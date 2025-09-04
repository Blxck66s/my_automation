/**
 * Extract the display URL (second argument) from a Cision-style Excel
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
