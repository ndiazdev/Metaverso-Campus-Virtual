import { cerrarSesion, guardarSesion, obtenerToken } from "../../state/estado";
import type { Cuenta, Rol } from "../../state/estado";

import { API_URL } from "../../api/cliente";

import "@fortawesome/fontawesome-free/css/all.min.css";

import { LOGO_URL, inyectarEstilosDashboard } from "./dashboardEstilos";
import {
  actualizarPreferencia,
  inyectarTema,
  leerPreferencias,
} from "../../state/preferencias";
import type { Idioma, Preferencias, Tema } from "../../state/preferencias";
import { locale, t } from "../../state/idioma";

/** Nombre del rol en mayúsculas, en el idioma elegido. */
export function etiquetaRol(rol: Rol): string {
  return t(`rol.${rol}`);
}

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

/**
 * Imagen de la cuenta: la foto propia si existe, o si no la
 * imagen genérica del rol.
 */
export function avatarDe(cuenta: Cuenta): string {
  return cuenta.foto || IMAGENES_ROL[cuenta.rol];
}

/** Escapa comillas y símbolos antes de meter texto en el HTML. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Fecha corta para las tarjetas de clase: "12 sept".
 * Devuelve cadena vacía cuando no hay fecha válida.
 */
export function fechaCorta(valor?: string | null): string {
  if (!valor) {
    return "";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "";
  }

  return fecha.toLocaleDateString(locale(), {
    day: "2-digit",
    month: "short",
  });
}

export type TabDashboard = "clases" | "usuarios" | "perfil" | "ajustes";

export interface DashboardComunOpciones {
  cuenta: Cuenta & { id?: number };

  alMostrarClases: () => void;

  alMostrarUsuarios?: () => void;

  alCerrar?: () => void;

  /**
   * Qué sección del sidebar debe verse activa al abrir el
   * dashboard. Por defecto "clases". El admin usa
   * "usuarios" para aterrizar en el panel de gestión.
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
// PLANTILLA DE UNA SECCIÓN DEL SIDEBAR
// ============================================================

function plantillaSeccion(
  valor: TabDashboard,
  icono: string,
  texto: string,
  activa: boolean,
): string {
  return `
    <button
      class="dash-nav-item ${activa ? "activo" : ""}"
      data-tab="${valor}"
      type="button"
    >
      <i class="dash-nav-icono fa-solid ${icono}"></i>
      <span>${texto}</span>
    </button>
  `;
}

// ============================================================
// CREAR DASHBOARD COMÚN
// ============================================================

export function crearDashboardComun(
  opciones: DashboardComunOpciones,
): DashboardComun {
  const { cuenta, alMostrarClases, alMostrarUsuarios, alCerrar } = opciones;

  const pestanaInicial: TabDashboard = opciones.pestanaInicial ?? "clases";

  // ----------------------------------------------------------
  // Inyectar estilos
  // ----------------------------------------------------------

  inyectarTema();
  inyectarEstilosDashboard();

  // ----------------------------------------------------------
  // Crear overlay principal
  // ----------------------------------------------------------

  const overlay = document.createElement("div");

  overlay.className = "dash-overlay";

  const esAdmin = cuenta.rol === "admin";

  // ----------------------------------------------------------
  // SIDEBAR + ZONA PRINCIPAL
  // ----------------------------------------------------------

  overlay.innerHTML = `
    <aside class="dash-sidebar">

      <div class="dash-marca">
        <img
          class="dash-marca-logo"
          src="${LOGO_URL}"
          alt="${t("comun.universidad")}"
        />
      </div>

      <p class="dash-nav-etiqueta">${t("comun.secciones")}</p>

      <nav class="dash-nav">
        ${
          esAdmin
            ? plantillaSeccion(
                "usuarios",
                "fa-users",
                t("comun.nav.usuarios"),
                pestanaInicial === "usuarios",
              )
            : ""
        }

        ${plantillaSeccion(
          "clases",
          "fa-graduation-cap",
          t("comun.nav.clases"),
          pestanaInicial === "clases",
        )}

        ${plantillaSeccion(
          "perfil",
          "fa-user",
          t("comun.nav.perfil"),
          pestanaInicial === "perfil",
        )}

        ${plantillaSeccion(
          "ajustes",
          "fa-gear",
          t("comun.nav.ajustes"),
          pestanaInicial === "ajustes",
        )}
      </nav>

      <div class="dash-sidebar-pie">

        <div class="dash-cuenta">
          <img
            class="dash-cuenta-miniatura"
            src="${avatarDe(cuenta)}"
            alt="${t("comun.avatar")}"
          />

          <div class="dash-cuenta-bloque">
            <p class="dash-cuenta-nombre">${cuenta.nombreCompleto}</p>
            <p class="dash-cuenta-rol">${etiquetaRol(cuenta.rol)}</p>
          </div>
        </div>

        <button class="dash-salir" id="botonSalir" type="button">
          <i class="dash-nav-icono fa-solid fa-right-from-bracket"></i>
          <span>${t("comun.cerrarSesion")}</span>
        </button>

      </div>

    </aside>

    <main class="dash-principal">
      <div class="dash-contenido" id="contenidoDashboard"></div>
    </main>
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

  const tabs =
    overlay.querySelectorAll<HTMLButtonElement>(".dash-nav-item");

  const botonSalir =
    overlay.querySelector<HTMLButtonElement>("#botonSalir")!;

  // ==========================================================
  // ACTIVAR SECCIÓN
  // ==========================================================

  /**
   * Vuelve a escribir los textos del sidebar: se llama cuando
   * la persona cambia el idioma desde Ajustes.
   */
  function refrescarTextosSidebar(): void {
    const textos: Record<TabDashboard, string> = {
      clases: t("comun.nav.clases"),
      usuarios: t("comun.nav.usuarios"),
      perfil: t("comun.nav.perfil"),
      ajustes: t("comun.nav.ajustes"),
    };

    tabs.forEach((tab) => {
      const nombre = tab.dataset.tab as TabDashboard;
      const etiqueta = tab.querySelector("span");

      if (etiqueta && textos[nombre]) {
        etiqueta.textContent = textos[nombre];
      }
    });

    const rol = overlay.querySelector(".dash-cuenta-rol");

    if (rol) {
      rol.textContent = etiquetaRol(cuenta.rol);
    }
  }

