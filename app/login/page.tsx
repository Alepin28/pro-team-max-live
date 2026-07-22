"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function errorMessage(code: string | null) {
  if (code === "sin-perfil") {
    return "Tu correo existe, pero todavía no está vinculado a un usuario interno.";
  }

  if (code === "deshabilitado") {
    return "Este acceso está deshabilitado. Habla con el dueño o administrador.";
  }

  if (code === "sesion") {
    return "No se pudo validar la sesión. Vuelve a ingresar.";
  }

  return "";
}

function friendlyLoginError(error: any) {
  const message = String(error?.message ?? "").toLowerCase();

  if (
    message.includes("email not confirmed") ||
    message.includes("not confirmed")
  ) {
    return "El correo todavía no está confirmado. Habla con el administrador.";
  }

  if (
    message.includes("user not found") ||
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials")
  ) {
    return "El correo o la contraseña no son correctos.";
  }

  if (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("failed")
  ) {
    return "No se pudo conectar con el servidor. Revisa internet e intenta otra vez.";
  }

  return "No se pudo ingresar. Revisa el correo y la contraseña.";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [loading, setLoading] = useState(false);

  const [notice, setNotice] = useState(
    errorMessage(searchParams.get("error"))
  );

  const returnPath = useMemo(() => {
    const raw = searchParams.get("volver");

    if (raw && raw.startsWith("/")) {
      return raw;
    }

    return "/";
  }, [searchParams]);

  useEffect(() => {
    async function redirectSession() {
      const { data, error } =
        await supabase.auth.getSession();

      if (error) {
        console.error(
          "Error revisando sesión:",
          error
        );
        return;
      }

      if (
        data.session &&
        !searchParams.get("error")
      ) {
        router.replace(returnPath);
      }
    }

    void redirectSession();
  }, [router, searchParams, returnPath]);

  async function signIn(event: FormEvent) {
    event.preventDefault();

    const cleanEmail = email
      .trim()
      .toLowerCase();

    if (!cleanEmail || !password) {
      setNotice(
        "Escribe tu correo y contraseña."
      );
      return;
    }

    setLoading(true);
    setNotice("");

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        console.error(
          "Error de login Supabase:",
          error
        );

        setNotice(
          friendlyLoginError(error)
        );

        return;
      }

      if (!data.session) {
        setNotice(
          "No se pudo iniciar sesión. Intenta otra vez."
        );
        return;
      }

      router.replace(returnPath);
    } catch (error: any) {
      console.error(
        "Error inesperado en login:",
        error
      );

      setNotice(
        friendlyLoginError(error)
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo">
          PTM
        </div>

        <div>
          <h1>Ingresar</h1>

          <p>
            Acceso interno de Pro Team Max.
          </p>
        </div>

        {notice ? (
          <div className="inline-error">
            {notice}
          </div>
        ) : null}

        <form
          className="auth-form"
          onSubmit={signIn}
        >
          <label>
            Correo
            <input
              autoComplete="email"
              type="email"
              value={email}
              placeholder="nombre@correo.com"
              onChange={(event) =>
                setEmail(event.target.value)
              }
            />
          </label>

          <label>
            Contraseña
            <input
              autoComplete="current-password"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={password}
              placeholder="Tu contraseña"
              onChange={(event) =>
                setPassword(event.target.value)
              }
            />
          </label>

          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) =>
                setShowPassword(
                  event.target.checked
                )
              }
            />

            Mostrar contraseña
          </label>

          <button
            className="btn save"
            disabled={loading}
            type="submit"
          >
            {loading
              ? "Ingresando..."
              : "Ingresar"}
          </button>
        </form>

        <div className="auth-links">
          <Link href="/recuperar-clave">
            Olvidé mi contraseña
          </Link>

          <Link href="/configurar-acceso-inicial">
            Primera configuración
          </Link>
        </div>
      </section>
    </main>
  );
}