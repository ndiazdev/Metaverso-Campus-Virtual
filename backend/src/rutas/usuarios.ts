// ======================================================
// RUTA: USUARIOS (administración)
// ------------------------------------------------------
// GET    /api/usuarios                    → lista todas las cuentas
// POST   /api/usuarios                    → crea una cuenta (solo admin)
// PUT    /api/usuarios/:correo            → edita nombre/datos/rol (solo admin)
// DELETE /api/usuarios/:correo            → elimina una cuenta (solo admin)
// PATCH  /api/usuarios/:correo/rol        → cambia el rol
// GET    /api/usuarios/:correo/perfil     → datos de una cuenta
// PATCH  /api/usuarios/:correo/perfil     → edita nombre/datos/foto
// PATCH  /api/usuarios/:correo/contrasena → cambia la contraseña
// ======================================================

import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { ENTORNO } from "../entorno";

export const rutasUsuarios = Router();

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
    return res.status(403).json({ error: "Acceso denegado. Solo administradores" });
  }
  next();
}

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
// CREAR USUARIO (solo administración)
// ------------------------------------------------------

const ROLES_VALIDOS = ["estudiante", "docente", "admin", "invitado"];

function normalizarCorreo(valor: unknown): string {
  return String(valor ?? "").trim().toLowerCase();
}

