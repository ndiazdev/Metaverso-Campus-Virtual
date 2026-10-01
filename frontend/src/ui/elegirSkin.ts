/**
 * MINI-VENTANA DE SKIN AL PULSAR "ENTRAR"
 * ---------------------------------------
 * Antes de entrar a la clase, el usuario elige entre las 2 skins de SU rol
 * (estudiante: mujer/hombre · docente: mujer/hombre). La elección se guarda
 * en localStorage (estado.ts → guardarGeneroAvatar) y la lee personaje.ts al
 * cargar el modelo 3D dentro del salón.
 *
 *   const genero = await elegirSkin(cuenta.rol);   // resuelve tras el cierre
 *
 * Comportamiento:
 *  · Clic en una tarjeta = la selecciona (borde #F2A93B).
 *  · Botón "Entrar a la clase" = guarda la selección y cierra.
 *  · ESC o clic fuera = cierra SIN cambiar lo ya guardado.
 *
 * Módulo independiente de Babylon: solo DOM + estado.
 */

import "@fortawesome/fontawesome-free/css/all.min.css";
import {
  guardarGeneroAvatar,
  obtenerGeneroAvatar,
  type GeneroAvatar,
  type Rol,
} from "../state/estado";

/** Las dos skins disponibles, con su ícono de respaldo. */
const SKINS: Array<{ genero: GeneroAvatar; nombre: string; icono: string }> = [
  { genero: "mujer", nombre: "Mujer", icono: "fa-person-dress" },
  { genero: "hombre", nombre: "Hombre", icono: "fa-person" },
];

/** Nombre del conjunto según el rol (igual criterio que CATALOGO en personaje.ts). */
function nombreConjunto(rol: Rol): string {
  return rol === "docente" || rol === "admin" ? "Docente" : "Estudiante";
}

function claveConjunto(rol: Rol): string {
  return rol === "docente" || rol === "admin" ? "docente" : "estudiante";
}

/**
 * Abre la mini-ventana y resuelve cuando se cierra (confirmar, ESC o clic
 * fuera). Solo se guarda en confirmar; los otros caminos dejan intacta la
 * preferencia anterior.
 */
export function elegirSkin(rol: Rol): Promise<void> {
  return new Promise((resolver) => {
    const conjunto = claveConjunto(rol);
    let seleccion: GeneroAvatar = obtenerGeneroAvatar();

    const fondo = document.createElement("div");
    fondo.style.cssText = [
      "position:fixed",
      "inset:0",
      "background:rgba(11,7,40,0.72)",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "z-index:6000",
      "font-family:sans-serif",
      "backdrop-filter:blur(3px)",
    ].join(";");

    const tarjetas = SKINS.map((skin) => {
      const activa = skin.genero === seleccion;
      const clave = `${conjunto}-${skin.genero}`;
      return `
        <button type="button" class="sk-tarjeta" data-genero="${skin.genero}"
          style="
            background:#f7f8ff; border:3px solid ${activa ? "#F2A93B" : "rgba(22,16,74,0.15)"};
            border-radius:16px; padding:14px 14px 12px; width:170px; cursor:pointer;
            display:flex; flex-direction:column; align-items:center; gap:8px;
            transition:border-color .15s, transform .15s;
          ">
          <span class="sk-icono" style="font-size:64px; color:#16104A;">
            <i class="fa-solid ${skin.icono}"></i>
          </span>
          <img class="sk-miniatura" src="models/personajes/${clave}.png" alt=""
            style="display:none; width:100%; height:150px; object-fit:contain;" />
          <span style="font-weight:bold; color:#16104A; font-size:15px;">${skin.nombre}</span>
        </button>
      `;
    }).join("");

    fondo.innerHTML = `
      <style>
        .sk-tarjeta:hover { transform:translateY(-3px); border-color:#F2A93B !important; }
        .sk-tarjeta:focus-visible { outline:3px solid #F2A93B; outline-offset:2px; }
      </style>
      <div style="
        background:#16104A; border:1px solid rgba(255,255,255,0.14);
        border-radius:18px; padding:26px 30px 22px; width:min(440px, 92vw);
        box-shadow:0 24px 60px rgba(0,0,0,0.5); text-align:center; color:white;
      ">
        <h2 style="margin:0 0 4px; font-size:21px;">Elige tu personaje</h2>
        <p style="margin:0 0 18px; font-size:13px; color:#b9b4e0;">
          Skin de ${nombreConjunto(rol).toLowerCase()} · se guarda para la próxima
        </p>
        <div style="display:flex; gap:16px; justify-content:center; flex-wrap:wrap;">
          ${tarjetas}
        </div>
        <button type="button" class="sk-entrar" style="
          margin-top:20px; padding:12px 26px; border:none; border-radius:10px;
          background:rgba(237,183,49); color:#16104A; font-weight:bold;
          font-size:15px; cursor:pointer;
        ">
          <i class="fa-solid fa-door-open"></i> Entrar a la clase
        </button>
      </div>
    `;
    document.body.appendChild(fondo);

    // Miniaturas: si el PNG existe tapa al ícono; si no existe (hoy no hay),
    // se queda el ícono de respaldo y no se ve ningún hueco roto.
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
        boton.style.borderColor = activo ? "#F2A93B" : "rgba(22,16,74,0.15)";
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
    // Clic en el fondo (fuera del panel) = salir sin cambiar la guardada.
    fondo.addEventListener("click", (evento) => {
      if (evento.target === fondo) cerrar(false);
    });
  });
}
