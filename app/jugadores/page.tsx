"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DEMO_ACCOUNT_ID } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";

type RealCategory = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7";
type Category = "UNCATEGORIZED" | RealCategory;
type Gender = "hombre" | "mujer";
type Side = "drive" | "reves" | "cualquiera";
type StatusFilter = "activos" | "inactivos" | "todos";

const FREE_ACTIVE_PLAYER_LIMIT = 50;

const PLAYER_AVATARS = ["👨", "👩", "🎾", "⭐", "🔥", "💪", "🏆", "🙂"];

const CATEGORY_OPTIONS: Array<{ value: Category; label: string }> = [
  { value: "UNCATEGORIZED", label: "Por categorizar" },
  { value: "C1", label: "Primera" },
  { value: "C2", label: "Segunda" },
  { value: "C3", label: "Tercera" },
  { value: "C4", label: "Cuarta" },
  { value: "C5", label: "Quinta" },
  { value: "C6", label: "Sexta" },
  { value: "C7", label: "Novatos" },
];

const REAL_CATEGORIES: Array<{ value: RealCategory; label: string }> =
  CATEGORY_OPTIONS.filter(
    (item): item is { value: RealCategory; label: string } =>
      item.value !== "UNCATEGORIZED"
  );

const DAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

type PlayerRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  whatsapp: string | null;
  gender: string | null;
  validated_category: string | null;
  secondary_category: string | null;
  preferred_side: string | null;
  active: boolean | null;
  notes: string | null;
  availability_notes: string | null;
  profile_image_url: string | null;
  avatar_emoji: string | null;
};

type CommunityRow = {
  id: string;
  name: string;
  active: boolean | null;
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

type AvailabilityDraft = {
  dayOfWeek: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
};

type PlayerForm = {
  firstName: string;
  lastName: string;
  whatsapp: string;
  gender: Gender;
  primaryCategory: Category;
  secondaryCategory: "" | RealCategory;
  preferredSide: Side;
  active: boolean;
  communityIds: string[];
  availability: AvailabilityDraft[];
  notes: string;
  availabilityNotes: string;
  profileImageUrl: string;
  avatarEmoji: string;
};

function defaultFullAvailability(): AvailabilityDraft[] {
  return DAYS.map((day) => ({
    dayOfWeek: day.value,
    enabled: true,
    startTime: "07:00",
    endTime: "22:00",
  }));
}

function weeklyAvailabilityFromRows(rows: AvailabilityRow[] = []): AvailabilityDraft[] {
  if (!rows.length) {
    return defaultFullAvailability();
  }

  return DAYS.map((day) => {
    const savedRow = rows.find((row) => row.day_of_week === day.value);

    return {
      dayOfWeek: day.value,
      enabled: Boolean(savedRow),
      startTime: savedRow ? timeValue(savedRow.start_time) : "07:00",
      endTime: savedRow ? timeValue(savedRow.end_time) : "22:00",
    };
  });
}

function emptyForm(): PlayerForm {
  return {
    firstName: "",
    lastName: "",
    whatsapp: "+593",
    gender: "hombre",
    primaryCategory: "UNCATEGORIZED",
    secondaryCategory: "",
    preferredSide: "cualquiera",
    active: true,
    communityIds: [],
    availability: defaultFullAvailability(),
    notes: "",
    availabilityNotes: "",
    profileImageUrl: "",
    avatarEmoji: "🎾",
  };
}

function normalizeCategory(value?: string | null): Category {
  if (!value) return "UNCATEGORIZED";

  if (
    value === "UNCATEGORIZED" ||
    value === "por_categorizar" ||
    value === "pendiente"
  ) {
    return "UNCATEGORIZED";
  }

  return REAL_CATEGORIES.some((item) => item.value === value)
    ? (value as RealCategory)
    : "UNCATEGORIZED";
}

function categoryToDb(value: Category): RealCategory | null {
  return value === "UNCATEGORIZED" ? null : value;
}

function normalizeGender(value?: string | null): Gender {
  return value === "mujer" || value === "femenino" ? "mujer" : "hombre";
}

function normalizeSide(value?: string | null): Side {
  if (value === "drive" || value === "reves" || value === "cualquiera") {
    return value;
  }

  return "cualquiera";
}

function categoryLabel(value?: string | null) {
  const normalized = normalizeCategory(value);
  return (
    CATEGORY_OPTIONS.find((item) => item.value === normalized)?.label ??
    "Por categorizar"
  );
}

function dayLabel(value: number) {
  return DAYS.find((item) => item.value === value)?.label ?? `Día ${value}`;
}

function timeValue(value?: string | null) {
  return (value ?? "00:00").slice(0, 5);
}

function fullName(player: PlayerRow) {
  return [player.first_name, player.last_name].filter(Boolean).join(" ");
}

function adjacentCategories(primary: Category) {
  if (primary === "UNCATEGORIZED") return [];

  const index = REAL_CATEGORIES.findIndex((item) => item.value === primary);

  return REAL_CATEGORIES.filter(
    (_, itemIndex) => Math.abs(itemIndex - index) === 1
  );
}

function isSecondaryAllowed(primary: Category, secondary: string) {
  if (primary === "UNCATEGORIZED") return secondary === "";

  return (
    secondary === "" ||
    adjacentCategories(primary).some((item) => item.value === secondary)
  );
}

function availabilitySummary(rows: AvailabilityRow[]) {
  if (!rows.length) return "Todos los días 07:00–22:00";

  return rows
    .slice()
    .sort(
      (a, b) =>
        a.day_of_week - b.day_of_week ||
        timeValue(a.start_time).localeCompare(timeValue(b.start_time))
    )
    .map(
      (row) =>
        `${dayLabel(row.day_of_week)} ${timeValue(row.start_time)}–${timeValue(
          row.end_time
        )}`
    )
    .join(" · ");
}

async function compressPlayerImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));

    reader.onload = () => {
      const image = new Image();

      image.onerror = () =>
        reject(new Error("El archivo no parece ser una imagen válida."));

      image.onload = () => {
        const maxSide = 320;

        const scale = Math.min(
          1,
          maxSide / Math.max(image.naturalWidth, image.naturalHeight)
        );

        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("No se pudo preparar la imagen."));
          return;
        }

        context.drawImage(image, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", 0.76));
      };

      image.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

