// ======================================================
// RUTA: CLASES
// ------------------------------------------------------
// GET    /api/clases                    → todas (admin)
// POST   /api/clases                    → crear clase
// PUT    /api/clases/:codigo            → editar (solo admin)
// DELETE /api/clases/:codigo            → eliminar (solo admin)
// GET    /api/clases/docente/:correo    → clases de un docente
// GET    /api/clases/estudiante/:correo → clases inscritas
// ======================================================

import { Router } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { ENTORNO } from "../entorno";

export const rutasClases = Router();

function verificarAutenticacion(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }
  try {
    const payload = jwt.verify(token, ENTORNO.JWT_SECRET) as any;
    req.usuario = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

function soloAdminODocente(req: any, res: any, next: any) {
  const rol = req.usuario?.rol;
  if (rol !== "admin" && rol !== "docente") {
    return res.status(403).json({ error: "Acceso denegado" });
  }
  next();
}

function soloAdmin(req: any, res: any, next: any) {
  if (req.usuario?.rol !== "admin") {
    return res.status(403).json({ error: "Acceso denegado: requiere administración." });
  }
  next();
}

// ------------------------------------------------------
// TODAS LAS CLASES
// ------------------------------------------------------

rutasClases.get("/", async (req, res) => {
  try {
    const [rows]: any = await db.query(
      `
        SELECT
          c.codigo,
          c.materia,
          c.correo_docente AS correoDocente,
          c.nombre_docente AS nombreDocente,

          (
            SELECT COUNT(*)
            FROM inscripciones i
            WHERE i.codigo_clase = c.codigo
          ) AS totalInscritos

        FROM clases c

        ORDER BY c.fecha_creacion DESC
      `
    );

    console.log("✅ /api/clases:", rows.length, "clases");

    return res.json(rows);
  } catch (error) {
    console.error("❌ ERROR /api/clases:");
    console.error(error);

    return res.status(500).json({
      error: "Error al consultar clases",
      detalle: error instanceof Error ? error.message : String(error),
    });
  }
});

// ------------------------------------------------------
// CREAR CLASE
// ------------------------------------------------------

rutasClases.post("/", verificarAutenticacion, soloAdminODocente, async (req, res) => {
  const { codigo, materia, correoDocente, nombreDocente } = req.body;

  if (!correoDocente || !nombreDocente) {
    return res.status(400).json({
      error: "Faltan datos del docente",
    });
  }

  try {
    await db.query(
      `
        INSERT INTO clases
        (
          codigo,
          materia,
          correo_docente,
          nombre_docente
        )
        VALUES (?, ?, ?, ?)
      `,
      [codigo, materia, correoDocente, nombreDocente]
    );

    console.log("✅ Clase creada:", codigo, materia);

    return res.status(201).json({
      codigo,
      materia,
      correoDocente,
      nombreDocente,
    });
  } catch (error) {
    console.error("❌ Error al crear clase en MySQL:", error);

    // Código repetido (UNIQUE): se explica en vez de tumbar un 500.
    const codigoDU = (error as any)?.code === "ER_DUP_ENTRY";
    return res.status(codigoDU ? 409 : 500).json({
      error: codigoDU
        ? `Ya existe una clase con el código "${codigo}".`
        : "Error al guardar la clase",
    });
  }
});

// ------------------------------------------------------
// EDITAR CLASE (solo administración)
// ------------------------------------------------------
// Cambia materia y/o docente. El código es la identidad de la
// clase (las inscripciones apuntan a él), así que NO se edita.

rutasClases.put("/:codigo", verificarAutenticacion, soloAdmin, async (req, res) => {
  const codigo = String(req.params.codigo || "").trim().toUpperCase();
  const cuerpo = req.body ?? {};

  const cambios: string[] = [];
  const valores: string[] = [];

  if (cuerpo.materia !== undefined) {
    const materia = String(cuerpo.materia ?? "").trim();
    if (materia.length < 3 || materia.length > 150) {
      return res.status(400).json({ error: "La materia debe tener entre 3 y 150 caracteres." });
    }
    cambios.push("materia = ?");
    valores.push(materia);
  }

  if (cuerpo.correoDocente !== undefined || cuerpo.nombreDocente !== undefined) {
    const correo = String(cuerpo.correoDocente ?? "").trim().toLowerCase();
    const nombre = String(cuerpo.nombreDocente ?? "").trim();

    if (!correo || !nombre) {
      return res.status(400).json({ error: "Faltan datos del docente." });
    }

    // El docente debe existir: la FK a `cuentas` lo exigiría igual.
    const [docentes]: any = await db.query(
      "SELECT correo FROM cuentas WHERE correo = ?",
      [correo]
    );
    if (docentes.length === 0) {
      return res.status(404).json({ error: `No existe ninguna cuenta con el correo "${correo}".` });
    }

    cambios.push("correo_docente = ?", "nombre_docente = ?");
    valores.push(correo, nombre);
  }

  if (cambios.length === 0) {
    return res.status(400).json({ error: "No hay cambios para guardar." });
  }

  try {
    const [existentes]: any = await db.query(
      "SELECT codigo FROM clases WHERE codigo = ?",
      [codigo]
    );
    if (existentes.length === 0) {
      return res.status(404).json({ error: `La clase "${codigo}" no existe.` });
    }

    valores.push(codigo);
    await db.query(`UPDATE clases SET ${cambios.join(", ")} WHERE codigo = ?`, valores);

    console.log("✅ Clase editada:", codigo);

    return res.json({ mensaje: "Clase actualizada correctamente" });
  } catch (error) {
    console.error("❌ Error al editar clase:", error);
    return res.status(500).json({ error: "Error al actualizar la clase" });
  }
});

// ------------------------------------------------------
// ELIMINAR CLASE (solo administración)
// ------------------------------------------------------
// La FK inscripciones → clases obliga a borrar las inscripciones
// de esa clase primero (borrar la clase sin tocarlas dejaría
// filas huérfanas apuntando a un código que ya no existe).

rutasClases.delete("/:codigo", verificarAutenticacion, soloAdmin, async (req, res) => {
  const codigo = String(req.params.codigo || "").trim().toUpperCase();

  try {
    const [existentes]: any = await db.query(
      "SELECT codigo FROM clases WHERE codigo = ?",
      [codigo]
    );
    if (existentes.length === 0) {
      return res.status(404).json({ error: `La clase "${codigo}" no existe.` });
    }

    await db.query("DELETE FROM inscripciones WHERE codigo_clase = ?", [codigo]);
    await db.query("DELETE FROM clases WHERE codigo = ?", [codigo]);

    console.log("✅ Clase eliminada:", codigo);

    return res.json({ mensaje: "Clase eliminada correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar clase:", error);
    return res.status(500).json({ error: "Error al eliminar la clase" });
  }
});

// ------------------------------------------------------
// UNA CLASE POR CÓDIGO
// ------------------------------------------------------
// Es lo que hace posible el ENLACE DIRECTO a una clase
// (localhost:5173/?clase=FIS-101): al abrir esa dirección el
// frontend pregunta qué clase es y, si tiene permiso, entra
// sin pasar por el panel. Va al FINAL a propósito: así
// /docente/... y /estudiante/... ya se han resuelto antes y
// "docente" nunca se confunde con un código de clase.
// ------------------------------------------------------

rutasClases.get("/:codigo", async (req, res) => {
  try {
    const codigo = String(req.params.codigo || "").trim().toUpperCase();

    const [rows]: any = await db.query(
      `
        SELECT
          c.codigo,
          c.materia,
          c.correo_docente AS correoDocente,
          c.nombre_docente AS nombreDocente,
          DATE_FORMAT(c.fecha_creacion, '%Y-%m-%d %H:%i') AS fechaCreacion,

          (
            SELECT COUNT(*)
            FROM inscripciones i
            WHERE i.codigo_clase = c.codigo
          ) AS totalInscritos

        FROM clases c

        WHERE c.codigo = ?
      `,
      [codigo]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        error: `La clase "${codigo}" no existe.`,
      });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("❌ ERROR /api/clases/:codigo:");
    console.error(error);

    return res.status(500).json({
      error: "Error al consultar la clase",
      detalle: error instanceof Error ? error.message : String(error),
    });
  }
});

// ------------------------------------------------------
// CLASES DEL DOCENTE
// ------------------------------------------------------

rutasClases.get("/docente/:correo", async (req, res) => {
  try {
    const [rows]: any = await db.query(
      `
          SELECT
            c.id,
            c.codigo,
            c.materia,
            c.fecha_creacion AS fechaCreacion,

            (
              SELECT COUNT(*)
              FROM inscripciones i
              WHERE i.codigo_clase = c.codigo
            ) AS totalInscritos

          FROM clases c
          WHERE c.correo_docente = ?
        `,
      [req.params.correo]
    );

    return res.json(rows);
  } catch (error) {
    console.error("Error al obtener clases del docente:", error);

    return res.status(500).json({
      error: "Error al consultar clases",
    });
  }
});

// ------------------------------------------------------
// CLASES DEL ESTUDIANTE (inscritas)
// ------------------------------------------------------

rutasClases.get("/estudiante/:correo", async (req, res) => {
  try {
    const [rows]: any = await db.query(
      `
        SELECT
          c.id,
          c.codigo,
          c.materia,
          c.fecha_creacion AS fechaCreacion,
          c.nombre_docente AS nombreDocente

        FROM inscripciones i

        JOIN clases c
          ON i.codigo_clase = c.codigo

        WHERE i.correo_estudiante = ?
      `,
      [req.params.correo]
    );

    return res.json(rows);
  } catch (error) {
    console.error("Error al obtener clases del estudiante:", error);

    return res.status(500).json({
      error: "Error al consultar inscripciones",
    });
  }
});
