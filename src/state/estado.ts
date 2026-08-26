

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

// ---------- Sesión activa ----------
export function guardarSesion(correo: string): void {
  localStorage.setItem(CLAVE_SESION, correo);
}

export function obtenerSesion(): Cuenta | null {
  const correo = localStorage.getItem(CLAVE_SESION);
  if (!correo) return null;
  return buscarCuenta(correo) || null;
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