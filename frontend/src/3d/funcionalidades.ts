// ============================================================
// FUNCIONALIDADES DEL AVATAR EN UN MAPA
// ------------------------------------------------------------
// Todo lo que un mapa necesita "para que el personaje camine,
// se siente y presente en el tablero" vive AQUÍ, y no se
// reescribe en cada mapa: se importa y se cablea.
//
//   import { crearFuncionalidades } from "./funcionalidades";
//   const func = crearFuncionalidades({ ...el mundo del mapa... });
//
// El mapa aporta el MUNDO (escena, sillas, atril, obstáculos y
// sus reglas de colisión) y recibe ya montado:
//
//   · caminar         WASD + colisiones + animación + cámara
//   · sentarse        E / botón "silla" (proximidad medida
//                     desde el MODELO 3D, no desde la cámara)
//   · presentar       R / botón, coloca al docente detrás del
//                     atril mirando a la clase
//   · cámara          B (1ª / 3ª persona)
//   · mano alzada     H / botón "mano"
//   · avisos          la píldora "Presiona E para sentarte"
// ============================================================

import * as BABYLON from "babylonjs";
import type { Personaje } from "./personaje";
import type { PuntoMundo } from "./tableroFuncionalidad";

// VELOCIDAD DE CAMINADO, en unidades por SEGUNDO.
// Antes era `0.15` por FRAME, así que dependía del monitor: a 60 fps eran 9 u/s (un
// trote) y a 144 Hz ¡21,6 u/s! Se multiplica por el tiempo real de cada frame, de modo
// que va igual en cualquier equipo. Baja el número si aún te parece rápido.
export const VELOCIDAD_CAMINAR = 4.0;

// Radio (XZ) del cuerpo usado para chocar. Coincide con el radio del elipsoide
// para que el muro "limite*", las mesas y el corrector de salón frenen en el mismo sitio.
export const RADIO_PERSONAJE = 0.55;

// Altura del OJO sobre el suelo cuando se va al atril sin cuerpo cargado
// (cámara suelta): 5.09 u — la misma que fija el salón para una persona de
// 1.76 m (ojo a 1.60 m; empty TEACH_01). Se suma a ctx.sueloY.
export const ALTURA_OJO_PROFESOR = 5.09;

// ---------------------------------------------------------------
// Tipos del mundo con los que trabaja cualquier mapa
// ---------------------------------------------------------------

export interface ParSilla {
  numero: number;
  posicionMundoSilla: BABYLON.Vector3;
  puntoSit: { posicion: BABYLON.Vector3; rotacionY: number };
}

export interface Atril {
  posicionAtril: BABYLON.Vector3;
  puntoEnsenar: { posicion: BABYLON.Vector3; rotacionY: number };
}

export interface ObstaculoSolido {
  nombre: string;
  min: BABYLON.Vector3;
  max: BABYLON.Vector3;
}

// ---------------------------------------------------------------
// Lo que el mapa le entrega a las funcionalidades
// ---------------------------------------------------------------

export interface ContextoFuncionalidades {
  /** Escena del mapa (de ahí salen el motor y el bucle de render). */
  escena: BABYLON.Scene;
  /** Altura del suelo del mapa en unidades del mundo (−0.789 en el salón). */
  sueloY: number;
  /**
   * Cámara del mapa: las funcionalidades le pegan el cuerpo y giran con ella.
   * Es UniversalCamera (y no Camera) porque el yaw de la mirada vive en
   * `rotation`, que está en TargetCamera.
   */
  camara: BABYLON.UniversalCamera;
  /** Cuerpo del avatar; null mientras aún no esté cargado. */
  personaje: () => Personaje | null;
  /** Pares de silla+clic de sentarse del mapa. */
  sillas: () => ParSilla[];
  /** Atril (si el mapa no tiene, se devuelve null y R no hace nada). */
  atril: () => Atril | null;
  /** Cajas sólidas (mesas, sillas, atril) con las que se calcula la orientación. */
  obstaculos: () => ObstaculoSolido[];

  // --- reglas de colisión: las define el mapa (son datos del mundo) ---
  recortarAlSalon: (posicion: BABYLON.Vector3, margen?: number) => void;
  posicionValida: (posicion: BABYLON.Vector3) => boolean;
  haySolape: (posicion: BABYLON.Vector3) => boolean;
  empujarFueraDeObstaculos: (posicion: BABYLON.Vector3) => void;

