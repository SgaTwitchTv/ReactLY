import assert from "node:assert/strict";
import test from "node:test";

import { sourceFromNativeAsset } from "../../src/media/nativeAsset.ts";
import { validateSourceMedia } from "../../src/media/validation.ts";

test("maps a native image-picker image into shared source metadata", () => {
  assert.deepEqual(
    sourceFromNativeAsset({
      uri: "file:///cache/photo.jpg",
      type: "image",
      width: 3024,
      height: 4032,
      fileName: "photo.jpg",
      fileSize: 512000,
      mimeType: "image/jpeg"
    }),
    {
      uri: "file:///cache/photo.jpg",
      kind: "image",
      width: 3024,
      height: 4032,
      name: "photo.jpg",
      sizeBytes: 512000,
      mimeType: "image/jpeg"
    }
  );
});

test("maps video duration and uses a measured fallback file size", () => {
  const source = sourceFromNativeAsset(
    {
      uri: "file:///cache/reaction-source.MOV",
      type: "video",
      width: 1920,
      height: 1080,
      duration: 4250,
      fileName: null,
      mimeType: null
    },
    2048000
  );

  assert.equal(source.kind, "video");
  assert.equal(source.mimeType, "video/quicktime");
  assert.equal(source.name, "reaction-source.MOV");
  assert.equal(source.sizeBytes, 2048000);
  assert.equal(source.durationMs, 4250);
});

test("rejects assets without valid native metadata", () => {
  const source = sourceFromNativeAsset({
    uri: "file:///cache/broken.mp4",
    type: "video",
    width: 0,
    height: 0,
    duration: null,
    fileSize: 0,
    mimeType: "video/mp4"
  });

  assert.deepEqual(validateSourceMedia(source).issues, [
    "invalid-dimensions",
    "empty-file",
    "invalid-duration"
  ]);
});
