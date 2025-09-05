/** A single row of a media coverage report */
export interface ReportRow {
  /**
   * Date article was published. If successfully parsed it's a Date (date-only semantics, no time).
   * If unavailable or unparsable it is the placeholder string "Not Available".
   */
  published: Date | string;
  /** Media outlet name */
  outlet: string;
  /** Coverage title (display text for hyperlink) */
  title: string;
  /** Total readership */
  readership: number;
  /** Ad equivalent value */
  adEq: number;
  /** Media base / region */
  base: string;
  /** Optional hyperlink target */
  url?: string;
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
