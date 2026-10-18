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
   * Llamar cuando cambia la lista de participantes: si la cámara local
   * está encendida, se ofrece el flujo a los que acaban de entrar.
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
  let idsSala: string[] = [];
  let idPropio = "";
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
      limpiar: () => {},
    };

    // Añade el flujo local SI ya está encendido (así el otro lo recibe
    // sin tener que esperar a un renegotiationneeded futuro).
    const flujoLocal = ctx.obtenerFlujoLocal();
    if (flujoLocal) {
      for (const pista of flujoLocal.getTracks()) {
        pc.addTrack(pista, flujoLocal);
      }
    }

    pc.onicecandidate = (evento) => {
      if (evento.candidate) {
        ctx.signaling.emitir("video:candidate", {
          para: id,
          candidate: evento.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (evento) => {
      const [pista] = evento.streams;
      if (!pista) return;
      if (!par.caja) par.caja = crearCaja(id);
      const video = par.caja.querySelector<HTMLVideoElement>(".vs-video")!;
      if (video.srcObject !== pista) {
        video.srcObject = pista;
        video.play().catch(() => undefined);
      }
      par.caja.classList.add("vs-visible");
      // Actualiza la etiqueta por si el nombre llegó tarde.
      const etiqueta = par.caja.querySelector<HTMLElement>(".vs-etiqueta")!;
      etiqueta.textContent = ctx.nombreDe(id) || "…";
    };

    pc.onnegotiationneeded = async () => {
      try {
        par.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) {
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

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed" ||
        pc.connectionState === "disconnected"
      ) {
        // "disconnected" puede recuperarse solo; se espera un poco antes
        // de destruir el par.
        if (pc.connectionState !== "disconnected") cerrarPar(id);
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

  quitadores.push(
    ctx.signaling.escuchar("video:oferta", async (datos: any) => {
      const de = datos?.de;
      if (esIdPropio(de) || typeof de !== "string") return;

      const par = crearPar(de);
      if (!par) return;
      const { pc } = par;

      try {
        const descripcion = new RTCSessionDescription({
          type: datos.tipo === "answer" ? "answer" : "offer",
          sdp: String(datos.sdp ?? ""),
        });

        // Perfect negotiation (MDN): si chocan ofertas, el "impolite"
        // (id mayor) descarta la remota; el "polite" la acepta.
        const conflicto = pc.signalingState !== "stable";
        const ofertaEntrante = descripcion.type === "offer";
        par.ignoreOffer = conflicto && idPropio > de;
        if (par.ignoreOffer && ofertaEntrante) return;

        await pc.setRemoteDescription(descripcion);

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
      if (esIdPropio(de) || typeof de !== "string") return;
      const par = pares.get(de);
      if (!par) return;
      try {
        await par.pc.setRemoteDescription(
          new RTCSessionDescription({
            type: "answer",
            sdp: String(datos.sdp ?? ""),
          }),
        );
      } catch (error) {
        console.warn("[videoSalon] error al procesar respuesta:", error);
      }
    }),
  );

  quitadores.push(
    ctx.signaling.escuchar("video:candidate", async (datos: any) => {
      const de = datos?.de;
      if (esIdPropio(de) || typeof de !== "string") return;
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

  // Alguien de la sala apagó la cámara: se cierra el par para no
  // conservar un vídeo congelado.
  quitadores.push(
    ctx.signaling.escuchar("video:estado", (datos: any) => {
      const id = datos?.id;
      if (esIdPropio(id) || typeof id !== "string") return;
      if (datos?.encendida === false) cerrarPar(id);
    }),
  );

  // ---------------------------------------------------------------
  // OFRECER EL FLUJO LOCAL A TODOS LOS PRESENTES
  // ---------------------------------------------------------------

  function ofrecerA(id: string): void {
    if (!camaraLocalEncendida) return;
    const flujo = ctx.obtenerFlujoLocal();
    if (!flujo) return;

    const par = crearPar(id);
    if (!par) return;

    // Si el par ya existe pero el flujo se encendió DESPUÉS de crearlo,
    // hay que añadir las pistas ahora (dispara negotiationneeded solo).
    const pistasEnviadas = par.pc
      .getSenders()
      .map((s) => s.track)
      .filter(Boolean);
    if (pistasEnviadas.length === 0) {
      for (const pista of flujo.getTracks()) {
        par.pc.addTrack(pista, flujo);
      }
    }
  }

  // ---------------------------------------------------------------
  // PROYECCIÓN DEL CUADRITO JUNTO AL AVATAR (cada frame)
  // ---------------------------------------------------------------

  const observador = ctx.escena.onBeforeRenderObservable.add(() => {
    const camara = ctx.escena.activeCamera;
    if (!camara) return;

    const motor = ctx.escena.getEngine();
    const ancho = motor.getRenderWidth();
    const alto = motor.getRenderHeight();
    const viewport = camara.viewport.toGlobal(ancho, alto);
    const transform = ctx.escena.getTransformMatrix();
    const identidad = BABYLON.Matrix.Identity();

    for (const par of pares.values()) {
      if (!par.caja || !par.caja.classList.contains("vs-visible")) continue;

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

  function fijarId(id: string): void {
    if (id) idPropio = id;
  }

  function publicarEstadoCamara(encendida: boolean): void {
    camaraLocalEncendida = encendida;
    ctx.signaling.emitir("video:estado", { encendida });

    if (!encendida) {
      // Apagada: cerrar todos los pares (dejan de enviarnos vídeo).
      // Los remotos cierran su lado al recibir video:estado false.
      cerrarTodos();
      return;
    }

    // Encendida: ofrecer el flujo a todos los que ya están en la sala.
    for (const id of idsSala) {
      if (id !== idPropio) ofrecerA(id);
    }
  }

  function actualizarParticipantes(ids: string[]): void {
    idsSala = ids;
    // Cerrar pares de gente que ya no está.
    for (const id of [...pares.keys()]) {
      if (!ids.includes(id)) cerrarPar(id);
    }
    // Si la cámara está encendida, ofrecer a los recién llegados.
    if (camaraLocalEncendida) {
      for (const id of ids) {
        if (id !== idPropio && !pares.has(id)) ofrecerA(id);
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
    actualizarParticipantes,
    destruir,
  };
}
