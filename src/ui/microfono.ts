/**
 * MICRÓFONO del usuario.
 *
 * Módulo independiente y sin Babylon: solo maneja el `MediaStream` del
 * navegador. La barra (src/ui/barraUsuario.ts) es quien lo llama; la escena no
 * tiene por qué saber nada del audio.
 *
 * Es la base para la etapa del CHAT POR PROXIMIDAD: el `MediaStream` que deja
 * encendido aquí es el que luego se enchufará al WebRTC / peer de la partida.
 *
 *   const estado = await alternarMicrofono(); // "encendido" | "apagado" | ...
 *   obtenerFlujoMicrofono();                  // MediaStream listo para la red
 *   liberarMicrofono();                       // al salir de la clase
 */

export type EstadoMicrofono = "encendido" | "apagado" | "sin-permiso" | "sin-soporte";

let flujo: MediaStream | null = null;
let encendido = false;

/** Estado actual sin pedir permisos (seguro de llamar en cada frame). */
export function estadoMicrofono(): EstadoMicrofono {
  if (!flujo) return "apagado";
  return encendido ? "encendido" : "apagado";
}

/**
 * Enciende o apaga el micrófono.
 * La primera vez pide permiso al navegador (puede tardar si el usuario duda).
 */
export async function alternarMicrofono(): Promise<EstadoMicrofono> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return "sin-soporte";
  }

  // Ya tenemos el flujo: solo alternamos la pista (no vuelve a pedir permiso).
  if (flujo) {
    encendido = !encendido;
    for (const pista of flujo.getAudioTracks()) {
      pista.enabled = encendido;
    }
    return encendido ? "encendido" : "apagado";
  }

  try {
    flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
    encendido = true;
    return "encendido";
  } catch (error) {
    console.warn("No se pudo activar el micrófono:", error);
    return "sin-permiso";
  }
}

/** El audio capturado, para quien quiera transmitirlo (etapa de voz por proximidad). */
export function obtenerFlujoMicrofono(): MediaStream | null {
  return flujo;
}

/** Apaga y suelta el micrófono (al salir de la clase / partida). */
export function liberarMicrofono(): void {
  if (flujo) {
    for (const pista of flujo.getTracks()) {
      pista.stop();
    }
  }
  flujo = null;
  encendido = false;
}
