// ======================================================
// RUTA: USUARIOS (administración)
// ------------------------------------------------------
// GET   /api/usuarios                    → lista todas las cuentas
// PATCH /api/usuarios/:correo/rol        → cambia el rol
// GET   /api/usuarios/:correo/perfil     → datos de una cuenta
// PATCH /api/usuarios/:correo/perfil     → edita nombre/datos/foto
// PATCH /api/usuarios/:correo/contrasena → cambia la contraseña
// ======================================================

import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "../db";

export const rutasUsuarios = Router();

// ------------------------------------------------------
// COLUMNA "foto" (migración suave)
// ------------------------------------------------------
// La foto de perfil se guarda en la tabla `cuentas`. Si la
// columna todavía no existe se crea al arrancar; si ya
// existe MySQL responde ER_DUP_FIELDNAME y lo ignoramos.
async function asegurarColumnaFoto(): Promise<void> {
  try {
    await db.query(
      "ALTER TABLE cuentas ADD COLUMN foto MEDIUMTEXT NULL AFTER materia"
    );

    console.log("✅ Columna 'foto' creada en la tabla cuentas");
  } catch (error) {
    const codigo = (error as { code?: string }).code;

    if (codigo !== "ER_DUP_FIELDNAME") {
      console.warn(
        "⚠ No se pudo crear la columna 'foto':",
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

void asegurarColumnaFoto();

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
          materia,
          foto
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

// ------------------------------------------------------
// PERFIL: leer los datos de una cuenta
// ------------------------------------------------------
rutasUsuarios.get("/:correo/perfil", async (req, res) => {
  try {
    const [filas]: any = await db.query(
      `
        SELECT
          id,
          correo,
          nombre_completo AS nombreCompleto,
          rol,
          carrera,
          materia,
          foto
        FROM cuentas
        WHERE correo = ?
      `,
      [req.params.correo]
    );

    if (filas.length === 0) {
      return res.status(404).json({
        error: "No se encontró la cuenta.",
      });
    }

    return res.json({ cuenta: filas[0] });
  } catch (error) {
    console.error("❌ Error al leer el perfil:", error);

    return res.status(500).json({
      error: "Error al leer el perfil",
    });
  }
});

// ------------------------------------------------------
// PERFIL: editar los datos (nombre, carrera, materia, foto)
// ------------------------------------------------------
rutasUsuarios.patch("/:correo/perfil", async (req, res) => {
  const cuerpo = req.body ?? {};
  const cambios: string[] = [];
  const valores: (string | null)[] = [];

  const limiteTexto = (
    valor: unknown,
    campo: string,
    maximo: number,
    minimo = 0
  ): string | null => {
    const texto = String(valor ?? "").trim();

    if (texto.length < minimo) {
      return `${campo} debe tener al menos ${minimo} caracteres.`;
    }

    if (texto.length > maximo) {
      return `${campo} es demasiado largo (máximo ${maximo} caracteres).`;
    }

    return null;
  };

  if (cuerpo.nombreCompleto !== undefined) {
    const fallo = limiteTexto(cuerpo.nombreCompleto, "El nombre completo", 120, 3);

    if (fallo) return res.status(400).json({ error: fallo });

    cambios.push("nombre_completo = ?");
    valores.push(String(cuerpo.nombreCompleto).trim());
  }

  if (cuerpo.carrera !== undefined) {
    const fallo = limiteTexto(cuerpo.carrera, "La carrera", 120);

    if (fallo) return res.status(400).json({ error: fallo });

    cambios.push("carrera = ?");
    valores.push(String(cuerpo.carrera).trim() || null);
  }

  if (cuerpo.materia !== undefined) {
    const fallo = limiteTexto(cuerpo.materia, "La materia", 120);

    if (fallo) return res.status(400).json({ error: fallo });

    cambios.push("materia = ?");
    valores.push(String(cuerpo.materia).trim() || null);
  }

  if (cuerpo.foto !== undefined) {
    if (cuerpo.foto === null || cuerpo.foto === "") {
      cambios.push("foto = NULL");
    } else {
      const foto = String(cuerpo.foto);

      if (!foto.startsWith("data:image/")) {
        return res.status(400).json({
          error: "La foto debe ser una imagen (JPG, PNG o WebP).",
        });
      }

      if (foto.length > 900000) {
        return res.status(400).json({
          error: "La imagen es demasiado pesada. Usa una más pequeña.",
        });
      }

      cambios.push("foto = ?");
      valores.push(foto);
    }
  }

  if (cambios.length === 0) {
    return res.status(400).json({
      error: "No hay cambios para guardar.",
    });
  }

  try {
    valores.push(req.params.correo);

    const [resultado]: any = await db.query(
      `UPDATE cuentas SET ${cambios.join(", ")} WHERE correo = ?`,
      valores
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        error: "No se encontró la cuenta.",
      });
    }

    const [filas]: any = await db.query(
      `
        SELECT
          id,
          correo,
          nombre_completo AS nombreCompleto,
          rol,
          carrera,
          materia,
          foto
        FROM cuentas
        WHERE correo = ?
      `,
      [req.params.correo]
    );

    console.log("✅ Perfil actualizado:", req.params.correo);

    return res.json({
      mensaje: "Perfil actualizado correctamente",
      cuenta: filas[0],
    });
  } catch (error) {
    console.error("❌ Error al actualizar el perfil:", error);

    if ((error as { code?: string }).code === "ER_BAD_FIELD_ERROR") {
      return res.status(500).json({
        error:
          "Falta la columna 'foto' en la base de datos. Reinicia el servidor para crearla.",
      });
    }

    return res.status(500).json({
      error: "Error al actualizar el perfil",
    });
  }
});

// ------------------------------------------------------
// PERFIL: cambiar la contraseña
// ------------------------------------------------------
rutasUsuarios.patch("/:correo/contrasena", async (req, res) => {
  const { contrasenaActual, contrasenaNueva } = req.body ?? {};

  if (!contrasenaActual || !contrasenaNueva) {
    return res.status(400).json({
      error: "Faltan datos: escribe la contraseña actual y la nueva.",
    });
  }

  const nueva = String(contrasenaNueva);

  if (nueva.length < 6) {
    return res.status(400).json({
      error: "La nueva contraseña debe tener al menos 6 caracteres.",
    });
  }

  if (nueva.length > 72) {
    return res.status(400).json({
      error: "La nueva contraseña es demasiado larga (máximo 72).",
    });
  }

  try {
    const [filas]: any = await db.query(
      "SELECT contrasena_hash FROM cuentas WHERE correo = ?",
      [req.params.correo]
    );

    if (filas.length === 0) {
      return res.status(404).json({
        error: "No se encontró la cuenta.",
      });
    }

    const coincide = await bcrypt.compare(
      String(contrasenaActual),
      filas[0].contrasena_hash
    );

    if (!coincide) {
      return res.status(401).json({
        error: "La contraseña actual no es correcta.",
      });
    }

    const hash = await bcrypt.hash(nueva, 10);

    await db.query(
      "UPDATE cuentas SET contrasena_hash = ? WHERE correo = ?",
      [hash, req.params.correo]
    );

    console.log("✅ Contraseña actualizada:", req.params.correo);

    return res.json({
      mensaje: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    console.error("❌ Error al cambiar la contraseña:", error);

    return res.status(500).json({
      error: "Error al cambiar la contraseña",
    });
  }
});
