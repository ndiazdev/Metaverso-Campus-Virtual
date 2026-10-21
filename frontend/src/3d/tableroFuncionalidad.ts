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
 *     rol: () => obtenerSesion()?.rol ?? "estudiante",
 *   });
 *
 *   tablero.abrirMenu();        // con P, mientras se está en el atril
 *   tablero.actualizar();       // en cada frame (proyecta el iframe de YouTube)
 *   tablero.refrescarVolumen(); // cuando cambia el 🔊 / el slider de ajustes
 *   tablero.destruir();         // al salir de la partida
 *
 * QUÉ SABE HACER
 *   · PDF → diapositivas (pdf.js), imágenes/galerías y vídeo del ordenador.
 *   · Notas de la pizarra escritas con el TECLADO (como un bloc de notas) y
 *     descargables como archivo de texto (.txt), en vez de PDF.
 *   · Link de YouTube montado con la IFrame Player API, para que 🔊 lo silencie
 *     de verdad (un <iframe> normal no expone `.volume`).
 *   · Compartir pantalla (getDisplayMedia) proyectada sobre la misma malla.
 *   · Limpiar, pausar/reanudar (Espacio) y pasar diapositivas (←/→).
 *   · Vista del presentador: una pantallita con la pizarra mientras se está
 *     en el atril, para no tener que girarse a mirarla.
 *   · Menú filtrado por rol: docente y admin publican de todo; estudiante e
 *     invitado, solo diapositivas y notas (el tablero es compartido).
 *
 * VOLUMEN: este módulo SOLO LEE el volumen que le pasa el mapa; nunca decide ni
 * toca el del portátil. El slider manda sobre el sonido de la APP (vídios,
 * pantalla compartida y, cuando llegue el chat por proximidad, las voces), que
 * siempre multiplica con el volumen del sistema operativo.
 */

import * as BABYLON from "babylonjs";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { MensajeTablero } from "../red/presencia";
import type { Rol } from "../state/estado";

