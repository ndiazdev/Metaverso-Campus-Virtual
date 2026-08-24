

import { guardarSesion } from "../../state/estado";
import type { Cuenta, Rol } from "../../state/estado";

const DOMINIO_INSTITUCIONAL = "@usantoto.edu.co";
const API_URL = "http://localhost:3000/api";

const ESTILOS = `
  .login-overlay {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    font-family: sans-serif;
    background: linear-gradient(rgba(10,25,60,0.75), rgba(10,25,60,0.75)),
      url('https://comunicaciones.santototunja.edu.co/wp-content/uploads/2020/11/Santoto_Tunja_Campus_Centro_Historico.jpg') center/cover;
  }
  .login-encabezado { text-align: center; margin-bottom: 24px; }
  .login-icono {
    width: 56px; height: 56px; border-radius: 14px; background: #1F3864;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 16px auto; font-size: 24px;
  }
  .login-titulo { color: white; font-size: 26px; font-weight: bold; margin: 0; }
  .login-subtitulo { color: #b8c4dd; font-size: 14px; margin: 6px 0 0 0; }
  .login-tarjeta {
    background: rgba(20,35,70,0.75); backdrop-filter: blur(6px);
    border-radius: 16px; padding: 32px; width: 380px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.4);
  }
  .login-etiqueta { color: #cfd8ea; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; display: block; margin-bottom: 6px; }
  .login-input {
    width: 100%; padding: 12px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.08); color: white; font-size: 14px; margin-bottom: 16px; box-sizing: border-box;
  }
  .login-input::placeholder { color: #8b98b8; }
  .login-boton {
    width: 100%; padding: 13px; border: none; border-radius: 8px;
    background: #F2A93B; color: #1a1a1a; font-weight: bold; font-size: 15px; cursor: pointer; margin-top: 4px;
  }
  .login-boton:hover { background: #e69a25; }
  .login-boton:disabled { background: #888; cursor: not-allowed; }
  .login-error { color: #ff8080; font-size: 12px; min-height: 16px; margin: -8px 0 12px 0; }
  .login-enlace { text-align: center; color: #b8c4dd; font-size: 13px; margin-top: 18px; }
  .login-enlace a { color: #F2A93B; font-weight: bold; cursor: pointer; text-decoration: none; }
  .login-roles { display: flex; gap: 12px; margin-bottom: 16px; }
  .login-rol-opcion {
    flex: 1; padding: 16px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.05); text-align: center; cursor: pointer; color: #cfd8ea; font-size: 13px;
  }
  .login-rol-opcion.activo { border-color: #F2A93B; background: rgba(242,169,59,0.15); color: white; }
  .login-rol-icono { font-size: 22px; display: block; margin-bottom: 6px; }
`;

function inyectarEstilos() {
  if (document.getElementById("estilos-login")) return;
  const style = document.createElement("style");
  style.id = "estilos-login";
  style.textContent = ESTILOS;
  document.head.appendChild(style);
}

export function iniciarLogin(alIniciarSesion: (cuenta: Cuenta) => void): void {
  inyectarEstilos();
  mostrarFormularioLogin(alIniciarSesion);
}

