import "../assets/style.css";
import * as BABYLON from "babylonjs";
import "babylonjs-loaders";
import { iniciarLogin } from "../page/login/login";
import { mostrarDashboard } from "../page/dashboard/dashboard";
import { obtenerSesion } from "../state/estado";
import type { Clase } from "../state/estado";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = new BABYLON.Engine(canvas, true);

// ---- UI DE PROXIMIDAD (TECLA E) ----
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
aviso.innerText = "Presiona E para sentarte";
document.body.appendChild(aviso);

// ---- UI NOTIFICACIÓN ALZAR LA MANO (TECLA H) ----
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
avisoMano.innerText = "✋ El usuario ha alzado la mano";
document.body.appendChild(avisoMano);

// ---- Estructura de Asiento ----
interface ParSilla {
  numero: number;
  posicionMundoSilla: BABYLON.Vector3;
  puntoSit: {
    posicion: BABYLON.Vector3;
    rotacionY: number;
  };
}

const paresSillas: ParSilla[] = [];

// ---- Carga del Salón y asignación de colisiones reales ----
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

  const todasLasMallas = resultado.meshes;
  const todosLosNodos = [...resultado.transformNodes, ...resultado.meshes];

  // Configuración de colisiones reales sobre mallas del salón
  todasLasMallas.forEach((mesh) => {
    const nombre = mesh.name.toLowerCase();

    // Activar colisión en Room, paredes, piso, escritorios (desk), plataforma, atril (lecturn) y estantes (shelf)
    if (
      nombre.includes("room") ||
      nombre.includes("wall") ||
      nombre.includes("pared") ||
      nombre.includes("piso") ||
      nombre.includes("floor") ||
      nombre.includes("desk") ||
      nombre.includes("platform") ||
      nombre.includes("lecturn") ||
      nombre.includes("shelf")
    ) {
      mesh.checkCollisions = true;
    } else {
      mesh.checkCollisions = false;
    }
  });

  const mapaSillas = new Map<number, BABYLON.AbstractMesh>();
  const mapaSits = new Map<number, BABYLON.TransformNode | BABYLON.AbstractMesh>();

  const extraerNumero = (str: string): number | null => {
    const match = str.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  };

  todasLasMallas.forEach((mesh) => {
    if (mesh.name.toLowerCase().includes("desk_chair")) {
      const num = extraerNumero(mesh.name);
      if (num !== null) {
        mapaSillas.set(num, mesh);
      }
    }
  });

  todosLosNodos.forEach((nodo) => {
    if (nodo.name.toUpperCase().startsWith("SIT_")) {
      const num = extraerNumero(nodo.name);
      if (num !== null) {
        mapaSits.set(num, nodo);
      }
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
      nodoSit.computeWorldMatrix(true, true);
      posSitFinal = nodoSit.absolutePosition.clone();

      if (nodoSit.rotationQuaternion) {
        rotYFinal = nodoSit.rotationQuaternion.toEulerAngles().y;
      } else {
        rotYFinal = nodoSit.rotation.y;
      }
    } else {
      posSitFinal = posSilla.clone();
      posSitFinal.y += 2.2;
    }

    paresSillas.push({
      numero: num,
      posicionMundoSilla: posSilla,
      puntoSit: {
        posicion: posSitFinal,
        rotacionY: rotYFinal,
      },
    });
  });

  console.log(`✅ Salón cargado con colisiones en estructura y mobiliario.`);
  return salon;
}

