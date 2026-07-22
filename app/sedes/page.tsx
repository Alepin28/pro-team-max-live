"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  City,
  Country,
} from "country-state-city";
import { PageHeader } from "@/components/PageHeader";
import { DEMO_ACCOUNT_ID } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";

type VenueRow = {
  id: string;
  name: string;
  country: string | null;
  country_code: string | null;
  city: string | null;
  courts_count: number | null;
  default_duration_minutes: number | null;
  active: boolean | null;
  image_url: string | null;
  avatar_emoji: string | null;
};

type EventRow = {
  id: string;
  venue_id: string;
  status: string;
};

type VenueDraft = {
  name: string;
  countryName: string;
  countryCode: string;
  city: string;
  courtsCount: string;
  defaultDurationMinutes: string;
  active: boolean;
  imageUrl: string;
  avatarEmoji: string;
};

type StatusFilter =
  | "activas"
  | "inactivas"
  | "todas";

type CountryOption = {
  name: string;
  isoCode: string;
  flag?: string;
};

type CityOption = {
  name: string;
};

const AVATARS = [
  "🏟️",
  "🎾",
  "🌴",
  "🏢",
  "🏫",
  "🌊",
  "⛰️",
  "⭐",
];

const COUNTRY_OPTIONS = (
  Country.getAllCountries() as CountryOption[]
)
  .map((country) => ({
    name: country.name,
    isoCode: country.isoCode,
    flag: country.flag,
  }))
  .sort((left, right) =>
    left.name.localeCompare(right.name, "es")
  );

const EMPTY_DRAFT: VenueDraft = {
  name: "",
  countryName: "Ecuador",
  countryCode: "EC",
  city: "Guayaquil",
  courtsCount: "1",
  defaultDurationMinutes: "90",
  active: true,
  imageUrl: "",
  avatarEmoji: "🏟️",
};

function isSystemVenue(venue: VenueRow) {
  const normalized =
    venue.name.trim().toLowerCase();

  return (
    normalized === "otra / por definir" ||
    normalized === "otra/por definir"
  );
}

function countryNameFromCode(code?: string | null) {
  const normalized =
    (code ?? "EC").trim().toUpperCase();

  return (
    COUNTRY_OPTIONS.find(
      (country) =>
        country.isoCode === normalized
    )?.name ?? "Ecuador"
  );
}

function draftFromVenue(
  venue: VenueRow
): VenueDraft {
  const countryCode =
    venue.country_code?.trim().toUpperCase() ||
    "EC";

  return {
    name: venue.name,
    countryName:
      venue.country?.trim() ||
      countryNameFromCode(countryCode),
    countryCode,
    city: venue.city ?? "Guayaquil",
    courtsCount: String(
      Number(venue.courts_count ?? 1)
    ),
    defaultDurationMinutes: String(
      Number(
        venue.default_duration_minutes ?? 90
      )
    ),
    active: venue.active !== false,
    imageUrl: venue.image_url ?? "",
    avatarEmoji:
      venue.avatar_emoji?.trim() || "🏟️",
  };
}

function validateDraft(draft: VenueDraft) {
  const name = draft.name.trim();
  const country = draft.countryName.trim();
  const city = draft.city.trim();
  const courtsCount = Number(
    draft.courtsCount
  );
  const duration = Number(
    draft.defaultDurationMinutes
  );

  if (!name) {
    return "Escribe el nombre de la sede.";
  }

  if (!country || !draft.countryCode) {
    return "Selecciona el país.";
  }

  if (!city) {
    return "Selecciona o escribe la ciudad.";
  }

  if (
    !Number.isInteger(courtsCount) ||
    courtsCount < 1 ||
    courtsCount > 100
  ) {
    return (
      "La cantidad de canchas debe estar " +
      "entre 1 y 100."
    );
  }

  if (
    !Number.isInteger(duration) ||
    duration < 30 ||
    duration > 480
  ) {
    return (
      "La duración debe estar entre " +
      "30 y 480 minutos."
    );
  }

  return "";
}

