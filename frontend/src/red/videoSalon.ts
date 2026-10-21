// ============================================================
// VIDEO SALÓN: cámara web de un participante junto a su avatar
// ------------------------------------------------------------
// Cuando alguien enciende la webcam, LOS DEMÁS ven un cuadrito
// de vídeo flotando junto a su personaje 3D (proyectado en
// pantalla cada frame con la cámara de la escena). El flujo de
// vídeo viaja P2P por WebRTC; el servidor solo reenvía las
// ofertas SDP y los candidatos ICE (señalización, ver
// backend/src/tiempoReal.ts).
//
// ── TOPOLOGÍA ──────────────────────────────────────────────
// Malla completa: cada persona con la cámara encendida mantiene
// un RTCPeerConnection por cada otro participante de la clase.
// Para una clase típica (1 docente presentando + N estudiantes)
// eso es N conexiones, suficiente. Si un nuevo estudiante entra
// mientras el docente ya está presentando, el docente le manda
// una oferta al verlo aparecer en la lista.
//
// ── PERFECT NEGOTIATION ────────────────────────────────────
// Si dos personas encienden la cámara a la vez, ambos envían
// ofertas a la vez (glare). Se usa el patrón "perfect
// negotiation" de MDN: el socket con id menor es "polite" y
// acepta la oferta remota; el mayor la descarta y sigue con la
// suya. Así nunca queda una conexión a medias.
//
// ── RENEGOCIAR AL ENCENDER ─────────────────────────────────
// Aunque los transceivers de audio y vídeo se crean de fábrica,
// encender la cámara o el micrófono sobre una conexión YA
// establecida exige una renegociación: replaceTrack solo no
// arranca el envío en algunos navegadores y el cuadrito remoto
// queda NEGRO (pista viva, sin fotogramas). Al encender se
// reofrece a todos los pares existentes (ver renegociar).
//
// ── EL CUADRITO EN PANTALLA ────────────────────────────────
// No es un HUD fijo: su posición 3D (la cabeza del avatar) se
// proyecta con BABYLON.Vector3.Project en cada frame, igual que
// un billboard, pero en el DOM. Si el avatar queda fuera de la
// pantalla o detrás de la cámara, el cuadrito se oculta.
// ============================================================

import * as BABYLON from "babylonjs";

/** Qué tan grande es el cuadrito de vídeo en píxeles. */
const ANCHO_CUADRITO = 132;

/** Tope de pares WebRTC simultáneos (protege contra bucles raros). */
const MAX_PARES = 24;

/**
 * Tras un "glare" (las dos cámaras se encienden a la vez y chocan dos
 * ofertas), una de las dos puede quedar sin enviar vídeo aunque la
 * conexión esté viva: el cuadrito sale NEGRO (hay pista, pero sin
 * fotogramas). Este temporizador vigila cada par: si la conexión está
 * "connected" y el otro dice que tiene la cámara encendida, pero no han
 * llegado fotogramas en ese tiempo, se manda una oferta de REPARACIÓN.
 */
const ESPERA_FOTOGRAMAS_MS = 6000;

/** Cuánto se espera entre una oferta de reparación y la siguiente. */
const INTERVALO_REPARACION_MS = 5000;

/**
 * Si una oferta MÍA no tiene respuesta tras este tiempo (el otro la
 * descartó en un glare y nunca llegó la respuesta), el par queda colgado
 * en `have-local-offer` y ya no se puede reparar. Se revierte la oferta
 * para volver a "stable" y poder reintentar.
 */
const OFERTA_COLGADA_MS = 8000;

/** ICE: solo STUN público. Para producción con NATs duros haría falta TURN. */
const CONFIG_RTC: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

/** Canal de señalización (delegado en la presencia / el socket de la sala). */
export interface SignalingSalon {
  emitir: (evento: string, datos: unknown) => void;
  /** Devuelve la función para quitar el listener. */
  escuchar: (evento: string, fn: (datos: any) => void) => () => void;
}

export interface OpcionesVideoSalon {
  escena: BABYLON.Scene;
  signaling: SignalingSalon;
  /** Flujo local de la webcam (null si está apagada). */
  obtenerFlujoLocal: () => MediaStream | null;
  /** Flujo local del micrófono (null si está apagado). */
  obtenerFlujoMicrofono: () => MediaStream | null;
  /** Volumen general del salón (0..1), para el audio remoto. */
  volumen: () => number;
  /** Cabeza del avatar remoto en unidades del salón (null si no existe aún). */
  posicionCabeza: (id: string) => BABYLON.Vector3 | null;
  /** Ancho de la etiqueta del nombre en unidades (para apartar el cuadrito y no taparla). */
  anchoEtiqueta: () => number;
  /** Nombre visible de un participante (para la etiqueta del cuadrito). */
  nombreDe: (id: string) => string;
  /** Se ejecuta al salir de la partida (para no dejar listeners). */
  limpiadores: Array<() => void>;
}

