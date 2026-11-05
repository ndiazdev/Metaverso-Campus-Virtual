import { t } from "../../state/idioma";
import {
  normalizarTipoSalon,
  SALONES,
  SALON_POR_DEFECTO,
  type TipoSalon,
} from "../../state/salones";

export function htmlSelectorSalon(tipoSeleccionado: unknown): string {
  const seleccionado = normalizarTipoSalon(tipoSeleccionado);
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

  return `
    <fieldset class="dash-salon-campo">
      <legend class="dash-modal-etiqueta">
        ${t("salon.tipo")}
      </legend>

      <p class="dash-salon-ayuda">
        ${t("salon.ayuda")}
      </p>

      <div class="dash-salon-opciones">
        ${SALONES.map((salon) => {
          const activo = salon.id === seleccionado;

          return `
            <label class="dash-salon-opcion${activo ? " seleccionada" : ""}">
              <input
                type="radio"
                name="tipoSalon"
                value="${salon.id}"
                ${activo ? "checked" : ""}
              />

              <img
                class="dash-salon-imagen"
                src="${base}/images/${salon.imagen}"
                alt="${t(salon.nombreKey)}"
                loading="lazy"
              />

              <span class="dash-salon-info">
                <strong>${t(salon.nombreKey)}</strong>
                <small>${t(salon.descripcionKey)}</small>
              </span>

              <span class="dash-salon-marca" aria-hidden="true">
                <i class="fa-solid fa-check"></i>
              </span>
            </label>
          `;
        }).join("")}
      </div>
    </fieldset>
  `;
}

export function conectarSelectorSalon(contenedor: ParentNode): void {
  const opciones = Array.from(
    contenedor.querySelectorAll<HTMLInputElement>('input[name="tipoSalon"]'),
  );

  const actualizar = (): void => {
    opciones.forEach((opcion) => {
      opcion
        .closest<HTMLElement>(".dash-salon-opcion")
        ?.classList.toggle("seleccionada", opcion.checked);
    });
  };

  opciones.forEach((opcion) => opcion.addEventListener("change", actualizar));
  actualizar();
}

export function leerTipoSalonSeleccionado(contenedor: ParentNode): TipoSalon {
  const marcado = contenedor.querySelector<HTMLInputElement>(
    'input[name="tipoSalon"]:checked',
  );

  return normalizarTipoSalon(marcado?.value ?? SALON_POR_DEFECTO);
}
