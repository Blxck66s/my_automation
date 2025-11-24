import ExcelJS from "exceljs";
import { cloneRowStyle } from "./formatting/rowStyle";

const PRS_SHEET_NAME = "PRs";
const DEFAULT_HYPERLINK = "https://www.tatnews.org/";

interface PrsSummaryArgs {
  workbook: ExcelJS.Workbook;
  reportSheet: ExcelJS.Worksheet;
  startRow: number;
  rowCount: number;
  writeTotals: boolean;
  totalReadership: number;
  totalAdEq: number;
  headlineText?: string;
}

export function appendPrsSummary(args: PrsSummaryArgs): void {
  const {
    workbook,
    reportSheet,
    startRow,
    rowCount,
    writeTotals,
    totalReadership,
    totalAdEq,
    headlineText,
  } = args;
  if (!rowCount) return;
  const prsSheet = workbook.getWorksheet(PRS_SHEET_NAME);
  if (!prsSheet) return;
  const firstDataRow = 2;
  let insertRowIndex = firstDataRow;
  while (!isRowEmpty(prsSheet.getRow(insertRowIndex))) {
    insertRowIndex++;
  }
  if (insertRowIndex > firstDataRow) {
    cloneRowStyle(prsSheet, firstDataRow, insertRowIndex);
  }
  const row = prsSheet.getRow(insertRowIndex);
  const seqNumber = insertRowIndex - firstDataRow + 1;
  row.getCell(1).value = seqNumber;
  row.getCell(2).value = null;
  if (headlineText) {
    row.getCell(3).value = {
      text: headlineText,
      hyperlink: DEFAULT_HYPERLINK,
    };
    const font = row.getCell(3).font ?? {};
    row.getCell(3).font = {
      ...font,
      underline: true,
      color: { argb: "FF0000FF" },
    };
  } else {
    row.getCell(3).value = "";
  }
  row.getCell(4).value = null;
  row.getCell(8).value = null;

  const lastDataRow = startRow + rowCount - 1;
  const sanitizedSheetName = reportSheet.name.replace(/'/g, "''");
  const sheetRef = `'${sanitizedSheetName}'!`;
  row.getCell(5).value = {
    formula: `${sheetRef}$A$${lastDataRow}`,
  };

  if (writeTotals) {
    const totalsRowIdx = lastDataRow + 1;
    row.getCell(6).value = {
      formula: `${sheetRef}$E$${totalsRowIdx}`,
    };
    row.getCell(7).value = {
      formula: `${sheetRef}$F$${totalsRowIdx}`,
    };
  } else {
    row.getCell(6).value = totalReadership;
    row.getCell(7).value = totalAdEq;
  }

  row.commit();
}

export function isRowEmpty(row: ExcelJS.Row): boolean {
  const values = Array.isArray(row.values)
    ? row.values
    : Object.values(row.values ?? {});
  return !values.some((value, idx) => {
    if (idx === 0) return false;
    return value !== undefined && value !== null && value !== "";
  });
}
