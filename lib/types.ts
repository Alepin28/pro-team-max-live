export type Category = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7";
export type Side = "drive" | "reves" | "cualquiera";
export type GenderMode = "hombres" | "mujeres" | "mixto" | "libre";
export type CategoryMode = "categoria" | "suma";

export type Player = {
  id: string;
  nombre: string;
  whatsapp: string;
  categoria: Category;
  genero: "hombre" | "mujer";
  lado: Side;
  comunidadId: string;
  sedeIds: string[];
  disponibilidad: { day: number; start: string; end: string }[];
  confiabilidad: number;
  tasaRespuesta: number;
  ultimaActividadDias: number;
  optIn: boolean;
  invitadoHoy: boolean;
};

export type Community = {
  id: string;
  sportId?: string;
  nombre: string;
  categoria?: Category;
  ciudad: string;
  descripcion?: string;
};

export type Venue = {
  id: string;
  nombre: string;
  ciudad: string;
  duracionDefault: number;
  canchas: number;
};

export type FillCourtInput = {
  comunidadId: string;
  sedeId: string;
  fecha: string;
  hora: string;
  duracion: number;
  categoria: Category;
  canchas: number;
  genero: GenderMode;
  categoryMode: CategoryMode;
  sumaTotal?: number;
};

export type Recommendation = {
  player: Player;
  score: number;
  reasons: string[];
  flags: string[];
};
