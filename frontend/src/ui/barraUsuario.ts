/**
 * BARRA DE USUARIO del metaverso (barra horizontal con los botones primarios:
 * micrófono, audio, sentarse, alzar la mano, emotes y cámara).
 *
 * Módulo independiente: NO conoce Babylon ni la escena. Es solo interfaz:
 * avisa con `alPulsar(...)` y el mapa decide qué hace con cada botón. Así un
 * mapa nuevo solo la importa y no hay que reescribir botones por cada mapa:
 *
 *   const barra = crearBarraUsuario({
 *     alPulsar: (accion, detalle) => {
 *       if (accion === "sentarse") alternarSentado();
 *     },
 *   });
 *
 *   barra.reflejar({ sentado: true, cercaDeSilla: false });
 *   barra.mostrarGlobo("👋");
 *   barra.destruir();
 */

// Iconos: Font Awesome instalado como dependencia local (no CDN, que el wifi de la
// biblioteca puede filtrarlo). Se importa aquí para que cada módulo solo pague su CSS.
import "@fortawesome/fontawesome-free/css/all.min.css";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type AccionBarra =
  | "microfono" // fa-microphone: encender / apagar el micrófono
  | "audio" // fa-volume: silenciar / restaurar el sonido general
  | "sentarse" // fa-chair: sentarse / levantarse
  | "alzarMano" // fa-hand: alzar la mano
  | "emote" // fa-face-grin-beam: se emite un emote (detalle = el emoji)
  | "camara" // fa-eye: cambiar entre 1ª y 3ª persona
  | "webcam"; // fa-video: encender / apagar la cámara web propia

export type EstadoMicrofono = "encendido" | "apagado" | "sin-permiso" | "sin-soporte";

export interface OpcionesBarraUsuario {
  /** Se dispara con cada pulsación. `detalle` solo lo usa "emote" (el emoji elegido). */
  alPulsar: (accion: AccionBarra, detalle?: string) => void;
}

/** Estado del mundo que la barra pinta en sus botones. Todo es opcional. */
export interface EstadoBarraUsuario {
  microfono?: EstadoMicrofono;
  audioEncendido?: boolean;
  /** Apaga fa-chair si no hay silla cerca (evita pulsar un botón que no haría nada). */
  cercaDeSilla?: boolean;
  sentado?: boolean;
  manoAlzada?: boolean;
  terceraPersona?: boolean;
  webcamEncendida?: boolean;
}

export interface BarraUsuario {
  reflejar: (estado: EstadoBarraUsuario) => void;
  /** Globo efímero sobre la barra: emotes o avisos cortos (se oculta a los 2.5 s). */
  mostrarGlobo: (texto: string) => void;
  /** Quita la barra del DOM (al salir de la partida). */
  destruir: () => void;
}

// ---------------------------------------------------------------------------
// Contenido
// ---------------------------------------------------------------------------

// HTML, no texto: los iconos son <i class="fa-solid ..."> de Font Awesome.
// Orden pensado a mano (petición del usuario: los grupos, cambiados de lado):
// a la IZQUIERDA los controles de comunicación (micrófono, volumen y cámara
// web) y a la DERECHA lo del mundo (silla, mano, emotes, vista), con un
// separador en medio.
const BOTONES: Array<{ accion: AccionBarra; icono: string; titulo: string }> = [
  { accion: "microfono", icono: '<i class="fa-solid fa-microphone"></i>', titulo: "Micrófono" },
  { accion: "audio", icono: '<i class="fa-solid fa-volume"></i>', titulo: "Silenciar el sonido" },
  {
    accion: "webcam",
    icono: '<i class="fa-solid fa-video"></i>',
    titulo: "Cámara web",
  },
  {
    accion: "sentarse",
    icono: '<i class="fa-solid fa-chair"></i>',
    titulo: "Sentarse / levantarse (E)",
  },
  { accion: "alzarMano", icono: '<i class="fa-solid fa-hand"></i>', titulo: "Alzar la mano (H)" },
  { accion: "emote", icono: '<i class="fa-solid fa-face-grin-beam"></i>', titulo: "Emotes" },
  {
    accion: "camara",
    icono: '<i class="fa-solid fa-eye"></i>',
    titulo: "Cámara 1ª / 3ª persona (B)",
  },
];

