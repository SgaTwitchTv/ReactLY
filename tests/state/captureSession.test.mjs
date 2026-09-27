import assert from "node:assert/strict";
import test from "node:test";

import {
  captureSessionReducer,
  initialCaptureSession
} from "../../src/state/captureSession.ts";

const preparedCapture = {
  preview: { testStream: true },
  hasCamera: true,
  hasMicrophone: true
};

test("moves from idle through permission request to ready", () => {
  const requesting = captureSessionReducer(initialCaptureSession, {
    type: "permission-requested"
  });
  const ready = captureSessionReducer(requesting, {
    type: "capture-prepared",
    capture: preparedCapture
  });

  assert.deepEqual(requesting, {
    status: "requesting-permission",
    capture: null,
    error: null
  });
  assert.deepEqual(ready, {
    status: "ready",
    capture: preparedCapture,
    error: null
  });
});

test("stores preparation errors without a media handle", () => {
  const failed = captureSessionReducer(initialCaptureSession, {
    type: "capture-failed",
    message: "Permission denied"
  });

  assert.deepEqual(failed, {
    status: "error",
    capture: null,
    error: "Permission denied"
  });
});

test("returns to idle when capture is stopped", () => {
  const ready = captureSessionReducer(initialCaptureSession, {
    type: "capture-prepared",
    capture: preparedCapture
  });

  assert.deepEqual(
    captureSessionReducer(ready, { type: "capture-stopped" }),
    initialCaptureSession
  );
});
