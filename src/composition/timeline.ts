import type { CanvasSize, CompositionLayout, Rect } from "./types";

export const SOURCE_FIRST_END_MS = 1000;
export const ROLE_SWAP_END_MS = 1650;
export const ROLE_SWAP_DURATION_MS = ROLE_SWAP_END_MS - SOURCE_FIRST_END_MS;

const CAMERA_INITIAL_WIDTH_RATIO = 0.31;
const CAMERA_ASPECT_RATIO = 3 / 4;
const SOURCE_FINAL_WIDTH_RATIO = 0.41;
const SOURCE_FINAL_ASPECT_RATIO = 16 / 9;
const EDGE_MARGIN_RATIO = 0.04;
const CAMERA_INITIAL_RADIUS_RATIO = 0.04;
const SOURCE_FINAL_RADIUS_RATIO = 0.03;

function assertCanvasSize(canvas: CanvasSize): void {
  if (
    !Number.isFinite(canvas.width) ||
    !Number.isFinite(canvas.height) ||
    canvas.width <= 0 ||
    canvas.height <= 0
  ) {
    throw new RangeError("Canvas width and height must be positive finite numbers.");
  }
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function interpolateRect(from: Rect, to: Rect, progress: number): Rect {
  return {
    x: lerp(from.x, to.x, progress),
    y: lerp(from.y, to.y, progress),
    width: lerp(from.width, to.width, progress),
    height: lerp(from.height, to.height, progress)
  };
}

function cubicEaseOut(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

function fullCanvas(canvas: CanvasSize): Rect {
  return { x: 0, y: 0, width: canvas.width, height: canvas.height };
}

function initialCameraRect(canvas: CanvasSize): Rect {
  const width = canvas.width * CAMERA_INITIAL_WIDTH_RATIO;
  const height = width / CAMERA_ASPECT_RATIO;
  const margin = canvas.width * EDGE_MARGIN_RATIO;

  return {
    x: canvas.width - width - margin,
    y: canvas.height - height - margin,
    width,
    height
  };
}

function finalSourceRect(canvas: CanvasSize): Rect {
  const width = canvas.width * SOURCE_FINAL_WIDTH_RATIO;
  const height = width / SOURCE_FINAL_ASPECT_RATIO;
  const margin = canvas.width * EDGE_MARGIN_RATIO;

  return {
    x: margin,
    y: canvas.height - height - margin,
    width,
    height
  };
}

export function layoutAt(timeMs: number, canvas: CanvasSize): CompositionLayout {
  assertCanvasSize(canvas);

  const safeTimeMs = Number.isFinite(timeMs) ? Math.max(0, timeMs) : 0;
  const sourceStart = fullCanvas(canvas);
  const cameraStart = initialCameraRect(canvas);
  const sourceEnd = finalSourceRect(canvas);
  const cameraEnd = fullCanvas(canvas);

  if (safeTimeMs < SOURCE_FIRST_END_MS) {
    return {
      sourceRect: sourceStart,
      cameraRect: cameraStart,
      sourceRadius: 0,
      cameraRadius: canvas.width * CAMERA_INITIAL_RADIUS_RATIO,
      brandOpacity: 0,
      phase: "source-first"
    };
  }

  if (safeTimeMs < ROLE_SWAP_END_MS) {
    const linearProgress = (safeTimeMs - SOURCE_FIRST_END_MS) / ROLE_SWAP_DURATION_MS;
    const progress = cubicEaseOut(linearProgress);

    return {
      sourceRect: interpolateRect(sourceStart, sourceEnd, progress),
      cameraRect: interpolateRect(cameraStart, cameraEnd, progress),
      sourceRadius: lerp(0, canvas.width * SOURCE_FINAL_RADIUS_RATIO, progress),
      cameraRadius: lerp(canvas.width * CAMERA_INITIAL_RADIUS_RATIO, 0, progress),
      brandOpacity: progress,
      phase: "role-swap"
    };
  }

  return {
    sourceRect: sourceEnd,
    cameraRect: cameraEnd,
    sourceRadius: canvas.width * SOURCE_FINAL_RADIUS_RATIO,
    cameraRadius: 0,
    brandOpacity: 1,
    phase: "reaction-first"
  };
}
