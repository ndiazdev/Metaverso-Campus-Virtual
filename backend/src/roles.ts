// ======================================================
// REGLA DE NEGOCIO: DETECCIÓN DE ROLES
// ------------------------------------------------------
// El rol de una cuenta se deduce de su correo:
//   · dominio distinto de @usantoto.edu.co → invitado
//   · profe. / profesor. / docente.        → docente
//   · cualquier otro                       → estudiante
// El rol admin no se deduce del correo: solo lo asigna
// un administrador desde el panel.
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

  return "estudiante";
}
