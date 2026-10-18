// ======================================================
// RUTA: INSCRIPCIONES
// ------------------------------------------------------
// GET    /api/inscripciones     → todas (admin)
// POST   /api/inscripciones     → inscribir estudiante en clase
// PUT    /api/inscripciones/:id → cambiar de clase (solo admin)
// DELETE /api/inscripciones/:id → anular inscripción (solo admin)
// ======================================================

import { Router } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { ENTORNO } from "../entorno";

export const rutasInscripciones = Router();

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

function soloAdmin(req: any, res: any, next: any) {
  if (req.usuario?.rol !== "admin") {
    return res.status(403).json({ error: "Acceso denegado: requiere administración." });
  }
  next();
}

// ------------------------------------------------------
// TODAS LAS INSCRIPCIONES
// ------------------------------------------------------

rutasInscripciones.get("/", async (req, res) => {
  try {
    const [rows]: any = await db.query(
      `
        SELECT
          i.id,
          i.correo_estudiante AS correoEstudiante,
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

rutasInscripciones.post("/", verificarAutenticacion, async (req, res) => {
  const correoEstudiante = String(req.body?.correoEstudiante ?? "").trim().toLowerCase();
  const codigoClase = String(req.body?.codigoClase ?? "").trim().toUpperCase();

  if (!correoEstudiante || !codigoClase) {
    return res.status(400).json({ error: "Faltan datos: estudiante y clase." });
  }

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
    // Comprobar que existe el estudiante
    // ----------------------------------------------

    const [estudiantes]: any = await db.query(
      "SELECT correo FROM cuentas WHERE correo = ?",
      [correoEstudiante]
    );
    if (estudiantes.length === 0) {
      return res.status(404).json({ error: "No existe ninguna cuenta con ese correo." });
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

// ------------------------------------------------------
// CAMBIAR DE CLASE (solo administración)
// ------------------------------------------------------
// Mueve la inscripción a otra clase (el estudiante no cambia).

rutasInscripciones.put("/:id", verificarAutenticacion, soloAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const codigoClase = String(req.body?.codigoClase ?? "").trim().toUpperCase();

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Id de inscripción inválido." });
  }
  if (!codigoClase) {
    return res.status(400).json({ error: "Falta la clase destino." });
  }

  try {
    const [previa]: any = await db.query(
      "SELECT id, correo_estudiante FROM inscripciones WHERE id = ?",
      [id]
    );
    if (previa.length === 0) {
      return res.status(404).json({ error: "No se encontró la inscripción." });
    }

    const [clases]: any = await db.query(
      "SELECT codigo FROM clases WHERE codigo = ?",
      [codigoClase]
    );
    if (clases.length === 0) {
      return res.status(404).json({ error: "No existe ninguna clase con ese código." });
    }

    const [dup]: any = await db.query(
      "SELECT id FROM inscripciones WHERE correo_estudiante = ? AND codigo_clase = ? AND id <> ?",
      [previa[0].correo_estudiante, codigoClase, id]
    );
    if (dup.length > 0) {
      return res.status(409).json({ error: "El estudiante ya está inscrito en esa clase." });
    }

    await db.query("UPDATE inscripciones SET codigo_clase = ? WHERE id = ?", [codigoClase, id]);

    console.log("✅ Inscripción movida:", id, "→", codigoClase);

    return res.json({ mensaje: "Inscripción actualizada correctamente" });
  } catch (error) {
    console.error("❌ Error al editar inscripción:", error);
    return res.status(500).json({ error: "Error al actualizar la inscripción" });
  }
});

// ------------------------------------------------------
// ANULAR INSCRIPCIÓN (solo administración)
// ------------------------------------------------------

rutasInscripciones.delete("/:id", verificarAutenticacion, soloAdmin, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Id de inscripción inválido." });
  }

  try {
    const [resultado]: any = await db.query("DELETE FROM inscripciones WHERE id = ?", [id]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: "No se encontró la inscripción." });
    }

    console.log("✅ Inscripción eliminada:", id);

    return res.json({ mensaje: "Inscripción eliminada correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar inscripción:", error);
    return res.status(500).json({ error: "Error al eliminar la inscripción" });
  }
});
