"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DEMO_ACCOUNT_ID } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";

type VenueRow = {
  id: string;
  name: string;
};

const categories = [
  { value: "C1", label: "Primera" },
  { value: "C2", label: "Segunda" },
  { value: "C3", label: "Tercera" },
  { value: "C4", label: "Cuarta" },
  { value: "C5", label: "Quinta" },
  { value: "C6", label: "Sexta" },
  { value: "C7", label: "Novatos" },
];

const dayOptions = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

const fallbackVenues = [
  "La Perla",
  "WE",
  "Spot Padel",
  "Manta",
];

function toggleValue(
  list: string[],
  value: string
) {
  return list.includes(value)
    ? list.filter(
        (item) => item !== value
      )
    : [...list, value];
}

function cleanPhone(value: string) {
  return value.replace(
    /[^0-9]/g,
    ""
  );
}

function normalizePhoneForStorage(
  value: string
) {
  const digits = cleanPhone(value);

  if (!digits) {
    return "";
  }

  if (
    digits.startsWith("0") &&
    digits.length === 10
  ) {
    return `+593${digits.slice(1)}`;
  }

  if (digits.startsWith("593")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export default function QuieroJugarPage() {
  const [venues, setVenues] =
    useState<VenueRow[]>([]);

  const [loadingVenues, setLoadingVenues] =
    useState(true);

  const [fullName, setFullName] =
    useState("");

  const [whatsapp, setWhatsapp] =
    useState("+593");

  const [email, setEmail] =
    useState("");

  const [category, setCategory] =
    useState("C5");

  const [
    preferredVenues,
    setPreferredVenues,
  ] = useState<string[]>([
    "Me da igual",
  ]);

  const [
    preferredDays,
    setPreferredDays,
  ] = useState<string[]>([]);

  const [
    preferredTimes,
    setPreferredTimes,
  ] = useState("Noche 19:00 a 22:00");

  const [message, setMessage] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [notice, setNotice] =
    useState("");

  useEffect(() => {
    loadVenues();
  }, []);

  async function loadVenues() {
    setLoadingVenues(true);

    try {
      const response = await supabase
        .from("venues")
        .select("id, name")
        .eq(
          "account_id",
          DEMO_ACCOUNT_ID
        )
        .eq("active", true)
        .order("name");

      if (response.error) {
        throw response.error;
      }

      setVenues(
        (response.data ?? []) as VenueRow[]
      );
    } catch {
      setVenues(
        fallbackVenues.map(
          (name, index) => ({
            id: String(index),
            name,
          })
        )
      );
    } finally {
      setLoadingVenues(false);
    }
  }

  function toggleVenue(
    venueName: string
  ) {
    setPreferredVenues(
      (current) => {
        if (
          venueName === "Me da igual"
        ) {
          return current.includes(
            "Me da igual"
          )
            ? []
            : ["Me da igual"];
        }

        const withoutAny =
          current.filter(
            (item) =>
              item !== "Me da igual"
          );

        return toggleValue(
          withoutAny,
          venueName
        );
      }
    );
  }

  async function submitRequest() {
    const name = fullName.trim();

    const phone =
      normalizePhoneForStorage(
        whatsapp
      );

    if (!name) {
      setNotice(
        "Escribe tu nombre para poder contactarte."
      );
      return;
    }

    if (
      !phone ||
      cleanPhone(phone).length < 10
    ) {
      setNotice(
        "Escribe un WhatsApp válido. Ejemplo: +593999999999."
      );
      return;
    }

    if (!preferredDays.length) {
      setNotice(
        "Selecciona por lo menos un día en el que normalmente puedas jugar."
      );
      return;
    }

    if (!preferredVenues.length) {
      setNotice(
        "Selecciona una sede o marca “Me da igual”."
      );
      return;
    }

    setSaving(true);
    setNotice(
      "Enviando solicitud..."
    );

    try {
      const existingRes =
        await supabase
          .from(
            "player_requests_demo"
          )
          .select(
            "id, whatsapp, status"
          )
          .eq(
            "account_id",
            DEMO_ACCOUNT_ID
          )
          .in("status", [
            "pendiente",
            "contactado",
            "convocado",
          ])
          .order("created_at", {
            ascending: false,
          })
          .limit(200);

      if (existingRes.error) {
        throw existingRes.error;
      }

      const existingRequest =
        (
          existingRes.data ?? []
        ).find(
          (row: any) =>
            cleanPhone(
              row.whatsapp ?? ""
            ) === cleanPhone(phone)
        );

      const payload = {
        account_id:
          DEMO_ACCOUNT_ID,

        full_name: name,
        whatsapp: phone,
        email:
          email.trim() || null,

        category,

        preferred_venues:
          preferredVenues,

        preferred_days:
          preferredDays,

        preferred_times:
          preferredTimes.trim() ||
          null,

        message:
          message.trim() || null,

        status: "pendiente",
        source: "quiero_jugar",
        updated_at:
          new Date().toISOString(),
      };

      if (existingRequest?.id) {
        const updateRes =
          await supabase
            .from(
              "player_requests_demo"
            )
            .update(payload)
            .eq(
              "id",
              existingRequest.id
            );

        if (updateRes.error) {
          throw updateRes.error;
        }

        setNotice(
          "Tu solicitud anterior fue actualizada. Un organizador revisará tus nuevos días y horarios."
        );
      } else {
        const insertRes =
          await supabase
            .from(
              "player_requests_demo"
            )
            .insert({
              ...payload,
              created_at:
                new Date().toISOString(),
            });

        if (insertRes.error) {
          throw insertRes.error;
        }

        setNotice(
          "Solicitud enviada. Un organizador te escribirá por WhatsApp cuando haya un partido que coincida con tu nivel y horario."
        );
      }

      setFullName("");
      setWhatsapp("+593");
      setEmail("");
      setCategory("C5");

      setPreferredVenues([
        "Me da igual",
      ]);

      setPreferredDays([]);

      setPreferredTimes(
        "Noche 19:00 a 22:00"
      );

      setMessage("");
    } catch (error: any) {
      setNotice(
        `No se pudo enviar la solicitud: ${error.message}`
      );
    } finally {
      setSaving(false);
    }
  }

  const venueNames =
    venues.length
      ? venues.map(
          (venue) => venue.name
        )
      : fallbackVenues;

  return (
    <>
      <PageHeader
        title="Quiero jugar"
        description="Cuéntanos cuándo y dónde puedes jugar. El administrador revisará tu solicitud."
      />

      <div
        className="card"
        style={{
          marginBottom: 16,
        }}
      >
        <div className="row-actions">
          <span className="badge good">
            Solicitud de jugador
          </span>

          <span className="badge warn">
            Categoría por validar
          </span>
        </div>

        <p className="help-text">
          La categoría que selecciones
          es aproximada. El
          administrador confirmará tu
          categoría principal,
          categoría secundaria,
          comunidades y disponibilidad.
        </p>

        <p className="help-text">
          El jugador no puede cambiar
          directamente sus datos
          administrativos después de
          ser registrado.
        </p>

        {notice ? (
          <p>
            <strong>
              {notice}
            </strong>
          </p>
        ) : null}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>
            Tus datos
          </h2>

          <div className="form">
            <label>
              Nombre completo

              <input
                placeholder="Ejemplo: Carlos Pérez"
                value={fullName}
                onChange={(event) =>
                  setFullName(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              WhatsApp

              <input
                placeholder="+593999999999"
                value={whatsapp}
                onChange={(event) =>
                  setWhatsapp(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Email opcional

              <input
                type="email"
                placeholder="jugador@email.com"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Categoría aproximada

              <select
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target.value
                  )
                }
              >
                {categories.map(
                  (item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  )
                )}
              </select>
            </label>

            <p className="help-text">
              No te preocupes si no
              estás seguro de tu nivel.
              El administrador puede
              corregirlo antes de
              agregarte a los partidos.
            </p>
          </div>
        </div>

        <div className="card">
          <h2>
            Disponibilidad
          </h2>

          <h3>
            Sedes donde puedes jugar
          </h3>

          {loadingVenues ? (
            <p className="help-text">
              Cargando sedes...
            </p>
          ) : null}

          <div className="row-actions">
            {venueNames.map(
              (venueName) => (
                <button
                  type="button"
                  key={venueName}
                  className={
                    preferredVenues.includes(
                      venueName
                    )
                      ? "btn"
                      : "btn secondary"
                  }
                  onClick={() =>
                    toggleVenue(
                      venueName
                    )
                  }
                >
                  {venueName}
                </button>
              )
            )}

            <button
              type="button"
              className={
                preferredVenues.includes(
                  "Me da igual"
                )
                  ? "btn"
                  : "btn secondary"
              }
              onClick={() =>
                toggleVenue(
                  "Me da igual"
                )
              }
            >
              Me da igual
            </button>
          </div>

          <h3>
            Días disponibles
          </h3>

          <div className="row-actions">
            {dayOptions.map(
              (day) => (
                <button
                  type="button"
                  key={day}
                  className={
                    preferredDays.includes(
                      day
                    )
                      ? "btn"
                      : "btn secondary"
                  }
                  onClick={() =>
                    setPreferredDays(
                      (current) =>
                        toggleValue(
                          current,
                          day
                        )
                    )
                  }
                >
                  {day}
                </button>
              )
            )}
          </div>

          <label>
            Horario aproximado

            <input
              placeholder="Ejemplo: 19:00 a 22:00"
              value={preferredTimes}
              onChange={(event) =>
                setPreferredTimes(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Mensaje opcional

            <textarea
              placeholder="Ejemplo: juego de drive, prefiero partidos competitivos o puedo jugar con poca anticipación."
              value={message}
              onChange={(event) =>
                setMessage(
                  event.target.value
                )
              }
              style={{
                minHeight: 110,
              }}
            />
          </label>

          <button
            className="btn full"
            disabled={saving}
            onClick={submitRequest}
          >
            {saving
              ? "Enviando..."
              : "Enviar solicitud"}
          </button>
        </div>
      </div>
    </>
  );
}