const createScene = async function (): Promise<BABYLON.Scene> {
  const scene = new BABYLON.Scene(engine);
  scene.gravity = new BABYLON.Vector3(0, -0.9, 0);
  scene.collisionsEnabled = true;
  scene.clearColor = new BABYLON.Color4(0.75, 0.85, 0.95, 1);

  // ---- CÁMARA (ALTURA DE PIE) ----
  const ALTURA_ADULTO_PIE = 5.5;
  const camara = new BABYLON.UniversalCamera("camara", new BABYLON.Vector3(0, ALTURA_ADULTO_PIE, -8), scene);
  camara.attachControl(canvas, true);
  camara.speed = 0.35;
  camara.angularSensibility = 5000;
  camara.keysUp.push(87);    // W
  camara.keysDown.push(83);  // S
  camara.keysLeft.push(65);  // A
  camara.keysRight.push(68); // D

  camara.ellipsoid = new BABYLON.Vector3(0.6, 2.0, 0.6);
  camara.checkCollisions = true;
  camara.applyGravity = true;
  camara.minZ = 0.1;

  canvas.addEventListener("click", () => canvas.requestPointerLock());

  // ---- LUZ ----
  const luz = new BABYLON.HemisphericLight("luz", new BABYLON.Vector3(0, 1, 0), scene);
  luz.intensity = 0.9;

  // ---- CARGA DEL ESCENARIO BLENDER ----
  await cargarSalon(scene);

  // ---- SUELO INVISIBLE DE COLISIÓN BASE ----
  const sueloColision = BABYLON.MeshBuilder.CreateGround("sueloColision", { width: 100, height: 100 }, scene);
  sueloColision.position = new BABYLON.Vector3(0, 0, 0);
  sueloColision.checkCollisions = true;
  sueloColision.isVisible = false;

  // ---- LÓGICA DE PROXIMIDAD Y ACCIÓN SENTARSE ----
  let sentado = false;
  let parCercano: ParSilla | null = null;
  let posicionGuardada: BABYLON.Vector3 | null = null;
  let rotacionGuardada = 0;
  const distanciaMaximaProximidad = 3.5;

  scene.onBeforeRenderObservable.add(() => {
    if (sentado) return;

    let masCercana: ParSilla | null = null;
    let menorDistancia = Infinity;

    for (const par of paresSillas) {
      const posCamara2D = new BABYLON.Vector3(camara.position.x, 0, camara.position.z);
      const posSilla2D = new BABYLON.Vector3(par.posicionMundoSilla.x, 0, par.posicionMundoSilla.z);
      const distancia = BABYLON.Vector3.Distance(posCamara2D, posSilla2D);

      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        masCercana = par;
      }
    }

    if (masCercana && menorDistancia < distanciaMaximaProximidad) {
      parCercano = masCercana;
      aviso.style.display = "block";
    } else {
      parCercano = null;
      aviso.style.display = "none";
    }
  });

  // ---- CONTROL DE TECLAS (E = SENTARSE, H = ALZAR LA MANO) ----
  let manoAlzada = false;
  let temporizadorMano: number | null = null;

  window.addEventListener("keydown", (evento) => {
    const tecla = evento.key.toLowerCase();

    // Accion con la Tecla E (Sentarse/Levantarse)
    if (tecla === "e") {
      if (!sentado && parCercano) {
        posicionGuardada = camara.position.clone();
        rotacionGuardada = camara.rotation.y;

        camara.position = parCercano.puntoSit.posicion.clone();

        camara.applyGravity = false;
        camara.checkCollisions = false;

        camara.keysUp = [];
        camara.keysDown = [];
        camara.keysLeft = [];
        camara.keysRight = [];

        sentado = true;
        aviso.style.display = "none";
      } else if (sentado) {
        if (posicionGuardada) {
          camara.position = posicionGuardada.clone();
          camara.position.y = ALTURA_ADULTO_PIE;
        } else {
          camara.position = new BABYLON.Vector3(0, ALTURA_ADULTO_PIE, -8);
        }
        camara.rotation.y = rotacionGuardada;

        camara.applyGravity = true;
        camara.checkCollisions = true;

        camara.keysUp = [87];
        camara.keysDown = [83];
        camara.keysLeft = [65];
        camara.keysRight = [68];

        sentado = false;
      }
    }

    // Accion con la Tecla H (Alzar la Mano)
    if (tecla === "h") {
      manoAlzada = !manoAlzada;

      if (manoAlzada) {
        avisoMano.style.display = "block";

        if (temporizadorMano) clearTimeout(temporizadorMano);
        temporizadorMano = window.setTimeout(() => {
          avisoMano.style.display = "none";
          manoAlzada = false;
        }, 4000);
      } else {
        avisoMano.style.display = "none";
        if (temporizadorMano) clearTimeout(temporizadorMano);
      }
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

// ---- CONTROL DE SESIÓN Y NAVEGACIÓN ----
const sesionActiva = obtenerSesion();
if (sesionActiva) {
  mostrarDashboard(sesionActiva, entrarAlSalon);
} else {
  iniciarLogin((cuenta) => {
    mostrarDashboard(cuenta, entrarAlSalon);
  });
}