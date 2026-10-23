import "../assets/style.css";
import { inyectarTema as montarTema } from "../state/preferencias";

// El tema (claro/oscuro) y el idioma se aplican apenas carga la
// pÃ¡gina, antes de que se pinte el login o el metaverso.
montarTema();
import * as BABYLON from "babylonjs";
import "babylonjs-loaders";
import { iniciarLogin } from "../page/login/login";
import { mostrarDashboard } from "../page/dashboard/dashboard";
import { obtenerSesion } from "../state/estado";
import type { Clase } from "../state/estado";
import { ALTURA_OBJETIVO_BASE, cargarPersonaje, fijarAlturaPersonaje, type Personaje } from "./personaje";
import { crearAvataresRemotos, type AvataresRemotos } from "./avataresRemotos";
import { crearListadoConectados, type ListadoConectados } from "../ui/listadoConectados";
import { leerClaseDeLaUrl, escribirClaseEnLaUrl } from "../state/enlaceClase";
import { t } from "../state/idioma";
import { obtenerClasePorCodigo } from "../api/servicios";
import type { EstadoLocal, Participante } from "../red/presencia";
// UI MODULAR: se importa como cualquier otra pieza, asÃ­ cada mapa nuevo reutiliza
// los mismos botones sin reescribirlos.
import { crearMenuAjustes, leerVolumen, guardarVolumen, type MenuAjustes } from "../ui/menuAjustes";
import { crearBarraUsuario, type BarraUsuario, type AccionBarra } from "../ui/barraUsuario";
import { alternarMicrofono, estadoMicrofono, liberarMicrofono, obtenerFlujoMicrofono } from "../ui/microfono";
import { crearCamaraWeb, type CamaraWeb } from "../ui/webcam";
import {
  mostrarPantallaCarga,
  reiniciarPantallaCarga,
  marcarSalonCargado,
  ocultarPantallaCarga,
} from "../ui/pantallaCarga";
import { crearVideoSalon, type VideoSalon } from "../red/videoSalon";
import { crearVideoTablero, type VideoTablero } from "../red/videoTablero";
// TABLERO: PDF, vÃ­deo, YouTube y compartir pantalla viven en su propio archivo,
// igual que la barra y los ajustes. El mapa solo lo importa y llama a su API.
import { crearTablero, type Tablero } from "./tableroFuncionalidad";
// FUNCIONALIDADES: caminar, sentarse, presentar en el atril y cÃ¡mara viven
// en su propio mÃ³dulo; cualquier mapa los importa en vez de reescribirlos.
import {
  crearFuncionalidades,
  RADIO_PERSONAJE,
  ALTURA_OJO_PROFESOR,
  type Funcionalidades,
  type ParSilla,
  type Atril,
  type ObstaculoSolido,
} from "./funcionalidades";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = new BABYLON.Engine(canvas, true);

// Escala a la que se importa el salÃ³n entero (cargarSalon la aplica a la raÃ­z
// del .glb justo al importarlo). El aula original medÃ­a 18.8 Ã— 12.4 m con
// muebles a tamaÃ±o real: el personaje (1.85 m) se perdÃ­a dentro, asÃ­ que el
// mapa baja al 85 % â€” 16 Ã— 10.5 m, todavÃ­a grande â€” y el personaje sube a
// 1.85 m (ver ALTURA_OBJETIVO_U en personaje.ts). TODAS las medidas del mapa
// (lÃ­mites, sillas, atril, rayos, techo) se leen despuÃ©s de aplicar esta
// escala, asÃ­ que las constantes de este archivo van ya multiplicadas.
const ESCALA_SALON = 0.85;

// PRUEBA DE TEXTURAS (07/10) â€” mapa de pruebas POR CLASE: solo las clases de
// esta lista cargan "mapes/salon.glb" (el .glb que saliÃ³ de Blender con los
// colores/texturas, pero EN METROS â€”paredes 3.4 m, techo 5.2 mâ€” y todavÃ­a SIN
// los nodos lÃ³gicos del prototipo: room, desk, desk_chair, sit_*, tablero_01,
// TEACH_01), asÃ­ que allÃ­ solo se mira si los colores salieron bien: sin nodos
// no hay sentarse, ni atril, ni colisiones de muebles, ni anclaje del tablero
// (todo lo que falte cae en los fallbacks que ya tenÃ­a cargarSalon). El resto
// de las clases cargan el prototipo con nodos, su escala y su techo normales.
// entrarAlSalon() fija claseActiva antes de montar la escena, asÃ­ que
// cargarSalon() decide el mapa con el cÃ³digo ya en mano. Al terminar la prueba,
// dejar la lista vacÃ­a.
// const CODIGOS_SALON_DE_PRUEBA: string[] = [];

// ESTATURA DEL PERSONAJE: SIEMPRE la base (5.892 u = 1.85 m), tambiÃ©n en el
// salÃ³n de prueba. El 7/10 por la tarde el usuario fijÃ³ en Blender TODAS las
// estructuras de los mapas a una altura ya definida y comÃºn â€” "para no tener que
// cada mapa agrandar o disminuir" â€” asÃ­ que ya no hay salÃ³n grande con
// personaje grande: REU-175 usa la misma estatura que el resto de clases.

// Escala del salÃ³n de prueba: 1 = TAL CUAL sale de Blender (7/10 tarde: el .glb
// ya viene a la altura definida, no hay que calibrar un factor por mapa).
// Medido con NullEngine sobre el .glb nuevo (altura relativa al parquÃ©):
// pupitres 1.70â€“1.81 (y desk.003 a 2.05), asientos ~1.1, atril (Lecturn) 3.16,
// TEACH_01 ~3.95, tablero_01 ~5.3, techo 11.7, sala 54.7Ã—28.8 â€” el mismo orden
// de magnitud que el prototipo (que entra Ã—0.85): lectern/tablero/sala calzan.
const ESCALA_SALON_DE_PRUEBA = 1;

// Cara superior del suelo del salÃ³n. Medida con rayos (NullEngine) sobre el .glb:
// room_primitive2 estÃ¡ en âˆ’0.789 en todo el salÃ³n (suelo plano); en el mundo
// acaba en âˆ’0.789 Ã— ESCALA_SALON. El personaje camina con los PIES AQUÃ, no
// en 0: con los pies en 0 flotaba sobre la laja.
const SUELO_Y = -0.789 * ESCALA_SALON;

// Altura del OJO del personaje ACTIVO en el mundo (suelo + ojo de la estatura
// vigente): por aquÃ­ arranca la cÃ¡mara antes de que cargue el cuerpo. Por
// defecto la de siempre (1.85 m â†’ 5.35 u); createScene() la cambia ANTES de
// montar la cÃ¡mara si la clase es de las de prueba (personaje mÃ¡s grande).
let alturaOjoActiva = ALTURA_OJO_PROFESOR;

// UI DE PROXIMIDAD
const aviso = document.createElement("div");
aviso.style.position = "absolute";
aviso.style.bottom = "12%";
aviso.style.left = "50%";
aviso.style.transform = "translateX(-50%)";
aviso.style.color = "#ffffff";
aviso.style.fontFamily = "sans-serif";
aviso.style.fontSize = "18px";
aviso.style.fontWeight = "bold";
aviso.style.background = "rgba(15, 23, 42, 0.85)";
aviso.style.border = "1px solid rgba(255, 255, 255, 0.2)";
aviso.style.padding = "10px 22px";
aviso.style.borderRadius = "10px";
aviso.style.display = "none";
aviso.style.zIndex = "1000";
aviso.style.pointerEvents = "none";
aviso.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
document.body.appendChild(aviso);

// UI MANO ALZADA
const avisoMano = document.createElement("div");
avisoMano.style.position = "absolute";
avisoMano.style.top = "20px";
avisoMano.style.right = "20px";
avisoMano.style.color = "#ffffff";
avisoMano.style.fontFamily = "sans-serif";
avisoMano.style.fontSize = "16px";
avisoMano.style.fontWeight = "bold";
avisoMano.style.background = "rgba(30, 58, 138, 0.9)";
avisoMano.style.border = "1px solid rgba(96, 165, 250, 0.5)";
avisoMano.style.padding = "12px 20px";
avisoMano.style.borderRadius = "8px";
avisoMano.style.display = "none";
avisoMano.style.zIndex = "1000";
avisoMano.style.pointerEvents = "none";
avisoMano.style.boxShadow = "0 4px 14px rgba(0,0,0,0.35)";
avisoMano.innerText = "El usuario ha alzado la mano";
document.body.appendChild(avisoMano);

// AVISO DE RATÃ“N BLOQUEADO (pointer lock)
// Al hacer clic en la escena se bloquea el puntero para mirar sin que el cursor
// estorbe. Mientras dura el bloqueo TODOS los clics van al canvas, asÃ­ que los
// botones de la barra y el engranaje no reciben nada: hay que pulsar Esc. Sin este
// aviso no habÃ­a forma de saberlo y el botÃ³n de volumen "a veces no funcionaba".
// Se crea una sola vez a nivel de mÃ³dulo, igual que el resto de avisos.
const avisoRaton = document.createElement("div");
avisoRaton.style.position = "fixed";
// Justo POR ENCIMA del aviso de proximidad (que estÃ¡ en bottom:12% y es el que dice
// "Presiona E para sentarte" / "Presiona R para presentar en el atril").
// Antes estaba a 96px fijos y, como el 12% sube con la altura de la ventana, en pantallas
// altas los dos se solapaban y la pÃ­ldora (z-index 1600) tapaba el mensaje de sentarse.
avisoRaton.style.bottom = "calc(12% + 56px)";
avisoRaton.style.left = "50%";
avisoRaton.style.transform = "translateX(-50%)";
avisoRaton.style.color = "#cbd5e1";
avisoRaton.style.fontFamily = "sans-serif";
avisoRaton.style.fontSize = "13px";
avisoRaton.style.background = "rgba(15, 23, 42, 0.95)";
avisoRaton.style.border = "1px solid rgba(255, 255, 255, 0.18)";
avisoRaton.style.padding = "7px 16px";
avisoRaton.style.borderRadius = "999px";
avisoRaton.style.whiteSpace = "nowrap";
avisoRaton.style.zIndex = "1600";
// Nunca puede quedarse encima de los botones: solo informativo.
avisoRaton.style.pointerEvents = "none";
avisoRaton.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.35)";
avisoRaton.innerText = "Ratón bloqueado — pulsa Esc para usar los botones";
avisoRaton.style.display = "none";
document.body.appendChild(avisoRaton);

function refrescarAvisoRaton(): void {
  avisoRaton.style.display = document.pointerLockElement ? "block" : "none";
}
document.addEventListener("pointerlockchange", refrescarAvisoRaton);
refrescarAvisoRaton();

const paresSillas: ParSilla[] = [];
let atril: Atril | null = null;

// PUNTOS DE APARICION QUE TRAE EL .GLB
// Los empties "Spawn1".."Spawn12" (pasillos) y "Spawn_Profe" los lee cargarSalon
// de los TransformNode del mapa. Si el .glb no los trae (export viejo), quedan
// vacios y elegirPuntoAparicion() usa las coordenadas de respaldo de abajo.
const puntosAparicion: { nombre: string; posicion: BABYLON.Vector3 }[] = [];
let puntoAparicionProfe: BABYLON.Vector3 | null = null;

// Coordenadas EXACTAS de los empties Spawn1..Spawn12 / Spawn_Profe del mapa,
// ya en unidades del mundo (escala y centrado del salón aplicados). Son el
// respaldo cuando el .glb que llega al navegador no trae esos empties (una
// copia vieja en caché, por ejemplo): así el spawn sigue cayendo en los
// pasillos que marcó el modelo en Blender.
const SPAWNS_ALUMNOS_FIJOS: ReadonlyArray<readonly [number, number]> = [
  [-0.66, 0.22],
  [5.46, 0.22],
  [-7.11, 0.22],
  [11.43, 0.22],
  [11.43, 7.93],
  [-7.11, 7.93],
  [5.46, 7.93],
  [-0.66, 7.93],
  [11.43, -7.49],
  [-7.11, -7.49],
  [5.46, -7.49],
  [-0.66, -7.49],
];
const SPAWN_PROFE_FIJO: readonly [number, number] = [18.15, -1.36];

// AABB del mesh "room" en coordenadas de mundo.
// Los "empty" del .glb (sit_*, TEACH_01, tablero_01, Plane.003...) son TransformNode y
// Babylon NO puede colisionar contra ellos: el motor de colisiones solo recorre mallas
// con checkCollisions (scene.meshes -> subMeshes). Por eso este AABB es la fuente de
// verdad del recinto: de Ã©l salen los 4 muros invisibles "limite*" y el recorte de la
// cÃ¡mara, que es lo que evita que nadie salga del salÃ³n.
let limitesSalon: { min: BABYLON.Vector3; max: BABYLON.Vector3 } | null = null;

// Comprueba si una posiciÃ³n respeta el recinto (sin moverla). Se usa para decidir si
// un movimiento es aceptable ANTES de ocuparlo, en vez de meterse y luego empujar.
function dentroDelSalon(posicion: BABYLON.Vector3, margen = 0.6): boolean {
  if (!limitesSalon) return true;
  const { min, max } = limitesSalon;
  return (
    posicion.x >= min.x + margen &&
    posicion.x <= max.x - margen &&
    posicion.z >= min.z + margen &&
    posicion.z <= max.z - margen
  );
}

// Mantiene una posiciÃ³n dentro del salÃ³n (se usa para la cÃ¡mara, que en tercera persona
// lleva un offset de casi 7 unidades detrÃ¡s del modelo y podrÃ­a salir por un hueco).
function recortarAlSalon(posicion: BABYLON.Vector3, margen = 0.6): void {
  if (!limitesSalon) return;
  const { min, max } = limitesSalon;
  posicion.x = Math.min(Math.max(posicion.x, min.x + margen), max.x - margen);
  posicion.z = Math.min(Math.max(posicion.z, min.z + margen), max.z - margen);
}

