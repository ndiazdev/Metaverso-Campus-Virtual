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
 */

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

const CONTROLES = [
  { accion: "Moverse", tecla: "W A S D" },
  { accion: "Mirar alrededor", tecla: "Mouse" },
  { accion: "Liberar el mouse / abrir ajustes", tecla: "Esc" },
  { accion: "Sentarse / levantarse", tecla: "E" },
  { accion: "Ir al atril / salir del atril", tecla: "R" },
  { accion: "Cambiar cámara (1ra / 3ra persona)", tecla: "B" },
  { accion: "Alzar la mano", tecla: "H" },
  { accion: "Micrófono y emotes", tecla: "Barra superior" },
  { accion: "Cámara web (tu videocámara)", tecla: "Barra superior" },
  { accion: "Publicar en el tablero (en el atril)", tecla: "P" },
  { accion: "Ver el tablero en grande (estando lejos)", tecla: "Clic sobre la pantalla" },
  { accion: "Cerrar la pantalla en grande", tecla: "Esc" },
  { accion: "Compartir pantalla (en el tablero)", tecla: "P" },
  { accion: "Escribir a mano en el tablero", tecla: "P" },
  { accion: "Cambiar diapositiva", tecla: "← / →" },
  { accion: "Pausar / reanudar video", tecla: "Espacio" },
  { accion: "Borrar el tablero", tecla: "Supr / Backspace" },
];

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

  overlay.innerHTML = `
    <style>
      /* Ajustes: panel ancho de computador (dos columnas), no de celular */
      .aj-panel {
        background:#0f172a; border:1px solid rgba(255,255,255,0.15);
        border-radius:16px; padding:32px 36px; width:min(900px, 92vw);
        color:white; max-height:85vh; overflow-y:auto;
        box-shadow:0 24px 60px rgba(0,0,0,0.5);
      }
      .aj-cuerpo {
        display:grid; grid-template-columns: minmax(260px, 1fr) 1.6fr;
        gap:36px; align-items:start;
      }
      .aj-controles { columns:2; column-gap:30px; }
      .aj-fila {
        display:flex; justify-content:space-between; gap:14px; padding:8px 0;
        border-bottom:1px solid rgba(255,255,255,0.08); font-size:13.5px;
        break-inside:avoid; -webkit-column-break-inside:avoid;
      }
      .aj-boton {
        width:100%; padding:12px; border:none; border-radius:9px;
        font-weight:bold; cursor:pointer; font-size:14px;
      }
      @media (max-width: 780px) {
        .aj-panel { padding:24px; width:94vw; }
        .aj-cuerpo { grid-template-columns:1fr; gap:24px; }
        .aj-controles { columns:1; }
      }
    </style>

    <div class="aj-panel">
      <h2 style="margin:0 0 20px 0; text-align:center; font-size:22px;"><i class="fa-solid fa-gear"></i> Ajustes</h2>

      <div class="aj-cuerpo">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label for="sliderVolumen" style="font-size:13.5px; color:#9aa8c7;"><i class="fa-solid fa-volume-high"></i> Volumen general</label>
            <span id="valorVolumen" style="font-size:13.5px; color:#F2A93B; font-weight:bold;">100%</span>
          </div>
          <input id="sliderVolumen" type="range" min="0" max="1" step="0.05" style="width:100%; margin:8px 0 26px 0;" />

          <button id="btnReanudar" type="button" class="aj-boton" style="background:#F2A93B; color:#1a1a1a; margin-bottom:10px;"><i class="fa-solid fa-play"></i> Reanudar</button>
          <button id="btnSalirClase" type="button" class="aj-boton" style="background:#EF4444; color:white;"><i class="fa-solid fa-right-from-bracket"></i> Salir de la clase</button>
          <p style="margin:14px 0 0; font-size:11.5px; color:#64748b; text-align:center;">Sales al panel de la cuenta con la que entraste.</p>
        </div>

        <div>
          <p style="font-size:13.5px; color:#9aa8c7; margin:0 0 6px 0;">Controles y botones</p>
          <div class="aj-controles">
            ${CONTROLES.map(
              (a) => `
              <div class="aj-fila">
                <span>${a.accion}</span>
                <span style="color:#F2A93B; font-weight:bold; white-space:nowrap;">${a.tecla}</span>
              </div>
            `
            ).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const sliderVolumen = overlay.querySelector<HTMLInputElement>("#sliderVolumen")!;
  const valorVolumen = overlay.querySelector<HTMLElement>("#valorVolumen")!;

  function pintarVolumen(volumen: number): void {
    sliderVolumen.value = String(volumen);
    valorVolumen.textContent = `${Math.round(volumen * 100)}%`;
  }

  pintarVolumen(opciones.volumenInicial ?? leerVolumen());

  sliderVolumen.addEventListener("input", () => {
    const volumen = parseFloat(sliderVolumen.value);
    pintarVolumen(volumen);
    guardarVolumen(volumen);
    opciones.alCambiarVolumen?.(volumen);
  });

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

  overlay.querySelector("#btnReanudar")!.addEventListener("click", cerrar);

  // Clic fuera del panel = cerrar
  overlay.addEventListener("click", (evento) => {
    if (evento.target === overlay) cerrar();
  });

  overlay.querySelector("#btnSalirClase")!.addEventListener("click", () => {
    cerrar();
    opciones.alSalirDeLaClase();
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
    actualizarVolumen: pintarVolumen,
    destruir,
  };
}
