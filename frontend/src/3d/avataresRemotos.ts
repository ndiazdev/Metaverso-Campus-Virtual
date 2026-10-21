// ============================================================
// AVATARES REMOTOS: las demás personas dentro del salón
// ------------------------------------------------------------
// Cuando el docente y el estudiante están en la misma clase,
// cada uno tiene que VER al otro. Este módulo es el que
// dibuja esos cuerpos y los mueve; no sabe nada de sockets
// (habla con red/presencia.ts) ni de teclas (habla con el mapa
// a través de un callback). Así el salón 3D no crece con lógica
// de red y este archivo se puede probar suelto.
//
// ── CÓMO SE CONSIGUE EL CUERPO DE CADA INVITADO ─────────────
// Cada persona se dibuja con SU skin (rol+género de su sesión), así
// que no vale con clonar siempre el cuerpo local: la propia skin se
// clona del cuerpo local (ya está en memoria) y las ajenas se cargan
// UNA sola vez por sesión y quedan escondidas bajo el suelo como
// plantilla (el .glb pesa ~55 MB, así que solo se paga por las skins
// que de verdad aparezcan en la clase).
//
// OJO: la solución fácil `skeleton = null` NO vale en estos
// .glb: sin esqueleto el cuerpo colapsa a un punto de 0.01 u
// en el piso (el tamaño lo dan las matrices de los huesos;
// medido: 0.01 u de crudo frente a 5.63 u con piel).
//
// Y el clon necesita dos toques más, medidos con NullEngine
// (probarClonEnlace.mjs): `Skeleton.clone()` le copia al clon el
// enlace hueso→nodo —¡pero apuntando a los nodos del ORIGINAL!— y,
// como los clips animan nodos, sin desenlazar el remoto ejecutaba
// al unísono cada movimiento del cuerpo del que se clonó (el bug de
// "al caminar con uno, el otro se mueve": 65 de 65 huesos enlazados).
// Por eso a cada esqueleto clonado se le llama
// `linkTransformNode(null)` y se le pone la pose del clip "parado"
// (ver liberarEsqueleto): pose de pie propia y cero influencia de
// nadie más (ver nota al pie del archivo).
//
// ── CÓMO SE ANIMA UN AVATAR REMOTO ──────────────────────────
// Cada cuerpo lleva sus PROPIOS grupos de animación re-apuntados a
// su esqueleto (crearGruposDeClon): la red solo manda booleanos
// (sentado, caminando, mano alzada) y aquí se decide el clip con la
// misma prioridad que el jugador local — sentado → caminar → mano →
// parado. Así, en dos ventanas a la vez, el que se sienta en una se
// sienta también en la otra. La cápsula de sustitución no tiene
// clips y sigue con el balanceo vertical de este módulo.
//
// ── POR QUÉ HAY QUE SUAVIZAR ────────────────────────────────
// El otro envía 12 posiciones por segundo, pero la pantalla se
// dibuja 60: si cada avatar "saltase" de una posición a la
// siguiente, se vería a teletransportes. Aquí cada avatar
// persigue su última posición conocida con un suavizado
// exponencial (independiente de los FPS) y, si de golpe le
// llega un salto enorme, se coloca de golpe: así un avatar que
// entra tarde aparece ya en su sitio en vez de volar desde el
// centro de la clase.
// ============================================================

import * as BABYLON from "babylonjs";
import { normalizarNombre, type AnimacionesPersonaje, type SlotAnimacion } from "./animaciones";
import { ALTURA_OBJETIVO_BASE, ALTURA_OBJETIVO_U, cargarPersonaje, claveSkin, type Personaje } from "./personaje";
import {
  crearPresencia,
  type EstadoConexion,
  type EstadoLocal,
  type MensajeTablero,
  type Participante,
  type Presencia,
} from "../red/presencia";
import type { Rol } from "../state/estado";

/** Contexto que el mapa 3D le entrega. */
export interface ContextoAvataresRemotos {
  escena: BABYLON.Scene;
  /** Código de la clase en la que se está jugando (sala a la que se entra). */
  clase: string;
  /** Altura del suelo del mapa: los pies de todos los avatares van aquí. */
  sueloY: number;
  /** Cuerpo del jugador local: hace de plantilla para su propia skin. */
  personaje: () => Personaje | null;
  /** Dónde está y qué hace el jugador local (lo publica a la red). */
  estadoLocal: () => EstadoLocal;
  /** Cambió la lista de gente de la clase. */
  alCambiarParticipantes: (participantes: Participante[], miId: string | null) => void;
  /** Cambió la conexión con el servidor. */
  alCambiarConexion: (estado: EstadoConexion, detalle?: string) => void;
  /** Otro de la sala publicó contenido en el tablero del aula. */
  alRecibirTablero?: (mensaje: MensajeTablero) => void;
  /** El servidor no dejó entrar a esta persona en la clase. */
  alRechazar: (motivo: string) => void;
  /** Alguien acaba de levantar la mano (transición de apagada → encendida). */
  alAlzarMano?: (nombre: string) => void;
  /** Se ejecuta al salir de la partida (para no dejar listeners). */
  limpiadores: Array<() => void>;
}

export interface AvataresRemotos {
  /** Gente en la clase ahora mismo. */
  participantes: () => Participante[];
  /** Id de esta conexión en el servidor; marca al propio usuario en la lista. */
  miId: () => string | null;
  /** Manda el contenido del tablero del aula al resto de la sala. */
  publicarTablero: (mensaje: MensajeTablero) => void;
  /**
   * Posición de la CABEZA del avatar remoto (un poco por encima) en unidades
   * del salón. Sirve para anclar el cuadrito de su webcam en pantalla
   * (se proyecta con la cámara activa en cada frame). null si ese avatar
   * aún no existe o no ha publicado posición.
   */
  posicionCabeza: (id: string) => BABYLON.Vector3 | null;
  /**
   * Siluetas (huesos en coordenadas de MUNDO) de todos los avatares remotos
   * visibles. El tablero las usa, junto a la del avatar local, para recortar
   * el vídeo: así no se tapa a nadie que esté delante de
   * la pizarra (p. ej. el profe presentando en el atril).
   */
  siluetas: () => Array<Array<{ x: number; y: number; z: number }>>;
  /** Ancho de la etiqueta del nombre en unidades del salón (para apartar el cuadrito de vídeo). */
  anchoEtiqueta: () => number;
  /** Nombre visible de un participante (para la etiqueta del cuadrito de vídeo). */
  nombreDe: (id: string) => string;
  /** Señalización WebRTC delegada a la presencia (ver red/presencia.ts). */
  emitirSignaling: (evento: string, datos: unknown) => void;
  escucharSignaling: (evento: string, fn: (datos: any) => void) => () => void;
  /** Corta la conexión y borra los avatares ajenos de la escena. */
  destruir: () => void;
}

// ── Constantes de la escena ──────────────────────────────────

