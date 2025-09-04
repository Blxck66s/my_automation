import ExcelJS from "exceljs";
import { loadTemplateBuffer } from "./template";
import { copyCellStyle } from "./cellStyle";

/**
 * Ensure worksheet name is unique (Excel 31 char limit).
 */
export function ensureUniqueSheetName(
  wb: ExcelJS.Workbook,
  desired: string
): string {
  const base = (desired || "Report").slice(0, 31) || "Report";
  const existing = new Set(wb.worksheets.map((w) => w.name));
  if (!existing.has(base)) return base;
  for (let i = 1; i < 1000; i++) {
    const candidate = (base + "_" + i).slice(0, 31);
    if (!existing.has(candidate)) return candidate;
  }
  return Date.now().toString().slice(-6);
}

function getMergeRanges(ws: ExcelJS.Worksheet): string[] {
  const anyWs = ws as unknown as {
    model?: { merges?: unknown };
    _merges?: Record<string, unknown>;
  };
  const merges = anyWs.model?.merges;
  if (Array.isArray(merges)) return merges.slice();
  const internal = anyWs._merges;
  if (internal && typeof internal === "object") return Object.keys(internal);
  return [];
}

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

/**
 * Import the first sheet of the template workbook into an existing workbook.
 */
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

  // Column widths
  src.columns.forEach((col, idx) => {
    if (col?.width) dst.getColumn(idx + 1).width = col.width;
  });

  // Rows + cells
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

  // Merges
  getMergeRanges(src).forEach((range) => {
    try {
      dst.mergeCells(range);
    } catch {
      /* ignore */
    }
  });

  return dst;
}
