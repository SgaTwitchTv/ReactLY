export interface PreparedCapture {
  preview: unknown;
  hasCamera: boolean;
  hasMicrophone: boolean;
}

export interface ActiveRecording {
  nativeHandle: unknown;
  startedAtMs: number;
}

export interface CapturedReaction {
  uri: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
}

export type CaptureErrorCode =
  | "permission-denied"
  | "unavailable"
  | "missing-track"
  | "recording-failed"
  | "unknown";

export interface CaptureFailure {
  code: CaptureErrorCode;
  message: string;
}
