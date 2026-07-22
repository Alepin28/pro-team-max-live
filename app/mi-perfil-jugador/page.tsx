"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DEMO_ACCOUNT_ID } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";

type PlayerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  whatsapp: string | null;
  validated_category: string | null;
  gender: string | null;
  preferred_side: string | null;
  active: boolean | null;
  deleted_at: string | null;
  reliability_score?: number | null;
};

type RequestRow = {
  id: string;
  [key: string]: any;
};

type ParticipationRow = {
  event_id: string;
  player_id: string;
  status: string | null;
  payment_status: string | null;
  payment_amount: number | string | null;
  payment_due_amount: number | string | null;
  paid_at: string | null;
};

type EventRow = {
  id: string;
  community_id: string | null;
  venue_id: string | null;
  event_date: string | null;
  start_time: string | null;
  duration_minutes: number | null;
  category: string | null;
  status: string | null;
  court_reservation_status: string | null;
  court_reservation_reference: string | null;
};

type SimpleRow = {
  id: string;
  name: string;
};

type ProfileResult = {
  player: PlayerRow | null;
  requests: RequestRow[];
  participations: ParticipationRow[];
  events: EventRow[];
  venues: SimpleRow[];
  communities: SimpleRow[];
};

const categories = [
  { value: "C1", label: "Primera" },
  { value: "C2", label: "Segunda" },
  { value: "C3", label: "Tercera" },
  { value: "C4", label: "Cuarta" },
  { value: "C5", label: "Quinta" },
  { value: "C6", label: "Sexta" },
  { value: "C7", label: "Novatos" },
];

function digits(value?: string | null) {
  return String(value ?? "").replace(/[^0-9]/g, "");
}

function phoneMatches(a?: string | null, b?: string | null) {
  const left = digits(a);
  const right = digits(b);

  if (!left || !right) return false;
  if (left === right) return true;

  const leftLast9 = left.slice(-9);
  const rightLast9 = right.slice(-9);

  return leftLast9.length >= 8 && leftLast9 === rightLast9;
}

function categoryLabel(category?: string | null) {
  return categories.find((item) => item.value === category)?.label ?? category ?? "Sin categoría";
}

function requestCategoryLabel(row: RequestRow) {
  return categoryLabel(row.category ?? row.requested_category ?? row.validated_category ?? row.category_code);
}

function requestName(row: RequestRow) {
  return row.full_name ?? row.name ?? row.player_name ?? "Jugador";
}

function requestWhatsapp(row: RequestRow) {
  return row.whatsapp ?? row.phone ?? row.phone_number ?? "";
}

function requestStatus(row: RequestRow) {
  const status = row.status ?? "nueva";

  if (status === "new" || status === "nueva" || status === "pendiente") return "Pendiente";
  if (status === "contacted" || status === "contactado") return "Contactado";
  if (status === "convocado") return "Convocado";
  if (status === "converted" || status === "convertido") return "Convertido en jugador";
  if (status === "closed" || status === "cerrado") return "Cerrado";
  if (status === "descartado") return "Descartado";

  return status;
}

function requestStatusClass(row: RequestRow) {
  const status = row.status ?? "pendiente";
  if (status === "convertido" || status === "converted") return "good";
  if (status === "contactado" || status === "convocado" || status === "contacted") return "good";
  if (status === "descartado") return "danger";
  return "warn";
}

function statusClass(status?: string | null) {
  if (status === "confirmado") return "good";
  if (status === "lista_espera") return "warn";
  if (status === "rechazo") return "danger";
  if (status === "ambiguo") return "warn";
  return "neutral";
}

function statusLabel(status?: string | null) {
  if (status === "confirmado") return "Confirmado";
  if (status === "lista_espera") return "Lista de espera";
  if (status === "rechazo") return "No puede";
  if (status === "ambiguo") return "Ambiguo";
  return status ?? "Sin estado";
}

function reservationLabel(status?: string | null) {
  if (status === "reservada") return "Cancha reservada";
  if (status === "no_disponible") return "No disponible";
  if (status === "cancelada") return "Reserva cancelada";
  return "Pendiente de reservar";
}

