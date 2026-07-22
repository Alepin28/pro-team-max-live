"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  createManualEvent,
  loadParticipations,
  removeParticipation,
  saveInvitation,
  saveManualMessage,
  saveParticipation,
} from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";

type Category = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7";
type GenderMode = "libre" | "hombres" | "mujeres" | "mixto";
type CategoryMode = "categoria" | "suma";
type PlayerStatus = "pendiente" | "confirmado" | "espera" | "rechazado" | "ambiguo";
type StatusMap = Record<string, PlayerStatus>;
type WaitlistMap = Record<string, number>;

type RpcParticipationResult = {
  ok?: boolean;
  previous_status?: string | null;
  final_status?: string | null;
  waitlist_position?: number | null;
  promoted_player_id?: string | null;
  confirmed_count?: number | null;
  capacity?: number | null;
  spots_remaining?: number | null;
};

type PromotionNotice = {
  playerId: string;
  playerName: string;
  phone: string | null;
  message: string;
};

const OTHER_VENUE_FALLBACK_ID = "10000000-0000-0000-0000-000000000099";

const CATEGORIES: Array<{ value: Category; label: string; lower: string }> = [
  { value: "C1", label: "Primera", lower: "primera" },
  { value: "C2", label: "Segunda", lower: "segunda" },
  { value: "C3", label: "Tercera", lower: "tercera" },
  { value: "C4", label: "Cuarta", lower: "cuarta" },
  { value: "C5", label: "Quinta", lower: "quinta" },
  { value: "C6", label: "Sexta", lower: "sexta" },
  { value: "C7", label: "Novatos", lower: "novatos" },
];

const DAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

const defaultMessage = `Hola {{nombre}}! 🎾

Tenemos partido de {{categoria}} a las {{hora}} en {{sede}}.
Creo que te puede calzar por nivel y horario.

¿Puedes jugar?`;

type CommunityRow = {
  id: string;
  sport_id: string | null;
  name: string;
  city: string | null;
  active: boolean | null;
};

type VenueRow = {
  id: string;
  name: string;
  city: string | null;
  courts_count: number | null;
  default_duration_minutes: number | null;
  active: boolean | null;
};

type CommunityCategoryRow = {
  community_id: string;
  category: Category;
};

type CommunityVenueRow = {
  community_id: string;
  venue_id: string;
};

type PlayerRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  whatsapp: string | null;
  gender: string | null;
  validated_category: string | null;
  secondary_category: string | null;
  preferred_side: string | null;
  reliability_score: number | null;
  opt_in_whatsapp: boolean | null;
  active: boolean | null;
  deleted_at: string | null;
  last_activity_at: string | null;
};

type PlayerCommunityRow = {
  player_id: string;
  community_id: string;
};

