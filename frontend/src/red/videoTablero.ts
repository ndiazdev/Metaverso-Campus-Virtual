// ============================================================
// VÍDEO DEL TABLERO EN DIRECTO (WebRTC)
// ------------------------------------------------------------
// Cuando el docente publica un vídeo subido desde su ordenador,
// el <video> que lo reproduce se captura con `captureStream()` y
// se manda a la sala P2P: cada alumno lo ve en su cajita personal
// y el profe lo ve en su vista del tablero. La pizarra 3D se queda
// apagada (proyectar ahí era lo que se glicheaba).
//
// ── TOPOLOGÍA ──────────────────────────────────────────────
// Solo hay UN emisor (el que publica) y N receptores. No hay
// "glare": el emisor ofrece y el receptor responde. El servidor
// solo reenvía ofertas SDP, respuestas y candidatos ICE de la
// MISMA sala (backend/src/tiempoReal.ts). El vídeo nunca pasa
// por el servidor.
//
// ── TARDE / SE VA ──────────────────────────────────────────
// Si alguien entra después, el emisor lo ve en la lista de
// participantes y le ofrece el flujo ya en marcha. Si el emisor
// para (limpiar, otro contenido), manda `activo:false` y los
// receptores retiran la cajita.
// ============================================================

/** Tope de pares simultáneos (una clase normal no llega ni de lejos). */
const MAX_PARES = 24;

/** ICE: STUN público; con NATs duros haría falta TURN (igual que videoSalon). */
const CONFIG_RTC: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

export interface SignalingVideoTablero {
  emitir: (evento: string, datos: unknown) => void;
  /** Devuelve la función para quitar el listener. */
  escuchar: (evento: string, fn: (datos: any) => void) => () => void;
}

export interface OpcionesVideoTablero {
  signaling: SignalingVideoTablero;
  /** Flujo recibido (o null cuando el emisor para). */
  alRecibir: (flujo: MediaStream | null) => void;
  /** Se ejecuta al salir de la partida (para no dejar listeners). */
  limpiadores?: Array<() => void>;
}

export interface VideoTablero {
  /** Id propio de socket (para no procesar ofertas propias). */
  fijarId: (id: string) => void;
  /** Lista de ids de la sala: ofrece el flujo a quien acabe de entrar. */
  actualizarParticipantes: (ids: string[]) => void;
  /** Flujo local a retransmitir (null = dejar de emitir). */
  publicar: (flujo: MediaStream | null) => void;
  /** Cierra pares, quita listeners y avisa al tablero de que no hay vídeo. */
  destruir: () => void;
}

interface Emisor {
  pc: RTCPeerConnection;
  /** true mientras se está creando/emitiendo una oferta. */
  ocupado: boolean;
}

interface Receptor {
  de: string;
  pc: RTCPeerConnection;
}

