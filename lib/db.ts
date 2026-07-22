import { supabase } from "./supabaseClient";
import type { Category, Community, Player, Side, Venue } from "./types";

export const PTM_ACCOUNT_ID = "10000000-0000-0000-0000-000000000001";

// Alias temporal para no romper pantallas antiguas mientras terminamos la migración.
export const DEMO_ACCOUNT_ID = PTM_ACCOUNT_ID;

type StaffProfile = {
  id?: string;
  account_id?: string;
  full_name?: string;
  role?: string;
  active?: boolean;
  auth_status?: string;
  permissions?: Record<string, boolean> | null;
  can_view_payments?: boolean;
};

export type ParticipationStatus =
  | "confirmado"
  | "lista_espera"
  | "rechazo"
  | "ambiguo"
  | "cancelado"
  | "no_respondio"
  | "asistio"
  | "no_show"
  | "reemplazo";

export type PaymentStatus = "pendiente" | "pagado" | "no_pago";

export type PaymentMethod =
  | "efectivo"
  | "transferencia"
  | "tarjeta_link"
  | "deposito"
  | null;

export type ParticipationWithPayment = {
  player_id: string;
  status: ParticipationStatus;
  waitlist_position?: number | null;

  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  payment_amount: number | null;
  payment_reference: string | null;
  payment_notes: string | null;
  payment_proof_url: string | null;
  paid_at: string | null;

  payment_due_amount: number | null;
  payment_due_notes: string | null;
};

function normalizeRpcObject(value: unknown): Record<string, any> {
  if (Array.isArray(value) && value.length) {
    const first = value[0];

    if (first && typeof first === "object") {
      return first as Record<string, any>;
    }
  }

  if (value && typeof value === "object") {
    return value as Record<string, any>;
  }

  return {};
}

function isMissingSecurityObject(error: any) {
  const code = String(error?.code ?? "").toUpperCase();

  const message = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    code === "42P01" ||
    code === "42883" ||
    code === "PGRST202" ||
    code === "PGRST205"
  ) {
    return true;
  }

  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("could not find the function") ||
    message.includes("schema cache")
  );
}

function normalizeTime(value?: string | null) {
  return (value ?? "00:00").slice(0, 5);
}

function normalizeGender(value?: string | null): "hombre" | "mujer" {
  return value === "mujer" || value === "femenino" ? "mujer" : "hombre";
}

function normalizePaymentStatus(value?: string | null): PaymentStatus {
  if (value === "pagado") return "pagado";
  if (value === "no_pago" || value === "no_pagado") return "no_pago";
  return "pendiente";
}

function normalizePaymentMethod(value?: string | null): PaymentMethod {
  if (value === "efectivo") return "efectivo";
  if (value === "transferencia") return "transferencia";
  if (value === "tarjeta_link" || value === "tarjeta" || value === "link") {
    return "tarjeta_link";
  }
  if (value === "deposito") return "deposito";
  return null;
}

function normalizeAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));

  return Number.isFinite(parsed) ? parsed : null;
}

export async function getCurrentStaffProfile(): Promise<StaffProfile> {
  const { data, error } = await supabase.rpc("ptm_current_staff_profile_v1");

  if (!error) {
    return normalizeRpcObject(data) as StaffProfile;
  }

  if (!isMissingSecurityObject(error)) {
    throw error;
  }

  // Compatibilidad antes de ejecutar el SQL de seguridad.
  // Permite que el MVP siga funcionando mientras se reemplazan archivos.
  return {
    id: "admin-demo",
    account_id: PTM_ACCOUNT_ID,
    full_name: "Alejandro Pincay",
    role: "owner",
    active: true,
    auth_status: "legacy_demo",
    permissions: {
      viewPayments: true,
      editPayments: true,
      managePayments: true,
      viewFinances: true,
      manageFinances: true,
      createEvents: true,
      editEvents: true,
      manageEvents: true,
      cancelEvents: true,
    },
    can_view_payments: true,
  };
}