  function activarTab(nombre: TabDashboard): void {
    tabs.forEach((tab) => {
      tab.classList.toggle("activo", tab.dataset.tab === nombre);
    });

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
  // EVENTOS DE LAS SECCIONES
  // ==========================================================

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activarTab(tab.dataset.tab as TabDashboard);
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

  // ==========================================================
  // UTILIDADES DEL PERFIL
  // ==========================================================

  function pintarMensaje(
    destino: HTMLElement | null,
    tipo: "ok" | "error",
    texto: string,
  ): void {
    if (!destino) {
      return;
    }

    destino.hidden = false;
    destino.className = `dash-perfil-mensaje ${tipo}`;
    destino.innerHTML = `<i class="fa-solid ${
      tipo === "ok" ? "fa-circle-check" : "fa-circle-exclamation"
    }"></i><span>${escapar(texto)}</span>`;
  }

  function limpiarMensaje(destino: HTMLElement | null): void {
    if (!destino) {
      return;
    }

    destino.hidden = true;
    destino.textContent = "";
  }

  function mensajeDe(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return t("perfil.msg.sinServidor");
  }

  /** Sincroniza sidebar y cabecera con la cuenta editada. */
  function refrescarCuenta(): void {
    const miniatura =
      overlay.querySelector<HTMLImageElement>(".dash-cuenta-miniatura");

    if (miniatura) {
      miniatura.src = avatarDe(cuenta);
    }

    const lateral = overlay.querySelector(".dash-cuenta-nombre");

    if (lateral) {
      lateral.textContent = cuenta.nombreCompleto;
    }

    const cabecera =
      contenido.querySelector<HTMLImageElement>(".dash-avatar-mini");

    if (cabecera) {
      cabecera.src = avatarDe(cuenta);
    }
  }

  async function guardarEnPerfil(
    seccion: "perfil" | "contrasena",
    cuerpo: Record<string, unknown>,
  ): Promise<{ mensaje?: string; cuenta?: Cuenta }> {
    const res = await fetch(
      `${API_URL}/usuarios/${encodeURIComponent(cuenta.correo)}/${seccion}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      },
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || t("perfil.msg.errorGuardar"));
    }

    return data;
  }

  /** Recorta la foto a un cuadrado de 320 px y la devuelve en base64. */
  function prepararFoto(archivo: File): Promise<string> {
    return new Promise((resolver, rechazar) => {
      const lector = new FileReader();

      lector.onerror = () => rechazar(new Error(t("perfil.msg.lectorImagen")));

      lector.onload = () => {
        const imagen = new Image();

        imagen.onerror = () =>
          rechazar(new Error(t("perfil.msg.sinImagen")));

        imagen.onload = () => {
          const lado = Math.min(imagen.naturalWidth, imagen.naturalHeight, 320);
          const lienzo = document.createElement("canvas");

          lienzo.width = lado;
          lienzo.height = lado;

          const contexto = lienzo.getContext("2d");

          if (!contexto) {
            rechazar(new Error(t("perfil.msg.sinNavegador")));
            return;
          }

          const origenX = (imagen.naturalWidth - lado) / 2;
          const origenY = (imagen.naturalHeight - lado) / 2;

          contexto.drawImage(
            imagen,
            origenX,
            origenY,
            lado,
            lado,
            0,
            0,
            lado,
            lado,
          );

          resolver(lienzo.toDataURL("image/jpeg", 0.82));
        };

        imagen.src = String(lector.result);
      };

      lector.readAsDataURL(archivo);
    });
  }

  // ==========================================================
  // PERFIL
  // ==========================================================

  function mostrarPerfil(): void {
    const nombre = cuenta.nombreCompleto || t("comun.usuario");
    const nombreSeguro = escapar(nombre);
    const correoSeguro = escapar(cuenta.correo);

    const claseRol = `rol-${
      cuenta.rol === "invitado" ? "estudiante" : cuenta.rol
    }`;

    const iconoRol =
      cuenta.rol === "admin"
        ? "fa-shield-halved"
        : cuenta.rol === "docente"
          ? "fa-chalkboard-user"
          : "fa-user-graduate";

    const esDocente = cuenta.rol === "docente";
    const conCampo =
      esDocente || cuenta.rol === "estudiante" || cuenta.rol === "invitado";

    const etiquetaCampo = esDocente ? t("perfil.materia") : t("perfil.carrera");
    const iconoCampo = esDocente ? "fa-book" : "fa-graduation-cap";
    const valorCampo = (esDocente ? cuenta.materia : cuenta.carrera) ?? "";

    contenido.innerHTML = `
      <div class="dash-cabecera">

        <div>
          <p class="dash-cabecera-etiqueta">${t("comun.nav.perfil")}</p>
          <h1 class="dash-cabecera-titulo">${nombreSeguro}</h1>
          <p class="dash-cabecera-subtitulo">${correoSeguro}</p>
        </div>

        <div class="dash-cabecera-acciones">
          <span class="dash-badge-rol ${claseRol}">
            <i class="fa-solid ${iconoRol}"></i>
            ${etiquetaRol(cuenta.rol)}
          </span>

          <img
            class="dash-avatar-mini"
            src="${avatarDe(cuenta)}"
            alt="${t("comun.avatar")}: ${nombreSeguro}"
          />
        </div>

      </div>

      <div class="dash-grid dash-grid-perfil">

        <div class="dash-card">

          <div class="dash-card-encabezado">
            <p class="dash-card-titulo">${t("perfil.fotoTitulo")}</p>
          </div>

          <div class="dash-perfil-avatar-marco">
            <img
              class="dash-perfil-avatar"
              id="perfilAvatar"
              src="${avatarDe(cuenta)}"
              alt="${t("perfil.altFoto")}"
            />

            <button
              class="dash-perfil-camara"
              id="botonCamara"
              type="button"
              aria-label="${t("perfil.ariaCambiarFoto")}"
            >
              <i class="fa-solid fa-camera"></i>
            </button>
          </div>

          <input
            id="archivoFoto"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
          />

          <div class="dash-perfil-botones">
            <button
              class="dash-boton-secundario"
              id="botonCambiarFoto"
              type="button"
            >
              <i class="fa-solid fa-upload"></i>
              <span>${cuenta.foto ? t("perfil.cambiarFoto") : t("perfil.subirFoto")}</span>
            </button>

            <button
              class="dash-boton-fantasma"
              id="botonQuitarFoto"
              type="button"
              ${cuenta.foto ? "" : "hidden"}
            >
              <i class="fa-solid fa-trash"></i>
              <span>${t("perfil.quitarFoto")}</span>
            </button>
          </div>

          <p class="dash-perfil-pista">${t("perfil.pistaFoto")}</p>

          <p class="dash-perfil-mensaje" id="mensajeFoto" hidden></p>
        </div>

        <div class="dash-card">

          <div class="dash-card-encabezado">
            <p class="dash-card-titulo">${t("perfil.infoTitulo")}</p>
            <span class="dash-badge-rol ${claseRol}">
              ${etiquetaRol(cuenta.rol)}
            </span>
          </div>

          <form class="dash-perfil-form" id="formPerfil">

            <div class="dash-perfil-campo">
              <label
                class="dash-perfil-campo-etiqueta"
                for="campoNombrePerfil"
              >
                <i class="fa-solid fa-id-badge"></i>
                ${t("perfil.nombre")}
              </label>

              <input
                class="dash-perfil-input"
                id="campoNombrePerfil"
                type="text"
                maxlength="120"
                value="${nombreSeguro}"
              />
            </div>

            <div class="dash-perfil-form-dos">
              <div class="dash-perfil-campo">
                <label
                  class="dash-perfil-campo-etiqueta"
                  for="campoCorreoPerfil"
                >
                  <i class="fa-solid fa-envelope"></i>
                  ${t("perfil.correo")}
                </label>

                <input
                  class="dash-perfil-input"
                  id="campoCorreoPerfil"
                  type="email"
                  value="${correoSeguro}"
                  readonly
                />
              </div>

              <div class="dash-perfil-campo">
                <label class="dash-perfil-campo-etiqueta" for="campoRolPerfil">
                  <i class="fa-solid fa-user-tag"></i>
                  ${t("perfil.rol")}
                </label>

                <input
                  class="dash-perfil-input"
                  id="campoRolPerfil"
                  type="text"
                  value="${etiquetaRol(cuenta.rol)}"
                  readonly
                />
              </div>
            </div>

            ${
              conCampo
                ? `
              <div class="dash-perfil-campo">
                <label
                  class="dash-perfil-campo-etiqueta"
                  for="campoExtraPerfil"
                >
                  <i class="fa-solid ${iconoCampo}"></i>
                  ${etiquetaCampo}
                </label>

                <input
                  class="dash-perfil-input"
                  id="campoExtraPerfil"
                  type="text"
                  maxlength="120"
                  value="${escapar(valorCampo)}"
                  placeholder="${esDocente ? t("perfil.sinMateria") : t("perfil.sinCarrera")}"
                />
              </div>`
                : ""
            }

            <div class="dash-perfil-fila">
              <span class="dash-perfil-etiqueta">
                <i class="fa-solid fa-building-columns"></i>
                ${t("perfil.institucion")}
              </span>
              <span class="dash-perfil-valor">
                ${t("perfil.institucionValor")}
              </span>
            </div>

            <p class="dash-perfil-mensaje" id="mensajePerfil" hidden></p>

            <button
              class="dash-boton-principal"
              id="botonGuardarPerfil"
              type="submit"
            >
              <i class="fa-solid fa-floppy-disk"></i>
              <span>${t("perfil.guardarCambios")}</span>
            </button>
          </form>
        </div>

        <div class="dash-card dash-perfil-seguridad">

          <div class="dash-card-encabezado">
            <p class="dash-card-titulo">
              <i class="fa-solid fa-lock"></i>
              ${t("perfil.contrasenaTitulo")}
            </p>
            <span class="dash-perfil-etiqueta">${t("perfil.minimo6")}</span>
          </div>

          <form class="dash-perfil-form" id="formSeguridad">

            <div class="dash-perfil-form-dos">
              <div class="dash-perfil-campo">
                <label
                  class="dash-perfil-campo-etiqueta"
                  for="campoContrasenaActual"
                >
                  <i class="fa-solid fa-key"></i>
                  ${t("perfil.contrasenaActual")}
                </label>

                <div class="dash-perfil-campo-ojo">
                  <input
                    class="dash-perfil-input"
                    id="campoContrasenaActual"
                    type="password"
                    autocomplete="current-password"
                    placeholder="••••••••"
                  />
                  <button
                    class="dash-perfil-ojo"
                    type="button"
                    data-campo="campoContrasenaActual"
                    aria-label="${t("perfil.ariaVerContrasena")}"
                  >
                    <i class="fa-solid fa-eye"></i>
                  </button>
                </div>
              </div>

              <div class="dash-perfil-campo">
                <label
                  class="dash-perfil-campo-etiqueta"
                  for="campoContrasenaNueva"
                >
                  <i class="fa-solid fa-key"></i>
                  ${t("perfil.nuevaContrasena")}
                </label>

                <div class="dash-perfil-campo-ojo">
                  <input
                    class="dash-perfil-input"
                    id="campoContrasenaNueva"
                    type="password"
                    autocomplete="new-password"
                    placeholder="••••••••"
                  />
                  <button
                    class="dash-perfil-ojo"
                    type="button"
                    data-campo="campoContrasenaNueva"
                    aria-label="${t("perfil.ariaVerContrasena")}"
                  >
                    <i class="fa-solid fa-eye"></i>
                  </button>
                </div>
              </div>
            </div>

            <div class="dash-perfil-campo">
              <label
                class="dash-perfil-campo-etiqueta"
                for="campoContrasenaConfirmar"
              >
                <i class="fa-solid fa-key"></i>
                ${t("perfil.confirmarContrasena")}
              </label>

              <div class="dash-perfil-campo-ojo">
                <input
                  class="dash-perfil-input"
                  id="campoContrasenaConfirmar"
                  type="password"
                  autocomplete="new-password"
                  placeholder="••••••••"
                />
                <button
                  class="dash-perfil-ojo"
                  type="button"
                  data-campo="campoContrasenaConfirmar"
                  aria-label="${t("perfil.ariaVerContrasena")}"
                >
                  <i class="fa-solid fa-eye"></i>
                </button>
              </div>
            </div>

            <p class="dash-perfil-mensaje" id="mensajeSeguridad" hidden></p>

            <button
              class="dash-boton-principal"
              id="botonGuardarContrasena"
              type="submit"
            >
              <i class="fa-solid fa-shield-halved"></i>
              <span>${t("perfil.actualizarContrasena")}</span>
            </button>
          </form>
        </div>

      </div>
    `;

    conectarPerfil();
  }

  // ==========================================================
  // EVENTOS DEL PERFIL
  // ==========================================================

  function conectarPerfil(): void {
    const archivo = contenido.querySelector<HTMLInputElement>("#archivoFoto");
    const avatar = contenido.querySelector<HTMLImageElement>("#perfilAvatar");

    const botonSubir =
      contenido.querySelector<HTMLButtonElement>("#botonCambiarFoto");

    const botonQuitar =
      contenido.querySelector<HTMLButtonElement>("#botonQuitarFoto");

    const botonCamara =
      contenido.querySelector<HTMLButtonElement>("#botonCamara");

    const mensajeFoto = contenido.querySelector<HTMLElement>("#mensajeFoto");
    const mensajePerfil = contenido.querySelector<HTMLElement>("#mensajePerfil");

    const mensajeSeguridad = contenido.querySelector<HTMLElement>(
      "#mensajeSeguridad",
    );

    const formPerfil = contenido.querySelector<HTMLFormElement>("#formPerfil");
    const formSeguridad =
      contenido.querySelector<HTMLFormElement>("#formSeguridad");

    if (!archivo || !botonSubir || !formPerfil || !formSeguridad) {
      return;
    }

    const esDocente = cuenta.rol === "docente";

    // --------------------------------------------------------
    // OJOS DE LAS CONTRASEÑAS
    // --------------------------------------------------------

    contenido
      .querySelectorAll<HTMLButtonElement>(".dash-perfil-ojo")
      .forEach((ojo) => {
        ojo.addEventListener("click", () => {
          const campo = contenido.querySelector<HTMLInputElement>(
            `#${ojo.dataset.campo ?? ""}`,
          );

          if (!campo) {
            return;
          }

          const visible = campo.type === "text";

          campo.type = visible ? "password" : "text";

          ojo.innerHTML = `<i class="fa-solid ${
            visible ? "fa-eye" : "fa-eye-slash"
          }"></i>`;
        });
      });

    // --------------------------------------------------------
    // SUBIR FOTO
    // --------------------------------------------------------

    const abrirArchivo = () => archivo.click();

    botonSubir.addEventListener("click", abrirArchivo);
    botonCamara?.addEventListener("click", abrirArchivo);

    archivo.addEventListener("change", async () => {
      const seleccionado = archivo.files?.[0];

      archivo.value = "";

      if (!seleccionado) {
        return;
      }

      limpiarMensaje(mensajeFoto);

      if (!seleccionado.type.startsWith("image/")) {
        pintarMensaje(
          mensajeFoto,
          "error",
          t("perfil.msg.formatoImagen"),
        );

        return;
      }

      if (seleccionado.size > 5 * 1024 * 1024) {
        pintarMensaje(mensajeFoto, "error", t("perfil.msg.imagenPesada"));

        return;
      }

      botonSubir.disabled = true;

      try {
        const foto = await prepararFoto(seleccionado);
        const respuesta = await guardarEnPerfil("perfil", { foto });

        cuenta.foto = respuesta.cuenta?.foto ?? foto;

        if (avatar) {
          avatar.src = avatarDe(cuenta);
        }

        refrescarCuenta();

        if (botonQuitar) {
          botonQuitar.hidden = false;
        }

        botonSubir.innerHTML =
          `<i class="fa-solid fa-upload"></i><span>${t("perfil.cambiarFoto")}</span>`;

        pintarMensaje(mensajeFoto, "ok", t("perfil.msg.fotoActualizada"));
      } catch (error) {
        pintarMensaje(mensajeFoto, "error", mensajeDe(error));
      } finally {
        botonSubir.disabled = false;
      }
    });

    // --------------------------------------------------------
    // QUITAR FOTO
    // --------------------------------------------------------

    botonQuitar?.addEventListener("click", async () => {
      botonQuitar.disabled = true;

      limpiarMensaje(mensajeFoto);

      try {
        await guardarEnPerfil("perfil", { foto: null });

        delete cuenta.foto;

        if (avatar) {
          avatar.src = avatarDe(cuenta);
        }

        refrescarCuenta();

        botonQuitar.hidden = true;

        botonSubir.innerHTML =
          `<i class="fa-solid fa-upload"></i><span>${t("perfil.subirFoto")}</span>`;

        pintarMensaje(
          mensajeFoto,
          "ok",
          t("perfil.msg.fotoQuitada"),
        );
      } catch (error) {
        pintarMensaje(mensajeFoto, "error", mensajeDe(error));
      } finally {
        botonQuitar.disabled = false;
      }
    });

    // --------------------------------------------------------
    // GUARDAR DATOS
    // --------------------------------------------------------

    formPerfil.addEventListener("submit", async (evento) => {
      evento.preventDefault();

      limpiarMensaje(mensajePerfil);

      const campoNombre =
        contenido.querySelector<HTMLInputElement>("#campoNombrePerfil");

      const campoExtra =
        contenido.querySelector<HTMLInputElement>("#campoExtraPerfil");

      const botonGuardar =
        contenido.querySelector<HTMLButtonElement>("#botonGuardarPerfil");

      const nombreNuevo = campoNombre?.value.trim() ?? "";

      if (nombreNuevo.length < 3) {
        pintarMensaje(
          mensajePerfil,
          "error",
          t("perfil.msg.nombreCorto"),
        );

        return;
      }

      const cuerpo: Record<string, string | null> = {
        nombreCompleto: nombreNuevo,
      };

      if (campoExtra) {
        cuerpo[esDocente ? "materia" : "carrera"] =
          campoExtra.value.trim() || null;
      }

      if (botonGuardar) {
        botonGuardar.disabled = true;
        botonGuardar.innerHTML =
          `<i class="fa-solid fa-circle-notch fa-spin"></i><span>${t("perfil.msg.guardando")}</span>`;
      }

      try {
        await guardarEnPerfil("perfil", cuerpo);

        cuenta.nombreCompleto = nombreNuevo;

        if (campoExtra) {
          const valor = campoExtra.value.trim() || undefined;

          if (esDocente) {
            cuenta.materia = valor;
          } else {
            cuenta.carrera = valor;
          }
        }

        const titulo = contenido.querySelector(".dash-cabecera-titulo");

        if (titulo) {
          titulo.textContent = cuenta.nombreCompleto;
        }

        refrescarCuenta();
        guardarSesion(cuenta.correo, cuenta, obtenerToken() ?? undefined);

        pintarMensaje(mensajePerfil, "ok", t("perfil.msg.guardados"));
      } catch (error) {
        pintarMensaje(mensajePerfil, "error", mensajeDe(error));
      } finally {
        if (botonGuardar) {
          botonGuardar.disabled = false;
          botonGuardar.innerHTML =
            `<i class="fa-solid fa-floppy-disk"></i><span>${t("perfil.guardarCambios")}</span>`;
        }
      }
    });

    // --------------------------------------------------------
    // CAMBIAR CONTRASEÑA
    // --------------------------------------------------------

    formSeguridad.addEventListener("submit", async (evento) => {
      evento.preventDefault();

      limpiarMensaje(mensajeSeguridad);

      const actual =
        contenido.querySelector<HTMLInputElement>("#campoContrasenaActual");

      const nueva =
        contenido.querySelector<HTMLInputElement>("#campoContrasenaNueva");

      const confirmar = contenido.querySelector<HTMLInputElement>(
        "#campoContrasenaConfirmar",
      );

      const boton = contenido.querySelector<HTMLButtonElement>(
        "#botonGuardarContrasena",
      );

      const valorActual = actual?.value ?? "";
      const valorNueva = nueva?.value ?? "";
      const valorConfirmar = confirmar?.value ?? "";

      if (!valorActual) {
        pintarMensaje(
          mensajeSeguridad,
          "error",
          t("perfil.msg.actualRequerida"),
        );

        return;
      }

      if (valorNueva.length < 6) {
        pintarMensaje(
          mensajeSeguridad,
          "error",
          t("perfil.msg.nuevaCorta"),
        );

        return;
      }

      if (valorNueva !== valorConfirmar) {
        pintarMensaje(
          mensajeSeguridad,
          "error",
          t("perfil.msg.confirmacion"),
        );

        return;
      }

      if (valorNueva === valorActual) {
        pintarMensaje(
          mensajeSeguridad,
          "error",
          t("perfil.msg.nuevaDistinta"),
        );

        return;
      }

      if (boton) {
        boton.disabled = true;
        boton.innerHTML =
          `<i class="fa-solid fa-circle-notch fa-spin"></i><span>${t("perfil.msg.actualizando")}</span>`;
      }

      try {
        await guardarEnPerfil("contrasena", {
          contrasenaActual: valorActual,
          contrasenaNueva: valorNueva,
        });

        if (actual) actual.value = "";
        if (nueva) nueva.value = "";
        if (confirmar) confirmar.value = "";

        pintarMensaje(
          mensajeSeguridad,
          "ok",
          t("perfil.msg.contrasenaCambiada"),
        );
      } catch (error) {
        pintarMensaje(mensajeSeguridad, "error", mensajeDe(error));
      } finally {
        if (boton) {
          boton.disabled = false;
          boton.innerHTML =
            `<i class="fa-solid fa-shield-halved"></i><span>${t("perfil.actualizarContrasena")}</span>`;
        }
      }
    });
  }

  // ==========================================================
  // AJUSTES
  // ==========================================================

  function mostrarAjustes(): void {
    const actual = leerPreferencias();

    contenido.innerHTML = `
      <div class="dash-cabecera">

        <div>
          <p class="dash-cabecera-etiqueta">${t("ajustes.etiqueta")}</p>
          <h1 class="dash-cabecera-titulo">${t("ajustes.titulo")}</h1>
          <p class="dash-cabecera-subtitulo">${t("ajustes.subtitulo")}</p>
        </div>

      </div>

      <div class="dash-grid dash-grid-ajustes">

        <section class="dash-card dash-ajuste">

          <div class="dash-card-encabezado">
            <p class="dash-card-titulo">
              <i class="fa-solid fa-palette"></i>
              ${t("ajustes.apariencia")}
            </p>
          </div>

          <div class="dash-ajuste-fila">
            <div class="dash-ajuste-texto">
              <p class="dash-ajuste-titulo">${t("ajustes.tema")}</p>
              <p class="dash-ajuste-pista">${t("ajustes.pistaTema")}</p>
            </div>

            <div
              class="dash-segmentado"
              role="group"
              aria-label="${t("ajustes.tema")}"
            >
              <button
                class="dash-segmentado-opcion"
                type="button"
                data-ajuste="tema"
                data-valor="claro"
                aria-pressed="${actual.tema === "claro"}"
              >
                <i class="fa-solid fa-sun"></i>
                <span>${t("ajustes.temaClaro")}</span>
              </button>

              <button
                class="dash-segmentado-opcion"
                type="button"
                data-ajuste="tema"
                data-valor="oscuro"
                aria-pressed="${actual.tema === "oscuro"}"
              >
                <i class="fa-solid fa-moon"></i>
                <span>${t("ajustes.temaOscuro")}</span>
              </button>
            </div>
          </div>

          <div class="dash-ajuste-fila">
            <div class="dash-ajuste-texto">
              <p class="dash-ajuste-titulo">${t("ajustes.idioma")}</p>
              <p class="dash-ajuste-pista">${t("ajustes.pistaIdioma")}</p>
            </div>

            <div
              class="dash-segmentado"
              role="group"
              aria-label="${t("ajustes.idioma")}"
            >
              <button
                class="dash-segmentado-opcion"
                type="button"
                data-ajuste="idioma"
                data-valor="es"
                aria-pressed="${actual.idioma === "es"}"
              >
                <span>${t("ajustes.idiomaEs")}</span>
              </button>

              <button
                class="dash-segmentado-opcion"
                type="button"
                data-ajuste="idioma"
                data-valor="en"
                aria-pressed="${actual.idioma === "en"}"
              >
                <span>${t("ajustes.idiomaEn")}</span>
              </button>
            </div>
          </div>

        </section>

        <section class="dash-card dash-ajuste">

          <div class="dash-card-encabezado">
            <p class="dash-card-titulo">
              <i class="fa-solid fa-universal-access"></i>
              ${t("ajustes.accesibilidad")}
            </p>
          </div>

          <div class="dash-ajuste-fila">
            <div class="dash-ajuste-texto">
              <p class="dash-ajuste-titulo">${t("ajustes.reducirAnimaciones")}</p>
              <p class="dash-ajuste-pista">${t("ajustes.descAnimaciones")}</p>
            </div>

            <button
              class="dash-interruptor"
              type="button"
              role="switch"
              aria-checked="${actual.reducirMovimiento}"
              aria-label="${t("ajustes.reducirAnimaciones")}"
              data-ajuste="movimiento"
            >
              <span class="dash-interruptor-punto"></span>
            </button>
          </div>

          <p class="dash-ajuste-nota">${t("ajustes.pistaAnimaciones")}</p>

        </section>

        <section class="dash-card dash-ajuste">

          <div class="dash-card-encabezado">
            <p class="dash-card-titulo">
              <i class="fa-solid fa-sliders"></i>
              ${t("ajustes.general")}
            </p>
          </div>

          <div class="dash-ajuste-fila">
            <div class="dash-ajuste-texto">
              <p class="dash-ajuste-titulo">${t("ajustes.restablecer")}</p>
              <p class="dash-ajuste-pista">${t("ajustes.pistaRestablecer")}</p>
            </div>

            <button
              class="dash-boton-secundario"
              id="botonRestablecer"
              type="button"
            >
              <i class="fa-solid fa-arrow-rotate-left"></i>
              <span>${t("ajustes.restablecer")}</span>
            </button>
          </div>

          <p class="dash-perfil-mensaje" id="mensajeAjustes" hidden></p>

        </section>

      </div>
    `;

    conectarAjustes(actual);
  }

  /**
   * Guarda la preferencia, repinta Ajustes (para refrescar
   * aria-pressed y todos los textos) y renueva el sidebar.
   */
  function aplicarAjuste(cambios: Partial<Preferencias>): void {
    actualizarPreferencia(cambios);
    mostrarAjustes();
    refrescarTextosSidebar();
  }

  function conectarAjustes(actual: Preferencias): void {
    contenido
      .querySelectorAll<HTMLButtonElement>('[data-ajuste="tema"]')
      .forEach((boton) => {
        boton.addEventListener("click", () => {
          aplicarAjuste({ tema: boton.dataset.valor as Tema });
        });
      });

    contenido
      .querySelectorAll<HTMLButtonElement>('[data-ajuste="idioma"]')
      .forEach((boton) => {
        boton.addEventListener("click", () => {
          aplicarAjuste({ idioma: boton.dataset.valor as Idioma });
        });
      });

    const interruptor = contenido.querySelector<HTMLButtonElement>(
      '[data-ajuste="movimiento"]',
    );

    interruptor?.addEventListener("click", () => {
      aplicarAjuste({ reducirMovimiento: !actual.reducirMovimiento });
    });

    const restablecer = contenido.querySelector<HTMLButtonElement>(
      "#botonRestablecer",
    );

    restablecer?.addEventListener("click", () => {
      aplicarAjuste({
        tema: "claro",
        idioma: "es",
        reducirMovimiento: false,
      });

      pintarMensaje(
        contenido.querySelector<HTMLElement>("#mensajeAjustes"),
        "ok",
        t("ajustes.msg.restablecido"),
      );
    });
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