/**
 * MINI-VENTANA DE SKIN AL PULSAR "ENTRAR"
 * ---------------------------------------
 * Antes de entrar a la clase, el usuario elige entre las 2 skins de SU rol
 * (estudiante: mujer/hombre · docente: mujer/hombre · admin: mujer/hombre).
 * La elección se guarda en localStorage (estado.ts → guardarGeneroAvatar) y
 * la lee personaje.ts al cargar el modelo 3D dentro del salón.
 *
 *   void elegirSkin(cuenta.rol);   // no hace falta esperarla: ver abajo
 *
 * La ventana se abre EN PARALELO con la carga del salón (dashboard.ts →
 * entrarConSkin): el usuario ve el aula DETRÁS de esta ventana —antes salía
 * todo en blanco— y la promesa se registra aquí con marcarSkinPendiente() para
 * que cargarPersonaje espere a que se cierre antes de leer el género.
 *
 * Comportamiento:
 *  · Clic en una tarjeta = la selecciona (borde dorado + anillo, como el
 *    estado activo de todo el dashboard).
 *  · Botón "Entrar a la clase" (o Enter) = guarda la selección y cierra.
 *  · ESC, la X o clic fuera = cierra SIN cambiar lo ya guardado.
 *
 * ASPECTO: repite el lenguaje del front (login/dashboard). Cuelga de las
 * variables --c-* que monta preferencias.ts, así que respeta el tema
 * claro/oscuro, y usa el mismo dibujo de las tarjetas y del botón principal
 * dorado del dashboard (borde de 1px, esquinas de 14px, sin degradados).
 *
 * Módulo independiente de Babylon: solo DOM + estado.
 */

import "@fortawesome/fontawesome-free/css/all.min.css";
import {
  guardarGeneroAvatar,
  marcarSkinPendiente,
  obtenerGeneroAvatar,
  type GeneroAvatar,
  type Rol,
} from "../state/estado";
import { inyectarTema } from "../state/preferencias";
import { t } from "../state/idioma";

/** Las dos skins disponibles, con su ícono de respaldo. */
const SKINS: Array<{
  genero: GeneroAvatar;
  etiqueta: "skin.mujer" | "skin.hombre";
  icono: string;
}> = [
  { genero: "mujer", etiqueta: "skin.mujer", icono: "fa-person-dress" },
  { genero: "hombre", etiqueta: "skin.hombre", icono: "fa-person" },
];

/** Conjunto de modelos del rol: admin, docente o estudiante (igual que personaje.ts). */
type Conjunto = "admin" | "docente" | "estudiante";

function conjuntoDe(rol: Rol): Conjunto {
  return rol === "admin" ? "admin" : rol === "docente" ? "docente" : "estudiante";
}

/** Prefijo de la foto de rol en /images/ (docente → "profe", estudiante → "estu"). */
const FOTO_CONJUNTO: Record<Conjunto, string> = {
  admin: "admin",
  docente: "profe",
  estudiante: "estu",
};

/** "admin", "docente" o "estudiante" traducido, para la línea de ayuda. */
function conjuntoEnMinusculas(rol: Rol): string {
  return t(`rol.${conjuntoDe(rol)}`).toLowerCase();
}

