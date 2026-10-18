// ======================================================
// PRESENCIA: el canal de tiempo real del frontend
// ------------------------------------------------------
// La API REST (api/cliente.ts) sirve para lo que se PIDE:
// clases, usuarios, inscripciones. Pero para el metaverso
// hace falta lo contrario: que el servidor AVISE cuando
// alguien entra, se mueve o se va. Eso es un WebSocket, y
// este archivo es la única parte del frontend que habla con
// él, para que el 3D no tenga que saber nada de sockets.
//
// Tres responsabilidades, bien separadas:
//
//   1. CONECTAR con el backend y meterse en la sala de su
//      clase. La autorización la hace el servidor mirando
//      MySQL (ver backend/src/tiempoReal.ts): si no tiene
//      permiso, este módulo lo cuenta con `alRechazar` y no
//      inventa un bypass.
//
//   2. PUBLICAR el estado del avatar. Aquí está el truco que
//      hace que funcione con 20 personas en la clase: se
//      manda como máximo 12 veces por segundo y SOLO si algo
//      ha cambiado de verdad. El bucle de render va a 60
//      fps, así que sin este filtro saldrían 60 mensajes por
//      persona y por segundo (y con floats, cada uno distinto
//      del anterior: 5 400 paquetes/hora por avatar que no
//      dicen nada). Con el filtro, alguien quieto no envía
//      NADA y alguien caminando envía 12/s, que es lo que
//      necesita el suavizado del otro lado.
//
//   3. ESCUCHAR a los demás: el servidor manda la lista
//      completa cada vez que alguien entra o sale (así nadie
//      se queda sin borrar a un avatar fantasma) y los
//      movimientos de uno en uno.
//
// El envío tiene "borde de salida": si llega un cambio justo
// cuando aún no toca enviar, no se pierde, se agenda para
// dentro de unos milisegundos. Sin eso, la última posición
// (y acciones como alzar la mano) se quedarían sin mandar
// siempre que se pulsara el botón en el hueco equivocado.
// ======================================================

import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { API_URL } from "../api/cliente";
import { obtenerGeneroAvatar, obtenerSesion, obtenerToken } from "../state/estado";
import type { GeneroAvatar, Rol } from "../state/estado";

/** Cómo va la conexión; se refleja en la píldora de conectados. */
export type EstadoConexion = "conectando" | "conectado" | "cerrado" | "error";

/** Lo único que se comparte de un avatar: dónde está y qué hace. */
export interface EstadoAvatar {
  x: number;
  y: number;
  z: number;
  /** Rumbo en radianes. yaw=0 mira a +Z y yaw=π/2 mira a +X. */
  yaw: number;
  caminando: boolean;
  sentado: boolean;
  enAtril: boolean;
  manoAlzada: boolean;
}

/**
 * Lo que el mapa 3D lee de SU avatar. `caminando` no se manda: lo
 * deduce este módulo comparando con la última posición enviada
 * (así el mapeo no tiene que saber nada de "se movió o no").
 */
export type EstadoLocal = Omit<EstadoAvatar, "caminando">;

/** Una persona dentro de la sala de una clase. */
export interface Participante {
  id: string;
  correo: string;
  nombre: string;
  rol: Rol;
  genero: GeneroAvatar;
  estado: EstadoAvatar;
}

/**
 * Contenido del tablero del aula que viaja por la sala: uno publica y
 * todos lo ven en SU pizarra. `imagen` es un data URL JPEG (las URL de
 * blob viven solo en el navegador que las creó, así que no le sirven
 * a nadie más); `youtube` va por enlace, que sí es universal.
 */
export type MensajeTablero =
  | { tipo: "imagen"; imagen: string }
  | { tipo: "youtube"; url: string }
  | { tipo: "limpiar" };

/**
 * Tope de un mensaje de tablero, en caracteres. Lo que sale del cliente
 * es un JPEG de ≤1600 px de ancho (≈0,5 MB en base64): esto deja margen
 * de sobra y, sobre todo, evita que un cliente hostil pase megas por
 * mensaje reenviándolos a toda la sala.
 */
const MAX_TABLERO_CARACTERES = 4_000_000;

