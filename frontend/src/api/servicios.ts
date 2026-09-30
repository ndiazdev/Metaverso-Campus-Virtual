import { API_URL } from "./cliente";

export async function obtenerClasesDocente(docenteId: number) {
  const res = await fetch(`${API_URL}/clases/docente/${docenteId}`);
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

export async function obtenerClasesEstudiante(estudianteId: number) {
  const res = await fetch(`${API_URL}/clases/estudiante/${estudianteId}`);
  return await res.json();
}

export async function inscribirClaseBD(estudianteId: number, codigoClase: string) {
  const res = await fetch(`${API_URL}/inscripciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estudianteId, codigoClase }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}