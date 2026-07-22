"use client";

import Link from "next/link";
import {
  FormEvent,
  useState,
} from "react";
import { supabase } from "@/lib/supabaseClient";

export default function RecuperarClavePage() {
  const [email, setEmail] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [notice, setNotice] =
    useState("");

  const [sent, setSent] =
    useState(false);

  async function sendRecovery(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!email.trim()) {
      setNotice(
        "Escribe tu correo."
      );
      return;
    }

    setLoading(true);
    setNotice("");

    try {
      const redirectTo =
        `${window.location.origin}` +
        "/nueva-clave";

      const { error } =
        await supabase.auth
          .resetPasswordForEmail(
            email
              .trim()
              .toLowerCase(),
            {
              redirectTo,
            }
          );

      if (error) {
        throw error;
      }

      setSent(true);
    } catch (error: any) {
      setNotice(
        `No se pudo enviar el correo: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo">
          🔑
        </div>

        <div>
          <h1>
            Recuperar contraseña
          </h1>

          <p>
            Te enviaremos un enlace
            para crear una contraseña
            nueva.
          </p>
        </div>

        {sent ? (
          <div className="auth-success">
            <strong>
              Revisa tu correo
            </strong>

            <p>
              Si el correo está
              registrado, recibirás el
              enlace de recuperación.
            </p>
          </div>
        ) : (
          <form
            className="auth-form"
            onSubmit={sendRecovery}
          >
            {notice ? (
              <div className="inline-error">
                {notice}
              </div>
            ) : null}

            <label>
              Correo
              <input
                autoComplete="email"
                type="email"
                value={email}
                placeholder="nombre@correo.com"
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
              />
            </label>

            <button
              className="btn save"
              disabled={loading}
              type="submit"
            >
              {loading
                ? "Enviando..."
                : "Enviar enlace"}
            </button>
          </form>
        )}

        <div className="auth-links">
          <Link href="/login">
            Volver a Ingresar
          </Link>
        </div>
      </section>
    </main>
  );
}