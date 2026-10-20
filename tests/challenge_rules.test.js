import test from "node:test";
import assert from "node:assert/strict";
import { applyProgressEvent, claimReward, CHALLENGE_DEFS, progressFraction } from "../behavior_pack/scripts/systems/challenge_rules.js";
import { CHALLENGES, PROGRESS_EVENTS } from "../behavior_pack/scripts/core/constants.js";

const blankSave = () => ({
  schema: 1,
  seenIntro: true,
  settings: {},
  unlockedSuits: ["classic", "improvised"],
  completedChallenges: {},
  rewardedChallenges: {},
  records: {},
  lifetime: { swingSeconds: 0, climbBlocks: 0, zipBlocks: 0, enemiesDefeated: 0, restrainsLanded: 0, gadgetHits: 0 },
});

test("events only advance the active challenge of matching type", () => {
  let state = { activeId: CHALLENGES.FIRST_SWING, progress: 0 };
  const r1 = applyProgressEvent(state, blankSave(), { type: PROGRESS_EVENTS.SWING_TIME, amount: 10 });
  assert.equal(r1.state.progress, 10);
  assert.equal(r1.ignored, false);
  const r2 = applyProgressEvent(r1.state, r1.save, { type: PROGRESS_EVENTS.RESTRAIN, amount: 3 });
  assert.equal(r2.ignored, true);
  assert.equal(r2.state.progress, 10);
});

test("no active challenge → ignored but lifetime stats still accrue", () => {
  const r = applyProgressEvent({ activeId: null, progress: 0 }, blankSave(), { type: PROGRESS_EVENTS.SWING_TIME, amount: 5 });
  assert.equal(r.ignored, true);
  assert.equal(r.save.lifetime.swingSeconds, 5);
});

test("completion fires exactly once and never re-completes", () => {
  const save = blankSave();
  let state = { activeId: CHALLENGES.BUG_CATCHER, progress: 9 };
  const r = applyProgressEvent(state, save, { type: PROGRESS_EVENTS.RESTRAIN, amount: 1 });
  assert.ok(r.completed, "challenge must complete at target");
  assert.equal(r.state.activeId, null);
  assert.ok(r.save.completedChallenges[CHALLENGES.BUG_CATCHER] !== undefined);

  // Re-feeding after completion must not re-progress or re-complete.
  const again = applyProgressEvent(r.state, r.save, { type: PROGRESS_EVENTS.RESTRAIN, amount: 5 });
  assert.equal(again.completed, null);
  assert.equal(again.state.activeId, null);
});

test("reward claim is idempotent (duplicate-reward guard, spec §13.2)", () => {
  const save = blankSave();
  save.completedChallenges[CHALLENGES.FIRST_SWING] = 123;
  const claimed1 = claimReward(save, CHALLENGES.FIRST_SWING);
  assert.ok(claimed1);
  const claimed2 = claimReward(claimed1, CHALLENGES.FIRST_SWING);
  assert.equal(claimed2, null, "second claim must be refused");
  assert.equal(claimReward(claimed1, "no_such_challenge"), null);
  const noComplete = claimReward(blankSave(), CHALLENGES.FIRST_SWING);
  assert.equal(noComplete, null, "cannot claim an uncompleted challenge");
});

test("progress caps at target and lifetime totals accumulate per type", () => {
  let state = { activeId: CHALLENGES.GADGETEER, progress: 14 };
  const r = applyProgressEvent(state, blankSave(), { type: PROGRESS_EVENTS.GADGET_HIT, amount: 99 });
  const def = CHALLENGE_DEFS.find((c) => c.id === CHALLENGES.GADGETEER);
  assert.ok(r.save.completedChallenges[CHALLENGES.GADGETEER] !== undefined);
  assert.equal(r.save.lifetime.gadgetHits, 99);
  assert.ok(progressFraction({ activeId: null, progress: 0 }) === 0);
  assert.ok(progressFraction({ activeId: def.id, progress: def.target / 2 }) === 0.5);
});

test("every definition is well-formed (ids unique, targets > 0, rewards shaped)", () => {
  const ids = new Set();
  for (const d of CHALLENGE_DEFS) {
    assert.ok(!ids.has(d.id), `duplicate challenge id ${d.id}`);
    ids.add(d.id);
    assert.ok(Number.isFinite(d.target) && d.target > 0);
    assert.ok(typeof d.eventType === "string");
    assert.ok(Array.isArray(d.reward.items) && Array.isArray(d.reward.suits));
    assert.ok(typeof d.reward.text === "string" && d.reward.text.length > 0);
    assert.ok(typeof d.description === "string" && d.description.length > 20);
  }
});
