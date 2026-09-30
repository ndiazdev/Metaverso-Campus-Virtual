/**
 * DESCARGAR LA PIZARRA COMO PDF.
 *
 * ¿PDF o Word? PDF: sale un único archivo con TODAS las hojas tal y como se
 * ven en la pizarra, sin dependencias ni instalaciones. Word (docx) obligaría a
 * meter las imágenes dentro de un ZIP con formato OOXML: mucho más código para
 * un resultado peor (la hoja se vería como una imagen pegada).
 *
 * El PDF se escribe a mano: cabecera, catálogo, una página por hoja con su
 * imagen JPEG incrustada (filtro DCTDecode), tabla de referencias y pie. No
 * depende de ninguna librería, así que este archivo es una pieza cerrada que
 * cualquier mapa puede reutilizar.
 */

export interface PaginaPdf {
  /** Bytes JPEG de la hoja (lo que saca `canvas.toDataURL("image/jpeg")`). */
  jpeg: Uint8Array;
  ancho: number;
  alto: number;
}

/** A4 apaisado: el contenido se encaja dentro sin deformarse. */
const ANCHO_MAX_PUNTOS = 841.89;
const ALTO_MAX_PUNTOS = 595.28;

const enc = new TextEncoder();

function escaparTexto(texto: string): string {
  return texto
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function bytesDeTexto(texto: string): Uint8Array {
  return enc.encode(texto);
}

/**
 * Construye el PDF completo en memoria.
 *
 * Esquema de objetos: 1 Catálogo · 2 Páginas · 3 Info y, por cada hoja, tres
 * objetos (página, cadena de contenido e imagen). El orden en el que se
 * escriben marca la posición de cada objeto en el archivo, que es lo que luego
 * apunta la tabla `xref`.
 */
export function construirPdf(paginas: PaginaPdf[], titulo: string): Uint8Array<ArrayBuffer> {
  if (paginas.length === 0) throw new Error("No hay hojas que exportar.");

  const trozos: Uint8Array[] = [];
  let posicion = 0;
  const inicioDeObjeto: number[] = []; // índice 0 = objeto 1

  const empujar = (dato: Uint8Array | string): void => {
    const bytes = typeof dato === "string" ? bytesDeTexto(dato) : dato;
    trozos.push(bytes);
    posicion += bytes.length;
  };

  const empezarObjeto = (): void => {
    inicioDeObjeto.push(posicion);
    empujar(`${inicioDeObjeto.length} 0 obj\n`);
  };

  const terminarObjeto = (): void => {
    empujar("endobj\n");
  };

  empujar("%PDF-1.4\n");
  empujar(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // marca de binario

  const total = 3 + paginas.length * 3;

  // 1 · Catálogo
  empezarObjeto();
  empujar("<< /Type /Catalog /Pages 2 0 R >>\n");
  terminarObjeto();

  // 2 · Páginas
  empezarObjeto();
  const kids = paginas
    .map((_, i) => `${4 + i * 3} 0 R`)
    .join(" ");
  empujar(`<< /Type /Pages /Kids [${kids}] /Count ${paginas.length} >>\n`);
  terminarObjeto();

  // 3 · Info (título del documento)
  empezarObjeto();
  empujar(`<< /Title (${escaparTexto(titulo)}) >>\n`);
  terminarObjeto();

  paginas.forEach((pagina, i) => {
    const objetoPagina = 4 + i * 3;
    const objetoContenido = objetoPagina + 1;
    const objetoImagen = objetoPagina + 2;

    const escala = Math.min(
      ANCHO_MAX_PUNTOS / Math.max(1, pagina.ancho),
      ALTO_MAX_PUNTOS / Math.max(1, pagina.alto)
    );
    const ancho = +(pagina.ancho * escala).toFixed(2);
    const alto = +(pagina.alto * escala).toFixed(2);
    const nombreImagen = `Im${i}`;

    // Página
    empezarObjeto();
    empujar(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ancho} ${alto}] ` +
        `/Resources << /XObject << /${nombreImagen} ${objetoImagen} 0 R >> ` +
        `/ProcSet [/PDF /ImageC] >> ` +
        `/Contents ${objetoContenido} 0 R >>\n`
    );
    terminarObjeto();

    // Cadena de contenido: se escala el cuadro al tamaño de la página.
    const cadena = `q ${ancho} 0 0 ${alto} 0 0 cm /${nombreImagen} Do Q`;
    empezarObjeto();
    empujar(`<< /Length ${cadena.length} >>\nstream\n${cadena}\nendstream\n`);
    terminarObjeto();

    // Imagen JPEG incrustada tal cual.
    empezarObjeto();
    empujar(
      `<< /Type /XObject /Subtype /Image /Width ${pagina.ancho} /Height ${pagina.alto} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
        `/Length ${pagina.jpeg.length} >>\nstream\n`
    );
    empujar(pagina.jpeg);
    empujar("\nendstream\n");
    terminarObjeto();
  });

  const inicioXref = posicion;
  const totalObjetos = total + 1; // el 0 siempre existe (objeto libre)
  empujar(`xref\n0 ${totalObjetos}\n`);
  empujar("0000000000 65535 f \n");
  for (const inicio of inicioDeObjeto) {
    empujar(`${String(inicio).padStart(10, "0")} 00000 n \n`);
  }
  empujar(`trailer\n<< /Size ${totalObjetos} /Root 1 0 R /Info 3 0 R >>\n`);
  empujar(`startxref\n${inicioXref}\n%%EOF\n`);

  const salida = new Uint8Array(posicion);
  let cursor = 0;
  for (const trozo of trozos) {
    salida.set(trozo, cursor);
    cursor += trozo.length;
  }
  return salida;
}

/** Convierte lienzos de la pizarra en páginas listas para el PDF (JPEG). */
export function paginasDesdeLienzos(lienzos: HTMLCanvasElement[]): PaginaPdf[] {
  return lienzos.map((lienzo) => {
    const url = lienzo.toDataURL("image/jpeg", 0.92);
    const base64 = url.slice(url.indexOf(",") + 1);
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return { jpeg: bytes, ancho: lienzo.width, alto: lienzo.height };
  });
}

/** Guarda el PDF en el disco del que lo pidió. */
export function descargarPdf(nombre: string, paginas: PaginaPdf[]): void {
  const pdf = construirPdf(paginas, nombre);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre.toLowerCase().endsWith(".pdf") ? nombre : `${nombre}.pdf`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
