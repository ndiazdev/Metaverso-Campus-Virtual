// ============================================================
// DASHBOARD ESTUDIANTE
// Gestión de clases en las que el estudiante está inscrito
// ============================================================

import type { Cuenta, Clase } from "../../state/estado";
import {
  avatarDe,
  etiquetaRol,
  fechaCorta,
} from "./dashboardComun";
import { montarFiltrosClases } from "./dashboardFiltros";
import { API_URL } from "../../api/cliente";
import { t } from "../../state/idioma";

export interface DashboardEstudianteOpciones {
  cuenta: Cuenta & { id?: number };
  contenido: HTMLDivElement;
  overlay: HTMLDivElement;
  alEntrarAClase: (clase: Clase) => void;
}

export async function mostrarDashboardEstudiante(
  opciones: DashboardEstudianteOpciones
): Promise<void> {
  const { cuenta, contenido, overlay, alEntrarAClase } = opciones;

  contenido.innerHTML = `<div class="dash-cargando">${t("estudiante.cargando")}</div>`;

  let misClases: Clase[] = [];

  try {
    const endpoint = `${API_URL}/clases/estudiante/${encodeURIComponent(cuenta.correo)}`;
    const res = await fetch(endpoint);
    if (res.ok) {
      misClases = await res.json();
    }
  } catch (error) {
    console.error("Error al consultar clases del estudiante:", error);
  }

  const docentes = new Set(
    misClases
      .map((clase) => clase.nombreDocente)
      .filter((nombre) => nombre),
  ).size;

  contenido.innerHTML = `

    <div class="dash-cabecera">

      <div>
        <p class="dash-cabecera-etiqueta">${etiquetaRol(cuenta.rol)}</p>
        <h1 class="dash-cabecera-titulo">
          ${cuenta.nombreCompleto.split(" ")[0]}
        </h1>
        <p class="dash-cabecera-subtitulo">
          ${misClases.length}
          ${
            misClases.length === 1
              ? t("estudiante.claseInscrita")
              : t("estudiante.clasesInscritas")
          }
        </p>
      </div>

      <div class="dash-cabecera-acciones">
        <button class="dash-boton-principal" id="botonAccionPrincipal">
          <i class="fa-solid fa-plus"></i>
          ${t("estudiante.unirseClase")}
        </button>
        <img class="dash-avatar-mini" src="${avatarDe(cuenta)}" alt="${t("comun.avatar")}" />
      </div>

    </div>

    <div class="dash-grid dash-grid-stats">

      <div class="dash-stat">
        <div class="dash-stat-cabecera">
          <span class="dash-stat-icono">
            <i class="fa-solid fa-graduation-cap"></i>
          </span>
          <span class="dash-stat-numero">${misClases.length}</span>
        </div>
        <div class="dash-stat-etiqueta">${t("estudiante.statClases")}</div>
      </div>

      <div class="dash-stat">
        <div class="dash-stat-cabecera">
          <span class="dash-stat-icono">
            <i class="fa-solid fa-chalkboard-user"></i>
          </span>
          <span class="dash-stat-numero">${docentes}</span>
        </div>
        <div class="dash-stat-etiqueta">
          ${
            docentes === 1
              ? t("estudiante.docente")
              : t("estudiante.docentes")
          }
        </div>
      </div>

    </div>

    <div class="dash-card">

      <div class="dash-card-encabezado">
        <p class="dash-card-titulo">${t("estudiante.misClases")}</p>
        <div class="dash-card-herramientas" id="herramientasClases"></div>
      </div>

      <div class="dash-lista" id="listaClases">
          ${
            misClases.length === 0
              ? `<p class="dash-vacio">${t("estudiante.vacio")}</p>`
              : misClases
                  .map(
                    (clase) => `
                      <div
                        class="dash-tarjeta-clase"
                        data-buscar="${clase.materia} ${clase.codigo} ${clase.nombreDocente || ""}"
                      >

                        <div class="dash-clase-datos">

                          <span class="dash-clase-icono">
                            <i class="fa-solid fa-graduation-cap"></i>
                          </span>

                          <div class="dash-clase-texto">

                            <p class="dash-clase-nombre">${clase.materia}</p>

                            <p class="dash-clase-meta">

                              <span class="dash-dato">
                                <i class="fa-solid fa-hashtag"></i>
                                <span class="dash-codigo">${clase.codigo}</span>
                              </span>

                              ${
                                clase.nombreDocente
                                  ? `
                                    <span class="dash-dato">
                                      <i class="fa-solid fa-chalkboard-user"></i>
                                      ${clase.nombreDocente}
                                    </span>
                                  `
                                  : ""
                              }

                              ${
                                fechaCorta(clase.fechaCreacion)
                                  ? `
                                    <span class="dash-dato">
                                      <i class="fa-solid fa-calendar"></i>
                                      ${fechaCorta(clase.fechaCreacion)}
                                    </span>
                                  `
                                  : ""
                              }

                            </p>

                          </div>

                        </div>

                        <button
                          class="dash-boton-entrar"
                          data-codigo="${clase.codigo}"
                        >
                          ${t("estudiante.entrar")}
                          <i class="fa-solid fa-arrow-right"></i>
                        </button>

                      </div>
              `
                  )
                  .join("")
          }
        </div>

    </div>
  `;

  montarFiltrosClases(contenido, t("estudiante.buscarClase"));

  contenido.querySelectorAll<HTMLButtonElement>(".dash-boton-entrar").forEach((boton) => {
    boton.addEventListener("click", () => {
      const codigoBuscado = boton.dataset.codigo;
      const claseSeleccionada = misClases.find((c) => c.codigo === codigoBuscado);
      if (!claseSeleccionada) return;
      overlay.remove();
      alEntrarAClase(claseSeleccionada);
    });
  });

  const botonPrincipal = contenido.querySelector<HTMLButtonElement>("#botonAccionPrincipal");
  if (botonPrincipal) {
    botonPrincipal.addEventListener("click", () => abrirModalUnirseClase());
  }

  function abrirModalUnirseClase(): void {
    const modal = document.createElement("div");
    modal.className = "dash-modal-fondo";
    modal.innerHTML = `
      <div class="dash-modal" role="dialog" aria-modal="true" aria-labelledby="tituloModalClase">
        <button type="button" class="dash-modal-cerrar" data-cerrar aria-label="${t("comun.cerrar")}" title="${t("comun.cerrar")}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        <h3 id="tituloModalClase">${t("estudiante.modalTitulo")}</h3>
        <p>${t("estudiante.modalAyuda")}</p>
        <input class="dash-input-codigo" id="campoCodigoUnirse" placeholder="${t("estudiante.modalPlaceholder")}" />
        <p class="dash-error" id="errorModal"></p>
        <button class="dash-boton-principal" id="botonConfirmarUnirse">${t("estudiante.inscribirme")}</button>
      </div>
    `;
    document.body.appendChild(modal);

    // Salidas: X, clic fuera y ESC (no hay nada que confirmar al salir).
    function cerrar(): void {
      window.removeEventListener("keydown", alTecla, true);
      modal.remove();
    }

    function alTecla(evento: KeyboardEvent): void {
      if (evento.key === "Escape") {
        evento.stopPropagation();
        cerrar();
      }
    }

    modal.querySelectorAll<HTMLElement>("[data-cerrar]").forEach((boton) => {
      boton.addEventListener("click", cerrar);
    });

    window.addEventListener("keydown", alTecla, true);

    modal.addEventListener("click", (evento) => {
      if (evento.target === modal) cerrar();
    });

    const campoCodigo = modal.querySelector<HTMLInputElement>("#campoCodigoUnirse")!;
    const errorModal = modal.querySelector<HTMLParagraphElement>("#errorModal")!;
    const botonConfirmar = modal.querySelector<HTMLButtonElement>("#botonConfirmarUnirse")!;

    botonConfirmar.addEventListener("click", async () => {
      const codigo = campoCodigo.value.trim().toUpperCase();
      if (!codigo) {
        errorModal.textContent = t("estudiante.errorCodigo");
        return;
      }

      botonConfirmar.disabled = true;
      botonConfirmar.textContent = t("estudiante.uniendote");

      try {
        const res = await fetch(`${API_URL}/inscripciones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correoEstudiante: cuenta.correo, codigoClase: codigo }),
        });

        const data = await res.json();

        if (!res.ok) {
          errorModal.textContent =
            data.error || t("estudiante.errorNoEncontrado");
          botonConfirmar.disabled = false;
          botonConfirmar.textContent = t("estudiante.inscribirme");
          return;
        }

        // `cerrar` suelta también el listener de ESC.
        cerrar();
        // Refresca la lista de clases inscritas para que aparezca la nueva
        mostrarDashboardEstudiante(opciones);
      } catch (error) {
        errorModal.textContent = t("perfil.msg.sinServidor");
        botonConfirmar.disabled = false;
        botonConfirmar.textContent = t("estudiante.inscribirme");
      }
    });
  }
}