// La estatura del personaje la manda personaje.ts y VARÍA según el mapa (en el
// salón de prueba el cuerpo es más grande), así que aquí no se guarda: se lee
// ALTURA_OBJETIVO_U en cada uso y todo (etiqueta y avatar de reserva) escala
// con ella para conservar el tamaño respecto al cuerpo.

/** A qué altura del suelo va la etiqueta con el nombre (0.95 u por encima de la cabeza). */
const alturaEtiqueta = (): number => ALTURA_OBJETIVO_U + 0.95;

/** Ancho del plano de la etiqueta, en unidades del salón (4.4 u a estatura base). */
const anchoEtiqueta = (): number => 4.4 * (ALTURA_OBJETIVO_U / ALTURA_OBJETIVO_BASE);

/** Qué tan rápido un avatar alcanza la posición que le llega. */
const SUAVIZADO = 14;

/** Si de golpe le llegan más de estas unidades, se coloca sin interpolar. */
const SALTO_MAXIMO = 7;

/** Amplitud del balanceo al caminar (0.1 u ≈ 3 cm). */
const BOB_CAMINANDO = 0.1;

/** Colores por rol: el del anillo bajo los pies y el de la etiqueta. */
/** ¿El estado es el spawn por defecto del servidor (nadie se ha movido)? */
function esEstadoInicial(estado: Participante["estado"]): boolean {
  return (
    estado.x === 0 && estado.y === 0 && estado.z === 0 &&
    estado.yaw === 0 && !estado.caminando && !estado.sentado &&
    !estado.enAtril && !estado.manoAlzada
  );
}

const COLOR_POR_ROL: Record<Rol, string> = {
  docente: "#F2A93B",
  admin: "#A78BFA",
  estudiante: "#38BDF8",
  invitado: "#94A3B8",
};

/** Una persona ya dibujada en la escena. */
interface AvatarRemoto {
  id: string;
  /** Nombre visible: es el que se da en el aviso de "levantó la mano". */
  nombre: string;
  raiz: BABYLON.TransformNode;
  /**
   * Rotación base del `.glb` (`__root__`) del cuerpo con el que se clonó.
   * Va por avatar porque cada skin puede traerla distinta: antes se leía
   * siempre la del cuerpo local.
   */
  rotacionBase: BABYLON.Quaternion | null;
  etiqueta: BABYLON.Mesh;
  anillo: BABYLON.Mesh;
  /** Posición a la que se está moviendo (la última que llegó por la red). */
  objetivo: BABYLON.Vector3;
  /** Rumbo objetivo, ya normalizado a (−π, π]. */
  yawObjetivo: number;
  /** Lo que dice la última red (para el balanceo y la etiqueta). */
  caminando: boolean;
  manoAlzada: boolean;
  sentado: boolean;
  /**
   * Clips re-apuntados al ESQUELETO PROPIO de este avatar (ver
   * crearGruposDeClon). `Partial`: lo que no esté es que esa skin no
   * trae ese clip. La cápsula de sustitución se queda con `{}`.
   */
  grupos: Partial<AnimacionesPersonaje>;
  /** El clip que está sonando ahora mismo (para no re-empezarlo con cada estado). */
  grupoActual: BABYLON.AnimationGroup | null;
  /** Último estado que mandó la red: manda aunque su cuerpo cargue después. */
  estadoRed: Participante["estado"];
  /** Fase del balanceo: dos personas no se mueven igual. */
  fase: number;
  /** Pies en el suelo, sin el balanceo. */
  baseY: number;
  /**
   * false hasta que llega el primer `sala:estado` de esa persona. El servidor
   * da y=0 a quien acaba de entrar (todavía no ha publicado nada), así que el
   * primer estado de verdad se coloca de golpe en lugar de dejar al avatar
   * "bajando" medio metro hasta el suelo.
   */
  posicionRecibida: boolean;
}

// ============================================================

