// tests/utils.test.js — pure helpers incl. the HUD compass arrow, which must
// follow Bedrock yaw conventions (0 = +Z/south, +90 = -X/west).

import test from "node:test";
import assert from "node:assert/strict";
import { relativeArrow, clampNum, distanceBetween, isEntityValid } from "../behavior_pack/scripts/core/utils.js";

test("compass arrow: 8 sectors + same-position dot", () => {
  const p = { x: 0, y: 64, z: 0 };
  // player facing south (+Z, yaw 0)
  assert.equal(relativeArrow(0, p, { x: 0, y: 64, z: 8 }), "↑");       // ahead
  assert.equal(relativeArrow(0, p, { x: 0, y: 64, z: -8 }), "↓");      // behind
  assert.equal(relativeArrow(0, p, { x: -8, y: 64, z: 0 }), "→");      // west = right when facing south
  assert.equal(relativeArrow(0, p, { x: 8, y: 64, z: 0 }), "←");       // east = left
  assert.equal(relativeArrow(0, p, p), "•");
  // facing north (yaw 180): ahead flips
  assert.equal(relativeArrow(180, p, { x: 0, y: 64, z: -8 }), "↑");
  // facing west (yaw 90): west is ahead, north is on the right
  assert.equal(relativeArrow(90, p, { x: -8, y: 64, z: 0 }), "↑");
  assert.equal(relativeArrow(90, p, { x: 0, y: 64, z: -8 }), "→");
});

test("clampNum handles NaN and bounds", () => {
  assert.equal(clampNum(5, 0, 3), 3);
  assert.equal(clampNum(-5, 0, 3), 0);
  assert.equal(clampNum(NaN, 0, 3, 1.5), 1.5);
});

test("distanceBetween is plain euclidean", () => {
  assert.equal(distanceBetween({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }), 5);
});

test("isEntityValid tolerates property+method isValid and stale handles", () => {
  assert.equal(isEntityValid(null), false);
  assert.equal(isEntityValid({ isValid: true }), true);
  assert.equal(isEntityValid({ isValid: false }), false);
  assert.equal(isEntityValid({ isValid: () => false }), false);
  assert.equal(isEntityValid({ isValid: () => true }), true);
  assert.equal(isEntityValid({}), true, "unknown shape treated as usable; errors surface later");
});