  /** Píldora de proximidad ("Presiona E para sentarte"). */
  aviso: HTMLElement;
  /** Píldora de mano alzada. */
  avisoMano: HTMLElement;
  /** Se usa para registrar los listeners y soltarlos al salir de la partida. */
  limpiadores: Array<() => void>;
  /** Radio y altura del cuerpo (por si el mapa los cambia). */
  radioPersonaje: number;
  alturaOjoProfesor: number;
  /** Distancia a la que aparecen los avisos de silla/atril. */
  distanciaProximidad?: number;

  /** Avisar al mapa de que el estado cambió (para reflejarlo en la barra). */
  alCambiarEstado: () => void;
  /** Refrescar el tablero con la silueta del cuerpo (recorte del vídeo). */
  alActualizarTablero: (silueta: PuntoMundo[] | null) => void;
  /** Al salir del atril: el mapa cierra aquí su menú del tablero. */
  alSalirDelAtril?: () => void;
}

// ---------------------------------------------------------------
// Estado que el mapa puede leer en cualquier momento
// ---------------------------------------------------------------

export interface EstadoFuncionalidades {
  sentado: boolean;
  enEscritorio: boolean;
  terceraPersona: boolean;
  manoAlzada: boolean;
  cercaDeSilla: boolean;
  cercaDelAtril: boolean;
}

export interface Funcionalidades {
  /** Acciones compartidas por el teclado (E / R / B / H) y la barra de botones. */
  alternarSentado: () => void;
  alternarAtril: () => void;
  alternarCamara: () => void;
  alternarMano: () => void;
  /**
   * Saludo corto (emote 👋): levanta la mano ~3.5 s sin tocar el estado de la
   * mano alzada (H), que sigue con su propio temporizador de 4 s.
   */
  saludar: () => void;
  /** Estado para pintar la barra u otra UI del mapa. */
  estado: () => EstadoFuncionalidades;
  /** true mientras el docente está presentando en el atril. */
  enElAtril: () => boolean;
  /** Limpia timers y avisos al salir de la partida. */
  destruir: () => void;
}