// ---------------------------------------------------------------
// OBSTÃCULOS SÃ“LIDOS (mesas "desk", sillas "desk_chair", atril "lecturn")
//
// Estos NO van al motor de colisiones de Babylon. Motivo verificado con pruebas
// sobre babylon.max.js (Collider._testTriangle / _getResponse): la laja de la mesa
// mide solo 8 cm de alto (y 1.51..1.59) y queda DENTRO del elipsoide del personaje,
// asÃ­ que Babylon la detecta ya desde dentro, no puede salir hacia atrÃ¡s y se queda
// bloqueado. SÃ­ntoma: "atraviesan las mesas y despuÃ©s no me dejan salir".
//
// Se resuelven a mano en el plano horizontal (cÃ­rculo vs AABB en XZ). Es
// determinista, no depende de los FPS, no permite tÃºneles y, sobre todo, si el
// cuerpo acaba dentro de la caja SIEMPRE lo devuelve por la cara mÃ¡s corta:
// el atasco deja de ser posible por construcciÃ³n.
// ---------------------------------------------------------------

const obstaculosSolidos: ObstaculoSolido[] = [];

// Altura del cuerpo usado para chocar (los muros "limite*" frenan a su altura).
const ALTURA_PERSONAJE = 4.9;

// Â¿Hay algÃºn mueble a menos de RADIO_PERSONAJE (medido en XZ) de la posiciÃ³n?
function haySolape(posicion: BABYLON.Vector3): boolean {
  const radioAlCuadrado = RADIO_PERSONAJE * RADIO_PERSONAJE;
  for (const obs of obstaculosSolidos) {
    // Filtro de altura: solo chocan los obstÃ¡culos que tocan el cuerpo (y 0..4.9).
    if (obs.max.y < posicion.y || obs.min.y > posicion.y + ALTURA_PERSONAJE) continue;
    const cx = Math.min(Math.max(posicion.x, obs.min.x), obs.max.x);
    const cz = Math.min(Math.max(posicion.z, obs.min.z), obs.max.z);
    const dx = posicion.x - cx;
    const dz = posicion.z - cz;
    if (dx * dx + dz * dz < radioAlCuadrado) return true;
  }
  return false;
}

// Una posiciÃ³n es utilizable si respeta el recinto y no cae dentro de ningÃºn mueble.
// Es exactamente la condiciÃ³n que exige el bucle de render antes de aceptar un frame.
function posicionValida(posicion: BABYLON.Vector3): boolean {
  return dentroDelSalon(posicion, RADIO_PERSONAJE) && !haySolape(posicion);
}

// Una Ãºnica pasada de expulsiÃ³n. El orden de las cajas importa: con dos muebles pegados,
// sacar a alguien de uno puede meterlo dentro del otro, asÃ­ que la pasada rota el inicio.
function empujarUnaPasada(posicion: BABYLON.Vector3, desde: number): void {
  for (let i = 0; i < obstaculosSolidos.length; i++) {
    const obs = obstaculosSolidos[(i + desde) % obstaculosSolidos.length];
    // Filtro de altura: solo chocan los obstÃ¡culos que tocan el cuerpo (y 0..4.9).
    if (obs.max.y < posicion.y || obs.min.y > posicion.y + ALTURA_PERSONAJE) continue;

    // Punto de la caja mÃ¡s cercano al centro del personaje (proyecciÃ³n en XZ).
    const cx = Math.min(Math.max(posicion.x, obs.min.x), obs.max.x);
    const cz = Math.min(Math.max(posicion.z, obs.min.z), obs.max.z);
    const dx = posicion.x - cx;
    const dz = posicion.z - cz;
    const distanciaAlCuadrado = dx * dx + dz * dz;
    const radioAlCuadrado = RADIO_PERSONAJE * RADIO_PERSONAJE;

    if (distanciaAlCuadrado >= radioAlCuadrado) continue;

    if (distanciaAlCuadrado > 1e-8) {
      // Borde de la caja: empuja radialmente hasta dejar el radio exacto.
      const distancia = Math.sqrt(distanciaAlCuadrado);
      posicion.x = cx + (dx / distancia) * RADIO_PERSONAJE;
      posicion.z = cz + (dz / distancia) * RADIO_PERSONAJE;
    } else {
      // El centro quedÃ³ DENTRO de la caja: salir por la cara mÃ¡s corta.
      const caras = [
        posicion.x - obs.min.x,
        obs.max.x - posicion.x,
        posicion.z - obs.min.z,
        obs.max.z - posicion.z,
      ];
      let caraMasCorta = 0;
      for (let i = 1; i < caras.length; i++) {
        if (caras[i] < caras[caraMasCorta]) caraMasCorta = i;
      }
      if (caraMasCorta === 0) posicion.x = obs.min.x - RADIO_PERSONAJE;
      else if (caraMasCorta === 1) posicion.x = obs.max.x + RADIO_PERSONAJE;
      else if (caraMasCorta === 2) posicion.z = obs.min.z - RADIO_PERSONAJE;
      else posicion.z = obs.max.z + RADIO_PERSONAJE;
    }
  }
}

// Red de seguridad: repite pasadas hasta que la posiciÃ³n quede libre. Solo llega aquÃ­
// un teletransporte (sentarte con E / atril con R) o algo fuera de lo previsto: en el
// caminar normal el cuerpo nunca ocupa una posiciÃ³n que solape.
function empujarFueraDeObstaculos(posicion: BABYLON.Vector3): void {
  for (let pasada = 0; pasada < 8 && haySolape(posicion); pasada++) {
    empujarUnaPasada(posicion, pasada);
  }
}

// --- HOLGURA RESPECTO A LA PARED -----------------------------------------
// `limitesSalon` sale de medirInteriorDelSalon y, si esa medida falla, queda
// como la caja entera del parque: puede llegar hasta la pared o pasarla. Por
// eso el spawn se valida aqui, con rayos reales contra la estructura, y no solo
// con la caja. Es el UNICO punto de control: da igual si el punto viene de un
// empty, del respaldo fijo o del plan B por sillas.
const MARGEN_PARED = RADIO_PERSONAJE + 0.8;

// Distancia horizontal a la estructura mas cercana (muro, ventana, cortina) con
// rayos a dos alturas y 12 rumbos. Si no hay nada dentro de `alcance`, devuelve
// `alcance` (sirve como "hay sitio de sobra").
function distanciaAPared(
  escena: BABYLON.Scene,
  pos: BABYLON.Vector3,
  alcance: number
): number {
  let minima = alcance;
  for (const h of [1.5, 3.5]) {
    const origen = new BABYLON.Vector3(pos.x, pos.y + h, pos.z);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const dir = new BABYLON.Vector3(Math.sin(a), 0, Math.cos(a));
      const golpe = escena.pickWithRay(
        new BABYLON.Ray(origen, dir, alcance),
        esMallaEstructura
      );
      if (golpe?.hit && golpe.distance < minima) minima = golpe.distance;
    }
  }
  return minima;
}

// Si el punto no sirve, busca en circulos crecientes el sitio valido mas cercano:
// fuera de muebles, dentro del salon Y con holgura real respecto a las paredes.
function sitioSeguroCerca(escena: BABYLON.Scene, inicio: BABYLON.Vector3): BABYLON.Vector3 {
  const sirve = (p: BABYLON.Vector3): boolean =>
    posicionValida(p) &&
    distanciaAPared(escena, p, MARGEN_PARED + 0.5) >= MARGEN_PARED;

  if (sirve(inicio)) return inicio;

  for (let r = 0.75; r <= 12; r += 0.75) {
    const pasos = Math.max(8, Math.round(r * 6));
    for (let i = 0; i < pasos; i++) {
      const a = (i / pasos) * Math.PI * 2;
      const p = new BABYLON.Vector3(
        inicio.x + Math.sin(a) * r,
        SUELO_Y,
        inicio.z + Math.cos(a) * r
      );
      if (sirve(p)) return p;
    }
  }
  console.warn("[spawn] no se hallo un sitio con holgura; se deja el punto original.");
  return inicio;
}

// ---------------------------------------------------------------
// PUNTOS DE APARICION
//
// El .glb trae empties con los sitios de entrada (los pone el modelo en
// Blender): "Spawn1".."Spawn12" en los pasillos y "Spawn_Profe" delante de la
// clase. El personaje se coloca con SU ORIGEN (a los pies del modelo) sobre el
// origen del empty, asi que el y=SUELO_Y es el unico que manda: los empties
// solo aportan X/Z.
//
//   · estudiante/invitado -> UNO AL AZAR de Spawn1..Spawn12, mirando al frente.
//   · docente/admin       -> Spawn_Profe, mirando a la clase.
//
// Si el mapa no trae esos empties (copia vieja en cache), se usan las
// coordenadas exactas de esos mismos pasillos (SPAWNS_ALUMNOS_FIJOS y
// SPAWN_PROFE_FIJO), asi que el resultado es identico.
//
// Es 100% client-side: cada cliente elige su spawn y lo publica por red
// (estadoLocal ya manda personaje.raiz.position), asi que no hay que tocar el
// backend.
// ---------------------------------------------------------------

