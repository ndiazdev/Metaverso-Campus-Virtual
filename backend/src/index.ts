// ======================================================
// INICIO DEL SERVIDOR
// ------------------------------------------------------
// Punto de entrada del backend: levanta la app (ver
// src/app.ts) en el puerto del .env.
//
//   npm run dev    → con recarga automática (tsx watch)
//   npm start      → una vez (producción / al subirlo)
// ======================================================

import { app } from "./app";
import { ENTORNO } from "./entorno";

app.listen(ENTORNO.PUERTO, () => {
  console.log("========================================");
  console.log("🚀 Backend (API + frontend) corriendo en:");
  console.log(`   http://localhost:${ENTORNO.PUERTO}`);
  console.log(`   API:  http://localhost:${ENTORNO.PUERTO}/api/login`);
  console.log("========================================");
});