// ============================================================
export function crearFuncionalidades(ctx: ContextoFuncionalidades): Funcionalidades {
  const distanciaMaximaProximidad = ctx.distanciaProximidad ?? 3.5;

  let modoTerceraPersona = false;
  let sentado = false;
  let enEscritorio = false;
  let parCercano: ParSilla | null = null;
  let cercaDelAtril = false;
  let posicionGuardada: BABYLON.Vector3 | null = null;
  let rotacionGuardada = 0;
  let manoAlzada = false;
  let temporizadorMano: number | null = null;

  // ── MÁQUINA DE ANIMACIÓN ────────────────────────────────────────────────────
  // `moviendose` se reinicia en cada frame y lo pone el bloque de movimiento;
  // los demás viven hasta que cambie la acción o se destruya el módulo.
  let moviendose = false;
  let saludando = false;
  let temporizadorSaludo: number | null = null;
  let grupoAnimado: BABYLON.AnimationGroup | null = null;
  let personajeAnimado: Personaje | null = null;

  // -----------------------------------------------------------------------
  // TECLAS DE MOVIMIENTO (WASD). Se registran aquí y se soltarán con
  // limpiadores, así un mapa nuevo no tiene que volver a cablearlas.
  // -----------------------------------------------------------------------
  const teclasPresionadas: { [key: string]: boolean } = {};

  const alPulsarTecla = (e: KeyboardEvent) => {
    teclasPresionadas[e.key.toLowerCase()] = true;
  };
  const alSoltarTecla = (e: KeyboardEvent) => {
    teclasPresionadas[e.key.toLowerCase()] = false;
  };
  window.addEventListener("keydown", alPulsarTecla);
  window.addEventListener("keyup", alSoltarTecla);
  ctx.limpiadores.push(() => {
    window.removeEventListener("keydown", alPulsarTecla);
    window.removeEventListener("keyup", alSoltarTecla);
  });

  // -----------------------------------------------------------------------
  // SILUETA DEL PERSONAJE (para el tablero)
  //
  // El <iframe> de YouTube y el lienzo de escritura son HTML y se pintan
  // SIEMPRE encima del canvas 3D: al mirar de frente la cabeza del personaje
  // quedaba tapada por el vídeo. Aquí se le entregan al tablero los huesos del
  // esqueleto (posición de MUNDO, ya con la escala y la rotación del modelo)
  // y él se encarga de proyectarlos y abrir el hueco con su forma.
  //
  // Solo en 3ª persona: en 1ª la cámara está puesta en la cabeza del modelo,
  // los huesos le quedan detrás o rozándole y no hay nada que recortar.
  // -----------------------------------------------------------------------
  function siluetaDeLaPersona(): PuntoMundo[] | null {
    const personaje = ctx.personaje();
    if (!modoTerceraPersona || !personaje || !personaje.esqueleto || !personaje.malla) return null;

    const puntos: PuntoMundo[] = [];
    for (const hueso of personaje.esqueleto.bones) {
      // getAbsolutePosition(malla) aplica la matriz de la malla: sin ella los
      // huesos saldrían en el espacio del esqueleto (cerca del origen) y el
      // hueco aparecería en el sitio equivocado.
      const p = hueso.getAbsolutePosition(personaje.malla);
      if (Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
        puntos.push({ x: p.x, y: p.y, z: p.z });
      }
    }
    return puntos.length >= 6 ? puntos : null;
  }

  /**
   * Coloca la cámara donde le toca según el cuerpo 3D y el modo 1ª/3ª persona.
   *
   * La usan dos sitios: el bucle de render (caminando) y los teletransportes
   * (R en el atril), para que cambiar de persona o girar la cabeza se comporte
   * igual estés presentando o caminando.
   *
   * Usa el yaw de la CÁMARA y no el del cuerpo: al escribir el cuaternión de la
   * raíz, Babylon pone `raiz.rotation` a cero y el offset dejaría de girar.
   */
  function pegarCamaraAlCuerpo(): void {
    const personaje = ctx.personaje();
    if (!personaje) return;
    const yaw = ctx.camara.rotation.y;
    const offsetActual = modoTerceraPersona
      ? (personaje.offsetTerceraPersona || new BABYLON.Vector3(0, 2.5, -4))
      : (personaje.offsetPrimeraPersona || new BABYLON.Vector3(0, 1.7, 0.2));

    const matrizRotacion = BABYLON.Matrix.RotationY(yaw);
    const offsetMundo = BABYLON.Vector3.TransformCoordinates(offsetActual, matrizRotacion);

    ctx.camara.position.copyFrom(personaje.raiz.position.add(offsetMundo));
    // En tercera persona el offset puede sacar la cámara del salón aunque la persona
    // esté dentro: se recorta a los límites del mesh "room".
    ctx.recortarAlSalon(ctx.camara.position);
  }

  function alternarCamara(): void {
    modoTerceraPersona = !modoTerceraPersona;
    ctx.alCambiarEstado();
  }

  function alternarAtril(): void {
    const atril = ctx.atril();
    const personaje = ctx.personaje();
    const obstaculos = ctx.obstaculos();

    if (!enEscritorio && cercaDelAtril && atril) {
      // Se guarda la posición del MODELO (no de la cámara): al salir, la cámara se
      // vuelve a derivar del cuerpo y así el cuerpo no salta de sitio.
      posicionGuardada = personaje
        ? personaje.raiz.position.clone()
        : ctx.camara.position.clone();
      rotacionGuardada = ctx.camara.rotation.y;

      // ── ¿HACIA DÓNDE MIRA? ─────────────────────────────────────────────────
      // "Al frente" = hacia donde están los estudiantes. Se calcula con el centro de
      // todas las mesas y sillas en vez de fiarse del empty "TEACH" del .glb: así el
      // profesor mira a la clase pase como pase el modelo, y el tablero le queda a la
      // espalda.
      let centroX = 0;
      let centroZ = 0;
      for (const obs of obstaculos) {
        centroX += (obs.min.x + obs.max.x) / 2;
        centroZ += (obs.min.z + obs.max.z) / 2;
      }
      centroX /= Math.max(1, obstaculos.length);
      centroZ /= Math.max(1, obstaculos.length);

      const alFrente = new BABYLON.Vector3(
        centroX - atril.posicionAtril.x,
        0,
        centroZ - atril.posicionAtril.z
      );
      if (alFrente.lengthSquared() < 1e-6) {
        alFrente.x = 1;
        alFrente.z = 0;
      }
      alFrente.normalize();

      // Convención medida con un NullEngine de Babylon 9.21: yaw=0 mira a +Z y
      // yaw=π/2 mira a +X, es decir yaw = atan2(dir.x, dir.z).
      const rumbo = Math.atan2(alFrente.x, alFrente.z);

      // ── ¿DÓNDE SE PONE? ────────────────────────────────────────────────────
      // Detrás del atril hay que retroceder su media profundidad + el radio del
      // cuerpo + un hueco, o el modelo queda dentro de la madera. La caja que se usa
      // es la más cercana al centro del atril, que es la del propio atril.
      let mediaFondo = 0.6;
      let distanciaMejor = Infinity;
      for (const obs of obstaculos) {
        const dx = (obs.min.x + obs.max.x) / 2 - atril.posicionAtril.x;
        const dz = (obs.min.z + obs.max.z) / 2 - atril.posicionAtril.z;
        const distancia = Math.hypot(dx, dz);
        if (distancia < distanciaMejor) {
          distanciaMejor = distancia;
          // proyección de la caja sobre la dirección de la clase
          mediaFondo =
            (Math.abs(alFrente.x) * (obs.max.x - obs.min.x) +
              Math.abs(alFrente.z) * (obs.max.z - obs.min.z)) /
            2;
        }
      }

      const detrasDelAtril = new BABYLON.Vector3(
        atril.posicionAtril.x - alFrente.x * (mediaFondo + ctx.radioPersonaje + 0.35),
        ctx.sueloY, // el suelo REAL del mapa, para no dejar el cuerpo flotando en el aire
        atril.posicionAtril.z - alFrente.z * (mediaFondo + ctx.radioPersonaje + 0.35)
      );

      // La red de seguridad del bucle de render NO corre mientras se está en el
      // atril, así que aquí se corrige a mano por si el cálculo lo dejara rozando.
      if (ctx.haySolape(detrasDelAtril)) ctx.empujarFueraDeObstaculos(detrasDelAtril);
      ctx.recortarAlSalon(detrasDelAtril, ctx.radioPersonaje);

      // La cámara mira al frente y el cuerpo se coloca justo detrás apuntando igual.
      // La orientación se mantiene mientras dura el atril (el tablero, a la espalda),
      // aunque el usuario gire la cabeza para mirar a los estudiantes.
      ctx.camara.rotation.y = rumbo;
      if (personaje) {
        personaje.raiz.position.copyFrom(detrasDelAtril);
        if (personaje.raiz.rotationQuaternion) {
          // Raíz glTF con rotationQuaternion: hay que componer con la rotación base
          // del loader, igual que hace el bucle de render al caminar.
          const base = personaje.rotacionBaseRaiz ?? BABYLON.Quaternion.Identity();
          personaje.raiz.rotationQuaternion =
            BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, rumbo).multiply(base);
        } else {
          personaje.raiz.rotation.y = rumbo;
        }
        pegarCamaraAlCuerpo();
      } else {
        ctx.camara.position = detrasDelAtril.add(
          new BABYLON.Vector3(0, ctx.alturaOjoProfesor, 0)
        );
      }

      enEscritorio = true;
      ctx.aviso.style.display = "none";
    } else if (enEscritorio) {
      if (posicionGuardada && personaje) {
        personaje.raiz.position = posicionGuardada.clone();
        personaje.raiz.position.y = ctx.sueloY;
      }
      ctx.camara.rotation.y = rotacionGuardada;
      enEscritorio = false;
      ctx.alSalirDelAtril?.();
    }
    ctx.alCambiarEstado();
  }

  function alternarSentado(): void {
    const personaje = ctx.personaje();
    if (!sentado && parCercano) {
      posicionGuardada = personaje
        ? personaje.raiz.position.clone()
        : ctx.camara.position.clone();
      rotacionGuardada = ctx.camara.rotation.y;

      // La cámara va al punto de OJO del empty sit_*; el cuerpo va a la misma XZ
      // pero con los PIES en el suelo real del mapa (SUELO_Y), si no quedaba
      // hundido en el suelo o flotando.
      ctx.camara.position = parCercano.puntoSit.posicion.clone();
      if (personaje) {
        personaje.raiz.position = new BABYLON.Vector3(
          parCercano.puntoSit.posicion.x,
          ctx.sueloY,
          parCercano.puntoSit.posicion.z
        );
      }

      sentado = true;
      ctx.aviso.style.display = "none";
    } else if (sentado) {
      if (posicionGuardada && personaje) {
        personaje.raiz.position = posicionGuardada.clone();
        personaje.raiz.position.y = ctx.sueloY;
      }
      ctx.camara.rotation.y = rotacionGuardada;
      sentado = false;
    }
    ctx.alCambiarEstado();
  }

  function alternarMano(): void {
    manoAlzada = !manoAlzada;
    if (manoAlzada) {
      ctx.avisoMano.style.display = "block";
      if (temporizadorMano) clearTimeout(temporizadorMano);
      temporizadorMano = window.setTimeout(() => {
        ctx.avisoMano.style.display = "none";
        manoAlzada = false;
        ctx.alCambiarEstado();
      }, 4000);
    } else {
      ctx.avisoMano.style.display = "none";
      if (temporizadorMano) clearTimeout(temporizadorMano);
    }
    ctx.alCambiarEstado();
  }

  // -----------------------------------------------------------------------
  // MÁQUINA DE ANIMACIÓN + SALUDO
  // -----------------------------------------------------------------------
  /**
   * Elige el clip que debe sonar en este frame. Prioridad: sentado → caminar
   * → saludar (mano arriba o emote) → parado. Si el slot pedido no existe
   * (hoy: caminar/sentarse/saludar; el .glb solo trae "parado") se cae a
   * "parado" para que no siga sonando el clip anterior — p. ej. caminando
   * mientras se está sentado.
   */
  function aplicarAnimacion(): void {
    const personaje = ctx.personaje();
    if (!personaje) return;
    const anim = personaje.animaciones;

    // Si cambió el cuerpo (otra skin, recarga de personaje), los grupos viejos
    // pertenecían al esqueleto anterior: se olvidan y se arranca de cero.
    if (personaje !== personajeAnimado) {
      personajeAnimado = personaje;
      grupoAnimado = null;
    }

    const preferido = sentado
      ? anim.sentarse
      : moviendose
        ? anim.caminar
        : manoAlzada || saludando
          ? anim.saludar
          : null;
    const deseado = (preferido ?? anim.parado) || null;

    if (!deseado || deseado === grupoAnimado) return;
    grupoAnimado?.stop();
    grupoAnimado = deseado;
    // El clip de sentarse es una pose con final (no en bucle); todos los
    // demás —parado, caminar, saludar— se repiten.
    deseado.play(deseado !== anim.sentarse);
  }

  /** Saludo rápido (emote 👋): mueve el brazo 3.5 s sin tocar la mano alzada (H). */
  function saludar(): void {
    saludando = true;
    if (temporizadorSaludo) clearTimeout(temporizadorSaludo);
    temporizadorSaludo = window.setTimeout(() => {
      saludando = false;
      temporizadorSaludo = null;
      ctx.alCambiarEstado();
    }, 3500);
  }

  // -----------------------------------------------------------------------
  // BUCLE DE ACTUALIZACIÓN (registrado en onBeforeRenderObservable)
  // -----------------------------------------------------------------------
  function actualizar(): void {
    const personaje = ctx.personaje();
    // Se reinicia cada frame: lo pone a true el bloque de movimiento de abajo.
    moviendose = false;

    if (personaje && !sentado && !enEscritorio) {
      // Tiempo real de este frame en segundos. El tope de 0.05 s evita un salto de
      // sitio si el navegador se queda sin frames (cambio de pestaña, pantalla de
      // carga...): sin él, una pausa de 2 s mandaría al personaje 8 unidades más allá.
      const dt = Math.min(ctx.escena.getEngine().getDeltaTime() / 1000, 0.05);
      const velocidad = VELOCIDAD_CAMINAR * dt;

      // IMPORTANTE: la raíz glTF tiene rotationQuaternion, y en ese caso Babylon ignora
      // raiz.rotation por completo. Usamos el cuaternión (y preservamos la rotación base
      // del loader para no romper la conversión diestro→zurdo del modelo).
      const yaw = ctx.camara.rotation.y;
      if (personaje.raiz.rotationQuaternion) {
        const rotacionBase = personaje.rotacionBaseRaiz ?? BABYLON.Quaternion.Identity();
        // yaw * base => aplica primero la rotación base del loader y encima el giro de la cámara
        personaje.raiz.rotationQuaternion =
          BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, yaw).multiply(rotacionBase);
      } else {
        personaje.raiz.rotation.y = yaw;
      }

      const avance = ctx.camara.getForwardRay().direction;
      avance.y = 0;
      avance.normalize();

      const derecha = ctx.camara.getDirection(BABYLON.Axis.X);
      derecha.y = 0;
      derecha.normalize();

      // Movimiento con colisiones: acumulamos todo el desplazamiento del frame y lo
      // resolvemos con moveWithCollisions(), que hace rodar el elipsoide de la raíz
      // contra las mallas con checkCollisions (room y muros "limite*").
      // addInPlace() no servía: escribía la posición a mano y el motor de colisiones
      // nunca se enteraba. Las mesas/sillas/atril se resuelven debajo, aparte.
      const desplazamiento = BABYLON.Vector3.Zero();

      if (teclasPresionadas["w"]) {
        desplazamiento.addInPlace(avance.scale(velocidad));
        moviendose = true;
      }
      if (teclasPresionadas["s"]) {
        desplazamiento.addInPlace(avance.scale(-velocidad));
        moviendose = true;
      }
      if (teclasPresionadas["d"]) {
        desplazamiento.addInPlace(derecha.scale(velocidad));
        moviendose = true;
      }
      if (teclasPresionadas["a"]) {
        desplazamiento.addInPlace(derecha.scale(-velocidad));
        moviendose = true;
      }

      if (moviendose && desplazamiento.lengthSquared() > 0) {
        // Suelo plano y sin gravedad: fijamos la altura antes/después para que la
        // respuesta del choque no pueda "subir" al personaje (p. ej. al rozar una silla).
        const alturaAntes = personaje.raiz.position.y;
        const antesX = personaje.raiz.position.x;
        const antesZ = personaje.raiz.position.z;

        personaje.raiz.moveWithCollisions(desplazamiento);
        personaje.raiz.position.y = alturaAntes;
        ctx.recortarAlSalon(personaje.raiz.position, ctx.radioPersonaje);

        // RECHAZO POR EJE, NO EMPUJÓN.
        // Si la posición resultante no es válida (se salió del salón o cayó dentro de
        // un mueble), se deshace el eje que la causó. Por qué no "empujar hacia fuera":
        // con dos cajas pegadas, expulsar a alguien de una lo deja dentro de la otra y
        // se queda bloqueado sin poder caminar (era el fallo de las sillas).
        // Al rechazar, el cuerpo nunca ocupa una posición que solape: se detiene en la
        // boca del mueble, desliza por sus caras y siempre puede retroceder.
        if (!ctx.posicionValida(personaje.raiz.position)) {
          const movidoX = personaje.raiz.position.x;
          const movidoZ = personaje.raiz.position.z;

          personaje.raiz.position.x = antesX;
          const valeSinX = ctx.posicionValida(personaje.raiz.position);

          personaje.raiz.position.x = movidoX;
          personaje.raiz.position.z = antesZ;
          const valeSinZ = ctx.posicionValida(personaje.raiz.position);

          if (valeSinX) {
            // Solo el eje X metía el cuerpo: se conserva el avance en Z (deslizamiento).
            personaje.raiz.position.x = antesX;
            personaje.raiz.position.z = movidoZ;
          } else if (!valeSinZ) {
            // Los dos ejes eran problemáticos: volver a la última posición válida.
            personaje.raiz.position.x = antesX;
            personaje.raiz.position.z = antesZ;
          }
          // valeSinZ: la posición ya quedó en {movidoX, antesZ}, que es válida.
        }
      }

      // RED DE SEGURIDAD. En el caminar normal nunca hace nada (el cuerpo ya está
      // fuera). Solo actúa si un teletransporte (sentarte con E / atril con R) o algo
      // imprevisto dejó el cuerpo dentro de un mueble, y repite hasta dejarlo libre.
      if (ctx.haySolape(personaje.raiz.position)) {
        ctx.empujarFueraDeObstaculos(personaje.raiz.position);
      }
      ctx.recortarAlSalon(personaje.raiz.position, ctx.radioPersonaje);

      pegarCamaraAlCuerpo();
    }

    // MÁQUINA DE ANIMACIÓN. Corre SIEMPRE (también sentado y en el atril): el
    // bloque de movimiento de arriba se salta esos estados y `sentado` solo se
    // lee aquí abajo. En el atril no hay clip propio: se queda en "parado".
    aplicarAnimacion();

    // Se calcula siempre, aunque estés sentado o en el atril: el iframe de YouTube
    // se posiciona respecto a la cámara (que sí se mueve al teletransportarte al
    // atril) y la textura de vídeo necesita su refresco de fotograma. La silueta
    // va aparte: es lo que impide que el vídeo tape al personaje.
    ctx.alActualizarTablero(siluetaDeLaPersona());

    // EN EL ATRIL: el cuerpo no camina (WASD está anulado), pero la cámara sigue
    // pegada a él. Sin esta línea, B (1ª/3ª persona) y el giro del ratón quedarían
    // congelados mientras presentas.
    if (enEscritorio) pegarCamaraAlCuerpo();

    if (sentado || enEscritorio) {
      ctx.alCambiarEstado();
      return;
    }

    // PROXIMIDAD DESDE EL MODELO 3D, NO DESDE LA CÁMARA.
    // En tercera persona la cámara va ~6.8 unidades detrás del cuerpo: medir desde ella
    // hacía que el aviso de "sentarte"/"atril" apareciera y desapareciera sin que el
    // personaje se moviera.
    const posicionPersona = personaje ? personaje.raiz.position : ctx.camara.position;
    const posPersona2D = new BABYLON.Vector3(posicionPersona.x, 0, posicionPersona.z);

    let masCercana: ParSilla | null = null;
    let menorDistancia = Infinity;

    for (const par of ctx.sillas()) {
      const posSilla2D = new BABYLON.Vector3(
        par.posicionMundoSilla.x,
        0,
        par.posicionMundoSilla.z
      );
      const distancia = BABYLON.Vector3.Distance(posPersona2D, posSilla2D);
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        masCercana = par;
      }
    }

    let distanciaAtril = Infinity;
    const atril = ctx.atril();
    if (atril) {
      const posAtril2D = new BABYLON.Vector3(atril.posicionAtril.x, 0, atril.posicionAtril.z);
      distanciaAtril = BABYLON.Vector3.Distance(posPersona2D, posAtril2D);
    }

    if (atril && distanciaAtril < distanciaMaximaProximidad && distanciaAtril <= menorDistancia) {
      cercaDelAtril = true;
      parCercano = null;
      ctx.aviso.innerText = "Presiona R para presentar en el atril";
      ctx.aviso.style.display = "block";
    } else if (masCercana && menorDistancia < distanciaMaximaProximidad) {
      parCercano = masCercana;
      cercaDelAtril = false;
      ctx.aviso.innerText = "Presiona E para sentarte";
      ctx.aviso.style.display = "block";
    } else {
      parCercano = null;
      cercaDelAtril = false;
      ctx.aviso.style.display = "none";
    }

    ctx.alCambiarEstado();
  }

  const observador = ctx.escena.onBeforeRenderObservable.add(actualizar);
  ctx.limpiadores.push(() => ctx.escena.onBeforeRenderObservable.remove(observador));

  return {
    alternarSentado,
    alternarAtril,
    alternarCamara,
    alternarMano,
    saludar,
    enElAtril: () => enEscritorio,
    estado: () => ({
      sentado,
      enEscritorio,
      terceraPersona: modoTerceraPersona,
      manoAlzada,
      cercaDeSilla: Boolean(parCercano),
      cercaDelAtril,
    }),
    destruir: () => {
      if (temporizadorMano) clearTimeout(temporizadorMano);
      temporizadorMano = null;
      manoAlzada = false;
      if (temporizadorSaludo) clearTimeout(temporizadorSaludo);
      temporizadorSaludo = null;
      saludando = false;
      grupoAnimado?.stop();
      grupoAnimado = null;
      personajeAnimado = null;
      ctx.aviso.style.display = "none";
      ctx.avisoMano.style.display = "none";
    },
  };
}
