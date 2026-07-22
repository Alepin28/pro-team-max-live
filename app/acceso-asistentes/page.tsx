"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DEMO_ACCOUNT_ID } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";

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
  role: string;
  active: boolean | null;
  allowed_categories: string[] | null;
  allowed_community_ids: string[] | null;
  allowed_venue_ids: string[] | null;
  allowed_genders: string[] | null;
  permissions: StaffPermissions | null;
  notes: string | null;
};

type SimpleRow = {
  id: string;
  name: string;
};

const ADMIN_GENERAL: StaffRow = {
  id: "admin-demo",
  full_name: "Alejandro Pincay",
  email: null,
  phone: null,
  role: "owner",
  active: true,
  allowed_categories: [],
  allowed_community_ids: [],
  allowed_venue_ids: [],
  allowed_genders: [],
  permissions: {
    createMatches: true,
    registerResponses: true,
    manageReservation: true,
    viewPayments: true,
    editPayments: true,
    managePlayers: true,
    cancelMatches: true,
  },
  notes: "Dueño y administrador principal de PadelProX.",
};

const CATEGORY_LABELS: Record<string, string> = {
  C1: "Primera",
  C2: "Segunda",
  C3: "Tercera",
  C4: "Cuarta",
  C5: "Quinta",
  C6: "Sexta",
  C7: "Novatos",
};

const PERMISSION_LABELS: Array<{ key: keyof StaffPermissions; label: string }> = [
  { key: "createMatches", label: "Crear partidos" },
  { key: "registerResponses", label: "Registrar respuestas" },
  { key: "manageReservation", label: "Gestionar reserva" },
  { key: "viewPayments", label: "Ver pagos" },
  { key: "editPayments", label: "Editar pagos" },
  { key: "managePlayers", label: "Gestionar jugadores" },
  { key: "cancelMatches", label: "Cancelar partidos" },
];

function roleLabel(role?: string | null) {
  if (role === "owner") return "Dueño";
  if (role === "admin") return "Administrador";
  if (role === "assistant") return "Asistente";
  if (role === "viewer") return "Solo lectura";
  return role || "Staff";
}

function roleClass(role?: string | null) {
  if (role === "owner" || role === "admin") return "good";
  if (role === "assistant") return "warn";
  return "neutral";
}

function canSeeEverything(staff: StaffRow) {
  return staff.id === "admin-demo" || staff.role === "owner" || staff.role === "admin";
}

function nameList(ids: string[] | null | undefined, rows: SimpleRow[]) {
  if (!ids?.length) return "Sin alcance asignado";
  const map = new Map(rows.map((row) => [row.id, row.name]));
  const names = ids.map((id) => map.get(id)).filter(Boolean);
  return names.length ? names.join(", ") : "Sin alcance asignado";
}

function categoryList(categories: string[] | null | undefined) {
  if (!categories?.length) return "Sin categorías asignadas";
  return categories.map((category) => CATEGORY_LABELS[category] ?? category).join(", ");
}

function genderList(genders: string[] | null | undefined) {
  if (!genders?.length) return "Hombres, mujeres, mixtos y libres";

  const labels: string[] = genders.map((gender) =>
    gender === "mujer" ? "Mujeres" : "Hombres"
  );

  if (genders.includes("hombre") && genders.includes("mujer")) {
    labels.push("Mixtos", "Libres");
  }

  return labels.join(", ");
}

