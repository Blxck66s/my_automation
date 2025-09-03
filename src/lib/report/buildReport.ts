import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { ReportRow } from "./types";
import templateUrl from "../../assets/report-templete.xlsx?url";

/**
 * Options controlling how the Excel report is built.
 */
export interface BuildReportOptions {
  /**
   * Worksheet name to target. If omitted, the first worksheet is used.
   */
  sheetName?: string;
  /**
   * The (1-based) row index in the template that represents the data row layout.
   * All inserted data rows will clone its styling.
   * Default: 5
   */
  startRow?: number;
  /**
   * Whether to write SUM formulas for numeric columns (readership/adEq).
   * Default: true
   */
  writeTotals?: boolean;
  /**
   * If true, auto widths will be recomputed for select columns.
   * Default: true
   */
  autoFit?: boolean;
}

/**
 * Build and download an updated Excel report using a template in /assets.
 */
export async function buildReportClient(
  rows: ReportRow[],
  opts: BuildReportOptions = {}
): Promise<void> {
  if (!rows.length) return;

  const { sheetName, startRow = 3, writeTotals = true, autoFit = true } = opts;

  const fetchTemplate = async (): Promise<ArrayBuffer> => {
    const resp = await fetch(templateUrl, { cache: "no-store" });
    if (!resp.ok) throw new Error(`Template fetch failed (${resp.status})`);
    return await resp.arrayBuffer();
  };

  try {
    const buf = await fetchTemplate();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws =
      (sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0]) ??
      wb.worksheets[0];
    if (!ws) throw new Error("Worksheet not found in template");

    const cloneRowStyle = (fromIdx: number, toIdx: number) => {
      const src = ws.getRow(fromIdx);
      const dst = ws.getRow(toIdx);
      dst.height = src.height;
      src.eachCell({ includeEmpty: true }, (cell, col) => {
        const t = dst.getCell(col);
        if (cell.font) t.font = { ...cell.font };
        if (cell.alignment) t.alignment = { ...cell.alignment };
        if (cell.border) t.border = { ...cell.border };
        if (cell.fill) t.fill = { ...cell.fill };
        if (cell.numFmt) t.numFmt = cell.numFmt;
      });
    };

    if (rows.length > 1) {
      ws.spliceRows(startRow + 1, 0, ...Array(rows.length - 1).fill([]));
    }

    rows.forEach((r, i) => {
      const rowIndex = startRow + i;
      cloneRowStyle(startRow, rowIndex);
      const row = ws.getRow(rowIndex);
      row.getCell(1).value = i + 1;
      row.getCell(2).value = r.published;
      row.getCell(3).value = r.outlet;
      row.getCell(4).value = r.url
        ? { text: r.title, hyperlink: r.url }
        : r.title;
      row.getCell(5).value = r.readership;
      row.getCell(6).value = r.adEq;
      row.getCell(7).value = r.base;
      row.getCell(5).numFmt = "#,##0";
      row.getCell(6).numFmt = "$#,##0";
      row.commit();
    });

    const lastDataRow = startRow + rows.length - 1;
    if (writeTotals) {
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
      [2, 3, 4, 7].forEach((colIdx) => {
        const col = ws.getColumn(colIdx);
        let max = 10;
        col.eachCell({ includeEmpty: false }, (c) => {
          const v = c.value;
          const s =
            typeof v === "object" && v && "text"
              ? String((v as { text: string }).text)
              : String(v);
          max = Math.max(max, s.length + 2);
        });
        col.width = Math.min(Math.max(10, max), 60);
      });
    }

    const outBuffer = await wb.xlsx.writeBuffer();
    saveAs(
      new Blob([outBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "report.xlsx"
    );
  } catch (err) {
    console.error("Report build failed:", err);
    alert(
      `Report build failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
