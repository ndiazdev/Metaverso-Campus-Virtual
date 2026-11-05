export const TIPOS_SALON = ["normal", "reunion", "griego"] as const;

export type TipoSalon = (typeof TIPOS_SALON)[number];

export interface OpcionSalon {
  id: TipoSalon;
  archivo: string;
  imagen: string;
  nombreKey: "salon.normal" | "salon.reunion" | "salon.griego";
  descripcionKey:
    | "salon.normalDesc"
    | "salon.reunionDesc"
    | "salon.griegoDesc";
}

export const SALON_POR_DEFECTO: TipoSalon = "normal";

export const SALONES: OpcionSalon[] = [
  {
    id: "normal",
    archivo: "salon_normal.glb",
    imagen: "salon_normal.png",
    nombreKey: "salon.normal",
    descripcionKey: "salon.normalDesc",
  },
  {
    id: "reunion",
    archivo: "salon_reunion.glb",
    imagen: "salon_reunion.png",
    nombreKey: "salon.reunion",
    descripcionKey: "salon.reunionDesc",
  },
  {
    id: "griego",
    archivo: "salon_griego.glb",
    imagen: "salon_griego.png",
    nombreKey: "salon.griego",
    descripcionKey: "salon.griegoDesc",
  },
];

export function normalizarTipoSalon(valor: unknown): TipoSalon {
  return TIPOS_SALON.includes(valor as TipoSalon)
    ? (valor as TipoSalon)
    : SALON_POR_DEFECTO;
}

export function opcionSalon(tipo: unknown): OpcionSalon {
  const normalizado = normalizarTipoSalon(tipo);
  return SALONES.find((salon) => salon.id === normalizado) ?? SALONES[0];
}

export function archivoSalon(tipo: unknown): string {
  return opcionSalon(tipo).archivo;
}
