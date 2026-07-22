"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY =
  "ptm_demo_access_token_v1";

const DEFAULT_ADMIN_ID =
  "admin-demo";

type LoginResponse = {
  ok?: boolean;
  next?: string;
  accessToken?: string;
  error?: string;
};

function resetOperatorToAdmin() {
  window.localStorage.setItem(
    "ptm.selectedStaffId",
    DEFAULT_ADMIN_ID
  );

  window.localStorage.removeItem(
    "ptm.selectedStaffSnapshot"
  );

  window.localStorage.removeItem(
    "ptm.sessionMode"
  );

  window.localStorage.removeItem(
    "ptm.lastEventId"
  );

  window.localStorage.removeItem(
    "ptm.lastEventMeta"
  );
}

export default function EntradaPage() {
  const [pin, setPin] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [notice, setNotice] =
    useState("");

  useEffect(() => {
    const parameters =
      new URLSearchParams(
        window.location.search
      );

    const sessionWasClosed =
      parameters.get("cerrado") === "1" ||
      parameters.get("logout") === "1";

    if (sessionWasClosed) {
      window.localStorage.removeItem(
        STORAGE_KEY
      );

      resetOperatorToAdmin();

      setNotice(
        "El acceso fue cerrado correctamente. Al entrar comenzarás como Administrador general."
      );
    }
  }, []);

  async function submitLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const normalizedPin =
      pin.trim();

    if (!normalizedPin) {
      setNotice(
        "Escribe la clave de entrada."
      );
      return;
    }

    setLoading(true);
    setNotice(
      "Comprobando clave..."
    );

    try {
      const parameters =
        new URLSearchParams(
          window.location.search
        );

      const requestedNext =
        parameters.get("next") ?? "/";

      const response = await fetch(
        "/api/demo-login",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
            "Cache-Control":
              "no-cache",
          },
          body: JSON.stringify({
            pin: normalizedPin,
            next: requestedNext,
          }),
        }
      );

      const result =
        (await response.json()) as LoginResponse;

      if (
        !response.ok ||
        result.ok !== true
      ) {
        throw new Error(
          result.error ??
            "No se pudo validar la clave."
        );
      }

      if (!result.accessToken) {
        throw new Error(
          "El servidor no devolvió una sesión válida."
        );
      }

      window.localStorage.setItem(
        STORAGE_KEY,
        result.accessToken
      );

      resetOperatorToAdmin();

      setNotice(
        "Clave correcta. Entrando como Administrador general..."
      );

      const destination =
        result.next &&
        result.next.startsWith("/") &&
        !result.next.startsWith("//") &&
        !result.next.startsWith(
          "/entrada"
        )
          ? result.next
          : "/";

      window.location.replace(
        destination
      );
    } catch (error: any) {
      setNotice(
        error.message ??
          "No se pudo entrar."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          padding: 34,
          borderRadius: 26,
          background: "white",
          border:
            "1px solid #dfe3ea",
          boxShadow:
            "0 18px 50px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 22,
          }}
        >
          <span className="badge good">
            Pro Team Max
          </span>

          <span className="badge warn">
            Acceso temporal
          </span>
        </div>

        <h1
          style={{
            marginTop: 0,
            marginBottom: 14,
            fontSize:
              "clamp(36px, 8vw, 58px)",
            lineHeight: 1.05,
          }}
        >
          Entrar a la aplicación
        </h1>

        <p
          style={{
            fontSize: 20,
            lineHeight: 1.55,
            color: "#6b7280",
          }}
        >
          Escribe la clave temporal.
          Al entrar comenzarás como
          Administrador general.
        </p>

        <form
          onSubmit={submitLogin}
          style={{
            marginTop: 28,
          }}
        >
          <label
            style={{
              display: "block",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Clave de entrada
          </label>

          <input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="12345678"
            value={pin}
            disabled={loading}
            onChange={(event) =>
              setPin(
                event.target.value
              )
            }
            style={{
              width: "100%",
              minHeight: 60,
              fontSize: 22,
            }}
          />

          <button
            type="submit"
            className="btn"
            disabled={loading}
            style={{
              marginTop: 14,
              minHeight: 54,
              fontSize: 18,
              paddingLeft: 28,
              paddingRight: 28,
            }}
          >
            {loading
              ? "Comprobando..."
              : "Entrar"}
          </button>
        </form>

        {notice ? (
          <div
            className="mini-panel"
            style={{
              marginTop: 20,
            }}
          >
            <strong>
              {notice}
            </strong>
          </div>
        ) : null}

        <p
          style={{
            marginTop: 26,
            marginBottom: 0,
            color: "#6b7280",
            lineHeight: 1.5,
          }}
        >
          Cuando necesites probar como
          asistente, usa la pantalla
          Acceso asistentes. Al cerrar
          acceso y volver a entrar,
          regresará al Administrador
          general.
        </p>
      </div>
    </div>
  );
}