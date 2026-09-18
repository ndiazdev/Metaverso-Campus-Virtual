import "../assets/style.css";
import * as BABYLON from "babylonjs";
import "babylonjs-loaders";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { iniciarLogin } from "../page/login/login";
import { mostrarDashboard } from "../page/dashboard/dashboard";
import { obtenerSesion } from "../state/estado";
import type { Clase } from "../state/estado";
import { cargarPersonaje, type Personaje } from "./personaje";

// Configuración del worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas")!;
const engine = new BABYLON.Engine(canvas, true);

const ALTURA_OJO_PROFESOR = 1.5;
const ALTURA_ADULTO_PIE = 7.7;

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
avisoMano.innerText = "✋ El usuario ha alzado la mano";
document.body.appendChild(avisoMano);

// UI MENÚ DE PUBLICAR
const menuPublicar = document.createElement("div");
menuPublicar.style.position = "absolute";
menuPublicar.style.top = "50%";
menuPublicar.style.left = "50%";
menuPublicar.style.transform = "translate(-50%, -50%)";
menuPublicar.style.background = "rgba(15, 23, 42, 0.95)";
menuPublicar.style.border = "1px solid rgba(255,255,255,0.15)";
menuPublicar.style.borderRadius = "12px";
menuPublicar.style.padding = "24px";
menuPublicar.style.display = "none";
menuPublicar.style.zIndex = "2000";
menuPublicar.style.fontFamily = "sans-serif";
menuPublicar.style.color = "white";
menuPublicar.style.width = "320px";
menuPublicar.innerHTML = `
  <h3 style="margin:0 0 16px 0; text-align:center;">Publicar en el tablero</h3>
  <button id="btnSubirPdf" style="width:100%; margin-bottom:8px; padding:10px; border:none; border-radius:8px; background:#F2A93B; color:#1a1a1a; font-weight:bold; cursor:pointer;">📄 Diapositivas (PDF)</button>
  <button id="btnSubirImagenes" style="width:100%; margin-bottom:8px; padding:10px; border:none; border-radius:8px; background:#F2A93B; color:#1a1a1a; font-weight:bold; cursor:pointer;">🖼️ Imágenes / Galerías</button>
  <button id="btnSubirVideo" style="width:100%; margin-bottom:8px; padding:10px; border:none; border-radius:8px; background:#F2A93B; color:#1a1a1a; font-weight:bold; cursor:pointer;">🎬 Video desde el computador</button>
  <button id="btnYoutube" style="width:100%; margin-bottom:8px; padding:10px; border:none; border-radius:8px; background:#F2A93B; color:#1a1a1a; font-weight:bold; cursor:pointer;">▶️ Link de YouTube</button>
  <button id="btnLimpiarTablero" style="width:100%; margin-bottom:8px; padding:10px; border:none; border-radius:8px; background:#EF4444; color:#ffffff; font-weight:bold; cursor:pointer;">🗑️ Limpiar Tablero</button>
  <button id="btnCerrarMenu" style="width:100%; padding:8px; border:none; border-radius:8px; background:transparent; color:#9aa8c7; cursor:pointer;">Cancelar (Esc)</button>
`;
document.body.appendChild(menuPublicar);

// INDICADOR CARGANDO
const cartelCargando = document.createElement("div");
cartelCargando.style.position = "absolute";
cartelCargando.style.top = "50%";
cartelCargando.style.left = "50%";
cartelCargando.style.transform = "translate(-50%, -50%)";
cartelCargando.style.background = "rgba(15, 23, 42, 0.9)";
cartelCargando.style.color = "#ffffff";
cartelCargando.style.padding = "20px 30px";
cartelCargando.style.borderRadius = "10px";
cartelCargando.style.fontSize = "18px";
cartelCargando.style.fontWeight = "bold";
cartelCargando.style.display = "none";
cartelCargando.style.zIndex = "3000";
cartelCargando.innerText = "⏳ Procesando diapositivas...";
document.body.appendChild(cartelCargando);

const inputPdf = document.createElement("input");
inputPdf.type = "file";
inputPdf.accept = "application/pdf";
inputPdf.style.display = "none";
document.body.appendChild(inputPdf);

const inputImagenes = document.createElement("input");
inputImagenes.type = "file";
inputImagenes.accept = "image/*";
inputImagenes.multiple = true;
inputImagenes.style.display = "none";
document.body.appendChild(inputImagenes);

