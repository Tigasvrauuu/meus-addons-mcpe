import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeSwingImpulse,
  computeReleaseImpulse,
  computeClingImpulse,
  climbTargetVy,
  add,
  length,
} from "../behavior_pack/scripts/core/swing_math.js";
import { WEB, CLING } from "../behavior_pack/scripts/core/config.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b}`);

const swing = (over) =>
  computeSwingImpulse({
    playerPos: { x: 5, y: 0, z: 0 },
    anchor: { x: 0, y: 0, z: 0 },
    rope: 5,
    velocity: { x: 0, y: 0, z: 0 },
    steerDir: null,
    maxSpeed: WEB.maxSpeed,
    steer: WEB.steerImpulse,
    pullGain: WEB.pullGain,
    pullMax: WEB.pullMax,
    ...over,
  });

test("slack rope applies no constraint impulse", () => {
  const imp = swing({ rope: 10 });
  assert.deepEqual(imp, { x: 0, y: 0, z: 0 });
});

test("taut rope removes outward radial velocity and keeps tangential velocity", () => {
  // Player is exactly on the rope; moving outward (+x) at 0.6 blocks/tick and
  // sideways (+z) at 0.4 blocks/tick.
  const imp = swing({ playerPos: { x: 5, y: 0, z: 0 }, rope: 5, velocity: { x: 0.6, y: 0, z: 0.4 } });
  near(imp.x, -0.6);
  near(imp.z, 0);
  near(imp.y, 0);
});

test("inward radial velocity is never removed (no pulling back into the anchor)", () => {
  const imp = swing({ rope: 5, velocity: { x: -0.5, y: 0, z: 0 } });
  assert.deepEqual(imp, { x: 0, y: 0, z: 0 });
});

test("overstretched rope gets a bounded correction", () => {
  const far = swing({ playerPos: { x: 50, y: 0, z: 0 }, rope: 5, velocity: { x: 0, y: 0, z: 0 } });
  assert.ok(far.x < 0, "correction must pull toward the anchor");
  assert.ok(Math.abs(far.x) <= WEB.pullMax + 1e-9, "correction must be capped");
});

test("speed is clamped to maxSpeed after the impulse", () => {
  const imp = swing({
    rope: 100,
    velocity: { x: 3, y: 0, z: 0 },
    playerPos: { x: 5, y: 0, z: 0 },
    maxSpeed: 1.0,
  });
  const after = add({ x: 3, y: 0, z: 0 }, imp);
  near(length(after), 1.0, 1e-9);
});

test("steering adds a small push along the view direction", () => {
  const imp = swing({ rope: 100, steerDir: { x: 0, y: 0, z: 1 } });
  near(imp.z, WEB.steerImpulse);
});

test("release nudge is boosted but capped", () => {
  const imp = computeReleaseImpulse({
    velocity: { x: 1.1, y: 0, z: 0 },
    aimDir: { x: 1, y: 0, z: 0 },
    boost: WEB.releaseBoost,
    maxSpeed: WEB.releaseMaxSpeed,
  });
  const after = add({ x: 1.1, y: 0, z: 0 }, imp);
  assert.ok(length(after) <= WEB.releaseMaxSpeed + 1e-9);
});

test("release from rest gives exactly the configured nudge", () => {
  const imp = computeReleaseImpulse({
    velocity: { x: 0, y: 0, z: 0 },
    aimDir: { x: 0, y: 0, z: 1 },
    boost: WEB.releaseBoost,
    maxSpeed: WEB.releaseMaxSpeed,
  });
  near(imp.z, WEB.releaseBoost);
});

test("cling impulse cancels horizontal drift and holds vertical speed at target", () => {
  const imp = computeClingImpulse({
    velocity: { x: 0.3, y: -0.2, z: -0.1 },
    targetVy: 0,
    normal: { x: 1, y: 0, z: 0 },
    offsetError: 0,
    stick: CLING.stickImpulse,
  });
  near(imp.x, -0.3);
  near(imp.z, 0.1);
  near(imp.y, 0.2);
});

test("cling spring pushes toward the wall when the player is too far out", () => {
  const imp = computeClingImpulse({
    velocity: { x: 0, y: 0, z: 0 },
    targetVy: 0,
    normal: { x: 1, y: 0, z: 0 },
    offsetError: -0.5, // player is 0.5 further out than wanted
    stick: CLING.stickImpulse,
  });
  assert.ok(imp.x < 0, "spring must move the player back toward the wall (-normal)");
});

test("pitch maps to climb, descend or hold", () => {
  assert.equal(climbTargetVy(-45, CLING), CLING.climbSpeed);
  assert.equal(climbTargetVy(60, CLING), -CLING.descendSpeed);
  assert.equal(climbTargetVy(0, CLING), 0);
});