type AvailabilityRow = {
  player_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type Recommendation = {
  player: PlayerRow;
  score: number;
  reasons: string[];
  flags: string[];
  group: "match" | "suggestion";
};

type StaffPermissions = {
  createMatches?: boolean;
  registerResponses?: boolean;
  manageReservation?: boolean;
  viewPayments?: boolean;
  editPayments?: boolean;
  managePlayers?: boolean;
  cancelMatches?: boolean;
};

type StaffRow = {
  id: string;
  account_id: string;
  full_name: string;
  role: string;
  active: boolean | null;
  auth_status?: string | null;
  allowed_categories: string[] | null;
  allowed_community_ids: string[] | null;
  allowed_venue_ids: string[] | null;
  allowed_genders: string[] | null;
  permissions: StaffPermissions | null;
  auth_user_id: string | null;
  can_view_payments?: boolean;
  can_edit_payments?: boolean;
};

const EMPTY_STAFF: StaffRow = {
  id: "",
  account_id: "",
  full_name: "Usuario sin acceso",
  role: "assistant",
  active: false,
  auth_status: "disabled",
  allowed_categories: [],
  allowed_community_ids: [],
  allowed_venue_ids: [],
  allowed_genders: [],
  auth_user_id: null,
  can_view_payments: false,
  can_edit_payments: false,
  permissions: {
    createMatches: false,
    registerResponses: false,
    manageReservation: false,
    viewPayments: false,
    editPayments: false,
    managePlayers: false,
    cancelMatches: false,
  },
};

function normalizeStaffProfile(data: unknown): StaffRow | null {
  const value = Array.isArray(data) ? data[0] : data;

  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (
    typeof row.id !== "string" ||
    typeof row.account_id !== "string" ||
    typeof row.full_name !== "string" ||
    typeof row.role !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    account_id: row.account_id,
    full_name: row.full_name,
    role: row.role,
    active: row.active === true,
    auth_status:
      typeof row.auth_status === "string"
        ? row.auth_status
        : null,
    allowed_categories: Array.isArray(row.allowed_categories)
      ? row.allowed_categories.filter(
          (item): item is string => typeof item === "string"
        )
      : [],
    allowed_community_ids: Array.isArray(
      row.allowed_community_ids
    )
      ? row.allowed_community_ids.filter(
          (item): item is string => typeof item === "string"
        )
      : [],
    allowed_venue_ids: Array.isArray(row.allowed_venue_ids)
      ? row.allowed_venue_ids.filter(
          (item): item is string => typeof item === "string"
        )
      : [],
    allowed_genders: Array.isArray(row.allowed_genders)
      ? row.allowed_genders.filter(
          (item): item is string => typeof item === "string"
        )
      : [],
    permissions:
      row.permissions &&
      typeof row.permissions === "object" &&
      !Array.isArray(row.permissions)
        ? (row.permissions as StaffPermissions)
        : {},
    auth_user_id:
      typeof row.auth_user_id === "string"
        ? row.auth_user_id
        : null,
    can_view_payments: row.can_view_payments === true,
    can_edit_payments: row.can_edit_payments === true,
  };
}

function ecuadorToday() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

function categoryLabel(value?: string | null) {
  return CATEGORIES.find((item) => item.value === value)?.label ?? value ?? "Sin categoría";
}

function categoryLabelLower(value?: string | null) {
  return CATEGORIES.find((item) => item.value === value)?.lower ?? value?.toLowerCase() ?? "categoría";
}

function categoryNumber(value?: string | null) {
  const parsed = Number((value ?? "").replace("C", ""));
  return Number.isFinite(parsed) ? parsed : 99;
}

function fullName(player: PlayerRow) {
  return [player.first_name, player.last_name].filter(Boolean).join(" ").trim() || "Jugador";
}

function firstName(player: PlayerRow) {
  return player.first_name?.trim().split(/\s+/)[0] || "Jugador";
}

function normalizeGender(value?: string | null) {
  if (value === "mujer" || value === "femenino") return "mujer";
  return "hombre";
}

function genderLabel(value: GenderMode) {
  if (value === "hombres") return "solo hombres";
  if (value === "mujeres") return "solo mujeres";
  if (value === "mixto") return "mixto";
  return "libre";
}

function sideLabel(value?: string | null) {
  if (value === "drive") return "Drive";
  if (value === "reves" || value === "revés") return "Revés";
  return "Cualquiera";
}

function dayLabel(value: number) {
  return DAYS.find((item) => item.value === value)?.label ?? `Día ${value}`;
}

function timeValue(value?: string | null) {
  return (value ?? "00:00").slice(0, 5);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function eventDayOfWeek(date: string) {
  const day = new Date(`${date}T12:00:00`).getDay();
  return day === 0 ? 7 : day;
}

function availabilityMatches(rows: AvailabilityRow[], date: string, startTime: string, durationMinutes: number) {
  if (!rows.length) return null;

  const day = eventDayOfWeek(date);
  const start = timeToMinutes(startTime);
  const end = start + durationMinutes;

  return rows.some((row) => {
    const rowStart = timeToMinutes(timeValue(row.start_time));
    const rowEnd = timeToMinutes(timeValue(row.end_time));
    return row.day_of_week === day && rowStart <= start && rowEnd >= end;
  });
}

function availabilityText(rows: AvailabilityRow[]) {
  if (!rows.length) return "Sin horario registrado";

  return rows
    .slice()
    .sort((a, b) => a.day_of_week - b.day_of_week || timeValue(a.start_time).localeCompare(timeValue(b.start_time)))
    .map((row) => `${dayLabel(row.day_of_week)} ${timeValue(row.start_time)}–${timeValue(row.end_time)}`)
    .join(" · ");
}

function statusLabel(status?: PlayerStatus) {
  if (!status || status === "pendiente") return "Sin respuesta";
  if (status === "confirmado") return "Confirmado";
  if (status === "espera") return "Lista de espera";
  if (status === "rechazado") return "No puede";
  return "Ambiguo";
}

function statusClass(status?: PlayerStatus) {
  if (status === "confirmado") return "good";
  if (status === "espera" || status === "ambiguo") return "warn";
  if (status === "rechazado") return "danger";
  return "neutral";
}

function amountFromText(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function cleanPhone(value?: string | null) {
  return (value ?? "").replace(/[^0-9]/g, "");
}

function whatsappLink(phone: string | null, message: string) {
  return `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(message)}`;
}

function naturalDate(date: string) {
  const today = ecuadorToday();
  const tomorrowDate = new Date(`${today}T12:00:00-05:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  const tomorrow = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tomorrowDate);

  if (date === today) return "hoy";
  if (date === tomorrow) return "mañana";

  return new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "long",
    timeZone: "America/Guayaquil",
  }).format(new Date(`${date}T12:00:00-05:00`));
}

function buildMessage(input: {
  player: PlayerRow;
  categoryText: string;
  venueText: string;
  date: string;
  time: string;
  courts: number;
  spots: number;
  gender: GenderMode;
  duration: number;
  template: string;
}) {
  const replacements: Record<string, string> = {
    "{{nombre}}": firstName(input.player),
    "{{categoria}}": input.categoryText,
    "{{sede}}": input.venueText,
    "{{fecha}}": naturalDate(input.date),
    "{{hora}}": input.time,
    "{{canchas}}": String(input.courts),
    "{{cupos}}": String(input.spots),
    "{{genero}}": genderLabel(input.gender),
    "{{duracion}}": String(input.duration),
  };

  let message = input.template;
  for (const [token, value] of Object.entries(replacements)) {
    message = message.split(token).join(value);
  }
  return message;
}

function buildParticipationStatusMessage(input: {
  player: PlayerRow;
  status: "confirmado" | "espera";
  waitlistPosition?: number | null;
  categoryText: string;
  venueText: string;
  date: string;
  time: string;
}) {
  const name = firstName(input.player);
  const dateText = naturalDate(input.date);

  if (input.status === "confirmado") {
    return `Hola ${name}! 🎾

Tu cupo quedó confirmado para el partido de ${input.categoryText} ${dateText} a las ${input.time} en ${input.venueText}.

Te espero 🙌`;
  }

  const positionText = input.waitlistPosition
    ? ` Estás en el puesto #${input.waitlistPosition}.`
    : "";

  return `Hola ${name}! 🎾

El partido de ${input.categoryText} ${dateText} a las ${input.time} en ${input.venueText} ya se llenó.${positionText}

Te dejé en lista de espera y te escribo apenas se libere un cupo.`;
}

function buildPromotionMessage(input: {
  player: PlayerRow;
  categoryText: string;
  venueText: string;
  date: string;
  time: string;
}) {
  const name = firstName(input.player);

  return `Hola ${name}! 🎾

Se liberó un cupo y ya quedaste confirmado para el partido de ${input.categoryText} ${naturalDate(input.date)} a las ${input.time} en ${input.venueText}.

Te espero 🙌`;
}

function normalizeRpcResult(data: unknown): RpcParticipationResult {
  if (Array.isArray(data)) {
    return (data[0] ?? {}) as RpcParticipationResult;
  }

  if (data && typeof data === "object") {
    return data as RpcParticipationResult;
  }

  return {};
}

function isOtherVenue(venue?: VenueRow | null) {
  if (!venue) return false;
  const normalized = venue.name.trim().toLowerCase();
  return venue.id === OTHER_VENUE_FALLBACK_ID || normalized === "otra / por definir" || normalized === "otra/por definir";
}

function staffRoleLabel(role?: string | null) {
  if (role === "owner") return "Dueño";
  if (role === "admin") return "Administrador";
  if (role === "assistant") return "Asistente";
  if (role === "viewer") return "Solo lectura";
  return role || "Staff";
}

function staffCanSeeEverything(staff: StaffRow) {
  return staff.role === "owner" || staff.role === "admin";
}

function staffHasPermission(staff: StaffRow, permission: keyof StaffPermissions) {
  if (staffCanSeeEverything(staff)) return true;
  return staff.permissions?.[permission] === true;
}

function syntheticOtherVenue(): VenueRow {
  return {
    id: OTHER_VENUE_FALLBACK_ID,
    name: "Otra / por definir",
    city: "Guayaquil",
    courts_count: 1,
    default_duration_minutes: 90,
    active: true,
  };
}

export default function LlenarCanchasPage() {
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [communityCategories, setCommunityCategories] = useState<CommunityCategoryRow[]>([]);
  const [communityVenues, setCommunityVenues] = useState<CommunityVenueRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [playerCommunities, setPlayerCommunities] = useState<PlayerCommunityRow[]>([]);
  const [availabilityRows, setAvailabilityRows] = useState<AvailabilityRow[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffRow[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [staffError, setStaffError] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const [comunidadId, setComunidadId] = useState("");
  const [sedeId, setSedeId] = useState("");
  const [otraSede, setOtraSede] = useState("Por definir");
  const [fecha, setFecha] = useState(ecuadorToday());
  const [hora, setHora] = useState("19:30");
  const [duracion, setDuracion] = useState(90);
  const [categoria, setCategoria] = useState<Category>("C5");
  const [categoryMode, setCategoryMode] = useState<CategoryMode>("categoria");
  const [sumaTotal, setSumaTotal] = useState(10);
  const [genero, setGenero] = useState<GenderMode>("libre");
  const [canchas, setCanchas] = useState(1);
  const [cupos, setCupos] = useState(4);
  const [comisionPartido, setComisionPartido] = useState("0");
  const [comisionNotas, setComisionNotas] = useState("");
  const [mensajeBase, setMensajeBase] = useState(defaultMessage);
  const [precioBase, setPrecioBase] = useState("12");
  const [precioNotas, setPrecioNotas] = useState("Precio normal por jugador");

  const [searched, setSearched] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [waitlistPositions, setWaitlistPositions] = useState<WaitlistMap>({});
  const [changingPlayerId, setChangingPlayerId] = useState<string | null>(null);
  const [promotionNotice, setPromotionNotice] = useState<PromotionNotice | null>(null);
  const [recommendationView, setRecommendationView] = useState<"matches" | "suggestions">("matches");

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    setNotice("");
    setStaffError("");

    try {
      const profileResponse = await supabase.rpc(
        "ptm_current_staff_profile_v1"
      );

      if (profileResponse.error) {
        throw profileResponse.error;
      }

      const authenticatedStaff = normalizeStaffProfile(
        profileResponse.data
      );

      if (!authenticatedStaff) {
        throw new Error(
          "Este acceso no está vinculado a un usuario interno activo."
        );
      }

      if (
        authenticatedStaff.active !== true ||
        authenticatedStaff.auth_status === "disabled" ||
        authenticatedStaff.auth_status === "deshabilitado"
      ) {
        throw new Error(
          "Este acceso está deshabilitado."
        );
      }

      const accountId = authenticatedStaff.account_id;

      setStaffMembers([authenticatedStaff]);
      setSelectedStaffId(authenticatedStaff.id);

      const [
        communitiesRes,
        venuesRes,
        communityCategoriesRes,
        communityVenuesRes,
        playersRes,
      ] = await Promise.all([
        supabase
          .from("communities")
          .select("id, sport_id, name, city, active")
          .eq("account_id", accountId)
          .eq("active", true)
          .order("name"),

        supabase
          .from("venues")
          .select(
            "id, name, city, courts_count, default_duration_minutes, active"
          )
          .eq("account_id", accountId)
          .eq("active", true)
          .order("name"),

        supabase
          .from("community_categories")
          .select("community_id, category")
          .eq("account_id", accountId),

        supabase
          .from("community_venues")
          .select("community_id, venue_id")
          .eq("account_id", accountId),

        supabase
          .from("players")
          .select(
            "id, first_name, last_name, whatsapp, gender, validated_category, secondary_category, preferred_side, reliability_score, opt_in_whatsapp, active, deleted_at, last_activity_at"
          )
          .eq("account_id", accountId)
          .is("deleted_at", null)
          .order("first_name"),
      ]);

      if (communitiesRes.error) throw communitiesRes.error;
      if (venuesRes.error) throw venuesRes.error;
      if (communityCategoriesRes.error) {
        throw communityCategoriesRes.error;
      }
      if (communityVenuesRes.error) {
        throw communityVenuesRes.error;
      }
      if (playersRes.error) throw playersRes.error;

      const loadedCommunities =
        (communitiesRes.data ?? []) as CommunityRow[];

      const loadedVenues =
        (venuesRes.data ?? []) as VenueRow[];

      const loadedPlayers =
        (playersRes.data ?? []) as PlayerRow[];

      const playerIds = loadedPlayers.map(
        (player) => player.id
      );

      let loadedPlayerCommunities: PlayerCommunityRow[] = [];
      let loadedAvailability: AvailabilityRow[] = [];

      if (playerIds.length) {
        const [
          playerCommunitiesRes,
          availabilityRes,
        ] = await Promise.all([
          supabase
            .from("player_communities")
            .select("player_id, community_id")
            .eq("account_id", accountId)
            .in("player_id", playerIds),

          supabase
            .from("player_availability")
            .select(
              "player_id, day_of_week, start_time, end_time"
            )
            .eq("account_id", accountId)
            .in("player_id", playerIds),
        ]);

        if (playerCommunitiesRes.error) {
          throw playerCommunitiesRes.error;
        }

        if (availabilityRes.error) {
          throw availabilityRes.error;
        }

        loadedPlayerCommunities =
          (playerCommunitiesRes.data ?? []) as PlayerCommunityRow[];

        loadedAvailability =
          (availabilityRes.data ?? []) as AvailabilityRow[];
      }

      setCommunities(loadedCommunities);
      setVenues(loadedVenues);
      setCommunityCategories(
        (communityCategoriesRes.data ?? []) as CommunityCategoryRow[]
      );
      setCommunityVenues(
        (communityVenuesRes.data ?? []) as CommunityVenueRow[]
      );
      setPlayers(loadedPlayers);
      setPlayerCommunities(loadedPlayerCommunities);
      setAvailabilityRows(loadedAvailability);

      const savedEventId =
        window.localStorage.getItem("ptm.lastEventId");

      const savedMetaRaw =
        window.localStorage.getItem("ptm.lastEventMeta");

      let restored = false;

      if (savedEventId && savedMetaRaw) {
        try {
          const savedMeta = JSON.parse(savedMetaRaw);

          if (savedMeta.comunidadId) {
            setComunidadId(savedMeta.comunidadId);
          }

          if (savedMeta.sedeId) {
            setSedeId(savedMeta.sedeId);
          }

          if (savedMeta.otraSede !== undefined) {
            setOtraSede(savedMeta.otraSede);
          }

          if (savedMeta.fecha) {
            setFecha(savedMeta.fecha);
          }

          if (savedMeta.hora) {
            setHora(savedMeta.hora);
          }

          if (savedMeta.duracion) {
            setDuracion(Number(savedMeta.duracion));
          }

          if (savedMeta.categoria) {
            setCategoria(savedMeta.categoria as Category);
          }

          if (savedMeta.categoryMode) {
            setCategoryMode(
              savedMeta.categoryMode as CategoryMode
            );
          }

          if (savedMeta.sumaTotal) {
            setSumaTotal(Number(savedMeta.sumaTotal));
          }

          if (savedMeta.genero) {
            setGenero(savedMeta.genero as GenderMode);
          }

          if (savedMeta.canchas) {
            setCanchas(Number(savedMeta.canchas));
          }

          if (savedMeta.cupos) {
            setCupos(Number(savedMeta.cupos));
          }

          if (savedMeta.comisionPartido !== undefined) {
            setComisionPartido(
              String(savedMeta.comisionPartido)
            );
          }

          if (savedMeta.comisionNotas !== undefined) {
            setComisionNotas(savedMeta.comisionNotas);
          }

          if (savedMeta.mensajeBase) {
            setMensajeBase(savedMeta.mensajeBase);
          }

          if (savedMeta.precioBase !== undefined) {
            setPrecioBase(String(savedMeta.precioBase));
          }

          if (savedMeta.precioNotas !== undefined) {
            setPrecioNotas(savedMeta.precioNotas);
          }

          const participationRows =
            await loadParticipations(savedEventId);

          const nextStatuses: StatusMap = {};
          const nextWaitlistPositions: WaitlistMap = {};

          for (const row of participationRows) {
            if (row.status === "confirmado") {
              nextStatuses[row.player_id] = "confirmado";
            }

            if (row.status === "lista_espera") {
              nextStatuses[row.player_id] = "espera";
              nextWaitlistPositions[row.player_id] =
                Number(row.waitlist_position ?? 0);
            }

            if (row.status === "rechazo") {
              nextStatuses[row.player_id] = "rechazado";
            }

            if (row.status === "ambiguo") {
              nextStatuses[row.player_id] = "ambiguo";
            }
          }

          setStatuses(nextStatuses);
          setWaitlistPositions(nextWaitlistPositions);
          setEventId(savedEventId);
          setSearched(true);
          restored = true;

          setNotice(
            "Último partido reabierto. Las respuestas siguen guardadas en Supabase."
          );
        } catch (error) {
          console.warn(
            "No se pudo reabrir el último partido",
            error
          );

          window.localStorage.removeItem(
            "ptm.lastEventId"
          );

          window.localStorage.removeItem(
            "ptm.lastEventMeta"
          );
        }
      }

      if (!restored) {
        const firstCommunity = loadedCommunities[0];

        const existingOtherVenue =
          loadedVenues.find((venue) =>
            isOtherVenue(venue)
          );

        const firstVenue =
          loadedVenues.find(
            (venue) => !isOtherVenue(venue)
          ) ?? existingOtherVenue;

        if (firstCommunity) {
          setComunidadId(firstCommunity.id);
        }

        if (firstVenue) {
          setSedeId(firstVenue.id);
          setDuracion(
            firstVenue.default_duration_minutes ?? 90
          );
        }
      }
    } catch (error: any) {
      setStaffMembers([]);
      setSelectedStaffId("");
      setStaffError(
        error?.message ?? "Error desconocido"
      );

      setNotice(
        `No se pudieron cargar los datos: ${
          error?.message ?? "Error desconocido"
        }`
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedStaff = useMemo(() => {
    return (
      staffMembers.find(
        (staff) => staff.id === selectedStaffId
      ) ?? EMPTY_STAFF
    );
  }, [staffMembers, selectedStaffId]);

  const canCreateMatches = staffHasPermission(
    selectedStaff,
    "createMatches"
  );

  const canRegisterResponses = staffHasPermission(
    selectedStaff,
    "registerResponses"
  );

  const canViewPayments =
    selectedStaff.can_view_payments === true ||
    staffHasPermission(selectedStaff, "viewPayments");

  const canEditPayments =
    selectedStaff.can_edit_payments === true ||
    staffHasPermission(selectedStaff, "editPayments");

  const staffCommunityOptions = useMemo(() => {
    if (staffCanSeeEverything(selectedStaff)) return communities;
    const allowedIds = selectedStaff.allowed_community_ids ?? [];
    return communities.filter((community) => allowedIds.includes(community.id));
  }, [communities, selectedStaff]);

  const communityById = useMemo(
    () => new Map(communities.map((community) => [community.id, community])),
    [communities]
  );

  const playerCommunitiesByPlayer = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of playerCommunities) {
      const current = map.get(row.player_id) ?? [];
      current.push(row.community_id);
      map.set(row.player_id, current);
    }
    return map;
  }, [playerCommunities]);

  const availabilityByPlayer = useMemo(() => {
    const map = new Map<string, AvailabilityRow[]>();
    for (const row of availabilityRows) {
      const current = map.get(row.player_id) ?? [];
      current.push(row);
      map.set(row.player_id, current);
    }
    return map;
  }, [availabilityRows]);

  const allowedCategories = useMemo(() => {
    const communityScoped = communityCategories
      .filter((row) => row.community_id === comunidadId)
      .map((row) => row.category);

    const communityOptions = communityScoped.length
      ? CATEGORIES.filter((item) => communityScoped.includes(item.value))
      : CATEGORIES;

    if (staffCanSeeEverything(selectedStaff)) return communityOptions;

    const staffCategories = (selectedStaff.allowed_categories ?? []).filter((value): value is Category =>
      CATEGORIES.some((item) => item.value === value)
    );

    return communityOptions.filter((item) => staffCategories.includes(item.value));
  }, [communityCategories, comunidadId, selectedStaff]);

  const allowedGenderModes = useMemo<GenderMode[]>(() => {
    if (staffCanSeeEverything(selectedStaff)) {
      return ["libre", "hombres", "mujeres", "mixto"];
    }

    const allowed = selectedStaff.allowed_genders ?? [];
    const canUseMen = allowed.includes("hombre");
    const canUseWomen = allowed.includes("mujer");
    const options: GenderMode[] = [];

    if (canUseMen) options.push("hombres");
    if (canUseWomen) options.push("mujeres");

    if (canUseMen && canUseWomen) {
      options.unshift("libre");
      options.push("mixto");
    }

    return options;
  }, [selectedStaff]);

  const venueOptions = useMemo(() => {
    const activeVenues = venues.filter((venue) => venue.active !== false);
    const communityScopedIds = communityVenues
      .filter((row) => row.community_id === comunidadId)
      .map((row) => row.venue_id);

    const communityOptions = communityScopedIds.length
      ? activeVenues.filter((venue) => communityScopedIds.includes(venue.id) || isOtherVenue(venue))
      : activeVenues;

    const otherVenue = activeVenues.find((venue) => isOtherVenue(venue)) ?? syntheticOtherVenue();
    const withOther = communityOptions.some((venue) => isOtherVenue(venue))
      ? communityOptions
      : [...communityOptions, otherVenue];

    if (staffCanSeeEverything(selectedStaff)) return withOther;

    const staffVenueIds = selectedStaff.allowed_venue_ids ?? [];
    return withOther.filter((venue) => staffVenueIds.includes(venue.id));
  }, [venues, communityVenues, comunidadId, selectedStaff]);

  useEffect(() => {
    if (!staffCommunityOptions.some((community) => community.id === comunidadId)) {
      const first = staffCommunityOptions[0];
      if (first) setComunidadId(first.id);
    }
  }, [staffCommunityOptions, comunidadId]);

  useEffect(() => {
    if (
      !allowedCategories.some(
        (item) => item.value === categoria
      )
    ) {
      setCategoria(
        allowedCategories[0]?.value ?? "C5"
      );
    }
  }, [allowedCategories, categoria]);

  useEffect(() => {
    if (!allowedGenderModes.includes(genero)) {
      setGenero(allowedGenderModes[0] ?? "libre");
    }
  }, [allowedGenderModes, genero]);

  useEffect(() => {
    if (!venueOptions.some((venue) => venue.id === sedeId)) {
      const first = venueOptions[0];
      if (first) {
        setSedeId(first.id);
        setDuracion(first.default_duration_minutes ?? 90);
      }
    }
  }, [venueOptions, sedeId]);

  const comunidad = communityById.get(comunidadId) ?? staffCommunityOptions[0];
  const sede = venueOptions.find((venue) => venue.id === sedeId) ?? venueOptions[0];
  const usingOtherVenue = isOtherVenue(sede);
  const sedeVisible = usingOtherVenue ? otraSede.trim() || "Otra / por definir" : sede?.name ?? "Sede";

  const categoriaVisible = categoryMode === "suma" ? `Suma ${sumaTotal}` : categoryLabel(categoria);
  const categoriaMensaje = categoryMode === "suma" ? `suma ${sumaTotal}` : categoryLabelLower(categoria);
  const precioBaseAmount = amountFromText(precioBase);
  const precioBaseSeguro = precioBaseAmount ?? 0;

  const recommendations = useMemo<Recommendation[]>(() => {
    if (!comunidad || !sede) return [];

    const targetForSum = sumaTotal / 2;

    return players
      .filter((player) => player.active !== false)
      .filter((player) => player.deleted_at === null)
      .filter((player) => player.opt_in_whatsapp !== false)
      .filter((player) => (playerCommunitiesByPlayer.get(player.id) ?? []).includes(comunidad.id))
      .map((player) => {
        const reasons: string[] = [];
        const flags: string[] = [];
        let score = Math.max(0, Math.min(100, player.reliability_score ?? 70));

        const primary = player.validated_category as Category | null;
        const secondary = player.secondary_category as Category | null;
        const primaryNumber = categoryNumber(primary);
        const secondaryNumber = categoryNumber(secondary);

        let exactCategory = false;
        let closeCategory = false;

        if (categoryMode === "categoria") {
          exactCategory = primary === categoria || secondary === categoria;

          const targetNumber = categoryNumber(categoria);
          const distance = Math.min(
            Math.abs(primaryNumber - targetNumber),
            Math.abs(secondaryNumber - targetNumber)
          );

          closeCategory = distance <= 1;

          if (exactCategory) {
            if (primary === categoria) {
              score += 30;
              reasons.push(`Categoría principal: ${categoryLabel(categoria)}`);
            } else {
              score += 25;
              reasons.push(`Categoría secundaria: ${categoryLabel(categoria)}`);
            }
          } else if (closeCategory) {
            score += 10;
            flags.push(
              `Categoría cercana: ${categoryLabel(primary)}${secondary ? ` / ${categoryLabel(secondary)}` : ""}`
            );
          } else {
            return null;
          }
        } else {
          const distance = Math.min(
            Math.abs(primaryNumber - targetForSum),
            Math.abs(secondaryNumber - targetForSum)
          );

          if (distance > 1.5) return null;

          exactCategory = distance <= 0.5;
          closeCategory = true;
          score += Math.max(8, 26 - Math.round(distance * 10));

          if (exactCategory) {
            reasons.push(`Nivel muy cercano a suma ${sumaTotal}`);
          } else {
            flags.push(`Nivel sugerido para suma ${sumaTotal}`);
          }
        }

        const playerGender = normalizeGender(player.gender);
        if (genero === "hombres" && playerGender !== "hombre") return null;
        if (genero === "mujeres" && playerGender !== "mujer") return null;

        if (genero === "hombres" || genero === "mujeres") {
          score += 8;
          reasons.push("Género compatible");
        } else if (genero === "mixto") {
          reasons.push("Disponible para formato mixto");
        }

        const playerAvailability = availabilityByPlayer.get(player.id) ?? [];
        const matchesAvailability = availabilityMatches(playerAvailability, fecha, hora, duracion);

        if (matchesAvailability === true) {
          score += 25;
          reasons.push("Coincide con el horario");
        } else if (matchesAvailability === false) {
          score -= 8;
          flags.push("Horario registrado distinto; consultar");
        } else {
          score -= 10;
          flags.push("Sin horario registrado; consultar");
        }

        if (!player.whatsapp) {
          score -= 20;
          flags.push("Sin WhatsApp");
        }

        if (player.opt_in_whatsapp === null) {
          flags.push("Revisar permiso WhatsApp");
        }

        if (player.last_activity_at) {
          const days = Math.max(
            0,
            Math.floor((Date.now() - new Date(player.last_activity_at).getTime()) / 86400000)
          );

          if (days <= 30) {
            score += 5;
            reasons.push("Actividad reciente");
          }
        }

        const group: Recommendation["group"] =
          exactCategory && matchesAvailability === true ? "match" : "suggestion";

        return {
          player,
          score: Math.max(0, Math.min(100, Math.round(score))),
          reasons,
          flags,
          group,
        };
      })
      .filter((item): item is Recommendation => item !== null)
      .sort((a, b) => {
        if (a.group !== b.group) return a.group === "match" ? -1 : 1;
        return b.score - a.score || fullName(a.player).localeCompare(fullName(b.player));
      });
  }, [
    players,
    comunidad,
    sede,
    playerCommunitiesByPlayer,
    availabilityByPlayer,
    categoryMode,
    categoria,
    sumaTotal,
    genero,
    fecha,
    hora,
    duracion,
  ]);

  const exactMatches = recommendations.filter((item) => item.group === "match");
  const suggestedPlayers = recommendations.filter((item) => item.group === "suggestion");
  const visibleRecommendations =
    recommendationView === "matches" ? exactMatches : suggestedPlayers;

  const confirmedIds = Object.entries(statuses)
    .filter(([, status]) => status === "confirmado")
    .map(([id]) => id);
  const waitlistIds = Object.entries(statuses)
    .filter(([, status]) => status === "espera")
    .map(([id]) => id)
    .sort(
      (a, b) =>
        (waitlistPositions[a] ?? 9999) -
        (waitlistPositions[b] ?? 9999)
    );
  const rejectedIds = Object.entries(statuses)
    .filter(([, status]) => status === "rechazado")
    .map(([id]) => id);
  const ambiguousIds = Object.entries(statuses)
    .filter(([, status]) => status === "ambiguo")
    .map(([id]) => id);
  const cuposRestantes = Math.max(cupos - confirmedIds.length, 0);

  function playerNameById(playerId: string) {
    return fullName(players.find((player) => player.id === playerId) ?? ({ first_name: playerId } as PlayerRow));
  }

  function clearCurrentEvent() {
    setSearched(false);
    setEventId(null);
    setStatuses({});
    setWaitlistPositions({});
    setPromotionNotice(null);
    setRecommendationView("matches");
    setNotice("");
    window.localStorage.removeItem("ptm.lastEventId");
    window.localStorage.removeItem("ptm.lastEventMeta");
  }

  function changeCommunity(nextCommunityId: string) {
    clearCurrentEvent();
    setComunidadId(nextCommunityId);
  }

  function changeVenue(nextVenueId: string) {
    clearCurrentEvent();
    setSedeId(nextVenueId);
    const nextVenue = venueOptions.find((venue) => venue.id === nextVenueId);
    if (nextVenue) setDuracion(nextVenue.default_duration_minutes ?? 90);
  }

  async function createEventAndSearch() {
    if (!canCreateMatches) {
      setNotice(`${selectedStaff.full_name} no tiene permiso para crear partidos.`);
      return;
    }

    if (!comunidad) {
      setNotice("Selecciona una comunidad.");
      return;
    }

    if (!sede) {
      setNotice("Selecciona una sede.");
      return;
    }

    if (usingOtherVenue && !otraSede.trim()) {
      setNotice("Escribe el nombre de la sede o deja ‘Por definir’. ");
      return;
    }

    if (canEditPayments && precioBaseAmount === null) {
      setNotice(
        "El precio base no es válido. Usa 12, 10.50 o 0 si será gratis."
      );
      return;
    }

    if (
      !Number.isInteger(cupos) ||
      cupos < 2 ||
      cupos > 100
    ) {
      setNotice(
        "La cantidad de jugadores debe estar entre 2 y 100."
      );
      return;
    }

    if (
      !Number.isInteger(duracion) ||
      duracion < 30 ||
      duracion > 480
    ) {
      setNotice(
        "La duración debe estar entre 30 y 480 minutos."
      );
      return;
    }

    const commissionAmount = canEditPayments
      ? amountFromText(comisionPartido)
      : 0;

    if (canEditPayments && commissionAmount === null) {
      setNotice(
        "La comisión no es válida. Usa 7.50, 10 o 0."
      );
      return;
    }

    if (!allowedCategories.some((item) => item.value === categoria)) {
      setNotice("La categoría elegida no está permitida para esta comunidad.");
      return;
    }

    setSaving(true);
    setNotice("Guardando partido y buscando jugadores compatibles...");

    try {
      const title = `${categoriaVisible} · ${sedeVisible} · ${fecha} ${hora}`;

      const id = await createManualEvent({
        communityId: comunidad.id,
        venueId: sede.id,
        sportId: comunidad.sport_id ?? undefined,
        title,
        eventDate: fecha,
        startTime: hora,
        durationMinutes: duracion,
        courtsCount: canchas,
        playersNeeded: cupos,
        category: categoria,
        customMessage: mensajeBase,
        paymentDefaultAmount: canEditPayments
          ? precioBaseAmount
          : null,
        paymentDefaultNotes: canEditPayments
          ? precioNotas.trim() || null
          : null,
        genderMode: genero,
        organizerStaffId: selectedStaff.id,
        organizerName: selectedStaff.full_name,
        commissionAmount: canEditPayments
          ? commissionAmount ?? 0
          : 0,
        commissionNotes: canEditPayments
          ? comisionNotas.trim() || null
          : null,
      });

      setEventId(id);
      setStatuses({});
      setWaitlistPositions({});
      setPromotionNotice(null);
      setRecommendationView(exactMatches.length ? "matches" : "suggestions");
      setSearched(true);

      const meta = {
        comunidadId: comunidad.id,
        sedeId: sede.id,
        otraSede,
        fecha,
        hora,
        duracion,
        categoria,
        categoryMode,
        sumaTotal,
        genero,
        canchas,
        cupos,
        comisionPartido: commissionAmount ?? 0,
        comisionNotas,
        mensajeBase,
        precioBase: precioBaseAmount,
        precioNotas,
      };

      window.localStorage.setItem("ptm.lastEventId", id);
      window.localStorage.setItem("ptm.lastEventMeta", JSON.stringify(meta));

      setNotice(
        exactMatches.length || suggestedPlayers.length
          ? `Partido guardado. Coinciden ${exactMatches.length} jugador(es) y te sugiero ${suggestedPlayers.length} más de esta comunidad.`
          : "Partido guardado. No encontré jugadores de esta comunidad con categoría exacta o cercana."
      );
    } catch (error: any) {
      setNotice(
        `No se pudo guardar el partido: ${error.message}. Si elegiste “Otra / por definir”, verifica que primero ejecutaste el SQL de este paquete.`
      );
    } finally {
      setSaving(false);
    }
  }

  async function refreshParticipations(options?: { showNotice?: boolean }) {
    if (!eventId) return;

    try {
      const rows = await loadParticipations(eventId);
      const nextStatuses: StatusMap = {};
      const nextWaitlistPositions: WaitlistMap = {};

      for (const row of rows) {
        if (row.status === "confirmado") nextStatuses[row.player_id] = "confirmado";

        if (row.status === "lista_espera") {
          nextStatuses[row.player_id] = "espera";
          nextWaitlistPositions[row.player_id] = Number(row.waitlist_position ?? 0);
        }

        if (row.status === "rechazo") nextStatuses[row.player_id] = "rechazado";
        if (row.status === "ambiguo") nextStatuses[row.player_id] = "ambiguo";
      }

      setStatuses(nextStatuses);
      setWaitlistPositions(nextWaitlistPositions);

      if (options?.showNotice !== false) {
        setNotice("Respuestas actualizadas desde Supabase.");
      }
    } catch (error: any) {
      setNotice(`No se pudieron actualizar las respuestas: ${error.message}`);
    }
  }

  async function logMessage(item: Recommendation, body: string) {
    if (!eventId) return;

    try {
      const messageId = await saveManualMessage({
        eventId,
        playerId: item.player.id,
        body,
      });

      await saveInvitation({
        eventId,
        playerId: item.player.id,
        messageId,
        score: item.score,
        reasons: item.reasons,
      });

      setNotice(`Invitación de ${fullName(item.player)} guardada en Supabase.`);
    } catch (error: any) {
      setNotice(`No se pudo guardar el registro del mensaje: ${error.message}`);
    }
  }

  async function copyMessage(item: Recommendation, message: string) {
    if (!canRegisterResponses) {
      setNotice(
        `${selectedStaff.full_name} no tiene permiso para registrar invitaciones.`
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(message);
      await logMessage(item, message);
      setNotice(`Mensaje de ${fullName(item.player)} copiado y registrado.`);
    } catch (error: any) {
      setNotice(`No se pudo copiar el mensaje: ${error.message}`);
    }
  }

  async function copyOperationalMessage(player: PlayerRow, message: string, label: string) {
    try {
      await navigator.clipboard.writeText(message);

      if (eventId) {
        await saveManualMessage({
          eventId,
          playerId: player.id,
          body: message,
        });
      }

      setNotice(`${label} de ${fullName(player)} copiado.`);
    } catch (error: any) {
      setNotice(`No se pudo copiar el aviso: ${error.message}`);
    }
  }


  async function changeParticipationStatus(
    playerId: string,
    requestedStatus:
      | "confirmado"
      | "lista_espera"
      | "rechazo"
      | "ambiguo"
      | "pendiente"
  ) {
    if (!canRegisterResponses) {
      setNotice(
        `${selectedStaff.full_name} no tiene permiso para registrar respuestas.`
      );
      return;
    }

    if (!eventId) {
      setNotice("Primero crea o abre un partido.");
      return;
    }

    setChangingPlayerId(playerId);
    setPromotionNotice(null);
    setNotice("Guardando respuesta...");

    try {
      let rawResult: unknown;

      if (requestedStatus === "pendiente") {
        rawResult = await removeParticipation({
          eventId,
          playerId,
        });
      } else {
        const orderedWaitlist = Object.entries(statuses)
          .filter(([, status]) => status === "espera")
          .map(([id]) => id)
          .sort(
            (a, b) =>
              (waitlistPositions[a] ?? 9999) -
              (waitlistPositions[b] ?? 9999)
          );

        const waitlistPosition =
          requestedStatus === "lista_espera"
            ? statuses[playerId] === "espera"
              ? waitlistPositions[playerId] ??
                orderedWaitlist.length + 1
              : orderedWaitlist.length + 1
            : undefined;

        rawResult = await saveParticipation({
          eventId,
          playerId,
          status: requestedStatus,
          waitlistPosition,
          paymentDueAmount:
            requestedStatus === "confirmado" &&
            canEditPayments
              ? precioBaseSeguro
              : null,
          paymentDueNotes:
            requestedStatus === "confirmado" &&
            canEditPayments
              ? precioNotas.trim() ||
                "Precio base del partido"
              : null,
        });
      }

      const result = normalizeRpcResult(rawResult);

      await refreshParticipations({
        showNotice: false,
      });

      const playerName = playerNameById(playerId);

      const finalStatus =
        result.final_status ?? requestedStatus;

      const promotedPlayerId =
        result.promoted_player_id ?? null;

      if (promotedPlayerId) {
        const promotedPlayer = players.find(
          (player) => player.id === promotedPlayerId
        );

        if (promotedPlayer) {
          const message = buildPromotionMessage({
            player: promotedPlayer,
            categoryText: categoriaMensaje,
            venueText: sedeVisible,
            date: fecha,
            time: hora,
          });

          setPromotionNotice({
            playerId: promotedPlayer.id,
            playerName: fullName(promotedPlayer),
            phone: promotedPlayer.whatsapp,
            message,
          });
        }
      }

      if (promotedPlayerId) {
        setNotice(
          `${playerName} salió de confirmados. ${playerNameById(
            promotedPlayerId
          )} pasó automáticamente de lista de espera a confirmado.`
        );
      } else if (finalStatus === "confirmado") {
        const paymentText =
          canViewPayments
            ? ` Debe pagar ${money(
                precioBaseSeguro
              )}.`
            : "";

        setNotice(
          `${playerName} quedó confirmado.${paymentText} Quedan ${Number(
            result.spots_remaining ?? 0
          )} cupo(s).`
        );
      } else if (finalStatus === "lista_espera") {
        setNotice(
          `${playerName} quedó en lista de espera, puesto #${Number(
            result.waitlist_position ?? 1
          )}.`
        );
      } else if (finalStatus === "rechazo") {
        setNotice(
          `${playerName} fue marcado como “No puede”.`
        );
      } else if (finalStatus === "ambiguo") {
        setNotice(
          `${playerName} fue marcado como respuesta ambigua.`
        );
      } else {
        setNotice(
          `${playerName} volvió a pendiente.`
        );
      }
    } catch (error: any) {
      setNotice(
        `No se pudo guardar la respuesta: ${
          error?.message ?? "Error desconocido"
        }`
      );
    } finally {
      setChangingPlayerId(null);
    }
  }

  async function registerOk(playerId: string) {
    const currentStatus = statuses[playerId] ?? "pendiente";

    await changeParticipationStatus(
      playerId,
      currentStatus === "confirmado"
        ? "pendiente"
        : "confirmado"
    );
  }

  async function registerWaitlist(playerId: string) {
    const currentStatus = statuses[playerId] ?? "pendiente";

    await changeParticipationStatus(
      playerId,
      currentStatus === "espera" ? "pendiente" : "lista_espera"
    );
  }

  async function registerSimpleStatus(
    playerId: string,
    nextStatus: "rechazado" | "ambiguo"
  ) {
    const currentStatus = statuses[playerId] ?? "pendiente";

    await changeParticipationStatus(
      playerId,
      currentStatus === nextStatus
        ? "pendiente"
        : nextStatus === "rechazado"
          ? "rechazo"
          : "ambiguo"
    );
  }

  function renderPlayerCard(item: Recommendation) {
    const player = item.player;
    const status = statuses[player.id] ?? "pendiente";
    const message = buildMessage({
      player,
      categoryText: categoriaMensaje,
      venueText: sedeVisible,
      date: fecha,
      time: hora,
      courts: canchas,
      spots: cupos,
      gender: genero,
      duration: duracion,
      template: mensajeBase,
    });
    const playerAvailability = availabilityByPlayer.get(player.id) ?? [];
    const waitlistPosition = waitlistPositions[player.id] ?? null;
    const isChanging = changingPlayerId === player.id;
    const statusMessage =
      status === "confirmado" || status === "espera"
        ? buildParticipationStatusMessage({
            player,
            status,
            waitlistPosition,
            categoryText: categoriaMensaje,
            venueText: sedeVisible,
            date: fecha,
            time: hora,
          })
        : null;

    return (
      <div className="card player-card" key={player.id}>
        <div className="player-top">
          <div>
            <strong>{fullName(player)}</strong>
            <p>
              {categoryLabel(player.validated_category)}
              {player.secondary_category ? ` / ${categoryLabel(player.secondary_category)}` : ""} · {normalizeGender(player.gender) === "mujer" ? "Mujer" : "Hombre"} · {sideLabel(player.preferred_side)}
            </p>
            <p className="help-text">WhatsApp: {player.whatsapp || "Sin número"}</p>
          </div>

          <div className="score">{item.score}</div>
        </div>

        <div className="row-actions">
          <span className={item.group === "match" ? "badge good" : "badge warn"}>
            {item.group === "match" ? "Coincide con tu búsqueda" : "Te sugiero"}
          </span>

          <span className={`badge ${statusClass(status)}`}>
            Estado: {statusLabel(status)}
            {status === "espera" && waitlistPosition ? ` #${waitlistPosition}` : ""}
          </span>

          {item.reasons.slice(0, 4).map((reason) => (
            <span className="badge good" key={reason}>{reason}</span>
          ))}

          {item.flags.map((flag) => (
            <span className="badge warn" key={flag}>{flag}</span>
          ))}
        </div>

        <p className="help-text">Disponibilidad: {availabilityText(playerAvailability)}</p>

        <div className="copy-box">{message}</div>

        <div className="row-actions">
          <button className="btn secondary" onClick={() => copyMessage(item, message)}>
            Copiar mensaje
          </button>

          {player.whatsapp && canRegisterResponses ? (
            <a
              className="btn"
              href={whatsappLink(player.whatsapp, message)}
              target="_blank"
              rel="noreferrer"
              onClick={() => void logMessage(item, message)}
            >
              Abrir WhatsApp
            </a>
          ) : null}

          <button
            className="btn ghost"
            disabled={!canRegisterResponses || isChanging}
            onClick={() => registerOk(player.id)}
          >
            {isChanging
              ? "Guardando..."
              : status === "confirmado"
                ? "↩️ Quitar confirmado"
                : status === "espera"
                  ? "✅ Pasar a OK"
                  : "✅ Registrar OK"}
          </button>

          <button
            className="btn ghost"
            disabled={!canRegisterResponses || isChanging}
            onClick={() => registerWaitlist(player.id)}
          >
            {status === "espera" ? "↩️ Quitar de espera" : "🟡 Lista de espera"}
          </button>

          <button
            className="btn ghost"
            disabled={!canRegisterResponses || isChanging}
            onClick={() => registerSimpleStatus(player.id, "rechazado")}
          >
            ❌ No puede
          </button>

          <button
            className="btn ghost"
            disabled={!canRegisterResponses || isChanging}
            onClick={() => registerSimpleStatus(player.id, "ambiguo")}
          >
            🤔 Ambiguo
          </button>
        </div>

        {statusMessage ? (
          <div className="row-actions" style={{ marginTop: 10 }}>
            <button
              className="btn secondary"
              onClick={() =>
                copyOperationalMessage(
                  player,
                  statusMessage,
                  status === "confirmado" ? "Confirmación" : "Aviso de espera"
                )
              }
            >
              {status === "confirmado" ? "Copiar confirmación" : "Copiar aviso de espera"}
            </button>

            {player.whatsapp ? (
              <a
                className="btn secondary"
                href={whatsappLink(player.whatsapp, statusMessage)}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (eventId) {
                    void saveManualMessage({
                      eventId,
                      playerId: player.id,
                      body: statusMessage,
                    });
                  }
                }}
              >
                Abrir WhatsApp del aviso
              </a>
            ) : null}
          </div>
        ) : null}

        <p className="help-text">
          El último cupo se controla en Supabase. Si el partido está lleno, el siguiente OK entra automáticamente a espera.
        </p>
      </div>
    );
  }

  if (loading) {
    return <PageHeader title="🎾 Llenar Canchas" description="Cargando comunidades, sedes y jugadores..." />;
  }

  if (!selectedStaff.id) {
    return (
      <>
        <PageHeader
          title="🎾 Llenar Canchas"
          description="No se pudo validar el acceso de esta sesión."
        />

        <div className="card">
          <h2>Acceso interno no disponible</h2>

          <p>
            {staffError ||
              notice ||
              "Este correo no está vinculado a un usuario interno activo."}
          </p>

          <div className="row-actions">
            <Link className="btn" href="/login">
              Volver al Login
            </Link>

            <Link className="btn secondary" href="/">
              Ir al Dashboard
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!communities.length) {
    return (
      <>
        <PageHeader title="🎾 Llenar Canchas" description="No hay comunidades activas." />
        <div className="card">
          <p>{notice || "Crea o activa una comunidad antes de armar un partido."}</p>
          <Link className="btn" href="/comunidades">Abrir Comunidades</Link>
        </div>
      </>
    );
  }

  if (!staffCommunityOptions.length) {
    return (
      <>
        <PageHeader title="🎾 Llenar Canchas" description="El operador no tiene comunidades asignadas." />
        <div className="card">
          <h2>{selectedStaff.full_name}</h2>
          <p>
            Este perfil no tiene comunidades permitidas. Entra a Staff como administrador y asígnale al menos una comunidad.
          </p>
          <div className="row-actions">
            <Link className="btn" href="/">
              Volver al Dashboard
            </Link>

            {staffCanSeeEverything(selectedStaff) ? (
              <Link className="btn secondary" href="/staff">
                Abrir Staff
              </Link>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="🎾 Llenar Canchas"
        description="Crea el partido rápido y filtra por comunidad, categoría principal/secundaria y disponibilidad real."
        action={<Link className="btn secondary" href="/eventos">Ver partidos</Link>}
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-actions">
          <span className="badge good">Supabase conectado</span>
          <span className="badge good">Operador: {selectedStaff.full_name}</span>
          <span className="badge neutral">{staffRoleLabel(selectedStaff.role)}</span>
          <span className="badge neutral">{players.filter((player) => player.active !== false).length} jugadores activos</span>
          <span className="badge neutral">{staffCommunityOptions.length} comunidades permitidas</span>
        </div>

        {notice ? <p><strong>{notice}</strong></p> : null}

        <div className="row-actions" style={{ marginTop: 12 }}>
          <button className="btn secondary" onClick={loadData}>🔄 Actualizar datos</button>
          <Link className="btn secondary" href="/manual-asistente">Manual</Link>
          {searched ? <button className="btn" onClick={clearCurrentEvent}>➕ Nuevo partido</button> : null}
          {eventId ? <Link className="btn secondary" href={`/eventos/${eventId}`}>Abrir detalle</Link> : null}
        </div>

        <p className="help-text">
          Modo WhatsApp manual: copia el mensaje y pégalo en WhatsApp Business. No se hacen envíos automáticos todavía.
        </p>
      </div>

      {promotionNotice ? (
        <div
          className="card"
          style={{
            marginBottom: 16,
            border: "1px solid #bbf7d0",
          }}
        >
          <div className="player-top">
            <div>
              <h2>🔄 Reemplazo automático</h2>
              <p>
                <strong>{promotionNotice.playerName}</strong> pasó del primer puesto de espera a confirmado.
              </p>
              <p className="help-text">
                Copia el aviso y envíalo por WhatsApp para confirmar que vio el cambio.
              </p>
            </div>

            <span className="badge good">Cupo confirmado</span>
          </div>

          <div className="copy-box">{promotionNotice.message}</div>

          <div className="row-actions">
            <button
              className="btn"
              onClick={async () => {
                const player = players.find((item) => item.id === promotionNotice.playerId);
                if (!player) return;

                await copyOperationalMessage(
                  player,
                  promotionNotice.message,
                  "Aviso de reemplazo"
                );
              }}
            >
              Copiar aviso de reemplazo
            </button>

            {promotionNotice.phone ? (
              <a
                className="btn secondary"
                href={whatsappLink(promotionNotice.phone, promotionNotice.message)}
                target="_blank"
                rel="noreferrer"
              >
                Abrir WhatsApp
              </a>
            ) : null}

            <button
              className="btn ghost"
              onClick={() => setPromotionNotice(null)}
            >
              Cerrar aviso
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-2">
        <div className="card">
          <h2>1. Datos del partido</h2>

          {!canCreateMatches ? (
            <p><strong>Este operador está en modo consulta: no tiene permiso para crear partidos.</strong></p>
          ) : null}

          {!allowedCategories.length ? (
            <p><strong>No hay categorías disponibles para esta combinación de comunidad y permisos.</strong></p>
          ) : null}

          {!venueOptions.length ? (
            <p><strong>No hay sedes asignadas a este operador para esta comunidad.</strong></p>
          ) : null}

          <div className="grid grid-2">
            <label>
              Comunidad
              <select
                value={comunidadId}
                disabled={searched}
                onChange={(event) => changeCommunity(event.target.value)}
              >
                {staffCommunityOptions.map((community) => (
                  <option value={community.id} key={community.id}>{community.name}</option>
                ))}
              </select>
            </label>

            <label>
              Sede
              <select
                value={sedeId}
                disabled={searched}
                onChange={(event) => changeVenue(event.target.value)}
              >
                {venueOptions.map((venue) => (
                  <option value={venue.id} key={venue.id}>{venue.name}</option>
                ))}
              </select>
            </label>
          </div>

          {usingOtherVenue ? (
            <label>
              Nombre de la otra sede
              <input
                value={otraSede}
                disabled={searched}
                placeholder="Ej: Club nuevo / por confirmar"
                onChange={(event) => {
                  clearCurrentEvent();
                  setOtraSede(event.target.value);
                }}
              />
            </label>
          ) : null}

          <div className="grid grid-3">
            <label>
              Fecha
              <input
                type="date"
                value={fecha}
                disabled={searched}
                onChange={(event) => {
                  clearCurrentEvent();
                  setFecha(event.target.value);
                }}
              />
            </label>

            <label>
              Hora
              <input
                type="time"
                value={hora}
                disabled={searched}
                onChange={(event) => {
                  clearCurrentEvent();
                  setHora(event.target.value);
                }}
              />
            </label>

            <label>
              Duración en minutos
              <input
                type="number"
                min="30"
                max="480"
                step="15"
                value={duracion}
                disabled={searched}
                onChange={(event) => {
                  clearCurrentEvent();
                  setDuracion(
                    Number(
                      event.target.value
                    )
                  );
                }}
              />

              <span className="help-text">
                Ejemplos: 90 minutos, 120 minutos o cualquier duración entre 30 y 480.
              </span>
            </label>
          </div>

          <div className="grid grid-3">
            <label>
              Categoría
              <select
                value={categoria}
                disabled={searched}
                onChange={(event) => {
                  clearCurrentEvent();
                  setCategoria(event.target.value as Category);
                }}
              >
                {allowedCategories.map((item) => (
                  <option value={item.value} key={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <label>
              Género
              <select
                value={genero}
                disabled={searched}
                onChange={(event) => {
                  clearCurrentEvent();
                  setGenero(event.target.value as GenderMode);
                }}
              >
                {allowedGenderModes.includes("libre") ? (
                  <option value="libre">Libre</option>
                ) : null}
                {allowedGenderModes.includes("hombres") ? (
                  <option value="hombres">Solo hombres</option>
                ) : null}
                {allowedGenderModes.includes("mujeres") ? (
                  <option value="mujeres">Solo mujeres</option>
                ) : null}
                {allowedGenderModes.includes("mixto") ? (
                  <option value="mixto">Mixto</option>
                ) : null}
              </select>
            </label>

            <label>
              Canchas
              <input
                type="number"
                min="1"
                max="20"
                value={canchas}
                disabled={searched}
                onChange={(event) => {
                  clearCurrentEvent();
                  setCanchas(
                    Number(
                      event.target.value
                    )
                  );
                }}
              />
            </label>

            <label>
              Jugadores necesarios
              <input
                type="number"
                min="2"
                max="100"
                value={cupos}
                disabled={searched}
                onChange={(event) => {
                  clearCurrentEvent();
                  setCupos(
                    Number(
                      event.target.value
                    )
                  );
                }}
              />

              <span className="help-text">
                Es independiente de las canchas: una cancha puede tener 4, 5 o 6 jugadores.
              </span>
            </label>
          </div>

          {canEditPayments ? (
            <div className="grid grid-2" style={{ marginTop: 12 }}>
              <label>
                Comisión de este partido
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={comisionPartido}
                  disabled={searched}
                  placeholder="Ej: 7.50, 10 o 0"
                  onChange={(event) => {
                    clearCurrentEvent();
                    setComisionPartido(event.target.value);
                  }}
                />

                <span className="help-text">
                  Manual por partido. Útil si hay 5 jugadores, precio especial o comisión distinta.
                </span>
              </label>

              <label>
                Nota de comisión
                <input
                  value={comisionNotas}
                  disabled={searched}
                  placeholder="Ej: cancha 5 personas; comisión $10"
                  onChange={(event) => {
                    clearCurrentEvent();
                    setComisionNotas(event.target.value);
                  }}
                />
              </label>
            </div>
          ) : null}

          <details style={{ marginTop: 12 }}>
            <summary><strong>Opciones avanzadas</strong></summary>

            <div style={{ height: 12 }} />

            <div className="grid grid-2">
              <label>
                Modo de categoría
                <select
                  value={categoryMode}
                  disabled={searched}
                  onChange={(event) => {
                    clearCurrentEvent();
                    setCategoryMode(event.target.value as CategoryMode);
                  }}
                >
                  <option value="categoria">Categoría normal</option>
                  <option value="suma">Suma orientativa</option>
                </select>
              </label>

              {categoryMode === "suma" ? (
                <label>
                  Suma total
                  <input
                    type="number"
                    min="4"
                    max="14"
                    value={sumaTotal}
                    disabled={searched}
                    onChange={(event) => {
                      clearCurrentEvent();
                      setSumaTotal(Number(event.target.value));
                    }}
                  />
                </label>
              ) : canEditPayments ? (
                <label>
                  Precio por jugador
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={precioBase}
                    disabled={searched}
                    onChange={(event) => {
                      clearCurrentEvent();
                      setPrecioBase(event.target.value);
                    }}
                  />
                </label>
              ) : (
                <div className="mini-panel">
                  <strong>Información financiera restringida</strong>
                  <p className="help-text">
                    Este usuario puede organizar el partido, pero no puede editar precios.
                  </p>
                </div>
              )}
            </div>

            {categoryMode === "suma" && canEditPayments ? (
              <label>
                Precio por jugador
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={precioBase}
                  disabled={searched}
                  onChange={(event) => {
                    clearCurrentEvent();
                    setPrecioBase(event.target.value);
                  }}
                />
              </label>
            ) : null}

            {canEditPayments ? (
              <>
                <label>
                  Nota del precio
                  <input
                    value={precioNotas}
                    disabled={searched}
                    placeholder="Ej: precio normal, cortesía, cancha compartida"
                    onChange={(event) => {
                      clearCurrentEvent();
                      setPrecioNotas(event.target.value);
                    }}
                  />
                </label>

              </>
            ) : null}

            <label>
              Mensaje editable
              <textarea
                value={mensajeBase}
                disabled={searched}
                onChange={(event) => {
                  clearCurrentEvent();
                  setMensajeBase(event.target.value);
                }}
              />
            </label>

            <p className="help-text">
              Variables: {"{{nombre}}"}, {"{{categoria}}"}, {"{{sede}}"}, {"{{fecha}}"}, {"{{hora}}"}, {"{{canchas}}"}, {"{{cupos}}"}, {"{{genero}}"}, {"{{duracion}}"}.
            </p>
          </details>

          {!searched ? (
            <button className="btn" disabled={saving || !canCreateMatches || !allowedCategories.length || !allowedGenderModes.length || !venueOptions.length} onClick={createEventAndSearch} style={{ marginTop: 16 }}>
              {saving ? "Guardando..." : "Crear partido y buscar jugadores"}
            </button>
          ) : null}
        </div>

        <div className="card">
          <h2>2. Resumen rápido</h2>

          <p><strong>{comunidad?.name ?? "Comunidad"}</strong> · {sedeVisible}</p>
          <p>{fecha} · {hora}</p>
          <p><strong>{categoriaVisible}</strong> · {genderLabel(genero)}</p>
          <p><strong>{canchas}</strong> cancha(s) · <strong>{cupos}</strong> jugadores · <strong>{duracion}</strong> min</p>
          {canViewPayments ? (
            <>
              <p>
                Precio base:{" "}
                <strong>{money(precioBaseSeguro)}</strong>{" "}
                por jugador
              </p>

              <p>
                Total esperado lleno:{" "}
                <strong>
                  {money(precioBaseSeguro * cupos)}
                </strong>
              </p>

              <p>
                Comisión de este partido:{" "}
                <strong>
                  {money(
                    amountFromText(
                      comisionPartido
                    ) ?? 0
                  )}
                </strong>
              </p>
            </>
          ) : (
            <p className="help-text">
              Los precios, pagos y comisiones están ocultos para este usuario.
            </p>
          )}


          <div className="mini-panel">
            <h3>Alcance de la comunidad</h3>
            <p className="help-text">
              Categorías permitidas: {allowedCategories.map((item) => item.label).join(", ")}. Géneros permitidos: {allowedGenderModes.map(genderLabel).join(", ")}.
            </p>
            <p className="help-text">
              Sedes permitidas: {venueOptions.map((venue) => venue.name).join(", ")}.
            </p>
          </div>

          <div className="mini-panel" style={{ marginTop: 12 }}>
            <h3>Cómo se muestran los jugadores</h3>
            <p className="help-text">
              “Coinciden con tu búsqueda” reúne jugadores de esta comunidad con categoría principal o secundaria exacta y horario compatible.
              “Te sugiero” muestra jugadores de la misma comunidad con categoría cercana o con un horario registrado diferente, para que igual puedas consultarles.
            </p>
          </div>

          {searched ? (
            <div className="mini-panel" style={{ marginTop: 12 }}>
              <h3>Estado del partido</h3>
              <p><strong>{confirmedIds.length}/{cupos}</strong> confirmados · faltan <strong>{cuposRestantes}</strong></p>
              <p>{waitlistIds.length} espera · {rejectedIds.length} no pueden · {ambiguousIds.length} ambiguos</p>
              {canViewPayments ? (
                <p>
                  Total esperado actual:{" "}
                  <strong>
                    {money(
                      precioBaseSeguro *
                        confirmedIds.length
                    )}
                  </strong>
                </p>
              ) : null}

              <div className="row-actions">
                {cuposRestantes === 0 ? <span className="badge good">Partido lleno</span> : <span className="badge warn">Faltan {cuposRestantes}</span>}
                <button className="btn secondary" onClick={() => void refreshParticipations()}>Actualizar respuestas</button>
              </div>

              {confirmedIds.length ? (
                <p className="help-text">Confirmados: {confirmedIds.map(playerNameById).join(", ")}</p>
              ) : null}

              {waitlistIds.length ? (
                <p className="help-text">
                  Lista de espera: {waitlistIds
                    .map((playerId) => `#${waitlistPositions[playerId] ?? "?"} ${playerNameById(playerId)}`)
                    .join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {searched ? (
        <>
          <div style={{ height: 20 }} />

          <div className="card" style={{ marginBottom: 16 }}>
            <h2>3. Jugadores para este partido</h2>

            <div
              className="row-actions"
              style={{
                marginBottom: 14,
                padding: 8,
                borderRadius: 16,
                background: "#f3f4f6",
              }}
            >
              <button
                type="button"
                className={recommendationView === "matches" ? "btn" : "btn secondary"}
                onClick={() => setRecommendationView("matches")}
              >
                Coinciden con tu búsqueda ({exactMatches.length})
              </button>

              <button
                type="button"
                className={recommendationView === "suggestions" ? "btn" : "btn secondary"}
                onClick={() => setRecommendationView("suggestions")}
              >
                Te sugiero ({suggestedPlayers.length})
              </button>
            </div>

            {recommendationView === "matches" ? (
              <p className="help-text">
                Categoría principal o secundaria exacta, misma comunidad y horario compatible.
              </p>
            ) : (
              <p className="help-text">
                Siempre pertenecen a esta comunidad. Pueden tener categoría cercana o un horario distinto al registrado;
                aparecen para que los consultes porque la disponibilidad puede cambiar.
              </p>
            )}

            {!visibleRecommendations.length ? (
              <div className="mini-panel">
                <h3>
                  {recommendationView === "matches"
                    ? "No hay coincidencias exactas"
                    : "No hay sugerencias adicionales"}
                </h3>

                <p className="help-text">
                  {recommendationView === "matches"
                    ? "Abre “Te sugiero” para ver jugadores de esta misma comunidad con categoría cercana o con otro horario registrado."
                    : "No hay más jugadores activos de esta comunidad con categoría exacta o cercana."}
                </p>

                <div className="row-actions">
                  {recommendationView === "matches" && suggestedPlayers.length ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setRecommendationView("suggestions")}
                    >
                      Ver sugerencias
                    </button>
                  ) : null}

                  <Link className="btn secondary" href="/jugadores">
                    Revisar jugadores
                  </Link>

                  <Link className="btn secondary" href="/comunidades">
                    Revisar comunidad
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid">{visibleRecommendations.map(renderPlayerCard)}</div>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}