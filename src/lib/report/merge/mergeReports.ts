import type { BuildStyleWarnings, ReportRow } from "../types";

function fixProtocol(u: string): string {
  let s = u.trim();
  s = s.replace(/^https?\/(?!\/)/i, (m) =>
    m.toLowerCase().startsWith("https") ? "https://" : "http://"
  );
  s = s.replace(/^https:(?!\/\/)/i, "https://");
  s = s.replace(/^http:(?!\/\/)/i, "http://");
  return s;
}

function extractBestUrl(raw: string): string | undefined {
  if (!raw) return undefined;
  const urlLikeRe = /(https?:\/?\/?[a-z0-9.-]+[^\s",)]+)/gi;
  const candidates: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = urlLikeRe.exec(raw))) candidates.push(m[0]);
  if (!candidates.length) return undefined;
  const fixed = candidates.map(fixProtocol);
  for (let i = fixed.length - 1; i >= 0; i--) {
    if (!/links\.cision\.one/i.test(fixed[i])) return fixed[i];
  }
  return fixed[fixed.length - 1];
}

function normalizeUrlForMatch(raw?: string): string | undefined {
  if (!raw) return undefined;
  let working = raw.trim();
  if (!working) return undefined;
  if (/^=*\s*hyperlink/i.test(working) || /%22,%20%22/i.test(working)) {
    const best = extractBestUrl(working);
    if (best) working = best;
  }
  const directHyperlink = working.match(
    /^=HYPERLINK\(\s*"[^"]*"\s*,\s*"([^"]+)"\s*\)$/i
  );
  if (directHyperlink) working = directHyperlink[1];
  working = fixProtocol(working);
  if (!/^[a-z]+:\/\//i.test(working)) working = "https://" + working;
  try {
    const u = new URL(working);
    u.search = "";
    u.hash = "";
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    let path = u.pathname || "/";
    path = path.replace(/\/{2,}/g, "/");
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return host + path;
  } catch {
    let s = working.split(/[?#]/)[0];
    s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    s = s.replace(/\/{2,}/g, "/");
    if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
    return s.toLowerCase();
  }
}

function parsePublishedDate(v: unknown): number {
  if (typeof v !== "string") return Number.NEGATIVE_INFINITY;
  let s = v.trim();
  if (!s || /^(not available|n\/a)$/i.test(s)) return Number.NEGATIVE_INFINITY;
  s = s.replace(/\./g, "-").replace(/\//g, "-").replace(/\s+/g, " ");
  const dmy = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
  if (dmy.test(s) && !/^\d{4}-/.test(s)) {
    const [, d, m, y] = s.match(dmy)!;
    return Date.parse(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
  }
  const ts = Date.parse(s);
  return Number.isFinite(ts) ? ts : Number.NEGATIVE_INFINITY;
}

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
      (["published", "outlet", "title", "base"] as const).forEach((f) => {
        if (
          isPlaceholder(baseRow[f]) &&
          typeof r[f] === "string" &&
          !isPlaceholder(r[f])
        )
          baseRow[f] = r[f];
      });
      if (!baseRow.url && r.url) baseRow.url = r.url;
    }
  });
  rows.sort((a, b) => {
    const db = parsePublishedDate(b.published);
    const da = parsePublishedDate(a.published);
    if (da < db) return -1;
    if (da > db) return 1;
    const ob = (b.outlet || "").toLowerCase();
    const oa = (a.outlet || "").toLowerCase();
    if (oa < ob) return -1;
    if (oa > ob) return 1;
    return 0;
  });
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
    if (r.url && prnInvalidDateUrls.has(r.url.trim())) redRows.push(i);
  });
  return { rows, styleWarnings: { redCells, redRows } };
}

function asNumber(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
