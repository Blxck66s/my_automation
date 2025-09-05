import { buildReportClient } from "../../lib/report/excel/buildReport";
import type { SelectedFile } from "../../lib/files/types";
import { extractCisionOneFile } from "../../lib/report/sources/cisionOne.extractor";

export const DownloadReportButton = ({
  isDisabled = false,
  dataFile,
}: {
  isDisabled?: boolean;
  dataFile: SelectedFile | undefined;
}) => {
  const handleClick = async () => {
    if (!dataFile) return;

    const { rows } = await extractCisionOneFile(dataFile.file);
    await buildReportClient(rows);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="btn btn-primary rounded-md"
      disabled={isDisabled}
    >
      Download Excel
    </button>
  );
};