const EMOTES = ["👋", "👏", "😂", "🎉", "👍", "❤️"];

const ESTILO = `
.bv-barra{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:8px 10px;background:rgba(15,23,42,0.92);border:1px solid rgba(255,255,255,0.15);border-radius:999px;z-index:1500;font-family:sans-serif;box-shadow:0 6px 18px rgba(0,0,0,0.35)}
.bv-boton{width:44px;height:44px;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,0.2);background:rgba(30,41,59,0.9);color:#E2E8F0;font-size:19px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .12s ease,background .12s ease,border-color .12s ease,box-shadow .12s ease,color .12s ease}
/* ENCIMA: se ilumina el borde del círculo (halo celeste) y el icono pasa a blanco. */
.bv-boton:hover:not(:disabled){transform:translateY(-2px);background:rgba(51,65,85,0.95);border-color:#7DD3FC;color:#fff;box-shadow:0 0 0 3px rgba(125,211,252,0.3),0 0 14px rgba(125,211,252,0.45)}
.bv-boton:focus{outline:none}
.bv-boton:focus-visible{border-color:#7DD3FC;box-shadow:0 0 0 3px rgba(125,211,252,0.35)}
.bv-boton:disabled{opacity:0.35;cursor:not-allowed}
/* ACCIÓN ACTIVADA: fondo amarillo y icono oscuro (así se lee sobre el ámbar).
   La corona sigue el color del botón, así el brillo al pasar encima siempre se nota. */
.bv-boton.bv-activo{background:#F2A93B;border-color:#F2A93B;color:#0F172A;box-shadow:0 0 0 3px rgba(242,169,59,0.3)}
.bv-boton.bv-activo:hover:not(:disabled){background:#F2A93B;border-color:#FDE68A;color:#0F172A;box-shadow:0 0 0 3px rgba(242,169,59,0.42),0 0 14px rgba(242,169,59,0.55)}
/* SIN AUDIO: rojo (micrófono apagado y volumen silenciado). */
.bv-boton.bv-apagado{background:#EF4444;border-color:#EF4444;color:#fff;box-shadow:0 0 0 3px rgba(239,68,68,0.3)}
.bv-boton.bv-apagado:hover:not(:disabled){background:#EF4444;border-color:#FCA5A5;color:#fff;box-shadow:0 0 0 3px rgba(239,68,68,0.45),0 0 14px rgba(239,68,68,0.5)}
.bv-separador{width:1px;height:26px;background:rgba(255,255,255,0.15);margin:0 3px}
.bv-globo{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);background:rgba(15,23,42,0.96);border:1px solid rgba(255,255,255,0.2);border-radius:999px;padding:8px 16px;color:#fff;font-size:22px;line-height:1;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .2s ease}
.bv-globo.bv-visible{opacity:1}
.bv-emotes{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);display:none;gap:4px;padding:7px 10px;background:rgba(15,23,42,0.96);border:1px solid rgba(255,255,255,0.18);border-radius:999px}
.bv-emotes.bv-visible{display:flex}
.bv-emote{width:36px;height:36px;padding:0;border:none;border-radius:50%;background:transparent;font-size:21px;line-height:1;cursor:pointer;transition:background .12s ease,transform .12s ease}
.bv-emote:hover{background:rgba(255,255,255,0.12);transform:translateY(-2px)}
`;

/** El CSS se inyecta una sola vez, aunque se salga y se vuelva a entrar. */
function inyectarEstilo(): void {
  if (document.getElementById("bv-estilo")) return;
  const estilo = document.createElement("style");
  estilo.id = "bv-estilo";
  estilo.textContent = ESTILO;
  document.head.appendChild(estilo);
}

// ---------------------------------------------------------------------------
// Fábrica
// ---------------------------------------------------------------------------

