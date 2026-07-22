"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { PageHeader } from "@/components/PageHeader";
import { DEMO_ACCOUNT_ID } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";

type Category =
  | "C1"
  | "C2"
  | "C3"
  | "C4"
  | "C5"
  | "C6"
  | "C7";

type Gender =
  | "hombre"
  | "mujer";

type Side =
  | "drive"
  | "reves"
  | "cualquiera";

type RequestStatus =
  | "pendiente"
  | "contactado"
  | "convocado"
  | "convertido"
  | "descartado"
  | string;

type ParticipationStatus =
  | "ambiguo"
  | "confirmado"
  | "lista_espera";

type PlayerRequestRow = {
  id: string;
  full_name: string;
  whatsapp: string;
  email: string | null;
  category: string | null;
  preferred_venues:
    | string[]
    | null;
  preferred_days:
    | string[]
    | null;
  preferred_times:
    | string
    | null;
  message: string | null;
  status: RequestStatus;
  internal_notes: string | null;
  created_at: string;
  contacted_at: string | null;
  converted_at: string | null;
  converted_player_id:
    | string
    | null;
};

type CommunityRow = {
  id: string;
  name: string;
};

type VenueRow = {
  id: string;
  name: string;
};

type PlayerRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  whatsapp: string | null;
  gender: string | null;
  validated_category:
    | string
    | null;
  secondary_category:
    | string
    | null;
  preferred_side:
    | string
    | null;
  active: boolean | null;
  notes: string | null;
  availability_notes:
    | string
    | null;
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

type EventRow = {
  id: string;
  community_id:
    | string
    | null;
  venue_id: string | null;
  event_date: string | null;
  start_time: string | null;
  category: string | null;
  status: string | null;
  players_needed:
    | number
    | null;
  payment_default_amount:
    | number
    | string
    | null;
};

