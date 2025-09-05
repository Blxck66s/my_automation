import templateUrl from "@assets/report-templete.xlsx?url";

// Load the template file as an ArrayBuffer.
export async function loadTemplateBuffer(): Promise<ArrayBuffer> {
  const url = templateUrl;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(
      `Failed to load template file : ${res.status} ${res.statusText}`
    );
  return await res.arrayBuffer();
}