// Hash FNV-1a sobre un string (correos) -> entero sin signo estable.
function hashTexto(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function elegirPuntoAparicion(): { posicion: BABYLON.Vector3; yaw: number } {
  const sesion = obtenerSesion();
  const rol = sesion?.rol ?? "estudiante";
  const respaldo = { posicion: new BABYLON.Vector3(0, SUELO_Y, -8), yaw: 0 };

  const esDocente = rol === "docente" || rol === "admin";

  // Rumbo para mirar al frente (atril/tablero). El convenio del proyecto es
  // yaw = atan2(dir.x, dir.z); sin atril se mira a +X, que es el frente del aula.
  const mirarAlFrente = (posicion: BABYLON.Vector3): number =>
    atril
      ? Math.atan2(
          atril.posicionAtril.x - posicion.x,
          atril.posicionAtril.z - posicion.z
        )
      : Math.PI / 2;

  // --- PUNTOS DEL MAPA (o sus coordenadas de respaldo) ---------------------
  // 1) DOCENTE / ADMIN: "Spawn_Profe", mirando al centro de la clase.
  if (esDocente) {
    const puntoProfe =
      puntoAparicionProfe ??
      new BABYLON.Vector3(SPAWN_PROFE_FIJO[0], SUELO_Y, SPAWN_PROFE_FIJO[1]);
    const posicion = new BABYLON.Vector3(puntoProfe.x, SUELO_Y, puntoProfe.z);
    if (haySolape(posicion)) empujarFueraDeObstaculos(posicion);
    recortarAlSalon(posicion, RADIO_PERSONAJE);

    let yaw = Math.PI;
    if (obstaculosSolidos.length) {
      let centroX = 0;
      let centroZ = 0;
      for (const obs of obstaculosSolidos) {
        centroX += (obs.min.x + obs.max.x) / 2;
        centroZ += (obs.min.z + obs.max.z) / 2;
      }
      centroX /= obstaculosSolidos.length;
      centroZ /= obstaculosSolidos.length;
      if (Math.hypot(centroX - posicion.x, centroZ - posicion.z) > 1e-6) {
        yaw = Math.atan2(centroX - posicion.x, centroZ - posicion.z);
      }
    }
    return { posicion, yaw };
  }

  // 2) ESTUDIANTE / INVITADO: uno al azar de "Spawn1".."Spawn12", de pie en el
  // pasillo y mirando al frente. Se recorre el resto de puntos si el elegido
  // cae dentro de un mueble; si ninguno sirve, se cae al reparto por sillas.
  if (!esDocente) {
    const puntos = puntosAparicion.length
      ? puntosAparicion
      : SPAWNS_ALUMNOS_FIJOS.map(([x, z], i) => ({
          nombre: `Spawn${i + 1}`,
          posicion: new BABYLON.Vector3(x, SUELO_Y, z),
        }));

    const inicio = Math.floor(Math.random() * puntos.length);
    for (let intento = 0; intento < puntos.length; intento++) {
      const punto = puntos[(inicio + intento) % puntos.length];
      const posicion = new BABYLON.Vector3(punto.posicion.x, SUELO_Y, punto.posicion.z);
      if (haySolape(posicion)) empujarFueraDeObstaculos(posicion);
      recortarAlSalon(posicion, RADIO_PERSONAJE);
      if (!posicionValida(posicion)) continue;
      console.log(
        `Aparición: ${punto.nombre} (${posicion.x.toFixed(2)}, ${posicion.z.toFixed(2)}) rol=${rol}`
      );
      return { posicion, yaw: mirarAlFrente(posicion) };
    }
  }

  // --- ESTUDIANTE / INVITADO: de pie junto a un pupitre --------------------
  // Un candidato por cada silla: la XZ del punto de sentarse, a altura de
  // suelo (no sentado). empujarFueraDeObstaculos lo saca de la caja de la
  // silla/mesa hacia el hueco libre mas cercano = el pasillo detras del
  // pupitre, que es justo "de pie junto al pupitre".
  const candidatos: BABYLON.Vector3[] = [];
  for (const par of paresSillas) {
    const punto = new BABYLON.Vector3(
      par.puntoSit.posicion.x,
      SUELO_Y,
      par.puntoSit.posicion.z
    );
    empujarFueraDeObstaculos(punto);
    recortarAlSalon(punto, RADIO_PERSONAJE);
    if (posicionValida(punto)) candidatos.push(punto);
  }
  if (!candidatos.length) return respaldo;

  const correo = sesion?.correo ?? "";
  const indice = hashTexto(correo) % candidatos.length;
  const posicion = candidatos[indice].clone();

  // Mirar al frente (al atril/tablero). Sin atril, yaw 0 (mirando a +Z).
  let yaw = 0;
  if (atril) {
    yaw = Math.atan2(
      atril.posicionAtril.x - posicion.x,
      atril.posicionAtril.z - posicion.z
    );
  }
  return { posicion, yaw };
}

let pantallaTablero: BABYLON.Mesh | null = null;
let materialPantalla: BABYLON.StandardMaterial | null = null;

// ---------------------------------------------------------------
// MEDIDA DEL INTERIOR DEL SALÃ“N CON RAYOS
//
// El AABB del mesh "room" NO es el aula: abarca tambiÃ©n el hueco que queda detrÃ¡s del
// tablero y el pasillo del fondo (en este mapa se pasaba 10 unidades en -X y 11 en +Z),
// asÃ­ que con ese recinto la cÃ¡mara y el modelo "atravesaban" la pared y acababan en la
// zona negra de fuera. Para contener de verdad hay que medir la cara INTERNA del muro.
//
// CÃ³mo: se lanzan rayos horizontales desde dentro del contenido del aula (los muebles
// marcan dÃ³nde estÃ¡ el aula, no el pasillo) hacia cada lado, contra la carcasa
// (room/ventanas/muros) y NUNCA contra muebles ni el suelo invisible. Se toma la MEDIANA
// de los impactos: los rayos que se escapan por una puerta o una ventana dan distancias
// enormes y la mediana los ignora. Si algo sale mal se devuelve null y se usa el AABB.
// ---------------------------------------------------------------
/**
 * TECHO MÃS ALTO â€” solo la altura: ancho (x) y fondo (z) no se tocan.
 *
 * Se hace POR TRAMOS para que las PUERTAS queden con su tamaÃ±o normal (si no, la
 * persona se verÃ­a enana al lado de la puerta) y lo que crezca sean los MARCOS y
 * las VENTANAS:
 *
 *     y <= TOPE_PUERTA   â†’  y' = y                     (MURO BAJO INTACTO)
 *     y >  TOPE_PUERTA   â†’  y' = TOPE + (y - TOPE) Ã— FACTOR
 *
 *     FACTOR = (TECHO + SUBIR_TECHO âˆ’ TOPE) / (TECHO âˆ’ TOPE)   â‰ˆ 1.971
 *
 * TOPE = 8.28 es el canto superior del hueco de la puerta: ahÃ­ termina el muro
 * bajo (las 4 puertas, los zÃ³calos y los tableros verdes viven todos por debajo,
 * porque todos sus huecos se cierran en esa misma cota) y empieza la banda alta.
 * Los 2 unidades de mÃ¡s se absorben TODOS por encima de esa cota, asÃ­ que:
 *
 *   Â· puertas (hoja + marco + vidrio superior) â†’ EXACTAMENTE como estaban
 *   Â· tableros verdes y ventanas bajas         â†’ como estaban (mismo hueco)
 *   Â· ventanas-transom y sus marcos            â†’ Ã—1.97 de alto  â† lo que se pidiÃ³
 *   Â· techo                                    â†’ 10.34 â†’ 12.34
 *
 * Por encima del canto todo escala igual (escala uniforme alrededor de TOPE), de
 * modo que los huecos siguen calzando con los marcos. Como la funciÃ³n solo depende
 * de y, las aristas verticales siguen verticales: nada se "achaquita".
 *
 * Medido en el .glb: suelo -0.75/-0.80 Â· hoja de la puerta -0.75 â†’ 4.98 (1.80 m
 * si 1 u â‰ˆ 0.314 m; el personaje mide 5.57 u â‰ˆ 1.75 m) Â· hueco de la puerta y
 * canto del muro bajo â†’ 8.28 Â· tableros verdes 2.29 â†’ 8.09 Â· ventanas-transom
 * 8.45 â†’ 9.83 (vidrio 8.55 â†’ 9.72) Â· ventanas laterales bajas 2.24 â†’ 7.32 y altas
 * 7.57 â†’ 9.06 Â· techo 10.34 Â· lÃ¡mparas 9.81-10.34.
 *
 * La decoraciÃ³n colgada en la pared no se deforma: se TRANSLADA la distancia que
 * le tocarÃ­a por su altura (y como estÃ¡ toda por debajo del canto, no se mueve).
 * Los muebles sobre el suelo (escritorios, sillas, libreros, atril) no se tocan.
 */
// Cotas del .glb, ya llevadas a unidades del mundo con ESCALA_SALON (se leen
// sobre geometrÃ­a ya escalada; el cociente FACTOR_TECHO no cambia al escalar
// las tres juntas, asÃ­ que el dibujo del techo es idÃ©ntico en proporciÃ³n).
const SUBIR_TECHO = 2 * ESCALA_SALON; // unidades del mundo. 0 lo apaga.
const TECHO_SALON = 10.34 * ESCALA_SALON; // cara de abajo del techo ORIGINAL, medida en el .glb
const TOPE_PUERTA = 8.28 * ESCALA_SALON; // canto superior del hueco de la puerta (muro bajo), en el .glb
const FACTOR_TECHO =
  (TECHO_SALON + SUBIR_TECHO - TOPE_PUERTA) / (TECHO_SALON - TOPE_PUERTA);
const UMBRAL_TECHO = 9.75 * ESCALA_SALON; // red de seguridad por geometrÃ­a (moldura 9.70 / borde 9.81)

/** Altura final de un punto: intacta bajo la puerta, estirada encima de ella. */
function mapearAltura(y: number): number {
  if (y <= TOPE_PUERTA) return y;
  return TOPE_PUERTA + (y - TOPE_PUERTA) * FACTOR_TECHO;
}

// Arquitectura: se deforma EN ESCALA junto con la pared (los huecos van en "room").
const PATRON_ESCALA: RegExp[] = [
  /^room(?:_\d+|_primitive\d+)?$/,
  /^windows(?:_\d+|_primitive\d+)?$/,
  /^Lights_hall(?:_\d+|_primitive\d+)?$/,
  /^Plane\.00[5789](?:_\d+|_primitive\d+)?$/, // vidrios de las ventanas del fondo
];

// DecoraciÃ³n colgada en la pared: sube en proporciÃ³n pero sin deformarse.
const PATRON_SUBIDA: RegExp[] = [
  /^Plane\.(?:001|01[789]|020|023|024)(?:_\d+|_primitive\d+)?$/,
];

function subirElTechoDeLaSala(escena: BABYLON.Scene): void {
  if (SUBIR_TECHO <= 0) return;

  const escaladas = new Set<BABYLON.AbstractMesh>();
  const subidas = new Set<BABYLON.AbstractMesh>();
  const coincide = (nombre: string, patrones: RegExp[]) =>
    patrones.some((p) => p.test(nombre));

  // 1) Por nombre: la arquitectura se mueve con la MISMA regla que la pared.
  //    "room" tiene 7 primitivas y Babylon puede repartirlas en "room_primitive0"â€¦
  //    o en "room_1", "room_2"; se cubren las dos formas y ademÃ¡s "windows",
  //    "Lights_hall" (si no, quedarÃ­an colgando) y los vidrios del fondo.
  for (const malla of escena.meshes) {
    if (coincide(malla.name, PATRON_ESCALA)) escaladas.add(malla);
    else if (coincide(malla.name, PATRON_SUBIDA)) subidas.add(malla);
  }

  // 2) Red de seguridad por GEOMETRÃA (no por nombre): asÃ­, aunque el .glb traya
  //    el aula con otro nombre o partida en varias piezas, el salÃ³n sube igual.
  //    Medido en el .glb actual: "room" ocupa x 60 anchos Â· z 39 de fondo Â·
  //    y -0.80 (suelo) a 10.34 (techo); "background" llega hasta y 23.8 (por eso
  //    el techo de las mallas se limita a 15).
  for (const malla of escena.meshes) {
    if (escaladas.has(malla) || subidas.has(malla)) continue;
    if (!malla.getVerticesData(BABYLON.VertexBuffer.PositionKind)) continue;

    malla.computeWorldMatrix(true);
    const caja = malla.getBoundingInfo().boundingBox;
    const ancho = caja.maximumWorld.x - caja.minimumWorld.x;
    const fondo = caja.maximumWorld.z - caja.minimumWorld.z;
    const yMax = caja.maximumWorld.y;
    const yMin = caja.minimumWorld.y;

    if (yMax < UMBRAL_TECHO) continue; // no llega a la banda del techo
    if (yMax >= 15 * ESCALA_SALON) continue; // el entorno "background" no se toca
    if (!(ancho > 40 * ESCALA_SALON || fondo > 20 * ESCALA_SALON)) continue; // no ocupa el salÃ³n entero

    const cascoDesdeElSuelo = yMin < 0.5 * ESCALA_SALON; // muros (y techo si van en la misma pieza)
    const losaSueltaArriba = yMin >= 9.5 * ESCALA_SALON; // techo o moldura separados del muro
    if (!cascoDesdeElSuelo && !losaSueltaArriba) continue;

    escaladas.add(malla);
    console.log(`Escala de techo: malla "${malla.name}" reconocida como el salÃ³n por su tamaÃ±o.`);
  }

  // 3) Escala de TODA la arquitectura: paredes, huecos, marcos, vidrios, techo
  //    y lÃ¡mparas con la misma fÃ³rmula, asÃ­ los huecos siguen calzando.
  for (const malla of escaladas) escalarVerticalUnaMalla(malla);

  if (escaladas.size > 0) {
    console.log(
      `SalÃ³n +${SUBIR_TECHO} u de alto: la puerta queda INTACTA hasta y=${TOPE_PUERTA}; ` +
        `por encima, escala vertical x${FACTOR_TECHO.toFixed(3)} (techo ${TECHO_SALON} -> ` +
        `${mapearAltura(TECHO_SALON).toFixed(2)}) en ` +
        `${escaladas.size} mallas: ${[...escaladas].map((m) => m.name).join(", ")}.`
    );
  } else {
    console.warn(
      `AVISO: no se encontrÃ³ el salÃ³n para subir el techo (umbral y=${UMBRAL_TECHO}).`
    );
  }

  // 4) DecoraciÃ³n colgada en la pared: se agrupa por pieza del .glb para que las
  //    primitivas de un mismo objeto suban juntas y no se separen entre sÃ­.
  const grupos = new Map<string, BABYLON.AbstractMesh[]>();
  for (const malla of subidas) {
    const base = malla.name.replace(/(?:_\d+|_primitive\d+)$/, "");
    const lista = grupos.get(base);
    if (lista) lista.push(malla);
    else grupos.set(base, [malla]);
  }

  for (const [base, lista] of grupos) {
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const malla of lista) {
      malla.computeWorldMatrix(true);
      const caja = malla.getBoundingInfo().boundingBox;
      yMin = Math.min(yMin, caja.minimumWorld.y);
      yMax = Math.max(yMax, caja.maximumWorld.y);
    }
    const centro = (yMin + yMax) / 2;
    const delta = mapearAltura(centro) - centro;
    if (Math.abs(delta) < 1e-4) continue;

    for (const malla of lista) subirProporcionalmenteUnaMalla(malla, delta);
    console.log(
      `DecoraciÃ³n "${base}": sube ${delta.toFixed(2)} u en proporciÃ³n al techo (sin deformarse).`
    );
  }
}

function escalarVerticalUnaMalla(malla: BABYLON.AbstractMesh): boolean {
  const posiciones = malla.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  if (!posiciones) return false;

  malla.computeWorldMatrix(true);
  const mundo = malla.getWorldMatrix();
  const inversa = new BABYLON.Matrix();
  mundo.invertToRef(inversa);

  // Se mide en el MUNDO (el piso es una altura del aula) y se vuelve a
  // escribir en coordenadas locales: asÃ­ funciona aunque la malla estÃ©
  // escalada o girada por sus padres.
  const mundial = new BABYLON.Vector3();
  const local = new BABYLON.Vector3();
  let tocados = 0;

  for (let i = 0; i < posiciones.length; i += 3) {
    mundial.x = posiciones[i];
    mundial.y = posiciones[i + 1];
    mundial.z = posiciones[i + 2];
    BABYLON.Vector3.TransformCoordinatesToRef(mundial, mundo, mundial);

    // MISMA fÃ³rmula para todos: intacta bajo la puerta, estirada por encima.
    const yNuevo = mapearAltura(mundial.y);
    if (yNuevo === mundial.y) continue; // la puerta (y todo lo de abajo) no se mueve

    mundial.y = yNuevo;
    BABYLON.Vector3.TransformCoordinatesToRef(mundial, inversa, local);
    posiciones[i] = local.x;
    posiciones[i + 1] = local.y;
    posiciones[i + 2] = local.z;
    tocados++;
  }

  if (!tocados) return false;

  malla.setVerticesData(BABYLON.VertexBuffer.PositionKind, posiciones, false);
  malla.refreshBoundingInfo(false, false);
  malla.computeWorldMatrix(true);
  return true;
}

function subirProporcionalmenteUnaMalla(malla: BABYLON.AbstractMesh, delta: number): boolean {
  const posiciones = malla.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  if (!posiciones) return false;

  malla.computeWorldMatrix(true);
  const mundo = malla.getWorldMatrix();
  const inversa = new BABYLON.Matrix();
  mundo.invertToRef(inversa);

  // TraslaciÃ³n rÃ­gida en el MUNDO: la pieza sube la distancia que le tocarÃ­a por
  // su altura, pero NO se deforma (un pÃ³ster estirado al 18% se verÃ­a mal).
  const mundial = new BABYLON.Vector3();
  const local = new BABYLON.Vector3();

  for (let i = 0; i < posiciones.length; i += 3) {
    mundial.x = posiciones[i];
    mundial.y = posiciones[i + 1];
    mundial.z = posiciones[i + 2];
    BABYLON.Vector3.TransformCoordinatesToRef(mundial, mundo, mundial);

    mundial.y += delta;
    BABYLON.Vector3.TransformCoordinatesToRef(mundial, inversa, local);
    posiciones[i] = local.x;
    posiciones[i + 1] = local.y;
    posiciones[i + 2] = local.z;
  }

  malla.setVerticesData(BABYLON.VertexBuffer.PositionKind, posiciones, false);
  malla.refreshBoundingInfo(false, false);
  malla.computeWorldMatrix(true);
  return true;
}

