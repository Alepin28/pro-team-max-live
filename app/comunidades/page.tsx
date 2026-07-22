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
  city: "Guayaquil",
  active: true,
  categories: [],
  venueIds: [],
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [notice, setNotice] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("activas");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("todas");
  const [venueFilter, setVenueFilter] = useState<VenueFilter>("todas");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CommunityForm>(EMPTY_FORM);

  useEffect(() => {
    loadCommunities();
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
      ] = await Promise.all([
        supabase
          .from("communities")
          .select("id, sport_id, name, city, default_category, active")
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
      ]);

      if (communitiesRes.error) throw communitiesRes.error;
      if (venuesRes.error) throw venuesRes.error;
      if (communityCategoriesRes.error) throw communityCategoriesRes.error;
      if (communityVenuesRes.error) throw communityVenuesRes.error;
      if (playerCommunitiesRes.error) throw playerCommunitiesRes.error;
      if (eventsRes.error) throw eventsRes.error;

      const communityRows = (communitiesRes.data ?? []) as CommunityRow[];
      const venueRows = (venuesRes.data ?? []) as VenueRow[];

      setCommunities(communityRows);
      setVenues(venueRows);

      const nextCategoryMap: Record<string, Category[]> = {};

      for (const row of (communityCategoriesRes.data ?? []) as CommunityCategoryRow[]) {
        if (!row.community_id || !row.category) continue;

        nextCategoryMap[row.community_id] = [
          ...(nextCategoryMap[row.community_id] ?? []),
          row.category,
        ];
      }

      setCategoryMap(nextCategoryMap);

      const nextVenueMap: Record<string, string[]> = {};

      for (const row of (communityVenuesRes.data ?? []) as CommunityVenueRow[]) {
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

  async function saveCommunityScopes(communityId: string) {
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

    if (form.categories.length) {
      const { error } = await supabase.from("community_categories").insert(
        form.categories.map((category) => ({
          account_id: DEMO_ACCOUNT_ID,
          community_id: communityId,
          category,
        }))
      );

      if (error) throw error;
    }

    if (form.venueIds.length) {
      const { error } = await supabase.from("community_venues").insert(
        form.venueIds.map((venueId) => ({
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
    const city = form.city.trim() || "Guayaquil";

    if (!name) {
      setNotice("Escribe el nombre de la comunidad.");
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      let communityId = editingId;

      if (editingId) {
        const { error } = await supabase
          .from("communities")
          .update({
            name,
            city,
            default_category: null,
            active: form.active,
          })
          .eq("id", editingId)
          .eq("account_id", DEMO_ACCOUNT_ID);

        if (error) throw error;

        communityId = editingId;
      } else {
        const sportId = await getPadelSportId();

        const { data, error } = await supabase
          .from("communities")
          .insert({
            account_id: DEMO_ACCOUNT_ID,
            sport_id: sportId,
            name,
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

      await saveCommunityScopes(communityId);

      closeForm();
      await loadCommunities();

      setNotice(editingId ? "Comunidad actualizada." : "Comunidad creada.");
    } catch (error: any) {
      setNotice(`No se pudo guardar la comunidad: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleCommunityStatus(community: CommunityRow) {
    const nextActive = !isActiveCommunity(community);

    try {
      const { error } = await supabase
        .from("communities")
        .update({ active: nextActive })
        .eq("id", community.id)
        .eq("account_id", DEMO_ACCOUNT_ID);

      if (error) throw error;

      await loadCommunities();
      setNotice(nextActive ? "Comunidad activada." : "Comunidad desactivada.");
    } catch (error: any) {
      setNotice(`No se pudo cambiar el estado: ${error.message}`);
    }
  }

  const activeVenues = useMemo(() => {
    return venues.filter((venue) => venue.active !== false);
  }, [venues]);

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
          `${community.name} ${community.city ?? ""} ${formatCategoryScope(
            categories
          )} ${formatVenueScope(venueIds, venues)}`
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
        description="Crea grupos de jugadores y define en qué categorías y sedes pueden jugar."
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
          <button className="btn secondary" onClick={loadCommunities}>
            🔄 Actualizar comunidades
          </button>

          <button className="btn" onClick={openCreateForm}>
            Crear comunidad
          </button>
        </div>

        <p className="help-text">
          Regla: una comunidad no tiene una sola categoría fija. Puede aceptar
          todas las categorías o solo algunas. También puede jugar en todas las
          sedes o solo en sedes específicas.
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
          <p className="help-text">Suma de vínculos jugador-comunidad.</p>
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

      {showForm ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>{editingId ? "Editar comunidad" : "Crear comunidad"}</h2>

          <p className="help-text">
            Primero crea la comunidad. Luego define qué categorías acepta y en
            qué sedes juega.
          </p>

          <div className="grid grid-2">
            <label>
              Nombre de la comunidad
              <input
                placeholder="Ej: Los Puertos, Padel Prox, La Perla"
                value={form.name}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    name: e.target.value,
                  }))
                }
              />
            </label>

            <label>
              Ciudad / zona
              <input
                placeholder="Ej: Guayaquil, Samborondón, Ceibos"
                value={form.city}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    city: e.target.value,
                  }))
                }
              />
            </label>

            <label>
              Estado
              <select
                value={form.active ? "activa" : "inactiva"}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    active: e.target.value === "activa",
                  }))
                }
              >
                <option value="activa">Activa</option>
                <option value="inactiva">Inactiva</option>
              </select>
            </label>
          </div>

          <div style={{ height: 16 }} />

          <div className="card">
            <h3>Categorías permitidas</h3>

            <p className="help-text">
              Si no marcas ninguna, esta comunidad acepta todas las categorías.
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
                Seleccionar todas
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
                Dejar todas por defecto
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

          <div className="card">
            <h3>Sedes permitidas</h3>

            <p className="help-text">
              Si no marcas ninguna, esta comunidad puede jugar en todas las
              sedes activas.
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
                Seleccionar todas las sedes
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
                Dejar todas por defecto
              </button>
            </div>

            {!activeVenues.length ? (
              <p className="help-text">
                No hay sedes activas cargadas. Crea o activa sedes primero.
              </p>
            ) : (
              <div className="grid grid-3" style={{ marginTop: 12 }}>
                {activeVenues.map((venue) => (
                  <label
                    key={venue.id}
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
                      checked={form.venueIds.includes(venue.id)}
                      onChange={() => toggleVenue(venue.id)}
                    />
                    <span>
                      <strong>{venue.name}</strong>
                      <br />
                      <span className="help-text">{venue.city ?? "Guayaquil"}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="row-actions">
            <button className="btn" onClick={saveCommunity} disabled={saving}>
              {saving
                ? "Guardando..."
                : editingId
                  ? "Guardar cambios"
                  : "Crear comunidad"}
            </button>

            <button className="btn secondary" onClick={closeForm}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Filtros rápidos</h2>

        <div className="grid grid-4">
          <label>
            Buscar
            <input
              placeholder="Nombre, ciudad, categoría o sede"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <label>
            Estado
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StatusFilter)
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
              onChange={(e) =>
                setCategoryFilter(e.target.value as CategoryFilter)
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
              onChange={(e) => setVenueFilter(e.target.value)}
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

        <p className="help-text">
          Mostrando {filteredCommunities.length} de {communities.length}{" "}
          comunidades.
        </p>
      </div>

      {!filteredCommunities.length ? (
        <div className="card">
          <h2>No hay comunidades con estos filtros</h2>
          <p>Cambia los filtros o crea una comunidad.</p>

          <div className="row-actions">
            <button
              className="btn secondary"
              onClick={() => {
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
            const categories = categoryMap[community.id] ?? [];
            const venueIds = venueMap[community.id] ?? [];

            return (
              <div
                className="card"
                key={community.id}
                style={{ opacity: active ? 1 : 0.7 }}
              >
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
                    {categories.length ? "Categorías limitadas" : "Todas las categorías"}
                  </span>

                  <span className="badge neutral">
                    {venueIds.length ? "Sedes limitadas" : "Todas las sedes"}
                  </span>
                </div>

                <div style={{ height: 12 }} />

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

                <div className="grid grid-2">
                  <div className="mini-panel">
                    <p className="help-text">Jugadores</p>
                    <h2>{players}</h2>
                  </div>

                  <div className="mini-panel">
                    <p className="help-text">Partidos</p>
                    <h2>{matches}</h2>
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
                    className="btn ghost"
                    onClick={() => toggleCommunityStatus(community)}
                  >
                    {active ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}