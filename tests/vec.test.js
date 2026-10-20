import test from "node:test";
import assert from "node:assert/strict";
import * as vec from "../behavior_pack/scripts/core/vec.js";

test("magnitude/distance/normalize basics", () => {
  assert.equal(vec.length({ x: 3, y: 0, z: 4 }), 5);
  assert.equal(vec.distance({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -2 }), 2);
  assert.deepEqual(vec.normalize({ x: 0, y: 0, z: 10 }), { x: 0, y: 0, z: 1 });
  assert.deepEqual(vec.normalize({ x: 0, y: 0, z: 0 }), { x: 0, y: 0, z: 0 }, "zero vector stays zero");
});

test("clampLength never exceeds limit and no-ops when shorter", () => {
  const clamped = vec.clampLength({ x: 10, y: 10, z: 10 }, 3);
  assert.ok(Math.abs(vec.length(clamped) - 3) < 1e-9);
  assert.deepEqual(vec.clampLength({ x: 1, y: 0, z: 0 }, 3), { x: 1, y: 0, z: 0 });
});

test("dot/cross identities", () => {
  assert.equal(vec.dot({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), 0);
  const c = vec.cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  assert.deepEqual(c, { x: 0, y: 0, z: 1 });
});

test("horizontal projections ignore Y", () => {
  assert.deepEqual(vec.horizontal({ x: 1, y: 99, z: 2 }), { x: 1, y: 0, z: 2 });
  assert.equal(vec.horizontalLength({ x: 3, y: 400, z: 4 }), 5);
});

test("lerpVec interpolates endpoint-exactly", () => {
  assert.deepEqual(vec.lerpVec({ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 }, 0.5), { x: 1, y: 1, z: 1 });
  assert.deepEqual(vec.lerpVec({ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 }, 1), { x: 2, y: 2, z: 2 });
});

test("toVec repairs garbage without throwing (spec §0.3 safety)", () => {
  assert.deepEqual(vec.toVec({ x: NaN, y: undefined, z: "x" }), { x: 0, y: 0, z: 0 });
  assert.deepEqual(vec.toVec(null), { x: 0, y: 0, z: 0 });
  assert.deepEqual(vec.toVec({ x: 1.5, y: -2, z: 0 }), { x: 1.5, y: -2, z: 0 });
  assert.equal(vec.isFiniteVec({ x: 1, y: 2, z: NaN }), false);
});

test("clampComponents bounds each axis", () => {
  const c = vec.clampComponents({ x: 99, y: -99, z: 0.5 }, { x: -1, y: -1, z: -1 }, { x: 1, y: 1, z: 1 });
  assert.deepEqual(c, { x: 1, y: -1, z: 0.5 });
});
