import type { Worksheet } from "exceljs";
import { copyCellStyle } from "./cellStyle";
export function cloneRowStyle(ws: Worksheet, fromIdx: number, toIdx: number) {
  if (fromIdx === toIdx) return;
  const src = ws.getRow(fromIdx);
  const dst = ws.getRow(toIdx);
  dst.height = src.height;
  src.eachCell({ includeEmpty: true }, (cell, col) => {
    copyCellStyle(cell, dst.getCell(col));
  });
}
