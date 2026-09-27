import assert from "node:assert/strict";
import test from "node:test";

import { LAYER_HANDOFF_MS, layerOrderAt } from "../../src/composition/layerOrder.ts";

test("keeps the reaction PiP above the source before the midpoint", () => {
  assert.deepEqual(layerOrderAt(0), ["source", "reaction"]);
  assert.deepEqual(layerOrderAt(1324), ["source", "reaction"]);
});

test("hands foreground to the source at the role-swap midpoint", () => {
  assert.equal(LAYER_HANDOFF_MS, 1325);
  assert.deepEqual(layerOrderAt(1325), ["reaction", "source"]);
  assert.deepEqual(layerOrderAt(5000), ["reaction", "source"]);
});
