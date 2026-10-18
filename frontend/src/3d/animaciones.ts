// ============================================================================
// ANIMACIONES DEL PERSONAJE
// ============================================================================
// Un solo módulo con toda la lógica de clips, "como si fuera una api": el resto
// del juego solo pide las animaciones de una acción y las reproduce.
//
// Qué hace al cargar un personaje:
//   1. Para TODOS los grupos que traiga el .glb (algunos arrancan solos).
//   2. Clasifica cada clip POR CONTENIDO (no por nombre): midiendo en el mundo
//      caderas, manos y pies a lo largo del clip decide si es sentarse,
//      caminar, saludar, parado o una pose T que se descarta.
//   3. Rellena los slots que falten con clips externos de /models/animacion/
//      (caminar.glb, sentado.glb, saludar.glb) si existen: el nombre del
//      archivo manda para esos (si no, un clip estático de sentarse se
//      confundiría con "parado").
//   4. Enlaza cada clip al esqueleto del personaje elegido:
//      · si el clip ya apunta a los TransformNodes vinculados del esqueleto
//        (identidad) se queda tal cual;
//      · si apunta a otro brazoete (p. ej. un archivo con 4 personajes
//        dentro, o un clip externo con sus propios nodos) se clona y se
//      re-apunta por nombre normalizado (mixamorig12:Hips → hips →
//        mixamorig9:Hips), con puerta del 50% de aciertos o se descarta.
//      Siempre se animan los TransformNodes vinculados (nunca los huesos):
//      skeleton.prepare() copia los TNs a los huesos en CADA render, así que
//      escribir directamente sobre un hueso vinculado se pierde.
//   5. Congela el viaje raíz: cualquier clip que mueva un nodo por más del 5%
//      de la estatura en HORIZONTAL (mundo) se le sujeta ese componente para
//      caminar en el sitio (el desplazamiento real lo manda el controlador).
//      Un clip de sentarse (caderas quietas) o un parado no se tocan.
//
// Política de unidades: los clips externos se retargetean TAL CUAL (factor 1),
// o sea: deben exportarse del mismo modelo/escala que el personaje (el flujo
// habitual de Mixamo/Blender). Si algún día llega un clip de otra escala, aquí
// es donde se añade el factor.
import * as BABYLON from "babylonjs";

/** Acción que puede pedir el juego. */
export type SlotAnimacion =
  | "parado"
  | "caminar"
  | "sentarse"
  | "saludar"
  | "manoParado"
  | "manoSentado";

/** El juego solo ve esto: un grupo por acción (null = no hay clip para esa acción). */
export interface AnimacionesPersonaje {
  parado: BABYLON.AnimationGroup | null;
  caminar: BABYLON.AnimationGroup | null;
  sentarse: BABYLON.AnimationGroup | null;
  saludar: BABYLON.AnimationGroup | null;
  /** Mano levantada de pie (alzarmanoparado.glb). */
  manoParado: BABYLON.AnimationGroup | null;
  /** Mano levantada sentado (alzarmanosentado.glb). */
  manoSentado: BABYLON.AnimationGroup | null;
}

/** Clips externos que cubren slots vacíos: [slot, archivo]. */
const EXTERNAS: ReadonlyArray<readonly [SlotAnimacion, string]> = [
  ["caminar", "caminar.glb"],
  ["sentarse", "sentado.glb"],
  ["saludar", "saludar.glb"],
  ["manoParado", "alzarmanoparado.glb"],
  ["manoSentado", "alzarmanosentado.glb"],
];
const CARPETA_ANIMACIONES = "/models/animacion/";

// ---------------------------------------------------------------
// Utilidades de muestreo (las mismas que validaron la clasificación)
// ---------------------------------------------------------------

function forzarMundo(nodo: { parent?: unknown; computeWorldMatrix?: (f?: boolean) => void } | null): void {
  const cadena: Array<{ computeWorldMatrix?: (f?: boolean) => void; parent?: unknown }> = [];
  let actual: unknown = nodo;
  const visto = new Set<unknown>();
  while (actual && typeof actual === "object" && !visto.has(actual)) {
    visto.add(actual);
    cadena.push(actual as { computeWorldMatrix?: (f?: boolean) => void; parent?: unknown });
    actual = (actual as { parent?: unknown }).parent;
  }
  for (let i = cadena.length - 1; i >= 0; i--) cadena[i].computeWorldMatrix?.(true);
}