// Muebles (escritorios, sillas, atril, cabinet): colisión propia vía ObstaculoSolido y
// NUNCA checkCollisions (ver ObstaculoSolido: el motor se atasca en las lajas finas).
// El CABINET (taquera/armario, p. ej. cabinet.003) entra aquí también: con
// checkCollisions el elipsoide se atascaba detrás de la laja fina y no dejaba
// salir ("intento salir y no me deja"). Con AABB + rechazo-por-eje el cuerpo se
// detiene en la cara y SIEMPRE puede retroceder, nunca queda atrapado dentro.
function esMuebleNombre(nombre: string): boolean {
  return (
    nombre.includes("desk") ||
    nombre.includes("chair") ||
    nombre.includes("lecturn") ||
    nombre.includes("cabinet")
  );
}

// Toda malla con geometría que NO sea mueble es estructura del salón (muros,
// techo, parqués, estantes…). La exportación actual del Blender no
// trae ninguna malla llamada "room"/"wall", así que un filtro por nombre no
// acertaba con NINGUNA malla y todo quedaba sin colisión: el personaje
// atravesaba las paredes. La raíz "__root__" del loader no tiene vértices
// propios y queda fuera; los muros invisibles "limite*", el suelo de colisión
// y la pantalla del tablero se crean aparte y se excluyen por seguridad.
function esMallaEstructura(m: BABYLON.AbstractMesh): boolean {
  const n = m.name.toLowerCase();
  if (n.startsWith("limite")) return false;
  if (n === "suelocolision") return false;
  if (n === "pantallaproyeccion") return false;
  if (esMuebleNombre(n)) return false;
  return !!m.getVerticesData(BABYLON.VertexBuffer.PositionKind);
}

// Caja del recinto cuando el .glb NO trae el mesh "room" (exportación actual).
// x/z salen del parqué (Cube.021) y, si no lo hubiera, de la unión de la
// estructura; y sale del techo de las mallas de estructura que caen sobre el
// parqué — el "background" del exterior solo entra si su AABB se solapa en x/z
// con el parqué, y aun así solo encarecería el muro invisible de más, que no
// cambia nada (nadie vuela por encima de la cabeza del personaje). NO se filtra
// por altura absoluta: el techo, después de subirElTechoDeLaSala(), supera
// cualquier cota fija razonable. El suelo se fija en SUELO_Y: es la altura
// exacta a la que pisa el personaje, y de paso hace que las alturas de los
// rayos de medirInteriorDelSalon (cajaRoom.min.y + n) caigan en la banda libre
// del muro y no dentro del pavimento.
function cajaDelRecintoPorGeometria(
  mallas: BABYLON.AbstractMesh[]
): { min: BABYLON.Vector3; max: BABYLON.Vector3 } | null {
  const estructura: BABYLON.AbstractMesh[] = [];
  for (const m of mallas) {
    if (!esMallaEstructura(m)) continue;
    m.computeWorldMatrix(true);
    m.refreshBoundingInfo(false, false);
    estructura.push(m);
  }
  if (!estructura.length) return null;

  const piso = estructura.find((m) => m.name === "Cube.021") ?? null;
  const paraXZ = piso ? [piso] : estructura;

  const min = new BABYLON.Vector3(Infinity, SUELO_Y, Infinity);
  const max = new BABYLON.Vector3(-Infinity, SUELO_Y, -Infinity);
  for (const m of paraXZ) {
    const caja = m.getBoundingInfo().boundingBox;
    min.x = Math.min(min.x, caja.minimumWorld.x);
    min.z = Math.min(min.z, caja.minimumWorld.z);
    max.x = Math.max(max.x, caja.maximumWorld.x);
    max.z = Math.max(max.z, caja.maximumWorld.z);
  }
  if (!isFinite(min.x) || !isFinite(max.x) || min.x >= max.x || min.z >= max.z) return null;

  // y: arriba, el techo de la estructura que cae sobre el parqué (x/z ya medidos).
  for (const m of estructura) {
    const caja = m.getBoundingInfo().boundingBox;
    if (caja.maximumWorld.x < min.x || caja.minimumWorld.x > max.x) continue;
    if (caja.maximumWorld.z < min.z || caja.minimumWorld.z > max.z) continue;
    max.y = Math.max(max.y, caja.maximumWorld.y);
  }
  if (max.y <= min.y) return null;

  return { min, max };
}

