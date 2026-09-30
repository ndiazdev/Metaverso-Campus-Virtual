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
import { IMAGENES_ROL, ETIQUETAS_ROL } from "./dashboardComun";
import { API_URL } from "../../api/cliente";

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
      Cargando clases desde la base de datos...
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

  contenido.innerHTML = `

    <div class="dash-cuerpo">

      <!-- ==================================================
           COLUMNA IZQUIERDA
           ================================================== -->

      <div class="dash-columna-izq">

        <div class="dash-etiqueta-rol">
          ${ETIQUETAS_ROL[cuenta.rol]}
        </div>


        <p class="dash-nombre-usuario">
          ${cuenta.nombreCompleto.split(" ")[0]}
        </p>


        <img
          class="dash-avatar-img"
          src="${IMAGENES_ROL[cuenta.rol]}"
          alt="Avatar"
        />


        <button
          class="dash-boton-principal"
          id="botonAccionPrincipal"
        >
          Unirse a Clase
        </button>


        <p class="dash-contador">
          ● 47 usuarios conectados
        </p>

      </div>


      <!-- ==================================================
           COLUMNA DERECHA
           ================================================== -->

      <div class="dash-columna-der">

        <p class="dash-seccion-titulo">
          Mis clases inscritas
        </p>


        <div id="listaClases">

          ${
            misClases.length === 0
              ? `
                <p class="dash-sin-clases">
                  Todavía no tienes clases inscritas.
                </p>
              `
              : misClases
                  .map(
                    (clase) => `

                      <div class="dash-tarjeta-clase">

                        <div>

                          <p class="dash-clase-nombre">
                            ${clase.materia}
                          </p>


                          <p class="dash-clase-meta">
                            ${clase.codigo}
                            ${
                              clase.nombreDocente
                                ? " · " + clase.nombreDocente
                                : ""
                            }
                          </p>

                        </div>


                        <button
                          class="dash-boton-entrar"
                          data-codigo="${clase.codigo}"
                        >
                          Entrar
                        </button>

                      </div>

                    `,
                  )
                  .join("")
          }

        </div>


        <!-- ==================================================
             ESTADÍSTICAS
             ================================================== -->

        <div class="dash-stats">

          <div class="dash-stat">

            <div class="dash-stat-numero">
              ${misClases.length}
            </div>

            <div class="dash-stat-etiqueta">
              Clases inscritas
            </div>

          </div>


          <div class="dash-stat">

            <div class="dash-stat-numero">
              47
            </div>

            <div class="dash-stat-etiqueta">
              Usuarios conectados
            </div>

          </div>

        </div>

      </div>

    </div>

  `;

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
          Unirse a una clase
        </h3>


        <p>
          Escribe el código que te dio tu docente
        </p>


        <input
          class="dash-input-codigo"
          id="campoCodigoUnirse"
          placeholder="EJ: CAL-123"
        />


        <p
          class="dash-error"
          id="errorModal"
        ></p>


        <button
          class="dash-boton-principal"
          id="botonConfirmarUnirse"
        >
          Inscribirme
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
        errorModal.textContent = "Ingresa un código válido.";

        return;
      }

      // ----------------------------------------------------
      // Estado de carga
      // ----------------------------------------------------

      botonConfirmar.disabled = true;

      botonConfirmar.textContent = "Uniéndote...";

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
          errorModal.textContent = data.error || "Código no encontrado.";

          botonConfirmar.disabled = false;

          botonConfirmar.textContent = "Inscribirme";

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

        errorModal.textContent = "No se pudo conectar con el servidor.";

        botonConfirmar.disabled = false;

        botonConfirmar.textContent = "Inscribirme";
      }
    });
  }
}
