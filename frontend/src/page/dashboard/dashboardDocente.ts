// ============================================================
// DASHBOARD DOCENTE
// Gestión de clases creadas por el docente
// ============================================================

import type { Cuenta, Clase } from "../../state/estado";
import { etiquetaRol, fechaCorta } from "./dashboardComun";
import { montarFiltrosClases } from "./dashboardFiltros";
import { t } from "../../state/idioma";

// ============================================================
// CONFIGURACIÓN API
// ============================================================

// La URL no se define aquí: vive en src/api/cliente.ts
import { API_URL } from "../../api/cliente";

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
      ${t("docente.cargando")}
    </div>
  `;

  // ==========================================================
  // CONSULTAR CLASES DEL DOCENTE
  // ==========================================================

  let misClases: Array<Clase & { totalInscritos?: number }> = [];

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

  const totalInscritos = misClases.reduce(
    (suma, clase) => suma + (clase.totalInscritos || 0),
    0,
  );

  const hayInscritos = misClases.some(
    (clase) => typeof clase.totalInscritos === "number",
  );

  contenido.innerHTML = `

    <div class="dash-cabecera">

      <div>
        <p class="dash-cabecera-etiqueta">${etiquetaRol(cuenta.rol)}</p>
        <h1 class="dash-cabecera-titulo">
          ${cuenta.nombreCompleto.split(" ")[0]}
        </h1>
        <p class="dash-cabecera-subtitulo">
          ${misClases.length}
          ${misClases.length === 1 ? t("docente.claseCreada") : t("docente.clasesCreadas")}
        </p>
      </div>

      <div class="dash-cabecera-acciones">
        <button
          class="dash-boton-principal"
          id="botonAccionPrincipal"
        >
          <i class="fa-solid fa-plus"></i>
          ${t("docente.nuevaClase")}
        </button>

        <img
          class="dash-avatar-mini"
          src="https://d2yoo3qu6vrk5d.cloudfront.net/pulzo-lite/images-resized/PP3946599-h-o.webp"
          alt="${t("docente.altAvatar")}"
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
        <div class="dash-stat-etiqueta">${t("docente.statClases")}</div>
      </div>

      ${
        hayInscritos
          ? `
            <div class="dash-stat">
              <div class="dash-stat-cabecera">
                <span class="dash-stat-icono">
                  <i class="fa-solid fa-user-group"></i>
                </span>
                <span class="dash-stat-numero">${totalInscritos}</span>
              </div>
              <div class="dash-stat-etiqueta">${t("docente.statInscritos")}</div>
            </div>
          `
          : ""
      }

    </div>

    <div class="dash-card">

      <div class="dash-card-encabezado">
        <p class="dash-card-titulo">${t("docente.misClases")}</p>
        <div class="dash-card-herramientas" id="herramientasClases"></div>
      </div>

      <div class="dash-lista" id="listaClases">

          ${
            misClases.length === 0
              ? `
                <p class="dash-vacio">
                  ${t("docente.sinClases")}
                </p>
              `
              : misClases
                  .map(
                    (clase) => `
                      <div
                        class="dash-tarjeta-clase"
                        data-buscar="${clase.materia} ${clase.codigo}"
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
                                typeof clase.totalInscritos === "number"
                                  ? `
                                    <span class="dash-dato">
                                      <i class="fa-solid fa-user-group"></i>
                                      ${clase.totalInscritos} ${t("docente.inscritos")}
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
                          ${t("docente.abrir")}
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

  montarFiltrosClases(contenido, t("docente.buscar"));

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
          ${t("docente.crearTitulo")}
        </h3>


        <p>
          ${t("docente.crearTexto")}
        </p>


        <input
          class="dash-input-codigo dash-input-texto"
          id="campoMateriaNueva"
          placeholder="${t("docente.placeholderMateria")}"
        />


        <p
          class="dash-error"
          id="errorModal"
        ></p>


        <button
          class="dash-boton-principal"
          id="botonConfirmarClase"
        >
          ${t("docente.generarClase")}
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
        errorModal.textContent = t("docente.errorMateria");

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

      botonConfirmar.textContent = t("docente.guardando");

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
          errorModal.textContent = t("docente.errorGuardar");

          botonConfirmar.disabled = false;

          botonConfirmar.textContent = t("docente.generarClase");

          return;
        }

        // ==================================================
        // CLASE CREADA
        // ==================================================

        modal.innerHTML = `

            <div class="dash-modal">

              <h3>
                ${t("docente.exitoTitulo")}
              </h3>


              <p>
                ${t("docente.exitoTexto")}
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
                ${t("docente.entrarClase")}
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

        errorModal.textContent = t("perfil.msg.sinServidor");

        botonConfirmar.disabled = false;

        botonConfirmar.textContent = t("docente.generarClase");
      }
    });
  }
}
