import { guardarSesion, detectarRolPorCorreo } from "../../state/estado";
import type { Cuenta, Rol } from "../../state/estado";
import { LOGO_URL } from "../dashboard/dashboardEstilos";
import "@fortawesome/fontawesome-free/css/all.min.css";

const API_URL = "http://localhost:3000/api";

const ETIQUETAS_ROL: Record<Rol, string> = {
  estudiante: "Estudiante",
  docente: "Docente",
  admin: "Administrador",
  invitado: "Invitado",
};

// El bloque de imagen que se repite en el login y en el registro.
// Es un CARRUSEL: cada entrada es la lista de nombres que se prueban en orden
// (por si la imagen está en .jpeg, .jpg o .png). Si ningún nombre carga, la
// diapositiva se descarta sola y el carrusel sigue con las que sí existan.
// Fotos reales del carrusel: login.jpeg, login1.jpeg, login2.jpeg, login3.jpeg
const IMAGENES_LOGIN: string[][] = [
  ["/images/login.jpeg", "/images/login.jpg", "/images/login.png"],
  ["/images/login1.jpeg", "/images/login1.jpg", "/images/login1.png"],
  ["/images/login2.jpeg", "/images/login2.jpg", "/images/login2.png"],
  ["/images/login3.jpeg", "/images/login3.jpg", "/images/login3.png"],
];

const PANEL_IMAGEN = `
  <div class="login-panel-imagen">
    <div class="login-carrusel">
      ${IMAGENES_LOGIN.map(
        (candidatos, i) =>
          `<img class="login-diapositiva${i === 0 ? " activa" : ""}" alt=""` +
          ` data-candidatos='${JSON.stringify(candidatos)}' data-i="0"` +
          ` src="${candidatos[0]}" />`,
      ).join("")}
    </div>
    <div class="login-puntos"></div>
    <div class="login-marca">
      <img class="login-marca-logo" src="${LOGO_URL}" alt="Universidad Santo Tomás" />
      <span class="login-marca-texto">CAMPUS<b>VIRTUAL</b></span>
    </div>
  </div>
`;

// Encabezado de marca que encabeza el formulario (título + línea de color).
const MARCA_SITIO = `
  <div class="login-marca-sitio">
    <h1 class="login-titulo">Metaverso<br />Académico</h1>
    <p class="login-kicker">Universidad Santo Tomás · Tunja</p>
  </div>
`;

