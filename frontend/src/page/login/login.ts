import { guardarSesion, detectarRolPorCorreo } from "../../state/estado";
import type { Cuenta, Rol } from "../../state/estado";
import "@fortawesome/fontawesome-free/css/all.min.css";

import { API_URL } from "../../api/cliente";
import {
  actualizarPreferencia,
  inyectarTema,
  leerPreferencias,
} from "../../state/preferencias";
import type { Idioma, Tema } from "../../state/preferencias";
import { t } from "../../state/idioma";
import { escribirPantallaEnLaUrl } from "../../state/enlaceClase";
import { LOGO_URL } from "../dashboard/dashboardEstilos";

// El bloque de imagen que se repite en el login y en el registro.
// Es un CARRUSEL: cada entrada es la lista de nombres que se prueban en orden
// (por si la imagen está en .jpeg, .jpg o .png). Si ningún nombre carga, la
// diapositiva se descarta sola y el carrusel sigue con las que sí existan.
// Fotos reales del carrusel: login.jpeg, login1.jpeg, login2.jpeg, login3.jpeg
const IMAGENES_LOGIN: string[][] = [
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
  </div>
`;

// Encabezado de marca que encabeza el formulario (logo centrado + título).
function marcaSitio(): string {
  return `
  <div class="login-marca-sitio">
    <img class="login-logo" src="${LOGO_URL}" alt="${t("comun.universidad")}" />
    <h1 class="login-titulo">${t("login.titulo")}</h1>
    <p class="login-kicker">${t("login.kicker")}</p>
  </div>
`;
}

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
    position: relative;
    margin: auto; display: flex; width: min(1040px, 100%); min-height: 620px;
    background: var(--c-vidrio-fondo);
    -webkit-backdrop-filter: blur(24px) saturate(1.15);
    backdrop-filter: blur(24px) saturate(1.15);
    border: 1px solid var(--c-vidrio-borde);
    border-radius: 20px; overflow: hidden;
    box-shadow: 0 34px 80px rgba(2,6,23,0.5), inset 0 1px 0 var(--c-vidrio-brillo);
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
    background: var(--c-superficie); border-radius: 12px; padding: 11px 18px;
    box-shadow: 0 10px 26px rgba(0,0,0,0.22);
  }
  .login-marca-logo { height: 42px; width: auto; display: block; }
  .login-marca-texto { font-size: 15px; font-weight: 800; line-height: 1.05; letter-spacing: 0.4px; color: var(--c-texto); }
  .login-marca-texto b { display: block; color: var(--c-marca); font-weight: 800; }

  /* ---------------- PANEL DERECHO: FORMULARIO ---------------- */
  /* padding-topAmplio: deja el hueco del selector de idioma/tema */
  .login-panel-form { flex: 1 1 auto; min-width: 0; padding: 64px 50px 44px; display: flex; flex-direction: column; justify-content: center; }
  .login-marca-sitio { margin-bottom: 30px; }
  /* Logo del campus virtual: centrado sobre el título (misma imagen que
     usa el dashboard). Si la URL externa falla, ocultarLogoSiFalla lo
     oculta y no queda ningún icono roto. */
  .login-logo { display: block; height: 64px; width: auto; max-width: 100%; margin: 0 auto 18px; object-fit: contain; }
  .login-titulo { margin: 0; font-size: 27px; line-height: 1.14; font-weight: 800; letter-spacing: 0.4px; color: var(--c-texto); text-transform: uppercase; }
  .login-kicker {
    display: flex; align-items: center; gap: 10px; margin: 14px 0 0;
    color: var(--c-marca); font-size: 12px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase;
  }
  .login-kicker::before { content: ""; width: 34px; height: 3px; border-radius: 2px; background: var(--c-marca); flex: none; }

  .login-titulo-form { margin: 0 0 6px; text-align: center; font-size: 21px; font-weight: 700; color: var(--c-texto); }
  .login-pista { margin: 0 0 24px; text-align: center; color: var(--c-texto-suave); font-size: 14px; }

  .login-etiqueta { display: block; font-size: 13px; font-weight: 600; color: var(--c-texto-suave); margin-bottom: 7px; }
  .login-campo { position: relative; margin-bottom: 16px; }
  .login-input {
    width: 100%; box-sizing: border-box; padding: 12px 14px;
    border: 1px solid var(--c-borde); border-radius: 10px; background: var(--c-superficie);
    color: var(--c-texto); font-size: 14px; font-family: inherit; outline: none;
    transition: border-color .15s ease, box-shadow .15s ease;
  }
  .login-input::placeholder { color: var(--c-texto-tenue); }
  .login-input:focus { border-color: var(--c-marca); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-marca) 15%, transparent); }
  .login-campo-con-ojo .login-input { padding-right: 46px; }
  .login-ojo {
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    width: 34px; height: 34px; padding: 0; border: none; background: transparent;
    color: var(--c-texto-tenue); font-size: 15px; cursor: pointer; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; transition: color .15s ease, background .15s ease;
  }
  .login-ojo:hover { color: var(--c-marca); background: color-mix(in srgb, var(--c-marca) 8%, transparent); }

  .login-error { color: var(--c-error); font-size: 12.5px; min-height: 16px; margin: -4px 0 12px 0; }
  .login-boton {
    width: 100%; padding: 14px; border: none; border-radius: 10px;
    background: var(--c-acento); color: var(--c-texto-boton); font-weight: 700; font-size: 15px;
    font-family: inherit; cursor: pointer; transition: background .15s ease, transform .1s ease;
  }
  .login-boton:hover { background: var(--c-acento-hover); }
  .login-boton:active { transform: translateY(1px); }
  .login-boton:disabled { background: var(--c-texto-tenue); color: #ffffff; cursor: not-allowed; }
  .login-enlace { text-align: center; color: var(--c-texto-suave); font-size: 13.5px; margin: 18px 0 0 0; }
  .login-enlace a { color: var(--c-marca); font-weight: 700; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }

  /* ---------------- ROL DETECTADO (crear cuenta) ----------------
     No se elige con una lista: la persona escribe su correo y este recuadro
     aparece solo, con el rol que le corresponde. */
  .login-rol-detectado {
    margin: 0 0 16px; padding: 10px 14px; border-radius: 10px;
    background: color-mix(in srgb, var(--c-marca) 7%, transparent); border: 1px solid color-mix(in srgb, var(--c-marca) 25%, transparent);
    color: var(--c-marca); font-size: 13px; font-weight: 700; text-align: center;
    display: none;
  }

  /* ---------------- SELECTOR DE IDIOMA / TEMA ----------------
     Va arriba a la derecha de la tarjeta para poder cambiar el
     idioma ANTES de entrar, sin cuenta. */
  .login-selector {
    position: absolute; top: 16px; right: 16px; z-index: 5;
    display: flex; align-items: center; gap: 6px;
  }
  .login-selector-grupo {
    display: inline-flex; gap: 3px; padding: 3px;
    background: color-mix(in srgb, var(--c-sombra) 22%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-texto) 12%, transparent);
    border-radius: 9px;
    backdrop-filter: blur(6px);
  }
  .login-selector-opcion {
    min-width: 34px; padding: 5px 9px; border: 1px solid transparent;
    border-radius: 6px; background: transparent; color: var(--c-texto-suave);
    font-family: inherit; font-size: 11.5px; font-weight: 700;
    letter-spacing: 0.3px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 5px;
    transition: background .15s ease, color .15s ease, border-color .15s ease;
  }
  .login-selector-opcion:hover { color: var(--c-texto); }
  .login-selector-opcion[aria-pressed="true"] {
    background: var(--c-superficie); border-color: var(--c-borde); color: var(--c-texto);
  }
  .login-selector-opcion:focus-visible {
    outline: 2px solid var(--c-acento); outline-offset: 2px;
  }
  .login-selector-tema { min-width: 32px; }

  /* ---------------- PANTALLAS ANGOSTAS ---------------- */
  @media (max-width: 900px) {
    .login-panel-imagen { display: none; }
    .login-tarjeta { min-height: auto; }
    .login-panel-form { padding: 58px 26px 34px; }
  }
  /* Selector más pequeño cuando la tarjeta es angosta */
  @media (max-width: 560px) {
    .login-selector { top: 12px; right: 12px; }
    .login-selector-opcion { min-width: 28px; padding: 5px 7px; }
  }
`;

function inyectarEstilos() {
  if (document.getElementById("estilos-login")) return;
  const style = document.createElement("style");
  style.id = "estilos-login";
  style.textContent = ESTILOS;
  document.head.appendChild(style);
}

// Selector de idioma y tema del login: como el idioma cambia TODOS los
// textos de la pantalla, al pulsarlo se vuelve a pintar el formulario
// entero (no hace falta estar dentro de una cuenta).
function selectorIdiomaYTema(): string {
  const actual = leerPreferencias();

  return `
    <div class="login-selector">
      <div class="login-selector-grupo" role="group" aria-label="${t("ajustes.idioma")}">
        <button
          class="login-selector-opcion"
          type="button"
          data-login-idioma="es"
          aria-pressed="${actual.idioma === "es"}"
          aria-label="${t("ajustes.idiomaEs")}"
        >ES</button>
        <button
          class="login-selector-opcion"
          type="button"
          data-login-idioma="en"
          aria-pressed="${actual.idioma === "en"}"
          aria-label="${t("ajustes.idiomaEn")}"
        >EN</button>
      </div>

      <div class="login-selector-grupo">
        <button
          class="login-selector-opcion login-selector-tema"
          type="button"
          id="botonTemaLogin"
          aria-label="${t("ajustes.tema")}"
          aria-pressed="${actual.tema === "oscuro"}"
          title="${t("ajustes.tema")}"
        >
          <i class="fa-solid ${actual.tema === "oscuro" ? "fa-moon" : "fa-sun"}"></i>
        </button>
      </div>
    </div>
  `;
}

/**
 * Conecta el selector del login. `repintar` vuelve a dibujar el
 * formulario con el idioma/tema nuevo.
 */
function conectarSelectorLogin(
  overlay: HTMLElement,
  repintar: () => void,
): void {
  overlay
    .querySelectorAll<HTMLButtonElement>("[data-login-idioma]")
    .forEach((boton) => {
      boton.addEventListener("click", () => {
        const idioma = boton.dataset.loginIdioma as Idioma;

        if (idioma !== leerPreferencias().idioma) {
          actualizarPreferencia({ idioma });
        }

        repintar();
      });
    });

  const botonTema = overlay.querySelector<HTMLButtonElement>("#botonTemaLogin");

  botonTema?.addEventListener("click", () => {
    const tema: Tema =
      leerPreferencias().tema === "oscuro" ? "claro" : "oscuro";

    actualizarPreferencia({ tema });
    repintar();
  });
}

// Si el logo institucional no carga (lo tenemos de una URL externa), se oculta
// y la insignia se queda solo con el texto: nunca queda un icono roto.
function ocultarLogoSiFalla(contenedor: ParentNode): void {
  const logo = contenedor.querySelector<HTMLImageElement>(".login-logo");
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
      punto.setAttribute(
        "aria-label",
        t("login.carruselImagen", { n: num + 1 }),
      );
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
      oculta
        ? t("login.ariaOcultarContrasena")
        : t("login.ariaMostrarContrasena"),
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
  // La dirección identifica la pantalla: sin cuenta se vive en /login,
  // así que abrir localhost:5173 queda en localhost:5173/login.
  escribirPantallaEnLaUrl("/login");

  inyectarTema();
  inyectarEstilos();
  mostrarFormularioLogin(alIniciarSesion);
}

function mostrarFormularioLogin(
  alIniciarSesion: (cuenta: Cuenta) => void,
  estado: { correo?: string; contrasena?: string; visible?: boolean } = {},
): void {
  const overlay = document.createElement("div");
  overlay.className = "login-overlay";

  overlay.innerHTML = `
    <div class="login-tarjeta">
      ${selectorIdiomaYTema()}
      <div class="login-panel-form">
        ${marcaSitio()}

        <h2 class="login-titulo-form">${t("login.tituloIniciarSesion")}</h2>
        <p class="login-pista">${t("login.pistaCorreo")}</p>

        <label class="login-etiqueta" for="campoCorreo">${t("perfil.correo")}</label>
        <div class="login-campo">
          <input id="campoCorreo" class="login-input" type="email" placeholder="usuario@usantoto.edu.co" value="${estado.correo ?? ""}" />
        </div>

        <label class="login-etiqueta" for="campoContrasena">${t("perfil.contrasenaTitulo")}</label>
        <div class="login-campo login-campo-con-ojo">
          <input id="campoContrasena" class="login-input" type="${estado.visible ? "text" : "password"}" placeholder="••••••••" value="${estado.contrasena ?? ""}" />
          <button type="button" class="login-ojo" id="botonOjo" aria-label="${t(estado.visible ? "login.ariaOcultarContrasena" : "login.ariaMostrarContrasena")}">
            <i class="fa-solid ${estado.visible ? "fa-eye-slash" : "fa-eye"}"></i>
          </button>
        </div>

        <p class="login-error" id="mensajeError"></p>

        <button class="login-boton" id="botonLogin">${t("login.botonIngresar")}</button>

        <p class="login-enlace">${t("login.primeraVez")} <a id="enlaceRegistro">${t("login.crearCuenta")}</a></p>
      </div>

      ${PANEL_IMAGEN}
    </div>
  `;

  document.body.appendChild(overlay);
  ocultarLogoSiFalla(overlay);
  iniciarCarrusel(overlay);

  // Cambiar el idioma repinta la pantalla: se guardan los valores escritos
  // y el tipo del campo de contraseña para no perder lo que ya iba.
  const recordar = (raiz: HTMLElement) => ({
    correo: raiz.querySelector<HTMLInputElement>("#campoCorreo")?.value ?? "",
    contrasena:
      raiz.querySelector<HTMLInputElement>("#campoContrasena")?.value ?? "",
    visible: raiz.querySelector<HTMLInputElement>("#campoContrasena")?.type === "text",
  });

  const repintarLogin = (): void => {
    const estado = recordar(overlay);

    overlay.remove();

    // El tipo del campo de contraseña y el icono del ojo se vuelven a
    // pintar desde `estado.visible`, así que no hay que tocar nada más.
    mostrarFormularioLogin(alIniciarSesion, estado);
  };

  conectarSelectorLogin(overlay, repintarLogin);

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
      mensajeError.textContent = t("login.msg.camposVacios");
      return;
    }

    mensajeError.textContent = "";
    botonLogin.disabled = true;
    botonLogin.textContent = t("login.msg.cargando");

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, contrasena }),
      });

      const data = await res.json();

      if (!res.ok) {
        mensajeError.textContent = data.error || t("login.msg.errorSesion");
        botonLogin.disabled = false;
        botonLogin.textContent = t("login.botonIngresar");
        return;
      }

      guardarSesion(data.cuenta.correo, data.cuenta, data.token);
      overlay.remove();
      alIniciarSesion(data.cuenta);
    } catch (err) {
      mensajeError.textContent = t("perfil.msg.sinServidor");
      botonLogin.disabled = false;
      botonLogin.textContent = t("login.botonIngresar");
    }
  });

  enlaceRegistro.addEventListener("click", () => {
    overlay.remove();

    mostrarFormularioRegistro(alIniciarSesion, {
      correo: campoCorreo.value.trim(),
    });
  });
}