rutasUsuarios.post("/", verificarAutenticacion, soloAdmin, async (req, res) => {
  const { nombreCompleto, contrasena, rol, carrera, materia } = req.body ?? {};
  const correo = normalizarCorreo(req.body?.correo);

  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return res.status(400).json({ error: "Escribe un correo válido." });
  }

  const nombre = String(nombreCompleto ?? "").trim();
  if (nombre.length < 3) {
    return res.status(400).json({ error: "El nombre completo debe tener al menos 3 caracteres." });
  }
  if (nombre.length > 150) {
    return res.status(400).json({ error: "El nombre completo es demasiado largo (máximo 150)." });
  }

  const clave = String(contrasena ?? "");
  if (clave.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
  }
  if (clave.length > 72) {
    return res.status(400).json({ error: "La contraseña es demasiado larga (máximo 72)." });
  }

  if (!ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: "Rol inválido." });
  }

  const carreraLimpia = String(carrera ?? "").trim() || null;
  const materiaLimpia = String(materia ?? "").trim() || null;

  if (rol === "estudiante" && !carreraLimpia) {
    return res.status(400).json({ error: "Los estudiantes deben tener carrera." });
  }
  if (rol === "docente" && !materiaLimpia) {
    return res.status(400).json({ error: "Los docentes deben tener materia." });
  }

  try {
    const [existentes]: any = await db.query(
      "SELECT id FROM cuentas WHERE correo = ?",
      [correo]
    );
    if (existentes.length > 0) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
    }

    const hash = await bcrypt.hash(clave, 10);

    await db.query(
      `
        INSERT INTO cuentas (nombre_completo, correo, contrasena_hash, rol, carrera, materia)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [nombre, correo, hash, rol, carreraLimpia, materiaLimpia]
    );

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
      [correo]
    );

    console.log("✅ Usuario creado:", correo, `(${rol})`);

    return res.status(201).json({
      mensaje: "Usuario creado correctamente",
      cuenta: filas[0],
    });
  } catch (error) {
    console.error("❌ Error al crear usuario:", error);

    return res.status(500).json({ error: "Error al crear el usuario" });
  }
});

// ------------------------------------------------------
// EDITAR USUARIO (solo administración)
// ------------------------------------------------------

rutasUsuarios.put("/:correo", verificarAutenticacion, soloAdmin, async (req, res) => {
  const correo = normalizarCorreo(req.params.correo);
  const cuerpo = req.body ?? {};
  const cambios: string[] = [];
  const valores: (string | null)[] = [];

  if (cuerpo.nombreCompleto !== undefined) {
    const nombre = String(cuerpo.nombreCompleto).trim();
    if (nombre.length < 3 || nombre.length > 150) {
      return res.status(400).json({ error: "El nombre completo debe tener entre 3 y 150 caracteres." });
    }
    cambios.push("nombre_completo = ?");
    valores.push(nombre);
  }

  if (cuerpo.rol !== undefined) {
    if (!ROLES_VALIDOS.includes(cuerpo.rol)) {
      return res.status(400).json({ error: "Rol inválido." });
    }
    cambios.push("rol = ?");
    valores.push(String(cuerpo.rol));
  }

  if (cuerpo.carrera !== undefined) {
    const carrera = String(cuerpo.carrera ?? "").trim() || null;
    cambios.push("carrera = ?");
    valores.push(carrera);
  }

  if (cuerpo.materia !== undefined) {
    const materia = String(cuerpo.materia ?? "").trim() || null;
    cambios.push("materia = ?");
    valores.push(materia);
  }

  if (cuerpo.contrasena !== undefined && String(cuerpo.contrasena).length > 0) {
    const clave = String(cuerpo.contrasena);
    if (clave.length < 6 || clave.length > 72) {
      return res.status(400).json({ error: "La contraseña debe tener entre 6 y 72 caracteres." });
    }
    const hash = await bcrypt.hash(clave, 10);
    cambios.push("contrasena_hash = ?");
    valores.push(hash);
  }

  if (cambios.length === 0) {
    return res.status(400).json({ error: "No hay cambios para guardar." });
  }

  try {
    valores.push(correo);

    const [resultado]: any = await db.query(
      `UPDATE cuentas SET ${cambios.join(", ")} WHERE correo = ?`,
      valores
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: "No se encontró la cuenta." });
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
      [correo]
    );

    console.log("✅ Usuario editado:", correo);

    return res.json({
      mensaje: "Usuario actualizado correctamente",
      cuenta: filas[0],
    });
  } catch (error) {
    console.error("❌ Error al editar usuario:", error);

    return res.status(500).json({ error: "Error al actualizar el usuario" });
  }
});

// ------------------------------------------------------
// ELIMINAR USUARIO (solo administración)
// ------------------------------------------------------
// Las FKs hacia cuentas son clases.correo_docente e
// inscripciones.correo_estudiante. Si la cuenta da clases se
// bloquea (borrarlas dejaría huérfanos a los alumnos de esas
// clases); las inscripciones propias del usuario sí se borran.

rutasUsuarios.delete("/:correo", verificarAutenticacion, soloAdmin, async (req: any, res: any) => {
  const correo = normalizarCorreo(req.params.correo);

  if (correo === normalizarCorreo(req.usuario?.correo)) {
    return res.status(400).json({ error: "No puedes eliminar tu propia cuenta." });
  }

  try {
    const [existentes]: any = await db.query(
      "SELECT id FROM cuentas WHERE correo = ?",
      [correo]
    );
    if (existentes.length === 0) {
      return res.status(404).json({ error: "No se encontró la cuenta." });
    }

    const [clases]: any = await db.query(
      "SELECT COUNT(*) AS total FROM clases WHERE correo_docente = ?",
      [correo]
    );
    if (clases[0].total > 0) {
      return res.status(409).json({
        error: `No se puede eliminar: la cuenta tiene ${clases[0].total} clase(s) a su nombre. Transfiérelas o elimínalas primero.`,
      });
    }

    await db.query(
      "DELETE FROM inscripciones WHERE correo_estudiante = ?",
      [correo]
    );
    await db.query("DELETE FROM cuentas WHERE correo = ?", [correo]);

    console.log("✅ Usuario eliminado:", correo);

    return res.json({ mensaje: "Usuario eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar usuario:", error);

    return res.status(500).json({ error: "Error al eliminar el usuario" });
  }
});

// ------------------------------------------------------
// CAMBIAR ROL
// ------------------------------------------------------

rutasUsuarios.patch("/:correo/rol", verificarAutenticacion, soloAdmin, async (req, res) => {
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
