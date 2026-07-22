"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DEMO_ACCOUNT_ID } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";
import type { Category } from "@/lib/types";

type StaffRole = "owner" | "admin" | "assistant" | "viewer";
type StaffFilter = "activos" | "inactivos" | "todos";

type SimpleRow = {
  id: string;
  name: string;
  city?: string | null;
};

type StaffPermissions = {
  createMatches?: boolean;
  registerResponses?: boolean;
  manageReservation?: boolean;
  viewPayments?: boolean;
  editPayments?: boolean;
  managePlayers?: boolean;
  cancelMatches?: boolean;
};

type StaffRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: StaffRole | string;
  active: boolean | null;
  allowed_categories: string[] | null;
  allowed_community_ids: string[] | null;
  allowed_venue_ids: string[] | null;
  allowed_genders: string[] | null;
  permissions: StaffPermissions | null;
  notes: string | null;
  created_at: string;
};

type StaffDraft = {
  fullName: string;
  email: string;
  phone: string;
  role: StaffRole;
  active: boolean;
  allowedCategories: Category[];
  allowedCommunityIds: string[];
  allowedVenueIds: string[];
  allowedGenders: Array<"hombre" | "mujer">;
  permissions: StaffPermissions;
  notes: string;
};

const categories: { value: Category; label: string }[] = [
  { value: "C1", label: "Primera" },
  { value: "C2", label: "Segunda" },
  { value: "C3", label: "Tercera" },
  { value: "C4", label: "Cuarta" },
  { value: "C5", label: "Quinta" },
  { value: "C6", label: "Sexta" },
  { value: "C7", label: "Novatos" },
];

const roleOptions: { value: StaffRole; label: string; description: string }[] = [
  { value: "owner", label: "Dueño", description: "Dueño de la cuenta. Ve y controla todo." },
  { value: "admin", label: "Administrador", description: "Administrador operativo. Puede gestionar casi todo." },
  { value: "assistant", label: "Asistente", description: "Arma partidos según permisos asignados." },
  { value: "viewer", label: "Solo lectura", description: "Puede revisar, pero no editar." },
];

const permissionOptions: { key: keyof StaffPermissions; label: string }[] = [
  { key: "createMatches", label: "Crear partidos" },
  { key: "registerResponses", label: "Registrar OK / No / Ambiguo" },
  { key: "manageReservation", label: "Marcar reserva de cancha" },
  { key: "viewPayments", label: "Ver pagos" },
  { key: "editPayments", label: "Editar pagos" },
  { key: "managePlayers", label: "Gestionar jugadores" },
  { key: "cancelMatches", label: "Cancelar partidos" },
];

function emptyDraft(communities: SimpleRow[] = [], venues: SimpleRow[] = []): StaffDraft {
  return {
    fullName: "",
    email: "",
    phone: "+593",
    role: "assistant",
    active: true,
    allowedCategories: ["C5", "C6"],
    allowedCommunityIds: communities[0]?.id ? [communities[0].id] : [],
    allowedVenueIds: venues[0]?.id ? [venues[0].id] : [],
    allowedGenders: ["hombre", "mujer"],
    permissions: {
      createMatches: true,
      registerResponses: true,
      manageReservation: true,
      viewPayments: false,
      editPayments: false,
      managePlayers: false,
      cancelMatches: false,
    },
    notes: "",
  };
}

function normalizeRole(value?: string | null): StaffRole {
  if (value === "owner" || value === "admin" || value === "assistant" || value === "viewer") return value;
  return "assistant";
}

function roleLabel(value?: string | null) {
  const role = normalizeRole(value);
  return roleOptions.find((item) => item.value === role)?.label ?? "Asistente";
}

function roleClass(value?: string | null) {
  const role = normalizeRole(value);
  if (role === "owner" || role === "admin") return "good";
  if (role === "assistant") return "warn";
  return "neutral";
}

function categoryLabel(value?: string | null) {
  return categories.find((item) => item.value === value)?.label ?? value ?? "";
}

function isCategory(value: string): value is Category {
  return ["C1", "C2", "C3", "C4", "C5", "C6", "C7"].includes(value);
}

function normalizeCategories(value?: string[] | null): Category[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isCategory);
}

function toggleValue<T extends string>(list: T[], value: T) {
  if (list.includes(value)) return list.filter((item) => item !== value);
  return [...list, value];
}

function canSeeEverything(row: StaffRow | StaffDraft) {
  return row.role === "owner" || row.role === "admin";
}

