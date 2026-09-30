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
 *   · La tuya propia: cajita arriba a la izquierda (debajo del engranaje ⚙️),
 *     espejada como en cualquier videollamada.
 *   · La de los demás: cuando llegue la etapa multijugador se pinta al lado del
 *     modelo 3D de cada persona; para eso se le pasa el `MediaStream` de
 *     `obtenerFlujo()` al peer correspondiente (etapa 2).
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
const ESTILO = `
.cw-caja{position:fixed;top:74px;left:16px;width:212px;border-radius:12px;overflow:hidden;background:#0B1220;border:1px solid rgba(255,255,255,0.18);box-shadow:0 8px 24px rgba(0,0,0,0.45);z-index:1500;font-family:sans-serif;display:none}
.cw-caja.cw-visible{display:block}
.cw-video{display:block;width:100%;height:126px;object-fit:cover;background:#000;transform:scaleX(-1)}
.cw-pie{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 8px}
.cw-etiqueta{font-size:12px;color:#E2E8F0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cw-apagar{width:22px;height:22px;flex:0 0 22px;padding:0;border:none;border-radius:50%;background:rgba(255,255,255,0.12);color:#E2E8F0;font-size:11px;line-height:1;cursor:pointer;transition:background .12s ease}
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
    <div class="cw-pie">
      <span class="cw-etiqueta">Tu cámara</span>
      <button type="button" class="cw-apagar" title="Apagar la cámara">✕</button>
    </div>
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
