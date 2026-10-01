// ============================================================
// DASHBOARD INVITADO
// Gestión de clases en las que el invitado está inscrito
//
// El invitado utiliza prácticamente la misma lógica que
// el estudiante:
// - Consultar clases inscritas
// - Unirse a una clase
// - Entrar a una clase
//
// No puede crear clases ni gestionar usuarios.
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

// ============================================================
// OPCIONES DEL DASHBOARD INVITADO
// ============================================================

export interface DashboardInvitadoOpciones {
  cuenta: Cuenta & { id?: number };

  contenido: HTMLDivElement;

  overlay: HTMLDivElement;

  alEntrarAClase: (clase: Clase) => void;
}

// ============================================================
// MOSTRAR DASHBOARD DEL INVITADO
// ============================================================

export async function mostrarDashboardInvitado(
  opciones: DashboardInvitadoOpciones,
): Promise<void> {
  const { cuenta, contenido, overlay, alEntrarAClase } = opciones;

  // ==========================================================
  // CARGANDO
  // ==========================================================

  contenido.innerHTML = `
    <div class="dash-cargando">
      ${t("estudiante.cargando")}
    </div>
  `;

  // ==========================================================
  // CONSULTAR CLASES DEL INVITADO
  // ==========================================================

  let misClases: Clase[] = [];

  try {
    const endpoint = `${API_URL}/clases/estudiante/${encodeURIComponent(
      cuenta.correo,
    )}`;

    const res = await fetch(endpoint);

    if (res.ok) {
      misClases = await res.json();
    }
  } catch (error) {
    console.error("Error al consultar clases del invitado:", error);
  }

  // ==========================================================
  // MOSTRAR DASHBOARD
  // ==========================================================

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
        <button
          class="dash-boton-principal"
          id="botonAccionPrincipal"
        >
          <i class="fa-solid fa-plus"></i>
          ${t("estudiante.unirseClase")}
        </button>

        <img
          class="dash-avatar-mini"
          src="${avatarDe(cuenta)}"
          alt="${t("comun.avatar")}"
        />
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
              ? `
                <p class="dash-vacio">
                  ${t("estudiante.vacio")}
                </p>
              `
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

                            <p class="dash-clase-nombre">
                              ${clase.materia}
                            </p>

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

                    `,
                  )
                  .join("")
          }

        </div>

      </div>

  `;

  // ==========================================================
  // BUSCADOR DE CLASES
  // ==========================================================

  montarFiltrosClases(contenido, t("estudiante.buscarClase"));

  // ==========================================================
  // BOTONES "ENTRAR"
  // ==========================================================

  contenido
    .querySelectorAll<HTMLButtonElement>(".dash-boton-entrar")
    .forEach((boton) => {
      boton.addEventListener("click", () => {
        const codigoBuscado = boton.dataset.codigo;

        const claseSeleccionada = misClases.find(
          (clase) => clase.codigo === codigoBuscado,
        );

        if (!claseSeleccionada) {
          return;
        }

        // Cerrar dashboard

        overlay.remove();

        // Entrar a la clase

        alEntrarAClase(claseSeleccionada);
      });
    });

  // ==========================================================
  // BOTÓN "UNIRSE A CLASE"
  // ==========================================================

  const botonPrincipal = contenido.querySelector<HTMLButtonElement>(
    "#botonAccionPrincipal",
  );

  if (botonPrincipal) {
    botonPrincipal.addEventListener("click", () => {
      abrirModalUnirseClase();
    });
  }

  // ==========================================================
  // MODAL PARA UNIRSE A UNA CLASE
  // ==========================================================

  function abrirModalUnirseClase(): void {
    const modal = document.createElement("div");

    modal.className = "dash-modal-fondo";

    modal.innerHTML = `

      <div class="dash-modal">

        <h3>
          ${t("estudiante.modalTitulo")}
        </h3>


        <p>
          ${t("estudiante.modalAyuda")}
        </p>


        <input
          class="dash-input-codigo"
          id="campoCodigoUnirse"
          placeholder="${t("estudiante.modalPlaceholder")}"
        />


        <p
          class="dash-error"
          id="errorModal"
        ></p>


        <button
          class="dash-boton-principal"
          id="botonConfirmarUnirse"
        >
          ${t("estudiante.inscribirme")}
        </button>

      </div>

    `;

    document.body.appendChild(modal);

    // ========================================================
    // ELEMENTOS DEL MODAL
    // ========================================================

    const campoCodigo =
      modal.querySelector<HTMLInputElement>("#campoCodigoUnirse")!;

    const errorModal =
      modal.querySelector<HTMLParagraphElement>("#errorModal")!;

    const botonConfirmar = modal.querySelector<HTMLButtonElement>(
      "#botonConfirmarUnirse",
    )!;

    // ========================================================
    // CONFIRMAR INSCRIPCIÓN
    // ========================================================

    botonConfirmar.addEventListener("click", async () => {
      const codigo = campoCodigo.value.trim().toUpperCase();

      // ----------------------------------------------------
      // Validación
      // ----------------------------------------------------

      if (!codigo) {
        errorModal.textContent = t("estudiante.errorCodigo");

        return;
      }

      // ----------------------------------------------------
      // Estado de carga
      // ----------------------------------------------------

      botonConfirmar.disabled = true;

      botonConfirmar.textContent = t("estudiante.uniendote");

      try {
        // ==================================================
        // INSCRIBIR AL INVITADO
        // ==================================================

        const res = await fetch(`${API_URL}/inscripciones`, {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            correoEstudiante: cuenta.correo,

            codigoClase: codigo,
          }),
        });

        const data = await res.json();

        // ==================================================
        // ERROR
        // ==================================================

        if (!res.ok) {
          errorModal.textContent =
            data.error || t("estudiante.errorNoEncontrado");

          botonConfirmar.disabled = false;

          botonConfirmar.textContent = t("estudiante.inscribirme");

          return;
        }

        // ==================================================
        // INSCRIPCIÓN EXITOSA
        // ==================================================

        modal.remove();

        // Recargar las clases del invitado

        mostrarDashboardInvitado(opciones);
      } catch (error) {
        console.error("Error al inscribirse a la clase:", error);

        errorModal.textContent = t("perfil.msg.sinServidor");

        botonConfirmar.disabled = false;

        botonConfirmar.textContent = t("estudiante.inscribirme");
      }
    });
  }
}
