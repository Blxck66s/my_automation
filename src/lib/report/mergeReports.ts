import type { ReportRow } from "./types";
import type { BuildStyleWarnings } from "./styleWarnings";

/**
 * Fix common protocol mangles like:
 *   https/host  -> https://host
 *   https:/host -> https://host
 *   http/host   -> http://host
 *   http:/host  -> http://host
 */
function fixProtocol(u: string): string {
  let s = u.trim();
  s = s.replace(/^https?\/(?!\/)/i, (m) =>
    m.toLowerCase().startsWith("https") ? "https://" : "http://"
  );
  s = s.replace(/^https:(?!\/\/)/i, "https://");
  s = s.replace(/^http:(?!\/\/)/i, "http://");
  return s;
}

/**
 * From a raw cell value (may be a malformed Excel HYPERLINK formula),
 * extract the best candidate article URL.
 * Strategy:
 *  - Collect all url-like substrings (http / https with 1 or 2 slashes, colon may be missing)
 *  - Repair protocol
 *  - Prefer the last candidate that is NOT a links.cision.one tracking URL
 *  - Fallback to the last candidate
 */
function extractBestUrl(raw: string): string | undefined {
  if (!raw) return undefined;
  const urlLikeRe = /(https?:\/?\/?[a-z0-9.-]+[^\s",)]+)/gi;
  const candidates: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = urlLikeRe.exec(raw))) {
    candidates.push(m[0]);
  }
  if (candidates.length === 0) return undefined;
  const fixed = candidates.map(fixProtocol);
  for (let i = fixed.length - 1; i >= 0; i--) {
    if (!/links\.cision\.one/i.test(fixed[i])) return fixed[i];
  }
  return fixed[fixed.length - 1];
}

/**
 * Normalize a URL for dedupe (does NOT mutate the stored ReportRow.url).
 * Returns host(without www.) + normalized path (no query/hash, no trailing slash unless root).
 */
function normalizeUrlForMatch(raw?: string): string | undefined {
  if (!raw) return undefined;
  let working = raw.trim();
  if (!working) return undefined;

  // If it looks like a HYPERLINK formula or contains encoded comma parts, extract last/best URL.
  if (/^=*\s*hyperlink/i.test(working) || /%22,%20%22/i.test(working)) {
    const best = extractBestUrl(working);
    if (best) working = best;
  }

  // If still a formula-like string (fallback)
  const directHyperlink = working.match(
    /^=HYPERLINK\(\s*"[^"]*"\s*,\s*"([^"]+)"\s*\)$/i
  );
  if (directHyperlink) working = directHyperlink[1];

  working = fixProtocol(working);

  // Add protocol if missing (treat as https)
  if (!/^[a-z]+:\/\//i.test(working)) {
    working = "https://" + working;
  }

  try {
    const u = new URL(working);
    // Drop query & hash
    u.search = "";
    u.hash = "";
    // Host normalize (strip leading www.)
    let host = u.hostname.toLowerCase();
    host = host.replace(/^www\./, "");

    // Path normalize
    let path = u.pathname || "/";
    path = path.replace(/\/{2,}/g, "/");
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

    return host + path;
  } catch {
    // Fallback: crude normalization
    let s = working.split(/[?#]/)[0];
    s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    s = s.replace(/\/{2,}/g, "/");
    if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
    return s.toLowerCase();
  }
}

/** Parse published date to epoch ms (invalid/placeholder -> -Infinity) */
function parsePublishedDate(v: unknown): number {
  if (typeof v !== "string") return Number.NEGATIVE_INFINITY;
  let s = v.trim();
  if (!s || /^(not available|n\/a)$/i.test(s)) return Number.NEGATIVE_INFINITY;

  // Normalize separators
  s = s.replace(/\./g, "-").replace(/\//g, "-").replace(/\s+/g, " ");

  // Detect DD-MM-YYYY (not starting with year) -> convert
  const dmy = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
  if (dmy.test(s) && !/^\d{4}-/.test(s)) {
    const [, d, m, y] = s.match(dmy)!;
    return Date.parse(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
  }

  const ts = Date.parse(s);
  return Number.isFinite(ts) ? ts : Number.NEGATIVE_INFINITY;
}

/**
 * Merge Cision + PRNewswire rows.
 * - Deduplicate by normalized URL
 * - On duplicate: max readership cision adEq; fill placeholders with real values
 * - Style warnings computed post-merge
 */
export function mergeCisionAndPrn(
  cision: ReportRow[],
  prn: ReportRow[],
  prnInvalidDateUrls: Set<string>
): { rows: ReportRow[]; styleWarnings: BuildStyleWarnings } {
  const placeholderRe = /^(not available|n\/a)$/i;
  const isPlaceholder = (v: unknown) =>
    typeof v === "string" && placeholderRe.test(v);

  const urlIndex = new Map<string, number>();
  cision.forEach((r, i) => {
    const key = normalizeUrlForMatch(r.url);
    if (key) urlIndex.set(key, i);
  });

  const rows = [...cision];

  prn.forEach((r) => {
    const normKey = normalizeUrlForMatch(r.url);
    if (!normKey) {
      rows.push(r);
      return;
    }
    const existingIdx = urlIndex.get(normKey);
    if (existingIdx === undefined) {
      urlIndex.set(normKey, rows.length);
      rows.push(r);
    } else {
      const baseRow = rows[existingIdx];
      baseRow.readership = Math.max(
        asNumber(baseRow.readership),
        asNumber(r.readership)
      );
      baseRow.adEq = baseRow.adEq ? asNumber(baseRow.adEq) : asNumber(r.adEq);

      // Fill string placeholders
      const STRING_FIELDS = ["published", "outlet", "title", "base"] as const;
      for (const f of STRING_FIELDS) {
        if (
          isPlaceholder(baseRow[f]) &&
          typeof r[f] === "string" &&
          !isPlaceholder(r[f])
        ) {
          baseRow[f] = r[f];
        }
      }
      if (
        typeof r.published === "string" &&
        !isPlaceholder(r.published) &&
        isPlaceholder(baseRow.published)
      ) {
        baseRow.published = r.published;
      }
      if (!baseRow.url && r.url) baseRow.url = r.url;
    }
  });

  // NEW: sort by date asc, then outlet asc
  rows.sort((a, b) => {
    const db = parsePublishedDate(b.published);
    const da = parsePublishedDate(a.published);
    if (da < db) return -1;
    if (da > db) return 1;
    // Same date, sort by outlet
    const ob = (b.outlet || "").toLowerCase();
    const oa = (a.outlet || "").toLowerCase();
    if (oa < ob) return -1;
    if (oa > ob) return 1;
    return 0;
  });

  // Build style warnings
  const redCells: { row: number; col: number }[] = [];
  const redRows: number[] = [];
  const colForField: Record<keyof ReportRow, number> = {
    published: 2,
    outlet: 3,
    title: 4,
    readership: 5,
    adEq: 6,
    base: 7,
    url: 4,
  };

  rows.forEach((r, i) => {
    (
      ["published", "outlet", "title", "readership", "adEq", "base"] as const
    ).forEach((f) => {
      if (isPlaceholder(r[f])) redCells.push({ row: i, col: colForField[f] });
    });
    if (r.url && prnInvalidDateUrls.has(r.url.trim())) {
      redRows.push(i);
    }
  });

  return { rows, styleWarnings: { redCells, redRows } };
}

function asNumber(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