function medirInteriorDelSalon(
  escena: BABYLON.Scene,
  candidatas: BABYLON.AbstractMesh[],
  cajaRoom: { min: BABYLON.Vector3; max: BABYLON.Vector3 },
  cajaContenido: { min: BABYLON.Vector3; max: BABYLON.Vector3 } | null
): { min: BABYLON.Vector3; max: BABYLON.Vector3 } | null {
  // Carcasa = estructura con geometría (muros, ventanas, techo…), nunca muebles
  // ni los muros invisibles "limite*": los rayos miden la cara interna del aula.
  const esCarcasa = esMallaEstructura;

  const mallas = candidatas.filter(esCarcasa);
  if (!mallas.length) return null;

  try {
    for (const m of mallas) {
      m.computeWorldMatrix(true);
      m.refreshBoundingInfo(false, false);
    }

    // OrÃ­genes: dentro de la caja de muebles, separada 1 unidad (a escala del
    // .glb) del borde.
    const origen = cajaContenido ?? cajaRoom;
    const inset = ESCALA_SALON;
    const minX = origen.min.x + inset;
    const maxX = origen.max.x - inset;
    const minZ = origen.min.z + inset;
    const maxZ = origen.max.z - inset;
    if (maxX <= minX || maxZ <= minZ) return null;

    const centroX = (minX + maxX) / 2;
    const centroZ = (minZ + maxZ) / 2;
    // Alturas sobre el suelo: por debajo del dintel de las ventanas y por encima de
    // mesas/sillas/atril (que ademÃ¡s no estÃ¡n en la carcasa, asÃ­ que no importan).
    const alturas = [2, 2.6, 3.8].map((a) => cajaRoom.min.y + a * ESCALA_SALON);
    const rayosPorAltura = 15;
    const alcance =
      Math.max(cajaRoom.max.x - cajaRoom.min.x, cajaRoom.max.z - cajaRoom.min.z) * 2;

    const medir = (dirX: number, dirZ: number): number | null => {
      const distancias: number[] = [];
      const direccion = new BABYLON.Vector3(dirX, 0, dirZ); // ya es unitario
      for (const y of alturas) {
        for (let i = 0; i < rayosPorAltura; i++) {
          const t = (i + 0.5) / rayosPorAltura;
          const origenRayo =
            dirX !== 0
              ? new BABYLON.Vector3(centroX, y, minZ + t * (maxZ - minZ))
              : new BABYLON.Vector3(minX + t * (maxX - minX), y, centroZ);
          const pick = escena.pickWithRay(
            new BABYLON.Ray(origenRayo, direccion, alcance),
            esCarcasa
          );
          if (pick && pick.hit && isFinite(pick.distance)) distancias.push(pick.distance);
        }
      }
      if (!distancias.length) return null;
      distancias.sort((a, b) => a - b);
      return distancias[Math.floor(distancias.length / 2)];
    };

    const min = cajaRoom.min.clone();
    const max = cajaRoom.max.clone();
    const izq = medir(-1, 0);
    const der = medir(1, 0);
    const del = medir(0, -1);
    const tra = medir(0, 1);
    if (izq !== null) min.x = centroX - izq;
    if (der !== null) max.x = centroX + der;
    if (del !== null) min.z = centroZ - del;
    if (tra !== null) max.z = centroZ + tra;

    // Control de salud: la caja medida tiene que seguir metida en el "room" y tener
    // dentro a los muebles. Si no, el AABB original es mÃ¡s seguro que una medida rara.
    const cabeEnRoom =
      min.x >= cajaRoom.min.x &&
      max.x <= cajaRoom.max.x &&
      min.z >= cajaRoom.min.z &&
      max.z <= cajaRoom.max.z;
    const contieneContenido = cajaContenido
      ? min.x < cajaContenido.min.x &&
        max.x > cajaContenido.max.x &&
        min.z < cajaContenido.min.z &&
        max.z > cajaContenido.max.z
      : true;
    if (!cabeEnRoom || !contieneContenido || min.x >= max.x || min.z >= max.z) return null;

    return { min, max };
  } catch (error) {
    console.warn("No se pudo medir el interior del salón con rayos:", error);
    return null;
  }
}

  async function cargarSalon(scene: BABYLON.Scene): Promise<BABYLON.AbstractMesh> {
    // Usar siempre salon.glb como mapa principal
    const baseModelos = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    const resultado = await BABYLON.SceneLoader.ImportMeshAsync(
      "",
      `${baseModelos}/models/mapes/`,
      "salon.glb",
      scene
    );

  const salon = resultado.meshes[0];
  salon.position = BABYLON.Vector3.Zero();
  // El salÃ³n entero entra a ESCALA_SALON (raÃ­z "__root__" del loader: multiplica
  // mallas, empties y huesos de una vez, conservando el flip -Z de handedness).
  // Se hace JUSTO DESPUÃ‰S de importar y ANTES de medir nada: todos los rayos,
  // lÃ­mites, sillas y obstÃ¡culos de este funciÃ³n salen ya en unidades del
  // mundo y calzan con lo que se ve en pantalla.
  // La prueba entra TAL CUAL (Ã—1: el .glb ya viene de Blender a la altura
  // definida el 7/10 â€” no se agranda ni se disminuye); el prototipo, ESCALA_SALON.
  salon.scaling = salon.scaling.multiplyByFloats(ESCALA_SALON_DE_PRUEBA, ESCALA_SALON_DE_PRUEBA, ESCALA_SALON_DE_PRUEBA);
  salon.computeWorldMatrix(true);

    {
      // salon.glb: centrar el AULA en (0,0) para que el spawn del centro de
    // la clase caiga en mitad del parquÃ©, y apoyar la CARA SUPERIOR del parquÃ©
    // exactamente en SUELO_Y, que es donde pisa el personaje. Se centra sobre la
    // malla del piso (Cube.021, material "Beech Wood Flooring Planks"); si un
    // export futuro la renombra, se cae a la caja del modelo entero y el spawn
    // queda en una esquina. El AABB se mide con la escala ya puesta y la posiciÃ³n
    // todavÃ­a en cero, asÃ­ que el centrado sale directo en unidades del mundo con
    // el flip del loader incluido.
    //
    // OJO: en la exportaciÃ³n del 7/10 el parquÃ© NO estÃ¡ en y=0 (estÃ¡ en -0.34),
    // asÃ­ que apoyar el y=0 en SUELO_Y dejarÃ­a al personaje flotando 0.93 u
    // sobre la laja (y la cadera no calzarÃ­a con la mesa). Por eso primero se
    // centra en XZ con y=0 y luego se mide con un rayo, justo en el spawn, la
    // altura REAL del parquÃ© para desplazar el salÃ³n: suelo medido = SUELO_Y,
    // pies clavados en la laja.
    const mallaPiso = resultado.meshes.find((m) => m.name === "Cube.021") ?? null;
    const aCentrar = mallaPiso ? [mallaPiso] : resultado.meshes;
    const min = new BABYLON.Vector3(
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY
    );
    const max = new BABYLON.Vector3(
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY
    );
    for (const malla of aCentrar) {
      if (!malla.getVerticesData(BABYLON.VertexBuffer.PositionKind)) continue;
      malla.computeWorldMatrix(true);
      const caja = malla.getBoundingInfo().boundingBox;
      min.x = Math.min(min.x, caja.minimumWorld.x);
      min.y = Math.min(min.y, caja.minimumWorld.y);
      min.z = Math.min(min.z, caja.minimumWorld.z);
      max.x = Math.max(max.x, caja.maximumWorld.x);
      max.y = Math.max(max.y, caja.maximumWorld.y);
      max.z = Math.max(max.z, caja.maximumWorld.z);
    }

    salon.position = new BABYLON.Vector3(-(min.x + max.x) / 2, 0, -(min.z + max.z) / 2);
    salon.computeWorldMatrix(true);

    let sueloMedido = min.y;
    if (mallaPiso) {
      mallaPiso.computeWorldMatrix(true);
      mallaPiso.refreshBoundingInfo(false, false);
      // Rayo SOLO contra el piso, lanzado un poco por encima de su canto inferior
      // y justo donde caerÃ¡ el spawn (0,0): la primera cara del parquÃ© que tope
      // es la superficie andable.
      const rayoSuelo = scene.pickWithRay(
        new BABYLON.Ray(new BABYLON.Vector3(0, min.y + 1, 0), new BABYLON.Vector3(0, -1, 0), 4),
        (malla) => malla === mallaPiso
      );
      if (rayoSuelo?.hit && rayoSuelo.pickedPoint) sueloMedido = rayoSuelo.pickedPoint.y;
    }
    salon.position.y = SUELO_Y - sueloMedido;
    salon.computeWorldMatrix(true);

    console.log(
      `salon.glb: ` +
        `centrado sobre ${mallaPiso ? `"${mallaPiso.name}" (el piso)` : "la caja del modelo"}: ` +
        `x[${min.x.toFixed(1)}, ${max.x.toFixed(1)}] ` +
        `y[${min.y.toFixed(1)}, ${max.y.toFixed(1)}] ` +
        `z[${min.z.toFixed(1)}, ${max.z.toFixed(1)}] -> ` +
        `posiciÃ³n (${salon.position.x.toFixed(1)}, ${salon.position.y.toFixed(2)}, ` +
        `${salon.position.z.toFixed(1)}) Â· parquÃ© medido en y=${sueloMedido.toFixed(2)}`
    );
  }

  paresSillas.length = 0;
  obstaculosSolidos.length = 0;
  atril = null;

  const todasLasMallas = resultado.meshes;
  const todosLosNodos = [...resultado.transformNodes, ...resultado.meshes];

  // EMPTIES DE APARICION: "Spawn1".."Spawn12" (pasillos) y "Spawn_Profe".
  // El loader glTF convierte los empties de Blender en TransformNode; su
  // absolutePosition ya sale en mundo (escala y centrado del salon aplicados).
  // Si el .glb no los trae se avisa y elegirPuntoAparicion() usa su respaldo.
  puntosAparicion.length = 0;
  puntoAparicionProfe = null;
  const esSpawnProfe = (nombre: string): boolean => /^spawn[_\s-]*profe$/i.test(nombre);
  const esSpawnAlumno = (nombre: string): boolean => /^spawn\s*\d+$/i.test(nombre);
  for (const nodo of todosLosNodos) {
    if (esSpawnProfe(nodo.name)) {
      nodo.computeWorldMatrix(true);
      puntoAparicionProfe = nodo.absolutePosition.clone();
    } else if (esSpawnAlumno(nodo.name)) {
      nodo.computeWorldMatrix(true);
      puntosAparicion.push({
        nombre: nodo.name,
        posicion: nodo.absolutePosition.clone(),
      });
    }
  }
  if (puntosAparicion.length || puntoAparicionProfe) {
    console.log(
      `Spawns del mapa -> ${puntosAparicion.map((p) => p.nombre).join(", ") || "ninguno"}` +
        (puntoAparicionProfe ? " + Spawn_Profe" : "")
    );
  } else {
    console.warn(
      "El mapa no trae empties Spawn1..Spawn12 / Spawn_Profe: se usan las coordenadas de respaldo de los pasillos."
    );
  }

  todasLasMallas.forEach((mesh) => {
    const nombre = mesh.name.toLowerCase();

    // Muebles y atril: colisiÃ³n propia (ver ObstaculoSolido). Si tambiÃ©n le damos
    // checkCollisions, Babylon y el corrector pelean por la misma posiciÃ³n y el
    // elipsoide vuelve a quedarse atrapado dentro de la laja de la mesa.
    if (esMuebleNombre(nombre)) {
      mesh.computeWorldMatrix(true);
      mesh.refreshBoundingInfo(false, false);
      const bb = mesh.getBoundingInfo().boundingBox;
      const ancho = bb.maximumWorld.x - bb.minimumWorld.x;
      const fondo = bb.maximumWorld.z - bb.minimumWorld.z;

      // "cabinet.003" agrupa en una sola malla las taquillas, ventanas y
      // cortinas de todo el perimetro: su caja mide 54 x 27 u y, metida en
      // obstaculosSolidos, tapaba el salon entero (todos los spawns
      // "solapaban" con ella y el avatar acababa pegado a la pared). Una pieza
      // de mobiliario real no pasa de 6 u de lado, asi que por encima de eso
      // se trata como estructura: colision del motor y fuera de las cajas.
      if (ancho > 6 || fondo > 6) {
        mesh.checkCollisions = true;
        return;
      }

      // Mueble normal: colision propia (ver ObstaculoSolido). Si tambien le
      // damos checkCollisions, Babylon y el corrector pelean por la misma
      // posicion y el elipsoide vuelve a quedarse atrapado dentro de la mesa.
      mesh.checkCollisions = false;
      obstaculosSolidos.push({
        nombre: mesh.name,
        min: bb.minimumWorld.clone(),
        max: bb.maximumWorld.clone(),
      });
      return;
    }

    // Estructura del salón (muros, techo, parqués…): al motor de
    // colisiones. Antes se filtraba por nombres ("room"/"wall"/…) y la
    // exportación actual del Blender no trae NINGUNA malla con esos nombres
    // (los muros son Cube.011, Cube.012, Cube.003…), así que
    // todas quedaban con checkCollisions=false y el personaje se salía
    // andando por la pared. Ahora toda malla con geometría que no sea mueble
    // es estructura (esMallaEstructura); los muebles (incluido el cabinet)
    // ya salieron arriba.
    mesh.checkCollisions = esMallaEstructura(mesh);
  });

  console.log(
    `ObstÃ¡culos sÃ³lidos -> ${obstaculosSolidos.length}: ` +
      obstaculosSolidos.map((o) => o.nombre).join(", ")
  );

  // ---------------------------------------------------------------
  // LÃMITES DEL SALÃ“N (colisiÃ³n con los "empty")
  // Un empty no es una malla, asÃ­ que no se le puede poner checkCollisions.
  // Se levantan 4 muros invisibles cuya cara interna cae sobre la pared INTERNA del
  // aula (medida con rayos, ver medirInteriorDelSalon) y crecen hacia fuera: solo
  // sirven para contener. Con el AABB crudo de "room" sobraban 10 unidades detrÃ¡s del
  // tablero y 11 en el pasillo, y por ahÃ­ se colaban la cÃ¡mara y el modelo.
  // ---------------------------------------------------------------
  // El techo sube ANTES de medir: asÃ­ el AABB y los muros invisibles ya salen con
  // la altura nueva y no hay que rehacer la mediciÃ³n. En la prueba (salon.glb con
  // texturas) NO se sube: mapearAltura() estira por encima de TOPE_PUERTA y
  // deformarÃ­a las texturas de las paredes; ademÃ¡s el techo real (â‰ˆ 4.4 m) ya
  // deja pasar la cÃ¡mara, que no sube de la altura del ojo (alturaOjoActiva).
  subirElTechoDeLaSala(scene);

  limitesSalon = null;

  // Caja ocupada por los muebles: marca "dónde está el aula" y de ahí salen los rayos.
  let cajaContenido: { min: BABYLON.Vector3; max: BABYLON.Vector3 } | null = null;
  for (const obs of obstaculosSolidos) {
    if (!cajaContenido) {
      cajaContenido = { min: obs.min.clone(), max: obs.max.clone() };
      continue;
    }
    cajaContenido.min.x = Math.min(cajaContenido.min.x, obs.min.x);
    cajaContenido.min.z = Math.min(cajaContenido.min.z, obs.min.z);
    cajaContenido.max.x = Math.max(cajaContenido.max.x, obs.max.x);
    cajaContenido.max.z = Math.max(cajaContenido.max.z, obs.max.z);
  }

  // CAJA BASE DEL RECINTO. Con el mesh "room" se usa su AABB (como hasta ahora).
  // Sin él —la exportación actual del Blender no lo trae— se arma desde la
  // geometría del propio .glb (parqué para x/z, techo de la estructura para y).
  // Sin esta caja no existen los muros "limite*", dentroDelSalon() devolvía
  // siempre true y el personaje y la cámara se salían del aula por cualquier lado.
  const meshRoom = todasLasMallas.find((m) => m.name.toLowerCase().includes("room"));
  let cajaRecinto: { min: BABYLON.Vector3; max: BABYLON.Vector3 } | null = null;
  let vinoDelRoom = false;

  if (meshRoom) {
    meshRoom.computeWorldMatrix(true);
    meshRoom.refreshBoundingInfo(false, false);
    const bb = meshRoom.getBoundingInfo().boundingBox;
    cajaRecinto = { min: bb.minimumWorld.clone(), max: bb.maximumWorld.clone() };
    vinoDelRoom = true;
    console.log(
      `AABB del mesh "room" (demasiado grande) -> x[${bb.minimumWorld.x.toFixed(2)}, ${bb.maximumWorld.x.toFixed(2)}] ` +
        `z[${bb.minimumWorld.z.toFixed(2)}, ${bb.maximumWorld.z.toFixed(2)}]`
    );
  } else {
    cajaRecinto = cajaDelRecintoPorGeometria(todasLasMallas);
    if (cajaRecinto) {
      console.log(
        `Sin mesh "room": recinto armado desde la geometría -> ` +
          `x[${cajaRecinto.min.x.toFixed(2)}, ${cajaRecinto.max.x.toFixed(2)}] ` +
          `y[${cajaRecinto.min.y.toFixed(2)}, ${cajaRecinto.max.y.toFixed(2)}] ` +
          `z[${cajaRecinto.min.z.toFixed(2)}, ${cajaRecinto.max.z.toFixed(2)}]`
      );
    }
  }

  if (cajaRecinto) {
    const { min, max } = cajaRecinto;

    const interior = medirInteriorDelSalon(scene, todasLasMallas, { min, max }, cajaContenido);
    if (interior) {
      min.copyFrom(interior.min);
      max.copyFrom(interior.max);
    }
    limitesSalon = { min, max };

    const GROSOR = 2;
    const alto = max.y - min.y;
    const centroX = (min.x + max.x) / 2;
    const centroZ = (min.z + max.z) / 2;

    const crearMuro = (nombre: string, ancho: number, fondo: number, x: number, z: number) => {
      const muro = BABYLON.MeshBuilder.CreateBox(
        nombre,
        { width: ancho, height: alto, depth: fondo },
        scene
      );
      muro.position = new BABYLON.Vector3(x, min.y + alto / 2, z);
      // La posiciÃ³n cambia despuÃ©s de crear la caja: hay que refrescar la matriz de
      // mundo y el AABB o el rechazo rÃ¡pido de colisiÃ³n seguirÃ­a con la caja en el origen.
      muro.computeWorldMatrix(true);
      muro.refreshBoundingInfo(false, false);
      muro.checkCollisions = true;
      muro.isVisible = false;
      muro.isPickable = false;
      return muro;
    };

    crearMuro("limiteIzquierdo", GROSOR, max.z - min.z, min.x - GROSOR / 2, centroZ);
    crearMuro("limiteDerecho", GROSOR, max.z - min.z, max.x + GROSOR / 2, centroZ);
    crearMuro(
      "limiteFrontal",
      max.x - min.x + GROSOR * 2,
      GROSOR,
      centroX,
      min.z - GROSOR / 2
    );
    crearMuro(
      "limiteTrasero",
      max.x - min.x + GROSOR * 2,
      GROSOR,
      centroX,
      max.z + GROSOR / 2
    );

    console.log(
      `Límites del salón${interior ? " (pared interior medida con rayos)" : vinoDelRoom ? " (sin medida: AABB de room)" : " (sin medida: geometría del salón)"} -> ` +
        `x[${min.x.toFixed(2)}, ${max.x.toFixed(2)}] ` +
        `y[${min.y.toFixed(2)}, ${max.y.toFixed(2)}] z[${min.z.toFixed(2)}, ${max.z.toFixed(2)}]`
    );
  } else {
    console.warn(
      "No se encontró el mesh 'room' ni la geometría del salón: el salón queda sin muros de contención."
    );
  }

  let nodoTablero: BABYLON.AbstractMesh | BABYLON.TransformNode | null = null;

  for (const nodo of todosLosNodos) {
    if (nodo.name.toLowerCase().includes("tablero_01") || nodo.name.toLowerCase() === "tablero_01") {
      nodoTablero = nodo;
      break;
    }
  }

  materialPantalla = new BABYLON.StandardMaterial("MatPantalla", scene);
  materialPantalla.emissiveColor = new BABYLON.Color3(1, 1, 1);
  materialPantalla.disableLighting = true;
  materialPantalla.backFaceCulling = false;

  if (nodoTablero) {
    nodoTablero.computeWorldMatrix(true);

    // El empty "tablero_01" MARCA el Ã¡rea del tablero (asÃ­ lo puso el modelo): su
    // escala es la MEDIA-distancia del recuadro que Blender dibuja, asÃ­ que el
    // tablero mide 2 Ã— escala. Con el .glb actual eso da 21.61 de ancho (z) Ã—
    // 7.40 de alto (y), centrado en y 5.70 (content y[2.00, 9.41]). Ojo: la
    // pizarra fÃ­sica YA NO EXISTE en el .glb (se borrÃ³ en la exportaciÃ³n del
    // 30/09), asÃ­ que el contenido va directo sobre la pared, cuya cara interna
    // estÃ¡ en x -21.374; el plano queda en x -21.130, o sea 0.24 por delante,
    // que es lo que evita el z-fighting.
    // El plano se construye 2Ã—2 en local y, como hereda la escala del empty,
    // acaba exactamente en esas medidas: si agrandas el empty en Blender, el
    // Ã¡rea del tablero crece sola sin tocar cÃ³digo.
    //
    // EL EMPTY TAMBIÃ‰N SE HACE MÃS GRANDE AL SUBIR EL TECHO. El hueco del tablero
    // estÃ¡ en la pared y la pared se deforma con mapearAltura() (intacta hasta
    // y=8.28 y estirada por encima), asÃ­ que el Ã¡rea del empty tiene que llevarse
    // con la MISMA funciÃ³n: si no, el tablero queda mÃ¡s alto que las diapositivas
    // (la pared crece y el contenido se queda donde estaba). El plano es 2Ã—2 y estÃ¡
    // centrado en el origen del empty, asÃ­ que bastan dos condiciones â€”canto
    // inferior y canto superiorâ€” para fijar media-altura (scaling.y) y centro
    // (position.y). x y z no se tocan: la pared solo crece hacia arriba.
    const matrizTablero = nodoTablero.getWorldMatrix();
    const centroY = BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.Zero(), matrizTablero).y;
    const arribaY = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(0, 1, 0), matrizTablero).y;
    const media = arribaY - centroY;
    // Solo en el prototipo: allÃ­ el techo SUBE (subirElTechoDeLaSala y
    // mapearAltura) y el empty tiene que estirarse con la pared. En el salÃ³n de
    // prueba el techo NO se sube (mapearAltura estirarÃ­a las texturas), asÃ­ que
    // el empty se queda exactamente donde lo puso Blender.
    if (Math.abs(media) > 1e-6) {
      const bajo = centroY - media;
      const alto = centroY + media;
      const nuevoBajo = mapearAltura(bajo);
      const nuevoAlto = mapearAltura(alto);
      const factor = (nuevoAlto - nuevoBajo) / (alto - bajo);
      nodoTablero.scaling.y *= factor;
      nodoTablero.position.y += (nuevoAlto + nuevoBajo - (alto + bajo)) / 2;
      console.log(
        `Tablero: el empty "tablero_01" sigue el mismo mapa que la pared: Ã¡rea ` +
          `y[${bajo.toFixed(2)}, ${alto.toFixed(2)}] -> [${nuevoBajo.toFixed(2)}, ` +
          `${nuevoAlto.toFixed(2)}] (escala y Ã—${factor.toFixed(3)})`
      );
    }

    const anchoLocal = 2;
    const altoLocal = 2;

    pantallaTablero = BABYLON.MeshBuilder.CreatePlane("PantallaProyeccion", { width: anchoLocal, height: altoLocal }, scene);
    pantallaTablero.material = materialPantalla;
    pantallaTablero.parent = nodoTablero;
    // -90Â° en Y: la cara del plano mira hacia el aula (-X); el ancho cae sobre
    // el eje Z del empty y el alto sobre su Y.
    pantallaTablero.rotation = new BABYLON.Vector3(0, -Math.PI / 2, 0);
    pantallaTablero.position = new BABYLON.Vector3(0.02, 0, 0);
    pantallaTablero.isVisible = false;
    pantallaTablero.computeWorldMatrix(true);
    pantallaTablero.refreshBoundingInfo(false, false);
  } else {
    pantallaTablero = BABYLON.MeshBuilder.CreatePlane("PantallaProyeccion", { width: 3.6 * ESCALA_SALON, height: 1.8 * ESCALA_SALON }, scene);
    pantallaTablero.material = materialPantalla;
    pantallaTablero.position = new BABYLON.Vector3(20.91, 5.74, -1.09).scale(ESCALA_SALON);
    pantallaTablero.isVisible = false;
  }

  const mapaSillas = new Map<number, BABYLON.AbstractMesh>();
  const mapaSits = new Map<number, BABYLON.TransformNode | BABYLON.AbstractMesh>();

  const extraerNumero = (str: string): number | null => {
    const match = str.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  };

  todasLasMallas.forEach((mesh) => {
    if (mesh.name.toLowerCase().includes("desk_chair")) {
      const num = extraerNumero(mesh.name);
      if (num !== null) mapaSillas.set(num, mesh);
    }
  });

  todosLosNodos.forEach((nodo) => {
    if (nodo.name.toUpperCase().startsWith("SIT_")) {
      const num = extraerNumero(nodo.name);
      if (num !== null) mapaSits.set(num, nodo);
    }
  });

  mapaSillas.forEach((meshSilla, num) => {
    meshSilla.computeWorldMatrix(true);
    let posSilla: BABYLON.Vector3;
    const boundingInfo = meshSilla.getBoundingInfo();

    if (boundingInfo && boundingInfo.boundingSphere) {
      posSilla = boundingInfo.boundingSphere.centerWorld.clone();
    } else {
      posSilla = meshSilla.absolutePosition.clone();
    }

    // Rumbo de la silla: se descompone su matriz MUNDIAL (el flip de
    // handedness del glTF queda absorbido en la descomposiciÃ³n â€” medido con
    // NullEngine: âˆ’90Â° en todas las sillas del salÃ³n). Es el rumbo con el
    // que hay que sentarse para quedar mirando al frente del puesto, sea
    // cual sea el lado desde el que se llegue.
    let rotSilla = NaN;
    const escalaSilla = new BABYLON.Vector3();
    const posDescompuesta = new BABYLON.Vector3();
    const cuatSilla = new BABYLON.Quaternion();
    if (meshSilla.getWorldMatrix().decompose(escalaSilla, cuatSilla, posDescompuesta)) {
      rotSilla = cuatSilla.toEulerAngles().y;
    }

    const nodoSit = mapaSits.get(num);
    let posSitFinal: BABYLON.Vector3;
    let rotYFinal = 0;

    if (nodoSit) {
      nodoSit.computeWorldMatrix(true);
      posSitFinal = nodoSit.absolutePosition.clone();
      rotYFinal = nodoSit.rotationQuaternion ? nodoSit.rotationQuaternion.toEulerAngles().y : nodoSit.rotation.y;
    } else {
      posSitFinal = posSilla.clone();
      posSitFinal.y += 2.2 * ESCALA_SALON;
    }

    paresSillas.push({
      numero: num,
      posicionMundoSilla: posSilla,
      puntoSit: { posicion: posSitFinal, rotacionY: rotYFinal },
      rotacionSilla: rotSilla,
    });
  });

  let meshAtril: BABYLON.AbstractMesh | null = null;
  for (const mesh of todasLasMallas) {
    if (mesh.name.toLowerCase().includes("lecturn")) {
      meshAtril = mesh;
      break;
    }
  }

  let nodoTeach: BABYLON.TransformNode | BABYLON.AbstractMesh | null = null;
  for (const nodo of todosLosNodos) {
    if (nodo.name.toUpperCase().includes("TEACH")) {
      nodoTeach = nodo;
      break;
    }
  }

  if (meshAtril || nodoTeach) {
    let posAtril = meshAtril 
      ? (meshAtril.getBoundingInfo()?.boundingSphere?.centerWorld?.clone() ?? meshAtril.absolutePosition.clone())
      : BABYLON.Vector3.Zero();

    let posEnsenar: BABYLON.Vector3;
    let rotEnsenar = Math.PI;

    if (nodoTeach) {
      nodoTeach.computeWorldMatrix(true);
      posEnsenar = nodoTeach.absolutePosition.clone();
      // Nota: puntoEnsenar hoy no se lee en ninguna parte (la cÃ¡mara del atril
      // se arma en funcionalidades con detrasDelAtril + alturaOjoProfesor).
      posEnsenar.y += alturaOjoActiva;
      rotEnsenar = nodoTeach.rotationQuaternion ? nodoTeach.rotationQuaternion.toEulerAngles().y : nodoTeach.rotation.y;
      // Sin malla "lecturn" (el salÃ³n de prueba solo trae el empty TEACH_01),
      // el punto de atril es el propio empty: asÃ­ la R de "presentar en el
      // atril" y la proximidad del menÃº P apuntan a su pizarra y no al (0,0)
      // del centro de la clase.
      if (!meshAtril) {
        posAtril = new BABYLON.Vector3(posEnsenar.x, SUELO_Y, posEnsenar.z);
      }
    } else {
      posEnsenar = posAtril.clone();
      posEnsenar.y += 2.5 * ESCALA_SALON;
      posEnsenar.z -= 0.5 * ESCALA_SALON;
    }

    atril = {
      posicionAtril: posAtril,
      puntoEnsenar: { posicion: posEnsenar, rotacionY: rotEnsenar },
    };
  }

  return salon;
}

