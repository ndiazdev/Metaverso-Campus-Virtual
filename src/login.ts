

export type RolUsuario = "docente" | "estudiante";

export interface Usuario {
  nombre: string;
  correo: string;
  rol: RolUsuario;
}


export class AuthManager {
  private usuarioActual: Usuario | null = null;

  constructor() {
    this.inyectarEstilosUI();
  }

  // Muestra el modal de inicio de sesión
  public mostrarLogin(): Promise<Usuario> {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.id = "login-overlay";
      overlay.innerHTML = `
        <div class="login-card">
          <h2>Metaverso USTA</h2>
          <p>Ingresa con tu correo institucional</p>
          <input type="email" id="email-input" placeholder="usuario@usantoto.edu.co" />
          <div id="login-error" class="error-msg"></div>
          <button id="login-btn">Iniciar Sesión</button>
        </div>
      `;
      document.body.appendChild(overlay);

      const btn = document.getElementById("login-btn")!;
      const input = document.getElementById("email-input") as HTMLInputElement;
      const errorDiv = document.getElementById("login-error")!;

      btn.addEventListener("click", () => {
        const email = input.value.trim().toLowerCase();

        // Validar correo institucional
        if (!email.endsWith("@usantoto.edu.co")) {
          errorDiv.innerText = "Debes usar un correo @usantoto.edu.co";
          return;
        }

        // Buscar en la base de datos simulada
        if (CUENTAS_MOCK[email]) {
          this.usuarioActual = CUENTAS_MOCK[email];
        } else {
          // Si el correo es nuevo pero institucional, asignamos rol estudiante por defecto
          this.usuarioActual = {
            nombre: email.split("@")[0],
            correo: email,
            rol: "estudiante",
          };
        }

        document.body.removeChild(overlay);
        this.renderizarPanelRol(this.usuarioActual);
        resolve(this.usuarioActual);
      });
    });
  }

  // Renderiza la interfaz según el rol detectado
  private renderizarPanelRol(usuario: Usuario): void {
    const panel = document.createElement("div");
    panel.id = "user-panel";

    if (usuario.rol === "docente") {
      panel.innerHTML = `
        <div class="panel-card">
          <span>Bienvenido, <b>${usuario.nombre}</b> (Docente)</span>
          <button id="btn-crear-clase" class="btn-primary">Crear Clase (Partida)</button>
        </div>
      `;
    } else {
      panel.innerHTML = `
        <div class="panel-card">
          <span>Bienvenido, <b>${usuario.nombre}</b> (Estudiante)</span>
          <button id="btn-unirse-clase" class="btn-secondary">Unirse a Clase</button>
        </div>
      `;
    }

    document.body.appendChild(panel);

    // Eventos para filtrado o lógica futura de partidas
    document.getElementById("btn-crear-clase")?.addEventListener("click", () => {
      alert("Modal para generar código de sesión 3D");
    });

    document.getElementById("btn-unirse-clase")?.addEventListener("click", () => {
      alert("Modal para ingresar código de acceso de 6 dígitos");
    });
  }

  public getUsuario(): Usuario | null {
    return this.usuarioActual;
  }

  private inyectarEstilosUI(): void {
    const style = document.createElement("style");
    style.innerHTML = `
      #login-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.85); display: flex;
        justify-content: center; align-items: center; z-index: 1000;
        font-family: Arial, sans-serif;
      }
      .login-card {
        background: #ffffff; padding: 2.5rem; border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3); text-align: center; width: 320px;
      }
      .login-card h2 { color: #1F3864; margin-bottom: 0.5rem; }
      .login-card p { color: #595959; font-size: 0.9rem; margin-bottom: 1.5rem; }
      .login-card input {
        width: 100%; padding: 0.75rem; border: 1px solid #ccc;
        border-radius: 6px; margin-bottom: 1rem; box-sizing: border-box;
      }
      .login-card button {
        width: 100%; padding: 0.75rem; background: #1F3864; color: white;
        border: none; border-radius: 6px; font-weight: bold; cursor: pointer;
      }
      .error-msg { color: #d32f2f; font-size: 0.85rem; margin-bottom: 0.8rem; }
      #user-panel {
        position: fixed; top: 20px; right: 20px; z-index: 500;
        font-family: Arial, sans-serif;
      }
      .panel-card {
        background: rgba(255, 255, 255, 0.95); padding: 1rem 1.5rem;
        border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end;
      }
      .btn-primary { background: #1F3864; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
      .btn-secondary { background: #2E5090; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
    `;
    document.head.appendChild(style);
  }
  
}

const CUENTAS_MOCK: Record<string, Usuario> = {
  "profesor@usantoto.edu.co": {
    nombre: "Prof. Juan Pérez",
    correo: "profesor@usantoto.edu.co",
    rol: "docente",
  },
  "estudiante@usantoto.edu.co": {
    nombre: "Nicolás Díaz",
    correo: "estudiante@usantoto.edu.co",
    rol: "estudiante",
  },
};