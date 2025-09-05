import { HEADER_SYNONYMS, type ExtractIssue, type ReportRow } from "../types";
import {
  extractPublishedFromPrnUrl,
  parseNumber,
  norm,
} from "../utils/extractorTools";

export interface PrnExtractResult {
  rows: ReportRow[];
  issues: ExtractIssue[];
  invalidDateUrls: Set<string>;
  headlineB1?: string;
}

const TEXT_PLACEHOLDER = "Not Available";
const NUM_PLACEHOLDER = "N/A";

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
  let startIdValue: string | undefined;
  const b4Cell = ws["B4"];
  if (b4Cell && b4Cell.v != null) {
    const v = String(b4Cell.v).trim();
    if (v) startIdValue = v;
  }
  let startDataIndex = 0;
  if (startIdValue) {
    for (let i = 0; i < matrix.length; i++) {
      const first = String(matrix[i][0] ?? "").trim();
      if (first === startIdValue) {
        startDataIndex = i;
        break;
      }
    }
  }
  const headerRowIndex = startDataIndex > 0 ? startDataIndex - 1 : 0;
  if (headerRowIndex === startDataIndex) {
    startDataIndex = Math.min(startDataIndex + 1, matrix.length);
  }
  const rawHeaderCells = (matrix[headerRowIndex] as string[]) ?? [];
  const headers: string[] = rawHeaderCells.map((h, i) => {
    const trimmed = String(h ?? "").trim();
    return trimmed || `__EMPTY_${i}`;
  });
  let endDataIndexExclusive = matrix.length;
  for (let i = startDataIndex; i < matrix.length; i++) {
    const first = String(matrix[i][0] ?? "").trim();
    if (first !== startIdValue) {
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
  dataObjects.forEach((record) => {
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
    let published = kPublished ? String(record[kPublished] ?? "").trim() : "";
    if (!published) {
      const derived = extractPublishedFromPrnUrl(url);
      if (derived) published = derived;
      else if (url) invalidDateUrls.add(url);
    }
    const outlet = kOutlet ? String(record[kOutlet] ?? "").trim() : "";
    let base = kBase ? String(record[kBase] ?? "").trim() : "";
    base = base.replace(/\s+/g, " ").trim();
    const title = kTitle ? String(record[kTitle] ?? "").trim() : "";
    const draft: ReportRow = {
      published: published || TEXT_PLACEHOLDER,
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
    rows.push(draft);
  });
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
      if (isPlaceholder(r[f])) missing.push(f);
    });
    if (missing.length) placeholders.set(i, missing);
  });
  return { placeholderFieldsPerRow: placeholders, invalidDateUrls };
}
