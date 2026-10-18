import { API_URL } from "./cliente";

export async function obtenerClasesDocente(docenteCorreo: string) {
  const res = await fetch(`${API_URL}/clases/docente/${encodeURIComponent(docenteCorreo)}`);
  return await res.json();
}

export async function crearClaseBD(datosClase: any) {
  const res = await fetch(`${API_URL}/clases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datosClase),
  });
  return await res.json();
}

export async function obtenerClasesEstudiante(estudianteCorreo: string) {
  const res = await fetch(`${API_URL}/clases/estudiante/${encodeURIComponent(estudianteCorreo)}`);
  return await res.json();
}

export async function inscribirClaseBD(correoEstudiante: string, codigoClase: string) {
  const res = await fetch(`${API_URL}/inscripciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correoEstudiante, codigoClase }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

/**
 * Una clase suelta por su código.
 *
 * Es lo que hace posible entrar por enlace (…/?clase=FIS-101): al abrir
 * esa dirección hay que saber de qué clase se trata antes de dibujar el
 * salón. Devuelve null si la API responde que no existe (404), para que
 * quien llame pueda distinguir "no hay esa clase" de "la API está caída".
 */
export async function obtenerClasePorCodigo(codigo: string) {
  const res = await fetch(`${API_URL}/clases/${encodeURIComponent(codigo)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`No se pudo consultar la clase "${codigo}".`);
  return await res.json();
}
