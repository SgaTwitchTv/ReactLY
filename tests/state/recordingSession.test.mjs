import assert from "node:assert/strict";
import test from "node:test";

import {
  initialRecordingSession,
  recordingSessionReducer
} from "../../src/state/recordingSession.ts";

const active = { nativeHandle: { recorder: true }, startedAtMs: 1000 };
const reaction = {
  uri: "blob:reactly-reaction",
  mimeType: "video/webm",
  sizeBytes: 4096,
  durationMs: 2500
};

test("moves through recording, stopping, and captured states", () => {
  const recording = recordingSessionReducer(initialRecordingSession, {
    type: "recording-started",
    active
  });
  const stopping = recordingSessionReducer(recording, {
    type: "recording-stop-requested"
  });
  const captured = recordingSessionReducer(stopping, {
    type: "recording-captured",
    reaction
  });

  assert.deepEqual(recording, { status: "recording", active, reaction: null, error: null });
  assert.deepEqual(stopping, { status: "stopping", active, reaction: null, error: null });
  assert.deepEqual(captured, {
    status: "captured",
    active: null,
    reaction,
    error: null
  });
});

test("ignores stop requests outside an active recording", () => {
  assert.equal(
    recordingSessionReducer(initialRecordingSession, { type: "recording-stop-requested" }),
    initialRecordingSession
  );
});

test("stores recording errors without retaining resources", () => {
  const failed = recordingSessionReducer(initialRecordingSession, {
    type: "recording-failed",
    message: "Recorder failed"
  });

  assert.deepEqual(failed, {
    status: "error",
    active: null,
    reaction: null,
    error: "Recorder failed"
  });
});

test("resets captured output before re-recording", () => {
  const captured = recordingSessionReducer(initialRecordingSession, {
    type: "recording-captured",
    reaction
  });

  assert.equal(
    recordingSessionReducer(captured, { type: "recording-reset" }),
    initialRecordingSession
  );
});
