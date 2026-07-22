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
  event_date: string;
  start_time: string;
  status: string;
  community_id: string;
  venue_id: string;
  organizer_staff_id: string | null;
  organizer_name: string | null;
  commission_amount:
    | number
    | string
    | null;
  commission_status: string | null;
  commission_paid_at: string | null;
  court_cost:
    | number
    | string
    | null;
  other_expenses:
    | number
    | string
    | null;
};

type ParticipationRow = {
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

type StaffPermissions = {
  viewPayments?: boolean;
  editPayments?: boolean;
  managePayments?: boolean;
  viewFinances?: boolean;
  manageFinances?: boolean;
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
  can_view_payments?: boolean;
};

type CommissionGroup = {
  key: string;
  name: string;
  matches: number;
  accrued: number;
  paid: number;
  pending: number;
};

function numericAmount(
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
          String(value).replace(",", ".")
        );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function normalizePaymentStatus(
  status?: string | null
) {
  if (status === "pagado") {
    return "pagado";
  }

  if (
    status === "no_pago" ||
    status === "no_pagado"
  ) {
    return "no_pago";
  }

  return "pendiente";
}

function isPaymentResolved(
  row: ParticipationRow
) {
  const status =
    normalizePaymentStatus(
      row.payment_status
    );

  if (status === "no_pago") {
    return true;
  }

  if (status !== "pagado") {
    return false;
  }

  return (
    numericAmount(
      row.payment_amount
    ) >=
    numericAmount(
      row.payment_due_amount
    )
  );
}

function monthValue() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(
      now.getMonth() + 1
    ).padStart(2, "0"),
  ].join("-");
}

function monthBounds(month: string) {
  const [year, rawMonth] =
    month.split("-").map(Number);

  const start = `${year}-${String(
    rawMonth
  ).padStart(2, "0")}-01`;

  const nextMonth = new Date(
    year,
    rawMonth,
    1
  );

  const end = [
    nextMonth.getFullYear(),
    String(
      nextMonth.getMonth() + 1
    ).padStart(2, "0"),
    "01",
  ].join("-");

  return {
    start,
    end,
  };
}

