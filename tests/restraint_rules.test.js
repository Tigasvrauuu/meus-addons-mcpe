import test from "node:test";
import assert from "node:assert/strict";
import { classifyRestraintTarget, classifyPullTarget, TARGET_CLASS, threatScore } from "../behavior_pack/scripts/systems/restraint_rules.js";
import { ENTITIES } from "../behavior_pack/scripts/core/constants.js";
import { buildConfig } from "../behavior_pack/scripts/core/config.js";

const cfg = buildConfig().combat;

test("classification: light locked, heavy slowed, elite immune", () => {
  const light = classifyRestraintTarget({ typeId: ENTITIES.THUG }, cfg);
  assert.equal(light.cls, TARGET_CLASS.LIGHT);
  assert.equal(light.fullLock, true);
  assert.equal(light.durationTicks, cfg.restraintBaseTicks);

  const heavy = classifyRestraintTarget({ typeId: ENTITIES.BRUTE }, cfg);
  assert.equal(heavy.cls, TARGET_CLASS.HEAVY);
  assert.equal(heavy.fullLock, false);
  assert.ok(heavy.durationTicks < light.durationTicks, "heavy restraint shorter");
  assert.ok(heavy.slownessAmplifier < light.slownessAmplifier);

  const elite = classifyRestraintTarget({ typeId: ENTITIES.ENFORCER }, cfg);
  assert.equal(elite.cls, TARGET_CLASS.IMMUNE);
  assert.equal(elite.durationTicks, 0);

  const vanilla = classifyRestraintTarget({ typeId: "minecraft:zombie" }, cfg);
  assert.equal(vanilla.cls, TARGET_CLASS.LIGHT);
});

test("invalid targets: players, dead entities, garbage", () => {
  assert.equal(classifyRestraintTarget({ typeId: "minecraft:player", isPlayer: true }, cfg).cls, TARGET_CLASS.INVALID);
  assert.equal(classifyRestraintTarget({ typeId: ENTITIES.THUG, alive: false }, cfg).cls, TARGET_CLASS.INVALID);
  assert.equal(classifyRestraintTarget(null, cfg).cls, TARGET_CLASS.INVALID);
  assert.equal(classifyRestraintTarget({}, cfg).cls, TARGET_CLASS.INVALID);
});

test("pull classification mirrors restraint limits (no elite teleports)", () => {
  assert.equal(classifyPullTarget({ typeId: ENTITIES.THUG }).mode, "strong");
  assert.equal(classifyPullTarget({ typeId: ENTITIES.BRUTE }).mode, "weak");
  assert.equal(classifyPullTarget({ typeId: ENTITIES.ENFORCER }).mode, "none");
  assert.equal(classifyPullTarget({ typeId: "minecraft:player", isPlayer: true }).mode, "none");
});

test("threat scoring prioritizes closeness and scary types", () => {
  const closeCreeper = threatScore("minecraft:creeper", 6);
  const farCreeper = threatScore("minecraft:creeper", 20);
  const closeThug = threatScore(ENTITIES.THUG, 6);
  assert.ok(closeCreeper < farCreeper);
  assert.ok(closeCreeper < closeThug, "creepers outrank thugs at equal distance");
  assert.equal(threatScore("whatever:mob", 10), 10, "unknown types use default weight");
});
