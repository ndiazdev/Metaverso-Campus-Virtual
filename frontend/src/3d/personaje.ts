import * as BABYLON from "babylonjs";
import { obtenerGeneroAvatar, type GeneroAvatar, type Rol } from "../state/estado";
import { montarAnimaciones, type AnimacionesPersonaje } from "./animaciones";

// ============================================================================
// CARGA DEL PERSONAJE
// ============================================================================
// El rol de la sesión + la piel elegida en la mini-ventana de "Entrar"
// (guardada por estado.ts) deciden qué archivo se carga de este catálogo.
export interface Personaje {
  raiz: BABYLON.AbstractMesh;
  // Rotación base que le pone el loader glTF a la raíz (__root__): convierte el sistema
  // diestro de glTF al zurdo de Babylon. SIEMPRE hay que conservarla al girar el personaje.
  rotacionBaseRaiz: BABYLON.Quaternion | null;
  offsetPrimeraPersona: BABYLON.Vector3; // posición del ojo (1ª persona)
  offsetTerceraPersona: BABYLON.Vector3; // posición de la cámara (3ª persona)
  /** Clips listos por acción; los slots sin clip quedan en null. */
  animaciones: AnimacionesPersonaje;
  /**
   * Malla con piel (la que lleva el esqueleto) y su esqueleto: el mapa los usa
   * para pasarle al tablero la silueta del cuerpo y que el vídeo no tape a la
   * persona.
   */
  malla: BABYLON.AbstractMesh | null;
  esqueleto: BABYLON.Skeleton | null;
}

// ALTURA DEL PERSONAJE EN EL MUNDO (la manda el salón, no el .glb).
//
// El salón está modelado a 0.314 m por unidad —medido con rayos en NullEngine:
// mesa 0.746 m · atril 1.19 m · ojo del empty TEACH_01 a 1.598 m sobre el suelo
// y puerta de 1.80 m (coincide con la medición histórica "1 u ≈ 0.314 m")—.
// Como la persona de referencia mide 1.76 m, en el mundo debe ocupar
// 1.76 / 0.314 = 5.605 unidades.
//
// NO es un multiplicador fijo del .glb: al cargar se mide la altura bruta del
// modelo y se calcula la escala que la lleva a 5.605 u. Así, si exportas otro
// .glb desde Mixamo (u otro sitio) con otra escala, la persona sigue midiendo
// 1.76 m sin tocar nada. Éste es el único número que hay que tocar para
// cambar la estatura.
const ALTURA_OBJETIVO_U = 5.605; // 1.76 m de persona a 0.314 m por unidad del salón

// ── CATÁLOGO DE SKINS ────────────────────────────────────────────────────────
// clave: `${conjunto}-${género}` → qué archivos probar, en orden, y con qué
// prefijo de malla elegir dentro del archivo si trae varios personajes.
//
// IMPORTANTE (estado de los modelos a fecha de hoy):
//  · `personajes/hombre.glb` (55 MB) es el único .glb bueno: un personaje
//    solo, centrado, con clip "parado" propio (Mixamo, prefijo mixamorig9).
//  · Los otros modelos (estHombre/estMujer/profeHombre/profeMujer, simple_girl,
//    estudiante1...) están fuera del catálogo a propósito: se re-encolan aquí
//    cuando lleguen los export buenos. Si un archivo del catálogo no existe o
//    sale sin cuerpo con esqueleto, se salta al siguiente candidato solo.
interface Skin {
  /** Candidatos en orden; el primero que cargue bien se usa. */
  archivos: string[];
  /** Si el archivo trae varios personajes, prefijo de malla del elegido (ej. "Ch31"). */
  prefijo?: string;
}

const CATALOGO: Record<string, Skin> = {
  "estudiante-mujer": { archivos: ["personajes/hombre.glb"] },
  "estudiante-hombre": { archivos: ["personajes/hombre.glb"] },
  "docente-mujer": { archivos: ["personajes/hombre.glb"] },
  "docente-hombre": { archivos: ["personajes/hombre.glb"] },
};

function claveSkin(rol: Rol, genero: GeneroAvatar): string {
  const conjunto = rol === "docente" || rol === "admin" ? "docente" : "estudiante";
  return `${conjunto}-${genero}`;
}

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

/** ¿El archivo trae al menos una malla con esqueleto (cuerpo de verdad)? */
function tieneCuerpo(r: BABYLON.ISceneLoaderAsyncResult): boolean {
  return r.meshes.some((m) => Boolean(m.skeleton));
}

/** Descarta por completo un .glb recién cargado (se usa cuando no sirve). */
function vaciar(r: BABYLON.ISceneLoaderAsyncResult): void {
  for (const g of r.animationGroups) {
    g.stop();
    g.dispose();
  }
  for (const m of r.meshes) m.dispose();
  for (const n of r.transformNodes) n.dispose();
}

