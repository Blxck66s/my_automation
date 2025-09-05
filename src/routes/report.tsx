import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { SelectedFile } from "../lib/files/types";
import { FileDropZone } from "../components/file-upload/FileDropZone";
import { ReportGenerationForm } from "../components/report/ReportGenerationForm";

export const Route = createFileRoute("/report")({
  component: RouteComponent,
});

function RouteComponent() {
  const [reportFile, setReportFile] = useState<SelectedFile | undefined>();
  const [cisionOneDataFile, setCisionOneDataFile] = useState<
    SelectedFile | undefined
  >();
  const [prNewswireDataFile, setPrNewswireDataFile] = useState<
    SelectedFile | undefined
  >();

  return (
    <div className="container mx-auto max-w-5xl p-4 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Report Automation (Monthly)</h1>
        <h3 className="opacity-80 my-4">
          Step 1: Upload base report, Cision One CSV data, optional PRNewswire
          XLSX data.
        </h3>
      </header>
      <section className="flex flex-col gap-6 md:flex-row md:flex-wrap">
        <FileDropZone
          id="existing-report"
          label="1. Existing Report (.xlsx)"
          description="Baseline Excel workbook to update."
          accept={[
            ".xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ]}
          value={reportFile}
          onSelect={setReportFile}
        />
        <FileDropZone
          id="supplemental-xlsx"
          label="2. PRNewswire Data File (.xls/.xlsx)"
          description="Optional (may include duplicates)."
          accept={[
            ".xls",
            ".xlsx",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ]}
          value={prNewswireDataFile}
          onSelect={setPrNewswireDataFile}
        />
        <FileDropZone
          id="primary-csv"
          label="3. Cision One Data File (.csv)"
          description="Main CSV dataset to normalize & merge."
          accept={[".csv", "text/csv"]}
          required
          value={cisionOneDataFile}
          onSelect={setCisionOneDataFile}
        />
      </section>
      <section className="flex flex-col items-center border-t pt-6">
        <h3 className="opacity-80 my-4">
          Step 2 (once files are uploaded): Generate Report
        </h3>
        <ReportGenerationForm
          reportFile={reportFile}
          cisionOneDataFile={cisionOneDataFile}
          prNewswireDataFile={prNewswireDataFile}
        />
      </section>
    </div>
  );
}
