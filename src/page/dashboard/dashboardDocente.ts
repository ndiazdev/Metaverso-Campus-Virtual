// ============================================================
// DASHBOARD DOCENTE
// Gestión de clases creadas por el docente
// ============================================================

import type { Cuenta, Clase } from "../../state/estado";

import { COLOR_ACENTO } from "./dashboardEstilos";

// ============================================================
// CONFIGURACIÓN API
// ============================================================

const API_URL = "http://localhost:3000/api";

// ============================================================
// INTERFAZ DE OPCIONES
// ============================================================

export interface DashboardDocenteOpciones {
  /**
   * Cuenta del docente actualmente conectado.
   */
  cuenta: Cuenta & { id?: number };

  /**
   * Contenedor donde se mostrará el contenido.
   */
  contenido: HTMLDivElement;

  /**
   * Overlay principal del dashboard.
   *
   * Se utiliza para cerrarlo antes de entrar
   * a una clase.
   */
  overlay: HTMLDivElement;

  /**
   * Función que se ejecuta cuando el docente
   * entra/abre una clase.
   */
  alEntrarAClase: (clase: Clase) => void;
}

// ============================================================
// MOSTRAR DASHBOARD DEL DOCENTE
// ============================================================

export async function mostrarDashboardDocente(
  opciones: DashboardDocenteOpciones,
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
  // CONSULTAR CLASES DEL DOCENTE
  // ==========================================================

  let misClases: Clase[] = [];

  try {
    const endpoint = `${API_URL}/clases/docente/${encodeURIComponent(
      cuenta.correo,
    )}`;

    const res = await fetch(endpoint);

    if (res.ok) {
      misClases = await res.json();
    }
  } catch (error) {
    console.error("Error al consultar clases del docente:", error);
  }

  // ==========================================================
  // MOSTRAR CONTENIDO
  // ==========================================================

  contenido.innerHTML = `

    <div class="dash-cuerpo">

      <!-- ==================================================
           COLUMNA IZQUIERDA
           ================================================== -->

      <div class="dash-columna-izq">

        <!-- Rol -->

        <div class="dash-etiqueta-rol">
          DOCENTE
        </div>


        <!-- Nombre -->

        <p class="dash-nombre-usuario">
          ${cuenta.nombreCompleto.split(" ")[0]}
        </p>


        <!-- Avatar -->

        <img
          class="dash-avatar-img"
          src="https://d2yoo3qu6vrk5d.cloudfront.net/pulzo-lite/images-resized/PP3946599-h-o.webp"
          alt="Avatar del docente"
        />


        <!-- Botón crear clase -->

        <button
          class="dash-boton-principal"
          id="botonAccionPrincipal"
        >
          Crear Clase
        </button>


        <!-- Usuarios conectados -->

        <p class="dash-contador">
          ● 47 usuarios conectados
        </p>

      </div>


      <!-- ==================================================
           COLUMNA DERECHA
           ================================================== -->

      <div class="dash-columna-der">

        <!-- Título -->

        <p class="dash-seccion-titulo">
          Mis clases creadas
        </p>


        <!-- Lista -->

        <div id="listaClases">

          ${
            misClases.length === 0
              ? `
                <p class="dash-sin-clases">
                  Todavía no tienes clases creadas.
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
                          </p>

                        </div>


                        <button
                          class="dash-boton-entrar"
                          data-codigo="${clase.codigo}"
                        >
                          Abrir
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
              Clases creadas
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
  // BOTONES "ABRIR"
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
  // BOTÓN CREAR CLASE
  // ==========================================================

  const botonPrincipal = contenido.querySelector<HTMLButtonElement>(
    "#botonAccionPrincipal",
  );

  if (botonPrincipal) {
    botonPrincipal.addEventListener("click", () => {
      abrirModalCrearClase();
    });
  }

  // ==========================================================
  // MODAL CREAR CLASE
  // ==========================================================

  function abrirModalCrearClase(): void {
    const modal = document.createElement("div");

    modal.className = "dash-modal-fondo";

    // --------------------------------------------------------
    // HTML DEL MODAL
    // --------------------------------------------------------

    modal.innerHTML = `

      <div class="dash-modal">

        <h3>
          Crear nueva clase
        </h3>


        <p>
          Escribe la materia que vas a dictar
        </p>


        <input
          class="dash-input-codigo"
          id="campoMateriaNueva"
          placeholder="Ej: Cálculo II"
          style="
            text-transform:none;
            letter-spacing:normal;
          "
        />


        <p
          class="dash-error"
          id="errorModal"
        ></p>


        <button
          class="dash-boton-principal"
          id="botonConfirmarClase"
        >
          Generar clase
        </button>

      </div>

    `;

    document.body.appendChild(modal);

    // ========================================================
    // ELEMENTOS DEL MODAL
    // ========================================================

    const campoMateria =
      modal.querySelector<HTMLInputElement>("#campoMateriaNueva")!;

    const errorModal =
      modal.querySelector<HTMLParagraphElement>("#errorModal")!;

    const botonConfirmar = modal.querySelector<HTMLButtonElement>(
      "#botonConfirmarClase",
    )!;

    // ========================================================
    // CONFIRMAR CREACIÓN
    // ========================================================

    botonConfirmar.addEventListener("click", async () => {
      // ----------------------------------------------------
      // Obtener materia
      // ----------------------------------------------------

      const materia = campoMateria.value.trim();

      // ----------------------------------------------------
      // Validar
      // ----------------------------------------------------

      if (materia.length === 0) {
        errorModal.textContent = "Escribe el nombre de la materia.";

        return;
      }

      // ----------------------------------------------------
      // Generar código
      // ----------------------------------------------------

      const prefijo = materia.substring(0, 3).toUpperCase();

      const numAzar = Math.floor(100 + Math.random() * 900);

      const codigoGenerado = `${prefijo}-${numAzar}`;

      // ----------------------------------------------------
      // Desactivar botón mientras se guarda
      // ----------------------------------------------------

      botonConfirmar.disabled = true;

      botonConfirmar.textContent = "Guardando...";

      try {
        // ==================================================
        // GUARDAR EN API
        // ==================================================

        const res = await fetch(`${API_URL}/clases`, {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            codigo: codigoGenerado,

            materia: materia,

            correoDocente: cuenta.correo,

            nombreDocente: cuenta.nombreCompleto,
          }),
        });

        // ==================================================
        // ERROR DEL SERVIDOR
        // ==================================================

        if (!res.ok) {
          errorModal.textContent = "Error al guardar en MySQL.";

          botonConfirmar.disabled = false;

          botonConfirmar.textContent = "Generar clase";

          return;
        }

        // ==================================================
        // CLASE CREADA
        // ==================================================

        modal.innerHTML = `

            <div class="dash-modal">

              <h3>
                ¡Clase creada!
              </h3>


              <p>
                Comparte este código con tus estudiantes
              </p>


              <div
                class="dash-codigo-grande"
              >
                ${codigoGenerado}
              </div>


              <button
                class="dash-boton-principal"
                id="botonEntrarAhora"
              >
                Entrar a la clase
              </button>

            </div>

          `;

        // ==================================================
        // ENTRAR A LA CLASE RECIÉN CREADA
        // ==================================================

        const botonEntrarAhora =
          modal.querySelector<HTMLButtonElement>("#botonEntrarAhora");

        if (botonEntrarAhora) {
          botonEntrarAhora.addEventListener("click", () => {
            modal.remove();

            overlay.remove();

            const nuevaClase: Clase = {
              codigo: codigoGenerado,

              materia: materia,

              correoDocente: cuenta.correo,

              nombreDocente: cuenta.nombreCompleto,

              fechaCreacion: new Date().toISOString(),

              estudiantesInscritos: [],
            };

            alEntrarAClase(nuevaClase);
          });
        }
      } catch (error) {
        console.error("Error al crear clase:", error);

        errorModal.textContent = "No se pudo conectar con el servidor.";

        botonConfirmar.disabled = false;

        botonConfirmar.textContent = "Generar clase";
      }
    });
  }
}