function permissionSummary(permissions?: StaffPermissions | null) {
  const active = permissionOptions
    .filter((item) => permissions?.[item.key])
    .map((item) => item.label);

  return active.length ? active.join(" · ") : "Sin permisos operativos";
}

function namesFromIds(ids: string[] | null | undefined, map: Map<string, SimpleRow>) {
  if (!ids?.length) return "Sin asignar";
  return ids.map((id) => map.get(id)?.name).filter(Boolean).join(", ") || "Sin asignar";
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [communities, setCommunities] = useState<SimpleRow[]>([]);
  const [venues, setVenues] = useState<SimpleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const [filter, setFilter] = useState<StaffFilter>("activos");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newStaff, setNewStaff] = useState<StaffDraft>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<StaffDraft | null>(null);

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    setLoading(true);
    setNotice("");

    try {
      const [staffRes, communitiesRes, venuesRes] = await Promise.all([
        supabase
          .from("staff_members_demo")
          .select("id, full_name, email, phone, role, active, allowed_categories, allowed_community_ids, allowed_venue_ids, allowed_genders, permissions, notes, created_at")
          .eq("account_id", DEMO_ACCOUNT_ID)
          .order("full_name"),

        supabase
          .from("communities")
          .select("id, name, city")
          .eq("account_id", DEMO_ACCOUNT_ID)
          .eq("active", true)
          .order("name"),

        supabase
          .from("venues")
          .select("id, name, city")
          .eq("account_id", DEMO_ACCOUNT_ID)
          .eq("active", true)
          .order("name"),
      ]);

      if (staffRes.error) throw staffRes.error;
      if (communitiesRes.error) throw communitiesRes.error;
      if (venuesRes.error) throw venuesRes.error;

      const communityRows = (communitiesRes.data ?? []) as SimpleRow[];
      const venueRows = (venuesRes.data ?? []) as SimpleRow[];

      setStaff((staffRes.data ?? []) as StaffRow[]);
      setCommunities(communityRows);
      setVenues(venueRows);
      setNewStaff((current) => ({
        ...current,
        allowedCommunityIds: current.allowedCommunityIds.length ? current.allowedCommunityIds : communityRows[0]?.id ? [communityRows[0].id] : [],
        allowedVenueIds: current.allowedVenueIds.length ? current.allowedVenueIds : venueRows[0]?.id ? [venueRows[0].id] : [],
      }));
    } catch (error: any) {
      setNotice(`No se pudieron cargar los usuarios: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  const activeStaff = useMemo(() => staff.filter((item) => item.active), [staff]);
  const inactiveStaff = useMemo(() => staff.filter((item) => !item.active), [staff]);
  const assistants = useMemo(() => staff.filter((item) => item.role === "assistant" && item.active), [staff]);

  const communityById = useMemo(() => new Map(communities.map((item) => [item.id, item])), [communities]);
  const venueById = useMemo(() => new Map(venues.map((item) => [item.id, item])), [venues]);

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();

    return staff
      .filter((item) => {
        if (filter === "activos") return item.active;
        if (filter === "inactivos") return !item.active;
        return true;
      })
      .filter((item) => {
        if (!term) return true;
        return [item.full_name, item.email, item.phone, item.role, item.notes]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      });
  }, [staff, filter, search]);

  function startEdit(row: StaffRow) {
    setEditingId(row.id);
    setEditDraft({
      fullName: row.full_name,
      email: row.email ?? "",
      phone: row.phone ?? "",
      role: normalizeRole(row.role),
      active: row.active !== false,
      allowedCategories: normalizeCategories(row.allowed_categories),
      allowedCommunityIds: row.allowed_community_ids ?? [],
      allowedVenueIds: row.allowed_venue_ids ?? [],
      allowedGenders: Array.isArray(row.allowed_genders)
        ? row.allowed_genders.filter((value): value is "hombre" | "mujer" =>
            value === "hombre" || value === "mujer"
          )
        : ["hombre", "mujer"],
      permissions: row.permissions ?? {},
      notes: row.notes ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function createStaff() {
    if (!newStaff.fullName.trim()) {
      setNotice("El nombre del miembro del staff es obligatorio.");
      return;
    }

    try {
      const { error } = await supabase.from("staff_members_demo").insert({
        account_id: DEMO_ACCOUNT_ID,
        full_name: newStaff.fullName.trim(),
        email: newStaff.email.trim() || null,
        phone: newStaff.phone.trim() || null,
        role: newStaff.role,
        active: newStaff.active,
        allowed_categories: canSeeEverything(newStaff) ? [] : newStaff.allowedCategories,
        allowed_community_ids: canSeeEverything(newStaff) ? [] : newStaff.allowedCommunityIds,
        allowed_venue_ids: canSeeEverything(newStaff) ? [] : newStaff.allowedVenueIds,
        allowed_genders: canSeeEverything(newStaff) ? [] : newStaff.allowedGenders,
        permissions: newStaff.permissions,
        notes: newStaff.notes.trim() || null,
      });

      if (error) throw error;

      setShowCreate(false);
      setNewStaff(emptyDraft(communities, venues));
      await loadStaff();
      setNotice("Usuario creado correctamente.");
    } catch (error: any) {
      setNotice(`No se pudo crear el usuario: ${error.message}`);
    }
  }

  async function saveEdit(row: StaffRow) {
    if (!editDraft) return;

    if (!editDraft.fullName.trim()) {
      setNotice("El nombre del miembro del staff es obligatorio.");
      return;
    }

    try {
      const { error } = await supabase
        .from("staff_members_demo")
        .update({
          full_name: editDraft.fullName.trim(),
          email: editDraft.email.trim() || null,
          phone: editDraft.phone.trim() || null,
          role: editDraft.role,
          active: editDraft.active,
          allowed_categories: canSeeEverything(editDraft) ? [] : editDraft.allowedCategories,
          allowed_community_ids: canSeeEverything(editDraft) ? [] : editDraft.allowedCommunityIds,
          allowed_venue_ids: canSeeEverything(editDraft) ? [] : editDraft.allowedVenueIds,
          allowed_genders: canSeeEverything(editDraft) ? [] : editDraft.allowedGenders,
          permissions: editDraft.permissions,
          notes: editDraft.notes.trim() || null,
          })
        .eq("account_id", DEMO_ACCOUNT_ID)
        .eq("id", row.id);

      if (error) throw error;

      cancelEdit();
      await loadStaff();
      setNotice("Usuario actualizado.");
    } catch (error: any) {
      setNotice(`No se pudo guardar el usuario: ${error.message}`);
    }
  }

  async function toggleActive(row: StaffRow) {
    const nextActive = !row.active;

    const ok = window.confirm(
      nextActive
        ? `¿Activar a ${row.full_name}?`
        : `¿Desactivar a ${row.full_name}? Ya no debería operar partidos hasta reactivarlo.`
    );

    if (!ok) return;

    try {
      const { error } = await supabase
        .from("staff_members_demo")
        .update({ active: nextActive })
        .eq("account_id", DEMO_ACCOUNT_ID)
        .eq("id", row.id);

      if (error) throw error;

      await loadStaff();
      setNotice(nextActive ? "Usuario activado." : "Usuario desactivado.");
    } catch (error: any) {
      setNotice(`No se pudo cambiar estado: ${error.message}`);
    }
  }

  function updateDraftPermission(target: "new" | "edit", key: keyof StaffPermissions, value: boolean) {
    if (target === "new") {
      setNewStaff((current) => ({
        ...current,
        permissions: { ...current.permissions, [key]: value },
      }));
      return;
    }

    setEditDraft((current) => current ? {
      ...current,
      permissions: { ...current.permissions, [key]: value },
    } : current);
  }

  function renderPermissionEditor(draft: StaffDraft, target: "new" | "edit") {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <h3>Permisos de acción</h3>
        <p className="help-text">Activa solamente las acciones que esta persona podrá realizar dentro del equipo.</p>

        <div className="row-actions">
          {permissionOptions.map((permission) => (
            <button
              key={permission.key}
              type="button"
              className={draft.permissions[permission.key] ? "btn" : "btn secondary"}
              onClick={() => updateDraftPermission(target, permission.key, !draft.permissions[permission.key])}
            >
              {permission.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderScopeEditor(draft: StaffDraft, setDraft: (updater: (current: StaffDraft) => StaffDraft) => void) {
    if (canSeeEverything(draft)) {
      return (
        <div className="mini-panel" style={{ marginTop: 12 }}>
          <strong>Alcance</strong>
          <p className="help-text">Este rol ve todas las comunidades, sedes y categorías de la cuenta.</p>
        </div>
      );
    }

    return (
      <div className="card" style={{ marginTop: 12 }}>
        <h3>Alcance permitido</h3>
        <p className="help-text">Para asistentes: define dónde y en qué categorías pueden armar partidos.</p>

        <h4>Géneros permitidos</h4>
        <div className="row-actions">
          <button
            type="button"
            className={draft.allowedGenders.includes("hombre") ? "btn" : "btn secondary"}
            onClick={() => setDraft((current) => ({
              ...current,
              allowedGenders: toggleValue(current.allowedGenders, "hombre"),
            }))}
          >
            Hombres
          </button>

          <button
            type="button"
            className={draft.allowedGenders.includes("mujer") ? "btn" : "btn secondary"}
            onClick={() => setDraft((current) => ({
              ...current,
              allowedGenders: toggleValue(current.allowedGenders, "mujer"),
            }))}
          >
            Mujeres
          </button>
        </div>

        <p className="help-text">
          Cuando tiene Hombres y Mujeres también podrá crear partidos Mixtos o Libres.
        </p>

        <h4>Categorías</h4>
        <div className="row-actions">
          {categories.map((category) => (
            <button
              key={category.value}
              type="button"
              className={draft.allowedCategories.includes(category.value) ? "btn" : "btn secondary"}
              onClick={() => setDraft((current) => ({
                ...current,
                allowedCategories: toggleValue(current.allowedCategories, category.value),
              }))}
            >
              {category.label}
            </button>
          ))}
        </div>

        <h4>Comunidades</h4>
        <div className="row-actions">
          {communities.map((community) => (
            <button
              key={community.id}
              type="button"
              className={draft.allowedCommunityIds.includes(community.id) ? "btn" : "btn secondary"}
              onClick={() => setDraft((current) => ({
                ...current,
                allowedCommunityIds: toggleValue(current.allowedCommunityIds, community.id),
              }))}
            >
              {community.name}
            </button>
          ))}
        </div>

        <h4>Sedes</h4>
        <div className="row-actions">
          {venues.map((venue) => (
            <button
              key={venue.id}
              type="button"
              className={draft.allowedVenueIds.includes(venue.id) ? "btn" : "btn secondary"}
              onClick={() => setDraft((current) => ({
                ...current,
                allowedVenueIds: toggleValue(current.allowedVenueIds, venue.id),
              }))}
            >
              {venue.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return <PageHeader title="Usuarios" description="Cargando usuarios y permisos..." />;
  }

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Dueño, administradores, asistentes y permisos por categoría, género, comunidad y sede."
        action={
          <button className="btn" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "Cerrar formulario" : "Agregar miembro"}
          </button>
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-actions">
          <span className="badge good">Activos: {activeStaff.length}</span>
          <span className="badge warn">Asistentes activos: {assistants.length}</span>
          <span className="badge neutral">Inactivos: {inactiveStaff.length}</span>
        </div>

        <p className="help-text">
          Configura quién puede crear partidos, registrar respuestas, gestionar jugadores, reservas y pagos.
        </p>

        {notice ? <p><strong>{notice}</strong></p> : null}

        <button className="btn secondary" onClick={loadStaff}>🔄 Actualizar usuarios</button>
      </div>

      {showCreate ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Agregar usuario</h2>

          <div className="grid grid-3">
            <label>
              Nombre completo
              <input
                placeholder="Ej: Carlos Asistente"
                value={newStaff.fullName}
                onChange={(e) => setNewStaff((current) => ({ ...current, fullName: e.target.value }))}
              />
            </label>

            <label>
              Email
              <input
                placeholder="Ej: asistente@email.com"
                value={newStaff.email}
                onChange={(e) => setNewStaff((current) => ({ ...current, email: e.target.value }))}
              />
            </label>

            <label>
              WhatsApp
              <input
                placeholder="Ej: +593999999999"
                value={newStaff.phone}
                onChange={(e) => setNewStaff((current) => ({ ...current, phone: e.target.value }))}
              />
            </label>

            <label>
              Rol
              <select
                value={newStaff.role}
                onChange={(e) => setNewStaff((current) => ({ ...current, role: e.target.value as StaffRole }))}
              >
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </label>

            <label>
              Estado
              <select
                value={newStaff.active ? "activo" : "inactivo"}
                onChange={(e) => setNewStaff((current) => ({ ...current, active: e.target.value === "activo" }))}
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </label>

            <label>
              Notas
              <input
                placeholder="Ej: solo Quinta y Sexta en La Perla"
                value={newStaff.notes}
                onChange={(e) => setNewStaff((current) => ({ ...current, notes: e.target.value }))}
              />
            </label>
          </div>

          {renderScopeEditor(newStaff, (updater) => setNewStaff(updater))}
          {renderPermissionEditor(newStaff, "new")}

          <div className="row-actions">
            <button className="btn save" onClick={createStaff}>Guardar miembro</button>
            <button className="btn secondary" onClick={() => setShowCreate(false)}>Cancelar</button>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Filtros rápidos</h2>

        <div className="grid grid-2">
          <label>
            Buscar
            <input
              placeholder="Nombre, email, WhatsApp, rol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <label>
            Estado
            <select value={filter} onChange={(e) => setFilter(e.target.value as StaffFilter)}>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos</option>
            </select>
          </label>
        </div>

        <p className="help-text">Mostrando {filteredStaff.length} de {staff.length} miembros del equipo.</p>
      </div>

      <div className="card">
        <h2>Equipo</h2>

        {!filteredStaff.length ? (
          <p className="help-text">No hay miembros del equipo con estos filtros.</p>
        ) : (
          <div className="grid">
            {filteredStaff.map((row) => {
              const isEditing = editingId === row.id;
              const allowedCategories = normalizeCategories(row.allowed_categories);
              const allAccess = row.role === "owner" || row.role === "admin";

              return (
                <div className="mini-panel" key={row.id} style={{ opacity: row.active ? 1 : 0.6 }}>
                  {!isEditing ? (
                    <>
                      <div className="player-top">
                        <div>
                          <h3>{row.full_name}</h3>
                          <p className="help-text">
                            {row.email || "Sin email"} · {row.phone || "Sin WhatsApp"}
                          </p>
                        </div>

                        <span className={`badge ${roleClass(row.role)}`}>{roleLabel(row.role)}</span>
                      </div>

                      <div className="row-actions">
                        <span className={row.active ? "badge good" : "badge warn"}>{row.active ? "Activo" : "Inactivo"}</span>
                        {allAccess ? (
                          <span className="badge good">Acceso total</span>
                        ) : (
                          <>
                            <span className="badge neutral">
                              {allowedCategories.length ? allowedCategories.map(categoryLabel).join(", ") : "Sin categorías"}
                            </span>
                            <span className="badge neutral">
                              {namesFromIds(row.allowed_community_ids, communityById)}
                            </span>
                            <span className="badge neutral">
                              {namesFromIds(row.allowed_venue_ids, venueById)}
                            </span>
                            <span className="badge neutral">
                              {Array.isArray(row.allowed_genders) && row.allowed_genders.length
                                ? row.allowed_genders
                                    .map((gender) => gender === "mujer" ? "Mujeres" : "Hombres")
                                    .join(" y ")
                                : "Todos los géneros"}
                            </span>
                          </>
                        )}
                      </div>

                      <p className="help-text">Permisos: {permissionSummary(row.permissions)}</p>
                      {row.notes ? <p className="help-text">Nota: {row.notes}</p> : null}

                      <div className="row-actions">
                        <button className="btn edit" onClick={() => startEdit(row)}>Editar permisos</button>
                        <button className="btn ghost" onClick={() => toggleActive(row)}>
                          {row.active ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </>
                  ) : editDraft ? (
                    <>
                      <h3>Editar miembro del equipo</h3>

                      <div className="grid grid-3">
                        <label>
                          Nombre completo
                          <input
                            value={editDraft.fullName}
                            onChange={(e) => setEditDraft((current) => current ? { ...current, fullName: e.target.value } : current)}
                          />
                        </label>

                        <label>
                          Email
                          <input
                            value={editDraft.email}
                            onChange={(e) => setEditDraft((current) => current ? { ...current, email: e.target.value } : current)}
                          />
                        </label>

                        <label>
                          WhatsApp
                          <input
                            value={editDraft.phone}
                            onChange={(e) => setEditDraft((current) => current ? { ...current, phone: e.target.value } : current)}
                          />
                        </label>

                        <label>
                          Rol
                          <select
                            value={editDraft.role}
                            onChange={(e) => setEditDraft((current) => current ? { ...current, role: e.target.value as StaffRole } : current)}
                          >
                            {roleOptions.map((role) => (
                              <option key={role.value} value={role.value}>{role.label}</option>
                            ))}
                          </select>
                        </label>

                        <label>
                          Estado
                          <select
                            value={editDraft.active ? "activo" : "inactivo"}
                            onChange={(e) => setEditDraft((current) => current ? { ...current, active: e.target.value === "activo" } : current)}
                          >
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                          </select>
                        </label>

                        <label>
                          Notas
                          <input
                            value={editDraft.notes}
                            onChange={(e) => setEditDraft((current) => current ? { ...current, notes: e.target.value } : current)}
                          />
                        </label>
                      </div>

                      {renderScopeEditor(editDraft, (updater) => setEditDraft((current) => current ? updater(current) : current))}
                      {renderPermissionEditor(editDraft, "edit")}

                      <div className="row-actions">
                        <button className="btn save" onClick={() => saveEdit(row)}>Guardar cambios</button>
                        <button className="btn secondary" onClick={cancelEdit}>Cancelar</button>
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}