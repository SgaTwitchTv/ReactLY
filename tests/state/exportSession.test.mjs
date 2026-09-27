import assert from "node:assert/strict";
import test from "node:test";

import {
  exportSessionReducer,
  initialExportSession
} from "../../src/state/exportSession.ts";

const result = {
  uri: "blob:reactly-export",
  mimeType: "video/webm",
  sizeBytes: 8192,
  durationMs: 2500,
  width: 720,
  height: 1280,
  fps: 30
};

test("tracks clamped export progress and completion", () => {
  const exporting = exportSessionReducer(initialExportSession, { type: "export-started" });
  const progressed = exportSessionReducer(exporting, {
    type: "export-progressed",
    progress: 1.5
  });
  const ready = exportSessionReducer(progressed, { type: "export-finished", result });

  assert.deepEqual(exporting, { status: "exporting", progress: 0, result: null, error: null });
  assert.deepEqual(progressed, { status: "exporting", progress: 1, result: null, error: null });
  assert.deepEqual(ready, { status: "ready", progress: 1, result, error: null });
});

test("ignores progress when no export is active", () => {
  assert.equal(
    exportSessionReducer(initialExportSession, { type: "export-progressed", progress: 0.5 }),
    initialExportSession
  );
});

test("stores export failures and resets for retry", () => {
  const failed = exportSessionReducer(initialExportSession, {
    type: "export-failed",
    message: "Encoding failed"
  });

  assert.deepEqual(failed, {
    status: "error",
    progress: 0,
    result: null,
    error: "Encoding failed"
  });
  assert.equal(
    exportSessionReducer(failed, { type: "export-reset" }),
    initialExportSession
  );
});
