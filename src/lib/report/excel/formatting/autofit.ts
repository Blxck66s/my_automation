import type { Worksheet, CellValue } from "exceljs";

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
      const v = cell.value as CellValue;
      let text = "";
      if (v == null) text = "";
      else if (typeof v === "object" && "text" in (v as object)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        text = String((v as any).text ?? "");
      } else text = String(v);
      width = Math.max(width, text.length + pad);
    });
    col.width = Math.min(Math.max(min, width), max);
  });
}