export function crearVideoTablero(ctx: OpcionesVideoTablero): VideoTablero {
  const emisores = new Map<string, Emisor>();
  let receptor: Receptor | null = null;
  let flujoLocal: MediaStream | null = null;
  let idPropio = "";
  let idsSala: string[] = [];
  const quitadores: Array<() => void> = [];

  const emitir = (evento: string, datos: unknown): void => {
    ctx.signaling.emitir(evento, datos);
  };

  function esAjeno(de: unknown): boolean {
    return typeof de === "string" && de !== "" && de !== idPropio;
  }

  // ---------------------------------------------------------------
  // EMISOR (el que publica el vídeo)
  // ---------------------------------------------------------------

  function cerrarEmisor(id: string): void {
    const emisor = emisores.get(id);
    if (!emisor) return;
    emisores.delete(id);
    try {
      emisor.pc.onicecandidate = null;
      emisor.pc.onconnectionstatechange = null;
      emisor.pc.close();
    } catch {
      // Ya estaba cerrado.
    }
  }

  function cerrarEmisores(): void {
    for (const id of [...emisores.keys()]) cerrarEmisor(id);
  }

  async function ofrecer(id: string): Promise<void> {
    if (!flujoLocal) return;

    let emisor = emisores.get(id);
    if (!emisor) {
      if (emisores.size >= MAX_PARES) return;
      const pc = new RTCPeerConnection(CONFIG_RTC);
      const video = flujoLocal.getVideoTracks()[0];
      const audio = flujoLocal.getAudioTracks()[0];
      // sendonly: el alumno solo recibe; no puede pausar ni mover nada.
      if (video) pc.addTransceiver(video, { direction: "sendonly" });
      if (audio) pc.addTransceiver(audio, { direction: "sendonly" });

      pc.onicecandidate = (evento) => {
        if (evento.candidate) {
          emitir("tablero-video:candidate", {
            para: id,
            candidate: evento.candidate.toJSON(),
          });
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          cerrarEmisor(id);
        }
      };

      emisor = { pc, ocupado: false };
      emisores.set(id, emisor);
    }

    if (emisor.ocupado || emisor.pc.signalingState !== "stable") return;
    emisor.ocupado = true;
    try {
      await emisor.pc.setLocalDescription();
      if (emisor.pc.localDescription) {
        emitir("tablero-video:oferta", {
          para: id,
          tipo: emisor.pc.localDescription.type,
          sdp: emisor.pc.localDescription.sdp,
        });
      }
    } catch (error) {
      console.warn("[videoTablero] error al ofrecer:", error);
    } finally {
      emisor.ocupado = false;
    }
  }

  // ---------------------------------------------------------------
  // RECEPTOR (alumnos y demás)
  // ---------------------------------------------------------------

  function cerrarReceptor(): void {
    const actual = receptor;
    receptor = null;
    if (!actual) return;
    try {
      actual.pc.onicecandidate = null;
      actual.pc.onconnectionstatechange = null;
      actual.pc.ontrack = null;
      actual.pc.close();
    } catch {
      // Ya estaba cerrado.
    }
    ctx.alRecibir(null);
  }

  function crearReceptor(de: string): Receptor {
    const pc = new RTCPeerConnection(CONFIG_RTC);
    const r: Receptor = { de, pc };
    // Un solo flujo por conexión: así el tablero recibe SIEMPRE el mismo
    // objeto cuando llega primero el vídeo y después el audio, y no rehace
    // la cajita (eso cortaría la reproducción).
    const flujo = new MediaStream();

    pc.ontrack = (evento) => {
      const pista = evento.track;
      // Renegociación (el mismo emisor cambia de vídeo): se quitan las pistas
      // viejas del mismo tipo para que el <video> no se quede congelado en el
      // último fotograma del vídeo anterior.
      const viejas =
        pista.kind === "video"
          ? flujo.getVideoTracks()
          : pista.kind === "audio"
            ? flujo.getAudioTracks()
            : [];
      for (const vieja of viejas) {
        if (vieja !== pista) flujo.removeTrack(vieja);
      }
      if (!flujo.getTracks().includes(pista)) flujo.addTrack(pista);
      ctx.alRecibir(flujo);
    };
    pc.onicecandidate = (evento) => {
      if (evento.candidate) {
        emitir("tablero-video:candidate", {
          para: de,
          candidate: evento.candidate.toJSON(),
        });
      }
    };
    pc.onconnectionstatechange = () => {
      if (
        receptor === r &&
        (pc.connectionState === "failed" || pc.connectionState === "closed")
      ) {
        cerrarReceptor();
      }
    };
    return r;
  }

  // ---------------------------------------------------------------
  // SEÑALIZACIÓN ENTRANTE
  // ---------------------------------------------------------------

  quitadores.push(
    ctx.signaling.escuchar("tablero-video:oferta", async (datos: any) => {
      const de = datos?.de;
      if (!esAjeno(de)) return;
      if (typeof datos?.sdp !== "string") return;

      // Solo hay un vídeo en el tablero: una oferta nueva sustituye a la
      // anterior (otro docente que publica, o el mismo renegociando).
      if (!receptor || receptor.de !== de) {
        cerrarReceptor();
        receptor = crearReceptor(de);
      }
      const actual = receptor;
      if (!actual) return;

      try {
        await actual.pc.setRemoteDescription(
          new RTCSessionDescription({ type: "offer", sdp: datos.sdp }),
        );
        await actual.pc.setLocalDescription();
        if (actual.pc.localDescription) {
          emitir("tablero-video:respuesta", {
            para: de,
            tipo: actual.pc.localDescription.type,
            sdp: actual.pc.localDescription.sdp,
          });
        }
      } catch (error) {
        console.warn("[videoTablero] error al responder la oferta:", error);
      }
    }),
  );

  quitadores.push(
    ctx.signaling.escuchar("tablero-video:respuesta", async (datos: any) => {
      const de = datos?.de;
      if (!esAjeno(de)) return;
      const emisor = emisores.get(de);
      if (!emisor || typeof datos?.sdp !== "string") return;
      try {
        await emisor.pc.setRemoteDescription(
          new RTCSessionDescription({ type: "answer", sdp: datos.sdp }),
        );
      } catch (error) {
        console.warn("[videoTablero] error al aplicar la respuesta:", error);
      }
    }),
  );

  quitadores.push(
    ctx.signaling.escuchar("tablero-video:candidate", async (datos: any) => {
      const de = datos?.de;
      if (!esAjeno(de)) return;
      const receptorActual = receptor;
      const pc =
        emisores.get(de)?.pc ??
        (receptorActual && receptorActual.de === de ? receptorActual.pc : null);
      if (!pc || !datos.candidate) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(datos.candidate));
      } catch {
        // Un candidato viejo de una conexión ya cerrada: se ignora.
      }
    }),
  );

  quitadores.push(
    ctx.signaling.escuchar("tablero-video:estado", (datos: any) => {
      const de = datos?.id;
      if (!esAjeno(de)) return;
      // El emisor paró (limpiar, otro contenido o se fue): se retira la cajita.
      if (datos?.activo !== true && receptor?.de === de) cerrarReceptor();
    }),
  );

  // ---------------------------------------------------------------
  // API PÚBLICA
  // ---------------------------------------------------------------

  function publicar(flujo: MediaStream | null): void {
    if (!flujo && !flujoLocal) return;
    // Pista nueva = conexiones nuevas: los pares viejos llevaban la anterior.
    cerrarEmisores();
    flujoLocal = flujo;

    if (!flujo) {
      emitir("tablero-video:estado", { activo: false });
      return;
    }

    emitir("tablero-video:estado", { activo: true });
    for (const id of idsSala) {
      if (id !== idPropio) void ofrecer(id);
    }
  }

  function fijarId(id: string): void {
    idPropio = id ?? "";
    if (!idPropio || !flujoLocal) return;
    for (const otro of idsSala) {
      if (otro !== idPropio && !emisores.has(otro)) void ofrecer(otro);
    }
  }

  function actualizarParticipantes(ids: string[]): void {
    idsSala = ids;

    for (const id of [...emisores.keys()]) {
      if (!ids.includes(id)) cerrarEmisor(id);
    }
    if (receptor && !ids.includes(receptor.de)) cerrarReceptor();

    if (!flujoLocal) return;
    for (const id of ids) {
      if (id !== idPropio && !emisores.has(id)) void ofrecer(id);
    }
  }

  function destruir(): void {
    for (const quitar of quitadores) quitar();
    quitadores.length = 0;
    cerrarEmisores();
    cerrarReceptor();
    flujoLocal = null;
  }

  ctx.limpiadores?.push(destruir);

  return { fijarId, actualizarParticipantes, publicar, destruir };
}
