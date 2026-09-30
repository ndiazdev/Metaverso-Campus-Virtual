/**
 * HOMOGRAFÍA — pegar contenido HTML sobre una pizarra 3D en perspectiva.
 *
 * ¿Para qué sirve? El tablero del aula es un rectángulo plano en el mundo, pero
 * en pantalla se ve como un trapecio (según el ángulo desde el que miras). Si al
 * vídeo o al lienzo se le pone simplemente su "caja" (el trapecio metido en un
 * rectángulo), el contenido se desplaza con respecto a la pizarra cuando te
 * mueves: parece que te sigue en vez de quedarse clavado en la pizarra.
 *
 * La solución es pegar el contenido con una matriz de perspectiva (CSS
 * `matrix3d`) que mapea el rectángulo del elemento EXACTAMENTE sobre las cuatro
 * esquinas proyectadas de la pizarra. Así, a cualquier distancia y ángulo, el
 * contenido se deforma igual que lo haría en la pared: se queda estático.
 *
 * Todo es matemática pura (sin DOM ni Babylon), así que se puede probar en Node.
 */

export interface Punto {
  x: number;
  y: number;
}

/**
 * Resuelve la homografía que lleva `origen[i]` → `destino[i]` (8 puntos de
 * ecuación, sistema 8×8 con eliminación de Gauss).
 *
 * Se normaliza con h[8] = 1. Devuelve null si el sistema es degenerado (p. ej.
 * dos esquinas de destino casi iguales: la pizarra se ve de canto y la matriz
 * saldría infinita).
 */
export function homografia(origen: Punto[], destino: Punto[]): number[] | null {
  if (origen.length !== 4 || destino.length !== 4) return null;

  // Sistema:  x·h0 + y·h1 + h2 − u·x·h6 − u·y·h7 = u
  //           x·h3 + y·h4 + h5 − v·x·h6 − v·y·h7 = v
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = origen[i];
    const u = destino[i].x;
    const v = destino[i].y;

    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);

    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  const h = resolver8por8(a, b);
  if (!h) return null;

  // Autocomprobación: la solución tiene que llevar cada origen a su destino.
  // Si no (sistema casi singular: dos esquinas encimadas, fuga al infinito…)
  // mejor no devolver nada, que una matriz a medias estropea el CSS.
  for (let i = 0; i < 4; i++) {
    const p = aplicar(h, origen[i]);
    if (Math.hypot(p.x - destino[i].x, p.y - destino[i].y) > 1e-3) return null;
  }
  for (const c of h) {
    if (!Number.isFinite(c) || Math.abs(c) > 1e6) return null;
  }
  return h;
}

/** Aplica la homografía a un punto (con división por w, como hace el navegador). */
export function aplicar(h: number[], p: Punto): Punto {
  const w = h[6] * p.x + h[7] * p.y + 1;
  if (!Number.isFinite(w) || Math.abs(w) < 1e-9) return { x: 0, y: 0 };
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

/** Inversa de la homografía: pantalla → coordenadas locales del elemento. */
export function invertir(h: number[]): number[] | null {
  // Se pasa a matriz 3×3 con la última fila puesta a 1 (h[8] se asume 1).
  const m = [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1],
  ];
  const det =
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;

  const inv = [
    (m[1][1] * m[2][2] - m[1][2] * m[2][1]) / det,
    (m[0][2] * m[2][1] - m[0][1] * m[2][2]) / det,
    (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / det,
    (m[1][2] * m[2][0] - m[1][0] * m[2][2]) / det,
    (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / det,
    (m[0][2] * m[1][0] - m[0][0] * m[1][2]) / det,
    (m[1][0] * m[2][1] - m[1][1] * m[2][0]) / det,
    (m[0][1] * m[2][0] - m[0][0] * m[2][1]) / det,
    (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / det,
  ];

  // Se reescala para que el elemento h[8] valga 1, que es como las consume
  // `aplicar` (w = h6·x + h7·y + 1) y como pide CSS. Sin esto la ida y vuelta
  // sale descomunal, porque el denominador quedaría escalado.
  const normalizador = inv[8];
  if (!Number.isFinite(normalizador) || Math.abs(normalizador) < 1e-12) return null;
  return inv.map((v) => v / normalizador);
}

/**
 * Cadena CSS `matrix3d(...)` para una homografía.
 *
 * El navegador guarda la matriz en columnas: (col1, col2, col3, col4). La
 * tercera columna solo afecta a z y la cuarta es la de traslación/perspectiva.
 */
export function matriz3d(h: number[]): string {
  return (
    `matrix3d(${h[0]}, ${h[3]}, 0, ${h[6]}, ` +
    `${h[1]}, ${h[4]}, 0, ${h[7]}, ` +
    `0, 0, 1, 0, ` +
    `${h[2]}, ${h[5]}, 0, 1)`
  );
}

/** Eliminación de Gauss con pivoteo para un sistema 8×8. */
function resolver8por8(a: number[][], b: number[]): number[] | null {
  const n = 8;
  const m = a.map((fila, i) => [...fila, b[i]]);

  for (let col = 0; col < n; col++) {
    let mejor = col;
    for (let f = col + 1; f < n; f++) {
      if (Math.abs(m[f][col]) > Math.abs(m[mejor][col])) mejor = f;
    }
    if (Math.abs(m[mejor][col]) < 1e-12) return null; // sistema degenerado
    if (mejor !== col) {
      [m[col], m[mejor]] = [m[mejor], m[col]];
    }

    const pivote = m[col][col];
    for (let c = col; c <= n; c++) m[col][c] /= pivote;

    for (let f = 0; f < n; f++) {
      if (f === col) continue;
      const factor = m[f][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) m[f][c] -= factor * m[col][c];
    }
  }

  const solucion = m.map((fila) => fila[n]);
  return solucion.every((v) => Number.isFinite(v)) ? solucion : null;
}
