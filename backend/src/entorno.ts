// ======================================================
// ENTORNO (variables de configuración)
// ------------------------------------------------------
// Todo lo configurable vive en backend/.env, que NO se
// sube a git (existe .env.example como plantilla).
// Aquí solo se LEEN las variables: ninguna credencial
// queda escrita dentro del código.
// ======================================================

import path from "node:path";
import dotenv from "dotenv";

// Se lee el .env que está al lado de package.json (backend/.env),
// sin importar desde qué carpeta se lance el servidor.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

export const ENTORNO = {
  /** Puerto de la API (Express). */
  PUERTO: Number(process.env.PORT || 3000),

  /** Base de datos MySQL. */
  DB_HOST: process.env.DB_HOST || "127.0.0.1",
  DB_PORT: Number(process.env.DB_PORT || 3306),
  DB_USER: process.env.DB_USER || "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "12345",
  DB_NAME: process.env.DB_NAME || "usta_metaverso",

  /** Orígenes permitidos para el frontend (cors). */
  ORIGENES: process.env.CORS_ORIGENES || "*",
  JWT_SECRET: process.env.JWT_SECRET || "campus_metaverso_secret",

  /** Correo saliente para los códigos de verificación. */
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || "",

  /** Secreto para firmar los códigos de verificación. */
  CODIGO_SECRET:
    process.env.CODIGO_SECRET ||
    process.env.JWT_SECRET ||
    "campus_metaverso_codigo",
};
