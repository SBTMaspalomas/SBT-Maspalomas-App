// Utilidades para importar jugadores desde un CSV y para normalizar los
// identificadores usados al vincular fotos por nombre de fichero.

// Tipos de documento admitidos (deben coincidir con el CHECK de la migración
// players_id_document_type_allowed y con DOC_TYPES de PlayerDocuments).
export const CSV_DOC_TYPES = ["DNI", "NIE", "Pasaporte", "DNI tutor"] as const;

export interface ParsedPlayerRow {
  /** Nº de línea en el CSV (1 = cabecera), para mensajes de error. */
  line: number;
  full_name: string;
  birth_date: string | null; // ISO YYYY-MM-DD o null
  id_document_type: string | null;
  id_document_number: string | null;
  team: string | null; // nombre de equipo tal cual aparece en el CSV
  errors: string[];
}

export interface CsvParseResult {
  rows: ParsedPlayerRow[];
  /** Errores globales (cabecera ausente, etc.). */
  fatal: string | null;
}

// Plantilla descargable / de referencia mostrada al administrador.
export const CSV_HEADERS = [
  "nombre_completo",
  "fecha_nacimiento",
  "tipo_documento",
  "numero_documento",
  "equipo",
] as const;

export const CSV_TEMPLATE = [
  CSV_HEADERS.join(","),
  "Juan Pérez García,2012-05-14,DNI,12345678A,Infantil A",
  "Lucía Santana Díaz,2010-11-02,NIE,X1234567L,Cadete B",
].join("\n");

/** Normaliza una cadena para comparaciones robustas (sin acentos, minúsculas). */
export function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Nombre de fichero → identificador normalizado (sin ruta ni extensión). */
export function fileNameToKey(fileName: string): string {
  const base = fileName.split("/").pop() ?? fileName;
  const noExt = base.replace(/\.[^.]+$/, "");
  return normalizeKey(noExt);
}

// --- Parsing de CSV --------------------------------------------------------

/** Parte una línea CSV respetando comillas dobles y el separador indicado. */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** Convierte una fecha del CSV (ISO o DD/MM/YYYY) a ISO YYYY-MM-DD, o null. */
function parseDate(raw: string): { value: string | null; error?: string } {
  const v = raw.trim();
  if (!v) return { value: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return { value: null, error: `Fecha inválida: "${v}"` };
    return { value: v };
  }
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { value: null, error: `Fecha inválida: "${v}"` };
    return { value: iso };
  }
  return { value: null, error: `Formato de fecha no reconocido: "${v}" (usa AAAA-MM-DD)` };
}

// Alias aceptados por columna (normalizados) → clave canónica.
const HEADER_ALIASES: Record<string, string> = {
  nombre: "nombre_completo",
  nombre_completo: "nombre_completo",
  nombrecompleto: "nombre_completo",
  jugador: "nombre_completo",
  fecha_nacimiento: "fecha_nacimiento",
  fechanacimiento: "fecha_nacimiento",
  nacimiento: "fecha_nacimiento",
  tipo_documento: "tipo_documento",
  tipodocumento: "tipo_documento",
  tipo: "tipo_documento",
  numero_documento: "numero_documento",
  numerodocumento: "numero_documento",
  documento: "numero_documento",
  dni: "numero_documento",
  equipo: "equipo",
  team: "equipo",
};

function canonicalDocType(raw: string): string | null {
  const key = normalizeKey(raw);
  return CSV_DOC_TYPES.find((t) => normalizeKey(t) === key) ?? null;
}

/**
 * Parsea el texto completo de un CSV de jugadores. Detecta el separador (`,` o
 * `;`) a partir de la cabecera y admite alias de columna en español.
 */
export function parsePlayersCsv(text: string): CsvParseResult {
  const clean = text.replace(/^\uFEFF/, ""); // quita BOM
  const lines = clean.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], fatal: "El archivo está vacío" };

  const headerLine = lines[0];
  const sep = headerLine.split(";").length > headerLine.split(",").length ? ";" : ",";
  const rawHeaders = splitLine(headerLine, sep).map((h) => normalizeKey(h));
  const cols = rawHeaders.map((h) => HEADER_ALIASES[h] ?? h);

  const idxName = cols.indexOf("nombre_completo");
  if (idxName < 0) {
    return {
      rows: [],
      fatal: 'Falta la columna obligatoria "nombre_completo" en la cabecera del CSV',
    };
  }
  const idxBirth = cols.indexOf("fecha_nacimiento");
  const idxType = cols.indexOf("tipo_documento");
  const idxNumber = cols.indexOf("numero_documento");
  const idxTeam = cols.indexOf("equipo");

  const rows: ParsedPlayerRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], sep);
    const errors: string[] = [];

    const full_name = (cells[idxName] ?? "").trim();
    if (!full_name) errors.push("Nombre vacío");

    let birth_date: string | null = null;
    if (idxBirth >= 0) {
      const res = parseDate(cells[idxBirth] ?? "");
      birth_date = res.value;
      if (res.error) errors.push(res.error);
    }

    let id_document_type: string | null = null;
    if (idxType >= 0) {
      const rawType = (cells[idxType] ?? "").trim();
      if (rawType) {
        const canon = canonicalDocType(rawType);
        if (canon) id_document_type = canon;
        else errors.push(`Tipo de documento no válido: "${rawType}"`);
      }
    }

    const id_document_number =
      idxNumber >= 0 && (cells[idxNumber] ?? "").trim() ? cells[idxNumber].trim() : null;
    const team = idxTeam >= 0 && (cells[idxTeam] ?? "").trim() ? cells[idxTeam].trim() : null;

    rows.push({
      line: i + 1,
      full_name,
      birth_date,
      id_document_type,
      id_document_number,
      team,
      errors,
    });
  }

  return { rows, fatal: null };
}
