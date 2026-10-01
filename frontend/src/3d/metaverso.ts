import "../assets/style.css";
import { inyectarTema as montarTema } from "../state/preferencias";

// El tema (claro/oscuro) y el idioma se aplican apenas carga la
// página, antes de que se pinte el login o el metaverso.
montarTema();
import * as BABYLON from "babylonjs";
import "babylonjs-loaders";
import { iniciarLogin } from "../page/login/login";
import { mostrarDashboard } from "../page/dashboard/dashboard";
import { obtenerSesion } from "../state/estado";
import type { Clase } from "../state/estado";
import { cargarPersonaje, type Personaje } from "./personaje";
import { crearAvataresRemotos, type AvataresRemotos } from "./avataresRemotos";
import { crearListadoConectados, type ListadoConectados } from "../ui/listadoConectados";
import { leerClaseDeLaUrl, escribirClaseEnLaUrl } from "../state/enlaceClase";
import { obtenerClasePorCodigo } from "../api/servicios";
import type { EstadoLocal, Participante } from "../red/presencia";
// UI MODULAR: se importa como cualquier otra pieza, así cada mapa nuevo reutiliza
// los mismos botones sin reescribirlos.
import { crearMenuAjustes, leerVolumen, guardarVolumen, type MenuAjustes } from "../ui/menuAjustes";
import { crearBarraUsuario, type BarraUsuario, type AccionBarra } from "../ui/barraUsuario";
import { alternarMicrofono, estadoMicrofono, liberarMicrofono } from "../ui/microfono";
import { crearCamaraWeb, type CamaraWeb } from "../ui/webcam";
// TABLERO: PDF, vídeo, YouTube y compartir pantalla viven en su propio archivo,
// igual que la barra y los ajustes. El mapa solo lo importa y llama a su API.
import { crearTablero, type Tablero } from "./tableroFuncionalidad";
// FUNCIONALIDADES: caminar, sentarse, presentar en el atril y cámara viven
// en su propio módulo; cualquier mapa los importa en vez de reescribirlos.
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

const ALTURA_ADULTO_PIE = 7.7;

// Cara superior del suelo del salón. Medida con rayos (NullEngine) sobre el .glb:
// room_primitive2 está en −0.789 en todo el salón (suelo plano). El personaje
// camina con los PIES AQUÍ, no en 0: con los pies en 0 flotaba 0.789 u = 25 cm
// sobre la laja.
const SUELO_Y = -0.789;

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

// AVISO DE RATÓN BLOQUEADO (pointer lock)
// Al hacer clic en la escena se bloquea el puntero para mirar sin que el cursor
// estorbe. Mientras dura el bloqueo TODOS los clics van al canvas, así que los
// botones de la barra y el engranaje no reciben nada: hay que pulsar Esc. Sin este
// aviso no había forma de saberlo y el botón de volumen "a veces no funcionaba".
// Se crea una sola vez a nivel de módulo, igual que el resto de avisos.
const avisoRaton = document.createElement("div");
avisoRaton.style.position = "fixed";
// Justo POR ENCIMA del aviso de proximidad (que está en bottom:12% y es el que dice
// "Presiona E para sentarte" / "Presiona R para presentar en el atril").
// Antes estaba a 96px fijos y, como el 12% sube con la altura de la ventana, en pantallas
// altas los dos se solapaban y la píldora (z-index 1600) tapaba el mensaje de sentarse.
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

// AABB del mesh "room" en coordenadas de mundo.
// Los "empty" del .glb (sit_*, TEACH_01, tablero_01, Plane.003...) son TransformNode y
// Babylon NO puede colisionar contra ellos: el motor de colisiones solo recorre mallas
// con checkCollisions (scene.meshes -> subMeshes). Por eso este AABB es la fuente de
// verdad del recinto: de él salen los 4 muros invisibles "limite*" y el recorte de la
// cámara, que es lo que evita que nadie salga del salón.
let limitesSalon: { min: BABYLON.Vector3; max: BABYLON.Vector3 } | null = null;

// Comprueba si una posición respeta el recinto (sin moverla). Se usa para decidir si
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

// Mantiene una posición dentro del salón (se usa para la cámara, que en tercera persona
// lleva un offset de casi 7 unidades detrás del modelo y podría salir por un hueco).
function recortarAlSalon(posicion: BABYLON.Vector3, margen = 0.6): void {
  if (!limitesSalon) return;
  const { min, max } = limitesSalon;
  posicion.x = Math.min(Math.max(posicion.x, min.x + margen), max.x - margen);
  posicion.z = Math.min(Math.max(posicion.z, min.z + margen), max.z - margen);
}

// ---------------------------------------------------------------
// OBSTÁCULOS SÓLIDOS (mesas "desk", sillas "desk_chair", atril "lecturn")
//
// Estos NO van al motor de colisiones de Babylon. Motivo verificado con pruebas
// sobre babylon.max.js (Collider._testTriangle / _getResponse): la laja de la mesa
// mide solo 8 cm de alto (y 1.51..1.59) y queda DENTRO del elipsoide del personaje,
// así que Babylon la detecta ya desde dentro, no puede salir hacia atrás y se queda
// bloqueado. Síntoma: "atraviesan las mesas y después no me dejan salir".
//
// Se resuelven a mano en el plano horizontal (círculo vs AABB en XZ). Es
// determinista, no depende de los FPS, no permite túneles y, sobre todo, si el
// cuerpo acaba dentro de la caja SIEMPRE lo devuelve por la cara más corta:
// el atasco deja de ser posible por construcción.
// ---------------------------------------------------------------