export function crearAvataresRemotos(ctx: ContextoAvataresRemotos): AvataresRemotos {
  const avatares = new Map<string, AvatarRemoto>();

  let presencia: Presencia | null = null;

  // ── CUERPOS POR SKIN (de dónde sale cada clon) ─────────────
  // Cada persona se dibuja con la skin de SU sesión, así que la plantilla
  // ya no es siempre el cuerpo local: la propia skin se clona del cuerpo
  // local y las ajenas se cargan una sola vez por sesión. La promesa se
  // guarda ANTES de resolver, que es lo que evita que dos personas con la
  // misma skin disparen dos cargas del mismo .glb a la vez.
  const plantillas = new Map<string, Promise<Personaje | null>>();

  /**
   * Cuerpo del que clonar el avatar de ESTA persona.
   * Una skin ajena se esconde bajo el suelo al cargarla: los clones
   * comparten su geometría y su transform se pisa al clonar, así que la
   * plantilla nunca se llega a ver.
   */
  async function plantillaPara(participante: Participante): Promise<Personaje | null> {
    const clave = claveSkin(participante.rol, participante.genero);

    const local = ctx.personaje();
    if (local && local.clave === clave) return local;

    let pendiente = plantillas.get(clave);
    if (!pendiente) {
      pendiente = (async () => {
        try {
          const cuerpo = await cargarPersonaje(ctx.escena, participante.rol, participante.genero);
          cuerpo.raiz.position.y = -1000;
          cuerpo.raiz.checkCollisions = false;
          cuerpo.raiz.isPickable = false;
          return cuerpo;
        } catch (e) {
          console.warn(`[avataresRemotos] no hay cuerpo para la skin de ${participante.nombre}:`, e);
          plantillas.delete(clave); // a ver si el siguiente intento cuela
          return null;
        }
      })();
      plantillas.set(clave, pendiente);
    }

    const cargada = await pendiente;
    // Mientras cargaba pudo aparecer el cuerpo local con esta misma skin
    // (la carga del jugador local va por su cuenta): mejor usarlo.
    const ahora = ctx.personaje();
    return ahora && ahora.clave === clave ? ahora : cargada;
  }

  // Lista más reciente del servidor: el alta de un avatar es asíncrona (a
  // veces hay que cargar su skin primero) y así no se dibuja a quien ya
  // salió de la clase mientras cargaba.
  let ultimaLista: Participante[] = [];

  // Segunda cerca del alta: `avatares` no contiene a la persona hasta el
  // final, así que sin este conjunto dos avisos seguidos dibujarían dos
  // veces lo mismo.
  const creando = new Set<string>();

  // ---------------------------------------------------------------
  // ETIQUETA CON EL NOMBRE
  // ---------------------------------------------------------------
  // Se dibuja en un canvas (DynamicTexture) y se cuelga de un plano
  // que siempre mira a la cámara. Es HTML-free: si se usara un div
  // del DOM, habría que proyectar la posición 3D a píxeles a mano en
  // cada frame y se vería por detrás de las paredes.
  //
  // Estilo: el mismo de la píldora de conectados (src/ui/listadoConectados.ts)
  // — punto de color del rol, texto blanco fino y fondo oscuro translúcido,
  // SIN borde de color ni texto en negrita. Un borde grueso por avatar encima
  // de la cabeza parecía un cartel de Interstate; aquí solo se insinúa quién es
  // quién. Lo que sí hace falta es algo de contraste: los nombres se leen a
  // contraluz.
  function crearEtiqueta(nombre: string, rol: Rol, id: string): BABYLON.Mesh {
    const ANCHO_TEX = 512;
    const ALTO_TEX = 128;
    const ALTO_CAJON = 72;
    const COLOR = "#E2E8F0";
    const color = COLOR_POR_ROL[rol] ?? COLOR_POR_ROL.invitado;

    const textura = new BABYLON.DynamicTexture(
      `cv_etiqueta_${id}`,
      { width: ANCHO_TEX, height: ALTO_TEX },
      ctx.escena,
      false,
    );
    textura.hasAlpha = true;

    // ICanvasRenderingContext es una versión recortada de la API 2D: con el
    // tipo completo se pueden usar textAlign/textBaseline y measureText.
    const lienzo = textura.getContext() as unknown as CanvasRenderingContext2D;

    lienzo.clearRect(0, 0, ANCHO_TEX, ALTO_TEX);

    // Cajón redondeado: sin borde, solo el fondo. ICanvasRenderingContext no
    // trae roundRect, así que el rectángulo redondeado se hace a mano con arcos.
    const margen = 10;
    const ancho = ANCHO_TEX - margen * 2;
    const y = (ALTO_TEX - ALTO_CAJON) / 2;
    const radio = ALTO_CAJON / 2;
    lienzo.beginPath();
    lienzo.moveTo(margen + radio, y);
    lienzo.lineTo(margen + ancho - radio, y);
    lienzo.arc(margen + ancho - radio, y + radio, radio, -Math.PI / 2, 0);
    lienzo.lineTo(margen + ancho, y + ALTO_CAJON - radio);
    lienzo.arc(margen + ancho - radio, y + ALTO_CAJON - radio, radio, 0, Math.PI / 2);
    lienzo.lineTo(margen + radio, y + ALTO_CAJON);
    lienzo.arc(margen + radio, y + ALTO_CAJON - radio, radio, Math.PI / 2, Math.PI);
    lienzo.lineTo(margen, y + radio);
    lienzo.arc(margen + radio, y + radio, radio, Math.PI, (3 * Math.PI) / 2);
    lienzo.closePath();
    lienzo.fillStyle = "rgba(15, 23, 42, 0.72)";
    lienzo.fill();

    // Punto del rol, igual que en la lista de conectados.
    const centroY = ALTO_TEX / 2;
    const centroPunto = margen + 30;
    lienzo.beginPath();
    lienzo.arc(centroPunto, centroY, 9, 0, Math.PI * 2);
    lienzo.fillStyle = color;
    lienzo.fill();

    // Nombre en el hueco que queda a la derecha del punto. Se deja margen a
    // ambos lados y, si aun así no cabe, se reduce la letra hasta que quepa.
    lienzo.fillStyle = COLOR;
    lienzo.textAlign = "center";
    lienzo.textBaseline = "middle";
    const xTexto = centroPunto + 14 + (ancho - (centroPunto + 14 - margen)) / 2;
    const anchoUtil = ancho - (centroPunto + 14 - margen) - 28;

    let tamano = 40;
    lienzo.font = `500 ${tamano}px sans-serif`;
    while (lienzo.measureText(nombre).width > anchoUtil && tamano > 22) {
      tamano -= 2;
      lienzo.font = `500 ${tamano}px sans-serif`;
    }
    lienzo.fillText(nombre, xTexto, centroY + 1);
    textura.update();

    const material = new BABYLON.StandardMaterial(`cv_mat_etiqueta_${id}`, ctx.escena);
    material.diffuseTexture = textura;
    material.emissiveTexture = textura;
    material.emissiveColor = new BABYLON.Color3(1, 1, 1);
    material.opacityTexture = textura;
    material.disableLighting = true;
    material.backFaceCulling = false;

    // El plano es más alto que el cajón dibujado para que el texto grande no
    // se recorte; lo que no se pinta queda transparente.
    const anchoPlano = anchoEtiqueta();
    const plano = BABYLON.MeshBuilder.CreatePlane(
      `cv_etiqueta_plano_${id}`,
      { width: anchoPlano, height: (anchoPlano * ALTO_TEX) / ANCHO_TEX },
      ctx.escena,
    );
    plano.material = material;
    plano.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    plano.isPickable = false;
    plano.renderingGroupId = 1; // por encima del salón, por debajo de la UI del navegador
    return plano;
  }

  /** Disco de color en el suelo: ayuda a distinguir roles de lejos. */
  function crearAnillo(rol: Rol, id: string): BABYLON.Mesh {
    const disco = BABYLON.MeshBuilder.CreateDisc(
      `cv_anillo_${id}`,
      { radius: 1.15, tessellation: 40 },
      ctx.escena,
    );
    // CreateDisc nace en el plano XY (vertical); tumbarlo lo deja en el suelo.
    disco.rotation.x = Math.PI / 2;

    const material = new BABYLON.StandardMaterial(`cv_mat_anillo_${id}`, ctx.escena);
    material.emissiveColor = BABYLON.Color3.FromHexString(COLOR_POR_ROL[rol] ?? COLOR_POR_ROL.invitado);
    material.diffuseColor = BABYLON.Color3.Black();
    material.disableLighting = true;
    material.alpha = 0.35;
    material.backFaceCulling = false;
    disco.material = material;
    disco.isPickable = false;
    return disco;
  }

  /**
   * Avatar de reserva cuando el jugador local no tiene cuerpo (el .glb
   * falló, que es justo lo que hace el mapa: avisa y sigue jugando).
   * Antes que dejar a la gente invisible, se dibuja una figura simple
   * con las primitivas de Babylon: alguien que se vea es mejor que un
   * hueco en el aula.
   */
  function crearAvatarSustituto(participante: Participante): BABYLON.TransformNode {
    const raiz = new BABYLON.TransformNode(`cv_remoto_${participante.id}`, ctx.escena);

    const factor = ALTURA_OBJETIVO_U / ALTURA_OBJETIVO_BASE;
    const cuerpo = BABYLON.MeshBuilder.CreateCapsule(
      `cv_remoto_cuerpo_${participante.id}`,
      { height: ALTURA_OBJETIVO_U * 0.78, radius: 0.85 * factor },
      ctx.escena,
    );
    cuerpo.position.y = (ALTURA_OBJETIVO_U * 0.78) / 2;
    cuerpo.parent = raiz;
    cuerpo.isPickable = false;

    const cabeza = BABYLON.MeshBuilder.CreateSphere(
      `cv_remoto_cabeza_${participante.id}`,
      { diameter: 0.95 * factor, segments: 12 },
      ctx.escena,
    );
    cabeza.position.y = ALTURA_OBJETIVO_U * 0.9;
    cabeza.parent = raiz;
    cabeza.isPickable = false;

    const material = new BABYLON.StandardMaterial(`cv_mat_sustituto_${participante.id}`, ctx.escena);
    material.diffuseColor = BABYLON.Color3.FromHexString(
      COLOR_POR_ROL[participante.rol] ?? COLOR_POR_ROL.invitado,
    );
    material.specularColor = BABYLON.Color3.Black();
    cuerpo.material = material;
    cabeza.material = material;

    return raiz;
  }

  /**
   * Deja un esqueleto clonado INDEPENDIENTE de su fuente y en pose de pie.
   *
   * `Skeleton.clone()` copia el enlace hueso→nodo del original —¡y apunta
   * a los nodos del ORIGINAL!— y, como los clips animan nodos, sin esto el
   * avatar remoto repetiría al unísono cada movimiento del cuerpo del que
   * se clonó (el bug de "al caminar con uno, el otro se mueve"; medido con
   * NullEngine: el clon seguía al original frame a frame, 65/65 huesos).
   *
   * Al desenlazar, cada hueso se queda en su matriz de enlace (T-pose en
   * estos .glb), así que ANTES se le pone la pose del clip "parado" — la
   * misma con la que el jugador local queda de pie—, evaluada a hueso por
   * nombre (los clips apuntan a nodos, pero el nodo y el hueso de una
   * articulación se llaman igual). Sin clip de parado se copia la pose
   * actual de la fuente: mejor un reposo congelado que una T.
   */
  function liberarEsqueleto(destino: BABYLON.Skeleton, fuente: Personaje): void {
    const parado = fuente.animaciones.parado;

    if (parado) {
      const frame = (parado.from + parado.to) / 2;
      const porNombre = new Map(destino.bones.map((h) => [h.name, h]));
      for (const objetivo of parado.targetedAnimations) {
        const nombre = (objetivo.target as { name?: string } | null)?.name;
        const hueso = nombre ? porNombre.get(nombre) : undefined;
        if (!hueso) continue;
        const prop = objetivo.animation.targetProperty;
        const bruto = objetivo.animation.evaluate(frame);
        const valor =
          bruto && typeof (bruto as { clone?: () => unknown }).clone === "function"
            ? (bruto as { clone: () => unknown }).clone()
            : bruto;
        if (prop === "rotationQuaternion") hueso.rotationQuaternion = valor as BABYLON.Quaternion;
        else if (prop === "position") hueso.position = valor as BABYLON.Vector3;
        else if (prop === "scaling") hueso.scaling = valor as BABYLON.Vector3;
      }
    } else {
      const original = fuente.esqueleto;
      if (original && original.bones.length === destino.bones.length) {
        for (let i = 0; i < destino.bones.length; i++) {
          const hueso = destino.bones[i];
          const base = original.bones[i];
          hueso.position.copyFrom(base.position);
          hueso.rotationQuaternion = base.getRotationQuaternion().clone();
          hueso.scaling = base.getScale().clone();
        }
      }
    }

    // Al final, nunca al principio: mientras el enlace siga puesto,
    // `prepare()` sobrescribiría estos valores con los nodos de la fuente.
    for (const hueso of destino.bones) hueso.linkTransformNode(null);
  }

  /**
   * Re-apunta los clips de la fuente al esqueleto PROPIO de este clon.
   *
   * Los clips animan TransformNodes, pero el cuerpo remoto quedó con los
   * huesos desenlazados (liberarEsqueleto), así que aquí se crea un
   * AnimationGroup por acción apuntando a los HUESOS del clon: el nodo y
   * el hueso de una articulación comparten nombre normalizado (igual que
   * mapaDeEnlaces en animaciones.ts). Cada avatar lleva los suyos —dos
   * personas con la misma skin no comparten grupos ni estado de
   * reproducción— y las animaciones se clonan para no tocar las de la
   * fuente (que al liberar plantillas se disposean).
   *
   * Medido con NullEngine (probarAnimRemota.mjs): un AnimationGroup sobre
   * un hueso desenlazado se comporta igual que sobre un nodo y
   * `prepare()` no lo pisa.
   */
  function crearGruposDeClon(
    clon: BABYLON.TransformNode,
    esqueletos: Map<BABYLON.Skeleton, BABYLON.Skeleton>,
    fuente: Personaje,
  ): Partial<AnimacionesPersonaje> {
    const grupos: Partial<AnimacionesPersonaje> = {};

    // Huesos del clon por nombre normalizado (todos sus esqueletos).
    const huesos = new Map<string, BABYLON.Bone>();
    for (const esqueleto of esqueletos.values()) {
      for (const hueso of esqueleto.bones) {
        const clave = normalizarNombre(hueso.name);
        if (clave && !huesos.has(clave)) huesos.set(clave, hueso);
      }
    }
    if (huesos.size === 0) return grupos;

    const entradas = Object.entries(fuente.animaciones) as Array<
      [SlotAnimacion, BABYLON.AnimationGroup | null]
    >;
    for (const [slot, original] of entradas) {
      if (!original) continue;
      const grupo = new BABYLON.AnimationGroup(`cv_${slot}_${clon.name}`, ctx.escena);
      let apuntados = 0;
      for (const canal of original.targetedAnimations) {
        const nombre = (canal.target as { name?: string } | null)?.name;
        const clave = nombre ? normalizarNombre(nombre) : "";
        const hueso = clave ? huesos.get(clave) : undefined;
        if (!hueso) continue; // raíces u otros nodos que no son hueso (el viaje
        // raíz no interesa: el remoto ya se mueve con su objetivo de red).
        grupo.addTargetedAnimation(canal.animation.clone(), hueso);
        apuntados++;
      }
      if (apuntados === 0) grupo.dispose();
      else grupos[slot] = grupo;
    }
    return grupos;
  }

  /**
   * Cuerpo clonado de la skin que le toca a ESTA persona, ya con
   * esqueleto propio, en pose de reposo y con sus clips re-apuntados.
   * Devuelve null si no hay forma de dibujarlo: entonces el avatar se
   * queda en el sustituto.
   */
  function crearCuerpo(
    participante: Participante,
    fuente: Personaje | null,
  ): { cuerpo: BABYLON.TransformNode; grupos: Partial<AnimacionesPersonaje> } | null {
    if (!fuente || !fuente.raiz) {
      anotarCuerpo(participante.id, "SUSTITUTO · sin plantilla para su skin");
      return null;
    }

    // clone(nombre, padreNuevo, noClonarHijos): null = sin padre, y sí quiere
    // los hijos (el cuerpo del personaje son decenas de mallas).
    const clon = fuente.raiz.clone(`cv_remoto_${participante.id}`, null, false);
    if (!clon) {
      anotarCuerpo(participante.id, "SUSTITUTO · clon fallido");
      return null;
    }

    clon.parent = null;
    clon.checkCollisions = false;
    clon.isPickable = false;

    // El clon hereda el transform del original (posición, escala y
    // rotación): la escala está bien calculada para el salón, así que
    // solo se pisan posición y rumbo.
    clon.position.set(0, ctx.sueloY, 0);
    clon.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, 0).multiply(
      fuente.rotacionBaseRaiz ?? BABYLON.Quaternion.Identity(),
    );

    // Esqueleto PROPIO de este clon (un clone del original, compartido
    // entre las mallas de ESTE clon): sin esqueleto estos .glb colapsan a
    // 0.01 u en el piso, porque el tamaño del cuerpo lo dan las matrices
    // de los huesos (medido con NullEngine: 0.01 u de vértices crudos
    // frente a 5.63 u dibujados con piel). El de la fuente NO se toca.
    const mallas = clon.getChildMeshes(false);
    const esqueletos = new Map<BABYLON.Skeleton, BABYLON.Skeleton>();
    for (const malla of mallas) {
      const original = malla.skeleton;
      if (original) {
        let copia = esqueletos.get(original);
        if (!copia) {
          // clone(nombre): el nombre es obligatorio en la firma; se usa el
          // del clon para poder identificarlo en la escena.
          copia = original.clone(`${clon.name}_huesos`);
          esqueletos.set(original, copia);
        }
        malla.skeleton = copia;
      }
      malla.checkCollisions = false;
      malla.isPickable = false;
    }

    if (mallas.length === 0) {
      console.warn(`[avataresRemotos] ${clon.name} no trae mallas: se usa el avatar de sustitución.`);
      clon.dispose(false, false);
      anotarCuerpo(participante.id, "SUSTITUTO · clon sin mallas");
      return null;
    }

    // Rompe el enlace con los nodos de la fuente y posa el cuerpo (ver
    // liberarEsqueleto): sin esto el remoto imitaría a quien se clonó.
    for (const copia of esqueletos.values()) liberarEsqueleto(copia, fuente);

    anotarCuerpo(participante.id, detalleDe(clon, mallas));

    return { cuerpo: clon, grupos: crearGruposDeClon(clon, esqueletos, fuente) };
  }

  // ---------------------------------------------------------------
  // ALTA Y BAJA DE AVATARES
  // ---------------------------------------------------------------

  function fijarObjetivo(avatar: AvatarRemoto, estado: Participante["estado"]): void {
    const manoAntes = avatar.manoAlzada;
    avatar.objetivo.set(estado.x, estado.y, estado.z);
    avatar.yawObjetivo = estado.yaw;
    avatar.caminando = estado.caminando;
    avatar.manoAlzada = estado.manoAlzada;
    avatar.sentado = estado.sentado;
    avatar.estadoRed = estado;
    aplicarClipRemoto(avatar);
    // Solo la subida apagada → encendida (el primer estado de alguien que ya
    // tenía la mano arriba no avisa: no es algo que "acaba de pasar").
    if (estado.manoAlzada && !manoAntes) ctx.alAlzarMano?.(avatar.nombre);
  }

  /**
   * Qué clip debe sonar en este avatar con el último estado de la red.
   * Misma prioridad que la máquina local (aplicarAnimacion en
   * funcionalidades.ts): sentado (con la mano si está alzada) → caminar →
   * mano alzada → parado. Lo que la skin no tenga cae al siguiente eslabón.
   */
  function elegirClipRemoto(avatar: AvatarRemoto): BABYLON.AnimationGroup | null {
    const g = avatar.grupos;
    const e = avatar.estadoRed;
    if (e.sentado) {
      if (e.manoAlzada && g.manoSentado) return g.manoSentado;
      return g.sentarse ?? g.parado ?? null;
    }
    if (e.caminando) return g.caminar ?? g.parado ?? null;
    if (e.manoAlzada) return g.manoParado ?? g.saludar ?? g.parado ?? null;
    return g.parado ?? null;
  }

  /**
   * Cambia el clip en reproducción SOLO si cambió el elegido: los estados
   * llegan a ~12/s y reiniciar el grupo en cada uno dejaría al cuerpo
   * siempre en el primer frame. Los clips de una sola pasada (sentarse,
   * mano sentada) arrancan sin loop y se quedan en su pose final, igual
   * que en la máquina local.
   */
  function aplicarClipRemoto(avatar: AvatarRemoto): void {
    const deseado = elegirClipRemoto(avatar);
    if (deseado === avatar.grupoActual) return;
    avatar.grupoActual?.stop();
    avatar.grupoActual = deseado;
    if (!deseado) return;
    const esPose = deseado === avatar.grupos.sentarse || deseado === avatar.grupos.manoSentado;
    deseado.play(!esPose);
  }

  /**
   * Alta de un avatar en escena. Es ASÍNRONA a propósito: primero aparece
   * la cápsula de sustitución con su etiqueta (la persona se ve enseguida,
   * aunque su skin tarde en cargar) y, en cuanto la plantilla de su skin
   * está lista, la cápsula se sustituye por su cuerpo real.
   */
  async function crearAvatar(participante: Participante): Promise<void> {
    if (avatares.has(participante.id) || creando.has(participante.id)) return;
    creando.add(participante.id);

    try {
      const raiz = crearAvatarSustituto(participante);
      anotarCuerpo(participante.id, `SUSTITUTO · cargando skin · alto ${altoDe(raiz).toFixed(2)} u`);
      const etiqueta = crearEtiqueta(participante.nombre, participante.rol, participante.id);
      const anillo = crearAnillo(participante.rol, participante.id);

      const avatar: AvatarRemoto = {
        id: participante.id,
        nombre: participante.nombre,
        raiz,
        rotacionBase: null,
        etiqueta,
        anillo,
        objetivo: new BABYLON.Vector3(participante.estado.x, ctx.sueloY, participante.estado.z),
        yawObjetivo: participante.estado.yaw,
        caminando: false,
        // Ya con el valor actual: así la primera llamada a fijarObjetivo no
        // cuenta como "acaba de levantar la mano" (no dispara el aviso).
        manoAlzada: participante.estado.manoAlzada,
        sentado: false,
        // Sin clips hasta que cargue el cuerpo real (la cápsula se queda aquí).
        grupos: {},
        grupoActual: null,
        estadoRed: participante.estado,
        fase: Math.random() * Math.PI * 2,
        baseY: ctx.sueloY,
        posicionRecibida: false,
      };
      fijarObjetivo(avatar, participante.estado);

      // El servidor spawna a quien entra en el centro de la clase con y=0 (aún
      // no ha publicado nada) y el suelo de ESTE mapa está en sueloY. Si el
      // estado de la lista es ese spawn vacío, se arranca en el suelo y espera
      // al primer movimiento de verdad; si no, es que esa persona ya estaba
      // dentro y su estado es real: se coloca ahí directamente.
      const vacio = esEstadoInicial(participante.estado);
      if (vacio) {
        avatar.objetivo.y = ctx.sueloY;
        avatar.baseY = ctx.sueloY;
        avatar.posicionRecibida = false;
      } else {
        avatar.posicionRecibida = true;
      }

      raiz.position.set(avatar.objetivo.x, avatar.objetivo.y, avatar.objetivo.z);
      etiqueta.position.set(avatar.objetivo.x, avatar.objetivo.y + alturaEtiqueta(), avatar.objetivo.z);
      anillo.position.set(avatar.objetivo.x, ctx.sueloY + 0.06, avatar.objetivo.z);

      avatares.set(participante.id, avatar);

      // ── cuerpo real, cuando su skin esté ──
      const fuente = await plantillaPara(participante);
      // Mientras cargaba pudo salir de la sala o caer la conexión: si ya
      // no está, no se dibuja (y si llegó a estar, `borrarAvatar` ya se
      // ocupó de la cápsula).
      if (!avatares.has(participante.id) || !ultimaLista.some((p) => p.id === participante.id)) return;
      if (!fuente) {
        anotarCuerpo(participante.id, "SUSTITUTO · sin skin disponible");
        return;
      }

      const cuerpoNuevo = crearCuerpo(participante, fuente);
      if (!cuerpoNuevo || !avatares.has(participante.id)) return; // se queda la cápsula
      const { cuerpo, grupos } = cuerpoNuevo;

      // Intercambio: el cuerpo nuevo nace en el sitio y con el rumbo del
      // avatar ya colocada; la etiqueta y el anillo no se tocan.
      const anterior = avatar.raiz;
      avatar.raiz = cuerpo;
      avatar.rotacionBase = fuente.rotacionBaseRaiz;
      cuerpo.position.copyFrom(anterior.position);
      cuerpo.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, avatar.yawObjetivo).multiply(
        fuente.rotacionBaseRaiz ?? BABYLON.Quaternion.Identity(),
      );
      avatar.grupos = grupos;
      anterior.dispose(false, true);
      // El cuerpo ya tiene sus clips: arranca el que toque con el último
      // estado que mandó (p. ej. si la skin cargó mientras estaba sentado).
      aplicarClipRemoto(avatar);
    } finally {
      creando.delete(participante.id);
    }
  }

  function borrarAvatar(id: string): void {
    const avatar = avatares.get(id);
    if (!avatar) return;
    avatares.delete(id);
    borrarAnotacion(id);

    // Sus grupos de animación son propios: apuntan a los huesos de ESTE
    // avatar, así que se liberan con él.
    avatar.grupoActual = null;
    for (const grupo of Object.values(avatar.grupos)) grupo?.dispose();

    // dispose() en la raíz se lleva también sus hijos (el cuerpo).
    // Los esqueletos clonados pertenecen SOLO a este avatar (están
    // compartidos entre sus mallas, así que el dispose de la malla no
    // los libera): se vacían aquí para no dejarlos colgados.
    const huesosDelAvatar = new Set<BABYLON.Skeleton>();
    for (const malla of avatar.raiz.getChildMeshes(false)) {
      if (malla.skeleton) huesosDelAvatar.add(malla.skeleton);
    }
    for (const esqueleto of huesosDelAvatar) esqueleto.dispose();

    avatar.etiqueta.material?.dispose();
    avatar.etiqueta.dispose();
    avatar.anillo.material?.dispose();
    avatar.anillo.dispose();
    avatar.raiz.dispose();
  }

  function borrarTodos(): void {
    for (const id of [...avatares.keys()]) borrarAvatar(id);
  }

  // ---------------------------------------------------------------
  // BUCLE DE SUAVIZADO (cada frame)
  // ---------------------------------------------------------------

  const observador = ctx.escena.onBeforeRenderObservable.add(() => {
    const dt = Math.min(ctx.escena.getEngine().getDeltaTime() / 1000, 0.05);
    // Suavizado exponencial: la fracción de camino que se recorre este
    // frame. Con k fijo depende de los FPS; con esto da igual en todos.
    const paso = 1 - Math.exp(-SUAVIZADO * dt);

    for (const avatar of avatares.values()) {
      if (!avatar.posicionRecibida) {
        colocar(avatar);
        continue;
      }

      const distancia = BABYLON.Vector3.Distance(avatar.raiz.position, avatar.objetivo);

      if (distancia > SALTO_MAXIMO) {
        // Salto grande (entró tarde, o se teletransportó): sin interpolar.
        avatar.raiz.position.copyFrom(avatar.objetivo);
      } else {
        avatar.raiz.position.x += (avatar.objetivo.x - avatar.raiz.position.x) * paso;
        avatar.raiz.position.z += (avatar.objetivo.z - avatar.raiz.position.z) * paso;
      }

      // La altura viene de la red (así los pies quedan en el suelo
      // también cuando el otro está sentado o en el atril).
      avatar.baseY += (avatar.objetivo.y - avatar.baseY) * paso;

      // Balanceo al caminar: solo para quien NO tiene clip de caminar
      // (la cápsula de sustitución o una skin sin ese clip). Con clip
      // real el cuerpo ya se mueve solo, y el doble rebote se ve raro.
      const bob =
        avatar.caminando && !avatar.grupos.caminar
          ? Math.sin(performance.now() * 0.009 + avatar.fase) * BOB_CAMINANDO
          : 0;
      avatar.raiz.position.y = avatar.baseY + bob;

      // Rumbo: se gira por el camino más corto. Sin esto, al pasar de
      // 179° a −179° (son 2° de verdad) daría una vuelta completa.
      const dif = angleToRadians(avatar.raiz, avatar.yawObjetivo);
      if (Math.abs(dif) > 1e-4) {
        aplicarRumbo(
          avatar.raiz,
          avatar.rotacionBase,
          avatar.raiz.rotationQuaternion,
          avatar.yawObjetivo,
          paso,
          dif,
        );
      }

      // La etiqueta y el anillo NO son hijos de la raíz a propósito: la
      // raíz está escalada al tamaño del salón (×0.0x) y un hijo
      // heredaría esa escala, con la etiqueta diminuta o gigante.
      avatar.etiqueta.position.set(
        avatar.raiz.position.x,
        avatar.raiz.position.y + alturaEtiqueta(),
        avatar.raiz.position.z,
      );
      avatar.anillo.position.set(
        avatar.raiz.position.x,
        ctx.sueloY + 0.06,
        avatar.raiz.position.z,
      );
    }
  });

  /**
   * Giro del avatar hacia el rumbo recibido, por el camino corto.
   * La raíz del .glb trae rotationQuaternion (el loader glTF la crea), así
   * que se compone igual que hace el jugador local en funcionalidades.ts.
   * `base` es la rotación `__root__` del cuerpo CONCRETO de este avatar
   * (cada skin puede traerla distinta), no la del cuerpo local.
   */
  function aplicarRumbo(
    raiz: BABYLON.TransformNode,
    base: BABYLON.Quaternion | null,
    actual: BABYLON.Quaternion | null,
    objetivo: number,
    paso: number,
    diferencia: number,
  ): void {
    const rotacionBase = (base ?? BABYLON.Quaternion.Identity()).clone();
    const destino = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, objetivo).multiply(rotacionBase);

    if (!actual) {
      raiz.rotationQuaternion = destino;
      return;
    }
    raiz.rotationQuaternion = BABYLON.Quaternion.Slerp(actual, destino, paso);

    // Si la diferencia era mínima, Slerp con pasos de 1/60 tampoco
    // llegaría nunca del todo: se fuerza el final del recorrido.
    if (Math.abs(diferencia) < 0.02) raiz.rotationQuaternion = destino;
  }

  /** Un avatar que acaba de llegar a la clase se coloca sin desplazarse. */
  function colocar(avatar: AvatarRemoto): void {
    avatar.raiz.position.copyFrom(avatar.objetivo);
    avatar.baseY = avatar.objetivo.y;
    avatar.posicionRecibida = true;
  }

  /** Diferencia de rumbo más corta entre el actual y el objetivo. */
  function angleToRadians(raiz: BABYLON.TransformNode, objetivo: number): number {
    const actual = raiz.rotationQuaternion
      ? raiz.rotationQuaternion.toEulerAngles().y
      : raiz.rotation.y;
    return Math.atan2(Math.sin(objetivo - actual), Math.cos(objetivo - actual));
  }

  // ---------------------------------------------------------------
  // CONEXIÓN CON LA RED
  // ---------------------------------------------------------------

  presencia = crearPresencia(ctx.clase, {
    alCambiarParticipantes: (participantes, miId) => {
      ultimaLista = participantes;

      // Sin id propio no se dibuja a nadie (ver nota de espera arriba).
      if (!miId) {
        ctx.alCambiarParticipantes(participantes, miId);
        return;
      }

      // Altas: los que no tengo en la escena. El alta es asíncrona (a veces
      // hay que cargar la skin de esa persona primero); `crearAvatar` se
      // protege sola contra dobles avisos.
      for (const participante of participantes) {
        if (participante.id === miId) continue; // uno mismo no se clona
        if (!avatares.has(participante.id)) void crearAvatar(participante);
      }
      // Bajas: los que ya no están en la lista del servidor.
      const ids = new Set(participantes.filter((p) => p.id !== miId).map((p) => p.id));
      for (const id of [...avatares.keys()]) {
        if (!ids.has(id)) borrarAvatar(id);
      }

      // Los que ya estaban: se actualiza el objetivo con el estado
      // más fresco que mande el servidor (el que acaba de entrar trae
      // su última posición guardada, no el origen).
      for (const participante of participantes) {
        const avatar = avatares.get(participante.id);
        if (avatar) fijarObjetivo(avatar, participante.estado);
      }

      ctx.alCambiarParticipantes(participantes, miId);
    },

    alMover: (id, estado) => {
      // Cinturón de seguridad: el servidor nunca reenvía el estado al que lo
      // manda (usa `socket.to`), pero si algún día lo hiciera, el avatar
      // propio no debe dibujarse ni moverse con uno mismo.
      if (id === presencia?.miId()) return;
      const avatar = avatares.get(id);
      if (!avatar) return;
      fijarObjetivo(avatar, estado);
      // El primero no se suaviza (venía del "aparece en el centro").
      if (!avatar.posicionRecibida) colocar(avatar);
    },

    alCambiarConexion: (estado, detalle) => {
      // Si se cae la conexión, los avatares que había en escena ya no
      // son de nadie: se borran para no dejar cuerpos fantasma clavados
      // en el salón. Cuando vuelva, el servidor manda la lista buena.
      if (estado === "cerrado" || estado === "error") borrarTodos();
      ctx.alCambiarConexion(estado, detalle);
    },

    alRechazar: (motivo) => ctx.alRechazar(motivo),

    // El contenido que otro publica en el tablero llega por aquí y se lo
    // entrega al mapa (que lo pinta en su pizarra) sin que el 3D tenga
    // que saber nada de sockets.
    alRecibirTablero: (mensaje) => ctx.alRecibirTablero?.(mensaje),
  });

  // El propio estado se lee en cada frame y se pasa al publicador, que
  // ya decide si toca enviarlo (ver red/presencia.ts).
  const observadorPublicacion = ctx.escena.onBeforeRenderObservable.add(() => {
    presencia?.publicar(ctx.estadoLocal());
  });

  function destruir(): void {
    presencia?.publicar({ ...ctx.estadoLocal(), sentado: false, enAtril: false, manoAlzada: false });
    presencia?.destruir();
    presencia = null;
    borrarTodos();

    // Las plantillas de skin cargadas para los remotos son de este módulo:
    // se liberan al final, cuando sus clones ya no existen (comparten
    // materiales con ellos). El cuerpo del jugador local no es suyo: no se
    // toca.
    for (const pendiente of plantillas.values()) {
      void pendiente.then((cuerpo) => {
        if (!cuerpo) return;
        for (const grupo of Object.values(cuerpo.animaciones)) grupo?.dispose();
        const esqueletos = new Set<BABYLON.Skeleton>();
        for (const malla of cuerpo.raiz.getChildMeshes(false)) {
          if (malla.skeleton) esqueletos.add(malla.skeleton);
        }
        for (const esqueleto of esqueletos) esqueleto.dispose();
        cuerpo.raiz.dispose(false, true);
      });
    }
    plantillas.clear();

    ctx.escena.onBeforeRenderObservable.remove(observador);
    ctx.escena.onBeforeRenderObservable.remove(observadorPublicacion);
  }

  ctx.limpiadores.push(destruir);

  function posicionCabeza(id: string): BABYLON.Vector3 | null {
    const avatar = avatares.get(id);
    if (!avatar || !avatar.posicionRecibida) return null;
    // Altura de la etiqueta del nombre: el cuadrito de vídeo se ancla AL
    // LADO de ese punto (derecha si cabe, izquierda si no), centrado en
    // vertical con la cabeza, en vez de flotar encima del personaje.
    return new BABYLON.Vector3(
      avatar.raiz.position.x,
      avatar.raiz.position.y + alturaEtiqueta(),
      avatar.raiz.position.z,
    );
  }

  function siluetas(): Array<Array<{ x: number; y: number; z: number }>> {
    const resultado: Array<Array<{ x: number; y: number; z: number }>> = [];
    for (const avatar of avatares.values()) {
      if (!avatar.posicionRecibida) continue;
      const puntos: Array<{ x: number; y: number; z: number }> = [];
      for (const malla of avatar.raiz.getChildMeshes(false)) {
        const esqueleto = malla.skeleton;
        if (!esqueleto) continue;
        for (const hueso of esqueleto.bones) {
          const p = hueso.getAbsolutePosition(malla);
          if (Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
            puntos.push({ x: p.x, y: p.y, z: p.z });
          }
        }
        break; // el primer esqueleto del cuerpo basta
      }
      if (puntos.length >= 6) resultado.push(puntos);
    }
    return resultado;
  }

  function nombreDe(id: string): string {
    return avatares.get(id)?.nombre ?? "";
  }

  return {
    participantes: () => presencia?.participantes() ?? [],
    miId: () => presencia?.miId() ?? null,
    publicarTablero: (mensaje) => presencia?.publicarTablero(mensaje),
    posicionCabeza,
    siluetas,
    anchoEtiqueta: () => anchoEtiqueta(),
    nombreDe,
    emitirSignaling: (evento, datos) => presencia?.emitirSignaling(evento, datos),
    escucharSignaling: (evento, fn) => presencia?.escucharSignaling(evento, fn) ?? (() => {}),
    destruir,
  };
}

