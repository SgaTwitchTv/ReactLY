import type { RectExportResult } from "./types";

function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) {
    return "mp4";
  }

  return "webm";
}

export function rectFileName(result: RectExportResult, createdAt = new Date()): string {
  const timestamp = createdAt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .replace(/\.\d{3}Z$/, "Z");

  return `ReactLY-${timestamp}.${extensionFor(result.mimeType)}`;
}
