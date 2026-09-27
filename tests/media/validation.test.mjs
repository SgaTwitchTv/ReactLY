import assert from "node:assert/strict";
import test from "node:test";

import {
  sourceKindFromMimeType,
  validateSourceMedia
} from "../../src/media/validation.ts";

const validImage = {
  uri: "blob:reactly-image",
  kind: "image",
  width: 1080,
  height: 1920,
  name: "reaction-source.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 1024
};

test("derives supported source kinds from MIME types", () => {
  assert.equal(sourceKindFromMimeType("image/jpeg"), "image");
  assert.equal(sourceKindFromMimeType("video/mp4"), "video");
  assert.equal(sourceKindFromMimeType("application/pdf"), null);
});

test("accepts a valid image source", () => {
  assert.deepEqual(validateSourceMedia(validImage), { valid: true, issues: [] });
});

test("requires positive dimensions and a non-empty file", () => {
  const result = validateSourceMedia({ ...validImage, width: 0, sizeBytes: 0 });

  assert.equal(result.valid, false);
  assert.deepEqual(result.issues, ["invalid-dimensions", "empty-file"]);
});

test("requires finite positive duration for video", () => {
  const result = validateSourceMedia({
    ...validImage,
    kind: "video",
    mimeType: "video/mp4"
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.issues, ["invalid-duration"]);
});

test("rejects a mismatch between MIME type and source kind", () => {
  const result = validateSourceMedia({ ...validImage, kind: "video", durationMs: 1000 });

  assert.equal(result.valid, false);
  assert.deepEqual(result.issues, ["unsupported-type"]);
});
