// tests/climb_math.test.js — wall climb + glide guarantees (spec §7).

import test from "node:test";
import assert from "node:assert/strict";
import { stepClimb, stepGlide, pickWall } from "../behavior_pack/scripts/systems/climb_math.js";
import { buildConfig } from "../behavior_pack/scripts/core/config.js";

const cfg = buildConfig().climbing;
const N = { x: 1, y: 0, z: 0 }; // wall to the player's -X; normal points +X

test("hover when no input: vertical velocity settles to ~0", () => {
  const r = stepClimb({ pos: { x: 0, y: 5, z: 0 }, vel: { x: 0, y: -0.8, z: 0 }, wallNormal: N, up: false, down: false, cfg, suitClimbSpeed: 1 });
  assert.ok(Math.abs(r.vel.y) <= Math.abs(-0.8) && Math.abs(r.vel.y) < 0.8);
  assert.ok(r.leap === false);
});

test("jump climbs up bounded; sneak climbs down bounded", () => {
  const up = stepClimb({ pos: { x: 0, y: 5, z: 0 }, vel: { x: 0, y: 0, z: 0 }, wallNormal: N, up: true, down: false, cfg, suitClimbSpeed: 1 });
  assert.ok(up.vel.y > 0 && up.vel.y <= cfg.climbUpSpeed + 1e-9);
  const down = stepClimb({ pos: { x: 0, y: 5, z: 0 }, vel: { x: 0, y: 0, z: 0 }, wallNormal: N, up: false, down: true, cfg, suitClimbSpeed: 1 });
  assert.ok(down.vel.y < 0 && down.vel.y >= -Math.max(cfg.climbDownSpeed, 0.5) - 1e-9);
});

test("velocity into the wall is cancelled (no tunneling, spec §7.2)", () => {
  const r = stepClimb({ pos: { x: 0, y: 5, z: 0 }, vel: { x: -0.6, y: 0, z: 0.3 }, wallNormal: N, up: false, down: false, cfg, suitClimbSpeed: 1 });
  // The large inward component is removed; only the tiny intentional
  // stick-pull contact residual (cfg.stickPull) may remain toward the wall.
  assert.ok(r.vel.x >= -0.1, `inward velocity must be removed, got ${r.vel.x}`);
  assert.ok(Math.abs(r.vel.z - 0.3) < 1e-9, "tangential motion preserved");
});

test("sneak+jump leaps off and exits climb", () => {
  const r = stepClimb({ pos: { x: 0, y: 5, z: 0 }, vel: { x: 0, y: 0, z: 0 }, wallNormal: N, up: true, down: true, cfg, suitClimbSpeed: 1 });
  assert.equal(r.leap, true);
  assert.ok(r.vel.x > 0, "leap pushes away from the wall");
  assert.ok(r.vel.y > 0, "leap pushes upward");
});

test("suit multiplier scales climb speed honestly", () => {
  const base = stepClimb({ pos: { x: 0, y: 5, z: 0 }, vel: { x: 0, y: 0, z: 0 }, wallNormal: N, up: true, down: false, cfg, suitClimbSpeed: 1 });
  const boosted = stepClimb({ pos: { x: 0, y: 5, z: 0 }, vel: { x: 0, y: 0, z: 0 }, wallNormal: N, up: true, down: false, cfg, suitClimbSpeed: 1.25 });
  assert.ok(boosted.vel.y > base.vel.y);
});

test("glide caps fall speed but never fights slow falls", () => {
  const capped = stepGlide({ vel: { x: 0.2, y: -2.5, z: 0 }, cfg });
  assert.equal(capped.active, true);
  assert.equal(capped.vel.y, -cfg.glideFallSpeedCap);
  const gentle = stepGlide({ vel: { x: 0.2, y: -0.2, z: 0 }, cfg });
  assert.equal(gentle.active, false);
});

test("pickWall prefers the wall the player faces", () => {
  const probes = [
    { dir: { x: 1, y: 0, z: 0 }, hit: { block: 1 }, distance: 0.9 },
    { dir: { x: 0, y: 0, z: -1 }, hit: { block: 1 }, distance: 0.9 },
  ];
  const facingNegZ = { x: 0, y: 0, z: -1 };
  const picked = pickWall(probes, facingNegZ);
  assert.ok(picked);
  assert.deepEqual(picked.dir, { x: 0, y: 0, z: 1 }); // normal points wall→player (+Z)
  assert.equal(pickWall([{ dir: { x: 1, y: 0, z: 0 }, hit: null, distance: 1 }], facingNegZ), null);
});
