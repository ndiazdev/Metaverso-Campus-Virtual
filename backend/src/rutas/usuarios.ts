// ======================================================
// RUTA: USUARIOS (administración)
// ------------------------------------------------------
// GET   /api/usuarios                 → lista todas las cuentas
// PATCH /api/usuarios/:correo/rol     → cambia el rol
// ======================================================

import { Router } from "express";
import { db } from "../db";

export const rutasUsuarios = Router();

// ------------------------------------------------------
// TODOS LOS USUARIOS
// ------------------------------------------------------

rutasUsuarios.get("/", async (req, res) => {
  try {
    const [rows]: any = await db.query(
      `
        SELECT
          id,
          correo,
          nombre_completo AS nombreCompleto,
          rol,
          carrera,
          materia
        FROM cuentas
        ORDER BY nombre_completo
      `
    );

    console.log("✅ /api/usuarios:", rows.length, "usuarios");

    return res.json(rows);
  } catch (error) {
    console.error("❌ ERROR /api/usuarios:");
    console.error(error);

    return res.status(500).json({
      error: "Error al consultar usuarios",
      detalle: error instanceof Error ? error.message : String(error),
    });
  }
});

// ------------------------------------------------------
// CAMBIAR ROL
// ------------------------------------------------------

rutasUsuarios.patch("/:correo/rol", async (req, res) => {
  const { nuevoRol } = req.body;

  if (nuevoRol !== "docente" && nuevoRol !== "estudiante") {
    return res.status(400).json({
      error: "Solo se puede cambiar a docente o estudiante.",
    });
  }

  try {
    const [resultado]: any = await db.query(
      `
          UPDATE cuentas
          SET rol = ?
          WHERE correo = ?
        `,
      [nuevoRol, req.params.correo]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        error: "No se encontró el usuario.",
      });
    }

    console.log("✅ Rol actualizado:", req.params.correo, "→", nuevoRol);

    return res.json({
      mensaje: "Rol actualizado correctamente",
    });
  } catch (error) {
    console.error("❌ Error al actualizar rol:", error);

    return res.status(500).json({
      error: "Error al actualizar el rol",
    });
  }
});
