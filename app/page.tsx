"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabaseClient";

type EventRow = {
  id: string;
  account_id: string;
  community_id: string;
  venue_id: string;
  event_date: string;
  start_time: string;
  players_needed: number;
  category: string;
  status: string;
  court_reservation_status: string | null;
};

type ParticipationRow = {
  account_id: string;
  event_id: string;
  status: string;
  payment_status: string | null;
  payment_amount:
    | number
    | string
    | null;
  payment_due_amount:
    | number
    | string
    | null;
};

type SimpleRow = {
  id: string;
  name: string;
};

type RequestRow = {
  id: string;
  status: string | null;
};

type PlayerCategoryRow = {
  id: string;
  active: boolean | null;
  validated_category: string | null;
};

type AlertRow = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  level:
    | "danger"
    | "warn"
    | "good";
  href: string;
};

type StaffProfile = {
  id?: string;
  account_id?: string;
  full_name?: string;
  role?: string;
  active?: boolean;
  auth_status?: string;
  permissions?: Record<
    string,
    boolean
  >;
  can_view_payments?: boolean;
};

function numberValue(
  value:
    | number
    | string
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(
          String(value).replace(
            ",",
            "."
          )
        );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function categoryLabel(
  category?: string | null
) {
  const labels: Record<
    string,
    string
  > = {
    C1: "Primera",
    C2: "Segunda",
    C3: "Tercera",
    C4: "Cuarta",
    C5: "Quinta",
    C6: "Sexta",
    C7: "Novatos",
  };

  return (
    labels[category ?? ""] ??
    category ??
    "Por categorizar"
  );
}

function isRealCategory(
  value?: string | null
) {
  return [
    "C1",
    "C2",
    "C3",
    "C4",
    "C5",
    "C6",
    "C7",
  ].includes(value ?? "");
}

function dateOnly(value: string) {
  return new Date(
    `${value}T12:00:00`
  );
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
    (dateOnly(
      event.event_date
    ).getTime() -
      todayOnly().getTime()) /
      86400000
  );
}