// ============================================================
// TABLERO Y VOLUMEN DE LA APP
// ============================================================

// El tablero de ESTA partida (src/3d/tableroFuncionalidad.ts). AquÃ­ solo se crea,
// se le pasa el volumen y se le llama la API: la lÃ³gica del proyector no vive ya
// en este archivo, que es el del mapa y del personaje.
let tablero: Tablero | null = null;

// VÍDEO DEL TABLERO EN DIRECTO (WebRTC): el docente sube un vídeo y su flujo
// se manda a la sala. Vive aquí para que el tablero lo use desde su closure
// (se crea más abajo, cuando la presencia ya tiene socket).
let videoTablero: VideoTablero | null = null;

// Volumen general (0..1). Vive aquÃ­ porque lo aplican a la vez el menÃº de ajustes
// y el botÃ³n ðŸ”Š de la barra; se persiste en el navegador desde src/ui/menuAjustes.ts.
let volumenGeneral = leerVolumen();
let volumenAntesDeSilenciar: number | null = null;

// Funciones de limpieza de la partida en curso. Se ejecutan al salir para que,
// al volver a entrar, no se registren los mismos listeners otra vez.
const limpiadoresDePartida: Array<() => void> = [];

// CÃ³digo de la clase en la que se estÃ¡ jugando ahora mismo. Lo necesita el
// mÃ³dulo de presencia (para meterse en la sala "clase:CODIGO") y la pÃ­ldora de
// conectados, que lo enseÃ±a arriba a la izquierda.
let claseActiva = "";

/**
 * VOLUMEN DE LA APP: manda sobre todo lo que suena DENTRO del metaverso â€” el vÃ­deo
 * del tablero, YouTube, la pantalla compartida y, cuando llegue el chat por
 * proximidad, las voces (entran por el audio global de Babylon).
 *
 * No toca el volumen del portÃ¡til: el slider multiplica con el del sistema
 * operativo, que el navegador no deja saltarse.
 */
function aplicarVolumenGlobal(): void {
  const motorAudio = BABYLON.Engine.audioEngine;
  if (motorAudio) motorAudio.setGlobalVolume(volumenGeneral);
  tablero?.refrescarVolumen();
}

// ============================================================
// ESCENA PRINCIPAL
// ============================================================

