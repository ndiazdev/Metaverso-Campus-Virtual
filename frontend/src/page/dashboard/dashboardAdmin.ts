import type { Cuenta, Clase } from "../../state/estado";
import {
  avatarDe,
  etiquetaRol,
  fechaCorta,
} from "./dashboardComun";
import { montarFiltros, montarFiltrosClases, montarTabla } from "./dashboardFiltros";
import { API_URL } from "../../api/cliente";
import { t } from "../../state/idioma";

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
      ${t("admin.cargando")}
    </div>
  `;

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
    console.error("Error al consultar las clases del administrador:", error);
  }

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
          ${misClases.length === 1 ? t("admin.claseCreada") : t("admin.clasesCreadas")}
        </p>
      </div>

      <div class="dash-cabecera-acciones">
        <button
          class="dash-boton-principal"
          id="botonAccionPrincipal"
        >
          <i class="fa-solid fa-plus"></i>
          ${t("admin.nuevaClase")}
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
        <div class="dash-stat-etiqueta">${t("admin.statClases")}</div>
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
              <div class="dash-stat-etiqueta">${t("admin.statInscritos")}</div>
            </div>
          `
          : ""
      }

    </div>

    <div class="dash-card">

      <div class="dash-card-encabezado">
        <p class="dash-card-titulo">${t("admin.misClases")}</p>
        <div class="dash-card-herramientas" id="herramientasClases"></div>
      </div>

      <div class="dash-lista" id="listaClases">

          ${
            misClases.length === 0
              ? `
                <p class="dash-vacio">
                  ${t("admin.sinClases")}
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
                                      ${clase.totalInscritos} ${t("admin.inscritos")}
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
                          ${t("admin.abrir")}
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

  montarFiltrosClases(contenido, t("admin.buscarClase"));

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
          ${t("admin.crearTitulo")}
        </h3>

        <p>
          ${t("admin.crearTexto")}
        </p>

        <input
          class="dash-input-codigo dash-input-texto"
          id="campoMateriaNueva"
          placeholder="${t("admin.placeholderMateria")}"
        />

        <p
          class="dash-error"
          id="errorModal"
        ></p>

        <button
          class="dash-boton-principal"
          id="botonConfirmarClase"
        >
          ${t("admin.generarClase")}
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
            t("admin.errorMateria");
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
          t("admin.guardando");

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
              t("admin.errorGuardar");

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
              t("admin.generarClase");

            return;
          }

          modal.innerHTML = `
            <div class="dash-modal">

              <h3>
                ${t("admin.exitoTitulo")}
              </h3>

              <p>
                ${t("admin.exitoTexto")}
              </p>

              <div class="dash-codigo-grande">
                ${codigoGenerado}
              </div>

              <button
                class="dash-boton-principal"
                id="botonEntrarAhora"
              >
                ${t("admin.entrarClase")}
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
            t("perfil.msg.sinServidor");

          botonConfirmar.disabled = false;
          botonConfirmar.textContent =
            t("admin.generarClase");
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
      ${t("admin.cargandoSistema")}
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
      t("admin.errorUsuarios");
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
      t("admin.errorClases");
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
      t("admin.errorInscripciones");
  }

  const iniciales = (nombre: string): string =>
    nombre
      .trim()
      .split(/\s+/)
      .map((parte) => parte.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase();

  contenido.innerHTML = `

    <div class="dash-cabecera">

      <div>
        <p class="dash-cabecera-etiqueta">${t("admin.etiqueta")}</p>
        <h1 class="dash-cabecera-titulo">${t("admin.panel")}</h1>
        <p class="dash-cabecera-subtitulo">
          ${t("admin.subtitulo")}
        </p>
      </div>

    </div>

    <div class="dash-grid dash-grid-stats">

      <div class="dash-stat">
        <div class="dash-stat-cabecera">
          <span class="dash-stat-icono">
            <i class="fa-solid fa-users"></i>
          </span>
          <span class="dash-stat-numero">${usuarios.length}</span>
        </div>
        <div class="dash-stat-etiqueta">${t("comun.nav.usuarios")}</div>
      </div>

      <div class="dash-stat">
        <div class="dash-stat-cabecera">
          <span class="dash-stat-icono">
            <i class="fa-solid fa-graduation-cap"></i>
          </span>
          <span class="dash-stat-numero">${clases.length}</span>
        </div>
        <div class="dash-stat-etiqueta">${t("comun.nav.clases")}</div>
      </div>

      <div class="dash-stat">
        <div class="dash-stat-cabecera">
          <span class="dash-stat-icono">
            <i class="fa-solid fa-clipboard-check"></i>
          </span>
          <span class="dash-stat-numero">${inscripciones.length}</span>
        </div>
        <div class="dash-stat-etiqueta">${t("admin.inscripciones")}</div>
      </div>

    </div>

      <div class="dash-grid dash-grid-tarjetas">

      <div class="dash-card">

        <div class="dash-card-encabezado">
          <p class="dash-card-titulo">${t("comun.nav.usuarios")} (${usuarios.length})</p>
          <div class="dash-card-herramientas" id="herramientasUsuarios"></div>
        </div>

          ${
            errorUsuarios
              ? `
                <p class="dash-error-panel">
                  ${errorUsuarios}
                </p>
              `
              : ""
          }

          <div class="dash-lista" id="listaUsuarios">

            ${
              usuarios.length === 0 &&
              !errorUsuarios
                ? `
                  <p class="dash-vacio">
                    ${t("admin.sinUsuarios")}
                  </p>
                `
                : `
                  <div class="dash-lista-cabecera">
                    <span>
                      <i class="fa-solid fa-user"></i>
                      ${t("comun.usuario")}
                    </span>
                    <span>
                      <i class="fa-solid fa-shield-halved"></i>
                      ${t("perfil.rol")}
                    </span>
                  </div>

                  ${usuarios
                    .map(
                      (u) => `
                        <div
                          class="dash-fila-usuario"
                          data-buscar="${u.nombreCompleto} ${u.correo} ${u.rol}"
                          data-grupo="${u.rol === "invitado" ? "estudiante" : u.rol}"
                        >

                          <div class="dash-usuario-info">

                            <span
                              class="dash-usuario-avatar rol-${
                                u.rol === "invitado" ? "estudiante" : u.rol
                              }"
                            >
                              ${iniciales(u.nombreCompleto)}
                            </span>

                            <div class="dash-usuario-bloque">

                              <p class="dash-usuario-nombre">
                                ${u.nombreCompleto}
                              </p>

                              <p class="dash-usuario-correo">
                                ${u.correo}
                              </p>

                            </div>

                          </div>

                          <div class="dash-usuario-rol">
                          ${
                            u.rol === "admin"
                              ? `
                                <span class="dash-badge-rol rol-admin">
                                  <i class="fa-solid fa-shield-halved"></i>
                                  ${etiquetaRol(u.rol)}
                                </span>
                              `
                              : `
                                <select
                                  class="dash-select-rol"
                                  data-correo="${u.correo}"
                                  data-rol="${u.rol}"
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
                                    ${etiquetaRol("estudiante")}
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
                                    ${etiquetaRol("docente")}
                                  </option>

                                </select>
                              `
                          }
                          </div>

                        </div>
                      `,
                    )
                    .join("")}
                `
            }

          </div>

        </div>

        <div class="dash-card">

          <div class="dash-card-encabezado">
            <p class="dash-card-titulo">${t("comun.nav.clases")} (${clases.length})</p>
            <div class="dash-card-herramientas" id="herramientasClasesAdmin"></div>
          </div>

          ${
            errorClases
              ? `
                <p class="dash-error-panel">
                  ${errorClases}
                </p>
              `
              : ""
          }

          ${
            clases.length === 0 &&
            !errorClases
              ? `
                <p class="dash-vacio">
                  ${t("admin.sinClasesLista")}
                </p>
              `
              : ""
          }

          ${
            clases.length > 0
              ? `
                <div class="dash-tabla-envoltura" id="listaClasesAdmin">

                  <table class="dash-tabla">

                    <thead>

                      <tr>

                        <th>
                          ${t("perfil.materia")}
                        </th>

                        <th>
                          ${t("admin.codigo")}
                        </th>

                        <th>
                          ${t("admin.docente")}
                        </th>

                        <th class="centro">
                          ${t("admin.colInscritos")}
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      ${clases
                        .map(
                          (clase) => `
                            <tr data-buscar="${clase.materia} ${clase.codigo} ${clase.nombreDocente}">

                              <td>
                                ${clase.materia}
                              </td>

                              <td class="tenue">
                                ${clase.codigo}
                              </td>

                              <td>
                                ${clase.nombreDocente}
                              </td>

                              <td class="centro">
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

        <div class="dash-card">

          <div class="dash-card-encabezado">
            <p class="dash-card-titulo">${t("admin.inscripciones")} (${inscripciones.length})</p>
            <div class="dash-card-herramientas" id="herramientasInscripciones"></div>
          </div>

          ${
            errorInscripciones
              ? `
                <p class="dash-error-panel">
                  ${errorInscripciones}
                </p>
              `
              : ""
          }

          ${
            inscripciones.length === 0 &&
            !errorInscripciones
              ? `
                <p class="dash-vacio">
                  ${t("admin.sinInscripciones")}
                </p>
              `
              : ""
          }

          ${
            inscripciones.length > 0
              ? `
                <div class="dash-tabla-envoltura" id="listaInscripcionesAdmin">

                  <table class="dash-tabla">

                    <thead>

                      <tr>

                        <th>
                          ${t("admin.estudiante")}
                        </th>

                        <th>
                          ${t("perfil.materia")}
                        </th>

                        <th>
                          ${t("admin.codigo")}
                        </th>

                        <th>
                          ${t("admin.fecha")}
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      ${inscripciones
                        .map(
                          (inscripcion) => `
                            <tr data-buscar="${inscripcion.nombreEstudiante} ${inscripcion.materia} ${inscripcion.codigo}">

                              <td>
                                ${inscripcion.nombreEstudiante}
                              </td>

                              <td>
                                ${inscripcion.materia}
                              </td>

                              <td class="tenue">
                                ${inscripcion.codigo}
                              </td>

                              <td class="tenue">
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

  // ==========================================================
  // BUSCADOR Y FILTROS
  // ==========================================================

  const FILTROS_ROL = [
    { valor: "todos", etiqueta: t("admin.filtroTodos") },
    { valor: "admin", etiqueta: t("admin.filtroAdmins") },
    { valor: "docente", etiqueta: t("admin.filtroDocentes") },
    { valor: "estudiante", etiqueta: t("admin.filtroEstudiantes") },
  ];

  const listaUsuarios =
    contenido.querySelector<HTMLElement>("#listaUsuarios");

  const herramientasUsuarios =
    contenido.querySelector<HTMLElement>("#herramientasUsuarios");

  if (listaUsuarios && herramientasUsuarios) {
    montarFiltros({
      destino: herramientasUsuarios,
      ubicacionVacio: listaUsuarios,
      items: Array.from(
        listaUsuarios.querySelectorAll<HTMLElement>(".dash-fila-usuario"),
      ),
      placeholder: t("admin.buscarUsuario"),
      filtros: FILTROS_ROL,
      etiquetaConteo: t("admin.conteoUsuarios"),
    });
  }

  montarTabla(contenido, {
    destino: "#herramientasClasesAdmin",
    tabla: "#listaClasesAdmin",
    placeholder: t("admin.buscarMateria"),
    etiquetaConteo: t("admin.conteoClases"),
  });

  montarTabla(contenido, {
    destino: "#herramientasInscripciones",
    tabla: "#listaInscripcionesAdmin",
    placeholder: t("admin.buscarInscripcion"),
    etiquetaConteo: t("admin.conteoInscripciones"),
  });

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
                t("admin.errorRol");

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
              t("perfil.msg.sinServidor"),
            );
          } finally {
            select.disabled = false;
          }
        },
      );
    });
}