const ESTILOS = `
  /* ---------------- FONDO DE PÁGINA (la parte de atrás) ----------------
     Estilo GLASS y SIN TONO AZUL: el velo es gris neutro puro, así que la
     foto del campus se ve sin filtro de color (ni azul ni morado).
     Bajando el 0.88 del velo se ve MÁS la foto; subiéndolo se ve MÁS el gris. */
  .login-overlay {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; padding: 24px; overflow-y: auto;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    background-color: #0C0D10;
    background-image:
      radial-gradient(circle at 14% 18%, rgba(255,255,255,0.06), transparent 48%),
      radial-gradient(circle at 86% 84%, rgba(255,255,255,0.05), transparent 52%),
      linear-gradient(rgba(12,13,16,0.88), rgba(12,13,16,0.88)),
      url("/images/fondologin.jpeg");
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }
  /* margin:auto en vez de align-items:center: si la tarjeta es más alta que la
     ventana se apila desde arriba y no se recorta la parte superior.
     GLASS: fondo translúcido + desenfoque del fondo (backdrop-filter) + borde
     claro e interior iluminado = efecto de vidrio esmerilado. */
  .login-tarjeta {
    margin: auto; display: flex; width: min(1040px, 100%); min-height: 620px;
    background: rgba(255,255,255,0.86);
    -webkit-backdrop-filter: blur(24px) saturate(1.15);
    backdrop-filter: blur(24px) saturate(1.15);
    border: 1px solid rgba(255,255,255,0.55);
    border-radius: 20px; overflow: hidden;
    box-shadow: 0 34px 80px rgba(2,6,23,0.5), inset 0 1px 0 rgba(255,255,255,0.75);
  }

  /* ---------------- PANEL IZQUIERDO: FOTO + LOGO ---------------- */
  .login-panel-imagen { position: relative; flex: 0 0 44%; overflow: hidden; background: #141518; }
  /* ---- Carrusel: todas las fotos apiladas y la activa con opacidad 1 ----
     Las fotos van SIEMPRE con su color original (sin tinte ni filtro),
     tal como pidió el ingeniero. */
  .login-carrusel { position: absolute; inset: 0; }
  .login-diapositiva {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; display: block; opacity: 0;
    transition: opacity 0.9s ease;
  }
  .login-diapositiva.activa { opacity: 1; }
  .login-puntos {
    position: absolute; left: 50%; bottom: 104px; transform: translateX(-50%);
    display: none; gap: 8px; z-index: 3;
  }
  .login-punto {
    width: 9px; height: 9px; padding: 0; border: none; border-radius: 50%;
    background: rgba(255,255,255,0.45); cursor: pointer; transition: transform .15s ease, background .15s ease;
  }
  .login-punto:hover { background: #ffffff; }
  .login-punto.activo { background: #ffffff; transform: scale(1.35); }
  .login-panel-imagen::after {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(12,13,16,0) 50%, rgba(12,13,16,0.55) 100%);
  }
  .login-marca {
    position: absolute; left: 22px; bottom: 22px; z-index: 2;
    display: flex; align-items: center; gap: 12px;
    background: #ffffff; border-radius: 12px; padding: 11px 18px;
    box-shadow: 0 10px 26px rgba(0,0,0,0.22);
  }
  .login-marca-logo { height: 42px; width: auto; display: block; }
  .login-marca-texto { font-size: 15px; font-weight: 800; line-height: 1.05; letter-spacing: 0.4px; color: #0F172A; }
  .login-marca-texto b { display: block; color: #16104A; font-weight: 800; }

  /* ---------------- PANEL DERECHO: FORMULARIO ---------------- */
  .login-panel-form { flex: 1 1 auto; min-width: 0; padding: 44px 50px; display: flex; flex-direction: column; justify-content: center; }
  .login-marca-sitio { margin-bottom: 30px; }
  .login-titulo { margin: 0; font-size: 27px; line-height: 1.14; font-weight: 800; letter-spacing: 0.4px; color: #0F172A; text-transform: uppercase; }
  .login-kicker {
    display: flex; align-items: center; gap: 10px; margin: 14px 0 0;
    color: #16104A; font-size: 12px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase;
  }
  .login-kicker::before { content: ""; width: 34px; height: 3px; border-radius: 2px; background: #16104A; flex: none; }

  .login-titulo-form { margin: 0 0 6px; text-align: center; font-size: 21px; font-weight: 700; color: #0F172A; }
  .login-pista { margin: 0 0 24px; text-align: center; color: #667085; font-size: 14px; }

  .login-etiqueta { display: block; font-size: 13px; font-weight: 600; color: #475467; margin-bottom: 7px; }
  .login-campo { position: relative; margin-bottom: 16px; }
  .login-input {
    width: 100%; box-sizing: border-box; padding: 12px 14px;
    border: 1px solid #D5D9E3; border-radius: 10px; background: #ffffff;
    color: #0F172A; font-size: 14px; font-family: inherit; outline: none;
    transition: border-color .15s ease, box-shadow .15s ease;
  }
  .login-input::placeholder { color: #98A2B3; }
  .login-input:focus { border-color: #16104A; box-shadow: 0 0 0 3px rgba(22,16,74,0.15); }
  .login-campo-con-ojo .login-input { padding-right: 46px; }
  .login-ojo {
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    width: 34px; height: 34px; padding: 0; border: none; background: transparent;
    color: #98A2B3; font-size: 15px; cursor: pointer; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; transition: color .15s ease, background .15s ease;
  }
  .login-ojo:hover { color: #16104A; background: rgba(22,16,74,0.08); }

  .login-error { color: #D92D20; font-size: 12.5px; min-height: 16px; margin: -4px 0 12px 0; }
  .login-boton {
    width: 100%; padding: 14px; border: none; border-radius: 10px;
    background: rgba(237, 183, 49, 1); color: #16104A; font-weight: 700; font-size: 15px;
    font-family: inherit; cursor: pointer; transition: background .15s ease, transform .1s ease;
  }
  .login-boton:hover { background: rgba(224, 166, 36, 1); }
  .login-boton:active { transform: translateY(1px); }
  .login-boton:disabled { background: #98A2B3; color: #ffffff; cursor: not-allowed; }
  .login-enlace { text-align: center; color: #667085; font-size: 13.5px; margin: 18px 0 0 0; }
  .login-enlace a { color: #16104A; font-weight: 700; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }

  /* ---------------- ROL DETECTADO (crear cuenta) ----------------
     No se elige con una lista: la persona escribe su correo y este recuadro
     aparece solo, con el rol que le corresponde. */
  .login-rol-detectado {
    margin: 0 0 16px; padding: 10px 14px; border-radius: 10px;
    background: rgba(22,16,74,0.07); border: 1px solid rgba(22,16,74,0.25);
    color: #16104A; font-size: 13px; font-weight: 700; text-align: center;
    display: none;
  }

  /* ---------------- PANTALLAS ANGOSTAS ---------------- */
  @media (max-width: 900px) {
    .login-panel-imagen { display: none; }
    .login-tarjeta { min-height: auto; }
    .login-panel-form { padding: 34px 26px; }
  }
`;

