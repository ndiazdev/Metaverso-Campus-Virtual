// ============================================================
// BÚSQUEDA Y FILTROS DEL DASHBOARD
//
// Monta una barra con buscador + filtros por categoría sobre
// cualquier listado del dashboard (clases, usuarios, tablas).
//
// Los elementos a filtrar se localizan por:
// - data-buscar: texto por el que se busca (materia, nombre...)
// - data-grupo: categoría del filtro (admin, docente...)
//
// El estilo de la barra vive en dashboardEstilos.ts
// ============================================================

import { t } from "../../state/idioma";

export interface FiltroDashboard {
  valor: string;
  etiqueta: string;
}

export interface OpcionesFiltros {
  /** Elementos que se van a ocultar o mostrar. */
  items: HTMLElement[];

  /** Contenedor donde se inserta la barra. */
  destino: HTMLElement;

  /**
   * Dónde se coloca el mensaje "sin resultados".
   * Por defecto, el mismo `destino`.
   */
  ubicacionVacio?: HTMLElement;

  /** Texto de ayuda del buscador. */
  placeholder: string;

  /** Categorías del filtro. "todos" no filtra. */
  filtros?: FiltroDashboard[];

  /** Sustantivo del contador: "clases", "usuarios"... */
  etiquetaConteo?: string;
}

/**
 * Quita tildes y pasa a minúsculas para que la búsqueda
 * funcione con y sin acentos.
 */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function montarFiltros(opciones: OpcionesFiltros): void {
  const {
    items,
    destino,
    ubicacionVacio,
    placeholder,
    filtros = [],
    etiquetaConteo = t("filtros.resultados"),
  } = opciones;

  if (!destino || items.length === 0) {
    return;
  }

  // ----------------------------------------------------------
  // BARRA
  // ----------------------------------------------------------

  const barra = document.createElement("div");

  barra.className = "dash-barra";

  barra.innerHTML = `
    <div class="dash-buscador">
      <input
        type="search"
        class="dash-buscador-input"
        placeholder="${placeholder}"
        aria-label="${placeholder}"
      />
    </div>

    ${
      filtros.length > 0
        ? `
          <div class="dash-chips">
            ${filtros
              .map(
                (filtro) => `
                  <button
                    type="button"
                    class="dash-chip ${filtro.valor === "todos" ? "activo" : ""}"
                    data-valor="${filtro.valor}"
                  >
                    ${filtro.etiqueta}
                  </button>
                `,
              )
              .join("")}
          </div>
        `
        : ""
    }

    <span class="dash-conteo"></span>
  `;

  destino.insertBefore(barra, destino.firstChild);

  const campoBusqueda = barra.querySelector<HTMLInputElement>(
    ".dash-buscador-input",
  )!;

  const contador = barra.querySelector<HTMLSpanElement>(".dash-conteo")!;

  const botonesFiltro = Array.from(
    barra.querySelectorAll<HTMLButtonElement>(".dash-chip"),
  );

  // ----------------------------------------------------------
  // ESTADO VACÍO (cuando el filtro no deja nada)
  // ----------------------------------------------------------

  const sinCoincidencias = document.createElement("p");

  sinCoincidencias.className = "dash-vacio";
  sinCoincidencias.textContent = t("filtros.vacio");

  sinCoincidencias.hidden = true;

  (ubicacionVacio ?? destino).appendChild(sinCoincidencias);

  // ----------------------------------------------------------
  // ESTADO DEL FILTRADO
  // ----------------------------------------------------------

  let busqueda = "";
  let categoria = filtros.some((f) => f.valor === "todos")
    ? "todos"
    : "";

  function refrescar(): void {
    const termino = normalizar(busqueda);

    let visibles = 0;

    items.forEach((item) => {
      const coincideBusqueda =
        termino.length === 0 ||
        normalizar(item.dataset.buscar ?? "").includes(termino);

      const coincideCategoria =
        categoria.length === 0 ||
        categoria === "todos" ||
        item.dataset.grupo === categoria;

      const visible = coincideBusqueda && coincideCategoria;

      item.hidden = !visible;

      if (visible) {
        visibles++;
      }
    });

    const hayFiltro = termino.length > 0 || categoria.length > 0;

    contador.textContent = hayFiltro
      ? t("filtros.conteo", {
          visibles,
          total: items.length,
          etiqueta: etiquetaConteo,
        })
      : `${items.length} ${etiquetaConteo}`;

    sinCoincidencias.hidden = visibles > 0;
  }

  // ----------------------------------------------------------
  // EVENTOS
  // ----------------------------------------------------------

  campoBusqueda.addEventListener("input", () => {
    busqueda = campoBusqueda.value;
    refrescar();
  });

  botonesFiltro.forEach((boton) => {
    boton.addEventListener("click", () => {
      categoria = boton.dataset.valor ?? "";

      botonesFiltro.forEach((otro) => {
        otro.classList.toggle("activo", otro === boton);
      });

      refrescar();
    });
  });

  refrescar();
}

/**
 * Monta el buscador de la lista de clases de una vista de rol.
 *
 * Espera en el DOM:
 * - #herramientasClases: donde se inserta el buscador
 * - #listaClases: contenedor de las .dash-tarjeta-clase
 */
export function montarFiltrosClases(
  contenido: HTMLElement,
  placeholder: string,
): void {
  const destino =
    contenido.querySelector<HTMLElement>("#herramientasClases");
  const lista = contenido.querySelector<HTMLElement>("#listaClases");

  if (!destino || !lista) {
    return;
  }

  montarFiltros({
    destino,
    ubicacionVacio: lista,
    items: Array.from(
      lista.querySelectorAll<HTMLElement>(".dash-tarjeta-clase"),
    ),
    placeholder,
    etiquetaConteo: t("filtros.clases"),
  });
}

/**
 * Monta el buscador de una tabla del panel de administración.
 *
 * Espera en el DOM:
 * - destino: selector del contenedor del buscador (cabecera)
 * - tabla: selector de la .dash-tabla-envoltura con las filas
 */
export function montarTabla(
  contenido: HTMLElement,
  opciones: {
    destino: string;
    tabla: string;
    placeholder: string;
    etiquetaConteo: string;
  },
): void {
  const barra = contenido.querySelector<HTMLElement>(
    opciones.destino,
  );
  const envoltura = contenido.querySelector<HTMLElement>(
    opciones.tabla,
  );

  if (!barra || !envoltura) {
    return;
  }

  montarFiltros({
    destino: barra,
    ubicacionVacio: envoltura,
    items: Array.from(
      envoltura.querySelectorAll<HTMLElement>("tbody tr"),
    ),
    placeholder: opciones.placeholder,
    etiquetaConteo: opciones.etiquetaConteo,
  });
}