function mostrarFormularioRegistro(
  alIniciarSesion: (cuenta: Cuenta) => void,
  estado: {
    nombre?: string;
    correo?: string;
    contrasena?: string;
    visible?: boolean;
    carrera?: string;
    materia?: string;
  } = {},
): void {
  const overlay = document.createElement("div");
  overlay.className = "login-overlay";

  overlay.innerHTML = `
    <div class="login-tarjeta">
      ${selectorIdiomaYTema()}
      <div class="login-panel-form">
        ${marcaSitio()}

        <h2 class="login-titulo-form">${t("login.crearCuenta")}</h2>
        <p class="login-pista">${t("login.pistaRegistro")}</p>

        <label class="login-etiqueta" for="campoNombre">${t("perfil.nombre")}</label>
        <div class="login-campo">
          <input id="campoNombre" class="login-input" type="text" placeholder="${t("login.ph.nombre")}" value="${estado.nombre ?? ""}" />
        </div>

        <label class="login-etiqueta" for="campoCorreo">${t("login.correo")}</label>
        <div class="login-campo">
          <input id="campoCorreo" class="login-input" type="email" placeholder="nombre.apellido@usantoto.edu.co" value="${estado.correo ?? ""}" />
        </div>

        <p class="login-rol-detectado" id="rolDetectado"></p>

        <label class="login-etiqueta" for="campoContrasena">${t("perfil.contrasenaTitulo")}</label>
        <div class="login-campo login-campo-con-ojo">
          <input id="campoContrasena" class="login-input" type="${estado.visible ? "text" : "password"}" placeholder="••••••••" value="${estado.contrasena ?? ""}" />
          <button type="button" class="login-ojo" id="botonOjo" aria-label="${t(estado.visible ? "login.ariaOcultarContrasena" : "login.ariaMostrarContrasena")}">
            <i class="fa-solid ${estado.visible ? "fa-eye-slash" : "fa-eye"}"></i>
          </button>
        </div>

        <div id="zonaEstudiante" style="display:none;">
          <label class="login-etiqueta" for="campoCarrera">${t("perfil.carrera")}</label>
          <div class="login-campo">
            <input id="campoCarrera" class="login-input" type="text" placeholder="${t("login.ph.carrera")}" value="${estado.carrera ?? ""}" />
          </div>
        </div>

        <div id="zonaDocente" style="display:none;">
          <label class="login-etiqueta" for="campoMateria">${t("login.materiaDicta")}</label>
          <div class="login-campo">
            <input id="campoMateria" class="login-input" type="text" placeholder="${t("login.ph.materia")}" value="${estado.materia ?? ""}" />
          </div>
        </div>

        <p class="login-error" id="mensajeError"></p>

        <button class="login-boton" id="botonRegistrar">${t("login.botonRegistrarme")}</button>

        <p class="login-enlace">${t("login.yaTienesCuenta")} <a id="enlaceLogin">${t("login.enlaceIniciaSesion")}</a></p>
      </div>

      ${PANEL_IMAGEN}
    </div>
  `;

  document.body.appendChild(overlay);
  ocultarLogoSiFalla(overlay);
  iniciarCarrusel(overlay);

  // Igual que en el login: cambiar el idioma repinta y conserva lo escrito.
  const repintarRegistro = (): void => {
    const campo = (sel: string): string =>
      overlay.querySelector<HTMLInputElement>(sel)?.value ?? "";

    // Se lee TODO antes de quitar la pantalla: luego el repintado
    // vuelve a crearla con estos mismos valores.
    const estado = {
      nombre: campo("#campoNombre"),
      correo: campo("#campoCorreo"),
      contrasena: campo("#campoContrasena"),
      visible:
        overlay.querySelector<HTMLInputElement>("#campoContrasena")?.type ===
        "text",
      carrera: campo("#campoCarrera"),
      materia: campo("#campoMateria"),
    };

    overlay.remove();

    mostrarFormularioRegistro(alIniciarSesion, estado);

    // El recuadro del rol y los campos extra (carrera/materia) dependen
    // del correo: se vuelven a calcular en la pantalla nueva.
    if (estado.correo) {
      overlay
        .querySelector<HTMLInputElement>("#campoCorreo")
        ?.dispatchEvent(new Event("input"));
    }
  };

  conectarSelectorLogin(overlay, repintarRegistro);

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
    rolDetectadoDiv.textContent = t("login.rolDetectado", {
      rol: t(`rol.${rol}`),
    });

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
      mensajeError.textContent = t("login.msg.nombreVacio");
      return;
    }
    if (!correo.includes("@")) {
      mensajeError.textContent = t("login.msg.correoInvalido");
      return;
    }
    if (contrasena.length < 6) {
      mensajeError.textContent = t("login.msg.contrasenaCorta");
      return;
    }

    mensajeError.textContent = "";
    botonRegistrar.disabled = true;
    botonRegistrar.textContent = t("login.msg.guardando");

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
          data.error || t("login.msg.errorRegistro");
        botonRegistrar.disabled = false;
        botonRegistrar.textContent = t("login.botonRegistrarme");
        return;
      }

      guardarSesion(data.cuenta.correo, data.cuenta, data.token);
      overlay.remove();
      alIniciarSesion(data.cuenta);
    } catch (err) {
      mensajeError.textContent = t("perfil.msg.sinServidor");
      botonRegistrar.disabled = false;
      botonRegistrar.textContent = t("login.botonRegistrarme");
    }
  });

  enlaceLogin.addEventListener("click", () => {
    overlay.remove();

    mostrarFormularioLogin(alIniciarSesion, {
      correo: campoCorreo.value.trim(),
    });
  });
}
