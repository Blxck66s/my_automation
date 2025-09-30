import ExcelJS, { type CellValue } from "exceljs";
import { saveAs } from "file-saver";
import type { BuildStyleWarnings, ReportRow } from "../types";
import { autoFitColumns } from "./formatting/autofit";
import { cloneRowStyle } from "./formatting/rowStyle";
import { loadTemplateBuffer } from "./template/template";
import {
  ensureUniqueSheetName,
  importTemplateSheet,
} from "./template/workbookTemplate";
import { extractDisplayUrl } from "../utils/extractorTools";

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
  headlineFromPrn?: string;
  autoDownload?: boolean;
}

export async function buildReportClient(
  rows: ReportRow[],
  opts: BuildReportOptions = {}
): Promise<File | null> {
  if (!rows.length) return null;
  const {
    startRow = 3,
    writeTotals = true,
    autoFit = true,
    outputFilename = "report.xlsx",
    baseWorkbookFile,
    targetSheetName = "Report",
    styleWarnings,
    numberPrefix,
    headlineFromPrn,
    autoDownload = true,
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
    if (ws) ws.name = ensureUniqueSheetName(wb, targetSheetName);
  }
  if (!ws) throw new Error("Failed to acquire worksheet");
  if (rows.length > 1)
    ws.spliceRows(startRow + 1, 0, ...Array(rows.length - 1).fill([]));
  const toPlainText = (v: CellValue): string => {
    if (v == null) return "";
    if (typeof v === "object") {
      if ("richText" in v && Array.isArray(v.richText)) {
        return v.richText.map((r: { text: string }) => r.text).join("");
      }
      if ("text" in v) return String(v.text);
    }
    return String(v);
  };
  const baseHeadline = (
    headlineFromPrn ?? toPlainText(ws.getCell("B1").value)
  ).trim();
  if (headlineFromPrn) ws.getCell("B1").value = baseHeadline;
  if (baseHeadline && numberPrefix)
    ws.getCell("A1").value = `${numberPrefix}. ${baseHeadline}`;
  const startingSeq = 1;
  // Convert JS Date (local date-only) to Excel serial date (1900 date system) with no time component.
  const toExcelSerial = (d: Date): number => {
    // Excel's day 1 is 1900-01-01, but due to the 1900 leap year bug, serial 60 is 1900-02-29.
    // Using UTC to avoid local DST influence.
    const msPerDay = 86400000;
    const excelEpoch = Date.UTC(1899, 11, 30); // 1899-12-30
    const utcMidnight = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((utcMidnight - excelEpoch) / msPerDay);
  };

  rows.forEach((r, i) => {
    const rowIndex = startRow + i;
    if (i > 0) cloneRowStyle(ws, startRow, rowIndex);
    const row = ws.getRow(rowIndex);
    const cleanedUrl = extractDisplayUrl(r.url);
    row.getCell(1).value = startingSeq + i;
    if (r.published instanceof Date && !isNaN(r.published.getTime())) {
      // Write as pure date serial to eliminate timezone/time portion display.
      row.getCell(2).value = toExcelSerial(r.published);
      row.getCell(2).numFmt = "dd-MMM-yy"; // e.g. 05-Jan-25
    } else if (typeof r.published === "string") {
      row.getCell(2).value = r.published; // e.g. "Not Available"
    } else {
      row.getCell(2).value = "Not Available";
    }
    row.getCell(3).value = r.outlet;
    if (cleanedUrl) {
      row.getCell(4).value = { text: r.title, hyperlink: cleanedUrl };
      const font = row.getCell(4).font ?? {};
      row.getCell(4).font = {
        ...font,
        underline: true,
        color: { argb: "FF0000FF" },
      };
    } else row.getCell(4).value = r.title;
    row.getCell(5).value = r.readership;
    row.getCell(6).value = r.adEq;
    row.getCell(7).value = r.base;
    row.getCell(5).numFmt ||= "#,##0";
    row.getCell(6).numFmt ||= "$#,##0";
    row.commit();
  });
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
  if (autoFit) {
    autoFitColumns(ws, [2, 3, 4, 5, 6, 7], {
      perColumn: {
        2: { max: 14 }, // Published
        // 5: { max: 24 }, // Readership
        6: { max: 16 }, // AdEq
      },
    });
  }
  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const generatedFile = new File([blob], outputFilename, {
    type: blob.type,
  });
  if (autoDownload) saveAs(generatedFile, outputFilename);
  return generatedFile;
}