/** La red es de todos: solo se reenvía lo que se reconoce del mensaje. */
function esMensajeTablero(valor: unknown): valor is MensajeTablero {
  if (typeof valor !== "object" || valor === null) return false;
  const m = valor as Record<string, unknown>;
  if (m.tipo === "limpiar") return true;
  if (m.tipo === "imagen") {
    return (
      typeof m.imagen === "string" &&
      m.imagen.startsWith("data:image/") &&
      m.imagen.length <= MAX_TABLERO_CARACTERES
    );
  }
  if (m.tipo === "youtube") return typeof m.url === "string" && m.url.length <= 500;
  return false;
}

export interface OpcionesPresencia {
  /** Cambió la lista de gente de la clase (entró o salió alguien). */
  alCambiarParticipantes: (participantes: Participante[], miId: string | null) => void;
  /**
   * Se movió UNA persona. Va aparte de `alCambiarParticipantes` a propósito:
   * el movimiento llega hasta 12 veces por segundo por persona, y repintar la
   * lista de la clase con cada mensaje (o reordenarla) daría tirones. Aquí
   * solo se avisa de quién y a dónde, y el 3D mueve ese avatar.
   */
  alMover: (id: string, estado: EstadoAvatar) => void;
  /** Cambió el estado de la conexión (conectando, conectado, error…). */
  alCambiarConexion: (estado: EstadoConexion, detalle?: string) => void;
  /** El servidor denegó la entrada a la clase. */
  alRechazar: (motivo: string) => void;
  /** Otro de la sala publicó contenido en el tablero del aula. */
  alRecibirTablero?: (mensaje: MensajeTablero) => void;
}

export interface Presencia {
  /** Se llama en cada frame: aquí dentro se decide si toca enviar. */
  publicar: (estado: EstadoLocal) => void;
  /** Manda el contenido del tablero del aula al resto de la sala. */
  publicarTablero: (mensaje: MensajeTablero) => void;
  /** Gente que hay ahora mismo en la clase (incluido uno mismo). */
  participantes: () => Participante[];
  /** Id de esta conexión; sirve para marcar "(tú)" en la lista. */
  miId: () => string | null;
  /**
   * Señalización WebRTC: envía un mensaje al servidor (se lo reenvía a la
   * sala o a un socket concreto, ver backend/src/tiempoReal.ts). El vídeo
   * en sí NUNCA pasa por aquí: solo ofertas SDP y candidatos ICE.
   */
  emitirSignaling: (evento: string, datos: unknown) => void;
  /**
   * Escucha un evento de señalización del servidor. Devuelve la función
   * para quitar el listener (al apagar la cámara o al salir).
   */
  escucharSignaling: (evento: string, fn: (datos: any) => void) => () => void;
  /** Corta la conexión y suelta los temporizadores. */
  destruir: () => void;
}

// ---------------------------------------------------------------
// Ritmo de envío
// ---------------------------------------------------------------

/** Tope de envíos: 12,5 por segundo. Suficiente para que el otro se vea fluido. */
const INTERVALO_MINIMO_MS = 80;

/**
 * Movimiento mínimo para darlo por real. Por debajo de esto son
 * diferencias de coma flotante: la cámara parada sigue devolviendo
 * valores como 0.30000000000000004 y no tiene ningún sentido mandarlos.
 */
const UMBRAL_MOVIMIENTO = 0.02;

/** Si no cambia nada, se reenvía el estado cada cierto tiempo (renueva el del servidor). */
const RENOVACION_MS = 2000;

/** Al parar de caminar, el "caminando" se mantiene un momento para que no parpadee. */
const COLA_CAMINANDO_MS = 180;

/** Formato del mensaje de rechazo que devuelve el backend. */
interface RespuestaEntrada {
  ok: boolean;
  error?: string;
  id?: string;
}

// ---------------------------------------------------------------
// URL del servidor de sockets
// ---------------------------------------------------------------
// socket.io se conecta a la RAÍZ del backend, no a /api: la API
// cuelga de /api pero el canal de sockets vive en "/". En desarrollo
// eso es http://localhost:3000; en producción no hay URL que
// configurar porque front y back son el mismo servidor.
function calcularUrlDeSockets(): string {
  const sinApi = API_URL.replace(/\/api\/?$/, "");
  return sinApi || window.location.origin;
}

// ---------------------------------------------------------------

