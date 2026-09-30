// ============================================================
// DASHBOARD ESTUDIANTE
// Gestión de clases en las que el estudiante está inscrito
// ============================================================

import type { Cuenta, Clase } from "../../state/estado";
import { IMAGENES_ROL, ETIQUETAS_ROL } from "./dashboardComun";
import { API_URL } from "../../api/cliente";

export interface DashboardEstudianteOpciones {
  cuenta: Cuenta & { id?: number };
  contenido: HTMLDivElement;
  overlay: HTMLDivElement;
  alEntrarAClase: (clase: Clase) => void;
}

export async function mostrarDashboardEstudiante(
  opciones: DashboardEstudianteOpciones
): Promise<void> {
  const { cuenta, contenido, overlay, alEntrarAClase } = opciones;

  contenido.innerHTML = `<div class="dash-cargando">Cargando clases desde la base de datos...</div>`;

  let misClases: Clase[] = [];

  try {
    const endpoint = `${API_URL}/clases/estudiante/${encodeURIComponent(cuenta.correo)}`;
    const res = await fetch(endpoint);
    if (res.ok) {
      misClases = await res.json();
    }
  } catch (error) {
    console.error("Error al consultar clases del estudiante:", error);
  }

  contenido.innerHTML = `
    <div class="dash-cuerpo">
      <div class="dash-columna-izq">
        <div class="dash-etiqueta-rol">${ETIQUETAS_ROL[cuenta.rol]}</div>
        <p class="dash-nombre-usuario">${cuenta.nombreCompleto.split(" ")[0]}</p>
        <img class="dash-avatar-img" src="${IMAGENES_ROL[cuenta.rol]}" alt="Avatar" />
        <button class="dash-boton-principal" id="botonAccionPrincipal">Unirse a Clase</button>
        <p class="dash-contador">● 47 usuarios conectados</p>
      </div>

      <div class="dash-columna-der">
        <p class="dash-seccion-titulo">Mis clases inscritas</p>
        <div id="listaClases">
          ${
            misClases.length === 0
              ? `<p class="dash-sin-clases">Todavía no tienes clases inscritas.</p>`
              : misClases
                  .map(
                    (clase) => `
                <div class="dash-tarjeta-clase">
                  <div>
                    <p class="dash-clase-nombre">${clase.materia}</p>
                    <p class="dash-clase-meta">${clase.codigo}${clase.nombreDocente ? " · " + clase.nombreDocente : ""}</p>
                  </div>
                  <button class="dash-boton-entrar" data-codigo="${clase.codigo}">Entrar</button>
                </div>
              `
                  )
                  .join("")
          }
        </div>

        <div class="dash-stats">
          <div class="dash-stat">
            <div class="dash-stat-numero">${misClases.length}</div>
            <div class="dash-stat-etiqueta">Clases inscritas</div>
          </div>
          <div class="dash-stat">
            <div class="dash-stat-numero">47</div>
            <div class="dash-stat-etiqueta">Usuarios conectados</div>
          </div>
        </div>
      </div>
    </div>
  `;

  contenido.querySelectorAll<HTMLButtonElement>(".dash-boton-entrar").forEach((boton) => {
    boton.addEventListener("click", () => {
      const codigoBuscado = boton.dataset.codigo;
      const claseSeleccionada = misClases.find((c) => c.codigo === codigoBuscado);
      if (!claseSeleccionada) return;
      overlay.remove();
      alEntrarAClase(claseSeleccionada);
    });
  });

  const botonPrincipal = contenido.querySelector<HTMLButtonElement>("#botonAccionPrincipal");
  if (botonPrincipal) {
    botonPrincipal.addEventListener("click", () => abrirModalUnirseClase());
  }

  function abrirModalUnirseClase(): void {
    const modal = document.createElement("div");
    modal.className = "dash-modal-fondo";
    modal.innerHTML = `
      <div class="dash-modal">
        <h3>Unirse a una clase</h3>
        <p>Escribe el código que te dio tu docente</p>
        <input class="dash-input-codigo" id="campoCodigoUnirse" placeholder="EJ: CAL-123" />
        <p class="dash-error" id="errorModal"></p>
        <button class="dash-boton-principal" id="botonConfirmarUnirse">Inscribirme</button>
      </div>
    `;
    document.body.appendChild(modal);

    const campoCodigo = modal.querySelector<HTMLInputElement>("#campoCodigoUnirse")!;
    const errorModal = modal.querySelector<HTMLParagraphElement>("#errorModal")!;
    const botonConfirmar = modal.querySelector<HTMLButtonElement>("#botonConfirmarUnirse")!;

    botonConfirmar.addEventListener("click", async () => {
      const codigo = campoCodigo.value.trim().toUpperCase();
      if (!codigo) {
        errorModal.textContent = "Ingresa un código válido.";
        return;
      }

      botonConfirmar.disabled = true;
      botonConfirmar.textContent = "Uniéndote...";

      try {
        const res = await fetch(`${API_URL}/inscripciones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correoEstudiante: cuenta.correo, codigoClase: codigo }),
        });

        const data = await res.json();

        if (!res.ok) {
          errorModal.textContent = data.error || "Código no encontrado.";
          botonConfirmar.disabled = false;
          botonConfirmar.textContent = "Inscribirme";
          return;
        }

        modal.remove();
        // Refresca la lista de clases inscritas para que aparezca la nueva
        mostrarDashboardEstudiante(opciones);
      } catch (error) {
        errorModal.textContent = "No se pudo conectar con el servidor.";
        botonConfirmar.disabled = false;
        botonConfirmar.textContent = "Inscribirme";
      }
    });
  }
}