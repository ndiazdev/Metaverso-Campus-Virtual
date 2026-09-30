// ======================================================
// RUTA: AUTENTICACIÓN
// ------------------------------------------------------
// POST /api/login     → valida correo y contraseña
// POST /api/registro  → crea la cuenta (rol detectado
//                       a partir del correo)
// ======================================================

import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "../db";
import { detectarRolPorCorreo } from "../roles";

export const rutasAuth = Router();

// ------------------------------------------------------
// LOGIN
// ------------------------------------------------------

rutasAuth.post("/login", async (req, res) => {
  const { correo, contrasena } = req.body;

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

    return res.json({
      cuenta,
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
// REGISTRO
// ------------------------------------------------------

rutasAuth.post("/registro", async (req, res) => {
  const { nombreCompleto, correo, contrasena, carrera, materia } = req.body;

  if (!nombreCompleto || !correo || !contrasena) {
    return res.status(400).json({
      error: "Faltan datos obligatorios.",
    });
  }

  const rolDetectado = detectarRolPorCorreo(correo);

  try {
    const [existentes]: any = await db.query(
      "SELECT id FROM cuentas WHERE correo = ?",
      [correo]
    );

    if (existentes.length > 0) {
      return res.status(400).json({
        error: "Ya existe una cuenta con ese correo.",
      });
    }

    const hash = await bcrypt.hash(contrasena, 10);

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
      [nombreCompleto, correo, hash, rolDetectado, carrera || null, materia || null]
    );

    const cuenta = {
      id: resultado.insertId,
      nombreCompleto,
      correo,
      rol: rolDetectado,
      carrera: carrera || null,
      materia: materia || null,
    };

    return res.status(201).json({
      cuenta,
    });
  } catch (error) {
    console.error("--- ERROR DE BASE DE DATOS (registro) ---");
    console.error(error);

    return res.status(500).json({
      error: "Error al registrar la cuenta.",
    });
  }
});
