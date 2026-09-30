/**
 * TABLERO DEL AULA — toda la funcionalidad del proyector en un solo archivo.
 *
 * Módulo con forma de API, igual que `src/ui/barraUsuario.ts` y
 * `src/ui/menuAjustes.ts`: el mapa solo crea el tablero con la malla que midió en
 * su .glb y llama a sus métodos. No reimplementa botones, ni pdf.js, ni la API de
 * YouTube, ni la captura de pantalla. Cualquier mapa o partida nueva lo reutiliza:
 *
 *   const tablero = crearTablero({
 *     pantalla,                       // la malla de proyección del mapa
 *     material,                       // su material emisivo
 *     scene,
 *     volumen: () => volumenGeneral,  // el mapa es dueño del volumen
 *   });
 *
 *   tablero.abrirMenu();        // con P, mientras se está en el atril
 *   tablero.actualizar();       // en cada frame (proyecta el iframe de YouTube)
 *   tablero.refrescarVolumen(); // cuando cambia el 🔊 / el slider de ajustes
 *   tablero.destruir();         // al salir de la partida
 *
 * QUÉ SABE HACER
 *   · PDF → diapositivas (pdf.js), imágenes/galerías y vídeo del ordenador.
 *   · Link de YouTube montado con la IFrame Player API, para que 🔊 lo silencie
 *     de verdad (un <iframe> normal no expone `.volume`).
 *   · Compartir pantalla (getDisplayMedia) proyectada sobre la misma malla.
 *   · Limpiar, pausar/reanudar (Espacio) y pasar diapositivas (←/→).
 *
 * VOLUMEN: este módulo SOLO LEE el volumen que le pasa el mapa; nunca decide ni
 * toca el del portátil. El slider manda sobre el sonido de la APP (vídios,
 * pantalla compartida y, cuando llegue el chat por proximidad, las voces), que
 * siempre multiplica con el volumen del sistema operativo.
 */

import * as BABYLON from "babylonjs";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { homografia, aplicar, invertir, matriz3d, type Punto } from "./homografia";
import { paginasDesdeLienzos, descargarPdf } from "./descargarPDF";

// Configuración del worker de PDF.js (usado por convertirPdfAImagenes).
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

/**
 * Lo que devuelve `proyectarPantalla`: la caja de la pizarra en pantalla y la
 * homografía que pega el contenido justo sobre sus cuatro esquinas.
 *
 * Sin la homografía el contenido se colocaba en la CAJA del trapecio, que crece
 * y se desplaza a un lado según el ángulo: el vídeo parecía que andaba detrás
 * de la persona en vez de quedarse clavado en la pizarra.
 */
interface RectPizarra {
  visible: boolean;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** Nula cuando la pizarra no se puede pegar (de canto, a medias…). */
  homografia: number[] | null;
}

/**
 * Un punto de un cuerpo en coordenadas del MUNDO (p. ej. un hueso del
 * personaje). El mapa se lo pasa a `actualizar()` para que el contenido no
 * tape lo que queda por delante de la pizarra.
 *
 * ¿Por qué hace falta? En 3D la persona pasa por delante del vídeo, pero el
 * <iframe> de YouTube y el lienzo son HTML y el HTML SIEMPRE se pinta encima
 * del canvas: sin este recorte, al mirar de frente el vídeo quedaba encima de
 * la cabeza del personaje. Con la silueta se le abre un agujero con su forma y
 * se ve el personaje por encima, como en el mundo real.
 */
