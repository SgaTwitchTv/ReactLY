import assert from "node:assert/strict";
import test from "node:test";

import {
  createNativeExportPlan,
  NATIVE_EXPORT_FPS,
  NATIVE_EXPORT_HEIGHT,
  NATIVE_EXPORT_WIDTH
} from "../../src/export/nativePlan.ts";

const input = {
  source: {
    uri: "file:///source.jpg",
    kind: "image",
    width: 1080,
    height: 1920,
    name: "source.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1000
  },
  reaction: {
    uri: "file:///reaction.mp4",
    mimeType: "video/mp4",
    sizeBytes: 2000,
    durationMs: 2000
  }
};

test("builds a deterministic 9:16 native frame plan", () => {
  const plan = createNativeExportPlan(input);

  assert.equal(plan.width, NATIVE_EXPORT_WIDTH);
  assert.equal(plan.height, NATIVE_EXPORT_HEIGHT);
  assert.equal(plan.fps, NATIVE_EXPORT_FPS);
  assert.equal(plan.frames.length, 60);
  assert.equal(plan.reaction.includeAudio, true);
  assert.equal(plan.reaction.mirrored, true);
  assert.equal(plan.source.loop, false);
  assert.deepEqual(plan.brand, {
    backgroundColor: "#070707",
    accentColor: "#C7FF35",
    watermark: "ReactLY",
    tagline: "DON'T COMMENT. REACT."
  });
});

test("carries the canonical phase and layer handoff into native frames", () => {
  const plan = createNativeExportPlan(input);
  const atZero = plan.frames[0];
  const atOneSecond = plan.frames[30];
  const afterHandoff = plan.frames[40];
  const reactionFirst = plan.frames[50];

  assert.equal(atZero?.foreground, "reaction");
  assert.equal(atZero?.brandOpacity, 0);
  assert.ok((atZero?.reactionRadius ?? 0) > 0);
  assert.deepEqual(atZero?.sourceRect, { x: 0, y: 0, width: 720, height: 1280 });
  assert.equal(atOneSecond?.timeMs, 1000);
  assert.equal(atOneSecond?.brandOpacity, 0);
  assert.ok((afterHandoff?.brandOpacity ?? 0) > 0);
  assert.equal(afterHandoff?.foreground, "source");
  assert.equal(reactionFirst?.reactionRect.width, 720);
  assert.equal(reactionFirst?.reactionRadius, 0);
  assert.ok((reactionFirst?.sourceRadius ?? 0) > 0);
});

test("loops video sources but never loops the reaction", () => {
  const plan = createNativeExportPlan({
    ...input,
    source: { ...input.source, kind: "video", mimeType: "video/mp4", durationMs: 500 }
  });

  assert.equal(plan.source.loop, true);
  assert.equal("loop" in plan.reaction, false);
});
