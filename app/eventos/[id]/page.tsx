"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { DEMO_ACCOUNT_ID, removeParticipation, saveParticipation } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";

type EventRow = {
  id: string;
  account_id: string;
  community_id: string;
  venue_id: string;
  title: string;
  event_date: string;
  start_time: string;
  duration_minutes: number;
  courts_count: number;
  players_needed: number;
  category: string;
  status: string;
  custom_message: string | null;
  created_at: string;
  payment_default_amount: number | string | null;
  payment_default_notes: string | null;
  court_reservation_status: string | null;
  court_reservation_reference: string | null;
  court_reservation_notes: string | null;
  court_reservation_requested_at: string | null;
  court_reserved_at: string | null;
  court_number: string | null;
  court_reserved_by: string | null;
  court_cost: number | string | null;
  other_expenses: number | string | null;
  financial_notes: string | null;
  played_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
  close_notes: string | null;
  canceled_at: string | null;
  gender_mode: string | null;
  organizer_staff_id: string | null;
  organizer_name: string | null;
  commission_amount: number | string | null;
  commission_status: string | null;
  commission_paid_at: string | null;
  commission_notes: string | null;
  updated_at: string | null;
  last_edited_by: string | null;
};

type ParticipationStatus = "confirmado" | "lista_espera" | "rechazo" | "ambiguo" | string;
type PaymentStatus = "pendiente" | "pagado" | "no_pago";
type PaymentMethod = "efectivo" | "transferencia" | "deposito" | "tarjeta_link" | null;
type ReservationStatus = "pendiente_reservar" | "solicitada" | "reservada" | "no_disponible" | "cancelada";

type ParticipationRow = {
  account_id: string;
  event_id: string;
  player_id: string;
  status: ParticipationStatus;
  waitlist_position: number | null;

  payment_status: "pendiente" | "pagado" | "no_pago" | "no_pagado" | string | null;
  payment_method: string | null;
  payment_amount: number | string | null;
  payment_reference: string | null;
  payment_notes: string | null;
  payment_proof_url: string | null;
  paid_at: string | null;

  payment_due_amount: number | string | null;
  payment_due_notes: string | null;
};

type PlayerRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  whatsapp: string | null;
};

type SimpleRow = {
  id: string;
  name: string;
};

type StaffOption = {
  id: string;
  full_name: string;
  role: string;
  active: boolean | null;
};

type StaffPermissions = {
  viewPayments?: boolean;
  editPayments?: boolean;
  managePayments?: boolean;
  viewFinances?: boolean;
  manageFinances?: boolean;
  createEvents?: boolean;
  editEvents?: boolean;
  manageEvents?: boolean;
  cancelEvents?: boolean;
  manageReservation?: boolean;
  [key: string]: boolean | undefined;
};

type StaffProfile = {
  id?: string | null;
  account_id?: string | null;
  full_name?: string | null;
  role?: string | null;
  active?: boolean | null;
  auth_status?: string | null;
  permissions?: StaffPermissions | null;
  can_view_payments?: boolean;
  can_edit_payments?: boolean;
};

type EventEditDraft = {
  communityId: string;
  venueId: string;
  eventDate: string;
  startTime: string;
  durationMinutes: string;
  courtsCount: string;
  playersNeeded: string;
  category: string;
  genderMode: "libre" | "hombres" | "mujeres" | "mixto";
  organizerStaffId: string;
  organizerName: string;
  commissionAmount: string;
  commissionNotes: string;
};

type PaymentDraft = {
  paymentStatus: PaymentStatus;
  paymentMethod: "" | Exclude<PaymentMethod, null>;
  paymentDueAmount: string;
  paymentAmount: string;
  paymentReference: string;
  paymentDueNotes: string;
  paymentNotes: string;
  paymentProofUrl: string;
};

type EventPriceDraft = {
  amount: string;
  notes: string;
};

type ReservationDraft = {
  status: ReservationStatus;
  courtNumber: string;
  reference: string;
  reservedBy: string;
  courtCost: string;
  otherExpenses: string;
  reservationNotes: string;
  financialNotes: string;
};

function categoryLabel(category?: string) {
  const labels: Record<string, string> = {
    C1: "Primera",
    C2: "Segunda",
    C3: "Tercera",
    C4: "Cuarta",
    C5: "Quinta",
    C6: "Sexta",
    C7: "Novatos",
  };

  return labels[category ?? ""] ?? category ?? "";
}

function categoryLabelLower(category?: string) {
  const labels: Record<string, string> = {
    C1: "primera",
    C2: "segunda",
    C3: "tercera",
    C4: "cuarta",
    C5: "quinta",
    C6: "sexta",
    C7: "novatos",
  };

  return labels[category ?? ""] ?? category ?? "";
}

function genderModeLabel(value?: string | null) {
  if (value === "hombres") return "Hombres";
  if (value === "mujeres") return "Mujeres";
  if (value === "mixto") return "Mixto";
  return "Libre";
}

function eventStatusLabel(status?: string) {
  if (status === "cancelado") return "Cancelado";
  if (status === "cerrado") return "Cerrado";
  if (status === "jugado") return "Jugado · cobros por resolver";
  if (status === "buscando_jugadores") return "Buscando jugadores";
  if (status === "completo") return "Completo";
  if (status === "borrador") return "Borrador";
  return status ?? "Sin estado";
}

function eventStatusClass(status?: string) {
  if (status === "cancelado") return "danger";
  if (status === "cerrado" || status === "completo") return "good";
  if (status === "jugado") return "warn";
  if (status === "buscando_jugadores") return "warn";
  return "neutral";
}

function normalizePaymentStatus(status?: string | null): PaymentStatus {
  if (status === "pagado") return "pagado";
  if (status === "no_pago" || status === "no_pagado") return "no_pago";
  return "pendiente";
}

function normalizePaymentMethod(method?: string | null): "" | Exclude<PaymentMethod, null> {
  if (method === "efectivo") return "efectivo";
  if (method === "transferencia") return "transferencia";
  if (method === "deposito") return "deposito";
  if (method === "tarjeta" || method === "link" || method === "tarjeta_link") return "tarjeta_link";
  return "";
}


function reservationStatusNormalized(status?: string | null): ReservationStatus {
  if (status === "solicitada") return "solicitada";
  if (status === "reservada") return "reservada";
  if (status === "no_disponible") return "no_disponible";
  if (status === "cancelada") return "cancelada";
  return "pendiente_reservar";
}

function reservationStatusLabel(status?: string | null) {
  const normalized = reservationStatusNormalized(status);

  if (normalized === "solicitada") return "Reserva solicitada";
  if (normalized === "reservada") return "Cancha reservada";
  if (normalized === "no_disponible") return "Cancha no disponible";
  if (normalized === "cancelada") return "Reserva cancelada";
  return "Cancha pendiente";
}

function reservationStatusClass(status?: string | null) {
  const normalized = reservationStatusNormalized(status);

  if (normalized === "reservada") return "good";
  if (normalized === "no_disponible" || normalized === "cancelada") return "danger";
  return "warn";
}

function paymentStatusLabel(status?: string | null) {
  const normalized = normalizePaymentStatus(status);

  if (normalized === "pagado") return "Pagó";
  if (normalized === "no_pago") return "No pagó";
  return "Después me paga";
}

function paymentStatusClass(status?: string | null) {
  const normalized = normalizePaymentStatus(status);

  if (normalized === "pagado") return "good";
  if (normalized === "no_pago") return "danger";
  return "warn";
}

function paymentMethodLabel(method?: string | null) {
  const normalized = normalizePaymentMethod(method);

  if (normalized === "efectivo") return "Efectivo";
  if (normalized === "transferencia") return "Transferencia";
  if (normalized === "deposito") return "Depósito";
  if (normalized === "tarjeta_link") return "Tarjeta/link";
  return "";
}

function numericAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function amountOrNull(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return null;

  const parsed = Number(trimmed.replace(",", "."));

  if (!Number.isFinite(parsed) || parsed < 0) return "invalid";

  return parsed;
}

function money(value: number | string | null | undefined) {
  const amount = numericAmount(value);
  return `$${amount.toFixed(2)}`;
}

