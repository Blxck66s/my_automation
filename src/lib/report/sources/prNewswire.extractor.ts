import { HEADER_SYNONYMS, type ExtractIssue, type ReportRow } from "../types";
import {
  extractPublishedFromPrnUrl,
  parseNumber,
  norm,
} from "../utils/extractorTools";

function toDate(raw: string): Date | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const toLocalDateOnly = (y: number, m: number, d: number) =>
    new Date(y, m, d); // midnight local
  const native = Date.parse(s);
  if (!Number.isNaN(native)) {
    const dt = new Date(native);
    return toLocalDateOnly(dt.getFullYear(), dt.getMonth(), dt.getDate());
  }
  let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    const [, d, mo, yRaw] = m;
    let y = yRaw;
    if (y.length === 2) y = (y < "50" ? "20" : "19") + y; // simple 2-digit year pivot
    return toLocalDateOnly(Number(y), Number(mo) - 1, Number(d));
  }
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

export interface PrnExtractResult {
  rows: ReportRow[];
  issues: ExtractIssue[];
  invalidDateUrls: Set<string>;
  headlineB1?: string;
}

const TEXT_PLACEHOLDER = "Not Available";
const NUM_PLACEHOLDER = "N/A";

const REQUIRED_PRN_HEADER_SEQUENCE = [
  "PR Newswire ID",
  "Language",
  "Outlet Name",
  "Media Type",
  "Link",
  "Location",
  "Source Type",
  "Industry",
  "Potential Audience",
  "Format",
  "Source",
];

function findHeaderRowBySequence(matrix: unknown[][]): number | undefined {
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row) continue;
    let matches = true;
    for (let c = 0; c < REQUIRED_PRN_HEADER_SEQUENCE.length; c++) {
      const expected = REQUIRED_PRN_HEADER_SEQUENCE[c];
      const cell = String(row[c] ?? "").trim();
      if (norm(cell) !== norm(expected)) {
        matches = false;
        break;
      }
    }
    if (matches) return i;
  }
  return undefined;
}

function buildHeaderIndex(
  headers: string[]
): Record<number, keyof ReportRow | undefined> {
  const idx: Record<string, keyof ReportRow> = {};
  for (const key of Object.keys(HEADER_SYNONYMS) as (keyof ReportRow)[]) {
    for (const variant of HEADER_SYNONYMS[key]) idx[norm(variant)] = key;
  }
  const map: Record<number, keyof ReportRow | undefined> = {};
  headers.forEach((h, i) => (map[i] = idx[norm(h)]));
  return map;
}

