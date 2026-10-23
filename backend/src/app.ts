// ======================================================
// APP: configuración de Express
// ------------------------------------------------------
// Aquí solo se arma la aplicación:
//   1. middlewares generales (cors, json)
//   2. montaje de las rutas de la API (una carpeta por
//      funcionalidad, ver src/rutas/)
//   3. entrega del FRONTEND compilado (frontend/dist),
//      así un mismo servidor deja listos los dos lados
//      a la hora de subirlo.
// El servidor en sí arranca en src/index.ts.
// ======================================================

import path from "node:path";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import { ENTORNO } from "./entorno";
import { rutasAuth } from "./rutas/auth";
import { rutasClases } from "./rutas/clases";
import { rutasInscripciones } from "./rutas/inscripciones";
import { rutasUsuarios } from "./rutas/usuarios";

export const app = express();

app.use(cors({ origin: ENTORNO.ORIGENES === "*" ? true : ENTORNO.ORIGENES.split(",") }));
app.use(express.json({ limit: "2mb" }));

// ------------------------------------------------------
// 1) API — las funcionalidades del backend
// ------------------------------------------------------
app.use("/api", rutasAuth);
app.use("/api/clases", rutasClases);
app.use("/api/inscripciones", rutasInscripciones);
app.use("/api/usuarios", rutasUsuarios);

// ------------------------------------------------------
// 2) FRONTEND — la parte visual (frontend/dist)
// ------------------------------------------------------
// Se sirve desde el mismo puerto que la API: en producción
// el navegador pide "/api/..." al propio servidor, así que
// no hay CORS ni URLs que configurar al subirlo.
// (Si algún día el front y el back van en servidores
// distintos, FRONT_DIST puede apuntar a otra carpeta.)
const CARPETA_DIST =
  process.env.FRONT_DIST || path.resolve(__dirname, "..", "..", "frontend", "dist");
const INDICE = path.join(CARPETA_DIST, "index.html");

// Imágenes del frontend (frontend/public/images). Se sirven también desde el
// código fuente para que el servidor las reconozca aunque frontend/dist no
// esté compilado o se haya copiado sin la carpeta images.
const CARPETA_IMAGENES = path.resolve(__dirname, "..", "..", "frontend", "public", "images");

if (fs.existsSync(CARPETA_IMAGENES)) {
  app.use("/images", express.static(CARPETA_IMAGENES));
}

if (fs.existsSync(INDICE)) {
  app.use(express.static(CARPETA_DIST));

  // Cualquier GET que no sea de la API devuelve el index.html:
  // así funcionan también las rutas del SPA al refrescar.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(INDICE);
  });
} else {
  console.warn(
    `⚠ No se encontró ${INDICE}.\n` +
      `   La API funciona igual, pero el frontend no se está sirviendo.\n` +
      `   Compílalo con: npm run build`
  );
}
