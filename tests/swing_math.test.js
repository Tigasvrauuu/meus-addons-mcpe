// tests/swing_math.test.js — the swing pendulum is the highest-risk logic;
// these assertions pin its stability guarantees (spec §6.4, §25.2).

import test from "node:test";
import assert from "node:assert/strict";
import { stepSwing, computeReleaseVelocity, stepZip, strandPoints, horizontalDelta } from "../behavior_pack/scripts/systems/swing_math.js";
import { buildConfig } from "../behavior_pack/scripts/core/config.js";

const cfg = buildConfig().traversal;

test("taut rope removes outward radial velocity (distance bounded)", () => {
  const anchor = { x: 0, y: 20, z: 0 };
  const pos = { x: 0, y: 8, z: 0 }; // 12 below anchor
  const ropeLen = 8; // stretched beyond rope+slack
  const vel = { x: 0, y: -0.5, z: 0 }; // moving away from anchor
  const r = stepSwing({ pos, vel, anchor, ropeLen, look: { x: 0, y: 0, z: 1 }, forwardInput: 0, sprint: false, reel: false, cfg, suitSwingPower: 1 });
  // outward radial (downward) component must be strongly reduced
  assert.ok(r.vel.y > vel.y, `expected outward velocity killed, got ${r.vel.y}`);
  assert.ok(r.taut === true);
  assert.ok(r.overshoot > 0);
});

test("slack rope preserves momentum (no forced velocity reset, spec §6.4)", () => {
  const anchor = { x: 0, y: 12, z: 0 };
  const pos = { x: 0, y: 8, z: 0 };
  const vel = { x: 0.3, y: -0.1, z: 0.2 };
  const r = stepSwing({ pos, vel, anchor, ropeLen: 20, look: { x: 0, y: 0, z: 1 }, forwardInput: 0, sprint: false, reel: false, cfg, suitSwingPower: 1 });
  assert.ok(r.taut === false);
  // only damping applied
  const expected = Math.hypot(vel.x, vel.y, vel.z) * cfg.damping;
  assert.ok(Math.abs(Math.hypot(r.vel.x, r.vel.y, r.vel.z) - expected) < 1e-9);
});

test("speed caps are enforced (no rocket launches, spec §21)", () => {
  const anchor = { x: 0, y: 20, z: 0 };
  const pos = { x: 0, y: 5, z: 0 };
  const vel = { x: 5, y: 5, z: 5 }; // absurd input
  const r = stepSwing({ pos, vel, anchor, ropeLen: 10, look: { x: 0, y: 0, z: 1 }, forwardInput: 0, sprint: false, reel: false, cfg, suitSwingPower: 1 });
  const speed = Math.hypot(r.vel.x, r.vel.y, r.vel.z);
  assert.ok(speed <= cfg.maxSpeed + 1e-9, `speed ${speed} exceeds cap ${cfg.maxSpeed}`);
  assert.ok(r.vel.y <= cfg.maxUpwardSpeed + 1e-9);
});

test("forward input adds bounded tangential acceleration (pumping)", () => {
  const anchor = { x: 0, y: 20, z: 0 };
  const pos = { x: 10, y: 15, z: 0 }; // offset sideways
  const vel = { x: 0, y: 0, z: 0 };
  const idle = stepSwing({ pos, vel, anchor, ropeLen: 20, look: { x: 0, y: 0, z: 1 }, forwardInput: 0, sprint: false, reel: false, cfg, suitSwingPower: 1 });
  const pumped = stepSwing({ pos, vel, anchor, ropeLen: 20, look: { x: 0, y: 0, z: 1 }, forwardInput: 1, sprint: false, reel: false, cfg, suitSwingPower: 1 });
  assert.ok(Math.hypot(pumped.vel.x, pumped.vel.z) > Math.hypot(idle.vel.x, idle.vel.z));
  // bounded: single-tick pump must stay small
  assert.ok(Math.hypot(pumped.vel.x, pumped.vel.y, pumped.vel.z) <= cfg.pumpAccelSprint * 1.5);
});

test("reel shortens rope but never below minimum", () => {
  const anchor = { x: 0, y: 20, z: 0 };
  let rope = 30;
  for (let i = 0; i < 200; i++) {
    const r = stepSwing({ pos: { x: 0, y: 8, z: 0 }, vel: { x: 0, y: 0, z: 0 }, anchor, ropeLen: rope, look: { x: 0, y: 0, z: 1 }, forwardInput: 0, sprint: false, reel: true, cfg, suitSwingPower: 1 });
    rope = r.ropeLen;
  }
  assert.equal(rope, cfg.minRopeLength);
});

test("degenerate input never produces NaN (safety, spec §0.3)", () => {
  const r = stepSwing({ pos: { x: 0, y: 0, z: 0 }, vel: { x: NaN, y: undefined, z: 0 }, anchor: { x: 0, y: 0, z: 0 }, ropeLen: NaN, look: { x: 0, y: 0, z: 0 }, forwardInput: NaN, sprint: false, reel: false, cfg, suitSwingPower: NaN });
  assert.ok(Number.isFinite(r.vel.x) && Number.isFinite(r.vel.y) && Number.isFinite(r.vel.z));
  assert.ok(Number.isFinite(r.ropeLen));
});

test("release preserves bounded momentum and optional launch boost", () => {
  const vel = { x: 0.6, y: -0.3, z: 0.4 };
  const plain = computeReleaseVelocity({ vel, launch: false, cfg });
  const boosted = computeReleaseVelocity({ vel, launch: true, cfg });
  const mag = (v) => Math.hypot(v.x, v.y, v.z);
  assert.ok(Math.abs(mag(plain) - mag(vel) * cfg.releaseRetain) < 1e-9);
  assert.ok(boosted.y > plain.y, "launch must add upward velocity");
  assert.ok(boosted.y <= cfg.maxUpwardSpeed + 1e-9);
});

test("zip accelerates toward anchor and finishes at arrival distance", () => {
  const anchor = { x: 0, y: 10, z: 0 };
  let pos = { x: 20, y: 10, z: 0 };
  let vel = { x: 0, y: 0, z: 0 };
  let steps = 0;
  let finished = false;
  while (steps++ < 400) {
    const r = stepZip({ pos, vel, anchor, cfg, suitZipSpeed: 1 });
    vel = r.vel;
    const speed = Math.hypot(vel.x, vel.y, vel.z);
    assert.ok(speed <= cfg.zipMaxSpeed + 1e-9, "zip speed capped");
    pos = { x: pos.x + vel.x, y: pos.y + vel.y, z: pos.z + vel.z };
    if (r.finished) { finished = true; break; }
  }
  assert.ok(finished, "zip must reach its anchor");
});

test("strandPoints returns bounded, evenly spaced samples", () => {
  const pts = strandPoints({ x: 0, y: 0, z: 0 }, { x: 0, y: 10, z: 0 }, 1, 6);
  assert.ok(pts.length <= 6);
  assert.ok(pts.length >= 2);
  assert.ok(pts[0].y === 0);
  assert.ok(Math.abs(pts[pts.length - 1].y - 10) < 1e-9);
  assert.deepEqual(strandPoints({ x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }, 1, 10), []);
});

test("horizontalDelta measures planar travel", () => {
  assert.ok(Math.abs(horizontalDelta({ x: 0, y: 50, z: 0 }, { x: 3, y: 40, z: 4 }) - 5) < 1e-9);
});
