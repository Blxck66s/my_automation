/** a single row of a media coverage report */
export interface ReportRow {
  published: string; // e.g. "26-Aug-25" (string so caller controls locale)
  outlet: string; // Media outlet name
  title: string; // Coverage title (display text for hyperlink)
  readership: number; // Total readership
  adEq: number; // Ad equivalent value
  base: string; // Media base / region
  url?: string; // Optional hyperlink target
}

/** style warnings found when building a report */
export interface BuildStyleWarnings {
  redCells?: { row: number; col: number }[];
  redRows?: number[];
}

/** Synonyms for ReportRow fields when extracting from CSV/Excel */
export const HEADER_SYNONYMS: Record<keyof ReportRow, string[]> = {
  published: ["published", "date"],
  outlet: ["source", "outlet", "outlet name", "publisher"],
  title: ["headline", "title"],
  readership: ["potential audience"],
  adEq: ["adeq", "advertising value equivalency", "ad value"],
  base: ["location", "country", "region", "base"],
  url: ["url", "link"],
};

/** Placeholder text for missing string fields */
export interface ExtractIssue {
  row: number;
  message: string;
  field?: keyof ReportRow;
  rawValue?: string;
}
