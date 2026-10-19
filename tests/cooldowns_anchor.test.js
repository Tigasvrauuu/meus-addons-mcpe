import { test } from "node:test";
import assert from "node:assert/strict";
import { isReady, remainingTicks, startCooldown, pruneCooldowns } from "../behavior_pack/scripts/core/cooldowns.js";
import { isAnchorAllowed, wallNormalForFace } from "../behavior_pack/scripts/core/anchor_rules.js";
import { WEB } from "../behavior_pack/scripts/core/config.js";

test("a fresh gadget is ready", () => {
  assert.equal(isReady(new Map(), "impact_web", 0), true);
});

test("starting a cooldown blocks use until it expires", () => {
  const cds = new Map();
  startCooldown(cds, "impact_web", 100, 60);
  assert.equal(isReady(cds, "impact_web", 159), false);
  assert.equal(remainingTicks(cds, "impact_web", 130), 30);
  assert.equal(isReady(cds, "impact_web", 160), true);
});

test("restarting a cooldown replaces the entry instead of stacking timers", () => {
  const cds = new Map();
  startCooldown(cds, "tech_pulse", 0, 160);
  startCooldown(cds, "tech_pulse", 10, 160);
  assert.equal(cds.size, 1);
  assert.equal(remainingTicks(cds, "tech_pulse", 10), 160);
});

test("invalid cooldown durations are treated as zero", () => {
  const cds = new Map();
  startCooldown(cds, "x", 50, Number.NaN);
  startCooldown(cds, "y", 50, -10);
  assert.equal(isReady(cds, "x", 50), true);
  assert.equal(isReady(cds, "y", 50), true);
});

test("pruning removes only expired entries", () => {
  const cds = new Map([["a", 5], ["b", 50]]);
  pruneCooldowns(cds, 10);
  assert.equal(cds.has("a"), false);
  assert.equal(cds.has("b"), true);
});

test("anchor rules reject liquids, passable blocks and hazards", () => {
  const solid = { isSolid: true, isLiquid: false };
  assert.equal(isAnchorAllowed("minecraft:stone", solid, WEB.unsafeAnchorTypes), true);
  assert.equal(isAnchorAllowed("minecraft:stone", { isSolid: false, isLiquid: false }, WEB.unsafeAnchorTypes), false);
  assert.equal(isAnchorAllowed("minecraft:water", { isSolid: true, isLiquid: true }, WEB.unsafeAnchorTypes), false);
  assert.equal(isAnchorAllowed("minecraft:magma", solid, WEB.unsafeAnchorTypes), false);
  assert.equal(isAnchorAllowed(undefined, solid, WEB.unsafeAnchorTypes), false);
});

test("wall normals point away from the wall and only vertical faces qualify", () => {
  assert.deepEqual(wallNormalForFace("East"), { x: 1, y: 0, z: 0 });
  assert.deepEqual(wallNormalForFace("North"), { x: 0, y: 0, z: -1 });
  assert.equal(wallNormalForFace("Up"), null);
  assert.equal(wallNormalForFace("Down"), null);
});