// ---------------------------------------------------------------
// PANEL DE DEPURACIÓN DE CUERPOS REMOTOS (?debugRemotos)
// ---------------------------------------------------------------
// El .glb del personaje tiene una trampa que no se puede resolver
// a ojo: la malla llega con esqueleto y debajo hay un nodo
// `Armature` que la escala cien veces, así que el tamaño que ve el
// ojo y el que dan las cuentas no siempre son el mismo. Este panel
// imprime en la propia pantalla lo que el navegador está dibujando
// de verdad para cada cuerpo: de dónde salió, cuántas mallas tiene,
// a qué alto queda en unidades del salón y si su material llegó a
// compilarse (una malla con material sin compilar NO se ve, ni
// grande ni pequeña: no se ve).
//
// Solo aparece si la URL lleva ?debugRemotos, así que el salón de
// siempre va limpio.
const DEPURAR = new URLSearchParams(globalThis.location?.search ?? "").has("debugRemotos");

const anotaciones = new Map<string, string>();

function anotarCuerpo(id: string, texto: string): void {
  if (!DEPURAR) return;
  anotaciones.set(id.slice(0, 6), texto);
  pintarPanel();
}

function borrarAnotacion(id: string): void {
  if (!DEPURAR) return;
  anotaciones.delete(id.slice(0, 6));
  pintarPanel();
}

