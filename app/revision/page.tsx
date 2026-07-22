"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DEMO_ACCOUNT_ID } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";

type Counts = {
  communities: number;
  venues: number;
  activePlayers: number;
  events: number;
  activeEvents: number;
  staff: number;
};

type Check = {
  label: string;
  ok: boolean;
  detail: string;
  href: string;
};

const EMPTY_COUNTS: Counts = {
  communities: 0,
  venues: 0,
  activePlayers: 0,
  events: 0,
  activeEvents: 0,
  staff: 0,
};

export default function RevisionPage() {
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const [operatorName, setOperatorName] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    loadReview();
  }, []);

  async function loadReview() {
    setLoading(true);
    setNotice("");

    const rawSession = window.localStorage.getItem("ptm.selectedStaffSnapshot");
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession) as { fullName?: string };
        setOperatorName(parsed.fullName ?? "");
      } catch {
        setOperatorName("");
      }
    }

    try {
      const [communitiesRes, venuesRes, playersRes, eventsRes, staffRes] = await Promise.all([
        supabase
          .from("communities")
          .select("id")
          .eq("account_id", DEMO_ACCOUNT_ID)
          .eq("active", true),
        supabase
          .from("venues")
          .select("id")
          .eq("account_id", DEMO_ACCOUNT_ID)
          .eq("active", true),
        supabase
          .from("players")
          .select("id")
          .eq("account_id", DEMO_ACCOUNT_ID)
          .eq("active", true)
          .is("deleted_at", null),
        supabase
          .from("events")
          .select("id, status")
          .eq("account_id", DEMO_ACCOUNT_ID),
        supabase
          .from("staff_members_demo")
          .select("id")
          .eq("account_id", DEMO_ACCOUNT_ID)
          .eq("active", true),
      ]);

      if (communitiesRes.error) throw communitiesRes.error;
      if (venuesRes.error) throw venuesRes.error;
      if (playersRes.error) throw playersRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (staffRes.error) throw staffRes.error;

      const eventRows = (eventsRes.data ?? []) as Array<{ id: string; status: string }>;

      setCounts({
        communities: communitiesRes.data?.length ?? 0,
        venues: venuesRes.data?.length ?? 0,
        activePlayers: playersRes.data?.length ?? 0,
        events: eventRows.length,
        activeEvents: eventRows.filter((event) => !["cancelado", "cerrado"].includes(event.status)).length,
        staff: staffRes.data?.length ?? 0,
      });
    } catch (error: any) {
      setNotice(`La revisión automática encontró un problema: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  const checks = useMemo<Check[]>(
    () => [
      {
        label: "Comunidades activas",
        ok: counts.communities > 0,
        detail: `${counts.communities} comunidad(es) disponible(s)`,
        href: "/comunidades",
      },
      {
        label: "Sedes activas",
        ok: counts.venues > 0,
        detail: `${counts.venues} sede(s), incluida Otra / por definir si ejecutaste el SQL`,
        href: "/sedes",
      },
      {
        label: "Jugadores activos",
        ok: counts.activePlayers > 0,
        detail: `${counts.activePlayers} jugador(es) aptos para convocatorias`,
        href: "/jugadores",
      },
      {
        label: "Partidos guardados",
        ok: counts.events > 0,
        detail: `${counts.events} total · ${counts.activeEvents} activo(s)`,
        href: "/eventos",
      },
      {
        label: "Staff demo",
        ok: counts.staff > 0,
        detail: `${counts.staff} operador(es) activo(s) además del administrador general`,
        href: "/staff",
      },
      {
        label: "Operador elegido en este equipo",
        ok: Boolean(operatorName),
        detail: operatorName || "Todavía no se eligió operador",
        href: "/acceso-asistentes",
      },
    ],
    [counts, operatorName]
  );

  const passed = checks.filter((check) => check.ok).length;

  if (loading) {
    return <PageHeader title="Revisión final" description="Comprobando el estado del MVP..." />;
  }

  return (
    <>
      <PageHeader
        title="Revisión final"
        description="Control rápido antes de usar Pro Team Max con el equipo."
        action={<button className="btn secondary" onClick={loadReview}>🔄 Revisar otra vez</button>}
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="player-top">
          <div>
            <h2>{passed}/{checks.length} comprobaciones listas</h2>
            <p className="help-text">Las verificaciones automáticas revisan datos básicos. Abajo está la prueba manual completa.</p>
          </div>
          <div className="score">{Math.round((passed / checks.length) * 100)}%</div>
        </div>

        {notice ? <p><strong>{notice}</strong></p> : null}
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        {checks.map((check) => (
          <div className="card" key={check.label}>
            <div className="row-actions">
              <span className={`badge ${check.ok ? "good" : "danger"}`}>
                {check.ok ? "LISTO" : "REVISAR"}
              </span>
            </div>
            <h2>{check.label}</h2>
            <p>{check.detail}</p>
            <Link className="btn secondary" href={check.href}>Abrir</Link>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Prueba completa antes del viernes</h2>
        <p>1. En Acceso de asistentes, entra como un asistente real de prueba.</p>
        <p>2. Crea un partido desde Llenar Canchas.</p>
        <p>3. Comprueba que solo aparezcan sus comunidades, categorías y sedes permitidas.</p>
        <p>4. Copia un WhatsApp y registra un OK, un No puede y un Ambiguo.</p>
        <p>5. Recarga la página: las respuestas deben seguir guardadas.</p>
        <p>6. Abre Partidos y entra al detalle.</p>
        <p>7. Registra un pago de prueba y vuelve a recargar.</p>
        <p>8. Cancela un partido de prueba y revisa los avisos manuales.</p>
        <p>9. Desde otro celular en el mismo WiFi abre el acceso de asistentes.</p>

        <div className="row-actions" style={{ marginTop: 12 }}>
          <Link className="btn" href="/acceso-asistentes">Empezar prueba</Link>
          <Link className="btn secondary" href="/llenar-canchas">Crear partido</Link>
          <Link className="btn secondary" href="/eventos">Ver partidos</Link>
        </div>
      </div>
    </>
  );
}