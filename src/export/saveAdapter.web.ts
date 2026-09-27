import { RectExportError } from "./errors";
import { rectFileName } from "./saveFileName";
import type { RectExportResult } from "./types";

export async function saveRect(result: RectExportResult): Promise<string> {
  if (typeof document === "undefined") {
    throw new RectExportError("ReactLY cannot start a download in this environment.");
  }

  const fileName = rectFileName(result);
  const link = document.createElement("a");
  link.href = result.uri;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);

  try {
    link.click();
  } finally {
    link.remove();
  }

  return fileName;
}

export async function shareRect(_result: RectExportResult): Promise<void> {
  throw new RectExportError("Use Download Video to save this Rect in your browser.");
}