function PlayerVisual({
  imageUrl,
  avatarEmoji,
  name,
  large = false,
}: {
  imageUrl: string;
  avatarEmoji: string;
  name: string;
  large?: boolean;
}) {
  const className = large ? "player-avatar large" : "player-avatar";

  if (imageUrl) {
    return <img alt={name || "Jugador"} className={className} src={imageUrl} />;
  }

  return (
    <div className={className} aria-label={`Avatar de ${name || "jugador"}`}>
      {avatarEmoji || "🎾"}
    </div>
  );
}

export default function JugadoresPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [playerCommunities, setPlayerCommunities] = useState<PlayerCommunityRow[]>(
    []
  );
  const [availabilityRows, setAvailabilityRows] = useState<AvailabilityRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlayerForm>(emptyForm());
  const [bulkStartTime, setBulkStartTime] = useState("07:00");
  const [bulkEndTime, setBulkEndTime] = useState("22:00");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("activos");
  const [categoryFilter, setCategoryFilter] = useState<"todas" | Category>(
    "todas"
  );
  const [communityFilter, setCommunityFilter] = useState("todas");
  const [dayFilter, setDayFilter] = useState("todos");
  const [timeFilter, setTimeFilter] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);

      if (params.get("categoria") === "por_categorizar") {
        setCategoryFilter("UNCATEGORIZED");
        setStatusFilter("activos");
      }
    }

    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setNotice("");

    try {
      const [playersRes, communitiesRes] = await Promise.all([
        supabase
          .from("players")
          .select(
            "id, first_name, last_name, whatsapp, gender, validated_category, secondary_category, preferred_side, active, notes, availability_notes, profile_image_url, avatar_emoji"
          )
          .eq("account_id", DEMO_ACCOUNT_ID)
          .order("first_name"),
        supabase
          .from("communities")
          .select("id, name, active")
          .eq("account_id", DEMO_ACCOUNT_ID)
          .order("name"),
      ]);

      if (playersRes.error) throw playersRes.error;
      if (communitiesRes.error) throw communitiesRes.error;

      const loadedPlayers = (playersRes.data ?? []) as PlayerRow[];

      setPlayers(loadedPlayers);
      setCommunities((communitiesRes.data ?? []) as CommunityRow[]);

      const playerIds = loadedPlayers.map((player) => player.id);

      if (!playerIds.length) {
        setPlayerCommunities([]);
        setAvailabilityRows([]);
        return;
      }

      const [relationsRes, availabilityRes] = await Promise.all([
        supabase
          .from("player_communities")
          .select("player_id, community_id")
          .in("player_id", playerIds),
        supabase
          .from("player_availability")
          .select("player_id, day_of_week, start_time, end_time")
          .in("player_id", playerIds),
      ]);

      if (relationsRes.error) throw relationsRes.error;
      if (availabilityRes.error) throw availabilityRes.error;

      setPlayerCommunities((relationsRes.data ?? []) as PlayerCommunityRow[]);
      setAvailabilityRows((availabilityRes.data ?? []) as AvailabilityRow[]);
    } catch (error: any) {
      setNotice(`No se pudieron cargar los jugadores: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  const activeCount = useMemo(
    () => players.filter((player) => player.active !== false).length,
    [players]
  );

  const pendingCategoryCount = useMemo(
    () =>
      players.filter(
        (player) =>
          player.active !== false &&
          normalizeCategory(player.validated_category) === "UNCATEGORIZED"
      ).length,
    [players]
  );

  const communityIdsByPlayer = useMemo(() => {
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

  const communityNameById = useMemo(
    () => new Map(communities.map((community) => [community.id, community.name])),
    [communities]
  );

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const selectedDay = dayFilter === "todos" ? null : Number(dayFilter);
    const selectedTime = timeFilter.trim();

    return players
      .filter((player) => {
        if (statusFilter === "activos") return player.active !== false;
        if (statusFilter === "inactivos") return player.active === false;
        return true;
      })
      .filter((player) => {
        if (categoryFilter === "todas") return true;

        if (categoryFilter === "UNCATEGORIZED") {
          return normalizeCategory(player.validated_category) === "UNCATEGORIZED";
        }

        return (
          player.validated_category === categoryFilter ||
          player.secondary_category === categoryFilter
        );
      })
      .filter((player) => {
        if (communityFilter === "todas") return true;
        return (communityIdsByPlayer.get(player.id) ?? []).includes(
          communityFilter
        );
      })
      .filter((player) => {
        if (selectedDay === null && !selectedTime) return true;

        const rows = availabilityByPlayer.get(player.id) ?? [];

        if (!rows.length) return true;

        return rows.some((row) => {
          if (selectedDay !== null && row.day_of_week !== selectedDay) {
            return false;
          }

          if (!selectedTime) return true;

          const start = timeValue(row.start_time);
          const end = timeValue(row.end_time);

          return start <= selectedTime && selectedTime <= end;
        });
      })
      .filter((player) => {
        if (!query) return true;

        const communityNames = (communityIdsByPlayer.get(player.id) ?? [])
          .map((id) => communityNameById.get(id) ?? "")
          .join(" ");

        return [
          fullName(player),
          player.whatsapp ?? "",
          categoryLabel(player.validated_category),
          categoryLabel(player.secondary_category),
          communityNames,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [
    players,
    search,
    statusFilter,
    categoryFilter,
    communityFilter,
    dayFilter,
    timeFilter,
    communityIdsByPlayer,
    availabilityByPlayer,
    communityNameById,
  ]);

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm());
    setBulkStartTime("07:00");
    setBulkEndTime("22:00");
    setShowCreateForm(true);
    setNotice("");
  }

  function openEditForm(player: PlayerRow) {
    const relations = communityIdsByPlayer.get(player.id) ?? [];
    const availability = weeklyAvailabilityFromRows(
      availabilityByPlayer.get(player.id) ?? []
    );

    const primaryCategory = normalizeCategory(player.validated_category);
    const secondaryCandidate = player.secondary_category ?? "";

    const firstEnabledDay = availability.find((row) => row.enabled);

    setShowCreateForm(false);
    setEditingId(player.id);
    setBulkStartTime(firstEnabledDay?.startTime ?? "07:00");
    setBulkEndTime(firstEnabledDay?.endTime ?? "22:00");

    setForm({
      firstName: player.first_name,
      lastName: player.last_name ?? "",
      whatsapp: player.whatsapp ?? "+593",
      gender: normalizeGender(player.gender),
      primaryCategory,
      secondaryCategory: isSecondaryAllowed(primaryCategory, secondaryCandidate)
        ? (secondaryCandidate as "" | RealCategory)
        : "",
      preferredSide: normalizeSide(player.preferred_side),
      active: player.active !== false,
      communityIds: relations,
      availability,
      notes: player.notes ?? "",
      availabilityNotes: player.availability_notes ?? "",
      profileImageUrl: player.profile_image_url ?? "",
      avatarEmoji:
        player.avatar_emoji ??
        (normalizeGender(player.gender) === "mujer" ? "👩" : "👨"),
    });

    setNotice("");
  }

  function closeForm() {
    setShowCreateForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setBulkStartTime("07:00");
    setBulkEndTime("22:00");
  }

  function toggleCommunity(communityId: string) {
    setForm((current) => ({
      ...current,
      communityIds: current.communityIds.includes(communityId)
        ? current.communityIds.filter((id) => id !== communityId)
        : [...current.communityIds, communityId],
    }));
  }

  function updateAvailability(
    dayOfWeek: number,
    field: "enabled" | "startTime" | "endTime",
    value: boolean | string
  ) {
    setForm((current) => ({
      ...current,
      availability: current.availability.map((row) =>
        row.dayOfWeek === dayOfWeek
          ? {
              ...row,
              [field]: value,
            }
          : row
      ),
    }));
  }

  function selectWeekdays() {
    setForm((current) => ({
      ...current,
      availability: current.availability.map((row) => {
        const shouldEnable = row.dayOfWeek >= 1 && row.dayOfWeek <= 5;

        return {
          ...row,
          enabled: shouldEnable,
          startTime: "07:00",
          endTime: "22:00",
        };
      }),
    }));
  }

  function selectWeekend() {
    setForm((current) => ({
      ...current,
      availability: current.availability.map((row) => {
        const shouldEnable = row.dayOfWeek === 6 || row.dayOfWeek === 7;

        return {
          ...row,
          enabled: shouldEnable,
          startTime: "07:00",
          endTime: "22:00",
        };
      }),
    }));
  }

  function selectEveryDay() {
    setForm((current) => ({
      ...current,
      availability: current.availability.map((row) => ({
        ...row,
        enabled: true,
        startTime: "07:00",
        endTime: "22:00",
      })),
    }));
  }

  function clearAvailabilityDays() {
    setForm((current) => ({
      ...current,
      availability: current.availability.map((row) => ({
        ...row,
        enabled: false,
      })),
    }));
  }

  function applyBulkSchedule() {
    const selectedDays = form.availability.filter((row) => row.enabled);

    if (!selectedDays.length) {
      setNotice("Selecciona al menos un día antes de aplicar el horario.");
      return;
    }

    if (!bulkStartTime || !bulkEndTime) {
      setNotice("Completa la hora inicial y la hora final.");
      return;
    }

    if (bulkStartTime >= bulkEndTime) {
      setNotice("La hora final debe ser mayor que la hora inicial.");
      return;
    }

    setForm((current) => ({
      ...current,
      availability: current.availability.map((row) =>
        row.enabled
          ? {
              ...row,
              startTime: bulkStartTime,
              endTime: bulkEndTime,
            }
          : row
      ),
    }));

    setNotice(
      `Horario ${bulkStartTime}–${bulkEndTime} aplicado a ${selectedDays.length} día(s).`
    );
  }

  async function handlePlayerImage(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setNotice("Selecciona un archivo de imagen.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setNotice("La imagen original no puede pesar más de 8 MB.");
      return;
    }

    try {
      const profileImageUrl = await compressPlayerImage(file);

      setForm((current) => ({
        ...current,
        profileImageUrl,
      }));

      setNotice("Imagen preparada. Guarda el jugador para conservarla.");
    } catch (error: any) {
      setNotice(`No se pudo preparar la imagen: ${error.message}`);
    }
  }

  function validateForm() {
    if (!form.firstName.trim()) return "El nombre es obligatorio.";

    if (!form.whatsapp.trim() || form.whatsapp.trim().length < 8) {
      return "Escribe un WhatsApp válido.";
    }

    if (!isSecondaryAllowed(form.primaryCategory, form.secondaryCategory)) {
      return "La categoría secundaria debe ser la categoría inmediatamente superior o inferior.";
    }

    for (const row of form.availability.filter((item) => item.enabled)) {
      if (!row.startTime || !row.endTime) {
        return "Completa los horarios de los días activados.";
      }

      if (row.startTime >= row.endTime) {
        return `En ${dayLabel(
          row.dayOfWeek
        )}, la hora final debe ser mayor que la inicial.`;
      }
    }

    const existingPlayer = editingId
      ? players.find((player) => player.id === editingId)
      : null;

    const isActivating = form.active && existingPlayer?.active === false;
    const isCreatingActive = form.active && !editingId;

    if (
      (isActivating || isCreatingActive) &&
      activeCount >= FREE_ACTIVE_PLAYER_LIMIT
    ) {
      return `Llegaste al límite de ${FREE_ACTIVE_PLAYER_LIMIT} jugadores activos del plan gratis.`;
    }

    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setNotice(validationError);
      return;
    }

    setSaving(true);
    setNotice(editingId ? "Guardando cambios..." : "Creando jugador...");

    try {
      const schedule = form.availability
        .filter((row) => row.enabled)
        .map((row) => ({
          day_of_week: row.dayOfWeek,
          start_time: row.startTime,
          end_time: row.endTime,
        }));

      const { data, error } = await supabase.rpc("ptm_save_player_profile_v2", {
        p_account_id: DEMO_ACCOUNT_ID,
        p_player_id: editingId,
        p_first_name: form.firstName.trim(),
        p_last_name: form.lastName.trim() || null,
        p_whatsapp: form.whatsapp.trim(),
        p_gender: form.gender,
        p_primary_category: categoryToDb(form.primaryCategory),
        p_secondary_category:
          form.primaryCategory === "UNCATEGORIZED"
            ? null
            : form.secondaryCategory || null,
        p_preferred_side: form.preferredSide,
        p_active: form.active,
        p_community_ids: form.communityIds,
        p_schedule: schedule,
        p_notes: form.notes.trim() || null,
        p_availability_notes: form.availabilityNotes.trim() || null,
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      const savedPlayerId = result?.player_id as string | undefined;

      if (!savedPlayerId) {
        throw new Error("Supabase no devolvió el jugador guardado.");
      }

      const reusedExistingPlayer = result?.reused_existing_player === true;

      const imageRes = await supabase
        .from("players")
        .update({
          profile_image_url: form.profileImageUrl || null,
          avatar_emoji:
            form.avatarEmoji || (form.gender === "mujer" ? "👩" : "👨"),
        })
        .eq("account_id", DEMO_ACCOUNT_ID)
        .eq("id", savedPlayerId);

      if (imageRes.error) throw imageRes.error;

      await loadData();
      closeForm();

      setNotice(
        editingId
          ? "Jugador actualizado correctamente."
          : reusedExistingPlayer
            ? "El WhatsApp ya existía. Se recuperó y actualizó ese jugador correctamente."
            : form.primaryCategory === "UNCATEGORIZED"
              ? "Jugador creado como Por categorizar. Luego asígnale categoría."
              : "Jugador creado correctamente."
      );
    } catch (error: any) {
      setNotice(`No se pudo guardar el jugador: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(player: PlayerRow) {
    const willBeActive = player.active === false;

    if (willBeActive && activeCount >= FREE_ACTIVE_PLAYER_LIMIT) {
      setNotice(
        `No puedes activar más de ${FREE_ACTIVE_PLAYER_LIMIT} jugadores en el plan gratis.`
      );
      return;
    }

    const confirmed = window.confirm(
      willBeActive
        ? `¿Activar a ${fullName(player)}? Volverá a aparecer para convocatorias.`
        : `¿Desactivar a ${fullName(
            player
          )}? Ya no aparecerá para convocatorias.`
    );

    if (!confirmed) return;

    try {
      const updateRes = await supabase
        .from("players")
        .update({
          active: willBeActive,
          last_activity_at: new Date().toISOString(),
        })
        .eq("account_id", DEMO_ACCOUNT_ID)
        .eq("id", player.id);

      if (updateRes.error) throw updateRes.error;

      await loadData();

      setNotice(willBeActive ? "Jugador activado." : "Jugador desactivado.");
    } catch (error: any) {
      setNotice(`No se pudo cambiar el estado: ${error.message}`);
    }
  }

  function renderPlayerForm(title: string, submitLabel: string) {
    return (
      <form className="card" style={{ marginTop: 12 }} onSubmit={handleSubmit}>
        <div className="section-title-row">
          <h2>{title}</h2>

          <button
            className="btn cancel-action"
            type="button"
            onClick={closeForm}
            disabled={saving}
          >
            Cerrar
          </button>
        </div>

        <p className="help-text">
          Para ingresar rápido: WhatsApp, nombres, apellidos, género y categoría.
          Si no saben la categoría, deja <strong>Por categorizar</strong>.
        </p>

        <div className="grid grid-3">
          <label>
            Nombres
            <input
              value={form.firstName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  firstName: event.target.value,
                }))
              }
              placeholder="Ej: Juan Carlos"
            />
          </label>

          <label>
            Apellidos
            <input
              value={form.lastName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  lastName: event.target.value,
                }))
              }
              placeholder="Ej: Pérez García"
            />
          </label>

          <label>
            WhatsApp
            <input
              value={form.whatsapp}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  whatsapp: event.target.value,
                }))
              }
              placeholder="+593999999999"
            />
          </label>

          <label>
            Género
            <select
              value={form.gender}
              onChange={(event) => {
                const gender = event.target.value as Gender;

                setForm((current) => ({
                  ...current,
                  gender,
                  avatarEmoji:
                    current.profileImageUrl ||
                    (current.avatarEmoji !== "👨" && current.avatarEmoji !== "👩")
                      ? current.avatarEmoji
                      : gender === "mujer"
                        ? "👩"
                        : "👨",
                }));
              }}
            >
              <option value="hombre">Hombre</option>
              <option value="mujer">Mujer</option>
            </select>
          </label>

          <label>
            Categoría
            <select
              value={form.primaryCategory}
              onChange={(event) => {
                const primaryCategory = event.target.value as Category;

                setForm((current) => ({
                  ...current,
                  primaryCategory,
                  secondaryCategory: isSecondaryAllowed(
                    primaryCategory,
                    current.secondaryCategory
                  )
                    ? current.secondaryCategory
                    : "",
                }));
              }}
            >
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {form.primaryCategory === "UNCATEGORIZED" ? (
          <div className="danger-note" style={{ marginTop: 12 }}>
            Este jugador quedará pendiente. No debería ser invitado a partidos
            normales hasta asignarle categoría real.
          </div>
        ) : null}

        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 900 }}>
            Opciones avanzadas: comunidades, disponibilidad, lado, foto y notas
          </summary>

          <div className="grid grid-3" style={{ marginTop: 16 }}>
            <label>
              Categoría secundaria opcional
              <select
                value={form.secondaryCategory}
                disabled={form.primaryCategory === "UNCATEGORIZED"}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    secondaryCategory: event.target.value as "" | RealCategory,
                  }))
                }
              >
                <option value="">Sin categoría secundaria</option>

                {adjacentCategories(form.primaryCategory).map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Lado preferido
              <select
                value={form.preferredSide}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    preferredSide: event.target.value as Side,
                  }))
                }
              >
                <option value="cualquiera">Cualquiera</option>
                <option value="drive">Drive</option>
                <option value="reves">Revés</option>
              </select>
            </label>

            <label>
              Estado
              <select
                value={form.active ? "activo" : "inactivo"}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    active: event.target.value === "activo",
                  }))
                }
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </label>
          </div>

          <div className="player-photo-editor" style={{ marginTop: 16 }}>
            <PlayerVisual
              avatarEmoji={form.avatarEmoji}
              imageUrl={form.profileImageUrl}
              large
              name={[form.firstName, form.lastName].filter(Boolean).join(" ")}
            />

            <div className="player-photo-copy">
              <h3>Foto o avatar</h3>

              <p className="help-text">
                Opcional. Puedes tomar una foto, elegirla desde el celular o usar
                un avatar.
              </p>

              <div className="row-actions">
                <label className="btn edit">
                  📷 Elegir foto
                  <input
                    accept="image/*"
                    hidden
                    type="file"
                    onChange={(event) => {
                      void handlePlayerImage(event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>

                {form.profileImageUrl ? (
                  <button
                    className="btn delete"
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        profileImageUrl: "",
                      }))
                    }
                  >
                    Quitar foto
                  </button>
                ) : null}
              </div>

              <div className="avatar-picker">
                {PLAYER_AVATARS.map((avatar) => (
                  <button
                    aria-label={`Usar avatar ${avatar}`}
                    className={
                      form.avatarEmoji === avatar
                        ? "avatar-option selected"
                        : "avatar-option"
                    }
                    key={avatar}
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        avatarEmoji: avatar,
                        profileImageUrl: "",
                      }))
                    }
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <h3 style={{ marginTop: 16 }}>Comunidades asignadas</h3>

          <p className="help-text">
            Puede pertenecer a una, varias o ninguna comunidad.
          </p>

          <div className="row-actions" style={{ marginBottom: 16 }}>
            {communities
              .filter((community) => community.active !== false)
              .map((community) => (
                <label
                  key={community.id}
                  className="badge neutral"
                  style={{ cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={form.communityIds.includes(community.id)}
                    onChange={() => toggleCommunity(community.id)}
                    style={{ marginRight: 6 }}
                  />

                  {community.name}
                </label>
              ))}
          </div>

          <h3>Disponibilidad semanal</h3>

          <p className="help-text">
            Por defecto el jugador queda disponible todos los días de 07:00 a
            22:00. Solo cambia esto cuando el jugador diga que NO puede algún día
            u horario.
          </p>

          <div className="row-actions" style={{ marginBottom: 12 }}>
            <button type="button" className="btn secondary" onClick={selectEveryDay}>
              Todos los días
            </button>

            <button type="button" className="btn secondary" onClick={selectWeekdays}>
              Lunes a viernes
            </button>

            <button type="button" className="btn secondary" onClick={selectWeekend}>
              Fin de semana
            </button>

            <button type="button" className="btn ghost" onClick={clearAvailabilityDays}>
              Limpiar días
            </button>
          </div>

          <div className="quick-schedule-panel">
            <strong>Horario rápido para los días seleccionados</strong>

            <div className="quick-schedule-grid">
              <label>
                Desde
                <input
                  type="time"
                  value={bulkStartTime}
                  onChange={(event) => setBulkStartTime(event.target.value)}
                />
              </label>

              <label>
                Hasta
                <input
                  type="time"
                  value={bulkEndTime}
                  onChange={(event) => setBulkEndTime(event.target.value)}
                />
              </label>

              <button type="button" className="btn" onClick={applyBulkSchedule}>
                Aplicar horario
              </button>
            </div>
          </div>

          <div className="grid">
            {form.availability.map((row) => (
              <div
                className="mini-panel"
                key={row.dayOfWeek}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "end",
                  opacity: row.enabled ? 1 : 0.68,
                }}
              >
                <label style={{ cursor: "pointer", flex: "1 1 110px" }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minHeight: 44,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(event) =>
                        updateAvailability(
                          row.dayOfWeek,
                          "enabled",
                          event.target.checked
                        )
                      }
                    />

                    <strong>{dayLabel(row.dayOfWeek)}</strong>
                  </span>
                </label>

                <label style={{ flex: "1 1 95px" }}>
                  Desde
                  <input
                    type="time"
                    value={row.startTime}
                    disabled={!row.enabled}
                    onChange={(event) =>
                      updateAvailability(
                        row.dayOfWeek,
                        "startTime",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label style={{ flex: "1 1 95px" }}>
                  Hasta
                  <input
                    type="time"
                    value={row.endTime}
                    disabled={!row.enabled}
                    onChange={(event) =>
                      updateAvailability(
                        row.dayOfWeek,
                        "endTime",
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <label>
              Notas de disponibilidad
              <textarea
                rows={3}
                value={form.availabilityNotes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    availabilityNotes: event.target.value,
                  }))
                }
                placeholder="Ej: Solo puede después de las 19:00."
              />
            </label>

            <label>
              Notas internas
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Solo visible para administración."
              />
            </label>
          </div>
        </details>

        <div className="row-actions" style={{ marginTop: 16 }}>
          <button className="btn save" type="submit" disabled={saving}>
            {saving ? "Guardando..." : submitLabel}
          </button>

          <button
            className="btn cancel-action"
            type="button"
            onClick={closeForm}
            disabled={saving}
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  if (loading) {
    return <PageHeader title="Jugadores" description="Cargando jugadores..." />;
  }

  return (
    <>
      <PageHeader
        title="Jugadores"
        description="Lista rápida para operación diaria. Edita cada jugador en su misma fila."
        action={
          <div className="row-actions">
            <Link className="btn edit" href="/jugadores/importar">
              Importar contactos
            </Link>

            <button
              className="btn save"
              onClick={showCreateForm ? closeForm : openCreateForm}
            >
              {showCreateForm ? "Cerrar formulario" : "Agregar jugador"}
            </button>
          </div>
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-actions">
          <span className="badge good">
            Activos: {activeCount}/{FREE_ACTIVE_PLAYER_LIMIT}
          </span>

          <span className="badge neutral">Total: {players.length}</span>

          <span className="badge warn">
            Por categorizar: {pendingCategoryCount}
          </span>

          <span className="badge warn">Inactivos: {players.length - activeCount}</span>
        </div>

        <p className="help-text">
          Los jugadores <strong>Por categorizar</strong> quedan pendientes para
          que tú o un asistente les asigne categoría después.
        </p>

        {notice ? (
          <p>
            <strong>{notice}</strong>
          </p>
        ) : null}

        <button className="btn secondary" onClick={() => void loadData()}>
          🔄 Actualizar
        </button>
      </div>

      {showCreateForm ? renderPlayerForm("Agregar jugador", "Crear jugador") : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Filtros</h2>

        <div className="grid grid-3">
          <label>
            Nombre o WhatsApp
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar jugador"
            />
          </label>

          <label>
            Estado
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
            >
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos</option>
            </select>
          </label>

          <label>
            Categoría
            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value as "todas" | Category)
              }
            >
              <option value="todas">Todas</option>

              {CATEGORY_OPTIONS.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Comunidad
            <select
              value={communityFilter}
              onChange={(event) => setCommunityFilter(event.target.value)}
            >
              <option value="todas">Todas</option>

              {communities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Día disponible
            <select
              value={dayFilter}
              onChange={(event) => setDayFilter(event.target.value)}
            >
              <option value="todos">Todos</option>

              {DAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Hora disponible
            <input
              type="time"
              value={timeFilter}
              onChange={(event) => setTimeFilter(event.target.value)}
            />
          </label>
        </div>

        <p className="help-text">Resultados: {filteredPlayers.length}</p>
      </div>

      <div>
        {filteredPlayers.map((player) => {
          const assignedCommunityIds = communityIdsByPlayer.get(player.id) ?? [];
          const playerAvailability = availabilityByPlayer.get(player.id) ?? [];
          const isUncategorized =
            normalizeCategory(player.validated_category) === "UNCATEGORIZED";

          return (
            <div className="card" key={player.id} style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    minWidth: 220,
                    flex: "1 1 260px",
                  }}
                >
                  <PlayerVisual
                    avatarEmoji={
                      player.avatar_emoji ??
                      (normalizeGender(player.gender) === "mujer" ? "👩" : "👨")
                    }
                    imageUrl={player.profile_image_url ?? ""}
                    name={fullName(player)}
                  />

                  <div>
                    <h2 style={{ margin: 0 }}>{fullName(player)}</h2>

                    <p className="help-text" style={{ margin: "4px 0 0" }}>
                      {player.whatsapp || "Sin WhatsApp"}
                    </p>
                  </div>
                </div>

                <div className="row-actions" style={{ flex: "2 1 420px" }}>
                  <span className={player.active !== false ? "badge good" : "badge warn"}>
                    {player.active !== false ? "Activo" : "Inactivo"}
                  </span>

                  <span className={isUncategorized ? "badge warn" : "badge neutral"}>
                    {categoryLabel(player.validated_category)}
                  </span>

                  {player.secondary_category ? (
                    <span className="badge neutral">
                      También {categoryLabel(player.secondary_category)}
                    </span>
                  ) : null}

                  <span className="badge neutral">
                    {normalizeGender(player.gender) === "mujer" ? "Mujer" : "Hombre"}
                  </span>
                </div>

                <div className="row-actions">
                  <button
                    className="btn edit"
                    onClick={() =>
                      editingId === player.id ? closeForm() : openEditForm(player)
                    }
                  >
                    {editingId === player.id ? "Cerrar" : "Editar"}
                  </button>

                  <button
                    className={
                      player.active !== false ? "btn deactivate" : "btn activate"
                    }
                    onClick={() => void toggleActive(player)}
                  >
                    {player.active !== false ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 10,
                  marginTop: 12,
                }}
              >
                <p style={{ margin: 0 }}>
                  <strong>Comunidades:</strong>{" "}
                  {assignedCommunityIds.length
                    ? assignedCommunityIds
                        .map((id) => communityNameById.get(id) ?? "Comunidad")
                        .join(", ")
                    : "Sin comunidad"}
                </p>

                <p style={{ margin: 0 }}>
                  <strong>Disponibilidad:</strong>{" "}
                  {availabilitySummary(playerAvailability)}
                </p>

                <p style={{ margin: 0 }}>
                  <strong>Lado:</strong>{" "}
                  {normalizeSide(player.preferred_side) === "reves"
                    ? "Revés"
                    : normalizeSide(player.preferred_side) === "drive"
                      ? "Drive"
                      : "Cualquiera"}
                </p>
              </div>

              {player.notes ? (
                <p style={{ marginTop: 10 }}>
                  <strong>Nota:</strong> {player.notes}
                </p>
              ) : null}

              {editingId === player.id
                ? renderPlayerForm(`Editar ${fullName(player)}`, "Guardar cambios")
                : null}
            </div>
          );
        })}
      </div>

      {!filteredPlayers.length ? (
        <div className="card">
          <h2>No hay jugadores con esos filtros</h2>

          <p className="help-text">
            Prueba quitar algún filtro o agrega un jugador nuevo.
          </p>
        </div>
      ) : null}
    </>
  );
}