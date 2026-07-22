"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { PageHeader } from "@/components/PageHeader";
import { DEMO_ACCOUNT_ID } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";

type StaffRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  active: boolean | null;
  auth_user_id: string | null;
  auth_status: string | null;
  must_change_password:
    | boolean
    | null;
  auth_created_at: string | null;
  last_login_at: string | null;
};

type Draft = {
  email: string;
  password: string;
};

function roleLabel(role: string) {
  if (role === "owner") {
    return "Dueño";
  }

  if (role === "admin") {
    return "Administrador";
  }

  if (role === "organizer") {
    return "Organizador";
  }

  return "Asistente";
}

function randomPassword() {
  const letters =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  let result = "PTM-";

  for (
    let index = 0;
    index < 10;
    index += 1
  ) {
    result +=
      letters[
        Math.floor(
          Math.random() *
            letters.length
        )
      ];
  }

  return result;
}

function recoveryRedirect() {
  return `${window.location.origin}/nueva-clave`;
}

export default function UsuariosAccesoPage() {
  const [rows, setRows] =
    useState<StaffRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [notice, setNotice] =
    useState("");

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [draft, setDraft] =
    useState<Draft>({
      email: "",
      password:
        randomPassword(),
    });

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    void loadRows();
  }, []);

  async function loadRows() {
    setLoading(true);
    setNotice("");

    try {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "staff_members_demo"
          )
          .select(
            "id, full_name, email, phone, role, active, auth_user_id, auth_status, must_change_password, auth_created_at, last_login_at"
          )
          .eq(
            "account_id",
            DEMO_ACCOUNT_ID
          )
          .order("role")
          .order("full_name");

      if (error) {
        throw error;
      }

      setRows(
        (data ??
          []) as StaffRow[]
      );
    } catch (error: any) {
      setNotice(
        `No se pudieron cargar los accesos: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  }

  const selected =
    useMemo(
      () =>
        rows.find(
          (row) =>
            row.id === selectedId
        ) ?? null,
      [rows, selectedId]
    );

  function selectRow(
    row: StaffRow
  ) {
    setSelectedId(row.id);

    setDraft({
      email: row.email ?? "",
      password:
        randomPassword(),
    });

    setNotice("");
  }

  async function authAction(
    action:
      | "create_access"
      | "disable_access"
      | "enable_access"
      | "temporary_password"
  ) {
    if (!selected) return;

    setSaving(true);
    setNotice("");

    try {
      const {
        data: sessionData,
      } =
        await supabase.auth
          .getSession();

      const accessToken =
        sessionData.session
          ?.access_token;

      if (!accessToken) {
        throw new Error(
          "La sesión venció. Vuelve a ingresar."
        );
      }

      const response =
        await fetch(
          "/api/admin/staff-access",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              action,
              staffId:
                selected.id,
              email:
                draft.email
                  .trim()
                  .toLowerCase(),
              temporaryPassword:
                draft.password,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "No se pudo completar la acción."
        );
      }

      setNotice(
        result.message ??
          "Acción completada."
      );

      await loadRows();
    } catch (error: any) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendRecovery(
    row: StaffRow
  ) {
    if (!row.email) {
      setNotice(
        "Este usuario no tiene correo registrado."
      );
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      const { error } =
        await supabase.auth
          .resetPasswordForEmail(
            row.email,
            {
              redirectTo:
                recoveryRedirect(),
            }
          );

      if (error) {
        throw error;
      }

      setNotice(
        `Se envió el enlace de recuperación a ${row.email}.`
      );
    } catch (error: any) {
      setNotice(
        `No se pudo enviar el correo: ${error.message}`
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageHeader
        title="Accesos"
        description="Cargando usuarios..."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Accesos"
        description="Crea correo y contraseña individual para cada usuario interno."
        action={
          <button
            className="btn secondary"
            onClick={() =>
              void loadRows()
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

      <div className="access-layout">
        <section className="card">
          <div className="section-title-row">
            <h2>Usuarios internos</h2>

            <span className="badge neutral">
              {rows.length}
            </span>
          </div>

          <div className="access-user-list">
            {rows.map((row) => (
              <button
                className={
                  selectedId === row.id
                    ? "access-user-row selected"
                    : "access-user-row"
                }
                key={row.id}
                onClick={() =>
                  selectRow(row)
                }
                type="button"
              >
                <div className="access-user-avatar">
                  {row.full_name
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>
                  <strong>
                    {row.full_name}
                  </strong>

                  <small>
                    {roleLabel(
                      row.role
                    )}
                    {" · "}
                    {row.email ??
                      "Sin correo"}
                  </small>
                </div>

                <span
                  className={`badge ${
                    row.auth_status ===
                      "deshabilitado"
                      ? "danger"
                      : row.auth_user_id
                        ? "good"
                        : "neutral"
                  }`}
                >
                  {row.auth_status ===
                  "deshabilitado"
                    ? "Deshabilitado"
                    : row.auth_user_id
                      ? "Con acceso"
                      : "Sin acceso"}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          {!selected ? (
            <div className="empty-compact">
              <span>🔐</span>

              <strong>
                Selecciona un usuario
              </strong>

              <p>
                Aquí podrás crear,
                recuperar o deshabilitar
                su acceso.
              </p>
            </div>
          ) : (
            <>
              <div className="section-title-row">
                <div>
                  <h2>
                    {selected.full_name}
                  </h2>

                  <p>
                    {roleLabel(
                      selected.role
                    )}
                  </p>
                </div>

                <span
                  className={`badge ${
                    selected.active ===
                    false
                      ? "danger"
                      : "good"
                  }`}
                >
                  {selected.active ===
                  false
                    ? "Inactivo"
                    : "Activo"}
                </span>
              </div>

              {!selected.auth_user_id ? (
                <div className="auth-form">
                  <label>
                    Correo de acceso
                    <input
                      type="email"
                      value={
                        draft.email
                      }
                      placeholder="usuario@correo.com"
                      onChange={(event) =>
                        setDraft(
                          (current) => ({
                            ...current,
                            email:
                              event.target
                                .value,
                          })
                        )
                      }
                    />
                  </label>

                  <label>
                    Contraseña temporal
                    <input
                      type="text"
                      value={
                        draft.password
                      }
                      onChange={(event) =>
                        setDraft(
                          (current) => ({
                            ...current,
                            password:
                              event.target
                                .value,
                          })
                        )
                      }
                    />
                  </label>

                  <div className="row-actions">
                    <button
                      className="btn secondary"
                      onClick={() =>
                        setDraft(
                          (current) => ({
                            ...current,
                            password:
                              randomPassword(),
                          })
                        )
                      }
                    >
                      Generar otra
                    </button>

                    <button
                      className="btn save"
                      disabled={saving}
                      onClick={() =>
                        void authAction(
                          "create_access"
                        )
                      }
                    >
                      Crear acceso
                    </button>
                  </div>

                  <p className="help-text">
                    Al ingresar por primera
                    vez deberá cambiar esta
                    contraseña.
                  </p>
                </div>
              ) : (
                <>
                  <div className="access-info-grid">
                    <div>
                      <small>
                        Correo
                      </small>
                      <strong>
                        {selected.email}
                      </strong>
                    </div>

                    <div>
                      <small>
                        Estado
                      </small>
                      <strong>
                        {selected.auth_status ??
                          "Activo"}
                      </strong>
                    </div>

                    <div>
                      <small>
                        Debe cambiar clave
                      </small>
                      <strong>
                        {selected.must_change_password
                          ? "Sí"
                          : "No"}
                      </strong>
                    </div>

                    <div>
                      <small>
                        Último ingreso
                      </small>
                      <strong>
                        {selected.last_login_at
                          ? new Date(
                              selected.last_login_at
                            ).toLocaleString(
                              "es-EC"
                            )
                          : "Nunca"}
                      </strong>
                    </div>
                  </div>

                  <div className="row-actions">
                    <button
                      className="btn edit"
                      disabled={
                        saving ||
                        !selected.email
                      }
                      onClick={() =>
                        void sendRecovery(
                          selected
                        )
                      }
                    >
                      Enviar recuperación
                    </button>

                    {selected.auth_status ===
                    "deshabilitado" ? (
                      <button
                        className="btn activate"
                        disabled={saving}
                        onClick={() =>
                          void authAction(
                            "enable_access"
                          )
                        }
                      >
                        Habilitar acceso
                      </button>
                    ) : (
                      <button
                        className="btn deactivate"
                        disabled={saving}
                        onClick={() =>
                          void authAction(
                            "disable_access"
                          )
                        }
                      >
                        Deshabilitar acceso
                      </button>
                    )}
                  </div>

                  <details className="access-temp-password">
                    <summary>
                      Crear contraseña
                      temporal
                    </summary>

                    <label>
                      Nueva contraseña
                      temporal
                      <input
                        type="text"
                        value={
                          draft.password
                        }
                        onChange={(event) =>
                          setDraft(
                            (current) => ({
                              ...current,
                              password:
                                event.target
                                  .value,
                            })
                          )
                        }
                      />
                    </label>

                    <div className="row-actions">
                      <button
                        className="btn secondary"
                        onClick={() =>
                          setDraft(
                            (current) => ({
                              ...current,
                              password:
                                randomPassword(),
                            })
                          )
                        }
                      >
                        Generar otra
                      </button>

                      <button
                        className="btn save"
                        disabled={saving}
                        onClick={() =>
                          void authAction(
                            "temporary_password"
                          )
                        }
                      >
                        Guardar temporal
                      </button>
                    </div>
                  </details>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}