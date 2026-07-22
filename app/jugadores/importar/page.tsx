"use client";

import Link from "next/link";
import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { PageHeader } from "@/components/PageHeader";
import { DEMO_ACCOUNT_ID } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";

type Category =
  | "C1"
  | "C2"
  | "C3"
  | "C4"
  | "C5"
  | "C6"
  | "C7";

type Gender = "hombre" | "mujer";

type Side =
  | "drive"
  | "reves"
  | "cualquiera";

type ImportStatus =
  | "nuevo"
  | "duplicado"
  | "repetido"
  | "invalido"
  | "importado";

type ImportSource =
  | "contactos"
  | "csv"
  | "vcf"
  | "pegado";

type ExistingPlayer = {
  id: string;
  first_name: string;
  last_name: string | null;
  whatsapp: string | null;
  active: boolean | null;
};

type CommunityRow = {
  id: string;
  name: string;
  active: boolean | null;
};

type ImportRow = {
  id: string;
  selected: boolean;
  source: ImportSource;
  originalName: string;
  firstName: string;
  lastName: string;
  phoneRaw: string;
  whatsapp: string;
  phoneKey: string;
  gender: Gender;
  primaryCategory: Category;
  secondaryCategory: "" | Category;
  preferredSide: Side;
  status: ImportStatus;
  statusMessage: string;
  existingPlayerId: string | null;
  existingPlayerName: string | null;
};

type DeviceContact = {
  name?: string[];
  tel?: string[];
};

type ContactPicker = {
  select: (
    properties: Array<"name" | "tel">,
    options: { multiple: boolean }
  ) => Promise<DeviceContact[]>;
};

type ContactNavigator = Navigator & {
  contacts?: ContactPicker;
};

const FREE_ACTIVE_PLAYER_LIMIT = 50;

const CATEGORIES: Array<{
  value: Category;
  label: string;
}> = [
  { value: "C1", label: "Primera" },
  { value: "C2", label: "Segunda" },
  { value: "C3", label: "Tercera" },
  { value: "C4", label: "Cuarta" },
  { value: "C5", label: "Quinta" },
  { value: "C6", label: "Sexta" },
  { value: "C7", label: "Novatos" },
];

const DAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

function categoryLabel(
  category: Category
) {
  return (
    CATEGORIES.find(
      (item) =>
        item.value === category
    )?.label ?? category
  );
}

function adjacentCategories(
  primary: Category
) {
  const index =
    CATEGORIES.findIndex(
      (item) =>
        item.value === primary
    );

  return CATEGORIES.filter(
    (_, itemIndex) =>
      Math.abs(
        itemIndex - index
      ) === 1
  );
}

function randomId() {
  return crypto.randomUUID();
}

function splitName(value: string) {
  const clean = value
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) {
    return {
      firstName: "",
      lastName: "",
    };
  }

  const parts = clean.split(" ");

  return {
    firstName: parts[0] ?? "",
    lastName:
      parts.slice(1).join(" "),
  };
}

function normalizeWhatsapp(
  value: string
) {
  const original = value.trim();
  const hadPlus =
    original.startsWith("+");

  let digits =
    original.replace(/\D/g, "");

  if (!digits) return "";

  if (
    digits.startsWith("00593")
  ) {
    digits = digits.slice(2);
  }

  if (
    digits.startsWith("593") &&
    digits.length >= 12
  ) {
    return `+${digits}`;
  }

  if (
    digits.startsWith("09") &&
    digits.length === 10
  ) {
    return `+593${digits.slice(1)}`;
  }

  if (
    digits.startsWith("9") &&
    digits.length === 9
  ) {
    return `+593${digits}`;
  }

  if (
    hadPlus &&
    digits.length >= 8
  ) {
    return `+${digits}`;
  }

  if (
    digits.length >= 10
  ) {
    return `+${digits}`;
  }

  return "";
}

function phoneKey(value: string) {
  const normalized =
    normalizeWhatsapp(value);

  if (!normalized) return "";

  const digits =
    normalized.replace(/\D/g, "");

  if (
    digits.startsWith("593") &&
    digits.length >= 12
  ) {
    return digits.slice(-9);
  }

  return digits.slice(-10);
}

function fullName(
  player: ExistingPlayer
) {
  return [
    player.first_name,
    player.last_name,
  ]
    .filter(Boolean)
    .join(" ");
}

function operatorName() {
  try {
    const raw =
      window.localStorage.getItem(
        "ptm.selectedStaffSnapshot"
      );

    if (!raw) {
      return "Alejandro Pincay";
    }

    const snapshot =
      JSON.parse(raw) as {
        fullName?: string;
      };

    return (
      snapshot.fullName ||
      "Alejandro Pincay"
    );
  } catch {
    return "Alejandro Pincay";
  }
}