/** Crea (una sola vez) el recuadro fijo de la esquina. */
function crearPanel(): HTMLDivElement | null {
  const existente = document.getElementById("cv-debug-cuerpos");
  if (existente instanceof HTMLDivElement) return existente;

  const panel = document.createElement("div");
  panel.id = "cv-debug-cuerpos";
  panel.style.cssText = [
    "position:fixed",
    "left:12px",
    "bottom:12px",
    "z-index:9999",
    "max-width:44ch",
    "padding:8px 10px",
    "border-radius:8px",
    "background:rgba(12,14,18,0.82)",
    "color:#e8ecf2",
    "font:11px/1.5 ui-monospace,Menlo,monospace",
    "white-space:pre-wrap",
    "pointer-events:none",
  ].join(";");

  document.body.appendChild(panel);
  return panel;
}

function pintarPanel(): void {
  const panel = crearPanel();
  if (!panel) return;

  panel.textContent = "";
  const titulo = document.createElement("div");
  titulo.textContent = `cuerpos remotos: ${anotaciones.size} · alto esperado 5.61 u`;
  panel.appendChild(titulo);

  for (const [id, texto] of anotaciones) {
    const linea = document.createElement("div");
    linea.textContent = `${id} · ${texto}`;
    panel.appendChild(linea);
  }
}

