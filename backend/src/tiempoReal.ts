// ======================================================
// TIEMPO REAL: quién está en cada clase
// ------------------------------------------------------
// El salón 3D es compartido: si el docente crea una clase y
// un estudiante se inscribe, al entrar los DOS tienen que
// verse el uno al otro. Para eso el backend necesita un
// canal de doble vía (WebSockets), porque la API REST solo
// contesta a peticiones: no sirve para avisar "el otro se
// movió".
//
// Cómo funciona (todo cabe en un archivo, sin másservicios):
//
//   · Cada clase es una SALA de socket.io: "clase:FIS-101".
//     Quien entra se une a la de su clase y NUNCA ve a los de
//     otra: dos clases son dos mundos separados.
//
//   · Al entrar, el servidor NO se fía de lo que dice el
//     navegador: busca la cuenta y el rol en MySQL y comprueba
//     que ese usuario tiene motivos para estar ahí (es el
//     docente de la clase, está inscrito, o es admin). Un
//     cliente modificado no puede colarse en una clase ajena.
//
//   · Guarda el último estado de cada avatar en memoria
//     (Map por clase). Al entrar alguien nuevo se le manda la
//     LISTA COMPLETA de los que ya estaban, para que no
//     aparezca esperthemido sobre la pizarra: cada uno spawnea
//     a los demás de golpe.
//
//   · Los movimientos se reenvían tal cual al resto de la sala.
//     No hay búfer ni persistencia: si el servidor se reinicia
//     se pierde la presencia, que es lo correcto (nadie está
//     "en línea" a través de un reinicio).
//
//   · Al salir (o si se cae la conexión) se avisa a los demás
//     para que borren ese avatar.
// ======================================================

import type { Server as ServidorHttp } from "node:http";
import { Server as ServidorSocket, type Socket } from "socket.io";
import { db } from "./db";
import { ENTORNO } from "./entorno";

/** Roles que maneja el proyecto (los mismos que en el frontend). */
type Rol = "estudiante" | "docente" | "admin" | "invitado";

/** Cómo se ve el cuerpo: elige el .glb del avatar remoto. */
type Genero = "mujer" | "hombre";

/** Lo único que se comparte de cada avatar: dónde está y qué hace. */
export interface EstadoAvatar {
  x: number;
  y: number;
  z: number;
  /** Rumbo (radianes). yaw=0 mira a +Z y yaw=π/2 mira a +X. */
  yaw: number;
  caminando: boolean;
  sentado: boolean;
  enAtril: boolean;
  manoAlzada: boolean;
}

/** Una persona dentro de una sala. */
export interface Participante {
  id: string;
  correo: string;
  nombre: string;
  rol: Rol;
  genero: Genero;
  estado: EstadoAvatar;
}

interface Sala {
  codigo: string;
  /** id de socket → participante. Es el estado en memoria de la clase. */
  participantes: Map<string, Participante>;
}

/** Clases con alguien dentro ahora mismo. Se limpia al vaciarse. */
const salas = new Map<string, Sala>();

/**
 * Topes de seguridad, no de rendimiento.
 * El cliente ya envía 12 veces por segundo, así que un móvil
 * con la pestaña abierta 20 minutos manda ~14 000 mensajes por
 * persona. Estos límites solo detienen un bucle runaway (un
 * `setInterval` mal puesto, una extensión, un cliente hostil).
 */
const MAX_MENSAJES_POR_SEGUNDO = 30;
const MAX_PARTICIPANTES_POR_SALA = 60;

/** Nombre de la sala de socket.io a partir del código de la clase. */
function nombreSala(codigo: string): string {
  return `clase:${codigo.trim().toUpperCase()}`;
}

// ---------------------------------------------------------------
// SANEAR LO QUE LLEGA DEL NAVEGADOR
// ---------------------------------------------------------------
// Todo lo que manda el cliente es desconfiable: si no se filtra,
// un `x: 1e308` lo dejaría flotando en el infinito o un `NaN`
// rompería la escena del otro. Se convierte a número y se
// acota a un rango que cubre el salón con holgura.