const inputVideo = document.createElement("input");
inputVideo.type = "file";
inputVideo.accept = "video/*";
inputVideo.style.display = "none";
document.body.appendChild(inputVideo);

interface ParSilla {
  numero: number;
  posicionMundoSilla: BABYLON.Vector3;
  puntoSit: { posicion: BABYLON.Vector3; rotacionY: number };
}

interface Atril {
  posicionAtril: BABYLON.Vector3;
  puntoEnsenar: { posicion: BABYLON.Vector3; rotacionY: number };
}

const paresSillas: ParSilla[] = [];
let atril: Atril | null = null;

let pantallaTablero: BABYLON.Mesh | null = null;
let materialPantalla: BABYLON.StandardMaterial | null = null;

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
  atril = null;

  const todasLasMallas = resultado.meshes;
  const todosLosNodos = [...resultado.transformNodes, ...resultado.meshes];

  todasLasMallas.forEach((mesh) => {
    const nombre = mesh.name.toLowerCase();
    
    const tieneColision = 
      nombre.includes("room") || 
      nombre.includes("wall") || 
      nombre.includes("pared") || 
      nombre.includes("piso") || 
      nombre.includes("floor") ||
      nombre.includes("desk") || 
      nombre.includes("chair") || 
      nombre.includes("shelf") || 
      nombre.includes("bookcase") || 
      nombre.includes("estante") || 
      nombre.includes("libreria") ||
      nombre.includes("lecturn");

    if (tieneColision) {
      mesh.checkCollisions = true;
    } else {
      mesh.checkCollisions = false;
    }
  });

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
    nodoTablero.computeWorldMatrix(true, true);

    const ancho = 1.89;
    const alto = 1.8;

    pantallaTablero = BABYLON.MeshBuilder.CreatePlane("PantallaProyeccion", { width: ancho, height: alto }, scene);
    pantallaTablero.material = materialPantalla;
    pantallaTablero.parent = nodoTablero;
    pantallaTablero.rotation = new BABYLON.Vector3(0, -Math.PI / 2, 0);
    pantallaTablero.position = new BABYLON.Vector3(0.02, 0, 0);
    pantallaTablero.isVisible = false;
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
      nodoSit.computeWorldMatrix(true, true);
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
      nodoTeach.computeWorldMatrix(true, true);
      posEnsenar = nodoTeach.absolutePosition.clone();
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
// FUNCIONES DE CONTROL DEL TABLERO
// ============================================================

let scenaActual: BABYLON.Scene | null = null;
let diapositivas: string[] = []; 
let indiceDiapositiva = 0;
let videoElementoActual: HTMLVideoElement | null = null;
let iframeYoutube: HTMLIFrameElement | null = null;

async function convertirPdfAImagenes(archivo: File): Promise<string[]> {
  const datosArrayBuffer = await archivo.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: datosArrayBuffer }).promise;
  const imagenes: string[] = [];

  for (let numPagina = 1; numPagina <= pdf.numPages; numPagina++) {
    const pagina = await pdf.getPage(numPagina);
    const viewport = pagina.getViewport({ scale: 2 });
    const canvasDoc = document.createElement("canvas");
    canvasDoc.width = viewport.width;
    canvasDoc.height = viewport.height;
    const contexto = canvasDoc.getContext("2d");

    if (!contexto) continue;

    await pagina.render({
      canvasContext: contexto,
      viewport: viewport,
    } as any).promise;

    const blob: Blob = await new Promise((resolve) =>
      canvasDoc.toBlob((b) => resolve(b!), "image/jpeg", 0.85)
    );
    imagenes.push(URL.createObjectURL(blob));
  }
  return imagenes;
}

function limpiarTextura(): void {
  if (materialPantalla?.diffuseTexture) {
    materialPantalla.diffuseTexture.dispose();
    materialPantalla.diffuseTexture = null;
  }
}

function mostrarImagenEnTablero(urlImagen: string, scene: BABYLON.Scene): void {
  if (!pantallaTablero || !materialPantalla) return;
  quitarYoutube();
  limpiarTextura();

  const nuevaTextura = new BABYLON.Texture(urlImagen, scene, false, false);
  nuevaTextura.vScale = -1;
  nuevaTextura.uScale = 1; 
  
  materialPantalla.diffuseTexture = nuevaTextura;
  pantallaTablero.isVisible = true;
}