/** Rango vertical en unidades del salón, medido sobre los vértices ya
 *  colocados (es lo que se dibuja) y sobre la caja que declara Babylon
 *  (es lo que él usa para decidir si se dibuja). Se muestran los dos
 *  porque no tienen por qué coincidir en un .glb. */
function medidasDe(nodo: BABYLON.TransformNode): { alto: number; caja: number } {
  let minV = Infinity;
  let maxV = -Infinity;
  let minC = Infinity;
  let maxC = -Infinity;

  for (const malla of nodo.getChildMeshes(false)) {
    malla.computeWorldMatrix(true);

    for (const esquina of malla.getBoundingInfo().boundingBox.vectorsWorld) {
      minC = Math.min(minC, esquina.y);
      maxC = Math.max(maxC, esquina.y);
    }

    // Con esqueleto los vértices crudos NO son lo que se dibuja (los mueve
    // el skinning: medido, 0.01 u de crudo frente a 5.63 u con piel). Para
    // esas mallas vale la caja que Babylon declaró, que sí refleja el
    // cuerpo; el bucle de vértices solo se usa en mallas estáticas.
    if (malla.skeleton) {
      minV = Math.min(minV, minC);
      maxV = Math.max(maxV, maxC);
      continue;
    }

    const datos = malla.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (!datos) continue;
    const mundo = malla.getWorldMatrix();
    const punto = new BABYLON.Vector3();
    for (let i = 0; i + 2 < datos.length; i += 3) {
      punto.set(datos[i], datos[i + 1], datos[i + 2]);
      const y = BABYLON.Vector3.TransformCoordinates(punto, mundo).y;
      minV = Math.min(minV, y);
      maxV = Math.max(maxV, y);
    }
  }

  return {
    alto: Number.isFinite(maxV - minV) ? maxV - minV : 0,
    caja: Number.isFinite(maxC - minC) ? maxC - minC : 0,
  };
}

