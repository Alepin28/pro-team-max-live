"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DEMO_ACCOUNT_ID } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";

type Category = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7";

type CommunityRow = {
  id: string;
  sport_id: string | null;
  name: string;
  whatsapp: string | null;
  city: string | null;
  default_category: string | null;
  active: boolean | null;
};

type VenueRow = {
  id: string;
  name: string;
  city: string | null;
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

type CommunityForm = {
  name: string;
  whatsapp: string;
  city: string;
  active: boolean;
  categories: Category[];
  venueIds: string[];
};

type StatusFilter = "activas" | "inactivas" | "todas";
type CategoryFilter = "todas" | Category;
type VenueFilter = "todas" | string;

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "C1", label: "Primera" },
  { value: "C2", label: "Segunda" },
  { value: "C3", label: "Tercera" },
  { value: "C4", label: "Cuarta" },
  { value: "C5", label: "Quinta" },
  { value: "C6", label: "Sexta" },
  { value: "C7", label: "Novatos" },
];

const EMPTY_FORM: CommunityForm = {
  name: "",
  whatsapp: "",
  city: "Guayaquil",
  active: true,
  categories: [],
  venueIds: [],
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function normalizeWhatsappForLink(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) return "";

  if (digits.startsWith("593")) return digits;
  if (digits.startsWith("0")) return `593${digits.slice(1)}`;

  return digits;
}

function isActiveCommunity(community: CommunityRow) {
  return community.active !== false;
}

function categoryLabel(category: Category) {
  return CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

function formatCategoryScope(categories: Category[]) {
  if (!categories.length) return "Todas las categorías";

  return categories.map(categoryLabel).join(", ");
}

function formatVenueScope(venueIds: string[], venues: VenueRow[]) {
  if (!venueIds.length) return "Todas las sedes";

  const names = venueIds
    .map((venueId) => venues.find((venue) => venue.id === venueId)?.name)
    .filter(Boolean);

  return names.length ? names.join(", ") : "Sedes seleccionadas";
}

function toggleArrayValue<T extends string>(values: T[], value: T) {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }

  return [...values, value];
}