const createScene = async function (alRenderizar: (escena: BABYLON.Scene) => void): Promise<BABYLON.Scene> {
  const scene = new BABYLON.Scene(engine);
  scene.gravity = new BABYLON.Vector3(0, -0.15, 0);
  scene.collisionsEnabled = true;
  scene.clearColor = new BABYLON.Color4(0.75, 0.85, 0.95, 1);

  // ESTATURA Y OJO DEL PERSONAJE: los de SIEMPRE (5.892 u / ojo 5.35), en TODAS
  // las clases â€” tambiÃ©n REU-175, desde que las estructuras del salÃ³n de prueba
  // vienen de Blender a la altura comÃºn de todos los mapas (7/10 tarde). Se fija
  // ANTES de la cÃ¡mara y de cargar el cuerpo (cargarPersonaje lee la estatura
  // activa al escalar).
  alturaOjoActiva = ALTURA_OJO_PROFESOR;
  fijarAlturaPersonaje(ALTURA_OBJETIVO_BASE);

  // 1. CONFIGURAR LA CÃMARA
  const camara = new BABYLON.UniversalCamera(
    "camara",
    new BABYLON.Vector3(0, SUELO_Y + alturaOjoActiva, -8),
    scene
  );
  camara.attachControl(canvas, true);
  camara.speed = 0.35;
  camara.angularSensibility = 5000;

  camara.keysUp = [];
  camara.keysDown = [];
  camara.keysLeft = [];
  camara.keysRight = [];

  const radioVertical = (SUELO_Y + alturaOjoActiva) / 2;
  camara.ellipsoid = new BABYLON.Vector3(0.5, radioVertical, 0.5);
  camara.ellipsoidOffset = new BABYLON.Vector3(0, radioVertical, 0);
  // La cÃ¡mara NO colisiona por su cuenta: su posiciÃ³n se copia 1:1 desde el modelo 3D
  // en cada frame, asÃ­ que su colisiÃ³n y su gravedad solo la desalinearÃ­an (y cobrarÃ­an
  // un barrido de colisiones completo por frame sin motivo). El encierro lo resuelven los
  // muros "limite*" + recortarAlSalon().
  camara.checkCollisions = false;
  camara.applyGravity = false;
  camara.minZ = 0.1;

  const luz = new BABYLON.HemisphericLight("luz", new BABYLON.Vector3(0, 1, 0), scene);
  luz.intensity = 0.9;

  // 2. EL BUCLE DE RENDER ARRANCA YA, con la cÃ¡mara y la luz listas. AsÃ­ el
  //    usuario ve el aula mientras carga (y DETRÃS de la ventana de skin, que
  //    sigue abierta en el panel): antes no se dibujaba nada hasta que
  //    terminaba de cargar el personaje y se veÃ­a una pantalla en blanco.
  alRenderizar(scene);

  await cargarSalon(scene);

  // TABLERO. El mapa solo aporta la malla y el material que ya midiÃ³ en su .glb
  // (el empty "tablero_01"); pdf.js, el vÃ­deo, YouTube y la captura de pantalla
  // los trae el mÃ³dulo. Un mapa nuevo no tiene que reescribir nada de esto.
  if (pantallaTablero && materialPantalla) {
    tablero = crearTablero({
      pantalla: pantallaTablero,
      material: materialPantalla,
      scene,
      volumen: () => volumenGeneral,
      // El menÃº "Publicar" se filtra con esto: docente/admin de todo,
      // estudiante/invitado solo diapositivas y notas.
      rol: () => obtenerSesion()?.rol ?? "estudiante",
      // EL TABLERO ES DEL SALÃ“N: lo que uno publica aquÃ­ (PDF, imagen,
      // YouTube, limpiar) sale hacia la sala por `remotos`. Se lee en el
      // momento del cierre, asÃ­ que funciona aunque `remotos` se cree
      // mÃ¡s abajo; sin conexiÃ³n no se manda nada (la red lo resuelve
      // reenviando cuando alguien entra).
      alPublicar: (mensaje) => remotos?.publicarTablero(mensaje),
      // El vídeo subido desde el ordenador NO se proyecta: su flujo sale por
      // WebRTC para que cada alumno lo vea en su cajita personal.
      alPublicarVideo: (flujo) => videoTablero?.publicar(flujo),
    });
  } else {
    console.warn("Sin malla de tablero en este mapa: no habrá proyección.");
  }

  const sueloColision = BABYLON.MeshBuilder.CreateGround("sueloColision", { width: 100, height: 100 }, scene);
  sueloColision.position = new BABYLON.Vector3(0, SUELO_Y, 0);
  sueloColision.checkCollisions = true;
  sueloColision.isVisible = false;

  // 3. CARGAR EL PERSONAJE 3D. Va DESPUÃ‰S del salÃ³n (el aula se ve ya detrÃ¡s
  //    de la ventana de skin) y ESPERA a que se cierre esa ventana antes de
  //    leer la skin elegida (esperarSkinPendiente dentro de cargarPersonaje).
  let personaje: Personaje | null = null;
  try {
    personaje = await cargarPersonaje(scene, obtenerSesion()?.rol ?? "estudiante");

    // PUNTO DE APARICION POR ROL Y PERSONA (ver elegirPuntoAparicion): el
    // docente detras del atril mirando a la clase, los estudiantes de pie
    // junto a un pupitre repartidos por el aula (mesa asignada por correo).
    // Antes todo el mundo salia apilado en el mismo (0, SUELO_Y, -8).
    const aparicion = elegirPuntoAparicion();
    const original = aparicion.posicion.clone();
    aparicion.posicion.copyFrom(sitioSeguroCerca(scene, aparicion.posicion));
    console.log(
      `[spawn] rol=${obtenerSesion()?.rol} original=(${original.x.toFixed(2)}, ${original.z.toFixed(2)}) ` +
        `final=(${aparicion.posicion.x.toFixed(2)}, ${aparicion.posicion.z.toFixed(2)})`
    );
    personaje.raiz.position.copyFrom(aparicion.posicion);

    // Orientar cuerpo y camara al yaw del punto de aparicion. La raiz glTF
    // trae rotationQuaternion, en cuyo caso Babylon ignora raiz.rotation:
    // hay que componer con la rotacion base del loader (mismo criterio que el
    // bucle de render y el teletransporte del atril).
    camara.rotation.y = aparicion.yaw;
    if (personaje.raiz.rotationQuaternion) {
      const base = personaje.rotacionBaseRaiz ?? BABYLON.Quaternion.Identity();
      personaje.raiz.rotationQuaternion =
        BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, aparicion.yaw).multiply(base);
    } else {
      personaje.raiz.rotation.y = aparicion.yaw;
    }

    // Camara al mismo sitio, a altura de ojo (evita un frame en el punto viejo;
    // despues la mantiene pegada pegarCamaraAlCuerpo).
    camara.position.copyFrom(aparicion.posicion);
    camara.position.y += alturaOjoActiva;

    // CUERPO DE COLISIÃ“N DEL PERSONAJE (lo que lleva moveWithCollisions).
    // No usa la geometrÃ­a del modelo, usa este elipsoide:
    //   radio (0.55, 2.42, 0.55) + offset (0, 2.73, 0)  =>  ocupa de SUELO_Y+0.31
    //   a SUELO_Y+5.15: el cuerpo entero de 1.85 m (5.892 u), con 0.31 de
    //   holgura bajo el pie para no engancharse en lajas ni cantos.
    // Choca con room y con los muros invisibles "limite*".
    // Mesas, sillas y atril NO pasan por aquÃ­: los resuelve empujarFueraDeObstaculos()
    // porque el motor de colisiones se atasca dentro de las lajas finas (ver ObstaculoSolido).
    personaje.raiz.ellipsoid = new BABYLON.Vector3(0.55, 2.42, 0.55);
    personaje.raiz.ellipsoidOffset = new BABYLON.Vector3(0, 2.73, 0);
  } catch (error) {
    console.error("Error al cargar el personaje:", error);
  }

  // La skin ya se eligio (cargarPersonaje espera a esa ventana): desde aqui el
  // usuario ve la pantalla de carga hasta que el salon termina de montarse.
  reiniciarPantallaCarga();

  // ---------------------------------------------------------------
  // FUNCIONALIDADES DEL AVATAR â†’ src/3d/funcionalidades.ts
  // Caminar, sentarse, presentar en el atril, cÃ¡mara 1Âª/3Âª persona y
  // mano alzada viven en un mÃ³dulo aparte: aquÃ­ solo se guarda la
  // referencia y se consulta su estado. Se monta mÃ¡s abajo, cuando el
  // salÃ³n ya cargÃ³ sus sillas, su atril y sus obstÃ¡culos.
  // ---------------------------------------------------------------
  let func: Funcionalidades;

  // -----------------------------------------------------------------------
  // CLIC EN EL TABLERO DESDE LEJOS â†’ se abre la pantalla en grande para el que
  // clica (igual que en framevr.io): el contenido del proyector se ve a pantalla
  // completa aquÃ­, sin tener que caminar hasta el atril.
  // Se registra DESPUÃ‰S de declarar `func` porque el handler lo lee y la
  // funciÃ³n es asÃ­ncrona (un clic durante la carga no tendrÃ­a esa referencia lista).
  // -----------------------------------------------------------------------
  function clicSobreElTablero(evento: MouseEvent): boolean {
    if (!tablero || !pantallaTablero || func.enElAtril()) return false;
    if (tablero.pantallaCompletaAbierta() || !tablero.hayContenido()) return false;

    const lienzo = scene.getEngine().getRenderingCanvas();
    if (!lienzo) return false;

    // Con el puntero bloqueado no hay cursor que seguir: se apunta al centro de la
    // pantalla, que es exactamente donde estÃ¡ la mirada del jugador.
    const bloqueado = document.pointerLockElement === lienzo;
    const rect = lienzo.getBoundingClientRect();
    const x = bloqueado ? lienzo.clientWidth / 2 : evento.clientX - rect.left;
    const y = bloqueado ? lienzo.clientHeight / 2 : evento.clientY - rect.top;

    const golpe = scene.pick(x, y);
    if (!golpe?.hit || !golpe.pickedPoint) return false;

    // La pizarra es un plano finÃ­simo clavado en la pared: comparar contra su AABB
    // tal cual no darÃ­a con la cara de la pizarra real del .glb, asÃ­ que se ensancha
    // (muy en X, que es el eje normal a la pared) y un poco en alto y fondo.
    pantallaTablero.computeWorldMatrix(true);
    const caja = pantallaTablero.getBoundingInfo().boundingBox;
    const p = golpe.pickedPoint;
    const dentro =
      p.x > caja.minimumWorld.x - 3 &&
      p.x < caja.maximumWorld.x + 3 &&
      p.y > caja.minimumWorld.y - 0.6 &&
      p.y < caja.maximumWorld.y + 0.6 &&
      p.z > caja.minimumWorld.z - 0.8 &&
      p.z < caja.maximumWorld.z + 0.8;
    if (!dentro) return false;

    tablero.abrirPantallaCompleta();
    return tablero.pantallaCompletaAbierta();
  }

  // Se registra con nombre para poder desmontarlo al salir de la partida
  // (si no, al volver a entrar se duplicarÃ­an los listeners).
  const alHacerClickEnCanvas = (evento: MouseEvent) => {
    // Mientras se escribe en las notas el ratÃ³n NO se bloquea: el clic tiene
    // que llegar al textarea para colocar el cursor donde toca.
    if (tablero?.dibujoAbierto()) return;
    if (clicSobreElTablero(evento)) return;
    canvas.requestPointerLock();
  };
  canvas.addEventListener("click", alHacerClickEnCanvas);
  limpiadoresDePartida.push(() => canvas.removeEventListener("click", alHacerClickEnCanvas));

  // UI de ESTA partida (archivos aparte en src/ui/): se guardan aquÃ­ para que
  // tanto el teclado como el bucle de render manden lo mismo a los botones.
  let barra: BarraUsuario | null = null;
  let menuAjustes: MenuAjustes | null = null;
  let camaraWeb: CamaraWeb | null = null;
  let videoSalon: VideoSalon | null = null;

  // -----------------------------------------------------------------------
  // FUNCIONALIDADES â†’ src/3d/funcionalidades.ts
  // Caminar (WASD + colisiones), sentarse (E), presentar en el atril (R),
  // cÃ¡mara 1Âª/3Âª persona (B) y mano alzada (H) viven en un mÃ³dulo aparte:
  // aquÃ­ solo se le entrega el mundo de ESTE mapa (escena, sillas, atril,
  // obstÃ¡culos y sus reglas de colisiÃ³n) y se cablea una sola vez. Un mapa
  // nuevo repite estas lÃ­neas y reutiliza todo sin reescribirlo.
  // -----------------------------------------------------------------------
  func = crearFuncionalidades({
    escena: scene,
    sueloY: SUELO_Y,
    camara,
    personaje: () => personaje,
    sillas: () => paresSillas,
    atril: () => atril,
    obstaculos: () => obstaculosSolidos,
    recortarAlSalon,
    posicionValida,
    haySolape,
    empujarFueraDeObstaculos,
    // Cuerpos de las demas personas (XZ + radio): nadie camina a traves de nadie.
    // Se lee en cada llamada, asi que funciona aunque `remotos` se cree despues.
    cuerposAjenos: () => remotos?.cuerpos() ?? [],
    aviso,
    avisoMano,
    limpiadores: limpiadoresDePartida,
    radioPersonaje: RADIO_PERSONAJE,
    alturaOjoProfesor: alturaOjoActiva,
    alCambiarEstado: () => reflejarBarra(),
    alActualizarTablero: () => {
      // YouTube y notas ya NO se pegan en la pizarra 3D (el vídeo es una caja
      // personal fija arriba a la derecha, las notas un panel lateral), asi que
      // aqui ya no se juntan siluetas para recortar nada: solo se refresca la
      // posicion de la caja y la textura de video.
      tablero?.actualizar();
      // VISTA DEL PRESENTADOR: mientras se esta en el atril, la pantallita
      // inferior izquierda repite la pizarra (que queda a las espaldas) para
      // no tener que dejar de mirar a la clase.
      tablero?.vistaPresentador(func.enElAtril());
    },
    alSalirDelAtril: () => tablero?.cerrarMenu(),
  });

  // -----------------------------------------------------------------------
  // ESTADO â†’ BARRA. El estado del avatar (sentado, tercera persona, manoâ€¦)
  // lo tiene funcionalidades.ts; aquÃ­ solo se pinta en la barra de usuario.
  // -----------------------------------------------------------------------
  function reflejarBarra(): void {
    if (!barra) return;
    const estado = func.estado();
    barra.reflejar({
      microfono: estadoMicrofono(),
      audioEncendido: volumenGeneral > 0,
      cercaDeSilla: estado.cercaDeSilla,
      sentado: estado.sentado,
      manoAlzada: estado.manoAlzada,
      terceraPersona: estado.terceraPersona,
      webcamEncendida: camaraWeb ? camaraWeb.estado() === "encendida" : false,
    });
  }

  // -----------------------------------------------------------------------
  // PRESENCIA: LOS DEMÃS MIEMBROS DE LA CLASE
  // (src/3d/avataresRemotos.ts dibuja y mueve los cuerpos; src/red/presencia.ts
  // habla con el servidor y filtra quÃ© se envÃ­a). AquÃ­ solo se le pasa el estado
  // del avatar local y se pinta lo que llega en la pÃ­ldora de conectados.
  // -----------------------------------------------------------------------
  let listado: ListadoConectados | null = null;
  let remotos: AvataresRemotos | null = null;
  /** Ids de socket vistos en la Ãºltima lista: para detectar quiÃ©n ENTRA. */
  const conocidos = new Set<string>();

  /**
   * Lo que se publica de MI avatar: dÃ³nde estoy y quÃ© estoy haciendo.
   * El rumbo se toma de la cÃ¡mara, que es la que mira a dÃ³nde andas (la cÃ¡mara
   * va pegada al cuerpo en 3Âª persona y por encima de los ojos en 1Âª).
   */
  function estadoLocal(): EstadoLocal {
    const pos = personaje?.raiz.position ?? new BABYLON.Vector3(0, SUELO_Y, -8);
    const estado = func.estado();
    return {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      // El rumbo del CUERPO, no el de la cámara: sentado o en el atril la
      // cámara gira con la mirada y publicarla haría girar el avatar ante los
      // demás (el cuerpo, en cambio, queda fijo mirando al frente).
      yaw: estado.rumbo,
      sentado: estado.sentado,
      enAtril: func.enElAtril(),
      manoAlzada: estado.manoAlzada,
    };
  }

  // La pÃ­ldora se crea antes que la presencia: asÃ­, el primer mensaje del
  // servidor (que puede llegar en el mismo frame) ya tiene dÃ³nde pintarse.
  listado = crearListadoConectados(claseActiva);

  remotos = crearAvataresRemotos({
    escena: scene,
    clase: claseActiva,
    sueloY: SUELO_Y,
    personaje: () => personaje,
    estadoLocal,
    alCambiarParticipantes: (participantes: Participante[], miId: string | null) => {
      listado?.reflejar(participantes, miId);

      // El id propio de socket llega (o se confirma tras reconexión) aquí:
      // el video de salón lo necesita para no crearse un par consigo mismo
      // y para saber si una oferta entrante es un "glare" (perfect negotiation).
      if (miId) videoSalon?.fijarId(miId);
      videoSalon?.actualizarParticipantes(participantes.map((p) => p.id));
      // Vídeo del tablero: mismo id y misma lista (así ofrece el flujo a quien
      // acaba de entrar si el docente está publicando).
      if (miId) videoTablero?.fijarId(miId);
      videoTablero?.actualizarParticipantes(participantes.map((p) => p.id));

      // Si ENTRA alguien a la clase y aquÃ­ hay algo en el tablero, se le
      // reenvÃ­a al momento: quien llega ve lo que se estÃ¡ presentando sin
      // tener que pedir nada. Sin `miId` (primer aviso, aÃºn sin confirmar
      // la entrada) no se manda: asÃ­, tras una reconexiÃ³n, manda el que
      // sigue en la sala con lo mÃ¡s fresco, no el que vuelve con lo suyo
      // de antes. Lo mismo hace el otro lado al verME entrar a mÃ­.
      const otros = new Set(participantes.filter((p) => p.id !== miId).map((p) => p.id));
      let entraAlguien = false;
      for (const id of otros) {
        if (!conocidos.has(id)) entraAlguien = true;
        conocidos.add(id);
      }
      for (const id of [...conocidos]) if (!otros.has(id)) conocidos.delete(id);
      if (entraAlguien && miId) tablero?.republicarContenido();
    },
    alCambiarConexion: (estado, detalle) => {
      listado?.reflejarConexion(estado, detalle);
      // La lista puede llegar antes que la confirmaciÃ³n de entrada, asÃ­ que el
      // "(tÃº)" no siempre sale en la primera pintada: al conectar se repinta.
      if (estado === "conectado") {
        listado?.reflejar(remotos?.participantes() ?? [], remotos?.miId() ?? null);
      }
    },
    alRechazar: (motivo) => {
      listado?.avisar(motivo);
      barra?.mostrarGlobo(motivo);
    },
    alAlzarMano: (nombre) => {
      // "Alguien levantÃ³ la mano" sale en la burbuja de la barra (la misma
      // que los mensajes de cÃ¡mara/micro): avisa a todos los de la clase.
      barra?.mostrarGlobo(t("mano.aviso", { nombre }));
    },
    alRecibirTablero: (mensaje) => {
      // Lo que otro publicÃ³ en la pizarra se pinta en la MÃA: mismo salÃ³n,
      // misma pantalla. El tablero aplica sin reenviar (sin eco).
      tablero?.aplicarMensaje(mensaje);
    },
    limpiadores: limpiadoresDePartida,
  });

  // -----------------------------------------------------------------------
  // VIDEO SALÓN: la webcam de quien presenta, como cuadrito junto a su avatar
  // (src/red/videoSalon.ts). Usa el mismo socket que la presencia para la
  // señalización WebRTC; el flujo de vídeo va P2P entre navegadores.
  // -----------------------------------------------------------------------
  videoSalon = crearVideoSalon({
    escena: scene,
    signaling: {
      emitir: (evento, datos) => remotos?.emitirSignaling(evento, datos),
      escuchar: (evento, fn) => remotos?.escucharSignaling(evento, fn) ?? (() => {}),
    },
    obtenerFlujoLocal: () => camaraWeb?.obtenerFlujo() ?? null,
    obtenerFlujoMicrofono: () => obtenerFlujoMicrofono(),
    volumen: () => volumenGeneral,
    posicionCabeza: (id) => remotos?.posicionCabeza(id) ?? null,
    anchoEtiqueta: () => remotos?.anchoEtiqueta() ?? 4.4,
    nombreDe: (id) => remotos?.nombreDe(id) ?? "",
    limpiadores: limpiadoresDePartida,
  });

  // El id propio de socket hace falta ANTES de ofrecer nada: si se quedara
  // vacío, las ofertas de la gente que ya está en la sala se descartarían
  // como propias y sus cámaras se quedarían en negro. Se fija aquí (si ya se
  // sabe) y luego en cada aviso de participantes (ver más abajo).
  videoSalon.fijarId(remotos?.miId() ?? "");

  // -----------------------------------------------------------------------
  // VÍDEO DEL TABLERO: el vídeo subido desde el ordenador viaja P2P (el
  // servidor solo señaliza). El alumno lo ve en su cajita personal y el profe
  // en la vista del tablero. Usa los mismos eventos de sala que la presencia.
  // -----------------------------------------------------------------------
  videoTablero = crearVideoTablero({
    signaling: {
      emitir: (evento, datos) => remotos?.emitirSignaling(evento, datos),
      escuchar: (evento, fn) => remotos?.escucharSignaling(evento, fn) ?? (() => {}),
    },
    alRecibir: (flujo) => tablero?.mostrarVideoDeLaSala(flujo),
    limpiadores: limpiadoresDePartida,
  });
  videoTablero.fijarId(remotos?.miId() ?? "");
  videoTablero.actualizarParticipantes(remotos?.participantes().map((p) => p.id) ?? []);

  // -----------------------------------------------------------------------
  // SALIR DE LA CLASE / PARTIDA â†’ vuelve al panel con el que iniciaste sesiÃ³n
  // -----------------------------------------------------------------------
  function salirDeLaPartida(): void {
    engine.stopRenderLoop();

    menuAjustes?.destruir();
    barra?.destruir();
    // La webcam tambiÃ©n: si no, el piloto de la cÃ¡mara seguirÃ­a encendido.
    camaraWeb?.destruir();
    listado?.destruir();
    // Retira tambiÃ©n el menÃº del tablero y, sobre todo, PARA la captura de
    // pantalla: si no, el navegador seguirÃ­a grabando tras salir de la clase.
    tablero?.destruir();
    menuAjustes = null;
    barra = null;
    tablero = null;
    camaraWeb = null;
    videoSalon = null;
    videoTablero = null;
    listado = null;
    remotos = null;

    // Mano alzada, su temporizador y los avisos: los limpia el mÃ³dulo de
    // funcionalidades, el mismo que los cableÃ³ al entrar en la clase.
    func.destruir();

    // Sin esto, al volver a entrar se registrarÃ­an listeners encima de otros.
    for (const limpiar of limpiadoresDePartida.splice(0)) limpiar();

    liberarMicrofono();
    if (document.pointerLockElement) document.exitPointerLock();

    // La clase se borra de la direcciÃ³n: si no, al volver al panel y pulsar
    // otra vez en la misma clase, entrarÃ­a por el enlace viejo en vez de por
    // el botÃ³n. El enlace se vuelve a escribir al entrar (ver entrarAlSalon).
    escribirClaseEnLaUrl(null);
    claseActiva = "";

    scene.dispose();

    const sesion = obtenerSesion();
    if (sesion) {
      mostrarDashboard(sesion, entrarAlSalon);
    } else {
      iniciarLogin((cuenta) => mostrarDashboard(cuenta, entrarAlSalon));
    }
  }

  // -----------------------------------------------------------------------
  // Botones de la barra (src/ui/barraUsuario.ts)
  // -----------------------------------------------------------------------
  function manejarAccionBarra(accion: AccionBarra, detalle?: string): void {
    if (accion === "sentarse") {
      func.alternarSentado();
      return;
    }
    if (accion === "alzarMano") {
      func.alternarMano();
      return;
    }
    if (accion === "camara") {
      func.alternarCamara();
      return;
    }

    if (accion === "webcam") {
      void (async () => {
        const estado = await camaraWeb?.alternar();
        reflejarBarra();
        // Publica el estado a la sala y, si se encendió, ofrece el flujo
        // P2P a los presentes (los demás ven el cuadrito junto al avatar).
        videoSalon?.publicarEstadoCamara(estado === "encendida");
        if (estado === "encendida") barra?.mostrarGlobo("Cámara encendida");
        else if (estado === "apagada") barra?.mostrarGlobo("Cámara apagada");
        else if (estado === "sin-permiso") barra?.mostrarGlobo("Sin permiso de cámara");
        else if (estado === "sin-soporte") barra?.mostrarGlobo("Cámara no disponible");
      })();
      return;
    }

    if (accion === "audio") {
      if (volumenGeneral > 0) {
        volumenAntesDeSilenciar = volumenGeneral;
        volumenGeneral = 0;
      } else {
        volumenGeneral =
          volumenAntesDeSilenciar && volumenAntesDeSilenciar > 0 ? volumenAntesDeSilenciar : 0.8;
        volumenAntesDeSilenciar = null;
      }
      guardarVolumen(volumenGeneral);
      aplicarVolumenGlobal();
      menuAjustes?.actualizarVolumen(volumenGeneral);
      reflejarBarra();
      barra?.mostrarGlobo(
        volumenGeneral > 0
          ? `Volumen ${Math.round(volumenGeneral * 100)}%`
          : "Sonido silenciado",
      );
      return;
    }

    if (accion === "microfono") {
      void alternarMicrofono().then((estado) => {
        reflejarBarra();
        // La voz viaja P2P por los mismos pares WebRTC que la webcam: se
        // publica el estado a la sala y se enchufa (o desenchufa) la pista
        // de audio. Así el otro LEE lo que se habla, no solo ve el cuadrito.
        videoSalon?.publicarEstadoMicrofono(estado === "encendido");
        if (estado === "encendido") barra?.mostrarGlobo("Micrófono encendido");
        else if (estado === "apagado") barra?.mostrarGlobo("Micrófono apagado");
        else if (estado === "sin-permiso") barra?.mostrarGlobo("Sin permiso de micrófono");
        else barra?.mostrarGlobo("Micrófono no disponible");
      });
      return;
    }

    // Etapa del chat por proximidad: aquÃ­ se reenvÃ­a `detalle` al resto de la
    // partida. De momento solo lo ve el propio jugador (lo pinta la barra).
    if (accion === "emote") {
      console.log("Emote:", detalle);
      // ðŸ‘‹ ademÃ¡s de pintarse en la barra, mueve el brazo del personaje 3.5 s.
      if (detalle === "ðŸ‘‹") func.saludar();
    }
  }

  // -----------------------------------------------------------------------
  // TECLADO
  // -----------------------------------------------------------------------
  const manejarTeclado = (evento: KeyboardEvent): void => {
    // MIENTRAS SE ESCRIBE EN LAS NOTAS las teclas son del TEXTO (b, r, â†,
    // espacio, Suprâ€¦): no se dispara ningÃºn atajo de la sala. Esc sÃ­, porque
    // es la tecla que cierra el editor.
    if (tablero?.dibujoAbierto() && evento.key !== "Escape") return;

    const tecla = evento.key.toLowerCase();

    if (tecla === "b") func.alternarCamara();
    if (tecla === "r") func.alternarAtril();
    if (tecla === "e") func.alternarSentado();
    if (tecla === "h") func.alternarMano();

    // P abre el menÃº del tablero SOLO en el atril: publicar, presentar y
    // limpiar son cosas de quien estÃ¡ presentando, no de quien estÃ¡ de cerca.
    if (tecla === "p" && func.enElAtril()) {
      tablero?.abrirMenu();
    }

    if (evento.key === "Escape") {
      if (tablero?.pantallaCompletaAbierta()) {
        tablero.cerrarPantallaCompleta();
      } else if (tablero?.menuAbierto()) {
        tablero.cerrarMenu();
      } else if (tablero?.dibujoAbierto()) {
        // Se termina de escribir pero lo escrito se queda en la pizarra.
        tablero.terminarDeEscribir();
      } else {
        // Esc tambiÃ©n libera el puntero: es la Ãºnica forma de volver a poder
        // clicar los botones de la barra y el engranaje de ajustes.
        menuAjustes?.alternar();
      }
    }

    // Las flechas cambian la diapositiva de TODA la clase: solo quien está en
    // el atril las manda (dentro de cambiarDiapositiva se comprueba igual).
    if (func.enElAtril() && evento.key === "ArrowRight") tablero?.cambiarDiapositiva(1);
    if (func.enElAtril() && evento.key === "ArrowLeft") tablero?.cambiarDiapositiva(-1);

    if (func.enElAtril() && evento.key === " ") {
      evento.preventDefault();
      tablero?.alternarPausa();
    }

    // Limpiar el tablero lo hace quien estÃ¡ EN EL ATRIL, del rol que sea
    // (docente, admin o estudiante). La posiciÃ³n es la que da permiso: el
    // que ocupa el atril es quien presenta y maneja la pizarra de todos.
    if (func.enElAtril() && (evento.key === "Delete" || evento.key === "Backspace")) {
      tablero?.limpiar();
    }
  };

  window.addEventListener("keydown", manejarTeclado);
  limpiadoresDePartida.push(() => window.removeEventListener("keydown", manejarTeclado));

  // -----------------------------------------------------------------------
  // UI MODULAR (src/ui/): menÃº de ajustes âš™ï¸ y barra de usuario.
  // Son archivos aparte con una responsabilidad fija: cualquier otro mapa los
  // importa y funciona igual, sin reescribir botones.
  // -----------------------------------------------------------------------
  aplicarVolumenGlobal();

  menuAjustes = crearMenuAjustes({
    volumenInicial: volumenGeneral,
    alCambiarVolumen: (volumen) => {
      volumenGeneral = volumen;
      aplicarVolumenGlobal();
      reflejarBarra();
    },
    alSalirDeLaClase: salirDeLaPartida,
  });

  // Se crea ANTES de la barra: reflejarBarra() se ejecuta nada mÃ¡s montarla y
  // necesita saber si la webcam estÃ¡ encendida.
  camaraWeb = crearCamaraWeb(() => reflejarBarra());

  barra = crearBarraUsuario({ alPulsar: manejarAccionBarra });
  reflejarBarra();

  // Hook de depuraciÃ³n: en la consola del navegador (F12) puedes inspeccionar
  // la escena con __metaverso.camara / __metaverso.personaje
  (window as unknown as Record<string, unknown>).__metaverso = { camara, personaje, escena: scene };

  // Salon montado: la pantalla de carga puede completar la barra y retirarse.
  marcarSalonCargado();

  return scene;
};