/** Escribe los canales de un grupo en sus objetivos para el frame dado. */
function aplicarGrupo(grupo: BABYLON.AnimationGroup, frame: number): void {
  for (const ta of grupo.targetedAnimations) {
    const prop = ta.animation.targetProperty;
    const destino = ta.target as {
      rotationQuaternion?: BABYLON.Quaternion | null;
      [clave: string]: unknown;
    } | null;
    if (!destino || !prop) continue;
    const bruto = ta.animation.evaluate(frame);
    const valor =
      bruto && typeof (bruto as { clone?: () => unknown }).clone === "function"
        ? (bruto as { clone: () => unknown }).clone()
        : bruto;
    if (prop === "rotationQuaternion") {
      if (!destino.rotationQuaternion) destino.rotationQuaternion = valor as BABYLON.Quaternion;
      else destino.rotationQuaternion.copyFrom(valor as BABYLON.Quaternion);
    } else {
      destino[prop] = valor;
    }
  }
}

interface NodoMuestra {
  name: string;
  getAbsolutePosition(): BABYLON.Vector3;
}

function primerObjetivo(grupo: BABYLON.AnimationGroup, re: RegExp): NodoMuestra | null {
  for (const ta of grupo.targetedAnimations) {
    const n = ta.target as NodoMuestra | null;
    if (n && typeof n.name === "string" && re.test(n.name)) return n;
  }
  return null;
}

function muestraPos(n: NodoMuestra): BABYLON.Vector3 {
  forzarMundo(n as unknown as { computeWorldMatrix?: (f?: boolean) => void });
  const p = n.getAbsolutePosition();
  return Number.isFinite(p.y) ? p : new BABYLON.Vector3(0, 0, 0);
}

interface Metricas {
  caderasMax: number;
  relMano: number;
  relManoIzq: number;
  piesRel: number;
  viaje: number;
}

/** Mide un clip en el mundo: altura de caderas, altura de manos, paso de pies y viaje. */
function metricasDe(grupo: BABYLON.AnimationGroup): Metricas {
  const caderas = primerObjetivo(grupo, /(^|:)Hips(\.\d+)?$/i);
  const manoDer = primerObjetivo(grupo, /(^|:)RightHand(\.\d+)?$/i);
  const manoIzq = primerObjetivo(grupo, /(^|:)LeftHand(\.\d+)?$/i);
  const pieIzq = primerObjetivo(grupo, /(^|:)LeftFoot(\.\d+)?$/i);
  const pieDer = primerObjetivo(grupo, /(^|:)RightFoot(\.\d+)?$/i);

  const N = 16;
  let maxC = -Infinity;
  let maxM = -Infinity;
  let maxMI = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let x0 = 0;
  let z0 = 0;
  let xFin = 0;
  let zFin = 0;

  for (let i = 0; i < N; i++) {
    const f = grupo.from + ((grupo.to - grupo.from) * i) / (N - 1);
    aplicarGrupo(grupo, f);

    if (caderas) {
      const p = muestraPos(caderas);
      maxC = Math.max(maxC, p.y);
      if (i === 0) { x0 = p.x; z0 = p.z; }
      if (i === N - 1) { xFin = p.x; zFin = p.z; }
    }
    if (manoDer) maxM = Math.max(maxM, muestraPos(manoDer).y);
    if (manoIzq) maxMI = Math.max(maxMI, muestraPos(manoIzq).y);
    if (pieIzq && pieDer) {
      const a = muestraPos(pieIzq);
      const b = muestraPos(pieDer);
      minX = Math.min(minX, a.x - b.x); maxX = Math.max(maxX, a.x - b.x);
      minZ = Math.min(minZ, a.z - b.z); maxZ = Math.max(maxZ, a.z - b.z);
    }
  }

  const ref = Number.isFinite(maxC) && maxC > 0 ? maxC : 1;
  const rangoPies = Number.isFinite(minX) ? Math.max(maxX - minX, maxZ - minZ) : 0;
  return {
    caderasMax: Number.isFinite(maxC) ? maxC : 0,
    relMano: Number.isFinite(maxM) ? maxM / ref : 0,
    relManoIzq: Number.isFinite(maxMI) ? maxMI / ref : 0,
    piesRel: rangoPies / ref,
    viaje: caderas ? Math.hypot(xFin - x0, zFin - z0) / ref : 0,
  };
}

type TipoClip = "parado" | "caminar" | "sentarse" | "saludar" | "descarte";

