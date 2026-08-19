import "../assets/style.css";
import * as BABYLON from "babylonjs";
import "babylonjs-loaders";
import { iniciarLogin } from "../page/login/login";
import { mostrarDashboard } from "../page/dashboard/dashboard";
import { obtenerSesion } from "../state/estado";
import type { Clase } from "../state/estado";





const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = new BABYLON.Engine(canvas, true);

// ---- UI de proximidad ----
const aviso = document.createElement("div");
aviso.style.position = "absolute";
aviso.style.bottom = "15%";
aviso.style.left = "50%";
aviso.style.transform = "translateX(-50%)";
aviso.style.color = "white";
aviso.style.fontFamily = "sans-serif";
aviso.style.fontSize = "18px";
aviso.style.background = "rgba(0,0,0,0.6)";
aviso.style.padding = "8px 16px";
aviso.style.borderRadius = "8px";
aviso.style.display = "none";
aviso.innerText = "Presiona E para sentarte";
document.body.appendChild(aviso);

// ---- Carga un modelo .glb, lo recentra en su pivote real, y lo posiciona ----
// (la colisión detallada queda DESACTIVADA aquí a propósito, ver crearColisionSimple)
async function cargarModelo(
  archivo: string,
  posicionMundo: BABYLON.Vector3,
  rotacionY: number,
  escala: number,
  scene: BABYLON.Scene
): Promise<BABYLON.TransformNode> {
  const resultado = await BABYLON.SceneLoader.ImportMeshAsync("", "/models/", archivo, scene);
  const raiz = resultado.meshes[0];

  let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
  let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
  resultado.meshes.forEach((malla) => {
    const caja = malla.getBoundingInfo()?.boundingBox;
    if (!caja) return;
    min = BABYLON.Vector3.Minimize(min, caja.minimumWorld);
    max = BABYLON.Vector3.Maximize(max, caja.maximumWorld);
  });
  const centro = BABYLON.Vector3.Center(min, max);

  raiz.position.x -= centro.x;
  raiz.position.z -= centro.z;

  const contenedor = new BABYLON.TransformNode("contenedor_" + archivo, scene);
  contenedor.position = posicionMundo;
  contenedor.rotation.y = rotacionY;
  raiz.parent = contenedor;
  raiz.scaling = new BABYLON.Vector3(escala, escala, escala);

  // IMPORTANTE: apagamos la colisión del modelo detallado (causaba que te quedaras pegado)
  resultado.meshes.forEach((malla) => (malla.checkCollisions = false));

  return contenedor;
}

// ---- Crea una caja INVISIBLE simple, solo para colisiones limpias (sin enganches) ----
function crearColisionSimple(
  posicionMundo: BABYLON.Vector3,
  rotacionY: number,
  ancho: number,
  alto: number,
  grosor: number,
  scene: BABYLON.Scene
): void {
  const caja = BABYLON.MeshBuilder.CreateBox("colision", { width: ancho, height: alto, depth: grosor }, scene);
  caja.position = new BABYLON.Vector3(posicionMundo.x, alto / 2, posicionMundo.z);
  caja.rotation.y = rotacionY;
  caja.checkCollisions = true;
  caja.isVisible = false;
}

// ---- Mide el ancho Y la altura real de un modelo (para escalarlo correctamente) ----
async function medirDimensiones(
  archivo: string,
  scene: BABYLON.Scene
): Promise<{ ancho: number; alto: number }> {
  const resultado = await BABYLON.SceneLoader.ImportMeshAsync("", "/models/", archivo, scene);
  let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
  let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

  resultado.meshes.forEach((malla) => {
    const caja = malla.getBoundingInfo()?.boundingBox;
    if (!caja) return;
    min = BABYLON.Vector3.Minimize(min, caja.minimumWorld);
    max = BABYLON.Vector3.Maximize(max, caja.maximumWorld);
  });

  const ancho = max.x - min.x;
  const alto = max.y - min.y;
  resultado.meshes.forEach((malla) => malla.dispose()); // era solo una copia de prueba para medir

  return {
    ancho: ancho > 0 ? ancho : 2,
    alto: alto > 0 ? alto : 3,
  };
}

