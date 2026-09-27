export interface NativeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NativeRectExportFrame {
  timeMs: number;
  sourceRect: NativeRect;
  reactionRect: NativeRect;
  sourceRadius: number;
  reactionRadius: number;
  brandOpacity: number;
  foreground: "source" | "reaction";
}

export interface NativeRectExportPlan {
  version: 1;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  source: {
    uri: string;
    kind: "image" | "video";
    width: number;
    height: number;
    loop: boolean;
  };
  reaction: {
    uri: string;
    mirrored: boolean;
    includeAudio: boolean;
  };
  brand: {
    backgroundColor: string;
    accentColor: string;
    watermark: string;
    tagline: string;
  };
  frames: NativeRectExportFrame[];
}

export interface NativeRectExportOutput {
  uri: string;
  mimeType: string;
  sizeBytes: number;
}
