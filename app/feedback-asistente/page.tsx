"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DEMO_ACCOUNT_ID } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";

type FeedbackRow = {
  id: string;
  account_id: string;
  reviewer_name: string;
  reviewer_role: string | null;
  screen: string;
  rating: number | null;
  priority: string;
  what_worked: string | null;
  what_confused: string | null;
  what_missing: string | null;
  screenshot_note: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
};

type FeedbackDraft = {
  reviewerName: string;
  reviewerRole: string;
  screen: string;
  rating: string;
  priority: string;
  whatWorked: string;
  whatConfused: string;
  whatMissing: string;
  screenshotNote: string;
};

const screens = [
  "Revisión final",
  "Manual asistente",
  "Dashboard",
  "Crear partido",
  "Jugadores recomendados",
  "WhatsApp / mensajes",
  "Registrar OK / No / Ambiguo",
  "Partidos",
  "Detalle del partido",
  "Pagos",
  "Reserva de cancha",
  "Solicitudes",
  "Convertir solicitud en jugador",
  "Portal jugador",
  "Quiero jugar",
  "Mi perfil jugador",
  "Staff / permisos",
  "Pitch / presentación",
  "Otro",
];

const roles = [
  "Administrador",
  "Asistente",
  "Profesor",
  "Secretaría",
  "Head coach",
  "Otro",
];

function statusLabel(status: string) {
  if (status === "nuevo") return "Nuevo";
  if (status === "revisado") return "Revisado";
  if (status === "resuelto") return "Resuelto";
  if (status === "descartado") return "Descartado";
  return status;
}

function statusClass(status: string) {
  if (status === "nuevo") return "warn";
  if (status === "revisado") return "good";
  if (status === "resuelto") return "good";
  if (status === "descartado") return "danger";
  return "neutral";
}

function priorityLabel(priority: string) {
  if (priority === "alta") return "Alta";
  if (priority === "media") return "Media";
  if (priority === "baja") return "Baja";
  return priority;
}

function priorityClass(priority: string) {
  if (priority === "alta") return "danger";
  if (priority === "media") return "warn";
  return "neutral";
}