/**
 * Reglas validadas contra los clips reales:
 *  · sentarse: caderas muy por debajo de la estatura de pie (< 75%);
 *  · caminar: separación de pies > 50% de la estatura o viaje > 90%;
 *  · saludar: una mano muy arriba (>145%) y claramente por encima de la otra;
 *  · pose T (ambas manos arriba): se descarta;
 *  · todo lo demás: parado.
 */
function clasificar(m: Metricas, refDePie: number): TipoClip {
  if (refDePie > 0 && m.caderasMax > 0 && m.caderasMax < 0.75 * refDePie) return "sentarse";
  if (m.piesRel > 0.5 || m.viaje > 0.9) return "caminar";
  if ((m.relMano > 1.45 || m.relManoIzq > 1.45) && Math.abs(m.relMano - m.relManoIzq) > 0.15) return "saludar";
  if (m.relMano > 1.2 && m.relManoIzq > 1.2) return "descarte";
  return "parado";
}

// ---------------------------------------------------------------
// Enlazar clips al esqueleto del personaje
// ---------------------------------------------------------------

/** `mixamorig9:Hips` / `mixamorig12:Hips.001` / `Hips` → `hips`. */
export function normalizarNombre(n: string): string {
  return n.replace(/^mixamorig\d*:?/i, "").replace(/\.\d+$/, "").toLowerCase();
}

function mapaDeEnlaces(esqueleto: BABYLON.Skeleton): Map<string, unknown> {
  const mapa = new Map<string, unknown>();
  for (const hueso of esqueleto.bones) {
    const nodo = hueso.getTransformNode?.() ?? null;
    const destino: unknown = nodo ?? hueso;
    const clave = normalizarNombre(hueso.name);
    if (clave && !mapa.has(clave)) mapa.set(clave, destino);
    if (nodo) {
      const claveNodo = normalizarNombre(nodo.name);
      if (claveNodo && !mapa.has(claveNodo)) mapa.set(claveNodo, destino);
    }
  }
  return mapa;
}

function clonarAnimacion(anim: BABYLON.Animation): BABYLON.Animation {
  const copia = anim.clone();
  const claves = anim.getKeys().map((k) => ({
    ...k,
    value: k.value && typeof k.value.clone === "function" ? k.value.clone() : k.value,
  }));
  copia.setKeys(claves);
  return copia;
}

/**
 * Sujeta el viaje horizontal de un canal de posición "in place":
 * por cada eje local, si su aporte en el MUNDO horizontal (neto × dirección
 * horizontal del eje) supera el 5% de la estatura, se planta en el primer valor.
 * Ejes verticales (altura de caderas, transición a sentado) no se tocan.
 */
function congelarViaje(
  anim: BABYLON.Animation,
  destino: unknown,
  alturaMundo: number,
): void {
  if (anim.targetProperty !== "position") return;
  const padre = (destino as { parent?: unknown } | null)?.parent as {
    parent?: unknown;
    computeWorldMatrix?: (f?: boolean) => void;
    getWorldMatrix?: () => BABYLON.Matrix;
  } | null;
  if (!padre || typeof padre.getWorldMatrix !== "function") return;

  const claves = anim.getKeys();
  if (claves.length < 2) return;
  const primero = claves[0].value as { x?: number; y?: number; z?: number } | null;
  const ultimo = claves[claves.length - 1].value as { x?: number; y?: number; z?: number } | null;
  if (!primero || typeof primero.x !== "number" || !ultimo || typeof ultimo.x !== "number") return;

  forzarMundo(padre);
  const pw = padre.getWorldMatrix();
  const cero = BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.Zero(), pw);
  const ejes = {
    x: BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.Right(), pw).subtract(cero),
    y: BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.Up(), pw).subtract(cero),
    z: BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.Forward(), pw).subtract(cero),
  } as const;

  const umbral = 0.05 * Math.max(alturaMundo, 0.001);
  for (const eje of ["x", "y", "z"] as const) {
    const neto = (ultimo[eje] as number) - (primero[eje] as number);
    if (!Number.isFinite(neto) || neto === 0) continue;
    const horizontal = Math.hypot(ejes[eje].x, ejes[eje].z);
    if (Math.abs(neto) * horizontal > umbral) {
      const fijo = primero[eje];
      for (const k of claves) {
        const v = k.value as { x?: number; y?: number; z?: number } | null;
        if (v && typeof v[eje] === "number") (v as Record<string, number>)[eje] = fijo as number;
      }
    }
  }
}

