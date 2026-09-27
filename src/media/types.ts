export type SourceKind = "image" | "video";

export interface SourceMedia {
  uri: string;
  kind: SourceKind;
  width: number;
  height: number;
  name: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
}

export type SourceValidationIssue =
  | "unsupported-type"
  | "missing-uri"
  | "invalid-dimensions"
  | "invalid-duration"
  | "empty-file";

export interface SourceValidationResult {
  valid: boolean;
  issues: SourceValidationIssue[];
}

export type SourcePickerResult =
  | { status: "selected"; source: SourceMedia }
  | { status: "cancelled" };
