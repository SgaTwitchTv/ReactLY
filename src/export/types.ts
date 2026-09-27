import type { CapturedReaction } from "../capture/types";
import type { SourceMedia } from "../media/types";

export interface RectExportInput {
  source: SourceMedia;
  reaction: CapturedReaction;
}

export interface RectExportResult {
  uri: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
}

export type ExportProgressListener = (progress: number) => void;
