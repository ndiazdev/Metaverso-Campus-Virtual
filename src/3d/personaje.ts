import * as BABYLON from "babylonjs";

// Cambia esto por el nombre exacto del .glb que exportes desde Blender
const NOMBRE_ARCHIVO_PERSONAJE = "simple_girl2.6.glb";

export interface Personaje {
  raiz: BABYLON.AbstractMesh;
  offsetPrimeraPersona: BABYLON.Vector3; // posición local del Empty "1persona"
  offsetTerceraPersona: BABYLON.Vector3; // posición local del Empty "3persona"
  animacionCaminar: BABYLON.AnimationGroup | null;
}

export async function cargarPersonaje(scene: BABYLON.Scene): Promise<Personaje> {
  const resultado = await BABYLON.SceneLoader.ImportMeshAsync(
    "",
    "/models/",
    NOMBRE_ARCHIVO_PERSONAJE,
    scene
  );

  const raiz = resultado.meshes[0];
  const todosLosNodos = [...resultado.transformNodes, ...resultado.meshes];

  // Buscar los 2 Empties de cámara
 // Aseguramos que las matrices de transformación estén actualizadas antes de medir
raiz.computeWorldMatrix(true);

// Buscar los 2 Empties de cámara
let offsetPrimeraPersona = new BABYLON.Vector3(0, 1.6, 0); // valor de respaldo si no se encuentra
let offsetTerceraPersona = new BABYLON.Vector3(0, 2, -3); // detrás y arriba, por si no se encuentra

for (const nodo of todosLosNodos) {
  const nombre = nodo.name.toLowerCase();

  if (nombre.includes("1persona")) {
    nodo.computeWorldMatrix(true);
    // Posición ABSOLUTA del Empty menos posición ABSOLUTA de la raíz =
    // el offset real, sin importar cuántos niveles de jerarquía haya en medio.
    offsetPrimeraPersona = nodo.absolutePosition.subtract(raiz.absolutePosition);
    console.log("✅ Empty '1persona' encontrado. Offset:", offsetPrimeraPersona.toString());
  }

  if (nombre.includes("3persona")) {
    nodo.computeWorldMatrix(true);
    offsetTerceraPersona = nodo.absolutePosition.subtract(raiz.absolutePosition);
    console.log("✅ Empty '3persona' encontrado. Offset:", offsetTerceraPersona.toString());
  }
}

  // Buscar la animación de caminar (se llama "cammina" según tu Blender)
  let animacionCaminar: BABYLON.AnimationGroup | null = null;
  for (const grupo of resultado.animationGroups) {
    if (grupo.name.toLowerCase().includes("cammina") || grupo.name.toLowerCase().includes("walk")) {
      animacionCaminar = grupo;
      animacionCaminar.stop(); // arranca detenida, se reproduce solo al caminar
      console.log(`✅ Animación de caminar encontrada: "${grupo.name}"`);
      break;
    }
  }
  if (!animacionCaminar) {
    console.warn("⚠️ No se encontró una animación llamada 'cammina' o 'walk'. Revisa el nombre en Blender.");
  }

  return { raiz, offsetPrimeraPersona, offsetTerceraPersona, animacionCaminar };
}