export interface VideoSalon {
  /**
   * Fija el id propio de socket (lo llama metaverso cuando lo sabe):
   * así se distinguen las ofertas propias de las ajenas y no se crea
   * un par consigo mismo.
   */
  fijarId: (id: string) => void;
  /**
   * Llamar DESPUÉS de encender/apagar la webcam local: publica el estado
   * a la sala y, si se enciende, ofrece el flujo a todos los presentes.
   */
  publicarEstadoCamara: (encendida: boolean) => void;
  /**
   * Llamar DESPUÉS de encender/apagar el micrófono local: publica el
   * estado a la sala, enchufa (o desenchufa) la pista de audio en cada
   * par WebRTC y, si nadie más tiene cámara ni micro, cierra las
   * conexiones (ya no se transmite nada).
   */
  publicarEstadoMicrofono: (encendida: boolean) => void;
  /**
   * Llamar cuando cambia la lista de participantes: si la cámara o el
   * micrófono local están encendidos, se ofrece el flujo a los que
   * acaban de entrar.
   */
  actualizarParticipantes: (ids: string[]) => void;
  /** Cierra todos los pares, quita los cuadritos y los listeners. */
  destruir: () => void;
}

interface ParVideo {
  id: string;
  pc: RTCPeerConnection;
  /** true mientras se está creando/rodando una oferta local (perfect negotiation). */
  makingOffer: boolean;
  /** true si hay que ignorar la oferta remota entrante (glare, lado impolite). */
  ignoreOffer: boolean;
  /** Cuadrito DOM con el <video> remoto (null hasta que llega el stream). */
  caja: HTMLDivElement | null;
  /** Pista remota de vídeo: su estado `muted` es quien dice si hay imagen. */
  pistaVideo: MediaStreamTrack | null;
  /** Flujo propio con esa pista, enchufado al <video> del cuadrito. */
  flujoVideo: MediaStream | null;
  /** <audio> oculto con la voz remota (null hasta que llega la pista). */
  audio: HTMLAudioElement | null;
  /** Emisor de la pista de audio local (existe aunque no haya mic todavía). */
  emisorAudio: RTCRtpSender | null;
  /** Emisor de la pista de vídeo local (existe aunque no haya cámara). */
  emisorVideo: RTCRtpSender | null;
  /**
   * Marca de tiempo (ms) del último "unmute" de la pista de vídeo remota:
   * es decir, del último fotograma recibido. 0 = aún no ha llegado ninguno.
   * Sirve para detectar el caso "conexión viva, cuadrito negro" y reparar
   * la oferta (ver ESPERA_FOTOGRAMAS_MS).
   */
  ultimoFotograma: number;
  /** true si el OTRO tiene la CÁMARA encendida según su último video:estado. */
  remotoTransmite: boolean;
  /** Marca de tiempo de la última oferta de reparación enviada (0 = ninguna). */
  ultimaReparacion: number;
  /**
   * Marca de tiempo de la última oferta MÍA enviada que aún no ha tenido
   * respuesta (0 = no hay oferta colgada). Si pasa demasiado tiempo en
   * `have-local-offer`, la oferta se revierte para no bloquear el par.
   */
  ultimaOfertaLocal: number;
  /** Limpia el listener de ontrack etc. */
  limpiar: () => void;
}

// ---------------------------------------------------------------
// ESTILO del cuadrito remoto (se inyecta una sola vez)
// ---------------------------------------------------------------

const ESTILO = `
.vs-caja{position:fixed;left:0;top:0;width:${ANCHO_CUADRITO}px;border-radius:10px;overflow:hidden;background:#0B1220;border:1px solid rgba(255,255,255,0.22);box-shadow:0 8px 22px rgba(0,0,0,0.5);z-index:1400;font-family:sans-serif;display:none;pointer-events:none;will-change:transform}
.vs-caja.vs-visible{display:block}
.vs-video{display:block;width:100%;height:${ANCHO_CUADRITO}px;object-fit:cover;background:#000}
.vs-etiqueta{position:absolute;left:5px;bottom:5px;font-size:10px;line-height:1.2;color:#E2E8F0;background:rgba(0,0,0,0.55);border-radius:4px;padding:2px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:calc(100% - 10px)}
`;

function inyectarEstilo(): void {
  if (document.getElementById("vs-estilo")) return;
  const estilo = document.createElement("style");
  estilo.id = "vs-estilo";
  estilo.textContent = ESTILO;
  document.head.appendChild(estilo);
}

// ---------------------------------------------------------------

