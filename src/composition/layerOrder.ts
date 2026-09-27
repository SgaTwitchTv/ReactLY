export type CompositionLayer = "source" | "reaction";

export const LAYER_HANDOFF_MS = 1325;

export function layerOrderAt(timeMs: number): readonly [CompositionLayer, CompositionLayer] {
  return timeMs < LAYER_HANDOFF_MS
    ? ["source", "reaction"]
    : ["reaction", "source"];
}
