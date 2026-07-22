import type { Community, Player, Venue } from "./types";

export const communities: Community[] = [
  { id: "padel-prox", nombre: "Padel Prox", ciudad: "Guayaquil", descripcion: "Comunidad principal de la academia" },
  { id: "mixtos-gye", nombre: "Mixtos Guayaquil", ciudad: "Guayaquil", descripcion: "Partidos mixtos y suma" },
  { id: "sparring", nombre: "Sparring / Quedadas", ciudad: "Guayaquil", descripcion: "Eventos largos y entrenamientos" },
];

export const venues: Venue[] = [
  { id: "we", nombre: "WE", ciudad: "Guayaquil", duracionDefault: 90, canchas: 4 },
  { id: "la-perla", nombre: "La Perla", ciudad: "Guayaquil", duracionDefault: 90, canchas: 3 },
  { id: "spot-padel", nombre: "Spot Padel", ciudad: "Guayaquil", duracionDefault: 90, canchas: 4 },
  { id: "manta", nombre: "Manta", ciudad: "Manta", duracionDefault: 90, canchas: 4 },
];

export const players: Player[] = [
  { id: "p1", nombre: "Juan Pérez", whatsapp: "+593991111111", categoria: "C5", genero: "hombre", lado: "drive", comunidadId: "padel-prox", sedeIds: ["we"], disponibilidad: [{ day: 1, start: "18:00", end: "22:00" }, { day: 3, start: "18:00", end: "22:00" }], confiabilidad: 94, tasaRespuesta: 91, ultimaActividadDias: 8, optIn: true, invitadoHoy: false },
  { id: "p2", nombre: "Carlos Ruiz", whatsapp: "+593992222222", categoria: "C5", genero: "hombre", lado: "reves", comunidadId: "padel-prox", sedeIds: ["we", "la-perla"], disponibilidad: [{ day: 1, start: "19:00", end: "22:00" }], confiabilidad: 88, tasaRespuesta: 86, ultimaActividadDias: 14, optIn: true, invitadoHoy: false },
  { id: "p3", nombre: "Pedro Mora", whatsapp: "+593993333333", categoria: "C5", genero: "hombre", lado: "cualquiera", comunidadId: "padel-prox", sedeIds: ["we"], disponibilidad: [{ day: 1, start: "17:00", end: "20:00" }], confiabilidad: 78, tasaRespuesta: 72, ultimaActividadDias: 3, optIn: true, invitadoHoy: false },
  { id: "p4", nombre: "Luis Andrade", whatsapp: "+593994444444", categoria: "C5", genero: "hombre", lado: "drive", comunidadId: "padel-prox", sedeIds: ["la-perla", "spot-padel"], disponibilidad: [{ day: 1, start: "19:00", end: "23:00" }], confiabilidad: 81, tasaRespuesta: 65, ultimaActividadDias: 20, optIn: true, invitadoHoy: false },
  { id: "p5", nombre: "Andrés Vera", whatsapp: "+593995555555", categoria: "C5", genero: "hombre", lado: "reves", comunidadId: "padel-prox", sedeIds: ["we"], disponibilidad: [{ day: 1, start: "19:00", end: "21:00" }], confiabilidad: 67, tasaRespuesta: 70, ultimaActividadDias: 35, optIn: true, invitadoHoy: true },
  { id: "p6", nombre: "Marco León", whatsapp: "+593996666666", categoria: "C6", genero: "hombre", lado: "cualquiera", comunidadId: "padel-prox", sedeIds: ["we"], disponibilidad: [{ day: 2, start: "18:00", end: "22:00" }], confiabilidad: 91, tasaRespuesta: 89, ultimaActividadDias: 11, optIn: true, invitadoHoy: false },
  { id: "p7", nombre: "David Torres", whatsapp: "+593997777777", categoria: "C6", genero: "hombre", lado: "drive", comunidadId: "padel-prox", sedeIds: ["la-perla"], disponibilidad: [{ day: 1, start: "19:00", end: "22:00" }], confiabilidad: 93, tasaRespuesta: 95, ultimaActividadDias: 4, optIn: true, invitadoHoy: false },
  { id: "p8", nombre: "Sofía Lima", whatsapp: "+593998888888", categoria: "C5", genero: "mujer", lado: "reves", comunidadId: "mixtos-gye", sedeIds: ["we", "la-perla"], disponibilidad: [{ day: 1, start: "19:00", end: "22:00" }], confiabilidad: 90, tasaRespuesta: 80, ultimaActividadDias: 6, optIn: true, invitadoHoy: false },
  { id: "p9", nombre: "María Torres", whatsapp: "+593989999999", categoria: "C4", genero: "mujer", lado: "drive", comunidadId: "mixtos-gye", sedeIds: ["we", "spot-padel"], disponibilidad: [{ day: 1, start: "18:00", end: "22:30" }], confiabilidad: 92, tasaRespuesta: 84, ultimaActividadDias: 5, optIn: true, invitadoHoy: false },
  { id: "p10", nombre: "Ana Salazar", whatsapp: "+593987777777", categoria: "C6", genero: "mujer", lado: "cualquiera", comunidadId: "padel-prox", sedeIds: ["spot-padel"], disponibilidad: [{ day: 1, start: "17:30", end: "21:00" }], confiabilidad: 85, tasaRespuesta: 78, ultimaActividadDias: 12, optIn: true, invitadoHoy: false }
];
