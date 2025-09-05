import type { Worksheet, CellValue } from "exceljs";

export interface ColumnFitOptions {
  min?: number;
  max?: number;
  pad?: number;
  perColumn?: Record<number, { min?: number; max?: number; pad?: number }>;
}

/**
 * Auto fit given columns (shrinks or expands) based on visible text length.
 * Improves handling for:
 *  - Excel date serial numbers with a numFmt (estimates formatted length)
 *  - Hyperlink / richText objects
 *  - Placeholder strings like "Not Available"
 */
export function autoFitColumns(
  ws: Worksheet,
  cols: number[],
  { min = 8, max = 60, pad = 2, perColumn }: ColumnFitOptions = {}
) {
  cols.forEach((colIdx) => {
    const col = ws.getColumn(colIdx);
    const overrides = perColumn?.[colIdx] ?? {};
    const effMin = overrides.min ?? min;
    const effMax = overrides.max ?? max;
    const effPad = overrides.pad ?? pad;

    let width = effMin;

    col.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value as CellValue;
      let text = "";

      if (v == null) {
        // empty
      } else if (typeof v === "number") {
        const fmt = cell.numFmt || "";
        // Simple heuristic for date-like number formats (Excel style)
        if (/(^|[^A-Za-z])d{1,2}[-/ ]MMM([- /]yy)?/i.test(fmt)) {
          // dd-MMM-yy representative placeholder (length 9)
          text = "00-XXX-00";
        } else {
          text = v.toString();
        }
      } else if (v instanceof Date) {
        text = v.toISOString().slice(0, 10); // YYYY-MM-DD
      } else if (typeof v === "string") {
        text = v;
      } else if (typeof v === "object") {
        if ("text" in v && v.text != null) text = String(v.text);
        else if ("richText" in v && Array.isArray(v.richText)) {
          text = v.richText.map((r: { text: string }) => r.text).join("");
        } else if ("result" in v && v.result != null) {
          text = String(v.result);
        } else if ("formula" in v && v.formula) {
          text = String(v.formula);
        }
      } else {
        text = String(v);
      }

      // If multi-line, consider longest line
      if (text.includes("\n")) {
        text = text
          .split("\n")
          .reduce(
            (longest, line) => (line.length > longest.length ? line : longest),
            ""
          );
      }

      if (/^not available$/i.test(text)) {
        // keep length as-is (could map to 'N/A' if narrower needed)
      }

      width = Math.max(width, text.length + effPad);
    });

    width = Math.min(Math.max(width, effMin), effMax);
    col.width = width;
  });
}
