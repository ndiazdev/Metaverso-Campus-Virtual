import { cerrarSesion } from "../../state/estado";
import type { Cuenta, Rol } from "../../state/estado";

import {
  LOGO_URL,
  COLOR_PRIMARIO,
  COLOR_ACENTO,
  inyectarEstilosDashboard,
} from "./dashboardEstilos";

export const ETIQUETAS_ROL: Record<Rol, string> = {
  docente: "DOCENTE",
  admin: "ADMINISTRADOR",
  estudiante: "ESTUDIANTE",
  invitado: "INVITADO",
};

export const IMAGENES_ROL: Record<Rol, string> = {
  docente:
    "https://d2yoo3qu6vrk5d.cloudfront.net/pulzo-lite/images-resized/PP3946599-h-o.webp",

  admin:
    "https://d2yoo3qu6vrk5d.cloudfront.net/pulzo-lite/images-resized/PP3946599-h-o.webp",

  estudiante:
    "https://cba.ucb.edu.bo/blog/wp-content/uploads/2021/04/desarrollo-programadores-desarrollo-tecnologias-diseno-codificacion-sitios-web_18497-1019.jpg",

  invitado:
    "https://cba.ucb.edu.bo/blog/wp-content/uploads/2021/04/desarrollo-programadores-desarrollo-tecnologias-diseno-codificacion-sitios-web_18497-1019.jpg",
};

export type TabDashboard = "clases" | "usuarios" | "perfil" | "ajustes";

export interface DashboardComunOpciones {
  cuenta: Cuenta & { id?: number };

  alMostrarClases: () => void;

  alMostrarUsuarios?: () => void;

  alCerrar?: () => void;

  /**
   * Qué pestaña debe verse marcada como activa apenas se abre el dashboard.
   * Por defecto "clases". El admin usa "usuarios" para aterrizar
   * directo en el panel de administración.
   */
  pestanaInicial?: TabDashboard;
}

// ============================================================
// REFERENCIA AL DASHBOARD COMÚN
// ============================================================

export interface DashboardComun {
  overlay: HTMLDivElement;
  contenido: HTMLDivElement;

  activarTab: (nombre: TabDashboard) => void;

  mostrarPerfil: () => void;

  mostrarAjustes: () => void;

  destruir: () => void;
}

// ============================================================
// CREAR DASHBOARD COMÚN
// ============================================================

