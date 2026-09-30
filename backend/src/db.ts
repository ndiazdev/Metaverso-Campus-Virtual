// ======================================================
// BASE DE DATOS
// ------------------------------------------------------
// Un solo pool de conexiones MySQL compartido por todas
// las rutas. La configuración sale de backend/.env.
// ======================================================

import mysql from "mysql2/promise";
import { ENTORNO } from "./entorno";

export const db = mysql.createPool({
  host: ENTORNO.DB_HOST,
  port: ENTORNO.DB_PORT,
  user: ENTORNO.DB_USER,
  password: ENTORNO.DB_PASSWORD,
  database: ENTORNO.DB_NAME,
});
