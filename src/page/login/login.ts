import { guardarSesion, detectarRolPorCorreo } from "../../state/estado";
import type { Cuenta, Rol } from "../../state/estado";

const DOMINIO_INSTITUCIONAL = "@usantoto.edu.co";
const API_URL = "http://localhost:3000/api";

const ETIQUETAS_ROL: Record<Rol, string> = {
  estudiante: "🎓 Estudiante",
  docente: "📋 Docente",
  admin: "🛡️ Administrador",
  invitado: "👤 Invitado",
};

const ESTILOS = `
  .login-overlay {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    font-family: sans-serif;
    
    
    background-image: url('https://comunicaciones.santototunja.edu.co/wp-content/uploads/2020/11/Santoto_Tunja_Campus_Centro_Historico.jpg');
    background-position: center;
    background-size: cover;
    background-repeat: no-repeat;
    background-color: #062a5c; 
  }
    .logo-login {
  width: 170px;         
  height: 170px;        
  object-fit: contain; 
  border-radius: 50%;   
  background-color: #0d2c54; 
  padding: 8px;         
  display: block;       
  margin: 0 auto 15px auto; 
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
  .login-rol-detectado {
    background: rgba(242,169,59,0.12); border: 1px solid rgba(242,169,59,0.35); border-radius: 8px;
    padding: 10px 14px; color: #F2A93B; font-size: 13px; font-weight: bold; text-align: center;
    margin-bottom: 16px; display: none;
  }
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

function mostrarFormularioLogin(
  alIniciarSesion: (cuenta: Cuenta) => void,
): void {
  const overlay = document.createElement("div");
  overlay.className = "login-overlay";

  overlay.innerHTML = `
    <div class="login-overlay">
      <!-- Moviendo el encabezado adentro de la tarjeta -->
      <div class="login-tarjeta">
        
        <div class="login-encabezado" style="text-align: center; margin-bottom: 24px;">
          <img class="logo-login" src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSyfi7TEQfvPpjTWsqljga0WB5N-h8SfivBv1XE7oxR_vwj3cR9SIMZssPe&s=10" alt="Logo USTA">
          <h1 class="login-titulo" style="color: white; margin-top: 10px;">Metaverso </h1>
          <p class="login-subtitulo" style="color: #ccc;">Universidad Santo Tomás · Tunja</p>
        </div>

        <!-- Campos del formulario -->
        <label class="login-etiqueta">CORREO INSTITUCIONAL O PERSONAL</label>
        <input id="campoCorreo" class="login-input" type="email" placeholder="usuario@usantoto.edu.co" />

        <label class="login-etiqueta">CONTRASEÑA</label>
        <input id="campoContrasena" class="login-input" type="password" placeholder="••••••••" />

        <p class="login-error" id="mensajeError"></p>

        <button class="login-boton" id="botonLogin">Iniciar Sesión</button>

        <p class="login-enlace">¿Primera vez aquí? <a id="enlaceRegistro">Crear cuenta</a></p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const campoCorreo = overlay.querySelector<HTMLInputElement>("#campoCorreo")!;
  const campoContrasena =
    overlay.querySelector<HTMLInputElement>("#campoContrasena")!;
  const mensajeError =
    overlay.querySelector<HTMLParagraphElement>("#mensajeError")!;
  const botonLogin = overlay.querySelector<HTMLButtonElement>("#botonLogin")!;
  const enlaceRegistro =
    overlay.querySelector<HTMLAnchorElement>("#enlaceRegistro")!;

  botonLogin.addEventListener("click", async () => {
    const correo = campoCorreo.value.trim().toLowerCase();
    const contrasena = campoContrasena.value;

    if (!correo || !contrasena) {
      mensajeError.textContent = "Ingresa correo y contraseña.";
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

function mostrarFormularioRegistro(
  alIniciarSesion: (cuenta: Cuenta) => void,
): void {
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

        <label class="login-etiqueta">Correo</label>
        <input id="campoCorreo" class="login-input" type="email" placeholder="nombre.apellido@usantoto.edu.co" />

        <div class="login-rol-detectado" id="rolDetectado"></div>

        <label class="login-etiqueta">Contraseña</label>
        <input id="campoContrasena" class="login-input" type="password" placeholder="••••••••" />

        <div id="zonaEstudiante" style="display:none;">
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
  const campoContrasena =
    overlay.querySelector<HTMLInputElement>("#campoContrasena")!;
  const campoCarrera =
    overlay.querySelector<HTMLInputElement>("#campoCarrera")!;
  const campoMateria =
    overlay.querySelector<HTMLInputElement>("#campoMateria")!;
  const mensajeError =
    overlay.querySelector<HTMLParagraphElement>("#mensajeError")!;
  const botonRegistrar =
    overlay.querySelector<HTMLButtonElement>("#botonRegistrar")!;
  const enlaceLogin = overlay.querySelector<HTMLAnchorElement>("#enlaceLogin")!;
  const rolDetectadoDiv =
    overlay.querySelector<HTMLDivElement>("#rolDetectado")!;
  const zonaEstudiante =
    overlay.querySelector<HTMLDivElement>("#zonaEstudiante")!;
  const zonaDocente = overlay.querySelector<HTMLDivElement>("#zonaDocente")!;

  // Cada vez que el usuario escribe el correo, mostramos en vivo qué rol le tocaría
  campoCorreo.addEventListener("input", () => {
    const correo = campoCorreo.value.trim();
    if (correo.length < 5 || !correo.includes("@")) {
      rolDetectadoDiv.style.display = "none";
      zonaEstudiante.style.display = "none";
      zonaDocente.style.display = "none";
      return;
    }

    const rol = detectarRolPorCorreo(correo);
    rolDetectadoDiv.style.display = "block";
    rolDetectadoDiv.textContent = `Rol detectado: ${ETIQUETAS_ROL[rol]}`;

    // Estudiante e invitado ven el campo de carrera; docente y admin no lo necesitan
    zonaEstudiante.style.display =
      rol === "estudiante" || rol === "invitado" ? "block" : "none";
    zonaDocente.style.display = rol === "docente" ? "block" : "none";
  });

  botonRegistrar.addEventListener("click", async () => {
    const nombreCompleto = campoNombre.value.trim();
    const correo = campoCorreo.value.trim().toLowerCase();
    const contrasena = campoContrasena.value;

    if (nombreCompleto.length === 0) {
      mensajeError.textContent = "Escribe tu nombre completo.";
      return;
    }
    if (!correo.includes("@")) {
      mensajeError.textContent = "Escribe un correo válido.";
      return;
    }
    if (contrasena.length < 6) {
      mensajeError.textContent =
        "La contraseña debe tener al menos 6 caracteres.";
      return;
    }

    mensajeError.textContent = "";
    botonRegistrar.disabled = true;
    botonRegistrar.textContent = "Guardando...";

    const rolPrevisto = detectarRolPorCorreo(correo);

    const nuevaCuenta = {
      nombreCompleto,
      correo,
      contrasena,
      carrera:
        rolPrevisto === "estudiante" || rolPrevisto === "invitado"
          ? campoCarrera.value.trim()
          : undefined,
      materia:
        rolPrevisto === "docente" ? campoMateria.value.trim() : undefined,
    };

    try {
      const res = await fetch(`${API_URL}/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevaCuenta),
      });

      const data = await res.json();

      if (!res.ok) {
        mensajeError.textContent =
          data.error || "Error al registrar la cuenta.";
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