function altoDe(nodo: BABYLON.TransformNode): number {
  return medidasDe(nodo).alto;
}

function detalleDe(clon: BABYLON.TransformNode, mallas: BABYLON.AbstractMesh[]): string {
  const { alto, caja } = medidasDe(clon);
  const nombre = clon.getChildMeshes(false)[0]?.name ?? "?";
  const listos = mallas.filter((m) => m.material?.isReadyForSubMesh(m, m.subMeshes?.[0] ?? null)).length;
  return `CLON · ${mallas.length} mallas (${nombre}) · alto ${alto.toFixed(2)} u · caja ${caja.toFixed(2)} u · material ${listos}/${mallas.length}`;
}
//
// Por qué un esqueleto CLONADO y no `malla.skeleton = null` (ni
// `malla.useBones = false`, que además no existe como setter:
// `useBones` en Babylon es un getter que sale de `_useBones &&
// computeBonesUsingShaders && skeleton`, así que la única palanca
// es el puntero `skeleton`):
// ponerlo a null deja `useBones` en falso, el material se compila
// sin la macro SKIN y la malla se dibuja con sus coordenadas de
// origen… que en ESTOS .glb significan un punto de 0.01 u en el
// piso: el cuerpo "de verdad" lo construye el skinning (medido con
// NullEngine: 0.01 u de vértices crudos frente a 5.63 u dibujados
// con piel). `skeleton.clone()` conserva la piel y, además, da al
// clon huesos propios.
//
// Y nada de esto toca al jugador local: cada malla tiene su propio
// puntero a esqueleto, así que el clon (y su esqueleto copiado)
// dejan al original con el suyo y sus animaciones siguen igual.
//
// ACTUALIZADO (medido con NullEngine, probarClonEnlace.mjs): con el
// esqueleto clonado NO bastaba. `Skeleton.clone()` copia además el
// enlace hueso→nodo del original —apuntando a los nodos del ORIGINAL—
// y, como los clips animan nodos, el remoto ejecutaba los pasos del
// cuerpo del que se clonó (65 de 65 huesos enlazados: al rotar un nodo
// del original, el clon se movía con él). Por eso a cada esqueleto
// clonado se le llama `linkTransformNode(null)` y se le pone antes la
// pose del clip "parado" (ver liberarEsqueleto): pose de pie propia,
// cero influencia externa, y el original intacto.
// ---------------------------------------------------------------