/**
 * Reproduce un clip de mano sentado EXACTAMENTE en el puesto: sustituye sus
 * canales de posición por los del clip de sentarse (clonados) y quita los que
 * sentarse no tenga. El archivo alzarmanosentado.glb salió de otra sesión de
 * Blender con el origen del brazo desplazado: sus propias posiciones dejaban
 * la cadera ~0.77 m fuera del asiento al pulsar H (teletransporte). El gesto
 * viaja en las rotaciones, que no se tocan, y la postura queda sobre las
 * mismas posiciones con las que se midió offsetCaderaSentado.
 */
function fijarPosicionesA(destino: BABYLON.AnimationGroup, base: BABYLON.AnimationGroup): void {
  const deBase = new Map<unknown, BABYLON.Animation>();
  for (const ta of base.targetedAnimations) {
    if (ta.animation.targetProperty === "position") deBase.set(ta.target, ta.animation);
  }
  let cambiados = 0;
  let quitados = 0;
  for (const ta of [...destino.targetedAnimations]) {
    if (ta.animation.targetProperty !== "position") continue;
    const animBase = deBase.get(ta.target);
    destino.removeTargetedAnimation(ta.animation);
    if (animBase) {
      destino.addTargetedAnimation(clonarAnimacion(animBase), ta.target);
      cambiados++;
    } else {
      quitados++;
    }
  }
  console.log(
    `[anim] "${destino.name}": posiciones tomadas de "${base.name}" (${cambiados} canales` +
      (quitados ? `, ${quitados} sin par en sentarse y quitados` : "") +
      ").",
  );
}

// ---------------------------------------------------------------
// Externos
// ---------------------------------------------------------------

