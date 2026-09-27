import type { SourceMedia, SourceValidationIssue, SourceValidationResult } from "./types";

const SUPPORTED_MIME_PREFIXES = ["image/", "video/"] as const;

export function sourceKindFromMimeType(mimeType: string): SourceMedia["kind"] | null {
  if (mimeType.startsWith(SUPPORTED_MIME_PREFIXES[0])) {
    return "image";
  }

  if (mimeType.startsWith(SUPPORTED_MIME_PREFIXES[1])) {
    return "video";
  }

  return null;
}

export function validateSourceMedia(source: SourceMedia): SourceValidationResult {
  const issues: SourceValidationIssue[] = [];

  if (!sourceKindFromMimeType(source.mimeType) || sourceKindFromMimeType(source.mimeType) !== source.kind) {
    issues.push("unsupported-type");
  }

  if (source.uri.trim().length === 0) {
    issues.push("missing-uri");
  }

  if (
    !Number.isFinite(source.width) ||
    !Number.isFinite(source.height) ||
    source.width <= 0 ||
    source.height <= 0
  ) {
    issues.push("invalid-dimensions");
  }

  if (!Number.isFinite(source.sizeBytes) || source.sizeBytes <= 0) {
    issues.push("empty-file");
  }

  if (
    source.kind === "video" &&
    (source.durationMs === undefined || !Number.isFinite(source.durationMs) || source.durationMs <= 0)
  ) {
    issues.push("invalid-duration");
  }

  return { valid: issues.length === 0, issues };
}
