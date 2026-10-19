import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultProfile, normalizeProfile, parseProfile, serializeProfile } from "../behavior_pack/scripts/core/profile.js";
import { applyNewUnlocks, isSuitUnlocked, isGadgetUnlocked } from "../behavior_pack/scripts/core/unlocks.js";

test("default profile starts with classic suit and impact web only", () => {
  const p = defaultProfile();
  assert.equal(p.suit, "classic");
  assert.equal(p.gadget, "impact_web");
  assert.deepEqual(p.unlockedSuits, ["classic"]);
  assert.deepEqual(p.unlockedGadgets, ["impact_web"]);
  assert.equal(p.starterGiven, false);
});

test("corrupted JSON falls back to defaults and reports repair", () => {
  const result = parseProfile("{not json");
  assert.equal(result.repaired, true);
  assert.deepEqual(result.profile, defaultProfile());
});

test("missing data is not reported as corruption", () => {
  const result = parseProfile(undefined);
  assert.equal(result.repaired, false);
});

test("equipping a locked suit in saved data is repaired to classic", () => {
  const { profile, repaired } = normalizeProfile({
    schema: 1,
    suit: "urban_burst",
    unlockedSuits: ["classic"],
    gadget: "impact_web",
    unlockedGadgets: ["impact_web"],
    stats: {},
  });
  assert.equal(profile.suit, "classic");
  assert.equal(repaired, true);
});

test("unknown ids, bad numbers and wrong types are sanitised", () => {
  const { profile } = normalizeProfile({
    schema: 1,
    suit: "hacked",
    gadget: 42,
    unlockedSuits: ["classic", "nope", "classic"],
    unlockedGadgets: "impact_web",
    stats: { swings: -5, wallClimbs: Number.NaN, gadgetUses: 3.7 },
    starterGiven: "yes",
    settings: { senseAlerts: "no" },
  });
  assert.equal(profile.suit, "classic");
  assert.equal(profile.gadget, "impact_web");
  assert.deepEqual(profile.unlockedSuits, ["classic"]);
  assert.deepEqual(profile.unlockedGadgets, ["impact_web"]);
  assert.equal(profile.stats.swings, 0);
  assert.equal(profile.stats.wallClimbs, 0);
  assert.equal(profile.stats.gadgetUses, 3);
  assert.equal(profile.starterGiven, false);
  assert.equal(profile.settings.senseAlerts, true);
});

test("round trip through serialize/parse keeps a valid profile unchanged", () => {
  const original = defaultProfile();
  original.stats.swings = 12;
  const parsed = parseProfile(serializeProfile(original));
  assert.equal(parsed.repaired, false);
  assert.deepEqual(parsed.profile, original);
});

test("unlocks trigger at exact thresholds and never twice", () => {
  const p = defaultProfile();
  p.stats.swings = 9;
  assert.deepEqual(applyNewUnlocks(p), []);
  p.stats.swings = 10;
  assert.deepEqual(applyNewUnlocks(p), [{ kind: "gadget", id: "web_restraint" }]);
  assert.ok(isGadgetUnlocked(p, "web_restraint"));
  assert.deepEqual(applyNewUnlocks(p), [], "repeat call must not re-award");
  assert.equal(p.unlockedGadgets.filter((x) => x === "web_restraint").length, 1);
});

test("suit unlock uses its own stat and is independent of gadget unlocks", () => {
  const p = defaultProfile();
  p.stats.swings = 20;
  const added = applyNewUnlocks(p);
  assert.ok(added.some((a) => a.kind === "suit" && a.id === "urban_burst"));
  assert.ok(isSuitUnlocked(p, "urban_burst"));
  assert.ok(!isSuitUnlocked(p, "advanced_tech"));
});
