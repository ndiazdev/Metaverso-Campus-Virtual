// ======================================================
// RUTA: INSCRIPCIONES
// ------------------------------------------------------
// GET  /api/inscripciones → todas (admin)
// POST /api/inscripciones → inscribir estudiante en clase
// ======================================================

import { Router } from "express";
import { db } from "../db";

export const rutasInscripciones = Router();

// ------------------------------------------------------
// TODAS LAS INSCRIPCIONES
// ------------------------------------------------------

rutasInscripciones.get("/", async (req, res) => {
  try {
    const [rows]: any = await db.query(
      `
        SELECT
          u.nombre_completo AS nombreEstudiante,
          c.materia,
          c.codigo,

          DATE_FORMAT(
            i.fecha_inscripcion,
            '%Y-%m-%d'
          ) AS fecha

        FROM inscripciones i

        JOIN cuentas u
          ON i.correo_estudiante = u.correo

        JOIN clases c
          ON i.codigo_clase = c.codigo

        ORDER BY
          i.fecha_inscripcion DESC
      `
    );

    console.log("✅ /api/inscripciones:", rows.length, "inscripciones");

    return res.json(rows);
  } catch (error) {
    console.error("❌ ERROR /api/inscripciones:");
    console.error(error);

    return res.status(500).json({
      error: "Error al consultar inscripciones",
      detalle: error instanceof Error ? error.message : String(error),
    });
  }
});

// ------------------------------------------------------
// INSCRIBIR ESTUDIANTE
// ------------------------------------------------------

rutasInscripciones.post("/", async (req, res) => {
  const { correoEstudiante, codigoClase } = req.body;

  try {
    // ----------------------------------------------
    // Comprobar que existe la clase
    // ----------------------------------------------

    const [clases]: any = await db.query(
      `
          SELECT codigo
          FROM clases
          WHERE codigo = ?
        `,
      [codigoClase]
    );

    if (clases.length === 0) {
      return res.status(404).json({
        error: "No existe ninguna clase con ese código.",
      });
    }

    // ----------------------------------------------
    // Comprobar inscripción previa
    // ----------------------------------------------

    const [previo]: any = await db.query(
      `
          SELECT id
          FROM inscripciones
          WHERE correo_estudiante = ?
            AND codigo_clase = ?
        `,
      [correoEstudiante, codigoClase]
    );

    if (previo.length > 0) {
      return res.status(400).json({
        error: "Ya estás inscrito en esta clase.",
      });
    }

    // ----------------------------------------------
    // Crear inscripción
    // ----------------------------------------------

    await db.query(
      `
          INSERT INTO inscripciones
          (
            codigo_clase,
            correo_estudiante
          )
          VALUES (?, ?)
        `,
      [codigoClase, correoEstudiante]
    );

    console.log("✅ Inscripción creada:", correoEstudiante, "→", codigoClase);

    return res.status(201).json({
      mensaje: "Inscripción exitosa",
    });
  } catch (error) {
    console.error("❌ Error en inscripción:", error);

    return res.status(500).json({
      error: "Error al inscribirse a la clase",
    });
  }
});
