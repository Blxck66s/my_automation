import { HEADER_SYNONYMS, type ExtractIssue, type ReportRow } from "../types";
import { norm, parseNumber } from "../utils/extractorTools";

// Parse date in several common formats and normalize to a *local* date-only (midnight local time).
// Previously we normalized to UTC to avoid cross‑TZ shifts when sharing, but requirement changed
// to reflect the client's local timezone exactly.
function parseFlexibleDate(raw: string): Date | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const toLocalDateOnly = (y: number, m: number, d: number) =>
    new Date(y, m, d); // local midnight
  // Native parse first (lets engine interpret timezone / format) then collapse to local date-only
  const native = Date.parse(s);
  if (!Number.isNaN(native)) {
    const dt = new Date(native);
    return toLocalDateOnly(dt.getFullYear(), dt.getMonth(), dt.getDate());
  }
  // d/m/y or d-m-y
  let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    const [, d, mo, yRaw] = m;
    let y = yRaw;
    if (y.length === 2) y = (y < "50" ? "20" : "19") + y; // naive 2-digit pivot
    return toLocalDateOnly(Number(y), Number(mo) - 1, Number(d));
  }
  // d-MMM-y (e.g. 5-Jan-2025)
  m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (m) {
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const [, d, mon, yRaw] = m;
    let y = yRaw;
    const idx = months.indexOf(mon.toLowerCase());
    if (idx >= 0) {
      if (y.length === 2) y = (y < "50" ? "20" : "19") + y;
      return toLocalDateOnly(Number(y), idx, Number(d));
    }
  }
  return undefined;
}

export interface CisionOneExtractResult {
  rows: ReportRow[];
  issues: ExtractIssue[];
  unmappedHeaders: string[];
  headerMap: Record<string, keyof ReportRow | undefined>;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        cur.push(field);
        field = "";
      } else if (ch === "\r") {
        /* ignore */
      } else if (ch === "\n") {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else field += ch;
    }
  }
  if (inQuotes) {
    /* unbalanced quotes */
  }
  cur.push(field);
  if (cur.length > 1 || cur[0] !== "") rows.push(cur);
  return rows;
}

function buildHeaderMap(headers: string[]): {
  map: Record<number, keyof ReportRow | undefined>;
  reverse: Record<string, keyof ReportRow | undefined>;
  unmapped: string[];
} {
  const synonymIndex: Record<string, keyof ReportRow> = {};
  for (const key of Object.keys(HEADER_SYNONYMS) as (keyof ReportRow)[]) {
    for (const variant of HEADER_SYNONYMS[key])
      synonymIndex[norm(variant)] = key;
  }
  const map: Record<number, keyof ReportRow | undefined> = {};
  const reverse: Record<string, keyof ReportRow | undefined> = {};
  const unmapped: string[] = [];
  headers.forEach((raw, idx) => {
    const n = norm(raw);
    const matched = synonymIndex[n];
    map[idx] = matched;
    reverse[raw] = matched;
    if (!matched) unmapped.push(raw);
  });
  return { map, reverse, unmapped };
}

export function extractCisionOneCsv(csvText: string): CisionOneExtractResult {
  const lines = parseCsv(csvText);
  if (lines.length === 0) {
    return {
      rows: [],
      issues: [{ row: 0, message: "Empty CSV input" }],
      unmappedHeaders: [],
      headerMap: {},
    };
  }
  const headers = lines[0];
  const { map: headerIndexMap, reverse, unmapped } = buildHeaderMap(headers);
  const issues: ExtractIssue[] = [];
  const rows: ReportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rowArr = lines[i];
    if (rowArr.every((v) => v.trim() === "")) continue;
    const draft: Partial<ReportRow> = {};
    rowArr.forEach((val, colIdx) => {
      const field = headerIndexMap[colIdx];
      if (!field) return;
      const trimmed = val.trim();
      switch (field) {
        case "readership": {
          const num = parseNumber(trimmed);
          if (num === undefined)
            issues.push({
              row: i + 1,
              field,
              message: "Invalid readership number",
              rawValue: trimmed,
            });
          else draft.readership = num;
          break;
        }
        case "adEq": {
          const num = parseNumber(trimmed);
          if (num === undefined)
            issues.push({
              row: i + 1,
              field,
              message: "Invalid adEq number",
              rawValue: trimmed,
            });
          else draft.adEq = num;
          break;
        }
        case "published": {
          const parsed = parseFlexibleDate(trimmed);
          draft.published = parsed ? parsed : "Not Available";
          break;
        }
        case "outlet":
          draft.outlet = trimmed;
          break;
        case "title":
          draft.title = trimmed;
          break;
        case "base":
          draft.base = trimmed;
          break;
        case "url":
          draft.url = trimmed || undefined;
          break;
      }
    });
    const required: (keyof ReportRow)[] = [
      "published",
      "outlet",
      "title",
      "readership",
      "adEq",
      "base",
      "url",
    ];
    const missing = required.filter(
      (k) => draft[k] === undefined || draft[k] === ""
    );
    if (draft.published === "Not Available") {
      issues.push({
        row: i + 1,
        field: "published",
        message: "Missing or invalid published date",
        rawValue: "",
      });
    }
    if (missing.length) {
      issues.push({
        row: i + 1,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
      continue;
    }
    rows.push(draft as ReportRow);
  }
  return { rows, issues, unmappedHeaders: unmapped, headerMap: reverse };
}

export async function extractCisionOneFile(
  file: File
): Promise<CisionOneExtractResult> {
  const text = await file.text();
  return extractCisionOneCsv(text);
}