/** Número finito dentro de [min, max]; si no es válido, devuelve el valor por defecto. */
function acotar(valor: unknown, min: number, max: number, porDefecto: number): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n)) return porDefecto;
  return Math.min(Math.max(n, min), max);
}

/** Lee el estado del avatar que envía el cliente, ya acotado. */
function sanearEstado(datos: unknown): EstadoAvatar | null {
  if (typeof datos !== "object" || datos === null) return null;
  const e = datos as Record<string, unknown>;

  // El salón va de −60 a +60 unidades en X/Z y de −10 a +25 en Y
  // (con margen de sobra: el .glb mide ~60 de ancho).
  const x = acotar(e.x, -200, 200, 0);
  const y = acotar(e.y, -200, 200, 0);
  const z = acotar(e.z, -200, 200, 0);
  // El rumbo se guarda normalizado en (−π, π] para que los números
  // no crezcan sin límite al dar vueltas.
  let yaw = acotar(e.yaw, -Math.PI, Math.PI, 0);
  if (typeof e.yaw === "number" && Number.isFinite(e.yaw)) {
    yaw = Math.atan2(Math.sin(e.yaw), Math.cos(e.yaw));
  }

  return {
    x,
    y,
    z,
    yaw,
    caminando: e.caminando === true,
    sentado: e.sentado === true,
    enAtril: e.enAtril === true,
    manoAlzada: e.manoAlzada === true,
  };
}

function sanearGenero(valor: unknown): Genero {
  return valor === "hombre" ? "hombre" : "mujer";
}

function sanearRol(valor: string): Rol {
  if (valor === "docente" || valor === "admin" || valor === "invitado") return valor;
  return "estudiante";
}

// ---------------------------------------------------------------
// AUTORIZACIÓN: ¿esta persona puede entrar a esta clase?
// ---------------------------------------------------------------
// El navegador manda "quiero entrar a FIS-101 como fulano", pero
// la respuesta la manda la base de datos: el rol sale de `cuentas`
// (que es donde lo dedujo el correo al registrarse) y el permiso
// se comprueba contra la propia clase.

type Autorizacion =
  | {
      permitido: true;
      nombre: string;
      rol: Rol;
      correoDocente: string;
    }
  | { permitido: false; motivo: string };

async function autorizarEntrada(codigoClase: string, correo: string): Promise<Autorizacion> {
  const codigo = codigoClase.trim().toUpperCase();
  const correoNormalizado = correo.trim().toLowerCase();

  if (!codigo) {
    return { permitido: false, motivo: "No se indicó ninguna clase." };
  }
  if (!correoNormalizado) {
    return { permitido: false, motivo: "Inicia sesión antes de entrar a una clase." };
  }

  // 1) ¿Existe la clase?
  const [clases]: any = await db.query(
    `SELECT codigo, correo_docente AS correoDocente
       FROM clases
      WHERE codigo = ?`,
    [codigo]
  );
  if (!clases || clases.length === 0) {
    return {
      permitido: false,
      motivo: `La clase "${codigo}" no existe. Revisa el enlace o pide que te creen una inscripción.`,
    };
  }

  // 2) ¿Existe la cuenta? (el correo es la identidad en este proyecto)
  const [cuentas]: any = await db.query(
    `SELECT nombre_completo AS nombre, rol
       FROM cuentas
      WHERE correo = ?`,
    [correoNormalizado]
  );
  if (!cuentas || cuentas.length === 0) {
    return {
      permitido: false,
      motivo: `La cuenta "${correoNormalizado}" no está registrada en el campus.`,
    };
  }

  const { nombre, rol: rolCrudo } = cuentas[0];
  const rol = sanearRol(rolCrudo);
  const correoDocente = String(clases[0].correoDocente || "").trim().toLowerCase();

  // 3) ¿Ese rol puede entrar a ESTA clase?
  //   · admin e invitado: sí, a cualquier clase (el admin tiene que
  //     poder revisar el aula; el invitado entra como espectador).
  //   · docente: solo a la suya.
  //   · estudiante: solo si está inscrito.
  if (rol === "docente" && correoDocente !== correoNormalizado) {
    return {
      permitido: false,
      motivo: `Esta clase la da ${clases[0].correoDocente || "otro docente"}. Un docente solo entra a sus propias clases.`,
    };
  }

  if (rol === "estudiante") {
    const [inscripciones]: any = await db.query(
      `SELECT 1
         FROM inscripciones
        WHERE codigo_clase = ?
          AND correo_estudiante = ?`,
      [codigo, correoNormalizado]
    );
    if (!inscripciones || inscripciones.length === 0) {
      return {
        permitido: false,
        motivo: `No estás inscrito en "${codigo}". Inscríbete desde tu panel y vuelve a abrir el enlace.`,
      };
    }
  }

  return { permitido: true, nombre, rol, correoDocente };
}

