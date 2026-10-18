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

import { obtenerToken } from "../state/estado";

const PERSONALIZADA = import.meta.env.VITE_API_URL as string | undefined;

export const API_URL: string =
  (PERSONALIZADA ? PERSONALIZADA.replace(/\/+$/, "") : "") ||
  (import.meta.env.DEV ? "http://localhost:3000/api" : "/api");

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

  return fetchOriginal(input, init);
};