function formatDate(value: string) {
  return new Date(
    `${value}T12:00:00`
  ).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
  });
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
    configure?: (
      query: any
    ) => any;
  }
) {
  let secureQuery: any =
    supabase
      .from(input.secureSource)
      .select(input.select);

  if (input.configure) {
    secureQuery =
      input.configure(
        secureQuery
      );
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

function profileCanViewFinances(
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
      ?.viewPayments === true ||
    profile.permissions
      ?.viewFinances === true ||
    profile.permissions
      ?.managePayments === true ||
    profile.permissions
      ?.manageFinances === true
  );
}

function profileCanManageFinances(
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

  return (
    profile.permissions
      ?.editPayments === true ||
    profile.permissions
      ?.managePayments === true ||
    profile.permissions
      ?.manageFinances === true
  );
}

export default function FinanzasPage() {
  const [month, setMonth] =
    useState(monthValue());

  const [accountId, setAccountId] =
    useState("");

  const [
    operatorName,
    setOperatorName,
  ] = useState("");

  const [events, setEvents] =
    useState<EventRow[]>([]);

  const [
    participations,
    setParticipations,
  ] =
    useState<ParticipationRow[]>(
      []
    );

  const [
    communities,
    setCommunities,
  ] =
    useState<SimpleRow[]>([]);

  const [venues, setVenues] =
    useState<SimpleRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [notice, setNotice] =
    useState("");

  const [allowed, setAllowed] =
    useState<boolean | null>(null);

  const [
    canManageFinances,
    setCanManageFinances,
  ] = useState(false);

  const [
    changingCommissionId,
    setChangingCommissionId,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    void loadAccess();
  }, []);

  useEffect(() => {
    if (
      allowed &&
      accountId &&
      month
    ) {
      void loadReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allowed,
    accountId,
    month,
  ]);

  async function loadAccess() {
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

      if (!profile.account_id) {
        throw new Error(
          "Tu sesión no está vinculada a una cuenta activa."
        );
      }

      const canView =
        profileCanViewFinances(
          profile
        );

      setAccountId(
        profile.account_id
      );

      setOperatorName(
        profile.full_name ??
          "Usuario"
      );

      setCanManageFinances(
        profileCanManageFinances(
          profile
        )
      );

      setAllowed(canView);

      if (!canView) {
        setLoading(false);
      }
    } catch (error: any) {
      setAllowed(false);
      setLoading(false);

      setNotice(
        `No se pudieron comprobar los permisos: ${
          error?.message ??
          "Error desconocido"
        }`
      );
    }
  }

  async function loadReport() {
    if (
      !accountId ||
      !month
    ) {
      return;
    }

    setLoading(true);
    setNotice("");

    try {
      const {
        start,
        end,
      } = monthBounds(month);

      const eventsRes =
        await secureSelectWithFallback(
          {
            secureSource:
              "ptm_events_secure_v1",

            fallbackSource:
              "events",

            select:
              "id, event_date, start_time, status, community_id, venue_id, organizer_staff_id, organizer_name, commission_amount, commission_status, commission_paid_at, court_cost, other_expenses",

            configure: (query) =>
              query
                .eq(
                  "account_id",
                  accountId
                )
                .gte(
                  "event_date",
                  start
                )
                .lt(
                  "event_date",
                  end
                )
                .order(
                  "event_date",
                  {
                    ascending: false,
                  }
                )
                .order(
                  "start_time",
                  {
                    ascending: false,
                  }
                ),
          }
        );

      const eventRows =
        (eventsRes.data ??
          []) as EventRow[];

      setEvents(eventRows);

      if (!eventRows.length) {
        setParticipations([]);
        setCommunities([]);
        setVenues([]);
        return;
      }

      const eventIds =
        eventRows.map(
          (event) => event.id
        );

      const activeRows =
        eventRows.filter(
          (event) =>
            event.status !==
            "cancelado"
        );

      const communityIds =
        Array.from(
          new Set(
            activeRows.map(
              (event) =>
                event.community_id
            )
          )
        );

      const venueIds =
        Array.from(
          new Set(
            activeRows.map(
              (event) =>
                event.venue_id
            )
          )
        );

      const [
        participationsRes,
        communitiesRes,
        venuesRes,
      ] = await Promise.all([
        secureSelectWithFallback({
          secureSource:
            "ptm_participations_secure_v1",

          fallbackSource:
            "participations",

          select:
            "event_id, status, payment_status, payment_amount, payment_due_amount",

          configure: (query) =>
            query.in(
              "event_id",
              eventIds
            ),
        }),

        communityIds.length
          ? supabase
              .from(
                "communities"
              )
              .select(
                "id, name"
              )
              .eq(
                "account_id",
                accountId
              )
              .in(
                "id",
                communityIds
              )
          : Promise.resolve({
              data: [],
              error: null,
            }),

        venueIds.length
          ? secureSelectWithFallback({
              secureSource:
                "ptm_venues_secure_v1",

              fallbackSource:
                "venues",

              select:
                "id, name",

              configure: (
                query
              ) =>
                query
                  .eq(
                    "account_id",
                    accountId
                  )
                  .in(
                    "id",
                    venueIds
                  ),
            })
          : Promise.resolve({
              data: [],
              error: null,
            }),
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

      setCommunities(
        (communitiesRes.data ??
          []) as SimpleRow[]
      );

      setVenues(
        (venuesRes.data ??
          []) as SimpleRow[]
      );
    } catch (error: any) {
      setEvents([]);
      setParticipations([]);
      setCommunities([]);
      setVenues([]);

      setNotice(
        `No se pudo cargar el informe financiero: ${
          error?.message ??
          "Error desconocido"
        }`
      );
    } finally {
      setLoading(false);
    }
  }

  const eventById = useMemo(
    () =>
      new Map(
        events.map((event) => [
          event.id,
          event,
        ])
      ),
    [events]
  );

  const communityById =
    useMemo(
      () =>
        new Map(
          communities.map(
            (community) => [
              community.id,
              community.name,
            ]
          )
        ),
      [communities]
    );

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

  const report = useMemo(() => {
    const validEvents =
      events.filter(
        (event) =>
          event.status !==
          "cancelado"
      );

    const completedEvents =
      validEvents.filter(
        (event) =>
          event.status ===
            "jugado" ||
          event.status ===
            "cerrado"
      );

    let expected = 0;
    let collected = 0;
    let pending = 0;
    let acceptedNotPaid = 0;

    for (
      const row of participations
    ) {
      const event =
        eventById.get(
          row.event_id
        );

      if (
        !event ||
        event.status ===
          "cancelado" ||
        row.status !==
          "confirmado"
      ) {
        continue;
      }

      const due =
        numericAmount(
          row.payment_due_amount
        );

      const paid =
        numericAmount(
          row.payment_amount
        );

      expected += due;
      collected += paid;

      const status =
        normalizePaymentStatus(
          row.payment_status
        );

      if (
        status === "no_pago"
      ) {
        acceptedNotPaid +=
          Math.max(
            due - paid,
            0
          );
      } else if (
        !isPaymentResolved(row)
      ) {
        pending += Math.max(
          due - paid,
          0
        );
      }
    }

    const courtExpenses =
      completedEvents.reduce(
        (sum, event) =>
          sum +
          numericAmount(
            event.court_cost
          ),
        0
      );

    const otherExpenses =
      completedEvents.reduce(
        (sum, event) =>
          sum +
          numericAmount(
            event.other_expenses
          ),
        0
      );

    const commissions =
      completedEvents.reduce(
        (sum, event) =>
          sum +
          numericAmount(
            event.commission_amount
          ),
        0
      );

    const commissionsPaid =
      completedEvents.reduce(
        (sum, event) =>
          sum +
          (
            event.commission_status ===
            "pagada"
              ? numericAmount(
                  event.commission_amount
                )
              : 0
          ),
        0
      );

    return {
      matches: validEvents.length,

      played:
        completedEvents.length,

      expected,

      collected,

      pending,

      acceptedNotPaid,

      courtExpenses,

      otherExpenses,

      commissions,

      commissionsPaid,

      commissionsPending:
        Math.max(
          commissions -
            commissionsPaid,
          0
        ),

      net:
        collected -
        courtExpenses -
        otherExpenses -
        commissions,
    };
  }, [
    events,
    participations,
    eventById,
  ]);

  const commissionGroups =
    useMemo<
      CommissionGroup[]
    >(() => {
      const map = new Map<
        string,
        CommissionGroup
      >();

      for (const event of events) {
        if (
          event.status !==
            "jugado" &&
          event.status !==
            "cerrado"
        ) {
          continue;
        }

        const amount =
          numericAmount(
            event.commission_amount
          );

        if (amount <= 0) {
          continue;
        }

        const key =
          event.organizer_staff_id ||
          event.organizer_name ||
          "sin-asignar";

        const name =
          event.organizer_name ||
          "Sin usuario asignado";

        const current =
          map.get(key) ?? {
            key,
            name,
            matches: 0,
            accrued: 0,
            paid: 0,
            pending: 0,
          };

        current.matches += 1;
        current.accrued +=
          amount;

        if (
          event.commission_status ===
          "pagada"
        ) {
          current.paid +=
            amount;
        } else {
          current.pending +=
            amount;
        }

        map.set(key, current);
      }

      return Array.from(
        map.values()
      ).sort(
        (left, right) =>
          right.accrued -
          left.accrued
      );
    }, [events]);

  async function setCommissionStatus(
    event: EventRow,
    status:
      | "pendiente"
      | "pagada"
  ) {
    if (!canManageFinances) {
      setNotice(
        "Tu usuario puede ver finanzas, pero no tiene permiso para cambiar comisiones."
      );
      return;
    }

    if (!accountId) {
      setNotice(
        "No se encontró la cuenta de la sesión."
      );
      return;
    }

    const confirmation =
      window.confirm(
        status === "pagada"
          ? `¿Marcar como pagada la comisión de ${money(
              numericAmount(
                event.commission_amount
              )
            )}?`
          : "¿Volver a marcar esta comisión como pendiente?"
      );

    if (!confirmation) {
      return;
    }

    setChangingCommissionId(
      event.id
    );

    setNotice("");

    try {
      const { error } =
        await supabase.rpc(
          "ptm_set_event_commission_status_v1",
          {
            p_account_id:
              accountId,

            p_event_id:
              event.id,

            p_status:
              status,

            p_operator_name:
              operatorName ||
              "Usuario",
          }
        );

      if (error) {
        throw error;
      }

      await loadReport();

      setNotice(
        status === "pagada"
          ? "Comisión marcada como pagada."
          : "Comisión marcada nuevamente como pendiente."
      );
    } catch (error: any) {
      setNotice(
        `No se pudo cambiar la comisión: ${
          error?.message ??
          "Error desconocido"
        }`
      );
    } finally {
      setChangingCommissionId(
        null
      );
    }
  }

  if (allowed === null) {
    return (
      <PageHeader
        title="Finanzas"
        description="Comprobando permisos..."
      />
    );
  }

  if (!allowed) {
    return (
      <>
        <PageHeader
          title="Finanzas"
          description="Esta información es privada."
        />

        {notice ? (
          <div className="notice-banner">
            {notice}
          </div>
        ) : null}

        <div className="card">
          <h2>
            Acceso restringido
          </h2>

          <p>
            Tu usuario no tiene
            permiso para ver pagos,
            costos, comisiones ni
            informes financieros.
          </p>

          <Link
            className="btn secondary"
            href="/"
          >
            Volver al Inicio
          </Link>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <PageHeader
        title="Finanzas"
        description="Preparando el informe..."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Finanzas"
        description="Informe privado para dueños, administradores y usuarios autorizados."
        action={
          <button
            className="btn secondary"
            onClick={() =>
              void loadReport()
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

      <div
        className="card compact-card"
        style={{
          marginBottom: 16,
        }}
      >
        <div className="grid grid-2">
          <label>
            Mes del informe
            <input
              type="month"
              value={month}
              onChange={(event) =>
                setMonth(
                  event.target
                    .value ||
                    monthValue()
                )
              }
            />
          </label>

          <div>
            <p className="help-text">
              Usuario de la sesión
            </p>

            <strong>
              {operatorName ||
                "Usuario"}
            </strong>

            <div
              className="row-actions"
              style={{
                marginTop: 8,
              }}
            >
              <span className="badge good">
                Finanzas autorizadas
              </span>

              <span
                className={`badge ${
                  canManageFinances
                    ? "good"
                    : "neutral"
                }`}
              >
                {canManageFinances
                  ? "Puede administrar"
                  : "Solo lectura"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="finance-kpi-grid">
        <div className="finance-kpi">
          <span>🎾</span>

          <div>
            <strong>
              {report.matches}
            </strong>

            <small>
              Partidos programados
            </small>
          </div>
        </div>

        <div className="finance-kpi">
          <span>✅</span>

          <div>
            <strong>
              {report.played}
            </strong>

            <small>
              Jugados o cerrados
            </small>
          </div>
        </div>

        <div className="finance-kpi">
          <span>💵</span>

          <div>
            <strong>
              {money(
                report.collected
              )}
            </strong>

            <small>
              Total cobrado
            </small>
          </div>
        </div>

        <div className="finance-kpi">
          <span>⏳</span>

          <div>
            <strong>
              {money(
                report.pending
              )}
            </strong>

            <small>
              Pendiente por cobrar
            </small>
          </div>
        </div>

        <div className="finance-kpi">
          <span>🏟️</span>

          <div>
            <strong>
              {money(
                report.courtExpenses
              )}
            </strong>

            <small>
              Costos de cancha
            </small>
          </div>
        </div>

        <div className="finance-kpi">
          <span>🧑‍💼</span>

          <div>
            <strong>
              {money(
                report.commissions
              )}
            </strong>

            <small>
              Comisiones
            </small>
          </div>
        </div>

        <div className="finance-kpi">
          <span>📉</span>

          <div>
            <strong>
              {money(
                report.acceptedNotPaid
              )}
            </strong>

            <small>
              No cobrado aceptado
            </small>
          </div>
        </div>

        <div
          className={`finance-kpi ${
            report.net >= 0
              ? "positive"
              : "negative"
          }`}
        >
          <span>📊</span>

          <div>
            <strong>
              {money(report.net)}
            </strong>

            <small>
              Resultado aproximado
            </small>
          </div>
        </div>
      </div>

      <div className="dashboard-columns">
        <section className="card">
          <div className="section-title-row">
            <h2>
              Comisiones por usuario
            </h2>

            <span className="badge neutral">
              {
                commissionGroups.length
              }
            </span>
          </div>

          {!commissionGroups.length ? (
            <div className="empty-compact">
              <span>🧑‍💼</span>

              <strong>
                No hay comisiones en
                este mes
              </strong>
            </div>
          ) : (
            <div className="commission-list">
              {commissionGroups.map(
                (group) => (
                  <div
                    className="commission-row"
                    key={group.key}
                  >
                    <div>
                      <strong>
                        {group.name}
                      </strong>

                      <small>
                        {group.matches}{" "}
                        partido(s)
                      </small>
                    </div>

                    <div>
                      <small>
                        Ganado
                      </small>

                      <strong>
                        {money(
                          group.accrued
                        )}
                      </strong>
                    </div>

                    <div>
                      <small>
                        Pagado
                      </small>

                      <strong>
                        {money(
                          group.paid
                        )}
                      </strong>
                    </div>

                    <div>
                      <small>
                        Pendiente
                      </small>

                      <strong>
                        {money(
                          group.pending
                        )}
                      </strong>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-title-row">
            <h2>
              Resumen de cobros
            </h2>
          </div>

          <div className="finance-summary-list">
            <div>
              <span>
                Total esperado
              </span>

              <strong>
                {money(
                  report.expected
                )}
              </strong>
            </div>

            <div>
              <span>
                Total cobrado
              </span>

              <strong>
                {money(
                  report.collected
                )}
              </strong>
            </div>

            <div>
              <span>
                Pendiente operativo
              </span>

              <strong>
                {money(
                  report.pending
                )}
              </strong>
            </div>

            <div>
              <span>
                No cobrado aceptado
              </span>

              <strong>
                {money(
                  report.acceptedNotPaid
                )}
              </strong>
            </div>

            <div>
              <span>
                Costos de cancha
              </span>

              <strong>
                {money(
                  report.courtExpenses
                )}
              </strong>
            </div>

            <div>
              <span>
                Otros gastos
              </span>

              <strong>
                {money(
                  report.otherExpenses
                )}
              </strong>
            </div>

            <div>
              <span>
                Comisiones pagadas
              </span>

              <strong>
                {money(
                  report.commissionsPaid
                )}
              </strong>
            </div>

            <div>
              <span>
                Comisiones pendientes
              </span>

              <strong>
                {money(
                  report.commissionsPending
                )}
              </strong>
            </div>
          </div>
        </section>
      </div>

      <section
        className="card"
        style={{
          marginTop: 16,
        }}
      >
        <div className="section-title-row">
          <h2>
            Partidos y comisiones
          </h2>

          <span className="badge neutral">
            {events.length}
          </span>
        </div>

        {!events.length ? (
          <div className="empty-compact">
            <span>📅</span>

            <strong>
              No hay partidos
              registrados en este mes
            </strong>
          </div>
        ) : (
          <div className="finance-event-list">
            {events.map(
              (event) => {
                const commission =
                  numericAmount(
                    event.commission_amount
                  );

                const isCompleted =
                  event.status ===
                    "jugado" ||
                  event.status ===
                    "cerrado";

                const isEligible =
                  isCompleted &&
                  commission > 0;

                const isCanceled =
                  event.status ===
                  "cancelado";

                return (
                  <div
                    className="finance-event-row"
                    key={event.id}
                  >
                    <div>
                      <strong>
                        {formatDate(
                          event.event_date
                        )}
                        {" · "}
                        {event.start_time.slice(
                          0,
                          5
                        )}
                      </strong>

                      <small>
                        {communityById.get(
                          event.community_id
                        ) ??
                          "Comunidad"}
                        {" · "}
                        {venueById.get(
                          event.venue_id
                        ) ?? "Sede"}
                      </small>
                    </div>

                    <div>
                      <small>
                        Organizó
                      </small>

                      <strong>
                        {event.organizer_name ??
                          "Sin asignar"}
                      </strong>
                    </div>

                    <div>
                      <small>
                        Comisión
                      </small>

                      <strong>
                        {money(
                          commission
                        )}
                      </strong>

                      {event.commission_status ===
                      "pagada" ? (
                        <small>
                          Pagada
                          {event.commission_paid_at
                            ? ` · ${new Date(
                                event.commission_paid_at
                              ).toLocaleDateString(
                                "es-EC"
                              )}`
                            : ""}
                        </small>
                      ) : null}
                    </div>

                    <div className="row-actions">
                      {isCanceled ? (
                        <span className="badge danger">
                          Cancelado
                        </span>
                      ) : isEligible ? (
                        event.commission_status ===
                        "pagada" ? (
                          canManageFinances ? (
                            <button
                              className="btn deactivate"
                              disabled={
                                changingCommissionId ===
                                event.id
                              }
                              onClick={() =>
                                void setCommissionStatus(
                                  event,
                                  "pendiente"
                                )
                              }
                            >
                              {changingCommissionId ===
                              event.id
                                ? "Guardando..."
                                : "Pagada ✓"}
                            </button>
                          ) : (
                            <span className="badge good">
                              Pagada ✓
                            </span>
                          )
                        ) : canManageFinances ? (
                          <button
                            className="btn save"
                            disabled={
                              changingCommissionId ===
                              event.id
                            }
                            onClick={() =>
                              void setCommissionStatus(
                                event,
                                "pagada"
                              )
                            }
                          >
                            {changingCommissionId ===
                            event.id
                              ? "Guardando..."
                              : "Marcar pagada"}
                          </button>
                        ) : (
                          <span className="badge warn">
                            Pendiente
                          </span>
                        )
                      ) : commission > 0 ? (
                        <span className="badge warn">
                          Se habilita al
                          jugar
                        </span>
                      ) : (
                        <span className="badge neutral">
                          Sin comisión
                        </span>
                      )}

                      <Link
                        className="btn edit"
                        href={`/eventos/${event.id}`}
                      >
                        Abrir
                      </Link>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>
    </>
  );
}