import { layerOrderAt } from "../composition/layerOrder.ts";
import { layoutAt } from "../composition/timeline.ts";
import type {
  NativeRectExportFrame,
  NativeRectExportPlan
} from "../../modules/reactly-compositor/src/ReactLYCompositor.types";
import type { RectExportInput } from "./types";

export const NATIVE_EXPORT_WIDTH = 720;
export const NATIVE_EXPORT_HEIGHT = 1280;
export const NATIVE_EXPORT_FPS = 30;

function frameAt(timeMs: number): NativeRectExportFrame {
  const layout = layoutAt(timeMs, {
    width: NATIVE_EXPORT_WIDTH,
    height: NATIVE_EXPORT_HEIGHT
  });
  const order = layerOrderAt(timeMs);

  return {
    timeMs,
    sourceRect: layout.sourceRect,
    reactionRect: layout.cameraRect,
    sourceRadius: layout.sourceRadius,
    reactionRadius: layout.cameraRadius,
    brandOpacity: layout.brandOpacity,
    foreground: order[1]
  };
}

export function createNativeExportPlan(input: RectExportInput): NativeRectExportPlan {
  const durationMs = Math.max(1, Math.round(input.reaction.durationMs));
  const frameCount = Math.max(1, Math.ceil((durationMs * NATIVE_EXPORT_FPS) / 1000));
  const frames = Array.from({ length: frameCount }, (_, index) =>
    frameAt((index * 1000) / NATIVE_EXPORT_FPS)
  );

  return {
    version: 1,
    width: NATIVE_EXPORT_WIDTH,
    height: NATIVE_EXPORT_HEIGHT,
    fps: NATIVE_EXPORT_FPS,
    durationMs,
    source: {
      uri: input.source.uri,
      kind: input.source.kind,
      width: input.source.width,
      height: input.source.height,
      loop: input.source.kind === "video"
    },
    reaction: {
      uri: input.reaction.uri,
      mirrored: true,
      includeAudio: true
    },
    brand: {
      backgroundColor: "#070707",
      accentColor: "#C7FF35",
      watermark: "ReactLY",
      tagline: "DON'T COMMENT. REACT."
    },
    frames
  };
}
