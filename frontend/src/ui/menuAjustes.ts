/**
 * AJUSTES del metaverso (engranaje arriba a la izquierda).
 *
 * Módulo independiente: NO conoce Babylon, ni la escena, ni el personaje.
 * Solo recibe callbacks, así que cualquier mapa / partida nueva lo reutiliza
 * importándolo tal cual:
 *
 *   const menu = crearMenuAjustes({
 *     volumenInicial: 1,
 *     alCambiarVolumen: (v) => aplicarVolumen(v),
 *     alSalirDeLaClase: () => volverAlDashboard(),
 *   });
 *
 *   menu.abrir();
 *   menu.cerrar();
 *   menu.destruir();   // al salir de la partida
 *
 * Diseño tipo videojuego: ventana con NAVBAR LATERAL (Configuraciones /
 * Controles + botones Reanudar / Salir) y el contenido en UNA SOLA COLUMNA
 * de tarjetas, siguiendo el lenguaje visual de las preferencias del
 * dashboard (src/page/dashboard/dashboardComun.ts): encabezados en
 * mayúsculas con filete dorado, controles segmentados, interruptores y
 * notas con borde discontinuo. Usa las variables --c-* que monta
 * state/preferencias.ts, así que respeta tema claro/oscuro.
 */

import { t, type Clave } from "../state/idioma";
import {
  actualizarPreferencia,
  leerPreferencias,
  type Idioma,
  type Tema,
} from "../state/preferencias";

// ---------------------------------------------------------------------------
// Persistencia del volumen (se guarda en el navegador, no en la escena)
// ---------------------------------------------------------------------------

const CLAVE_VOLUMEN = "usta_metaverso_volumen";

/** Volumen guardado (0..1). 1 (100%) si nunca se ha tocado. */
export function leerVolumen(): number {
  const guardado = localStorage.getItem(CLAVE_VOLUMEN);
  if (guardado === null) return 1;
  const numero = parseFloat(guardado);
  if (!Number.isFinite(numero)) return 1;
  return Math.min(1, Math.max(0, numero));
}

export function guardarVolumen(volumen: number): void {
  localStorage.setItem(CLAVE_VOLUMEN, String(Math.min(1, Math.max(0, volumen))));
}

// ---------------------------------------------------------------------------
// Contenido del panel
// ---------------------------------------------------------------------------

interface Control {
  /** Clave del diccionario (state/idioma.ts). */
  accion: Clave;
  /**
   * Tecla o atajo. Si empieza por "juego." es una clave del diccionario
   * (solo las que cambian entre idiomas); el resto es texto literal.
   */
  tecla: string;
}

const CONTROLES: Control[] = [
  { accion: "juego.control.moverse", tecla: "W A S D" },
  { accion: "juego.control.mirar", tecla: "Mouse" },
  { accion: "juego.control.liberarMouse", tecla: "Esc" },
  { accion: "juego.control.sentarse", tecla: "E" },
  { accion: "juego.control.atril", tecla: "R" },
  { accion: "juego.control.camara", tecla: "B" },
  { accion: "juego.control.mano", tecla: "H" },
  { accion: "juego.control.microfono", tecla: "juego.tecla.barraSuperior" },
  { accion: "juego.control.webcam", tecla: "juego.tecla.barraSuperior" },
  { accion: "juego.control.publicar", tecla: "P" },
  { accion: "juego.control.verTablero", tecla: "juego.tecla.clicPantalla" },
  { accion: "juego.control.cerrarPantalla", tecla: "Esc" },
  { accion: "juego.control.compartir", tecla: "P" },
  { accion: "juego.control.escribir", tecla: "P" },
  { accion: "juego.control.diapositiva", tecla: "← / →" },
  { accion: "juego.control.pausar", tecla: "juego.tecla.espacio" },
  { accion: "juego.control.borrar", tecla: "juego.tecla.supr" },
];

/** Traduce la tecla solo si es una clave del diccionario ("juego.tecla.*"). */
function textoTecla(tecla: string): string {
  return tecla.startsWith("juego.") ? t(tecla as Clave) : tecla;
}

