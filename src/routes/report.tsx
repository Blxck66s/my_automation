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
        <h1 className="text-2xl font-bold">Automation Workspace</h1>
        <p className="text-sm opacity-80">
          Step 1: Upload base report, Cision One CSV data, optional PRNewswire
          XLSX data.
          <br />
          Step 2 (mapping, formatting, dedupe) coming soon.
        </p>
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
          required
          value={reportFile}
          onSelect={setReportFile}
        />
        <FileDropZone
          id="primary-csv"
          label="2. Cision One Data File (.csv)"
          description="Main CSV dataset to normalize & merge."
          accept={[".csv", "text/csv"]}
          required
          value={cisionOneDataFile}
          onSelect={setCisionOneDataFile}
        />
        <FileDropZone
          id="supplemental-xlsx"
          label="3. PRNewswire Data File (.xls/.xlsx)"
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
      </section>
      <section className="flex flex-col items-center border-t pt-6">
        <ReportGenerationForm
          reportFile={reportFile}
          cisionOneDataFile={cisionOneDataFile}
          prNewswireDataFile={prNewswireDataFile}
        />
      </section>
    </div>
  );
}
