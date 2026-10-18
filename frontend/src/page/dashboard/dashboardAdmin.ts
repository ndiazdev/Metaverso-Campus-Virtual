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
  /**
   * Pestaña a mostrar al montar (usuarios/clases/inscripciones). Sirve
   * para que al refrescar tras un CRUD no se vuelva siempre a la de
   * usuarios.
   */
  pestana?: "usuarios" | "clases" | "inscripciones";
}

interface ClaseAdmin {
  codigo: string;
  materia: string;
  correoDocente: string;
  nombreDocente: string;
  totalInscritos: number;
}

interface InscripcionAdmin {
  id: number;
  correoEstudiante: string;
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
      <div
        class="dash-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tituloModalClase"
      >

        <button
          type="button"
          class="dash-modal-cerrar"
          data-cerrar
          aria-label="${t("comun.cerrar")}"
          title="${t("comun.cerrar")}"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>

        <h3 id="tituloModalClase">
          ${t("admin.crearTitulo")}
        </h3>

        <p>
          ${t("admin.crearTexto")}
        </p>

        <label class="dash-modal-etiqueta" for="campoMateriaNueva">
          ${t("perfil.materia")}
        </label>

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

        <button
          type="button"
          class="dash-boton-secundario"
          data-cerrar
        >
          ${t("comun.cancelar")}
        </button>

      </div>
    `;

    document.body.appendChild(modal);

    // --------------------------------------------------------
    // SALIDAS DEL MODAL: X, Cancelar, clic fuera y ESC.
    // `conectarCierre` se repite después del éxito porque ahí se
    // reescribe todo el HTML y los botones viejos quedan sin clic.
    // --------------------------------------------------------

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

    function conectarCierre(): void {
      modal.querySelectorAll<HTMLElement>("[data-cerrar]").forEach((boton) => {
        boton.addEventListener("click", cerrar);
      });
    }

    conectarCierre();
    window.addEventListener("keydown", alTecla, true);

    modal.addEventListener("click", (evento) => {
      if (evento.target === modal) cerrar();
    });

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
            <div
              class="dash-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="tituloModalClase"
            >

              <button
                type="button"
                class="dash-modal-cerrar"
                data-cerrar
                aria-label="${t("comun.cerrar")}"
                title="${t("comun.cerrar")}"
              >
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>

              <h3 id="tituloModalClase">
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

              <button
                type="button"
                class="dash-boton-secundario"
                data-cerrar
              >
                ${t("comun.cerrar")}
              </button>

            </div>
          `;

          conectarCierre();

          const botonEntrarAhora =
            modal.querySelector<HTMLButtonElement>(
              "#botonEntrarAhora",
            );