type Pestana = "config" | "controles";

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export interface OpcionesMenuAjustes {
  /** Volumen con el que arranca el slider (0..1). Por defecto, el guardado. */
  volumenInicial?: number;
  /** Se llama cada vez que el usuario mueve el slider (0..1). */
  alCambiarVolumen?: (volumen: number) => void;
  /** Botón rojo "Salir de la clase": vuelve a la sesión con la que entraste. */
  alSalirDeLaClase: () => void;
}

export interface MenuAjustes {
  abrir: () => void;
  cerrar: () => void;
  alternar: () => void;
  /** Deja el slider al día si el volumen cambió desde otro sitio (p. ej. el botón de volumen de la barra). */
  actualizarVolumen: (volumen: number) => void;
  /** Quita el engranaje y el panel del DOM (al salir de la partida). */
  destruir: () => void;
}

export function crearMenuAjustes(opciones: OpcionesMenuAjustes): MenuAjustes {
  // -------------------------------------------------------------------------
  // Botón engranaje (arriba a la izquierda)
  // -------------------------------------------------------------------------

  const botonAjustes = document.createElement("button");
  botonAjustes.type = "button";
  botonAjustes.innerHTML = '<i class="fa-solid fa-gear"></i>';
  botonAjustes.title = "Ajustes";
  botonAjustes.style.position = "absolute";
  botonAjustes.style.top = "16px";
  botonAjustes.style.left = "16px";
  botonAjustes.style.width = "44px";
  botonAjustes.style.height = "44px";
  botonAjustes.style.fontSize = "20px";
  botonAjustes.style.borderRadius = "50%";
  botonAjustes.style.border = "1px solid rgba(255,255,255,0.25)";
  botonAjustes.style.background = "rgba(15,23,42,0.85)";
  botonAjustes.style.color = "white";
  botonAjustes.style.cursor = "pointer";
  botonAjustes.style.zIndex = "1500";
  botonAjustes.style.boxShadow = "0 4px 12px rgba(0,0,0,0.35)";
  document.body.appendChild(botonAjustes);

  // -------------------------------------------------------------------------
  // Panel
  // -------------------------------------------------------------------------

  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.6)";
  overlay.style.display = "none";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "2500";
  overlay.style.fontFamily = "sans-serif";

  /** Volumen vigente en la interfaz (el slider no es la fuente tras repintar). */
  let volumen = opciones.volumenInicial ?? leerVolumen();
  /** Pestaña abierta: se conserva al repintar (cambio de tema / idioma). */
  let pestana: Pestana = "config";

  // -------------------------------------------------------------------------
  // Plantilla: navbar lateral + contenido en una sola columna
  // -------------------------------------------------------------------------

  function plantilla(): string {
    const preferencias = leerPreferencias();

    return `
    <style>
      /* Ventana de ajustes: navbar lateral + contenido en una sola columna */
      .aj-panel {
        display: flex;
        width: min(960px, 94vw);
        max-height: 86vh;
        background: var(--c-fondo);
        border: 1px solid var(--c-borde);
        border-radius: 16px;
        color: var(--c-texto);
        overflow: hidden;
        box-shadow: 0 24px 60px rgba(0,0,0,0.5);
      }

      /* ── NAVBAR LATERAL ─────────────────────────────────────────── */
      .aj-lateral {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 232px;
        flex: 0 0 232px;
        padding: 22px 16px;
        background: var(--c-superficie-suave);
        border-right: 1px solid var(--c-borde);
      }
      .aj-marca {
        display: inline-block;
        align-self: flex-start;
        padding: 4px 11px;
        margin: 0 0 14px 4px;
        border: 1px solid var(--c-borde);
        background: var(--c-superficie);
        border-radius: 7px;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        color: var(--c-texto-suave);
      }
      .aj-nav-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 10px 12px;
        border: 1px solid transparent;
        border-radius: 9px;
        background: transparent;
        color: var(--c-texto-suave);
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
      }
      .aj-nav-item i { width: 16px; text-align: center; }
      .aj-nav-item:hover { color: var(--c-texto); background: var(--c-superficie); }
      .aj-nav-item[aria-selected="true"] {
        background: var(--c-superficie);
        border-color: var(--c-borde);
        color: var(--c-texto);
        box-shadow: 0 1px 2px color-mix(in srgb, var(--c-sombra) 6%, transparent);
      }
      .aj-nav-item[aria-selected="true"] i { color: var(--c-acento); }
      .aj-nav-item:focus-visible {
        outline: 2px solid var(--c-acento);
        outline-offset: 2px;
      }

      .aj-lateral-acciones {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: auto;
        padding-top: 16px;
        border-top: 1px solid var(--c-borde);
      }
      .aj-nota-lateral {
        margin: 0;
        font-size: 10.5px;
        line-height: 1.5;
        color: var(--c-texto-tenue);
        text-align: center;
      }

      /* ── CONTENIDO (una sola columna) ───────────────────────────── */
      .aj-contenido {
        flex: 1;
        min-width: 0;
        padding: 26px 30px;
        overflow-y: auto;
      }
      .aj-titulo {
        margin: 0 0 4px 0;
        font-size: 24px;
        font-weight: 800;
        color: var(--c-texto);
      }
      .aj-titulo i { color: var(--c-acento); }
      .aj-subtitulo { margin: 0; font-size: 13.5px; color: var(--c-texto-suave); }
      .aj-columna {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-top: 20px;
      }

      .aj-card {
        display: flex;
        flex-direction: column;
        gap: 14px;
        background: var(--c-superficie);
        border: 1px solid var(--c-borde);
        border-radius: 14px;
        padding: 20px 22px;
        box-shadow: 0 1px 2px color-mix(in srgb, var(--c-sombra) 4%, transparent);
      }
      .aj-card-cab {
        padding-bottom: 12px;
        border-bottom: 1px solid var(--c-borde-suave);
      }
      .aj-card-titulo {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        color: var(--c-texto-suave);
      }
      .aj-card-titulo::before {
        content: "";
        width: 3px;
        height: 12px;
        border-radius: 2px;
        background: var(--c-acento);
      }

      .aj-fila {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .aj-texto { flex: 1 1 200px; min-width: 0; }
      .aj-fila-titulo {
        margin: 0;
        font-size: 13.5px;
        font-weight: 600;
        color: var(--c-texto);
      }
      .aj-fila-pista {
        margin: 4px 0 0 0;
        font-size: 12.5px;
        line-height: 1.5;
        color: var(--c-texto-tenue);
      }
      .aj-nota {
        margin: 0;
        padding-top: 12px;
        border-top: 1px dashed var(--c-borde-suave);
        font-size: 12px;
        line-height: 1.5;
        color: var(--c-texto-tenue);
      }
      .aj-valor {
        font-size: 13.5px;
        font-weight: 700;
        color: var(--c-acento);
      }
      .aj-slider {
        width: 100%;
        margin-top: 4px;
        accent-color: var(--c-acento);
        cursor: pointer;
      }

      /* Control segmentado: tema e idioma (mismo lenguaje que el dashboard) */
      .aj-segmentado {
        display: inline-flex;
        gap: 4px;
        padding: 4px;
        background: var(--c-superficie-suave);
        border: 1px solid var(--c-borde);
        border-radius: 10px;
        flex: 0 0 auto;
      }
      .aj-segmentado-opcion {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 7px 13px;
        border: 1px solid transparent;
        border-radius: 7px;
        background: transparent;
        color: var(--c-texto-suave);
        font-family: inherit;
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
      }
      .aj-segmentado-opcion:hover { color: var(--c-texto); }
      .aj-segmentado-opcion[aria-pressed="true"] {
        background: var(--c-superficie);
        border-color: var(--c-borde);
        color: var(--c-texto);
        box-shadow: 0 1px 2px color-mix(in srgb, var(--c-sombra) 6%, transparent);
      }
      .aj-segmentado-opcion[aria-pressed="true"] i { color: var(--c-acento); }

      /* Interruptor: reducir animaciones */
      .aj-interruptor {
        flex: 0 0 auto;
        width: 46px;
        height: 26px;
        padding: 3px;
        border: 1px solid var(--c-borde);
        border-radius: 999px;
        background: var(--c-superficie-suave);
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.15s ease;
      }
      .aj-interruptor-punto {
        display: block;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--c-texto-tenue);
        transition: transform 0.18s ease, background 0.18s ease;
      }
      .aj-interruptor[aria-checked="true"] {
        background: var(--c-acento-suave);
        border-color: var(--c-acento-borde);
      }
      .aj-interruptor[aria-checked="true"] .aj-interruptor-punto {
        background: var(--c-acento);
        transform: translateX(20px);
      }
      .aj-segmentado-opcion:focus-visible,
      .aj-interruptor:focus-visible {
        outline: 2px solid var(--c-acento);
        outline-offset: 2px;
      }

      /* Botones de acción (Reanudar / Salir) */
      .aj-boton {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 11px 12px;
        border: none;
        border-radius: 9px;
        font-family: inherit;
        font-weight: 700;
        font-size: 13.5px;
        cursor: pointer;
      }
      .aj-boton-primario { background: var(--c-acento); color: var(--c-texto-boton); }
      .aj-boton-primario:hover { background: var(--c-acento-hover); }
      .aj-boton-peligro { background: var(--c-error); color: #fff; }

      /* Controles */
      .aj-controles { columns: 2; column-gap: 26px; }
      .aj-fila-control {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        padding: 8px 0;
        border-bottom: 1px solid var(--c-borde-suave);
        font-size: 13.5px;
        color: var(--c-texto);
        break-inside: avoid;
        -webkit-column-break-inside: avoid;
      }
      .aj-tecla {
        color: var(--c-acento);
        font-weight: 700;
        white-space: nowrap;
      }

      @media (max-width: 820px) {
        .aj-panel { flex-direction: column; max-height: 92vh; }
        .aj-lateral {
          width: auto;
          flex: 0 0 auto;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          border-right: none;
          border-bottom: 1px solid var(--c-borde);
          overflow-x: auto;
        }
        .aj-marca { display: none; }
        .aj-nav-item { width: auto; white-space: nowrap; }
        .aj-lateral-acciones {
          flex-direction: row;
          margin-top: 0;
          margin-left: auto;
          padding-top: 0;
          border-top: none;
        }
        .aj-lateral-acciones .aj-nota-lateral { display: none; }
        .aj-boton { width: auto; white-space: nowrap; }
        .aj-contenido { padding: 20px; }
        .aj-controles { columns: 1; }
        .aj-fila { align-items: flex-start; flex-direction: column; }
        .aj-segmentado { width: 100%; }
        .aj-segmentado-opcion { flex: 1; justify-content: center; }
      }
    </style>

    <div class="aj-panel" role="dialog" aria-label="${t("ajustes.etiqueta")}">

      <!-- ── NAVBAR LATERAL ── -->
      <nav class="aj-lateral">
        <span class="aj-marca">${t("ajustes.etiqueta")}</span>

        <button
          class="aj-nav-item"
          type="button"
          role="tab"
          data-pestana="config"
          aria-selected="${pestana === "config"}"
        >
          <i class="fa-solid fa-sliders"></i>
          <span>${t("juego.ajustes.navConfig")}</span>
        </button>

        <button
          class="aj-nav-item"
          type="button"
          role="tab"
          data-pestana="controles"
          aria-selected="${pestana === "controles"}"
        >
          <i class="fa-solid fa-keyboard"></i>
          <span>${t("juego.ajustes.navControles")}</span>
        </button>

        <div class="aj-lateral-acciones">
          <button id="btnReanudar" type="button" class="aj-boton aj-boton-primario">
            <i class="fa-solid fa-play"></i>
            <span>${t("juego.ajustes.reanudar")}</span>
          </button>

          <button id="btnSalirClase" type="button" class="aj-boton aj-boton-peligro">
            <i class="fa-solid fa-right-from-bracket"></i>
            <span>${t("juego.ajustes.salir")}</span>
          </button>

          <p class="aj-nota-lateral">${t("juego.ajustes.pistaSalir")}</p>
        </div>
      </nav>

      <!-- ── CONTENIDO (una sola columna) ── -->
      <div class="aj-contenido">

        <section id="pestanaConfig" role="tabpanel">
          <h2 class="aj-titulo"><i class="fa-solid fa-sliders"></i> ${t("ajustes.titulo")}</h2>
          <p class="aj-subtitulo">${t("ajustes.subtitulo")}</p>

          <div class="aj-columna">

            <section class="aj-card">
              <div class="aj-card-cab">
                <p class="aj-card-titulo">
                  <i class="fa-solid fa-volume-high"></i>
                  ${t("juego.ajustes.audio")}
                </p>
              </div>

              <div>
                <div class="aj-fila">
                  <p class="aj-fila-titulo">${t("juego.ajustes.volumen")}</p>
                  <span id="valorVolumen" class="aj-valor">100%</span>
                </div>
                <p class="aj-fila-pista">${t("juego.ajustes.pistaVolumen")}</p>
                <input id="sliderVolumen" class="aj-slider" type="range" min="0" max="1" step="0.05" />
              </div>
            </section>

            <section class="aj-card">
              <div class="aj-card-cab">
                <p class="aj-card-titulo">
                  <i class="fa-solid fa-palette"></i>
                  ${t("ajustes.apariencia")}
                </p>
              </div>

              <div class="aj-fila">
                <div class="aj-texto">
                  <p class="aj-fila-titulo">${t("ajustes.tema")}</p>
                  <p class="aj-fila-pista">${t("ajustes.pistaTema")}</p>
                </div>

                <div class="aj-segmentado" role="group" aria-label="${t("ajustes.tema")}">
                  <button
                    class="aj-segmentado-opcion"
                    type="button"
                    data-ajuste="tema"
                    data-valor="claro"
                    aria-pressed="${preferencias.tema === "claro"}"
                  >
                    <i class="fa-solid fa-sun"></i>
                    <span>${t("ajustes.temaClaro")}</span>
                  </button>
                  <button
                    class="aj-segmentado-opcion"
                    type="button"
                    data-ajuste="tema"
                    data-valor="oscuro"
                    aria-pressed="${preferencias.tema === "oscuro"}"
                  >
                    <i class="fa-solid fa-moon"></i>
                    <span>${t("ajustes.temaOscuro")}</span>
                  </button>
                </div>
              </div>

              <div class="aj-fila">
                <div class="aj-texto">
                  <p class="aj-fila-titulo">${t("ajustes.idioma")}</p>
                  <p class="aj-fila-pista">${t("ajustes.pistaIdioma")}</p>
                </div>

                <div class="aj-segmentado" role="group" aria-label="${t("ajustes.idioma")}">
                  <button
                    class="aj-segmentado-opcion"
                    type="button"
                    data-ajuste="idioma"
                    data-valor="es"
                    aria-pressed="${preferencias.idioma === "es"}"
                  >
                    <span>${t("ajustes.idiomaEs")}</span>
                  </button>
                  <button
                    class="aj-segmentado-opcion"
                    type="button"
                    data-ajuste="idioma"
                    data-valor="en"
                    aria-pressed="${preferencias.idioma === "en"}"
                  >
                    <span>${t("ajustes.idiomaEn")}</span>
                  </button>
                </div>
              </div>
            </section>

            <section class="aj-card">
              <div class="aj-card-cab">
                <p class="aj-card-titulo">
                  <i class="fa-solid fa-universal-access"></i>
                  ${t("ajustes.accesibilidad")}
                </p>
              </div>

              <div class="aj-fila">
                <div class="aj-texto">
                  <p class="aj-fila-titulo">${t("ajustes.reducirAnimaciones")}</p>
                  <p class="aj-fila-pista">${t("ajustes.descAnimaciones")}</p>
                </div>

                <button
                  class="aj-interruptor"
                  type="button"
                  role="switch"
                  aria-checked="${preferencias.reducirMovimiento}"
                  aria-label="${t("ajustes.reducirAnimaciones")}"
                  data-ajuste="movimiento"
                >
                  <span class="aj-interruptor-punto"></span>
                </button>
              </div>

              <p class="aj-nota">${t("ajustes.pistaAnimaciones")}</p>
            </section>

          </div>
        </section>

        <section id="pestanaControles" role="tabpanel" hidden>
          <h2 class="aj-titulo"><i class="fa-solid fa-keyboard"></i> ${t("juego.ajustes.controles")}</h2>
          <p class="aj-subtitulo">${t("juego.ajustes.subControles")}</p>

          <div class="aj-columna">
            <section class="aj-card">
              <div class="aj-controles">
                ${CONTROLES.map(
                  (a) => `
                  <div class="aj-fila-control">
                    <span>${t(a.accion)}</span>
                    <span class="aj-tecla">${textoTecla(a.tecla)}</span>
                  </div>
                `,
                ).join("")}
              </div>
            </section>
          </div>
        </section>

      </div>
    </div>
  `;
  }

  // -------------------------------------------------------------------------
  // Repintado y cableado (se vuelve a montar tras cada cambio de preferencia:
  // así se actualizan aria-pressed y TODOS los textos en el idioma nuevo)
  // -------------------------------------------------------------------------

  function pintarVolumen(): void {
    const slider = overlay.querySelector<HTMLInputElement>("#sliderVolumen");
    const valor = overlay.querySelector<HTMLElement>("#valorVolumen");
    if (slider) slider.value = String(volumen);
    if (valor) valor.textContent = `${Math.round(volumen * 100)}%`;
  }

  function mostrarPestana(): void {
    const config = overlay.querySelector<HTMLElement>("#pestanaConfig");
    const controles = overlay.querySelector<HTMLElement>("#pestanaControles");
    if (config) config.hidden = pestana !== "config";
    if (controles) controles.hidden = pestana !== "controles";
    overlay.querySelectorAll<HTMLButtonElement>("[data-pestana]").forEach((boton) => {
      boton.setAttribute("aria-selected", String(boton.dataset.pestana === pestana));
    });
  }

  function pintar(): void {
    overlay.innerHTML = plantilla();
    botonAjustes.title = t("ajustes.etiqueta");
    botonAjustes.setAttribute("aria-label", t("ajustes.etiqueta"));
    pintarVolumen();
    cablear();
    mostrarPestana();
  }

  function aplicarPreferencia(cambios: Parameters<typeof actualizarPreferencia>[0]): void {
    actualizarPreferencia(cambios);
    pintar();
  }

  function cablear(): void {
    overlay.querySelectorAll<HTMLButtonElement>("[data-pestana]").forEach((boton) => {
      boton.addEventListener("click", () => {
        pestana = boton.dataset.pestana as Pestana;
        mostrarPestana();
      });
    });

    const slider = overlay.querySelector<HTMLInputElement>("#sliderVolumen");
    slider?.addEventListener("input", () => {
      volumen = parseFloat(slider.value);
      pintarVolumen();
      guardarVolumen(volumen);
      opciones.alCambiarVolumen?.(volumen);
    });

    overlay
      .querySelectorAll<HTMLButtonElement>('[data-ajuste="tema"]')
      .forEach((boton) => {
        boton.addEventListener("click", () => {
          aplicarPreferencia({ tema: boton.dataset.valor as Tema });
        });
      });

    overlay
      .querySelectorAll<HTMLButtonElement>('[data-ajuste="idioma"]')
      .forEach((boton) => {
        boton.addEventListener("click", () => {
          aplicarPreferencia({ idioma: boton.dataset.valor as Idioma });
        });
      });

    const interruptor = overlay.querySelector<HTMLButtonElement>('[data-ajuste="movimiento"]');
    interruptor?.addEventListener("click", () => {
      aplicarPreferencia({ reducirMovimiento: !leerPreferencias().reducirMovimiento });
    });

    overlay.querySelector("#btnReanudar")?.addEventListener("click", cerrar);

    overlay.querySelector("#btnSalirClase")?.addEventListener("click", () => {
      cerrar();
      opciones.alSalirDeLaClase();
    });
  }

  pintar();
  document.body.appendChild(overlay);

  // -------------------------------------------------------------------------
  // Comportamiento
  // -------------------------------------------------------------------------

  function abrir(): void {
    // El puntero está "bloqueado" mirando la escena: hay que liberarlo o no se
    // puede mover el slider ni pulsar los botones del panel.
    if (document.pointerLockElement) document.exitPointerLock();
    overlay.style.display = "flex";
  }

  function cerrar(): void {
    overlay.style.display = "none";
  }

  function alternar(): void {
    if (overlay.style.display === "none") abrir();
    else cerrar();
  }

  // Clic fuera del panel = cerrar (se engancha una sola vez: el nodo overlay
  // sobrevive a los repintados de su interior)
  overlay.addEventListener("click", (evento) => {
    if (evento.target === overlay) cerrar();
  });

  botonAjustes.addEventListener("click", alternar);

  function destruir(): void {
    botonAjustes.remove();
    overlay.remove();
  }

  return {
    abrir,
    cerrar,
    alternar,
    actualizarVolumen: (nuevo: number) => {
      volumen = nuevo;
      pintarVolumen();
    },
    destruir,
  };
}