function inyectarEstilos() {
  if (document.getElementById("estilos-login")) return;
  const style = document.createElement("style");
  style.id = "estilos-login";
  style.textContent = ESTILOS;
  document.head.appendChild(style);
}

// Si el logo institucional no carga (lo tenemos de una URL externa), se oculta
// y la insignia se queda solo con el texto: nunca queda un icono roto.
function ocultarLogoSiFalla(contenedor: ParentNode): void {
  const logo = contenedor.querySelector<HTMLImageElement>(".login-marca-logo");
  if (!logo) return;
  const fallo = () => {
    logo.style.display = "none";
  };
  logo.addEventListener("error", fallo);
  if (logo.complete && logo.naturalWidth === 0) fallo();
}

// CARRUSEL del panel de imagen: avanza solo cada 5 s, se puede ir a una foto
// con los puntitos y descarta sola las imágenes que no existan todavía.
function iniciarCarrusel(raiz: HTMLElement): void {
  const lienzo = raiz.querySelector<HTMLElement>(".login-carrusel");
  const cajaPuntos = raiz.querySelector<HTMLElement>(".login-puntos");
  if (!lienzo || !cajaPuntos) return;

  const todas = Array.from(lienzo.querySelectorAll<HTMLImageElement>("img"));
  let indice = 0;
  let reloj: number | null = null;

  const vivas = () => todas.filter((img) => img.dataset.rota !== "1");

  // Flechas y no `function`: así TypeScript mantiene el narrowing de "no es null"
  // dentro del cuerpo de cada una.
  const pintar = (): void => {
    const lista = vivas();
    if (lista.length === 0) return;
    if (indice >= lista.length) indice = 0;
    todas.forEach((img) => img.classList.remove("activa"));
    lista[indice].classList.add("activa");
    cajaPuntos.querySelectorAll(".login-punto").forEach((punto, num) => {
      punto.classList.toggle("activo", num === indice);
    });
  };

  const reiniciar = (): void => {
    if (reloj) clearInterval(reloj);
    reloj = window.setInterval(() => {
      indice++;
      pintar();
    }, 5000);
  };

  const pintarPuntos = (): void => {
    const lista = vivas();
    cajaPuntos.innerHTML = "";
    cajaPuntos.style.display = lista.length > 1 ? "flex" : "none";
    lista.forEach((_img, num) => {
      const punto = document.createElement("button");
      punto.type = "button";
      punto.className = "login-punto" + (num === indice ? " activo" : "");
      punto.setAttribute("aria-label", `Imagen ${num + 1} del carrusel`);
      punto.addEventListener("click", () => {
        indice = num;
        pintar();
        reiniciar();
      });
      cajaPuntos.appendChild(punto);
    });
  };

  for (const img of todas) {
    img.addEventListener("error", () => {
      const candidatos = JSON.parse(img.dataset.candidatos ?? "[]") as string[];
      const actual = Number(img.dataset.i ?? 0);
      if (actual + 1 < candidatos.length) {
        // Todavía queda por probar otro nombre (.jpg, .jpeg, .png…)
        img.dataset.i = String(actual + 1);
        img.src = candidatos[actual + 1];
        return;
      }
      // Ninguna variante carga: la foto se retira y se repintan los puntitos.
      img.dataset.rota = "1";
      img.classList.remove("activa");
      pintarPuntos();
      pintar();
    });
  }

  pintarPuntos();
  pintar();
  reiniciar();
}

