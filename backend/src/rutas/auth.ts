// ======================================================
// RUTA: AUTENTICACIÓN
// ------------------------------------------------------
// POST /api/login     → valida correo y contraseña
// POST /api/registro  → crea la cuenta directamente (sin código)
//
// El registro público solo crea estudiantes y docentes. El rol admin
// se asigna únicamente desde el panel de administración.
// ======================================================

import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { ENTORNO } from "../entorno";

export const rutasAuth = Router();

function normalizarCorreo(valor: unknown): string {
  return String(valor ?? "").trim().toLowerCase();
}

function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

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
// REGISTRO: CREAR CUENTA
// ------------------------------------------------------

rutasAuth.post("/registro", async (req, res) => {
  const nombre = String(req.body?.nombreCompleto ?? "").trim();
  const correo = normalizarCorreo(req.body?.correo);
  const clave = String(req.body?.contrasena ?? "");
  const rol = String(req.body?.rol ?? "estudiante").trim().toLowerCase();
  const carrera = String(req.body?.carrera ?? "").trim() || null;
  const materia = String(req.body?.materia ?? "").trim() || null;

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

  if (rol !== "estudiante" && rol !== "docente") {
    return res.status(400).json({
      error: "El rol debe ser estudiante o docente.",
    });
  }

  if (rol === "estudiante" && !carrera) {
    return res.status(400).json({
      error: "Los estudiantes deben tener carrera.",
    });
  }

  if (rol === "docente" && !materia) {
    return res.status(400).json({
      error: "Los docentes deben tener materia.",
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

    const hash = await bcrypt.hash(clave, 10);
    const carreraFinal = rol === "estudiante" ? carrera : null;
    const materiaFinal = rol === "docente" ? materia : null;

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
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [nombre, correo, hash, rol, carreraFinal, materiaFinal]
    );

    const cuenta = {
      id: resultado.insertId,
      nombreCompleto: nombre,
      correo,
      rol,
      carrera: carreraFinal,
      materia: materiaFinal,
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
