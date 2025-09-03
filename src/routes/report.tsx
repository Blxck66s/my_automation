import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { SelectedFile } from "../lib/files/types";
import { FileDropZone } from "../components/file-upload/FileDropZone";
import { DownloadReportButton } from "../components/report/DownloadReportButton";

export const Route = createFileRoute("/report")({
  component: RouteComponent,
});

function RouteComponent() {
  const [reportFile, setReportFile] = useState<SelectedFile | undefined>();
  const [primaryDataFile, setPrimaryDataFile] = useState<
    SelectedFile | undefined
  >();
  const [supplementalFile, setSupplementalFile] = useState<
    SelectedFile | undefined
  >();

  const ready = !!(reportFile && primaryDataFile);

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
          description="Baseline Excel workbook to append/enrich."
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
          label="2. Cision One Data (.csv)"
          description="Main CSV dataset to normalize & merge."
          accept={[".csv", "text/csv"]}
          required
          value={primaryDataFile}
          onSelect={setPrimaryDataFile}
        />
        <FileDropZone
          id="supplemental-xlsx"
          label="3. Supplemental Source (.xlsx)"
          description="Optional extra workbook (may include duplicates)."
          accept={[
            ".xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ]}
          value={supplementalFile}
          onSelect={setSupplementalFile}
        />
      </section>
      <section className="card border bg-base-100">
        <div className="card-body gap-4">
          <h2 className="card-title">Next Step (Pending)</h2>
          <ul className="list-disc pl-5 text-sm opacity-80 space-y-1">
            <li>Merge + dedupe (including supplemental)</li>
            <li>Export updated report (.xlsx)</li>
          </ul>
          <div>
            <DownloadReportButton
              isDisabled={!ready}
              dataFile={primaryDataFile}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
