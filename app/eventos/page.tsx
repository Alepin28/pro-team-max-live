"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
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
  payment_default_amount: number | string | null;
  court_reservation_status: string | null;
  court_number: string | null;
  court_cost: number | string | null;
  other_expenses: number | string | null;
  played_at: string | null;
  closed_at: string | null;
  gender_mode: string | null;
  organizer_name: string | null;
  commission_amount: number | string | null;
  commission_status: string | null;
};

type ParticipationRow = {
  account_id: string;
  event_id: string;
  player_id: string;
  status: string;
  payment_status: string | null;
  payment_amount: number | string | null;
  payment_due_amount: number | string | null;
};

type SimpleRow = {
  id: string;
  name: string;
};

type StaffPermissions = {
  viewPayments?: boolean;
  editPayments?: boolean;
  managePayments?: boolean;
  [key: string]: boolean | undefined;
};

type StaffProfile = {
  id?: string;
  account_id?: string;
  full_name?: string;
  role?: string;
  active?: boolean;
  auth_status?: string;
  permissions?: StaffPermissions | null;
};

type StatusFilter =
  | "activos"
  | "jugados"
  | "cerrados"
  | "cancelados"
  | "todos";

type DateFilter =
  | "proximos"
  | "hoy"
  | "manana"
  | "semana"
  | "pasados"
  | "todos";

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

  const message = [
    error?.message,
    error?.details,
    error?.hint,
  ]
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

function canProfileViewPayments(profile: StaffProfile) {
  const role = String(profile.role ?? "").toLowerCase();

  return (
    role === "owner" ||
    role === "admin" ||
    profile.permissions?.viewPayments === true
  );
}

function categoryLabel(category?: string | null) {
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

function genderLabel(gender?: string | null) {
  if (gender === "hombres") return "Hombres";
  if (gender === "mujeres") return "Mujeres";
  if (gender === "mixto") return "Mixto";

  return "Libre";
}

function statusLabel(status?: string | null) {
  if (status === "cancelado") return "Cancelado";
  if (status === "cerrado") return "Cerrado";
  if (status === "jugado") return "Jugado · por cerrar";
  if (status === "completo") return "Completo";
  if (status === "buscando_jugadores") return "Buscando jugadores";

  return status ?? "Sin estado";
}

function statusClass(status?: string | null) {
  if (status === "cancelado") return "danger";

  if (status === "cerrado" || status === "completo") {
    return "good";
  }

  if (status === "jugado" || status === "buscando_jugadores") {
    return "warn";
  }

  return "neutral";
}

function reservationLabel(status?: string | null) {
  if (status === "reservada") return "Cancha lista";
  if (status === "solicitada") return "Reserva solicitada";
  if (status === "no_disponible") return "No disponible";
  if (status === "cancelada") return "Reserva cancelada";

  return "Cancha pendiente";
}

function reservationClass(status?: string | null) {
  if (status === "reservada") return "good";

  if (status === "no_disponible" || status === "cancelada") {
    return "danger";
  }

  return "warn";
}

function numericAmount(
  value: number | string | null | undefined
) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).replace(",", "."));

  return Number.isFinite(parsed) ? parsed : 0;
}

function money(
  value: number | string | null | undefined
) {
  return `$${numericAmount(value).toFixed(2)}`;
}

function normalizePaymentStatus(status?: string | null) {
  if (status === "pagado") return "pagado";

  if (status === "no_pago" || status === "no_pagado") {
    return "no_pago";
  }

  return "pendiente";
}

function isPaymentResolved(row: ParticipationRow) {
  const status = normalizePaymentStatus(row.payment_status);

  if (status === "no_pago") {
    return true;
  }

  if (status !== "pagado") {
    return false;
  }

  return (
    numericAmount(row.payment_amount) >=
    numericAmount(row.payment_due_amount)
  );
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(
    "es-EC",
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }
  );
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function todayOnly() {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}

function diffDays(event: EventRow) {
  return Math.round(
    (new Date(`${event.event_date}T12:00:00`).getTime() -
      todayOnly().getTime()) /
      86400000
  );
}

