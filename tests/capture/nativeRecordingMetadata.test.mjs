import assert from "node:assert/strict";
import test from "node:test";

import { nativeRecordingMimeType } from "../../src/capture/nativeRecordingMetadata.ts";

test("recognizes explicit native recording extensions", () => {
  assert.equal(nativeRecordingMimeType("file:///cache/reaction.mov", "ios"), "video/quicktime");
  assert.equal(nativeRecordingMimeType("file:///cache/reaction.webm?local=1", "android"), "video/webm");
  assert.equal(nativeRecordingMimeType("file:///cache/reaction.mp4", "android"), "video/mp4");
});

test("uses platform recording defaults when the cache URI has no extension", () => {
  assert.equal(nativeRecordingMimeType("file:///cache/reaction", "ios"), "video/quicktime");
  assert.equal(nativeRecordingMimeType("file:///cache/reaction", "android"), "video/mp4");
});