export async function getCurrentAccountId() {
  const profile = await getCurrentStaffProfile();

  if (!profile.account_id) {
    throw new Error("Tu sesión no está vinculada a una cuenta activa.");
  }

  return profile.account_id;
}

export async function getCurrentOperatorName() {
  const profile = await getCurrentStaffProfile();
  return profile.full_name ?? "Usuario";
}

export async function loadInitialData(): Promise<{
  source: "supabase" | "demo";
  communities: Community[];
  venues: Venue[];
  players: Player[];
  error?: string;
}> {
  try {
    const accountId = await getCurrentAccountId();

    const [
      communitiesRes,
      venuesRes,
      playersRes,
      playerCommunitiesRes,
      playerVenuesRes,
      availabilityRes,
    ] = await Promise.all([
      supabase
        .from("communities")
        .select("id, sport_id, name, city, default_category, active")
        .eq("account_id", accountId)
        .eq("active", true)
        .order("name"),

      supabase
        .from("venues")
        .select("id, name, city, courts_count, default_duration_minutes, active")
        .eq("account_id", accountId)
        .eq("active", true)
        .order("name"),

      supabase
        .from("players")
        .select(
          "id, first_name, last_name, whatsapp, gender, validated_category, preferred_side, reliability_score, opt_in_whatsapp, status, active, deleted_at, last_activity_at"
        )
        .eq("account_id", accountId)
        .eq("active", true)
        .is("deleted_at", null)
        .order("first_name"),

      supabase
        .from("player_communities")
        .select("player_id, community_id, status"),

      supabase
        .from("player_venues")
        .select("player_id, venue_id, preference"),

      supabase
        .from("player_availability")
        .select("player_id, day_of_week, start_time, end_time"),
    ]);

    const errors = [
      communitiesRes.error,
      venuesRes.error,
      playersRes.error,
      playerCommunitiesRes.error,
      playerVenuesRes.error,
      availabilityRes.error,
    ].filter(Boolean);

    if (errors.length) {
      throw new Error(errors.map((error) => error?.message).join(" | "));
    }

    const communities: Community[] = (communitiesRes.data ?? []).map((row: any) => ({
      id: row.id,
      sportId: row.sport_id,
      nombre: row.name,
      ciudad: row.city ?? "Guayaquil",
      categoria: row.default_category as Category | undefined,
      descripcion: "Comunidad guardada en Supabase",
    }));

    const venues: Venue[] = (venuesRes.data ?? []).map((row: any) => ({
      id: row.id,
      nombre: row.name,
      ciudad: row.city ?? "Guayaquil",
      duracionDefault: row.default_duration_minutes ?? 90,
      canchas: row.courts_count ?? 1,
    }));

    const playerIdSet = new Set((playersRes.data ?? []).map((row: any) => row.id));

    const communityByPlayer = new Map<string, string>();

    for (const row of playerCommunitiesRes.data ?? []) {
      if (!playerIdSet.has(row.player_id)) continue;

      if (!communityByPlayer.has(row.player_id)) {
        communityByPlayer.set(row.player_id, row.community_id);
      }
    }

    const venuesByPlayer = new Map<string, string[]>();

    for (const row of playerVenuesRes.data ?? []) {
      if (!playerIdSet.has(row.player_id)) continue;

      const current = venuesByPlayer.get(row.player_id) ?? [];
      current.push(row.venue_id);
      venuesByPlayer.set(row.player_id, current);
    }

    const availabilityByPlayer = new Map<
      string,
      { day: number; start: string; end: string }[]
    >();

    for (const row of availabilityRes.data ?? []) {
      if (!playerIdSet.has(row.player_id)) continue;

      const current = availabilityByPlayer.get(row.player_id) ?? [];
      current.push({
        day: row.day_of_week,
        start: normalizeTime(row.start_time),
        end: normalizeTime(row.end_time),
      });
      availabilityByPlayer.set(row.player_id, current);
    }

    const players: Player[] = (playersRes.data ?? []).map((row: any) => {
      const lastActivity = row.last_activity_at ? new Date(row.last_activity_at) : null;

      const diffDays = lastActivity
        ? Math.max(0, Math.round((Date.now() - lastActivity.getTime()) / 86400000))
        : 30;

      return {
        id: row.id,
        nombre: [row.first_name, row.last_name].filter(Boolean).join(" "),
        whatsapp: row.whatsapp,
        categoria: (row.validated_category ?? "C5") as Category,
        genero: normalizeGender(row.gender),
        lado: (row.preferred_side ?? "cualquiera") as Side,
        comunidadId: communityByPlayer.get(row.id) ?? communities[0]?.id ?? "",
        sedeIds: venuesByPlayer.get(row.id) ?? [],
        disponibilidad: availabilityByPlayer.get(row.id) ?? [],
        confiabilidad: row.reliability_score ?? 70,
        tasaRespuesta: Math.max(50, Math.min(95, row.reliability_score ?? 70)),
        ultimaActividadDias: diffDays,
        optIn: !!row.opt_in_whatsapp,
        invitadoHoy: false,
      };
    });

    return {
      source: "supabase",
      communities,
      venues,
      players,
      error:
        !communities.length || !venues.length || !players.length
          ? "La cuenta está conectada y conserva datos reales, pero todavía falta cargar comunidades, sedes o jugadores."
          : undefined,
    };
  } catch (error: any) {
    console.warn(
      "No se pudo cargar Supabase. Por seguridad no se mostrarán datos ficticios.",
      error?.message
    );

    return {
      source: "supabase",
      communities: [],
      venues: [],
      players: [],
      error: error?.message ?? "Error desconocido",
    };
  }
}

