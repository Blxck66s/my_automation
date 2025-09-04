import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { ReportRow } from "./types";
import { extractDisplayUrl } from "./url";
import { autoFitColumns } from "./autofit";
import { cloneRowStyle } from "./rowStyle";
import { loadTemplateBuffer } from "./template";
import { ensureUniqueSheetName, importTemplateSheet } from "./workbookTemplate";
import type { BuildStyleWarnings } from "./styleWarnings";

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
  templateFilename?: string;
  styleWarnings?: BuildStyleWarnings;
  numberPrefix?: string;
  headlineFromPrn?: string; // NEW: prefer PRN B1 headline over workbook template
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
    styleWarnings,
    numberPrefix,
    headlineFromPrn, // NEW
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

  // Headline logic: prefer provided PRN headline, fallback to existing B1
  const toPlainText = (v: ExcelJS.CellValue): string => {
    if (v == null) return "";
    if (typeof v === "object") {
      if ("richText" in v && Array.isArray(v.richText)) {
        return v.richText.map((r) => r.text).join("");
      }
      if ("text" in v) return String(v.text);
    }
    return String(v);
  };
  const baseHeadline = (
    headlineFromPrn ?? toPlainText(ws.getCell("B1").value)
  ).trim();
  if (headlineFromPrn) {
    // Overwrite B1 so workbook reflects PRN headline source
    ws.getCell("B1").value = baseHeadline;
  }
  if (baseHeadline && numberPrefix) {
    ws.getCell("A1").value = `${numberPrefix}. ${baseHeadline}`;
  }

  // Simple sequential numbering (removed B4-based logic)
  const startingSeq = 1;

  // Populate rows
  rows.forEach((r, i) => {
    const rowIndex = startRow + i;
    if (i > 0) cloneRowStyle(ws, startRow, rowIndex);
    const row = ws.getRow(rowIndex);
    const cleanedUrl = extractDisplayUrl(r.url);

    row.getCell(1).value = startingSeq + i;
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

  // Apply style warnings (after data rows before totals)
  if (styleWarnings) {
    const applyRedFont = (rowIndex: number, col?: number) => {
      const excelRow = ws.getRow(startRow + rowIndex);
      if (col) {
        const cell = excelRow.getCell(col);
        cell.font = { ...(cell.font ?? {}), color: { argb: "FFFF0000" } };
      } else {
        for (let c = 1; c <= 7; c++) {
          const cell = excelRow.getCell(c);
          cell.font = { ...(cell.font ?? {}), color: { argb: "FFFF0000" } };
        }
      }
      excelRow.commit();
    };

    styleWarnings.redCells?.forEach(({ row, col }) => applyRedFont(row, col));
    styleWarnings.redRows?.forEach((r) => applyRedFont(r));
  }

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
