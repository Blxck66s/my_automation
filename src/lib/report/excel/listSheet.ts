import ExcelJS, {
  type CellValue,
  type Worksheet,
  type Cell,
  type CellHyperlinkValue,
  type CellFormulaValue,
  type CellRichTextValue,
} from "exceljs";
import type { ReportRow } from "../types";
import { buildReportClient } from "./buildReport";

const DEFAULT_LIST_SHEET_NAME = "LIST";
const DEFAULT_DATA_START_ROW = 3;
const WORKBOOK_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface GenerateListSheetOptions {
  listSheetName?: string;
  dataStartRow?: number;
}

export interface ListSheetResult {
  file: File;
  aggregatedRowCount: number;
  sourceSheetCount: number;
}

export async function generateListSheetFromWorkbook(
  workbookFile: File,
  options: GenerateListSheetOptions = {}
): Promise<ListSheetResult> {
  const listSheetName =
    (options.listSheetName || DEFAULT_LIST_SHEET_NAME).trim() ||
    DEFAULT_LIST_SHEET_NAME;
  const dataStartRow = options.dataStartRow ?? DEFAULT_DATA_START_ROW;
  if (!workbookFile) throw new Error("A workbook file is required");
  const workbook = new ExcelJS.Workbook();
  const buf = await workbookFile.arrayBuffer();
  await workbook.xlsx.load(buf);

  const numericSheets = workbook.worksheets
    .filter((ws) => /^\d+$/.test(ws.name.trim()))
    .sort((a, b) => Number(a.name) - Number(b.name));
  if (!numericSheets.length)
    throw new Error("No numeric-named sheets were found in the workbook");

  const aggregatedRows = numericSheets.flatMap((sheet) =>
    extractRowsFromSheet(sheet, dataStartRow)
  );
  if (!aggregatedRows.length)
    throw new Error("Numeric sheets do not contain any data rows");

  const existingList = workbook.worksheets.find(
    (ws) => ws.name.toLowerCase() === listSheetName.toLowerCase()
  );
  if (existingList) workbook.removeWorksheet(existingList.id);

  const cleanedBuffer = await workbook.xlsx.writeBuffer();
  const cleanedFile = new File([cleanedBuffer], workbookFile.name, {
    type: workbookFile.type || WORKBOOK_MIME_TYPE,
  });

  const generatedFile = await buildReportClient(aggregatedRows, {
    baseWorkbookFile: cleanedFile,
    targetSheetName: listSheetName,
    outputFilename: workbookFile.name,
    autoDownload: false,
    sortRows: false,
  });
  if (!generatedFile) throw new Error("Failed to build LIST sheet");
  return {
    file: generatedFile,
    aggregatedRowCount: aggregatedRows.length,
    sourceSheetCount: numericSheets.length,
  };
}

function extractRowsFromSheet(sheet: Worksheet, startRow: number): ReportRow[] {
  const rows: ReportRow[] = [];
  for (let r = startRow; r <= sheet.rowCount + 1; r++) {
    const sequenceCell = sheet.getCell(r, 1);
    if (!hasSequenceValue(sequenceCell.value)) break;
    const publishedCell = sheet.getCell(r, 2);
    const outletCell = sheet.getCell(r, 3);
    const titleCell = sheet.getCell(r, 4);
    const readershipCell = sheet.getCell(r, 5);
    const adEqCell = sheet.getCell(r, 6);
    const baseCell = sheet.getCell(r, 7);
    const { title, url } = parseTitleCell(titleCell);
    rows.push({
      published: parsePublishedValue(publishedCell.value),
      outlet: toPlainText(outletCell.value),
      title,
      readership: coerceToNumber(readershipCell.value),
      adEq: coerceToNumber(adEqCell.value),
      base: toPlainText(baseCell.value),
      url,
    });
  }
  return rows;
}

function hasSequenceValue(value: CellValue): boolean {
  if (value == null) return false;
  if (typeof value === "number") return !Number.isNaN(value);
  if (typeof value === "string") return value.trim().length > 0;
  if (value instanceof Date) return true;
  if (typeof value === "object" && "result" in (value as CellFormulaValue)) {
    return hasSequenceValue((value as CellFormulaValue).result as CellValue);
  }
  return true;
}

function toPlainText(value: CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number")
    return Number.isFinite(value) ? `${value}` : "";
  if (typeof value === "object") {
    if (
      "text" in value &&
      typeof (value as CellHyperlinkValue).text === "string"
    )
      return ((value as CellHyperlinkValue).text ?? "").trim();
    if ("richText" in value) {
      return ((value as CellRichTextValue).richText || [])
        .map((run) => run.text)
        .join("")
        .trim();
    }
    if ("result" in value)
      return toPlainText((value as CellFormulaValue).result as CellValue);
  }
  return String(value).trim();
}

function parsePublishedValue(value: CellValue): Date | string {
  if (value instanceof Date) return value;
  if (typeof value === "number" && Number.isFinite(value))
    return excelSerialToDate(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || "Not Available";
  }
  if (typeof value === "object" && value) {
    if ("result" in value)
      return parsePublishedValue(
        (value as CellFormulaValue).result as CellValue
      );
    if ("text" in value)
      return parsePublishedValue((value as CellHyperlinkValue).text ?? "");
  }
  return "Not Available";
}

function parseTitleCell(cell: Cell): { title: string; url?: string } {
  const value = cell.value;
  if (value && typeof value === "object" && "hyperlink" in value) {
    const hyperlinkValue = value as CellHyperlinkValue;
    return {
      title:
        (hyperlinkValue.text ?? "").trim() || toPlainText(cell.value) || "",
      url: hyperlinkValue.hyperlink,
    };
  }
  return {
    title: toPlainText(value),
    url: undefined,
  };
}

function coerceToNumber(value: CellValue): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const hasParens = value.includes("(") && value.includes(")");
    const normalized = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return 0;
    return hasParens ? -parsed : parsed;
  }
  if (typeof value === "object" && value && "result" in value)
    return coerceToNumber((value as CellFormulaValue).result as CellValue);
  return 0;
}

function excelSerialToDate(serial: number): Date {
  const excelEpoch = Date.UTC(1899, 11, 30);
  const msPerDay = 86400000;
  return new Date(excelEpoch + serial * msPerDay);
}
