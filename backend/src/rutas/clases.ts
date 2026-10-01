// ======================================================
// RUTA: CLASES
// ------------------------------------------------------
// GET  /api/clases                    → todas (admin)
// POST /api/clases                    → crear clase
// GET  /api/clases/docente/:correo    → clases de un docente
// GET  /api/clases/estudiante/:correo → clases inscritas
// ======================================================

import { Router } from "express";
import { db } from "../db";

export const rutasClases = Router();

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

rutasClases.post("/", async (req, res) => {
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

    return res.status(500).json({
      error: "Error al guardar la clase",
    });
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
