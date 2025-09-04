/**
 * Styling instructions consumed by buildReportClient.
 * row / col are zero-based relative to data rows (not absolute worksheet row numbers).
 */
export interface BuildStyleWarnings {
  redCells?: { row: number; col: number }[];
  redRows?: number[];
}