function mostrarVideoEnTablero(urlVideo: string, scene: BABYLON.Scene): void {
  if (!pantallaTablero || !materialPantalla) return;
  quitarYoutube();
  limpiarTextura();

  const videoTexture = new BABYLON.VideoTexture("videoTablero", urlVideo, scene, true, false);
  videoTexture.vScale = 1;
  videoTexture.uScale = 1;
  materialPantalla.diffuseTexture = videoTexture;
  pantallaTablero.isVisible = true;

  videoElementoActual = videoTexture.video;
  videoElementoActual.loop = true;
  videoElementoActual.play().catch(() => console.warn("Autoplay bloqueado por el navegador."));
}

function limpiarTablero(): void {
  quitarYoutube();
  limpiarTextura();
  diapositivas = [];
  indiceDiapositiva = 0;
  videoElementoActual = null;
  if (pantallaTablero) {
    pantallaTablero.isVisible = false;
  }
}

function cambiarDiapositiva(direccion: 1 | -1, scene: BABYLON.Scene): void {
  if (diapositivas.length === 0) return;
  indiceDiapositiva = (indiceDiapositiva + direccion + diapositivas.length) % diapositivas.length;
  mostrarImagenEnTablero(diapositivas[indiceDiapositiva], scene);
}

function mostrarYoutube(idVideo: string): void {
  quitarYoutube();
  limpiarTextura();
  if (pantallaTablero) pantallaTablero.isVisible = false;

  iframeYoutube = document.createElement("iframe");
  iframeYoutube.src = `https://www.youtube.com/embed/${idVideo}?autoplay=1`;
  iframeYoutube.style.position = "absolute";
  iframeYoutube.style.border = "none";
  iframeYoutube.style.zIndex = "500";
  iframeYoutube.allow = "autoplay; encrypted-media";
  document.body.appendChild(iframeYoutube);
}

function quitarYoutube(): void {
  if (iframeYoutube) {
    iframeYoutube.remove();
    iframeYoutube = null;
  }
}

function actualizarPosicionYoutube(scene: BABYLON.Scene): void {
  if (!iframeYoutube || !pantallaTablero) return;

  const bounds = pantallaTablero.getBoundingInfo().boundingBox;
  const esquinas = bounds.vectorsWorld;
  const camera = scene.activeCamera;
  if (!camera) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let visible = false;

  const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
  const transformMatrix = scene.getTransformMatrix();

  esquinas.forEach((esquina) => {
    const proyectado = BABYLON.Vector3.Project(
      esquina,
      BABYLON.Matrix.Identity(),
      transformMatrix,
      viewport
    );
    if (proyectado.z > 0 && proyectado.z < 1) visible = true;
    minX = Math.min(minX, proyectado.x);
    minY = Math.min(minY, proyectado.y);
    maxX = Math.max(maxX, proyectado.x);
    maxY = Math.max(maxY, proyectado.y);
  });

  if (!visible) {
    iframeYoutube.style.display = "none";
    return;
  }

  iframeYoutube.style.display = "block";
  iframeYoutube.style.left = `${minX}px`;
  iframeYoutube.style.top = `${minY}px`;
  iframeYoutube.style.width = `${maxX - minX}px`;
  iframeYoutube.style.height = `${maxY - minY}px`;
}

function extraerIdYoutube(url: string): string | null {
  const patron = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(patron);
  return match ? match[1] : null;
}

// ============================================================
// ESCENA PRINCIPAL
// ============================================================

