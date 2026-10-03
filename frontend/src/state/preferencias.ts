// ============================================================
// PREFERENCIAS DE LA CUENTA (en este navegador)
// ------------------------------------------------------------
// Tema (claro/oscuro), idioma (es/en) y accesibilidad
// (reducir animaciones). Se guardan en localStorage y se
// aplican sobre <html> como atributos data:
//
//   <html data-tema="oscuro" data-animaciones="reducidas" lang="en">
//
// Toda la plataforma (login, dashboard y menús del metaverso)
// cuelga de las variables CSS --c-* que definen estos estilos,
// así que cambiar el tema se nota en todas partes a la vez.
// ============================================================

export type Tema = "claro" | "oscuro";
export type Idioma = "es" | "en";

export interface Preferencias {
  tema: Tema;
  idioma: Idioma;
  reducirMovimiento: boolean;
}

const CLAVE = "usta_metaverso_preferencias";

const POR_DEFECTO: Preferencias = {
  tema: "claro",
  idioma: "es",
  reducirMovimiento: false,
};

// ============================================================
// PALETA
// ------------------------------------------------------------
// "claro" es la paleta profesional que ya usa el dashboard:
// superficies blancas, filetes grises y dorado #EDB732 solo
// como acento. "oscuro" es el mismo lenguaje sobre fondo
// carbón, sin colores fuertes.
// ============================================================

interface Tokens {
  fondo: string;
  superficie: string;
  "superficie-suave": string;
  borde: string;
  "borde-suave": string;
  texto: string;
  "texto-suave": string;
  "texto-tenue": string;
  acento: string;
  "acento-hover": string;
  "acento-suave": string;
  "acento-borde": string;
  "acento-tinto": string;
  "texto-boton": string;
  error: string;
  /** Verde de acción: pestañas y estados del panel de administración. */
  verde: string;
  "verde-hover": string;
  "verde-suave": string;
  "verde-borde": string;
  /** Color del texto sobre el verde sólido (contraste por tema). */
  "verde-texto": string;
  "rol-docente-fondo": string;
  "rol-docente-borde": string;
  "rol-docente-texto": string;
  "rol-alumno-fondo": string;
  "rol-alumno-borde": string;
  "rol-alumno-texto": string;
  sombra: string;
  /** Color de marca del login (enlaces, kicker, foco). */
  marca: string;
  /** Fondo suave de la insignia de marca. */
  "marca-suave": string;
  /** Vidrio de la tarjeta del login (fondo/borde/brillo). */
  "vidrio-fondo": string;
  "vidrio-borde": string;
  "vidrio-brillo": string;
}

const CLARO: Tokens = {
  fondo: "#f5f6f8",
  superficie: "#ffffff",
  "superficie-suave": "#f7f8fa",
  borde: "#e4e7ed",
  "borde-suave": "#eceff4",
  texto: "#14171f",
  "texto-suave": "#5d6577",
  "texto-tenue": "#98a0b0",
  acento: "#EDB732",
  "acento-hover": "#DFA51F",
  "acento-suave": "#FCF5E3",
  "acento-borde": "#F0E0B4",
  "acento-tinto": "#7A5A06",
  "texto-boton": "#241b04",
  error: "#b4524f",
  verde: "#15803D",
  "verde-hover": "#166534",
  "verde-suave": "#E9F6EE",
  "verde-borde": "#BBE3CB",
  "verde-texto": "#FFFFFF",
  "rol-docente-fondo": "#EDF1FB",
  "rol-docente-borde": "#D9E1F5",
  "rol-docente-texto": "#3E5693",
  "rol-alumno-fondo": "#E9F4EF",
  "rol-alumno-borde": "#D3E7DE",
  "rol-alumno-texto": "#3C7861",
  sombra: "#141924",
  marca: "#16104A",
  "marca-suave": "#EEEDF8",
  "vidrio-fondo": "rgba(255,255,255,0.86)",
  "vidrio-borde": "rgba(255,255,255,0.55)",
  "vidrio-brillo": "rgba(255,255,255,0.75)",
};