export default function AccesoAsistentesPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [communities, setCommunities] = useState<SimpleRow[]>([]);
  const [venues, setVenues] = useState<SimpleRow[]>([]);
  const [selectedId, setSelectedId] = useState("admin-demo");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    loadAccessData();
  }, []);

  async function loadAccessData() {
    setLoading(true);
    setNotice("");

    try {
      const [staffRes, communitiesRes, venuesRes] = await Promise.all([
        supabase
          .from("staff_members_demo")
          .select(
            "id, full_name, email, phone, role, active, allowed_categories, allowed_community_ids, allowed_venue_ids, allowed_genders, permissions, notes"
          )
          .eq("account_id", DEMO_ACCOUNT_ID)
          .eq("active", true)
          .order("full_name"),
        supabase
          .from("communities")
          .select("id, name")
          .eq("account_id", DEMO_ACCOUNT_ID)
          .eq("active", true)
          .order("name"),
        supabase
          .from("venues")
          .select("id, name")
          .eq("account_id", DEMO_ACCOUNT_ID)
          .eq("active", true)
          .order("name"),
      ]);

      if (staffRes.error) throw staffRes.error;
      if (communitiesRes.error) throw communitiesRes.error;
      if (venuesRes.error) throw venuesRes.error;

      const staffRows = (staffRes.data ?? []) as StaffRow[];
      setStaff(staffRows);
      setCommunities((communitiesRes.data ?? []) as SimpleRow[]);
      setVenues((venuesRes.data ?? []) as SimpleRow[]);

      const savedId = window.localStorage.getItem("ptm.selectedStaffId");
      if (savedId && (savedId === "admin-demo" || staffRows.some((row) => row.id === savedId))) {
        setSelectedId(savedId);
      }
    } catch (error: any) {
      setStaff([]);
      setNotice(
        `No se pudo cargar la lista de usuarios: ${error.message}. Mientras tanto puedes entrar como Alejandro Pincay.`
      );
    } finally {
      setLoading(false);
    }
  }

  const allOptions = useMemo(() => [ADMIN_GENERAL, ...staff], [staff]);
  const selectedStaff = allOptions.find((row) => row.id === selectedId) ?? ADMIN_GENERAL;

  function enterAs(staffMember: StaffRow) {
    const snapshot = {
      id: staffMember.id,
      fullName: staffMember.full_name,
      role: staffMember.role,
      allowedCategories: staffMember.allowed_categories ?? [],
      allowedCommunityIds: staffMember.allowed_community_ids ?? [],
      allowedVenueIds: staffMember.allowed_venue_ids ?? [],
      allowedGenders: staffMember.allowed_genders ?? [],
      permissions: staffMember.permissions ?? {},
      enteredAt: new Date().toISOString(),
    };

    window.localStorage.setItem("ptm.selectedStaffId", staffMember.id);
    window.localStorage.setItem("ptm.selectedStaffSnapshot", JSON.stringify(snapshot));
    window.localStorage.setItem("ptm.sessionMode", "staff-demo");
    window.localStorage.removeItem("ptm.lastEventId");
    window.localStorage.removeItem("ptm.lastEventMeta");
    window.location.href = "/llenar-canchas";
  }

  function clearSession() {
    window.localStorage.removeItem("ptm.selectedStaffId");
    window.localStorage.removeItem("ptm.selectedStaffSnapshot");
    window.localStorage.removeItem("ptm.sessionMode");
    setSelectedId("admin-demo");
    setNotice("Operador borrado de este dispositivo. Elige quién va a trabajar ahora.");
  }

  if (loading) {
    return <PageHeader title="Cambiar usuario" description="Cargando operadores activos..." />;
  }

  return (
    <>
      <PageHeader
        title="Cambiar usuario"
        description="Elige qué usuario utilizará la aplicación en este celular o computadora."
        action={<Link className="btn secondary" href="/manual-asistente">Ver manual del equipo</Link>}
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-actions">
          <span className="badge good">Acceso interno de PadelProX</span>
          <span className="badge neutral">Uso exclusivo del equipo</span>
          <span className="badge good">Permisos operativos activos</span>
        </div>

        <p>
          Cada celular o computadora debe seleccionar al usuario que está trabajando. La selección queda guardada en ese navegador.
        </p>

        <p className="help-text">
          Los permisos de cada persona se aplican dentro de Llenar Canchas. Usa solamente perfiles reales del equipo.
        </p>

        {notice ? <p><strong>{notice}</strong></p> : null}

        <div className="row-actions">
          <button className="btn secondary" onClick={loadAccessData}>🔄 Actualizar lista</button>
          <button className="btn ghost" onClick={clearSession}>Cambiar operador</button>
          <Link className="btn secondary" href="/staff">Configurar usuarios</Link>
        </div>
      </div>

      <div className="grid grid-2">
        {allOptions.map((staffMember) => {
          const selected = staffMember.id === selectedId;
          const everything = canSeeEverything(staffMember);
          const activePermissions = PERMISSION_LABELS.filter(
            (permission) => everything || staffMember.permissions?.[permission.key] === true
          );

          return (
            <div className="card" key={staffMember.id}>
              <div className="player-top">
                <div>
                  <h2>{staffMember.full_name}</h2>
                  <div className="row-actions">
                    <span className={`badge ${roleClass(staffMember.role)}`}>{roleLabel(staffMember.role)}</span>
                    {selected ? <span className="badge good">Seleccionado en este equipo</span> : null}
                  </div>
                </div>
              </div>

              {staffMember.email ? <p className="help-text">Email: {staffMember.email}</p> : null}
              {staffMember.phone ? <p className="help-text">WhatsApp: {staffMember.phone}</p> : null}

              <div className="mini-panel" style={{ marginTop: 12 }}>
                <strong>Alcance</strong>
                {everything ? (
                  <p>Puede trabajar con todas las comunidades, categorías y sedes.</p>
                ) : (
                  <>
                    <p><strong>Comunidades:</strong> {nameList(staffMember.allowed_community_ids, communities)}</p>
                    <p><strong>Categorías:</strong> {categoryList(staffMember.allowed_categories)}</p>
                    <p><strong>Sedes:</strong> {nameList(staffMember.allowed_venue_ids, venues)}</p>
                    <p><strong>Géneros:</strong> {genderList(staffMember.allowed_genders)}</p>
                  </>
                )}
              </div>

              <div className="mini-panel" style={{ marginTop: 12 }}>
                <strong>Permisos</strong>
                <div className="row-actions" style={{ marginTop: 8 }}>
                  {activePermissions.length ? (
                    activePermissions.map((permission) => (
                      <span className="badge good" key={permission.key}>{permission.label}</span>
                    ))
                  ) : (
                    <span className="badge danger">Sin permisos operativos</span>
                  )}
                </div>
              </div>

              {staffMember.notes ? <p className="help-text">Nota: {staffMember.notes}</p> : null}

              <button className="btn" style={{ marginTop: 12 }} onClick={() => enterAs(staffMember)}>
                Entrar como {staffMember.full_name}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}