export function crearBarraUsuario(opciones: OpcionesBarraUsuario): BarraUsuario {
  inyectarEstilo();

  const botones = new Map<AccionBarra, HTMLButtonElement>();

  const barra = document.createElement("div");
  barra.className = "bv-barra";

  const globo = document.createElement("div");
  globo.className = "bv-globo";

  const emotes = document.createElement("div");
  emotes.className = "bv-emotes";

  // El separador divide los dos grupos: comunicación a la izquierda, mundo
  // a la derecha (se coloca antes de "sentarse").
  const separadores = new Set<AccionBarra>(["sentarse"]);

  for (const definicion of BOTONES) {
    if (separadores.has(definicion.accion)) {
      const separador = document.createElement("span");
      separador.className = "bv-separador";
      barra.appendChild(separador);
    }

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "bv-boton";
    boton.innerHTML = definicion.icono;
    boton.title = definicion.titulo;
    boton.addEventListener("click", () => {
      // ✨ solo abre/ cierra el selector; el emote real sale al elegir uno.
      if (definicion.accion === "emote") {
        emotes.classList.toggle("bv-visible");
        return;
      }
      opciones.alPulsar(definicion.accion);
    });
    botones.set(definicion.accion, boton);
    barra.appendChild(boton);
  }

  // El menú de emotes vive DENTRO de la barra para heredar su posicionamiento.
  for (const emoji of EMOTES) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "bv-emote";
    boton.textContent = emoji;
    boton.title = "Emote";
    boton.addEventListener("click", () => {
      emotes.classList.remove("bv-visible");
      mostrarGlobo(emoji);
      opciones.alPulsar("emote", emoji);
    });
    emotes.appendChild(boton);
  }

  barra.appendChild(emotes);
  barra.appendChild(globo);
  document.body.appendChild(barra);

  // -------------------------------------------------------------------------
  // Globo efímero
  // -------------------------------------------------------------------------

  let temporizadorGlobo: number | null = null;

  function mostrarGlobo(texto: string): void {
    globo.textContent = texto;
    globo.classList.add("bv-visible");
    if (temporizadorGlobo) clearTimeout(temporizadorGlobo);
    temporizadorGlobo = window.setTimeout(() => {
      globo.classList.remove("bv-visible");
    }, 2500);
  }

  // -------------------------------------------------------------------------
  // Reflejar el estado del mundo en los botones
  // -------------------------------------------------------------------------

  function reflejar(estado: EstadoBarraUsuario): void {
    if (estado.microfono !== undefined) {
      const boton = botones.get("microfono")!;
      const encendido = estado.microfono === "encendido";
      boton.classList.toggle("bv-activo", encendido);
      boton.classList.toggle("bv-apagado", !encendido);
      boton.title =
        estado.microfono === "sin-permiso"
          ? "Micrófono: sin permiso"
          : estado.microfono === "sin-soporte"
            ? "Micrófono no disponible en este navegador"
            : encendido
              ? "Micrófono encendido (clic para apagar)"
              : "Micrófono apagado (clic para encender)";
    }

    if (estado.audioEncendido !== undefined) {
      const boton = botones.get("audio")!;
      boton.innerHTML = estado.audioEncendido
        ? '<i class="fa-solid fa-volume"></i>'
        : '<i class="fa-solid fa-volume-xmark"></i>';
      boton.classList.toggle("bv-apagado", !estado.audioEncendido);
      boton.title = estado.audioEncendido ? "Silenciar el sonido" : "Restaurar el sonido";
    }

    if (estado.cercaDeSilla !== undefined || estado.sentado !== undefined) {
      const boton = botones.get("sentarse")!;
      const utilizable = Boolean(estado.cercaDeSilla) || Boolean(estado.sentado);
      boton.disabled = !utilizable;
    }

    if (estado.sentado !== undefined) {
      botones.get("sentarse")!.classList.toggle("bv-activo", estado.sentado);
    }

    if (estado.manoAlzada !== undefined) {
      botones.get("alzarMano")!.classList.toggle("bv-activo", estado.manoAlzada);
    }

    if (estado.terceraPersona !== undefined) {
      botones.get("camara")!.classList.toggle("bv-activo", estado.terceraPersona);
    }

    if (estado.webcamEncendida !== undefined) {
      const boton = botones.get("webcam")!;
      boton.classList.toggle("bv-activo", estado.webcamEncendida);
      boton.title = estado.webcamEncendida
        ? "Cámara web encendida (clic para apagar)"
        : "Cámara web apagada (clic para encender)";
    }
  }

  function destruir(): void {
    if (temporizadorGlobo) clearTimeout(temporizadorGlobo);
    barra.remove();
  }

  return { reflejar, mostrarGlobo, destruir };
}
