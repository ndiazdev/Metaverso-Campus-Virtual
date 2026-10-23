import { defineConfig } from "vite";

// ======================================================
// CONFIGURACIÓN DE VITE
// ------------------------------------------------------
// `base` es la carpeta pública donde se publica el sitio.
//
//   · Desarrollo (`npm run dev`): "/" → http://localhost:5173/
//   · Producción (`npm run build`): "/metaverso-santototunja/"
//
// Vite usa este valor para:
//   · las rutas de /assets/*.js y *.css del index.html
//   · `import.meta.env.BASE_URL`, que el código usa para las
//     imágenes (`public/images`) y para escribir las rutas de
//     pantalla (/login, /dashboard) dentro del subdirectorio.
//
// Si algún día se publica en otro subdirectorio, basta con cambiar
// BASE_PRODUCCION o pasar `VITE_BASE` al compilar:
//   VITE_BASE=/otra-carpeta/ npm run build
// ======================================================

const BASE_PRODUCCION = "/metaverso-santototunja/";

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE ?? (mode === "production" ? BASE_PRODUCCION : "/"),
}));
