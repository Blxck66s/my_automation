import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { ReportRow } from "./types";
import { extractDisplayUrl } from "./url";
import { autoFitColumns } from "./autofit";
import { cloneRowStyle } from "./rowStyle";
import { loadTemplateBuffer } from "./template";
import { ensureUniqueSheetName, importTemplateSheet } from "./workbookTemplate";

/**
 * Options controlling how the Excel report is built.
 */
export interface BuildReportOptions {
  startRow?: number;
  writeTotals?: boolean;
  autoFit?: boolean;
  outputFilename?: string;
  baseWorkbookFile?: File;
  targetSheetName?: string;
  templateFilename?: string; // (kept for future use)
}

/**
 * Build & download an Excel report.
 */
export async function buildReportClient(
  rows: ReportRow[],
  opts: BuildReportOptions = {}
): Promise<void> {
  if (!rows.length) return;

  const {
    startRow = 3,
    writeTotals = true,
    autoFit = true,
    outputFilename = "report.xlsx",
    baseWorkbookFile,
    targetSheetName = "Report",
  } = opts;

  const wb = new ExcelJS.Workbook();
  let ws: ExcelJS.Worksheet;

  if (baseWorkbookFile) {
    const buf = await baseWorkbookFile.arrayBuffer();
    await wb.xlsx.load(buf);
    ws = await importTemplateSheet(wb, targetSheetName);
  } else {
    const buf = await loadTemplateBuffer();
    await wb.xlsx.load(buf);
    ws = wb.worksheets[0];
    if (ws) {
      ws.name = ensureUniqueSheetName(wb, targetSheetName);
    }
  }

  if (!ws) throw new Error("Failed to acquire worksheet");

  // Insert blank rows if multiple data rows
  if (rows.length > 1) {
    ws.spliceRows(startRow + 1, 0, ...Array(rows.length - 1).fill([]));
  }

  // Populate rows
  rows.forEach((r, i) => {
    const rowIndex = startRow + i;
    if (i > 0) cloneRowStyle(ws, startRow, rowIndex);
    const row = ws.getRow(rowIndex);
    const cleanedUrl = extractDisplayUrl(r.url);

    row.getCell(1).value = i + 1;
    row.getCell(2).value = r.published;
    row.getCell(3).value = r.outlet;

    if (cleanedUrl) {
      row.getCell(4).value = { text: r.title, hyperlink: cleanedUrl };
      const font = row.getCell(4).font ?? {};
      row.getCell(4).font = {
        ...font,
        underline: true,
        color: { argb: "FF0000FF" },
      };
    } else {
      row.getCell(4).value = r.title;
    }

    row.getCell(5).value = r.readership;
    row.getCell(6).value = r.adEq;
    row.getCell(7).value = r.base;

    row.getCell(5).numFmt ||= "#,##0";
    row.getCell(6).numFmt ||= "$#,##0";
    row.commit();
  });

  // Totals
  if (writeTotals) {
    const lastDataRow = startRow + rows.length - 1;
    const totalRow = ws.getRow(lastDataRow + 1);
    totalRow.getCell(5).value = {
      formula: `SUM(E${startRow}:E${lastDataRow})`,
    };
    totalRow.getCell(6).value = {
      formula: `SUM(F${startRow}:F${lastDataRow})`,
    };
    totalRow.commit();
  }

  if (autoFit) autoFitColumns(ws, [2, 3, 4, 7]);

  const out = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    outputFilename.endsWith(".xlsx") ? outputFilename : `${outputFilename}.xlsx`
  );
}
