import assert from "node:assert/strict";
import test from "node:test";

import {
  creationSessionReducer,
  initialCreationSession
} from "../../src/state/creationSession.ts";

const source = {
  uri: "blob:reactly-image",
  kind: "image",
  width: 1080,
  height: 1920,
  name: "source.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 2048
};

test("moves from idle through selection to source ready", () => {
  const selecting = creationSessionReducer(initialCreationSession, {
    type: "source-selection-started"
  });
  const ready = creationSessionReducer(selecting, { type: "source-selected", source });

  assert.deepEqual(selecting, { status: "selecting-source", source: null, error: null });
  assert.deepEqual(ready, { status: "source-ready", source, error: null });
});

test("returns to idle after cancellation or clearing", () => {
  const selecting = creationSessionReducer(initialCreationSession, {
    type: "source-selection-started"
  });
  const ready = creationSessionReducer(selecting, { type: "source-selected", source });

  assert.deepEqual(
    creationSessionReducer(selecting, { type: "source-selection-cancelled" }),
    initialCreationSession
  );
  assert.deepEqual(
    creationSessionReducer(ready, { type: "source-cleared" }),
    initialCreationSession
  );
});

test("stores a recoverable source-selection error", () => {
  const failed = creationSessionReducer(initialCreationSession, {
    type: "source-selection-failed",
    message: "Unsupported source"
  });

  assert.deepEqual(failed, {
    status: "source-error",
    source: null,
    error: "Unsupported source"
  });
});
