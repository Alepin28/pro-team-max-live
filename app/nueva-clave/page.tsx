"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function getErrorMessage(error: any) {
  if (!error) {
    return "Error desconocido.";
  }

  if (typeof error === "string") {
    return error;
  }

  return (
    error.message ||
    error.error_description ||
    error.details ||
    JSON.stringify(error)
  );
}

export default function NuevaClavePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const mandatory =
    searchParams.get("obligatorio") === "1";

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const { data, error } =
        await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (error) {
        console.error(
          "Error revisando sesión en nueva clave:",
          error
        );
      }

      setReady(Boolean(data.session));
      setChecking(false);
    }

    void checkSession();

    const { data: listener } =
      supabase.auth.onAuthStateChange(
        (event, session) => {
          if (
            event === "PASSWORD_RECOVERY" ||
            event === "SIGNED_IN" ||
            event === "TOKEN_REFRESHED" ||
            event === "INITIAL_SESSION"
          ) {
            setReady(Boolean(session));
            setChecking(false);
          }
        }
      );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function completeInternalFlag() {
    const { data: sessionData, error } =
      await supabase.auth.getSession();

    if (error) {
      throw new Error(
        "No se pudo leer la sesión actual: " +
          getErrorMessage(error)
      );
    }

    const accessToken =
      sessionData.session?.access_token;

    if (!accessToken) {
      throw new Error(
        "No hay sesión activa para terminar el cambio de contraseña."
      );
    }

    const response = await fetch(
      "/api/auth/complete-password-change",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      }
    );

    const payload = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      throw new Error(
        payload?.error ||
          payload?.message ||
          "No se pudo actualizar el perfil interno."
      );
    }

    return payload;
  }

  async function updatePassword(event: FormEvent) {
    event.preventDefault();

    if (password.length < 8) {
      setNotice(
        "La contraseña debe tener al menos 8 caracteres."
      );
      return;
    }

    if (password !== confirm) {
      setNotice(
        "Las contraseñas no coinciden."
      );
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      const { error } =
        await supabase.auth.updateUser({
          password,
        });

      if (error) {
        throw new Error(
          "Supabase no pudo cambiar la contraseña: " +
            getErrorMessage(error)
        );
      }

      await completeInternalFlag();

      setNotice(
        "Contraseña guardada correctamente. Entrando..."
      );

      router.replace("/");
      router.refresh();
    } catch (error: any) {
      console.error(
        "Error cambiando contraseña:",
        error
      );

      setNotice(
        `No se pudo cambiar la contraseña: ${getErrorMessage(
          error
        )}`
      );
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-logo">
            🔐
          </div>

          <h1>Revisando sesión</h1>

          <p>
            Un momento, estamos validando tu acceso.
          </p>
        </section>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-logo">
            🔒
          </div>

          <h1>Enlace no disponible</h1>

          <p>
            El enlace puede haber vencido o ya fue utilizado.
          </p>

          <Link
            className="btn save"
            href="/recuperar-clave"
          >
            Pedir otro enlace
          </Link>

          <Link
            className="btn secondary"
            href="/login"
          >
            Volver a ingresar
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo">
          🔐
        </div>

        <div>
          <h1>Crear contraseña nueva</h1>

          <p>
            {mandatory
              ? "Por seguridad, cambia la contraseña temporal antes de continuar."
              : "Escribe la contraseña que usarás desde ahora."}
          </p>
        </div>

        {notice ? (
          <div className="inline-error">
            {notice}
          </div>
        ) : null}

        <form
          className="auth-form"
          onSubmit={updatePassword}
        >
          <label>
            Contraseña nueva
            <input
              autoComplete="new-password"
              type="password"
              value={password}
              placeholder="Mínimo 8 caracteres"
              onChange={(event) =>
                setPassword(event.target.value)
              }
            />
          </label>

          <label>
            Repetir contraseña
            <input
              autoComplete="new-password"
              type="password"
              value={confirm}
              placeholder="Repite la contraseña"
              onChange={(event) =>
                setConfirm(event.target.value)
              }
            />
          </label>

          <button
            className="btn save"
            disabled={saving}
            type="submit"
          >
            {saving
              ? "Guardando..."
              : "Guardar contraseña"}
          </button>
        </form>
      </section>
    </main>
  );
}