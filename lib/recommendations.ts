import type { FillCourtInput, Player, Recommendation } from "./types";

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function dayOfWeek(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function isAvailable(player: Player, date: string, time: string, duration: number) {
  const day = dayOfWeek(date);
  const start = toMinutes(time);
  const end = start + duration;

  return player.disponibilidad.some((slot) => {
    return slot.day === day && toMinutes(slot.start) <= start && toMinutes(slot.end) >= end;
  });
}

function genderCompatible(player: Player, input: FillCourtInput) {
  if (input.genero === "libre" || input.genero === "mixto") return true;
  if (input.genero === "hombres") return player.genero === "hombre";
  if (input.genero === "mujeres") return player.genero === "mujer";
  return true;
}

function categoryCompatible(player: Player, input: FillCourtInput) {
  if (input.categoryMode === "suma") {
    // MVP demo: en suma dejamos entrar categorías cercanas y el admin arma las parejas.
    return true;
  }

  return player.categoria === input.categoria;
}

function firstName(fullName: string) {
  return fullName
    .replace(/\s+Demo$/i, "")
    .trim()
    .split(" ")[0];
}

function formatDateForMessage(dateString: string) {
  const eventDate = new Date(`${dateString}T12:00:00`);
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const eventOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

  const diffDays = Math.round((eventOnly.getTime() - todayOnly.getTime()) / 86400000);

  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "mañana";

  return eventDate.toLocaleDateString("es-EC", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });
}

function normalizeHour(time: string) {
  return time.slice(0, 5);
}

function cleanSpaces(text: string) {
  return text
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getRecommendations(players: Player[], input: FillCourtInput): Recommendation[] {
  return players
    .map((player) => {
      let score = 0;
      const reasons: string[] = [];
      const flags: string[] = [];

      if (!player.optIn) {
        flags.push("Sin opt-in WhatsApp");
        score -= 100;
      }

      if (player.comunidadId === input.comunidadId) {
        score += 30;
        reasons.push("Pertenece a la comunidad");
      } else {
        flags.push("Fuera de comunidad");
        score -= 20;
      }

      if (categoryCompatible(player, input)) {
        score += 30;
        reasons.push(input.categoryMode === "suma" ? "Compatible para suma" : "Categoría compatible");
      } else {
        flags.push("Categoría diferente");
        score -= 25;
      }

      if (genderCompatible(player, input)) {
        score += 10;
        reasons.push("Género compatible");
      } else {
        flags.push("Género no compatible");
        score -= 80;
      }

      if (player.sedeIds.includes(input.sedeId)) {
        score += 12;
        reasons.push("Juega en esta sede");
      } else {
        flags.push("Sede no habitual");
      }

      if (isAvailable(player, input.fecha, input.hora, input.duracion)) {
        score += 25;
        reasons.push("Disponible en ese horario");
      } else {
        flags.push("Disponibilidad no confirmada");
        score -= 10;
      }

      score += Math.round(player.confiabilidad * 0.2);
      reasons.push(`Confiabilidad ${player.confiabilidad}/100`);

      score += Math.round(player.tasaRespuesta * 0.08);

      if (player.ultimaActividadDias > 14 && player.ultimaActividadDias < 45) {
        score += 5;
        reasons.push("Buen candidato para reactivar");
      }

      if (player.invitadoHoy) {
        score -= 20;
        flags.push("Ya fue invitado hoy");
      }

      return {
        player,
        score,
        reasons,
        flags,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function buildWhatsappMessage(params: {
  nombre: string;
  categoria: string;
  sede: string;
  fecha: string;
  hora: string;
  cupos: number;
  canchas: number;
  genero: string;
  duracion: number;
  mensajeBase: string;
}) {
  const nombreCorto = firstName(params.nombre);
  const fechaTexto = formatDateForMessage(params.fecha);
  const horaTexto = normalizeHour(params.hora);

  const message = params.mensajeBase
    .replaceAll("{{nombre}}", nombreCorto)
    .replaceAll("{{categoria}}", params.categoria)
    .replaceAll("{{sede}}", params.sede)
    .replaceAll("{{fecha}}", fechaTexto)
    .replaceAll("{{hora}}", horaTexto)
    .replaceAll("{{cupos}}", String(params.cupos))
    .replaceAll("{{canchas}}", String(params.canchas))
    .replaceAll("{{genero}}", params.genero)
    .replaceAll("{{duracion}}", String(params.duracion));

  return cleanSpaces(message);
}

export function whatsappLink(phone: string, message: string) {
  const clean = phone.replace(/[^0-9]/g, "");

  // En navegador normalmente abre WhatsApp Web.
  // WhatsApp Business no siempre se puede forzar desde una web.
  // Para Business, lo más seguro en MVP es copiar mensaje y pegarlo manualmente.
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}