function parseDelimitedLine(
  line: string,
  separator: string
) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (
    let index = 0;
    index < line.length;
    index += 1
  ) {
    const character =
      line[index];

    if (character === '"') {
      if (
        quoted &&
        line[index + 1] === '"'
      ) {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }

      continue;
    }

    if (
      character === separator &&
      !quoted
    ) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());

  return values;
}

function detectSeparator(
  header: string
) {
  const options = [",", ";", "\t"];

  return options
    .map((separator) => ({
      separator,
      count:
        header.split(separator).length,
    }))
    .sort(
      (left, right) =>
        right.count - left.count
    )[0]?.separator ?? ",";
}

function normalizeHeader(
  value: string
) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

function findHeaderIndex(
  headers: string[],
  candidates: string[]
) {
  return headers.findIndex(
    (header) =>
      candidates.some(
        (candidate) =>
          header === candidate ||
          header.includes(
            candidate
          )
      )
  );
}

function parseCsv(
  text: string
) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter(
      (line) =>
        line.trim().length > 0
    );

  if (lines.length < 2) {
    throw new Error(
      "El archivo CSV no contiene contactos."
    );
  }

  const separator =
    detectSeparator(lines[0]);

  const rawHeaders =
    parseDelimitedLine(
      lines[0],
      separator
    );

  const headers =
    rawHeaders.map(
      normalizeHeader
    );

  const nameIndex =
    findHeaderIndex(
      headers,
      [
        "name",
        "nombre",
        "full name",
        "nombre completo",
      ]
    );

  const firstNameIndex =
    findHeaderIndex(
      headers,
      [
        "first name",
        "given name",
        "nombre",
      ]
    );

  const lastNameIndex =
    findHeaderIndex(
      headers,
      [
        "last name",
        "family name",
        "surname",
        "apellido",
      ]
    );

  const phoneIndexes =
    headers
      .map((header, index) => ({
        header,
        index,
      }))
      .filter(
        ({ header }) =>
          [
            "phone",
            "telefono",
            "movil",
            "mobile",
            "whatsapp",
            "celular",
          ].some(
            (candidate) =>
              header.includes(
                candidate
              )
          )
      )
      .map(
        ({ index }) => index
      );

  if (!phoneIndexes.length) {
    throw new Error(
      "No encontré una columna de teléfono o WhatsApp."
    );
  }

  return lines
    .slice(1)
    .map((line) => {
      const values =
        parseDelimitedLine(
          line,
          separator
        );

      const directName =
        nameIndex >= 0
          ? values[nameIndex] ?? ""
          : "";

      const firstName =
        firstNameIndex >= 0
          ? values[
              firstNameIndex
            ] ?? ""
          : "";

      const lastName =
        lastNameIndex >= 0
          ? values[
              lastNameIndex
            ] ?? ""
          : "";

      const name =
        directName ||
        [firstName, lastName]
          .filter(Boolean)
          .join(" ");

      const phone =
        phoneIndexes
          .map(
            (index) =>
              values[index] ?? ""
          )
          .find(
            (value) =>
              normalizeWhatsapp(
                value
              )
          ) ?? "";

      return {
        name,
        phone,
      };
    })
    .filter(
      (row) =>
        row.name || row.phone
    );
}

function unfoldVcard(
  text: string
) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  const unfolded: string[] = [];

  for (const line of lines) {
    if (
      /^[ \t]/.test(line) &&
      unfolded.length
    ) {
      unfolded[
        unfolded.length - 1
      ] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  return unfolded.join("\n");
}

function decodeVcardValue(
  value: string
) {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseVcard(
  text: string
) {
  const unfolded =
    unfoldVcard(text);

  const cards =
    unfolded.match(
      /BEGIN:VCARD[\s\S]*?END:VCARD/gi
    ) ?? [];

  if (!cards.length) {
    throw new Error(
      "El archivo VCF no contiene contactos."
    );
  }

  return cards
    .map((card) => {
      const lines =
        card.split("\n");

      const fullNameLine =
        lines.find((line) =>
          /^FN(?:;[^:]*)?:/i.test(
            line
          )
        );

      const structuredNameLine =
        lines.find((line) =>
          /^N(?:;[^:]*)?:/i.test(
            line
          )
        );

      let name = "";

      if (fullNameLine) {
        name = decodeVcardValue(
          fullNameLine.slice(
            fullNameLine.indexOf(
              ":"
            ) + 1
          )
        );
      } else if (
        structuredNameLine
      ) {
        const raw =
          structuredNameLine.slice(
            structuredNameLine.indexOf(
              ":"
            ) + 1
          );

        const parts =
          raw.split(";");

        name = [
          parts[1],
          parts[2],
          parts[0],
        ]
          .filter(Boolean)
          .map(
            decodeVcardValue
          )
          .join(" ");
      }

      const phoneLines =
        lines.filter((line) =>
          /^TEL(?:;[^:]*)?:/i.test(
            line
          )
        );

      const phone =
        phoneLines
          .map((line) =>
            decodeVcardValue(
              line.slice(
                line.indexOf(":") +
                  1
              )
            )
          )
          .find((value) =>
            normalizeWhatsapp(value)
          ) ?? "";

      return {
        name,
        phone,
      };
    })
    .filter(
      (row) =>
        row.name || row.phone
    );
}

function parsePastedList(
  text: string
) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => {
      const clean =
        line.trim();

      if (!clean) {
        return null;
      }

      const match =
        clean.match(
          /^(.*?)[,;|\t]\s*(\+?[\d\s()\-]{8,})$/
        ) ||
        clean.match(
          /^(.*?)(\+?\d[\d\s()\-]{7,})$/
        );

      if (!match) {
        return {
          name: clean,
          phone: "",
        };
      }

      return {
        name:
          match[1]?.trim() ??
          "",
        phone:
          match[2]?.trim() ??
          "",
      };
    })
    .filter(
      (
        row
      ): row is {
        name: string;
        phone: string;
      } =>
        Boolean(row)
    );
}

