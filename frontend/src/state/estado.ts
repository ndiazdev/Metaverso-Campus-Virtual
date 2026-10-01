

export type Rol = "estudiante" | "docente" | "admin" | "invitado";

const DOMINIO_INSTITUCIONAL = "@usantoto.edu.co";


export function detectarRolPorCorreo(correo: string): Rol {
  const correoNormalizado = correo.trim().toLowerCase();
  if (!correoNormalizado.endsWith(DOMINIO_INSTITUCIONAL)) {
    return "invitado";
  }
  const parteLocal = correoNormalizado.split("@")[0];
  const prefijosDocente = ["profe.", "profesor.", "docente."];
  if (prefijosDocente.some((prefijo) => parteLocal.startsWith(prefijo))) return "docente";
  if (parteLocal.startsWith("admin.")) return "admin";
  return "estudiante";
}

export interface Cuenta {
  nombreCompleto: string;
  correo: string;
  contrasena: string; // demo únicamente: en un backend real NUNCA se guarda así
  rol: Rol;
  carrera?: string; // solo estudiante
  materia?: string; // solo docente
  foto?: string; // dataURL de la foto propia (opcional)
}

export interface Clase {
  codigo: string; // ej: "MAT-A-SIS"
  materia: string;
  correoDocente: string;
  nombreDocente: string;
  fechaCreacion: string;
  estudiantesInscritos: string[]; // correos
}

const CLAVE_CUENTAS = "usta_metaverso_cuentas";
const CLAVE_CLASES = "usta_metaverso_clases";
const CLAVE_SESION = "usta_metaverso_sesion";

// ---------- Preferencia de avatar ----------
// Qué cuerpo usa la persona dentro del salón ("mujer" u "hombre"). La elige el
// usuario en Ajustes del dashboard y la lee personaje.ts al cargar el modelo:
// el rol de la sesión decide el CONJUNTO (estudiante / docente) y esta
// preferencia, la variante dentro del conjunto.
export type GeneroAvatar = "mujer" | "hombre";

const CLAVE_AVATAR = "usta_metaverso_avatar";

/** Preferencia guardada; "mujer" la primera vez. */
export function obtenerGeneroAvatar(): GeneroAvatar {
  const guardado = localStorage.getItem(CLAVE_AVATAR);
  return guardado === "hombre" ? "hombre" : "mujer";
}

export function guardarGeneroAvatar(genero: GeneroAvatar): void {
  localStorage.setItem(CLAVE_AVATAR, genero);
}

// ---------- Cuentas ----------
export function obtenerCuentas(): Cuenta[] {
  const datos = localStorage.getItem(CLAVE_CUENTAS);
  return datos ? JSON.parse(datos) : [];
}

export function guardarCuenta(cuenta: Cuenta): void {
  const cuentas = obtenerCuentas();
  cuentas.push(cuenta);
  localStorage.setItem(CLAVE_CUENTAS, JSON.stringify(cuentas));
}

export function buscarCuenta(correo: string): Cuenta | undefined {
  return obtenerCuentas().find((c) => c.correo.toLowerCase() === correo.toLowerCase());
}

// ---------- Clases ----------
export function obtenerClases(): Clase[] {
  const datos = localStorage.getItem(CLAVE_CLASES);
  return datos ? JSON.parse(datos) : [];
}

export function guardarClase(clase: Clase): void {
  const clases = obtenerClases();
  clases.push(clase);
  localStorage.setItem(CLAVE_CLASES, JSON.stringify(clases));
}

export function buscarClasePorCodigo(codigo: string): Clase | undefined {
  return obtenerClases().find((c) => c.codigo.toUpperCase() === codigo.toUpperCase());
}

export function clasesDelDocente(correoDocente: string): Clase[] {
  return obtenerClases().filter((c) => c.correoDocente === correoDocente);
}

export function inscribirEstudiante(codigo: string, correoEstudiante: string): boolean {
  const clases = obtenerClases();
  const clase = clases.find((c) => c.codigo.toUpperCase() === codigo.toUpperCase());
  if (!clase) return false;
  if (!clase.estudiantesInscritos.includes(correoEstudiante)) {
    clase.estudiantesInscritos.push(correoEstudiante);
  }
  localStorage.setItem(CLAVE_CLASES, JSON.stringify(clases));
  return true;
}

// ---------- Sesión activa (el "token" con el que entraste) ----------
/**
 * Token de sesión: se guarda COMPLETO el usuario con el que se inició sesión,
 * no solo el correo. Así, al salir de la clase (⚙️ → Salir), el panel que se
 * muestra es el de la cuenta con la que entraste, aunque esa cuenta venga del
 * backend (API) y no exista en el localStorage local.
 *
 * El backend todavía no emite JWT: cuando lo haga, el mismo objeto lo guarda
 * en `token` y aquí queda listo para reenviarlo en los `fetch`.
 */
interface SesionGuardada {
  version: 1;
  correo: string;
  cuenta: Cuenta;
  token?: string;
  abiertoEn: string;
}

export function guardarSesion(
  correo: string,
  cuenta?: Cuenta,
  token?: string,
): void {
  const datos: Cuenta | undefined = cuenta ?? buscarCuenta(correo);
  if (!datos) {
    // Sin cuenta completa (no debería pasar): al menos recuerda el correo.
    localStorage.setItem(CLAVE_SESION, correo);
    return;
  }
  const sesion: SesionGuardada = {
    version: 1,
    correo,
    cuenta: datos,
    token,
    abiertoEn: new Date().toISOString(),
  };
  localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
}

/** Cuenta de la sesión abierta, o null si no hay sesión. */
export function obtenerSesion(): Cuenta | null {
  const crudo = localStorage.getItem(CLAVE_SESION);
  if (!crudo) return null;

  // Formato viejo: solo el correo en texto plano.
  if (!crudo.startsWith("{")) return buscarCuenta(crudo) || null;

  try {
    const sesion = JSON.parse(crudo) as Partial<SesionGuardada>;
    const cuenta = sesion.cuenta;
    if (cuenta?.correo) return cuenta;
    // Datos incompletos: último recurso, buscar por correo guardado.
    if (sesion.correo) return buscarCuenta(sesion.correo) || null;
    return null;
  } catch {
    return buscarCuenta(crudo) || null;
  }
}

/** Token del backend si existe (pendiente: el API aún no lo emite). */
export function obtenerToken(): string | null {
  const crudo = localStorage.getItem(CLAVE_SESION);
  if (!crudo || !crudo.startsWith("{")) return null;
  try {
    const sesion = JSON.parse(crudo) as Partial<SesionGuardada>;
    return sesion.token ?? null;
  } catch {
    return null;
  }
}

export function cerrarSesion(): void {
  localStorage.removeItem(CLAVE_SESION);
}

// ---------- Utilidad ----------
export function generarCodigoClase(materia: string): string {
  const abreviatura = materia
    .trim()
    .split(/\s+/)
    .map((palabra) => palabra.substring(0, 3).toUpperCase())
    .join("")
    .substring(0, 6);
  const numeroAleatorio = Math.floor(100 + Math.random() * 900);
  return `${abreviatura}-${numeroAleatorio}`;
}