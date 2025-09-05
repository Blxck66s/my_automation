import type { Cell } from "exceljs";
export function copyCellStyle(src: Cell, dst: Cell): void {
  if (src.font) dst.font = { ...src.font };
  if (src.alignment) dst.alignment = { ...src.alignment };
  if (src.border) dst.border = { ...src.border };
  if (src.fill) dst.fill = { ...src.fill };
  if (src.numFmt) dst.numFmt = src.numFmt;
  if (src.protection) dst.protection = { ...src.protection };
}
