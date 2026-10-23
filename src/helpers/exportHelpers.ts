/**
 * Data Export & File Download Helper Functions
 */

/**
 * Trigger immediate browser download of an in-memory string or binary as a file
 */
export function downloadFile(
  content: string | Uint8Array,
  filename: string,
  mimeType: string = "text/plain;charset=utf-8;",
): void {
  const blob = new Blob([content as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert an array of objects to a CSV string and trigger download
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; header: string }[],
): void {
  if (data.length === 0) return;

  const cols =
    columns ||
    (Object.keys(data[0]) as (keyof T)[]).map((k) => ({
      key: k,
      header: String(k),
    }));

  const escapeCSV = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerRow = cols.map((c) => escapeCSV(c.header)).join(",");
  const dataRows = data.map((item) =>
    cols.map((c) => escapeCSV(item[c.key])).join(","),
  );

  const csvContent = [headerRow, ...dataRows].join("\n");
  downloadFile(
    csvContent,
    filename.endsWith(".csv") ? filename : `${filename}.csv`,
    "text/csv;charset=utf-8;",
  );
}

/**
 * Export data array or object as JSON file
 */
export function exportToJSON(data: unknown, filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(
    jsonContent,
    filename.endsWith(".json") ? filename : `${filename}.json`,
    "application/json;charset=utf-8;",
  );
}