export interface PuntoMundo {
  x: number;
  y: number;
  z: number;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export interface OpcionesTablero {
  /** Malla de proyección que crea el mapa (p. ej. anclada al empty "tablero_01"). */
  pantalla: BABYLON.Mesh;
  /** Material de esa malla: aquí se enchufa la textura de cada contenido. */
  material: BABYLON.StandardMaterial;
  /** Escena de esta partida. */
  scene: BABYLON.Scene;
  /** Volumen general vigente (0..1). El tablero solo lo lee. */
  volumen: () => number;
}

export interface Tablero {
  /** Abre el menú "Publicar en el tablero" y libera el ratón para poder clicarlo. */
  abrirMenu: () => void;
  cerrarMenu: () => void;
  menuAbierto: () => boolean;
  /** Proyecta una imagen o una página ya convertida. */
  mostrarImagen: (url: string) => void;
  /** Proyecta un vídeo por URL (blob o remota) y lo deja en bucle. */
  mostrarVideo: (url: string) => void;
  /** Devuelve false si la cadena no contiene un ID de YouTube válido. */
  publicarYoutube: (url: string) => boolean;
  /** Pide permiso al navegador y proyecta la pantalla/ventana/pestaña elegida. */
  compartirPantalla: () => Promise<void>;
  cambiarDiapositiva: (direccion: 1 | -1) => void;
  /** Espacio: pausa o reanuda el vídeo que esté en el tablero. */
  alternarPausa: () => void;
  /** Borra todo lo proyectado (Supr / Backspace o botón 🗑️). */
  limpiar: () => void;
  /** ¿Hay algo publicado ahora mismo? */
  hayContenido: () => boolean;
  /** TABLERO INTELIGENTE: escribe con el ratón o el dedo sobre la pizarra. */
  escribirEnElTablero: () => void;
  /** Deja de escribir sin borrar lo escrito (Esc o ✔ Listo). */
  terminarDeEscribir: () => void;
  /** true mientras se esté escribiendo (el ratón debe quedarse libre). */
  dibujoAbierto: () => boolean;
  /**
   * PANTALLA EN GRANDE: el contenido del tablero a pantalla completa para quien
   * la abre (clic sobre la pantalla estando lejos). Mueve el propio iframe de
   * YouTube o el <video> dentro de la caja; al cerrarlos devuelve a su sitio.
   */
  abrirPantallaCompleta: () => void;
  cerrarPantallaCompleta: () => void;
  pantallaCompletaAbierta: () => boolean;
  /** Vuelve a aplicar `opciones.volumen()` a todo lo que suena en el tablero. */
  refrescarVolumen: () => void;
  /**
   * Llamar en cada frame. `silueta` (opcional) son puntos en coordenadas de
   * mundo que deben verse POR DELANTE del contenido —normalmente los huesos
   * del personaje en 3ª persona—: con ellos se recortan el iframe de YouTube
   * y el lienzo para que la persona no quede tapada por el vídeo. Maps que no
   * lo usen pueden llamar `actualizar()` sin argumentos.
   */
  actualizar: (silueta?: readonly PuntoMundo[] | null) => void;
  /** Retira el menú, el cartel y los inputs del DOM y suelta la captura. */
  destruir: () => void;
}

// ---------------------------------------------------------------------------
// YouTube: tipos mínimos de la IFrame Player API (no hay paquete de tipos)
// ---------------------------------------------------------------------------

interface ReproductorYoutube {
  setVolume: (volumen: number) => void; // 0..100
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
}

interface FabricaYoutube {
  Player: new (
    ancla: HTMLElement,
    opciones: {
      videoId?: string;
      playerVars?: Record<string, number | string | boolean>;
      events?: Record<string, (evento: { target: ReproductorYoutube }) => void>;
    }
  ) => ReproductorYoutube;
}

export function crearTablero(opciones: OpcionesTablero): Tablero {
  const { pantalla, material, scene } = opciones;

  // -------------------------------------------------------------------------
  // DOM propio: menú, inputs ocultos, cartel de carga y estilo de YouTube.
  // Se crea aquí (y se borra en destruir()) para que entrar y salir de la
  // partida no deje botones huérfanos ni duplicados.
  // -------------------------------------------------------------------------

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
  <button id="btnSubirPdf" style="width:100%; margin-bottom:8px; padding:10px; border:none; border-radius:8px; background:#F2A93B; color:#1a1a1a; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-file-pdf"></i> Diapositivas (PDF)</button>
  <button id="btnSubirImagenes" style="width:100%; margin-bottom:8px; padding:10px; border:none; border-radius:8px; background:#F2A93B; color:#1a1a1a; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-image"></i> Imágenes / Galerías</button>
  <button id="btnSubirVideo" style="width:100%; margin-bottom:8px; padding:10px; border:none; border-radius:8px; background:#F2A93B; color:#1a1a1a; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-film"></i> Video desde el computador</button>
  <button id="btnYoutube" style="width:100%; margin-bottom:8px; padding:10px; border:none; border-radius:8px; background:#F2A93B; color:#1a1a1a; font-weight:bold; cursor:pointer;"><i class="fa-brands fa-youtube"></i> Link de YouTube</button>
  <button id="btnCompartirPantalla" style="width:100%; margin-bottom:8px; padding:10px; border:none; border-radius:8px; background:#F2A93B; color:#1a1a1a; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-display"></i> Compartir pantalla</button>
  <button id="btnDibujar" style="width:100%; margin-bottom:8px; padding:10px; border:none; border-radius:8px; background:#F2A93B; color:#1a1a1a; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-pen"></i> Escribir en el tablero</button>
  <button id="btnLimpiarTablero" style="width:100%; margin-bottom:8px; padding:10px; border:none; border-radius:8px; background:#EF4444; color:#ffffff; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-trash"></i> Limpiar tablero</button>
  <button id="btnCerrarMenu" style="width:100%; padding:8px; border:none; border-radius:8px; background:transparent; color:#9aa8c7; cursor:pointer;">Cancelar (Esc)</button>
`;
  document.body.appendChild(menuPublicar);

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
  cartelCargando.innerText = "Procesando diapositivas...";
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

  // La API le pone al <iframe> medidas fijas de fábrica: aquí se le obliga a llenar
  // el contenedor, que es el que de verdad se coloca sobre el tablero en cada frame.
  const estiloYoutube = document.createElement("style");
  estiloYoutube.textContent =
    ".yt-contenedor{overflow:hidden}" +
    ".yt-contenedor iframe{width:100%!important;height:100%!important;border:0!important;display:block}";
  document.head.appendChild(estiloYoutube);

  /** PANTALLA EN GRANDE (clic sobre la pizarra estando lejos). */
  const estiloCompleto = document.createElement("style");
  estiloCompleto.textContent =
    ".tb-full{position:fixed;inset:0;z-index:2600;background:rgba(4,7,16,0.96);display:flex;font-family:sans-serif}" +
    ".tb-full-zona{position:relative;flex:1 1 auto;height:100%;overflow:hidden}" +
    ".tb-full-imagen,.tb-full-video{width:100%;height:100%;object-fit:contain;background:#000;display:block}" +
    ".tb-full-cerrar{position:absolute;top:18px;right:18px;z-index:2;width:44px;height:44px;padding:0;" +
    "border:1px solid rgba(255,255,255,0.25);border-radius:50%;background:rgba(15,23,42,0.9);" +
    "color:#fff;font-size:20px;line-height:1;cursor:pointer}" +
    ".tb-full-cerrar:hover{background:#EF4444}";
  document.head.appendChild(estiloCompleto);

  /** TABLERO INTELIGENTE: lienzo y barra de colores. */
  const estiloDibujo = document.createElement("style");
  estiloDibujo.textContent =
    ".td-lienzo{position:absolute;left:0;top:0;z-index:400;background:#fff;" +
    "touch-action:none;pointer-events:none;cursor:crosshair;display:none}" +
    ".td-lienzo.td-activo{pointer-events:auto}" +
    ".td-barra{position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:2100;" +
    "display:none;gap:8px;align-items:center;padding:8px 14px;border-radius:26px;" +
    "max-width:min(96vw,1080px);flex-wrap:wrap;justify-content:center;" +
    "background:rgba(15,23,42,0.95);border:1px solid rgba(255,255,255,0.18);" +
    "font-family:sans-serif;box-shadow:0 6px 18px rgba(0,0,0,0.35)}" +
    ".td-barra.td-visible{display:flex}" +
    ".td-color{width:26px;height:26px;padding:0;border-radius:50%;" +
    "border:2px solid rgba(255,255,255,0.35);cursor:pointer;flex:0 0 auto}" +
    ".td-color.td-actual{border-color:#fff;box-shadow:0 0 0 3px rgba(125,211,252,0.65)}" +
    ".td-separador{width:1px;height:22px;background:rgba(255,255,255,0.18);flex:0 0 auto}" +
    ".td-hoja{width:30px;height:30px;padding:0;border:none;border-radius:50%;flex:0 0 auto;" +
    "background:rgba(255,255,255,0.12);color:#E2E8F0;font-size:14px;line-height:1;" +
    "cursor:pointer;transition:background .12s ease,opacity .12s ease}" +
    ".td-hoja:hover{background:rgba(255,255,255,0.24)}" +
    ".td-hoja:disabled{opacity:.3;cursor:not-allowed;background:rgba(255,255,255,0.12)}" +
    ".td-pagina{font-size:12px;color:#cbd5e1;min-width:44px;text-align:center;flex:0 0 auto;" +
    "font-variant-numeric:tabular-nums;letter-spacing:.3px}" +
    ".td-accion{height:30px;padding:0 13px;border:none;border-radius:999px;flex:0 0 auto;" +
    "background:#F2A93B;color:#1a1a1a;font-weight:bold;font-size:13px;cursor:pointer}" +
    ".td-accion:hover{filter:brightness(1.08)}" +
    ".td-accion.td-suave{background:rgba(255,255,255,0.12);color:#E2E8F0}" +
    ".td-accion.td-suave:hover{background:rgba(255,255,255,0.22);filter:none}";
  document.head.appendChild(estiloDibujo);

  // -------------------------------------------------------------------------
  // Estado
  // -------------------------------------------------------------------------

  let diapositivas: string[] = [];
  let indiceDiapositiva = 0;
  /** <video> que suena ahora (el subido o el de la pantalla compartida). */
  let videoElemento: HTMLVideoElement | null = null;
  /** Textura de vídeo activa; se refresca a mano en cada frame. */
  let texturaVideo: BABYLON.VideoTexture | null = null;
  /** Captura de pantalla en curso. Si no se para, el navegador no deja de grabar. */
  let flujoPantalla: MediaStream | null = null;

  let contenedorYoutube: HTMLDivElement | null = null;
  let iframeYoutube: HTMLIFrameElement | null = null; // solo en el respaldo sin API
  let reproductorYoutube: ReproductorYoutube | null = null;
  let apiYoutubeLista: Promise<void> | null = null;

  /** URL de la imagen (o página de PDF) que está en la pizarra ahora mismo. */
  let imagenActual: string | null = null;
  /** Caja de la pantalla en grande; null = cerrada. */
  let cajaCompleta: HTMLDivElement | null = null;
  /** Mientras dure, YouTube se clava a pantalla completa en vez de al tablero. */
  let modoCompleto = false;
  /** Estado previo del <video> al pasarse a grande (para devolverlo igual). */
  let controlesPrevios = false;

  /** TABLERO INTELIGENTE: escritura con el ratón o el dedo sobre la pizarra. */
  let lienzoDibujo: HTMLCanvasElement | null = null;
  let barraDibujo: HTMLDivElement | null = null;
  let modoDibujo = false;
  /** El lienzo está aportando contenido a la pizarra (sirve para abrirlo en grande). */
  let hayDibujo = false;
  let colorDibujo = "#111827";
  /**
   * Pizarra MULTI-HOJA: las hojas guardadas viven en lienzos fuera de la
   * pantalla y la que se ve (`indiceHoja`) es el propio `lienzoDibujo`. Antes
   * de cambiar de hoja se copia la visible dentro, así que no se pierde nada.
   */
  let hojas: HTMLCanvasElement[] = [];
  let indiceHoja = 0;
  /**
   * Pasa un clic de PANTALLA a coordenadas del lienzo. Hace falta porque la
   * pizarra se pega con una matriz de perspectiva (matrix3d): lo que devuelve
   * getBoundingClientRect() es la caja del elemento, no el trapecio que se ve,
   * y con eso solo el trazo saldría desviado.
   */
  let mapaPuntero: ((x: number, y: number) => { x: number; y: number }) | null = null;
  /**
   * Silueta de lo que queda enfrente de la pizarra (la persona), ya proyectada
   * a pantalla y reducida a su contorno. Se recalcula en `actualizar()` y se
   * usa en los dos elementos HTML: iframe de YouTube y lienzo de escritura.
   */
  let siluetaPantalla: Punto[] | null = null;

  // -------------------------------------------------------------------------
  // Volumen
  // -------------------------------------------------------------------------

  function aplicarVolumenAlYoutube(): void {
    if (!reproductorYoutube) return;
    const porcentaje = Math.round(opciones.volumen() * 100);
    try {
      if (porcentaje <= 0) reproductorYoutube.mute();
      else {
        reproductorYoutube.unMute();
        reproductorYoutube.setVolume(porcentaje);
      }
    } catch (error) {
      console.warn("No se pudo ajustar el volumen de YouTube:", error);
    }
  }

  function refrescarVolumen(): void {
    const volumen = opciones.volumen();
    if (videoElemento) {
      // El mando va por dos vías porque el navegador puede haber dejado el <video>
      // en silencio al bloquear el autoplay con sonido: así 🔊 lo levanta igual.
      videoElemento.muted = volumen <= 0;
      videoElemento.volume = volumen;
    }
    aplicarVolumenAlYoutube(); // el <iframe> no tiene `.volume`
  }

  // -------------------------------------------------------------------------
  // YouTube
  // -------------------------------------------------------------------------

  function cargarApiYoutube(): Promise<void> {
    if (apiYoutubeLista) return apiYoutubeLista;
    apiYoutubeLista = new Promise<void>((resolver) => {
      const w = window as unknown as { YT?: FabricaYoutube; onYouTubeIframeAPIReady?: () => void };
      if (w.YT?.Player) {
        resolver();
        return;
      }
      w.onYouTubeIframeAPIReady = () => resolver();
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      // Si la red la bloquea se resuelve igual: el vídeo se ve igual que antes y solo
      // se pierde el mando de volumen, que es preferible a dejar la promesa colgada.
      script.onerror = () => {
        console.warn("No se pudo cargar la API de YouTube (¿red filtrada?).");
        resolver();
      };
      document.head.appendChild(script);
    });
    return apiYoutubeLista;
  }

  async function montarPlayerYoutube(idVideo: string, ancla: HTMLElement): Promise<void> {
    await cargarApiYoutube();

    // Se salió del vídeo (o se publicó otro) mientras se descargaba la API.
    if (!contenedorYoutube || !contenedorYoutube.contains(ancla)) return;

    const fabrica = (window as unknown as { YT?: FabricaYoutube }).YT;
    if (!fabrica?.Player) {
      // Respaldo: se ve y se oye igual que siempre, pero 🔊 no podrá silenciarlo.
      console.warn("API de YouTube no disponible: el botón de volumen no controlará este vídeo.");
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube.com/embed/${idVideo}?autoplay=1`;
      iframe.allow = "autoplay; encrypted-media";
      iframeYoutube = iframe;
      ancla.replaceWith(iframe);
      return;
    }

