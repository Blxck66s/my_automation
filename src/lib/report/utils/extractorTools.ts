/** Normalize string: trim, lowercase, collapse spaces */
export function norm(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Parse number from string, removing $ and , */
export function parseNumber(v: unknown): number | undefined {
  if (v == null) return undefined;
  const cleaned = String(v).replace(/[$,]/g, "").trim().replace(/\s+/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/** Extract date (YYYYMMDD) from PR Newswire URL query (?rkey=YYYYMMDD) -> dd/mm/yy */
export function extractPublishedFromPrnUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const m = url.match(/[?&]rkey=(\d{8})/i);
  if (!m) return undefined;
  const raw = m[1];
  const y = Number(raw.slice(0, 4));
  const mo = Number(raw.slice(4, 6));
  const d = Number(raw.slice(6, 8));
  if (!y || !mo || !d || mo < 1 || mo > 12) return undefined;
  return `${String(d).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${String(y).slice(-2)}`;
}

/**
 * Extract the display URL (second argument) from a Cision One CSV
 * HYPERLINK formula:
 *   =HYPERLINK("tracking","https://real.url/article")
 * If not matched, the original string is returned.
 */
export function extractDisplayUrl(raw?: string): string | undefined {
  if (!raw) return raw;
  const trimmed = raw.trim();
  const m = trimmed.match(/^=HYPERLINK\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)$/i);
  return m ? m[2] : raw;
}

/**
 * Derive sheet name from first numeric prefix in CSV file name (NN_ / NN- / NN ).
 */
export function deriveSuggestedSheetName(fileName: string): string {
  const m = fileName.match(/(^|\D)(\d{1,4})[_\-\s]/);
  if (m && m[2]) return m[2];
  return "Report";
}
