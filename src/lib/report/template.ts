/**
 * Fetch the Excel template from the public directory.
 * Default filename: report-template.xlsx
 * Returns an ArrayBuffer (throws with descriptive error if invalid).
 */
import templateUrl from "../../assets/report-templete.xlsx?url";

export async function loadTemplateBuffer(): Promise<ArrayBuffer> {
  const url = templateUrl;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to load template file : ${res.status} ${res.statusText}`
    );
  }
  return await res.arrayBuffer();
}
