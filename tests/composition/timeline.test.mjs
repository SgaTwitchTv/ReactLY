import assert from "node:assert/strict";
import test from "node:test";

import {
  ROLE_SWAP_DURATION_MS,
  layoutAt
} from "../../src/composition/timeline.ts";

const canvas = { width: 900, height: 1600 };

function assertRectClose(actual, expected, tolerance = 0.0001) {
  for (const key of ["x", "y", "width", "height"]) {
    assert.ok(
      Math.abs(actual[key] - expected[key]) <= tolerance,
      `${key}: expected ${expected[key]}, received ${actual[key]}`
    );
  }
}

test("uses the source-first composition at 0 and 999 ms", () => {
  for (const timeMs of [0, 999]) {
    const layout = layoutAt(timeMs, canvas);

    assert.equal(layout.phase, "source-first");
    assert.deepEqual(layout.sourceRect, { x: 0, y: 0, width: 900, height: 1600 });
    assert.equal(layout.cameraRect.width, 279);
    assert.equal(layout.brandOpacity, 0);
  }
});

test("begins the role swap at exactly 1000 ms without a visual jump", () => {
  const before = layoutAt(999, canvas);
  const start = layoutAt(1000, canvas);

  assert.equal(start.phase, "role-swap");
  assertRectClose(start.sourceRect, before.sourceRect);
  assertRectClose(start.cameraRect, before.cameraRect);
  assert.equal(start.brandOpacity, 0);
});

test("uses cubic ease-out at the 1325 ms midpoint", () => {
  const midpoint = layoutAt(1325, canvas);

  assert.equal(ROLE_SWAP_DURATION_MS, 650);
  assert.equal(midpoint.phase, "role-swap");
  assert.equal(midpoint.brandOpacity, 0.875);
  assertRectClose(midpoint.cameraRect, {
    x: 73.125,
    y: 149,
    width: 822.375,
    height: 1446.5
  });
});

test("uses the reaction-first composition from 1650 ms onward", () => {
  for (const timeMs of [1650, 5000]) {
    const layout = layoutAt(timeMs, canvas);

    assert.equal(layout.phase, "reaction-first");
    assert.deepEqual(layout.cameraRect, { x: 0, y: 0, width: 900, height: 1600 });
    assertRectClose(layout.sourceRect, {
      x: 36,
      y: 1356.4375,
      width: 369,
      height: 207.5625
    });
    assert.equal(layout.sourceRadius, 27);
    assert.equal(layout.cameraRadius, 0);
    assert.equal(layout.brandOpacity, 1);
  }
});

test("clamps negative and non-finite time to the beginning", () => {
  assert.deepEqual(layoutAt(-1, canvas), layoutAt(0, canvas));
  assert.deepEqual(layoutAt(Number.NaN, canvas), layoutAt(0, canvas));
});

test("rejects invalid canvas dimensions", () => {
  assert.throws(() => layoutAt(0, { width: 0, height: 1600 }), RangeError);
  assert.throws(() => layoutAt(0, { width: 900, height: Number.NaN }), RangeError);
});
