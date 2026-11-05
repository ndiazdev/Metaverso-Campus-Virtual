import crypto from "node:crypto";
import { db } from "./db";
import { ENTORNO } from "./entorno";
import { enviarCodigoVerificacion } from "./correo";

const DURACION_MINUTOS = 10;
const MAX_INTENTOS = 5;
const ESPERA_REENVIO_SEGUNDOS = 60;
const MAX_POR_HORA = 5;

export type ResultadoSolicitud =
  | { ok: true }
  | { ok: false; status: number; error: string };

export type ResultadoVerificacion =
  | { ok: true }
  | { ok: false; error: string };

export function esSolicitudFallida(
  resultado: ResultadoSolicitud
): resultado is { ok: false; status: number; error: string } {
  return !resultado.ok;
}

export function esVerificacionFallida(
  resultado: ResultadoVerificacion
): resultado is { ok: false; error: string } {
  return !resultado.ok;
}

export function normalizarCorreo(valor: unknown): string {
  return String(valor ?? "").trim().toLowerCase();
}

export function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function hashCodigo(correo: string, codigo: string): string {
  return crypto
    .createHmac("sha256", ENTORNO.CODIGO_SECRET)
    .update(`${correo}:${codigo}`)
    .digest("hex");
}

export async function asegurarTablaVerificaciones(): Promise<void> {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS verificaciones_correo (
        id INT NOT NULL AUTO_INCREMENT,
        correo VARCHAR(150) NOT NULL,
        codigo_hash VARCHAR(64) NOT NULL,
        intentos INT NOT NULL DEFAULT 0,
        creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expira DATETIME NOT NULL,
        PRIMARY KEY (id),
        KEY correo (correo),
        KEY creado (creado)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    console.warn(
      "No se pudo crear la tabla verificaciones_correo:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

let tablaLista: Promise<void> | null = null;

function prepararTabla(): Promise<void> {
  if (!tablaLista) tablaLista = asegurarTablaVerificaciones();
  return tablaLista;
}

export async function solicitarCodigo(
  correo: string
): Promise<ResultadoSolicitud> {
  await prepararTabla();

  const [ultimo]: any = await db.query(
    `
      SELECT TIMESTAMPDIFF(SECOND, MAX(creado), NOW()) AS segundos
      FROM verificaciones_correo
      WHERE correo = ?
    `,
    [correo]
  );

  const segundos = ultimo[0]?.segundos;

  if (segundos !== null && segundos !== undefined && Number(segundos) < ESPERA_REENVIO_SEGUNDOS) {
    return {
      ok: false,
      status: 429,
      error: `Espera ${ESPERA_REENVIO_SEGUNDOS} segundos antes de pedir otro código.`,
    };
  }

  const [porHora]: any = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM verificaciones_correo
      WHERE correo = ? AND creado > (NOW() - INTERVAL 1 HOUR)
    `,
    [correo]
  );

  if (Number(porHora[0]?.total ?? 0) >= MAX_POR_HORA) {
    return {
      ok: false,
      status: 429,
      error: "Demasiados códigos solicitados. Intenta más tarde.",
    };
  }

  const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const hash = hashCodigo(correo, codigo);

  const [resultado]: any = await db.query(
    `
      INSERT INTO verificaciones_correo (correo, codigo_hash, expira)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ${DURACION_MINUTOS} MINUTE))
    `,
    [correo, hash]
  );

  try {
    await enviarCodigoVerificacion(correo, codigo);
  } catch (error) {
    await db.query("DELETE FROM verificaciones_correo WHERE id = ?", [
      resultado.insertId,
    ]);
    throw error;
  }

  return { ok: true };
}

export async function verificarCodigo(
  correo: string,
  codigo: string
): Promise<ResultadoVerificacion> {
  await prepararTabla();

  const [filas]: any = await db.query(
    `
      SELECT
        id,
        codigo_hash,
        intentos,
        TIMESTAMPDIFF(SECOND, NOW(), expira) AS segundos_restantes
      FROM verificaciones_correo
      WHERE correo = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [correo]
  );

  if (filas.length === 0) {
    return { ok: false, error: "No hay un código pendiente para este correo." };
  }

  const fila = filas[0];

  if (Number(fila.segundos_restantes) <= 0) {
    await db.query("DELETE FROM verificaciones_correo WHERE id = ?", [fila.id]);
    return { ok: false, error: "El código expiró. Pide uno nuevo." };
  }

  if (Number(fila.intentos) >= MAX_INTENTOS) {
    await db.query("DELETE FROM verificaciones_correo WHERE id = ?", [fila.id]);
    return {
      ok: false,
      error: "Demasiados intentos. Pide un código nuevo.",
    };
  }

  const esperado = Buffer.from(hashCodigo(correo, codigo), "hex");
  const guardado = Buffer.from(String(fila.codigo_hash), "hex");

  const coincide =
    esperado.length === guardado.length &&
    crypto.timingSafeEqual(esperado, guardado);

  if (!coincide) {
    const nuevosIntentos = Number(fila.intentos) + 1;

    if (nuevosIntentos >= MAX_INTENTOS) {
      await db.query("DELETE FROM verificaciones_correo WHERE id = ?", [fila.id]);
      return {
        ok: false,
        error: "Demasiados intentos. Pide un código nuevo.",
      };
    }

    await db.query(
      "UPDATE verificaciones_correo SET intentos = intentos + 1 WHERE id = ?",
      [fila.id]
    );

    return { ok: false, error: "Código incorrecto." };
  }

  await db.query("DELETE FROM verificaciones_correo WHERE correo = ?", [correo]);

  return { ok: true };
}

void prepararTabla();
