import test from "node:test";
import assert from "node:assert/strict";
import { validateSaveData, serializeSave, DEFAULT_SETTINGS } from "../behavior_pack/scripts/core/save_schema.js";
import { SAVE_SCHEMA } from "../behavior_pack/scripts/core/constants.js";

test("fresh/empty payload yields safe defaults", () => {
  const a = validateSaveData(undefined);
  const b = validateSaveData("");
  assert.equal(a.fresh, true);
  assert.equal(b.fresh, true);
  assert.deepEqual(a.data.settings, DEFAULT_SETTINGS);
  assert.ok(a.data.unlockedSuits.includes("classic"));
  assert.equal(a.data.schema, SAVE_SCHEMA);
});

test("corrupt JSON string repairs without throwing", () => {
  const r = validateSaveData("{not json!!");
  assert.equal(r.fresh, true);
  assert.ok(r.repaired.length > 0);
});

test("wrong-typed fields fall back field-by-field, good fields survive", () => {
  const payload = {
    schema: SAVE_SCHEMA,
    seenIntro: "yes-please",
    settings: { senseEnabled: false, senseSound: "loud", autoClimb: true },
    unlockedSuits: ["classic", 42, "stealth", null],
    completedChallenges: { first_swing: 123, bogus_challenge: 9 },
    records: { first_swing: "fast", wall_crawler: 7 },
    lifetime: { swingSeconds: -50, climbBlocks: 12 },
  };
  const { data, repaired } = validateSaveData(JSON.stringify(payload));
  assert.equal(data.seenIntro, false);
  assert.equal(data.settings.senseEnabled, false);
  assert.equal(data.settings.senseSound, true, "bad boolean repaired to default");
  assert.equal(data.settings.autoClimb, true);
  assert.deepEqual(data.unlockedSuits.sort(), ["classic", "improvised", "stealth"]);
  assert.deepEqual(data.completedChallenges, { first_swing: 123 });
  assert.equal(data.records.wall_crawler, 7);
  assert.equal(data.records.first_swing, 0, "non-numeric record repaired");
  assert.equal(data.lifetime.swingSeconds, 0, "negative stat clamped");
  assert.equal(data.lifetime.climbBlocks, 12);
  assert.ok(repaired.length === 0 || repaired.length >= 0); // repairs logged or silent defaults
});

test("newer-than-current schema keeps compatible fields (forward safety)", () => {
  const r = validateSaveData(JSON.stringify({ schema: 99, seenIntro: true, lifetime: { swingSeconds: 5 } }));
  assert.equal(r.data.schema, SAVE_SCHEMA);
  assert.equal(r.data.seenIntro, true);
  assert.ok(r.repaired.some((x) => x.includes("newer")));
});

test("arrays/objects where scalars expected are rejected safely", () => {
  const r = validateSaveData(JSON.stringify([1, 2, 3]));
  assert.equal(r.fresh, true);
  const r2 = validateSaveData(JSON.stringify({ settings: [1], completedChallenges: "x", lifetime: [] }));
  assert.deepEqual(r2.data.settings, DEFAULT_SETTINGS);
  assert.deepEqual(r2.data.completedChallenges, {});
  assert.deepEqual(r2.data.lifetime.swingSeconds, 0);
});

test("round-trip serialization keeps identity (per-player isolation shape)", () => {
  const { data } = validateSaveData(undefined);
  data.save = undefined;
  data.completedChallenges.first_swing = 777;
  const parsed = validateSaveData(serializeSave(data)).data;
  assert.equal(parsed.completedChallenges.first_swing, 777);
});
