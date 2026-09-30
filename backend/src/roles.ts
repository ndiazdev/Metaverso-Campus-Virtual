// ======================================================
// REGLA DE NEGOCIO: DETECCIÓN DE ROLES
// ------------------------------------------------------
// El rol de una cuenta se deduce de su correo:
//   · dominio distinto de @usantoto.edu.co → invitado
//   · profe. / profesor. / docente.        → docente
//   · admin.                               → admin
//   · cualquier otro                       → estudiante
// ======================================================

export function detectarRolPorCorreo(correo: string): string {
  const DOMINIO_INSTITUCIONAL = "@usantoto.edu.co";

  const correoNormalizado = correo.trim().toLowerCase();

  if (!correoNormalizado.endsWith(DOMINIO_INSTITUCIONAL)) {
    return "invitado";
  }

  const parteLocal = correoNormalizado.split("@")[0];

  const prefijosDocente = ["profe.", "profesor.", "docente."];

  if (prefijosDocente.some((prefijo) => parteLocal.startsWith(prefijo))) {
    return "docente";
  }

  if (parteLocal.startsWith("admin.")) {
    return "admin";
  }

  return "estudiante";
}