export async function createManualEvent(input: {
  communityId: string;
  venueId: string;
  sportId?: string;
  title: string;
  eventDate: string;
  startTime: string;
  durationMinutes: number;
  courtsCount: number;
  playersNeeded: number;
  category: Category;
  customMessage: string;
  paymentDefaultAmount?: number | null;
  paymentDefaultNotes?: string | null;
  genderMode?: "libre" | "hombres" | "mujeres" | "mixto";
  organizerStaffId?: string | null;
  organizerName?: string | null;
  commissionAmount?: number | null;
  commissionNotes?: string | null;
}) {
  const accountId = await getCurrentAccountId();
  const profile = await getCurrentStaffProfile();
  const sportId = input.sportId ?? (await getPadelSportId());
  const commissionAmount = input.commissionAmount ?? 0;

  const { data, error } = await supabase
    .from("events")
    .insert({
      account_id: accountId,
      community_id: input.communityId,
      venue_id: input.venueId,
      sport_id: sportId,
      title: input.title,
      event_type: "partido_libre",
      event_date: input.eventDate,
      start_time: input.startTime,
      duration_minutes: input.durationMinutes,
      courts_count: input.courtsCount,
      players_needed: input.playersNeeded,
      category: input.category,
      status: "buscando_jugadores",
      custom_message: input.customMessage,
      payment_default_amount: input.paymentDefaultAmount ?? 0,
      payment_default_notes: input.paymentDefaultNotes ?? null,
      gender_mode: input.genderMode ?? "libre",
      organizer_staff_id: input.organizerStaffId ?? profile.id ?? null,
      organizer_name: input.organizerName ?? profile.full_name ?? "Usuario",
      commission_amount: commissionAmount,
      commission_notes: input.commissionNotes ?? null,
      commission_status: commissionAmount > 0 ? "pendiente" : "no_aplica",
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error) throw error;

  if (!data?.id) {
    throw new Error("Supabase no devolvió el evento creado.");
  }

  return data.id as string;
}

async function getPadelSportId() {
  const { data, error } = await supabase
    .from("sports")
    .select("id")
    .eq("code", "padel")
    .single();

  if (error) throw error;

  return data.id as string;
}

async function getEventPaymentDefault(eventId: string) {
  const accountId = await getCurrentAccountId();

  const { data, error } = await supabase
    .from("events")
    .select("payment_default_amount, payment_default_notes")
    .eq("account_id", accountId)
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw error;

  return {
    amount: normalizeAmount((data as any)?.payment_default_amount) ?? 0,
    notes: ((data as any)?.payment_default_notes ?? null) as string | null,
  };
}

export async function saveManualMessage(input: {
  eventId: string;
  playerId: string;
  body: string;
}) {
  const accountId = await getCurrentAccountId();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      account_id: accountId,
      event_id: input.eventId,
      player_id: input.playerId,
      channel: "manual",
      direction: "outbound",
      body: input.body,
      status: "enviado",
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error) throw error;

  if (!data?.id) {
    throw new Error("Supabase no devolvió el mensaje creado.");
  }

  return data.id as string;
}

