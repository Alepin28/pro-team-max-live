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

const ACTIVE_PLAYER_LIMIT = 500;
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

const REAL_CATEGORIES = CATEGORY_OPTIONS.filter(
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

function timeValue(value?: string | null) {
  return (value ?? "00:00").slice(0, 5);
}

function fullName(player: PlayerRow) {
  return [player.first_name, player.last_name].filter(Boolean).join(" ");
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

function categoryLabel(value?: string | null) {
  const normalized = normalizeCategory(value);
  return (
    CATEGORY_OPTIONS.find((item) => item.value === normalized)?.label ??
    "Por categorizar"
  );
}

function normalizeGender(value?: string | null): Gender {
  return value === "mujer" || value === "femenino" ? "mujer" : "hombre";
}

function genderLabel(value?: string | null) {
  return normalizeGender(value) === "mujer" ? "Mujer" : "Hombre";
}

function normalizeSide(value?: string | null): Side {
  if (value === "drive" || value === "reves" || value === "cualquiera") {
    return value;
  }
  return "cualquiera";
}

function sideLabel(value?: string | null) {
  const normalized = normalizeSide(value);
  if (normalized === "drive") return "Drive";
  if (normalized === "reves") return "Revés";
  return "Cualquiera";
}

function dayLabel(value: number) {
  return DAYS.find((item) => item.value === value)?.label ?? `Día ${value}`;
}

function defaultFullAvailability(): AvailabilityDraft[] {
  return DAYS.map((day) => ({
    dayOfWeek: day.value,
    enabled: true,
    startTime: "07:00",
    endTime: "22:00",
  }));
}

function weeklyAvailabilityFromRows(
  rows: AvailabilityRow[] = []
): AvailabilityDraft[] {
  if (!rows.length) return defaultFullAvailability();

  return DAYS.map((day) => {
    const saved = rows.find((row) => row.day_of_week === day.value);
    return {
      dayOfWeek: day.value,
      enabled: Boolean(saved),
      startTime: saved ? timeValue(saved.start_time) : "07:00",
      endTime: saved ? timeValue(saved.end_time) : "22:00",
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
    .sort((a, b) => a.day_of_week - b.day_of_week)
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
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("No se pudo preparar la imagen."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
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
  const [playerCommunities, setPlayerCommunities] = useState<
    PlayerCommunityRow[]
  >([]);
  const [availabilityRows, setAvailabilityRows] = useState<AvailabilityRow[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
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
    void loadData(true);
  }, []);

  async function loadData(clearNotice = false) {
    setLoading(true);
    if (clearNotice) setNotice("");

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
          return (
            timeValue(row.start_time) <= selectedTime &&
            selectedTime <= timeValue(row.end_time)
          );
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
          genderLabel(player.gender),
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

  const selectedPlayerIdSet = useMemo(
    () => new Set(selectedPlayerIds),
    [selectedPlayerIds]
  );

  const selectedPlayers = useMemo(
    () => players.filter((player) => selectedPlayerIdSet.has(player.id)),
    [players, selectedPlayerIdSet]
  );

  const selectedCount = selectedPlayers.length;
  const allVisibleSelected =
    filteredPlayers.length > 0 &&
    filteredPlayers.every((player) => selectedPlayerIdSet.has(player.id));

  function resetFormState() {
    setForm(emptyForm());
    setBulkStartTime("07:00");
    setBulkEndTime("22:00");
  }

  function closeForm() {
    setShowCreateForm(false);
    setEditingId(null);
    resetFormState();
  }

  function openCreateForm() {
    setEditingId(null);
    resetFormState();
    setShowCreateForm(true);
    setNotice("");
  }

  function openEditForm(player: PlayerRow) {
    if (editingId === player.id) {
      closeForm();
      return;
    }

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
      communityIds: communityIdsByPlayer.get(player.id) ?? [],
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

  function togglePlayerSelection(playerId: string) {
    setSelectedPlayerIds((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId]
    );
  }

  function selectVisiblePlayers() {
    if (!filteredPlayers.length) {
      setNotice("No hay jugadores visibles para seleccionar.");
      return;
    }
    setSelectedPlayerIds((current) => {
      const next = new Set(current);
      filteredPlayers.forEach((player) => next.add(player.id));
      return Array.from(next);
    });
    setNotice(`${filteredPlayers.length} jugador(es) visibles seleccionados.`);
  }

  function clearSelectedPlayers() {
    setSelectedPlayerIds([]);
    setNotice("Selección limpiada.");
  }

  async function bulkSetActive(nextActive: boolean) {
    if (!selectedCount) {
      setNotice("Selecciona al menos un jugador.");
      return;
    }

    const playersToChange = selectedPlayers.filter(
      (player) => (player.active !== false) !== nextActive
    );
    if (!playersToChange.length) {
      setNotice(
        nextActive
          ? "Los jugadores seleccionados ya están activos."
          : "Los jugadores seleccionados ya están inactivos."
      );
      return;
    }

    if (nextActive) {
      const activatingCount = playersToChange.filter(
        (player) => player.active === false
      ).length;
      if (activeCount + activatingCount > ACTIVE_PLAYER_LIMIT) {
        setNotice(
          `No se puede activar ese bloque porque pasaría el límite de ${ACTIVE_PLAYER_LIMIT} jugadores activos.`
        );
        return;
      }
    }

    const action = nextActive ? "activar" : "desactivar";
    if (
      !window.confirm(
        `¿Seguro que quieres ${action} ${playersToChange.length} jugador(es)?`
      )
    ) {
      return;
    }

    setBulkSaving(true);
    setNotice(
      nextActive
        ? "Activando jugadores seleccionados..."
        : "Desactivando jugadores seleccionados..."
    );

    try {
      const ids = playersToChange.map((player) => player.id);
      const { error } = await supabase
        .from("players")
        .update({ active: nextActive })
        .eq("account_id", DEMO_ACCOUNT_ID)
        .in("id", ids);
      if (error) throw error;

      if (editingId && ids.includes(editingId)) closeForm();
      setSelectedPlayerIds([]);
      await loadData(false);
      setNotice(
        nextActive
          ? `${ids.length} jugador(es) activado(s).`
          : `${ids.length} jugador(es) desactivado(s).`
      );
    } catch (error: any) {
      setNotice(`No se pudo actualizar el bloque: ${error.message}`);
    } finally {
      setBulkSaving(false);
    }
  }

  async function deletePlayerBlock(playersToDelete: PlayerRow[]) {
    if (!playersToDelete.length) {
      setNotice("Selecciona al menos un jugador para eliminar.");
      return;
    }

    const confirmText = window.prompt(
      `Vas a ELIMINAR definitivamente ${playersToDelete.length} jugador(es).\n\n` +
        "Úsalo solamente para pruebas, duplicados o errores. Para jugadores reales, es mejor desactivar.\n\n" +
        "Escribe ELIMINAR para continuar."
    );
    if (confirmText !== "ELIMINAR") {
      setNotice("Eliminación cancelada.");
      return;
    }

    const ids = playersToDelete.map((player) => player.id);
    setBulkSaving(true);
    setNotice("Eliminando jugadores...");

    try {
      const { error } = await supabase.rpc(
        "ptm_delete_players_permanent_v1",
        {
          p_account_id: DEMO_ACCOUNT_ID,
          p_player_ids: ids,
        }
      );
      if (error) throw error;

      if (editingId && ids.includes(editingId)) closeForm();
      setSelectedPlayerIds((current) =>
        current.filter((id) => !ids.includes(id))
      );
      await loadData(false);
      setNotice(`${ids.length} jugador(es) eliminado(s) definitivamente.`);
    } catch (error: any) {
      setNotice(
        `No se pudo eliminar. Si tiene historial real, desactívalo. Detalle: ${error.message}`
      );
    } finally {
      setBulkSaving(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("activos");
    setCategoryFilter("todas");
    setCommunityFilter("todas");
    setDayFilter("todos");
    setTimeFilter("");
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
        row.dayOfWeek === dayOfWeek ? { ...row, [field]: value } : row
      ),
    }));
  }

  function setAvailabilityPreset(preset: "weekdays" | "weekend" | "all" | "none") {
    setForm((current) => ({
      ...current,
      availability: current.availability.map((row) => {
        const enabled =
          preset === "all"
            ? true
            : preset === "none"
              ? false
              : preset === "weekdays"
                ? row.dayOfWeek >= 1 && row.dayOfWeek <= 5
                : row.dayOfWeek === 6 || row.dayOfWeek === 7;
        return {
          ...row,
          enabled,
          startTime: enabled ? row.startTime || "07:00" : row.startTime,
          endTime: enabled ? row.endTime || "22:00" : row.endTime,
        };
      }),
    }));
  }

  function applyBulkSchedule() {
    const enabledRows = form.availability.filter((row) => row.enabled);
    if (!enabledRows.length) {
      setNotice("Selecciona al menos un día antes de aplicar el horario.");
      return;
    }
    if (!bulkStartTime || !bulkEndTime || bulkStartTime >= bulkEndTime) {
      setNotice("Revisa la hora inicial y final.");
      return;
    }

    setForm((current) => ({
      ...current,
      availability: current.availability.map((row) =>
        row.enabled
          ? { ...row, startTime: bulkStartTime, endTime: bulkEndTime }
          : row
      ),
    }));
    setNotice(
      `Horario ${bulkStartTime}–${bulkEndTime} aplicado a ${enabledRows.length} día(s).`
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
      setForm((current) => ({ ...current, profileImageUrl }));
      setNotice("Imagen preparada. Presiona Guardar cambios para conservarla.");
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
      return "La categoría secundaria debe ser inmediatamente superior o inferior.";
    }

    for (const row of form.availability.filter((item) => item.enabled)) {
      if (!row.startTime || !row.endTime || row.startTime >= row.endTime) {
        return `Revisa el horario de ${dayLabel(row.dayOfWeek)}.`;
      }
    }

    const existing = editingId
      ? players.find((player) => player.id === editingId)
      : null;
    const isActivating = form.active && existing?.active === false;
    const isCreatingActive = form.active && !editingId;
    if (
      (isActivating || isCreatingActive) &&
      activeCount >= ACTIVE_PLAYER_LIMIT
    ) {
      return `Llegaste al límite de ${ACTIVE_PLAYER_LIMIT} jugadores activos.`;
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

    const wasEditing = Boolean(editingId);
    setSaving(true);
    setNotice(wasEditing ? "Guardando cambios..." : "Creando jugador...");

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

      const reusedExisting = result?.reused_existing_player === true;
      closeForm();
      await loadData(false);
      setNotice(
        wasEditing
          ? "Jugador actualizado correctamente."
          : reusedExisting
            ? "El WhatsApp ya existía. Se recuperó y actualizó ese jugador."
            : form.primaryCategory === "UNCATEGORIZED"
              ? "Jugador creado como Por categorizar."
              : "Jugador creado correctamente."
      );
    } catch (error: any) {
      setNotice(`No se pudo guardar el jugador: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  function renderPlayerForm(mode: "create" | "edit") {
    const title = mode === "edit" ? "Editar jugador" : "Agregar jugador";
    const saveText = mode === "edit" ? "Guardar cambios" : "Crear jugador";
    const activeCommunities = communities.filter(
      (community) => community.active !== false
    );

    return (
      <form className="player-editor" onSubmit={handleSubmit}>
        <div className="player-editor-heading">
          <div>
            <h2>{title}</h2>
            <p className="help-text">
              Cambia todos los datos que necesites. Nada se guarda hasta presionar
              <strong> {saveText}</strong>.
            </p>
          </div>
          <button className="btn secondary" type="button" onClick={closeForm}>
            Cerrar
          </button>
        </div>

        <div className="player-main-grid">
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
              placeholder="Ej: Anthony"
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
              placeholder="Ej: Barona"
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
                    !["👨", "👩"].includes(current.avatarEmoji)
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

        <div className="communities-main-block">
          <h3>Comunidades</h3>
          <p className="help-text">
            Este dato queda visible aquí porque se usa todos los días. Puede marcar
            una, varias o ninguna.
          </p>
          <div className="community-check-grid">
            {activeCommunities.length ? (
              activeCommunities.map((community) => (
                <label className="community-check" key={community.id}>
                  <input
                    checked={form.communityIds.includes(community.id)}
                    type="checkbox"
                    onChange={() => toggleCommunity(community.id)}
                  />
                  <span>{community.name}</span>
                </label>
              ))
            ) : (
              <p className="help-text">No hay comunidades activas.</p>
            )}
          </div>
        </div>

        <details className="advanced-editor">
          <summary>Opciones avanzadas</summary>

          <div className="advanced-grid">
            <label>
              Categoría secundaria
              <select
                disabled={form.primaryCategory === "UNCATEGORIZED"}
                value={form.secondaryCategory}
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
          </div>

          <div className="photo-editor">
            <PlayerVisual
              avatarEmoji={form.avatarEmoji}
              imageUrl={form.profileImageUrl}
              large
              name={`${form.firstName} ${form.lastName}`.trim()}
            />
            <div>
              <h3>Foto o avatar</h3>
              <div className="row-actions">
                <label className="btn edit file-button">
                  Elegir foto
                  <input
                    hidden
                    accept="image/*"
                    capture="environment"
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

          <div className="availability-block">
            <h3>Disponibilidad semanal</h3>
            <div className="row-actions">
              <button
                className="btn secondary"
                type="button"
                onClick={() => setAvailabilityPreset("all")}
              >
                Todos
              </button>
              <button
                className="btn secondary"
                type="button"
                onClick={() => setAvailabilityPreset("weekdays")}
              >
                Lunes a viernes
              </button>
              <button
                className="btn secondary"
                type="button"
                onClick={() => setAvailabilityPreset("weekend")}
              >
                Fin de semana
              </button>
              <button
                className="btn secondary"
                type="button"
                onClick={() => setAvailabilityPreset("none")}
              >
                Limpiar días
              </button>
            </div>

            <div className="schedule-apply-row">
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
              <button className="btn edit" type="button" onClick={applyBulkSchedule}>
                Aplicar horario
              </button>
            </div>

            <div className="availability-days">
              {form.availability.map((row) => (
                <div className="availability-day" key={row.dayOfWeek}>
                  <label className="day-check">
                    <input
                      checked={row.enabled}
                      type="checkbox"
                      onChange={(event) =>
                        updateAvailability(
                          row.dayOfWeek,
                          "enabled",
                          event.target.checked
                        )
                      }
                    />
                    <span>{dayLabel(row.dayOfWeek)}</span>
                  </label>
                  <input
                    disabled={!row.enabled}
                    type="time"
                    value={row.startTime}
                    onChange={(event) =>
                      updateAvailability(
                        row.dayOfWeek,
                        "startTime",
                        event.target.value
                      )
                    }
                  />
                  <input
                    disabled={!row.enabled}
                    type="time"
                    value={row.endTime}
                    onChange={(event) =>
                      updateAvailability(
                        row.dayOfWeek,
                        "endTime",
                        event.target.value
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="advanced-grid notes-grid">
            <label>
              Nota de disponibilidad
              <textarea
                rows={3}
                value={form.availabilityNotes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    availabilityNotes: event.target.value,
                  }))
                }
                placeholder="Ej: Solo puede después de las 18:00"
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
                placeholder="Notas para el equipo"
              />
            </label>
          </div>
        </details>

        <div className="editor-actions">
          <button className="btn save" disabled={saving} type="submit">
            {saving ? "Guardando..." : saveText}
          </button>
          <button
            className="btn secondary"
            disabled={saving}
            type="button"
            onClick={closeForm}
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
      <style>{`
        .players-mobile-list { display: flex; flex-direction: column; gap: 8px; }
        .players-summary-card, .players-filters-card, .players-bulk-card { margin-bottom: 10px !important; }
        .players-filter-top { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: end; }
        .players-filter-details { margin-top: 10px; }
        .players-filter-details summary, .advanced-editor summary { cursor: pointer; font-weight: 900; color: #334155; }
        .players-bulk-layout { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; }
        .players-bulk-title { margin: 0; font-size: 15px; font-weight: 950; }
        .players-bulk-text { margin: 2px 0 0; color: #64748b; font-size: 12px; }
        .player-compact-card { padding: 10px 12px !important; border-radius: 16px !important; margin: 0 !important; }
        .player-compact-top { display: grid; grid-template-columns: 20px 42px minmax(0, 1fr) auto; gap: 9px; align-items: center; }
        .player-row-checkbox { width: 17px; height: 17px; cursor: pointer; }
        .player-avatar { width: 42px; height: 42px; min-width: 42px; border-radius: 50%; object-fit: cover; display: flex; align-items: center; justify-content: center; background: #e2e8f0; font-size: 21px; }
        .player-avatar.large { width: 72px; height: 72px; min-width: 72px; font-size: 34px; }
        .player-compact-info { min-width: 0; }
        .player-compact-name { margin: 0; font-size: 16px; line-height: 1.05; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .player-compact-phone { margin: 2px 0 0; font-size: 11px; color: #64748b; }
        .player-compact-badges { display: flex; gap: 4px; margin-top: 5px; overflow: hidden; }
        .player-compact-badge { display: inline-flex; border-radius: 999px; padding: 3px 7px; background: #e5e7eb; color: #334155; font-size: 10px; font-weight: 900; white-space: nowrap; max-width: 115px; overflow: hidden; text-overflow: ellipsis; }
        .player-compact-badge.good { background: #ccfbf1; color: #0f766e; }
        .player-compact-badge.warn { background: #fef3c7; color: #92400e; }
        .player-compact-edit { min-height: 34px !important; padding: 7px 10px !important; font-size: 12px !important; }
        .player-row-secondary { margin-top: 7px; padding-top: 7px; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; justify-content: space-between; align-items: center; }
        .player-row-secondary-text { min-width: 0; color: #64748b; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .player-editor-wrap { margin-top: 10px; border-top: 2px solid #cbd5e1; padding-top: 10px; }
        .player-editor { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 16px; padding: 14px; }
        .player-editor-heading { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; margin-bottom: 12px; }
        .player-editor-heading h2 { margin: 0 0 3px; }
        .player-main-grid, .advanced-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .communities-main-block { margin-top: 14px; padding: 12px; border-radius: 14px; background: white; border: 1px solid #dbe4ee; }
        .communities-main-block h3 { margin: 0 0 3px; }
        .community-check-grid { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
        .community-check { display: inline-flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 999px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; font-size: 12px; font-weight: 800; }
        .community-check input { width: 16px; height: 16px; margin: 0; }
        .advanced-editor { margin-top: 14px; padding: 12px; border-radius: 14px; background: white; border: 1px solid #dbe4ee; }
        .advanced-editor > summary { margin-bottom: 10px; }
        .photo-editor { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: center; margin-top: 14px; }
        .file-button { cursor: pointer; }
        .avatar-picker { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .avatar-option { width: 38px; height: 38px; border-radius: 10px; border: 1px solid #cbd5e1; background: white; cursor: pointer; font-size: 21px; }
        .avatar-option.selected { border: 2px solid #0f766e; background: #ccfbf1; }
        .availability-block { margin-top: 14px; }
        .schedule-apply-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: end; margin: 10px 0; }
        .availability-days { display: grid; gap: 6px; }
        .availability-day { display: grid; grid-template-columns: minmax(120px, 1fr) 120px 120px; gap: 8px; align-items: center; }
        .day-check { display: flex; align-items: center; gap: 7px; margin: 0; }
        .day-check input { width: 17px; height: 17px; margin: 0; }
        .notes-grid { margin-top: 14px; grid-template-columns: 1fr 1fr; }
        .editor-actions { display: flex; gap: 8px; margin-top: 14px; position: sticky; bottom: 68px; padding: 9px; border-radius: 12px; background: rgba(248, 250, 252, 0.96); border: 1px solid #dbe4ee; z-index: 3; }
        .editor-actions .btn.save { flex: 1; }
        .notice-card { margin-bottom: 10px !important; padding: 9px 12px !important; }
        @media (max-width: 760px) {
          .players-summary-card, .players-filters-card, .players-bulk-card { padding: 9px 10px !important; border-radius: 14px !important; margin-bottom: 7px !important; }
          .players-bulk-layout { grid-template-columns: 1fr; }
          .players-bulk-card .row-actions { gap: 4px !important; }
          .players-bulk-card .btn { min-height: 29px !important; padding: 5px 7px !important; font-size: 10px !important; }
          .players-filter-top { grid-template-columns: minmax(0, 1fr) 72px; gap: 6px; }
          .player-compact-card { padding: 7px 8px !important; border-radius: 13px !important; }
          .player-compact-top { grid-template-columns: 17px 32px minmax(0, 1fr) 58px; gap: 5px; }
          .player-row-checkbox { width: 15px; height: 15px; }
          .player-avatar { width: 32px; height: 32px; min-width: 32px; font-size: 16px; }
          .player-compact-name { font-size: 13px; }
          .player-compact-phone { font-size: 9.5px; margin-top: 1px; }
          .player-compact-badges { gap: 3px; margin-top: 3px; }
          .player-compact-badge { padding: 2px 5px; font-size: 9px; max-width: 72px; }
          .player-compact-edit { min-height: 28px !important; padding: 4px 5px !important; font-size: 10px !important; }
          .player-row-secondary { margin-top: 5px; padding-top: 5px; }
          .player-row-secondary-text { font-size: 9.5px; }
          .player-row-secondary .btn { min-height: 26px !important; padding: 3px 6px !important; font-size: 9.5px !important; }
          .player-editor { padding: 10px; border-radius: 13px; }
          .player-editor-heading { align-items: center; }
          .player-editor-heading h2 { font-size: 17px; }
          .player-editor-heading .help-text { font-size: 11px; }
          .player-main-grid, .advanced-grid, .notes-grid { grid-template-columns: 1fr 1fr; gap: 7px; }
          .player-main-grid label, .advanced-grid label { font-size: 10.5px !important; }
          .player-main-grid input, .player-main-grid select, .advanced-grid input, .advanced-grid select, .advanced-grid textarea { min-height: 34px !important; padding: 6px 8px !important; font-size: 12px !important; }
          .communities-main-block, .advanced-editor { padding: 9px; margin-top: 9px; }
          .community-check { padding: 5px 7px; font-size: 10px; }
          .photo-editor { grid-template-columns: 54px minmax(0, 1fr); gap: 8px; }
          .player-avatar.large { width: 54px; height: 54px; min-width: 54px; font-size: 26px; }
          .avatar-option { width: 32px; height: 32px; font-size: 17px; }
          .schedule-apply-row { grid-template-columns: 1fr 1fr; }
          .schedule-apply-row .btn { grid-column: 1 / -1; }
          .availability-day { grid-template-columns: minmax(92px, 1fr) 90px 90px; gap: 5px; }
          .availability-day input[type="time"] { min-width: 0; padding: 5px !important; font-size: 10px !important; }
          .day-check { font-size: 10.5px !important; }
          .editor-actions { bottom: 62px; }
        }
        @media (max-width: 430px) {
          .player-main-grid, .advanced-grid, .notes-grid { grid-template-columns: 1fr; }
          .availability-day { grid-template-columns: 1fr 82px 82px; }
        }
      `}</style>

      <PageHeader
        title="Jugadores"
        description="Lista compacta para la operación diaria. Edita y guarda todo junto."
        action={
          <div className="row-actions">
            <Link className="btn edit" href="/jugadores/importar">
              Importar
            </Link>
            <button
              className="btn save"
              type="button"
              onClick={showCreateForm ? closeForm : openCreateForm}
            >
              {showCreateForm ? "Cerrar" : "Agregar jugador"}
            </button>
          </div>
        }
      />

      <div className="card players-summary-card">
        <div className="row-actions">
          <span className="badge good">
            Activos: {activeCount}/{ACTIVE_PLAYER_LIMIT}
          </span>
          <span className="badge neutral">Total: {players.length}</span>
          <span className="badge warn">
            Por categorizar: {pendingCategoryCount}
          </span>
          <span className="badge neutral">
            Inactivos: {players.length - activeCount}
          </span>
          <button className="btn secondary" type="button" onClick={() => void loadData(true)}>
            Actualizar
          </button>
        </div>
      </div>

      {notice ? (
        <div className="card notice-card">
          <strong>{notice}</strong>
        </div>
      ) : null}

      {showCreateForm ? (
        <div className="card" style={{ marginBottom: 10 }}>
          {renderPlayerForm("create")}
        </div>
      ) : null}

      <div className="card players-filters-card">
        <div className="players-filter-top">
          <label>
            Buscar
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre, WhatsApp o comunidad"
            />
          </label>
          <button className="btn secondary" type="button" onClick={clearFilters}>
            Limpiar
          </button>
        </div>

        <details className="players-filter-details">
          <summary>Filtros avanzados · {filteredPlayers.length} resultado(s)</summary>
          <div className="grid grid-4" style={{ marginTop: 10 }}>
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
              Día
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
        </details>
      </div>

      <div className="card players-bulk-card">
        <div className="players-bulk-layout">
          <div>
            <p className="players-bulk-title">
              Acciones por bloque · {selectedCount} seleccionado(s)
            </p>
            <p className="players-bulk-text">
              Selecciona jugadores y cambia el estado de todos juntos.
            </p>
          </div>
          <div className="row-actions">
            <button
              className="btn secondary"
              disabled={bulkSaving}
              type="button"
              onClick={allVisibleSelected ? clearSelectedPlayers : selectVisiblePlayers}
            >
              {allVisibleSelected ? "Limpiar selección" : "Seleccionar visibles"}
            </button>
            <button
              className="btn activate"
              disabled={bulkSaving || !selectedCount}
              type="button"
              onClick={() => void bulkSetActive(true)}
            >
              Activar
            </button>
            <button
              className="btn deactivate"
              disabled={bulkSaving || !selectedCount}
              type="button"
              onClick={() => void bulkSetActive(false)}
            >
              Desactivar
            </button>
            <button
              className="btn delete"
              disabled={bulkSaving || !selectedCount}
              type="button"
              onClick={() => void deletePlayerBlock(selectedPlayers)}
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>

      <div className="players-mobile-list">
        {filteredPlayers.map((player) => {
          const assignedCommunityIds = communityIdsByPlayer.get(player.id) ?? [];
          const assignedCommunityNames = assignedCommunityIds
            .map((id) => communityNameById.get(id) ?? "Comunidad")
            .join(", ");
          const isActive = player.active !== false;
          const isEditing = editingId === player.id;
          const playerAvailability = availabilityByPlayer.get(player.id) ?? [];

          return (
            <div className="card player-compact-card" key={player.id}>
              <div className="player-compact-top">
                <input
                  aria-label={`Seleccionar ${fullName(player)}`}
                  checked={selectedPlayerIdSet.has(player.id)}
                  className="player-row-checkbox"
                  type="checkbox"
                  onChange={() => togglePlayerSelection(player.id)}
                />

                <PlayerVisual
                  avatarEmoji={
                    player.avatar_emoji ??
                    (normalizeGender(player.gender) === "mujer" ? "👩" : "👨")
                  }
                  imageUrl={player.profile_image_url ?? ""}
                  name={fullName(player)}
                />

                <div className="player-compact-info">
                  <h2 className="player-compact-name">{fullName(player)}</h2>
                  <p className="player-compact-phone">
                    {player.whatsapp || "Sin WhatsApp"}
                  </p>
                  <div className="player-compact-badges">
                    <span
                      className={`player-compact-badge ${
                        isActive ? "good" : "warn"
                      }`}
                    >
                      {isActive ? "Activo" : "Inactivo"}
                    </span>
                    <span className="player-compact-badge">
                      {categoryLabel(player.validated_category)}
                    </span>
                    <span className="player-compact-badge">
                      {genderLabel(player.gender)}
                    </span>
                    <span className="player-compact-badge">
                      {assignedCommunityNames || "Sin comunidad"}
                    </span>
                  </div>
                </div>

                <button
                  className={
                    isEditing
                      ? "btn secondary player-compact-edit"
                      : "btn edit player-compact-edit"
                  }
                  type="button"
                  onClick={() => openEditForm(player)}
                >
                  {isEditing ? "Cerrar" : "Editar"}
                </button>
              </div>

              <div className="player-row-secondary">
                <span className="player-row-secondary-text">
                  {sideLabel(player.preferred_side)} · {availabilitySummary(playerAvailability)}
                </span>
                <button
                  className="btn delete"
                  disabled={bulkSaving}
                  type="button"
                  onClick={() => void deletePlayerBlock([player])}
                >
                  Eliminar
                </button>
              </div>

              {isEditing ? (
                <div className="player-editor-wrap">
                  {renderPlayerForm("edit")}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {!filteredPlayers.length ? (
        <div className="card">
          <h2>No hay jugadores con esos filtros</h2>
          <p className="help-text">
            Limpia los filtros o agrega un jugador nuevo.
          </p>
        </div>
      ) : null}
    </>
  );
}