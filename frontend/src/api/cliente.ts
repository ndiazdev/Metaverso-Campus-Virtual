// ======================================================
// CAPA DE API DEL FRONTEND
// ------------------------------------------------------
// Único lugar que decide de dónde viene el backend.
// El login y los dashboards importan API_URL desde aquí y
// se quedan con lo suyo: mostrar cosas en pantalla.
//
//   · Desarrollo : el front corre en el 5173 y la API en
//                  el 3000 (son dos procesos distintos).
//   · Producción : el MISMO servidor entrega el front y la
//                  API, así que basta con "/api" y no hay
//                  que configurar nada al subirlo.
//
// Si algún día la API vive en otro sitio, se fuerza con la
// variable de entorno VITE_API_URL (archivo .env del front).
// ======================================================

import {
  cerrarSesion,
  marcarSesionExpirada,
  obtenerToken,
} from "../state/estado";

const PERSONALIZADA = import.meta.env.VITE_API_URL as string | undefined;
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export const API_URL: string =
  (PERSONALIZADA ? PERSONALIZADA.replace(/\/+$/, "") : "") ||
  (import.meta.env.DEV ? "http://localhost:3000/api" : `${BASE}/api`);

// ======================================================
// CABECERA DE AUTENTICACIÓN
// ------------------------------------------------------
// El backend exige `Authorization: Bearer <token>` en los endpoints
// protegidos (crear clases, inscripciones, cambiar roles…), pero los
// ~20 `fetch` sueltos de la app no la ponían: recién logueado, todo lo
// que exigía sesión fallaba con 401 "Token no proporcionado". Como
// TODA la API sale de aquí (todos importan API_URL), se envuelve fetch
// una sola vez en vez de tocar llamada por llamada: solo para URLs de
// API_URL y solo si la llamada no trae ya su propia cabecera. El token
// lo guarda el login en la sesión (estado.ts → obtenerToken).
// ======================================================
const fetchOriginal = window.fetch.bind(window);

/** Evita recargar en bucle si llegan varios 401 a la vez. */
let yaRedirigiendoPorSesion = false;

window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

  if (url.startsWith(API_URL)) {
    const token = obtenerToken();
    if (token) {
      // Si input es un Request, sus cabeceras también viajan: init.headers las
      // reemplazaría por completo, así que se parte de ellas si no hay init.
      const base =
        init?.headers ??
        (input instanceof Request ? input.headers : undefined);
      const headers = new Headers(base);
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
        init = { ...init, headers };
      }
    }
  }

  const respuesta = fetchOriginal(input, init);

  // Si el backend avisa de que el token caducó, se cierra la sesión y se
  // recarga para que aparezca el login con el aviso. Se mira el `codigo` y no
  // el 401 a secas: /api/login también responde 401 con credenciales malas y
  // ahí no hay que cerrar nada.
  void respuesta.then(async (res) => {
    if (!url.startsWith(API_URL) || res.status !== 401 || yaRedirigiendoPorSesion) return;
    try {
      const datos = (await res.clone().json()) as { codigo?: string };
      // Cualquiera de los tres deja la sesión inservible: el token caducó, el
      // servidor ya no lo reconoce (p. ej. cambió JWT_SECRET) o falta.
      if (
        datos?.codigo !== "SESION_EXPIRADA" &&
        datos?.codigo !== "TOKEN_INVALIDO" &&
        datos?.codigo !== "TOKEN_FALTANTE"
      ) {
        return;
      }

      yaRedirigiendoPorSesion = true;
      cerrarSesion();
      marcarSesionExpirada();
      location.reload();
    } catch {
      // Respuesta sin JSON (proxy, HTML de error…): no es sesión caducada.
    }
  }).catch(() => {
    // La petición en sí falló (red): la maneja quien hizo el fetch.
  });

  return respuesta;
};
