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

const PERSONALIZADA = import.meta.env.VITE_API_URL as string | undefined;

export const API_URL: string =
  (PERSONALIZADA ? PERSONALIZADA.replace(/\/+$/, "") : "") ||
  (import.meta.env.DEV ? "http://localhost:3000/api" : "/api");
