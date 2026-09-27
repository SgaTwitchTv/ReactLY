import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Execute the real adapter with camera/filesystem boundaries replaced by fakes.
function setup() {
  const uri = "file:///cache/reaction.mp4";
  const files = new Set([uri]);
  let complete;
  let stops = 0;
  const completion = new Promise((resolve) => { complete = resolve; });
  const camera = { recordAsync: () => completion, stopRecording: () => { stops++; } };
  const preview = { isActive: () => true, isReady: () => true, getCamera: () => camera };
  const dependencies = {
    "expo-file-system": { File: class {
      constructor(path) { this.uri = path; }
      get exists() { return files.has(this.uri); }
      get size() { return this.exists ? 2048 : 0; }
      delete() { files.delete(this.uri); }
    } },
    "react-native": { Platform: { OS: "android" } },
    "./errors": { CapturePreparationError: class extends Error {} },
    "./nativeCapture": { isNativeCapturePreview: (value) => value === preview },
    "./nativeRecordingMetadata": { nativeRecordingMimeType: () => "video/mp4" }
  };
  const source = readFileSync(new URL("../../src/capture/recordingAdapter.native.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const adapter = {};
  new Function("require", "exports", compiled)((name) => {
    assert.ok(name in dependencies, `Unexpected adapter dependency: ${name}`);
    return dependencies[name];
  }, adapter);
  return { adapter, uri, files, finish: () => complete({ uri }),
    active: adapter.startRecording({ preview }), stops: () => stops };
}

test("completed native recording survives active-handle cleanup until explicitly released", async () => {
  const f = setup();
  const stopping = f.adapter.stopRecording(f.active);
  f.finish();
  const reaction = await stopping;
  await f.adapter.cancelRecording(f.active);
  assert.equal(f.files.has(reaction.uri), true);
  assert.equal(f.stops(), 1);
  f.adapter.releaseReaction(reaction);
  assert.equal(f.files.has(reaction.uri), false);
});

test("native cancellation deletes an unfinished recording after the camera closes it", async () => {
  const f = setup();
  const cancelling = f.adapter.cancelRecording(f.active);
  f.finish();
  await cancelling;
  assert.equal(f.files.has(f.uri), false);
  assert.equal(f.stops(), 1);
});

test("cleanup waiting alongside stop does not delete the transferred reaction", async () => {
  const f = setup();
  const stopping = f.adapter.stopRecording(f.active);
  const cancelling = f.adapter.cancelRecording(f.active);
  f.finish();
  const [reaction] = await Promise.all([stopping, cancelling]);
  assert.equal(f.files.has(reaction.uri), true);
  assert.equal(f.stops(), 1);
});
