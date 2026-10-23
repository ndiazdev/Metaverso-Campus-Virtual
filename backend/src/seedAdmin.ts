// ======================================================
// ADMINISTRADOR POR DEFECTO
// ------------------------------------------------------
// Al arrancar el backend se asegura de que exista la
// cuenta admin@usantoto.edu.co con rol admin. Si ya
// existe no se toca: así no se pisa una contraseña que
// se haya cambiado después.
//
// También se puede ejecutar a mano tras importar la BD:
//   npm run seed:admin
// ======================================================

import bcrypt from "bcrypt";
import { db } from "./db";

const CORREO_ADMIN = "admin@usantoto.edu.co";
const CONTRASENA_ADMIN = "Admin2026*";
const NOMBRE_ADMIN = "Administrador";

export async function asegurarAdmin(): Promise<void> {
  try {
    const [existentes]: any = await db.query(
      "SELECT id FROM cuentas WHERE correo = ?",
      [CORREO_ADMIN]
    );

    if (existentes.length > 0) {
      return;
    }

    const hash = await bcrypt.hash(CONTRASENA_ADMIN, 10);

    await db.query(
      `
        INSERT INTO cuentas
          (nombre_completo, correo, contrasena_hash, rol, carrera, materia)
        VALUES (?, ?, ?, 'admin', NULL, NULL)
      `,
      [NOMBRE_ADMIN, CORREO_ADMIN, hash]
    );

    console.log(`Admin por defecto creado: ${CORREO_ADMIN}`);
  } catch (error) {
    console.warn(
      "No se pudo crear el admin por defecto:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

if (require.main === module) {
  void asegurarAdmin().then(() => db.end());
}