function ratingLabel(value: number | null) {
  if (!value) return "Sin nota";
  if (value === 1) return "1/5 · Muy confuso";
  if (value === 2) return "2/5 · Difícil";
  if (value === 3) return "3/5 · Regular";
  if (value === 4) return "4/5 · Bien";
  return "5/5 · Muy claro";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const emptyDraft: FeedbackDraft = {
  reviewerName: "",
  reviewerRole: "Asistente",
  screen: "Crear partido",
  rating: "4",
  priority: "media",
  whatWorked: "",
  whatConfused: "",
  whatMissing: "",
  screenshotNote: "",
};

export default function FeedbackAsistentePage() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [draft, setDraft] = useState<FeedbackDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [priorityFilter, setPriorityFilter] = useState("todas");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadFeedback();
  }, []);

  async function loadFeedback() {
    setLoading(true);
    setNotice("");

    try {
      const { data, error } = await supabase
        .from("assistant_feedback_demo")
        .select("*")
        .eq("account_id", DEMO_ACCOUNT_ID)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      setFeedback((data ?? []) as FeedbackRow[]);
    } catch (error: any) {
      setNotice(`No se pudo cargar feedback: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(field: keyof FeedbackDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveFeedback() {
    setNotice("");

    if (!draft.reviewerName.trim()) {
      setNotice("Escribe tu nombre para guardar el feedback.");
      return;
    }

    if (!draft.whatWorked.trim() && !draft.whatConfused.trim() && !draft.whatMissing.trim()) {
      setNotice("Escribe al menos un comentario: qué funcionó, qué confundió o qué faltó.");
      return;
    }

    setSaving(true);

    try {
      const rating = Number(draft.rating);

      const { error } = await supabase
        .from("assistant_feedback_demo")
        .insert({
          account_id: DEMO_ACCOUNT_ID,
          reviewer_name: draft.reviewerName.trim(),
          reviewer_role: draft.reviewerRole.trim() || null,
          screen: draft.screen,
          rating: Number.isFinite(rating) ? rating : null,
          priority: draft.priority,
          what_worked: draft.whatWorked.trim() || null,
          what_confused: draft.whatConfused.trim() || null,
          what_missing: draft.whatMissing.trim() || null,
          screenshot_note: draft.screenshotNote.trim() || null,
          status: "nuevo",
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setDraft((current) => ({
        ...emptyDraft,
        reviewerName: current.reviewerName,
        reviewerRole: current.reviewerRole,
      }));

      await loadFeedback();
      setNotice("Feedback guardado. Gracias, esto sirve para mejorar el flujo.");
    } catch (error: any) {
      setNotice(`No se pudo guardar feedback: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(row: FeedbackRow, status: string) {
    try {
      const { error } = await supabase
        .from("assistant_feedback_demo")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (error) throw error;

      await loadFeedback();
      setNotice(`Feedback marcado como ${statusLabel(status)}.`);
    } catch (error: any) {
      setNotice(`No se pudo actualizar feedback: ${error.message}`);
    }
  }

  const stats = useMemo(() => {
    return {
      total: feedback.length,
      newItems: feedback.filter((row) => row.status === "nuevo").length,
      high: feedback.filter((row) => row.priority === "alta").length,
      resolved: feedback.filter((row) => row.status === "resuelto").length,
    };
  }, [feedback]);

  const filteredFeedback = useMemo(() => {
    const q = search.trim().toLowerCase();

    return feedback.filter((row) => {
      if (statusFilter !== "todos" && row.status !== statusFilter) return false;
      if (priorityFilter !== "todas" && row.priority !== priorityFilter) return false;

      if (!q) return true;

      const haystack = [
        row.reviewer_name,
        row.reviewer_role ?? "",
        row.screen,
        row.priority,
        row.status,
        row.what_worked ?? "",
        row.what_confused ?? "",
        row.what_missing ?? "",
        row.screenshot_note ?? "",
      ].join(" ").toLowerCase();

      return haystack.includes(q);
    });
  }, [feedback, statusFilter, priorityFilter, search]);

  if (loading) {
    return (
      <PageHeader
        title="Feedback asistente"
        description="Cargando comentarios internos..."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Feedback asistente"
        description="Pantalla para que los asistentes dejen comentarios después de probar Pro Team Max."
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <span className="badge good">Prueba interna</span>
        <span className="badge warn">Usar datos de prueba</span>
        <span className="badge neutral">Feedback para mejorar</span>

        <h2 style={{ marginTop: 16 }}>Objetivo</h2>

        <p>
          Esta pantalla recoge comentarios reales de quienes van a usar el sistema
          para armar partidos. Sirve para detectar qué confunde, qué falta y qué
          debe cambiar antes de usarlo oficialmente.
        </p>

        {notice ? (
          <p>
            <strong>{notice}</strong>
          </p>
        ) : null}

        <div className="row-actions">
          <button className="btn secondary" onClick={loadFeedback}>
            🔄 Actualizar feedback
          </button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card">
          <p className="help-text">Total comentarios</p>
          <h2>{stats.total}</h2>
        </div>

        <div className="card">
          <p className="help-text">Nuevos</p>
          <h2>{stats.newItems}</h2>
        </div>

        <div className="card">
          <p className="help-text">Alta prioridad</p>
          <h2>{stats.high}</h2>
        </div>

        <div className="card">
          <p className="help-text">Resueltos</p>
          <h2>{stats.resolved}</h2>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Dejar feedback</h2>

        <div className="grid grid-3">
          <label>
            Tu nombre
            <input
              placeholder="Ej: Laura"
              value={draft.reviewerName}
              onChange={(e) => updateDraft("reviewerName", e.target.value)}
            />
          </label>

          <label>
            Rol
            <select
              value={draft.reviewerRole}
              onChange={(e) => updateDraft("reviewerRole", e.target.value)}
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label>
            Pantalla revisada
            <select
              value={draft.screen}
              onChange={(e) => updateDraft("screen", e.target.value)}
            >
              {screens.map((screen) => (
                <option key={screen} value={screen}>
                  {screen}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-2">
          <label>
            Claridad
            <select
              value={draft.rating}
              onChange={(e) => updateDraft("rating", e.target.value)}
            >
              <option value="1">1/5 · Muy confuso</option>
              <option value="2">2/5 · Difícil</option>
              <option value="3">3/5 · Regular</option>
              <option value="4">4/5 · Bien</option>
              <option value="5">5/5 · Muy claro</option>
            </select>
          </label>

          <label>
            Prioridad
            <select
              value={draft.priority}
              onChange={(e) => updateDraft("priority", e.target.value)}
            >
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </label>
        </div>

        <div className="grid grid-3">
          <label>
            Qué funcionó bien
            <textarea
              placeholder="Ej: Crear partido fue fácil, el resumen ayuda..."
              value={draft.whatWorked}
              onChange={(e) => updateDraft("whatWorked", e.target.value)}
              style={{ minHeight: 100 }}
            />
          </label>

          <label>
            Qué confundió
            <textarea
              placeholder="Ej: No entendí lista de espera, pagos, permisos..."
              value={draft.whatConfused}
              onChange={(e) => updateDraft("whatConfused", e.target.value)}
              style={{ minHeight: 100 }}
            />
          </label>

          <label>
            Qué faltó
            <textarea
              placeholder="Ej: Falta filtro, buscar jugador, foto, ranking..."
              value={draft.whatMissing}
              onChange={(e) => updateDraft("whatMissing", e.target.value)}
              style={{ minHeight: 100 }}
            />
          </label>
        </div>

        <label>
          Nota de error o captura
          <textarea
            placeholder="Ej: Me salió error al convertir jugador. Captura enviada por WhatsApp."
            value={draft.screenshotNote}
            onChange={(e) => updateDraft("screenshotNote", e.target.value)}
            style={{ minHeight: 80 }}
          />
        </label>

        <div className="row-actions">
          <button className="btn" disabled={saving} onClick={saveFeedback}>
            {saving ? "Guardando..." : "Guardar feedback"}
          </button>

          <button className="btn secondary" onClick={() => setDraft(emptyDraft)}>
            Limpiar formulario
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Filtros</h2>

        <div className="grid grid-3">
          <label>
            Buscar
            <input
              placeholder="Nombre, pantalla, comentario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <label>
            Estado
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="nuevo">Nuevos</option>
              <option value="revisado">Revisados</option>
              <option value="resuelto">Resueltos</option>
              <option value="descartado">Descartados</option>
            </select>
          </label>

          <label>
            Prioridad
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="todas">Todas</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </label>
        </div>

        <p className="help-text">
          Mostrando {filteredFeedback.length} de {feedback.length} comentarios.
        </p>
      </div>

      <div className="card">
        <h2>Comentarios recibidos</h2>

        {!filteredFeedback.length ? (
          <p className="help-text">Todavía no hay feedback con estos filtros.</p>
        ) : (
          <div className="grid">
            {filteredFeedback.map((row) => (
              <div className="mini-panel" key={row.id}>
                <div className="player-top">
                  <div>
                    <strong>{row.reviewer_name}</strong>
                    <p className="help-text">
                      {row.reviewer_role ?? "Sin rol"} · {row.screen} · {formatDate(row.created_at)}
                    </p>
                  </div>

                  <div className="row-actions">
                    <span className={`badge ${statusClass(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>

                    <span className={`badge ${priorityClass(row.priority)}`}>
                      Prioridad {priorityLabel(row.priority)}
                    </span>

                    <span className="badge neutral">
                      {ratingLabel(row.rating)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-3" style={{ marginTop: 12 }}>
                  <div className="card">
                    <p className="help-text">Funcionó</p>
                    <p>{row.what_worked || "Sin comentario."}</p>
                  </div>

                  <div className="card">
                    <p className="help-text">Confundió</p>
                    <p>{row.what_confused || "Sin comentario."}</p>
                  </div>

                  <div className="card">
                    <p className="help-text">Faltó</p>
                    <p>{row.what_missing || "Sin comentario."}</p>
                  </div>
                </div>

                {row.screenshot_note ? (
                  <p className="help-text" style={{ marginTop: 10 }}>
                    Nota/captura: {row.screenshot_note}
                  </p>
                ) : null}

                <div className="row-actions" style={{ marginTop: 12 }}>
                  <button className="btn secondary" onClick={() => updateStatus(row, "revisado")}>
                    Marcar revisado
                  </button>

                  <button className="btn secondary" onClick={() => updateStatus(row, "resuelto")}>
                    Marcar resuelto
                  </button>

                  <button className="btn ghost" onClick={() => updateStatus(row, "descartado")}>
                    Descartar
                  </button>

                  <button className="btn ghost" onClick={() => updateStatus(row, "nuevo")}>
                    Volver a nuevo
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}