export function crearVideoSalon(ctx: OpcionesVideoSalon): VideoSalon {
  inyectarEstilo();

  const pares = new Map<string, ParVideo>();
  let camaraLocalEncendida = false;
  let microLocalEncendido = false;
  let idsSala: string[] = [];
  let idPropio = "";
  /**
   * ¿El OTRO tiene la CÁMARA encendida según su último `video:estado`?
   * (Solo la cámara: el micro no dibuja imagen y no interesa reparar
   * cuadritos por él.) Se guarda aunque el par todavía no exista: el
   * mensaje puede llegar ANTES que la oferta, y crearPar() lo usa para no
   * marcar como "sin cámara" a alguien que sí la tiene.
   */
  const estadoRemoto = new Map<string, boolean>();
  /** Último momento en que se revisaron los pares para reparar sin fotogramas. */
  let ultimaRevisionReparacion = 0;
  const quitadores: Array<() => void> = [];

  // ---------------------------------------------------------------
  // CUADRITO DOM por par remoto
  // ---------------------------------------------------------------

  function crearCaja(id: string): HTMLDivElement {
    const caja = document.createElement("div");
    caja.className = "vs-caja";
    caja.innerHTML = `
      <video class="vs-video" autoplay playsinline muted></video>
      <span class="vs-etiqueta"></span>
    `;
    const etiqueta = caja.querySelector<HTMLElement>(".vs-etiqueta")!;
    etiqueta.textContent = ctx.nombreDe(id) || "…";
    document.body.appendChild(caja);
    return caja;
  }

  function borrarCaja(caja: HTMLDivElement | null): void {
    caja?.remove();
  }

  // ---------------------------------------------------------------
  // ¿HAY IMAGEN? El que manda es el estado de la PISTA remota.
  // ---------------------------------------------------------------
  // OJO: los eventos "mute"/"unmute" del propio <video> son del elemento (que
  // aquí va mudo a posta para no duplicar la voz) y NO se disparan cuando la
  // cámara del otro se enciende o se apaga. Quien lo sabe es la pista remota:
  // `pista.muted` pasa a false en cuanto llegan fotogramas (evento "unmute"
  // en la PISTA). Además, como esos eventos pueden llegar tarde o perderse,
  // la visibilidad se repasa en cada frame del bucle de proyección.
  //
  // OJO2: aquí NO se toca `par.ultimoFotograma`: que la pista esté
  // "unmuted" no prueba que haya fotogramas decodificados (el cuadrito
  // NEGRO justo eso es: pista viva, sin imagen). La marca de tiempo solo
  // la pone el requestVideoFrameCallback de conectarVideo (o el repaso de
  // `videoWidth` en la reparación).

  function refrescarVisibilidad(par: ParVideo): void {
    if (!par.caja) return;
    const pista = par.pistaVideo;
    const hayImagen = Boolean(pista && pista.readyState === "live" && !pista.muted);
    const yaSeVe = par.caja.classList.contains("vs-visible");
    if (hayImagen !== yaSeVe) par.caja.classList.toggle("vs-visible", hayImagen);
  }

  /** Cablea la pista remota de vídeo a su cuadrito (se hace una sola vez). */
  function conectarVideo(par: ParVideo, pista: MediaStreamTrack): void {
    if (par.pistaVideo === pista && par.caja) {
      refrescarVisibilidad(par);
      return;
    }
    par.pistaVideo = pista;
    if (!par.caja) par.caja = crearCaja(par.id);
    if (!par.flujoVideo) par.flujoVideo = new MediaStream();
    // Si el flujo ya tenía OTRA pista de vídeo (una renegociación trajo una
    // nueva), se quita la vieja: si el <video> se quedara con la primera —
    // ahora muerta— el cuadrito saldría NEGRO aunque llegue la nueva.
    for (const vieja of par.flujoVideo.getVideoTracks()) {
      if (vieja !== pista) par.flujoVideo.removeTrack(vieja);
    }
    if (!par.flujoVideo.getVideoTracks().includes(pista)) par.flujoVideo.addTrack(pista);

    const video = par.caja.querySelector<HTMLVideoElement>(".vs-video")!;
    if (video.srcObject !== par.flujoVideo) {
      video.srcObject = par.flujoVideo;
      video.play().catch(() => undefined);
    }
    const etiqueta = par.caja.querySelector<HTMLElement>(".vs-etiqueta")!;
    etiqueta.textContent = ctx.nombreDe(par.id) || "…";

    pista.addEventListener("mute", () => refrescarVisibilidad(par));
    pista.addEventListener("unmute", () => refrescarVisibilidad(par));
    pista.addEventListener("ended", () => refrescarVisibilidad(par));

    // Detección REAL de fotogramas: requestVideoFrameCallback solo se
    // dispara cuando el <video> decodifica un fotograma de verdad (no
    // basta con que la pista esté "unmuted"). Alimenta
    // par.ultimoFotograma, que es lo que usa la reparación para no
    // disparar ofertas falsas. Se corta solo si la pista cambia.
    type VideoConRvfc = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      webkitRequestVideoFrameCallback?: (cb: () => void) => number;
    };
    const rvfc =
      (video as VideoConRvfc).requestVideoFrameCallback ??
      (video as VideoConRvfc).webkitRequestVideoFrameCallback;
    if (rvfc) {
      const anotarFotograma = () => {
        if (par.pistaVideo !== pista || !par.caja) return;
        par.ultimoFotograma = Date.now();
        rvfc.call(video, anotarFotograma);
      };
      rvfc.call(video, anotarFotograma);
    }

    requestAnimationFrame(() => refrescarVisibilidad(par));
    refrescarVisibilidad(par);
  }

  /**
   * Oferta/respuesta/candidato MÍO? El servidor sí añade `de: socket.id` al
   * reenviar, pero solo se puede DESCARTAR el propio con seguridad cuando el
   * id propio ya está fijado (ver `fijarId`): mientras `idPropio` sigue vacío
   * —recién llegado— tratar "vacío === vacío" como propio descartaría TODAS
   * las ofertas de la gente que ya está en la sala, y la cámara de los demás
   * se quedaría en negro.
   */
  function esDeIdPropio(de: unknown): boolean {
    return idPropio !== "" && esIdPropio(de);
  }

  // ---------------------------------------------------------------
  // PARES WEBRTC (perfect negotiation)
  // ---------------------------------------------------------------

  function crearPar(id: string): ParVideo | null {
    if (pares.size >= MAX_PARES) return null;
    const existente = pares.get(id);
    if (existente) return existente;

    const pc = new RTCPeerConnection(CONFIG_RTC);
    const par: ParVideo = {
      id,
      pc,
      makingOffer: false,
      ignoreOffer: false,
      caja: null,
      pistaVideo: null,
      flujoVideo: null,
      audio: null,
      emisorAudio: null,
      emisorVideo: null,
      ultimoFotograma: 0,
      remotoTransmite: estadoRemoto.get(id) ?? false,
      ultimaReparacion: 0,
      ultimaOfertaLocal: 0,
      limpiar: () => {},
    };

    // Transceivers SIEMPRE para audio y vídeo (aunque no haya ni cámara ni
    // micro): así los m-lines ya están negociados de fábrica. Si la cámara
    // o el micrófono YA están encendidos, la pista se pasa DIRECTAMENTE a
    // addTransceiver para que la PRIMERA oferta ya la lleve. Si se
    // generara la oferta antes de que replaceTrack aplique (carrera con
    // onnegotiationneeded), el m-line de vídeo saldría sin SSRC y el otro
    // lado, aunque conectara, no recibiría fotogramas: cuadrito NEGRO. Si
    // aún no hay pista, se crea el transceiver "vacío" y al encender
    // después se renegocia (ver ofrecerA/renegociar).
    const flujoCamara0 = camaraLocalEncendida ? ctx.obtenerFlujoLocal() : null;
    const pistaVideo0 = flujoCamara0?.getVideoTracks()[0] ?? null;
    const flujoMicro0 = microLocalEncendido ? ctx.obtenerFlujoMicrofono() : null;
    const pistaAudio0 = flujoMicro0?.getAudioTracks()[0] ?? null;

    par.emisorAudio = pc.addTransceiver(pistaAudio0 ?? "audio", {
      direction: "sendrecv",
    }).sender;
    par.emisorVideo = pc.addTransceiver(pistaVideo0 ?? "video", {
      direction: "sendrecv",
    }).sender;
    void actualizarEmisores(par);

    pc.onicecandidate = (evento) => {
      if (evento.candidate) {
        ctx.signaling.emitir("video:candidate", {
          para: id,
          candidate: evento.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (evento) => {
      const pista = evento.track;

      // AUDIO: la voz del otro va a un <audio> oculto NO muted (el cuadrito
      // de vídeo sí va muted para no duplicar el sonido).
      if (pista.kind === "audio") {
        let audio = par.audio;
        if (!audio) {
          audio = document.createElement("audio");
          audio.autoplay = true;
          audio.style.display = "none";
          document.body.appendChild(audio);
          par.audio = audio;
        }
        const flujo = new MediaStream([pista]);
        if (audio.srcObject !== flujo) {
          audio.srcObject = flujo;
          audio.volume = ctx.volumen();
          void audio.play().catch(() => undefined);
        }
        return;
      }

      // VÍDEO: cuadrito flotante junto al avatar (muted: el sonido es del <audio>).
      // La visibilidad NO se decide aquí: al llegar puede que la cámara del
      // otro todavía no emita (pista en muted); eso lo resuelve
      // refrescarVisibilidad() en cuanto llegan fotogramas.
      conectarVideo(par, pista);
      // Actualiza la etiqueta por si el nombre llegó tarde.
      const etiqueta = par.caja?.querySelector<HTMLElement>(".vs-etiqueta");
      if (etiqueta) etiqueta.textContent = ctx.nombreDe(id) || "…";
    };

    pc.onnegotiationneeded = async () => {
      try {
        par.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) {
          par.ultimaOfertaLocal = Date.now();
          ctx.signaling.emitir("video:oferta", {
            para: id,
            tipo: pc.localDescription.type,
            sdp: pc.localDescription.sdp,
          });
        }
      } catch (error) {
        console.warn("[videoSalon] error en negotiationneeded:", error);
      } finally {
        par.makingOffer = false;
      }
    };

    // Si la conexión se cae del todo, se reconstruye el par desde cero: así
    // la siguiente oferta ya lleva las pistas locales enchufadas de fábrica
    // (ver el comentario de crearPar) y no se queda un m-line vacío.
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        cerrarPar(id);
      }
    };

    pares.set(id, par);
    return par;
  }

  function cerrarPar(id: string): void {
    const par = pares.get(id);
    if (!par) return;
    pares.delete(id);
    try {
      par.pc.onicecandidate = null;
      par.pc.ontrack = null;
      par.pc.onnegotiationneeded = null;
      par.pc.onconnectionstatechange = null;
      par.pc.close();
    } catch {
      // Ya estaba cerrado.
    }
    borrarCaja(par.caja);
    par.audio?.remove();
    par.audio = null;
    par.limpiar();
  }

  function cerrarTodos(): void {
    for (const id of [...pares.keys()]) cerrarPar(id);
  }

  // ---------------------------------------------------------------
  // SEÑALIZACIÓN ENTRANTE
  // ---------------------------------------------------------------

  function esIdPropio(de: unknown): boolean {
    return typeof de === "string" && de === idPropio;
  }

  // Señalización imperfecta (MDN): el socket con id MENOR es "polite" y
  // acepta la oferta remota; el MAYOR la descarta y sigue con la suya.
  function esPolite(de: string): boolean {
    return idPropio < de;
  }

  quitadores.push(
    ctx.signaling.escuchar("video:oferta", async (datos: any) => {
      const de = datos?.de;
      if (esDeIdPropio(de) || typeof de !== "string") return;

      const par = crearPar(de);
      if (!par) return;
      const { pc } = par;

      try {
        const descripcion = new RTCSessionDescription({
          type: datos.tipo === "answer" ? "answer" : "offer",
          sdp: String(datos.sdp ?? ""),
        });

        // Perfect negotiation (MDN): si chocan dos OFERTAS, el "impolite"
        // (id mayor) descarta la remota; el "polite" la acepta.
        //
        // El choque SOLO aplica a ofertas entrantes (como en MDN): una
        // RESPUESTA nunca se ignora. Si no, `ignoreOffer` se quedaría
        // clavado en true al procesar una respuesta en estado
        // have-local-offer y bloquearía para siempre las reparaciones
        // (repararParSinFotogramas lo salta).
        const ofertaEntrante = descripcion.type === "offer";
        const choque =
          ofertaEntrante && !(!par.makingOffer && pc.signalingState === "stable");
        par.ignoreOffer = !esPolite(de) && choque;
        if (par.ignoreOffer) return;

        await pc.setRemoteDescription(descripcion);
        // Tras aplicar la descripción remota, la oferta local pendiente (si
        // la hubo) quedó respondida o revertida: ya no hay oferta colgada.
        par.ultimaOfertaLocal = 0;

        if (descripcion.type === "offer") {
          await pc.setLocalDescription();
          if (pc.localDescription) {
            ctx.signaling.emitir("video:respuesta", {
              para: de,
              tipo: pc.localDescription.type,
              sdp: pc.localDescription.sdp,
            });
          }
        }
        // Descripción aplicada con éxito → se está en "stable": el episodio
        // de glare terminó. Si no se limpia aquí, `ignoreOffer` puede
        // quedarse en true (de un choque anterior) y bloquear para siempre
        // las reparaciones (repararParSinFotogramas lo salta).
        par.ignoreOffer = false;
      } catch (error) {
        if (!par.ignoreOffer) {
          console.warn("[videoSalon] error al procesar oferta:", error);
        }
      }
    }),
  );

  quitadores.push(
    ctx.signaling.escuchar("video:respuesta", async (datos: any) => {
      const de = datos?.de;
      if (esDeIdPropio(de) || typeof de !== "string") return;
      const par = pares.get(de);
      if (!par) return;
      // Una respuesta aceptada cierra el episodio de glare: se levanta el
      // bloqueo (si no, una oferta descartada dejaría ignoreOffer clavado
      // en true y las reparaciones nunca se dispararían).
      par.ignoreOffer = false;
      try {
        await par.pc.setRemoteDescription(
          new RTCSessionDescription({
            type: "answer",
            sdp: String(datos.sdp ?? ""),
          }),
        );
        // La respuesta cierra la negociación: ya no hay oferta local colgada.
        par.ultimaOfertaLocal = 0;
      } catch (error) {
        console.warn("[videoSalon] error al procesar respuesta:", error);
      }
    }),
  );

  quitadores.push(
    ctx.signaling.escuchar("video:candidate", async (datos: any) => {
      const de = datos?.de;
      if (esDeIdPropio(de) || typeof de !== "string") return;
      const par = pares.get(de);
      if (!par || !datos.candidate) return;
      try {
        await par.pc.addIceCandidate(
          new RTCIceCandidate(datos.candidate as RTCIceCandidateInit),
        );
      } catch (error) {
        if (!par.ignoreOffer) {
          console.warn("[videoSalon] error al añadir candidate:", error);
        }
      }
    }),
  );

  // Alguien de la sala cambió su estado (cámara y/o micrófono): se cierra
  // el par SOLO si ya no transmite NADA (ni cámara ni micro). Así un
  // participante que solo habla (sin webcam) mantiene su voz viva.
  quitadores.push(
    ctx.signaling.escuchar("video:estado", (datos: any) => {
      const id = datos?.id;
      if (esDeIdPropio(id) || typeof id !== "string") return;
      const camara = datos?.encendida === true;
      const micro = datos?.micro === true;
      // Solo la CÁMARA nos importa para reparar cuadritos negros (el micro
      // no dibuja imagen). Se guarda SIEMPRE, aunque el par aún no exista:
      // el video:estado puede llegar antes que la oferta, y crearPar() lo
      // usa para saber si hay que reparar si el cuadrito queda negro.
      estadoRemoto.set(id, camara);
      const par = pares.get(id);
      if (par) par.remotoTransmite = camara;
      // Se cierra el par SOLO si ya no transmite NADA (ni cámara ni micro).
      if (!camara && !micro) cerrarPar(id);
    }),
  );

  // ---------------------------------------------------------------
  // OFRECER EL FLUJO LOCAL A TODOS LOS PRESENTES
  // ---------------------------------------------------------------

  /**
   * Enchufa (o desenchufa) las pistas locales en los emisores del par.
   * Devuelve una promesa que resuelve cuando replaceTrack YA APLICÓ: hay
   * que esperarla antes de renegociar, porque si la oferta se genera
   * antes de que la pista esté en el emisor, el m-line sale sin SSRC y
   * el otro no recibe imagen (cuadrito NEGRO). Nunca rechaza.
   */
  async function actualizarEmisores(par: ParVideo): Promise<void> {
    const flujoCamara = camaraLocalEncendida ? ctx.obtenerFlujoLocal() : null;
    const pistaVideo = flujoCamara?.getVideoTracks()[0] ?? null;

    const flujoMicro = microLocalEncendido ? ctx.obtenerFlujoMicrofono() : null;
    const pistaAudio = flujoMicro?.getAudioTracks()[0] ?? null;

    await Promise.all([
      par.emisorVideo?.replaceTrack(pistaVideo) ?? Promise.resolve(),
      par.emisorAudio?.replaceTrack(pistaAudio) ?? Promise.resolve(),
    ]).catch(() => undefined);
  }

  /**
   * Fuerza una renegociación con un par YA conectado. Hace falta al
   * encender la cámara o el micrófono sobre un par existente: aunque los
   * transceivers ya estaban negociados, replaceTrack solo no arranca el
   * envío en algunos navegadores y el cuadrito remoto sale NEGRO (pista
   * viva, sin fotogramas). Al reenviar la oferta con la pista ya
   * enchufada, el otro recibe la asociación nueva y la imagen/voz arranca.
   */
  async function renegociar(par: ParVideo): Promise<void> {
    if (par.makingOffer || par.pc.signalingState !== "stable") return;
    try {
      par.makingOffer = true;
      await par.pc.setLocalDescription();
      if (par.pc.localDescription) {
        par.ultimaOfertaLocal = Date.now();
        ctx.signaling.emitir("video:oferta", {
          para: par.id,
          tipo: par.pc.localDescription.type,
          sdp: par.pc.localDescription.sdp,
        });
      }
    } catch (error) {
      console.warn("[videoSalon] error al renegociar:", error);
    } finally {
      par.makingOffer = false;
    }
  }

  async function ofrecerA(id: string): Promise<void> {
    // Solo tiene sentido ofrecer la conexión si se transmite algo
    // (cámara o micrófono); si no, no hay nada que enviar.
    if (!camaraLocalEncendida && !microLocalEncendido) return;

    try {
      const yaExistia = pares.has(id);
      const par = crearPar(id);
      if (!par) return;
      // Espera a que la pista esté EN el emisor antes de renegociar: si
      // no, la oferta puede salir sin la pista (m-line sin SSRC) y el
      // cuadrito remoto queda NEGRO.
      await actualizarEmisores(par);
      // Par nuevo: la primera oferta (onnegotiationneeded) ya lleva la
      // pista de fábrica (se pasó a addTransceiver). Par YA negociado:
      // replaceTrack no basta, hay que renegociar para que el otro
      // empiece a recibir la pista nueva (si no, cuadrito NEGRO — el
      // fallo del segundo usuario en encender la cámara).
      if (yaExistia) await renegociar(par);
    } catch {
      // Un par que falle no debe tirar abajo el ofrecimiento a los demás.
    }
  }

  /**
   * Vigila todos los pares conectados y, si alguno muestra un cuadrito
   * NEGRO (conexión viva pero sin imagen), fuerza una renegociación. Se
   * dispara por el SÍNTOMA (el <video> no decodifica), no solo por el
   * estado remoto, para no quedarse en negro si el video:estado no llegó.
   * También recupera ofertas colgadas en have-local-offer que bloquearían
   * el par para siempre.
   */
  function repararParSinFotogramas(): void {
    const ahora = Date.now();
    for (const par of pares.values()) {
      if (par.pc.connectionState !== "connected") continue;
      if (par.makingOffer || par.ignoreOffer) continue;

      // OFERTA COLGADA: mandamos una oferta que nunca fue contestada (el
      // otro la descartó en un glare). Si no se revierte, el par queda en
      // have-local-offer y ya no se puede reparar (todo lo de abajo lo
      // saltaría). Se revierte a "stable" para reintentar en el próximo
      // tick.
      if (par.pc.signalingState === "have-local-offer") {
        if (par.ultimaOfertaLocal && ahora - par.ultimaOfertaLocal > OFERTA_COLGADA_MS) {
          par.ultimaOfertaLocal = 0;
          par.ignoreOffer = false; // el glare quedó atrás al revertir
          void par.pc.setLocalDescription({ type: "rollback" }).catch(() => undefined);
        }
        continue;
      }
      if (par.pc.signalingState !== "stable") continue;
      if (ahora - par.ultimaReparacion < INTERVALO_REPARACION_MS) continue;

      const video = par.caja?.querySelector<HTMLVideoElement>(".vs-video");
      const pista = par.pistaVideo;
      const recibiendoRtp = Boolean(pista && pista.readyState === "live" && !pista.muted);
      const videoNegro = !video || video.videoWidth === 0;

      // Si el <video> decodifica fotogramas de verdad, apuntarlo (respaldo
      // por si requestVideoFrameCallback no estuviera disponible).
      if (video && video.videoWidth > 0) par.ultimoFotograma = ahora;

      // Caso A (síntoma directo): la pista dice que recibe RTP pero el
      // <video> no decodifica nada → cuadrito NEGRO. No depende del estado.
      const cajaNegra = recibiendoRtp && videoNegro;
      // Caso B: el remoto tiene la CÁMARA encendida pero aún no ha llegado
      // fotograma nunca (o hace mucho).
      const esperando =
        par.remotoTransmite &&
        (par.ultimoFotograma === 0 || ahora - par.ultimoFotograma > ESPERA_FOTOGRAMAS_MS);

      if (!cajaNegra && !esperando) continue;

      // El <video> está conectado pero congelado: reconectar la pista y
      // reproducir. A veces basta con esto (sin tocar la negociación).
      if (video && par.flujoVideo) {
        if (video.srcObject !== par.flujoVideo) video.srcObject = par.flujoVideo;
        if (video.paused) void video.play().catch(() => undefined);
      }

      // Renegociación: al reenviar la oferta con las pistas ya enchufadas,
      // el OTRO lado vuelve a describir sus emisores y la imagen arranca.
      par.ultimaReparacion = ahora;
      par.makingOffer = true;
      par.ultimaOfertaLocal = ahora;
      void par.pc
        .createOffer()
        .then((oferta) => par.pc.setLocalDescription(oferta))
        .then(() => {
          if (!par.pc.localDescription) return;
          ctx.signaling.emitir("video:oferta", {
            para: par.id,
            tipo: par.pc.localDescription.type,
            sdp: par.pc.localDescription.sdp,
          });
        })
        .catch(() => undefined)
        .finally(() => {
          par.makingOffer = false;
        });
      return; // una reparación por tick: no saturar la sala
    }
  }

  // ---------------------------------------------------------------
  // PROYECCIÓN DEL CUADRITO JUNTO AL AVATAR (cada frame)
  // ---------------------------------------------------------------

  const observador = ctx.escena.onBeforeRenderObservable.add(() => {
    const camara = ctx.escena.activeCamera;
    if (!camara) return;

    // De vez en cuando se mira si hay algún par "connected" pero sin
    // fotogramas (cuadrito negro) y se reofrece: es el caso típico de un
    // "glare" mal resuelto al encender varias cámaras a la vez.
    if (Date.now() - ultimaRevisionReparacion > INTERVALO_REPARACION_MS) {
      ultimaRevisionReparacion = Date.now();
      repararParSinFotogramas();
    }

    const motor = ctx.escena.getEngine();
    const ancho = motor.getRenderWidth();
    const alto = motor.getRenderHeight();
    const viewport = camara.viewport.toGlobal(ancho, alto);
    const transform = ctx.escena.getTransformMatrix();
    const identidad = BABYLON.Matrix.Identity();

    for (const par of pares.values()) {
      // El volumen de la voz remota sigue al general (🔊 del menú).
      if (par.audio) {
        const v = Math.min(1, Math.max(0, ctx.volumen()));
        if (par.audio.volume !== v) par.audio.volume = v;
      }

      // CABLEADO + VISIBILIDAD. Normalmente el cablea `ontrack`; este
      // respaldo, por si ese evento no llegara, coge la pista del
      // transceptor que sí está NEGOCIADO (mid != null): así no se coge por
      // error la pista de un transceptor local aún no asociado al SDP.
      if (!par.pistaVideo) {
        const negociado = par.pc
          .getTransceivers()
          .find((t) => t.mid !== null && t.receiver.track?.kind === "video");
        if (negociado?.receiver.track) conectarVideo(par, negociado.receiver.track);
      } else {
        refrescarVisibilidad(par);
      }

      if (!par.caja || !par.caja.classList.contains("vs-visible")) {
        // Cámara apagada (o aún sin imagen): el cuadrito NO debe quedarse
        // congelado en pantalla con el último fotograma.
        if (par.caja && par.caja.style.display !== "none") par.caja.style.display = "none";
        continue;
      }

      const cabeza = ctx.posicionCabeza(par.id);
      if (!cabeza) {
        par.caja.style.display = "none";
        continue;
      }

      const proyectada = BABYLON.Vector3.Project(
        cabeza,
        identidad,
        transform,
        viewport,
      );

      // z fuera de [0,1] = detrás de la cámara o demasiado lejos.
      const fuera =
        proyectada.z < 0 ||
        proyectada.z > 1 ||
        proyectada.x < -ANCHO_CUADRITO ||
        proyectada.x > ancho + ANCHO_CUADRITO ||
        proyectada.y < -ANCHO_CUADRITO ||
        proyectada.y > alto + ANCHO_CUADRITO;

      if (fuera) {
        par.caja.style.display = "none";
        continue;
      }

      // AL LADO del personaje (no encima): a la derecha de la etiqueta del
      // nombre, centrado en vertical con la cabeza. El hueco se calcula
      // proyectando medio ancho de etiqueta para no taparla nunca; si a la
      // derecha no cabe, el cuadrito se va a la izquierda de la cabeza.
      const derechaCamara = camara.getDirection(BABYLON.Axis.X);
      const bordeEtiqueta = BABYLON.Vector3.Project(
        cabeza.add(derechaCamara.scale(ctx.anchoEtiqueta() / 2)),
        identidad,
        transform,
        viewport,
      );
      const hueco = Math.max(10, Math.round(bordeEtiqueta.x - proyectada.x) + 8);

      const cabeDerecha = proyectada.x + hueco + ANCHO_CUADRITO <= ancho;
      const x = cabeDerecha
        ? proyectada.x + hueco
        : proyectada.x - hueco - ANCHO_CUADRITO;

      par.caja.style.display = "block";
      par.caja.style.transform =
        `translate(${Math.round(x)}px, ${Math.round(proyectada.y)}px) translateY(-50%)`;
    }
  });

  // ---------------------------------------------------------------
  // API PÚBLICA
  // ---------------------------------------------------------------

  /**
   * Fija el id propio de socket (lo llama metaverso cuando lo sabe): así se
   * distinguen las ofertas propias de las ajenas y no se crea un par
   * consigo mismo.
   *
   * IMPORTANTE: se permite fijar el id "vacío" para saber que el id propio
   * AÚN NO ha llegado (ver `esDeIdPropio`): si no, las ofertas de todos
   * se descartarían como propias. En cuanto llega el id real, se ofrece el
   * flujo local a los que ya estaban en la sala antes de saberlo.
   */
  function fijarId(id: string): void {
    idPropio = id ?? "";
    if (!idPropio) return;

    if (!camaraLocalEncendida && !microLocalEncendido) return;
    for (const otro of idsSala) {
      if (otro !== idPropio && !pares.has(otro)) void ofrecerA(otro);
    }
  }

  function publicarEstadoCamara(encendida: boolean): void {
    camaraLocalEncendida = encendida;
    ctx.signaling.emitir("video:estado", { encendida, micro: microLocalEncendido });

    if (!encendida && !microLocalEncendido) {
      // Apagada y sin micrófono: no se transmite nada, se cierran los pares.
      // Los remotos cierran su lado al recibir video:estado con ambos flags
      // en false (si el micro sigue encendido, la conexión se queda viva
      // solo para la voz).
      cerrarTodos();
      return;
    }

    if (encendida) {
      // Ofrecer a todos los de la sala. Se une con los pares que ya
      // existen para no saltarse a nadie (por si el roster aún no lo
      // trae, o viene de un video:estado previo).
      const destinos = new Set([...idsSala, ...pares.keys()]);
      for (const id of destinos) {
        if (id !== idPropio) void ofrecerA(id);
      }
    } else {
      // Cámara apagada pero el micro sigue: se desenchufa la pista de
      // vídeo en cada par (la conexión se queda viva solo para la voz).
      for (const par of pares.values()) {
        void par.emisorVideo?.replaceTrack(null).catch(() => undefined);
      }
    }
  }

  function publicarEstadoMicrofono(encendida: boolean): void {
    microLocalEncendido = encendida;
    ctx.signaling.emitir("video:estado", { encendida: camaraLocalEncendida, micro: encendida });

    // La pista de audio se enchufa (o desenchufa) en cada par existente.
    // El transceiver ya estaba negociado al crear el par, pero al ENCENDER
    // replaceTrack no basta en algunos navegadores: se fuerza también una
    // renegociación para que el otro empiece a recibir la voz.
    const flujo = encendida ? ctx.obtenerFlujoMicrofono() : null;
    const pista = flujo?.getAudioTracks()[0] ?? null;
    for (const par of pares.values()) {
      // replaceTrack PRIMERO (esperado) y DESPUÉS renegociar: si la oferta
      // sale antes de que el emisor tenga la pista, no se envía audio.
      void par.emisorAudio
        ?.replaceTrack(pista)
        .catch(() => undefined)
        .then(() => (encendida ? renegociar(par) : undefined))
        .catch(() => undefined);
    }

    if (encendida) {
      // Gente que ya está en la sala y todavía no tiene par con nosotros.
      for (const id of idsSala) {
        if (id !== idPropio && !pares.has(id)) void ofrecerA(id);
      }
    } else if (!camaraLocalEncendida) {
      // Micro apagado y sin cámara: ya no se transmite nada.
      cerrarTodos();
    }
  }

  function actualizarParticipantes(ids: string[]): void {
    const anteriores = new Set(idsSala);
    idsSala = ids;
    // Cerrar pares de gente que ya no está.
    for (const id of [...pares.keys()]) {
      if (!ids.includes(id)) cerrarPar(id);
    }
    // Y olvidar su estado de transmisión.
    for (const id of [...estadoRemoto.keys()]) {
      if (!ids.includes(id)) estadoRemoto.delete(id);
    }

    // Alguien NUEVO entra: si yo transmito (cámara o micro), le reenvío mi
    // estado ahora. Él pudo entrar DESPUÉS de que yo encendiera la cámara,
    // y entonces nunca recibió mi video:estado original; sin él no sabe
    // que transmito y no podría reparar un cuadrito negro. El servidor
    // reenvía video:estado al resto de la sala (el recién llegado lo
    // recibe; a los demás no les hace nada).
    const hayRecienLlegado = ids.some((id) => id !== idPropio && !anteriores.has(id));
    if (hayRecienLlegado && (camaraLocalEncendida || microLocalEncendido)) {
      ctx.signaling.emitir("video:estado", {
        encendida: camaraLocalEncendida,
        micro: microLocalEncendido,
      });
    }

    // Si se transmite algo (cámara o micro), ofrecer a los recién llegados.
    if (camaraLocalEncendida || microLocalEncendido) {
      for (const id of ids) {
        if (id !== idPropio && !pares.has(id)) void ofrecerA(id);
      }
    }
  }

  function destruir(): void {
    ctx.escena.onBeforeRenderObservable.remove(observador);
    for (const quitar of quitadores) quitar();
    quitadores.length = 0;
    cerrarTodos();
  }

  ctx.limpiadores.push(destruir);

  return {
    fijarId,
    publicarEstadoCamara,
    publicarEstadoMicrofono,
    actualizarParticipantes,
    destruir,
  };
}
