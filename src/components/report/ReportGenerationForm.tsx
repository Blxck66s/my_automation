import { useEffect, useMemo, useState } from "react";
import { saveAs } from "file-saver";
import type { SelectedFile } from "../../lib/files/types";
import { extractCisionOneFile } from "../../lib/report/sources/cisionOne.extractor";
import type { BuildStyleWarnings, ReportRow } from "../../lib/report/types";
import { buildReportClient } from "../../lib/report/excel/buildReport";
import { extractPrnFile } from "../../lib/report/sources/prNewswire.extractor";
import { mergeCisionAndPrn } from "../../lib/report/merge/mergeReports";
import {
  deriveHeadlineFromCisionFilename,
  deriveSuggestedSheetName,
} from "../../lib/report/utils/extractorTools";

interface ReportGenerationFormProps {
  reportFile?: SelectedFile;
  cisionOneDataFile?: SelectedFile;
  prNewswireDataFile?: SelectedFile;
  onReportFileReplace?: (file: SelectedFile) => void;
  onResetSourceFiles?: () => void;
}

export function ReportGenerationForm({
  reportFile,
  cisionOneDataFile,
  prNewswireDataFile,
  onReportFileReplace,
  onResetSourceFiles,
}: ReportGenerationFormProps) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [issues, setIssues] = useState<{ row: number; message: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [styleWarnings, setStyleWarnings] = useState<
    BuildStyleWarnings | undefined
  >(undefined);
  const [prnHeadline, setPrnHeadline] = useState<string | undefined>();
  const [cisionHeadline, setCisionHeadline] = useState<string | undefined>();
  const [generatedReport, setGeneratedReport] = useState<File | null>(null);

  // Form state
  const [ignoreExistingWorkbook, setIgnoreExistingWorkbook] = useState(false);
  const [targetSheetName, setTargetSheetName] = useState("");
  const [outputFileName, setOutputFileName] = useState("report");

  // Track user override for output file name
  const outputNameChangedRef = useMemo(() => ({ current: false }), []);

  // Unified parsing + merge
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setStyleWarnings(undefined);
      if (cisionOneDataFile) setGeneratedReport(null);
      if (!cisionOneDataFile) {
        setRows([]);
        setIssues([]);
        setCisionHeadline(undefined);
        return;
      }
      setLoading(true);
      try {
        const cisionRes = await extractCisionOneFile(cisionOneDataFile.file);
        if (cancelled) return;

        let mergedRows = cisionRes.rows.slice();
        const mergedIssues = cisionRes.issues
          .slice()
          .sort((a, b) => a.row - b.row)
          .map((i) => ({ row: i.row, message: i.message }));
        let mergedStyles: BuildStyleWarnings | undefined;

        if (prNewswireDataFile) {
          try {
            const prnRes = await extractPrnFile(prNewswireDataFile.file);
            if (cancelled) return;
            const { rows: prnRows, invalidDateUrls, headlineB1 } = prnRes;
            setPrnHeadline(headlineB1);
            const { rows: finalRows, styleWarnings: sw } = mergeCisionAndPrn(
              cisionRes.rows,
              prnRows,
              invalidDateUrls
            );
            mergedRows = finalRows;
            mergedStyles = sw;
          } catch (e) {
            mergedIssues.push({
              row: 0,
              message: `PRNewswire parse failed: ${(e as Error).message}`,
            });
          }
        } else {
          setPrnHeadline(undefined); // reset if PRN removed
        }

        setRows(mergedRows);
        setStyleWarnings(mergedStyles);
        setCisionHeadline(
          deriveHeadlineFromCisionFilename(cisionOneDataFile.name)
        );
        const suggestion = deriveSuggestedSheetName(cisionOneDataFile.name);
        setTargetSheetName((prev) => (prev ? prev : suggestion));
        setIssues(mergedIssues);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [cisionOneDataFile, prNewswireDataFile]);

  // Default output file name from existing report (if provided & not overridden)
  useEffect(() => {
    if (reportFile && !outputNameChangedRef.current) {
      const base = reportFile.name.replace(/\.xlsx$/i, "");
      setOutputFileName(base || "report");
    }
  }, [reportFile, outputNameChangedRef]);

  const canGenerate =
    rows.length > 0 && !!outputFileName.trim() && !!targetSheetName.trim();
  const canDownload = !!generatedReport;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    // derive numeric prefix from sheet suggestion (digits only)
    const numPrefixMatch = cisionOneDataFile?.name.match(/(\d{1,4})/);
    const numberPrefix = numPrefixMatch ? numPrefixMatch[1] : undefined;
    // Ensure output filename ends with .xlsx
    const outputFileNameTrimmed = outputFileName.trim().endsWith(".xlsx")
      ? outputFileName.trim()
      : `${outputFileName.trim()}.xlsx`;

    try {
      const generatedFile = await buildReportClient(rows, {
        baseWorkbookFile:
          ignoreExistingWorkbook || !reportFile ? undefined : reportFile.file,
        targetSheetName: targetSheetName.trim(),
        outputFilename: outputFileNameTrimmed,
        styleWarnings,
        numberPrefix,
        headlineFromPrn: prnHeadline,
        headlineFromCisionFile: cisionHeadline,
        autoDownload: false,
      });
      if (!generatedFile) return;

      setGeneratedReport(generatedFile);
      const replacement: SelectedFile = {
        file: generatedFile,
        name: generatedFile.name,
        size: generatedFile.size,
        lastModified: generatedFile.lastModified,
        type: generatedFile.type,
      } as SelectedFile;
      onReportFileReplace?.(replacement);
      onResetSourceFiles?.();

      setRows([]);
      setIssues([]);
      setStyleWarnings(undefined);
      setPrnHeadline(undefined);
      setCisionHeadline(undefined);
      setIgnoreExistingWorkbook(false);
      setTargetSheetName("");
      setOutputFileName("report");
      outputNameChangedRef.current = false;
    } catch (error) {
      console.error("Report generation failed:", error);
    }
  };
  const handleDownload = () => {
    if (!generatedReport) return;
    saveAs(generatedReport, generatedReport.name);
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
              disabled={!canGenerate || loading}
            >
              Generate Excel
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!canDownload}
              onClick={handleDownload}
            >
              Download Excel
            </button>
            {!canGenerate && !generatedReport && (
              <span className="text-xs text-warning">
                Provide CSV data and sheet/output names.
              </span>
            )}
            {generatedReport && (
              <span className="text-xs text-success">
                Report ready. Click Download.
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