// Ojo de la contraseña: alterna password/text y cambia el icono.
function vincularOjo(campo: HTMLInputElement, boton: HTMLButtonElement): void {
  boton.addEventListener("click", () => {
    const oculta = campo.type === "password";
    campo.type = oculta ? "text" : "password";
    boton.innerHTML = oculta
      ? '<i class="fa-solid fa-eye-slash"></i>'
      : '<i class="fa-solid fa-eye"></i>';
    boton.setAttribute(
      "aria-label",
      oculta ? "Ocultar contraseña" : "Mostrar contraseña",
    );
    campo.focus();
  });
}

// Igual que detectarRolPorCorreo, pero devuelve null mientras el correo todavía
// se está escribiendo: así no le grita "Invitado!" a mitad de @usantoto.edu.co.
function detectarMientrasSeEscribe(correo: string): Rol | null {
  const limpio = correo.trim().toLowerCase();
  if (limpio.length < 5 || !limpio.includes("@")) return null;

  const dominio = limpio.split("@")[1] ?? "";
  if (dominio.length === 0) return null;

  // "@usantoto.e" a medio escribir: todavía no sabemos nada.
  const institucional = "usantoto.edu.co";
  if (dominio.length < institucional.length && institucional.startsWith(dominio)) {
    return null;
  }

  return detectarRolPorCorreo(limpio);
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
    <div class="login-tarjeta">
      <div class="login-panel-form">
        ${MARCA_SITIO}

        <h2 class="login-titulo-form">Iniciar sesión</h2>
        <p class="login-pista">Ingrese con su correo institucional</p>

        <label class="login-etiqueta" for="campoCorreo">Correo institucional</label>
        <div class="login-campo">
          <input id="campoCorreo" class="login-input" type="email" placeholder="usuario@usantoto.edu.co" />
        </div>

        <label class="login-etiqueta" for="campoContrasena">Contraseña</label>
        <div class="login-campo login-campo-con-ojo">
          <input id="campoContrasena" class="login-input" type="password" placeholder="••••••••" />
          <button type="button" class="login-ojo" id="botonOjo" aria-label="Mostrar contraseña">
            <i class="fa-solid fa-eye"></i>
          </button>
        </div>

        <p class="login-error" id="mensajeError"></p>

        <button class="login-boton" id="botonLogin">Ingresar</button>

        <p class="login-enlace">¿Primera vez aquí? <a id="enlaceRegistro">Crear cuenta</a></p>
      </div>

      ${PANEL_IMAGEN}
    </div>
  `;

  document.body.appendChild(overlay);
  ocultarLogoSiFalla(overlay);
  iniciarCarrusel(overlay);

  const campoCorreo = overlay.querySelector<HTMLInputElement>("#campoCorreo")!;
  const campoContrasena =
    overlay.querySelector<HTMLInputElement>("#campoContrasena")!;
  const botonOjo = overlay.querySelector<HTMLButtonElement>("#botonOjo")!;
  const mensajeError =
    overlay.querySelector<HTMLParagraphElement>("#mensajeError")!;
  const botonLogin = overlay.querySelector<HTMLButtonElement>("#botonLogin")!;
  const enlaceRegistro =
    overlay.querySelector<HTMLAnchorElement>("#enlaceRegistro")!;

  vincularOjo(campoContrasena, botonOjo);

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
        botonLogin.textContent = "Ingresar";
        return;
      }

      guardarSesion(data.cuenta.correo, data.cuenta, data.token);
      overlay.remove();
      alIniciarSesion(data.cuenta);
    } catch (err) {
      mensajeError.textContent = "No se pudo conectar con el servidor.";
      botonLogin.disabled = false;
      botonLogin.textContent = "Ingresar";
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
    <div class="login-tarjeta">
      <div class="login-panel-form">
        ${MARCA_SITIO}

        <h2 class="login-titulo-form">Crear cuenta</h2>
        <p class="login-pista">Únete al campus virtual USTA Tunja</p>

        <label class="login-etiqueta" for="campoNombre">Nombre completo</label>
        <div class="login-campo">
          <input id="campoNombre" class="login-input" type="text" placeholder="Tu nombre completo" />
        </div>

        <label class="login-etiqueta" for="campoCorreo">Correo</label>
        <div class="login-campo">
          <input id="campoCorreo" class="login-input" type="email" placeholder="nombre.apellido@usantoto.edu.co" />
        </div>

        <p class="login-rol-detectado" id="rolDetectado"></p>

        <label class="login-etiqueta" for="campoContrasena">Contraseña</label>
        <div class="login-campo login-campo-con-ojo">
          <input id="campoContrasena" class="login-input" type="password" placeholder="••••••••" />
          <button type="button" class="login-ojo" id="botonOjo" aria-label="Mostrar contraseña">
            <i class="fa-solid fa-eye"></i>
          </button>
        </div>

        <div id="zonaEstudiante" style="display:none;">
          <label class="login-etiqueta" for="campoCarrera">Carrera</label>
          <div class="login-campo">
            <input id="campoCarrera" class="login-input" type="text" placeholder="Ej: Ingeniería de Sistemas" />
          </div>
        </div>

        <div id="zonaDocente" style="display:none;">
          <label class="login-etiqueta" for="campoMateria">Materia que dicta</label>
          <div class="login-campo">
            <input id="campoMateria" class="login-input" type="text" placeholder="Ej: Cálculo II" />
          </div>
        </div>

        <p class="login-error" id="mensajeError"></p>

        <button class="login-boton" id="botonRegistrar">Registrarme</button>

        <p class="login-enlace">¿Ya tienes cuenta? <a id="enlaceLogin">Inicia sesión</a></p>
      </div>

      ${PANEL_IMAGEN}
    </div>
  `;

  document.body.appendChild(overlay);
  ocultarLogoSiFalla(overlay);
  iniciarCarrusel(overlay);

  const campoNombre = overlay.querySelector<HTMLInputElement>("#campoNombre")!;
  const campoCorreo = overlay.querySelector<HTMLInputElement>("#campoCorreo")!;
  const campoContrasena =
    overlay.querySelector<HTMLInputElement>("#campoContrasena")!;
  const botonOjo = overlay.querySelector<HTMLButtonElement>("#botonOjo")!;
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

  vincularOjo(campoContrasena, botonOjo);

  // Mientras escribes el correo: aparece el recuadro con el rol detectado y
  // se abren los campos extra de ese rol (carrera / materia).
  const refrescarRol = (correo: string): void => {
    const rol = detectarMientrasSeEscribe(correo);

    if (rol === null) {
      rolDetectadoDiv.style.display = "none";
      zonaEstudiante.style.display = "none";
      zonaDocente.style.display = "none";
      return;
    }

    rolDetectadoDiv.style.display = "block";
    rolDetectadoDiv.textContent = `Rol detectado: ${ETIQUETAS_ROL[rol]}`;

    // Estudiante e invitado ven el campo de carrera; docente y admin no lo necesitan
    zonaEstudiante.style.display =
      rol === "estudiante" || rol === "invitado" ? "block" : "none";
    zonaDocente.style.display = rol === "docente" ? "block" : "none";
  };

  campoCorreo.addEventListener("input", () =>
    refrescarRol(campoCorreo.value.trim()),
  );

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

      guardarSesion(data.cuenta.correo, data.cuenta, data.token);
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
