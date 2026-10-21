/**
 * CÁMARA WEB del usuario.
 *
 * Módulo independiente y sin Babylon, igual que `src/ui/microfono.ts`: solo
 * maneja el `MediaStream` de la webcam y su cajita en pantalla. La barra
 * (src/ui/barraUsuario.ts) es quien la llama; la escena no necesita saber nada.
 *
 *   const camara = crearCamaraWeb();
 *   await camara.alternar();   // pide permiso la primera vez y enseña la caja
 *   camara.obtenerFlujo();     // MediaStream listo para el WebRTC de la partida
 *   camara.destruir();         // al salir de la clase: apaga el piloto de la webcam
 *
 * DÓNDE SE VE
 *   · La tuya propia: cajita arriba a la IZQUIERDA, por debajo del engranaje
 *     y de la píldora de la clase (que ocupan la esquina superior izquierda),
 *     más grande y espejada como en cualquier videollamada.
 *   · La de los demás: cuadrito al LADO del modelo 3D de cada persona
 *     (src/red/videoSalon.ts), proyectado en pantalla en cada frame.
 */

export type EstadoCamara = "encendida" | "apagada" | "sin-permiso" | "sin-soporte";

export interface CamaraWeb {
  /** Enciende o apaga la webcam. La primera vez pide permiso al navegador. */
  alternar: () => Promise<EstadoCamara>;
  /** Estado actual sin pedir nada (seguro de llamar en cada reflejo de la barra). */
  estado: () => EstadoCamara;
  /** El vídeo capturado, para transmitirlo (etapa multijugador). */
  obtenerFlujo: () => MediaStream | null;
  /** Apaga y suelta la cámara (al salir de la clase / partida). */
  destruir: () => void;
}

// El CSS se inyecta una sola vez, aunque se entre y se salga de la partida.
// La self-view es un CUADRITO grande arriba a la IZQUIERDA, por debajo del
// engranaje y de la píldora de la clase (que ocupan la esquina superior
// izquierda): el vídeo llena la caja, la ✕ aparece al pasar el ratón y la
// etiqueta queda como insignia superpuesta.
const ESTILO = `
.cw-caja{position:fixed;top:80px;left:16px;width:200px;height:200px;border-radius:12px;overflow:hidden;background:#0B1220;border:1px solid rgba(255,255,255,0.18);box-shadow:0 8px 24px rgba(0,0,0,0.45);z-index:1500;font-family:sans-serif;display:none}
.cw-caja.cw-visible{display:block}
.cw-video{display:block;width:100%;height:100%;object-fit:cover;background:#000;transform:scaleX(-1)}
.cw-etiqueta{position:absolute;left:5px;bottom:5px;font-size:10px;line-height:1.2;color:#E2E8F0;background:rgba(0,0,0,0.5);border-radius:4px;padding:2px 6px;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:calc(100% - 10px)}
.cw-apagar{position:absolute;top:4px;right:4px;width:20px;height:20px;padding:0;border:none;border-radius:50%;background:rgba(0,0,0,0.55);color:#E2E8F0;font-size:10px;line-height:1;cursor:pointer;opacity:0;transition:opacity .12s ease,background .12s ease}
.cw-caja:hover .cw-apagar,.cw-apagar:focus-visible{opacity:1}
.cw-apagar:hover{background:#EF4444;color:#fff}
`;

function inyectarEstilo(): void {
  if (document.getElementById("cw-estilo")) return;
  const estilo = document.createElement("style");
  estilo.id = "cw-estilo";
  estilo.textContent = ESTILO;
  document.head.appendChild(estilo);
}

export function crearCamaraWeb(alCambiarEstado?: (estado: EstadoCamara) => void): CamaraWeb {
  inyectarEstilo();

  let flujo: MediaStream | null = null;

  const caja = document.createElement("div");
  caja.className = "cw-caja";
  caja.innerHTML = `
    <video class="cw-video" autoplay playsinline muted></video>
    <span class="cw-etiqueta">Tu cámara</span>
    <button type="button" class="cw-apagar" title="Apagar la cámara" aria-label="Apagar la cámara">✕</button>
  `;

  const video = caja.querySelector<HTMLVideoElement>(".cw-video")!;
  const etiqueta = caja.querySelector<HTMLElement>(".cw-etiqueta")!;
  const botonApagar = caja.querySelector<HTMLButtonElement>(".cw-apagar")!;
  document.body.appendChild(caja);

  function apagar(): void {
    if (flujo) {
      for (const pista of flujo.getTracks()) pista.stop();
    }
    flujo = null;
    video.srcObject = null;
    caja.classList.remove("cw-visible");
    etiqueta.textContent = "Tu cámara";
  }

  // Apagar desde la ✕ de la cajita tiene que repintar el botón de la barra.
  botonApagar.addEventListener("click", () => {
    apagar();
    alCambiarEstado?.("apagada");
  });

  async function alternar(): Promise<EstadoCamara> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return "sin-soporte";
    }

    // Ya estaba encendida: se apaga sin volver a tocar el permiso.
    if (flujo) {
      apagar();
      return "apagada";
    }

    try {
      flujo = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "user" },
        audio: false, // el audio lo lleva el micrófono, aparte
      });
      video.srcObject = flujo;
      caja.classList.add("cw-visible");
      etiqueta.textContent = "Tu cámara";
      // Puede rechazar si la pestaña está en segundo plano: se ignora, el vídeo
      // empieza solo en cuanto el navegador lo decida.
      video.play().catch(() => undefined);
      return "encendida";
    } catch (error) {
      console.warn("No se pudo encender la cámara web:", error);
      apagar();
      return "sin-permiso";
    }
  }

  function estado(): EstadoCamara {
    if (!flujo) return "apagada";
    const pista = flujo.getVideoTracks()[0];
    return pista && pista.readyState === "live" ? "encendida" : "apagada";
  }

  function destruir(): void {
    apagar();
    caja.remove();
  }

  return { alternar, estado, obtenerFlujo: () => flujo, destruir };
}