export async function saveInvitation(input: {
  eventId: string;
  playerId: string;
  messageId?: string;
  score: number;
  reasons: string[];
}) {
  const accountId = await getCurrentAccountId();

  const { error } = await supabase.from("invitations").upsert(
    {
      account_id: accountId,
      event_id: input.eventId,
      player_id: input.playerId,
      message_id: input.messageId,
      wave_number: 1,
      channel: "manual",
      status: "enviada",
      recommendation_score: input.score,
      recommendation_reasons: input.reasons,
      sent_at: new Date().toISOString(),
    },
    {
      onConflict: "event_id,player_id",
    }
  );

  if (error) throw error;
}

export async function saveParticipation(input: {
  eventId: string;
  playerId: string;
  status: "confirmado" | "lista_espera" | "rechazo" | "ambiguo";
  waitlistPosition?: number;
  paymentDueAmount?: number | null;
  paymentDueNotes?: string | null;
}) {
  const accountId = await getCurrentAccountId();
  const isConfirmed = input.status === "confirmado";

  let finalDueAmount: number | null = null;
  let finalDueNotes: string | null = null;

  if (isConfirmed) {
    const eventDefault = await getEventPaymentDefault(input.eventId);

    finalDueAmount = input.paymentDueAmount ?? eventDefault.amount ?? 0;
    finalDueNotes = input.paymentDueNotes ?? eventDefault.notes ?? null;
  }

  const isFree = isConfirmed && (finalDueAmount ?? 0) === 0;

  const { error } = await supabase.from("participations").upsert(
    {
      account_id: accountId,
      event_id: input.eventId,
      player_id: input.playerId,
      status: input.status,
      waitlist_position: input.waitlistPosition ?? null,
      source: "manual",
      confirmed_at: isConfirmed ? new Date().toISOString() : null,

      payment_due_amount: isConfirmed ? finalDueAmount : null,
      payment_due_notes: isConfirmed ? finalDueNotes : null,

      payment_status: isConfirmed ? (isFree ? "pagado" : "pendiente") : "pendiente",
      payment_method: null,
      payment_amount: isConfirmed ? 0 : null,
      payment_reference: null,
      payment_notes: isFree ? "Gratis / cortesía por precio base del evento." : null,
      payment_proof_url: null,
      paid_at: isFree ? new Date().toISOString() : null,
    },
    {
      onConflict: "event_id,player_id",
    }
  );

  if (error) throw error;
}

export async function removeParticipation(input: {
  eventId: string;
  playerId: string;
}) {
  const accountId = await getCurrentAccountId();

  const { error } = await supabase
    .from("participations")
    .delete()
    .eq("account_id", accountId)
    .eq("event_id", input.eventId)
    .eq("player_id", input.playerId);

  if (error) throw error;
}

