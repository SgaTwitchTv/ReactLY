export interface CanvasSize {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CompositionPhase = "source-first" | "role-swap" | "reaction-first";

export interface CompositionLayout {
  sourceRect: Rect;
  cameraRect: Rect;
  sourceRadius: number;
  cameraRadius: number;
  brandOpacity: number;
  phase: CompositionPhase;
}