const obstaculosSolidos: ObstaculoSolido[] = [];

// Altura del cuerpo usado para chocar (los muros "limite*" frenan a su altura).
const ALTURA_PERSONAJE = 4.9;

// ¿Hay algún mueble a menos de RADIO_PERSONAJE (medido en XZ) de la posición?
function haySolape(posicion: BABYLON.Vector3): boolean {
  const radioAlCuadrado = RADIO_PERSONAJE * RADIO_PERSONAJE;
  for (const obs of obstaculosSolidos) {
    // Filtro de altura: solo chocan los obstáculos que tocan el cuerpo (y 0..4.9).
    if (obs.max.y < posicion.y || obs.min.y > posicion.y + ALTURA_PERSONAJE) continue;
    const cx = Math.min(Math.max(posicion.x, obs.min.x), obs.max.x);
    const cz = Math.min(Math.max(posicion.z, obs.min.z), obs.max.z);
    const dx = posicion.x - cx;
    const dz = posicion.z - cz;
    if (dx * dx + dz * dz < radioAlCuadrado) return true;
  }
  return false;
}

// Una posición es utilizable si respeta el recinto y no cae dentro de ningún mueble.
// Es exactamente la condición que exige el bucle de render antes de aceptar un frame.
function posicionValida(posicion: BABYLON.Vector3): boolean {
  return dentroDelSalon(posicion, RADIO_PERSONAJE) && !haySolape(posicion);
}