const createScene = async function (): Promise<BABYLON.Scene> {
  const scene = new BABYLON.Scene(engine);
  scenaActual = scene;
  scene.gravity = new BABYLON.Vector3(0, -0.15, 0);
  scene.collisionsEnabled = true;
  scene.clearColor = new BABYLON.Color4(0.75, 0.85, 0.95, 1);

  // 1. CARGAR EL PERSONAJE 3D
  let personaje: Personaje | null = null;
  try {
    personaje = await cargarPersonaje(scene);
    personaje.raiz.position = new BABYLON.Vector3(0, 0, -8);
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
  camara.checkCollisions = true;
  camara.applyGravity = true;
  camara.minZ = 0.1;

  canvas.addEventListener("click", () => canvas.requestPointerLock());

  const luz = new BABYLON.HemisphericLight("luz", new BABYLON.Vector3(0, 1, 0), scene);
  luz.intensity = 0.9;

  await cargarSalon(scene);

  const sueloColision = BABYLON.MeshBuilder.CreateGround("sueloColision", { width: 100, height: 100 }, scene);
  sueloColision.position = new BABYLON.Vector3(0, 0, 0);
  sueloColision.checkCollisions = true;
  sueloColision.isVisible = false;

  let modoTerceraPersona = false;
  let sentado = false;
  let enEscritorio = false;
  let parCercano: ParSilla | null = null;
  let cercaDelAtril = false;
  let posicionGuardada: BABYLON.Vector3 | null = null;
  let rotacionGuardada = 0;
  const distanciaMaximaProximidad = 3.5;

  const teclasPresionadas: { [key: string]: boolean } = {};

  window.addEventListener("keydown", (e) => { teclasPresionadas[e.key.toLowerCase()] = true; });
  window.addEventListener("keyup", (e) => { teclasPresionadas[e.key.toLowerCase()] = false; });

  // BUCLE DE ACTUALIZACIÓN
  scene.onBeforeRenderObservable.add(() => {
    if (personaje && !sentado && !enEscritorio) {
      let moviendose = false;
      const velocidad = 0.15;

      personaje.raiz.rotation.y = camara.rotation.y;

      const avance = camara.getForwardRay().direction;
      avance.y = 0;
      avance.normalize();

      const derecha = camara.getDirection(BABYLON.Axis.X);
      derecha.y = 0;
      derecha.normalize();

      // Movimiento directo mediante addInPlace para garantizar reactividad
      if (teclasPresionadas["w"]) {
        personaje.raiz.position.addInPlace(avance.scale(velocidad));
        moviendose = true;
      }
      if (teclasPresionadas["s"]) {
        personaje.raiz.position.addInPlace(avance.scale(-velocidad));
        moviendose = true;
      }
      if (teclasPresionadas["d"]) {
        personaje.raiz.position.addInPlace(derecha.scale(velocidad));
        moviendose = true;
      }
      if (teclasPresionadas["a"]) {
        personaje.raiz.position.addInPlace(derecha.scale(-velocidad));
        moviendose = true;
      }

      if (personaje.animacionCaminar) {
        if (moviendose && !personaje.animacionCaminar.isPlaying) {
          personaje.animacionCaminar.play(true);
        } else if (!moviendose && personaje.animacionCaminar.isPlaying) {
          personaje.animacionCaminar.stop();
        }
      }

      const offsetActual = modoTerceraPersona 
        ? (personaje.offsetTerceraPersona || new BABYLON.Vector3(0, 2.5, -4)) 
        : (personaje.offsetPrimeraPersona || new BABYLON.Vector3(0, 1.7, 0.2));

      const matrizRotacion = BABYLON.Matrix.RotationY(personaje.raiz.rotation.y);
      const offsetMundo = BABYLON.Vector3.TransformCoordinates(offsetActual, matrizRotacion);
      
      camara.position.copyFrom(personaje.raiz.position.add(offsetMundo));
    }

    if (sentado || enEscritorio) return;

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

    let distanciaAtril = Infinity;
    if (atril) {
      const posCamara2D = new BABYLON.Vector3(camara.position.x, 0, camara.position.z);
      const posAtril2D = new BABYLON.Vector3(atril.posicionAtril.x, 0, atril.posicionAtril.z);
      distanciaAtril = BABYLON.Vector3.Distance(posCamara2D, posAtril2D);
    }

    if (atril && distanciaAtril < distanciaMaximaProximidad && distanciaAtril <= menorDistancia) {
      cercaDelAtril = true;
      parCercano = null;
      aviso.innerText = "Presiona R para presentar en el atril";
      aviso.style.display = "block";
    } else if (masCercana && menorDistancia < distanciaMaximaProximidad) {
      parCercano = masCercana;
      cercaDelAtril = false;
      aviso.innerText = "Presiona E para sentarte";
      aviso.style.display = "block";
    } else {
      parCercano = null;
      cercaDelAtril = false;
      aviso.style.display = "none";
    }

    actualizarPosicionYoutube(scene);
  });

  let manoAlzada = false;
  let temporizadorMano: number | null = null;

  window.addEventListener("keydown", (evento) => {
    const tecla = evento.key.toLowerCase();

    if (tecla === "b") {
      modoTerceraPersona = !modoTerceraPersona;
    }

    if (tecla === "r") {
      if (!enEscritorio && cercaDelAtril && atril) {
        posicionGuardada = camara.position.clone();
        rotacionGuardada = camara.rotation.y;

        camara.position = atril.puntoEnsenar.posicion.clone();
        camara.rotation.y = atril.puntoEnsenar.rotacionY;

        enEscritorio = true;
        aviso.style.display = "none";
      } else if (enEscritorio) {
        if (posicionGuardada && personaje) {
          personaje.raiz.position = posicionGuardada.clone();
          personaje.raiz.position.y = 0;
        }
        camara.rotation.y = rotacionGuardada;
        enEscritorio = false;
        menuPublicar.style.display = "none";
      }
    }

    if (tecla === "e") {
      if (!sentado && parCercano) {
        posicionGuardada = camara.position.clone();
        rotacionGuardada = camara.rotation.y;

        camara.position = parCercano.puntoSit.posicion.clone();
        if (personaje) {
          personaje.raiz.position = parCercano.puntoSit.posicion.clone();
        }

        sentado = true;
        aviso.style.display = "none";
      } else if (sentado) {
        if (posicionGuardada && personaje) {
          personaje.raiz.position = posicionGuardada.clone();
          personaje.raiz.position.y = 0;
        }
        camara.rotation.y = rotacionGuardada;
        sentado = false;
      }
    }

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

    if (tecla === "p" && enEscritorio) {
      menuPublicar.style.display = "block";
    }

    if (evento.key === "Escape") {
      menuPublicar.style.display = "none";
    }

    if (evento.key === "ArrowRight") {
      cambiarDiapositiva(1, scene);
    }
    if (evento.key === "ArrowLeft") {
      cambiarDiapositiva(-1, scene);
    }

    if (enEscritorio && evento.key === " ") {
      evento.preventDefault();
      if (videoElementoActual) {
        if (videoElementoActual.paused) videoElementoActual.play();
        else videoElementoActual.pause();
      }
    }

    if (enEscritorio && (evento.key === "Delete" || evento.key === "Backspace")) {
      limpiarTablero();
    }
  });

  return scene;
};

// LISTENERS
document.getElementById("btnSubirPdf")!.addEventListener("click", () => inputPdf.click());
document.getElementById("btnSubirImagenes")!.addEventListener("click", () => inputImagenes.click());
document.getElementById("btnSubirVideo")!.addEventListener("click", () => inputVideo.click());
document.getElementById("btnLimpiarTablero")!.addEventListener("click", () => {
  limpiarTablero();
  menuPublicar.style.display = "none";
});
document.getElementById("btnCerrarMenu")!.addEventListener("click", () => menuPublicar.style.display = "none");

document.getElementById("btnYoutube")!.addEventListener("click", () => {
  const url = prompt("Pega el link del video de YouTube:");
  if (!url || !scenaActual) return;
  const idVideo = extraerIdYoutube(url);
  if (!idVideo) {
    alert("No se pudo identificar un ID válido de YouTube.");
    return;
  }
  mostrarYoutube(idVideo);
  menuPublicar.style.display = "none";
});

inputPdf.addEventListener("change", async () => {
  if (!inputPdf.files || inputPdf.files.length === 0 || !scenaActual) return;
  menuPublicar.style.display = "none";
  cartelCargando.style.display = "block";

  try {
    const paginas = await convertirPdfAImagenes(inputPdf.files[0]);
    diapositivas = paginas;
    indiceDiapositiva = 0;
    mostrarImagenEnTablero(diapositivas[0], scenaActual);
  } catch (e) {
    console.error(e);
    alert("Error al procesar el archivo PDF.");
  } finally {
    cartelCargando.style.display = "none";
    inputPdf.value = "";
  }
});

inputImagenes.addEventListener("change", () => {
  if (!inputImagenes.files || inputImagenes.files.length === 0 || !scenaActual) return;
  diapositivas = Array.from(inputImagenes.files).map((archivo) => URL.createObjectURL(archivo));
  indiceDiapositiva = 0;
  mostrarImagenEnTablero(diapositivas[0], scenaActual);
  menuPublicar.style.display = "none";
  inputImagenes.value = "";
});

inputVideo.addEventListener("change", () => {
  if (!inputVideo.files || inputVideo.files.length === 0 || !scenaActual) return;
  const url = URL.createObjectURL(inputVideo.files[0]);
  mostrarVideoEnTablero(url, scenaActual);
  menuPublicar.style.display = "none";
  inputVideo.value = "";
});

function entrarAlSalon(_clase: Clase) {
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