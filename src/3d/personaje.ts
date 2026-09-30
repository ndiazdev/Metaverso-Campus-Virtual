import * as BABYLON from "babylonjs";

// Cambia esto por el nombre exacto del .glb que exportes desde Blender
const NOMBRE_ARCHIVO_PERSONAJE = "simple_girl2.6.glb";

export interface Personaje {
  raiz: BABYLON.AbstractMesh;
  // Rotación base que le pone el loader glTF a la raíz (__root__): convierte el sistema
  // diestro de glTF al zurdo de Babylon. SIEMPRE hay que conservarla al girar el personaje.
  rotacionBaseRaiz: BABYLON.Quaternion | null;
  offsetPrimeraPersona: BABYLON.Vector3; // posición local del Empty "1persona"
  offsetTerceraPersona: BABYLON.Vector3; // posición local del Empty "3persona"
  animacionCaminar: BABYLON.AnimationGroup | null;
  /**
   * Malla con piel (la que lleva el esqueleto) y su esqueleto: el mapa los usa
   * para pasarle al tablero la silueta del cuerpo y que el vídeo no tape a la
   * persona. Si el .glb viniera sin animación rigueada quedan en null.
   */
  malla: BABYLON.AbstractMesh | null;
  esqueleto: BABYLON.Skeleton | null;
}

// ALTURA DEL PERSONAJE.
// Medido del .glb con su jerarquía: mide 4.966 unidades (pies en Y = -0.119) y
// se veía de niña. 1.15 la deja en 5.71 unidades, de estatura de universitaria.
// Es el ÚNICO número que hay que tocar: 1.10 = un pelín más alta, 1.25 = alta.
const ESCALA_PERSONAJE = 1.15;

/**
 * Recalcula la matriz de mundo de un nodo y de todos sus hijos, de ARRIBA ABAJO.
 *
 * Hace falta porque Babylon, al recalcular un nodo, lee la matriz del padre desde
 * caché: si solo se fuerza la raíz, los hijos (los Empties "1persona"/"3persona")
 * seguirían con la altura antigua y la medición de la cámara saldría mal.
 */
function forzarMatrizMundo(raiz: BABYLON.Node): void {
  const pendientes: BABYLON.Node[] = [raiz];
  while (pendientes.length > 0) {
    const nodo = pendientes.pop()!;
    const recalculable = nodo as unknown as { computeWorldMatrix?: (forzar?: boolean) => void };
    recalculable.computeWorldMatrix?.(true);
    for (const hijo of nodo.getChildren()) pendientes.push(hijo);
  }
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

  // El loader glTF crea la raíz "__root__" con rotationQuaternion = (0,1,0,0) y scaling = (1,1,-1).
  // Mientras exista rotationQuaternion, BABYLON IGNORA por completo raiz.rotation (sin lanzar error),
  // así que hay que guardar la rotación base y componer con ella al girar el personaje.
  const rotacionBaseRaiz = raiz.rotationQuaternion ? raiz.rotationQuaternion.clone() : null;
  if (rotacionBaseRaiz) {
    console.log(
      `La raíz '${raiz.name}' usa rotationQuaternion (raiz.rotation NO tiene efecto). Base: ${rotacionBaseRaiz.toString()}`
    );
  } else {
    console.log(` La raíz '${raiz.name}' usa rotation (Euler).`);
  }

  // Aseguramos que las matrices de transformación estén actualizadas antes de medir.
  //
  // Primero se aplica la ESCALA, y solo después se miden los Empties de cámara: esas
  // posiciones son la altura de los ojos, y si se midieran con el modelo pequeño la
  // cámara quedaría al pecho de una persona ya crecida.
  const escala = raiz.scaling;
  raiz.scaling = new BABYLON.Vector3(
    escala.x * ESCALA_PERSONAJE,
    escala.y * ESCALA_PERSONAJE,
    escala.z * ESCALA_PERSONAJE // el signo -Z de la raíz glTF se conserva (handedness)
  );
  console.log(`Altura del personaje: escala ×${ESCALA_PERSONAJE}`);
  forzarMatrizMundo(raiz);

  // Buscar los 2 Empties de cámara.
  let offsetPrimeraPersona = new BABYLON.Vector3(0, 1.6, 0); // respaldo si no se encuentra
  let offsetTerceraPersona = new BABYLON.Vector3(0, 2, -3); // detrás y arriba, por si no se encuentra

  for (const nodo of todosLosNodos) {
    const nombre = nodo.name.toLowerCase();

    if (nombre.includes("1persona")) {
      nodo.computeWorldMatrix(true);
      // Posición ABSOLUTA del Empty menos posición ABSOLUTA de la raíz =
      // el offset real, sin importar cuántos niveles de jerarquía haya en medio.
      offsetPrimeraPersona = nodo.absolutePosition.subtract(raiz.absolutePosition);
      console.log("Empty '1persona' encontrado. Offset:", offsetPrimeraPersona.toString());
    }

    if (nombre.includes("3persona")) {
      nodo.computeWorldMatrix(true);
      offsetTerceraPersona = nodo.absolutePosition.subtract(raiz.absolutePosition);
      console.log("Empty '3persona' encontrado. Offset:", offsetTerceraPersona.toString());
    }
  }

  // Buscar la animación de caminar (se llama "cammina" según tu Blender)
  let animacionCaminar: BABYLON.AnimationGroup | null = null;
  for (const grupo of resultado.animationGroups) {
    if (grupo.name.toLowerCase().includes("cammina") || grupo.name.toLowerCase().includes("walk")) {
      animacionCaminar = grupo;
      animacionCaminar.stop(); // arranca detenida, se reproduce solo al caminar
      console.log(`Animación de caminar encontrada: "${grupo.name}"`);
      break;
    }
  }
  if (!animacionCaminar) {
    console.warn("No se encontró una animación llamada 'cammina' o 'walk'. Revisa el nombre en Blender.");
  }

  // Malla con piel + esqueleto: de los huesos sale la silueta con la que el
  // tablero recorta el vídeo para que la persona se vea por DELANTE.
  const mallaPiel = resultado.meshes.find((m) => m.skeleton) ?? null;
  const esqueleto = mallaPiel ? mallaPiel.skeleton : null;
  if (esqueleto) {
    console.log(`Esqueleto encontrado: ${esqueleto.bones.length} huesos (silueta lista).`);
  } else {
    console.warn("El personaje no trae esqueleto: no habrá silueta para recortar el contenido.");
  }

  return {
    raiz,
    rotacionBaseRaiz,
    offsetPrimeraPersona,
    offsetTerceraPersona,
    animacionCaminar,
    malla: mallaPiel,
    esqueleto,
  };
}