// Estilos propios (se inyectan una sola vez). Todos los colores salen de
// las variables --c-* del tema: no hay ningún color escrito a mano.
const ESTILOS = `
  .sk-fondo {
    position: fixed; inset: 0; z-index: 6000;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    /* Velo sobre el SALÓN: la escena 3D ya se dibuja detrás de esta ventana,
       así que va oscuro y suave para que el aula se vea sin perder contraste. */
    background: rgb(9 13 20 / 42%);
    -webkit-backdrop-filter: blur(3px);
    backdrop-filter: blur(3px);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .sk-fondo *,
  .sk-fondo *::before,
  .sk-fondo *::after { box-sizing: border-box; }

  /* Panel: igual que las .dash-card (borde 1px, radio 14, sombra suave). */
  .sk-panel {
    position: relative;
    width: min(440px, 100%);
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    padding: 26px 28px 24px;
    background: var(--c-superficie);
    border: 1px solid var(--c-borde);
    border-radius: 14px;
    color: var(--c-texto);
    text-align: center;
    box-shadow: 0 24px 60px color-mix(in srgb, var(--c-sombra) 22%, transparent);
  }

  .sk-cerrar {
    position: absolute; top: 12px; right: 12px;
    width: 30px; height: 30px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--c-borde);
    border-radius: 8px;
    background: var(--c-superficie);
    color: var(--c-texto-suave);
    font-size: 13px;
    cursor: pointer;
    transition: background .15s ease, border-color .15s ease, color .15s ease;
  }

  .sk-cerrar:hover {
    background: var(--c-acento-suave);
    border-color: var(--c-acento);
    color: var(--c-acento-tinto);
  }

  /* Etiqueta de sección: la misma píldora de las cabeceras del dashboard. */
  .sk-etiqueta {
    display: inline-block;
    font-size: 10px; font-weight: 700; letter-spacing: 0.9px;
    text-transform: uppercase;
    color: var(--c-texto-suave);
    background: var(--c-superficie-suave);
    border: 1px solid var(--c-borde);
    border-radius: 6px;
    padding: 3px 9px;
    margin: 0 0 12px 0;
  }

  .sk-titulo {
    margin: 0 0 5px;
    font-size: 19px; font-weight: 600; letter-spacing: -0.3px;
    color: var(--c-texto);
  }

  .sk-pista {
    margin: 0 0 18px;
    font-size: 13px;
    color: var(--c-texto-suave);
  }

  .sk-opciones {
    display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;
  }

  /* Tarjeta de skin: ficha con borde de 1px como las del dashboard. */
  .sk-tarjeta {
    position: relative;
    width: 150px; padding: 16px 14px 13px;
    display: flex; flex-direction: column; align-items: center; gap: 9px;
    background: var(--c-superficie);
    border: 1px solid var(--c-borde);
    border-radius: 12px;
    color: var(--c-texto);
    font-family: inherit;
    cursor: pointer;
    transition: border-color .15s ease, box-shadow .15s ease,
      transform .15s ease, background .15s ease;
  }

  .sk-tarjeta:hover {
    transform: translateY(-2px);
    border-color: var(--c-acento);
  }

  /* Selección: acento dorado + anillo suave (estado activo del front). */
  .sk-tarjeta[aria-pressed="true"] {
    background: var(--c-acento-suave);
    border-color: var(--c-acento);
    box-shadow: 0 0 0 3px var(--c-accento-suave);
  }

  .sk-check {
    position: absolute; top: 8px; right: 9px;
    font-size: 14px;
    color: var(--c-acento-tinto);
    opacity: 0;
    transition: opacity .15s ease;
  }

  .sk-tarjeta[aria-pressed="true"] .sk-check { opacity: 1; }

  .sk-icono {
    font-size: 54px; line-height: 1;
    color: var(--c-marca);
  }

  .sk-nombre {
    font-size: 14px; font-weight: 600;
    color: var(--c-texto);
  }

  .sk-miniatura { display: none; width: 100%; height: 140px; object-fit: contain; }

  /* Botón principal: calco de .dash-boton-principal (dorado sólido). */
  .sk-entrar {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 8px; width: 100%; margin-top: 20px;
    padding: 11px 16px;
    border: 1px solid var(--c-acento);
    border-radius: 8px;
    background: var(--c-acento);
    color: var(--c-texto-boton);
    font-family: inherit; font-size: 13.5px; font-weight: 700;
    letter-spacing: 0.2px;
    cursor: pointer;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--c-acento) 35%, transparent);
    transition: background .15s ease, border-color .15s ease,
      transform .15s ease, box-shadow .15s ease;
  }

  .sk-entrar:hover {
    background: var(--c-acento-hover);
    border-color: var(--c-acento-hover);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px color-mix(in srgb, var(--c-acento) 38%, transparent);
  }

  .sk-entrar:active { transform: translateY(0); }

  .sk-fondo button:focus-visible {
    outline: 2px solid var(--c-acento);
    outline-offset: 2px;
  }
`;

function inyectarEstilos(): void {
  if (document.getElementById("estilos-skin")) return;
  const style = document.createElement("style");
  style.id = "estilos-skin";
  style.textContent = ESTILOS;
  document.head.appendChild(style);
}

/**
 * Abre la mini-ventana y resuelve cuando se cierra (confirmar, ESC, X o clic
 * fuera). Solo se guarda en confirmar; los otros caminos dejan intacta la
 * preferencia anterior.
 */