function entrarAlSalon(clase: Clase) {
  claseActiva = clase.codigo;
  // La direcciÃ³n pasa a ser la de esta clase: es lo que permite copiar el
  // enlace del navegador y pasÃ¡rselo a otro para que entre a la MISMA.
  escribirClaseEnLaUrl(clase.codigo);

  // Tapa el canvas mientras se importa el mapa (el render loop arranca antes
  // de que el salon exista). Queda por debajo de la ventana de skins.
  mostrarPantallaCarga();

  const alRedimensionar = () => engine.resize();
  window.addEventListener("resize", alRedimensionar);
  limpiadoresDePartida.push(() => window.removeEventListener("resize", alRedimensionar));

  createScene((escena) => {
    engine.runRenderLoop(() => escena.render());
  }).catch((error) => {
    console.error("ERROR AL CREAR LA ESCENA:", error);
    ocultarPantallaCarga();
    alert("Ocurrió un error cargando el salón. Revisa la consola (F12).");
  });
}

// -----------------------------------------------------------------------
// ENTRAR POR ENLACE  â†’  http://localhost:5173/?clase=FIS-101
// -----------------------------------------------------------------------
// Si la direcciÃ³n trae el cÃ³digo de una clase, se entra directamente en ella
// en lugar de mostrar el panel. Se pregunta a la API de quÃ© clase se trata (el
// cÃ³digo solo no dice ni la materia ni el docente) y se entra. Devuelve false
// si no habÃ­a enlace o la clase ya no existe, para que el llamante abra el
// panel con normalidad.
async function entrarPorEnlace(): Promise<boolean> {
  const codigo = leerClaseDeLaUrl();
  if (!codigo) return false;

  let clase: Clase | null = null;
  try {
    clase = await obtenerClasePorCodigo(codigo);
  } catch (error) {
    console.error("No se pudo consultar la clase del enlace:", error);
  }

  if (!clase) {
    aviso.textContent = `La clase ${codigo} no existe o el servidor no estÃ¡ disponible.`;
    aviso.style.display = "block";
    window.setTimeout(() => {
      aviso.style.display = "none";
    }, 4000);
    // Se quita el enlace de la direcciÃ³n para no repetir el error al recargar.
    escribirClaseEnLaUrl(null);
    return false;
  }

  entrarAlSalon(clase);
  return true;
}

// Si no hay sesiÃ³n se pide el login primero, y solo despuÃ©s se mira el enlace:
// asÃ­ un enlace recibido por WhatsApp funciona aunque no se estÃ© conectado.
async function arrancar(): Promise<void> {
  const sesion = obtenerSesion();
  if (!sesion) {
    iniciarLogin((cuenta) => {
      void entrarPorEnlace().then((entro) => {
        if (!entro) mostrarDashboard(cuenta, entrarAlSalon);
      });
    });
    return;
  }
  const entro = await entrarPorEnlace();
  if (!entro) mostrarDashboard(sesion, entrarAlSalon);
}

void arrancar();
