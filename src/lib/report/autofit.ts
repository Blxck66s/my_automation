import type { Worksheet } from "exceljs";

/**
 * Auto-fit widths for given column indexes (1-based).
 * Simple heuristic: longest textual length + padding, clamped.
 */
export function autoFitColumns(
  ws: Worksheet,
  cols: number[],
  {
    min = 10,
    max = 60,
    pad = 2,
  }: { min?: number; max?: number; pad?: number } = {}
) {
  cols.forEach((colIdx) => {
    const col = ws.getColumn(colIdx);
    let width = min;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      let text: string;
      if (v == null) text = "";
      else if (typeof v === "object" && "text" in v) text = String(v.text);
      else text = String(v);
      width = Math.max(width, text.length + pad);
    });
    col.width = Math.min(Math.max(min, width), max);
  });
}
