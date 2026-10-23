// ======================================================
// INICIO DEL SERVIDOR
// ------------------------------------------------------
// Punto de entrada del backend: levanta la app (ver
// src/app.ts) en el puerto del .env y le engancha el
// canal de tiempo real (socket.io) que hace que los
// avatares de una misma clase se vean entre ellos.
//
//   npm run dev    → con recarga automática (tsx watch)
//   npm start      → una vez (producción / al subirlo)
// ======================================================

import { app } from "./app";
import { ENTORNO } from "./entorno";
import { adjuntarTiempoReal } from "./tiempoReal";
import { asegurarAdmin } from "./seedAdmin";

// app.listen() devuelve el servidor http que hay detrás de Express:
// ese mismo servidor es el que atiende los WebSockets, así que el
// multijugador comparte el puerto 3000 y no hace falta abrir otro.
const servidor = app.listen(ENTORNO.PUERTO, () => {
  console.log("========================================");
  console.log("🚀 Backend (API + frontend) corriendo en:");
  console.log(`   http://localhost:${ENTORNO.PUERTO}`);
  console.log(`   API:  http://localhost:${ENTORNO.PUERTO}/api/login`);
  console.log("========================================");
});

adjuntarTiempoReal(servidor);

// Si la base ya está importada, deja creado el admin por defecto.
void asegurarAdmin();