export function crearPresencia(
  clase: string,
  opciones: OpcionesPresencia,
): Presencia {
  const codigo = clase.trim().toUpperCase();

  let socket: Socket | null = null;
  let miId: string | null = null;
  let lista: Participante[] = [];

  // --- control del ritmo de envío ---
  let ultimoEnvio = 0;
  let ultimaRenovacion = 0;
  let pendiente: EstadoLocal | null = null;
  let temporizadorPendiente: number | null = null;
  let ultimaPosicion: { x: number; y: number; z: number } | null = null;
  let caminarHasta = 0;

  function limpiaPendiente(): void {
    if (temporizadorPendiente !== null) {
      clearTimeout(temporizadorPendiente);
      temporizadorPendiente = null;
    }
  }

  function enviar(): void {
    limpiaPendiente();
    if (!pendiente || !socket || !socket.connected) return;

    const ahora = performance.now();
    const local = pendiente;
    const anterior = ultimaPosicion;

    // ¿Se movió de verdad? (solo en XZ: subir y bajar es el asiento)
    const movido =
      anterior === null ||
      Math.hypot(local.x - anterior.x, local.z - anterior.z) > UMBRAL_MOVIMIENTO;

    const caminando = movido ? (caminarHasta = ahora + COLA_CAMINANDO_MS) > ahora : ahora < caminarHasta;

    if (movido) {
      ultimaPosicion = { x: local.x, y: local.y, z: local.z };
    }

    // Sin cambios de sitio y sin acciones nuevas: no se manda nada.
    // Solo se renueva de vez en cuando, para que el estado del
    // servidor (y su lista) no se quede viejo si algo se desincroniza.
    const hayAccion =
      local.sentado || local.enAtril || local.manoAlzada || ahora < caminarHasta;
    if (!movido && !hayAccion && ahora - ultimaRenovacion < RENOVACION_MS) {
      return;
    }

    const estado: EstadoAvatar = { ...local, caminando };
    socket.emit("sala:estado", estado);
    ultimoEnvio = ahora;
    ultimaRenovacion = ahora;
    pendiente = null;

    // El avatar propio cambia de aspecto con la acción: se avisa a la
    // sala para que los demás lo pinten (sentado, mano alzada…).
    if (hayAccion) {
      const yo = lista.find((p) => p.id === miId);
      if (yo) yo.estado = estado;
    }
  }

  function publicar(estado: EstadoLocal): void {
    pendiente = estado;
    const desde = performance.now() - ultimoEnvio;
    if (desde >= INTERVALO_MINIMO_MS) {
      enviar();
      return;
    }
    // Aún no toca: se agenda para el hueco que queda (borde de salida).
    if (temporizadorPendiente === null) {
      temporizadorPendiente = window.setTimeout(enviar, INTERVALO_MINIMO_MS - desde);
    }
  }

  /**
   * El contenido del tablero va aparte del estado del avatar: no es un
   * flujo de 12/s, sino eventos ocasionales (publicar, pasar de página,
   * limpiar) de hasta unos cientos de kB. Sin conexión no se encola nada:
   * al volver a entrar, el que tiene contenido en su tablero lo reenvía
   * (ver `republicarContenido` del tablero), así que nada se pierde.
   */
  function publicarTablero(mensaje: MensajeTablero): void {
    if (!socket || !socket.connected || !esMensajeTablero(mensaje)) return;
    socket.emit("sala:tablero", mensaje);
  }

  // ---------------------------------------------------------------
  // CONEXIÓN
  // ---------------------------------------------------------------

  function pedirEntrada(): void {
    if (!socket) return;
    const sesion = leerSesionParaPresencia();
    if (!sesion) {
      opciones.alRechazar("No hay sesión abierta: inicia sesión para entrar a la clase.");
      return;
    }

    socket.emit(
      "sala:entrar",
      {
        codigoClase: codigo,
        correo: sesion.correo,
        genero: sesion.genero,
      },
      (respuesta: RespuestaEntrada) => {
        if (!respuesta || !respuesta.ok) {
          opciones.alRechazar(respuesta?.error ?? "El servidor no confirmó la entrada a la clase.");
          opciones.alCambiarConexion("error", respuesta?.error);
          return;
        }
        miId = respuesta.id ?? null;
        opciones.alCambiarConexion("conectado");

        // El servidor manda la lista ANTES de confirmar la entrada, así que
        // aquella primera lista llegó sin saber cuál es el propio id (quien la
        // recibe todavía no sabe si se ha dibujado a sí mismo). Se reenvía aquí
        // la misma lista ya con el id confirmado: así el 3D dibuja a los demás
        // y la UI puede marcar "(tú)".
        if (miId && lista.length > 0) {
          opciones.alCambiarParticipantes(lista, miId);
        }
      },
    );
  }

  function arrancar(): void {
    opciones.alCambiarConexion("conectando");
    socket = io(calcularUrlDeSockets(), {
      transports: ["websocket", "polling"],
      auth: { token: obtenerToken() || undefined },
      // Si el servidor reinicia, socket.io reintenta solo; al reconectar
      // hay que volver a pedir la sala, porque el id de socket cambió y
      // el servidor no se acuerda de a qué clase estábamos.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => {
      opciones.alCambiarConexion("conectando");
      pedirEntrada();
    });

    socket.on("disconnect", (motivo: string) => {
      // "io client disconnect" es nuestro propio socket.disconnect(): nos
      // hemos ido nosotros al salir, no es un fallo que haya que avisar.
      if (motivo === "io client disconnect") return;
      opciones.alCambiarConexion("cerrado", "Se perdió la conexión con el servidor.");
      // El id del socket ya no vale: si se dejara, al reconectar la primera
      // lista de participantes compararía contra un id viejo y el 3D podría
      // clonarse a sí mismo antes de recibir el id nuevo.
      miId = null;
      lista = [];
      opciones.alCambiarParticipantes(lista, miId);
    });

    socket.on("connect_error", (error: Error) => {
      opciones.alCambiarConexion("error", error.message);
    });

    // La lista completa de la clase. El servidor la reenvía cada vez que
    // alguien entra o sale; el cliente solo tiene que recargar su escena.
    socket.on(
      "sala:participantes",
      (datos: { participantes?: Participante[] }) => {
        lista = Array.isArray(datos?.participantes) ? datos.participantes : [];
        opciones.alCambiarParticipantes(lista, miId);
      },
    );

    // Movimiento de UNA persona. Se actualiza su estado y se avisa con
    // `alMover` (no con `alCambiarParticipantes`): así el 3D mueve ese avatar
    // sin repintar la lista de la clase 12 veces por segundo.
    socket.on("sala:estado", (datos: { id?: string; estado?: EstadoAvatar }) => {
      if (!datos?.id || !datos.estado) return;
      const objetivo = lista.find((p) => p.id === datos.id);
      if (objetivo) objetivo.estado = datos.estado;
      opciones.alMover(datos.id, datos.estado);
    });

    // Contenido del tablero publicado por otro de la clase (el servidor
    // excluye al emisor). Se valida antes de tocar la escena: la red es
    // de todos y de ahí solo debe salir lo reconocible.
    socket.on("sala:tablero", (datos: unknown) => {
      if (!esMensajeTablero(datos)) return;
      opciones.alRecibirTablero?.(datos);
    });
  }

  function destruir(): void {
    limpiaPendiente();
    pendiente = null;
    lista = [];
    miId = null;
    if (!socket) return;
    // Salir de la sala antes de cerrar: si no, el servidor no se
    // entera hasta que expire el socket y los demás ven un avatar
    // congelado unos segundos.
    socket.emit("sala:salir");
    socket.disconnect();
    socket = null;
  }

  function emitirSignaling(evento: string, datos: unknown): void {
    if (!socket || !socket.connected) return;
    socket.emit(evento, datos);
  }

  function escucharSignaling(evento: string, fn: (datos: any) => void): () => void {
    if (!socket) return () => {};
    socket.on(evento, fn);
    return () => socket?.off(evento, fn);
  }

  arrancar();

  return {
    publicar,
    publicarTablero,
    participantes: () => lista,
    miId: () => miId,
    emitirSignaling,
    escucharSignaling,
    destruir,
  };
}

// ---------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------
// Se lee aquí y no se pasa por parámetro para que este módulo se pueda
// usar desde cualquier mapa. Todo se protege con try/catch y con
// comprobaciones: un localStorage corrupto (o vacío) debe llevar a
// "no hay sesión abierta", nunca a una excepción en medio de la partida.
function leerSesionParaPresencia(): { correo: string; genero: GeneroAvatar } | null {
  try {
    // obtenerSesion() ya resuelve los dos formatos de sesión (el objeto
    // nuevo y el correo suelto de las versiones anteriores).
    const cuenta = obtenerSesion();
    if (!cuenta?.correo) return null;
    return { correo: cuenta.correo, genero: obtenerGeneroAvatar() };
  } catch {
    return null;
  }
}
