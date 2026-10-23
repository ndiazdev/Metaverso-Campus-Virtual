// ======================================================
// ENLACE DE CLASE EN LA DIRECCIÓN
// ------------------------------------------------------
// Una clase se abre por una dirección, no por un botón suelto:
//
//   http://localhost:5173/?clase=FIS-101
//
// Así el docente manda ese enlace por WhatsApp y el estudiante
// cae DIRECTO en el aula: al abrirlo, la app mira el parámetro,
// pregunta a la API de qué clase se trata y, si tiene permiso,
// entra sin pasar por el panel.
//
// El mismo parámetro sirve para el camino de vuelta: al entrar a
// una clase desde el panel, la dirección se actualiza sola. Así
// el estudiante puede copiar la barra del navegador y pasársela
// a otro compañero, y ambos acabarán en el mismo sitio.
//
// Formato del código: el mismo que genera el panel al crear la
// clase (3 letras + guion + 3 números, tipo FIS-101), así que
// aquí se limita a letras, números, guion y guion bajo: nada de
// barras ni comillas, que romperían la URL.
// ======================================================

/** Nombre del parámetro en la dirección. */
const PARAMETRO = "clase";

/** Un código de clase no puede ser arbitrario: se filtra antes de ir al servidor. */
const FORMATO_CODIGO = /^[A-Z0-9_-]{1,40}$/;

/**
 * Clase pedida en la dirección, o null si no hay.
 * Se normaliza a mayúsculas porque los códigos se guardan así en
 * MySQL ("fis-101" y "FIS-101" son la misma clase).
 */
export function leerClaseDeLaUrl(): string | null {
  try {
    const valor = new URLSearchParams(window.location.search).get(PARAMETRO);
    if (!valor) return null;

    const codigo = valor.trim().toUpperCase();
    return FORMATO_CODIGO.test(codigo) ? codigo : null;
  } catch {
    return null;
  }
}

/** Escribe (o quita) el parámetro de la dirección sin recargar la página. */
export function escribirClaseEnLaUrl(codigo: string | null): void {
  try {
    const url = new URL(window.location.href);
    if (codigo) {
      url.searchParams.set(PARAMETRO, codigo.trim().toUpperCase());
    } else {
      url.searchParams.delete(PARAMETRO);
    }
    // replaceState y no pushState a propósito: entrar y salir de clases
    // no debe llenar el historial del navegador de la misma pantalla (el
    // botón para volver al panel es el ⚙️ → Salir, no el "atrás").
    window.history.replaceState(null, "", url);
  } catch {
    // Si el navegador bloquea la API de historial (modo privado muy
    // restrictivo, iframe), la app sigue funcionando: solo se pierde el
    // identificador en la barra de direcciones.
  }
}

/**
 * Escribe la pantalla que se está viendo (/login o /dashboard) en la
 * dirección, SIN recargar: así abrir `localhost:5173` acaba en
 * `localhost:5173/login` y el panel queda en `/dashboard`, y la barra
 * de direcciones siempre dice dónde se está parado.
 *
 * Conserva los parámetros (p. ej. `?clase=FIS-101`) y, como aquí,
 * usa replaceState: cambiar de pantalla no llena el historial.
 */
export function escribirPantallaEnLaUrl(ruta: string): void {
  try {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    const url = new URL(window.location.href);
    let nuevaRuta = ruta.startsWith("/") ? ruta : `/${ruta}`;

    if (base && base !== "/") {
      nuevaRuta = `${base}${nuevaRuta}`;
    } else if (base === "/") {
      // Si está en raíz, se deja tal cual
    }

    if (url.pathname !== nuevaRuta) {
      url.pathname = nuevaRuta;
      window.history.replaceState(null, "", url);
    }
  } catch {
    // Sin API de historial la app sigue funcionando: solo no se
    // actualiza la barra de direcciones.
  }
}