async function existeArchivo(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    const tipo = r.headers.get("content-type") ?? "";
    return r.ok && !tipo.includes("text/html");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------
// Montaje principal
// ---------------------------------------------------------------

/**
 * Qué deja montados `montarAnimaciones`, además de los clips.
 */
export interface MontajeAnimaciones {
  grupos: AnimacionesPersonaje;
  /**
   * Cadera (Hips) con el clip sentado aplicado, relativa a la raíz y ya en
   * unidades del salón: es el punto físico que hay que apoyar en el asiento
   * (empty sit_*) al sentarse. null si no hay clip de sentarse.
   */
  caderaSentado: BABYLON.Vector3 | null;
  /**
   * Empties de cámara del clip sentado (1personasentado/3personasentado),
   * en el espacio del personaje y SIN escalar (la escala la aplica personaje.ts).
   */
  vaciosSentado: { primera: BABYLON.Vector3 | null; tercera: BABYLON.Vector3 | null };
}

/**
 * Mide los empties de cámara del clip sentado y los devuelve en el ESPACIO
 * DEL PERSONAJE (sin escalar):
 *
 *   relativo a la raíz del archivo externo + (armature del personaje − armature del externo)
 *
 * El segundo término es lo que hace que los empties sigan al cuerpo: si el
 * archivo del clip trae el armature desplazado (sentado.glb lo lleva a −0.45
 * en Y), al retargetear el hueso Hips queda 0.45 más arriba de donde estaba en
 * su archivo, pero los empties cuelcan de la raíz (no del armature) y no se
 * mueven solos: se les suma la misma diferencia.
 *
 * La misma convención que los empties de pie (rotación diestro→zurdo y flip
 * del loader incluidos, porque ambos archivos pasan por el mismo loader).
 */
function medirVaciosSentado(
  carga: BABYLON.ISceneLoaderAsyncResult,
  armPersonaje: BABYLON.TransformNode | null,
): { primera: BABYLON.Vector3 | null; tercera: BABYLON.Vector3 | null } {
  const nodos: BABYLON.TransformNode[] = [...carga.transformNodes, ...carga.meshes];
  const raizExterna =
    carga.meshes.find((m) => !m.parent) ??
    carga.transformNodes.find((n) => !n.parent) ??
    null;
  const hipsExterno = nodos.find((n) => normalizarNombre(n.name) === "hips") ?? null;
  const armExterno =
    hipsExterno?.parent instanceof BABYLON.TransformNode ? hipsExterno.parent : null;

  let delta = BABYLON.Vector3.Zero();
  if (armPersonaje && armExterno) {
    armPersonaje.computeWorldMatrix?.(true);
    armExterno.computeWorldMatrix?.(true);
    delta = armPersonaje.absolutePosition.subtract(armExterno.absolutePosition);
  }

  const relativo = (subcadena: string): BABYLON.Vector3 | null => {
    const vacio = nodos.find((n) => n.name.toLowerCase().includes(subcadena));
    if (!vacio || !raizExterna) return null;
    vacio.computeWorldMatrix?.(true);
    raizExterna.computeWorldMatrix?.(true);
    const p = vacio.absolutePosition.subtract(raizExterna.absolutePosition).add(delta);
    return Number.isFinite(p.y) ? p : null;
  };

  const primera = relativo("1persona");
  const tercera = relativo("3persona");
  console.log(
    `[anim] empties sentado (sin escalar) → 1P ${primera?.toString() ?? "—"} · ` +
      `3P ${tercera?.toString() ?? "—"} · Δ armature ${delta.toString()}`,
  );
  return { primera, tercera };
}

export async function montarAnimaciones(
  escena: BABYLON.Scene,
  esqueleto: BABYLON.Skeleton | null,
  gruposPropios: BABYLON.AnimationGroup[],
  alturaMundo: number,
  raiz: BABYLON.AbstractMesh | null,
): Promise<MontajeAnimaciones> {
  const vacias: AnimacionesPersonaje = {
    parado: null,
    caminar: null,
    sentarse: null,
    saludar: null,
    manoParado: null,
    manoSentado: null,
  };

  // 1) Nada de autoplay: varios .glb arrancan una animación al cargar.
  for (const g of gruposPropios) g.stop();

  if (!esqueleto) {
    for (const g of gruposPropios) g.dispose();
    return { grupos: vacias, caderaSentado: null, vaciosSentado: { primera: null, tercera: null } };
  }

  const mapa = mapaDeEnlaces(esqueleto);
  const descartes = new Set<BABYLON.AnimationGroup>();

  // Armature del personaje elegido (padre de su Hips, si existe): hace falta
  // para corregir los empties del clip sentado si el archivo externo trae el
  // armature desplazado (ver medirVaciosSentado).
  const hipsChar = mapa.get("hips");
  const armPersonaje =
    hipsChar instanceof BABYLON.TransformNode && hipsChar.parent instanceof BABYLON.TransformNode
      ? hipsChar.parent
      : null;

  // 2) Clasificar los clips propios por contenido.
  const propios = gruposPropios.map((grupo) => ({ grupo, m: metricasDe(grupo) }));
  const refDePie = Math.max(0, ...propios.map((x) => x.m.caderasMax));
  const elegidos = new Map<SlotAnimacion, BABYLON.AnimationGroup>();
  for (const { grupo, m } of propios) {
    const tipo = clasificar(m, refDePie);
    if (tipo === "descarte" || elegidos.has(tipo)) {
      descartes.add(grupo);
      continue;
    }
    elegidos.set(tipo, grupo);
    console.log(`[anim] ${grupo.name} → ${tipo} (mano ${m.relMano.toFixed(2)}/${m.relManoIzq.toFixed(2)}, pies ${m.piesRel.toFixed(2)}, viaje ${m.viaje.toFixed(2)})`);
  }

  // 3) Enlazar al esqueleto elegido (identidad o retarget).
  const enlazar = (grupo: BABYLON.AnimationGroup): BABYLON.AnimationGroup | null => {
    let resueltos = 0;
    let identidad = true;
    const pares: Array<{ anim: BABYLON.Animation; destino: unknown }> = [];

    for (const ta of grupo.targetedAnimations) {
      const nombre = typeof ta.target?.name === "string" ? ta.target.name : "";
      const destino = mapa.get(normalizarNombre(nombre));
      if (!destino) { identidad = false; continue; }
      resueltos++;
      if (destino !== ta.target) identidad = false;
      if (ta.animation.targetProperty === "scaling") continue; // escalas no se re-apuntan
      pares.push({ anim: ta.animation, destino });
    }

    const total = grupo.targetedAnimations.length;
    if (total === 0 || resueltos * 2 < total) {
      console.warn(`[anim] "${grupo.name}": solo ${resueltos}/${total} canales enlazan con el esqueleto; se descarta.`);
      return null;
    }

    if (identidad) {
      for (const { anim, destino } of pares) congelarViaje(anim, destino, alturaMundo);
      return grupo;
    }

    const nuevo = new BABYLON.AnimationGroup(`${grupo.name} (enlazada)`, escena);
    for (const { anim, destino } of pares) {
      const copia = clonarAnimacion(anim);
      congelarViaje(copia, destino, alturaMundo);
      nuevo.addTargetedAnimation(copia, destino);
    }
    descartes.add(grupo);
    console.log(`[anim] "${grupo.name}" retargeteado a ${pares.length} canales del esqueleto.`);
    return nuevo;
  };

  const resultado: AnimacionesPersonaje = {
    parado: null,
    caminar: null,
    sentarse: null,
    saludar: null,
    manoParado: null,
    manoSentado: null,
  };
  let vaciosSentado: { primera: BABYLON.Vector3 | null; tercera: BABYLON.Vector3 | null } = {
    primera: null,
    tercera: null,
  };
  for (const slot of ["parado", "caminar", "sentarse", "saludar"] as const) {
    const propio = elegidos.get(slot);
    if (propio) resultado[slot] = enlazar(propio);
  }

  // 4) Los clips externos cubren los slots que siguen vacíos: el nombre del
  //    archivo manda (un clip estático de sentarse medido solo contra su propio
  //    archivo se confundiría con "parado").
  for (const [slot, archivo] of EXTERNAS) {
    if (resultado[slot]) continue;
    const url = CARPETA_ANIMACIONES + archivo;
    if (!(await existeArchivo(url))) continue;
    try {
      const carga = await BABYLON.SceneLoader.ImportMeshAsync("", CARPETA_ANIMACIONES, archivo, escena);
      for (const g of carga.animationGroups) g.stop();
      const grupo = carga.animationGroups[0] ?? null;
      if (grupo) {
        const enlazado = enlazar(grupo);
        if (enlazado) {
          resultado[slot] = enlazado;
          // La mano alzada sentado se apoya SIEMPRE en las posiciones del clip
          // de sentarse (el puesto); las suyas vienen desplazadas de otra
          // sesión de Blender y teletransportaban fuera de la silla.
          if (slot === "manoSentado" && resultado.sentarse) {
            fijarPosicionesA(enlazado, resultado.sentarse);
          }
          console.log(`[anim] slot "${slot}" cubierto con ${archivo}`);
          // Los empties de cámara del clip sentado se miden ANTES de tirar los
          // nodos del archivo externo: dan la vista 1ª/3ª persona con el cuerpo
          // sentado (si el archivo no los trae, quedan null y valen los respaldos).
          if (slot === "sentarse") vaciosSentado = medirVaciosSentado(carga, armPersonaje);
        }
        for (const otro of carga.animationGroups) if (otro !== grupo) descartes.add(otro);
        if (!enlazado) descartes.add(grupo);
      }
      // Los nodos del archivo externo ya no hacen falta (el clip clonado
      // apunta a los TNs del personaje).
      for (const m of carga.meshes) m.dispose();
      for (const n of carga.transformNodes) n.dispose();
    } catch (e) {
      console.warn(`[anim] no se pudo cargar ${archivo}:`, e);
    }
  }

  // 5) CADERA DEL POSE SENTADO: se aplica el clip (su frame final) y se mide
  //    la cadera del esqueleto elegido respecto de la raíz, ya en unidades del
  //    salón. Es el punto que al sentarse hay que apoyar sobre el asiento
  //    (empty sit_*), en vez de clavar los pies en el suelo. Después vuelve la
  //    pose de parado.
  let caderaSentado: BABYLON.Vector3 | null = null;
  if (resultado.sentarse && raiz && hipsChar instanceof BABYLON.TransformNode) {
    aplicarGrupo(resultado.sentarse, resultado.sentarse.to);
    forzarMundo(hipsChar);
    const rel = hipsChar.absolutePosition.subtract(raiz.absolutePosition);
    if (Number.isFinite(rel.y)) {
      caderaSentado = rel;
      console.log(`[anim] cadera sentado → ${rel.toString()} (relativa a la raíz, unidades del salón)`);
    }
  }

  // 6) Pose limpia inicial con el clip de parado (el muestreo dejó una pose al azar).
  const parado = resultado.parado;
  if (parado) aplicarGrupo(parado, (parado.from + parado.to) / 2);

  // 7) Tirar todo lo que no se usa (los slots de mano y los clips propios
  //    descartados cuentan como "no usado").
  const usados = new Set(Object.values(resultado));
  for (const g of descartes) {
    if (!usados.has(g)) {
      g.stop();
      g.dispose();
    }
  }

  return { grupos: resultado, caderaSentado, vaciosSentado };
}
