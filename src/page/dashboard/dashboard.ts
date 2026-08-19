
import {
  clasesDelDocente,
  obtenerClases,
  guardarClase,
  generarCodigoClase,
  inscribirEstudiante,
  buscarClasePorCodigo,
  cerrarSesion,
} from "../../state/estado";
import type { Cuenta, Clase } from "../../state/estado";

const ESTILOS = `
  .dash-overlay {
    position: fixed; inset: 0; z-index: 1000; font-family: sans-serif;
    background: linear-gradient(rgba(10,25,60,0.82), rgba(10,25,60,0.82)),
      url('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTTYFEc6WBmWWAszNaRkopQlG8NYiF3tuPp4auehsphraKnmjrmg3CPfUo&s=10') center/cover;
    overflow-y: auto;
  }
  .dash-nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 32px; background: rgba(10,20,45,0.5);
  }
  .dash-marca { display: flex; align-items: center; gap: 10px; color: white; font-weight: bold; font-size: 17px; }
  .dash-marca-icono { width: 34px; height: 34px; border-radius: 8px; background: #1F3864; display:flex; align-items:center; justify-content:center; }
  .dash-tabs { display: flex; gap: 4px; background: rgba(255,255,255,0.08); padding: 4px; border-radius: 10px; }
  .dash-tab { padding: 8px 18px; border-radius: 8px; color: #cfd8ea; font-size: 13px; font-weight: 600; cursor: pointer; }
  .dash-tab.activo { background: white; color: #1F3864; }
  .dash-salir { color: #cfd8ea; font-size: 13px; cursor: pointer; }
  .dash-cuerpo { display: flex; gap: 48px; padding: 48px; max-width: 1100px; margin: 0 auto; flex-wrap: wrap; }
  .dash-columna-izq { flex: 0 0 260px; text-align: center; }
  .dash-etiqueta-rol {
    display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: bold;
    letter-spacing: 0.5px; margin-bottom: 10px;
  }
  .dash-etiqueta-rol.estudiante { background: rgba(242,169,59,0.2); color: #F2A93B; }
  .dash-etiqueta-rol.docente { background: rgba(242,169,59,0.2); color: #F2A93B; }
  .dash-nombre-usuario { color: white; font-size: 24px; font-weight: bold; margin: 0 0 24px 0; }
  .dash-avatar { font-size: 100px; margin-bottom: 24px; }
  .dash-boton-principal {
    width: 100%; padding: 15px; border: none; border-radius: 10px; background: #F2A93B;
    color: #1a1a1a; font-weight: bold; font-size: 15px; cursor: pointer; margin-bottom: 10px;
  }
  .dash-contador { color: #b8c4dd; font-size: 12px; }
  .dash-columna-der { flex: 1; min-width: 320px; }
  .dash-seccion-titulo { color: #b8c4dd; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 14px; }
  .dash-tarjeta-clase {
    background: rgba(255,255,255,0.06); border-radius: 12px; padding: 18px 20px;
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;
  }
  .dash-clase-nombre { color: white; font-weight: bold; font-size: 15px; margin: 0 0 4px 0; }
  .dash-clase-meta { color: #9aa8c7; font-size: 12px; }
  .dash-clase-hora { color: #cfd8ea; font-size: 12px; text-align: right; margin-bottom: 8px; }
  .dash-boton-entrar {
    padding: 8px 16px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25);
    background: transparent; color: white; font-size: 12px; cursor: pointer;
  }
  .dash-stats { display: flex; gap: 14px; margin-top: 24px; }
  .dash-stat { flex: 1; background: rgba(255,255,255,0.06); border-radius: 12px; padding: 18px; text-align: center; }
  .dash-stat-numero { color: #F2A93B; font-size: 24px; font-weight: bold; }
  .dash-stat-etiqueta { color: #9aa8c7; font-size: 12px; margin-top: 4px; }
  .dash-modal-fondo { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1100; }
  .dash-modal { background: #14233f; border-radius: 14px; padding: 28px; width: 320px; text-align: center; }
  .dash-modal h3 { color: white; margin: 0 0 8px 0; }
  .dash-modal p { color: #b8c4dd; font-size: 13px; margin-bottom: 16px; }
  .dash-codigo-grande { color: #F2A93B; font-size: 32px; font-weight: bold; letter-spacing: 2px; margin: 12px 0 20px 0; }
  .dash-input-codigo {
    width: 100%; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.08); color: white; font-size: 16px; text-align: center; letter-spacing: 2px;
    text-transform: uppercase; box-sizing: border-box; margin-bottom: 12px;
  }
  .dash-error { color: #ff8080; font-size: 12px; min-height: 16px; margin-bottom: 8px; }
`;

function inyectarEstilos() {
  if (document.getElementById("estilos-dashboard")) return;
  const style = document.createElement("style");
  style.id = "estilos-dashboard";
  style.textContent = ESTILOS;
  document.head.appendChild(style);
}