export function elegirSkin(rol: Rol): Promise<void> {
  const promesa = new Promise<void>((resolver) => {
    inyectarTema();
    inyectarEstilos();

    const conjunto = conjuntoDe(rol);
    let seleccion: GeneroAvatar = obtenerGeneroAvatar();

    const fondo = document.createElement("div");
    fondo.className = "sk-fondo";

    const tarjetas = SKINS.map((skin) => {
      const activa = skin.genero === seleccion;
      // Foto del rol + género (las mismas que usa el dashboard). Si no
      // cargara, el manejador de "error" de más abajo la quita y queda el
      // ícono de respaldo, sin ningún hueco roto.
      const foto = `/images/${FOTO_CONJUNTO[conjunto]}${skin.genero === "mujer" ? "F" : "M"}img.png`;
      return `
        <button
          type="button"
          class="sk-tarjeta"
          data-genero="${skin.genero}"
          aria-pressed="${activa}"
        >
          <i class="fa-solid fa-circle-check sk-check" aria-hidden="true"></i>
          <span class="sk-icono"><i class="fa-solid ${skin.icono}"></i></span>
          <img class="sk-miniatura" src="${foto}" alt="" />
          <span class="sk-nombre">${t(skin.etiqueta)}</span>
        </button>
      `;
    }).join("");

    fondo.innerHTML = `
      <div
        class="sk-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="skTitulo"
      >
        <button
          type="button"
          class="sk-cerrar"
          aria-label="${t("skin.cerrar")}"
          title="${t("skin.cerrar")}"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>

        <span class="sk-etiqueta">${t(`rol.${rol}`)}</span>

        <h2 class="sk-titulo" id="skTitulo">${t("skin.titulo")}</h2>
        <p class="sk-pista">
          ${t("skin.pista", { conjunto: conjuntoEnMinusculas(rol) })}
        </p>

        <div class="sk-opciones">${tarjetas}</div>

        <button type="button" class="sk-entrar">
          <i class="fa-solid fa-door-open" aria-hidden="true"></i>
          ${t("admin.entrarClase")}
        </button>
      </div>
    `;
    document.body.appendChild(fondo);

    // Miniaturas: si la foto existe tapa al ícono; si no cargara (o hay un
    // fallo de red), se quita y se queda el ícono de respaldo, sin ningún
    // hueco roto.
    for (const img of fondo.querySelectorAll<HTMLImageElement>(".sk-miniatura")) {
      img.addEventListener("load", () => {
        img.style.display = "block";
        img.previousElementSibling?.setAttribute("style", "display:none");
      });
      img.addEventListener("error", () => img.remove());
    }

    const botones = Array.from(fondo.querySelectorAll<HTMLButtonElement>(".sk-tarjeta"));

    function pintarSeleccion(): void {
      for (const boton of botones) {
        const activo = boton.dataset["genero"] === seleccion;
        boton.setAttribute("aria-pressed", String(activo));
      }
    }

    for (const boton of botones) {
      boton.addEventListener("click", () => {
        seleccion = boton.dataset["genero"] === "hombre" ? "hombre" : "mujer";
        pintarSeleccion();
      });
    }

    function cerrar(guardar: boolean): void {
      if (guardar) guardarGeneroAvatar(seleccion);
      window.removeEventListener("keydown", alTecla, true);
      fondo.remove();
      resolver();
    }

    function alTecla(evento: KeyboardEvent): void {
      // ESC = salir sin cambiar; Enter = confirmar la selección.
      if (evento.key === "Escape") {
        evento.stopPropagation();
        cerrar(false);
      } else if (evento.key === "Enter") {
        evento.preventDefault();
        cerrar(true);
      }
    }

    window.addEventListener("keydown", alTecla, true);

    fondo.querySelector(".sk-entrar")!.addEventListener("click", () => cerrar(true));
    // La X y el clic en el fondo (fuera del panel) = salir sin cambiar.
    fondo.querySelector(".sk-cerrar")!.addEventListener("click", () => cerrar(false));
    fondo.addEventListener("click", (evento) => {
      if (evento.target === fondo) cerrar(false);
    });
  });

  // Se marca ya mismo (síncrono): cargarPersonaje espera esta promesa antes
  // de leer el género, y por eso el salón se ve DETRÁS de la ventana en vez
  // de la pantalla en blanco de antes.
  marcarSkinPendiente(promesa);
  return promesa;
}