function baseRow(
  name: string,
  phone: string,
  source: ImportSource,
  defaults: {
    gender: Gender;
    primaryCategory: Category;
    preferredSide: Side;
  }
): ImportRow {
  const names =
    splitName(name);

  const whatsapp =
    normalizeWhatsapp(phone);

  return {
    id: randomId(),
    selected: true,
    source,
    originalName: name,
    firstName:
      names.firstName,
    lastName:
      names.lastName,
    phoneRaw: phone,
    whatsapp,
    phoneKey:
      phoneKey(phone),
    gender:
      defaults.gender,
    primaryCategory:
      defaults.primaryCategory,
    secondaryCategory: "",
    preferredSide:
      defaults.preferredSide,
    status: "nuevo",
    statusMessage: "Nuevo",
    existingPlayerId: null,
    existingPlayerName: null,
  };
}

function sourceLabel(
  source: ImportSource
) {
  if (source === "contactos") {
    return "Contactos del dispositivo";
  }

  if (source === "csv") {
    return "Archivo CSV";
  }

  if (source === "vcf") {
    return "Archivo VCF";
  }

  return "Lista pegada";
}

export default function ImportarJugadoresPage() {
  const [
    existingPlayers,
    setExistingPlayers,
  ] = useState<ExistingPlayer[]>([]);

  const [
    communities,
    setCommunities,
  ] = useState<CommunityRow[]>([]);

  const [rows, setRows] =
    useState<ImportRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [importing, setImporting] =
    useState(false);

  const [
    contactPickerAvailable,
    setContactPickerAvailable,
  ] = useState(false);

  const [notice, setNotice] =
    useState("");

  const [
    pastedText,
    setPastedText,
  ] = useState("");

  const [
    defaultGender,
    setDefaultGender,
  ] =
    useState<Gender>("hombre");

  const [
    defaultCategory,
    setDefaultCategory,
  ] =
    useState<Category>("C5");

  const [
    defaultSide,
    setDefaultSide,
  ] =
    useState<Side>("cualquiera");

  const [
    defaultActive,
    setDefaultActive,
  ] = useState(true);

  const [
    communityIds,
    setCommunityIds,
  ] = useState<string[]>([]);

  const [
    selectedDays,
    setSelectedDays,
  ] =
    useState<number[]>([
      1, 2, 3, 4, 5,
    ]);

  const [
    startTime,
    setStartTime,
  ] = useState("07:00");

  const [endTime, setEndTime] =
    useState("22:00");

  const [
    progress,
    setProgress,
  ] = useState({
    current: 0,
    total: 0,
  });

  useEffect(() => {
    setContactPickerAvailable(
      Boolean(
        (
          navigator as ContactNavigator
        ).contacts?.select
      )
    );

    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setNotice("");

    try {
      const [
        playersRes,
        communitiesRes,
      ] = await Promise.all([
        supabase
          .from("players")
          .select(
            "id, first_name, last_name, whatsapp, active"
          )
          .eq(
            "account_id",
            DEMO_ACCOUNT_ID
          ),

        supabase
          .from("communities")
          .select(
            "id, name, active"
          )
          .eq(
            "account_id",
            DEMO_ACCOUNT_ID
          )
          .order("name"),
      ]);

      if (playersRes.error) {
        throw playersRes.error;
      }

      if (communitiesRes.error) {
        throw communitiesRes.error;
      }

      setExistingPlayers(
        (playersRes.data ??
          []) as ExistingPlayer[]
      );

      const communityRows =
        (communitiesRes.data ??
          []) as CommunityRow[];

      setCommunities(
        communityRows
      );

      if (
        !communityIds.length &&
        communityRows[0]?.id
      ) {
        setCommunityIds([
          communityRows[0].id,
        ]);
      }
    } catch (error: any) {
      setNotice(
        `No se pudo preparar la importación: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  }

  const activeCount = useMemo(
    () =>
      existingPlayers.filter(
        (player) =>
          player.active !== false
      ).length,
    [existingPlayers]
  );

  const existingByPhone =
    useMemo(() => {
      const map = new Map<
        string,
        ExistingPlayer
      >();

      for (
        const player of
        existingPlayers
      ) {
        const key = phoneKey(
          player.whatsapp ?? ""
        );

        if (key) {
          map.set(key, player);
        }
      }

      return map;
    }, [existingPlayers]);

  function classifyRows(
    nextRows: ImportRow[]
  ) {
    const seen = new Map<
      string,
      string
    >();

    return nextRows.map(
      (row) => {
        const cleanWhatsapp =
          normalizeWhatsapp(
            row.phoneRaw ||
              row.whatsapp
          );

        const key = phoneKey(
          cleanWhatsapp
        );

        const existing =
          key
            ? existingByPhone.get(
                key
              )
            : null;

        let status:
          ImportStatus = "nuevo";

        let statusMessage =
          "Nuevo";

        let selected =
          row.selected;

        if (
          !row.firstName.trim()
        ) {
          status = "invalido";
          statusMessage =
            "Falta el nombre";
          selected = false;
        } else if (!key) {
          status = "invalido";
          statusMessage =
            "Teléfono inválido";
          selected = false;
        } else if (existing) {
          status =
            "duplicado";
          statusMessage =
            `Ya existe: ${fullName(
              existing
            )}`;
          selected = false;
        } else if (
          seen.has(key)
        ) {
          status =
            "repetido";
          statusMessage =
            "Repetido en esta lista";
          selected = false;
        } else {
          seen.set(key, row.id);
        }

        return {
          ...row,
          selected,
          whatsapp:
            cleanWhatsapp,
          phoneKey: key,
          status,
          statusMessage,
          existingPlayerId:
            existing?.id ?? null,
          existingPlayerName:
            existing
              ? fullName(existing)
              : null,
        };
      }
    );
  }

  function addRows(
    incoming: Array<{
      name: string;
      phone: string;
    }>,
    source: ImportSource
  ) {
    if (!incoming.length) {
      setNotice(
        "No encontré contactos para agregar."
      );
      return;
    }

    const created =
      incoming.map((item) =>
        baseRow(
          item.name,
          item.phone,
          source,
          {
            gender:
              defaultGender,
            primaryCategory:
              defaultCategory,
            preferredSide:
              defaultSide,
          }
        )
      );

    setRows((current) =>
      classifyRows([
        ...current,
        ...created,
      ])
    );

    setNotice(
      `${created.length} contacto(s) agregado(s) para revisar.`
    );
  }

  async function pickContacts() {
    const contacts =
      (
        navigator as ContactNavigator
      ).contacts;

    if (!contacts?.select) {
      setNotice(
        "Este navegador no ofrece el selector directo. Usa un archivo VCF o CSV."
      );
      return;
    }

    try {
      const selected =
        await contacts.select(
          ["name", "tel"],
          { multiple: true }
        );

      const parsed =
        selected.map(
          (contact) => ({
            name:
              contact.name?.[0] ??
              "",
            phone:
              contact.tel?.find(
                (value) =>
                  normalizeWhatsapp(
                    value
                  )
              ) ??
              contact.tel?.[0] ??
              "",
          })
        );

      addRows(
        parsed,
        "contactos"
      );
    } catch (error: any) {
      setNotice(
        error?.name ===
          "AbortError"
          ? "Selección cancelada."
          : `No se pudieron abrir los contactos: ${error.message}`
      );
    }
  }

  async function readFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    event.currentTarget.value =
      "";

    if (!file) return;

    try {
      const text =
        await file.text();

      const lowerName =
        file.name.toLowerCase();

      if (
        lowerName.endsWith(
          ".vcf"
        ) ||
        file.type.includes(
          "vcard"
        )
      ) {
        addRows(
          parseVcard(text),
          "vcf"
        );
      } else {
        addRows(
          parseCsv(text),
          "csv"
        );
      }
    } catch (error: any) {
      setNotice(
        `No se pudo leer el archivo: ${error.message}`
      );
    }
  }

  function addPasted() {
    const parsed =
      parsePastedList(
        pastedText
      );

    addRows(
      parsed,
      "pegado"
    );

    if (parsed.length) {
      setPastedText("");
    }
  }

  function updateRow(
    id: string,
    patch: Partial<ImportRow>
  ) {
    setRows((current) =>
      classifyRows(
        current.map((row) =>
          row.id === id
            ? {
                ...row,
                ...patch,
              }
            : row
        )
      )
    );
  }

  function applyDefaults() {
    setRows((current) =>
      classifyRows(
        current.map((row) =>
          row.selected &&
          row.status ===
            "nuevo"
            ? {
                ...row,
                gender:
                  defaultGender,
                primaryCategory:
                  defaultCategory,
                secondaryCategory:
                  "",
                preferredSide:
                  defaultSide,
              }
            : row
        )
      )
    );

    setNotice(
      "Los valores generales se aplicaron a los contactos seleccionados."
    );
  }

  function selectAllNew() {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        selected:
          row.status ===
          "nuevo",
      }))
    );
  }

  function clearSelection() {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        selected: false,
      }))
    );
  }

  function removeUnselected() {
    setRows((current) =>
      classifyRows(
        current.filter(
          (row) =>
            row.selected ||
            row.status ===
              "importado"
        )
      )
    );
  }

  function toggleCommunity(
    communityId: string
  ) {
    setCommunityIds(
      (current) =>
        current.includes(
          communityId
        )
          ? current.filter(
              (id) =>
                id !==
                communityId
            )
          : [
              ...current,
              communityId,
            ]
    );
  }

  function toggleDay(
    day: number
  ) {
    setSelectedDays(
      (current) =>
        current.includes(day)
          ? current.filter(
              (value) =>
                value !== day
            )
          : [...current, day]
    );
  }

  const summary = useMemo(() => {
    const selected =
      rows.filter(
        (row) =>
          row.selected &&
          row.status ===
            "nuevo"
      );

    return {
      total: rows.length,
      selected:
        selected.length,
      newCount:
        rows.filter(
          (row) =>
            row.status ===
            "nuevo"
        ).length,
      duplicates:
        rows.filter(
          (row) =>
            row.status ===
              "duplicado" ||
            row.status ===
              "repetido"
        ).length,
      invalid:
        rows.filter(
          (row) =>
            row.status ===
            "invalido"
        ).length,
      imported:
        rows.filter(
          (row) =>
            row.status ===
            "importado"
        ).length,
    };
  }, [rows]);

  async function importSelected() {
    const selected =
      rows.filter(
        (row) =>
          row.selected &&
          row.status ===
            "nuevo"
      );

    if (!selected.length) {
      setNotice(
        "Selecciona al menos un contacto nuevo."
      );
      return;
    }

    if (!communityIds.length) {
      setNotice(
        "Selecciona al menos una comunidad para la importación."
      );
      return;
    }

    if (
      !selectedDays.length
    ) {
      setNotice(
        "Selecciona al menos un día de disponibilidad."
      );
      return;
    }

    if (
      !startTime ||
      !endTime ||
      startTime >= endTime
    ) {
      setNotice(
        "El horario general no es válido."
      );
      return;
    }

    if (
      defaultActive &&
      activeCount +
        selected.length >
        FREE_ACTIVE_PLAYER_LIMIT
    ) {
      setNotice(
        `La importación superaría el límite de ${FREE_ACTIVE_PLAYER_LIMIT} jugadores activos. Importa menos contactos o selecciona “Inactivos”.`
      );
      return;
    }

    const confirmed =
      window.confirm(
        `¿Importar ${selected.length} jugador(es) seleccionados?`
      );

    if (!confirmed) return;

    setImporting(true);
    setProgress({
      current: 0,
      total: selected.length,
    });

    const batchId =
      crypto.randomUUID();

    const importedBy =
      operatorName();

    let importedCount = 0;
    const importedIds =
      new Set<string>();

    const schedule =
      selectedDays
        .slice()
        .sort(
          (left, right) =>
            left - right
        )
        .map((day) => ({
          day_of_week: day,
          start_time:
            startTime,
          end_time:
            endTime,
        }));

    try {
      for (
        let index = 0;
        index <
        selected.length;
        index += 1
      ) {
        const row =
          selected[index];

        setProgress({
          current: index + 1,
          total:
            selected.length,
        });

        try {
          const {
            data,
            error,
          } =
            await supabase.rpc(
              "ptm_save_player_profile_v2",
              {
                p_account_id:
                  DEMO_ACCOUNT_ID,
                p_player_id:
                  null,
                p_first_name:
                  row.firstName.trim(),
                p_last_name:
                  row.lastName.trim() ||
                  null,
                p_whatsapp:
                  row.whatsapp,
                p_gender:
                  row.gender,
                p_primary_category:
                  row.primaryCategory,
                p_secondary_category:
                  row.secondaryCategory ||
                  null,
                p_preferred_side:
                  row.preferredSide,
                p_active:
                  defaultActive,
                p_community_ids:
                  communityIds,
                p_schedule:
                  schedule,
                p_notes:
                  `Importado desde ${sourceLabel(
                    row.source
                  )}.`,
                p_availability_notes:
                  "Horario inicial aplicado durante la importación.",
              }
            );

          if (error) {
            throw error;
          }

          const result =
            Array.isArray(data)
              ? data[0]
              : data;

          const playerId =
            result?.player_id as
              | string
              | undefined;

          if (!playerId) {
            throw new Error(
              "No se recibió el jugador guardado."
            );
          }

          const metadataRes =
            await supabase
              .from("players")
              .update({
                import_source:
                  row.source,
                imported_at:
                  new Date().toISOString(),
                imported_by:
                  importedBy,
                import_batch_id:
                  batchId,
                avatar_emoji:
                  row.gender ===
                  "mujer"
                    ? "👩"
                    : "👨",
              })
              .eq(
                "account_id",
                DEMO_ACCOUNT_ID
              )
              .eq(
                "id",
                playerId
              );

          if (
            metadataRes.error
          ) {
            throw metadataRes.error;
          }

          importedCount += 1;
          importedIds.add(
            row.id
          );
        } catch (rowError: any) {
          setRows(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                  row.id
                    ? {
                        ...item,
                        selected:
                          false,
                        status:
                          "invalido",
                        statusMessage:
                          `Error: ${rowError.message}`,
                      }
                    : item
              )
          );
        }
      }

      await supabase
        .from(
          "player_import_batches"
        )
        .insert({
          id: batchId,
          account_id:
            DEMO_ACCOUNT_ID,
          source:
            Array.from(
              new Set(
                selected.map(
                  (row) =>
                    row.source
                )
              )
            ).join(","),
          selected_count:
            selected.length,
          imported_count:
            importedCount,
          duplicate_count:
            summary.duplicates,
          invalid_count:
            summary.invalid,
          imported_by:
            importedBy,
        });

      setRows((current) =>
        current.map((row) =>
          importedIds.has(
            row.id
          )
            ? {
                ...row,
                selected:
                  false,
                status:
                  "importado",
                statusMessage:
                  "Importado correctamente",
              }
            : row
        )
      );

      await loadData();

      setNotice(
        `${importedCount} jugador(es) importado(s). ${
          selected.length -
          importedCount
        } no se pudieron guardar.`
      );
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <PageHeader
        title="Importar jugadores"
        description="Preparando contactos..."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Importar jugadores"
        description="Selecciona contactos, revisa cuáles sí entran y guárdalos juntos."
        action={
          <Link
            className="btn secondary"
            href="/jugadores"
          >
            Volver a Jugadores
          </Link>
        }
      />

      {notice ? (
        <div className="notice-banner">
          {notice}
        </div>
      ) : null}

      <div className="import-source-grid">
        <section className="card import-source-card">
          <span>📱</span>
          <h2>
            Contactos del teléfono
          </h2>
          <p>
            Abre el selector del dispositivo
            y comparte únicamente los contactos
            que deseas revisar.
          </p>

          <button
            className="btn save"
            disabled={
              !contactPickerAvailable ||
              importing
            }
            onClick={() =>
              void pickContacts()
            }
          >
            Seleccionar contactos
          </button>

          {!contactPickerAvailable ? (
            <small>
              En este navegador utiliza VCF o
              CSV.
            </small>
          ) : null}
        </section>

        <section className="card import-source-card">
          <span>📄</span>
          <h2>Archivo CSV o VCF</h2>
          <p>
            Acepta exportaciones de Google
            Contactos, Apple y archivos comunes.
          </p>

          <label className="btn edit">
            Elegir archivo
            <input
              accept=".csv,.vcf,text/csv,text/vcard"
              hidden
              type="file"
              onChange={(event) =>
                void readFile(
                  event
                )
              }
            />
          </label>
        </section>

        <section className="card import-source-card">
          <span>📋</span>
          <h2>Pegar una lista</h2>
          <p>
            Una persona por línea:
            nombre y teléfono.
          </p>

          <textarea
            rows={5}
            value={pastedText}
            placeholder={
              "Carlos Pérez, 0991234567\nAndrea López, +593987654321"
            }
            onChange={(event) =>
              setPastedText(
                event.target.value
              )
            }
          />

          <button
            className="btn edit"
            disabled={
              !pastedText.trim() ||
              importing
            }
            onClick={addPasted}
          >
            Agregar lista
          </button>
        </section>
      </div>

      <section
        className="card"
        style={{ marginTop: 16 }}
      >
        <div className="section-title-row">
          <h2>
            Datos generales
          </h2>
          <span className="badge neutral">
            Se aplican al grupo
          </span>
        </div>

        <div className="grid grid-3">
          <label>
            Categoría principal
            <select
              value={
                defaultCategory
              }
              onChange={(event) =>
                setDefaultCategory(
                  event.target
                    .value as Category
                )
              }
            >
              {CATEGORIES.map(
                (category) => (
                  <option
                    key={
                      category.value
                    }
                    value={
                      category.value
                    }
                  >
                    {category.label}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Género predeterminado
            <select
              value={defaultGender}
              onChange={(event) =>
                setDefaultGender(
                  event.target
                    .value as Gender
                )
              }
            >
              <option value="hombre">
                Hombre
              </option>
              <option value="mujer">
                Mujer
              </option>
            </select>
          </label>

          <label>
            Lado predeterminado
            <select
              value={defaultSide}
              onChange={(event) =>
                setDefaultSide(
                  event.target
                    .value as Side
                )
              }
            >
              <option value="cualquiera">
                Cualquiera
              </option>
              <option value="drive">
                Drive
              </option>
              <option value="reves">
                Revés
              </option>
            </select>
          </label>

          <label>
            Estado inicial
            <select
              value={
                defaultActive
                  ? "activo"
                  : "inactivo"
              }
              onChange={(event) =>
                setDefaultActive(
                  event.target
                    .value ===
                    "activo"
                )
              }
            >
              <option value="activo">
                Activo
              </option>
              <option value="inactivo">
                Inactivo
              </option>
            </select>
          </label>

          <label>
            Desde
            <input
              type="time"
              value={startTime}
              onChange={(event) =>
                setStartTime(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Hasta
            <input
              type="time"
              value={endTime}
              onChange={(event) =>
                setEndTime(
                  event.target.value
                )
              }
            />
          </label>
        </div>

        <h3>Comunidades</h3>

        <div className="row-actions">
          {communities
            .filter(
              (community) =>
                community.active !==
                false
            )
            .map(
              (community) => (
                <label
                  className="badge neutral import-check"
                  key={community.id}
                >
                  <input
                    type="checkbox"
                    checked={communityIds.includes(
                      community.id
                    )}
                    onChange={() =>
                      toggleCommunity(
                        community.id
                      )
                    }
                  />
                  {community.name}
                </label>
              )
            )}
        </div>

        <h3>Días disponibles</h3>

        <div className="row-actions">
          {DAYS.map((day) => (
            <button
              className={
                selectedDays.includes(
                  day.value
                )
                  ? "btn edit"
                  : "btn secondary"
              }
              key={day.value}
              onClick={() =>
                toggleDay(
                  day.value
                )
              }
              type="button"
            >
              {day.label}
            </button>
          ))}
        </div>

        <div
          className="row-actions"
          style={{ marginTop: 14 }}
        >
          <button
            className="btn save"
            disabled={
              !summary.selected
            }
            onClick={
              applyDefaults
            }
            type="button"
          >
            Aplicar a seleccionados
          </button>

          <span className="help-text">
            Puedes corregir categoría y género
            individualmente abajo.
          </span>
        </div>
      </section>

      <section
        className="card"
        style={{ marginTop: 16 }}
      >
        <div className="section-title-row">
          <h2>
            Revisar contactos
          </h2>

          <span className="badge neutral">
            {summary.total}
          </span>
        </div>

        <div className="import-summary-grid">
          <div>
            <strong>
              {summary.selected}
            </strong>
            <small>
              Seleccionados
            </small>
          </div>

          <div>
            <strong>
              {summary.newCount}
            </strong>
            <small>Nuevos</small>
          </div>

          <div>
            <strong>
              {summary.duplicates}
            </strong>
            <small>
              Duplicados
            </small>
          </div>

          <div>
            <strong>
              {summary.invalid}
            </strong>
            <small>
              Por corregir
            </small>
          </div>

          <div>
            <strong>
              {summary.imported}
            </strong>
            <small>
              Importados
            </small>
          </div>
        </div>

        <div className="row-actions">
          <button
            className="btn edit"
            onClick={selectAllNew}
            type="button"
          >
            Seleccionar nuevos
          </button>

          <button
            className="btn secondary"
            onClick={clearSelection}
            type="button"
          >
            Quitar selección
          </button>

          <button
            className="btn delete"
            onClick={removeUnselected}
            type="button"
          >
            Quitar los que no
          </button>
        </div>

        {!rows.length ? (
          <div className="empty-compact">
            <span>📇</span>
            <strong>
              Todavía no agregaste contactos
            </strong>
          </div>
        ) : (
          <div className="import-contact-list">
            {rows.map((row) => (
              <article
                className={`import-contact-card ${row.status}`}
                key={row.id}
              >
                <label className="import-select-box">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    disabled={
                      row.status !==
                      "nuevo"
                    }
                    onChange={(event) =>
                      updateRow(
                        row.id,
                        {
                          selected:
                            event.target
                              .checked,
                        }
                      )
                    }
                  />
                  <span>
                    {row.selected
                      ? "Sí"
                      : "No"}
                  </span>
                </label>

                <div className="import-contact-main">
                  <div className="grid grid-2">
                    <label>
                      Nombre
                      <input
                        value={
                          row.firstName
                        }
                        onChange={(event) =>
                          updateRow(
                            row.id,
                            {
                              firstName:
                                event.target
                                  .value,
                            }
                          )
                        }
                      />
                    </label>

                    <label>
                      Apellido
                      <input
                        value={
                          row.lastName
                        }
                        onChange={(event) =>
                          updateRow(
                            row.id,
                            {
                              lastName:
                                event.target
                                  .value,
                            }
                          )
                        }
                      />
                    </label>

                    <label>
                      WhatsApp
                      <input
                        value={
                          row.phoneRaw
                        }
                        onChange={(event) =>
                          updateRow(
                            row.id,
                            {
                              phoneRaw:
                                event.target
                                  .value,
                            }
                          )
                        }
                      />
                    </label>

                    <label>
                      Categoría
                      <select
                        value={
                          row.primaryCategory
                        }
                        onChange={(event) =>
                          updateRow(
                            row.id,
                            {
                              primaryCategory:
                                event.target
                                  .value as Category,
                              secondaryCategory:
                                "",
                            }
                          )
                        }
                      >
                        {CATEGORIES.map(
                          (category) => (
                            <option
                              key={
                                category.value
                              }
                              value={
                                category.value
                              }
                            >
                              {
                                category.label
                              }
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label>
                      Categoría secundaria
                      <select
                        value={
                          row.secondaryCategory
                        }
                        onChange={(event) =>
                          updateRow(
                            row.id,
                            {
                              secondaryCategory:
                                event.target
                                  .value as
                                  | ""
                                  | Category,
                            }
                          )
                        }
                      >
                        <option value="">
                          Ninguna
                        </option>

                        {adjacentCategories(
                          row.primaryCategory
                        ).map(
                          (category) => (
                            <option
                              key={
                                category.value
                              }
                              value={
                                category.value
                              }
                            >
                              {
                                category.label
                              }
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label>
                      Género
                      <select
                        value={
                          row.gender
                        }
                        onChange={(event) =>
                          updateRow(
                            row.id,
                            {
                              gender:
                                event.target
                                  .value as Gender,
                            }
                          )
                        }
                      >
                        <option value="hombre">
                          Hombre
                        </option>
                        <option value="mujer">
                          Mujer
                        </option>
                      </select>
                    </label>
                  </div>

                  <div className="import-contact-footer">
                    <span
                      className={`badge ${
                        row.status ===
                        "nuevo"
                          ? "good"
                          : row.status ===
                            "importado"
                            ? "good"
                            : row.status ===
                                "invalido"
                              ? "danger"
                              : "warn"
                      }`}
                    >
                      {
                        row.statusMessage
                      }
                    </span>

                    {row.whatsapp ? (
                      <span className="help-text">
                        Se guardará como{" "}
                        <strong>
                          {row.whatsapp}
                        </strong>
                      </span>
                    ) : null}

                    <span className="help-text">
                      {sourceLabel(
                        row.source
                      )}
                      {" · "}
                      {categoryLabel(
                        row.primaryCategory
                      )}
                    </span>
                  </div>
                </div>

                <button
                  className="btn delete"
                  onClick={() =>
                    setRows(
                      (current) =>
                        classifyRows(
                          current.filter(
                            (item) =>
                              item.id !==
                              row.id
                          )
                        )
                    )
                  }
                  type="button"
                >
                  Quitar
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        className="card import-final-card"
        style={{ marginTop: 16 }}
      >
        <div>
          <h2>
            Importar seleccionados
          </h2>

          <p>
            {summary.selected} jugador(es)
            listos. Activos actuales:{" "}
            {activeCount}/
            {FREE_ACTIVE_PLAYER_LIMIT}.
          </p>

          {importing ? (
            <p>
              Guardando{" "}
              {progress.current} de{" "}
              {progress.total}...
            </p>
          ) : null}
        </div>

        <button
          className="btn save"
          disabled={
            importing ||
            !summary.selected
          }
          onClick={() =>
            void importSelected()
          }
        >
          {importing
            ? "Importando..."
            : `Importar ${summary.selected} jugador(es)`}
        </button>
      </section>
    </>
  );
}