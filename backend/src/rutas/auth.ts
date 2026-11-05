// ======================================================
// RUTA: AUTENTICACIÓN
// ------------------------------------------------------
// POST /api/login                    → valida correo y contraseña
// POST /api/registro/solicitar-codigo → envía un código de 6 dígitos
// POST /api/registro                 → verifica el código y crea la cuenta
// ======================================================

import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { ENTORNO } from "../entorno";
import {
  correoValido,
  esSolicitudFallida,
  esVerificacionFallida,
  normalizarCorreo,
  solicitarCodigo,
  verificarCodigo,
} from "../verificacionCorreo";

export const rutasAuth = Router();

// ------------------------------------------------------
// LOGIN
// ------------------------------------------------------

rutasAuth.post("/login", async (req, res) => {
  const correo = normalizarCorreo(req.body?.correo);
  const contrasena = String(req.body?.contrasena ?? "");

  if (!correo || !contrasena) {
    return res.status(400).json({
      error: "Ingresa correo y contraseña.",
    });
  }

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
        foto,
        contrasena_hash
      FROM cuentas
      WHERE correo = ?
      `,
      [correo]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        error: "Credenciales inválidas",
      });
    }

    const cuenta = rows[0];

    const coincide = await bcrypt.compare(contrasena, cuenta.contrasena_hash);

    if (!coincide) {
      return res.status(401).json({
        error: "Credenciales inválidas",
      });
    }

    delete cuenta.contrasena_hash;

    const token = jwt.sign(
      { correo: cuenta.correo, rol: cuenta.rol, id: cuenta.id },
      ENTORNO.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      cuenta,
      token,
    });
  } catch (error) {
    console.error("--- ERROR DE BASE DE DATOS (login) ---");
    console.error(error);

    return res.status(500).json({
      error: "Error en la base de datos",
    });
  }
});

// ------------------------------------------------------
// REGISTRO: PEDIR CÓDIGO
// ------------------------------------------------------

rutasAuth.post("/registro/solicitar-codigo", async (req, res) => {
  const correo = normalizarCorreo(req.body?.correo);

  if (!correoValido(correo)) {
    return res.status(400).json({
      error: "Escribe un correo válido.",
    });
  }

  try {
    const [existentes]: any = await db.query(
      "SELECT id FROM cuentas WHERE correo = ?",
      [correo]
    );

    if (existentes.length > 0) {
      return res.status(409).json({
        error: "Ya existe una cuenta con ese correo.",
      });
    }

    const resultado = await solicitarCodigo(correo);

    if (esSolicitudFallida(resultado)) {
      return res.status(resultado.status).json({
        error: resultado.error,
      });
    }

    return res.json({
      mensaje: "Código enviado. Revisa tu correo.",
    });
  } catch (error) {
    console.error("--- ERROR AL ENVIAR EL CÓDIGO ---");
    console.error(error);

    return res.status(500).json({
      error: "No se pudo enviar el código. Intenta de nuevo.",
    });
  }
});

// ------------------------------------------------------
// REGISTRO: VERIFICAR Y CREAR CUENTA
// ------------------------------------------------------

rutasAuth.post("/registro", async (req, res) => {
  const nombre = String(req.body?.nombreCompleto ?? "").trim();
  const correo = normalizarCorreo(req.body?.correo);
  const clave = String(req.body?.contrasena ?? "");
  const codigo = String(req.body?.codigo ?? "").trim();
  const carrera = String(req.body?.carrera ?? "").trim() || null;

  if (!nombre || !correo || !clave) {
    return res.status(400).json({
      error: "Faltan datos obligatorios.",
    });
  }

  if (!correoValido(correo)) {
    return res.status(400).json({
      error: "Escribe un correo válido.",
    });
  }

  if (nombre.length < 3 || nombre.length > 150) {
    return res.status(400).json({
      error: "El nombre completo debe tener entre 3 y 150 caracteres.",
    });
  }

  if (clave.length < 6 || clave.length > 72) {
    return res.status(400).json({
      error: "La contraseña debe tener entre 6 y 72 caracteres.",
    });
  }

  if (!/^\d{6}$/.test(codigo)) {
    return res.status(400).json({
      error: "Escribe el código de 6 dígitos.",
    });
  }

  try {
    const [existentes]: any = await db.query(
      "SELECT id FROM cuentas WHERE correo = ?",
      [correo]
    );

    if (existentes.length > 0) {
      return res.status(409).json({
        error: "Ya existe una cuenta con ese correo.",
      });
    }

    const verificacion = await verificarCodigo(correo, codigo);

    if (esVerificacionFallida(verificacion)) {
      return res.status(400).json({
        error: verificacion.error,
      });
    }

    const hash = await bcrypt.hash(clave, 10);
    const rolRegistro = "estudiante";

    const [resultado]: any = await db.query(
      `
        INSERT INTO cuentas
        (
          nombre_completo,
          correo,
          contrasena_hash,
          rol,
          carrera,
          materia
        )
        VALUES (?, ?, ?, ?, ?, NULL)
      `,
      [nombre, correo, hash, rolRegistro, carrera]
    );

    const cuenta = {
      id: resultado.insertId,
      nombreCompleto: nombre,
      correo,
      rol: rolRegistro,
      carrera,
      materia: null,
    };

    const token = jwt.sign(
      { correo: cuenta.correo, rol: cuenta.rol, id: cuenta.id },
      ENTORNO.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.status(201).json({
      cuenta,
      token,
    });
  } catch (error) {
    console.error("--- ERROR DE BASE DE DATOS (registro) ---");
    console.error(error);

    return res.status(500).json({
      error: "Error al registrar la cuenta.",
    });
  }
});