    try {
      reproductorYoutube = new fabrica.Player(ancla, {
        videoId: idVideo,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        // En cuanto esté listo se le manda el volumen guardado, por si el usuario
        // tenía el 🔊 apagado antes de publicar el vídeo.
        events: { onReady: () => aplicarVolumenAlYoutube() },
      });
    } catch (error) {
      console.warn("No se pudo montar el reproductor de YouTube:", error);
    }
  }

  function quitarYoutube(): void {
    if (reproductorYoutube) {
      try {
        reproductorYoutube.destroy();
      } catch {
        // el reproductor ya había sido retirado del DOM
      }
      reproductorYoutube = null;
    }
    if (contenedorYoutube) {
      contenedorYoutube.remove();
      contenedorYoutube = null;
    }
    if (iframeYoutube) {
      iframeYoutube.remove();
      iframeYoutube = null;
    }
  }

  function mostrarYoutube(idVideo: string): void {
    cambiarContenido();
    if (pantalla) pantalla.isVisible = false;

    // El contenedor es el que se posiciona sobre el tablero (ver actualizar()).
    const contenedor = document.createElement("div");
    contenedor.className = "yt-contenedor";
    contenedor.style.position = "absolute";
    contenedor.style.zIndex = "500";
    contenedor.style.left = "0px";
    contenedor.style.top = "0px";
    contenedor.style.width = "1px"; // dimensiones provisionales hasta el primer frame
    contenedor.style.height = "1px";
    document.body.appendChild(contenedor);
    contenedorYoutube = contenedor;

    // Ancla: la API la sustituye por su <iframe> dentro del contenedor.
    const ancla = document.createElement("div");
    contenedor.appendChild(ancla);

    void montarPlayerYoutube(idVideo, ancla);
  }

  /**
   * Pizarra proyectada: sus cuatro esquinas en pantalla y la matriz de
   * perspectiva que hace que el contenido se quede CLAVADO a la pizarra, igual
   * que si estuviera pintado en la pared. Lo comparten el iframe de YouTube y
   * el lienzo del modo escritura, así que los dos caen sobre el mismo sitio.
   */
  function proyectarPantalla(): RectPizarra | null {
    if (!pantalla) return null;

    const camera = scene.activeCamera;
    if (!camera) return null;

    const oculto: RectPizarra = {
      visible: false,
      x: 0,
      y: 0,
      ancho: 0,
      alto: 0,
      homografia: null,
    };

    pantalla.computeWorldMatrix(true);
    const caja = pantalla.getBoundingInfo().boundingBox;
    const xMedio = (caja.minimumWorld.x + caja.maximumWorld.x) / 2;
    const yAlto = caja.maximumWorld.y;
    const yBajo = caja.minimumWorld.y;
    const zIzquierda = caja.maximumWorld.z;
    const zDerecha = caja.minimumWorld.z;

    const motor = scene.getEngine();
    const viewport = camera.viewport.toGlobal(motor.getRenderWidth(), motor.getRenderHeight());
    const transformMatrix = scene.getTransformMatrix();

    // Orden de las esquinas MIRANDO LA PIZARRA DE FRENTE. Su cara mira a -X y,
    // con la cabeza arriba, mirando hacia ella la izquierda en pantalla es +Z
    // (izquierda = arriba × adelante en el sistema zurdó de Babylon): por eso
    // arriba-izquierda es el extremo de Z grande. Es el mismo orden en el que
    // están dibujadas las esquinas del <iframe> y del <canvas>, y de ahí sale
    // la matriz: si el orden se confundiera, el texto saldría del revés.
    const mundo = [
      new BABYLON.Vector3(xMedio, yAlto, zIzquierda),
      new BABYLON.Vector3(xMedio, yAlto, zDerecha),
      new BABYLON.Vector3(xMedio, yBajo, zDerecha),
      new BABYLON.Vector3(xMedio, yBajo, zIzquierda),
    ];

    const puntos: Punto[] = [];
    for (const vertice of mundo) {
      const p = BABYLON.Vector3.Project(
        vertice,
        BABYLON.Matrix.Identity(),
        transformMatrix,
        viewport
      );
      // Las CUATRO tienen que estar delante de la cámara: si una se queda
      // detrás, la pizarra se ve de canto o partida y la matriz saldría
      // invertida (el contenido parecería perseguir a la persona).
      if (p.z <= 0 || p.z >= 1) return oculto;
      puntos.push({ x: p.x, y: p.y });
    }

    // Caja envolvente: es donde se coloca el elemento (left/top y su tamaño).
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of puntos) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const ancho = maxX - minX;
    const alto = maxY - minY;
    if (!(ancho > 8 && alto > 8)) return oculto;

    // Esquinas encimadas (pizarra casi de canto): la matriz sería degenerada y
    // el navegador dejaría el contenido por las nubes. Mejor no mostrar nada.
    for (let i = 0; i < puntos.length; i++) {
      for (let j = i + 1; j < puntos.length; j++) {
        if (Math.hypot(puntos[i].x - puntos[j].x, puntos[i].y - puntos[j].y) < 4) {
          return oculto;
        }
      }
    }

    // Área real del trapecio proyectado (las cuatro esquinas ya vienen en orden
    // de contorno, así que basta la fórmula del zapatero). Si es ridícula, la
    // pizarra no se está viendo.
    let area = 0;
    for (let i = 0; i < puntos.length; i++) {
      const a = puntos[i];
      const b = puntos[(i + 1) % puntos.length];
      area += a.x * b.y - b.x * a.y;
    }
    area = Math.abs(area) / 2;
    if (area < 400 || area / (ancho * alto) < 0.05) return oculto;

    const origen: Punto[] = [
      { x: 0, y: 0 },
      { x: ancho, y: 0 },
      { x: ancho, y: alto },
      { x: 0, y: alto },
    ];
    const destino = puntos.map((p) => ({ x: p.x - minX, y: p.y - minY }));
    const matriz = homografia(origen, destino);
    if (!matriz) return oculto;

    return { visible: true, x: minX, y: minY, ancho, alto, homografia: matriz };
  }

  // -------------------------------------------------------------------------
  // SILUETA DE LO QUE QUEDA ENFRENTE (la persona)
  //
  // El canvas de Babylon está debajo del HTML, así que el <iframe> de YouTube y
  // el lienzo se pintan SIEMPRE encima de todo: al mirar de frente la cabeza
  // quedaba tapada por el vídeo. La solución es recortar esos dos elementos con
  // la forma del cuerpo, de modo que por el agujero se ve el canvas (con la
  // persona) y alrededor el contenido pegado en la pizarra.
  // -------------------------------------------------------------------------

  /**
   * Proyecta la silueta (un esqueleto: cabeza, hombros, manos, caderas,
   * rodillas, pies) y devuelve su CONTORNO: el casco convexo de los círculos de
   * cada punto. El grosor sale de la altura del propio cuerpo, así que funciona
   * con cualquier escala; en la cabeza se ensancha para cubrir cránea y pelo,
   * que están por encima del último hueso.
   */
  function proyectarSilueta(puntos: readonly PuntoMundo[]): Punto[] | null {
    if (puntos.length < 6) return null;
    const camara = scene.activeCamera;
    if (!camara) return null;

    let yBajo = Infinity;
    let yAlto = -Infinity;
    for (const p of puntos) {
      if (p.y < yBajo) yBajo = p.y;
      if (p.y > yAlto) yAlto = p.y;
    }
    const altura = yAlto - yBajo;
    if (!(altura > 1)) return null;

    const motor = scene.getEngine();
    const viewport = camara.viewport.toGlobal(motor.getRenderWidth(), motor.getRenderHeight());
    const transformMatrix = scene.getTransformMatrix();
    const derecha = camara.getDirection(BABYLON.Vector3.Right());
    const fov = (camara as unknown as { fov?: number }).fov ?? 0.8;

    const muestras: Punto[] = [];
    const PUNTOS_POR_CIRCULO = 12;

    for (const p of puntos) {
      // Radio en unidades del mundo: más ancho arriba (cránea/pelo).
      const casiTope = p.y >= yAlto - altura * 0.08;
      const radio = altura * (casiTope ? 0.14 : 0.05);

      const centro = new BABYLON.Vector3(p.x, p.y, p.z);
      const q = BABYLON.Vector3.Project(centro, BABYLON.Matrix.Identity(), transformMatrix, viewport);
      if (q.z <= 0 || q.z >= 1) continue; // detrás de la cámara no hay nada que recortar

      // Radio en PÍXELES: se proyecta un punto a `radio` unidades por la derecha.
      const borde = BABYLON.Vector3.Project(
        centro.add(derecha.scale(radio)),
        BABYLON.Matrix.Identity(),
        transformMatrix,
        viewport
      );
      let radioPx = borde.z > 0 && borde.z < 1 ? Math.hypot(borde.x - q.x, borde.y - q.y) : 0;
      if (!(radioPx > 0.5)) {
        // Respaldo por si el punto auxiliar ha caído tras la cámara: cuántos
        // píxeles mide una unidad a esa distancia según el ángulo vertical.
        const distancia = Math.max(0.5, BABYLON.Vector3.Distance(centro, camara.position));
        radioPx = (radio * viewport.height) / (2 * distancia * Math.tan(Math.max(0.05, fov) / 2));
      }
      if (!(radioPx > 0.5)) continue;

      for (let i = 0; i < PUNTOS_POR_CIRCULO; i++) {
        const angulo = (i / PUNTOS_POR_CIRCULO) * Math.PI * 2;
        muestras.push({ x: q.x + Math.cos(angulo) * radioPx, y: q.y + Math.sin(angulo) * radioPx });
      }
    }

    if (muestras.length < 36) return null;

    const contorno = cascoConvexo(muestras);
    if (contorno.length < 3) return null;

    // Guarda: si la silueta ocupa casi toda la pantalla, o la cámara está
    // dentro del cuerpo o los puntos vienen mal. Recortar eso sería abrir un
    // agujero gigante en el vídeo, así que prefiero no tocar nada.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of contorno) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    if ((maxX - minX) * (maxY - minY) > viewport.width * viewport.height * 0.6) return null;

    return contorno;
  }

  /** Casco convexo de unos puntos (Andrew monotone chain). */
  function cascoConvexo(puntos: Punto[]): Punto[] {
    const ordenados = [...puntos].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
    if (ordenados.length < 3) return ordenados;

    const cruce = (o: Punto, a: Punto, b: Punto) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

    const inferior: Punto[] = [];
    for (const p of ordenados) {
      while (inferior.length >= 2 && cruce(inferior[inferior.length - 2], inferior[inferior.length - 1], p) <= 0) {
        inferior.pop();
      }
      inferior.push(p);
    }

    const superior: Punto[] = [];
    for (let i = ordenados.length - 1; i >= 0; i--) {
      const p = ordenados[i];
      while (superior.length >= 2 && cruce(superior[superior.length - 2], superior[superior.length - 1], p) <= 0) {
        superior.pop();
      }
      superior.push(p);
    }

    inferior.pop();
    superior.pop();
    return inferior.concat(superior);
  }

  /** Caja del contenido cuando ocupa toda la pantalla (sin perspectiva). */
  function cajaPantallaCompleta(elemento: HTMLElement): RectPizarra {
    return {
      visible: true,
      x: 0,
      y: 0,
      ancho: elemento.offsetWidth || window.innerWidth,
      alto: elemento.offsetHeight || window.innerHeight,
      homografia: null,
    };
  }

  /**
   * Abre un agujero con la silueta sobre el contenido HTML, para que lo que
   * queda por DELANTE de la pizarra se vea por encima del vídeo.
   *
   * El recorte va en coordenadas LOCALES del elemento (así lo consume CSS) y el
   * elemento está deformado con matrix3d: por eso los puntos se deshacen con la
   * MISMA homografía inversa que ya usa el puntero al escribir sobre la pizarra.
   */
  function recortarConSilueta(elemento: HTMLElement, rect: RectPizarra | null): void {
    const silueta = siluetaPantalla;
    const sinRecorte = () => {
      if (elemento.style.clipPath) elemento.style.clipPath = "";
    };

    if (!silueta || !rect || !rect.visible || silueta.length < 3) {
      sinRecorte();
      return;
    }

    // Si ni siquiera se cruza con la caja del contenido, no hace falta tocar nada.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of silueta) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const holgura = 4;
    if (
      maxX < rect.x - holgura ||
      minX > rect.x + rect.ancho + holgura ||
      maxY < rect.y - holgura ||
      minY > rect.y + rect.alto + holgura
    ) {
      sinRecorte();
      return;
    }

    const inversa = rect.homografia ? invertir(rect.homografia) : null;
    const local = silueta.map((p) => {
      const rel = { x: p.x - rect.x, y: p.y - rect.y };
      return inversa ? aplicar(inversa, rel) : rel;
    });

    // El agujero tiene que girar AL REVÉS que el rectángulo exterior: con la
    // regla "nonzero" de CSS solo así queda vacío por dentro.
    let area = 0;
    for (let i = 0; i < local.length; i++) {
      const a = local[i];
      const b = local[(i + 1) % local.length];
      area += a.x * b.y - b.x * a.y;
    }
    if (area > 0) local.reverse();

    const numero = (v: number) => Math.round(v * 10) / 10;
    const camino = (puntos: Punto[]) =>
      "M" + puntos.map((p) => `${numero(p.x)} ${numero(p.y)}`).join("L") + "Z";

    const ancho = Math.round(rect.ancho);
    const alto = Math.round(rect.alto);
    const exterior = `M0 0L${ancho} 0L${ancho} ${alto}L0 ${alto}Z`;
    elemento.style.clipPath = `path("${exterior}${camino(local)}")`;
  }

  function actualizarPosicionYoutube(): void {
    if (!contenedorYoutube) return;

    // Pantalla en grande: se clava a la zona de la caja y se ignora el tablero.
    // La matriz de perspectiva se QUITA aquí: si no, el vídeo se quedaría
    // torcido dentro del reproductor a pantalla completa.
    if (modoCompleto) {
      contenedorYoutube.style.display = "block";
      contenedorYoutube.style.left = "0px";
      contenedorYoutube.style.top = "0px";
      contenedorYoutube.style.width = "100%";
      contenedorYoutube.style.height = "100%";
      contenedorYoutube.style.transform = "none";
      recortarConSilueta(contenedorYoutube, cajaPantallaCompleta(contenedorYoutube));
      return;
    }

    // Se posiciona el CONTENEDOR y no el <iframe>, porque la API de YouTube sustituye
    // el elemento que recibe por el suyo propio: mover el nodo viejo no movería nada.
    const rect = proyectarPantalla();
    if (!rect || !rect.visible) {
      contenedorYoutube.style.display = "none";
      recortarConSilueta(contenedorYoutube, null);
      return;
    }

    contenedorYoutube.style.display = "block";
    contenedorYoutube.style.left = `${rect.x}px`;
    contenedorYoutube.style.top = `${rect.y}px`;
    contenedorYoutube.style.width = `${rect.ancho}px`;
    contenedorYoutube.style.height = `${rect.alto}px`;
    // Matrix3d: el rectángulo del contenedor se deforma hasta calzar con las
    // cuatro esquinas de la pizarra, así el vídeo se queda quieto en la pared
    // aunque la persona se mueva o mire de lado.
    if (rect.homografia) {
      contenedorYoutube.style.transformOrigin = "0 0";
      contenedorYoutube.style.transform = matriz3d(rect.homografia);
    } else {
      contenedorYoutube.style.transform = "none";
    }
    // Y el hueco con la persona: si no, al mirar de frente el vídeo taparía la
    // cabeza del personaje (el HTML siempre se pinta encima del canvas).
    recortarConSilueta(contenedorYoutube, rect);
  }

  function extraerIdYoutube(url: string): string | null {
    const patron = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(patron);
    return match ? match[1] : null;
  }

  function publicarYoutube(url: string): boolean {
    const idVideo = extraerIdYoutube(url);
    if (!idVideo) return false;
    mostrarYoutube(idVideo);
    return true;
  }

  // -------------------------------------------------------------------------
  // Contenido "de mapa de bits": PDF, imágenes, vídeo y pantalla compartida
  // -------------------------------------------------------------------------

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

  /** Para de grabar la pantalla. Obligatorio: si no, el aviso de "compartiendo" se queda. */
  function detenerPantallaCompartida(): void {
    if (flujoPantalla) {
      for (const pista of flujoPantalla.getTracks()) {
        pista.onended = null;
        pista.stop();
      }
      flujoPantalla = null;
    }
    if (videoElemento && videoElemento.srcObject) {
      videoElemento.pause();
      videoElemento.srcObject = null;
    }
  }

  function limpiarTextura(): void {
    if (material.diffuseTexture) {
      material.diffuseTexture.dispose();
      material.diffuseTexture = null;
    }
    texturaVideo = null;
  }

  /**
   * Retira lo que hubiera antes de poner contenido nuevo. Se llama desde TODOS los
   * publicadores para que nunca convivan un iframe de YouTube, un vídeo y una
   * captura de pantalla sobre la misma malla.
   */
  function cambiarContenido(): void {
    salirDeModoDibujo();
    ocultarLienzo();
    quitarYoutube();
    limpiarTextura();
    detenerPantallaCompartida();
    imagenActual = null;
  }

  function mostrarImagen(urlImagen: string): void {
    if (!pantalla || !material) return;
    cambiarContenido();

    const nuevaTextura = new BABYLON.Texture(urlImagen, scene, false, false);
    nuevaTextura.vScale = -1;
    nuevaTextura.uScale = 1;

    material.diffuseTexture = nuevaTextura;
    pantalla.isVisible = true;
    imagenActual = urlImagen;
  }

  function mostrarVideo(urlVideo: string): void {
    if (!pantalla || !material) return;
    cambiarContenido();

    const videoTexture = new BABYLON.VideoTexture("videoTablero", urlVideo, scene, true, false);
    videoTexture.vScale = 1;
    videoTexture.uScale = 1;
    material.diffuseTexture = videoTexture;
    texturaVideo = videoTexture;
    pantalla.isVisible = true;

    videoElemento = videoTexture.video;
    videoElemento.loop = true;
    refrescarVolumen();
    videoElemento.play().catch(() => console.warn("Autoplay bloqueado por el navegador."));
  }

  /**
   * COMPARTIR PANTALLA.
   *
   * `getDisplayMedia` devuelve un MediaStream, que se enchufa a un <video> con
   * `srcObject` (no hay URL) y de ahí a una VideoTexture, igual que un vídeo subido.
   *
   * Dos detalles leídos del fuente de Babylon 9.21 antes de escribir esto:
   *   · el constructor acepta un HTMLVideoElement ya montado y NO le cambia el src;
   *   · `independentVideoSource` le dice a Babylon que no toque play/pause/muted,
   *     que es justo lo que queremos: aquí el que manda es este módulo.
   * El orden importa: srcObject y la textura se crean en el MISMO tick, para que
   * `canplay` (del que cuelga la textura interna) no se emite antes de registrarla.
   */
  async function compartirPantalla(): Promise<void> {
    if (!pantalla || !material) return;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      alert("Este navegador no permite compartir pantalla.");
      return;
    }

    let flujo: MediaStream;
    try {
      flujo = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch {
      // El usuario canceló el diálogo del navegador: no es un error.
      return;
    }

    cambiarContenido();

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.muted = false;
    video.srcObject = flujo;

    const textura = new BABYLON.VideoTexture(
      "pantallaCompartida",
      video,
      scene,
      false, // sin mipmaps: se regenerarían en cada frame del stream
      false, // invertY=false → el volcado a GPU ya invierte, igual que el vídeo subido
      BABYLON.Texture.BILINEAR_SAMPLINGMODE, // sin mipmaps: bilineal va bien y es barata
      { independentVideoSource: true }
    );
    textura.vScale = 1;
    textura.uScale = 1;
    material.diffuseTexture = textura;
    texturaVideo = textura;
    pantalla.isVisible = true;

    flujoPantalla = flujo;
    videoElemento = video;
    refrescarVolumen(); // el mismo mando que el resto de la app

    // Si el profesor pulsa "Dejar de compartir" en la barra del navegador, el tablero
    // se limpia solo; si no, quedaría un stream grabando en segundo plano.
    const pistaVideo = flujo.getVideoTracks()[0];
    if (pistaVideo) pistaVideo.onended = () => limpiar();

    video.play().catch(() => {
      // Autoplay con sonido bloqueado: se muestra el vídeo en silencio y se avisa.
      video.muted = true;
      console.warn("El navegador bloqueó el audio de la pantalla compartida (vídeo en silencio).");
      video.play().catch((error) => console.warn("No se pudo reproducir la pantalla:", error));
    });

    menuPublicar.style.display = "none";
    console.log("Compartiendo pantalla en el tablero.");
  }

  // -------------------------------------------------------------------------
  // PANTALLA EN GRANDE (clic sobre la pizarra de lejos)
  // -------------------------------------------------------------------------
  function hayContenido(): boolean {
    return Boolean(contenedorYoutube || imagenActual || videoElemento || hayDibujo);
  }

  function pantallaCompletaAbierta(): boolean {
    return cajaCompleta !== null;
  }

  function cerrarPantallaCompleta(): void {
    const caja = cajaCompleta;
    if (!caja) return;
    cajaCompleta = null;
    modoCompleto = false;

    const zona = caja.querySelector<HTMLElement>(".tb-full-zona");
    if (zona) {
      // El iframe de YouTube vuelve a <body>: así actualizar() vuelve a
      // proyectarlo sobre la pizarra en 3D, que es donde estaba.
      if (contenedorYoutube && contenedorYoutube.parentElement === zona) {
        document.body.appendChild(contenedorYoutube);
      }
      const imagen = zona.querySelector<HTMLImageElement>("img");
      if (imagen) imagen.remove();
      if (videoElemento && videoElemento.parentElement === zona) {
        videoElemento.classList.remove("tb-full-video");
        videoElemento.controls = controlesPrevios;
        // Babylon sigue leyendo este <video> aunque ya no esté en el DOM
        // (así estaba antes de abrir la pantalla en grande).
        videoElemento.remove();
      }
      if (lienzoDibujo && lienzoDibujo.parentElement === zona) {
        document.body.appendChild(lienzoDibujo); // vuelve a proyectarse sobre la pizarra
      }
    }

    caja.remove();
  }

  function abrirPantallaCompleta(): void {
    if (cajaCompleta || !hayContenido()) return;

    // El ratón queda libre: si no, ni la ✕ ni el resto de la UI reciben el clic.
    if (document.pointerLockElement) document.exitPointerLock();
    cerrarMenu();

    const caja = document.createElement("div");
    caja.className = "tb-full";
    caja.innerHTML =
      '<button type="button" class="tb-full-cerrar" title="Cerrar (Esc)">✕</button>' +
      '<div class="tb-full-zona"></div>';
    document.body.appendChild(caja);
    cajaCompleta = caja;
    modoCompleto = true;

    caja
      .querySelector<HTMLButtonElement>(".tb-full-cerrar")!
      .addEventListener("click", cerrarPantallaCompleta);

    const zona = caja.querySelector<HTMLElement>(".tb-full-zona")!;
    if (contenedorYoutube) {
      zona.appendChild(contenedorYoutube);
    } else if (imagenActual) {
      const imagen = document.createElement("img");
      imagen.className = "tb-full-imagen";
      imagen.src = imagenActual;
      zona.appendChild(imagen);
    } else if (videoElemento) {
      // Se queda con la barra de progreso mientras está en grande (y se le
      // devuelve su estado anterior al cerrar).
      controlesPrevios = videoElemento.controls;
      videoElemento.classList.add("tb-full-video");
      videoElemento.controls = true;
      zona.appendChild(videoElemento);
    } else if (hayDibujo && lienzoDibujo) {
      zona.appendChild(lienzoDibujo);
    }
  }

  /** Las ← → siguen funcionando con la pantalla en grande (PDF / galería). */
  function refrescarPantallaCompleta(): void {
    if (!cajaCompleta || !imagenActual) return;
    const imagen = cajaCompleta.querySelector<HTMLImageElement>("img");
    if (imagen) imagen.src = imagenActual;
  }

  // -------------------------------------------------------------------------
  // TABLERO INTELIGENTE — escribir con el ratón o con el dedo
  //
  // Es un <canvas> pegado encima de la pizarra, proyectado con la MISMA
  // matemática que el iframe de YouTube (proyectarPantalla), así que calza con la
  // pizarra 3D a cualquier distancia y ángulo sin tocar Babylon. Va con Pointer
  // Events, así que funciona igual con ratón y con dedo (tableta), y su
  // resolución es fija y con la proporción REAL de la pizarra: al ampliarlo
  // (pantalla en grande) los trazos no se deforman.
  // -------------------------------------------------------------------------

  function pintarFondoDelLienzo(): void {
    if (!lienzoDibujo) return;
    const ctx = lienzoDibujo.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, lienzoDibujo.width, lienzoDibujo.height);
  }

  // -------------------------------------------------------------------------
  // HOJAS DE LA PIZARRA — pasar hojas y descargarlas
  //
  // La hoja que se está viendo es el propio `lienzoDibujo`; las demás viven en
  // lienzos fuera de la pantalla. Antes de moverse se copia la visible dentro,
  // así que nada de lo escrito se pierde. Cualquier mapa reutiliza esto a través
  // de la barra: la lógica no está repartida por el código del mapa.
  // -------------------------------------------------------------------------

  function nuevaHojaEnBlanco(): HTMLCanvasElement {
    const hoja = document.createElement("canvas");
    hoja.width = lienzoDibujo?.width ?? 2048;
    hoja.height = lienzoDibujo?.height ?? 794;
    const ctx = hoja.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, hoja.width, hoja.height);
    }
    return hoja;
  }

  function guardarHojaActual(): void {
    const visible = lienzoDibujo;
    if (!visible) return;
    const destino = hojas[indiceHoja] ?? (hojas[indiceHoja] = nuevaHojaEnBlanco());
    const ctx = destino.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, destino.width, destino.height);
    ctx.drawImage(visible, 0, 0);
  }

  function pintarHojaEnElLienzo(): void {
    const visible = lienzoDibujo;
    if (!visible) return;
    const ctx = visible.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, visible.width, visible.height);
    const hoja = hojas[indiceHoja];
    if (hoja) ctx.drawImage(hoja, 0, 0);
  }

  /** La hoja visible todavía no está copiada en `hojas`: cuenta también. */
  function totalDeHojas(): number {
    return Math.max(hojas.length, indiceHoja + 1);
  }

  function irAHoja(nueva: number): void {
    if (!lienzoDibujo) return;
    if (nueva < 0 || nueva >= totalDeHojas() || nueva === indiceHoja) return;
    guardarHojaActual();
    indiceHoja = nueva;
    if (!hojas[indiceHoja]) hojas[indiceHoja] = nuevaHojaEnBlanco();
    pintarHojaEnElLienzo();
    hayDibujo = true;
    refrescarContadorDeHojas();
  }

  function hojaNueva(): void {
    if (!lienzoDibujo) return;
    guardarHojaActual();
    hojas.push(nuevaHojaEnBlanco());
    indiceHoja = hojas.length - 1;
    pintarHojaEnElLienzo();
    hayDibujo = true;
    refrescarContadorDeHojas();
  }

  function refrescarContadorDeHojas(): void {
    const contador = barraDibujo?.querySelector<HTMLElement>("#tdHoja");
    if (contador) contador.textContent = `${indiceHoja + 1} / ${totalDeHojas()}`;

    const anterior = barraDibujo?.querySelector<HTMLButtonElement>('[data-hoja="anterior"]');
    const siguiente = barraDibujo?.querySelector<HTMLButtonElement>('[data-hoja="siguiente"]');
    if (anterior) anterior.disabled = indiceHoja <= 0;
    if (siguiente) siguiente.disabled = indiceHoja >= totalDeHojas() - 1;
  }

  /** Todas las hojas en lienzos, con la visible refrescada, listas para el PDF. */
  function hojasListasParaDescargar(): HTMLCanvasElement[] {
    guardarHojaActual();
    const lienzos: HTMLCanvasElement[] = [];
    for (let i = 0; i < totalDeHojas(); i++) {
      if (!hojas[i]) hojas[i] = nuevaHojaEnBlanco();
      lienzos.push(hojas[i]);
    }
    return lienzos;
  }

  function descargarHojas(): void {
    try {
      const paginas = paginasDesdeLienzos(hojasListasParaDescargar());
      descargarPdf("Pizarra de clase", paginas);
    } catch (error) {
      console.error("No se pudo generar el PDF de la pizarra:", error);
      alert("No se pudo descargar la pizarra. Inténtalo otra vez.");
    }
  }

  /** Une un trazo continuo entre el punto anterior y el nuevo. */
  function conectarTrazos(lienzo: HTMLCanvasElement): void {
    let pintando = false;
    let ultimo: { x: number; y: number } | null = null;

    const aPixeles = (evento: PointerEvent): { x: number; y: number } => {
      // Con la matriz de perspectiva, la caja que devuelve getBoundingClientRect
      // es el rectángulo del elemento y NO el trapecio que se ve en pantalla:
      // con ella solo el trazo saldría desviado. Se usa el mapa inverso
      // (pantalla → lienzo) calculado en actualizarPosicionLienzo.
      if (mapaPuntero) return mapaPuntero(evento.clientX, evento.clientY);

      // Respaldo (pantalla en grande), donde no hay perspectiva que deshacer.
      const rect = lienzo.getBoundingClientRect();
      return {
        x: ((evento.clientX - rect.left) / Math.max(1, rect.width)) * lienzo.width,
        y: ((evento.clientY - rect.top) / Math.max(1, rect.height)) * lienzo.height,
      };
    };

    const trazar = (evento: PointerEvent): void => {
      const ctx = lienzo.getContext("2d");
      if (!ctx) return;
      const punto = aPixeles(evento);
      ctx.strokeStyle = colorDibujo;
      ctx.lineWidth = Math.max(6, lienzo.width / 160);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(ultimo ? ultimo.x : punto.x, ultimo ? ultimo.y : punto.y);
      ctx.lineTo(punto.x, punto.y);
      ctx.stroke();
      ultimo = punto;
      hayDibujo = true;
    };

    lienzo.addEventListener("pointerdown", (evento) => {
      if (!modoDibujo) return;
      evento.preventDefault();
      pintando = true;
      ultimo = null;
      // Captura el puntero: si el dedo se sale de la pizarra el trazo no se corta.
      lienzo.setPointerCapture(evento.pointerId);
      trazar(evento);
    });

    lienzo.addEventListener("pointermove", (evento) => {
      if (!modoDibujo || !pintando) return;
      evento.preventDefault();
      trazar(evento);
    });

    const soltar = (evento: PointerEvent): void => {
      pintando = false;
      ultimo = null;
      if (lienzo.hasPointerCapture(evento.pointerId)) {
        lienzo.releasePointerCapture(evento.pointerId);
      }
    };
    lienzo.addEventListener("pointerup", soltar);
    lienzo.addEventListener("pointercancel", soltar);
  }

  function asegurarLienzo(): HTMLCanvasElement | null {
    if (!pantalla) return null;

    if (!lienzoDibujo) {
      pantalla.computeWorldMatrix(true);
      const mundo = pantalla.getWorldMatrix();
      const caja = pantalla.getBoundingInfo().boundingBox;
      // Tamaño local de la pizarra llevado al mundo (rotación y escalado de los
      // padres incluidos): de ahí sale la proporción real del lienzo.
      const anchoMundo = BABYLON.Vector3.TransformNormal(
        new BABYLON.Vector3(caja.maximum.x - caja.minimum.x, 0, 0),
        mundo
      ).length();
      const altoMundo = BABYLON.Vector3.TransformNormal(
        new BABYLON.Vector3(0, caja.maximum.y - caja.minimum.y, 0),
        mundo
      ).length();
      const proporcion = anchoMundo > 0 && altoMundo > 0 ? anchoMundo / altoMundo : 2;
      const ladoLargo = 2048;

      lienzoDibujo = document.createElement("canvas");
      lienzoDibujo.className = "td-lienzo";
      lienzoDibujo.width = ladoLargo;
      lienzoDibujo.height = Math.max(256, Math.round(ladoLargo / proporcion));
      document.body.appendChild(lienzoDibujo);
      pintarFondoDelLienzo();
      conectarTrazos(lienzoDibujo);
      // Pizarra recién creada: se empieza con UNA sola hoja en blanco.
      hojas = [];
      indiceHoja = 0;
    }

    lienzoDibujo.classList.add("td-activo");
    hayDibujo = true;
    return lienzoDibujo;
  }

  function ocultarLienzo(): void {
    hayDibujo = false;
    if (!lienzoDibujo) return;
    lienzoDibujo.classList.remove("td-activo");
    lienzoDibujo.style.display = "none";
  }

  function actualizarPosicionLienzo(): void {
    const lienzo = lienzoDibujo;
    if (!lienzo || !hayDibujo) return;

    // Pantalla en grande: ocupa toda la zona y no hay perspectiva que deshacer.
    if (modoCompleto) {
      lienzo.style.display = "block";
      lienzo.style.left = "0px";
      lienzo.style.top = "0px";
      lienzo.style.width = "100%";
      lienzo.style.height = "100%";
      lienzo.style.transform = "none";
      mapaPuntero = null;
      recortarConSilueta(lienzo, cajaPantallaCompleta(lienzo));
      return;
    }

    const rect = proyectarPantalla();
    if (!rect || !rect.visible) {
      lienzo.style.display = "none";
      mapaPuntero = null;
      recortarConSilueta(lienzo, null);
      return;
    }

    lienzo.style.display = "block";
    lienzo.style.left = `${rect.x}px`;
    lienzo.style.top = `${rect.y}px`;
    lienzo.style.width = `${rect.ancho}px`;
    lienzo.style.height = `${rect.alto}px`;

    // La pizarra se pega en perspectiva, así que para saber en qué punto del
    // lienzo acaba el trazo hay que deshacer la matriz: sin esto, al escribir de
    // lado la línea saldría corrida respecto al puntero.
    const inversa = rect.homografia ? invertir(rect.homografia) : null;
    if (rect.homografia && inversa) {
      lienzo.style.transformOrigin = "0 0";
      lienzo.style.transform = matriz3d(rect.homografia);
      const { x: origenX, y: origenY, ancho, alto } = rect;
      mapaPuntero = (clientX, clientY) => {
        const local = aplicar(inversa, { x: clientX - origenX, y: clientY - origenY });
        return {
          x: (local.x / Math.max(1, ancho)) * lienzo.width,
          y: (local.y / Math.max(1, alto)) * lienzo.height,
        };
      };
    } else {
      lienzo.style.transform = "none";
      mapaPuntero = null;
    }

    // Hueco con la persona: lo escrito tiene que quedar DETRÁS de ella igual
    // que el vídeo (el lienzo también es HTML y se pinta sobre el canvas).
    recortarConSilueta(lienzo, rect);
  }

  function asegurarBarraDibujo(): HTMLDivElement {
    if (barraDibujo) return barraDibujo;

    const colores: Array<[string, string]> = [
      ["#111827", "Tinta negra"],
      ["#2563EB", "Tinta azul"],
      ["#EF4444", "Tinta roja"],
      ["#16A34A", "Tinta verde"],
      ["#F2A93B", "Tinta ámbar"],
      ["#FFFFFF", "Borrador"],
    ];

    const caja = document.createElement("div");
    caja.className = "td-barra";
    caja.innerHTML =
      '<span style="font-size:13px;color:#9aa8c7">Tablero inteligente</span>' +
      colores
        .map(
          ([color, titulo]) =>
            `<button type="button" class="td-color${color === colorDibujo ? " td-actual" : ""}"` +
            ` data-color="${color}" title="${titulo}" style="background:${color}"></button>`
        )
        .join("") +
      // Pasar hojas: anterior, siguiente y hoja nueva (tres botones) + contador.
      '<span class="td-separador"></span>' +
      '<button type="button" class="td-hoja" data-hoja="anterior" title="Hoja anterior">' +
      '<i class="fa-solid fa-angles-left"></i></button>' +
      '<span class="td-pagina" id="tdHoja">1 / 1</span>' +
      '<button type="button" class="td-hoja" data-hoja="siguiente" title="Hoja siguiente">' +
      '<i class="fa-solid fa-angles-right"></i></button>' +
      '<button type="button" class="td-hoja" data-hoja="nueva" title="Hoja nueva">' +
      '<i class="fa-solid fa-plus"></i></button>' +
      // Descargar: un PDF con todas las hojas tal y como se ven en la pizarra.
      '<span class="td-separador"></span>' +
      '<button type="button" class="td-accion td-suave" data-accion="descargar" ' +
      'title="Descargar todas las hojas en PDF"><i class="fa-solid fa-file-pdf"></i> Descargar PDF</button>' +
      '<button type="button" class="td-accion" data-accion="limpiar" ' +
      'title="Borrar lo escrito en esta hoja"><i class="fa-solid fa-trash"></i> Limpiar</button>' +
      '<button type="button" class="td-accion" data-accion="listo"><i class="fa-solid fa-check"></i> Listo</button>';
    document.body.appendChild(caja);
    barraDibujo = caja;

    caja.querySelectorAll<HTMLButtonElement>("[data-hoja]").forEach((boton) => {
      boton.addEventListener("click", () => {
        const accion = boton.dataset.hoja;
        if (accion === "anterior") irAHoja(indiceHoja - 1);
        else if (accion === "siguiente") irAHoja(indiceHoja + 1);
        else if (accion === "nueva") hojaNueva();
      });
    });

    caja
      .querySelector<HTMLButtonElement>('[data-accion="descargar"]')!
      .addEventListener("click", descargarHojas);

    caja.querySelectorAll<HTMLButtonElement>(".td-color").forEach((boton) => {
      boton.addEventListener("click", () => {
        colorDibujo = boton.dataset.color ?? "#111827";
        caja.querySelectorAll(".td-color").forEach((otro) => otro.classList.remove("td-actual"));
        boton.classList.add("td-actual");
      });
    });

    caja
      .querySelector<HTMLButtonElement>('[data-accion="limpiar"]')!
      .addEventListener("click", () => {
        pintarFondoDelLienzo();
        hayDibujo = true; // la pizarra sigue ahí, solo que en blanco
      });

    caja
      .querySelector<HTMLButtonElement>('[data-accion="listo"]')!
      .addEventListener("click", salirDeModoDibujo);

    refrescarContadorDeHojas();
    return caja;
  }

  function salirDeModoDibujo(): void {
    if (!modoDibujo) return;
    modoDibujo = false;
    // El trazo se queda en la pizarra: solo se deja de escribir.
    lienzoDibujo?.classList.remove("td-activo");
    barraDibujo?.classList.remove("td-visible");
  }

  function entrarEnModoDibujo(): void {
    if (document.pointerLockElement) document.exitPointerLock();
    cerrarPantallaCompleta();
    // La pizarra queda SOLO para escribir: vídeo, imagen o YouTube se retiran
    // (es lo mismo que pasa al publicar cualquier otra cosa).
    cambiarContenido();

    const lienzo = asegurarLienzo();
    if (!lienzo) return;

    modoDibujo = true;
    // Con la pizarra visible y sin textura el material sale en blanco: pizarra nueva.
    if (pantalla) pantalla.isVisible = true;
    actualizarPosicionLienzo();
    asegurarBarraDibujo().classList.add("td-visible");
    refrescarContadorDeHojas();
  }

  function limpiar(): void {
    cerrarPantallaCompleta();
    cambiarContenido();
    pintarFondoDelLienzo();
    // La pizarra entera: se olvidan TODAS las hojas y se vuelve a la primera.
    hojas = [];
    indiceHoja = 0;
    refrescarContadorDeHojas();
    for (const url of diapositivas) URL.revokeObjectURL(url);
    diapositivas = [];
    indiceDiapositiva = 0;
    videoElemento = null;
    if (pantalla) pantalla.isVisible = false;
  }

  function cambiarDiapositiva(direccion: 1 | -1): void {
    if (diapositivas.length === 0) return;
    indiceDiapositiva = (indiceDiapositiva + direccion + diapositivas.length) % diapositivas.length;
    mostrarImagen(diapositivas[indiceDiapositiva]);
  }

  function alternarPausa(): void {
    if (!videoElemento) return;
    if (videoElemento.paused) void videoElemento.play();
    else videoElemento.pause();
  }

  function actualizar(silueta?: readonly PuntoMundo[] | null): void {
    // La textura de vídeo no avanza sola: Babylon solo la actualiza cuando llegan
    // eventos (canplay/seeked/paused). Sin este refresco a mano el tablero se
    // quedaría congelado en el primer fotograma.
    texturaVideo?.update();

    // La silueta solo hace falta cuando hay contenido en HTML sobre la pizarra:
    // lo que se proyecta como TEXTURA ya lo tapa el motor 3D por sí solo (ahí la
    // persona queda por delante sin que haga falta recortar nada).
    const hayContenidoHtml =
      hayDibujo || Boolean(contenedorYoutube && contenedorYoutube.style.display !== "none");
    siluetaPantalla = hayContenidoHtml && silueta && silueta.length > 5 ? proyectarSilueta(silueta) : null;

    actualizarPosicionYoutube();
    actualizarPosicionLienzo();
    refrescarPantallaCompleta();
  }

  // -------------------------------------------------------------------------
  // Menú y botones
  // -------------------------------------------------------------------------

  function abrirMenu(): void {
    // Con la pantalla en grande no tiene sentido el menú: se cierra antes.
    cerrarPantallaCompleta();
    // Tampoco se escribe mientras se publica otra cosa (el trazo se queda).
    salirDeModoDibujo();
    // Mientras el ratón está bloqueado ningún botón recibe clics (es el mismo motivo
    // por el que 🔊 "a veces no funcionaba"): se libera al abrir el menú.
    if (document.pointerLockElement) document.exitPointerLock();
    menuPublicar.style.display = "block";
  }

  function cerrarMenu(): void {
    menuPublicar.style.display = "none";
  }

  function menuAbierto(): boolean {
    return menuPublicar.style.display === "block";
  }

  menuPublicar.querySelector("#btnSubirPdf")!.addEventListener("click", () => inputPdf.click());
  menuPublicar.querySelector("#btnSubirImagenes")!.addEventListener("click", () => inputImagenes.click());
  menuPublicar.querySelector("#btnSubirVideo")!.addEventListener("click", () => inputVideo.click());
  menuPublicar.querySelector("#btnCerrarMenu")!.addEventListener("click", cerrarMenu);
  // Tablero inteligente: se cierra el menú y se empieza a escribir en la pizarra.
  menuPublicar.querySelector("#btnDibujar")!.addEventListener("click", () => {
    cerrarMenu();
    entrarEnModoDibujo();
  });
  menuPublicar
    .querySelector("#btnLimpiarTablero")!
    .addEventListener("click", () => {
      limpiar();
      cerrarMenu();
    });
  menuPublicar.querySelector("#btnCompartirPantalla")!.addEventListener("click", () => {
    void compartirPantalla();
  });

  menuPublicar.querySelector("#btnYoutube")!.addEventListener("click", () => {
    const url = prompt("Pega el link del video de YouTube:");
    if (!url) return;
    if (!publicarYoutube(url)) {
      alert("No se pudo identificar un ID válido de YouTube.");
      return;
    }
    cerrarMenu();
  });

  inputPdf.addEventListener("change", async () => {
    const archivo = inputPdf.files?.[0];
    if (!archivo) return;
    cerrarMenu();
    cartelCargando.style.display = "block";

    try {
      const paginas = await convertirPdfAImagenes(archivo);
      if (paginas.length === 0) throw new Error("El PDF no tiene páginas convertibles.");
      mostrarImagen(paginas[0]);
      // Se revoca DESPUÉS de proyectar: la textura anterior puede seguir cargando.
      for (const url of diapositivas) URL.revokeObjectURL(url);
      diapositivas = paginas;
      indiceDiapositiva = 0;
    } catch (e) {
      console.error(e);
      alert("Error al procesar el archivo PDF.");
    } finally {
      cartelCargando.style.display = "none";
      inputPdf.value = "";
    }
  });

  inputImagenes.addEventListener("change", () => {
    const archivos = inputImagenes.files;
    if (!archivos || archivos.length === 0) return;
    const nuevas = Array.from(archivos).map((archivo) => URL.createObjectURL(archivo));
    mostrarImagen(nuevas[0]);
    for (const url of diapositivas) URL.revokeObjectURL(url);
    diapositivas = nuevas;
    indiceDiapositiva = 0;
    cerrarMenu();
    inputImagenes.value = "";
  });

  inputVideo.addEventListener("change", () => {
    const archivo = inputVideo.files?.[0];
    if (!archivo) return;
    mostrarVideo(URL.createObjectURL(archivo));
    cerrarMenu();
    inputVideo.value = "";
  });

  function destruir(): void {
    cerrarPantallaCompleta();
    limpiar(); // deja el tablero en blanco, para el vídeo y para la captura
    menuPublicar.remove();
    cartelCargando.remove();
    inputPdf.remove();
    inputImagenes.remove();
    inputVideo.remove();
    estiloYoutube.remove();
    estiloCompleto.remove();
    estiloDibujo.remove();
    barraDibujo?.remove();
    lienzoDibujo?.remove();
    barraDibujo = null;
    lienzoDibujo = null;
    hojas = [];
    indiceHoja = 0;
    mapaPuntero = null;
    siluetaPantalla = null;
    hayDibujo = false;
    modoDibujo = false;
    // YouTube deja el script cargado a propósito: reutilizarlo al volver a entrar
    // evita pedirlo otra vez y su callback global sigue siendo válido.
  }

  return {
    abrirMenu,
    cerrarMenu,
    menuAbierto,
    mostrarImagen,
    mostrarVideo,
    publicarYoutube,
    compartirPantalla,
    cambiarDiapositiva,
    alternarPausa,
    limpiar,
    hayContenido,
    abrirPantallaCompleta,
    cerrarPantallaCompleta,
    pantallaCompletaAbierta,
    escribirEnElTablero: entrarEnModoDibujo,
    terminarDeEscribir: salirDeModoDibujo,
    dibujoAbierto: () => modoDibujo,
    refrescarVolumen,
    actualizar,
    destruir,
  };
}