export function mostrarDashboard(
  cuenta: Cuenta,
  alEntrarAClase: (clase: Clase) => void
): void {
  inyectarEstilos();

  const overlay = document.createElement("div");
  overlay.className = "dash-overlay";

  const esDocente = cuenta.rol === "docente";
  const totalUsuariosConectados = 47; 

  overlay.innerHTML = `
    <div class="dash-nav">
      <div class="dash-marca">
        <div class="dash-marca-icono">🎓</div>
        USTA Metaverso
      </div>
      <div class="dash-tabs">
        <div class="dash-tab activo" data-tab="clases">CLASES</div>
        <div class="dash-tab" data-tab="perfil">PERFIL</div>
        <div class="dash-tab" data-tab="ajustes">AJUSTES</div>
      </div>
      <div class="dash-salir" id="botonSalir">Salir</div>
    </div>
    <div id="contenidoDashboard"></div>
  `;

  document.body.appendChild(overlay);

  const contenido = overlay.querySelector<HTMLDivElement>("#contenidoDashboard")!;
  const tabs = overlay.querySelectorAll<HTMLDivElement>(".dash-tab");
  const botonSalir = overlay.querySelector<HTMLDivElement>("#botonSalir")!;

  function activarTab(nombre: string) {
    tabs.forEach((t) => t.classList.toggle("activo", t.dataset.tab === nombre));
    if (nombre === "clases") renderClases();
    if (nombre === "perfil") renderPerfil();
    if (nombre === "ajustes") renderAjustes();
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => activarTab(tab.dataset.tab!)));

  botonSalir.addEventListener("click", () => {
    cerrarSesion();
    overlay.remove();
    location.reload();
  });

  
  function renderClases() {
    const misClases = esDocente ? clasesDelDocente(cuenta.correo) : obtenerClases().slice(-5).reverse();

    contenido.innerHTML = `
      <div class="dash-cuerpo">
        <div class="dash-columna-izq">
          <div class="dash-etiqueta-rol ${cuenta.rol}">${esDocente ? "DOCENTE" : "ESTUDIANTE"}</div>
          <p class="dash-nombre-usuario">${cuenta.nombreCompleto.split(" ")[0]}</p>
          <div class="dash-avatar">${esDocente ? "🧑‍🏫" : "🧑‍🎓"}</div>
          <button class="dash-boton-principal" id="botonAccionPrincipal">
            ${esDocente ? "Crear Clase" : "Unirse a Clase"}
          </button>
          <p class="dash-contador">● ${totalUsuariosConectados} usuarios conectados</p>
        </div>

        <div class="dash-columna-der">
          <p class="dash-seccion-titulo">${esDocente ? "Mis clases recientes" : "Clases recientes"}</p>
          <div id="listaClases">
            ${
              misClases.length === 0
                ? `<p style="color:#9aa8c7; font-size:13px;">Todavía no hay clases ${esDocente ? "creadas" : "disponibles"}.</p>`
                : misClases
                    .map(
                      (clase) => `
                <div class="dash-tarjeta-clase">
                  <div>
                    <p class="dash-clase-nombre">${clase.materia}</p>
                    <p class="dash-clase-meta">${clase.codigo}${esDocente ? "" : " · " + clase.nombreDocente}</p>
                  </div>
                  <button class="dash-boton-entrar" data-codigo="${clase.codigo}">
                    ${esDocente ? "Abrir" : "Entrar"}
                  </button>
                </div>
              `
                    )
                    .join("")
            }
          </div>

          <div class="dash-stats">
            <div class="dash-stat">
              <div class="dash-stat-numero">${misClases.length}</div>
              <div class="dash-stat-etiqueta">${esDocente ? "Clases activas" : "Clases hoy"}</div>
            </div>
            <div class="dash-stat">
              <div class="dash-stat-numero">${totalUsuariosConectados}</div>
              <div class="dash-stat-etiqueta">Usuarios conectados</div>
            </div>
          </div>
        </div>
      </div>
    `;

    
    contenido.querySelectorAll<HTMLButtonElement>(".dash-boton-entrar").forEach((boton) => {
      boton.addEventListener("click", () => {
        const clase = buscarClasePorCodigo(boton.dataset.codigo!);
        if (clase) alEntrarAClase(clase);
      });
    });

    
    const botonPrincipal = contenido.querySelector<HTMLButtonElement>("#botonAccionPrincipal")!;
    botonPrincipal.addEventListener("click", () => {
      if (esDocente) abrirModalCrearClase();
      else abrirModalUnirseClase();
    });
  }

  function abrirModalCrearClase() {
    const modal = document.createElement("div");
    modal.className = "dash-modal-fondo";
    modal.innerHTML = `
      <div class="dash-modal">
        <h3>Crear nueva clase</h3>
        <p>Escribe la materia que vas a dictar</p>
        <input class="dash-input-codigo" id="campoMateriaNueva" placeholder="Ej: Cálculo II" style="text-transform:none; letter-spacing:normal;" />
        <p class="dash-error" id="errorModal"></p>
        <button class="dash-boton-principal" id="botonConfirmarClase">Generar código</button>
      </div>
    `;
    document.body.appendChild(modal);

    const campoMateria = modal.querySelector<HTMLInputElement>("#campoMateriaNueva")!;
    const errorModal = modal.querySelector<HTMLParagraphElement>("#errorModal")!;
    const botonConfirmar = modal.querySelector<HTMLButtonElement>("#botonConfirmarClase")!;

    botonConfirmar.addEventListener("click", () => {
      const materia = campoMateria.value.trim();
      if (materia.length === 0) {
        errorModal.textContent = "Escribe el nombre de la materia.";
        return;
      }

      const clase: Clase = {
        codigo: generarCodigoClase(materia),
        materia,
        correoDocente: cuenta.correo,
        nombreDocente: cuenta.nombreCompleto,
        fechaCreacion: new Date().toISOString(),
        estudiantesInscritos: [],
      };
      guardarClase(clase);

      modal.innerHTML = `
        <div class="dash-modal">
          <h3>¡Clase creada!</h3>
          <p>Comparte este código con tus estudiantes</p>
          <div class="dash-codigo-grande">${clase.codigo}</div>
          <button class="dash-boton-principal" id="botonEntrarAhora">Entrar a la clase</button>
        </div>
      `;
      modal.querySelector<HTMLButtonElement>("#botonEntrarAhora")!.addEventListener("click", () => {
        modal.remove();
        alEntrarAClase(clase);
      });
    });
  }

  function abrirModalUnirseClase() {
    const modal = document.createElement("div");
    modal.className = "dash-modal-fondo";
    modal.innerHTML = `
      <div class="dash-modal">
        <h3>Unirse a una clase</h3>
        <p>Escribe el código que te dio tu docente</p>
        <input class="dash-input-codigo" id="campoCodigoUnirse" placeholder="EJ: CAL-123" />
        <p class="dash-error" id="errorModal"></p>
        <button class="dash-boton-principal" id="botonConfirmarUnirse">Entrar</button>
      </div>
    `;
    document.body.appendChild(modal);

    const campoCodigo = modal.querySelector<HTMLInputElement>("#campoCodigoUnirse")!;
    const errorModal = modal.querySelector<HTMLParagraphElement>("#errorModal")!;
    const botonConfirmar = modal.querySelector<HTMLButtonElement>("#botonConfirmarUnirse")!;

    botonConfirmar.addEventListener("click", () => {
      const codigo = campoCodigo.value.trim();
      const clase = buscarClasePorCodigo(codigo);

      if (!clase) {
        errorModal.textContent = "No existe ninguna clase con ese código.";
        return;
      }

      inscribirEstudiante(codigo, cuenta.correo);
      modal.remove();
      alEntrarAClase(clase);
    });
  }

 
  function renderPerfil() {
    const misClases = esDocente ? clasesDelDocente(cuenta.correo) : [];

    contenido.innerHTML = `
      <div style="max-width:480px; margin: 40px auto; text-align:center;">
        <div style="font-size:80px; margin-bottom:16px;">${esDocente ? "🧑‍🏫" : "🧑‍🎓"}</div>
        <div style="background:rgba(255,255,255,0.06); border-radius:14px; padding:28px; text-align:left;">
          <p style="color:white; font-size:20px; font-weight:bold; margin:0;">${cuenta.nombreCompleto}</p>
          <p style="color:#F2A93B; font-size:13px; font-weight:bold; margin:2px 0 20px 0;">${esDocente ? "Docente" : "Estudiante"}</p>

          <div style="display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid rgba(255,255,255,0.1);">
            <span style="color:#9aa8c7; font-size:13px;">Correo</span>
            <span style="color:white; font-size:13px;">${cuenta.correo}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid rgba(255,255,255,0.1);">
            <span style="color:#9aa8c7; font-size:13px;">Institución</span>
            <span style="color:white; font-size:13px;">USTA Seccional Tunja</span>
          </div>
          ${
            esDocente
              ? `<div style="display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid rgba(255,255,255,0.1);">
                  <span style="color:#9aa8c7; font-size:13px;">Materia</span>
                  <span style="color:white; font-size:13px;">${cuenta.materia || "—"}</span>
                </div>`
              : `<div style="display:flex; justify-content:space-between; padding:10px 0; border-top:1px solid rgba(255,255,255,0.1);">
                  <span style="color:#9aa8c7; font-size:13px;">Carrera</span>
                  <span style="color:white; font-size:13px;">${cuenta.carrera || "—"}</span>
                </div>`
          }
        </div>

        ${
          esDocente
            ? `<div class="dash-stats">
                <div class="dash-stat"><div class="dash-stat-numero">${misClases.length}</div><div class="dash-stat-etiqueta">Clases creadas</div></div>
              </div>`
            : ""
        }
      </div>
    `;
  }

  // ---------------- Pestaña AJUSTES ----------------
  function renderAjustes() {
    contenido.innerHTML = `
      <div style="max-width:480px; margin: 60px auto; text-align:center; color:#b8c4dd;">
        <p style="font-size:15px;">Sección de ajustes — próximamente.</p>
        <p style="font-size:13px; color:#9aa8c7;">Aquí irán preferencias de cuenta, notificaciones, y configuración de audio/cámara para las clases.</p>
      </div>
    `;
  }

  renderClases(); 
}