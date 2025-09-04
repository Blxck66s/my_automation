/**
 * Extract date (YYYYMMDD) from PR Newswire URL query (?rkey=YYYYMMDD).
 * Returns formatted dd-MMM-yy (e.g. 27-Aug-25) or undefined.
 */
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function extractPublishedFromPrnUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const m = url.match(/[?&]rkey=(\d{8})/i);
  if (!m) return undefined;
  const raw = m[1];
  const y = Number(raw.slice(0, 4));
  const mo = Number(raw.slice(4, 6));
  const d = Number(raw.slice(6, 8));
  if (!y || !mo || !d || mo < 1 || mo > 12) return undefined;
  return `${String(d).padStart(2, "0")}-${MONTHS[mo - 1]}-${String(y).slice(-2)}`;
}
