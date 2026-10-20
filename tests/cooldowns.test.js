import test from "node:test";
import assert from "node:assert/strict";
import { isReady, remaining, nextReadyTick, formatRemaining, markCooldown, pruneCooldowns } from "../behavior_pack/scripts/core/cooldowns.js";

test("readiness is timestamp-derived (no timers to leak)", () => {
  assert.equal(isReady(undefined, 100), true);
  assert.equal(isReady(null, 100), true);
  assert.equal(isReady(100, 99), false);
  assert.equal(isReady(100, 100), true);
  assert.equal(isReady(NaN, 100), true, "corrupt value must fail OPEN, never lock the player");
  assert.equal(isReady("nope", 100), true);
});

test("remaining never goes negative and formats sensibly", () => {
  assert.equal(remaining(150, 100), 50);
  assert.equal(remaining(50, 100), 0);
  assert.equal(formatRemaining(100, 60), "2.0s");
  assert.equal(formatRemaining(60, 100), "READY");
});

test("suit multipliers are clamped (spec §19.1 corrupted-data safety)", () => {
  assert.equal(nextReadyTick(100, 80, 0.75), 160);
  assert.equal(nextReadyTick(100, 80, 0), 120, "multiplier clamped to 0.25 min");
  assert.equal(nextReadyTick(100, 80, 99), 260, "multiplier clamped to 2 max");
  assert.equal(nextReadyTick(100, NaN, 1), 100);
});

test("cooldown map helpers are pure and prune old entries", () => {
  const m0 = {};
  const m1 = markCooldown(m0, "impact_web", 500);
  assert.deepEqual(m0, {}, "original untouched");
  assert.equal(m1.impact_web, 500);
  const pruned = pruneCooldowns({ a: 10, b: 900 }, 1000, 400);
  assert.deepEqual(pruned, { b: 900 });
});
