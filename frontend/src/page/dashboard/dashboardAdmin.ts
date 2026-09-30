import type { Cuenta, Clase } from "../../state/estado";
import { IMAGENES_ROL, ETIQUETAS_ROL } from "./dashboardComun";
import { API_URL } from "../../api/cliente";

export interface DashboardAdminOpciones {
  cuenta: Cuenta & { id?: number };
  contenido: HTMLDivElement;
  overlay: HTMLDivElement;
  alEntrarAClase: (clase: Clase) => void;
}

interface ClaseAdmin {
  codigo: string;
  materia: string;
  correoDocente: string;
  nombreDocente: string;
  totalInscritos: number;
}

interface InscripcionAdmin {
  nombreEstudiante: string;
  materia: string;
  codigo: string;
  fecha: string;
}

export async function mostrarDashboardAdmin(
  opciones: DashboardAdminOpciones,
): Promise<void> {
  const { cuenta, contenido, overlay, alEntrarAClase } = opciones;

  contenido.innerHTML = `
    <div class="dash-cargando">
      Cargando tus clases...
    </div>
  `;

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
    console.error("Error al consultar las clases del administrador:", error);
  }

  contenido.innerHTML = `
    <div class="dash-cuerpo">

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
          Crear Clase
        </button>

        <p class="dash-contador">
          ● 47 usuarios conectados
        </p>

      </div>

      <div class="dash-columna-der">

        <p class="dash-seccion-titulo">
          Mis clases creadas
        </p>

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

        overlay.remove();
        alEntrarAClase(claseSeleccionada);
      });
    });

  const botonPrincipal =
    contenido.querySelector<HTMLButtonElement>(
      "#botonAccionPrincipal",
    );

  if (botonPrincipal) {
    botonPrincipal.addEventListener("click", () =>
      abrirModalCrearClase(),
    );
  }

  function abrirModalCrearClase(): void {
    const modal = document.createElement("div");

    modal.className = "dash-modal-fondo";

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

    const campoMateria =
      modal.querySelector<HTMLInputElement>(
        "#campoMateriaNueva",
      )!;

    const errorModal =
      modal.querySelector<HTMLParagraphElement>(
        "#errorModal",
      )!;

    const botonConfirmar =
      modal.querySelector<HTMLButtonElement>(
        "#botonConfirmarClase",
      )!;

    botonConfirmar.addEventListener(
      "click",
      async () => {
        const materia = campoMateria.value.trim();

        if (!materia) {
          errorModal.textContent =
            "Escribe el nombre de la materia.";
          return;
        }

        const prefijo = materia
          .substring(0, 3)
          .toUpperCase();

        const numAzar = Math.floor(
          100 + Math.random() * 900,
        );

        const codigoGenerado =
          `${prefijo}-${numAzar}`;

        botonConfirmar.disabled = true;
        botonConfirmar.textContent =
          "Guardando...";

        try {
          const res = await fetch(
            `${API_URL}/clases`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                codigo: codigoGenerado,
                materia,
                correoDocente: cuenta.correo,
                nombreDocente:
                  cuenta.nombreCompleto,
              }),
            },
          );

          if (!res.ok) {
            let mensaje =
              "Error al guardar la clase.";

            try {
              const data = await res.json();

              if (data.error) {
                mensaje = data.error;
              }
            } catch {
              // No hay respuesta JSON
            }

            errorModal.textContent = mensaje;

            botonConfirmar.disabled = false;
            botonConfirmar.textContent =
              "Generar clase";

            return;
          }

          modal.innerHTML = `
            <div class="dash-modal">

              <h3>
                ¡Clase creada!
              </h3>

              <p>
                Comparte este código con tus estudiantes
              </p>

              <div class="dash-codigo-grande">
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

          const botonEntrarAhora =
            modal.querySelector<HTMLButtonElement>(
              "#botonEntrarAhora",
            );

          if (botonEntrarAhora) {
            botonEntrarAhora.addEventListener(
              "click",
              () => {
                modal.remove();
                overlay.remove();

                const nuevaClase: Clase = {
                  codigo: codigoGenerado,
                  materia,
                  correoDocente:
                    cuenta.correo,
                  nombreDocente:
                    cuenta.nombreCompleto,
                  fechaCreacion:
                    new Date().toISOString(),
                  estudiantesInscritos: [],
                };

                alEntrarAClase(nuevaClase);
              },
            );
          }
        } catch (error) {
          console.error(
            "Error al crear clase:",
            error,
          );

          errorModal.textContent =
            "No se pudo conectar con el servidor.";

          botonConfirmar.disabled = false;
          botonConfirmar.textContent =
            "Generar clase";
        }
      },
    );
  }
}

