"use client";

import Link from "next/link";
import {
  FormEvent,
  useState,
} from "react";

export default function ConfigurarAccesoInicialPage() {
  const [fullName, setFullName] =
    useState("Alejandro Pincay");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirm, setConfirm] =
    useState("");

  const [setupSecret, setSetupSecret] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [notice, setNotice] =
    useState("");

  const [finished, setFinished] =
    useState(false);

  async function bootstrap(
    event: FormEvent
  ) {
    event.preventDefault();

    if (
      !fullName.trim() ||
      !email.trim() ||
      !setupSecret.trim()
    ) {
      setNotice(
        "Completa nombre, correo y clave de configuración."
      );
      return;
    }

    if (password.length < 8) {
      setNotice(
        "La contraseña temporal debe tener al menos 8 caracteres."
      );
      return;
    }

    if (
      password !== confirm
    ) {
      setNotice(
        "Las contraseñas no coinciden."
      );
      return;
    }

    setLoading(true);
    setNotice("");

    try {
      const response =
        await fetch(
          "/api/auth/bootstrap-owner",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              fullName:
                fullName.trim(),
              email:
                email
                  .trim()
                  .toLowerCase(),
              password,
              setupSecret:
                setupSecret.trim(),
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "No se pudo crear el acceso inicial."
        );
      }

      setFinished(true);
    } catch (error: any) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card auth-card-wide">
        <div className="auth-logo">
          👑
        </div>

        <div>
          <h1>
            Acceso inicial del dueño
          </h1>

          <p>
            Este formulario funciona
            una sola vez. Después se
            bloquea automáticamente.
          </p>
        </div>

        {finished ? (
          <div className="auth-success">
            <strong>
              Acceso creado
            </strong>

            <p>
              Ya puedes ingresar con
              tu correo y contraseña
              temporal.
            </p>

            <Link
              className="btn save"
              href="/login"
            >
              Ir a Ingresar
            </Link>
          </div>
        ) : (
          <form
            className="auth-form"
            onSubmit={bootstrap}
          >
            {notice ? (
              <div className="inline-error">
                {notice}
              </div>
            ) : null}

            <label>
              Nombre del dueño
              <input
                value={fullName}
                onChange={(event) =>
                  setFullName(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Correo del dueño
              <input
                autoComplete="email"
                type="email"
                value={email}
                placeholder="tu-correo@dominio.com"
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Contraseña temporal
              <input
                autoComplete="new-password"
                type="password"
                value={password}
                placeholder="Mínimo 8 caracteres"
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Repetir contraseña
              <input
                autoComplete="new-password"
                type="password"
                value={confirm}
                onChange={(event) =>
                  setConfirm(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Clave de configuración
              <input
                type="password"
                value={setupSecret}
                placeholder="La que pusiste en .env.local"
                onChange={(event) =>
                  setSetupSecret(
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
                ? "Creando acceso..."
                : "Crear acceso del dueño"}
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