// Una única pasada de expulsión. El orden de las cajas importa: con dos muebles pegados,
// sacar a alguien de uno puede meterlo dentro del otro, así que la pasada rota el inicio.
function empujarUnaPasada(posicion: BABYLON.Vector3, desde: number): void {
  for (let i = 0; i < obstaculosSolidos.length; i++) {
    const obs = obstaculosSolidos[(i + desde) % obstaculosSolidos.length];
    // Filtro de altura: solo chocan los obstáculos que tocan el cuerpo (y 0..4.9).
    if (obs.max.y < posicion.y || obs.min.y > posicion.y + ALTURA_PERSONAJE) continue;

    // Punto de la caja más cercano al centro del personaje (proyección en XZ).
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
      // El centro quedó DENTRO de la caja: salir por la cara más corta.
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

// Red de seguridad: repite pasadas hasta que la posición quede libre. Solo llega aquí
// un teletransporte (sentarte con E / atril con R) o algo fuera de lo previsto: en el
// caminar normal el cuerpo nunca ocupa una posición que solape.
function empujarFueraDeObstaculos(posicion: BABYLON.Vector3): void {
  for (let pasada = 0; pasada < 8 && haySolape(posicion); pasada++) {
    empujarUnaPasada(posicion, pasada);
  }
}

let pantallaTablero: BABYLON.Mesh | null = null;
let materialPantalla: BABYLON.StandardMaterial | null = null;

// ---------------------------------------------------------------
// MEDIDA DEL INTERIOR DEL SALÓN CON RAYOS
//
// El AABB del mesh "room" NO es el aula: abarca también el hueco que queda detrás del
// tablero y el pasillo del fondo (en este mapa se pasaba 10 unidades en -X y 11 en +Z),
// así que con ese recinto la cámara y el modelo "atravesaban" la pared y acababan en la
// zona negra de fuera. Para contener de verdad hay que medir la cara INTERNA del muro.
//
// Cómo: se lanzan rayos horizontales desde dentro del contenido del aula (los muebles
// marcan dónde está el aula, no el pasillo) hacia cada lado, contra la carcasa
// (room/ventanas/muros) y NUNCA contra muebles ni el suelo invisible. Se toma la MEDIANA
// de los impactos: los rayos que se escapan por una puerta o una ventana dan distancias
// enormes y la mediana los ignora. Si algo sale mal se devuelve null y se usa el AABB.
// ---------------------------------------------------------------
/**
 * TECHO MÁS ALTO — solo la altura: ancho (x) y fondo (z) no se tocan.
 *
 * Se hace POR TRAMOS para que las PUERTAS queden con su tamaño normal (si no, la
 * persona se vería enana al lado de la puerta) y lo que crezca sean los MARCOS y
 * las VENTANAS:
 *
 *     y <= TOPE_PUERTA   →  y' = y                     (MURO BAJO INTACTO)
 *     y >  TOPE_PUERTA   →  y' = TOPE + (y - TOPE) × FACTOR
 *
 *     FACTOR = (TECHO + SUBIR_TECHO − TOPE) / (TECHO − TOPE)   ≈ 1.971
 *
 * TOPE = 8.28 es el canto superior del hueco de la puerta: ahí termina el muro
 * bajo (las 4 puertas, los zócalos y los tableros verdes viven todos por debajo,
 * porque todos sus huecos se cierran en esa misma cota) y empieza la banda alta.
 * Los 2 unidades de más se absorben TODOS por encima de esa cota, así que:
 *
 *   · puertas (hoja + marco + vidrio superior) → EXACTAMENTE como estaban
 *   · tableros verdes y ventanas bajas         → como estaban (mismo hueco)
 *   · ventanas-transom y sus marcos            → ×1.97 de alto  ← lo que se pidió
 *   · techo                                    → 10.34 → 12.34
 *
 * Por encima del canto todo escala igual (escala uniforme alrededor de TOPE), de
 * modo que los huecos siguen calzando con los marcos. Como la función solo depende
 * de y, las aristas verticales siguen verticales: nada se "achaquita".
 *
 * Medido en el .glb: suelo -0.75/-0.80 · hoja de la puerta -0.75 → 4.98 (1.80 m
 * si 1 u ≈ 0.314 m; el personaje mide 5.57 u ≈ 1.75 m) · hueco de la puerta y
 * canto del muro bajo → 8.28 · tableros verdes 2.29 → 8.09 · ventanas-transom
 * 8.45 → 9.83 (vidrio 8.55 → 9.72) · ventanas laterales bajas 2.24 → 7.32 y altas
 * 7.57 → 9.06 · techo 10.34 · lámparas 9.81-10.34.
 *
 * La decoración colgada en la pared no se deforma: se TRANSLADA la distancia que
 * le tocaría por su altura (y como está toda por debajo del canto, no se mueve).
 * Los muebles sobre el suelo (escritorios, sillas, libreros, atril) no se tocan.
 */
const SUBIR_TECHO = 2; // unidades del mundo. 0 lo apaga.
const TECHO_SALON = 10.34; // cara de abajo del techo ORIGINAL, medida en el .glb
const TOPE_PUERTA = 8.28; // canto superior del hueco de la puerta (muro bajo), en el .glb
const FACTOR_TECHO =
  (TECHO_SALON + SUBIR_TECHO - TOPE_PUERTA) / (TECHO_SALON - TOPE_PUERTA);
const UMBRAL_TECHO = 9.75; // red de seguridad por geometría (moldura 9.70 / borde 9.81)

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

// Decoración colgada en la pared: sube en proporción pero sin deformarse.
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
  //    "room" tiene 7 primitivas y Babylon puede repartirlas en "room_primitive0"…
  //    o en "room_1", "room_2"; se cubren las dos formas y además "windows",
  //    "Lights_hall" (si no, quedarían colgando) y los vidrios del fondo.
  for (const malla of escena.meshes) {
    if (coincide(malla.name, PATRON_ESCALA)) escaladas.add(malla);
    else if (coincide(malla.name, PATRON_SUBIDA)) subidas.add(malla);
  }

  // 2) Red de seguridad por GEOMETRÍA (no por nombre): así, aunque el .glb traya
  //    el aula con otro nombre o partida en varias piezas, el salón sube igual.
  //    Medido en el .glb actual: "room" ocupa x 60 anchos · z 39 de fondo ·
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
    if (yMax >= 15) continue; // el entorno "background" no se toca
    if (!(ancho > 40 || fondo > 20)) continue; // no ocupa el salón entero

    const cascoDesdeElSuelo = yMin < 0.5; // muros (y techo si van en la misma pieza)
    const losaSueltaArriba = yMin >= 9.5; // techo o moldura separados del muro
    if (!cascoDesdeElSuelo && !losaSueltaArriba) continue;

    escaladas.add(malla);
    console.log(`Escala de techo: malla "${malla.name}" reconocida como el salón por su tamaño.`);
  }

  // 3) Escala de TODA la arquitectura: paredes, huecos, marcos, vidrios, techo
  //    y lámparas con la misma fórmula, así los huecos siguen calzando.
  for (const malla of escaladas) escalarVerticalUnaMalla(malla);

  if (escaladas.size > 0) {
    console.log(
      `Salón +${SUBIR_TECHO} u de alto: la puerta queda INTACTA hasta y=${TOPE_PUERTA}; ` +
        `por encima, escala vertical x${FACTOR_TECHO.toFixed(3)} (techo ${TECHO_SALON} -> ` +
        `${mapearAltura(TECHO_SALON).toFixed(2)}) en ` +
        `${escaladas.size} mallas: ${[...escaladas].map((m) => m.name).join(", ")}.`
    );
  } else {
    console.warn(
      `AVISO: no se encontró el salón para subir el techo (umbral y=${UMBRAL_TECHO}).`
    );
  }

  // 4) Decoración colgada en la pared: se agrupa por pieza del .glb para que las
  //    primitivas de un mismo objeto suban juntas y no se separen entre sí.
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
      `Decoración "${base}": sube ${delta.toFixed(2)} u en proporción al techo (sin deformarse).`
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
  // escribir en coordenadas locales: así funciona aunque la malla esté
  // escalada o girada por sus padres.
  const mundial = new BABYLON.Vector3();
  const local = new BABYLON.Vector3();
  let tocados = 0;

  for (let i = 0; i < posiciones.length; i += 3) {
    mundial.x = posiciones[i];
    mundial.y = posiciones[i + 1];
    mundial.z = posiciones[i + 2];
    BABYLON.Vector3.TransformCoordinatesToRef(mundial, mundo, mundial);

    // MISMA fórmula para todos: intacta bajo la puerta, estirada por encima.
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

  // Traslación rígida en el MUNDO: la pieza sube la distancia que le tocaría por
  // su altura, pero NO se deforma (un póster estirado al 18% se vería mal).
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

function medirInteriorDelSalon(
  escena: BABYLON.Scene,
  candidatas: BABYLON.AbstractMesh[],
  cajaRoom: { min: BABYLON.Vector3; max: BABYLON.Vector3 },
  cajaContenido: { min: BABYLON.Vector3; max: BABYLON.Vector3 } | null
): { min: BABYLON.Vector3; max: BABYLON.Vector3 } | null {
  const esCarcasa = (m: BABYLON.AbstractMesh) => {
    const n = m.name.toLowerCase();
    if (n.startsWith("limite")) return false; // son nuestros muros invisibles
    return (
      n.includes("room") ||
      n.includes("window") ||
      n.includes("wall") ||
      n.includes("pared")
    );
  };

  const mallas = candidatas.filter(esCarcasa);
  if (!mallas.length) return null;

  try {
    for (const m of mallas) {
      m.computeWorldMatrix(true);
      m.refreshBoundingInfo(false, false);
    }

    // Orígenes: dentro de la caja de muebles, separada 1 unidad del borde.
    const origen = cajaContenido ?? cajaRoom;
    const inset = 1;
    const minX = origen.min.x + inset;
    const maxX = origen.max.x - inset;
    const minZ = origen.min.z + inset;
    const maxZ = origen.max.z - inset;
    if (maxX <= minX || maxZ <= minZ) return null;

    const centroX = (minX + maxX) / 2;
    const centroZ = (minZ + maxZ) / 2;
    // Alturas sobre el suelo: por debajo del dintel de las ventanas y por encima de
    // mesas/sillas/atril (que además no están en la carcasa, así que no importan).
    const alturas = [2, 2.6, 3.8].map((a) => cajaRoom.min.y + a);
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
    // dentro a los muebles. Si no, el AABB original es más seguro que una medida rara.
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
  const resultado = await BABYLON.SceneLoader.ImportMeshAsync(
    "",
    "/models/",
    "prototipo_mapa_vista_sentarse.glb",
    scene
  );

  const salon = resultado.meshes[0];
  salon.position = BABYLON.Vector3.Zero();

  paresSillas.length = 0;
  obstaculosSolidos.length = 0;
  atril = null;

  const todasLasMallas = resultado.meshes;
  const todosLosNodos = [...resultado.transformNodes, ...resultado.meshes];

  todasLasMallas.forEach((mesh) => {
    const nombre = mesh.name.toLowerCase();

    // Muebles y atril: colisión propia (ver ObstaculoSolido). Si también le damos
    // checkCollisions, Babylon y el corrector pelean por la misma posición y el
    // elipsoide vuelve a quedarse atrapado dentro de la laja de la mesa.
    if (nombre.includes("desk") || nombre.includes("chair") || nombre.includes("lecturn")) {
      mesh.checkCollisions = false;

      mesh.computeWorldMatrix(true);
      mesh.refreshBoundingInfo(false, false);
      const bb = mesh.getBoundingInfo().boundingBox;
      obstaculosSolidos.push({
        nombre: mesh.name,
        min: bb.minimumWorld.clone(),
        max: bb.maximumWorld.clone(),
      });
      return;
    }

    // Estructura del salón: se deja al motor de colisiones (muros + suelo + room).
    const esEstructura =
      nombre.includes("room") ||
      nombre.includes("wall") ||
      nombre.includes("pared") ||
      nombre.includes("piso") ||
      nombre.includes("floor") ||
      nombre.includes("shelf") ||
      nombre.includes("bookcase") ||
      nombre.includes("estante") ||
      nombre.includes("libreria");

    mesh.checkCollisions = esEstructura;
  });

  console.log(
    `Obstáculos sólidos -> ${obstaculosSolidos.length}: ` +
      obstaculosSolidos.map((o) => o.nombre).join(", ")
  );

  // ---------------------------------------------------------------
  // LÍMITES DEL SALÓN (colisión con los "empty")
  // Un empty no es una malla, así que no se le puede poner checkCollisions.
  // Se levantan 4 muros invisibles cuya cara interna cae sobre la pared INTERNA del
  // aula (medida con rayos, ver medirInteriorDelSalon) y crecen hacia fuera: solo
  // sirven para contener. Con el AABB crudo de "room" sobraban 10 unidades detrás del
  // tablero y 11 en el pasillo, y por ahí se colaban la cámara y el modelo.
  // ---------------------------------------------------------------
  // El techo sube ANTES de medir: así el AABB y los muros invisibles ya salen con
  // la altura nueva y no hay que rehacer la medición.
  subirElTechoDeLaSala(scene);

  limitesSalon = null;
  const meshRoom = todasLasMallas.find((m) => m.name.toLowerCase().includes("room"));

  if (meshRoom) {
    meshRoom.computeWorldMatrix(true);
    meshRoom.refreshBoundingInfo(false, false);

    const bb = meshRoom.getBoundingInfo().boundingBox;
    const min = bb.minimumWorld.clone();
    const max = bb.maximumWorld.clone();

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
      // La posición cambia después de crear la caja: hay que refrescar la matriz de
      // mundo y el AABB o el rechazo rápido de colisión seguiría con la caja en el origen.
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
      `AABB del mesh "room" (demasiado grande) -> x[${bb.minimumWorld.x.toFixed(2)}, ${bb.maximumWorld.x.toFixed(2)}] ` +
        `z[${bb.minimumWorld.z.toFixed(2)}, ${bb.maximumWorld.z.toFixed(2)}]`
    );
    console.log(
      `Límites del salón${interior ? " (pared interior medida con rayos)" : " (sin medida: AABB de room)"} -> ` +
        `x[${min.x.toFixed(2)}, ${max.x.toFixed(2)}] ` +
        `y[${min.y.toFixed(2)}, ${max.y.toFixed(2)}] z[${min.z.toFixed(2)}, ${max.z.toFixed(2)}]`
    );
  } else {
    console.warn("No se encontró el mesh 'room': el salón queda sin muros de contención.");
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

    // El empty "tablero_01" MARCA el área del tablero (así lo puso el modelo): su
    // escala es la MEDIA-distancia del recuadro que Blender dibuja, así que el
    // tablero mide 2 × escala. Con el .glb actual eso da 21.61 de ancho (z) ×
    // 7.40 de alto (y), centrado en y 5.70 (content y[2.00, 9.41]). Ojo: la
    // pizarra física YA NO EXISTE en el .glb (se borró en la exportación del
    // 30/09), así que el contenido va directo sobre la pared, cuya cara interna
    // está en x -21.374; el plano queda en x -21.130, o sea 0.24 por delante,
    // que es lo que evita el z-fighting.
    // El plano se construye 2×2 en local y, como hereda la escala del empty,
    // acaba exactamente en esas medidas: si agrandas el empty en Blender, el
    // área del tablero crece sola sin tocar código.
    //
    // EL EMPTY TAMBIÉN SE HACE MÁS GRANDE AL SUBIR EL TECHO. El hueco del tablero
    // está en la pared y la pared se deforma con mapearAltura() (intacta hasta
    // y=8.28 y estirada por encima), así que el área del empty tiene que llevarse
    // con la MISMA función: si no, el tablero queda más alto que las diapositivas
    // (la pared crece y el contenido se queda donde estaba). El plano es 2×2 y está
    // centrado en el origen del empty, así que bastan dos condiciones —canto
    // inferior y canto superior— para fijar media-altura (scaling.y) y centro
    // (position.y). x y z no se tocan: la pared solo crece hacia arriba.
    const matrizTablero = nodoTablero.getWorldMatrix();
    const centroY = BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.Zero(), matrizTablero).y;
    const arribaY = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(0, 1, 0), matrizTablero).y;
    const media = arribaY - centroY;
    if (Math.abs(media) > 1e-6) {
      const bajo = centroY - media;
      const alto = centroY + media;
      const nuevoBajo = mapearAltura(bajo);
      const nuevoAlto = mapearAltura(alto);
      const factor = (nuevoAlto - nuevoBajo) / (alto - bajo);
      nodoTablero.scaling.y *= factor;
      nodoTablero.position.y += (nuevoAlto + nuevoBajo - (alto + bajo)) / 2;
      console.log(
        `Tablero: el empty "tablero_01" sigue el mismo mapa que la pared: área ` +
          `y[${bajo.toFixed(2)}, ${alto.toFixed(2)}] -> [${nuevoBajo.toFixed(2)}, ` +
          `${nuevoAlto.toFixed(2)}] (escala y ×${factor.toFixed(3)})`
      );
    }

    const anchoLocal = 2;
    const altoLocal = 2;

    pantallaTablero = BABYLON.MeshBuilder.CreatePlane("PantallaProyeccion", { width: anchoLocal, height: altoLocal }, scene);
    pantallaTablero.material = materialPantalla;
    pantallaTablero.parent = nodoTablero;
    // -90° en Y: la cara del plano mira hacia el aula (-X); el ancho cae sobre
    // el eje Z del empty y el alto sobre su Y.
    pantallaTablero.rotation = new BABYLON.Vector3(0, -Math.PI / 2, 0);
    pantallaTablero.position = new BABYLON.Vector3(0.02, 0, 0);
    pantallaTablero.isVisible = false;
    pantallaTablero.computeWorldMatrix(true);
    pantallaTablero.refreshBoundingInfo(false, false);
  } else {
    pantallaTablero = BABYLON.MeshBuilder.CreatePlane("PantallaProyeccion", { width: 3.6, height: 1.8 }, scene);
    pantallaTablero.material = materialPantalla;
    pantallaTablero.position = new BABYLON.Vector3(20.91, 5.74, -1.09);
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

    const nodoSit = mapaSits.get(num);
    let posSitFinal: BABYLON.Vector3;
    let rotYFinal = 0;

    if (nodoSit) {
      nodoSit.computeWorldMatrix(true);
      posSitFinal = nodoSit.absolutePosition.clone();
      rotYFinal = nodoSit.rotationQuaternion ? nodoSit.rotationQuaternion.toEulerAngles().y : nodoSit.rotation.y;
    } else {
      posSitFinal = posSilla.clone();
      posSitFinal.y += 2.2;
    }

    paresSillas.push({
      numero: num,
      posicionMundoSilla: posSilla,
      puntoSit: { posicion: posSitFinal, rotacionY: rotYFinal },
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
      // Nota: puntoEnsenar hoy no se lee en ninguna parte (la cámara del atril
      // se arma en funcionalidades con detrasDelAtril + alturaOjoProfesor).
      posEnsenar.y += ALTURA_OJO_PROFESOR; 
      rotEnsenar = nodoTeach.rotationQuaternion ? nodoTeach.rotationQuaternion.toEulerAngles().y : nodoTeach.rotation.y;
    } else {
      posEnsenar = posAtril.clone();
      posEnsenar.y += 2.5; 
      posEnsenar.z -= 0.5;
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

// El tablero de ESTA partida (src/3d/tableroFuncionalidad.ts). Aquí solo se crea,
// se le pasa el volumen y se le llama la API: la lógica del proyector no vive ya
// en este archivo, que es el del mapa y del personaje.
let tablero: Tablero | null = null;

// Volumen general (0..1). Vive aquí porque lo aplican a la vez el menú de ajustes
// y el botón 🔊 de la barra; se persiste en el navegador desde src/ui/menuAjustes.ts.
let volumenGeneral = leerVolumen();
let volumenAntesDeSilenciar: number | null = null;

// Funciones de limpieza de la partida en curso. Se ejecutan al salir para que,
// al volver a entrar, no se registren los mismos listeners otra vez.
const limpiadoresDePartida: Array<() => void> = [];

// Código de la clase en la que se está jugando ahora mismo. Lo necesita el
// módulo de presencia (para meterse en la sala "clase:CODIGO") y la píldora de
// conectados, que lo enseña arriba a la izquierda.
let claseActiva = "";

/**
 * VOLUMEN DE LA APP: manda sobre todo lo que suena DENTRO del metaverso — el vídeo
 * del tablero, YouTube, la pantalla compartida y, cuando llegue el chat por
 * proximidad, las voces (entran por el audio global de Babylon).
 *
 * No toca el volumen del portátil: el slider multiplica con el del sistema
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

const createScene = async function (): Promise<BABYLON.Scene> {
  const scene = new BABYLON.Scene(engine);
  scene.gravity = new BABYLON.Vector3(0, -0.15, 0);
  scene.collisionsEnabled = true;
  scene.clearColor = new BABYLON.Color4(0.75, 0.85, 0.95, 1);

  // 1. CARGAR EL PERSONAJE 3D (la skin la eligió el usuario en la mini-ventana
  //    al pulsar "Entrar": rol + género guardados en localStorage).
  let personaje: Personaje | null = null;
  try {
    personaje = await cargarPersonaje(scene, obtenerSesion()?.rol ?? "estudiante");
    personaje.raiz.position = new BABYLON.Vector3(0, SUELO_Y, -8);

    // CUERPO DE COLISIÓN DEL PERSONAJE (lo que lleva moveWithCollisions).
    // No usa la geometría del modelo, usa este elipsoide:
    //   radio (0.55, 2.3, 0.55) + offset (0, 2.6, 0)  =>  ocupa de SUELO_Y+0.30
    //   (= −0.489) a SUELO_Y+4.90 (= 4.111): casi el cuerpo entero de 1.76 m,
    //   y con 0.30 de holgura bajo el pie para no engancharse en lajas ni cantos.
    // Choca con room (-0.81..10.32) y con los muros invisibles "limite*".
    // Mesas, sillas y atril NO pasan por aquí: los resuelve empujarFueraDeObstaculos()
    // porque el motor de colisiones se atasca dentro de las lajas finas (ver ObstaculoSolido).
    personaje.raiz.ellipsoid = new BABYLON.Vector3(0.55, 2.3, 0.55);
    personaje.raiz.ellipsoidOffset = new BABYLON.Vector3(0, 2.6, 0);
  } catch (error) {
    console.error("Error al cargar el personaje:", error);
  }

  // 2. CONFIGURAR LA CÁMARA
  const camara = new BABYLON.UniversalCamera("camara", new BABYLON.Vector3(0, ALTURA_ADULTO_PIE, -8), scene);
  camara.attachControl(canvas, true);
  camara.speed = 0.35;
  camara.angularSensibility = 5000;

  camara.keysUp = [];
  camara.keysDown = [];
  camara.keysLeft = [];
  camara.keysRight = [];

  const radioVertical = ALTURA_ADULTO_PIE / 2;
  camara.ellipsoid = new BABYLON.Vector3(0.5, radioVertical, 0.5);
  camara.ellipsoidOffset = new BABYLON.Vector3(0, radioVertical, 0);
  // La cámara NO colisiona por su cuenta: su posición se copia 1:1 desde el modelo 3D
  // en cada frame, así que su colisión y su gravedad solo la desalinearían (y cobrarían
  // un barrido de colisiones completo por frame sin motivo). El encierro lo resuelven los
  // muros "limite*" + recortarAlSalon().
  camara.checkCollisions = false;
  camara.applyGravity = false;
  camara.minZ = 0.1;

  const luz = new BABYLON.HemisphericLight("luz", new BABYLON.Vector3(0, 1, 0), scene);
  luz.intensity = 0.9;

  await cargarSalon(scene);

  // TABLERO. El mapa solo aporta la malla y el material que ya midió en su .glb
  // (el empty "tablero_01"); pdf.js, el vídeo, YouTube y la captura de pantalla
  // los trae el módulo. Un mapa nuevo no tiene que reescribir nada de esto.
  if (pantallaTablero && materialPantalla) {
    tablero = crearTablero({
      pantalla: pantallaTablero,
      material: materialPantalla,
      scene,
      volumen: () => volumenGeneral,
    });
  } else {
    console.warn("Sin malla de tablero en este mapa: no habrá proyección.");
  }

  const sueloColision = BABYLON.MeshBuilder.CreateGround("sueloColision", { width: 100, height: 100 }, scene);
  sueloColision.position = new BABYLON.Vector3(0, SUELO_Y, 0);
  sueloColision.checkCollisions = true;
  sueloColision.isVisible = false;

  // ---------------------------------------------------------------
  // FUNCIONALIDADES DEL AVATAR → src/3d/funcionalidades.ts
  // Caminar, sentarse, presentar en el atril, cámara 1ª/3ª persona y
  // mano alzada viven en un módulo aparte: aquí solo se guarda la
  // referencia y se consulta su estado. Se monta más abajo, cuando el
  // salón ya cargó sus sillas, su atril y sus obstáculos.
  // ---------------------------------------------------------------
  let func: Funcionalidades;

  // -----------------------------------------------------------------------
  // CLIC EN EL TABLERO DESDE LEJOS → se abre la pantalla en grande para el que
  // clica (igual que en framevr.io): el contenido del proyector se ve a pantalla
  // completa aquí, sin tener que caminar hasta el atril.
  // Se registra DESPUÉS de declarar `func` porque el handler lo lee y la
  // función es asíncrona (un clic durante la carga no tendría esa referencia lista).
  // -----------------------------------------------------------------------
  function clicSobreElTablero(evento: MouseEvent): boolean {
    if (!tablero || !pantallaTablero || func.enElAtril()) return false;
    if (tablero.pantallaCompletaAbierta() || !tablero.hayContenido()) return false;

    const lienzo = scene.getEngine().getRenderingCanvas();
    if (!lienzo) return false;

    // Con el puntero bloqueado no hay cursor que seguir: se apunta al centro de la
    // pantalla, que es exactamente donde está la mirada del jugador.
    const bloqueado = document.pointerLockElement === lienzo;
    const rect = lienzo.getBoundingClientRect();
    const x = bloqueado ? lienzo.clientWidth / 2 : evento.clientX - rect.left;
    const y = bloqueado ? lienzo.clientHeight / 2 : evento.clientY - rect.top;

    const golpe = scene.pick(x, y);
    if (!golpe?.hit || !golpe.pickedPoint) return false;

    // La pizarra es un plano finísimo clavado en la pared: comparar contra su AABB
    // tal cual no daría con la cara de la pizarra real del .glb, así que se ensancha
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
  // (si no, al volver a entrar se duplicarían los listeners).
  const alHacerClickEnCanvas = (evento: MouseEvent) => {
    // Mientras se escribe en la pizarra el ratón NO se bloquea: si no, el trazo
    // se cortaría en cuanto se cliqu fuera del lienzo.
    if (tablero?.dibujoAbierto()) return;
    if (clicSobreElTablero(evento)) return;
    canvas.requestPointerLock();
  };
  canvas.addEventListener("click", alHacerClickEnCanvas);
  limpiadoresDePartida.push(() => canvas.removeEventListener("click", alHacerClickEnCanvas));

  // UI de ESTA partida (archivos aparte en src/ui/): se guardan aquí para que
  // tanto el teclado como el bucle de render manden lo mismo a los botones.
  let barra: BarraUsuario | null = null;
  let menuAjustes: MenuAjustes | null = null;
  let camaraWeb: CamaraWeb | null = null;

  // -----------------------------------------------------------------------
  // FUNCIONALIDADES → src/3d/funcionalidades.ts
  // Caminar (WASD + colisiones), sentarse (E), presentar en el atril (R),
  // cámara 1ª/3ª persona (B) y mano alzada (H) viven en un módulo aparte:
  // aquí solo se le entrega el mundo de ESTE mapa (escena, sillas, atril,
  // obstáculos y sus reglas de colisión) y se cablea una sola vez. Un mapa
  // nuevo repite estas líneas y reutiliza todo sin reescribirlo.
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
    aviso,
    avisoMano,
    limpiadores: limpiadoresDePartida,
    radioPersonaje: RADIO_PERSONAJE,
    alturaOjoProfesor: ALTURA_OJO_PROFESOR,
    alCambiarEstado: () => reflejarBarra(),
    alActualizarTablero: (silueta) => tablero?.actualizar(silueta),
    alSalirDelAtril: () => tablero?.cerrarMenu(),
  });

  // -----------------------------------------------------------------------
  // ESTADO → BARRA. El estado del avatar (sentado, tercera persona, mano…)
  // lo tiene funcionalidades.ts; aquí solo se pinta en la barra de usuario.
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
  // PRESENCIA: LOS DEMÁS MIEMBROS DE LA CLASE
  // (src/3d/avataresRemotos.ts dibuja y mueve los cuerpos; src/red/presencia.ts
  // habla con el servidor y filtra qué se envía). Aquí solo se le pasa el estado
  // del avatar local y se pinta lo que llega en la píldora de conectados.
  // -----------------------------------------------------------------------
  let listado: ListadoConectados | null = null;
  let remotos: AvataresRemotos | null = null;

  /**
   * Lo que se publica de MI avatar: dónde estoy y qué estoy haciendo.
   * El rumbo se toma de la cámara, que es la que mira a dónde andas (la cámara
   * va pegada al cuerpo en 3ª persona y por encima de los ojos en 1ª).
   */
  function estadoLocal(): EstadoLocal {
    const pos = personaje?.raiz.position ?? new BABYLON.Vector3(0, SUELO_Y, -8);
    const estado = func.estado();
    return {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      yaw: camara.rotation.y,
      sentado: estado.sentado,
      enAtril: func.enElAtril(),
      manoAlzada: estado.manoAlzada,
    };
  }

  // La píldora se crea antes que la presencia: así, el primer mensaje del
  // servidor (que puede llegar en el mismo frame) ya tiene dónde pintarse.
  listado = crearListadoConectados(claseActiva);

  remotos = crearAvataresRemotos({
    escena: scene,
    clase: claseActiva,
    sueloY: SUELO_Y,
    personaje: () => personaje,
    estadoLocal,
    alCambiarParticipantes: (participantes: Participante[], miId: string | null) => {
      listado?.reflejar(participantes, miId);
    },
    alCambiarConexion: (estado, detalle) => {
      listado?.reflejarConexion(estado, detalle);
      // La lista puede llegar antes que la confirmación de entrada, así que el
      // "(tú)" no siempre sale en la primera pintada: al conectar se repinta.
      if (estado === "conectado") {
        listado?.reflejar(remotos?.participantes() ?? [], remotos?.miId() ?? null);
      }
    },
    alRechazar: (motivo) => {
      listado?.avisar(motivo);
      barra?.mostrarGlobo(motivo);
    },
    limpiadores: limpiadoresDePartida,
  });

  // -----------------------------------------------------------------------
  // SALIR DE LA CLASE / PARTIDA → vuelve al panel con el que iniciaste sesión
  // -----------------------------------------------------------------------
  function salirDeLaPartida(): void {
    engine.stopRenderLoop();

    menuAjustes?.destruir();
    barra?.destruir();
    // La webcam también: si no, el piloto de la cámara seguiría encendido.
    camaraWeb?.destruir();
    listado?.destruir();
    // Retira también el menú del tablero y, sobre todo, PARA la captura de
    // pantalla: si no, el navegador seguiría grabando tras salir de la clase.
    tablero?.destruir();
    menuAjustes = null;
    barra = null;
    tablero = null;
    camaraWeb = null;
    listado = null;
    remotos = null;

    // Mano alzada, su temporizador y los avisos: los limpia el módulo de
    // funcionalidades, el mismo que los cableó al entrar en la clase.
    func.destruir();

    // Sin esto, al volver a entrar se registrarían listeners encima de otros.
    for (const limpiar of limpiadoresDePartida.splice(0)) limpiar();

    liberarMicrofono();
    if (document.pointerLockElement) document.exitPointerLock();

    // La clase se borra de la dirección: si no, al volver al panel y pulsar
    // otra vez en la misma clase, entraría por el enlace viejo en vez de por
    // el botón. El enlace se vuelve a escribir al entrar (ver entrarAlSalon).
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
        if (estado === "encendido") barra?.mostrarGlobo("Micrófono encendido");
        else if (estado === "apagado") barra?.mostrarGlobo("Micrófono apagado");
        else if (estado === "sin-permiso") barra?.mostrarGlobo("Sin permiso de micrófono");
        else barra?.mostrarGlobo("Micrófono no disponible");
      });
      return;
    }

    // Etapa del chat por proximidad: aquí se reenvía `detalle` al resto de la
    // partida. De momento solo lo ve el propio jugador (lo pinta la barra).
    if (accion === "emote") {
      console.log("Emote:", detalle);
      // 👋 además de pintarse en la barra, mueve el brazo del personaje 3.5 s.
      if (detalle === "👋") func.saludar();
    }
  }

  // -----------------------------------------------------------------------
  // TECLADO
  // -----------------------------------------------------------------------
  const manejarTeclado = (evento: KeyboardEvent): void => {
    const tecla = evento.key.toLowerCase();

    if (tecla === "b") func.alternarCamara();
    if (tecla === "r") func.alternarAtril();
    if (tecla === "e") func.alternarSentado();
    if (tecla === "h") func.alternarMano();

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
        // Esc también libera el puntero: es la única forma de volver a poder
        // clicar los botones de la barra y el engranaje de ajustes.
        menuAjustes?.alternar();
      }
    }

    if (evento.key === "ArrowRight") tablero?.cambiarDiapositiva(1);
    if (evento.key === "ArrowLeft") tablero?.cambiarDiapositiva(-1);

    if (func.enElAtril() && evento.key === " ") {
      evento.preventDefault();
      tablero?.alternarPausa();
    }

    if (func.enElAtril() && (evento.key === "Delete" || evento.key === "Backspace")) {
      tablero?.limpiar();
    }
  };

  window.addEventListener("keydown", manejarTeclado);
  limpiadoresDePartida.push(() => window.removeEventListener("keydown", manejarTeclado));

  // -----------------------------------------------------------------------
  // UI MODULAR (src/ui/): menú de ajustes ⚙️ y barra de usuario.
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

  // Se crea ANTES de la barra: reflejarBarra() se ejecuta nada más montarla y
  // necesita saber si la webcam está encendida.
  camaraWeb = crearCamaraWeb(() => reflejarBarra());

  barra = crearBarraUsuario({ alPulsar: manejarAccionBarra });
  reflejarBarra();

  // Hook de depuración: en la consola del navegador (F12) puedes inspeccionar
  // la escena con __metaverso.camara / __metaverso.personaje
  (window as unknown as Record<string, unknown>).__metaverso = { camara, personaje, escena: scene };

  return scene;
};