const createScene = async function (): Promise<BABYLON.Scene> {
  const scene = new BABYLON.Scene(engine);
  scene.gravity = new BABYLON.Vector3(0, -0.9, 0);
  scene.collisionsEnabled = true;
  scene.clearColor = new BABYLON.Color4(0.75, 0.85, 0.95, 1);

  // ---- CÁMARA ----
  const camara = new BABYLON.UniversalCamera("camara", new BABYLON.Vector3(0, 1.6, -9), scene);
  camara.attachControl(canvas, true);
  camara.speed = 0.25;
  camara.angularSensibility = 5500;
  camara.keysUp.push(87);
  camara.keysDown.push(83);
  camara.keysLeft.push(65);
  camara.keysRight.push(68);
  camara.ellipsoid = new BABYLON.Vector3(0.5, 0.9, 0.5);
  camara.checkCollisions = true;
  camara.applyGravity = true;
  camara.minZ = 0.1;

  canvas.addEventListener("click", () => canvas.requestPointerLock());

  // ---- LUZ ----
  const luz = new BABYLON.HemisphericLight("luz", new BABYLON.Vector3(0, 1, 0), scene);
  luz.intensity = 0.9;

  // ============================================
  // TAMAÑO DEL SALÓN (escalado a una altura realista de pared)
  // ============================================
  const ALTURA_PARED_DESEADA = 3; // metros — altura típica de un salón
  const { ancho: anchoOriginalPared, alto: altoOriginalPared } = await medirDimensiones("pared.glb", scene);
  const ESCALA_PARED = ALTURA_PARED_DESEADA / altoOriginalPared;
  const TAMANO_PARED = anchoOriginalPared * ESCALA_PARED; // ancho YA escalado, para que las piezas encajen

  const PIEZAS_FRENTE = 10; // ancho del salón (tamaño grande, como lo teníamos)
  const PIEZAS_LADO = 10; // profundidad del salón

  const ANCHO = PIEZAS_FRENTE * TAMANO_PARED;
  const PROFUNDO = PIEZAS_LADO * TAMANO_PARED;

  // Ahora que ya sabemos el tamaño real del salón, ponemos al jugador bien adentro
  camara.position = new BABYLON.Vector3(0, 1.6, -(PROFUNDO / 2 - 1));

  // ---- SUELO ----
  const suelo = BABYLON.MeshBuilder.CreateGround("suelo", { width: ANCHO, height: PROFUNDO }, scene);
  const matSuelo = new BABYLON.StandardMaterial("matSuelo", scene);
  matSuelo.diffuseColor = new BABYLON.Color3(0.55, 0.55, 0.58);
  suelo.material = matSuelo;
  suelo.checkCollisions = true;

  // ---- PAREDES MODULARES (visual con el modelo real + colisión con caja simple) ----
  const GROSOR_COLISION = 0.3;

  // Fondo (donde va el tablero)
  for (let i = 0; i < PIEZAS_FRENTE; i++) {
    const x = -ANCHO / 2 + TAMANO_PARED / 2 + i * TAMANO_PARED;
    const pos = new BABYLON.Vector3(x, 0, PROFUNDO / 2);
    await cargarModelo("pared.glb", pos, Math.PI, ESCALA_PARED, scene);
    crearColisionSimple(pos, Math.PI, TAMANO_PARED, ALTURA_PARED_DESEADA, GROSOR_COLISION, scene);
  }

  // Frente
  for (let i = 0; i < PIEZAS_FRENTE; i++) {
    const x = -ANCHO / 2 + TAMANO_PARED / 2 + i * TAMANO_PARED;
    const pos = new BABYLON.Vector3(x, 0, -PROFUNDO / 2);
    await cargarModelo("pared.glb", pos, 0, ESCALA_PARED, scene);
    crearColisionSimple(pos, 0, TAMANO_PARED, ALTURA_PARED_DESEADA, GROSOR_COLISION, scene);
  }

  // Izquierda — con puerta en la pieza del medio (SIN caja de colisión ahí, para poder cruzar)
  const piezaPuerta = Math.floor(PIEZAS_LADO / 2);
  for (let i = 0; i < PIEZAS_LADO; i++) {
    const z = -PROFUNDO / 2 + TAMANO_PARED / 2 + i * TAMANO_PARED;
    const esPuerta = i === piezaPuerta;
    const archivo = esPuerta ? "pared_puerta.glb" : "pared.glb";
    const pos = new BABYLON.Vector3(-ANCHO / 2, 0, z);
    await cargarModelo(archivo, pos, Math.PI / 2, ESCALA_PARED, scene);
    if (!esPuerta) {
      crearColisionSimple(pos, Math.PI / 2, TAMANO_PARED, ALTURA_PARED_DESEADA, GROSOR_COLISION, scene);
    }
  }

  // Derecha — con ventanas en las 2 piezas del medio (SÍ llevan colisión, no son atravesables)
  const piezaVentana1 = Math.floor(PIEZAS_LADO / 2) - 1;
  const piezaVentana2 = Math.floor(PIEZAS_LADO / 2);
  for (let i = 0; i < PIEZAS_LADO; i++) {
    const z = -PROFUNDO / 2 + TAMANO_PARED / 2 + i * TAMANO_PARED;
    const esVentana = i === piezaVentana1 || i === piezaVentana2;
    const archivo = esVentana ? "pared_ventana.glb" : "pared.glb";
    const pos = new BABYLON.Vector3(ANCHO / 2, 0, z);
    await cargarModelo(archivo, pos, -Math.PI / 2, ESCALA_PARED, scene);
    crearColisionSimple(pos, -Math.PI / 2, TAMANO_PARED, ALTURA_PARED_DESEADA, GROSOR_COLISION, scene);
  }

  // ---- TABLERO ----
  const tablero = BABYLON.MeshBuilder.CreatePlane("tablero", { width: 6, height: 2.5 }, scene);
  tablero.position = new BABYLON.Vector3(0, 2.2, PROFUNDO / 2 - 0.15);
  tablero.rotation.y = Math.PI;
  const matTablero = new BABYLON.StandardMaterial("matTablero", scene);
  matTablero.diffuseColor = new BABYLON.Color3(0.08, 0.28, 0.15);
  tablero.material = matTablero;

  // ---- SILLAS (sin colisión detallada, para que no te enganches al pasar cerca) ----
  const ESCALA_SILLA = ESCALA_PARED * 1; // proporcional al tamaño real del salón, un poco más grande

  interface Silla {
    posicion: BABYLON.Vector3;
    posicionSentado: BABYLON.Vector3;
    rotacionSentado: number;
  }
  const sillas: Silla[] = [];

  const filas = 3;
  const columnas = 5;
  const espacioX = 3;
  const espacioZ = 2.8;
  const inicioX = -((columnas - 1) * espacioX) / 2;
  const inicioZ = 0;

  for (let fila = 0; fila < filas; fila++) {
    for (let col = 0; col < columnas; col++) {
      const x = inicioX + col * espacioX;
      const z = inicioZ + fila * espacioZ;

      await cargarModelo("silla.glb", new BABYLON.Vector3(x, 0, z), Math.PI, ESCALA_SILLA, scene);

      sillas.push({
        posicion: new BABYLON.Vector3(x, 0.5, z),
        posicionSentado: new BABYLON.Vector3(x, 1.05, z + 0.1),
        rotacionSentado: Math.PI,
      });
    }
  }

  // ---- PROXIMIDAD + SENTARSE ----
  let sentado = false;
  let sillaCercana: Silla | null = null;
  let posicionGuardada: BABYLON.Vector3 | null = null;
  let rotacionGuardada = 0;
  const distanciaMaxima = 1.8;

  scene.onBeforeRenderObservable.add(() => {
    if (sentado) return;
    let masCercana: Silla | null = null;
    let menorDistancia = Infinity;
    for (const silla of sillas) {
      const distancia = BABYLON.Vector3.Distance(camara.position, silla.posicion);
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        masCercana = silla;
      }
    }
    if (masCercana && menorDistancia < distanciaMaxima) {
      sillaCercana = masCercana;
      aviso.style.display = "block";
    } else {
      sillaCercana = null;
      aviso.style.display = "none";
    }
  });

  window.addEventListener("keydown", (evento) => {
    if (evento.key.toLowerCase() !== "e") return;

    if (!sentado && sillaCercana) {
      // Guarda dónde estabas antes de sentarte
      posicionGuardada = camara.position.clone();
      rotacionGuardada = camara.rotation.y;

      camara.position = sillaCercana.posicionSentado.clone();
      camara.rotation.y = sillaCercana.rotacionSentado;

      // Apaga gravedad y colisiones (sentado no necesitas caminar)
      camara.applyGravity = false;
      camara.checkCollisions = false;

      // Congela SOLO el movimiento (WASD). El mouse sigue libre para mirar alrededor.
      camara.keysUp = [];
      camara.keysDown = [];
      camara.keysLeft = [];
      camara.keysRight = [];

      sentado = true;
      aviso.style.display = "none";
    } else if (sentado) {
      camara.position = posicionGuardada ? posicionGuardada.clone() : new BABYLON.Vector3(0, 1.6, -5);
      camara.rotation.y = rotacionGuardada;

      camara.applyGravity = true;
      camara.checkCollisions = true;

      // Reactiva el movimiento con WASD
      camara.keysUp = [87];
      camara.keysDown = [83];
      camara.keysLeft = [65];
      camara.keysRight = [68];

      sentado = false;
    }
  });

  return scene;
};

function entrarAlSalon(clase: Clase) {
  console.log("Entrando a la clase:", clase);
  createScene().then((scene) => {
    engine.runRenderLoop(() => scene.render());
  });
  window.addEventListener("resize", () => engine.resize());
}

const sesionActiva = obtenerSesion();
if (sesionActiva) {
  mostrarDashboard(sesionActiva, entrarAlSalon);
} else {
  iniciarLogin((cuenta) => {
    mostrarDashboard(cuenta, entrarAlSalon);
  });
}