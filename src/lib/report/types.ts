export interface ReportRow {
  published: string; // e.g. "26-Aug-25" (string so caller controls locale)
  outlet: string; // Media outlet name
  title: string; // Coverage title (display text for hyperlink)
  readership: number; // Total readership
  adEq: number; // Ad equivalent value
  base: string; // Media base / region
  url?: string; // Optional hyperlink target
}