// Configuración del worker de PDF.js (usado por convertirPdfAImagenes).
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// (Eliminados junto con la proyección 3D: la interfaz `RectPizarra`, el tipo
//  `PuntoMundo` y la importación de `homografia`/`matriz3d`. Ya nada pegaba
//  contenido HTML en la pizarra ni recortaba siluetas.)

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
  /**
   * El tablero es del SALÓN, no de uno solo: cada vez que cambia lo que se
   * ve aquí (publicar, pasar de diapositiva, limpiar), este callback manda
   * una copia al resto de la sala. Sin él (mapa en solitario) no se manda
   * nada: el tablero funciona igual que siempre.
   */
  alPublicar?: (mensaje: MensajeTablero) => void;
  /**
   * Rol de quien maneja este tablero. El menú "Publicar" se FILTRA con él:
   * docente y admin publican de todo; estudiantes (e invitados) solo
   * diapositivas y notas, que es lo que se les permite subir.
   */
  rol: () => Rol;
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
  /**
   * VISTA DEL PRESENTADOR: una pantallita en la esquina con lo que está
   * en el tablero, para quien está en el atril y no quiere dejar de mirar
   * a la clase. Solo se muestra con `true` (mientras se presenta).
   */
  vistaPresentador: (activa: boolean) => void;
  /**
   * Pinta en ESTE tablero algo que publicó otro de la sala. Es el único
   * camino de entrada de la red: NO se vuelve a publicar, para que un
   * mensaje recibido no genere un eco infinito entre los dos clientes.
   */
  aplicarMensaje: (mensaje: MensajeTablero) => void;
  /**
   * Reenvía a la sala lo que se está viendo ahora. Se llama cuando entra
   * alguien nuevo a la clase: así quien llega ve al instante lo que se
   * está presentando sin tener que pedirlo.
   */
  republicarContenido: () => void;
  /** TABLERO INTELIGENTE: el papel de notas, escrito con el teclado. */
  escribirEnElTablero: () => void;
  /** Deja de escribir sin borrar lo escrito (Esc o ✔ Listo). */
  terminarDeEscribir: () => void;
  /** true mientras se esté escribiendo en las notas (el ratón debe quedarse libre). */
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
   * Llamar en cada frame. Ya no recibe proveedor de siluetas: nada se pega en
   * la pizarra 3D (YouTube es caja personal fija, notas panel lateral), así
   * que no hay contenido HTML que recortar con la forma del cuerpo.
   */
  actualizar: () => void;
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
  <button id="btnNotas" style="width:100%; margin-bottom:8px; padding:10px; border:none; border-radius:8px; background:#F2A93B; color:#1a1a1a; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-note-sticky"></i> Notas en el tablero</button>
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
  // El ✕ va con z-index 600: con 2 se lo comían el papel de notas (400) y el
  // iframe de YouTube (500), hermanos suyos dentro de la misma zona.
  const estiloCompleto = document.createElement("style");
  estiloCompleto.textContent =
    ".tb-full{position:fixed;inset:0;z-index:2600;background:rgba(4,7,16,0.96);display:flex;font-family:sans-serif}" +
    ".tb-full-zona{position:relative;flex:1 1 auto;height:100%;overflow:hidden}" +
    ".tb-full-imagen,.tb-full-video{width:100%;height:100%;object-fit:contain;background:#000;display:block}" +
    ".tb-full-cerrar{position:absolute;top:18px;right:18px;z-index:600;width:44px;height:44px;padding:0;" +
    "border:1px solid rgba(255,255,255,0.25);border-radius:50%;background:rgba(15,23,42,0.9);" +
    "color:#fff;font-size:20px;line-height:1;cursor:pointer}" +
    ".tb-full-cerrar:hover{background:#EF4444}";
  document.head.appendChild(estiloCompleto);

  /**
   * NOTAS EN EL TABLERO: papel blanco con <textarea>. Mientras se ESCRIBE
   * (solo se llega desde el atril) es panel FIJO A LA DERECHA con borde y
   * sombra (rectEdicion); al dejar de escribir —y para quien solo lee— se
   * PROYECTA en la pizarra 3D con la misma homografía que el vídeo, así el
   * texto se ve escrito EN el tablero y llega en vivo a toda la clase. En
   * pantalla en grande ocupa toda la zona. Antes eran trazos con el ratón;
   * ahora se ESCRIBE con el teclado y se descarga como .txt.
   */
  const estiloNotas = document.createElement("style");
  estiloNotas.textContent =
    ".td-notas{position:absolute;left:0;top:0;z-index:400;background:#fffdf7;" +
    "border:1px solid rgba(15,23,42,0.28);border-radius:12px;" +
    "box-shadow:0 14px 36px rgba(0,0,0,0.5);" +
    "display:none;pointer-events:none;box-sizing:border-box;overflow:hidden}" +
    ".td-notas.td-activo{pointer-events:auto}" +
    ".td-notas textarea{width:100%;height:100%;border:0;outline:0;resize:none;" +
    "background:transparent;box-sizing:border-box;padding:3.5% 4%;margin:0;" +
    "color:#1f2937;line-height:1.5;font-family:inherit;pointer-events:none;" +
    "caret-color:#111827;white-space:pre-wrap;overflow-wrap:break-word;word-break:break-word}" +
    ".td-notas.td-activo textarea{pointer-events:auto}" +
    ".td-notas textarea::placeholder{color:#94a3b8}" +
    // Sin editar, el papel también recibe el clic (solo pasa en el atril): el
    // clic entra en modo escritura. Hasta entonces el textarea no es tocable.
    ".td-notas.td-clic{pointer-events:auto;cursor:text}" +
    ".td-notas.td-clic textarea{pointer-events:none}" +
    ".td-barra{position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:2100;" +
    "display:none;gap:8px;align-items:center;padding:8px 14px;border-radius:26px;" +
    "max-width:min(96vw,1080px);flex-wrap:wrap;justify-content:center;" +
    "background:rgba(15,23,42,0.95);border:1px solid rgba(255,255,255,0.18);" +
    "font-family:sans-serif;box-shadow:0 6px 18px rgba(0,0,0,0.35)}" +
    ".td-barra.td-visible{display:flex}" +
    ".td-accion{height:30px;padding:0 13px;border:none;border-radius:999px;flex:0 0 auto;" +
    "background:#F2A93B;color:#1a1a1a;font-weight:bold;font-size:13px;cursor:pointer}" +
    ".td-accion:hover{filter:brightness(1.08)}" +
    ".td-accion.td-suave{background:rgba(255,255,255,0.12);color:#E2E8F0}" +
    ".td-accion.td-suave:hover{background:rgba(255,255,255,0.22);filter:none}";
  document.head.appendChild(estiloNotas);

  /** VISTA DEL PRESENTADOR: la pantallita de quien está en el atril. */
  const estiloMini = document.createElement("style");
  estiloMini.textContent =
    ".tb-mini{position:fixed;left:20px;bottom:96px;z-index:1900;width:min(30vw,380px);" +
    "border-radius:12px;overflow:hidden;background:rgba(15,23,42,0.96);" +
    "border:1px solid rgba(255,255,255,0.22);box-shadow:0 8px 24px rgba(0,0,0,0.45);" +
    "font-family:sans-serif;display:none;cursor:pointer}" +
    ".tb-mini:hover{border-color:rgba(242,169,59,0.85)}" +
    ".tb-mini-escribir{float:right;color:#F2A93B;font-weight:bold}" +
    ".tb-mini-titulo{font-size:11px;letter-spacing:.4px;text-transform:uppercase;" +
    "color:#9aa8c7;padding:7px 12px 6px;border-bottom:1px solid rgba(255,255,255,0.12)}" +
    ".tb-mini-zona{position:relative;width:100%;aspect-ratio:16/9;background:#000;" +
    "display:flex;align-items:center;justify-content:center;overflow:hidden}" +
    ".tb-mini-zona img{width:100%;height:100%;object-fit:contain;background:#000;display:block}" +
    ".tb-mini-zona .tb-mini-texto{margin:0;padding:10px 12px;width:100%;height:100%;" +
    "box-sizing:border-box;overflow:auto;background:#fffdf7;color:#1f2937;" +
    "font-size:13px;line-height:1.45;white-space:pre-wrap;overflow-wrap:break-word}" +
    ".tb-mini-zona .tb-mini-vacio{color:#94a3b8;font-size:13px;padding:0 16px;text-align:center}";
  document.head.appendChild(estiloMini);

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
  /** ID del vídeo de YouTube que se está proyectando (para la miniatura). */
  let youtubeActual: string | null = null;

  /** URL de la imagen (o página de PDF) que está en la pizarra ahora mismo. */
  let imagenActual: string | null = null;
  /** Caja de la pantalla en grande; null = cerrada. */
  let cajaCompleta: HTMLDivElement | null = null;
  /** Mientras dure, YouTube se clava a pantalla completa en vez de al tablero. */
  let modoCompleto = false;
  /** Estado previo del <video> al pasarse a grande (para devolverlo igual). */
  let controlesPrevios = false;

  // ── SINCRONIZACIÓN CON LA SALA ──────────────────────────────────────────
  // El contenido de ESTE navegador (PDF convertido, galería…) no le sirve
  // a nadie más: sus URL son `blob:` y solo existen aquí. Así que quien
  // publica manda a la sala una COPIA en JPEG (data URL ≤1600 px) y los
  // demás la pintan en su pizarra con la misma API que usarían si la
  // hubieran subido ellos. `ultimoMensaje` recuerda lo que se ve ahora
  // para poder reenviarlo cuando alguien nuevo entre a la clase.
  let ultimoMensaje: MensajeTablero | null = null;
  let mensajePendiente: MensajeTablero | null = null;
  let temporizadorPublicacion: number | null = null;
  /** Instante en que empezó a estar pendiente el mensaje en cola. */
  let momentoPendiente = 0;
  /** Cuenta las publicaciones: una conversión que llega tarde se descarta. */
  let ordenPublicacion = 0;

  /** Calma entre publicaciones: pasar cinco diapositivas seguidas no manda cinco JPEGs. */
  const PUBLICACION_MS = 250;
  /**
   * Tope de espera (misma medida que la calma): mientras se teclea seguido,
   * el reloj de `PUBLICACION_MS` se rearmaría con cada tecla y NADA saldría
   * hasta que el profe dejara de escribir. A los `MAX_ESPERA_MS` de la
   * PRIMERA tecla pendiente se manda lo último: las notas se ven EN VIVO
   * (4 mensajes/s, la sala admite 8/s) sin esperar a Enter ni a Listo.
   */
  const MAX_ESPERA_MS = 250;

  // COMPARTIR PANTALLA → LA SALA. Un MediaStream no viaja por socket, así
  // que mientras se comparte se fotografía el <video> cada cierto tiempo y
  // el fotograma (JPEG ~1280 px) se manda como una imagen más del tablero:
  // los que entren a la clase lo ven con la misma API de siempre, con la
  // pantalla en grande y hasta en la vista del presentador.
  const INTERVALO_FOTOGRAMA_MS = 400;
  const ANCHO_FOTOGRAMA = 1280;
  const CALIDAD_FOTOGRAMA = 0.6;
  let temporizadorFotogramas: number | null = null;
  let lienzoFotograma: HTMLCanvasElement | null = null;
  /** Hay una captura en marcha (marcado aparte del intervalo, que puede no existir). */
  let capturandoPantalla = false;
  /** Fotograma leído DIRECTO de la pista de captura: se cierra tras dibujarlo. */
  type FotogramaCaptura = CanvasImageSource & { close(): void; width: number; height: number };
  type LectorCaptura = {
    read(): Promise<{ value?: FotogramaCaptura; done: boolean }>;
    cancel(): Promise<void>;
  };
  type ProcesadorDePantalla = new (init: { track: MediaStreamTrack }) => {
    readable: { getReader(): LectorCaptura };
  };
  /** Lector del camino directo, para cancelarlo al dejar de compartir. */
  let lectorCaptura: LectorCaptura | null = null;

  /** NOTAS DEL TABLERO: papel con <textarea> en el panel de la derecha. */
  let cajaNotas: HTMLDivElement | null = null;
  let textoNotas: HTMLTextAreaElement | null = null;
  let barraNotas: HTMLDivElement | null = null;
  let modoNotas = false;
  /** El papel de notas está visible en pantalla (editando o con texto). */
  let hayNotas = false;
  /** Tope de caracteres del bloc (el mismo que valida la red, en presencia.ts). */
  const MAX_NOTAS = 50_000;

  // ── VISTA DEL PRESENTADOR ───────────────────────────────────────────────
  // Pantallita fija abajo a la izquierda con lo que está en el tablero,
  // solo visible mientras se está en el atril: el que presenta mira a la
  // clase y, de reojo, a su diapositiva, sin tener que girarse.
  let panelPresentador: HTMLDivElement | null = null;
  let panelActivo = false;
  /** Para no tocar el DOM en cada frame: solo si cambió lo que se muestra. */
  let clavePanel = "";

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
    youtubeActual = null;
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
    youtubeActual = idVideo;
    if (pantalla) pantalla.isVisible = false;

    // CAJA PERSONAL FIJA (arriba a la derecha). Ya NO se proyecta en la pizarra
    // 3D: al pegar el iframe con homografía y recortarlo con la silueta de cada
    // persona aparecían los "domos" verdes alrededor de los avatares, el frame
    // se trababa al recalcular la matriz cada vez que alguien se acercaba y, en
    // geometría degenerada (muy de canto), la matriz se disparaba y crasheaba
    // la página. Una caja fija no depende de la cámara: se ve igual siempre.
    const contenedor = document.createElement("div");
    contenedor.className = "yt-contenedor";
    contenedor.style.position = "fixed";
    contenedor.style.top = "16px";
    contenedor.style.right = "16px";
    contenedor.style.zIndex = "1450";
    contenedor.style.width = "min(30vw, 380px)";
    contenedor.style.height = "min(16.875vw, 214px)"; // 16:9 del ancho de arriba
    contenedor.style.borderRadius = "12px";
    contenedor.style.overflow = "hidden";
    contenedor.style.background = "#000";
    contenedor.style.border = "1px solid rgba(255,255,255,0.22)";
    contenedor.style.boxShadow = "0 8px 24px rgba(0,0,0,0.5)";
    document.body.appendChild(contenedor);
    contenedorYoutube = contenedor;

    // Ancla: la API la sustituye por su <iframe> dentro del contenedor.
    const ancla = document.createElement("div");
    contenedor.appendChild(ancla);

    void montarPlayerYoutube(idVideo, ancla);
  }

  // -------------------------------------------------------------------------
  // (Eliminado) PROYECCION 3D + SILUETAS
  //
  // Antes aqui vivian "proyectarPantalla" (la homografia que claba el
  // contenido en la pizarra) y todo el sistema de siluetas (recorte con la
  // forma del cuerpo para que la persona se viera por delante). YouTube dejo
  // de proyectarse (es una caja personal fija arriba a la derecha) y las
  // notas son un panel lateral: por eso ese subsistema entero -que dibujaba
  // los "domos" verdes y trababa/crasheaba la pagina al acercarse alguien-
  // se elimino. Lo que va como TEXTURA en el tablero (PDF, imagenes,
  // pantalla compartida) lo tapa el motor 3D solo.
  // -------------------------------------------------------------------------

  function actualizarPosicionYoutube(): void {
    if (!contenedorYoutube) return;

    // La caja de YouTube es un panel PERSONAL FIJO (arriba a la derecha): no se
    // proyecta en la pizarra 3D, así que aquí no hay homografía ni recorte de
    // silueta que recalcular. Solo se gestiona la "pantalla en grande".
    if (modoCompleto) {
      contenedorYoutube.style.display = "block";
      contenedorYoutube.style.left = "0px";
      contenedorYoutube.style.top = "0px";
      contenedorYoutube.style.right = "auto";
      contenedorYoutube.style.width = "100%";
      contenedorYoutube.style.height = "100%";
      contenedorYoutube.style.borderRadius = "0px";
      contenedorYoutube.style.transform = "none";
      return;
    }

    // Modo caja: volver a la posición fija de la esquina superior derecha.
    contenedorYoutube.style.display = "block";
    contenedorYoutube.style.left = "auto";
    contenedorYoutube.style.top = "16px";
    contenedorYoutube.style.right = "16px";
    contenedorYoutube.style.width = "min(30vw, 380px)";
    contenedorYoutube.style.height = "min(16.875vw, 214px)";
    contenedorYoutube.style.borderRadius = "12px";
    contenedorYoutube.style.transform = "none";
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
    // El enlace SÍ es universal: a la sala le basta con la URL, sin
    // convertir nada (por eso este tipo de contenido pesa cero).
    publicar({ tipo: "youtube", url });
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
    detenerCapturaPantalla();
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

  /**
   * Fotografía el <video> de la pantalla y se la recuerda a la sala como
   * una imagen más del tablero (aunque NO se pinta aquí: en LOCAL ya se ve
   * el stream en vivo con su VideoTexture, y pintar el fotograma pasaría
   * por cambiarContenido(), que DETIENE el propio compartir, y congelaría
   * el vídeo a la cadencia de captura).
   *
   * `encolar` (250 ms, último-gana) hace de caída de red: si los fotogramas
   * llegan pegados o la conexión va lenta, solo se emite el más fresco.
   */
  function iniciarCapturaPantalla(video: HTMLVideoElement): void {
    detenerCapturaPantalla();
    capturandoPantalla = true;
    const lienzo = (lienzoFotograma ??= document.createElement("canvas"));
    const ctx = lienzo.getContext("2d");
    if (!ctx) return;

    /** Último JPEG mandado: hay INTERVALO_FOTOGRAMA_MS de calma entre envíos. */
    let ultimoEnvio = 0;
    const tocaEnviar = (): boolean => performance.now() - ultimoEnvio >= INTERVALO_FOTOGRAMA_MS;

    const prepararLienzo = (ancho: number, alto: number): boolean => {
      if (!(ancho > 0) || !(alto > 0)) return false;
      const escala = Math.min(1, ANCHO_FOTOGRAMA / ancho);
      const w = Math.max(1, Math.round(ancho * escala));
      const h = Math.max(1, Math.round(alto * escala));
      if (lienzo.width !== w || lienzo.height !== h) {
        lienzo.width = w;
        lienzo.height = h;
      }
      return true;
    };

    const mandar = (): void => {
      ultimoEnvio = performance.now();
      const fotograma = lienzo.toDataURL("image/jpeg", CALIDAD_FOTOGRAMA);
      // Va por `encolar`, no por `publicar`: no invalida conversiones en
      // vuelo (¿y si subo una diapositiva mientras comparto?). Sí se
      // recuerda en `ultimoMensaje` para quien entre a la clase ahora:
      // recibirá UN fotograma congelado y a los 400 ms ya lleva los vivos.
      ultimoMensaje = { tipo: "imagen", imagen: fotograma };
      encolar(ultimoMensaje);
    };

    // ── CAMINO 1 (el bueno): MediaStreamTrackProcessor ────────────────────
    // Lee los fotogramas DIRECTAMENTE de la pista de captura, sin pasar por el
    // <video>. Por eso sigue mandando clase aunque el profe se vaya a un
    // PowerPoint con la pestaña oculta: ni los temporizadores de la pestaña de
    // fondo (1 por segundo) ni la congelación de la decodificación del vídeo
    // lo frenan, que era justo lo que dejaba la presentación a medias.
    const tipoProcesador = (navigator as unknown as {
      MediaStreamTrackProcessor?: ProcesadorDePantalla;
    }).MediaStreamTrackProcessor;
    const pistaCaptura = flujoPantalla?.getVideoTracks()[0];
    const hayCaminoDirecto = Boolean(tipoProcesador && pistaCaptura);
    if (tipoProcesador && pistaCaptura) {
      const lector = new tipoProcesador({ track: pistaCaptura }).readable.getReader();
      lectorCaptura = lector;
      const leerFotogramas = async (): Promise<void> => {
        while (capturandoPantalla) {
          const { value: fotograma, done } = await lector.read();
          if (done || !fotograma) break;
          if (!tocaEnviar() || !prepararLienzo(fotograma.width, fotograma.height)) {
            fotograma.close(); // consumido: sin close la pila de fotogramas se desborda
            continue;
          }
          ctx.drawImage(fotograma, 0, 0, lienzo.width, lienzo.height);
          fotograma.close();
          mandar();
        }
      };
      void leerFotogramas().catch((error) => console.warn("[tablero] captura directa:", error));
    }

    // ── CAMINO 2 (respaldo): el <video> + temporizador ───────────────────
    // Vale en navegadores sin MediaStreamTrackProcessor y hace de red de
    // seguridad si el camino 1 se para: solo pinta si hace rato que no llega
    // nada por la vía directa, así nunca manda un fotograma viejo por delante.
    temporizadorFotogramas = window.setInterval(() => {
      if (hayCaminoDirecto && performance.now() - ultimoEnvio < INTERVALO_FOTOGRAMA_MS * 4) return;
      if (!tocaEnviar()) return;
      const ancho = video.videoWidth;
      const alto = video.videoHeight;
      if (!ancho || !alto || video.readyState < 2) return; // stream aún sin datos
      if (!prepararLienzo(ancho, alto)) return;
      ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
      mandar();
    }, INTERVALO_FOTOGRAMA_MS);
  }

  function detenerCapturaPantalla(): void {
    capturandoPantalla = false;
    if (lectorCaptura) {
      void lectorCaptura.cancel().catch(() => undefined);
      lectorCaptura = null;
    }
    if (temporizadorFotogramas !== null) {
      clearInterval(temporizadorFotogramas);
      temporizadorFotogramas = null;
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
    salirDeModoNotas();
    ocultarNotas();
    quitarYoutube();
    limpiarTextura();
    detenerPantallaCompartida();
    imagenActual = null;
  }

  // -------------------------------------------------------------------------
  // SINCRONIZACIÓN CON LA SALA (el tablero es del salón, no de uno solo)
  // -------------------------------------------------------------------------

  /**
   * Deja `mensaje` en cola para emitirlo con `PUBLICACION_MS` de calma:
   * un puntero en ráfaga (varias diapositivas seguidas) solo interesa al
   * otro lado en su último estado, no cada pulsación intermedia. El tope
   * `MAX_ESPERA_MS` corta la calma cuando el reloj no deja de rearmarse:
   * tecleo continuo = publicación cada tope, no "al parar de escribir".
   */
  function encolar(mensaje: MensajeTablero): void {
    if (!opciones.alPublicar) return;
    const yaHabiaPendiente = mensajePendiente !== null;
    mensajePendiente = mensaje;
    if (temporizadorPublicacion !== null) clearTimeout(temporizadorPublicacion);
    if (!yaHabiaPendiente) momentoPendiente = performance.now();

    // CON LA PESTAÑA DE FONDO los temporizadores del navegador se quedan a uno
    // por segundo (y a uno por minuto tras cinco minutos oculta): el reloj de
    // calma nunca llegaría a disparar mientras llegan fotogramas y la clase se
    // quedaría con la última imagen CONGELADA. Ahí se manda ya; el ritmo de las
    // imágenes lo sigue marcando quien las captura (cada INTERVALO_FOTOGRAMA_MS).
    if (typeof document !== "undefined" && document.hidden) {
      enviarPendiente();
      return;
    }

    // TOPE DE ESPERA: si en cola ya llevamos `MAX_ESPERA_MS`, sale ahora lo
    // último aunque sigan llegando teclas (si no, la calma se rearmaría
    // eternamente y la sala no vería el texto hasta la próxima pausa).
    if (yaHabiaPendiente && performance.now() - momentoPendiente >= MAX_ESPERA_MS) {
      enviarPendiente();
      return;
    }

    // Y el temporizador NUNCA se agenda más allá del tope: la calma se rearma
    // con cada tecla, pero el reloj de espera se mide desde la PRIMERA.
    const hastaTope = Math.max(0, momentoPendiente + MAX_ESPERA_MS - performance.now());
    temporizadorPublicacion = window.setTimeout(
      enviarPendiente,
      Math.min(PUBLICACION_MS, hastaTope)
    );
  }

  /** Suelta lo último que haya en cola (lo anterior queda obsoleto). */
  function enviarPendiente(): void {
    temporizadorPublicacion = null;
    const pendiente = mensajePendiente;
    mensajePendiente = null;
    if (pendiente) opciones.alPublicar?.(pendiente);
  }

  function publicar(mensaje: MensajeTablero): void {
    ordenPublicacion++; // invalida cualquier conversión en vuelo anterior
    ultimoMensaje = mensaje;
    encolar(mensaje);
  }

  /**
   * JPEG de tamaño acotado como data URL. Es EL paso que hace posible
   * compartir: una URL `blob:` solo existe en el navegador que la creó,
   * así que a la sala hay que mandarle píxeles, no un enlace.
   * Ancho máx. 1600 px y calidad 0.8 → ~200-500 kB en base64, holgado
   * para una pizarra vista a cualquier distancia.
   */
  async function imagenParaLaSala(url: string): Promise<string | null> {
    try {
      const imagen = new Image();
      await new Promise<void>((resolver, rechazar) => {
        imagen.onload = () => resolver();
        imagen.onerror = () => rechazar(new Error("imagen ilegible"));
        imagen.src = url;
      });

      const escala = Math.min(1, 1600 / Math.max(1, imagen.width));
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.max(1, Math.round(imagen.width * escala));
      lienzo.height = Math.max(1, Math.round(imagen.height * escala));
      const ctx = lienzo.getContext("2d");
      if (!ctx) return null;

      // JPEG no tiene alfa: si no se rellena el fondo, lo transparente
      // llegaría negro a la pizarra del otro.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
      return lienzo.toDataURL("image/jpeg", 0.8);
    } catch (error) {
      console.warn("[tablero] No se pudo preparar la imagen para la sala:", error);
      return null;
    }
  }

  async function publicarImagen(url: string): Promise<void> {
    const mia = ++ordenPublicacion;
    const imagen = await imagenParaLaSala(url);
    // Si mientras convertía se publicó otra cosa, esta queda obsoleta.
    if (imagen && mia === ordenPublicacion) publicar({ tipo: "imagen", imagen });
  }

  /**
   * Cuerpo común de las imágenes. Pintar y publicar van separados: lo
   * recibido de la red pinta sin reenviar (evita el eco) y lo local pinta
   * y manda una copia a la sala.
   */
  function pintarImagen(urlImagen: string): void {
    if (!pantalla || !material) return;
    cambiarContenido();

    const nuevaTextura = new BABYLON.Texture(urlImagen, scene, false, false);
    nuevaTextura.vScale = -1;
    nuevaTextura.uScale = 1;

    material.diffuseTexture = nuevaTextura;
    pantalla.isVisible = true;
    imagenActual = urlImagen;
  }

  function mostrarImagen(urlImagen: string): void {
    pintarImagen(urlImagen);
    if (urlImagen.startsWith("data:")) {
      // Ya viene convertido (p. ej. de la sala): se recuerda sin
      // reconvertir ni reenviar — quien lo publicó ya lo hizo.
      ordenPublicacion++;
      ultimoMensaje = { tipo: "imagen", imagen: urlImagen };
      return;
    }
    void publicarImagen(urlImagen);
  }

  /**
   * Pinta las notas que publicó otro sin reenviarlas (sin eco). Si aquí se
   * está escribiendo, no se pisa el papel: manda lo local y el siguiente
   * tecleo se sincroniza solo. Si el otro borró sus notas (texto vacío),
   * se retira el papel de la pizarra.
   */
  function aplicarNotas(texto: string): void {
    if (modoNotas) return;
    if (!texto.trim()) {
      ocultarNotas();
      if (pantalla && !imagenActual && !youtubeActual && !videoElemento) {
        pantalla.isVisible = false;
      }
      // Si la caja en grande solo enseñaba el papel (ahora oculto), se cierra
      // como hace el limpiar: no queda nada que mirar en negro.
      if (cajaCompleta && cajaCompleta.querySelector(".td-notas")) {
        cerrarPantallaCompleta();
      }
      return;
    }
    // Las notas reemplazan al contenido anterior... pero solo si AHORA mismo
    // hay algo distinto del papel: con las notas ya pintadas, cada tecla que
    // llega de la sala ocultaría y reencendería el papel entero (parpadeo en
    // el que la clase vería el texto aparecer y desaparecer mientras se teclea).
    if (!hayNotas || imagenActual || youtubeActual || videoElemento || contenedorYoutube) {
      cambiarContenido();
    }
    // Las notas llegadas de la red se PINTAN pero no se editan: para escribir
    // hay que clicar el papel (o la vista), que ya exige estar en el atril.
    const caja = asegurarNotas(false);
    if (!caja || !textoNotas) return;
    textoNotas.value = texto;
    hayNotas = true;
    if (pantalla) pantalla.isVisible = true;
    actualizarPosicionNotas();

    // PANTALLA EN GRANDE: si la caja no lleva aún el papel dentro (se abrió
    // con otra cosa puesta, o el papel no existía todavía), se reabre para
    // que quede DENTRO — mismo truco que con imagen y YouTube —. Solo la
    // PRIMERA vez: con cada tecla posterior el papel ya está colocado. El
    // aviso por contenido es a propósito: si hubiera un vídeo (la caja
    // prefiere a éste), reabrir una y otra vez sería un bucle sin papel.
    if (
      cajaCompleta &&
      !cajaCompleta.querySelector(".td-notas") &&
      !contenedorYoutube &&
      !imagenActual &&
      !videoElemento
    ) {
      cerrarPantallaCompleta();
      abrirPantallaCompleta();
    }
  }

  /**
   * Única puerta de entrada de la red. Pinta lo que publicó otro sin
   * volver a publicarlo (un eco aquí sería un bucle infinito entre los
   * dos clientes) y lo recuerda en `ultimoMensaje` para que, si alguien
   * más entra a la clase, se le pueda reenviar.
   *
   * Si la pizarra está en PANTALLA GRANDE (alguien siguiendo la
   * presentación de lejos), la caja se mantiene al día: con imagen basta
   * cambiar el src; con YouTube se reabre para que el iframe quede DENTRO;
   * el limpiar ya cierra la caja por su cuenta.
   */
  function aplicarMensaje(mensaje: MensajeTablero): void {
    ultimoMensaje = mensaje;
    if (mensaje.tipo === "imagen") {
      pintarImagen(mensaje.imagen);
      if (cajaCompleta) {
        if (cajaCompleta.querySelector("img")) {
          refrescarPantallaCompleta();
        } else {
          cerrarPantallaCompleta();
          abrirPantallaCompleta();
        }
      }
    } else if (mensaje.tipo === "youtube") {
      // Igual que `publicarYoutube` pero sin publicar: solo el ID validado.
      const idVideo = extraerIdYoutube(mensaje.url);
      if (!idVideo) return;
      // El contenedor del vídeo nuevo se monta en <body>: si había
      // pantalla en grande, se reabre después para que quede DENTRO.
      const enGrande = cajaCompleta !== null;
      if (enGrande) cerrarPantallaCompleta();
      mostrarYoutube(idVideo);
      if (enGrande) abrirPantallaCompleta();
    } else if (mensaje.tipo === "notas") {
      aplicarNotas(mensaje.texto);
    } else if (mensaje.tipo === "limpiar") {
      limpiarBase(); // ya cierra la pantalla en grande
    }
  }

  /**
   * Reenvía a la sala lo que se ve ahora (cuando alguien acaba de
   * entrar). Va por `encolar`, no por `publicar`: no debe invalidar una
   * conversión en vuelo —si acabo de subir algo nuevo, esa sigue siendo
   * la más fresca.
   */
  function republicarContenido(): void {
    if (ultimoMensaje) encolar(ultimoMensaje);
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
      // `displaySurface: "monitor"` hace que el selector del navegador abra con
      // la PANTALLA COMPLETA preseleccionada: así, al cambiarse de pestaña o a
      // otro programa (un PowerPoint, por ejemplo), la clase sigue viendo lo
      // que se comparte en vez de quedarse en blanco.
      flujo = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" },
        audio: true,
      });
    } catch (error) {
      // El usuario canceló el diálogo del navegador: no es un error.
      if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")) {
        return;
      }
      try {
        // Navegador que no entiende las pistas de restricción: se pide como antes.
        flujo = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      } catch {
        return;
      }
    }

    // Aviso suave si al final se compartió una sola pestaña/ventana: en ese
    // caso, al cambiar de pestaña la clase dejaría de ver la presentación.
    const superficie = flujo.getVideoTracks()[0]?.getSettings() as { displaySurface?: string };
    if (superficie.displaySurface && superficie.displaySurface !== "monitor") {
      console.warn(
        `[tablero] Se está compartiendo "${superficie.displaySurface}". ` +
          "Si cambias de pestaña o programa la clase no lo verá: " +
          "mejor comparte la PANTALLA COMPLETA."
      );
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

    // De aquí salen los fotogramas que ven los demás (ver iniciarCapturaPantalla).
    iniciarCapturaPantalla(video);

    menuPublicar.style.display = "none";
    console.log("Compartiendo pantalla en el tablero.");
  }

  // -------------------------------------------------------------------------
  // PANTALLA EN GRANDE (clic sobre la pizarra de lejos)
  // -------------------------------------------------------------------------
  function hayContenido(): boolean {
    return Boolean(contenedorYoutube || imagenActual || videoElemento || hayNotas);
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
      if (cajaNotas && cajaNotas.parentElement === zona) {
        document.body.appendChild(cajaNotas); // vuelve al panel de la derecha
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
    } else if (hayNotas && cajaNotas) {
      zona.appendChild(cajaNotas);
    }
  }

  /** Mantiene al día la caja en grande cuando la diapositiva cambia (en la sala). */
  function refrescarPantallaCompleta(): void {
    if (!cajaCompleta || !imagenActual) return;
    const imagen = cajaCompleta.querySelector<HTMLImageElement>("img");
    if (imagen) imagen.src = imagenActual;
  }

  // -------------------------------------------------------------------------
  // NOTAS EN EL TABLERO — escribir con el teclado
  //
  // Es un <textarea> sobre un papel blanco. Mientras se está escribiendo (en
  // el atril) el papel es un panel FIJO A LA DERECHA (rectEdicion): superficie
  // cómoda y estable, sin perspectiva. Al publicar/cerrar —y para quien no
  // escribe— el papel se PEGA EN LA PIZARRA 3D con la misma homografía que el
  // vídeo: el texto se ve escrito en el tablero y se actualiza EN VIVO para
  // toda la clase. En pantalla en grande ocupa toda la zona. Sustituye al
  // antiguo tablero de trazos con el ratón: aquí se ESCRIBE (como en un bloc
  // de notas) y se descarga como archivo de texto.
  // -------------------------------------------------------------------------

  function borrarNotas(): void {
    if (!textoNotas) return;
    textoNotas.value = "";
    // Si se estaba editando el papel se queda (en blanco); si no, se oculta.
    hayNotas = modoNotas;
  }

  /**
   * Descarga las notas como archivo de texto (bloc de notas), no como PDF:
   * el contenido del <textarea> tal cual, con BOM UTF-8 para que Windows
   * lo abra con acentos y ñ sin líos de codificación.
   */
  function descargarNotas(): void {
    const texto = textoNotas?.value ?? "";
    if (!texto.trim()) {
      alert("Todavía no hay notas que descargar.");
      return;
    }
    try {
      const blob = new Blob(["\ufeff", texto], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "Notas del tablero.txt";
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      // Se revoca pasados unos ms: revocar antes cancela la descarga en Firefox.
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (error) {
      console.error("No se pudieron descargar las notas:", error);
      alert("No se pudieron descargar las notas. Inténtalo otra vez.");
    }
  }


  function asegurarNotas(editable: boolean): HTMLDivElement | null {
    if (!pantalla) return null;

    if (!cajaNotas) {
      pantalla.computeWorldMatrix(true);
      const mundo = pantalla.getWorldMatrix();
      const caja = pantalla.getBoundingInfo().boundingBox;
      // Tamaño local de la pizarra llevado al mundo (rotación y escalado de los
      // padres incluidos): de ahí sale la proporción real del papel.
      const anchoMundo = BABYLON.Vector3.TransformNormal(
        new BABYLON.Vector3(caja.maximum.x - caja.minimum.x, 0, 0),
        mundo
      ).length();
      const altoMundo = BABYLON.Vector3.TransformNormal(
        new BABYLON.Vector3(0, caja.maximum.y - caja.minimum.y, 0),
        mundo
      ).length();
      const proporcion = anchoMundo > 0 && altoMundo > 0 ? anchoMundo / altoMundo : 2;

      cajaNotas = document.createElement("div");
      cajaNotas.className = "td-notas";
      // Tamaño provisional: la posición y el tamaño REALES los pone cada
      // frame actualizarPosicionNotas(), igual que hacía el lienzo.
      cajaNotas.style.width = "1024px";
      cajaNotas.style.height = `${Math.max(256, Math.round(1024 / proporcion))}px`;

      textoNotas = document.createElement("textarea");
      textoNotas.placeholder = "Escribe aquí las notas de la clase…";
      textoNotas.spellcheck = false;
      // Tope del bloc: el mismo que valida la red (presencia.ts y el backend).
      textoNotas.maxLength = MAX_NOTAS;
      // LAS NOTAS SE COMPARTEN EN VIVO: cada tecleo sale a la sala en cuanto
      // cumple la calma de 250 ms, y con el tope de `encolar` sale también
      // mientras se teclea seguido (máximo un envío cada 250 ms). Asignar
      // `.value` desde código no dispara "input", así que lo que llega de la
      // red no genera eco ni bucle.
      textoNotas.addEventListener("input", () => {
        // Solo manda texto a la sala quien está EN EL ATRIL y escribiendo: así
        // ni un papel recibido de la red ni un foco suelto publican nada.
        if (!panelActivo || !modoNotas) return;
        publicar({ tipo: "notas", texto: textoNotas?.value ?? "" });
      });
      // CLIC SOBRE EL PAPEL → empezar a escribir. La clase `td-clic` (la pone
      // actualizarPosicionNotas mientras se está en el atril) es la que hace
      // que el papel reciba el clic ANTES de ser editable.
      cajaNotas.addEventListener("click", () => {
        if (panelActivo && hayNotas && !modoNotas) entrarEnModoNotas();
      });
      cajaNotas.appendChild(textoNotas);
      document.body.appendChild(cajaNotas);
    }

    // SOLO SE ESCRIBE DESDE EL ATRIL: sin `editable` el papel es de solo
    // lectura, y así un estudiante que reciba las notas no puede teclear en
    // ellas ni publicar nada por su cuenta.
    if (editable) {
      cajaNotas.classList.add("td-activo");
      cajaNotas.classList.remove("td-clic");
    } else {
      cajaNotas.classList.remove("td-activo");
    }
    hayNotas = true;
    return cajaNotas;
  }

  function ocultarNotas(): void {
    hayNotas = false;
    if (!cajaNotas) return;
    cajaNotas.classList.remove("td-activo");
    cajaNotas.style.display = "none";
  }

  /**
   * La tipografía se dimensiona con la altura del papel: en pantalla en
   * grande la letra crece con la zona, y en el panel de la derecha se queda
   * en un cuerpo cómodo de lectura (nunca clavada en px absolutos).
   */
  function ajustarFuenteNotas(altoPx: number): void {
    if (!textoNotas) return;
    textoNotas.style.fontSize = `${Math.max(11, Math.round(altoPx * 0.042))}px`;
  }

  /**
   * Geometría del panel de notas, a la derecha: SOLO la usa quien está
   * ESCRIBIENDO en el atril (la pizarra queda a sus espaldas, proyectarla
   * sale gigante e inestable). Quien no escribe ve el papel proyectado en la
   * pizarra 3D. La barra de acciones va justo debajo, para que no se meta con
   * el panel de la clase de arriba a la izquierda ni con la webcam.
   */
  function rectEdicion(): { left: number; top: number; ancho: number; alto: number } {
    const ancho = Math.round(Math.min(window.innerWidth * 0.34, 460));
    // Por debajo de la caja de la webcam (top:16 + 200) para no tapar el
    // principio del texto, pero sin pisar la barra del jugador de abajo.
    const top = Math.round(
      Math.max(window.innerHeight * 0.13, Math.min(240, window.innerHeight * 0.3))
    );
    const alto = Math.round(
      Math.min(window.innerHeight * 0.42, 380, window.innerHeight - top - 96)
    );
    return { left: window.innerWidth - ancho - 20, top, ancho, alto };
  }

  /** Devuelve la barra de notas a su sitio de siempre (centrada arriba). */
  function barraEnPosicionNormal(): void {
    if (!barraNotas) return;
    barraNotas.style.left = "";
    barraNotas.style.top = "";
    barraNotas.style.right = "";
    barraNotas.style.transform = "";
  }

  function actualizarPosicionNotas(): void {
    const caja = cajaNotas;
    if (!caja || !hayNotas) return;

    // EL PAPEL RECIBE EL CLIC solo mientras se está en el atril y sin escribir
    // aún: con eso el clic entra a editar (el textarea, en cambio, solo se toca
    // con td-activo). Así el estudiante que clica la pizarra no edita nada.
    caja.classList.toggle("td-clic", panelActivo && !modoNotas);

    // PANTALLA EN GRANDE: ocupa toda la zona y no hay perspectiva que deshacer.
    // SIN recorte de silueta: los huecos dejaban ver el fondo de la caja
    // (casi negro) y quedaban como MANCHAS en forma de persona sobre el texto.
    // Quien mira en grande no tapa a nadie: su pantalla ES el tablero.
    if (modoCompleto) {
      barraEnPosicionNormal();
      caja.style.display = "block";
      caja.style.left = "0px";
      caja.style.top = "0px";
      caja.style.width = "100%";
      caja.style.height = "100%";
      caja.style.transform = "none";
      ajustarFuenteNotas(window.innerHeight);
      if (caja.style.clipPath) caja.style.clipPath = "";
      return;
    }

    // MODO ESCRITURA (solo se llega estando en el atril): el papel pasa a
    // PANEL FIJO A LA DERECHA con borde, como una superficie de EDICIÓN
    // cómoda y estable. Proyectarlo en la pizarra mientras se escribe no
    // sirve: desde el atril la pizarra está a las espaldas y su proyección
    // sale gigante e inestable.
    if (modoNotas) {
      barraEnPosicionNormal();
      const edicion = rectEdicion();
      caja.style.display = "block";
      caja.style.left = `${edicion.left}px`;
      caja.style.top = `${edicion.top}px`;
      caja.style.width = `${edicion.ancho}px`;
      caja.style.height = `${edicion.alto}px`;
      caja.style.transform = "none";
      ajustarFuenteNotas(edicion.alto);
      if (caja.style.clipPath) caja.style.clipPath = "";
      // La barra de acciones se planta bajo el papel en vez de en el centro
      // de arriba (allí choca con el panel de la clase).
      if (barraNotas && barraNotas.classList.contains("td-visible")) {
        barraNotas.style.left = "auto";
        barraNotas.style.right = "20px";
        barraNotas.style.top = `${edicion.top + edicion.alto + 10}px`;
        barraNotas.style.transform = "none";
      }
      return;
    }

    // VISTA DE LA SALA (cualquier otro, y el del atril cuando ya NO escribe):
    // el papel es un PANEL FIJO A LA DERECHA de solo lectura, igual que el del
    // que escribe pero sin borde editable. Así el estudiante ve a la derecha lo
    // que el profe teclea EN VIVO, sin proyectarlo en la pizarra 3D (la
    // proyección con homografía + recorte de silueta era la que dibujaba los
    // "domos" verdes, traba la página al acercarse y podía crashearla).
    barraEnPosicionNormal();
    const vista = rectEdicion();
    caja.style.display = "block";
    caja.style.left = `${vista.left}px`;
    caja.style.top = `${vista.top}px`;
    caja.style.width = `${vista.ancho}px`;
    caja.style.height = `${vista.alto}px`;
    caja.style.transform = "none";
    ajustarFuenteNotas(vista.alto);
    if (caja.style.clipPath) caja.style.clipPath = "";
  }

  function asegurarBarraNotas(): HTMLDivElement {
    if (barraNotas) return barraNotas;

    const caja = document.createElement("div");
    caja.className = "td-barra";
    caja.innerHTML =
      '<span style="font-size:13px;color:#9aa8c7">Notas del tablero</span>' +
      '<button type="button" class="td-accion" data-accion="descargar" ' +
      'title="Descargar las notas como archivo de texto">' +
      '<i class="fa-solid fa-download"></i> Descargar .txt</button>' +
      '<button type="button" class="td-accion td-suave" data-accion="limpiar" ' +
      'title="Borrar todo lo escrito"><i class="fa-solid fa-trash"></i> Limpiar</button>' +
      '<button type="button" class="td-accion" data-accion="listo">' +
      '<i class="fa-solid fa-check"></i> Listo</button>';
    document.body.appendChild(caja);
    barraNotas = caja;

    caja
      .querySelector<HTMLButtonElement>('[data-accion="descargar"]')!
      .addEventListener("click", descargarNotas);

    caja
      .querySelector<HTMLButtonElement>('[data-accion="limpiar"]')!
      .addEventListener("click", () => {
        borrarNotas();
        // El borrado manual también se comparte: el papel queda en blanco para todos.
        publicar({ tipo: "notas", texto: "" });
      });

    caja
      .querySelector<HTMLButtonElement>('[data-accion="listo"]')!
      .addEventListener("click", salirDeModoNotas);

    return caja;
  }

  function salirDeModoNotas(): void {
    if (!modoNotas) return;
    modoNotas = false;
    // Lo escrito se queda en el papel: solo se deja de escribir.
    textoNotas?.blur();
    cajaNotas?.classList.remove("td-activo");
    barraNotas?.classList.remove("td-visible");
    // Papel vacío tras "Listo": no tiene sentido pintar un blanco en la pizarra.
    const vacias = !textoNotas?.value.trim();
    hayNotas = !vacias;
    // Al terminar con el papel en blanco, la sala entera se entera (oculta el papel).
    if (vacias) publicar({ tipo: "notas", texto: "" });
  }

  function entrarEnModoNotas(): void {
    // SOLO ESCRIBE QUIEN ESTÁ EN EL ATRIL: todas las puertas (menú Publicar,
    // clic en el papel, clic en la vista) pasan por aquí, así que aunque un
    // estudiante tenga el foco en el papel no llega a teclear.
    if (!panelActivo) return;
    if (document.pointerLockElement) document.exitPointerLock();
    cerrarPantallaCompleta();
    // El papel queda SOLO para escribir: vídeo, imagen o YouTube se retiran
    // (es lo mismo que pasa al publicar cualquier otra cosa).
    cambiarContenido();

    const caja = asegurarNotas(true);
    if (!caja) return;

    // Si la sala ya tiene notas publicadas y aquí el papel está en blanco,
    // se cargan en el bloc para poder seguir editándolas (no empezar de cero
    // viendo una pizarra ajena en blanco).
    if (
      textoNotas &&
      !textoNotas.value &&
      ultimoMensaje?.tipo === "notas" &&
      ultimoMensaje.texto
    ) {
      textoNotas.value = ultimoMensaje.texto;
    }

    modoNotas = true;
    // Con la pizarra visible y sin textura el material sale en blanco: pizarra nueva.
    if (pantalla) pantalla.isVisible = true;
    // Primero la barra y luego la posición: así en el primer frame ya sale
    // debajo del papel (en el atril) en vez de un frame centrada arriba.
    asegurarBarraNotas().classList.add("td-visible");
    actualizarPosicionNotas();
    textoNotas?.focus();
  }

  /** Cuerpo del borrado, común a "limpiar" local y a lo que manda la sala. */
  function limpiarBase(): void {
    cerrarPantallaCompleta();
    cambiarContenido(); // retira todo y oculta el papel de notas
    borrarNotas(); // las notas también: limpiar es limpiar
    for (const url of diapositivas) URL.revokeObjectURL(url);
    diapositivas = [];
    indiceDiapositiva = 0;
    videoElemento = null;
    if (pantalla) pantalla.isVisible = false;
  }

  function limpiar(): void {
    limpiarBase();
    // La sala entera se entera: si uno limpia, la pizarra se limpia para todos.
    publicar({ tipo: "limpiar" });
  }

  function cambiarDiapositiva(direccion: 1 | -1): void {
    // Las ← → de UN estudiante no mueven la presentación de TODA la clase:
    // cambiar de diapositiva es cosa de quien está en el atril.
    if (!panelActivo) return;
    if (diapositivas.length === 0) return;
    indiceDiapositiva = (indiceDiapositiva + direccion + diapositivas.length) % diapositivas.length;
    mostrarImagen(diapositivas[indiceDiapositiva]);
  }

  function alternarPausa(): void {
    if (!videoElemento) return;
    if (videoElemento.paused) void videoElemento.play();
    else videoElemento.pause();
  }

  // -------------------------------------------------------------------------
  // VISTA DEL PRESENTADOR — la pantallita de quien está en el atril
  //
  // Mientras se presenta, la pizarra queda a las espaldas: sin esta vista hay
  // que girarse (y dejar de mirar a la clase) para comprobar qué se está
  // mostrando. El panel repite aquí lo que hay en la pizarra —imagen, la
  // miniatura de YouTube o un aviso de vídeo— y solo se ve mientras se está en
  // el atril (vistaPresentador(true)).
  //
  // NO DUPLICA DOS VISTAS: mientras se ESCRIBE (el papel está como panel de
  // edición a la derecha) o con pantalla compartida, la vista se OCULTA
  // (refrescarVistaPresentador). Al salir de ese estado vuelve sola y repite
  // lo de la pizarra, que está a las espaldas de quien presenta.
  //
  // Además ES UNA PUERTA DE ESCRITURA: con la pizarra vacía, el clic aquí
  // empieza a escribir; con el papel proyectado (vista oculta), el clic va al
  // propio papel (clase td-clic), que solo la recibe en el atril.
  // -------------------------------------------------------------------------

  function vistaPresentador(activa: boolean): void {
    if (activa === panelActivo) return;
    panelActivo = activa;
    clavePanel = ""; // al activarse hay que repintar aunque no haya cambiado nada
    if (activa) {
      asegurarPanelPresentador();
      // Quién decide si la pantallita SE VE es refrescarVistaPresentador():
      // mientras se escribe o con pantalla compartida, DUPLICARÍA lo que ya
      // está delante, así que ahí se queda oculta.
      refrescarVistaPresentador();
    } else if (panelPresentador) {
      panelPresentador.style.display = "none";
    }
  }

  function asegurarPanelPresentador(): void {
    if (panelPresentador) return;
    const panel = document.createElement("div");
    panel.className = "tb-mini";
    panel.title = "Clic para escribir en el tablero";
    panel.innerHTML =
      '<div class="tb-mini-titulo">Vista del tablero' +
      '<span class="tb-mini-escribir" title="Escribir en el tablero">&#9998;</span></div>' +
      '<div class="tb-mini-zona"><span class="tb-mini-vacio">Sin contenido en el tablero</span></div>';
    // CLIC EN LA VISTA → ESCRIBIR, pero SOLO si lo que hay en la pizarra son
    // las notas (o no hay nada). Con diapositivas, YouTube o pantalla
    // compartida el clic NO reacciona: para cambiar de contenido está el
    // menú Publicar (si no, un clic de más borraría la presentación).
    panel.addEventListener("click", () => {
      const conOtroContenido = Boolean(imagenActual || contenedorYoutube || videoElemento);
      if (conOtroContenido) return;
      if (!modoNotas) {
        cerrarMenu();
        entrarEnModoNotas();
      } else {
        textoNotas?.focus();
      }
    });
    document.body.appendChild(panel);
    panelPresentador = panel;
  }

  /**
   * Refresca la pantallita solo cuando cambia lo que se muestra: cada frame
   * se compara una cadena (barata) y el DOM solo se toca con la clave nueva,
   * para que mirar a la clase no cueste ni un milisegundo de más.
   */
  function refrescarVistaPresentador(): void {
    if (!panelActivo || !panelPresentador) return;

    // NO DOS VISTAS A LA VEZ: mientras se ESCRIBE, el papel está como panel
    // de edición a la derecha (ya delante del que escribe) y la pantallita
    // lo duplicaría; con una pantalla compartida pasa lo mismo. Al dejar de
    // escribir vuelve sola: el display="" obliga a repintar la próxima vez
    // que se muestre (entonces repite lo de la pizarra, que está a las
    // espaldas de quien presenta).
    const duplicaContenido = modoNotas || flujoPantalla !== null;
    const visibilidad = duplicaContenido ? "none" : "block";
    if (panelPresentador.style.display !== visibilidad) {
      panelPresentador.style.display = visibilidad;
      clavePanel = "";
    }
    if (duplicaContenido) return; // oculta: no hace falta pintar nada

    // Se captura el estado AHORA: el pintar es síncrono, así que no puede cambiar.
    const urlImagen = imagenActual;
    const idYoutube = youtubeActual;
    const notasVisibles = hayNotas;
    const notas = textoNotas?.value ?? "";

    let clave: string;
    let pintar: (zona: HTMLElement) => void;

    if (urlImagen) {
      clave = `imagen|${urlImagen}`;
      pintar = (zona) => {
        const img = document.createElement("img");
        img.alt = "Contenido del tablero";
        img.src = urlImagen;
        zona.replaceChildren(img);
      };
    } else if (idYoutube) {
      clave = `youtube|${idYoutube}`;
      pintar = (zona) => {
        const img = document.createElement("img");
        img.alt = "Vídeo de YouTube";
        // La miniatura del propio vídeo: sirve aunque el iframe real esté
        // tapado o en otra pestaña, y no duplica el reproductor.
        img.src = `https://img.youtube.com/vi/${idYoutube}/hqdefault.jpg`;
        zona.replaceChildren(img);
      };
    } else if (notasVisibles) {
      // Papel abierto pero todavía sin texto: se muestra un aviso en gris,
      // no un <pre> en blanco (que parecía un fallo de pintado).
      const vacias = !notas.trim();
      clave = `notas|${notas}`;
      pintar = (zona) => {
        const pre = document.createElement("pre");
        pre.className = "tb-mini-texto";
        pre.textContent = vacias ? "Escribiendo notas…" : notas;
        if (vacias) pre.style.color = "#94a3b8";
        zona.replaceChildren(pre);
      };
    } else if (videoElemento) {
      clave = "video";
      pintar = (zona) => {
        const aviso = document.createElement("span");
        aviso.className = "tb-mini-vacio";
        aviso.textContent = "Vídeo o pantalla compartida en reproducción";
        zona.replaceChildren(aviso);
      };
    } else {
      clave = "vacio";
      pintar = (zona) => {
        const aviso = document.createElement("span");
        aviso.className = "tb-mini-vacio";
        aviso.textContent = "Sin contenido en el tablero";
        zona.replaceChildren(aviso);
      };
    }

    if (clave === clavePanel) return;
    clavePanel = clave;
    const zona = panelPresentador.querySelector<HTMLElement>(".tb-mini-zona");
    if (zona) pintar(zona);
  }

  function actualizar(): void {
    // La textura de vídeo no avanza sola: Babylon solo la actualiza cuando llegan
    // eventos (canplay/seeked/paused). Sin este refresco a mano el tablero se
    // quedaría congelado en el primer fotograma.
    texturaVideo?.update();

    // NI EL IFRAME DE YOUTUBE NI EL PAPEL DE NOTAS SE PEGAN YA EN LA PIZARRA 3D:
    // el vídeo vive en una caja personal fija (arriba a la derecha) y las notas
    // en un panel lateral. Por eso ya NO se calcula la silueta de nadie para
    // recortar contenido HTML (era lo que dibujaba los "domos" verdes y traba la
    // página al acercarse alguien). Lo que va como TEXTURA en el tablero (PDF,
    // imágenes, vídeo subido, pantalla compartida) lo tapa el motor 3D solo.
    actualizarPosicionYoutube();
    actualizarPosicionNotas();
    refrescarPantallaCompleta();
    refrescarVistaPresentador();
  }

  // -------------------------------------------------------------------------
  // Menú y botones
  // -------------------------------------------------------------------------

  function abrirMenu(): void {
    // El menú es la puerta a subir contenido, presentar y limpiar: solo se
    // abre estando EN EL ATRIL (el rol filtra además QUÉ se puede subir).
    if (!panelActivo) return;
    // Con la pantalla en grande no tiene sentido el menú: se cierra antes.
    cerrarPantallaCompleta();
    // Tampoco se escribe mientras se publica otra cosa (lo escrito se queda).
    salirDeModoNotas();
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
  // Notas en el tablero: se cierra el menú y se empieza a escribir con el teclado.
  menuPublicar.querySelector("#btnNotas")!.addEventListener("click", () => {
    cerrarMenu();
    entrarEnModoNotas();
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

  // -------------------------------------------------------------------------
  // MENÚ SEGÚN EL ROL — el tablero es del SALÓN y lo comparten todos. Subir
  // imágenes, vídeo o YouTube solo lo hacen docente y admin (son archivos de
  // clase); el resto —estudiante e invitado— sí puede poner PDF, COMPARTIR SU
  // PANTALLA y LIMPIAR la pizarra, porque quien ocupa el atril es quien
  // presenta y maneja el tablero, venga de donde venga el rol. (El rol no
  // cambia dentro de una partida, por eso se aplica una sola vez al crear el
  // tablero.)
  // -------------------------------------------------------------------------
  const rolTablero = opciones.rol();
  if (rolTablero !== "docente" && rolTablero !== "admin") {
    for (const selector of ["#btnSubirImagenes", "#btnSubirVideo", "#btnYoutube"]) {
      const boton = menuPublicar.querySelector<HTMLElement>(selector);
      if (boton) boton.style.display = "none";
    }
  }

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
    // `limpiarBase`, no `limpiar`: salir NO debe avisar a la sala. La
    // pizarra compartida es del salón —quien se va no la borra para los
    // que siguen presentando— y el tablero local acaba igual de vacío.
    limpiarBase();
    detenerCapturaPantalla(); // por si acaso: limpiarBase ya lo hace al pasar por cambiarContenido
    if (temporizadorPublicacion !== null) {
      clearTimeout(temporizadorPublicacion);
      temporizadorPublicacion = null;
    }
    mensajePendiente = null;
    ultimoMensaje = null;
    menuPublicar.remove();
    cartelCargando.remove();
    inputPdf.remove();
    inputImagenes.remove();
    inputVideo.remove();
    estiloYoutube.remove();
    estiloCompleto.remove();
    estiloNotas.remove();
    estiloMini.remove();
    barraNotas?.remove();
    cajaNotas?.remove();
    panelPresentador?.remove();
    barraNotas = null;
    cajaNotas = null;
    textoNotas = null;
    panelPresentador = null;
    panelActivo = false;
    clavePanel = "";
    hayNotas = false;
    modoNotas = false;
    youtubeActual = null;
    imagenActual = null;
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
    aplicarMensaje,
    republicarContenido,
    abrirPantallaCompleta,
    cerrarPantallaCompleta,
    pantallaCompletaAbierta,
    escribirEnElTablero: entrarEnModoNotas,
    terminarDeEscribir: salirDeModoNotas,
    dibujoAbierto: () => modoNotas,
    vistaPresentador,
    refrescarVolumen,
    actualizar,
    destruir,
  };
}