function formatDate(value: string) {
  return dateOnly(
    value
  ).toLocaleDateString("es-EC", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function isActiveEvent(
  event: EventRow
) {
  return (
    event.status !== "cancelado" &&
    event.status !== "cerrado"
  );
}

function normalizeDashboardPaymentStatus(
  value?: string | null
) {
  if (value === "pagado") {
    return "pagado";
  }

  if (
    value === "no_pago" ||
    value === "no_pagado"
  ) {
    return "no_pago";
  }

  return "pendiente";
}

function dashboardPaymentResolved(
  row: ParticipationRow
) {
  const status =
    normalizeDashboardPaymentStatus(
      row.payment_status
    );

  if (status === "no_pago") {
    return true;
  }

  if (status !== "pagado") {
    return false;
  }

  return (
    numberValue(
      row.payment_amount
    ) >=
    numberValue(
      row.payment_due_amount
    )
  );
}

function reservationStatus(
  value?: string | null
) {
  if (value === "reservada") {
    return "reservada";
  }

  if (value === "no_disponible") {
    return "no_disponible";
  }

  if (value === "cancelada") {
    return "cancelada";
  }

  return "pendiente_reservar";
}

function normalizeRpcObject(
  value: unknown
): Record<string, any> {
  if (
    Array.isArray(value) &&
    value.length
  ) {
    const first = value[0];

    if (
      first &&
      typeof first === "object"
    ) {
      return first as Record<
        string,
        any
      >;
    }
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return value as Record<
      string,
      any
    >;
  }

  return {};
}

function isMissingSecurityObject(
  error: any
) {
  const code = String(
    error?.code ?? ""
  ).toUpperCase();

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
    message.includes(
      "does not exist"
    ) ||
    message.includes(
      "could not find the table"
    ) ||
    message.includes(
      "could not find the function"
    ) ||
    message.includes(
      "schema cache"
    )
  );
}

async function secureSelectWithFallback(
  input: {
    secureSource: string;
    fallbackSource: string;
    select: string;
    configure:
      | ((query: any) => any)
      | undefined;
  }
) {
  let secureQuery: any =
    supabase
      .from(input.secureSource)
      .select(input.select);

  if (input.configure) {
    secureQuery =
      input.configure(secureQuery);
  }

  const secureResult =
    await secureQuery;

  if (!secureResult.error) {
    return secureResult;
  }

  if (
    !isMissingSecurityObject(
      secureResult.error
    )
  ) {
    throw secureResult.error;
  }

  let fallbackQuery: any =
    supabase
      .from(input.fallbackSource)
      .select(input.select);

  if (input.configure) {
    fallbackQuery =
      input.configure(
        fallbackQuery
      );
  }

  const fallbackResult =
    await fallbackQuery;

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return fallbackResult;
}

function canProfileViewPayments(
  profile: StaffProfile
) {
  const role = String(
    profile.role ?? ""
  ).toLowerCase();

  if (
    role === "owner" ||
    role === "admin"
  ) {
    return true;
  }

  if (
    profile.can_view_payments ===
    true
  ) {
    return true;
  }

  return (
    profile.permissions
      ?.viewPayments === true
  );
}

export default function DashboardPage() {
  const [events, setEvents] =
    useState<EventRow[]>([]);

  const [
    participations,
    setParticipations,
  ] =
    useState<ParticipationRow[]>(
      []
    );

  const [venues, setVenues] =
    useState<SimpleRow[]>([]);

  const [
    communities,
    setCommunities,
  ] =
    useState<SimpleRow[]>([]);

  const [requests, setRequests] =
    useState<RequestRow[]>([]);

  const [
    pendingCategoryPlayers,
    setPendingCategoryPlayers,
  ] = useState(0);

  const [
    canViewPayments,
    setCanViewPayments,
  ] = useState(false);

  const [
    operatorName,
    setOperatorName,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [notice, setNotice] =
    useState("");

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setNotice("");

    try {
      const profileRes =
        await supabase.rpc(
          "ptm_current_staff_profile_v1"
        );

      if (profileRes.error) {
        throw profileRes.error;
      }

      const profile =
        normalizeRpcObject(
          profileRes.data
        ) as StaffProfile;

      const accountId =
        profile.account_id;

      if (!accountId) {
        throw new Error(
          "Tu sesión no está vinculada a una cuenta activa."
        );
      }

      const paymentsAllowed =
        canProfileViewPayments(
          profile
        );

      setCanViewPayments(
        paymentsAllowed
      );

      setOperatorName(
        profile.full_name ?? ""
      );

      const [
        eventsRes,
        requestsRes,
        playersCategoryRes,
      ] = await Promise.all([
        secureSelectWithFallback({
          secureSource:
            "ptm_events_secure_v1",
          fallbackSource:
            "events",
          select:
            "id, account_id, community_id, venue_id, event_date, start_time, players_needed, category, status, court_reservation_status",
          configure: (query) =>
            query
              .eq(
                "account_id",
                accountId
              )
              .order(
                "event_date",
                {
                  ascending: true,
                }
              )
              .limit(120),
        }),

        supabase
          .from(
            "player_requests_demo"
          )
          .select("id, status")
          .eq(
            "account_id",
            accountId
          ),

        supabase
          .from("players")
          .select(
            "id, active, validated_category"
          )
          .eq(
            "account_id",
            accountId
          ),
      ]);

      if (requestsRes.error) {
        throw requestsRes.error;
      }

      if (playersCategoryRes.error) {
        throw playersCategoryRes.error;
      }

      const playerRows =
        (playersCategoryRes.data ??
          []) as PlayerCategoryRow[];

      setPendingCategoryPlayers(
        playerRows.filter(
          (player) =>
            player.active !== false &&
            !isRealCategory(
              player.validated_category
            )
        ).length
      );

      const eventRows =
        (eventsRes.data ??
          []) as EventRow[];

      setEvents(eventRows);

      setRequests(
        (requestsRes.data ??
          []) as RequestRow[]
      );

      if (!eventRows.length) {
        setParticipations([]);
        setVenues([]);
        setCommunities([]);
        return;
      }

      const eventIds =
        eventRows.map(
          (row) => row.id
        );

      const venueIds =
        Array.from(
          new Set(
            eventRows.map(
              (row) => row.venue_id
            )
          )
        );

      const communityIds =
        Array.from(
          new Set(
            eventRows.map(
              (row) =>
                row.community_id
            )
          )
        );

      const [
        participationsRes,
        venuesRes,
        communitiesRes,
      ] = await Promise.all([
        secureSelectWithFallback({
          secureSource:
            "ptm_participations_secure_v1",
          fallbackSource:
            "participations",
          select:
            "account_id, event_id, status, payment_status, payment_amount, payment_due_amount",
          configure: (query) =>
            query
              .eq(
                "account_id",
                accountId
              )
              .in(
                "event_id",
                eventIds
              ),
        }),

        secureSelectWithFallback({
          secureSource:
            "ptm_venues_secure_v1",
          fallbackSource:
            "venues",
          select: "id, name",
          configure: (query) =>
            query
              .eq(
                "account_id",
                accountId
              )
              .in(
                "id",
                venueIds
              ),
        }),

        supabase
          .from("communities")
          .select("id, name")
          .eq(
            "account_id",
            accountId
          )
          .in(
            "id",
            communityIds
          ),
      ]);

      if (
        communitiesRes.error
      ) {
        throw communitiesRes.error;
      }

      setParticipations(
        (participationsRes.data ??
          []) as ParticipationRow[]
      );

      setVenues(
        (venuesRes.data ??
          []) as SimpleRow[]
      );

      setCommunities(
        (communitiesRes.data ??
          []) as SimpleRow[]
      );
    } catch (error: any) {
      setNotice(
        `No se pudo cargar el inicio: ${
          error?.message ??
          "Error desconocido"
        }`
      );

      setEvents([]);
      setParticipations([]);
      setVenues([]);
      setCommunities([]);
      setRequests([]);
      setPendingCategoryPlayers(0);
    } finally {
      setLoading(false);
    }
  }

  const venueById = useMemo(
    () =>
      new Map(
        venues.map((venue) => [
          venue.id,
          venue.name,
        ])
      ),
    [venues]
  );

  const communityById =
    useMemo(
      () =>
        new Map(
          communities.map(
            (row) => [
              row.id,
              row.name,
            ]
          )
        ),
      [communities]
    );

  const participationsByEvent =
    useMemo(() => {
      const map = new Map<
        string,
        ParticipationRow[]
      >();

      for (const row of participations) {
        const current =
          map.get(row.event_id) ??
          [];

        current.push(row);

        map.set(
          row.event_id,
          current
        );
      }

      return map;
    }, [participations]);

  const activeEvents = useMemo(
    () =>
      events
        .filter(isActiveEvent)
        .sort((a, b) => {
          const left = new Date(
            `${a.event_date}T${a.start_time}`
          ).getTime();

          const right = new Date(
            `${b.event_date}T${b.start_time}`
          ).getTime();

          return left - right;
        }),
    [events]
  );

  const activeUpcoming =
    useMemo(
      () =>
        activeEvents.filter(
          (event) =>
            diffDays(event) >= 0
        ),
      [activeEvents]
    );

  const activePast = useMemo(
    () =>
      activeEvents.filter(
        (event) =>
          diffDays(event) < 0
      ),
    [activeEvents]
  );

  const metrics = useMemo(() => {
    let missingSlots = 0;
    let courtsPending = 0;
    let pendingPaymentPeople = 0;
    let pendingPaymentAmount = 0;
    let readyToClose = 0;
    let collectedThisMonth = 0;

    for (const event of activeEvents) {
      const rows =
        participationsByEvent.get(
          event.id
        ) ?? [];

      const confirmed =
        rows.filter(
          (row) =>
            row.status ===
            "confirmado"
        );

      const missing = Math.max(
        Number(
          event.players_needed ?? 0
        ) - confirmed.length,
        0
      );

      if (diffDays(event) >= 0) {
        missingSlots += missing;

        if (
          missing === 0 &&
          reservationStatus(
            event.court_reservation_status
          ) ===
            "pendiente_reservar"
        ) {
          courtsPending += 1;
        }
      }

      if (canViewPayments) {
        let eventPendingMoney = 0;

        for (const row of confirmed) {
          const due =
            numberValue(
              row.payment_due_amount
            );

          const paid =
            numberValue(
              row.payment_amount
            );

          const missingMoney =
            Math.max(
              due - paid,
              0
            );

          if (
            !dashboardPaymentResolved(
              row
            )
          ) {
            pendingPaymentPeople +=
              1;

            pendingPaymentAmount +=
              missingMoney;

            eventPendingMoney +=
              missingMoney;
          }
        }

        if (
          diffDays(event) < 0 &&
          eventPendingMoney === 0
        ) {
          readyToClose += 1;
        }
      }
    }

    if (canViewPayments) {
      const now = new Date();

      const currentYear =
        now.getFullYear();

      const currentMonth =
        now.getMonth();

      for (const event of events) {
        if (
          event.status ===
          "cancelado"
        ) {
          continue;
        }

        const eventDate =
          new Date(
            `${event.event_date}T12:00:00`
          );

        if (
          eventDate.getFullYear() !==
            currentYear ||
          eventDate.getMonth() !==
            currentMonth
        ) {
          continue;
        }

        const rows =
          participationsByEvent.get(
            event.id
          ) ?? [];

        collectedThisMonth +=
          rows
            .filter(
              (row) =>
                row.status ===
                "confirmado"
            )
            .reduce(
              (sum, row) =>
                sum +
                numberValue(
                  row.payment_amount
                ),
              0
            );
      }
    }

    return {
      todayMatches:
        activeUpcoming.filter(
          (event) =>
            diffDays(event) === 0
        ).length,

      upcomingMatches:
        activeUpcoming.length,

      openPastMatches:
        activePast.length,

      readyToClose,

      missingSlots,

      courtsPending,

      pendingPaymentPeople,

      pendingPaymentAmount,

      collectedThisMonth,

      pendingRequests:
        requests.filter(
          (request) =>
            request.status ===
            "pendiente"
        ).length,

      pendingCategoryPlayers,
    };
  }, [
    events,
    activeEvents,
    activeUpcoming,
    activePast,
    participationsByEvent,
    requests,
    canViewPayments,
    pendingCategoryPlayers,
  ]);

  const alerts =
    useMemo<AlertRow[]>(() => {
      const rows: AlertRow[] =
        [];

      for (const event of activeEvents) {
        const eventRows =
          participationsByEvent.get(
            event.id
          ) ?? [];

        const confirmed =
          eventRows.filter(
            (row) =>
              row.status ===
              "confirmado"
          );

        const missing =
          Math.max(
            Number(
              event.players_needed ??
                0
            ) - confirmed.length,
            0
          );

        const venue =
          venueById.get(
            event.venue_id
          ) ?? "Sede";

        const community =
          communityById.get(
            event.community_id
          ) ?? "Comunidad";

        const smallDetail =
          `${community} · ${venue} · ` +
          `${formatDate(
            event.event_date
          )} ` +
          `${formatTime(
            event.start_time
          )}`;

        const reservation =
          reservationStatus(
            event.court_reservation_status
          );

        const eventMissingMoney =
          canViewPayments
            ? confirmed.reduce(
                (sum, row) => {
                  if (
                    dashboardPaymentResolved(
                      row
                    )
                  ) {
                    return sum;
                  }

                  const due =
                    numberValue(
                      row.payment_due_amount
                    );

                  const paid =
                    numberValue(
                      row.payment_amount
                    );

                  return (
                    sum +
                    Math.max(
                      due - paid,
                      0
                    )
                  );
                },
                0
              )
            : 0;

        if (diffDays(event) < 0) {
          if (!canViewPayments) {
            rows.push({
              id:
                `${event.id}-past-review`,
              icon: "🕒",
              title:
                "Partido pasado · revisar estado",
              detail: smallDetail,
              level: "warn",
              href:
                `/eventos/${event.id}`,
            });

            continue;
          }

          if (
            eventMissingMoney > 0
          ) {
            rows.push({
              id:
                `${event.id}-past-payment`,
              icon: "💵",
              title:
                `Partido jugado · falta cobrar ` +
                `${money(
                  eventMissingMoney
                )}`,
              detail: smallDetail,
              level: "warn",
              href:
                `/eventos/${event.id}`,
            });
          } else {
            rows.push({
              id:
                `${event.id}-ready-close`,
              icon: "✅",
              title:
                "Todos los cobros están resueltos · listo para cerrar",
              detail: smallDetail,
              level: "good",
              href:
                `/eventos/${event.id}`,
            });
          }

          continue;
        }

        if (
          reservation ===
            "no_disponible" ||
          reservation ===
            "cancelada"
        ) {
          rows.push({
            id:
              `${event.id}-court-problem`,
            icon: "🚨",
            title:
              "Problema con la cancha",
            detail: smallDetail,
            level: "danger",
            href:
              `/eventos/${event.id}`,
          });
        }

        if (
          missing === 0 &&
          reservation ===
            "pendiente_reservar"
        ) {
          rows.push({
            id:
              `${event.id}-court`,
            icon: "🏟️",
            title:
              "Partido lleno sin cancha",
            detail: smallDetail,
            level:
              diffDays(event) <= 1
                ? "danger"
                : "warn",
            href:
              `/eventos/${event.id}`,
          });
        }

        if (
          missing > 0 &&
          diffDays(event) <= 1
        ) {
          rows.push({
            id:
              `${event.id}-players`,
            icon: "👥",
            title:
              `Faltan ${missing} jugador(es)`,
            detail: smallDetail,
            level: "warn",
            href:
              `/eventos/${event.id}`,
          });
        }

        if (
          canViewPayments &&
          eventMissingMoney > 0 &&
          diffDays(event) <= 1
        ) {
          rows.push({
            id:
              `${event.id}-payment`,
            icon: "💵",
            title:
              `Falta cobrar ` +
              `${money(
                eventMissingMoney
              )}`,
            detail: smallDetail,
            level: "warn",
            href:
              `/eventos/${event.id}`,
          });
        }
      }

      if (
        metrics.pendingRequests > 0
      ) {
        rows.push({
          id: "requests",
          icon: "📥",
          title:
            `${metrics.pendingRequests} ` +
            `solicitud(es) nueva(s)`,
          detail:
            "Jugadores esperando revisión.",
          level: "warn",
          href: "/solicitudes",
        });
      }

      if (
        metrics.pendingCategoryPlayers > 0
      ) {
        rows.push({
          id: "players-without-category",
          icon: "🏷️",
          title:
            `${metrics.pendingCategoryPlayers} ` +
            `jugador(es) por categorizar`,
          detail:
            "Personas ingresadas sin categoría. Hay que revisar antes de invitarlas.",
          level: "warn",
          href:
            "/jugadores?categoria=por_categorizar",
        });
      }

      const order = {
        danger: 0,
        warn: 1,
        good: 2,
      };

      return rows
        .sort(
          (a, b) =>
            order[a.level] -
            order[b.level]
        )
        .slice(0, 8);
    }, [
      activeEvents,
      participationsByEvent,
      venueById,
      communityById,
      metrics.pendingRequests,
      metrics.pendingCategoryPlayers,
      canViewPayments,
    ]);

  const nextEvent =
    activeUpcoming[0] ?? null;

  if (loading) {
    return (
      <PageHeader
        title="Inicio"
        description="Cargando lo importante..."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Inicio"
        description={
          operatorName
            ? `Hola, ${operatorName}. Lo urgente primero.`
            : "Lo urgente primero."
        }
        action={
          <button
            className="btn secondary"
            onClick={() =>
              void loadDashboard()
            }
          >
            🔄 Actualizar
          </button>
        }
      />

      {notice ? (
        <div className="notice-banner">
          {notice}
        </div>
      ) : null}

      <div className="dashboard-kpi-grid">
        <Link
          className="dashboard-kpi"
          href="/eventos"
        >
          <span>🎾</span>

          <div>
            <strong>
              {metrics.todayMatches}
            </strong>

            <small>
              Partidos hoy
            </small>
          </div>
        </Link>

        <Link
          className="dashboard-kpi"
          href="/llenar-canchas"
        >
          <span>👥</span>

          <div>
            <strong>
              {metrics.missingSlots}
            </strong>

            <small>
              Cupos por llenar
            </small>
          </div>
        </Link>

        <Link
          className="dashboard-kpi"
          href="/jugadores?categoria=por_categorizar"
        >
          <span>🏷️</span>

          <div>
            <strong>
              {
                metrics.pendingCategoryPlayers
              }
            </strong>

            <small>
              Por categorizar
            </small>
          </div>
        </Link>

        {canViewPayments ? (
          <Link
            className="dashboard-kpi"
            href="/eventos"
          >
            <span>💵</span>

            <div>
              <strong>
                {
                  metrics.pendingPaymentPeople
                }
              </strong>

              <small>
                Por cobrar ·{" "}
                {money(
                  metrics.pendingPaymentAmount
                )}
              </small>
            </div>
          </Link>
        ) : (
          <div className="dashboard-kpi">
            <span>🔒</span>

            <div>
              <strong>Privado</strong>

              <small>
                Información financiera
              </small>
            </div>
          </div>
        )}

        <Link
          className="dashboard-kpi"
          href="/eventos"
        >
          <span>🏟️</span>

          <div>
            <strong>
              {metrics.courtsPending}
            </strong>

            <small>
              Canchas pendientes
            </small>
          </div>
        </Link>

        <Link
          className="dashboard-kpi"
          href="/solicitudes"
        >
          <span>📥</span>

          <div>
            <strong>
              {metrics.pendingRequests}
            </strong>

            <small>
              Solicitudes nuevas
            </small>
          </div>
        </Link>

        {canViewPayments ? (
          <Link
            className="dashboard-kpi"
            href="/finanzas"
          >
            <span>💰</span>

            <div>
              <strong>
                {money(
                  metrics.collectedThisMonth
                )}
              </strong>

              <small>
                Cobrado este mes
              </small>
            </div>
          </Link>
        ) : null}
      </div>

      <div className="dashboard-action-row">
        <Link
          className="btn save"
          href="/llenar-canchas"
        >
          🎾 Crear partido
        </Link>

        <Link
          className="btn edit"
          href="/eventos"
        >
          📋 Ver partidos
        </Link>

        <Link
          className="btn secondary"
          href="/jugadores"
        >
          👥 Jugadores
        </Link>

        <Link
          className="btn secondary"
          href="/jugadores?categoria=por_categorizar"
        >
          🏷️ Por categorizar
        </Link>

        <Link
          className="btn secondary"
          href="/solicitudes"
        >
          📥 Solicitudes
        </Link>

        {canViewPayments ? (
          <Link
            className="btn secondary"
            href="/finanzas"
          >
            💰 Finanzas
          </Link>
        ) : null}
      </div>

      <div className="dashboard-status-strip">
        {canViewPayments ? (
          <span className="badge good">
            {metrics.readyToClose}{" "}
            listo(s) para cerrar
          </span>
        ) : null}

        <span className="badge warn">
          {
            metrics.openPastMatches
          }{" "}
          partido(s) pasado(s)
          todavía abierto(s)
        </span>

        {metrics.pendingCategoryPlayers > 0 ? (
          <span className="badge warn">
            {
              metrics.pendingCategoryPlayers
            }{" "}
            jugador(es) sin categoría
          </span>
        ) : null}

        <span className="help-text">
          Un partido desaparece de
          las alertas cuando se marca
          Cerrado o Cancelado.
          {canViewPayments
            ? " Si ya pasó y todos los cobros están resueltos, queda como listo para cerrar."
            : " Los cobros solo son visibles para usuarios autorizados."}
        </span>
      </div>

      <div className="dashboard-columns">
        <section className="card compact-card">
          <div className="section-title-row">
            <h2>Próximo partido</h2>

            <span className="badge neutral">
              {
                metrics.upcomingMatches
              }{" "}
              próximos
            </span>
          </div>

          {!nextEvent ? (
            <div className="empty-compact">
              <span>🎾</span>

              <strong>
                No hay partidos próximos
              </strong>

              <Link
                className="btn save"
                href="/llenar-canchas"
              >
                Crear el primero
              </Link>
            </div>
          ) : (
            <div className="next-match-card">
              <div className="next-match-date">
                <strong>
                  {formatTime(
                    nextEvent.start_time
                  )}
                </strong>

                <small>
                  {formatDate(
                    nextEvent.event_date
                  )}
                </small>
              </div>

              <div className="next-match-copy">
                <strong>
                  {communityById.get(
                    nextEvent.community_id
                  ) ?? "Comunidad"}
                </strong>

                <span>
                  {venueById.get(
                    nextEvent.venue_id
                  ) ?? "Sede"}{" "}
                  ·{" "}
                  {categoryLabel(
                    nextEvent.category
                  )}
                </span>

                {(() => {
                  const rows =
                    participationsByEvent.get(
                      nextEvent.id
                    ) ?? [];

                  const confirmed =
                    rows.filter(
                      (row) =>
                        row.status ===
                        "confirmado"
                    ).length;

                  const missing =
                    Math.max(
                      Number(
                        nextEvent.players_needed ??
                          0
                      ) - confirmed,
                      0
                    );

                  return (
                    <div className="row-actions">
                      <span
                        className={`badge ${
                          missing > 0
                            ? "warn"
                            : "good"
                        }`}
                      >
                        {confirmed}/
                        {
                          nextEvent.players_needed
                        }
                      </span>

                      <span
                        className={`badge ${
                          reservationStatus(
                            nextEvent.court_reservation_status
                          ) ===
                          "reservada"
                            ? "good"
                            : "warn"
                        }`}
                      >
                        {reservationStatus(
                          nextEvent.court_reservation_status
                        ) ===
                        "reservada"
                          ? "Cancha lista"
                          : "Cancha pendiente"}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <Link
                className="btn edit"
                href={`/eventos/${nextEvent.id}`}
              >
                Abrir
              </Link>
            </div>
          )}
        </section>

        <section className="card compact-card">
          <div className="section-title-row">
            <h2>Alertas</h2>

            <span
              className={`badge ${
                alerts.length
                  ? "warn"
                  : "good"
              }`}
            >
              {alerts.length}
            </span>
          </div>

          {!alerts.length ? (
            <div className="empty-compact">
              <span>✅</span>

              <strong>
                Todo en orden
              </strong>
            </div>
          ) : (
            <div className="alert-list">
              {alerts.map(
                (alert) => (
                  <Link
                    className={`alert-row ${alert.level}`}
                    href={alert.href}
                    key={alert.id}
                  >
                    <span className="alert-icon">
                      {alert.icon}
                    </span>

                    <span className="alert-copy">
                      <strong>
                        {alert.title}
                      </strong>

                      <small>
                        {alert.detail}
                      </small>
                    </span>

                    <span>›</span>
                  </Link>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}