function entrarAlSalon(clase: Clase) {
  claseActiva = clase.codigo;
  // La dirección pasa a ser la de esta clase: es lo que permite copiar el
  // enlace del navegador y pasárselo a otro para que entre a la MISMA.
  escribirClaseEnLaUrl(clase.codigo);

  const alRedimensionar = () => engine.resize();
  window.addEventListener("resize", alRedimensionar);
  limpiadoresDePartida.push(() => window.removeEventListener("resize", alRedimensionar));

  createScene()
    .then((scene) => {
      engine.runRenderLoop(() => scene.render());
    })
    .catch((error) => {
      console.error("ERROR AL CREAR LA ESCENA:", error);
      alert("Ocurrió un error cargando el salón. Revisa la consola (F12).");
    });
}

// -----------------------------------------------------------------------
// ENTRAR POR ENLACE  →  http://localhost:5173/?clase=FIS-101
// -----------------------------------------------------------------------
// Si la dirección trae el código de una clase, se entra directamente en ella
// en lugar de mostrar el panel. Se pregunta a la API de qué clase se trata (el
// código solo no dice ni la materia ni el docente) y se entra. Devuelve false
// si no había enlace o la clase ya no existe, para que el llamante abra el
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
    aviso.textContent = `La clase ${codigo} no existe o el servidor no está disponible.`;
    aviso.style.display = "block";
    window.setTimeout(() => {
      aviso.style.display = "none";
    }, 4000);
    // Se quita el enlace de la dirección para no repetir el error al recargar.
    escribirClaseEnLaUrl(null);
    return false;
  }

  entrarAlSalon(clase);
  return true;
}

// Si no hay sesión se pide el login primero, y solo después se mira el enlace:
// así un enlace recibido por WhatsApp funciona aunque no se esté conectado.
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