async function compressImage(
  file: File
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(
        new Error(
          "No se pudo leer la imagen."
        )
      );
    };

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => {
        reject(
          new Error(
            "El archivo no parece ser una imagen válida."
          )
        );
      };

      image.onload = () => {
        const maxSide = 320;
        const scale = Math.min(
          1,
          maxSide /
            Math.max(
              image.naturalWidth,
              image.naturalHeight
            )
        );

        const width = Math.max(
          1,
          Math.round(
            image.naturalWidth * scale
          )
        );

        const height = Math.max(
          1,
          Math.round(
            image.naturalHeight * scale
          )
        );

        const canvas =
          document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context =
          canvas.getContext("2d");

        if (!context) {
          reject(
            new Error(
              "No se pudo preparar la imagen."
            )
          );
          return;
        }

        context.drawImage(
          image,
          0,
          0,
          width,
          height
        );

        resolve(
          canvas.toDataURL(
            "image/jpeg",
            0.76
          )
        );
      };

      image.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

function VenueVisual({
  imageUrl,
  avatarEmoji,
  name,
  large = false,
}: {
  imageUrl: string;
  avatarEmoji: string;
  name: string;
  large?: boolean;
}) {
  const className = large
    ? "venue-avatar large"
    : "venue-avatar";

  if (imageUrl) {
    return (
      <img
        alt={name || "Sede"}
        className={className}
        src={imageUrl}
      />
    );
  }

  return (
    <div
      aria-label={`Avatar de ${
        name || "la sede"
      }`}
      className={className}
    >
      {avatarEmoji || "🏟️"}
    </div>
  );
}

function VenueEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  title,
  error,
  editorId,
}: {
  draft: VenueDraft;
  onChange: (draft: VenueDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  title: string;
  error: string;
  editorId: string;
}) {
  const cityOptions = useMemo(
    () =>
      (
        City.getCitiesOfCountry(
          draft.countryCode
        ) ?? []
      )
        .map((city: CityOption) => city.name)
        .filter(Boolean)
        .sort((left: string, right: string) =>
          left.localeCompare(right, "es")
        ),
    [draft.countryCode]
  );

  const cityListId =
    `venue-cities-${editorId}`;

  async function handleFile(
    file?: File
  ) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      window.alert(
        "Selecciona un archivo de imagen."
      );
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      window.alert(
        "La imagen original no puede pesar más de 8 MB."
      );
      return;
    }

    try {
      const imageUrl =
        await compressImage(file);

      onChange({
        ...draft,
        imageUrl,
      });
    } catch (imageError: any) {
      window.alert(
        imageError.message ??
          "No se pudo preparar la imagen."
      );
    }
  }

  return (
    <div className="inline-editor">
      <div className="venue-editor-heading">
        <VenueVisual
          avatarEmoji={draft.avatarEmoji}
          imageUrl={draft.imageUrl}
          large
          name={draft.name}
        />

        <div>
          <h3>{title}</h3>
          <p className="help-text">
            País y ciudad son los únicos
            datos de ubicación.
          </p>
        </div>
      </div>

      {error ? (
        <div className="inline-error">
          {error}
        </div>
      ) : null}

      <div className="grid grid-2">
        <label>
          Nombre de la sede
          <input
            value={draft.name}
            placeholder="Ej: La Perla"
            onChange={(event) =>
              onChange({
                ...draft,
                name: event.target.value,
              })
            }
          />
        </label>

        <label>
          País
          <select
            value={draft.countryCode}
            onChange={(event) => {
              const country =
                COUNTRY_OPTIONS.find(
                  (item) =>
                    item.isoCode ===
                    event.target.value
                );

              onChange({
                ...draft,
                countryCode:
                  country?.isoCode ?? "EC",
                countryName:
                  country?.name ?? "Ecuador",
                city:
                  country?.isoCode === "EC"
                    ? "Guayaquil"
                    : "",
              });
            }}
          >
            {COUNTRY_OPTIONS.map(
              (country) => (
                <option
                  key={country.isoCode}
                  value={country.isoCode}
                >
                  {country.flag
                    ? `${country.flag} `
                    : ""}
                  {country.name}
                </option>
              )
            )}
          </select>
        </label>

        <label>
          Ciudad
          <input
            list={cityListId}
            value={draft.city}
            placeholder="Escribe o selecciona una ciudad"
            onChange={(event) =>
              onChange({
                ...draft,
                city: event.target.value,
              })
            }
          />

          <datalist id={cityListId}>
            {cityOptions.map(
              (cityName: string) => (
                <option
                  key={cityName}
                  value={cityName}
                />
              )
            )}
          </datalist>
        </label>

        <label>
          Cantidad de canchas
          <input
            min="1"
            max="100"
            type="number"
            value={draft.courtsCount}
            onChange={(event) =>
              onChange({
                ...draft,
                courtsCount:
                  event.target.value,
              })
            }
          />
        </label>

        <label>
          Duración predeterminada
          <select
            value={
              draft.defaultDurationMinutes
            }
            onChange={(event) =>
              onChange({
                ...draft,
                defaultDurationMinutes:
                  event.target.value,
              })
            }
          >
            <option value="60">
              60 minutos
            </option>
            <option value="90">
              90 minutos
            </option>
            <option value="120">
              120 minutos
            </option>
            <option value="180">
              180 minutos
            </option>
          </select>
        </label>

        <label>
          Estado
          <select
            value={
              draft.active
                ? "activa"
                : "inactiva"
            }
            onChange={(event) =>
              onChange({
                ...draft,
                active:
                  event.target.value ===
                  "activa",
              })
            }
          >
            <option value="activa">
              Activa
            </option>
            <option value="inactiva">
              Inactiva
            </option>
          </select>
        </label>
      </div>

      <div className="venue-image-section">
        <div>
          <strong>Imagen pequeña</strong>
          <p className="help-text">
            Puedes tomar una foto o elegirla
            desde el celular. Se reduce antes
            de guardarse.
          </p>
        </div>

        <label className="btn edit">
          📷 Elegir foto
          <input
            accept="image/*"
            capture="environment"
            hidden
            type="file"
            onChange={(event) => {
              void handleFile(
                event.target.files?.[0]
              );

              event.currentTarget.value =
                "";
            }}
          />
        </label>

        {draft.imageUrl ? (
          <button
            className="btn delete"
            type="button"
            onClick={() =>
              onChange({
                ...draft,
                imageUrl: "",
              })
            }
          >
            Quitar foto
          </button>
        ) : null}
      </div>

      <div>
        <strong>Avatar alternativo</strong>
        <p className="help-text">
          Se muestra cuando la sede no tiene
          fotografía.
        </p>

        <div className="avatar-picker">
          {AVATARS.map((avatar) => (
            <button
              aria-label={`Usar avatar ${avatar}`}
              className={
                draft.avatarEmoji === avatar
                  ? "avatar-option selected"
                  : "avatar-option"
              }
              key={avatar}
              onClick={() =>
                onChange({
                  ...draft,
                  avatarEmoji: avatar,
                })
              }
              type="button"
            >
              {avatar}
            </button>
          ))}
        </div>
      </div>

      <div className="row-actions">
        <button
          className="btn save"
          disabled={saving}
          onClick={onSave}
          type="button"
        >
          {saving
            ? "Guardando..."
            : "Guardar"}
        </button>

        <button
          className="btn cancel-action"
          disabled={saving}
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function SedesPage() {
  const [venues, setVenues] =
    useState<VenueRow[]>([]);
  const [events, setEvents] =
    useState<EventRow[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [notice, setNotice] =
    useState("");

  const [query, setQuery] =
    useState("");
  const [
    statusFilter,
    setStatusFilter,
  ] = useState<StatusFilter>("activas");

  const [creating, setCreating] =
    useState(false);
  const [
    createDraft,
    setCreateDraft,
  ] = useState<VenueDraft>(EMPTY_DRAFT);

  const [editingId, setEditingId] =
    useState<string | null>(null);
  const [
    editDraft,
    setEditDraft,
  ] = useState<VenueDraft>(EMPTY_DRAFT);

  const [
    savingKey,
    setSavingKey,
  ] = useState<string | null>(null);
  const [
    inlineError,
    setInlineError,
  ] = useState("");

  useEffect(() => {
    void loadVenues();
  }, []);

  async function loadVenues(
    clearNotice = true
  ) {
    setLoading(true);

    if (clearNotice) {
      setNotice("");
    }

    try {
      const [venuesRes, eventsRes] =
        await Promise.all([
          supabase
            .from("venues")
            .select(
              "id, name, country, country_code, city, courts_count, default_duration_minutes, active, image_url, avatar_emoji"
            )
            .eq(
              "account_id",
              DEMO_ACCOUNT_ID
            )
            .order("name"),

          supabase
            .from("events")
            .select(
              "id, venue_id, status"
            )
            .eq(
              "account_id",
              DEMO_ACCOUNT_ID
            ),
        ]);

      if (venuesRes.error) {
        throw venuesRes.error;
      }

      if (eventsRes.error) {
        throw eventsRes.error;
      }

      setVenues(
        (venuesRes.data ??
          []) as VenueRow[]
      );

      setEvents(
        (eventsRes.data ??
          []) as EventRow[]
      );
    } catch (error: any) {
      setNotice(
        `No se pudieron cargar las sedes: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setCreating(true);
    setCreateDraft({
      ...EMPTY_DRAFT,
    });
    setEditingId(null);
    setInlineError("");
  }

  function cancelCreate() {
    setCreating(false);
    setCreateDraft({
      ...EMPTY_DRAFT,
    });
    setInlineError("");
  }

  function startEdit(venue: VenueRow) {
    if (isSystemVenue(venue)) {
      setNotice(
        "La sede “Otra / por definir” " +
          "es una opción del sistema y " +
          "no se edita."
      );
      return;
    }

    setCreating(false);
    setEditingId(venue.id);
    setEditDraft(
      draftFromVenue(venue)
    );
    setInlineError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({
      ...EMPTY_DRAFT,
    });
    setInlineError("");
  }

  async function saveVenue(
    venueId: string | null,
    draft: VenueDraft
  ) {
    const validationError =
      validateDraft(draft);

    if (validationError) {
      setInlineError(validationError);
      return;
    }

    const savingId =
      venueId ?? "new";

    setSavingKey(savingId);
    setInlineError("");

    try {
      const { data, error } =
        await supabase.rpc(
          "ptm_save_venue_v2",
          {
            p_account_id:
              DEMO_ACCOUNT_ID,
            p_venue_id: venueId,
            p_name: draft.name,
            p_country:
              draft.countryName,
            p_country_code:
              draft.countryCode,
            p_city: draft.city,
            p_courts_count: Number(
              draft.courtsCount
            ),
            p_default_duration_minutes:
              Number(
                draft.defaultDurationMinutes
              ),
            p_active: draft.active,
            p_image_url:
              draft.imageUrl || null,
            p_avatar_emoji:
              draft.avatarEmoji,
          }
        );

      if (error) {
        throw error;
      }

      const result = Array.isArray(data)
        ? data[0]
        : data;

      const savedId =
        result?.venue_id as
          | string
          | undefined;

      const created =
        result?.created === true;

      if (!savedId) {
        throw new Error(
          "Supabase no devolvió la sede guardada."
        );
      }

      if (venueId) {
        cancelEdit();
      } else {
        cancelCreate();
      }

      await loadVenues(false);

      setNotice(
        created
          ? "Sede creada correctamente."
          : "Sede actualizada correctamente."
      );

      window.setTimeout(() => {
        document
          .getElementById(
            `venue-${savedId}`
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
      }, 120);
    } catch (error: any) {
      setInlineError(
        `No se pudo guardar la sede: ${error.message}`
      );
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleVenueStatus(
    venue: VenueRow
  ) {
    if (isSystemVenue(venue)) {
      setNotice(
        "La sede “Otra / por definir” " +
          "debe permanecer activa."
      );
      return;
    }

    const nextActive =
      venue.active === false;

    const confirmed =
      window.confirm(
        nextActive
          ? `¿Activar la sede ${venue.name}?`
          : `¿Desactivar la sede ${venue.name}? Ya no aparecerá para crear nuevos partidos.`
      );

    if (!confirmed) return;

    setSavingKey(venue.id);
    setInlineError("");

    try {
      const draft =
        draftFromVenue(venue);

      const { error } =
        await supabase.rpc(
          "ptm_save_venue_v2",
          {
            p_account_id:
              DEMO_ACCOUNT_ID,
            p_venue_id: venue.id,
            p_name: draft.name,
            p_country:
              draft.countryName,
            p_country_code:
              draft.countryCode,
            p_city: draft.city,
            p_courts_count: Number(
              draft.courtsCount
            ),
            p_default_duration_minutes:
              Number(
                draft.defaultDurationMinutes
              ),
            p_active: nextActive,
            p_image_url:
              draft.imageUrl || null,
            p_avatar_emoji:
              draft.avatarEmoji,
          }
        );

      if (error) throw error;

      await loadVenues(false);

      setNotice(
        nextActive
          ? "Sede activada."
          : "Sede desactivada."
      );
    } catch (error: any) {
      setNotice(
        `No se pudo cambiar el estado: ${error.message}`
      );
    } finally {
      setSavingKey(null);
    }
  }

  async function deleteVenue(
    venue: VenueRow,
    eventCount: number
  ) {
    if (isSystemVenue(venue)) {
      setNotice(
        "La sede “Otra / por definir” " +
          "no se puede borrar."
      );
      return;
    }

    if (eventCount > 0) {
      setNotice(
        `${venue.name} tiene ${eventCount} partido(s) relacionado(s). El borrado total con historial se habilitará cuando exista acceso real del dueño. Por ahora desactívala.`
      );
      return;
    }

    const confirmation =
      window.prompt(
        `Para borrar definitivamente ${venue.name}, escribe BORRAR.`
      );

    if (confirmation !== "BORRAR") {
      return;
    }

    setSavingKey(venue.id);

    try {
      const { error } =
        await supabase.rpc(
          "ptm_delete_venue_v1",
          {
            p_account_id:
              DEMO_ACCOUNT_ID,
            p_venue_id: venue.id,
          }
        );

      if (error) throw error;

      if (editingId === venue.id) {
        cancelEdit();
      }

      await loadVenues(false);

      setNotice(
        "Sede borrada definitivamente."
      );
    } catch (error: any) {
      setNotice(
        `No se pudo borrar la sede: ${error.message}`
      );
    } finally {
      setSavingKey(null);
    }
  }

  const eventCountByVenue =
    useMemo(() => {
      const map = new Map<
        string,
        {
          total: number;
          activos: number;
          cerrados: number;
          cancelados: number;
        }
      >();

      for (const event of events) {
        const current =
          map.get(event.venue_id) ?? {
            total: 0,
            activos: 0,
            cerrados: 0,
            cancelados: 0,
          };

        current.total += 1;

        if (
          event.status === "cancelado"
        ) {
          current.cancelados += 1;
        } else if (
          event.status === "cerrado"
        ) {
          current.cerrados += 1;
        } else {
          current.activos += 1;
        }

        map.set(
          event.venue_id,
          current
        );
      }

      return map;
    }, [events]);

  const filteredVenues =
    useMemo(() => {
      const cleanQuery =
        query.trim().toLowerCase();

      return venues.filter((venue) => {
        const active =
          venue.active !== false;

        if (
          statusFilter === "activas" &&
          !active
        ) {
          return false;
        }

        if (
          statusFilter === "inactivas" &&
          active
        ) {
          return false;
        }

        if (!cleanQuery) {
          return true;
        }

        return [
          venue.name,
          venue.city ?? "",
          venue.country ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(cleanQuery);
      });
    }, [
      venues,
      query,
      statusFilter,
    ]);

  const stats = useMemo(() => {
    const official = venues.filter(
      (venue) =>
        !isSystemVenue(venue)
    );

    const active = official.filter(
      (venue) =>
        venue.active !== false
    );

    return {
      total: official.length,
      active: active.length,
      inactive: official.filter(
        (venue) =>
          venue.active === false
      ).length,
      courts: active.reduce(
        (sum, venue) =>
          sum +
          Number(
            venue.courts_count ?? 1
          ),
        0
      ),
    };
  }, [venues]);

  if (loading) {
    return (
      <PageHeader
        title="Sedes"
        description="Cargando sedes..."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Sedes"
        description="Registra los lugares donde se jugarán los partidos."
        action={
          <button
            className="btn save"
            onClick={
              creating
                ? cancelCreate
                : startCreate
            }
          >
            {creating
              ? "Cerrar"
              : "Agregar sede"}
          </button>
        }
      />

      {notice ? (
        <div className="notice-banner">
          {notice}
        </div>
      ) : null}

      {creating ? (
        <div
          className="card"
          style={{ marginBottom: 16 }}
        >
          <VenueEditor
            draft={createDraft}
            editorId="new"
            error={inlineError}
            onCancel={cancelCreate}
            onChange={setCreateDraft}
            onSave={() =>
              void saveVenue(
                null,
                createDraft
              )
            }
            saving={
              savingKey === "new"
            }
            title="Nueva sede"
          />
        </div>
      ) : null}

      <div
        className="dashboard-kpi-grid"
        style={{ marginBottom: 16 }}
      >
        <div className="dashboard-kpi">
          <span>📍</span>
          <div>
            <strong>
              {stats.active}
            </strong>
            <small>Sedes activas</small>
          </div>
        </div>

        <div className="dashboard-kpi">
          <span>🎾</span>
          <div>
            <strong>
              {stats.courts}
            </strong>
            <small>Canchas</small>
          </div>
        </div>

        <div className="dashboard-kpi">
          <span>⏸️</span>
          <div>
            <strong>
              {stats.inactive}
            </strong>
            <small>Inactivas</small>
          </div>
        </div>

        <div className="dashboard-kpi">
          <span>📚</span>
          <div>
            <strong>
              {stats.total}
            </strong>
            <small>Total</small>
          </div>
        </div>
      </div>

      <div
        className="card compact-card"
        style={{ marginBottom: 16 }}
      >
        <div className="grid grid-2">
          <label>
            Buscar sede
            <input
              value={query}
              placeholder="Nombre, ciudad o país"
              onChange={(event) =>
                setQuery(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Estado
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value as StatusFilter
                )
              }
            >
              <option value="activas">
                Activas
              </option>
              <option value="inactivas">
                Inactivas
              </option>
              <option value="todas">
                Todas
              </option>
            </select>
          </label>
        </div>

        <div
          className="row-actions"
          style={{ marginTop: 10 }}
        >
          <button
            className="btn secondary"
            onClick={() =>
              void loadVenues()
            }
          >
            🔄 Actualizar
          </button>

          <Link
            className="btn secondary"
            href="/comunidades"
          >
            Comunidades
          </Link>
        </div>
      </div>

      {!filteredVenues.length ? (
        <div className="card">
          <h2>
            No hay sedes con estos filtros
          </h2>

          <button
            className="btn save"
            onClick={startCreate}
          >
            Agregar primera sede
          </button>
        </div>
      ) : (
        <div className="grid grid-2">
          {filteredVenues.map(
            (venue) => {
              const counts =
                eventCountByVenue.get(
                  venue.id
                ) ?? {
                  total: 0,
                  activos: 0,
                  cerrados: 0,
                  cancelados: 0,
                };

              const systemVenue =
                isSystemVenue(venue);

              const isEditing =
                editingId === venue.id;

              return (
                <div
                  className="card venue-card"
                  id={`venue-${venue.id}`}
                  key={venue.id}
                >
                  {isEditing ? (
                    <VenueEditor
                      draft={editDraft}
                      editorId={venue.id}
                      error={inlineError}
                      onCancel={
                        cancelEdit
                      }
                      onChange={
                        setEditDraft
                      }
                      onSave={() =>
                        void saveVenue(
                          venue.id,
                          editDraft
                        )
                      }
                      saving={
                        savingKey ===
                        venue.id
                      }
                      title={`Editar ${venue.name}`}
                    />
                  ) : (
                    <>
                      <div className="venue-card-heading">
                        <VenueVisual
                          avatarEmoji={
                            venue.avatar_emoji ??
                            "🏟️"
                          }
                          imageUrl={
                            venue.image_url ??
                            ""
                          }
                          name={venue.name}
                        />

                        <div className="venue-card-copy">
                          <h2>
                            {venue.name}
                          </h2>

                          <p>
                            {venue.city ??
                              "Ciudad"}
                            ,{" "}
                            {venue.country ??
                              "Ecuador"}
                          </p>
                        </div>

                        <span
                          className={`badge ${
                            venue.active ===
                            false
                              ? "warn"
                              : "good"
                          }`}
                        >
                          {venue.active ===
                          false
                            ? "Inactiva"
                            : "Activa"}
                        </span>
                      </div>

                      {systemVenue ? (
                        <p className="help-text">
                          Opción del sistema para
                          lugares todavía no
                          registrados.
                        </p>
                      ) : (
                        <>
                          <div className="venue-main-stats">
                            <div>
                              <strong>
                                {Number(
                                  venue.courts_count ??
                                    1
                                )}
                              </strong>
                              <small>
                                Canchas
                              </small>
                            </div>

                            <div>
                              <strong>
                                {Number(
                                  venue.default_duration_minutes ??
                                    90
                                )}
                              </strong>
                              <small>
                                Minutos
                              </small>
                            </div>

                            <div>
                              <strong>
                                {counts.total}
                              </strong>
                              <small>
                                Partidos
                              </small>
                            </div>
                          </div>

                          <div className="row-actions">
                            <button
                              className="btn edit"
                              onClick={() =>
                                startEdit(
                                  venue
                                )
                              }
                            >
                              Editar
                            </button>

                            <button
                              className={
                                venue.active ===
                                false
                                  ? "btn activate"
                                  : "btn deactivate"
                              }
                              disabled={
                                savingKey ===
                                venue.id
                              }
                              onClick={() =>
                                void toggleVenueStatus(
                                  venue
                                )
                              }
                            >
                              {venue.active ===
                              false
                                ? "Activar"
                                : "Desactivar"}
                            </button>

                            <button
                              className="btn delete"
                              disabled={
                                savingKey ===
                                  venue.id ||
                                counts.total > 0
                              }
                              onClick={() =>
                                void deleteVenue(
                                  venue,
                                  counts.total
                                )
                              }
                              title={
                                counts.total > 0
                                  ? "Tiene historial. Por ahora debe desactivarse."
                                  : "Borrar definitivamente"
                              }
                            >
                              Borrar
                            </button>
                          </div>

                          {counts.total > 0 ? (
                            <p className="help-text">
                              Tiene historial: se
                              puede desactivar. El
                              borrado total quedará
                              reservado al dueño con
                              acceso real.
                            </p>
                          ) : null}
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            }
          )}
        </div>
      )}
    </>
  );
}