function formatDate(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString("es-EC", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateForMessage(dateString: string) {
  const eventDate = new Date(`${dateString}T12:00:00`);
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const eventDateOnlyValue = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

  const diffDays = Math.round((eventDateOnlyValue.getTime() - todayDate.getTime()) / 86400000);

  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "mañana";

  return eventDate.toLocaleDateString("es-EC", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });
}

function formatTime(time: string) {
  return time.slice(0, 5);
}

function playerName(player?: PlayerRow) {
  if (!player) return "Jugador";
  return [player.first_name, player.last_name].filter(Boolean).join(" ");
}

function firstName(player?: PlayerRow) {
  if (!player) return "Jugador";
  return player.first_name;
}

function whatsappLink(phone: string | null, message: string) {
  const clean = (phone ?? "").replace(/[^0-9]/g, "");

  if (!clean) return "#";

  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

function cancellationMessage(event: EventRow, venueName: string, player?: PlayerRow) {
  const nombre = firstName(player);
  const categoria = categoryLabelLower(event.category);
  const fecha = formatDateForMessage(event.event_date);
  const hora = formatTime(event.start_time);

  return `Hola ${nombre}! 🎾

Te aviso que el partido de ${categoria} ${fecha} a las ${hora} en ${venueName} se canceló.

Gracias por confirmar. Te aviso apenas se arme otro.`;
}

function courtReservationMessage(
  event: EventRow,
  venueName: string,
  communityName: string
) {
  const fecha = formatDate(event.event_date);
  const hora = formatTime(event.start_time);
  const categoria = categoryLabel(event.category);

  return `Hola, quisiera solicitar una reserva de cancha para este partido:

Comunidad: ${communityName}
Sede: ${venueName}
Fecha: ${fecha}
Hora: ${hora}
Duración: ${event.duration_minutes} minutos
Categoría: ${categoria}
Canchas necesarias: ${event.courts_count}

Por favor, confírmame disponibilidad, número de cancha y referencia de la reserva.`;
}

function paymentKey(row: ParticipationRow) {
  return `${row.event_id}-${row.player_id}`;
}

function dueAmount(row: ParticipationRow) {
  return numericAmount(row.payment_due_amount);
}

function paidAmount(row: ParticipationRow) {
  return numericAmount(row.payment_amount);
}

function buildPaymentDraft(row: ParticipationRow): PaymentDraft {
  const due = dueAmount(row);
  const paid = paidAmount(row);

  return {
    paymentStatus: normalizePaymentStatus(row.payment_status),
    paymentMethod: normalizePaymentMethod(row.payment_method),
    paymentDueAmount: row.payment_due_amount === null || row.payment_due_amount === undefined ? "" : String(due),
    paymentAmount: row.payment_amount === null || row.payment_amount === undefined ? "" : String(paid),
    paymentReference: row.payment_reference ?? "",
    paymentDueNotes: row.payment_due_notes ?? "",
    paymentNotes: row.payment_notes ?? "",
    paymentProofUrl: row.payment_proof_url ?? "",
  };
}

function financialState(row: ParticipationRow) {
  const due = dueAmount(row);
  const paid = paidAmount(row);
  const status = normalizePaymentStatus(row.payment_status);

  if (due === 0 && status === "pagado") {
    return { label: "Gratis / cortesía", className: "good", missing: 0, extra: 0 };
  }

  if (status === "no_pago") {
    return { label: "No pagó", className: "danger", missing: due, extra: 0 };
  }

  if (paid > due && paid > 0) {
    return { label: "Pagó extra", className: "good", missing: 0, extra: paid - due };
  }

  if (due > 0 && paid > 0 && paid < due) {
    return { label: "Pago parcial", className: "warn", missing: due - paid, extra: 0 };
  }

  if (due > 0 && paid >= due && status === "pagado") {
    return { label: "Completo", className: "good", missing: 0, extra: 0 };
  }

  if (due === 0 && paid === 0) {
    return { label: "Por definir", className: "warn", missing: 0, extra: 0 };
  }

  return { label: "Por cobrar", className: "warn", missing: due, extra: 0 };
}

function eventIdFromParams(rawId: string | string[] | undefined) {
  if (Array.isArray(rawId)) return rawId[0] ?? "";
  return rawId ?? "";
}

function isPaymentResolved(row: ParticipationRow) {
  const status = normalizePaymentStatus(
    row.payment_status
  );

  if (status === "no_pago") {
    return true;
  }

  if (status !== "pagado") {
    return false;
  }

  return paidAmount(row) >= dueAmount(row);
}

function normalizeRpcObject(value: unknown): Record<string, any> {
  if (Array.isArray(value) && value.length > 0) {
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

function localStaffSnapshot(): StaffProfile {
  try {
    const raw = window.localStorage.getItem("ptm.selectedStaffSnapshot");

    if (!raw) {
      return {
        account_id: DEMO_ACCOUNT_ID,
        full_name: "Alejandro Pincay",
        role: "owner",
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
          manageReservation: true,
        },
        can_view_payments: true,
        can_edit_payments: true,
      };
    }

    const snapshot = JSON.parse(raw) as {
      id?: string;
      accountId?: string;
      account_id?: string;
      fullName?: string;
      full_name?: string;
      role?: string;
      permissions?: StaffPermissions;
    };

    const role = snapshot.role ?? "assistant";
    const ownerOrAdmin = role === "owner" || role === "admin";

    return {
      id: snapshot.id ?? null,
      account_id:
        snapshot.account_id ??
        snapshot.accountId ??
        DEMO_ACCOUNT_ID,
      full_name:
        snapshot.full_name ??
        snapshot.fullName ??
        "Usuario",
      role,
      permissions: snapshot.permissions ?? {},
      can_view_payments:
        ownerOrAdmin || snapshot.permissions?.viewPayments === true,
      can_edit_payments:
        ownerOrAdmin ||
        snapshot.permissions?.editPayments === true ||
        snapshot.permissions?.managePayments === true,
    };
  } catch {
    return {
      account_id: DEMO_ACCOUNT_ID,
      full_name: "Alejandro Pincay",
      role: "owner",
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
        manageReservation: true,
      },
      can_view_payments: true,
      can_edit_payments: true,
    };
  }
}

async function loadCurrentStaffProfile(): Promise<StaffProfile> {
  const result = await supabase.rpc("ptm_current_staff_profile_v1");

  if (result.error) {
    if (isMissingSecurityObject(result.error)) {
      return localStaffSnapshot();
    }

    throw result.error;
  }

  const profile = normalizeRpcObject(result.data) as StaffProfile;

  if (!profile.account_id) {
    throw new Error(
      "Tu sesión no está vinculada a un usuario interno activo."
    );
  }

  return profile;
}

async function secureSelectWithFallback(input: {
  secureSource: string;
  fallbackSource: string;
  select: string;
  configure?: (query: any) => any;
}) {
  let secureQuery: any = supabase
    .from(input.secureSource)
    .select(input.select);

  if (input.configure) {
    secureQuery = input.configure(secureQuery);
  }

  const secureResult = await secureQuery;

  if (!secureResult.error) {
    return secureResult;
  }

  if (!isMissingSecurityObject(secureResult.error)) {
    throw secureResult.error;
  }

  let fallbackQuery: any = supabase
    .from(input.fallbackSource)
    .select(input.select);

  if (input.configure) {
    fallbackQuery = input.configure(fallbackQuery);
  }

  const fallbackResult = await fallbackQuery;

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return fallbackResult;
}

function profileCanManageEvents(profile: StaffProfile) {
  const role = String(profile.role ?? "").toLowerCase();

  return (
    role === "owner" ||
    role === "admin" ||
    role === "assistant" ||
    role === "asistente" ||
    role === "secretary" ||
    role === "secretaria" ||
    profile.permissions?.createEvents === true ||
    profile.permissions?.editEvents === true ||
    profile.permissions?.manageEvents === true
  );
}

function profileCanViewPayments(profile: StaffProfile) {
  const role = String(profile.role ?? "").toLowerCase();

  return (
    role === "owner" ||
    role === "admin" ||
    profile.can_view_payments === true ||
    profile.permissions?.viewPayments === true ||
    profile.permissions?.viewFinances === true ||
    profile.permissions?.editPayments === true ||
    profile.permissions?.managePayments === true ||
    profile.permissions?.manageFinances === true
  );
}

function profileCanEditPayments(profile: StaffProfile) {
  const role = String(profile.role ?? "").toLowerCase();

  return (
    role === "owner" ||
    role === "admin" ||
    profile.can_edit_payments === true ||
    profile.permissions?.editPayments === true ||
    profile.permissions?.managePayments === true ||
    profile.permissions?.manageFinances === true
  );
}

function profileCanManageCommissions(profile: StaffProfile) {
  const role = String(profile.role ?? "").toLowerCase();

  return (
    role === "owner" ||
    role === "admin" ||
    profile.permissions?.manageFinances === true
  );
}

export default function EventoDetallePage() {
  const params = useParams();
  const eventId = eventIdFromParams(params?.id as string | string[] | undefined);

  const [accountId, setAccountId] = useState("");
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [canManageEvent, setCanManageEvent] = useState(false);
  const [canViewPayments, setCanViewPayments] = useState(false);
  const [canEditPayments, setCanEditPayments] = useState(false);
  const [canManageCommissions, setCanManageCommissions] = useState(false);

  const [event, setEvent] = useState<EventRow | null>(null);
  const [participations, setParticipations] = useState<ParticipationRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [venue, setVenue] = useState<SimpleRow | null>(null);
  const [community, setCommunity] = useState<SimpleRow | null>(null);
  const [venueOptions, setVenueOptions] = useState<SimpleRow[]>([]);
  const [communityOptions, setCommunityOptions] = useState<SimpleRow[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [showCancelMessages, setShowCancelMessages] = useState(false);
  const [changingParticipationKey, setChangingParticipationKey] = useState<string | null>(null);

  const [editingPaymentKey, setEditingPaymentKey] = useState<string | null>(null);
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, PaymentDraft>>({});
  const [editingEventPrice, setEditingEventPrice] = useState(false);
  const [eventPriceDraft, setEventPriceDraft] = useState<EventPriceDraft>({ amount: "", notes: "" });
  const [editingReservation, setEditingReservation] = useState(false);
  const [editingEventDetails, setEditingEventDetails] = useState(false);
  const [savingEventDetails, setSavingEventDetails] = useState(false);
  const [eventEditDraft, setEventEditDraft] = useState<EventEditDraft>({
    communityId: "",
    venueId: "",
    eventDate: "",
    startTime: "19:30",
    durationMinutes: "90",
    courtsCount: "1",
    playersNeeded: "4",
    category: "C5",
    genderMode: "libre",
    organizerStaffId: "",
    organizerName: "Usuario",
    commissionAmount: "0",
    commissionNotes: "",
  });
  const [reservationDraft, setReservationDraft] = useState<ReservationDraft>({
    status: "pendiente_reservar",
    courtNumber: "",
    reference: "",
    reservedBy: "",
    courtCost: "",
    otherExpenses: "",
    reservationNotes: "",
    financialNotes: "",
  });

  useEffect(() => {
    if (eventId) loadEventDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function loadEventDetail() {
    setLoading(true);
    setNotice("");

    try {
      const currentProfile = await loadCurrentStaffProfile();
      const currentAccountId = currentProfile.account_id ?? DEMO_ACCOUNT_ID;
      const viewPayments = profileCanViewPayments(currentProfile);
      const editPayments = profileCanEditPayments(currentProfile);
      const manageEvents = profileCanManageEvents(currentProfile);
      const manageCommissions = profileCanManageCommissions(currentProfile);

      setAccountId(currentAccountId);
      setStaffProfile(currentProfile);
      setCanViewPayments(viewPayments);
      setCanEditPayments(editPayments);
      setCanManageEvent(manageEvents);
      setCanManageCommissions(manageCommissions);

      const eventRes = await secureSelectWithFallback({
        secureSource: "ptm_events_secure_v1",
        fallbackSource: "events",
        select:
          "id, account_id, community_id, venue_id, title, event_date, start_time, duration_minutes, courts_count, players_needed, category, status, custom_message, created_at, payment_default_amount, payment_default_notes, court_reservation_status, court_reservation_notes, court_reservation_reference, court_reservation_requested_at, court_reserved_at, court_number, court_reserved_by, court_cost, other_expenses, financial_notes, played_at, closed_at, closed_by, close_notes, canceled_at, gender_mode, organizer_staff_id, organizer_name, commission_amount, commission_status, commission_paid_at, commission_notes, updated_at, last_edited_by",
        configure: (query) =>
          query
            .eq("account_id", currentAccountId)
            .eq("id", eventId)
            .maybeSingle(),
      });

      const eventRow = eventRes.data as EventRow | null;

      if (!eventRow) {
        setEvent(null);
        setParticipations([]);
        setPlayers([]);
        setVenue(null);
        setCommunity(null);
        setNotice("No encontré este partido o tu usuario no tiene acceso.");
        return;
      }

      setEvent(eventRow);
      setEventEditDraft({
        communityId: eventRow.community_id,
        venueId: eventRow.venue_id,
        eventDate: eventRow.event_date,
        startTime: formatTime(eventRow.start_time),
        durationMinutes: String(eventRow.duration_minutes),
        courtsCount: String(eventRow.courts_count),
        playersNeeded: String(eventRow.players_needed),
        category: eventRow.category,
        genderMode:
          eventRow.gender_mode === "hombres" ||
          eventRow.gender_mode === "mujeres" ||
          eventRow.gender_mode === "mixto"
            ? eventRow.gender_mode
            : "libre",
        organizerStaffId: eventRow.organizer_staff_id ?? "",
        organizerName:
          eventRow.organizer_name ?? currentProfile.full_name ?? "Usuario",
        commissionAmount: String(numericAmount(eventRow.commission_amount)),
        commissionNotes: eventRow.commission_notes ?? "",
      });

      setEventPriceDraft({
        amount:
          eventRow.payment_default_amount === null ||
          eventRow.payment_default_amount === undefined
            ? ""
            : String(numericAmount(eventRow.payment_default_amount)),
        notes: eventRow.payment_default_notes ?? "",
      });

      setReservationDraft({
        status: reservationStatusNormalized(eventRow.court_reservation_status),
        courtNumber: eventRow.court_number ?? "",
        reference: eventRow.court_reservation_reference ?? "",
        reservedBy: eventRow.court_reserved_by ?? "",
        courtCost:
          eventRow.court_cost === null || eventRow.court_cost === undefined
            ? ""
            : String(numericAmount(eventRow.court_cost)),
        otherExpenses:
          eventRow.other_expenses === null ||
          eventRow.other_expenses === undefined
            ? ""
            : String(numericAmount(eventRow.other_expenses)),
        reservationNotes: eventRow.court_reservation_notes ?? "",
        financialNotes: eventRow.financial_notes ?? "",
      });

      const [
        participationsRes,
        venueRes,
        communityRes,
        venueOptionsRes,
        communityOptionsRes,
        staffOptionsRes,
      ] = await Promise.all([
        secureSelectWithFallback({
          secureSource: "ptm_participations_secure_v1",
          fallbackSource: "participations",
          select:
            "account_id, event_id, player_id, status, waitlist_position, payment_status, payment_method, payment_amount, payment_reference, payment_notes, payment_proof_url, paid_at, payment_due_amount, payment_due_notes",
          configure: (query) =>
            query
              .eq("account_id", currentAccountId)
              .eq("event_id", eventRow.id)
              .order("status")
              .order("waitlist_position", { ascending: true }),
        }),

        secureSelectWithFallback({
          secureSource: "ptm_venues_secure_v1",
          fallbackSource: "venues",
          select: "id, account_id, name",
          configure: (query) =>
            query
              .eq("account_id", currentAccountId)
              .eq("id", eventRow.venue_id)
              .maybeSingle(),
        }),

        supabase
          .from("communities")
          .select("id, name")
          .eq("account_id", currentAccountId)
          .eq("id", eventRow.community_id)
          .maybeSingle(),

        secureSelectWithFallback({
          secureSource: "ptm_venues_secure_v1",
          fallbackSource: "venues",
          select: "id, account_id, name, active",
          configure: (query) =>
            query
              .eq("account_id", currentAccountId)
              .eq("active", true)
              .order("name"),
        }),

        supabase
          .from("communities")
          .select("id, name")
          .eq("account_id", currentAccountId)
          .eq("active", true)
          .order("name"),

        supabase
          .from("staff_members_demo")
          .select("id, full_name, role, active")
          .eq("account_id", currentAccountId)
          .eq("active", true)
          .order("full_name"),
      ]);

      if (communityRes.error) throw communityRes.error;
      if (communityOptionsRes.error) throw communityOptionsRes.error;
      if (staffOptionsRes.error) throw staffOptionsRes.error;

      const participationRows = (participationsRes.data ?? []) as ParticipationRow[];

      setParticipations(participationRows);
      setVenue((venueRes.data ?? null) as SimpleRow | null);
      setCommunity((communityRes.data ?? null) as SimpleRow | null);
      setVenueOptions((venueOptionsRes.data ?? []) as SimpleRow[]);
      setCommunityOptions((communityOptionsRes.data ?? []) as SimpleRow[]);
      setStaffOptions((staffOptionsRes.data ?? []) as StaffOption[]);

      const playerIds = Array.from(
        new Set(participationRows.map((row) => row.player_id))
      );

      if (playerIds.length) {
        const playersRes = await supabase
          .from("players")
          .select("id, first_name, last_name, whatsapp")
          .eq("account_id", currentAccountId)
          .in("id", playerIds);

        if (playersRes.error) throw playersRes.error;

        setPlayers((playersRes.data ?? []) as PlayerRow[]);
      } else {
        setPlayers([]);
      }
    } catch (error: any) {
      setEvent(null);
      setParticipations([]);
      setPlayers([]);
      setVenue(null);
      setCommunity(null);
      setNotice(
        `No se pudo cargar el partido: ${
          error?.message ?? "Error desconocido"
        }`
      );
    } finally {
      setLoading(false);
    }
  }

  const playerById = useMemo(() => {
    return new Map(players.map((player) => [player.id, player]));
  }, [players]);

  const confirmed = useMemo(() => participations.filter((row) => row.status === "confirmado"), [participations]);
  const waitlist = useMemo(() => participations.filter((row) => row.status === "lista_espera"), [participations]);
  const rejected = useMemo(() => participations.filter((row) => row.status === "rechazo"), [participations]);
  const ambiguous = useMemo(() => participations.filter((row) => row.status === "ambiguo"), [participations]);

  const shouldNotify = useMemo(() => [...confirmed, ...waitlist, ...ambiguous], [confirmed, waitlist, ambiguous]);

  const totalExpected = canViewPayments
    ? confirmed.reduce((sum, row) => sum + dueAmount(row), 0)
    : 0;
  const totalPaid = canViewPayments
    ? confirmed.reduce((sum, row) => sum + paidAmount(row), 0)
    : 0;
  const totalMissing = canViewPayments
    ? confirmed.reduce((sum, row) => sum + financialState(row).missing, 0)
    : 0;
  const totalExtra = canViewPayments
    ? confirmed.reduce((sum, row) => sum + financialState(row).extra, 0)
    : 0;
  const courtCost = canViewPayments ? numericAmount(event?.court_cost) : 0;
  const otherExpenses = canViewPayments
    ? numericAmount(event?.other_expenses)
    : 0;
  const commissionAmount = canViewPayments
    ? numericAmount(event?.commission_amount)
    : 0;
  const totalExpenses = courtCost + otherExpenses;
  const netResult = totalPaid - totalExpenses - commissionAmount;

  const completePlayers = canViewPayments
    ? confirmed.filter((row) => {
        const state = financialState(row).label;
        return state === "Completo" || state === "Gratis / cortesía";
      })
    : [];
  const freePlayers = canViewPayments
    ? confirmed.filter(
        (row) => financialState(row).label === "Gratis / cortesía"
      )
    : [];
  const partialPlayers = canViewPayments
    ? confirmed.filter((row) => financialState(row).label === "Pago parcial")
    : [];
  const pendingPlayers = canViewPayments
    ? confirmed.filter((row) => {
        const state = financialState(row).label;
        return state === "Por cobrar" || state === "Por definir";
      })
    : [];
  const notPaidPlayers = canViewPayments
    ? confirmed.filter((row) => financialState(row).label === "No pagó")
    : [];
  const extraPlayers = canViewPayments
    ? confirmed.filter((row) => financialState(row).label === "Pagó extra")
    : [];

  const unresolvedPayments = canViewPayments
    ? confirmed.filter((row) => !isPaymentResolved(row))
    : [];

  const acceptedNoPaymentAmount = canViewPayments
    ? notPaidPlayers.reduce(
        (sum, row) =>
          sum + Math.max(dueAmount(row) - paidAmount(row), 0),
        0
      )
    : 0;

  const operationalPendingAmount = canViewPayments
    ? unresolvedPayments.reduce(
        (sum, row) =>
          sum + Math.max(dueAmount(row) - paidAmount(row), 0),
        0
      )
    : 0;

  function operatorName() {
    return staffProfile?.full_name ?? "Usuario";
  }

  function startEditingPayment(row: ParticipationRow) {
    const key = paymentKey(row);

    setPaymentDrafts((current) => ({
      ...current,
      [key]: buildPaymentDraft(row),
    }));

    setEditingPaymentKey(key);
  }

  function cancelEditingPayment() {
    setEditingPaymentKey(null);
  }

  function updatePaymentDraft(key: string, field: keyof PaymentDraft, value: string) {
    setPaymentDrafts((current) => {
      const currentDraft = current[key];

      if (!currentDraft) return current;

      return {
        ...current,
        [key]: {
          ...currentDraft,
          [field]: value,
        },
      };
    });
  }

  async function savePayment(row: ParticipationRow) {
    if (!canEditPayments) {
      setNotice("Tu usuario no tiene permiso para editar pagos.");
      return;
    }

    const key = paymentKey(row);
    const draft = paymentDrafts[key];

    if (!draft) {
      setNotice("No encontré los datos del pago para guardar.");
      return;
    }

    const due = amountOrNull(draft.paymentDueAmount);
    const paid = amountOrNull(draft.paymentAmount);

    if (due === "invalid") {
      setNotice("El monto que debe pagar no es válido. Usa algo como 10 o 12.50.");
      return;
    }

    if (paid === "invalid") {
      setNotice("El monto pagado no es válido. Usa algo como 10 o 12.50.");
      return;
    }

    const paymentDueAmount = due ?? 0;
    const paymentAmount = paid ?? 0;

    let paymentStatus = draft.paymentStatus;
    let paymentMethod: PaymentMethod = draft.paymentMethod || null;

    if (
      paymentDueAmount === 0 &&
      paymentAmount === 0 &&
      paymentStatus !== "no_pago"
    ) {
      paymentStatus = "pagado";
      paymentMethod = null;
    }

    if (
      paymentStatus === "pagado" &&
      paymentDueAmount > 0 &&
      paymentAmount === 0
    ) {
      setNotice(
        "Si marcas como pagado, pon el monto pagado. Si no ha pagado todavía, usa “Después me paga” o “No pagó”."
      );
      return;
    }

    if (paymentStatus === "pagado" && paymentAmount > 0 && !paymentMethod) {
      paymentMethod = "efectivo";
    }

    try {
      const rpcResult = await supabase.rpc(
        "ptm_update_participation_payment_v1",
        {
          p_event_id: row.event_id,
          p_player_id: row.player_id,
          p_payment_status: paymentStatus,
          p_payment_method: paymentStatus === "pagado" ? paymentMethod : null,
          p_payment_amount:
            paymentStatus === "pagado" ? paymentAmount : paymentAmount || null,
          p_payment_reference: draft.paymentReference.trim() || null,
          p_payment_notes: draft.paymentNotes.trim() || null,
          p_payment_proof_url: draft.paymentProofUrl.trim() || null,
          p_payment_due_amount: paymentDueAmount,
          p_payment_due_notes: draft.paymentDueNotes.trim() || null,
        }
      );

      if (rpcResult.error) {
        if (!isMissingSecurityObject(rpcResult.error)) {
          throw rpcResult.error;
        }

        const legacyResult = await supabase
          .from("participations")
          .update({
            payment_due_amount: paymentDueAmount,
            payment_due_notes: draft.paymentDueNotes.trim() || null,
            payment_status: paymentStatus,
            payment_method: paymentStatus === "pagado" ? paymentMethod : null,
            payment_amount:
              paymentStatus === "pagado" ? paymentAmount : paymentAmount || null,
            payment_reference: draft.paymentReference.trim() || null,
            payment_notes: draft.paymentNotes.trim() || null,
            payment_proof_url: draft.paymentProofUrl.trim() || null,
            paid_at: paymentStatus === "pagado" ? new Date().toISOString() : null,
          })
          .eq("account_id", accountId || DEMO_ACCOUNT_ID)
          .eq("event_id", row.event_id)
          .eq("player_id", row.player_id);

        if (legacyResult.error) throw legacyResult.error;
      }

      setEditingPaymentKey(null);
      await loadEventDetail();
      setNotice("Pago guardado correctamente.");
    } catch (error: any) {
      setNotice(`No se pudo guardar el pago: ${error?.message ?? "Error desconocido"}`);
    }
  }

  async function markAsFree(row: ParticipationRow) {
    if (!canEditPayments) {
      setNotice("Tu usuario no tiene permiso para editar pagos.");
      return;
    }

    const key = paymentKey(row);
    setPaymentDrafts((current) => ({
      ...current,
      [key]: {
        ...buildPaymentDraft(row),
        paymentStatus: "pagado",
        paymentMethod: "",
        paymentDueAmount: "0",
        paymentAmount: "0",
        paymentDueNotes: "Gratis / cortesía",
        paymentNotes: "Jugador marcado como gratis / cortesía.",
      },
    }));
    setEditingPaymentKey(key);

    await Promise.resolve();

    const freeDraft: PaymentDraft = {
      ...buildPaymentDraft(row),
      paymentStatus: "pagado",
      paymentMethod: "",
      paymentDueAmount: "0",
      paymentAmount: "0",
      paymentDueNotes: "Gratis / cortesía",
      paymentNotes: "Jugador marcado como gratis / cortesía.",
    };

    setPaymentDrafts((current) => ({ ...current, [key]: freeDraft }));

    try {
      const rpcResult = await supabase.rpc(
        "ptm_update_participation_payment_v1",
        {
          p_event_id: row.event_id,
          p_player_id: row.player_id,
          p_payment_status: "pagado",
          p_payment_method: null,
          p_payment_amount: 0,
          p_payment_reference: null,
          p_payment_notes: "Jugador marcado como gratis / cortesía.",
          p_payment_proof_url: null,
          p_payment_due_amount: 0,
          p_payment_due_notes: "Gratis / cortesía",
        }
      );

      if (rpcResult.error) {
        if (!isMissingSecurityObject(rpcResult.error)) throw rpcResult.error;

        const legacyResult = await supabase
          .from("participations")
          .update({
            payment_due_amount: 0,
            payment_due_notes: "Gratis / cortesía",
            payment_status: "pagado",
            payment_method: null,
            payment_amount: 0,
            payment_reference: null,
            payment_notes: "Jugador marcado como gratis / cortesía.",
            paid_at: new Date().toISOString(),
          })
          .eq("account_id", accountId || DEMO_ACCOUNT_ID)
          .eq("event_id", row.event_id)
          .eq("player_id", row.player_id);

        if (legacyResult.error) throw legacyResult.error;
      }

      setEditingPaymentKey(null);
      await loadEventDetail();
      setNotice("Jugador marcado como gratis / cortesía.");
    } catch (error: any) {
      setNotice(`No se pudo marcar como gratis: ${error?.message ?? "Error desconocido"}`);
    }
  }

  async function markPaymentPending(row: ParticipationRow) {
    if (!canEditPayments) {
      setNotice("Tu usuario no tiene permiso para editar pagos.");
      return;
    }

    try {
      const rpcResult = await supabase.rpc(
        "ptm_update_participation_payment_v1",
        {
          p_event_id: row.event_id,
          p_player_id: row.player_id,
          p_payment_status: "pendiente",
          p_payment_method: null,
          p_payment_amount: null,
          p_payment_reference: null,
          p_payment_notes: row.payment_notes,
          p_payment_proof_url: row.payment_proof_url,
          p_payment_due_amount: row.payment_due_amount,
          p_payment_due_notes: row.payment_due_notes,
        }
      );

      if (rpcResult.error) {
        if (!isMissingSecurityObject(rpcResult.error)) throw rpcResult.error;

        const legacyResult = await supabase
          .from("participations")
          .update({
            payment_status: "pendiente",
            payment_method: null,
            payment_amount: null,
            payment_reference: null,
            paid_at: null,
          })
          .eq("account_id", accountId || DEMO_ACCOUNT_ID)
          .eq("event_id", row.event_id)
          .eq("player_id", row.player_id);

        if (legacyResult.error) throw legacyResult.error;
      }

      await loadEventDetail();
      setNotice("Pago marcado como después me paga.");
    } catch (error: any) {
      setNotice(`No se pudo marcar como pendiente: ${error?.message ?? "Error desconocido"}`);
    }
  }

  async function markPaymentNotPaid(row: ParticipationRow) {
    if (!canEditPayments) {
      setNotice("Tu usuario no tiene permiso para editar pagos.");
      return;
    }

    try {
      const rpcResult = await supabase.rpc(
        "ptm_update_participation_payment_v1",
        {
          p_event_id: row.event_id,
          p_player_id: row.player_id,
          p_payment_status: "no_pago",
          p_payment_method: null,
          p_payment_amount: 0,
          p_payment_reference: null,
          p_payment_notes: row.payment_notes,
          p_payment_proof_url: row.payment_proof_url,
          p_payment_due_amount: row.payment_due_amount,
          p_payment_due_notes: row.payment_due_notes,
        }
      );

      if (rpcResult.error) {
        if (!isMissingSecurityObject(rpcResult.error)) throw rpcResult.error;

        const legacyResult = await supabase
          .from("participations")
          .update({
            payment_status: "no_pago",
            payment_method: null,
            payment_amount: null,
            payment_reference: null,
            paid_at: null,
          })
          .eq("account_id", accountId || DEMO_ACCOUNT_ID)
          .eq("event_id", row.event_id)
          .eq("player_id", row.player_id);

        if (legacyResult.error) throw legacyResult.error;
      }

      await loadEventDetail();
      setNotice("Pago marcado como no pagó.");
    } catch (error: any) {
      setNotice(`No se pudo marcar como no pagó: ${error?.message ?? "Error desconocido"}`);
    }
  }

  async function saveEventDefaultPrice() {
    if (!event || !canEditPayments) {
      setNotice("Tu usuario no tiene permiso para editar el precio base.");
      return;
    }

    const amount = amountOrNull(eventPriceDraft.amount);

    if (amount === "invalid") {
      setNotice("El precio base del partido no es válido. Usa algo como 10 o 12.50.");
      return;
    }

    try {
      const rpcResult = await supabase.rpc("ptm_update_event_finance_v1", {
        p_event_id: event.id,
        p_payment_default_amount: amount ?? 0,
        p_payment_default_notes: eventPriceDraft.notes.trim() || null,
        p_court_cost: numericAmount(event.court_cost),
        p_other_expenses: numericAmount(event.other_expenses),
        p_financial_notes: event.financial_notes,
        p_operator_name: operatorName(),
      });

      if (rpcResult.error) {
        if (!isMissingSecurityObject(rpcResult.error)) throw rpcResult.error;

        const legacyResult = await supabase
          .from("events")
          .update({
            payment_default_amount: amount,
            payment_default_notes: eventPriceDraft.notes.trim() || null,
          })
          .eq("account_id", accountId || DEMO_ACCOUNT_ID)
          .eq("id", event.id);

        if (legacyResult.error) throw legacyResult.error;
      }

      setEditingEventPrice(false);
      await loadEventDetail();
      setNotice("Precio base del partido guardado.");
    } catch (error: any) {
      setNotice(`No se pudo guardar el precio base: ${error?.message ?? "Error desconocido"}`);
    }
  }

  async function applyDefaultPriceToEmptyConfirmed() {
    if (!event || !canEditPayments) {
      setNotice("Tu usuario no tiene permiso para aplicar precios.");
      return;
    }

    const defaultAmount = numericAmount(event.payment_default_amount);

    if (
      event.payment_default_amount === null ||
      event.payment_default_amount === undefined
    ) {
      setNotice("Primero guarda un precio base en el partido.");
      return;
    }

    const ok = window.confirm(
      `Esto aplicará el precio base ${money(defaultAmount)} solo a confirmados que todavía no tienen monto a pagar. No toca excepciones ya editadas. ¿Continuar?`
    );

    if (!ok) return;

    try {
      const rpcResult = await supabase.rpc(
        "ptm_apply_event_default_price_v1",
        { p_event_id: event.id }
      );

      if (rpcResult.error) {
        if (!isMissingSecurityObject(rpcResult.error)) throw rpcResult.error;

        const legacyResult = await supabase
          .from("participations")
          .update({
            payment_due_amount: defaultAmount,
            payment_due_notes:
              event.payment_default_notes || "Precio base del partido",
            payment_status: defaultAmount === 0 ? "pagado" : "pendiente",
            payment_method: null,
            payment_amount: defaultAmount === 0 ? 0 : null,
            paid_at: defaultAmount === 0 ? new Date().toISOString() : null,
          })
          .eq("account_id", accountId || DEMO_ACCOUNT_ID)
          .eq("event_id", event.id)
          .eq("status", "confirmado")
          .is("payment_due_amount", null);

        if (legacyResult.error) throw legacyResult.error;
      }

      await loadEventDetail();
      setNotice("Precio base aplicado a confirmados sin monto definido.");
    } catch (error: any) {
      setNotice(`No se pudo aplicar el precio base: ${error?.message ?? "Error desconocido"}`);
    }
  }

  async function saveCourtReservation(
    nextStatus?: ReservationStatus,
    options?: {
      reference?: string;
      reservationNotes?: string;
    }
  ) {
    if (!event || !canManageEvent) {
      setNotice("Tu usuario no tiene permiso para editar la reserva.");
      return;
    }

    const status = nextStatus ?? reservationDraft.status;
    const reference = options?.reference ?? reservationDraft.reference;
    const reservationNotes =
      options?.reservationNotes ?? reservationDraft.reservationNotes;

    const parsedCourtCost = amountOrNull(reservationDraft.courtCost);
    const parsedOtherExpenses = amountOrNull(reservationDraft.otherExpenses);

    if (canEditPayments && parsedCourtCost === "invalid") {
      setNotice("El costo de la cancha no es válido. Usa algo como 20 o 35.50.");
      return;
    }

    if (canEditPayments && parsedOtherExpenses === "invalid") {
      setNotice("Los otros gastos no son válidos. Usa algo como 0, 5 o 12.50.");
      return;
    }

    try {
      const reservationRpc = await supabase.rpc(
        "ptm_update_event_reservation_v1",
        {
          p_event_id: event.id,
          p_status: status,
          p_notes: reservationNotes.trim() || null,
          p_reference: reference.trim() || null,
          p_court_number: reservationDraft.courtNumber.trim() || null,
          p_operator_name:
            reservationDraft.reservedBy.trim() || operatorName(),
        }
      );

      if (reservationRpc.error) {
        if (!isMissingSecurityObject(reservationRpc.error)) {
          throw reservationRpc.error;
        }

        const now = new Date().toISOString();
        const legacyReservation = await supabase
          .from("events")
          .update({
            court_reservation_status: status,
            court_number: reservationDraft.courtNumber.trim() || null,
            court_reservation_reference: reference.trim() || null,
            court_reserved_by: reservationDraft.reservedBy.trim() || null,
            court_reservation_notes: reservationNotes.trim() || null,
            court_reservation_requested_at:
              status === "pendiente_reservar"
                ? null
                : event.court_reservation_requested_at ?? now,
            court_reserved_at: status === "reservada" ? now : null,
          })
          .eq("account_id", accountId || DEMO_ACCOUNT_ID)
          .eq("id", event.id);

        if (legacyReservation.error) throw legacyReservation.error;
      }

      if (canEditPayments) {
        const financeRpc = await supabase.rpc("ptm_update_event_finance_v1", {
          p_event_id: event.id,
          p_payment_default_amount: numericAmount(
            event.payment_default_amount
          ),
          p_payment_default_notes: event.payment_default_notes,
          p_court_cost: parsedCourtCost ?? 0,
          p_other_expenses: parsedOtherExpenses ?? 0,
          p_financial_notes: reservationDraft.financialNotes.trim() || null,
          p_operator_name: operatorName(),
        });

        if (financeRpc.error) {
          if (!isMissingSecurityObject(financeRpc.error)) throw financeRpc.error;

          const legacyFinance = await supabase
            .from("events")
            .update({
              court_cost: parsedCourtCost ?? 0,
              other_expenses: parsedOtherExpenses ?? 0,
              financial_notes: reservationDraft.financialNotes.trim() || null,
            })
            .eq("account_id", accountId || DEMO_ACCOUNT_ID)
            .eq("id", event.id);

          if (legacyFinance.error) throw legacyFinance.error;
        }
      }

      setEditingReservation(false);
      await loadEventDetail();

      if (status === "reservada") {
        setNotice("Cancha marcada como reservada.");
      } else if (status === "solicitada") {
        setNotice("Solicitud de reserva guardada.");
      } else if (status === "pendiente_reservar") {
        setNotice("Reserva marcada como pendiente.");
      } else if (status === "no_disponible") {
        setNotice(
          "Cancha marcada como no disponible. Revisa si debes cambiar horario o cancelar el partido."
        );
      } else {
        setNotice("Reserva marcada como cancelada.");
      }
    } catch (error: any) {
      setNotice(
        `No se pudo guardar la reserva de cancha: ${
          error?.message ?? "Error desconocido"
        }`
      );
    }
  }

  async function copyCourtReservationMessage() {
    if (!event) return;

    const message = courtReservationMessage(
      event,
      venue?.name ?? "la sede",
      community?.name ?? "la comunidad"
    );

    try {
      await navigator.clipboard.writeText(message);
      setNotice("Mensaje de solicitud de cancha copiado.");
    } catch {
      setNotice(
        "No se pudo copiar automáticamente. Revisa los permisos del navegador."
      );
    }
  }

  function beginEditEventDetails() {
    if (!event || !canManageEvent) {
      setNotice("Tu usuario no tiene permiso para editar partidos.");
      return;
    }

    setEventEditDraft({
      communityId: event.community_id,
      venueId: event.venue_id,
      eventDate: event.event_date,
      startTime: formatTime(event.start_time),
      durationMinutes: String(event.duration_minutes),
      courtsCount: String(event.courts_count),
      playersNeeded: String(event.players_needed),
      category: event.category,
      genderMode:
        event.gender_mode === "hombres" ||
        event.gender_mode === "mujeres" ||
        event.gender_mode === "mixto"
          ? event.gender_mode
          : "libre",
      organizerStaffId: event.organizer_staff_id ?? "",
      organizerName: event.organizer_name ?? operatorName(),
      commissionAmount: String(numericAmount(event.commission_amount)),
      commissionNotes: event.commission_notes ?? "",
    });

    setEditingEventDetails(true);
    setNotice("");
  }

  function selectOrganizer(staffId: string) {
    if (!staffId) {
      setEventEditDraft((current) => ({
        ...current,
        organizerStaffId: "",
        organizerName: operatorName(),
      }));
      return;
    }

    const selected = staffOptions.find((staff) => staff.id === staffId);

    setEventEditDraft((current) => ({
      ...current,
      organizerStaffId: staffId,
      organizerName: selected?.full_name ?? operatorName(),
    }));
  }

  async function saveEventDetails() {
    if (!event || !canManageEvent) {
      setNotice("Tu usuario no tiene permiso para editar partidos.");
      return;
    }

    const courtsCount = Number(eventEditDraft.courtsCount);
    const durationMinutes = Number(eventEditDraft.durationMinutes);
    const playersNeeded = Number(eventEditDraft.playersNeeded);
    const commissionAmount = canManageCommissions
      ? Number(eventEditDraft.commissionAmount || 0)
      : numericAmount(event.commission_amount);

    if (!eventEditDraft.communityId) {
      setNotice("Selecciona una comunidad.");
      return;
    }

    if (!eventEditDraft.venueId) {
      setNotice("Selecciona una sede.");
      return;
    }

    if (!Number.isInteger(courtsCount) || courtsCount < 1 || courtsCount > 20) {
      setNotice("La cantidad de canchas debe estar entre 1 y 20.");
      return;
    }

    if (
      !Number.isInteger(playersNeeded) ||
      playersNeeded < 2 ||
      playersNeeded > 100
    ) {
      setNotice("La cantidad de jugadores debe estar entre 2 y 100.");
      return;
    }

    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 30 ||
      durationMinutes > 480
    ) {
      setNotice("La duración debe estar entre 30 y 480 minutos.");
      return;
    }

    if (!Number.isFinite(commissionAmount) || commissionAmount < 0) {
      setNotice("La comisión no es válida.");
      return;
    }

    const changesCompatibility =
      event.category !== eventEditDraft.category ||
      (event.gender_mode ?? "libre") !== eventEditDraft.genderMode;

    if (participations.length > 0 && changesCompatibility) {
      const confirmedChange = window.confirm(
        "Este partido ya tiene respuestas. Cambiar categoría o género puede dejar jugadores incompatibles. ¿Deseas continuar y revisar manualmente los confirmados?"
      );

      if (!confirmedChange) return;
    }

    setSavingEventDetails(true);
    setNotice("Guardando cambios del partido...");

    try {
      const { error } = await supabase.rpc("ptm_update_event_details_v2", {
        p_account_id: accountId || DEMO_ACCOUNT_ID,
        p_event_id: event.id,
        p_community_id: eventEditDraft.communityId,
        p_venue_id: eventEditDraft.venueId,
        p_event_date: eventEditDraft.eventDate,
        p_start_time: eventEditDraft.startTime,
        p_duration_minutes: durationMinutes,
        p_courts_count: courtsCount,
        p_players_needed: playersNeeded,
        p_category: eventEditDraft.category,
        p_gender_mode: eventEditDraft.genderMode,
        p_organizer_staff_id: eventEditDraft.organizerStaffId || null,
        p_organizer_name: eventEditDraft.organizerName || operatorName(),
        p_commission_amount: commissionAmount,
        p_commission_notes: canManageCommissions
          ? eventEditDraft.commissionNotes.trim() || null
          : event.commission_notes,
        p_operator_name: operatorName(),
      });

      if (error) throw error;

      setEditingEventDetails(false);
      await loadEventDetail();
      setNotice("Partido actualizado correctamente.");
    } catch (error: any) {
      setNotice(
        `No se pudo actualizar el partido: ${
          error?.message ?? "Error desconocido"
        }`
      );
    } finally {
      setSavingEventDetails(false);
    }
  }

  async function markEventPlayed() {
    if (!event || !canManageEvent) {
      setNotice("Tu usuario no tiene permiso para cambiar el estado del partido.");
      return;
    }

    const ok = window.confirm(
      "¿Confirmas que este partido sí se jugó? Después de marcarlo como jugado, ya no se podrá cancelar."
    );

    if (!ok) return;

    try {
      const { error } = await supabase.rpc("ptm_mark_event_played_v1", {
        p_account_id: accountId || DEMO_ACCOUNT_ID,
        p_event_id: event.id,
        p_operator_name: operatorName(),
      });

      if (error) throw error;

      await loadEventDetail();
      setNotice(
        canViewPayments && unresolvedPayments.length
          ? `Partido marcado como jugado. Quedan ${unresolvedPayments.length} pago(s) por resolver antes de cerrarlo.`
          : "Partido marcado como jugado correctamente."
      );
    } catch (error: any) {
      setNotice(
        `No se pudo marcar como jugado: ${error?.message ?? "Error desconocido"}`
      );
    }
  }

  async function closeEvent() {
    if (!event || !canEditPayments) {
      setNotice(
        "Solo un usuario autorizado para pagos puede cerrar definitivamente el partido."
      );
      return;
    }

    if (unresolvedPayments.length > 0) {
      setNotice(
        `No se puede cerrar todavía. Hay ${unresolvedPayments.length} pago(s) por cobrar o parcial(es). Márcalos como pagado, gratis o no pagó.`
      );
      return;
    }

    const closeNotes = window.prompt(
      "Nota final opcional del partido:",
      event.close_notes ?? ""
    );

    if (closeNotes === null) return;

    const ok = window.confirm(
      "¿Cerrar definitivamente este partido? Quedará en el historial y desaparecerá de las alertas activas."
    );

    if (!ok) return;

    try {
      const { error } = await supabase.rpc("ptm_close_event_v1", {
        p_account_id: accountId || DEMO_ACCOUNT_ID,
        p_event_id: event.id,
        p_operator_name: operatorName(),
        p_close_notes: closeNotes,
      });

      if (error) throw error;

      await loadEventDetail();
      setNotice("Partido cerrado correctamente. Se mantiene en el historial.");
    } catch (error: any) {
      setNotice(
        `No se pudo cerrar el partido: ${error?.message ?? "Error desconocido"}`
      );
    }
  }

  async function cancelEvent() {
    if (!event || !canManageEvent) {
      setNotice("Tu usuario no tiene permiso para cancelar partidos.");
      return;
    }

    const ok = window.confirm(
      "¿Seguro que este partido no se jugará y deseas cancelarlo? Después podrás copiar los avisos de cancelación."
    );

    if (!ok) return;

    try {
      const { error } = await supabase.rpc("ptm_cancel_event_v1", {
        p_account_id: accountId || DEMO_ACCOUNT_ID,
        p_event_id: event.id,
        p_operator_name: operatorName(),
      });

      if (error) throw error;

      setShowCancelMessages(true);
      await loadEventDetail();
      setNotice("Partido cancelado. Ahora puedes copiar los avisos.");
    } catch (error: any) {
      setNotice(
        `No se pudo cancelar el partido: ${error?.message ?? "Error desconocido"}`
      );
    }
  }

  function openInLlenarCanchas() {
    if (!event || !canManageEvent) {
      setNotice("Tu usuario no tiene permiso para completar jugadores.");
      return;
    }

    window.localStorage.setItem("ptm.lastEventId", event.id);

    window.localStorage.setItem(
      "ptm.lastEventMeta",
      JSON.stringify({
        comunidadId: event.community_id,
        sedeId: event.venue_id,
        fecha: event.event_date,
        hora: formatTime(event.start_time),
        duracion: event.duration_minutes,
        categoria: event.category,
        canchas: event.courts_count,
        genero: event.gender_mode ?? "libre",
        categoryMode: "categoria",
        sumaTotal: 10,
        precioBase: canViewPayments
          ? numericAmount(event.payment_default_amount)
          : 0,
        notaPrecio: canViewPayments
          ? event.payment_default_notes ?? ""
          : "",
        mensajeBase:
          event.custom_message ??
          `Hola {{nombre}}! 🎾\n\nTenemos partido de {{categoria}} a las {{hora}} en {{sede}}.\nCreo que te puede calzar por nivel y horario.\n\n¿Puedes jugar?`,
      })
    );

    window.location.href = "/llenar-canchas";
  }

  function nextWaitlistPositionFor(row: ParticipationRow) {
    if (row.status === "lista_espera" && row.waitlist_position) {
      return row.waitlist_position;
    }

    const positions = waitlist
      .map((item) => Number(item.waitlist_position ?? 0))
      .filter((value) => Number.isFinite(value) && value > 0);

    return positions.length ? Math.max(...positions) + 1 : 1;
  }

  async function changeParticipationFromDetail(
    row: ParticipationRow,
    requestedStatus:
      | "confirmado"
      | "lista_espera"
      | "rechazo"
      | "ambiguo"
      | "pendiente"
  ) {
    if (!event || !canManageEvent) {
      setNotice("Tu usuario no tiene permiso para cambiar respuestas.");
      return;
    }

    if (isCanceled || isClosed) {
      setNotice("Este partido ya está cerrado o cancelado.");
      return;
    }

    const key = paymentKey(row);
    setChangingParticipationKey(key);
    setNotice("Guardando respuesta del jugador...");

    try {
      if (requestedStatus === "pendiente") {
        await removeParticipation({
          eventId: event.id,
          playerId: row.player_id,
        });
      } else {
        await saveParticipation({
          eventId: event.id,
          playerId: row.player_id,
          status: requestedStatus,
          waitlistPosition:
            requestedStatus === "lista_espera"
              ? nextWaitlistPositionFor(row)
              : undefined,
          paymentDueAmount:
            requestedStatus === "confirmado" && canEditPayments
              ? numericAmount(event.payment_default_amount)
              : null,
          paymentDueNotes:
            requestedStatus === "confirmado" && canEditPayments
              ? event.payment_default_notes || "Precio base del partido"
              : null,
        });
      }

      await loadEventDetail();

      const name = playerName(playerById.get(row.player_id));

      if (requestedStatus === "confirmado") {
        setNotice(`${name} quedó confirmado.`);
      } else if (requestedStatus === "lista_espera") {
        setNotice(`${name} quedó en lista de espera.`);
      } else if (requestedStatus === "rechazo") {
        setNotice(`${name} fue marcado como No puede.`);
      } else if (requestedStatus === "ambiguo") {
        setNotice(`${name} fue marcado como Ambiguo.`);
      } else {
        setNotice(`${name} volvió a Sin respuesta.`);
      }
    } catch (error: any) {
      setNotice(
        `No se pudo cambiar la respuesta: ${
          error?.message ?? "Error desconocido"
        }`
      );
    } finally {
      setChangingParticipationKey(null);
    }
  }

  function renderResponseActions(row: ParticipationRow) {
    if (!canManageEvent || isCanceled || isClosed) {
      return null;
    }

    const key = paymentKey(row);
    const isChanging = changingParticipationKey === key;

    return (
      <div className="row-actions" style={{ marginTop: 8 }}>
        {row.status !== "confirmado" ? (
          <button
            className="btn ghost"
            disabled={isChanging}
            onClick={() =>
              changeParticipationFromDetail(row, "confirmado")
            }
          >
            ✅ Pasar a OK
          </button>
        ) : null}

        {row.status !== "lista_espera" ? (
          <button
            className="btn ghost"
            disabled={isChanging}
            onClick={() =>
              changeParticipationFromDetail(row, "lista_espera")
            }
          >
            🟡 Lista de espera
          </button>
        ) : null}

        {row.status !== "rechazo" ? (
          <button
            className="btn ghost"
            disabled={isChanging}
            onClick={() =>
              changeParticipationFromDetail(row, "rechazo")
            }
          >
            ❌ No puede
          </button>
        ) : null}

        {row.status !== "ambiguo" ? (
          <button
            className="btn ghost"
            disabled={isChanging}
            onClick={() =>
              changeParticipationFromDetail(row, "ambiguo")
            }
          >
            🤔 Ambiguo
          </button>
        ) : null}

        <button
          className="btn secondary"
          disabled={isChanging}
          onClick={() =>
            changeParticipationFromDetail(row, "pendiente")
          }
        >
          ↩️ Quitar respuesta
        </button>
      </div>
    );
  }

  if (loading) {
    return <PageHeader title="Detalle del partido" description="Cargando partido desde Supabase..." />;
  }

  if (!event) {
    return (
      <>
        <PageHeader title="Detalle del partido" description="No se encontró el partido." />

        <div className="card">
          {notice ? <p><strong>{notice}</strong></p> : null}
          <a className="btn" href="/eventos">Volver a partidos</a>
        </div>
      </>
    );
  }

  const isCanceled = event.status === "cancelado";
  const isClosed = event.status === "cerrado";
  const isPlayed = event.status === "jugado";
  const missingPlayers = Math.max(event.players_needed - confirmed.length, 0);
  const reservationStatus = reservationStatusNormalized(event.court_reservation_status);
  const isCourtReserved = reservationStatus === "reservada";
  const isFullAndCourtPending =
    missingPlayers === 0 && !isCourtReserved && !isCanceled;
  const paymentsReadyToClose =
    canViewPayments && unresolvedPayments.length === 0;

  return (
    <>
      <PageHeader
        title="Detalle del partido"
        description="Resumen arriba, pagos y respuestas abajo. Lo avanzado queda ordenado sin estorbar."
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-actions">
          <a className="btn secondary" href="/eventos">← Volver a partidos</a>
          <button className="btn secondary" onClick={loadEventDetail}>🔄 Actualizar detalle</button>
          {!canViewPayments ? (
            <span className="badge neutral">🔒 Finanzas privadas</span>
          ) : null}
        </div>

        {notice ? <p><strong>{notice}</strong></p> : null}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="player-top">
          <div>
            <h2>{community?.name ?? "Comunidad"} · {venue?.name ?? "Sede"}</h2>

            <p>
              {formatDate(event.event_date)} · {formatTime(event.start_time)} · {categoryLabel(event.category)} · {genderModeLabel(event.gender_mode)}
            </p>

            <p>
              {event.courts_count} cancha(s) · {event.players_needed} jugadores · {event.duration_minutes} min
            </p>

            <p className="help-text">
              Organizado por: <strong>{event.organizer_name ?? "Sin usuario asignado"}</strong>
              {canViewPayments ? (
                <> · Comisión: <strong>{money(event.commission_amount)}</strong></>
              ) : null}
            </p>

            <p className="help-text">ID completo: {event.id}</p>
          </div>

          <div className="score">{confirmed.length}/{event.players_needed}</div>
        </div>

        <div className="row-actions">
          <span className={`badge ${eventStatusClass(event.status)}`}>{eventStatusLabel(event.status)}</span>
          <span className={`badge ${reservationStatusClass(event.court_reservation_status)}`}>
            {reservationStatusLabel(event.court_reservation_status)}
          </span>

          {isCanceled ? (
            <span className="badge danger">Partido cancelado</span>
          ) : isClosed ? (
            <span className="badge good">Partido cerrado</span>
          ) : missingPlayers === 0 ? (
            <span className="badge good">Partido completo</span>
          ) : (
            <span className="badge warn">Faltan {missingPlayers}</span>
          )}

          <span className="badge good">{confirmed.length} confirmados</span>
          <span className="badge warn">{waitlist.length} espera</span>
          <span className="badge danger">{rejected.length} no pueden</span>
          <span className="badge warn">{ambiguous.length} ambiguos</span>
        </div>

        <div className="row-actions" style={{ marginTop: 12 }}>
          {canManageEvent && !isPlayed && !isCanceled && !isClosed ? (
            <button
              className="btn edit"
              onClick={beginEditEventDetails}
            >
              Editar partido
            </button>
          ) : null}

          {canManageEvent && !isPlayed && !isCanceled && !isClosed ? (
            <button
              className="btn secondary"
              onClick={openInLlenarCanchas}
            >
              Completar jugadores
            </button>
          ) : null}

          {canManageEvent && !isPlayed && !isCanceled && !isClosed ? (
            <button
              className="btn save"
              onClick={markEventPlayed}
            >
              Marcar como jugado
            </button>
          ) : null}

          {isPlayed && !isClosed && canEditPayments ? (
            <button
              className="btn save"
              disabled={!paymentsReadyToClose}
              onClick={closeEvent}
              title={
                paymentsReadyToClose
                  ? "Cerrar y enviar al historial"
                  : "Primero resuelve los pagos por cobrar o parciales"
              }
            >
              Cerrar partido
            </button>
          ) : null}

          {canManageEvent && !isPlayed && !isCanceled && !isClosed ? (
            <button
              className="btn delete"
              onClick={cancelEvent}
            >
              Cancelar partido
            </button>
          ) : null}

          {isCanceled ? (
            <button
              className="btn secondary"
              onClick={() =>
                setShowCancelMessages(
                  (value) => !value
                )
              }
            >
              {showCancelMessages
                ? "Ocultar avisos"
                : "Ver avisos de cancelación"}
            </button>
          ) : null}
        </div>
      </div>

      {editingEventDetails ? (
        <div className="card event-inline-editor" style={{ marginBottom: 16 }}>
          <div className="section-title-row">
            <div>
              <h2>Editar partido</h2>
              <p className="help-text">
                El cambio se guarda aquí mismo. La comunidad solo puede cambiarse antes de enviar invitaciones o registrar respuestas.
              </p>
            </div>

            <button
              className="btn cancel-action"
              disabled={savingEventDetails}
              onClick={() => setEditingEventDetails(false)}
            >
              Cerrar edición
            </button>
          </div>

          <div className="grid grid-3">
            <label>
              Comunidad
              <select
                value={eventEditDraft.communityId}
                disabled={participations.length > 0}
                onChange={(e) =>
                  setEventEditDraft((current) => ({
                    ...current,
                    communityId: e.target.value,
                  }))
                }
              >
                {communityOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Sede
              <select
                value={eventEditDraft.venueId}
                onChange={(e) =>
                  setEventEditDraft((current) => ({
                    ...current,
                    venueId: e.target.value,
                  }))
                }
              >
                {venueOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Fecha
              <input
                type="date"
                value={eventEditDraft.eventDate}
                onChange={(e) =>
                  setEventEditDraft((current) => ({
                    ...current,
                    eventDate: e.target.value,
                  }))
                }
              />
            </label>

            <label>
              Hora
              <input
                type="time"
                value={eventEditDraft.startTime}
                onChange={(e) =>
                  setEventEditDraft((current) => ({
                    ...current,
                    startTime: e.target.value,
                  }))
                }
              />
            </label>

            <label>
              Duración en minutos
              <input
                type="number"
                min="30"
                max="480"
                step="15"
                value={
                  eventEditDraft.durationMinutes
                }
                onChange={(e) =>
                  setEventEditDraft(
                    (current) => ({
                      ...current,
                      durationMinutes:
                        e.target.value,
                    })
                  )
                }
              />

              <span className="help-text">
                Puedes usar 90, 120 o cualquier duración entre 30 y 480 minutos.
              </span>
            </label>

            <label>
              Canchas
              <input
                type="number"
                min="1"
                max="20"
                value={
                  eventEditDraft.courtsCount
                }
                onChange={(e) =>
                  setEventEditDraft(
                    (current) => ({
                      ...current,
                      courtsCount:
                        e.target.value,
                    })
                  )
                }
              />
            </label>

            <label>
              Jugadores necesarios
              <input
                type="number"
                min="2"
                max="100"
                value={
                  eventEditDraft.playersNeeded
                }
                onChange={(e) =>
                  setEventEditDraft(
                    (current) => ({
                      ...current,
                      playersNeeded:
                        e.target.value,
                    })
                  )
                }
              />

              <span className="help-text">
                Es independiente de las canchas. Ejemplo: una cancha con 5 o 6 jugadores durante dos horas.
              </span>
            </label>

            <label>
              Categoría
              <select
                value={eventEditDraft.category}
                onChange={(e) =>
                  setEventEditDraft((current) => ({
                    ...current,
                    category: e.target.value,
                  }))
                }
              >
                <option value="C1">Primera</option>
                <option value="C2">Segunda</option>
                <option value="C3">Tercera</option>
                <option value="C4">Cuarta</option>
                <option value="C5">Quinta</option>
                <option value="C6">Sexta</option>
                <option value="C7">Novatos</option>
              </select>
            </label>

            <label>
              Género del partido
              <select
                value={eventEditDraft.genderMode}
                onChange={(e) =>
                  setEventEditDraft((current) => ({
                    ...current,
                    genderMode: e.target.value as EventEditDraft["genderMode"],
                  }))
                }
              >
                <option value="libre">Libre</option>
                <option value="hombres">Hombres</option>
                <option value="mujeres">Mujeres</option>
                <option value="mixto">Mixto</option>
              </select>
            </label>

            <label>
              Organizado por
              <select
                value={eventEditDraft.organizerStaffId}
                onChange={(e) => selectOrganizer(e.target.value)}
              >
                <option value="admin-demo">Alejandro Pincay</option>
                {staffOptions.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.full_name}
                  </option>
                ))}
              </select>
            </label>

{canManageCommissions ? (
              <>
            <label>
              Comisión manual de este partido
              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  eventEditDraft.commissionAmount
                }
                placeholder="Ej: 7.50, 10 o 0"
                onChange={(e) =>
                  setEventEditDraft(
                    (current) => ({
                      ...current,
                      commissionAmount:
                        e.target.value,
                    })
                  )
                }
              />

              <span className="help-text">
                Se define caso por caso. No depende de un valor fijo del usuario.
              </span>
            </label>

            <label>
              Nota de comisión
              <input
                value={
                  eventEditDraft.commissionNotes
                }
                placeholder="Ej: organizó y jugó; 4 personas; comisión $10"
                onChange={(e) =>
                  setEventEditDraft(
                    (current) => ({
                      ...current,
                      commissionNotes:
                        e.target.value,
                    })
                  )
                }
              />
            </label>
              </>
            ) : null}
          </div>

          {participations.length > 0 ? (
            <div className="notice-banner">
              Este partido ya tiene actividad. Puedes cambiar sede, fecha, hora, duración, canchas, cantidad de jugadores y género. La comunidad queda protegida para no mezclar grupos por accidente.
            </div>
          ) : null}

          <div className="row-actions">
            <button
              className="btn save"
              disabled={savingEventDetails}
              onClick={saveEventDetails}
            >
              {savingEventDetails ? "Guardando..." : "Guardar cambios"}
            </button>

            <button
              className="btn cancel-action"
              disabled={savingEventDetails}
              onClick={() => setEditingEventDetails(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div className="card lifecycle-card" style={{ marginBottom: 16 }}>
        <div className="section-title-row">
          <h2>Ciclo del partido</h2>

          {isClosed ? (
            <span className="badge good">Finalizado</span>
          ) : isCanceled ? (
            <span className="badge danger">No se jugó</span>
          ) : isPlayed ? (
            <span className="badge warn">Jugado · falta cerrar</span>
          ) : (
            <span className="badge neutral">Operación activa</span>
          )}
        </div>

        <div className="lifecycle-steps">
          <div className="lifecycle-step complete">
            <span>1</span>
            <div>
              <strong>Partido creado</strong>
              <small>Jugadores y cancha</small>
            </div>
          </div>

          <div
            className={`lifecycle-step ${
              isPlayed || isClosed ? "complete" : ""
            }`}
          >
            <span>2</span>
            <div>
              <strong>Partido jugado</strong>
              <small>
                {event.played_at
                  ? new Date(event.played_at).toLocaleString("es-EC")
                  : "Pendiente de confirmar"}
              </small>
            </div>
          </div>

          <div
            className={`lifecycle-step ${
              paymentsReadyToClose ? "complete" : ""
            }`}
          >
            <span>3</span>
            <div>
              <strong>Cobros resueltos</strong>
              <small>
                {paymentsReadyToClose
                  ? "Pagados, gratis o no pagó"
                  : `${unresolvedPayments.length} por cobrar/parcial(es)`}
              </small>
            </div>
          </div>

          <div
            className={`lifecycle-step ${
              isClosed ? "complete" : ""
            }`}
          >
            <span>4</span>
            <div>
              <strong>Partido cerrado</strong>
              <small>
                {event.closed_at
                  ? new Date(event.closed_at).toLocaleString("es-EC")
                  : "Pasa al historial"}
              </small>
            </div>
          </div>
        </div>

        {canViewPayments && isPlayed && unresolvedPayments.length > 0 ? (
          <div className="payment-resolution-warning">
            <strong>
              Falta resolver {unresolvedPayments.length} pago(s)
            </strong>

            <p className="help-text">
              Un pago queda resuelto cuando se marca como Pagado completo,
              Gratis o No pagó. Los pagos parciales siguen por cobrar.
            </p>

            <div className="row-actions">
              {unresolvedPayments.map((row) => (
                <span
                  className="badge warn"
                  key={row.player_id}
                >
                  {playerName(playerById.get(row.player_id))}
                </span>
              ))}
            </div>

            <p className="help-text">
              Pendiente operativo: <strong>{money(operationalPendingAmount)}</strong>.
              No cobrado aceptado: <strong>{money(acceptedNoPaymentAmount)}</strong>.
            </p>
          </div>
        ) : null}

        {canViewPayments && isPlayed && paymentsReadyToClose && !isClosed ? (
          <div className="payment-resolution-ready">
            <strong>✅ Todo está resuelto</strong>
            <p className="help-text">
              Ya puedes cerrar el partido. Después desaparecerá de las alertas
              y seguirá disponible en el historial.
            </p>
          </div>
        ) : null}

        {isClosed && event.closed_by ? (
          <p className="help-text">
            Cerrado por <strong>{event.closed_by}</strong>.
            {event.close_notes ? ` Nota: ${event.close_notes}` : ""}
          </p>
        ) : null}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        {isFullAndCourtPending ? (
          <div
            className="mini-panel"
            style={{
              marginBottom: 14,
              border: "2px solid #f59e0b",
              background: "#fffbeb",
            }}
          >
            <strong>⚠ Partido lleno — cancha pendiente de reservar</strong>
            <p className="help-text" style={{ marginBottom: 0 }}>
              Los jugadores ya están completos, pero todavía no consta una cancha confirmada.
            </p>
          </div>
        ) : null}

        <div className="player-top">
          <div>
            <h2>Reserva de cancha y costos</h2>

            <p>
              Estado actual:{" "}
              <strong>{reservationStatusLabel(event.court_reservation_status)}</strong>
            </p>

            {event.court_number ? (
              <p className="help-text">Número de cancha: {event.court_number}</p>
            ) : null}

            {event.court_reservation_reference ? (
              <p className="help-text">
                Referencia: {event.court_reservation_reference}
              </p>
            ) : null}

            {event.court_reserved_by ? (
              <p className="help-text">Reservada por: {event.court_reserved_by}</p>
            ) : null}

            {event.court_reservation_requested_at ? (
              <p className="help-text">
                Solicitud registrada:{" "}
                {new Date(event.court_reservation_requested_at).toLocaleString("es-EC")}
              </p>
            ) : null}

            {event.court_reserved_at ? (
              <p className="help-text">
                Reserva confirmada:{" "}
                {new Date(event.court_reserved_at).toLocaleString("es-EC")}
              </p>
            ) : null}

            {canViewPayments ? (
              <p className="help-text">
                Costo de cancha: <strong>{money(event.court_cost)}</strong> · Otros
                gastos: <strong>{money(event.other_expenses)}</strong>
              </p>
            ) : null}

            {event.court_reservation_notes ? (
              <p className="help-text">
                Nota operativa: {event.court_reservation_notes}
              </p>
            ) : null}

            {canViewPayments && event.financial_notes ? (
              <p className="help-text">Nota financiera: {event.financial_notes}</p>
            ) : null}

            <p className="help-text">
              Pro Team Max guarda el seguimiento. La reserva real se realiza en la
              aplicación o sistema del club.
            </p>
          </div>

          <span
            className={`badge ${reservationStatusClass(
              event.court_reservation_status
            )}`}
          >
            {reservationStatusLabel(event.court_reservation_status)}
          </span>
        </div>

        {editingReservation ? (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="grid grid-3">
              <label>
                Estado de reserva
                <select
                  value={reservationDraft.status}
                  onChange={(e) =>
                    setReservationDraft((current) => ({
                      ...current,
                      status: e.target.value as ReservationStatus,
                    }))
                  }
                >
                  <option value="pendiente_reservar">Pendiente de reservar</option>
                  <option value="solicitada">Reserva solicitada</option>
                  <option value="reservada">Cancha reservada</option>
                  <option value="no_disponible">No disponible</option>
                  <option value="cancelada">Reserva cancelada</option>
                </select>
              </label>

              <label>
                Número de cancha
                <input
                  placeholder="Ej: Cancha 2"
                  value={reservationDraft.courtNumber}
                  onChange={(e) =>
                    setReservationDraft((current) => ({
                      ...current,
                      courtNumber: e.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Código o referencia
                <input
                  placeholder="Ej: reserva #123 o SimplyBook"
                  value={reservationDraft.reference}
                  onChange={(e) =>
                    setReservationDraft((current) => ({
                      ...current,
                      reference: e.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Reservada por
                <input
                  placeholder="Ej: Alejandro, asistente de mañana..."
                  value={reservationDraft.reservedBy}
                  onChange={(e) =>
                    setReservationDraft((current) => ({
                      ...current,
                      reservedBy: e.target.value,
                    }))
                  }
                />
              </label>

{canEditPayments ? (
                <>
              <label>
                Costo de cancha
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej: 30"
                  value={reservationDraft.courtCost}
                  onChange={(e) =>
                    setReservationDraft((current) => ({
                      ...current,
                      courtCost: e.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Otros gastos
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej: 5"
                  value={reservationDraft.otherExpenses}
                  onChange={(e) =>
                    setReservationDraft((current) => ({
                      ...current,
                      otherExpenses: e.target.value,
                    }))
                  }
                />
              </label>
                </>
              ) : null}
            </div>

            <label>
              Notas operativas de la reserva
              <textarea
                placeholder="Ej: se pidió cancha 2, falta confirmación del club..."
                value={reservationDraft.reservationNotes}
                onChange={(e) =>
                  setReservationDraft((current) => ({
                    ...current,
                    reservationNotes: e.target.value,
                  }))
                }
                style={{ minHeight: 80 }}
              />
            </label>

            {canEditPayments ? (
            <label>
              Notas financieras
              <textarea
                placeholder="Ej: el club cobra después, hubo descuento, gasto extra..."
                value={reservationDraft.financialNotes}
                onChange={(e) =>
                  setReservationDraft((current) => ({
                    ...current,
                    financialNotes: e.target.value,
                  }))
                }
                style={{ minHeight: 80 }}
              />
            </label>
            ) : null}

            <div className="row-actions">
              <button className="btn save" onClick={() => saveCourtReservation()}>
                Guardar reserva y costos
              </button>

              <button
                className="btn secondary"
                onClick={() => setEditingReservation(false)}
              >
                Cancelar edición
              </button>
            </div>
          </div>
        ) : canManageEvent ? (
          <div className="row-actions" style={{ marginTop: 12 }}>
            <button
              className="btn secondary"
              onClick={() => saveCourtReservation("solicitada")}
            >
              Marcar solicitud enviada
            </button>

            <button
              className="btn"
              onClick={() => {
                setReservationDraft((current) => ({
                  ...current,
                  status: "reservada",
                }));
                setEditingReservation(true);
              }}
            >
              Marcar cancha reservada
            </button>

            <button
              className="btn secondary"
              onClick={() => {
                setReservationDraft({
                  status: reservationStatusNormalized(
                    event.court_reservation_status
                  ),
                  courtNumber: event.court_number ?? "",
                  reference: event.court_reservation_reference ?? "",
                  reservedBy: event.court_reserved_by ?? "",
                  courtCost:
                    event.court_cost === null || event.court_cost === undefined
                      ? ""
                      : String(numericAmount(event.court_cost)),
                  otherExpenses:
                    event.other_expenses === null ||
                    event.other_expenses === undefined
                      ? ""
                      : String(numericAmount(event.other_expenses)),
                  reservationNotes: event.court_reservation_notes ?? "",
                  financialNotes: event.financial_notes ?? "",
                });
                setEditingReservation(true);
              }}
            >
              Editar reserva y costos
            </button>

            <button className="btn ghost" onClick={copyCourtReservationMessage}>
              Copiar mensaje para el club
            </button>

            <button
              className="btn ghost"
              onClick={() =>
                saveCourtReservation("pendiente_reservar", {
                  reference: "",
                  reservationNotes: "Pendiente de reservar en la app del club.",
                })
              }
            >
              Marcar pendiente
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <p className="help-text">Estado rápido</p>
          <h2>{confirmed.length}/{event.players_needed}</h2>
          <p className="help-text">Confirmados · faltan {missingPlayers}</p>
        </div>

        {canViewPayments ? (
          <>
            <div className="card">
              <p className="help-text">Cobrado</p>
              <h2>{money(totalPaid)}</h2>
              <p className="help-text">Esperado: {money(totalExpected)}</p>
            </div>

            <div className="card">
              <p className="help-text">Pendiente</p>
              <h2>{money(totalMissing)}</h2>
              <p className="help-text">Faltante por cobrar</p>
            </div>
          </>
        ) : (
          <div className="card">
            <p className="help-text">Finanzas</p>
            <h2>🔒 Privado</h2>
            <p className="help-text">Información no autorizada</p>
          </div>
        )}
      </div>

      {canViewPayments ? (
        <>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Cobro base</h2>

          {!editingEventPrice ? (
            <>
              <p>
                Precio base por jugador: <strong>{event.payment_default_amount === null ? "Sin definir" : money(event.payment_default_amount)}</strong>
              </p>

              {event.payment_default_notes ? (
                <p className="help-text">Nota: {event.payment_default_notes}</p>
              ) : null}

              <div className="row-actions">
                <button className="btn secondary" onClick={() => setEditingEventPrice(true)}>Editar precio base</button>
                <button className="btn ghost" onClick={applyDefaultPriceToEmptyConfirmed}>Aplicar a confirmados sin monto</button>
              </div>

              <p className="help-text">
                Esto no cambia precios especiales, gratis ni pagos ya editados. Solo ayuda a completar partidos viejos o confirmados sin monto.
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-2">
                <label>
                  Precio base por jugador
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ej: 12"
                    value={eventPriceDraft.amount}
                    onChange={(e) => setEventPriceDraft((current) => ({ ...current, amount: e.target.value }))}
                  />
                </label>

                <label>
                  Nota general
                  <input
                    placeholder="Ej: precio normal por jugador"
                    value={eventPriceDraft.notes}
                    onChange={(e) => setEventPriceDraft((current) => ({ ...current, notes: e.target.value }))}
                  />
                </label>
              </div>

              <div className="row-actions">
                <button className="btn save" onClick={saveEventDefaultPrice}>Guardar precio base</button>
                <button className="btn secondary" onClick={() => setEditingEventPrice(false)}>Cancelar</button>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <h2>Pagos del partido</h2>

          <div className="grid grid-3">
            <div className="mini-panel">
              <p className="help-text">Total esperado</p>
              <h2>{money(totalExpected)}</h2>
            </div>

            <div className="mini-panel">
              <p className="help-text">Total cobrado</p>
              <h2>{money(totalPaid)}</h2>
            </div>

            <div className="mini-panel">
              <p className="help-text">Faltante</p>
              <h2>{money(totalMissing)}</h2>
            </div>
          </div>

          <div className="row-actions" style={{ marginTop: 10 }}>
            <span className="badge good">{completePlayers.length} completos</span>
            <span className="badge good">{freePlayers.length} gratis</span>
            <span className="badge warn">{partialPlayers.length} parciales</span>
            <span className="badge warn">{pendingPlayers.length} por cobrar</span>
            <span className="badge danger">{notPaidPlayers.length} no pagaron</span>
            <span className="badge good">{extraPlayers.length} extra</span>
          </div>

          {totalExtra > 0 ? (
            <p className="help-text">Pagos extra detectados: <strong>{money(totalExtra)}</strong>.</p>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Cierre financiero del partido</h2>

        <div className="grid grid-3">
          <div className="mini-panel">
            <p className="help-text">Total cobrado</p>
            <h2>{money(totalPaid)}</h2>
          </div>

          <div className="mini-panel">
            <p className="help-text">Costo de cancha</p>
            <h2>{money(courtCost)}</h2>
          </div>

          <div className="mini-panel">
            <p className="help-text">Otros gastos</p>
            <h2>{money(otherExpenses)}</h2>
          </div>

          <div className="mini-panel">
            <p className="help-text">Gastos totales</p>
            <h2>{money(totalExpenses)}</h2>
          </div>

          <div className="mini-panel">
            <p className="help-text">Resultado final</p>
            <h2>{money(netResult)}</h2>
          </div>

          <div className="mini-panel">
            <p className="help-text">Pendiente por cobrar</p>
            <h2>{money(totalMissing)}</h2>
          </div>
        </div>

        <div className="row-actions" style={{ marginTop: 12 }}>
          {netResult > 0 ? (
            <span className="badge good">Saldo positivo: {money(netResult)}</span>
          ) : netResult < 0 ? (
            <span className="badge danger">Saldo negativo: {money(netResult)}</span>
          ) : (
            <span className="badge neutral">Resultado en cero</span>
          )}

          {totalMissing > 0 ? (
            <span className="badge warn">
              Aún falta cobrar {money(totalMissing)}
            </span>
          ) : (
            <span className="badge good">Sin faltantes registrados</span>
          )}
        </div>

        {event.financial_notes ? (
          <p className="help-text">
            Nota financiera: {event.financial_notes}
          </p>
        ) : null}

        <p className="help-text">
          Fórmula: total cobrado − costo de cancha − otros gastos = resultado final.
        </p>
      </div>

        </>
      ) : null}

      <div className="grid grid-2">
        <div className="card">
          <h2>Jugadores confirmados</h2>

          {confirmed.length ? (
            confirmed.map((row) => {
              const player = playerById.get(row.player_id);
              const key = paymentKey(row);
              const isEditing = editingPaymentKey === key;
              const draft = paymentDrafts[key];
              const state = financialState(row);

              return (
                <div key={row.player_id} className="mini-panel" style={{ marginTop: 12 }}>
                  <p>✅ <strong>{playerName(player)}</strong></p>

                  {canViewPayments ? (
                    <>
                  <div className="row-actions">
                    <span className={`badge ${state.className}`}>{state.label}</span>
                    <span className="badge neutral">Debe: {money(row.payment_due_amount)}</span>
                    <span className={`badge ${paymentStatusClass(row.payment_status)}`}>{paymentStatusLabel(row.payment_status)}</span>
                    <span className="badge good">Pagó: {money(row.payment_amount)}</span>

                    {row.payment_method ? <span className="badge good">{paymentMethodLabel(row.payment_method)}</span> : null}
                    {row.payment_reference ? <span className="badge neutral">Ref: {row.payment_reference}</span> : null}
                  </div>

                  {state.missing > 0 ? <p className="help-text">Faltante: <strong>{money(state.missing)}</strong></p> : null}
                  {state.extra > 0 ? <p className="help-text">Pagó extra: <strong>{money(state.extra)}</strong></p> : null}
                  {row.payment_due_notes ? <p className="help-text">Nota del precio: {row.payment_due_notes}</p> : null}
                  {row.payment_notes ? <p className="help-text">Nota del pago: {row.payment_notes}</p> : null}
                    </>
                  ) : null}

                  {canEditPayments && isEditing && draft ? (
                    <div className="card" style={{ marginTop: 12 }}>
                      <h3>Editar cobro del jugador</h3>

                      <div className="grid grid-2">
                        <label>
                          Debe pagar
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Ej: 12, 10 o 0"
                            value={draft.paymentDueAmount}
                            onChange={(e) => updatePaymentDraft(key, "paymentDueAmount", e.target.value)}
                          />
                        </label>

                        <label>
                          Monto pagado
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Ej: 12, 10, 5 o 0"
                            value={draft.paymentAmount}
                            onChange={(e) => updatePaymentDraft(key, "paymentAmount", e.target.value)}
                          />
                        </label>

                        <label>
                          Estado de pago
                          <select
                            value={draft.paymentStatus}
                            onChange={(e) => updatePaymentDraft(key, "paymentStatus", e.target.value as PaymentStatus)}
                          >
                            <option value="pendiente">Después me paga</option>
                            <option value="pagado">Pagado</option>
                            <option value="no_pago">No pagó</option>
                          </select>
                        </label>

                        {draft.paymentStatus === "pagado" && Number(draft.paymentAmount || 0) > 0 ? (
                          <label>
                            Método
                            <select
                              value={draft.paymentMethod}
                              onChange={(e) => updatePaymentDraft(key, "paymentMethod", e.target.value)}
                            >
                              <option value="">Seleccionar método</option>
                              <option value="efectivo">Efectivo</option>
                              <option value="transferencia">Transferencia</option>
                              <option value="deposito">Depósito</option>
                              <option value="tarjeta_link">Tarjeta/link</option>
                            </select>
                          </label>
                        ) : null}

                        <label>
                          Referencia
                          <input
                            placeholder="Ej: comprobante, últimos dígitos, depósito"
                            value={draft.paymentReference}
                            onChange={(e) => updatePaymentDraft(key, "paymentReference", e.target.value)}
                          />
                        </label>

                        <label>
                          Nota del precio
                          <input
                            placeholder="Ej: precio especial, gratis, pagó cancha completa"
                            value={draft.paymentDueNotes}
                            onChange={(e) => updatePaymentDraft(key, "paymentDueNotes", e.target.value)}
                          />
                        </label>
                      </div>

                      <label>
                        Nota interna del pago
                        <textarea
                          placeholder="Ej: falta validar transferencia, abonó parcial..."
                          value={draft.paymentNotes}
                          onChange={(e) => updatePaymentDraft(key, "paymentNotes", e.target.value)}
                          style={{ minHeight: 80 }}
                        />
                      </label>

                      <label>
                        Link/ruta de comprobante
                        <input
                          placeholder="Después: link de Supabase Storage. Por ahora opcional."
                          value={draft.paymentProofUrl}
                          onChange={(e) => updatePaymentDraft(key, "paymentProofUrl", e.target.value)}
                        />
                      </label>

                      <div className="row-actions">
                        <button className="btn save" onClick={() => savePayment(row)}>Guardar pago</button>
                        <button className="btn secondary" onClick={cancelEditingPayment}>Cancelar</button>
                      </div>
                    </div>
                  ) : canEditPayments ? (
                    <div className="row-actions">
                      <button className="btn secondary" onClick={() => startEditingPayment(row)}>Editar pago</button>
                      <button className="btn activate" onClick={() => markAsFree(row)}>Gratis</button>
                      <button className="btn ghost" onClick={() => markPaymentPending(row)}>Después me paga</button>
                      <button className="btn ghost" onClick={() => markPaymentNotPaid(row)}>No pagó</button>
                    </div>
                  ) : null}

                  {renderResponseActions(row)}
                </div>
              );
            })
          ) : (
            <p className="help-text">Todavía no hay confirmados.</p>
          )}
        </div>

        <div className="card">
          <h2>Respuestas pendientes</h2>

          <div className="mini-panel">
            <h3>Lista de espera</h3>
            {waitlist.length ? (
              waitlist.map((row, index) => (
                <div key={row.player_id} style={{ marginTop: 10 }}>
                  <p>
                    🟡 #{row.waitlist_position ?? index + 1}{" "}
                    {playerName(playerById.get(row.player_id))}
                  </p>
                  {renderResponseActions(row)}
                </div>
              ))
            ) : (
              <p className="help-text">Sin lista de espera.</p>
            )}
          </div>

          <div className="mini-panel" style={{ marginTop: 12 }}>
            <h3>No pueden</h3>
            {rejected.length ? (
              rejected.map((row) => (
                <div key={row.player_id} style={{ marginTop: 10 }}>
                  <p>❌ {playerName(playerById.get(row.player_id))}</p>
                  {renderResponseActions(row)}
                </div>
              ))
            ) : (
              <p className="help-text">Sin rechazados.</p>
            )}
          </div>

          <div className="mini-panel" style={{ marginTop: 12 }}>
            <h3>Ambiguos</h3>
            {ambiguous.length ? (
              ambiguous.map((row) => (
                <div key={row.player_id} style={{ marginTop: 10 }}>
                  <p>🤔 {playerName(playerById.get(row.player_id))}</p>
                  {renderResponseActions(row)}
                </div>
              ))
            ) : (
              <p className="help-text">Sin ambiguos.</p>
            )}
          </div>
        </div>
      </div>

      {isCanceled && showCancelMessages ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Avisos de cancelación</h2>

          <p className="help-text">
            Enviar manualmente a confirmados, lista de espera y ambiguos. No se avisa a “No pueden”.
          </p>

          {!shouldNotify.length ? (
            <p className="help-text">No hay jugadores para notificar.</p>
          ) : (
            shouldNotify.map((row) => {
              const player = playerById.get(row.player_id);
              const message = cancellationMessage(event, venue?.name ?? "la sede", player);

              return (
                <div className="mini-panel" key={row.player_id} style={{ marginTop: 12 }}>
                  <strong>{playerName(player)}</strong>

                  <p className="help-text">
                    Estado previo: {row.status === "confirmado" ? "Confirmado" : row.status === "lista_espera" ? "Lista de espera" : "Ambiguo"}
                  </p>

                  <div className="copy-box">{message}</div>

                  <div className="row-actions">
                    <button
                      className="btn secondary"
                      onClick={async () => {
                        await navigator.clipboard.writeText(message);
                        setNotice(`Aviso copiado para ${playerName(player)}.`);
                      }}
                    >
                      Copiar aviso
                    </button>

                    <a className="btn" href={whatsappLink(player?.whatsapp ?? null, message)} target="_blank" rel="noreferrer">
                      Abrir WhatsApp
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </>
  );
}