          if (botonEntrarAhora) {
            botonEntrarAhora.addEventListener(
              "click",
              () => {
                // `cerrar` suelta también el listener de ESC: si no,
                // seguiría capturando la tecla dentro de la clase.
                cerrar();
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
  const { contenido, cuenta } = opciones;

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

    <div class="dash-card">

        <div class="dash-card-encabezado">

          <div class="dash-pestanas">
            <button
              type="button"
              class="dash-pestana activo"
              data-vista="usuarios"
              aria-pressed="true"
            >
              <i class="fa-solid fa-users"></i>
              ${t("comun.nav.usuarios")}
              <span class="dash-pestana-conteo">${usuarios.length}</span>
            </button>

            <button
              type="button"
              class="dash-pestana"
              data-vista="clases"
              aria-pressed="false"
            >
              <i class="fa-solid fa-graduation-cap"></i>
              ${t("comun.nav.clases")}
              <span class="dash-pestana-conteo">${clases.length}</span>
            </button>

            <button
              type="button"
              class="dash-pestana"
              data-vista="inscripciones"
              aria-pressed="false"
            >
              <i class="fa-solid fa-clipboard-check"></i>
              ${t("admin.inscripciones")}
              <span class="dash-pestana-conteo">${inscripciones.length}</span>
            </button>
          </div>

          <div class="dash-card-herramientas">
            <div
              class="dash-herramienta"
              id="herramientasUsuarios"
              data-zona="usuarios"
            ></div>

            <div
              class="dash-herramienta"
              id="herramientasClasesAdmin"
              data-zona="clases"
              hidden
            ></div>

            <div
              class="dash-herramienta"
              id="herramientasInscripciones"
              data-zona="inscripciones"
              hidden
            ></div>
          </div>

        </div>

      <section data-zona="usuarios">

          ${
            errorUsuarios
              ? `
                <p class="dash-error-panel">
                  ${errorUsuarios}
                </p>
              `
              : `
                <div class="dash-lista-acciones">
                  <button
                    type="button"
                    class="dash-boton-principal"
                    id="botonCrearUsuario"
                  >
                    <i class="fa-solid fa-user-plus"></i>
                    ${t("admin.crearUsuario")}
                  </button>
                </div>
              `
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

                          <div class="dash-usuario-acciones">

                            <button
                              type="button"
                              class="dash-boton-icono"
                              data-editar="${encodeURIComponent(u.correo)}"
                              title="${t("admin.editar")}"
                              aria-label="${t("admin.editar")} ${u.nombreCompleto}"
                            >
                              <i class="fa-solid fa-pen" aria-hidden="true"></i>
                            </button>

                            ${
                              u.correo !== cuenta.correo
                                ? `
                                  <button
                                    type="button"
                                    class="dash-boton-icono peligro"
                                    data-eliminar="${encodeURIComponent(u.correo)}"
                                    title="${t("admin.eliminar")}"
                                    aria-label="${t("admin.eliminar")} ${u.nombreCompleto}"
                                  >
                                    <i class="fa-solid fa-trash" aria-hidden="true"></i>
                                  </button>
                                `
                                : ""
                            }

                          </div>

                        </div>
                      `,
                    )
                    .join("")}
                `
            }

          </div>

      </section>

      <section data-zona="clases" hidden>

          ${
            errorClases
              ? `
                <p class="dash-error-panel">
                  ${errorClases}
                </p>
              `
              : `
                <div class="dash-lista-acciones">
                  <button
                    type="button"
                    class="dash-boton-principal"
                    id="botonCrearClase"
                  >
                    <i class="fa-solid fa-plus"></i>
                    ${t("admin.crearClase")}
                  </button>
                </div>
              `
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

                        <th class="centro">
                          ${t("admin.colAcciones")}
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

                              <td class="centro">

                                <div class="dash-tabla-acciones">

                                  <button
                                    type="button"
                                    class="dash-boton-icono"
                                    data-editar-clase="${encodeURIComponent(clase.codigo)}"
                                    title="${t("admin.editar")}"
                                    aria-label="${t("admin.editar")} ${clase.materia}"
                                  >
                                    <i class="fa-solid fa-pen" aria-hidden="true"></i>
                                  </button>

                                  <button
                                    type="button"
                                    class="dash-boton-icono peligro"
                                    data-eliminar-clase="${encodeURIComponent(clase.codigo)}"
                                    title="${t("admin.eliminar")}"
                                    aria-label="${t("admin.eliminar")} ${clase.materia}"
                                  >
                                    <i class="fa-solid fa-trash" aria-hidden="true"></i>
                                  </button>

                                </div>

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

      </section>

      <section data-zona="inscripciones" hidden>

          ${
            errorInscripciones
              ? `
                <p class="dash-error-panel">
                  ${errorInscripciones}
                </p>
              `
              : `
                <div class="dash-lista-acciones">
                  <button
                    type="button"
                    class="dash-boton-principal"
                    id="botonCrearInscripcion"
                  >
                    <i class="fa-solid fa-user-plus"></i>
                    ${t("admin.inscribirEstudiante")}
                  </button>
                </div>
              `
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

                        <th class="centro">
                          ${t("admin.colAcciones")}
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

                              <td class="centro">

                                <div class="dash-tabla-acciones">

                                  <button
                                    type="button"
                                    class="dash-boton-icono"
                                    data-editar-inscripcion="${inscripcion.id}"
                                    title="${t("admin.editar")}"
                                    aria-label="${t("admin.editar")} ${inscripcion.nombreEstudiante}"
                                  >
                                    <i class="fa-solid fa-pen" aria-hidden="true"></i>
                                  </button>

                                  <button
                                    type="button"
                                    class="dash-boton-icono peligro"
                                    data-eliminar-inscripcion="${inscripcion.id}"
                                    title="${t("admin.eliminar")}"
                                    aria-label="${t("admin.eliminar")} ${inscripcion.nombreEstudiante}"
                                  >
                                    <i class="fa-solid fa-trash" aria-hidden="true"></i>
                                  </button>

                                </div>

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

      </section>

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

  // ==========================================================
  // PESTAÑAS: UNA SOLA CAJA conmuta entre usuarios / clases /
  // inscripciones. Los chips de rol (Todos/Admins/…) pertenecen
  // solo a la barra de usuarios, así que al cambiar de pestaña
  // desaparecen junto con ella.
  // ==========================================================

  const pestanas = Array.from(
    contenido.querySelectorAll<HTMLButtonElement>(".dash-pestana"),
  );

  pestanas.forEach((pestana) => {
    pestana.addEventListener("click", () => {
      const vista = pestana.dataset.vista ?? "";

      pestanas.forEach((otra) => {
        const activa = otra === pestana;
        otra.classList.toggle("activo", activa);
        otra.setAttribute("aria-pressed", String(activa));
      });

      contenido
        .querySelectorAll<HTMLElement>("[data-zona]")
        .forEach((zona) => {
          zona.hidden = zona.dataset.zona !== vista;
        });
    });
  });

  // Pestaña inicial distinta de "usuarios" (tras un CRUD de clases o
  // inscripciones se vuelve a abrir en la misma donde estabas).
  const pestanaSolicitada = opciones.pestana;
  if (pestanaSolicitada && pestanaSolicitada !== "usuarios") {
    pestanas
      .find((pestana) => pestana.dataset.vista === pestanaSolicitada)
      ?.click();
  }

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

  // ==========================================================
  // CRUD DE USUARIOS: crear / editar / eliminar
  // ==========================================================

  type UsuarioFila = Cuenta & { id: number };

  const escaparAtributo = (texto: string): string =>
    texto
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function pestanaActual(): "usuarios" | "clases" | "inscripciones" {
    const activa = contenido.querySelector<HTMLButtonElement>(".dash-pestana.activo");
    const vista = activa?.dataset.vista;
    return vista === "clases" || vista === "inscripciones" ? vista : "usuarios";
  }

  function refrescarUsuarios(): void {
    void mostrarUsuariosAdmin({ ...opciones, pestana: pestanaActual() });
  }

  function cerrarConEsc(cerrar: () => void): () => void {
    function alTecla(evento: KeyboardEvent): void {
      if (evento.key === "Escape") {
        evento.stopPropagation();
        cerrar();
      }
    }

    window.addEventListener("keydown", alTecla, true);

    return () => window.removeEventListener("keydown", alTecla, true);
  }

  function abrirModalUsuario(usuario: UsuarioFila | null): void {
    const esEdicion = usuario !== null;

    const modal = document.createElement("div");
    modal.className = "dash-modal-fondo";

    const opcionesRol: Array<{ valor: string; etiqueta: string }> = [
      { valor: "estudiante", etiqueta: etiquetaRol("estudiante") },
      { valor: "docente", etiqueta: etiquetaRol("docente") },
      { valor: "admin", etiqueta: etiquetaRol("admin") },
    ];

    const rolInicial = usuario?.rol && ["estudiante", "docente", "admin"].includes(usuario.rol) ? usuario.rol : "estudiante";

    modal.innerHTML = `
      <div
        class="dash-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tituloModalUsuario"
      >

        <button
          type="button"
          class="dash-modal-cerrar"
          data-cerrar
          aria-label="${t("comun.cerrar")}"
          title="${t("comun.cerrar")}"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>

        <h3 id="tituloModalUsuario">
          ${esEdicion ? t("admin.editarUsuarioTitulo") : t("admin.crearUsuarioTitulo")}
        </h3>

        <p>
          ${esEdicion ? t("admin.editarUsuarioTexto") : t("admin.crearUsuarioTexto")}
        </p>

        <label class="dash-modal-etiqueta" for="campoNombreUsuario">
          ${t("admin.campoNombre")}
        </label>

        <input
          class="dash-input-codigo dash-input-texto"
          id="campoNombreUsuario"
          value="${esEdicion ? escaparAtributo(usuario.nombreCompleto) : ""}"
        />

        <label class="dash-modal-etiqueta" for="campoCorreoUsuario">
          ${t("admin.campoCorreo")}
        </label>

        <input
          class="dash-input-codigo dash-input-texto"
          id="campoCorreoUsuario"
          type="email"
          ${esEdicion ? `value="${escaparAtributo(usuario.correo)}" disabled` : ""}
        />

        <label class="dash-modal-etiqueta" for="campoRolUsuario">
          ${t("perfil.rol")}
        </label>

        <select class="dash-select-rol" id="campoRolUsuario">
          ${opcionesRol
            .map(
              (opcion) => `
                <option value="${opcion.valor}" ${opcion.valor === rolInicial ? "selected" : ""}>
                  ${opcion.etiqueta}
                </option>
              `,
            )
            .join("")}
        </select>

        <label class="dash-modal-etiqueta" for="campoCarreraUsuario">
          ${t("admin.campoCarrera")}
        </label>

        <input
          class="dash-input-codigo dash-input-texto"
          id="campoCarreraUsuario"
          value="${esEdicion ? escaparAtributo(usuario.carrera ?? "") : ""}"
          ${rolInicial !== "estudiante" ? "hidden" : ""}
        />

        <label class="dash-modal-etiqueta" for="campoMateriaUsuario" ${rolInicial !== "docente" ? "hidden" : ""}>
          ${t("perfil.materia")}
        </label>

        <input
          class="dash-input-codigo dash-input-texto"
          id="campoMateriaUsuario"
          value="${esEdicion ? escaparAtributo(usuario.materia ?? "") : ""}"
          ${rolInicial !== "docente" ? "hidden" : ""}
        />

        <label class="dash-modal-etiqueta" for="campoContrasenaUsuario">
          ${esEdicion ? t("admin.campoContrasenaOpcional") : t("admin.campoContrasena")}
        </label>

        <input
          class="dash-input-codigo dash-input-texto"
          id="campoContrasenaUsuario"
          type="password"
          autocomplete="${esEdicion ? "new-password" : "new-password"}"
        />

        <p
          class="dash-error"
          id="errorModalUsuario"
        ></p>

        <button
          class="dash-boton-principal"
          id="botonConfirmarUsuario"
        >
          ${t("admin.guardarUsuario")}
        </button>

        <button
          type="button"
          class="dash-boton-secundario"
          data-cerrar
        >
          ${t("comun.cancelar")}
        </button>

      </div>
    `;

    document.body.appendChild(modal);

    function cerrar(): void {
      quitarTecla();
      modal.remove();
    }

    const quitarTecla = cerrarConEsc(cerrar);

    modal.querySelectorAll<HTMLElement>("[data-cerrar]").forEach((boton) => {
      boton.addEventListener("click", cerrar);
    });

    modal.addEventListener("click", (evento) => {
      if (evento.target === modal) cerrar();
    });

    const campoNombre =
      modal.querySelector<HTMLInputElement>("#campoNombreUsuario")!;
    const campoCorreo =
      modal.querySelector<HTMLInputElement>("#campoCorreoUsuario")!;
    const campoRol =
      modal.querySelector<HTMLSelectElement>("#campoRolUsuario")!;
    const campoCarrera =
      modal.querySelector<HTMLInputElement>("#campoCarreraUsuario")!;
    const campoMateria =
      modal.querySelector<HTMLInputElement>("#campoMateriaUsuario")!;
    const etiquetaMateria = modal.querySelector<HTMLLabelElement>(
      'label[for="campoMateriaUsuario"]',
    )!;
    const campoContrasena =
      modal.querySelector<HTMLInputElement>("#campoContrasenaUsuario")!;
    const errorModal =
      modal.querySelector<HTMLParagraphElement>("#errorModalUsuario")!;
    const botonConfirmar =
      modal.querySelector<HTMLButtonElement>("#botonConfirmarUsuario")!;

    function sincronizarRol(): void {
      const rol = campoRol.value;
      campoCarrera.hidden = rol !== "estudiante";
      campoMateria.hidden = rol !== "docente";
      etiquetaMateria.hidden = rol !== "docente";
    }

    campoRol.addEventListener("change", sincronizarRol);
    sincronizarRol();

    botonConfirmar.addEventListener("click", async () => {
      const nombre = campoNombre.value.trim();
      const correo = campoCorreo.value.trim().toLowerCase();
      const rol = campoRol.value;
      const contrasena = campoContrasena.value;

      errorModal.textContent = "";

      if (nombre.length < 3) {
        errorModal.textContent = t("admin.errorNombre");
        return;
      }

      if (!esEdicion && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        errorModal.textContent = t("admin.errorCorreo");
        return;
      }

      if (!esEdicion && contrasena.length < 6) {
        errorModal.textContent = t("admin.errorContrasena");
        return;
      }

      if (esEdicion && contrasena.length > 0 && contrasena.length < 6) {
        errorModal.textContent = t("admin.errorContrasena");
        return;
      }

      if (rol === "estudiante" && !campoCarrera.value.trim()) {
        errorModal.textContent = t("admin.errorCarrera");
        return;
      }

      if (rol === "docente" && !campoMateria.value.trim()) {
        errorModal.textContent = t("admin.errorMateriaDocente");
        return;
      }

      const cuerpo: Record<string, string> = {
        nombreCompleto: nombre,
        rol,
      };

      if (rol === "estudiante") {
        cuerpo.carrera = campoCarrera.value.trim();
        cuerpo.materia = "";
      } else if (rol === "docente") {
        cuerpo.materia = campoMateria.value.trim();
        cuerpo.carrera = "";
      }

      if (!esEdicion) {
        cuerpo.correo = correo;
        cuerpo.contrasena = contrasena;
      } else if (contrasena.length > 0) {
        cuerpo.contrasena = contrasena;
      }

      botonConfirmar.disabled = true;
      botonConfirmar.textContent = t("admin.guardando");

      try {
        const res = await fetch(
          esEdicion
            ? `${API_URL}/usuarios/${encodeURIComponent(usuario.correo)}`
            : `${API_URL}/usuarios`,
          {
            method: esEdicion ? "PUT" : "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(cuerpo),
          },
        );

        if (!res.ok) {
          let mensaje = esEdicion
            ? t("admin.errorActualizarUsuario")
            : t("admin.errorCrearUsuario");

          try {
            const data = await res.json();

            if (data.error) {
              mensaje = data.error;
            }
          } catch {
            // Respuesta no JSON
          }

          errorModal.textContent = mensaje;

          botonConfirmar.disabled = false;
          botonConfirmar.textContent = t("admin.guardarUsuario");

          return;
        }

        cerrar();
        refrescarUsuarios();
      } catch (error) {
        console.error(
          esEdicion ? "Error al editar usuario:" : "Error al crear usuario:",
          error,
        );

        errorModal.textContent = t("perfil.msg.sinServidor");

        botonConfirmar.disabled = false;
        botonConfirmar.textContent = t("admin.guardarUsuario");
      }
    });

    campoNombre.focus();
  }

  function abrirConfirmarEliminar(usuario: UsuarioFila): void {
    const modal = document.createElement("div");
    modal.className = "dash-modal-fondo";

    modal.innerHTML = `
      <div
        class="dash-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tituloModalEliminar"
      >

        <button
          type="button"
          class="dash-modal-cerrar"
          data-cerrar
          aria-label="${t("comun.cerrar")}"
          title="${t("comun.cerrar")}"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>

        <h3 id="tituloModalEliminar">
          ${t("admin.confirmarEliminarTitulo")}
        </h3>

        <p>
          ${t("admin.confirmarEliminar", { nombre: usuario.nombreCompleto })}
        </p>

        <p
          class="dash-error"
          id="errorModalEliminar"
        ></p>

        <button
          class="dash-boton-peligro-solido"
          id="botonConfirmarEliminar"
        >
          <i class="fa-solid fa-trash" aria-hidden="true"></i>
          ${t("admin.eliminar")}
        </button>

        <button
          type="button"
          class="dash-boton-secundario"
          data-cerrar
        >
          ${t("admin.no")}
        </button>

      </div>
    `;

    document.body.appendChild(modal);

    function cerrar(): void {
      quitarTecla();
      modal.remove();
    }

    const quitarTecla = cerrarConEsc(cerrar);

    modal.querySelectorAll<HTMLElement>("[data-cerrar]").forEach((boton) => {
      boton.addEventListener("click", cerrar);
    });

    modal.addEventListener("click", (evento) => {
      if (evento.target === modal) cerrar();
    });

    const errorModal =
      modal.querySelector<HTMLParagraphElement>("#errorModalEliminar")!;
    const botonConfirmar =
      modal.querySelector<HTMLButtonElement>("#botonConfirmarEliminar")!;

    botonConfirmar.addEventListener("click", async () => {
      botonConfirmar.disabled = true;
      botonConfirmar.textContent = t("admin.guardando");

      try {
        const res = await fetch(
          `${API_URL}/usuarios/${encodeURIComponent(usuario.correo)}`,
          {
            method: "DELETE",
          },
        );

        if (!res.ok) {
          let mensaje = t("admin.errorEliminarUsuario");

          try {
            const data = await res.json();

            if (data.error) {
              mensaje = data.error;
            }
          } catch {
            // Respuesta no JSON
          }

          errorModal.textContent = mensaje;

          botonConfirmar.disabled = false;
          botonConfirmar.innerHTML = `
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
            ${t("admin.eliminar")}
          `;

          return;
        }

        cerrar();
        refrescarUsuarios();
      } catch (error) {
        console.error("Error al eliminar usuario:", error);

        errorModal.textContent = t("perfil.msg.sinServidor");

        botonConfirmar.disabled = false;
        botonConfirmar.innerHTML = `
          <i class="fa-solid fa-trash" aria-hidden="true"></i>
          ${t("admin.eliminar")}
        `;
      }
    });
  }

  const botonCrearUsuario =
    contenido.querySelector<HTMLButtonElement>("#botonCrearUsuario");

  if (botonCrearUsuario) {
    botonCrearUsuario.addEventListener("click", () => abrirModalUsuario(null));
  }

  contenido.querySelectorAll<HTMLButtonElement>("[data-editar]").forEach((boton) => {
    boton.addEventListener("click", () => {
      const correo = decodeURIComponent(boton.dataset.editar ?? "");
      const usuario = usuarios.find((u) => u.correo === correo);

      if (usuario) {
        abrirModalUsuario(usuario as UsuarioFila);
      }
    });
  });

  contenido.querySelectorAll<HTMLButtonElement>("[data-eliminar]").forEach((boton) => {
    boton.addEventListener("click", () => {
      const correo = decodeURIComponent(boton.dataset.eliminar ?? "");
      const usuario = usuarios.find((u) => u.correo === correo);

      if (usuario) {
        abrirConfirmarEliminar(usuario as UsuarioFila);
      }
    });
  });

  // ==========================================================
  // CRUD DE CLASES: crear / editar / eliminar
  // ==========================================================

  // Quien puede ser docente de una clase: docentes y administración.
  const candidatosDocente = usuarios.filter(
    (u) => u.rol === "docente" || u.rol === "admin",
  );

  function opcionesDocente(sel: string): string {
    if (candidatosDocente.length === 0) {
      return `<option value="" disabled selected>${t("admin.sinDocentes")}</option>`;
    }
    return candidatosDocente
      .map(
        (d) => `
          <option value="${escaparAtributo(d.correo)}" ${d.correo === sel ? "selected" : ""}>
            ${escaparAtributo(d.nombreCompleto)} (${escaparAtributo(d.correo)})
          </option>
        `,
      )
      .join("");
  }

  function abrirModalClase(clase: ClaseAdmin | null): void {
    const esEdicion = clase !== null;

    const modal = document.createElement("div");
    modal.className = "dash-modal-fondo";

    modal.innerHTML = `
      <div
        class="dash-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tituloModalClaseAdmin"
      >

        <button
          type="button"
          class="dash-modal-cerrar"
          data-cerrar
          aria-label="${t("comun.cerrar")}"
          title="${t("comun.cerrar")}"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>

        <h3 id="tituloModalClaseAdmin">
          ${esEdicion ? t("admin.editarClaseTitulo") : t("admin.crearClase")}
        </h3>

        <p>
          ${esEdicion ? t("admin.editarClaseTexto") : t("admin.crearTexto")}
        </p>

        <label class="dash-modal-etiqueta" for="campoMateriaClaseAdmin">
          ${t("perfil.materia")}
        </label>

        <input
          class="dash-input-codigo dash-input-texto"
          id="campoMateriaClaseAdmin"
          value="${esEdicion ? escaparAtributo(clase.materia) : ""}"
        />

        <label class="dash-modal-etiqueta" for="campoCodigoClaseAdmin">
          ${t("admin.campoCodigo")}
        </label>

        <input
          class="dash-input-codigo dash-input-texto"
          id="campoCodigoClaseAdmin"
          value="${esEdicion ? escaparAtributo(clase.codigo) : ""}"
          ${esEdicion ? "disabled" : ""}
        />

        <label class="dash-modal-etiqueta" for="campoDocenteClaseAdmin">
          ${t("admin.campoDocente")}
        </label>

        <select class="dash-select-rol" id="campoDocenteClaseAdmin">
          ${opcionesDocente(esEdicion ? clase.correoDocente : candidatosDocente[0]?.correo ?? "")}
        </select>

        <p
          class="dash-error"
          id="errorModalClaseAdmin"
        ></p>

        <button
          class="dash-boton-principal"
          id="botonConfirmarClaseAdmin"
        >
          ${t("admin.guardarUsuario")}
        </button>

        <button
          type="button"
          class="dash-boton-secundario"
          data-cerrar
        >
          ${t("comun.cancelar")}
        </button>

      </div>
    `;

    document.body.appendChild(modal);

    function cerrar(): void {
      quitarTecla();
      modal.remove();
    }

    const quitarTecla = cerrarConEsc(cerrar);

    modal.querySelectorAll<HTMLElement>("[data-cerrar]").forEach((boton) => {
      boton.addEventListener("click", cerrar);
    });

    modal.addEventListener("click", (evento) => {
      if (evento.target === modal) cerrar();
    });

    const campoMateria =
      modal.querySelector<HTMLInputElement>("#campoMateriaClaseAdmin")!;
    const campoCodigo =
      modal.querySelector<HTMLInputElement>("#campoCodigoClaseAdmin")!;
    const campoDocente =
      modal.querySelector<HTMLSelectElement>("#campoDocenteClaseAdmin")!;
    const errorModal =
      modal.querySelector<HTMLParagraphElement>("#errorModalClaseAdmin")!;
    const botonConfirmar =
      modal.querySelector<HTMLButtonElement>("#botonConfirmarClaseAdmin")!;

    botonConfirmar.addEventListener("click", async () => {
      const materia = campoMateria.value.trim();
      const codigo = campoCodigo.value.trim().toUpperCase();
      const correoDocente = campoDocente.value;

      errorModal.textContent = "";

      if (materia.length < 3) {
        errorModal.textContent = t("admin.errorMateria");
        return;
      }

      if (!esEdicion) {
        if (codigo && !/^[A-Z0-9-]{2,20}$/.test(codigo)) {
          errorModal.textContent = t("admin.errorCodigo");
          return;
        }
      }

      if (!correoDocente) {
        errorModal.textContent = t("admin.errorDocente");
        return;
      }

      const docente = candidatosDocente.find((d) => d.correo === correoDocente);
      if (!docente) {
        errorModal.textContent = t("admin.errorDocente");
        return;
      }

      botonConfirmar.disabled = true;
      botonConfirmar.textContent = t("admin.guardando");

      try {
        const res = await fetch(
          esEdicion
            ? `${API_URL}/clases/${encodeURIComponent(clase.codigo)}`
            : `${API_URL}/clases`,
          {
            method: esEdicion ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(esEdicion ? {} : { codigo: codigo || generarCodigo(materia) }),
              materia,
              correoDocente: docente.correo,
              nombreDocente: docente.nombreCompleto,
            }),
          },
        );

        if (!res.ok) {
          let mensaje = esEdicion
            ? t("admin.errorActualizarClase")
            : t("admin.errorCrearClase");

          try {
            const data = await res.json();
            if (data.error) mensaje = data.error;
          } catch {
            // Respuesta no JSON
          }

          errorModal.textContent = mensaje;

          botonConfirmar.disabled = false;
          botonConfirmar.textContent = t("admin.guardarUsuario");

          return;
        }

        cerrar();
        refrescarUsuarios();
      } catch (error) {
        console.error(
          esEdicion ? "Error al editar clase:" : "Error al crear clase:",
          error,
        );

        errorModal.textContent = t("perfil.msg.sinServidor");

        botonConfirmar.disabled = false;
        botonConfirmar.textContent = t("admin.guardarUsuario");
      }
    });

    campoMateria.focus();
  }

  function generarCodigo(materia: string): string {
    const prefijo = materia.substring(0, 3).toUpperCase();
    const numAzar = Math.floor(100 + Math.random() * 900);
    return `${prefijo}-${numAzar}`;
  }

  function abrirConfirmarEliminarClase(clase: ClaseAdmin): void {
    const modal = document.createElement("div");
    modal.className = "dash-modal-fondo";

    modal.innerHTML = `
      <div
        class="dash-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tituloModalEliminarClase"
      >

        <button
          type="button"
          class="dash-modal-cerrar"
          data-cerrar
          aria-label="${t("comun.cerrar")}"
          title="${t("comun.cerrar")}"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>

        <h3 id="tituloModalEliminarClase">
          ${t("admin.confirmarEliminarClaseTitulo")}
        </h3>

        <p>
          ${t("admin.confirmarEliminarClase", { nombre: `${clase.materia} (${clase.codigo})` })}
        </p>

        <p
          class="dash-error"
          id="errorModalEliminarClase"
        ></p>

        <button
          class="dash-boton-peligro-solido"
          id="botonConfirmarEliminarClase"
        >
          <i class="fa-solid fa-trash" aria-hidden="true"></i>
          ${t("admin.eliminar")}
        </button>

        <button
          type="button"
          class="dash-boton-secundario"
          data-cerrar
        >
          ${t("admin.no")}
        </button>

      </div>
    `;

    document.body.appendChild(modal);

    function cerrar(): void {
      quitarTecla();
      modal.remove();
    }

    const quitarTecla = cerrarConEsc(cerrar);

    modal.querySelectorAll<HTMLElement>("[data-cerrar]").forEach((boton) => {
      boton.addEventListener("click", cerrar);
    });

    modal.addEventListener("click", (evento) => {
      if (evento.target === modal) cerrar();
    });

    const errorModal =
      modal.querySelector<HTMLParagraphElement>("#errorModalEliminarClase")!;
    const botonConfirmar =
      modal.querySelector<HTMLButtonElement>("#botonConfirmarEliminarClase")!;

    botonConfirmar.addEventListener("click", async () => {
      botonConfirmar.disabled = true;
      botonConfirmar.textContent = t("admin.guardando");

      try {
        const res = await fetch(
          `${API_URL}/clases/${encodeURIComponent(clase.codigo)}`,
          { method: "DELETE" },
        );

        if (!res.ok) {
          let mensaje = t("admin.errorEliminarClase");

          try {
            const data = await res.json();
            if (data.error) mensaje = data.error;
          } catch {
            // Respuesta no JSON
          }

          errorModal.textContent = mensaje;

          botonConfirmar.disabled = false;
          botonConfirmar.innerHTML = `
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
            ${t("admin.eliminar")}
          `;

          return;
        }

        cerrar();
        refrescarUsuarios();
      } catch (error) {
        console.error("Error al eliminar clase:", error);

        errorModal.textContent = t("perfil.msg.sinServidor");

        botonConfirmar.disabled = false;
        botonConfirmar.innerHTML = `
          <i class="fa-solid fa-trash" aria-hidden="true"></i>
          ${t("admin.eliminar")}
        `;
      }
    });
  }

  // ==========================================================
  // CRUD DE INSCRIPCIONES: crear / editar / eliminar
  // ==========================================================

  const candidatosEstudiante = usuarios.filter(
    (u) => u.rol === "estudiante" || u.rol === "invitado",
  );

  function opcionesEstudiante(sel: string): string {
    if (candidatosEstudiante.length === 0) {
      return `<option value="" disabled selected>${t("admin.sinEstudiantes")}</option>`;
    }
    return candidatosEstudiante
      .map(
        (e) => `
          <option value="${escaparAtributo(e.correo)}" ${e.correo === sel ? "selected" : ""}>
            ${escaparAtributo(e.nombreCompleto)} (${escaparAtributo(e.correo)})
          </option>
        `,
      )
      .join("");
  }

  function opcionesClase(sel: string): string {
    if (clases.length === 0) {
      return `<option value="" disabled selected>${t("admin.sinClasesOpciones")}</option>`;
    }
    return clases
      .map(
        (c) => `
          <option value="${escaparAtributo(c.codigo)}" ${c.codigo === sel ? "selected" : ""}>
            ${escaparAtributo(c.materia)} (${escaparAtributo(c.codigo)})
          </option>
        `,
      )
      .join("");
  }

  function abrirModalInscripcion(inscripcion: InscripcionAdmin | null): void {
    const esEdicion = inscripcion !== null;

    const modal = document.createElement("div");
    modal.className = "dash-modal-fondo";

    modal.innerHTML = `
      <div
        class="dash-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tituloModalInscripcionAdmin"
      >

        <button
          type="button"
          class="dash-modal-cerrar"
          data-cerrar
          aria-label="${t("comun.cerrar")}"
          title="${t("comun.cerrar")}"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>

        <h3 id="tituloModalInscripcionAdmin">
          ${esEdicion ? t("admin.editarInscripcionTitulo") : t("admin.inscribirTitulo")}
        </h3>

        <p>
          ${esEdicion ? t("admin.editarInscripcionTexto") : t("admin.inscribirTexto")}
        </p>

        ${
          esEdicion
            ? `
              <label class="dash-modal-etiqueta" for="campoEstudianteInscripcion">
                ${t("admin.campoEstudiante")}
              </label>

              <input
                class="dash-input-codigo dash-input-texto"
                id="campoEstudianteInscripcion"
                value="${escaparAtributo(inscripcion.nombreEstudiante)} (${escaparAtributo(inscripcion.correoEstudiante)})"
                disabled
              />
            `
            : `
              <label class="dash-modal-etiqueta" for="campoEstudianteInscripcion">
                ${t("admin.campoEstudiante")}
              </label>

              <select class="dash-select-rol" id="campoEstudianteInscripcion">
                ${opcionesEstudiante("")}
              </select>
            `
        }

        <label class="dash-modal-etiqueta" for="campoClaseInscripcion">
          ${t("admin.campoClase")}
        </label>

        <select class="dash-select-rol" id="campoClaseInscripcion">
          ${opcionesClase(esEdicion ? inscripcion.codigo : "")}
        </select>

        <p
          class="dash-error"
          id="errorModalInscripcionAdmin"
        ></p>

        <button
          class="dash-boton-principal"
          id="botonConfirmarInscripcionAdmin"
        >
          ${t("admin.guardarUsuario")}
        </button>

        <button
          type="button"
          class="dash-boton-secundario"
          data-cerrar
        >
          ${t("comun.cancelar")}
        </button>

      </div>
    `;

    document.body.appendChild(modal);

    function cerrar(): void {
      quitarTecla();
      modal.remove();
    }

    const quitarTecla = cerrarConEsc(cerrar);

    modal.querySelectorAll<HTMLElement>("[data-cerrar]").forEach((boton) => {
      boton.addEventListener("click", cerrar);
    });

    modal.addEventListener("click", (evento) => {
      if (evento.target === modal) cerrar();
    });

    const campoEstudiante =
      modal.querySelector<HTMLSelectElement>("#campoEstudianteInscripcion")!;
    const campoClase =
      modal.querySelector<HTMLSelectElement>("#campoClaseInscripcion")!;
    const errorModal =
      modal.querySelector<HTMLParagraphElement>("#errorModalInscripcionAdmin")!;
    const botonConfirmar =
      modal.querySelector<HTMLButtonElement>("#botonConfirmarInscripcionAdmin")!;

    botonConfirmar.addEventListener("click", async () => {
      const codigoClase = campoClase.value;

      errorModal.textContent = "";

      if (!codigoClase) {
        errorModal.textContent = t("admin.errorClaseSel");
        return;
      }

      if (!esEdicion && !campoEstudiante.value) {
        errorModal.textContent = t("admin.errorEstudiante");
        return;
      }

      botonConfirmar.disabled = true;
      botonConfirmar.textContent = t("admin.guardando");

      try {
        const res = await fetch(
          esEdicion
            ? `${API_URL}/inscripciones/${inscripcion.id}`
            : `${API_URL}/inscripciones`,
          {
            method: esEdicion ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(esEdicion
                ? { codigoClase }
                : { correoEstudiante: campoEstudiante.value, codigoClase }),
            }),
          },
        );

        if (!res.ok) {
          let mensaje = esEdicion
            ? t("admin.errorActualizarInscripcion")
            : t("admin.errorCrearInscripcion");

          try {
            const data = await res.json();
            if (data.error) mensaje = data.error;
          } catch {
            // Respuesta no JSON
          }

          errorModal.textContent = mensaje;

          botonConfirmar.disabled = false;
          botonConfirmar.textContent = t("admin.guardarUsuario");

          return;
        }

        cerrar();
        refrescarUsuarios();
      } catch (error) {
        console.error(
          esEdicion ? "Error al editar inscripción:" : "Error al inscribir:",
          error,
        );

        errorModal.textContent = t("perfil.msg.sinServidor");

        botonConfirmar.disabled = false;
        botonConfirmar.textContent = t("admin.guardarUsuario");
      }
    });
  }

  function abrirConfirmarEliminarInscripcion(inscripcion: InscripcionAdmin): void {
    const modal = document.createElement("div");
    modal.className = "dash-modal-fondo";

    modal.innerHTML = `
      <div
        class="dash-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tituloModalEliminarInscripcion"
      >

        <button
          type="button"
          class="dash-modal-cerrar"
          data-cerrar
          aria-label="${t("comun.cerrar")}"
          title="${t("comun.cerrar")}"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>

        <h3 id="tituloModalEliminarInscripcion">
          ${t("admin.confirmarEliminarInscripcionTitulo")}
        </h3>

        <p>
          ${t("admin.confirmarEliminarInscripcion", { nombre: inscripcion.nombreEstudiante })}
        </p>

        <p
          class="dash-error"
          id="errorModalEliminarInscripcion"
        ></p>

        <button
          class="dash-boton-peligro-solido"
          id="botonConfirmarEliminarInscripcion"
        >
          <i class="fa-solid fa-trash" aria-hidden="true"></i>
          ${t("admin.eliminar")}
        </button>

        <button
          type="button"
          class="dash-boton-secundario"
          data-cerrar
        >
          ${t("admin.no")}
        </button>

      </div>
    `;

    document.body.appendChild(modal);

    function cerrar(): void {
      quitarTecla();
      modal.remove();
    }

    const quitarTecla = cerrarConEsc(cerrar);

    modal.querySelectorAll<HTMLElement>("[data-cerrar]").forEach((boton) => {
      boton.addEventListener("click", cerrar);
    });

    modal.addEventListener("click", (evento) => {
      if (evento.target === modal) cerrar();
    });

    const errorModal =
      modal.querySelector<HTMLParagraphElement>("#errorModalEliminarInscripcion")!;
    const botonConfirmar =
      modal.querySelector<HTMLButtonElement>("#botonConfirmarEliminarInscripcion")!;

    botonConfirmar.addEventListener("click", async () => {
      botonConfirmar.disabled = true;
      botonConfirmar.textContent = t("admin.guardando");

      try {
        const res = await fetch(
          `${API_URL}/inscripciones/${inscripcion.id}`,
          { method: "DELETE" },
        );

        if (!res.ok) {
          let mensaje = t("admin.errorEliminarInscripcion");

          try {
            const data = await res.json();
            if (data.error) mensaje = data.error;
          } catch {
            // Respuesta no JSON
          }

          errorModal.textContent = mensaje;

          botonConfirmar.disabled = false;
          botonConfirmar.innerHTML = `
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
            ${t("admin.eliminar")}
          `;

          return;
        }

        cerrar();
        refrescarUsuarios();
      } catch (error) {
        console.error("Error al eliminar inscripción:", error);

        errorModal.textContent = t("perfil.msg.sinServidor");

        botonConfirmar.disabled = false;
        botonConfirmar.innerHTML = `
          <i class="fa-solid fa-trash" aria-hidden="true"></i>
          ${t("admin.eliminar")}
        `;
      }
    });
  }

  // --------------------------------------------------------
  // CABLEADO de los botones de las dos secciones
  // --------------------------------------------------------

  contenido
    .querySelector<HTMLButtonElement>("#botonCrearClase")
    ?.addEventListener("click", () => abrirModalClase(null));

  contenido
    .querySelectorAll<HTMLButtonElement>("[data-editar-clase]")
    .forEach((boton) => {
      boton.addEventListener("click", () => {
        const codigo = decodeURIComponent(boton.dataset.editarClase ?? "");
        const clase = clases.find((c) => c.codigo === codigo);
        if (clase) abrirModalClase(clase);
      });
    });

  contenido
    .querySelectorAll<HTMLButtonElement>("[data-eliminar-clase]")
    .forEach((boton) => {
      boton.addEventListener("click", () => {
        const codigo = decodeURIComponent(boton.dataset.eliminarClase ?? "");
        const clase = clases.find((c) => c.codigo === codigo);
        if (clase) abrirConfirmarEliminarClase(clase);
      });
    });

  contenido
    .querySelector<HTMLButtonElement>("#botonCrearInscripcion")
    ?.addEventListener("click", () => abrirModalInscripcion(null));

  contenido
    .querySelectorAll<HTMLButtonElement>("[data-editar-inscripcion]")
    .forEach((boton) => {
      boton.addEventListener("click", () => {
        const id = Number(boton.dataset.editarInscripcion);
        const inscripcion = inscripciones.find((i) => i.id === id);
        if (inscripcion) abrirModalInscripcion(inscripcion);
      });
    });

  contenido
    .querySelectorAll<HTMLButtonElement>("[data-eliminar-inscripcion]")
    .forEach((boton) => {
      boton.addEventListener("click", () => {
        const id = Number(boton.dataset.eliminarInscripcion);
        const inscripcion = inscripciones.find((i) => i.id === id);
        if (inscripcion) abrirConfirmarEliminarInscripcion(inscripcion);
      });
    });
}