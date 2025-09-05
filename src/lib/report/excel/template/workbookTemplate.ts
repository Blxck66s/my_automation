import ExcelJS from "exceljs";
import { loadTemplateBuffer } from "./template";
import { copyCellStyle } from "../formatting/cellStyle";

// Ensure the desired sheet name is unique within the workbook.
export function ensureUniqueSheetName(
  wb: ExcelJS.Workbook,
  desired: string
): string {
  const base = (desired || "Report").slice(0, 31) || "Report";
  const existing = new Set(wb.worksheets.map((w) => w.name));
  if (!existing.has(base)) return base;
  for (let i = 1; i < 1000; i++) {
    const candidate = (base + "-" + i).slice(0, 31);
    if (!existing.has(candidate)) return candidate;
  }
  return Date.now().toString().slice(-6);
}

// Get the list of merged cell ranges in the worksheet.
function getMergeRanges(ws: ExcelJS.Worksheet): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyWs = ws as any;
  const merges = anyWs.model?.merges;
  if (Array.isArray(merges)) return merges.slice();
  const internal: Record<string, unknown> | undefined = anyWs._merges;
  if (internal && typeof internal === "object") return Object.keys(internal);
  return [];
}

// Deep clone a cell value, including rich text.
function cloneCellValue(v: ExcelJS.CellValue): ExcelJS.CellValue {
  if (v == null || typeof v !== "object") return v;
  if ((v as ExcelJS.CellRichTextValue).richText) {
    const rich = (v as ExcelJS.CellRichTextValue).richText.map((run) => ({
      ...run,
      font: run.font ? { ...run.font } : run.font,
    }));
    return { ...(v as ExcelJS.CellRichTextValue), richText: rich };
  }
  return { ...v };
}

// Import a template sheet into the given workbook, ensuring unique naming and copying styles.
export async function importTemplateSheet(
  wb: ExcelJS.Workbook,
  targetName: string
): Promise<ExcelJS.Worksheet> {
  const buf = await loadTemplateBuffer();
  const tmplWb = new ExcelJS.Workbook();
  await tmplWb.xlsx.load(buf);
  const src = tmplWb.worksheets[0];
  if (!src) throw new Error("Template workbook has no sheets");
  const finalName = ensureUniqueSheetName(wb, targetName);
  const dst = wb.addWorksheet(finalName);
  src.columns.forEach((col, idx) => {
    if (col?.width) dst.getColumn(idx + 1).width = col.width;
  });
  for (let r = 1; r <= src.rowCount; r++) {
    const sRow = src.getRow(r);
    const dRow = dst.getRow(r);
    if (sRow.height) dRow.height = sRow.height;
    sRow.eachCell({ includeEmpty: true }, (cell, c) => {
      const dCell = dRow.getCell(c);
      dCell.value = cloneCellValue(cell.value);
      copyCellStyle(cell, dCell);
    });
    dRow.commit();
  }
  getMergeRanges(src).forEach((range) => {
    try {
      dst.mergeCells(range);
    } catch {
      /* ignore */
    }
  });
  return dst;
}