function reservationClass(status?: string | null) {
  if (status === "reservada") return "good";
  if (status === "no_disponible" || status === "cancelada") return "danger";
  return "warn";
}

function paymentLabel(status?: string | null) {
  if (status === "pagado") return "Pagado";
  if (status === "no_pago" || status === "no_pagado") return "No pagó";
  return "Pendiente";
}

function paymentClass(status?: string | null) {
  if (status === "pagado") return "good";
  if (status === "no_pago" || status === "no_pagado") return "danger";
  return "warn";
}

function numericAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number | string | null | undefined) {
  return `$${numericAmount(value).toFixed(2)}`;
}

function formatDate(dateString?: string | null) {
  if (!dateString) return "Sin fecha";

  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString("es-EC", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatTime(time?: string | null) {
  return (time ?? "").slice(0, 5) || "Sin hora";
}

function eventDateTime(event?: EventRow | null) {
  if (!event?.event_date || !event?.start_time) return new Date(0);
  return new Date(`${event.event_date}T${event.start_time}`);
}

function playerName(player?: PlayerRow | null) {
  if (!player) return "Jugador no registrado todavía";
  return [player.first_name, player.last_name].filter(Boolean).join(" ") || "Jugador";
}

function percent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function uniqueText(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export default function MiPerfilJugadorPage() {
  const [phone, setPhone] = useState("+593");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState<ProfileResult>({
    player: null,
    requests: [],
    participations: [],
    events: [],
    venues: [],
    communities: [],
  });
  const [searched, setSearched] = useState(false);

  async function searchProfile() {
    setNotice("");
    setLoading(true);
    setSearched(true);

    const cleanPhone = digits(phone);

    if (cleanPhone.length < 8) {
      setNotice("Escribe un WhatsApp válido. Ejemplo: +593999999999.");
      setLoading(false);
      return;
    }

    try {
      const [playersRes, requestsRes] = await Promise.all([
        supabase
          .from("players")
          .select("id, first_name, last_name, whatsapp, validated_category, gender, preferred_side, active, deleted_at, reliability_score")
          .eq("account_id", DEMO_ACCOUNT_ID)
          .limit(500),

        supabase
          .from("player_requests_demo")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      if (playersRes.error) throw playersRes.error;
      if (requestsRes.error) throw requestsRes.error;

      const allPlayers = (playersRes.data ?? []) as PlayerRow[];
      const allRequests = (requestsRes.data ?? []) as RequestRow[];

      const matchedPlayer = allPlayers.find((row) => phoneMatches(row.whatsapp, phone)) ?? null;
      const matchedRequests = allRequests.filter((row) => phoneMatches(requestWhatsapp(row), phone));

      let participations: ParticipationRow[] = [];
      let events: EventRow[] = [];
      let venues: SimpleRow[] = [];
      let communities: SimpleRow[] = [];

      if (matchedPlayer) {
        const participationsRes = await supabase
          .from("participations")
          .select("event_id, player_id, status, payment_status, payment_amount, payment_due_amount, paid_at")
          .eq("player_id", matchedPlayer.id);

        if (participationsRes.error) throw participationsRes.error;

        participations = (participationsRes.data ?? []) as ParticipationRow[];
        const eventIds = Array.from(new Set(participations.map((row) => row.event_id).filter(Boolean)));

        if (eventIds.length) {
          const eventsRes = await supabase
            .from("events")
            .select("id, community_id, venue_id, event_date, start_time, duration_minutes, category, status, court_reservation_status, court_reservation_reference")
            .in("id", eventIds);

          if (eventsRes.error) throw eventsRes.error;

          events = (eventsRes.data ?? []) as EventRow[];

          const venueIds = Array.from(new Set(events.map((event) => event.venue_id).filter(Boolean))) as string[];
          const communityIds = Array.from(new Set(events.map((event) => event.community_id).filter(Boolean))) as string[];

          if (venueIds.length) {
            const venuesRes = await supabase.from("venues").select("id, name").in("id", venueIds);
            if (venuesRes.error) throw venuesRes.error;
            venues = (venuesRes.data ?? []) as SimpleRow[];
          }

          if (communityIds.length) {
            const communitiesRes = await supabase.from("communities").select("id, name").in("id", communityIds);
            if (communitiesRes.error) throw communitiesRes.error;
            communities = (communitiesRes.data ?? []) as SimpleRow[];
          }
        }
      }

      setProfile({
        player: matchedPlayer,
        requests: matchedRequests,
        participations,
        events,
        venues,
        communities,
      });

      if (!matchedPlayer && !matchedRequests.length) {
        setNotice("No encontramos jugador ni solicitudes con ese WhatsApp. Revisa que lo escribiste igual que en la solicitud.");
      } else if (!matchedPlayer && matchedRequests.length) {
        setNotice("Encontramos tu solicitud. Todavía no estás convertido en jugador registrado.");
      } else {
        setNotice("Perfil encontrado.");
      }
    } catch (error: any) {
      setNotice(`No se pudo buscar el perfil: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  const eventById = useMemo(() => new Map(profile.events.map((event) => [event.id, event])), [profile.events]);
  const venueById = useMemo(() => new Map(profile.venues.map((venue) => [venue.id, venue])), [profile.venues]);
  const communityById = useMemo(() => new Map(profile.communities.map((community) => [community.id, community])), [profile.communities]);

  const sortedParticipations = useMemo(() => {
    return [...profile.participations].sort((a, b) => {
      const eventA = eventById.get(a.event_id);
      const eventB = eventById.get(b.event_id);
      return eventDateTime(eventB).getTime() - eventDateTime(eventA).getTime();
    });
  }, [profile.participations, eventById]);

  const paymentStats = useMemo(() => {
    const expected = profile.participations.reduce((sum, row) => sum + numericAmount(row.payment_due_amount), 0);
    const paid = profile.participations.reduce((sum, row) => sum + numericAmount(row.payment_amount), 0);
    const missing = profile.participations.reduce((sum, row) => {
      const due = numericAmount(row.payment_due_amount);
      const rowPaid = numericAmount(row.payment_amount);
      return sum + Math.max(due - rowPaid, 0);
    }, 0);

    const pendingPayments = profile.participations.filter((row) => {
      const due = numericAmount(row.payment_due_amount);
      const rowPaid = numericAmount(row.payment_amount);
      return due > rowPaid;
    }).length;

    return { expected, paid, missing, pendingPayments };
  }, [profile.participations]);

  const rankingStats = useMemo(() => {
    const total = profile.participations.length;
    const confirmed = profile.participations.filter((row) => row.status === "confirmado").length;
    const waitlist = profile.participations.filter((row) => row.status === "lista_espera").length;
    const rejected = profile.participations.filter((row) => row.status === "rechazo").length;
    const ambiguous = profile.participations.filter((row) => row.status === "ambiguo").length;
    const responsePositive = total ? (confirmed / total) * 100 : 0;
    const reliability = profile.player?.reliability_score ?? Math.max(50, Math.min(100, Math.round(responsePositive || 80)));

    return { total, confirmed, waitlist, rejected, ambiguous, responsePositive, reliability };
  }, [profile.participations, profile.player]);

  const latestRequest = profile.requests[0];

  const requestedVenues = useMemo(() => {
    return uniqueText(
      profile.requests.flatMap((row) =>
        Array.isArray(row.preferred_venues) ? row.preferred_venues : row.preferred_venue ? [row.preferred_venue] : []
      )
    );
  }, [profile.requests]);

  const requestedDays = useMemo(() => {
    return uniqueText(
      profile.requests.flatMap((row) =>
        Array.isArray(row.preferred_days) ? row.preferred_days : row.preferred_day ? [row.preferred_day] : []
      )
    );
  }, [profile.requests]);

  return (
    <>
      <PageHeader
        title="Mi perfil jugador"
        description="Portal demo: el jugador consulta solicitudes, partidos, pagos, ranking y estado de cancha usando su WhatsApp."
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <span className="badge warn">App jugador demo</span>
        <p className="help-text">
          Más adelante esto tendrá login real. Por ahora, sirve como prototipo rápido para mostrar la experiencia del jugador.
        </p>

        {notice ? <p><strong>{notice}</strong></p> : null}

        <div className="grid grid-2">
          <label>
            WhatsApp del jugador
            <input
              placeholder="Ej: +593999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchProfile();
              }}
            />
          </label>

          <button className="btn" disabled={loading} onClick={searchProfile} style={{ alignSelf: "end" }}>
            {loading ? "Buscando..." : "Buscar mi perfil"}
          </button>
        </div>
      </div>

      {searched ? (
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <div className="card">
            <p className="help-text">Estado</p>
            <h2>{profile.player ? "Jugador registrado" : profile.requests.length ? "Solicitud recibida" : "Sin datos"}</h2>
            <p className="help-text">
              {profile.player ? playerName(profile.player) : profile.requests.length ? requestName(profile.requests[0]) : "No encontrado"}
            </p>
          </div>

          <div className="card">
            <p className="help-text">Partidos</p>
            <h2>{rankingStats.total}</h2>
            <p className="help-text">Confirmados, espera, rechazados o ambiguos.</p>
          </div>

          <div className="card">
            <p className="help-text">Faltante</p>
            <h2>{money(paymentStats.missing)}</h2>
            <p className="help-text">Según pagos registrados por el admin.</p>
          </div>

          <div className="card">
            <p className="help-text">Confiabilidad demo</p>
            <h2>{rankingStats.reliability}</h2>
            <p className="help-text">Subirá con confirmaciones y buen historial.</p>
          </div>
        </div>
      ) : null}

      {searched && (profile.player || latestRequest) ? (
        <div className="grid grid-2" style={{ marginBottom: 16 }}>
          <div className="card">
            <h2>Mi estado deportivo</h2>

            <div className="row-actions">
              {profile.player ? <span className="badge good">Jugador registrado</span> : <span className="badge warn">Solicitud recibida</span>}
              <span className="badge good">{categoryLabel(profile.player?.validated_category ?? latestRequest?.category)}</span>
              {profile.player?.gender ? <span className="badge neutral">{profile.player.gender}</span> : null}
              {profile.player?.preferred_side ? <span className="badge neutral">{profile.player.preferred_side}</span> : null}
            </div>

            <p className="help-text" style={{ marginTop: 10 }}>
              {profile.player
                ? "Ya estás en la base del admin. Puedes ser convocado desde Crear partido."
                : "El admin ya puede ver tu solicitud. Cuando te convierta en jugador, aparecerás para convocatorias."}
            </p>

            {requestedVenues.length || requestedDays.length ? (
              <div className="mini-panel" style={{ marginTop: 12 }}>
                <h3>Preferencias enviadas</h3>
                {requestedVenues.length ? <p className="help-text">Sedes: {requestedVenues.join(", ")}</p> : null}
                {requestedDays.length ? <p className="help-text">Días: {requestedDays.join(", ")}</p> : null}
                {latestRequest?.preferred_times ? <p className="help-text">Horario: {latestRequest.preferred_times}</p> : null}
              </div>
            ) : null}
          </div>

          <div className="card">
            <h2>Mi ranking demo</h2>

            <div className="grid grid-3">
              <div className="mini-panel">
                <p className="help-text">Confirmados</p>
                <h2>{rankingStats.confirmed}</h2>
              </div>

              <div className="mini-panel">
                <p className="help-text">Lista espera</p>
                <h2>{rankingStats.waitlist}</h2>
              </div>

              <div className="mini-panel">
                <p className="help-text">No pude</p>
                <h2>{rankingStats.rejected}</h2>
              </div>
            </div>

            <div className="row-actions" style={{ marginTop: 12 }}>
              <span className="badge good">Respuesta positiva: {percent(rankingStats.responsePositive)}</span>
              <span className="badge warn">Ambiguos: {rankingStats.ambiguous}</span>
              <span className="badge neutral">Score demo: {rankingStats.reliability}</span>
            </div>

            <p className="help-text">
              Este ranking es demo. Después puede alimentar prioridad de invitación, historial y reputación.
            </p>
          </div>
        </div>
      ) : null}

      {searched ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Mis pagos</h2>

          <div className="grid grid-3">
            <div className="mini-panel">
              <p className="help-text">Total esperado</p>
              <h2>{money(paymentStats.expected)}</h2>
            </div>

            <div className="mini-panel">
              <p className="help-text">Total pagado</p>
              <h2>{money(paymentStats.paid)}</h2>
            </div>

            <div className="mini-panel">
              <p className="help-text">Faltante</p>
              <h2>{money(paymentStats.missing)}</h2>
            </div>
          </div>

          <div className="row-actions" style={{ marginTop: 12 }}>
            <span className="badge warn">Pagos pendientes: {paymentStats.pendingPayments}</span>
            <span className="badge neutral">Controlado por el admin</span>
          </div>
        </div>
      ) : null}

      {searched ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Mis solicitudes</h2>

          {!profile.requests.length ? (
            <p className="help-text">No hay solicitudes registradas con este WhatsApp.</p>
          ) : (
            <div className="grid">
              {profile.requests.map((row) => (
                <div className="mini-panel" key={row.id}>
                  <strong>{requestName(row)}</strong>

                  <div className="row-actions" style={{ marginTop: 8 }}>
                    <span className="badge good">{requestCategoryLabel(row)}</span>
                    <span className={`badge ${requestStatusClass(row)}`}>{requestStatus(row)}</span>
                    {row.preferred_times ? <span className="badge neutral">{row.preferred_times}</span> : null}
                  </div>

                  <p className="help-text">
                    Sedes: {Array.isArray(row.preferred_venues) ? row.preferred_venues.join(", ") : row.preferred_venue ?? "Sin sede"}
                  </p>

                  <p className="help-text">
                    Días: {Array.isArray(row.preferred_days) ? row.preferred_days.join(", ") : row.preferred_day ?? "Sin días"}
                  </p>

                  {row.message ? <p className="help-text">Mensaje: {row.message}</p> : null}
                  {row.created_at ? <p className="help-text">Enviada: {new Date(row.created_at).toLocaleString("es-EC")}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {searched ? (
        <div className="card">
          <h2>Mis partidos</h2>

          {!sortedParticipations.length ? (
            <p className="help-text">Todavía no hay partidos registrados para este WhatsApp.</p>
          ) : (
            <div className="grid">
              {sortedParticipations.map((row) => {
                const event = eventById.get(row.event_id);
                const venue = event?.venue_id ? venueById.get(event.venue_id) : null;
                const community = event?.community_id ? communityById.get(event.community_id) : null;
                const due = numericAmount(row.payment_due_amount);
                const paid = numericAmount(row.payment_amount);
                const missing = Math.max(due - paid, 0);

                return (
                  <div className="mini-panel" key={`${row.event_id}-${row.player_id}`}>
                    <strong>
                      {community?.name ?? "Comunidad"} · {venue?.name ?? "Sede"}
                    </strong>

                    <p className="help-text">
                      {formatDate(event?.event_date)} · {formatTime(event?.start_time)} · {categoryLabel(event?.category)}
                    </p>

                    <div className="row-actions">
                      <span className={`badge ${statusClass(row.status)}`}>{statusLabel(row.status)}</span>
                      <span className={`badge ${reservationClass(event?.court_reservation_status)}`}>{reservationLabel(event?.court_reservation_status)}</span>
                      <span className={`badge ${paymentClass(row.payment_status)}`}>Pago: {paymentLabel(row.payment_status)}</span>
                      <span className="badge neutral">Debe: {money(row.payment_due_amount)}</span>
                      <span className="badge good">Pagó: {money(row.payment_amount)}</span>
                      {missing > 0 ? <span className="badge warn">Falta: {money(missing)}</span> : null}
                    </div>

                    {event?.court_reservation_reference ? (
                      <p className="help-text">Reserva: {event.court_reservation_reference}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}