// ---------------------------------------------------------------
// MONTAJE DEL SERVIDOR DE SOCKETS
// ---------------------------------------------------------------

export function adjuntarTiempoReal(servidorHttp: ServidorHttp): ServidorSocket {
  const io = new ServidorSocket(servidorHttp, {
    // En desarrollo el front va en el 5173 y el back en el 3000: son
    // orígenes distintos, así que el handshake sí lleva CORS. Se
    // reutiliza la misma lista de ENTORNO para no tener dos fuentes
    // de verdad ("*" = cualquiera, como ya hace app.ts).
    cors: {
      origin: ENTORNO.ORIGENES === "*" ? true : ENTORNO.ORIGENES.split(","),
      methods: ["GET", "POST"],
    },
    // El ping mantiene viva la conexión detrás de proxies que
    // cortan las conexiones ociosas (Render, Railway, ngrok...).
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Lista los participantes de una sala como array plano (lo que
  // entiende el cliente). Nunca incluye al propio socket: cada
  // cliente filtra su id al pintar.
  function roster(codigo: string): Participante[] {
    const sala = salas.get(codigo);
    if (!sala) return [];
    return [...sala.participantes.values()];
  }

  function avisarRoster(codigo: string): void {
    io.to(nombreSala(codigo)).emit("sala:participantes", {
      clase: codigo,
      participantes: roster(codigo),
    });
  }

  /** Saca a un socket de la sala en la que estuviera y avisa a los demás. */
  function salirDeSala(socket: Socket, motivo: "salida" | "desconexion"): void {
    const codigo = socket.data.codigoSala as string | undefined;
    if (!codigo) return;
    socket.data.codigoSala = undefined;

    const sala = salas.get(codigo);
    if (sala) {
      sala.participantes.delete(socket.id);
      // La sala desaparece de memoria cuando se queda vacía: si no,
      // un curso con 40 clases abiertas a lo largo del día dejaría
      // 40 Map vacíos colgando.
      if (sala.participantes.size === 0) salas.delete(codigo);
    }

    avisarRoster(codigo);
    const quien = socket.data.nombre as string | undefined;
    if (quien) {
      console.log(
        `👋 ${quien} salió de ${codigo} (${motivo}). Quedan ${salas.get(codigo)?.participantes.size ?? 0}.`
      );
    }
  }

  io.on("connection", (socket) => {
    // Contador anti-abuso por conexión (ver MAX_MENSAJES_POR_SEGUNDO).
    let ventana = Date.now();
    let enviados = 0;

    socket.on("sala:entrar", async (datos: unknown, responder?: Function) => {
      const responderSiHay = typeof responder === "function" ? responder : () => {};

      const entrada = (datos ?? {}) as Record<string, unknown>;
      const codigo = String(entrada.codigoClase ?? "").trim().toUpperCase();
      const correo = String(entrada.correo ?? "").trim().toLowerCase();

      // Si este socket ya estaba en otra sala (cambio de clase sin
      // recargar), primero sale de la antigua.
      salirDeSala(socket, "salida");

      try {
        const permiso = await autorizarEntrada(codigo, correo);

        // Nota de tipos: el proyecto compila con "strict": false, y sin
        // strictNullChecks TypeScript NO estrecha uniones discriminadas por
        // un booleano (escribir `if (!permiso.permitido)` da error al leer
        // `motivo`). Por eso el corte se hace con `in`, que sí estrecha.
        if ("motivo" in permiso) {
          console.warn(`⛔ ${correo || "anónimo"} no pudo entrar a ${codigo}: ${permiso.motivo}`);
          responderSiHay({ ok: false, error: permiso.motivo });
          return;
        }

        const sala = salas.get(codigo) ?? { codigo, participantes: new Map<string, Participante>() };
        if (sala.participantes.size >= MAX_PARTICIPANTES_POR_SALA) {
          responderSiHay({
            ok: false,
            error: `La clase "${codigo}" está llena (${MAX_PARTICIPANTES_POR_SALA} personas).`,
          });
          return;
        }

        const participante: Participante = {
          id: socket.id,
          correo,
          nombre: permiso.nombre,
          rol: permiso.rol,
          // El cuerpo lo elige el usuario en su navegador; no es un
          // dato sensible, así que se acepta tal cual (el servidor
          // no lo necesita para autorizar nada).
          genero: sanearGenero(entrada.genero),
          // Aparece en el centro de la clase, de pie, mirando al frente.
          estado: {
            x: 0,
            y: 0,
            z: 0,
            yaw: 0,
            caminando: false,
            sentado: false,
            enAtril: false,
            manoAlzada: false,
          },
        };

        sala.participantes.set(socket.id, participante);
        salas.set(codigo, sala);

        socket.data.codigoSala = codigo;
        socket.data.nombre = permiso.nombre;
        await socket.join(nombreSala(codigo));

        // El que entra recibe el mismo aviso que los demás (así ya
        // spawnea a los que estaban dentro), y el acknowledge le
        // confirma que puede seguir adelante con la escena.
        avisarRoster(codigo);
        responderSiHay({ ok: true, id: socket.id, clase: codigo });

        console.log(
          `🟢 ${permiso.nombre} (${permiso.rol}) entró a ${codigo}. ` +
            `En la sala: ${sala.participantes.size}.`
        );
      } catch (error) {
        console.error("❌ Error al entrar en la sala:", error);
        responderSiHay({
          ok: false,
          error: "No se pudo verificar el acceso a la clase. Inténtalo de nuevo.",
        });
      }
    });

    // -------------------------------------------------------------
    // MOVIMIENTO: se reenvía al resto de la sala sin guardarlo en
    // disco (el último estado sí queda en memoria para el que entre
    // después). Los que están en la misma clase son los únicos que
    // lo reciben: los de otra clase ni se enteran.
    // -------------------------------------------------------------
    socket.on("sala:estado", (estado: unknown) => {
      const ahora = Date.now();
      if (ahora - ventana >= 1000) {
        ventana = ahora;
        enviados = 0;
      }
      if (++enviados > MAX_MENSAJES_POR_SEGUNDO) return;

      const codigo = socket.data.codigoSala as string | undefined;
      if (!codigo) return;

      const limpio = sanearEstado(estado);
      if (!limpio) return;

      const sala = salas.get(codigo);
      const participante = sala?.participantes.get(socket.id);
      if (!sala || !participante) return;

      participante.estado = limpio;
      // `socket.to(...)` excluye al emisor: cada quien ya sabe dónde
      // está él mismo.
      socket.to(nombreSala(codigo)).emit("sala:estado", { id: socket.id, estado: limpio });
    });

    // Salida explícita (botón "Salir de la clase"). Si el socket se
    // cierra sin avisar, el evento "disconnect" de abajo cubre el caso.
    socket.on("sala:salir", () => salirDeSala(socket, "salida"));

    // Red lenta / pestaña cerrada / caída de red. Sin esto, los demás
    // verían avatares congelados en el sitio donde se les fue el wifi.
    socket.on("disconnect", () => salirDeSala(socket, "desconexion"));
  });

  console.log("🔌 Tiempo real: salas por clase activas (socket.io).");
  return io;
}