export async function mostrarUsuariosAdmin(
  opciones: DashboardAdminOpciones,
): Promise<void> {
  const { contenido } = opciones;

  contenido.innerHTML = `
    <div class="dash-cargando">
      Cargando información del sistema...
    </div>
  `;

  let usuarios: Array<Cuenta & { id: number }> = [];
  let clases: ClaseAdmin[] = [];
  let inscripciones: InscripcionAdmin[] = [];

  let errorUsuarios = "";
  let errorClases = "";
  let errorInscripciones = "";

  try {
    const res = await fetch(
      `${API_URL}/usuarios`,
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    usuarios = await res.json();
  } catch (error) {
    console.error(
      "Error al cargar usuarios:",
      error,
    );

    errorUsuarios =
      "No se pudieron cargar los usuarios.";
  }

  try {
    const res = await fetch(
      `${API_URL}/clases`,
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    clases = await res.json();
  } catch (error) {
    console.error(
      "Error al cargar todas las clases:",
      error,
    );

    errorClases =
      "No se pudieron cargar las clases.";
  }

  try {
    const res = await fetch(
      `${API_URL}/inscripciones`,
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    inscripciones = await res.json();
  } catch (error) {
    console.error(
      "Error al cargar todas las inscripciones:",
      error,
    );

    errorInscripciones =
      "No se pudieron cargar las inscripciones.";
  }

  contenido.innerHTML = `
    <div
      style="
        max-width:1100px;
        margin:32px auto;
        padding:0 24px 50px 24px;
      "
    >

      <h2
        style="
          color:white;
          margin:0 0 4px 0;
        "
      >
        Panel de administración
      </h2>

      <p
        style="
          color:#9aa8c7;
          font-size:13px;
          margin:0 0 28px 0;
        "
      >
        Gestión general del sistema
      </p>

      <div
        style="
          background:rgba(255,255,255,0.04);
          border-radius:12px;
          padding:20px 24px;
          margin-bottom:24px;
        "
      >

        <p class="dash-seccion-titulo">
          Todos los usuarios (${usuarios.length})
        </p>

        ${
          errorUsuarios
            ? `
              <p
                style="
                  color:#ff6b6b;
                  font-size:13px;
                "
              >
                ${errorUsuarios}
              </p>
            `
            : ""
        }

        <div id="listaUsuarios">

          ${
            usuarios.length === 0 &&
            !errorUsuarios
              ? `
                <p class="dash-sin-clases">
                  No hay usuarios registrados.
                </p>
              `
              : usuarios
                  .map(
                    (u) => `
                      <div
                        style="
                          display:flex;
                          justify-content:space-between;
                          align-items:center;
                          gap:20px;
                          padding:14px 0;
                          border-bottom:1px solid rgba(255,255,255,0.06);
                        "
                      >

                        <div>

                          <p
                            style="
                              color:white;
                              font-weight:bold;
                              font-size:14px;
                              margin:0;
                            "
                          >
                            ${u.nombreCompleto}
                          </p>

                          <p
                            style="
                              color:#9aa8c7;
                              font-size:12px;
                              margin:3px 0 0 0;
                            "
                          >
                            ${u.correo}
                          </p>

                        </div>

                        ${
                          u.rol === "admin"
                            ? `
                              <span class="dash-badge-rol">
                                ADMINISTRADOR
                              </span>
                            `
                            : `
                              <select
                                class="dash-select-rol"
                                data-correo="${u.correo}"
                                style="
                                  min-width:130px;
                                "
                              >

                                <option
                                  value="estudiante"
                                  ${
                                    u.rol ===
                                      "estudiante" ||
                                    u.rol ===
                                      "invitado"
                                      ? "selected"
                                      : ""
                                  }
                                >
                                  Estudiante
                                </option>

                                <option
                                  value="docente"
                                  ${
                                    u.rol ===
                                    "docente"
                                      ? "selected"
                                      : ""
                                  }
                                >
                                  Docente
                                </option>

                              </select>
                            `
                        }

                      </div>
                    `,
                  )
                  .join("")
          }

        </div>

      </div>

      <div
        style="
          background:rgba(255,255,255,0.04);
          border-radius:12px;
          padding:20px 24px;
          margin-bottom:24px;
        "
      >

        <p class="dash-seccion-titulo">
          Todas las clases (${clases.length})
        </p>

        ${
          errorClases
            ? `
              <p
                style="
                  color:#ff6b6b;
                  font-size:13px;
                "
              >
                ${errorClases}
              </p>
            `
            : ""
        }

        ${
          clases.length === 0 &&
          !errorClases
            ? `
              <p class="dash-sin-clases">
                No hay clases creadas todavía.
              </p>
            `
            : ""
        }

        ${
          clases.length > 0
            ? `
              <div
                style="
                  overflow-x:auto;
                "
              >

                <table
                  style="
                    width:100%;
                    border-collapse:collapse;
                  "
                >

                  <thead>

                    <tr>

                      <th
                        style="
                          text-align:left;
                          color:#9aa8c7;
                          font-size:12px;
                          padding:12px 8px;
                        "
                      >
                        Materia
                      </th>

                      <th
                        style="
                          text-align:left;
                          color:#9aa8c7;
                          font-size:12px;
                          padding:12px 8px;
                        "
                      >
                        Código
                      </th>

                      <th
                        style="
                          text-align:left;
                          color:#9aa8c7;
                          font-size:12px;
                          padding:12px 8px;
                        "
                      >
                        Docente
                      </th>

                      <th
                        style="
                          text-align:center;
                          color:#9aa8c7;
                          font-size:12px;
                          padding:12px 8px;
                        "
                      >
                        Inscritos
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    ${clases
                      .map(
                        (clase) => `
                          <tr>

                            <td
                              style="
                                color:white;
                                padding:12px 8px;
                                border-top:1px solid rgba(255,255,255,0.06);
                              "
                            >
                              ${clase.materia}
                            </td>

                            <td
                              style="
                                color:#9aa8c7;
                                padding:12px 8px;
                                border-top:1px solid rgba(255,255,255,0.06);
                              "
                            >
                              ${clase.codigo}
                            </td>

                            <td
                              style="
                                color:#b8c4dd;
                                padding:12px 8px;
                                border-top:1px solid rgba(255,255,255,0.06);
                              "
                            >
                              ${clase.nombreDocente}
                            </td>

                            <td
                              style="
                                color:white;
                                text-align:center;
                                padding:12px 8px;
                                border-top:1px solid rgba(255,255,255,0.06);
                              "
                            >
                              ${clase.totalInscritos}
                            </td>

                          </tr>
                        `,
                      )
                      .join("")}

                  </tbody>

                </table>

              </div>
            `
            : ""
        }

      </div>

      <div
        style="
          background:rgba(255,255,255,0.04);
          border-radius:12px;
          padding:20px 24px;
        "
      >

        <p class="dash-seccion-titulo">
          Todas las inscripciones (${inscripciones.length})
        </p>

        ${
          errorInscripciones
            ? `
              <p
                style="
                  color:#ff6b6b;
                  font-size:13px;
                "
              >
                ${errorInscripciones}
              </p>
            `
            : ""
        }

        ${
          inscripciones.length === 0 &&
          !errorInscripciones
            ? `
              <p class="dash-sin-clases">
                Todavía no hay inscripciones.
              </p>
            `
            : ""
        }

        ${
          inscripciones.length > 0
            ? `
              <div
                style="
                  overflow-x:auto;
                "
              >

                <table
                  style="
                    width:100%;
                    border-collapse:collapse;
                  "
                >

                  <thead>

                    <tr>

                      <th
                        style="
                          text-align:left;
                          color:#9aa8c7;
                          font-size:12px;
                          padding:12px 8px;
                        "
                      >
                        Estudiante
                      </th>

                      <th
                        style="
                          text-align:left;
                          color:#9aa8c7;
                          font-size:12px;
                          padding:12px 8px;
                        "
                      >
                        Materia
                      </th>

                      <th
                        style="
                          text-align:left;
                          color:#9aa8c7;
                          font-size:12px;
                          padding:12px 8px;
                        "
                      >
                        Código
                      </th>

                      <th
                        style="
                          text-align:left;
                          color:#9aa8c7;
                          font-size:12px;
                          padding:12px 8px;
                        "
                      >
                        Fecha
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    ${inscripciones
                      .map(
                        (inscripcion) => `
                          <tr>

                            <td
                              style="
                                color:white;
                                padding:12px 8px;
                                border-top:1px solid rgba(255,255,255,0.06);
                              "
                            >
                              ${inscripcion.nombreEstudiante}
                            </td>

                            <td
                              style="
                                color:#b8c4dd;
                                padding:12px 8px;
                                border-top:1px solid rgba(255,255,255,0.06);
                              "
                            >
                              ${inscripcion.materia}
                            </td>

                            <td
                              style="
                                color:#9aa8c7;
                                padding:12px 8px;
                                border-top:1px solid rgba(255,255,255,0.06);
                              "
                            >
                              ${inscripcion.codigo}
                            </td>

                            <td
                              style="
                                color:#9aa8c7;
                                padding:12px 8px;
                                border-top:1px solid rgba(255,255,255,0.06);
                              "
                            >
                              ${inscripcion.fecha}
                            </td>

                          </tr>
                        `,
                      )
                      .join("")}

                  </tbody>

                </table>

              </div>
            `
            : ""
        }

      </div>

    </div>
  `;

  contenido
    .querySelectorAll<HTMLSelectElement>(
      ".dash-select-rol",
    )
    .forEach((select) => {
      select.addEventListener(
        "change",
        async () => {
          const correo =
            select.dataset.correo!;

          const nuevoRol =
            select.value;

          select.disabled = true;

          try {
            const res = await fetch(
              `${API_URL}/usuarios/${encodeURIComponent(
                correo,
              )}/rol`,
              {
                method: "PATCH",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  nuevoRol,
                }),
              },
            );

            if (!res.ok) {
              let mensaje =
                "No se pudo actualizar el rol.";

              try {
                const data =
                  await res.json();

                if (data.error) {
                  mensaje = data.error;
                }
              } catch {
                // Respuesta no JSON
              }

              alert(mensaje);
            }
          } catch (error) {
            console.error(
              "Error al cambiar el rol:",
              error,
            );

            alert(
              "No se pudo conectar con el servidor.",
            );
          } finally {
            select.disabled = false;
          }
        },
      );
    });
}