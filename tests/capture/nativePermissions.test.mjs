import assert from "node:assert/strict";
import test from "node:test";

import {
  createNativeCapturePreview,
  nativePermissionFailure
} from "../../src/capture/nativeCapture.ts";

test("accepts native capture only when camera and microphone are granted", () => {
  assert.equal(nativePermissionFailure(true, true), null);
});

test("describes the individual missing native permission", () => {
  assert.deepEqual(nativePermissionFailure(false, true), {
    code: "permission-denied",
    message: "ReactLY needs camera permission to record your reaction."
  });
  assert.deepEqual(nativePermissionFailure(true, false), {
    code: "permission-denied",
    message: "ReactLY needs microphone permission to record your reaction."
  });
});

test("describes both missing native permissions", () => {
  assert.deepEqual(nativePermissionFailure(false, false), {
    code: "permission-denied",
    message: "ReactLY needs camera and microphone permission to record your reaction."
  });
});

test("controls the native camera reference lifecycle", () => {
  const preview = createNativeCapturePreview();
  const camera = { pausePreview: async () => undefined };

  preview.markReady();
  assert.equal(preview.isReady(), false);
  preview.attachCamera(camera);
  preview.markReady();
  assert.equal(preview.getCamera(), camera);
  assert.equal(preview.isReady(), true);

  preview.deactivate();
  assert.equal(preview.isActive(), false);
  assert.equal(preview.isReady(), false);
  assert.equal(preview.getCamera(), null);
  preview.attachCamera(camera);
  assert.equal(preview.getCamera(), null);
});
