// ======================================================
// MIDDLEWARE DE AUTENTICACIÓN (JWT)
// ------------------------------------------------------
// Un único lugar para validar el token de sesión. Antes
// cada ruta (clases, usuarios, inscripciones) repetía su
// propio `jwt.verify` y devolvía siempre "Token inválido",
// incluso cuando el token solo había caducado. El frontend
// necesita distinguir ambos casos para cerrar la sesión y
// pedir de nuevo el login en vez de mostrar un error raro.
// ======================================================

import jwt from "jsonwebtoken";
import { ENTORNO } from "./entorno";

export interface UsuarioToken {
  correo: string;
  rol: string;
  id: number;
  iat?: number;
  exp?: number;
}

/**
 * Valida el `Authorization: Bearer <token>` y deja el payload en `req.usuario`.
 *
 * Códigos de error (siempre 401):
 *   · TOKEN_FALTANTE   → no vino cabecera o venía vacía.
 *   · SESION_EXPIRADA  → el token es válido pero pasó su `exp`.
 *   · TOKEN_INVALIDO   → firma mal, token corrupto, etc.
 */
export function verificarAutenticacion(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({
      error: "Token no proporcionado",
      codigo: "TOKEN_FALTANTE",
    });
  }

  try {
    const payload = jwt.verify(token, ENTORNO.JWT_SECRET) as UsuarioToken;
    req.usuario = payload;
    next();
  } catch (e) {
    // TokenExpiredError puede venir del propio jsonwebtoken o de un Error
    // clonado; se comprueba también el nombre por si acaso.
    if (e instanceof jwt.TokenExpiredError || (e as any)?.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Tu sesión expiró. Vuelve a iniciar sesión.",
        codigo: "SESION_EXPIRADA",
      });
    }

    return res.status(401).json({
      error: "Token inválido",
      codigo: "TOKEN_INVALIDO",
    });
  }
}