export function crearDashboardComun(
  opciones: DashboardComunOpciones,
): DashboardComun {
  const { cuenta, alMostrarClases, alMostrarUsuarios, alCerrar } = opciones;

  // La pestaña que debe verse "activa" (marcada) al abrir el dashboard
  const pestanaInicial: TabDashboard = opciones.pestanaInicial ?? "clases";

  // ----------------------------------------------------------
  // Inyectar estilos
  // ----------------------------------------------------------

  inyectarEstilosDashboard();

  // ----------------------------------------------------------
  // Crear overlay principal
  // ----------------------------------------------------------

  const overlay = document.createElement("div");

  overlay.className = "dash-overlay";

  // ----------------------------------------------------------
  // Determinar si es administrador
  // ----------------------------------------------------------

  const esAdmin = cuenta.rol === "admin";

  // ----------------------------------------------------------
  // HTML base
  // ----------------------------------------------------------

  overlay.innerHTML = `
    <!-- ======================================================
         NAVBAR
         ====================================================== -->

    <div class="dash-nav">

      <!-- Logo institucional -->

      <div class="dash-marca">

        <img
          class="dash-marca-logo"
          src="${LOGO_URL}"
          alt="Universidad Santo Tomás"
        />

      </div>


      <!-- ==================================================
           PESTAÑAS
           ================================================== -->

      <div class="dash-tabs">

        ${
        esAdmin
          ? `
              <div
                class="dash-tab ${pestanaInicial === "usuarios" ? "activo" : ""}"
                data-tab="usuarios"
              >
                USUARIOS
              </div>
            `
          : ""
      }

        <div class="dash-tab ${pestanaInicial === "clases" ? "activo" : ""}" data-tab="clases">
          CLASES
        </div>

        <div
          class="dash-tab ${pestanaInicial === "perfil" ? "activo" : ""}"
          data-tab="perfil"
        >
          PERFIL
        </div>


        <div
          class="dash-tab ${pestanaInicial === "ajustes" ? "activo" : ""}"
          data-tab="ajustes"
        >
          AJUSTES
        </div>

      </div>


      <!-- ==================================================
           SALIR
           ================================================== -->

      <div
        class="dash-salir"
        id="botonSalir"
      >
        Salir
      </div>

    </div>


    <!-- ======================================================
         CONTENIDO DINÁMICO
         ====================================================== -->

    <div id="contenidoDashboard"></div>
  `;

  // ----------------------------------------------------------
  // Agregar al documento
  // ----------------------------------------------------------

  document.body.appendChild(overlay);

  // ----------------------------------------------------------
  // Obtener elementos
  // ----------------------------------------------------------

  const contenido = overlay.querySelector<HTMLDivElement>(
    "#contenidoDashboard",
  )!;

  const tabs = overlay.querySelectorAll<HTMLDivElement>(".dash-tab");

  const botonSalir = overlay.querySelector<HTMLDivElement>("#botonSalir")!;

  // ==========================================================
  // ACTIVAR PESTAÑA
  // ==========================================================

  function activarTab(nombre: TabDashboard): void {
    // --------------------------------------------------------
    // Cambiar visualmente la pestaña activa
    // --------------------------------------------------------

    tabs.forEach((tab) => {
      tab.classList.toggle("activo", tab.dataset.tab === nombre);
    });

    // --------------------------------------------------------
    // Cargar el contenido correspondiente
    // --------------------------------------------------------

    switch (nombre) {

      case "usuarios":
        if (alMostrarUsuarios) {
          alMostrarUsuarios();
        }

        break;

      case "clases":
        alMostrarClases();

        break;

      case "perfil":
        mostrarPerfil();

        break;

      case "ajustes":
        mostrarAjustes();

        break;
    }
  }

  // ==========================================================
  // EVENTOS DE LAS PESTAÑAS
  // ==========================================================

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const nombreTab = tab.dataset.tab as TabDashboard;

      activarTab(nombreTab);
    });
  });

  // ==========================================================
  // BOTÓN SALIR
  // ==========================================================

  botonSalir.addEventListener("click", () => {
    cerrarSesion();

    overlay.remove();

    if (alCerrar) {
      alCerrar();
    }

    location.reload();
  });

  // ==========================================================
  // PERFIL
  // ==========================================================

  function mostrarPerfil(): void {
    const nombre = cuenta.nombreCompleto || "Usuario";

    const primerNombre = nombre.split(" ")[0];

    contenido.innerHTML = `

      <div class="dash-perfil-contenedor">

        <img
          class="dash-avatar-img"
          src="${IMAGENES_ROL[cuenta.rol]}"
          alt="Avatar de ${primerNombre}"
        />

        <div class="dash-perfil-tarjeta">

          <p style="color:white; font-size:20px; font-weight:bold; margin:0;">
            ${cuenta.nombreCompleto}
          </p>

          <p style="color:${COLOR_ACENTO}; font-size:13px; font-weight:bold; margin:2px 0 20px 0;">
            ${ETIQUETAS_ROL[cuenta.rol]}
          </p>

          <div style="display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid rgba(255,255,255,0.1);">
            <span style="color:#9aa8c7; font-size:13px;">Correo</span>
            <span style="color:white; font-size:13px;">${cuenta.correo}</span>
          </div>

          <div style="display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid rgba(255,255,255,0.1);">
            <span style="color:#9aa8c7; font-size:13px;">Institución</span>
            <span style="color:white; font-size:13px;">USTA Seccional Tunja</span>
          </div>

          ${
            cuenta.rol === "docente"
              ? `
                <div style="display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid rgba(255,255,255,0.1);">
                  <span style="color:#9aa8c7; font-size:13px;">Materia</span>
                  <span style="color:white; font-size:13px;">${cuenta.materia || "—"}</span>
                </div>
            `
              : cuenta.rol === "estudiante" || cuenta.rol === "invitado"
                ? `
                <div style="display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid rgba(255,255,255,0.1);">
                  <span style="color:#9aa8c7; font-size:13px;">Carrera</span>
                  <span style="color:white; font-size:13px;">${cuenta.carrera || "—"}</span>
                </div>
             `
                : ""
          }
        </div>
      </div>
    `;
  }

  function mostrarAjustes(): void {
    contenido.innerHTML = `
      <div style="max-width:480px; margin:60px auto; text-align:center; color:#b8c4dd; padding:0 20px;">
        <p style="font-size:15px;">Sección de ajustes — próximamente.</p>
        <p style="font-size:13px;color:#9aa8c7;">
          Aquí irán preferencias de cuenta, notificaciones y configuración de
          audio/cámara para las clases.
        </p>
      </div>
    `;
  }

  function destruir(): void {
    overlay.remove();
  }

  return {
    overlay,
    contenido,
    activarTab,
    mostrarPerfil,
    mostrarAjustes,
    destruir,
  };
}