export async function cargarPersonaje(
  scene: BABYLON.Scene,
  rol: Rol = "estudiante",
): Promise<Personaje> {
  const genero = obtenerGeneroAvatar();
  const skin = CATALOGO[claveSkin(rol, genero)] ?? CATALOGO["estudiante-mujer"]!;

  // ── CARGAR CON RESPALDO ────────────────────────────────────────────────────
  // Se prueban los candidatos en orden: si un archivo no existe (404) o existe
  // pero salió mal (el clásico export de Blender "solo armature, sin cuerpo"),
  // se descarta con aviso y se sigue con el siguiente.
  let resultado: BABYLON.ISceneLoaderAsyncResult | null = null;
  for (const archivo of skin.archivos) {
    try {
      const r = await BABYLON.SceneLoader.ImportMeshAsync("", "/models/", archivo, scene);
      if (tieneCuerpo(r)) {
        resultado = r;
        break;
      }
      console.warn(`[personaje] "${archivo}" no tiene cuerpo con esqueleto (export incompleto): se descarta.`);
      vaciar(r);
    } catch (e) {
      console.warn(`[personaje] no se pudo cargar "${archivo}":`, e);
    }
  }
  if (!resultado) {
    throw new Error(
      `No hay ningún modelo de personaje utilizable para la skin "${claveSkin(rol, genero)}". ` +
        `Faltan: ${skin.archivos.join(", ")}`,
    );
  }

  const raiz = resultado.meshes[0];
  const todosLosNodos = [...resultado.transformNodes, ...resultado.meshes];

  // El loader glTF crea la raíz "__root__" con rotationQuaternion = (0,1,0,0) y scaling = (1,1,-1).
  // Mientras exista rotationQuaternion, BABYLON IGNORA por completo raiz.rotation (sin lanzar error),
  // así que hay que guardar la rotación base y componer con ella al girar el personaje.
  const rotacionBaseRaiz = raiz.rotationQuaternion ? raiz.rotationQuaternion.clone() : null;

  // ── ELEGIR EL PERSONAJE DENTRO DEL ARCHIVO (si trae varios) ────────────────
  const conPiel = resultado.meshes.filter((m) => Boolean(m.skeleton));
  let mallas = conPiel;
  if (skin.prefijo) {
    const propias = conPiel.filter((m) => m.name.startsWith(skin.prefijo!));
    if (propias.length > 0) {
      mallas = propias;
    } else {
      console.warn(`[personaje] el prefijo "${skin.prefijo}" no está en el archivo: se usa el primer personaje.`);
    }
  }
  const mallaPiel = mallas[0] ?? null;
  const esqueleto = mallaPiel ? mallaPiel.skeleton : null;

  // Si el archivo trae varios cuerpos, se liberan los no elegidos (memoria).
  const esqueletosDescartados = new Set<BABYLON.Skeleton>();
  for (const m of conPiel) {
    if (m.skeleton && m.skeleton !== esqueleto) {
      esqueletosDescartados.add(m.skeleton);
      m.dispose();
    }
  }
  for (const s of esqueletosDescartados) s.dispose();

  // Aseguramos que las matrices de transformación estén actualizadas antes de medir.
  forzarMatrizMundo(raiz);

  // ── MEDICIÓN: alturas + centro (antes de escalar) ──────────────────────────
  let yMin = Infinity;
  let yMax = -Infinity;
  let xMin = Infinity;
  let xMax = -Infinity;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const malla of mallas) {
    if (!malla.getVerticesData(BABYLON.VertexBuffer.PositionKind)) continue;
    malla.computeWorldMatrix(true);
    const caja = malla.getBoundingInfo().boundingBox;
    yMin = Math.min(yMin, caja.minimumWorld.y);
    yMax = Math.max(yMax, caja.maximumWorld.y);
    xMin = Math.min(xMin, caja.minimumWorld.x);
    xMax = Math.max(xMax, caja.maximumWorld.x);
    zMin = Math.min(zMin, caja.minimumWorld.z);
    zMax = Math.max(zMax, caja.maximumWorld.z);
  }
  const alturaBruta = Number.isFinite(yMin) && Number.isFinite(yMax) ? yMax - yMin : 0;
  const cx = Number.isFinite(xMin) ? (xMin + xMax) / 2 : 0;
  const cz = Number.isFinite(zMin) ? (zMin + zMax) / 2 : 0;
  if (alturaBruta <= 0) {
    throw new Error(`[personaje] "${resultado.meshes[0].name}": no se pudo medir la altura del cuerpo.`);
  }

  // El personaje elegido debe estar centrado en el origen de la raíz: si no,
  // chocaría en un sitio y se vería en otro. (Aviso, no magia: el fix correcto
  // es exportar el modelo centrado.)
  if (Math.hypot(cx, cz) > 0.5) {
    console.warn(
      `[personaje] el cuerpo elegido está descentrado (${cx.toFixed(2)}, ${cz.toFixed(2)} u): ` +
        `exporta el modelo con el personaje en el origen.`,
    );
  }

  // ── Elegir los Empties de cámara del personaje elegido (si hay varios) ────
  // Se hace ANTES de escalar (coordinadas aún en unidades del .glb) y se mide
  // el offset DESPUÉS de escalar, que es cuando la altura ya es la del salón.
  let vacioPrimera: BABYLON.TransformNode | BABYLON.AbstractMesh | null = null;
  let vacioTercera: BABYLON.TransformNode | BABYLON.AbstractMesh | null = null;
  let mejorD1 = Infinity;
  let mejorD3 = Infinity;
  for (const nodo of todosLosNodos) {
    const nombre = nodo.name.toLowerCase();
    const esPrimera = nombre.includes("1persona");
    const esTercera = nombre.includes("3persona");
    if (!esPrimera && !esTercera) continue;
    nodo.computeWorldMatrix?.(true);
    const d = Math.hypot(nodo.absolutePosition.x - cx, nodo.absolutePosition.z - cz);
    if (esPrimera && d < mejorD1) { mejorD1 = d; vacioPrimera = nodo; }
    if (esTercera && d < mejorD3) { mejorD3 = d; vacioTercera = nodo; }
  }

  // ── ESCALA CALCULADA PARA CLAVAR LOS 1.76 m ───────────────────────────────
  const escalaCalculada = ALTURA_OBJETIVO_U / alturaBruta;
  const escala = raiz.scaling;
  raiz.scaling = new BABYLON.Vector3(
    escala.x * escalaCalculada,
    escala.y * escalaCalculada,
    escala.z * escalaCalculada // el signo -Z de la raíz se conserva (handedness)
  );
  console.log(
    `[personaje] altura ${alturaBruta.toFixed(3)} u → ×${escalaCalculada.toFixed(3)} = ` +
      `${ALTURA_OBJETIVO_U} u (1.76 m a 0.314 m por unidad del salón)`,
  );
  forzarMatrizMundo(raiz);

  // Si el .glb no trae Empties (los export de Mixamo no los traen), valen éstos,
  // calculados para una persona de ALTURA_OBJETIVO_U (5.605 u = 1.76 m) en
  // unidades del salón:
  //  · primera persona: la altura del ojo que fija el salón (empty TEACH_01:
  //    4.30 sobre el suelo de −0.789 = 5.09 u = 1.60 m), un pelín por delante
  //    para que la nariz no quede dentro de la malla de la cara.
  //  · tercera persona: la misma proporción que ya se veía con el modelo
  //    anterior (alto 2/2.05 y distancia 3/2.05 de la estatura) aplicada a
  //    5.605 u, para conservar el encuadre de siempre.
  let offsetPrimeraPersona = new BABYLON.Vector3(0, 5.09, 0.15);
  let offsetTerceraPersona = new BABYLON.Vector3(0, 5.5, -8.2);

  if (vacioPrimera) {
    vacioPrimera.computeWorldMatrix?.(true);
    offsetPrimeraPersona = vacioPrimera.absolutePosition.subtract(raiz.absolutePosition);
    console.log("[personaje] Empty '1persona' → offset", offsetPrimeraPersona.toString());
  }
  if (vacioTercera) {
    vacioTercera.computeWorldMatrix?.(true);
    offsetTerceraPersona = vacioTercera.absolutePosition.subtract(raiz.absolutePosition);
    console.log("[personaje] Empty '3persona' → offset", offsetTerceraPersona.toString());
  }

  // Silueta para el tablero + matrices de huesos en textura (aviso de uniforms).
  if (esqueleto) {
    esqueleto.useTextureToStoreBoneMatrices = true;
    console.log(`[personaje] esqueleto: ${esqueleto.bones.length} huesos (silueta lista).`);
  } else {
    console.warn("[personaje] el personaje no trae esqueleto: no habrá silueta ni clips.");
  }

  // ── ANIMACIONES (clasificar + enlazar al esqueleto elegido) ────────────────
  const animaciones = await montarAnimaciones(
    scene,
    esqueleto,
    resultado.animationGroups,
    ALTURA_OBJETIVO_U,
  );
  console.log(
    "[personaje] clips listos →",
    Object.entries(animaciones)
      .map(([k, v]) => `${k}: ${v ? v.name : "—"}`)
      .join(" · "),
  );

  return {
    raiz,
    rotacionBaseRaiz,
    offsetPrimeraPersona,
    offsetTerceraPersona,
    animaciones,
    malla: mallaPiel,
    esqueleto,
  };
}