export async function loadParticipations(
  eventId: string
): Promise<ParticipationWithPayment[]> {
  const accountId = await getCurrentAccountId();

  const { data, error } = await supabase
    .from("participations")
    .select(
      `
      player_id,
      status,
      waitlist_position,
      payment_status,
      payment_method,
      payment_amount,
      payment_reference,
      payment_notes,
      payment_proof_url,
      paid_at,
      payment_due_amount,
      payment_due_notes
    `
    )
    .eq("account_id", accountId)
    .eq("event_id", eventId);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    player_id: row.player_id,
    status: row.status as ParticipationStatus,
    waitlist_position: row.waitlist_position ?? null,

    payment_status: normalizePaymentStatus(row.payment_status),
    payment_method: normalizePaymentMethod(row.payment_method),
    payment_amount: normalizeAmount(row.payment_amount),
    payment_reference: row.payment_reference ?? null,
    payment_notes: row.payment_notes ?? null,
    payment_proof_url: row.payment_proof_url ?? null,
    paid_at: row.paid_at ?? null,

    payment_due_amount: normalizeAmount(row.payment_due_amount),
    payment_due_notes: row.payment_due_notes ?? null,
  }));
}

export async function updateParticipationPayment(input: {
  eventId: string;
  playerId: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentAmount?: number | null;
  paymentReference?: string | null;
  paymentNotes?: string | null;
  paymentProofUrl?: string | null;
  paymentDueAmount?: number | null;
  paymentDueNotes?: string | null;
}) {
  const accountId = await getCurrentAccountId();
  const isPaid = input.paymentStatus === "pagado";

  const payload: Record<string, any> = {
    payment_status: input.paymentStatus,
    payment_method: isPaid ? input.paymentMethod ?? null : null,
    payment_amount: isPaid ? input.paymentAmount ?? null : input.paymentAmount ?? null,
    payment_reference: input.paymentReference ?? null,
    payment_notes: input.paymentNotes ?? null,
    payment_proof_url: input.paymentProofUrl ?? null,
    paid_at: isPaid ? new Date().toISOString() : null,
  };

  if (input.paymentDueAmount !== undefined) {
    payload.payment_due_amount = input.paymentDueAmount;
  }

  if (input.paymentDueNotes !== undefined) {
    payload.payment_due_notes = input.paymentDueNotes;
  }

  const { error } = await supabase
    .from("participations")
    .update(payload)
    .eq("account_id", accountId)
    .eq("event_id", input.eventId)
    .eq("player_id", input.playerId);

  if (error) throw error;
}

export async function markPaymentPending(input: {
  eventId: string;
  playerId: string;
}) {
  return updateParticipationPayment({
    eventId: input.eventId,
    playerId: input.playerId,
    paymentStatus: "pendiente",
    paymentMethod: null,
    paymentAmount: null,
    paymentReference: null,
  });
}

export async function markPaymentNotPaid(input: {
  eventId: string;
  playerId: string;
  paymentNotes?: string | null;
}) {
  return updateParticipationPayment({
    eventId: input.eventId,
    playerId: input.playerId,
    paymentStatus: "no_pago",
    paymentMethod: null,
    paymentAmount: null,
    paymentReference: null,
    paymentNotes: input.paymentNotes ?? null,
  });
}

export async function getEventPaymentSummary(eventId: string) {
  const participations = await loadParticipations(eventId);
  const confirmed = participations.filter((item) => item.status === "confirmado");

  const totalExpected = confirmed.reduce((sum, item) => {
    return sum + (item.payment_due_amount ?? 0);
  }, 0);

  const totalCobrado = confirmed.reduce((sum, item) => {
    return sum + (item.payment_amount ?? 0);
  }, 0);

  const faltante = Math.max(totalExpected - totalCobrado, 0);
  const extra = Math.max(totalCobrado - totalExpected, 0);

  const pagados = confirmed.filter((item) => item.payment_status === "pagado").length;
  const pendientes = confirmed.filter((item) => item.payment_status === "pendiente").length;
  const noPagaron = confirmed.filter((item) => item.payment_status === "no_pago").length;
  const gratis = confirmed.filter(
    (item) => item.payment_status === "pagado" && (item.payment_due_amount ?? 0) === 0
  ).length;

  return {
    totalExpected,
    totalCobrado,
    faltante,
    extra,
    confirmados: confirmed.length,
    pagados,
    pendientes,
    noPagaron,
    gratis,
  };
}