export default function PartidosPage() {
  const [events, setEvents] = useState<EventRow[]>([]);

  const [participations, setParticipations] = useState<
    ParticipationRow[]
  >([]);

  const [venues, setVenues] = useState<SimpleRow[]>([]);

  const [communities, setCommunities] = useState<SimpleRow[]>(
    []
  );

  const [canViewPayments, setCanViewPayments] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("activos");

  const [dateFilter, setDateFilter] =
    useState<DateFilter>("proximos");

  const [search, setSearch] = useState("");

  useEffect(() => {
    void loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    setNotice("");

    try {
      const profileRes = await supabase.rpc(
        "ptm_current_staff_profile_v1"
      );

      if (profileRes.error) {
        throw profileRes.error;
      }

      const profile = normalizeRpcObject(
        profileRes.data
      ) as StaffProfile;

      const accountId = profile.account_id;

      if (!accountId) {
        throw new Error(
          "Tu sesión no está vinculada a una cuenta activa."
        );
      }

      const paymentsAllowed =
        canProfileViewPayments(profile);

      setCanViewPayments(paymentsAllowed);

      const eventsRes = await secureSelectWithFallback({
        secureSource: "ptm_events_secure_v1",
        fallbackSource: "events",
        select:
          "id, account_id, community_id, venue_id, title, event_date, start_time, duration_minutes, courts_count, players_needed, category, status, payment_default_amount, court_reservation_status, court_number, court_cost, other_expenses, played_at, closed_at, gender_mode, organizer_name, commission_amount, commission_status",
        configure: (query) =>
          query
            .eq("account_id", accountId)
            .order("event_date", {
              ascending: false,
            })
            .order("start_time", {
              ascending: false,
            })
            .limit(150),
      });

      const eventRows = (eventsRes.data ?? []) as EventRow[];

      setEvents(eventRows);

      if (!eventRows.length) {
        setParticipations([]);
        setVenues([]);
        setCommunities([]);
        return;
      }

      const eventIds = eventRows.map((event) => event.id);

      const venueIds = Array.from(
        new Set(eventRows.map((event) => event.venue_id))
      );

      const communityIds = Array.from(
        new Set(eventRows.map((event) => event.community_id))
      );

      const [
        participationsRes,
        venuesRes,
        communitiesRes,
      ] = await Promise.all([
        secureSelectWithFallback({
          secureSource: "ptm_participations_secure_v1",
          fallbackSource: "participations",
          select:
            "account_id, event_id, player_id, status, payment_status, payment_amount, payment_due_amount",
          configure: (query) =>
            query
              .eq("account_id", accountId)
              .in("event_id", eventIds),
        }),

        secureSelectWithFallback({
          secureSource: "ptm_venues_secure_v1",
          fallbackSource: "venues",
          select: "id, name",
          configure: (query) =>
            query
              .eq("account_id", accountId)
              .in("id", venueIds),
        }),

        supabase
          .from("communities")
          .select("id, name")
          .eq("account_id", accountId)
          .in("id", communityIds),
      ]);

      if (communitiesRes.error) {
        throw communitiesRes.error;
      }

      setParticipations(
        (participationsRes.data ?? []) as ParticipationRow[]
      );

      setVenues((venuesRes.data ?? []) as SimpleRow[]);

      setCommunities(
        (communitiesRes.data ?? []) as SimpleRow[]
      );
    } catch (error: any) {
      setEvents([]);
      setParticipations([]);
      setVenues([]);
      setCommunities([]);

      setNotice(
        `No se pudieron cargar los partidos: ${
          error?.message ?? "Error desconocido"
        }`
      );
    } finally {
      setLoading(false);
    }
  }

  const venueById = useMemo(
    () =>
      new Map(
        venues.map((venue) => [venue.id, venue.name])
      ),
    [venues]
  );

  const communityById = useMemo(
    () =>
      new Map(
        communities.map((community) => [
          community.id,
          community.name,
        ])
      ),
    [communities]
  );

  const participationByEvent = useMemo(() => {
    const map = new Map<string, ParticipationRow[]>();

    for (const row of participations) {
      const current = map.get(row.event_id) ?? [];

      current.push(row);
      map.set(row.event_id, current);
    }

    return map;
  }, [participations]);

  const filteredEvents = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return events
      .filter((event) => {
        const canceled = event.status === "cancelado";
        const closed = event.status === "cerrado";
        const played = event.status === "jugado";
        const active = !canceled && !closed;

        if (statusFilter === "activos" && !active) {
          return false;
        }

        if (statusFilter === "jugados" && !played) {
          return false;
        }

        if (statusFilter === "cerrados" && !closed) {
          return false;
        }

        if (statusFilter === "cancelados" && !canceled) {
          return false;
        }

        const difference = diffDays(event);

        if (dateFilter === "proximos" && difference < 0) {
          return false;
        }

        if (dateFilter === "hoy" && difference !== 0) {
          return false;
        }

        if (dateFilter === "manana" && difference !== 1) {
          return false;
        }

        if (
          dateFilter === "semana" &&
          (difference < 0 || difference > 7)
        ) {
          return false;
        }

        if (dateFilter === "pasados" && difference >= 0) {
          return false;
        }

        if (!cleanSearch) {
          return true;
        }

        return [
          event.title,
          communityById.get(event.community_id) ?? "",
          venueById.get(event.venue_id) ?? "",
          categoryLabel(event.category),
          genderLabel(event.gender_mode),
          event.organizer_name ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(cleanSearch);
      })
      .sort((left, right) => {
        const leftTime = new Date(
          `${left.event_date}T${left.start_time}`
        ).getTime();

        const rightTime = new Date(
          `${right.event_date}T${right.start_time}`
        ).getTime();

        return rightTime - leftTime;
      });
  }, [
    events,
    statusFilter,
    dateFilter,
    search,
    communityById,
    venueById,
  ]);

  if (loading) {
    return (
      <PageHeader
        title="Partidos"
        description="Cargando partidos..."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Partidos"
        description="Vista rápida. Abre el detalle cuando necesites editar, registrar respuestas o cerrar."
        action={
          <Link className="btn save" href="/llenar-canchas">
            Crear partido
          </Link>
        }
      />

      {notice ? (
        <div className="notice-banner">{notice}</div>
      ) : null}

      <div
        className="card compact-card"
        style={{ marginBottom: 16 }}
      >
        <div className="grid grid-3">
          <label>
            Buscar
            <input
              value={search}
              placeholder="Comunidad, sede, usuario..."
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </label>

          <label>
            Estado
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as StatusFilter
                )
              }
            >
              <option value="activos">Activos</option>
              <option value="jugados">
                Jugados por cerrar
              </option>
              <option value="cerrados">Cerrados</option>
              <option value="cancelados">Cancelados</option>
              <option value="todos">Todos</option>
            </select>
          </label>

          <label>
            Fecha
            <select
              value={dateFilter}
              onChange={(event) =>
                setDateFilter(
                  event.target.value as DateFilter
                )
              }
            >
              <option value="proximos">Próximos</option>
              <option value="hoy">Hoy</option>
              <option value="manana">Mañana</option>
              <option value="semana">
                Próximos 7 días
              </option>
              <option value="pasados">Pasados</option>
              <option value="todos">
                Todas las fechas
              </option>
            </select>
          </label>
        </div>

        <div
          className="row-actions"
          style={{ marginTop: 10 }}
        >
          <button
            className="btn secondary"
            onClick={() => void loadEvents()}
          >
            🔄 Actualizar
          </button>

          <span className="badge neutral">
            {filteredEvents.length} de {events.length}
          </span>

          {!canViewPayments ? (
            <span className="badge neutral">
              🔒 Finanzas privadas
            </span>
          ) : null}
        </div>
      </div>

      {!filteredEvents.length ? (
        <div className="card">
          <h2>No hay partidos con estos filtros</h2>

          <div className="row-actions">
            <button
              className="btn secondary"
              onClick={() => {
                setStatusFilter("todos");
                setDateFilter("todos");
              }}
            >
              Ver todos
            </button>

            <Link
              className="btn save"
              href="/llenar-canchas"
            >
              Crear partido
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid">
          {filteredEvents.map((event) => {
            const rows =
              participationByEvent.get(event.id) ?? [];

            const confirmed = rows.filter(
              (row) => row.status === "confirmado"
            );

            const waitlist = rows.filter(
              (row) => row.status === "lista_espera"
            );

            const unresolved = canViewPayments
              ? confirmed.filter(
                  (row) => !isPaymentResolved(row)
                )
              : [];

            const totalExpected = canViewPayments
              ? confirmed.reduce(
                  (sum, row) =>
                    sum +
                    numericAmount(row.payment_due_amount),
                  0
                )
              : 0;

            const totalPaid = canViewPayments
              ? confirmed.reduce(
                  (sum, row) =>
                    sum +
                    numericAmount(row.payment_amount),
                  0
                )
              : 0;

            const pendingAmount = canViewPayments
              ? unresolved.reduce(
                  (sum, row) =>
                    sum +
                    Math.max(
                      numericAmount(row.payment_due_amount) -
                        numericAmount(row.payment_amount),
                      0
                    ),
                  0
                )
              : 0;

            const expenses = canViewPayments
              ? numericAmount(event.court_cost) +
                numericAmount(event.other_expenses)
              : 0;

            const commission = canViewPayments
              ? numericAmount(event.commission_amount)
              : 0;

            const net = totalPaid - expenses - commission;

            const missingPlayers = Math.max(
              event.players_needed - confirmed.length,
              0
            );

            const isPlayed = event.status === "jugado";
            const isClosed = event.status === "cerrado";
            const isCanceled = event.status === "cancelado";

            return (
              <article
                className="card compact-event-card"
                key={event.id}
              >
                <div className="compact-event-main">
                  <div className="compact-event-date">
                    <strong>
                      {formatTime(event.start_time)}
                    </strong>

                    <small>
                      {formatDate(event.event_date)}
                    </small>
                  </div>

                  <div className="compact-event-copy">
                    <h2>
                      {communityById.get(event.community_id) ??
                        "Comunidad"}
                    </h2>

                    <p>
                      {venueById.get(event.venue_id) ?? "Sede"}
                      {" · "}
                      {categoryLabel(event.category)}
                      {" · "}
                      {genderLabel(event.gender_mode)}
                    </p>

                    <div className="row-actions">
                      <span
                        className={`badge ${statusClass(
                          event.status
                        )}`}
                      >
                        {statusLabel(event.status)}
                      </span>

                      <span
                        className={`badge ${reservationClass(
                          event.court_reservation_status
                        )}`}
                      >
                        {reservationLabel(
                          event.court_reservation_status
                        )}
                      </span>

                      {missingPlayers > 0 &&
                      !isClosed &&
                      !isCanceled ? (
                        <span className="badge warn">
                          Faltan {missingPlayers}
                        </span>
                      ) : (
                        <span className="badge good">
                          {confirmed.length}/
                          {event.players_needed}
                        </span>
                      )}

                      {isPlayed && canViewPayments ? (
                        unresolved.length ? (
                          <span className="badge warn">
                            {unresolved.length} pago(s)
                          </span>
                        ) : (
                          <span className="badge good">
                            Listo para cerrar
                          </span>
                        )
                      ) : null}
                    </div>
                  </div>

                  <Link
                    className="btn edit"
                    href={`/eventos/${event.id}`}
                  >
                    Abrir
                  </Link>
                </div>

                <details className="event-more-details">
                  <summary>Más información</summary>

                  <div className="event-more-grid">
                    <div>
                      <small>Canchas</small>
                      <strong>{event.courts_count}</strong>
                    </div>

                    <div>
                      <small>Duración</small>
                      <strong>
                        {event.duration_minutes} min
                      </strong>
                    </div>

                    <div>
                      <small>Confirmados</small>
                      <strong>{confirmed.length}</strong>
                    </div>

                    <div>
                      <small>Espera</small>
                      <strong>{waitlist.length}</strong>
                    </div>

                    <div>
                      <small>Organizó</small>
                      <strong>
                        {event.organizer_name ??
                          "Sin asignar"}
                      </strong>
                    </div>

                    {event.court_number ? (
                      <div>
                        <small>Cancha</small>
                        <strong>{event.court_number}</strong>
                      </div>
                    ) : null}

                    {canViewPayments ? (
                      <>
                        <div>
                          <small>Esperado</small>
                          <strong>{money(totalExpected)}</strong>
                        </div>

                        <div>
                          <small>Cobrado</small>
                          <strong>{money(totalPaid)}</strong>
                        </div>

                        <div>
                          <small>Pendiente</small>
                          <strong>{money(pendingAmount)}</strong>
                        </div>

                        <div>
                          <small>Gastos</small>
                          <strong>{money(expenses)}</strong>
                        </div>

                        <div>
                          <small>Comisión</small>
                          <strong>{money(commission)}</strong>
                        </div>

                        <div>
                          <small>Resultado</small>
                          <strong>{money(net)}</strong>
                        </div>
                      </>
                    ) : (
                      <div>
                        <small>Finanzas</small>
                        <strong>Información privada</strong>
                      </div>
                    )}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}