const OSCURO: Tokens = {
  fondo: "#0e1116",
  superficie: "#161a21",
  "superficie-suave": "#1c212a",
  borde: "#2a303b",
  "borde-suave": "#22272f",
  texto: "#e9ecf3",
  "texto-suave": "#a6adbe",
  "texto-tenue": "#7b8397",
  acento: "#EDB732",
  "acento-hover": "#F0C24A",
  "acento-suave": "#3a2f12",
  "acento-borde": "#6d5518",
  "acento-tinto": "#f2c76b",
  "texto-boton": "#241b04",
  error: "#e58481",
  verde: "#22C55E",
  "verde-hover": "#2FD471",
  "verde-suave": "#14301F",
  "verde-borde": "#2E6B45",
  "verde-texto": "#0B1F13",
  "rol-docente-fondo": "#1a2130",
  "rol-docente-borde": "#2b3550",
  "rol-docente-texto": "#9db3e8",
  "rol-alumno-fondo": "#16261f",
  "rol-alumno-borde": "#24402f",
  "rol-alumno-texto": "#86c7a8",
  sombra: "#000000",
  marca: "#EDB732",
  "marca-suave": "#20242e",
  "vidrio-fondo": "rgba(22,25,32,0.9)",
  "vidrio-borde": "rgba(255,255,255,0.12)",
  "vidrio-brillo": "rgba(255,255,255,0.06)",
};

function variables(tokens: Tokens): string {
  return (Object.keys(tokens) as (keyof Tokens)[])
    .map((clave) => `  --c-${clave}: ${tokens[clave]};`)
    .join("\n");
}

// ============================================================
// ESTILOS DEL TEMA (se inyectan una sola vez)
// ============================================================

export const ESTILO_TEMA = `
  :root {
${variables(CLARO)}
  }

  :root[data-tema="oscuro"] {
${variables(OSCURO)}
  }

  /* Accesibilidad: la persona pide menos movimiento y la
     interfaz deja de animar (transiciones y parpadeos). */
  :root[data-animaciones="reducidas"] *,
  :root[data-animaciones="reducidas"] *::before,
  :root[data-animaciones="reducidas"] *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
`;

// ============================================================
// LECTURA / GUARDADO / APLICACIÓN
// ============================================================

export function leerPreferencias(): Preferencias {
  try {
    const crudo = localStorage.getItem(CLAVE);

    if (!crudo) {
      return { ...POR_DEFECTO };
    }

    const datos = JSON.parse(crudo) as Partial<Preferencias>;

    return {
      tema: datos.tema === "oscuro" ? "oscuro" : "claro",
      idioma: datos.idioma === "en" ? "en" : "es",
      reducirMovimiento: datos.reducirMovimiento === true,
    };
  } catch {
    return { ...POR_DEFECTO };
  }
}

export function guardarPreferencias(preferencias: Preferencias): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(preferencias));
  } catch {
    // Algunos navegadores bloquean el almacenamiento: la
    // preferencia queda solo en esta sesión.
  }
}

/** Escribe los atribivos de tema/idioma/animación en <html>. */
export function aplicarPreferencias(): void {
  const datos = leerPreferencias();
  const raiz = document.documentElement;

  raiz.dataset.tema = datos.tema;
  raiz.dataset.animaciones = datos.reducirMovimiento
    ? "reducidas"
    : "normales";
  raiz.lang = datos.idioma;
}

/** true cuando la persona pidió menos movimiento. */
export function reducirMovimiento(): boolean {
  return leerPreferencias().reducirMovimiento;
}

/** Idioma elegido ("es" por defecto). */
export function idiomaActual(): Idioma {
  return leerPreferencias().idioma;
}

/** Guarda y aplica en un solo paso. Devuelve la preferencia final. */
export function actualizarPreferencia(
  cambios: Partial<Preferencias>,
): Preferencias {
  const siguientes: Preferencias = {
    ...leerPreferencias(),
    ...cambios,
  };

  guardarPreferencias(siguientes);
  aplicarPreferencias();

  return siguientes;
}

// ============================================================
// INYECCIÓN
// ============================================================

/**
 * Monta la hoja de variables CSS y aplica la preferencia
 * guardada. Es idempotente: se puede llamar desde el login,
 * el dashboard y el metaverso sin duplicar nada.
 */
export function inyectarTema(): void {
  if (!document.getElementById("estilos-tema")) {
    const style = document.createElement("style");

    style.id = "estilos-tema";
    style.textContent = ESTILO_TEMA;

    document.head.appendChild(style);
  }

  aplicarPreferencias();
}
