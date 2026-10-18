

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

/** Preferencia guardada; "mujer" la primera vez.
 *  Igual que la sesión: primero la de ESTA pestaña (así dos pestañas con
 *  cuentas distintas pueden llevar skins distintas) y si no, la compartida. */
export function obtenerGeneroAvatar(): GeneroAvatar {
  const guardado = sessionStorage.getItem(CLAVE_AVATAR) ?? localStorage.getItem(CLAVE_AVATAR);
  return guardado === "hombre" ? "hombre" : "mujer";
}

export function guardarGeneroAvatar(genero: GeneroAvatar): void {
  sessionStorage.setItem(CLAVE_AVATAR, genero);
  localStorage.setItem(CLAVE_AVATAR, genero);
}

// Ventana de skin abierta (elegirSkin.ts la marca al abrirse y se resuelve
// al cerrarse). Mientras exista, cargarPersonaje ESPERA antes de leer el
// género: así el salón se carga y se ve DETRÁS de la ventana (en vez de la
// pantalla en blanco de antes) y el modelo que entra es el que eligió el
// usuario en esa misma sesión.
let skinPendiente: Promise<unknown> | null = null;

export function marcarSkinPendiente(promesa: Promise<unknown>): void {
  skinPendiente = promesa;
  promesa.then(
    () => {
      if (skinPendiente === promesa) skinPendiente = null;
    },
    () => {
      if (skinPendiente === promesa) skinPendiente = null;
    },
  );
}

/** Resuelve al cerrarse la ventana de skin, o ya mismo si no hay ninguna. */
export function esperarSkinPendiente(): Promise<void> {
  return skinPendiente ? skinPendiente.then(() => undefined) : Promise.resolve();
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
 * El login guarda aquí el JWT que emite el backend; api/cliente.ts lo
 * reenvía en la cabecera Authorization de cada fetch a la API.
 *
 * DÓNDE SE GUARDA (y por qué, en dos sitios): en `sessionStorage` (propio de
 * ESTA pestaña) y en `localStorage` (compartido por todo el navegador). Se
 * LEE primero el de la pestaña, así que dos pestañas abiertas a la vez
 * pueden entrar a la misma clase como dos usuarios distintos (probar el
 * salón con varias cuentas): antes las dos peleaban por la misma clave de
 * localStorage y las dos entraban con el último correo logueado. Una pestaña
 * nueva —o el navegador reabierto, donde no hay sessionStorage— toma la de
 * localStorage, así que la sesión sigue sobreviviendo al cierre. Al duplicar
 * una pestaña el navegador copia su sessionStorage: la copia arranca con la
 * misma sesión y cambiar de cuenta ahí no toca a la original.
 */
interface SesionGuardada {
  version: 1;
  correo: string;
  cuenta: Cuenta;
  token?: string;
  abiertoEn: string;
}

/** Lo que hay guardado en la sesión: pestaña primero, navegador después. */
function leerSesionCruda(): string | null {
  return sessionStorage.getItem(CLAVE_SESION) ?? localStorage.getItem(CLAVE_SESION);
}

/** Guarda en la pestaña (identidad de ESTA pestaña) y en el navegador
 *  (sesión por defecto para pestañas nuevas y para tras reiniciar). */
function escribirSesionCruda(valor: string): void {
  sessionStorage.setItem(CLAVE_SESION, valor);
  localStorage.setItem(CLAVE_SESION, valor);
}

export function guardarSesion(
  correo: string,
  cuenta?: Cuenta,
  token?: string,
): void {
  const datos: Cuenta | undefined = cuenta ?? buscarCuenta(correo);
  if (!datos) {
    // Sin cuenta completa (no debería pasar): al menos recuerda el correo.
    escribirSesionCruda(correo);
    return;
  }
  const sesion: SesionGuardada = {
    version: 1,
    correo,
    cuenta: datos,
    token,
    abiertoEn: new Date().toISOString(),
  };
  escribirSesionCruda(JSON.stringify(sesion));
}

/** Cuenta de la sesión abierta, o null si no hay sesión. */
export function obtenerSesion(): Cuenta | null {
  const crudo = leerSesionCruda();
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

/** Token JWT del login; api/cliente.ts lo envía en Authorization. */
export function obtenerToken(): string | null {
  const crudo = leerSesionCruda();
  if (!crudo || !crudo.startsWith("{")) return null;
  try {
    const sesion = JSON.parse(crudo) as Partial<SesionGuardada>;
    return sesion.token ?? null;
  } catch {
    return null;
  }
}

export function cerrarSesion(): void {
  // La sesión de ESTA pestaña y la por defecto de las pestañas nuevas
  // (localStorage). Otras pestañas ya abiertas conservan la suya.
  sessionStorage.removeItem(CLAVE_SESION);
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