export default function ComunidadesPage() {
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, Category[]>>({});
  const [venueMap, setVenueMap] = useState<Record<string, string[]>>({});

  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});
  const [templateCounts, setTemplateCounts] = useState<Record<string, number>>(
    {}
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("activas");
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>("todas");
  const [venueFilter, setVenueFilter] = useState<VenueFilter>("todas");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CommunityForm>(EMPTY_FORM);

  useEffect(() => {
    void loadCommunities();
  }, []);

  async function loadCommunities() {
    setLoading(true);
    setNotice("");

    try {
      const [
        communitiesRes,
        venuesRes,
        communityCategoriesRes,
        communityVenuesRes,
        playerCommunitiesRes,
        eventsRes,
        templatesRes,
      ] = await Promise.all([
        supabase
          .from("communities")
          .select(
            "id, sport_id, name, whatsapp, city, default_category, active"
          )
          .eq("account_id", DEMO_ACCOUNT_ID)
          .order("name"),

        supabase
          .from("venues")
          .select("id, name, city, active")
          .eq("account_id", DEMO_ACCOUNT_ID)
          .order("name"),

        supabase
          .from("community_categories")
          .select("community_id, category")
          .eq("account_id", DEMO_ACCOUNT_ID),

        supabase
          .from("community_venues")
          .select("community_id, venue_id")
          .eq("account_id", DEMO_ACCOUNT_ID),

        supabase
          .from("player_communities")
          .select("community_id, player_id"),

        supabase
          .from("events")
          .select("id, community_id")
          .eq("account_id", DEMO_ACCOUNT_ID),

        supabase
          .from("event_templates")
          .select("id, community_id"),
      ]);

      if (communitiesRes.error) throw communitiesRes.error;
      if (venuesRes.error) throw venuesRes.error;
      if (communityCategoriesRes.error) throw communityCategoriesRes.error;
      if (communityVenuesRes.error) throw communityVenuesRes.error;
      if (playerCommunitiesRes.error) throw playerCommunitiesRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (templatesRes.error) throw templatesRes.error;

      const communityRows = (communitiesRes.data ?? []) as CommunityRow[];
      const venueRows = (venuesRes.data ?? []) as VenueRow[];

      setCommunities(communityRows);
      setVenues(venueRows);

      const nextCategoryMap: Record<string, Category[]> = {};

      for (const row of (communityCategoriesRes.data ??
        []) as CommunityCategoryRow[]) {
        if (!row.community_id || !row.category) continue;

        nextCategoryMap[row.community_id] = [
          ...(nextCategoryMap[row.community_id] ?? []),
          row.category,
        ];
      }

      setCategoryMap(nextCategoryMap);

      const nextVenueMap: Record<string, string[]> = {};

      for (const row of (communityVenuesRes.data ??
        []) as CommunityVenueRow[]) {
        if (!row.community_id || !row.venue_id) continue;

        nextVenueMap[row.community_id] = [
          ...(nextVenueMap[row.community_id] ?? []),
          row.venue_id,
        ];
      }

      setVenueMap(nextVenueMap);

      const nextPlayerCounts: Record<string, number> = {};

      for (const row of playerCommunitiesRes.data ?? []) {
        const communityId = row.community_id as string;

        if (!communityId) continue;

        nextPlayerCounts[communityId] =
          (nextPlayerCounts[communityId] ?? 0) + 1;
      }

      setPlayerCounts(nextPlayerCounts);

      const nextMatchCounts: Record<string, number> = {};

      for (const row of eventsRes.data ?? []) {
        const communityId = row.community_id as string;

        if (!communityId) continue;

        nextMatchCounts[communityId] =
          (nextMatchCounts[communityId] ?? 0) + 1;
      }

      setMatchCounts(nextMatchCounts);

      const nextTemplateCounts: Record<string, number> = {};

      for (const row of templatesRes.data ?? []) {
        const communityId = row.community_id as string;

        if (!communityId) continue;

        nextTemplateCounts[communityId] =
          (nextTemplateCounts[communityId] ?? 0) + 1;
      }

      setTemplateCounts(nextTemplateCounts);
    } catch (error: any) {
      setNotice(`No se pudieron cargar las comunidades: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function getPadelSportId() {
    const fromCurrentCommunity = communities.find(
      (community) => community.sport_id
    )?.sport_id;

    if (fromCurrentCommunity) return fromCurrentCommunity;

    const { data, error } = await supabase
      .from("sports")
      .select("id")
      .eq("code", "padel")
      .maybeSingle();

    if (error) throw error;

    if (!data?.id) {
      throw new Error("No encontré el deporte pádel en Supabase.");
    }

    return data.id as string;
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setNotice("");
  }

  function openEditForm(community: CommunityRow) {
    setEditingId(community.id);
    setForm({
      name: community.name,
      whatsapp: community.whatsapp ?? "",
      city: community.city ?? "Guayaquil",
      active: community.active !== false,
      categories: categoryMap[community.id] ?? [],
      venueIds: venueMap[community.id] ?? [],
    });
    setShowForm(true);
    setNotice("");
  }

  function closeForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(false);
    setSaving(false);
  }

  function toggleCategory(category: Category) {
    setForm((current) => ({
      ...current,
      categories: toggleArrayValue(current.categories, category),
    }));
  }

  function toggleVenue(venueId: string) {
    setForm((current) => ({
      ...current,
      venueIds: toggleArrayValue(current.venueIds, venueId),
    }));
  }

  async function saveCommunityScopes(
    communityId: string,
    values: CommunityForm
  ) {
    const deleteCategoriesRes = await supabase
      .from("community_categories")
      .delete()
      .eq("account_id", DEMO_ACCOUNT_ID)
      .eq("community_id", communityId);

    if (deleteCategoriesRes.error) throw deleteCategoriesRes.error;

    const deleteVenuesRes = await supabase
      .from("community_venues")
      .delete()
      .eq("account_id", DEMO_ACCOUNT_ID)
      .eq("community_id", communityId);

    if (deleteVenuesRes.error) throw deleteVenuesRes.error;

    if (values.categories.length) {
      const { error } = await supabase.from("community_categories").insert(
        values.categories.map((category) => ({
          account_id: DEMO_ACCOUNT_ID,
          community_id: communityId,
          category,
        }))
      );

      if (error) throw error;
    }

    if (values.venueIds.length) {
      const { error } = await supabase.from("community_venues").insert(
        values.venueIds.map((venueId) => ({
          account_id: DEMO_ACCOUNT_ID,
          community_id: communityId,
          venue_id: venueId,
        }))
      );

      if (error) throw error;
    }
  }

  async function saveCommunity() {
    const name = form.name.trim();
    const whatsapp = form.whatsapp.trim() || null;
    const city = form.city.trim() || "Guayaquil";
    const wasEditing = Boolean(editingId);
    const editingCommunityId = editingId;

    if (!name) {
      setNotice("Escribe el nombre de la comunidad.");
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      let communityId = editingCommunityId;

      if (editingCommunityId) {
        const { error } = await supabase
          .from("communities")
          .update({
            name,
            whatsapp,
            city,
            default_category: null,
            active: form.active,
          })
          .eq("id", editingCommunityId)
          .eq("account_id", DEMO_ACCOUNT_ID);

        if (error) throw error;
      } else {
        const sportId = await getPadelSportId();

        const { data, error } = await supabase
          .from("communities")
          .insert({
            account_id: DEMO_ACCOUNT_ID,
            sport_id: sportId,
            name,
            whatsapp,
            city,
            default_category: null,
            active: form.active,
          })
          .select("id")
          .single();

        if (error) throw error;

        communityId = data.id as string;
      }

      if (!communityId) {
        throw new Error("No se pudo obtener el ID de la comunidad.");
      }

      await saveCommunityScopes(communityId, form);

      closeForm();
      await loadCommunities();

      setNotice(wasEditing ? "Comunidad actualizada." : "Comunidad creada.");
    } catch (error: any) {
      setNotice(`No se pudo guardar la comunidad: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCommunity(community: CommunityRow) {
    const players = playerCounts[community.id] ?? 0;
    const matches = matchCounts[community.id] ?? 0;
    const templates = templateCounts[community.id] ?? 0;

    if (players > 0 || matches > 0 || templates > 0) {
      setNotice(
        `No se puede eliminar "${community.name}" porque tiene ${players} jugador(es), ${matches} partido(s) y ${templates} plantilla(s). Desactívala desde Editar para conservar el historial.`
      );
      return;
    }

    const confirmation = window.prompt(
      `Vas a eliminar definitivamente la comunidad "${community.name}".\n\nEsta acción no se puede deshacer.\n\nEscribe ELIMINAR para continuar.`
    );

    if (confirmation !== "ELIMINAR") {
      setNotice("Eliminación cancelada. No se borró ninguna comunidad.");
      return;
    }

    setDeletingId(community.id);
    setNotice("");

    try {
      const { error } = await supabase.rpc(
        "ptm_delete_community_permanent_v1",
        {
          p_account_id: DEMO_ACCOUNT_ID,
          p_community_id: community.id,
        }
      );

      if (error) throw error;

      if (editingId === community.id) {
        closeForm();
      }

      await loadCommunities();
      setNotice(`Comunidad "${community.name}" eliminada definitivamente.`);
    } catch (error: any) {
      setNotice(`No se pudo eliminar la comunidad: ${error.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  const activeVenues = useMemo(() => {
    return venues.filter((venue) => venue.active !== false);
  }, [venues]);

  const venuesAvailableInForm = useMemo(() => {
    if (!editingId) return activeVenues;

    const selectedVenueIds = new Set(form.venueIds);

    return venues.filter(
      (venue) => venue.active !== false || selectedVenueIds.has(venue.id)
    );
  }, [activeVenues, editingId, form.venueIds, venues]);

  const stats = useMemo(() => {
    const active = communities.filter(isActiveCommunity);

    const totalPlayers = communities.reduce(
      (sum, community) => sum + (playerCounts[community.id] ?? 0),
      0
    );

    const totalMatches = communities.reduce(
      (sum, community) => sum + (matchCounts[community.id] ?? 0),
      0
    );

    const restrictedByCategory = communities.filter(
      (community) => (categoryMap[community.id] ?? []).length > 0
    ).length;

    const restrictedByVenue = communities.filter(
      (community) => (venueMap[community.id] ?? []).length > 0
    ).length;

    return {
      total: communities.length,
      active: active.length,
      inactive: communities.length - active.length,
      totalPlayers,
      totalMatches,
      restrictedByCategory,
      restrictedByVenue,
    };
  }, [communities, playerCounts, matchCounts, categoryMap, venueMap]);

  const filteredCommunities = useMemo(() => {
    const cleanQuery = normalizeText(query);

    return communities.filter((community) => {
      const active = isActiveCommunity(community);
      const categories = categoryMap[community.id] ?? [];
      const venueIds = venueMap[community.id] ?? [];

      if (statusFilter === "activas" && !active) return false;
      if (statusFilter === "inactivas" && active) return false;

      if (
        categoryFilter !== "todas" &&
        categories.length &&
        !categories.includes(categoryFilter)
      ) {
        return false;
      }

      if (
        venueFilter !== "todas" &&
        venueIds.length &&
        !venueIds.includes(venueFilter)
      ) {
        return false;
      }

      if (cleanQuery) {
        const haystack = normalizeText(
          `${community.name} ${community.whatsapp ?? ""} ${
            community.city ?? ""
          } ${formatCategoryScope(categories)} ${formatVenueScope(
            venueIds,
            venues
          )}`
        );

        if (!haystack.includes(cleanQuery)) return false;
      }

      return true;
    });
  }, [
    communities,
    query,
    statusFilter,
    categoryFilter,
    venueFilter,
    categoryMap,
    venueMap,
    venues,
  ]);

  function renderCommunityEditor(title: string) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <h2>{title}</h2>

        <p className="help-text">
          Cambia todos los datos necesarios y guarda una sola vez al final.
          Ningún campo se guarda automáticamente.
        </p>

        <div className="grid grid-2">
          <label>
            Nombre de la comunidad
            <input
              placeholder="Ej: Los Puertos, Padel Prox, La Perla"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </label>

          <label>
            WhatsApp de la comunidad
            <input
              inputMode="tel"
              placeholder="Ej: 0980822090"
              value={form.whatsapp}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  whatsapp: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Ciudad / zona
            <input
              placeholder="Ej: Guayaquil, Samborondón, Ceibos"
              value={form.city}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  city: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Estado
            <select
              value={form.active ? "activa" : "inactiva"}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  active: event.target.value === "activa",
                }))
              }
            >
              <option value="activa">Activa</option>
              <option value="inactiva">Inactiva</option>
            </select>
          </label>
        </div>

        <div style={{ height: 16 }} />

        <div className="mini-panel">
          <h3>Categorías permitidas</h3>

          <p className="help-text">
            Si no marcas ninguna, la comunidad acepta todas las categorías.
          </p>

          <div className="row-actions">
            <button
              className="btn secondary"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  categories: CATEGORIES.map((item) => item.value),
                }))
              }
              type="button"
            >
              Marcar todas
            </button>

            <button
              className="btn ghost"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  categories: [],
                }))
              }
              type="button"
            >
              Todas por defecto
            </button>
          </div>

          <div className="grid grid-4" style={{ marginTop: 12 }}>
            {CATEGORIES.map((category) => (
              <label
                key={category.value}
                className="mini-panel"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.categories.includes(category.value)}
                  onChange={() => toggleCategory(category.value)}
                />
                {category.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="mini-panel">
          <h3>Sedes permitidas</h3>

          <p className="help-text">
            Si no marcas ninguna, la comunidad puede jugar en todas las sedes.
          </p>

          <div className="row-actions">
            <button
              className="btn secondary"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  venueIds: activeVenues.map((venue) => venue.id),
                }))
              }
              type="button"
            >
              Marcar sedes activas
            </button>

            <button
              className="btn ghost"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  venueIds: [],
                }))
              }
              type="button"
            >
              Todas por defecto
            </button>
          </div>

          {!venuesAvailableInForm.length ? (
            <p className="help-text">
              No hay sedes activas cargadas. Crea o activa sedes primero.
            </p>
          ) : (
            <div className="grid grid-3" style={{ marginTop: 12 }}>
              {venuesAvailableInForm.map((venue) => (
                <label
                  key={venue.id}
                  className="mini-panel"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    opacity: venue.active === false ? 0.7 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.venueIds.includes(venue.id)}
                    onChange={() => toggleVenue(venue.id)}
                  />

                  <span>
                    <strong>{venue.name}</strong>
                    {venue.active === false ? " · Inactiva" : ""}
                    <br />
                    <span className="help-text">
                      {venue.city ?? "Guayaquil"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="row-actions" style={{ marginTop: 16 }}>
          <button className="btn" onClick={saveCommunity} disabled={saving}>
            {saving
              ? "Guardando..."
              : editingId
                ? "Guardar cambios"
                : "Crear comunidad"}
          </button>

          <button
            className="btn secondary"
            onClick={closeForm}
            disabled={saving}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <PageHeader
        title="Comunidades"
        description="Cargando comunidades desde Supabase..."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Comunidades"
        description="Administra nombre, WhatsApp, estado, categorías y sedes desde un solo lugar."
        action={
          <button className="btn" onClick={openCreateForm}>
            Crear comunidad
          </button>
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <span className="badge good">Datos: Supabase conectado</span>

        {notice ? (
          <p>
            <strong>{notice}</strong>
          </p>
        ) : null}

        <div style={{ height: 12 }} />

        <div className="row-actions">
          <button
            className="btn secondary"
            onClick={() => void loadCommunities()}
          >
            🔄 Actualizar comunidades
          </button>

          <button className="btn" onClick={openCreateForm}>
            Crear comunidad
          </button>
        </div>

        <p className="help-text">
          Una comunidad puede aceptar una, varias o todas las categorías y
          jugar en una, varias o todas las sedes.
        </p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card">
          <p className="help-text">Comunidades activas</p>
          <h2>{stats.active}</h2>
          <p className="help-text">
            Total: {stats.total} · Inactivas: {stats.inactive}
          </p>
        </div>

        <div className="card">
          <p className="help-text">Jugadores vinculados</p>
          <h2>{stats.totalPlayers}</h2>
          <p className="help-text">
            Partidos vinculados: {stats.totalMatches}
          </p>
        </div>

        <div className="card">
          <p className="help-text">Con categorías limitadas</p>
          <h2>{stats.restrictedByCategory}</h2>
          <p className="help-text">Las demás aceptan todas.</p>
        </div>

        <div className="card">
          <p className="help-text">Con sedes limitadas</p>
          <h2>{stats.restrictedByVenue}</h2>
          <p className="help-text">Las demás aceptan todas.</p>
        </div>
      </div>

      {showForm && !editingId
        ? renderCommunityEditor("Crear comunidad")
        : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Filtros rápidos</h2>

        <div className="grid grid-4">
          <label>
            Buscar
            <input
              placeholder="Nombre, WhatsApp, ciudad, categoría o sede"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
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
              <option value="activas">Activas</option>
              <option value="inactivas">Inactivas</option>
              <option value="todas">Todas</option>
            </select>
          </label>

          <label>
            Categoría
            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value as CategoryFilter)
              }
            >
              <option value="todas">Todas</option>

              {CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sede
            <select
              value={venueFilter}
              onChange={(event) => setVenueFilter(event.target.value)}
            >
              <option value="todas">Todas</option>

              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="row-actions" style={{ marginTop: 12 }}>
          <button
            className="btn secondary"
            onClick={() => {
              setQuery("");
              setStatusFilter("todas");
              setCategoryFilter("todas");
              setVenueFilter("todas");
            }}
          >
            Limpiar filtros
          </button>

          <span className="help-text">
            Mostrando {filteredCommunities.length} de {communities.length}{" "}
            comunidades.
          </span>
        </div>
      </div>

      {!filteredCommunities.length ? (
        <div className="card">
          <h2>No hay comunidades con estos filtros</h2>
          <p>Cambia los filtros o crea una comunidad.</p>

          <div className="row-actions">
            <button
              className="btn secondary"
              onClick={() => {
                setQuery("");
                setStatusFilter("todas");
                setCategoryFilter("todas");
                setVenueFilter("todas");
              }}
            >
              Limpiar filtros
            </button>

            <button className="btn" onClick={openCreateForm}>
              Crear comunidad
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-3">
          {filteredCommunities.map((community) => {
            const active = isActiveCommunity(community);
            const players = playerCounts[community.id] ?? 0;
            const matches = matchCounts[community.id] ?? 0;
            const templates = templateCounts[community.id] ?? 0;
            const categories = categoryMap[community.id] ?? [];
            const venueIds = venueMap[community.id] ?? [];
            const whatsappLink = normalizeWhatsappForLink(
              community.whatsapp ?? ""
            );
            const isEditing = editingId === community.id;

            return (
              <div
                className="card"
                key={community.id}
                style={{ opacity: active || isEditing ? 1 : 0.7 }}
              >
                {isEditing ? (
                  renderCommunityEditor(`Editar: ${community.name}`)
                ) : (
                  <>
                    <div className="player-top">
                      <div>
                        <h2>{community.name}</h2>
                        <p>{community.city ?? "Guayaquil"}</p>
                      </div>
                    </div>

                    <div className="row-actions">
                      <span className={`badge ${active ? "good" : "danger"}`}>
                        {active ? "Activa" : "Inactiva"}
                      </span>

                      <span className="badge neutral">
                        {categories.length
                          ? "Categorías limitadas"
                          : "Todas las categorías"}
                      </span>

                      <span className="badge neutral">
                        {venueIds.length
                          ? "Sedes limitadas"
                          : "Todas las sedes"}
                      </span>
                    </div>

                    <div style={{ height: 12 }} />

                    <div className="mini-panel">
                      <p className="help-text">WhatsApp</p>

                      {community.whatsapp ? (
                        whatsappLink ? (
                          <a
                            href={`https://wa.me/${whatsappLink}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <strong>{community.whatsapp}</strong>
                          </a>
                        ) : (
                          <strong>{community.whatsapp}</strong>
                        )
                      ) : (
                        <strong>Sin WhatsApp</strong>
                      )}
                    </div>

                    <div style={{ height: 8 }} />

                    <div className="mini-panel">
                      <p className="help-text">Categorías permitidas</p>
                      <strong>{formatCategoryScope(categories)}</strong>
                    </div>

                    <div style={{ height: 8 }} />

                    <div className="mini-panel">
                      <p className="help-text">Sedes permitidas</p>
                      <strong>{formatVenueScope(venueIds, venues)}</strong>
                    </div>

                    <div style={{ height: 12 }} />

                    <div className="grid grid-3">
                      <div className="mini-panel">
                        <p className="help-text">Jugadores</p>
                        <h2>{players}</h2>
                      </div>

                      <div className="mini-panel">
                        <p className="help-text">Partidos</p>
                        <h2>{matches}</h2>
                      </div>

                      <div className="mini-panel">
                        <p className="help-text">Plantillas</p>
                        <h2>{templates}</h2>
                      </div>
                    </div>

                    <p className="help-text">
                      ID corto: {community.id.slice(0, 8)}
                    </p>

                    <div className="row-actions">
                      <button
                        className="btn secondary"
                        onClick={() => openEditForm(community)}
                      >
                        Editar
                      </button>

                      <button
                        className="btn danger"
                        onClick={() => void deleteCommunity(community)}
                        disabled={deletingId === community.id}
                      >
                        {deletingId === community.id
                          ? "Eliminando..."
                          : "Eliminar"}
                      </button>
                    </div>

                    {players > 0 || matches > 0 || templates > 0 ? (
                      <p className="help-text">
                        Esta comunidad tiene historial. Para dejar de usarla,
                        entra en Editar y cambia el estado a Inactiva.
                      </p>
                    ) : (
                      <p className="help-text">
                        Puede eliminarse definitivamente si es una prueba,
                        duplicado o registro falso.
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}