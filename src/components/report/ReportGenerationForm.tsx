import { useEffect, useMemo, useState } from "react";
import type { SelectedFile } from "../../lib/files/types";
import { extractCisionOneFile } from "../../lib/report/cisionOneExtractor";
import type { ReportRow } from "../../lib/report/types";
import { buildReportClient } from "../../lib/report/buildReport";

interface ReportGenerationFormProps {
  reportFile?: SelectedFile;
  cisionOneDataFile?: SelectedFile;
}

/**
 * Derive sheet name from first numeric prefix in CSV file name (NN_ / NN- / NN ).
 */
function deriveSuggestedSheetName(fileName: string): string {
  const m = fileName.match(/(^|\D)(\d{1,4})[_\-\s]/);
  if (m && m[2]) return m[2];
  return "Report";
}

export function ReportGenerationForm({
  reportFile,
  cisionOneDataFile,
}: ReportGenerationFormProps) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [issues, setIssues] = useState<{ row: number; message: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [ignoreExistingWorkbook, setIgnoreExistingWorkbook] = useState(false);
  const [targetSheetName, setTargetSheetName] = useState("");
  const [outputFileName, setOutputFileName] = useState("report");

  // Track user override for output file name
  const outputNameChangedRef = useMemo(() => ({ current: false }), []);

  // Parse CSV
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!cisionOneDataFile) {
        setRows([]);
        setIssues([]);
        return;
      }
      setLoading(true);
      try {
        const res = await extractCisionOneFile(cisionOneDataFile.file);
        if (cancelled) return;
        setRows(res.rows);
        const suggestion = deriveSuggestedSheetName(cisionOneDataFile.name);
        setTargetSheetName((prev) => (prev ? prev : suggestion));
        setIssues(
          res.issues
            .slice()
            .sort((a, b) => a.row - b.row)
            .map((i) => ({ row: i.row, message: i.message }))
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [cisionOneDataFile]);

  // Default output file name from existing report (if provided & not overridden)
  useEffect(() => {
    if (reportFile && !outputNameChangedRef.current) {
      const base = reportFile.name.replace(/\.xlsx$/i, "");
      setOutputFileName(base || "report");
    }
  }, [reportFile]);

  const canGenerate =
    rows.length > 0 && !!outputFileName.trim() && !!targetSheetName.trim();

  const handleGenerate = async () => {
    if (!canGenerate) return;
    await buildReportClient(rows, {
      baseWorkbookFile:
        ignoreExistingWorkbook || !reportFile ? undefined : reportFile.file,
      targetSheetName: targetSheetName.trim(),
      outputFilename: outputFileName.trim() + ".xlsx",
    });
  };
  return (
    <div className="card shadow-md bg-base-200 w-fit">
      <div className="card-body gap-6">
        <h2 className="card-title">Generate Report</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleGenerate();
          }}
          className="space-y-6"
        >
          <div className="flex flex-wrap justify-center gap-10">
            <fieldset className="fieldset basis-full ">
              <legend className="fieldset-legend text-sm font-semibold">
                Data Source
              </legend>
              <div className="text-xs opacity-70">
                {loading && "Parsing CSV..."}
                {!loading && rows.length === 0 && "No rows parsed yet."}
                {!loading && rows.length > 0 && (
                  <span>
                    Parsed {rows.length} rows{" "}
                    {issues.length > 0 && (
                      <span className="text-warning">
                        • {issues.length} issue(s)
                      </span>
                    )}
                  </span>
                )}
              </div>
              {issues.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs link">
                    View issues
                  </summary>
                  <ul className="mt-2 space-y-1 max-h-40 overflow-auto text-xs">
                    {issues.slice(0, 50).map((i, idx) => (
                      <li
                        key={idx}
                        className="rounded bg-base-200 px-2 py-1 leading-tight"
                      >
                        Row {i.row}: {i.message}
                      </li>
                    ))}
                    {issues.length > 50 && (
                      <li className="text-warning">
                        + {issues.length - 50} more...
                      </li>
                    )}
                  </ul>
                </details>
              )}
            </fieldset>

            <fieldset className="fieldset flex-[calc(50%-2.5rem)]">
              <legend className="fieldset-legend text-sm font-semibold mb-2">
                Report Workbook
              </legend>

              <label className="label text-xs">
                New sheet name{" "}
                <span className="opacity-60">(derived from CSV)</span>
              </label>
              <input
                type="text"
                className="input input-sm input-bordered"
                value={targetSheetName}
                maxLength={31}
                onChange={(e) => setTargetSheetName(e.target.value)}
                placeholder="Sheet name"
              />
              <label className="label cursor-pointer flex items-center gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={ignoreExistingWorkbook || !reportFile}
                  onChange={(e) => setIgnoreExistingWorkbook(e.target.checked)}
                  disabled={!reportFile}
                />
                <span className="text-xs">
                  {reportFile
                    ? "Ignore uploaded workbook (create new)"
                    : "No existing workbook (will create new)"}
                </span>
              </label>
            </fieldset>

            <fieldset className="fieldset flex-[calc(50%-2.5rem)]">
              <legend className="fieldset-legend text-sm font-semibold mb-2">
                Output
              </legend>
              <label className="label text-xs">
                Output filename (no extension)
              </label>
              <input
                type="text"
                className="input input-sm input-bordered "
                value={outputFileName}
                onChange={(e) => {
                  outputNameChangedRef.current = true;
                  setOutputFileName(e.target.value);
                }}
                placeholder="report"
              />
            </fieldset>
          </div>

          <div className="flex items-center justify-center gap-4">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canGenerate}
            >
              Generate Excel
            </button>
            {!canGenerate && (
              <span className="text-xs text-warning">
                Provide CSV data and sheet/output names.
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