function mostrarFormularioLogin(alIniciarSesion: (cuenta: Cuenta) => void): void {
  const overlay = document.createElement("div");
  overlay.className = "login-overlay";

  overlay.innerHTML = `
    <div>
      <div class="login-encabezado">
        <div class="login-icono">🎓</div>
        <h1 class="login-titulo">USTA Metaverso</h1>
        <p class="login-subtitulo">Universidad Santo Tomás · Tunja</p>
      </div>
      <div class="login-tarjeta">
        <label class="login-etiqueta">Correo institucional</label>
        <input id="campoCorreo" class="login-input" type="email" placeholder="usuario@usantoto.edu.co" />

        <label class="login-etiqueta">Contraseña</label>
        <input id="campoContrasena" class="login-input" type="password" placeholder="••••••••" />

        <p class="login-error" id="mensajeError"></p>

        <button class="login-boton" id="botonLogin">Iniciar Sesión</button>

        <p class="login-enlace">¿Primera vez aquí? <a id="enlaceRegistro">Crear cuenta</a></p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const campoCorreo = overlay.querySelector<HTMLInputElement>("#campoCorreo")!;
  const campoContrasena = overlay.querySelector<HTMLInputElement>("#campoContrasena")!;
  const mensajeError = overlay.querySelector<HTMLParagraphElement>("#mensajeError")!;
  const botonLogin = overlay.querySelector<HTMLButtonElement>("#botonLogin")!;
  const enlaceRegistro = overlay.querySelector<HTMLAnchorElement>("#enlaceRegistro")!;

  botonLogin.addEventListener("click", async () => {
    const correo = campoCorreo.value.trim().toLowerCase();
    const contrasena = campoContrasena.value;

    if (!correo.endsWith(DOMINIO_INSTITUCIONAL)) {
      mensajeError.textContent = `Usa tu correo institucional (${DOMINIO_INSTITUCIONAL})`;
      return;
    }

    if (!contrasena) {
      mensajeError.textContent = "Ingresa tu contraseña.";
      return;
    }

    mensajeError.textContent = "";
    botonLogin.disabled = true;
    botonLogin.textContent = "Cargando...";

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, contrasena }),
      });

      const data = await res.json();

      if (!res.ok) {
        mensajeError.textContent = data.error || "Error al iniciar sesión.";
        botonLogin.disabled = false;
        botonLogin.textContent = "Iniciar Sesión";
        return;
      }

      guardarSesion(data.cuenta.correo);
      overlay.remove();
      alIniciarSesion(data.cuenta);
    } catch (err) {
      mensajeError.textContent = "No se pudo conectar con el servidor.";
      botonLogin.disabled = false;
      botonLogin.textContent = "Iniciar Sesión";
    }
  });

  enlaceRegistro.addEventListener("click", () => {
    overlay.remove();
    mostrarFormularioRegistro(alIniciarSesion);
  });
}

function mostrarFormularioRegistro(alIniciarSesion: (cuenta: Cuenta) => void): void {
  const overlay = document.createElement("div");
  overlay.className = "login-overlay";

  overlay.innerHTML = `
    <div>
      <div class="login-encabezado">
        <h1 class="login-titulo">Crear cuenta</h1>
        <p class="login-subtitulo">Únete al campus virtual USTA Tunja</p>
      </div>
      <div class="login-tarjeta">
        <label class="login-etiqueta">Nombre completo</label>
        <input id="campoNombre" class="login-input" type="text" placeholder="Tu nombre completo" />

        <label class="login-etiqueta">Correo institucional</label>
        <input id="campoCorreo" class="login-input" type="email" placeholder="usuario@usantoto.edu.co" />

        <label class="login-etiqueta">Contraseña</label>
        <input id="campoContrasena" class="login-input" type="password" placeholder="••••••••" />

        <label class="login-etiqueta">Selecciona tu rol</label>
        <div class="login-roles">
          <div class="login-rol-opcion activo" data-rol="estudiante">
            <span class="login-rol-icono">🎓</span> Estudiante
          </div>
          <div class="login-rol-opcion" data-rol="docente">
            <span class="login-rol-icono">📋</span> Docente
          </div>
        </div>

        <div id="zonaEstudiante">
          <label class="login-etiqueta">Carrera</label>
          <input id="campoCarrera" class="login-input" type="text" placeholder="Ej: Ingeniería de Sistemas" />
        </div>

        <div id="zonaDocente" style="display:none;">
          <label class="login-etiqueta">Materia que dicta</label>
          <input id="campoMateria" class="login-input" type="text" placeholder="Ej: Cálculo II" />
        </div>

        <p class="login-error" id="mensajeError"></p>

        <button class="login-boton" id="botonRegistrar">Registrarme</button>

        <p class="login-enlace">¿Ya tienes cuenta? <a id="enlaceLogin">Inicia sesión</a></p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const campoNombre = overlay.querySelector<HTMLInputElement>("#campoNombre")!;
  const campoCorreo = overlay.querySelector<HTMLInputElement>("#campoCorreo")!;
  const campoContrasena = overlay.querySelector<HTMLInputElement>("#campoContrasena")!;
  const campoCarrera = overlay.querySelector<HTMLInputElement>("#campoCarrera")!;
  const campoMateria = overlay.querySelector<HTMLInputElement>("#campoMateria")!;
  const mensajeError = overlay.querySelector<HTMLParagraphElement>("#mensajeError")!;
  const botonRegistrar = overlay.querySelector<HTMLButtonElement>("#botonRegistrar")!;
  const enlaceLogin = overlay.querySelector<HTMLAnchorElement>("#enlaceLogin")!;
  const opcionesRol = overlay.querySelectorAll<HTMLDivElement>(".login-rol-opcion");
  const zonaEstudiante = overlay.querySelector<HTMLDivElement>("#zonaEstudiante")!;
  const zonaDocente = overlay.querySelector<HTMLDivElement>("#zonaDocente")!;

  let rolSeleccionado: Rol = "estudiante";

  opcionesRol.forEach((opcion) => {
    opcion.addEventListener("click", () => {
      opcionesRol.forEach((o) => o.classList.remove("activo"));
      opcion.classList.add("activo");
      rolSeleccionado = opcion.dataset.rol as Rol;
      zonaEstudiante.style.display = rolSeleccionado === "estudiante" ? "block" : "none";
      zonaDocente.style.display = rolSeleccionado === "docente" ? "block" : "none";
    });
  });

  botonRegistrar.addEventListener("click", async () => {
    const nombreCompleto = campoNombre.value.trim();
    const correo = campoCorreo.value.trim().toLowerCase();
    const contrasena = campoContrasena.value;

    if (nombreCompleto.length === 0) {
      mensajeError.textContent = "Escribe tu nombre completo.";
      return;
    }
    if (!correo.endsWith(DOMINIO_INSTITUCIONAL)) {
      mensajeError.textContent = `Usa tu correo institucional (${DOMINIO_INSTITUCIONAL})`;
      return;
    }
    if (contrasena.length < 6) {
      mensajeError.textContent = "La contraseña debe tener al menos 6 caracteres.";
      return;
    }

    mensajeError.textContent = "";
    botonRegistrar.disabled = true;
    botonRegistrar.textContent = "Guardando...";

    const nuevaCuenta = {
      nombreCompleto,
      correo,
      contrasena,
      rol: rolSeleccionado,
      carrera: rolSeleccionado === "estudiante" ? campoCarrera.value.trim() : undefined,
      materia: rolSeleccionado === "docente" ? campoMateria.value.trim() : undefined,
    };

    try {
      const res = await fetch(`${API_URL}/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevaCuenta),
      });

      const data = await res.json();

      if (!res.ok) {
        mensajeError.textContent = data.error || "Error al registrar la cuenta.";
        botonRegistrar.disabled = false;
        botonRegistrar.textContent = "Registrarme";
        return;
      }

      guardarSesion(data.cuenta.correo);
      overlay.remove();
      alIniciarSesion(data.cuenta);
    } catch (err) {
      mensajeError.textContent = "No se pudo conectar con el servidor.";
      botonRegistrar.disabled = false;
      botonRegistrar.textContent = "Registrarme";
    }
  });

  enlaceLogin.addEventListener("click", () => {
    overlay.remove();
    mostrarFormularioLogin(alIniciarSesion);
  });
}