export async function extractPrnFile(file: File): Promise<PrnExtractResult> {
  const issues: ExtractIssue[] = [];
  const invalidDateUrls = new Set<string>();
  const XLSX = await import("xlsx");
  const data = new Uint8Array(await file.arrayBuffer());
  let wb;
  try {
    wb = XLSX.read(data, { type: "array" });
  } catch {
    throw new Error(
      "Failed to read PRNewswire spreadsheet (ensure .xls/.xlsx is valid)"
    );
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName)
    return {
      rows: [],
      issues: [{ row: 0, message: "No worksheet found" }],
      invalidDateUrls,
    };
  const ws = wb.Sheets[sheetName];
  let headlineB1: string | undefined;
  const b1Cell = ws["B1"];
  if (b1Cell && b1Cell.v != null) {
    const v = String(b1Cell.v).trim();
    if (v) headlineB1 = v;
  }
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    blankrows: false,
    defval: "",
  }) as unknown[][];
  if (!matrix.length)
    return {
      rows: [],
      issues: [{ row: 0, message: "Empty sheet" }],
      invalidDateUrls,
    };
  let headerRowIndex = findHeaderRowBySequence(matrix);
  let startDataIndex = headerRowIndex !== undefined ? headerRowIndex + 1 : 0;
  if (headerRowIndex === undefined) {
    let startIdValue: string | undefined;
    const b4Cell = ws["B4"];
    if (b4Cell && b4Cell.v != null) {
      const v = String(b4Cell.v).trim();
      if (v) startIdValue = v;
    }
    if (startIdValue) {
      for (let i = 0; i < matrix.length; i++) {
        const first = String(matrix[i][0] ?? "").trim();
        if (first === startIdValue) {
          startDataIndex = i;
          break;
        }
      }
    }
    headerRowIndex = startDataIndex > 0 ? startDataIndex - 1 : 0;
    if (headerRowIndex === startDataIndex) {
      startDataIndex = Math.min(startDataIndex + 1, matrix.length);
    }
  } else {
    startDataIndex = Math.min(startDataIndex, matrix.length);
  }
  if (headerRowIndex === undefined) headerRowIndex = 0;
  const rawHeaderCells = (matrix[headerRowIndex] as string[]) ?? [];
  const headers: string[] = rawHeaderCells.map((h, i) => {
    const trimmed = String(h ?? "").trim();
    return trimmed || `__EMPTY_${i}`;
  });
  let endDataIndexExclusive = matrix.length;
  for (let i = startDataIndex; i < matrix.length; i++) {
    const row = matrix[i];
    const isEmptyRow =
      !row || row.every((cell) => cell == null || String(cell).trim() === "");
    const isUnrelatedRow =
      row &&
      (row[0] ===
        " * This website requires a subscription or a login to view content." ||
        row[0] === "Earned Media");
    if (isEmptyRow || isUnrelatedRow) {
      endDataIndexExclusive = i;
      break;
    }
  }
  const headerFieldMap = buildHeaderIndex(headers);
  const dataObjects: Record<string, unknown>[] = [];
  for (let r = startDataIndex; r < endDataIndexExclusive; r++) {
    const rowArr = matrix[r];
    if (!rowArr || rowArr.every((c) => String(c).trim() === "")) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      obj[h] = rowArr[i];
    });
    dataObjects.push(obj);
  }
  const rows: ReportRow[] = [];
  const findKeyForField = (field: keyof ReportRow): string | undefined =>
    headers.find((_, idx) => headerFieldMap[idx] === field);
  const kPublished = findKeyForField("published");
  const kOutlet = findKeyForField("outlet");
  const kTitle = findKeyForField("title");
  const kReadership = findKeyForField("readership");
  const kBase = findKeyForField("base");
  const kUrl = findKeyForField("url");
  for (const record of dataObjects) {
    const url = kUrl ? String(record[kUrl] ?? "").trim() : "";
    const readershipRaw = kReadership ? record[kReadership] : undefined;
    let readership = parseNumber(readershipRaw);
    if (readership === undefined) {
      const numericCandidates: number[] = [];
      Object.values(record).forEach((v) => {
        const n = parseNumber(v);
        if (n !== undefined && n > 0) numericCandidates.push(n);
      });
      if (numericCandidates.length)
        readership = numericCandidates.sort((a, b) => b - a)[0];
    }
    const adEq =
      readership !== undefined ? Math.round(readership / 3) : undefined;
    let publishedStr = kPublished
      ? String(record[kPublished] ?? "").trim()
      : "";
    if (!publishedStr) {
      const derived = extractPublishedFromPrnUrl(url);
      if (derived) publishedStr = derived;
      else if (url) invalidDateUrls.add(url);
    }
    const published = toDate(publishedStr) ?? "Not Available";
    const outlet = kOutlet ? String(record[kOutlet] ?? "").trim() : "";
    let base = kBase ? String(record[kBase] ?? "").trim() : "";
    base = base.replace(/\s+/g, " ").trim();
    const title = kTitle ? String(record[kTitle] ?? "").trim() : "";
    const draft: ReportRow = {
      published,
      outlet: outlet || TEXT_PLACEHOLDER,
      title: title || TEXT_PLACEHOLDER,
      readership:
        readership !== undefined
          ? readership
          : (NUM_PLACEHOLDER as unknown as number),
      adEq: adEq !== undefined ? adEq : (NUM_PLACEHOLDER as unknown as number),
      base: base || TEXT_PLACEHOLDER,
      url: url || undefined,
    };
    const hasMeaningfulText =
      (draft.url && draft.url.trim().length > 0) ||
      (draft.outlet && draft.outlet !== TEXT_PLACEHOLDER) ||
      (draft.title && draft.title !== TEXT_PLACEHOLDER) ||
      (draft.base && draft.base !== TEXT_PLACEHOLDER);
    if (!hasMeaningfulText) continue;
    rows.push(draft);
  }
  return { rows, issues, invalidDateUrls, headlineB1 };
}

export function derivePrnStyle(
  rows: ReportRow[],
  invalidDateUrls: Set<string>
): {
  placeholderFieldsPerRow: Map<number, (keyof ReportRow)[]>;
  invalidDateUrls: Set<string>;
} {
  const placeholders = new Map<number, (keyof ReportRow)[]>();
  const isPlaceholder = (v: unknown) =>
    typeof v === "string" && /^(not available|n\/a)$/i.test(v.trim());
  rows.forEach((r, i) => {
    const missing: (keyof ReportRow)[] = [];
    (
      [
        "published",
        "outlet",
        "title",
        "readership",
        "adEq",
        "base",
      ] as (keyof ReportRow)[]
    ).forEach((f) => {
      if (f === "published") {
        if (
          (r.published instanceof Date && isNaN(r.published.getTime())) ||
          r.published === "Not Available"
        )
          missing.push(f);
      } else if (isPlaceholder(r[f])) missing.push(f);
    });
    if (missing.length) placeholders.set(i, missing);
  });
  return { placeholderFieldsPerRow: placeholders, invalidDateUrls };
}
