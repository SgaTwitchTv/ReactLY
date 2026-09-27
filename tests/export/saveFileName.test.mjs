import assert from "node:assert/strict";
import test from "node:test";

import { rectFileName } from "../../src/export/saveFileName.ts";

const baseResult = {
  uri: "blob:reactly-test",
  mimeType: "video/webm;codecs=vp9,opus",
  sizeBytes: 1024,
  durationMs: 2000,
  width: 720,
  height: 1280,
  fps: 30
};

test("builds a filesystem-safe UTC filename for WebM exports", () => {
  assert.equal(
    rectFileName(baseResult, new Date("2026-07-27T14:32:05.123Z")),
    "ReactLY-20260727-143205Z.webm"
  );
});

test("uses an MP4 extension when a future exporter returns MP4", () => {
  assert.equal(
    rectFileName(
      { ...baseResult, mimeType: "video/mp4" },
      new Date("2026-01-02T03:04:05.000Z")
    ),
    "ReactLY-20260102-030405Z.mp4"
  );
});