type AvailabilityDraft = {
  key: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type ConversionDraft = {
  gender: "" | Gender;
  primaryCategory: Category;
  secondaryCategory:
    | ""
    | Category;
  preferredSide: Side;
  communityIds: string[];
  availability:
    AvailabilityDraft[];
  playerNotes: string;
  availabilityNotes: string;
};

const FREE_ACTIVE_PLAYER_LIMIT = 50;

const CATEGORIES: Array<{
  value: Category;
  label: string;
}> = [
  {
    value: "C1",
    label: "Primera",
  },
  {
    value: "C2",
    label: "Segunda",
  },
  {
    value: "C3",
    label: "Tercera",
  },
  {
    value: "C4",
    label: "Cuarta",
  },
  {
    value: "C5",
    label: "Quinta",
  },
  {
    value: "C6",
    label: "Sexta",
  },
  {
    value: "C7",
    label: "Novatos",
  },
];

const DAYS = [
  {
    value: 1,
    label: "Lunes",
  },
  {
    value: 2,
    label: "Martes",
  },
  {
    value: 3,
    label: "Miércoles",
  },
  {
    value: 4,
    label: "Jueves",
  },
  {
    value: 5,
    label: "Viernes",
  },
  {
    value: 6,
    label: "Sábado",
  },
  {
    value: 7,
    label: "Domingo",
  },
];

function categoryLabel(
  value?: string | null
) {
  return (
    CATEGORIES.find(
      (item) =>
        item.value === value
    )?.label ??
    value ??
    "Sin categoría"
  );
}

function normalizeCategory(
  value?: string | null
): Category {
  return CATEGORIES.some(
    (item) =>
      item.value === value
  )
    ? (value as Category)
    : "C5";
}

function normalizeGender(
  value?: string | null
): "" | Gender {
  if (
    value === "hombre" ||
    value === "masculino"
  ) {
    return "hombre";
  }

  if (
    value === "mujer" ||
    value === "femenino"
  ) {
    return "mujer";
  }

  return "";
}

function normalizeSide(
  value?: string | null
): Side {
  if (
    value === "drive" ||
    value === "reves" ||
    value === "cualquiera"
  ) {
    return value;
  }

  return "cualquiera";
}

function adjacentCategories(
  primary: Category
) {
  const index =
    CATEGORIES.findIndex(
      (item) =>
        item.value === primary
    );

  return CATEGORIES.filter(
    (_, itemIndex) =>
      Math.abs(
        itemIndex - index
      ) === 1
  );
}

function isSecondaryAllowed(
  primary: Category,
  secondary: string
) {
  return (
    secondary === "" ||
    adjacentCategories(
      primary
    ).some(
      (item) =>
        item.value === secondary
    )
  );
}

function statusLabel(
  status?: string | null
) {
  if (status === "pendiente") {
    return "Pendiente";
  }

  if (status === "contactado") {
    return "Contactado";
  }

  if (status === "convocado") {
    return "Convocado";
  }

  if (status === "convertido") {
    return "Convertido a jugador";
  }

  if (status === "descartado") {
    return "Descartado";
  }

  return status ?? "Sin estado";
}

function statusClass(
  status?: string | null
) {
  if (status === "pendiente") {
    return "warn";
  }

  if (
    status === "contactado" ||
    status === "convocado" ||
    status === "convertido"
  ) {
    return "good";
  }

  if (status === "descartado") {
    return "danger";
  }

  return "neutral";
}

function formatDate(
  value: string
) {
  return new Date(
    value
  ).toLocaleString(
    "es-EC",
    {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatEventDate(
  value?: string | null
) {
  if (!value) {
    return "Sin fecha";
  }

  return new Date(
    `${value}T12:00:00`
  ).toLocaleDateString(
    "es-EC",
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }
  );
}

function formatTime(
  value?: string | null
) {
  return (
    value ?? ""
  ).slice(0, 5) || "Sin hora";
}

function dayLabel(
  value: number
) {
  return (
    DAYS.find(
      (item) =>
        item.value === value
    )?.label ??
    `Día ${value}`
  );
}

function timeValue(
  value?: string | null
) {
  return (
    value ?? "00:00"
  ).slice(0, 5);
}

function cleanPhone(
  value: string
) {
  return value.replace(
    /[^0-9]/g,
    ""
  );
}

function normalizePhoneForStorage(
  value: string
) {
  const digits =
    cleanPhone(value);

  if (
    digits.startsWith("0") &&
    digits.length === 10
  ) {
    return `+593${digits.slice(1)}`;
  }

  return digits
    ? `+${digits}`
    : "";
}

function splitName(
  fullName: string
) {
  const parts =
    fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  return {
    firstName:
      parts[0] ?? "Jugador",

    lastName:
      parts.slice(1).join(" ") ||
      null,
  };
}

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
          String(value).replace(
            ",",
            "."
          )
        );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function buildMessage(
  row: PlayerRequestRow
) {
  const firstName =
    row.full_name.split(
      " "
    )[0] || row.full_name;

  const venues =
    (
      row.preferred_venues ??
      []
    ).join(", ") ||
    "la sede que te quede mejor";

  const days =
    (
      row.preferred_days ??
      []
    ).join(", ") ||
    "los días que te convengan";

  const category =
    categoryLabel(
      row.category
    ).toLowerCase();

  return `Hola ${firstName}! 🎾

Vi tu solicitud para jugar.
Tengo registrado nivel aproximado ${category}, disponibilidad ${days}${row.preferred_times ? ` (${row.preferred_times})` : ""}, y preferencia por ${venues}.

Antes de agregarte, vamos a validar tu nivel, comunidad y horario.

¿Sigues disponible para jugar esta semana?`;
}

function whatsappLink(
  row: PlayerRequestRow
) {
  return `https://wa.me/${cleanPhone(
    row.whatsapp
  )}?text=${encodeURIComponent(
    buildMessage(row)
  )}`;
}

function newAvailabilityRow(
  dayOfWeek = 1,
  startTime = "19:00",
  endTime = "22:00"
): AvailabilityDraft {
  return {
    key: `${Date.now()}-${Math.random()}`,
    dayOfWeek,
    startTime,
    endTime,
  };
}

function dayNumberFromName(
  name: string
) {
  const normalized =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );

  const match =
    DAYS.find(
      (day) =>
        day.label
          .toLowerCase()
          .normalize("NFD")
          .replace(
            /[\u0300-\u036f]/g,
            ""
          ) === normalized
    );

  return match?.value ?? null;
}

function parseTimeRange(
  text?: string | null
) {
  const value =
    (text ?? "")
      .toLowerCase();

  const match =
    value.match(
      /(\d{1,2})(?::(\d{2}))?\s*(?:a|hasta|-|–)\s*(\d{1,2})(?::(\d{2}))?/
    );

  function normalizeHour(
    hour: string,
    minutes?: string
  ) {
    return `${hour.padStart(
      2,
      "0"
    )}:${(
      minutes ?? "00"
    ).padStart(2, "0")}`;
  }

  if (match) {
    return {
      start:
        normalizeHour(
          match[1],
          match[2]
        ),

      end:
        normalizeHour(
          match[3],
          match[4]
        ),
    };
  }

  if (
    value.includes("mañana")
  ) {
    return {
      start: "07:00",
      end: "12:00",
    };
  }

  if (
    value.includes("tarde")
  ) {
    return {
      start: "14:00",
      end: "18:00",
    };
  }

  return {
    start: "19:00",
    end: "22:00",
  };
}

function availabilityFromRequest(
  row: PlayerRequestRow
) {
  const range =
    parseTimeRange(
      row.preferred_times
    );

  return (
    row.preferred_days ??
    []
  )
    .map(dayNumberFromName)
    .filter(
      (
        day
      ): day is number =>
        day !== null
    )
    .map((day) =>
      newAvailabilityRow(
        day,
        range.start,
        range.end
      )
    );
}

function eventStatusLabel(
  status?: string | null
) {
  if (
    status ===
    "buscando_jugadores"
  ) {
    return "Buscando jugadores";
  }

  if (status === "completo") {
    return "Completo";
  }

  if (status === "cerrado") {
    return "Cerrado";
  }

  if (status === "cancelado") {
    return "Cancelado";
  }

  return status ?? "Sin estado";
}

export default function SolicitudesPage() {
  const [requests, setRequests] =
    useState<PlayerRequestRow[]>([]);

  const [
    communities,
    setCommunities,
  ] = useState<CommunityRow[]>([]);

  const [venues, setVenues] =
    useState<VenueRow[]>([]);

  const [events, setEvents] =
    useState<EventRow[]>([]);

  const [players, setPlayers] =
    useState<PlayerRow[]>([]);

  const [
    playerCommunities,
    setPlayerCommunities,
  ] = useState<
    PlayerCommunityRow[]
  >([]);

  const [
    availabilityRows,
    setAvailabilityRows,
  ] = useState<
    AvailabilityRow[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [notice, setNotice] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("pendiente");

  const [search, setSearch] =
    useState("");

  const [
    notesDraft,
    setNotesDraft,
  ] = useState<
    Record<string, string>
  >({});

  const [
    conversionRequestId,
    setConversionRequestId,
  ] = useState<
    string | null
  >(null);

  const [
    conversionDraft,
    setConversionDraft,
  ] = useState<
    ConversionDraft | null
  >(null);

  const [savingConversion, setSavingConversion] =
    useState(false);

  const [
    assigningId,
    setAssigningId,
  ] = useState<
    string | null
  >(null);

  const [
    selectedEventByRequest,
    setSelectedEventByRequest,
  ] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    setNotice("");

    try {
      const [
        requestsRes,
        communitiesRes,
        venuesRes,
        eventsRes,
        playersRes,
      ] = await Promise.all([
        supabase
          .from(
            "player_requests_demo"
          )
          .select(
            "id, full_name, whatsapp, email, category, preferred_venues, preferred_days, preferred_times, message, status, internal_notes, created_at, contacted_at, converted_at, converted_player_id"
          )
          .eq(
            "account_id",
            DEMO_ACCOUNT_ID
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("communities")
          .select("id, name")
          .eq(
            "account_id",
            DEMO_ACCOUNT_ID
          )
          .eq("active", true)
          .order("name"),

        supabase
          .from("venues")
          .select("id, name")
          .eq(
            "account_id",
            DEMO_ACCOUNT_ID
          )
          .eq("active", true)
          .order("name"),

        supabase
          .from("events")
          .select(
            "id, community_id, venue_id, event_date, start_time, category, status, players_needed, payment_default_amount"
          )
          .eq(
            "account_id",
            DEMO_ACCOUNT_ID
          )
          .neq(
            "status",
            "cancelado"
          )
          .neq(
            "status",
            "cerrado"
          )
          .order("event_date", {
            ascending: true,
          })
          .limit(100),

        supabase
          .from("players")
          .select(
            "id, first_name, last_name, whatsapp, gender, validated_category, secondary_category, preferred_side, active, notes, availability_notes"
          )
          .eq(
            "account_id",
            DEMO_ACCOUNT_ID
          )
          .order("first_name"),
      ]);

      if (requestsRes.error) {
        throw requestsRes.error;
      }

      if (communitiesRes.error) {
        throw communitiesRes.error;
      }

      if (venuesRes.error) {
        throw venuesRes.error;
      }

      if (eventsRes.error) {
        throw eventsRes.error;
      }

      if (playersRes.error) {
        throw playersRes.error;
      }

      const loadedRequests =
        (requestsRes.data ??
          []) as PlayerRequestRow[];

      const loadedPlayers =
        (playersRes.data ??
          []) as PlayerRow[];

      setRequests(
        loadedRequests
      );

      setCommunities(
        (communitiesRes.data ??
          []) as CommunityRow[]
      );

      setVenues(
        (venuesRes.data ??
          []) as VenueRow[]
      );

      setEvents(
        (eventsRes.data ??
          []) as EventRow[]
      );

      setPlayers(
        loadedPlayers
      );

      const drafts:
        Record<string, string> =
        {};

      for (
        const row of loadedRequests
      ) {
        drafts[row.id] =
          row.internal_notes ?? "";
      }

      setNotesDraft(drafts);

      const playerIds =
        loadedPlayers.map(
          (player) => player.id
        );

      if (!playerIds.length) {
        setPlayerCommunities([]);
        setAvailabilityRows([]);
        return;
      }

      const [
        relationsRes,
        availabilityRes,
      ] = await Promise.all([
        supabase
          .from(
            "player_communities"
          )
          .select(
            "player_id, community_id"
          )
          .in(
            "player_id",
            playerIds
          ),

        supabase
          .from(
            "player_availability"
          )
          .select(
            "player_id, day_of_week, start_time, end_time"
          )
          .in(
            "player_id",
            playerIds
          ),
      ]);

      if (relationsRes.error) {
        throw relationsRes.error;
      }

      if (availabilityRes.error) {
        throw availabilityRes.error;
      }

      setPlayerCommunities(
        (relationsRes.data ??
          []) as PlayerCommunityRow[]
      );

      setAvailabilityRows(
        (availabilityRes.data ??
          []) as AvailabilityRow[]
      );
    } catch (error: any) {
      setNotice(
        `No se pudieron cargar las solicitudes: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  }

  const playerByNormalizedPhone =
    useMemo(() => {
      const map =
        new Map<
          string,
          PlayerRow
        >();

      for (
        const player of players
      ) {
        const phone =
          cleanPhone(
            player.whatsapp ?? ""
          );

        if (phone) {
          map.set(
            phone,
            player
          );
        }
      }

      return map;
    }, [players]);

  const communitiesByPlayer =
    useMemo(() => {
      const map =
        new Map<
          string,
          string[]
        >();

      for (
        const row of playerCommunities
      ) {
        const current =
          map.get(row.player_id) ??
          [];

        current.push(
          row.community_id
        );

        map.set(
          row.player_id,
          current
        );
      }

      return map;
    }, [playerCommunities]);

  const availabilityByPlayer =
    useMemo(() => {
      const map =
        new Map<
          string,
          AvailabilityRow[]
        >();

      for (
        const row of availabilityRows
      ) {
        const current =
          map.get(row.player_id) ??
          [];

        current.push(row);

        map.set(
          row.player_id,
          current
        );
      }

      return map;
    }, [availabilityRows]);

  const venueById =
    useMemo(
      () =>
        new Map(
          venues.map(
            (venue) => [
              venue.id,
              venue,
            ]
          )
        ),
      [venues]
    );

  const communityById =
    useMemo(
      () =>
        new Map(
          communities.map(
            (community) => [
              community.id,
              community,
            ]
          )
        ),
      [communities]
    );

  const eventOptions =
    useMemo(() => {
      return events.filter(
        (event) =>
          event.status !==
            "cancelado" &&
          event.status !==
            "cerrado"
      );
    }, [events]);

  const activePlayerCount =
    useMemo(
      () =>
        players.filter(
          (player) =>
            player.active !== false
        ).length,
      [players]
    );

  async function updateStatus(
    row: PlayerRequestRow,
    status: RequestStatus
  ) {
    try {
      const patch:
        Record<string, any> = {
        status,
        updated_at:
          new Date().toISOString(),
      };

      if (
        status === "contactado" ||
        status === "convocado"
      ) {
        patch.contacted_at =
          new Date().toISOString();
      }

      const response =
        await supabase
          .from(
            "player_requests_demo"
          )
          .update(patch)
          .eq("id", row.id);

      if (response.error) {
        throw response.error;
      }

      await loadRequests();

      setNotice(
        `Solicitud marcada como ${statusLabel(
          status
        )}.`
      );
    } catch (error: any) {
      setNotice(
        `No se pudo actualizar la solicitud: ${error.message}`
      );
    }
  }

  async function saveNotes(
    row: PlayerRequestRow
  ) {
    try {
      const response =
        await supabase
          .from(
            "player_requests_demo"
          )
          .update({
            internal_notes:
              notesDraft[
                row.id
              ]?.trim() ||
              null,

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", row.id);

      if (response.error) {
        throw response.error;
      }

      await loadRequests();

      setNotice(
        "Nota interna guardada."
      );
    } catch (error: any) {
      setNotice(
        `No se pudo guardar la nota: ${error.message}`
      );
    }
  }

  function startConversion(
    row: PlayerRequestRow
  ) {
    const existingPlayer =
      playerByNormalizedPhone.get(
        cleanPhone(row.whatsapp)
      );

    const currentAvailability =
      existingPlayer
        ? (
            availabilityByPlayer.get(
              existingPlayer.id
            ) ?? []
          ).map(
            (item) => ({
              key: `${existingPlayer.id}-${item.day_of_week}-${item.start_time}-${Math.random()}`,

              dayOfWeek:
                item.day_of_week,

              startTime:
                timeValue(
                  item.start_time
                ),

              endTime:
                timeValue(
                  item.end_time
                ),
            })
          )
        : [];

    const requestedAvailability =
      availabilityFromRequest(row);

    const primary =
      existingPlayer
        ? normalizeCategory(
            existingPlayer.validated_category
          )
        : normalizeCategory(
            row.category
          );

    const existingSecondary =
      existingPlayer
        ? existingPlayer.secondary_category ??
          ""
        : "";

    setConversionRequestId(
      row.id
    );

    setConversionDraft({
      gender:
        existingPlayer
          ? normalizeGender(
              existingPlayer.gender
            )
          : "",

      primaryCategory:
        primary,

      secondaryCategory:
        isSecondaryAllowed(
          primary,
          existingSecondary
        )
          ? (existingSecondary as
              | ""
              | Category)
          : "",

      preferredSide:
        existingPlayer
          ? normalizeSide(
              existingPlayer.preferred_side
            )
          : "cualquiera",

      communityIds:
        existingPlayer
          ? communitiesByPlayer.get(
              existingPlayer.id
            ) ?? []
          : [],

      availability:
        currentAvailability.length
          ? currentAvailability
          : requestedAvailability,

      playerNotes:
        existingPlayer?.notes ??
        row.message ??
        "",

      availabilityNotes:
        existingPlayer?.availability_notes ??
        [
          row.preferred_times
            ? `Horario solicitado: ${row.preferred_times}`
            : "",

          row.preferred_venues?.length
            ? `Sedes solicitadas: ${row.preferred_venues.join(
                ", "
              )}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
    });

    setNotice("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelConversion() {
    setConversionRequestId(
      null
    );

    setConversionDraft(null);
  }

  function toggleConversionCommunity(
    communityId: string
  ) {
    setConversionDraft(
      (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,

          communityIds:
            current.communityIds.includes(
              communityId
            )
              ? current.communityIds.filter(
                  (id) =>
                    id !== communityId
                )
              : [
                  ...current.communityIds,
                  communityId,
                ],
        };
      }
    );
  }

  function addConversionAvailability() {
    setConversionDraft(
      (current) =>
        current
          ? {
              ...current,

              availability: [
                ...current.availability,
                newAvailabilityRow(),
              ],
            }
          : current
    );
  }

  function updateConversionAvailability(
    key: string,
    field:
      | "dayOfWeek"
      | "startTime"
      | "endTime",
    value: string
  ) {
    setConversionDraft(
      (current) =>
        current
          ? {
              ...current,

              availability:
                current.availability.map(
                  (item) =>
                    item.key === key
                      ? {
                          ...item,

                          [field]:
                            field ===
                            "dayOfWeek"
                              ? Number(
                                  value
                                )
                              : value,
                        }
                      : item
                ),
            }
          : current
    );
  }

  function removeConversionAvailability(
    key: string
  ) {
    setConversionDraft(
      (current) =>
        current
          ? {
              ...current,

              availability:
                current.availability.filter(
                  (item) =>
                    item.key !== key
                ),
            }
          : current
    );
  }

  async function replaceCommunities(
    playerId: string,
    communityIds: string[]
  ) {
    const deleteRes =
      await supabase
        .from(
          "player_communities"
        )
        .delete()
        .eq(
          "player_id",
          playerId
        );

    if (deleteRes.error) {
      throw deleteRes.error;
    }

    if (!communityIds.length) {
      return;
    }

    const withStatus =
      communityIds.map(
        (communityId) => ({
          account_id:
            DEMO_ACCOUNT_ID,

          player_id: playerId,
          community_id:
            communityId,

          status: "activo",
        })
      );

    const firstInsert =
      await supabase
        .from(
          "player_communities"
        )
        .insert(withStatus);

    if (!firstInsert.error) {
      return;
    }

    const message =
      firstInsert.error.message.toLowerCase();

    if (
      !message.includes("status") ||
      !message.includes("column")
    ) {
      throw firstInsert.error;
    }

    const retry =
      await supabase
        .from(
          "player_communities"
        )
        .insert(
          communityIds.map(
            (communityId) => ({
              account_id:
                DEMO_ACCOUNT_ID,

              player_id:
                playerId,

              community_id:
                communityId,
            })
          )
        );

    if (retry.error) {
      throw retry.error;
    }
  }

  async function replaceAvailability(
    playerId: string,
    availability:
      AvailabilityDraft[]
  ) {
    const deleteRes =
      await supabase
        .from(
          "player_availability"
        )
        .delete()
        .eq(
          "player_id",
          playerId
        );

    if (deleteRes.error) {
      throw deleteRes.error;
    }

    if (!availability.length) {
      return;
    }

    const insertRes =
      await supabase
        .from(
          "player_availability"
        )
        .insert(
          availability.map(
            (item) => ({
              account_id:
                DEMO_ACCOUNT_ID,

              player_id:
                playerId,

              day_of_week:
                item.dayOfWeek,

              start_time:
                item.startTime,

              end_time:
                item.endTime,
            })
          )
        );

    if (insertRes.error) {
      throw insertRes.error;
    }
  }

  async function saveConversion(
    row: PlayerRequestRow
  ) {
    if (!conversionDraft) {
      return;
    }

    if (!conversionDraft.gender) {
      setNotice(
        "Selecciona hombre o mujer antes de guardar el jugador."
      );
      return;
    }

    if (
      !conversionDraft.communityIds.length
    ) {
      setNotice(
        "Selecciona por lo menos una comunidad para el jugador."
      );
      return;
    }

    if (
      !isSecondaryAllowed(
        conversionDraft.primaryCategory,
        conversionDraft.secondaryCategory
      )
    ) {
      setNotice(
        "La categoría secundaria debe estar inmediatamente arriba o abajo de la categoría principal."
      );
      return;
    }

    for (
      const item of conversionDraft.availability
    ) {
      if (
        !item.startTime ||
        !item.endTime ||
        item.startTime >= item.endTime
      ) {
        setNotice(
          `Revisa el horario de ${dayLabel(
            item.dayOfWeek
          )}. La hora final debe ser mayor que la inicial.`
        );
        return;
      }
    }

    const normalizedPhone =
      normalizePhoneForStorage(
        row.whatsapp
      );

    const existingPlayer =
      playerByNormalizedPhone.get(
        cleanPhone(
          normalizedPhone
        )
      );

    if (
      !existingPlayer &&
      activePlayerCount >=
        FREE_ACTIVE_PLAYER_LIMIT
    ) {
      setNotice(
        `Llegaste al límite de ${FREE_ACTIVE_PLAYER_LIMIT} jugadores activos del plan gratis.`
      );
      return;
    }

    const confirmed =
      window.confirm(
        existingPlayer
          ? `${row.full_name} ya existe como jugador. Se actualizarán los datos administrativos seleccionados. ¿Continuar?`
          : `Se creará a ${row.full_name} como jugador activo con las categorías, comunidades y horarios seleccionados. ¿Continuar?`
      );

    if (!confirmed) {
      return;
    }

    setSavingConversion(true);

    setNotice(
      existingPlayer
        ? "Actualizando jugador existente..."
        : "Creando jugador..."
    );

    try {
      const {
        firstName,
        lastName,
      } = splitName(
        row.full_name
      );

      const payload = {
        first_name: firstName,
        last_name: lastName,
        whatsapp:
          normalizedPhone,

        gender:
          conversionDraft.gender,

        validated_category:
          conversionDraft.primaryCategory,

        secondary_category:
          conversionDraft.secondaryCategory ||
          null,

        preferred_side:
          conversionDraft.preferredSide,

        active: true,

        notes:
          conversionDraft.playerNotes.trim() ||
          null,

        availability_notes:
          conversionDraft.availabilityNotes.trim() ||
          null,

        last_activity_at:
          new Date().toISOString(),
      };

      let playerId =
        existingPlayer?.id ??
        null;

      if (existingPlayer) {
        const updateRes =
          await supabase
            .from("players")
            .update(payload)
            .eq(
              "account_id",
              DEMO_ACCOUNT_ID
            )
            .eq(
              "id",
              existingPlayer.id
            );

        if (updateRes.error) {
          throw updateRes.error;
        }
      } else {
        const createRes =
          await supabase
            .from("players")
            .insert({
              account_id:
                DEMO_ACCOUNT_ID,

              ...payload,

              reliability_score: 80,
              opt_in_whatsapp: true,
            })
            .select("id")
            .maybeSingle();

        if (createRes.error) {
          throw createRes.error;
        }

        playerId =
          createRes.data?.id ??
          null;
      }

      if (!playerId) {
        throw new Error(
          "Supabase no devolvió el jugador guardado."
        );
      }

      await replaceCommunities(
        playerId,
        conversionDraft.communityIds
      );

      await replaceAvailability(
        playerId,
        conversionDraft.availability
      );

      const currentInternalNote =
        notesDraft[
          row.id
        ]?.trim() ||
        row.internal_notes ||
        "";

      const conversionNote =
        existingPlayer
          ? "Solicitud vinculada con jugador existente. Datos administrativos revisados por el organizador."
          : "Convertido en jugador. Categorías, comunidades y disponibilidad validadas por el organizador.";

      const requestUpdate =
        await supabase
          .from(
            "player_requests_demo"
          )
          .update({
            status: "convertido",

            converted_at:
              new Date().toISOString(),

            converted_player_id:
              playerId,

            internal_notes: [
              currentInternalNote,
              conversionNote,
            ]
              .filter(Boolean)
              .join("\n"),

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", row.id);

      if (
        requestUpdate.error
      ) {
        throw requestUpdate.error;
      }

      cancelConversion();

      await loadRequests();

      setNotice(
        existingPlayer
          ? `${row.full_name} ya existía. Sus datos fueron revisados y la solicitud quedó vinculada.`
          : `${row.full_name} fue creado como jugador activo y ya puede aparecer en Crear partido.`
      );
    } catch (error: any) {
      setNotice(
        `No se pudo convertir la solicitud: ${error.message}`
      );
    } finally {
      setSavingConversion(false);
    }
  }

  async function addRequestToEvent(
    row: PlayerRequestRow,
    requestedStatus:
      ParticipationStatus
  ) {
    if (
      !row.converted_player_id
    ) {
      setNotice(
        "Primero convierte la solicitud en jugador."
      );
      return;
    }

    const eventId =
      selectedEventByRequest[
        row.id
      ] ||
      eventOptions[0]?.id;

    const event =
      eventOptions.find(
        (item) =>
          item.id === eventId
      );

    if (!event) {
      setNotice(
        "No hay partidos activos para agregar al jugador."
      );
      return;
    }

    setAssigningId(row.id);

    setNotice(
      "Agregando jugador al partido..."
    );

    try {
      const currentRes =
        await supabase
          .from(
            "participations"
          )
          .select(
            "player_id, status, waitlist_position"
          )
          .eq(
            "event_id",
            event.id
          );

      if (currentRes.error) {
        throw currentRes.error;
      }

      const currentRows =
        currentRes.data ?? [];

      const confirmedCount =
        currentRows.filter(
          (item: any) =>
            item.status ===
            "confirmado"
        ).length;

      let finalStatus =
        requestedStatus;

      if (
        requestedStatus ===
          "confirmado" &&
        confirmedCount >=
          (event.players_needed ?? 4)
      ) {
        finalStatus =
          "lista_espera";
      }

      const waitlistPositions =
        currentRows
          .filter(
            (item: any) =>
              item.status ===
              "lista_espera"
          )
          .map(
            (item: any) =>
              Number(
                item.waitlist_position ??
                  0
              )
          );

      const waitlistPosition =
        finalStatus ===
        "lista_espera"
          ? Math.max(
              0,
              ...waitlistPositions
            ) + 1
          : null;

      const dueAmount =
        finalStatus ===
        "confirmado"
          ? numericAmount(
              event.payment_default_amount
            )
          : null;

      const payload = {
        status: finalStatus,

        waitlist_position:
          waitlistPosition,

        payment_due_amount:
          dueAmount,

        payment_due_notes:
          finalStatus ===
          "confirmado"
            ? "Precio base del partido"
            : null,

        payment_status:
          finalStatus ===
            "confirmado" &&
          dueAmount === 0
            ? "pagado"
            : "pendiente",

        payment_amount:
          finalStatus ===
            "confirmado" &&
          dueAmount === 0
            ? 0
            : null,

        paid_at: null,
      };

      const existing =
        currentRows.find(
          (item: any) =>
            item.player_id ===
            row.converted_player_id
        );

      if (existing) {
        const updateRes =
          await supabase
            .from(
              "participations"
            )
            .update(payload)
            .eq(
              "event_id",
              event.id
            )
            .eq(
              "player_id",
              row.converted_player_id
            );

        if (updateRes.error) {
          throw updateRes.error;
        }
      } else {
        const insertRes =
          await supabase
            .from(
              "participations"
            )
            .insert({
              event_id:
                event.id,

              player_id:
                row.converted_player_id,

              ...payload,
            });

        if (insertRes.error) {
          throw insertRes.error;
        }
      }

      const eventText =
        `${formatEventDate(
          event.event_date
        )} ${formatTime(
          event.start_time
        )} · ${categoryLabel(
          event.category
        )}`;

      const statusText =
        finalStatus ===
        "confirmado"
          ? "Confirmado"
          : finalStatus ===
            "lista_espera"
          ? "Lista de espera"
          : "Interesado / ambiguo";

      const currentNote =
        notesDraft[
          row.id
        ]?.trim() ||
        row.internal_notes ||
        "";

      const requestUpdate =
        await supabase
          .from(
            "player_requests_demo"
          )
          .update({
            status: "convocado",

            contacted_at:
              new Date().toISOString(),

            internal_notes: [
              currentNote,
              `Partido: ${eventText}. Estado: ${statusText}.`,
            ]
              .filter(Boolean)
              .join("\n"),

            updated_at:
              new Date().toISOString(),
          })
          .eq("id", row.id);

      if (
        requestUpdate.error
      ) {
        throw requestUpdate.error;
      }

      await loadRequests();

      setNotice(
        requestedStatus ===
          "confirmado" &&
        finalStatus ===
          "lista_espera"
          ? `${row.full_name} pasó automáticamente a lista de espera porque el partido ya estaba lleno.`
          : `${row.full_name} fue agregado al partido como ${statusText.toLowerCase()}.`
      );
    } catch (error: any) {
      setNotice(
        `No se pudo agregar al partido: ${error.message}`
      );
    } finally {
      setAssigningId(null);
    }
  }

  const stats = useMemo(
    () => ({
      pending:
        requests.filter(
          (row) =>
            row.status ===
            "pendiente"
        ).length,

      contacted:
        requests.filter(
          (row) =>
            row.status ===
              "contactado" ||
            row.status ===
              "convocado"
        ).length,

      converted:
        requests.filter(
          (row) =>
            row.status ===
            "convertido"
        ).length,

      discarded:
        requests.filter(
          (row) =>
            row.status ===
            "descartado"
        ).length,
    }),
    [requests]
  );

  const filteredRequests =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return requests.filter(
        (row) => {
          if (
            statusFilter !==
              "todos" &&
            row.status !==
              statusFilter
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            row.full_name,
            row.whatsapp,
            row.email ?? "",
            categoryLabel(
              row.category
            ),
            (
              row.preferred_venues ??
              []
            ).join(" "),
            (
              row.preferred_days ??
              []
            ).join(" "),
            row.preferred_times ??
              "",
            row.message ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        }
      );
    }, [
      requests,
      statusFilter,
      search,
    ]);

  if (loading) {
    return (
      <PageHeader
        title="Solicitudes"
        description="Cargando solicitudes..."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Solicitudes"
        description="Revisa, contacta, valida los datos administrativos y convierte la solicitud en jugador."
      />

      <div
        className="card"
        style={{
          marginBottom: 16,
        }}
      >
        <div className="row-actions">
          <span className="badge warn">
            Pendientes:{" "}
            {stats.pending}
          </span>

          <span className="badge good">
            Contactadas/convocadas:{" "}
            {stats.contacted}
          </span>

          <span className="badge good">
            Convertidas:{" "}
            {stats.converted}
          </span>

          <span className="badge danger">
            Descartadas:{" "}
            {stats.discarded}
          </span>

          <span className="badge neutral">
            Jugadores activos:{" "}
            {activePlayerCount}/
            {
              FREE_ACTIVE_PLAYER_LIMIT
            }
          </span>
        </div>

        <p className="help-text">
          El jugador propone nivel,
          sedes y horario. El
          administrador valida
          categoría principal,
          categoría secundaria,
          comunidades y
          disponibilidad antes de
          guardarlo.
        </p>

        {notice ? (
          <p>
            <strong>
              {notice}
            </strong>
          </p>
        ) : null}

        <div className="row-actions">
          <button
            className="btn secondary"
            onClick={loadRequests}
          >
            🔄 Actualizar
          </button>

          <a
            className="btn"
            href="/quiero-jugar"
            target="_blank"
            rel="noreferrer"
          >
            Abrir formulario
          </a>

          <a
            className="btn secondary"
            href="/jugadores"
          >
            Ver jugadores
          </a>

          <a
            className="btn secondary"
            href="/llenar-canchas"
          >
            Crear partido
          </a>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 16,
        }}
      >
        <h2>
          Filtros
        </h2>

        <div className="grid grid-2">
          <label>
            Buscar

            <input
              placeholder="Nombre, WhatsApp, categoría, sede o día"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Estado

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
            >
              <option value="pendiente">
                Pendientes
              </option>

              <option value="contactado">
                Contactados
              </option>

              <option value="convocado">
                Convocados
              </option>

              <option value="convertido">
                Convertidos
              </option>

              <option value="descartado">
                Descartados
              </option>

              <option value="todos">
                Todos
              </option>
            </select>
          </label>
        </div>

        <p className="help-text">
          Mostrando{" "}
          {filteredRequests.length}{" "}
          de {requests.length}.
        </p>
      </div>

      {!filteredRequests.length ? (
        <div className="card">
          <h2>
            No hay solicitudes con
            estos filtros
          </h2>

          <p className="help-text">
            Cambia el filtro o crea
            una solicitud desde
            Quiero jugar.
          </p>
        </div>
      ) : (
        <div className="grid">
          {filteredRequests.map(
            (row) => {
              const message =
                buildMessage(row);

              const isConverted =
                Boolean(
                  row.converted_player_id
                );

              const selectedEventId =
                selectedEventByRequest[
                  row.id
                ] ||
                eventOptions[0]?.id ||
                "";

              const editingConversion =
                conversionRequestId ===
                row.id;

              return (
                <div
                  className="card"
                  key={row.id}
                >
                  <div className="player-top">
                    <div>
                      <h2>
                        {
                          row.full_name
                        }
                      </h2>

                      <p>
                        {row.whatsapp}

                        {row.email
                          ? ` · ${row.email}`
                          : ""}
                      </p>

                      <p className="help-text">
                        Llegó:{" "}
                        {formatDate(
                          row.created_at
                        )}
                      </p>
                    </div>

                    <div className="score">
                      {categoryLabel(
                        row.category
                      )}
                    </div>
                  </div>

                  <div className="row-actions">
                    <span
                      className={`badge ${statusClass(
                        row.status
                      )}`}
                    >
                      {statusLabel(
                        row.status
                      )}
                    </span>

                    <span className="badge neutral">
                      {(
                        row.preferred_venues ??
                        []
                      ).join(", ") ||
                        "Sin sede"}
                    </span>

                    <span className="badge neutral">
                      {(
                        row.preferred_days ??
                        []
                      ).join(", ") ||
                        "Sin días"}
                    </span>

                    {row.preferred_times ? (
                      <span className="badge neutral">
                        {
                          row.preferred_times
                        }
                      </span>
                    ) : null}
                  </div>

                  {row.message ? (
                    <p>
                      <strong>
                        Mensaje:
                      </strong>{" "}
                      {row.message}
                    </p>
                  ) : null}

                  <div className="copy-box">
                    {message}
                  </div>

                  <div className="row-actions">
                    <button
                      className="btn secondary"
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          message
                        );

                        setNotice(
                          `Mensaje copiado para ${row.full_name}.`
                        );
                      }}
                    >
                      Copiar mensaje
                    </button>

                    <a
                      className="btn"
                      href={whatsappLink(
                        row
                      )}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() =>
                        updateStatus(
                          row,
                          "contactado"
                        )
                      }
                    >
                      Abrir WhatsApp
                    </a>

                    {!isConverted ? (
                      <button
                        className="btn"
                        onClick={() =>
                          startConversion(
                            row
                          )
                        }
                      >
                        Validar y convertir
                      </button>
                    ) : (
                      <a
                        className="btn secondary"
                        href="/jugadores"
                      >
                        Ver jugador
                      </a>
                    )}

                    <button
                      className="btn ghost"
                      onClick={() =>
                        updateStatus(
                          row,
                          "descartado"
                        )
                      }
                    >
                      Descartar
                    </button>

                    <button
                      className="btn ghost"
                      onClick={() =>
                        updateStatus(
                          row,
                          "pendiente"
                        )
                      }
                    >
                      Pendiente
                    </button>
                  </div>

                  {editingConversion &&
                  conversionDraft ? (
                    <div
                      className="mini-panel"
                      style={{
                        marginTop: 16,
                      }}
                    >
                      <h3>
                        Validar jugador
                      </h3>

                      <p className="help-text">
                        Estos datos solo
                        los podrá cambiar
                        el administrador o
                        asistente
                        autorizado.
                      </p>

                      <div className="grid grid-2">
                        <label>
                          Categoría principal

                          <select
                            value={
                              conversionDraft.primaryCategory
                            }
                            onChange={(
                              event
                            ) => {
                              const primary =
                                event
                                  .target
                                  .value as Category;

                              setConversionDraft(
                                (
                                  current
                                ) =>
                                  current
                                    ? {
                                        ...current,

                                        primaryCategory:
                                          primary,

                                        secondaryCategory:
                                          isSecondaryAllowed(
                                            primary,
                                            current.secondaryCategory
                                          )
                                            ? current.secondaryCategory
                                            : "",
                                      }
                                    : current
                              );
                            }}
                          >
                            {CATEGORIES.map(
                              (item) => (
                                <option
                                  key={
                                    item.value
                                  }
                                  value={
                                    item.value
                                  }
                                >
                                  {
                                    item.label
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </label>

                        <label>
                          Categoría secundaria

                          <select
                            value={
                              conversionDraft.secondaryCategory
                            }
                            onChange={(
                              event
                            ) =>
                              setConversionDraft(
                                (
                                  current
                                ) =>
                                  current
                                    ? {
                                        ...current,

                                        secondaryCategory:
                                          event
                                            .target
                                            .value as
                                            | ""
                                            | Category,
                                      }
                                    : current
                              )
                            }
                          >
                            <option value="">
                              Sin categoría secundaria
                            </option>

                            {adjacentCategories(
                              conversionDraft.primaryCategory
                            ).map(
                              (item) => (
                                <option
                                  key={
                                    item.value
                                  }
                                  value={
                                    item.value
                                  }
                                >
                                  {
                                    item.label
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </label>

                        <label>
                          Género

                          <select
                            value={
                              conversionDraft.gender
                            }
                            onChange={(
                              event
                            ) =>
                              setConversionDraft(
                                (
                                  current
                                ) =>
                                  current
                                    ? {
                                        ...current,

                                        gender:
                                          event
                                            .target
                                            .value as
                                            | ""
                                            | Gender,
                                      }
                                    : current
                              )
                            }
                          >
                            <option value="">
                              Seleccionar
                            </option>

                            <option value="hombre">
                              Hombre
                            </option>

                            <option value="mujer">
                              Mujer
                            </option>
                          </select>
                        </label>

                        <label>
                          Lado preferido

                          <select
                            value={
                              conversionDraft.preferredSide
                            }
                            onChange={(
                              event
                            ) =>
                              setConversionDraft(
                                (
                                  current
                                ) =>
                                  current
                                    ? {
                                        ...current,

                                        preferredSide:
                                          event
                                            .target
                                            .value as Side,
                                      }
                                    : current
                              )
                            }
                          >
                            <option value="cualquiera">
                              Cualquiera
                            </option>

                            <option value="drive">
                              Drive
                            </option>

                            <option value="reves">
                              Revés
                            </option>
                          </select>
                        </label>
                      </div>

                      <h3>
                        Comunidades
                      </h3>

                      <div className="row-actions">
                        {communities.map(
                          (community) => (
                            <button
                              type="button"
                              key={
                                community.id
                              }
                              className={
                                conversionDraft.communityIds.includes(
                                  community.id
                                )
                                  ? "btn"
                                  : "btn secondary"
                              }
                              onClick={() =>
                                toggleConversionCommunity(
                                  community.id
                                )
                              }
                            >
                              {
                                community.name
                              }
                            </button>
                          )
                        )}
                      </div>

                      <h3>
                        Disponibilidad semanal
                      </h3>

                      {!conversionDraft
                        .availability
                        .length ? (
                        <p className="help-text">
                          No hay horarios
                          estructurados.
                          Agrega al menos
                          uno o deja la
                          explicación en
                          notas.
                        </p>
                      ) : null}

                      {conversionDraft.availability.map(
                        (item) => (
                          <div
                            className="grid grid-3"
                            key={
                              item.key
                            }
                            style={{
                              marginBottom: 10,
                            }}
                          >
                            <label>
                              Día

                              <select
                                value={
                                  item.dayOfWeek
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateConversionAvailability(
                                    item.key,
                                    "dayOfWeek",
                                    event
                                      .target
                                      .value
                                  )
                                }
                              >
                                {DAYS.map(
                                  (day) => (
                                    <option
                                      key={
                                        day.value
                                      }
                                      value={
                                        day.value
                                      }
                                    >
                                      {
                                        day.label
                                      }
                                    </option>
                                  )
                                )}
                              </select>
                            </label>

                            <label>
                              Desde

                              <input
                                type="time"
                                value={
                                  item.startTime
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateConversionAvailability(
                                    item.key,
                                    "startTime",
                                    event
                                      .target
                                      .value
                                  )
                                }
                              />
                            </label>

                            <label>
                              Hasta

                              <input
                                type="time"
                                value={
                                  item.endTime
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateConversionAvailability(
                                    item.key,
                                    "endTime",
                                    event
                                      .target
                                      .value
                                  )
                                }
                              />
                            </label>

                            <button
                              type="button"
                              className="btn danger"
                              onClick={() =>
                                removeConversionAvailability(
                                  item.key
                                )
                              }
                            >
                              Quitar horario
                            </button>
                          </div>
                        )
                      )}

                      <button
                        type="button"
                        className="btn secondary"
                        onClick={
                          addConversionAvailability
                        }
                      >
                        + Agregar horario
                      </button>

                      <label>
                        Notas internas del jugador

                        <textarea
                          value={
                            conversionDraft.playerNotes
                          }
                          onChange={(
                            event
                          ) =>
                            setConversionDraft(
                              (
                                current
                              ) =>
                                current
                                  ? {
                                      ...current,

                                      playerNotes:
                                        event
                                          .target
                                          .value,
                                    }
                                  : current
                            )
                          }
                          placeholder="Ejemplo: buen candidato, nivel por revisar, evitar jugar con..."
                          style={{
                            minHeight: 90,
                          }}
                        />
                      </label>

                      <label>
                        Notas de disponibilidad

                        <textarea
                          value={
                            conversionDraft.availabilityNotes
                          }
                          onChange={(
                            event
                          ) =>
                            setConversionDraft(
                              (
                                current
                              ) =>
                                current
                                  ? {
                                      ...current,

                                      availabilityNotes:
                                        event
                                          .target
                                          .value,
                                    }
                                  : current
                            )
                          }
                          placeholder="Ejemplo: siempre avisar, puede jugar con poca anticipación..."
                          style={{
                            minHeight: 80,
                          }}
                        />
                      </label>

                      <div className="row-actions">
                        <button
                          className="btn"
                          disabled={
                            savingConversion
                          }
                          onClick={() =>
                            saveConversion(
                              row
                            )
                          }
                        >
                          {savingConversion
                            ? "Guardando..."
                            : "Guardar y convertir"}
                        </button>

                        <button
                          className="btn secondary"
                          disabled={
                            savingConversion
                          }
                          onClick={
                            cancelConversion
                          }
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isConverted ? (
                    <div
                      className="mini-panel"
                      style={{
                        marginTop: 16,
                      }}
                    >
                      <h3>
                        Meter en partido
                      </h3>

                      {!eventOptions.length ? (
                        <p className="help-text">
                          No hay partidos
                          activos.
                        </p>
                      ) : (
                        <>
                          <label>
                            Partido

                            <select
                              value={
                                selectedEventId
                              }
                              onChange={(
                                event
                              ) =>
                                setSelectedEventByRequest(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    [row.id]:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                            >
                              {eventOptions.map(
                                (event) => {
                                  const venue =
                                    event.venue_id
                                      ? venueById.get(
                                          event.venue_id
                                        )
                                      : null;

                                  const community =
                                    event.community_id
                                      ? communityById.get(
                                          event.community_id
                                        )
                                      : null;

                                  return (
                                    <option
                                      key={
                                        event.id
                                      }
                                      value={
                                        event.id
                                      }
                                    >
                                      {formatEventDate(
                                        event.event_date
                                      )}{" "}
                                      ·{" "}
                                      {formatTime(
                                        event.start_time
                                      )}{" "}
                                      ·{" "}
                                      {categoryLabel(
                                        event.category
                                      )}{" "}
                                      ·{" "}
                                      {venue?.name ??
                                        "Sede"}{" "}
                                      ·{" "}
                                      {community?.name ??
                                        "Comunidad"}{" "}
                                      ·{" "}
                                      {eventStatusLabel(
                                        event.status
                                      )}
                                    </option>
                                  );
                                }
                              )}
                            </select>
                          </label>

                          <div className="row-actions">
                            <button
                              className="btn secondary"
                              disabled={
                                assigningId ===
                                row.id
                              }
                              onClick={() =>
                                addRequestToEvent(
                                  row,
                                  "ambiguo"
                                )
                              }
                            >
                              Agregar como interesado
                            </button>

                            <button
                              className="btn"
                              disabled={
                                assigningId ===
                                row.id
                              }
                              onClick={() =>
                                addRequestToEvent(
                                  row,
                                  "confirmado"
                                )
                              }
                            >
                              Confirmar directo
                            </button>

                            <button
                              className="btn ghost"
                              disabled={
                                assigningId ===
                                row.id
                              }
                              onClick={() =>
                                addRequestToEvent(
                                  row,
                                  "lista_espera"
                                )
                              }
                            >
                              Lista de espera
                            </button>
                          </div>

                          <p className="help-text">
                            Si intentas
                            confirmar en
                            un partido
                            lleno, el
                            jugador pasará
                            automáticamente
                            a lista de
                            espera.
                          </p>
                        </>
                      )}
                    </div>
                  ) : null}

                  <label>
                    Nota interna de la solicitud

                    <textarea
                      value={
                        notesDraft[
                          row.id
                        ] ?? ""
                      }
                      onChange={(
                        event
                      ) =>
                        setNotesDraft(
                          (
                            current
                          ) => ({
                            ...current,

                            [row.id]:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      placeholder="Notas sobre contacto, nivel o seguimiento"
                      style={{
                        minHeight: 80,
                      }}
                    />
                  </label>

                  <button
                    className="btn secondary"
                    onClick={() =>
                      saveNotes(row)
                    }
                  >
                    Guardar nota
                  </button>
                </div>
              );
            }
          )}
        </div>
      )}
    </>
  );
}