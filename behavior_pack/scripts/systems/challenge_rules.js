// systems/challenge_rules.js — PURE module (no @minecraft imports; unit-testable).
// Challenge definitions + the progress reducer (spec §13). The runtime
// (challenges.js) only feeds events in and hands rewards out; all rules live
// here so completion logic is covered by automated tests.

import { CHALLENGES, PROGRESS_EVENTS, ITEMS } from "../core/constants.js";

/**
 * Challenge definitions.
 * - eventType: which progression event advances it
 * - target: units required (seconds / blocks / count)
 * - unit: label used in progress strings
 * - reward: {items: [{typeId, count}], suits: [suitId], text}
 * Rewards are granted exactly once (guarded by rewardedChallenges).
 */
export const CHALLENGE_DEFS = Object.freeze([
  {
    id: CHALLENGES.FIRST_SWING,
    name: "First Swing",
    description: "Spend 30 seconds swinging on webs (cumulative). Practice the core: fire, pump with forward movement, release with JUMP.",
    eventType: PROGRESS_EVENTS.SWING_TIME,
    target: 30,
    unit: "s swung",
    reward: { items: [{ typeId: ITEMS.IMPACT_WEB, count: 2 }], suits: [], text: "2x Impact Web" },
    recommended: true,
  },
  {
    id: CHALLENGES.WALL_CRAWLER,
    name: "Wall Crawler",
    description: "Climb 100 blocks upward on walls (cumulative). Jump toward a wall mid-air to attach, JUMP to climb, SNEAK+JUMP to leap off.",
    eventType: PROGRESS_EVENTS.CLIMB_UP,
    target: 100,
    unit: "blocks climbed",
    reward: { items: [], suits: ["stealth"], text: "Stealth Suit unlocked" },
  },
  {
    id: CHALLENGES.BUG_CATCHER,
    name: "Bug Catcher",
    description: "Restrain 10 hostile targets with the Restraint Web gadget.",
    eventType: PROGRESS_EVENTS.RESTRAIN,
    target: 10,
    unit: "restrained",
    reward: { items: [{ typeId: ITEMS.TECH_PULSE, count: 1 }], suits: [], text: "Tech Pulse gadget" },
  },
  {
    id: CHALLENGES.STREET_SWEEPER,
    name: "Street Sweeper",
    description: "Defeat 8 SMX enemies (street thugs and friends). Spawn some from the Suit Station's sparring option.",
    eventType: PROGRESS_EVENTS.ENEMY_DEFEATED,
    target: 8,
    unit: "defeated",
    reward: { items: [], suits: ["iron"], text: "Iron-Armor Suit unlocked" },
  },
  {
    id: CHALLENGES.GADGETEER,
    name: "Gadgeteer",
    description: "Land 15 gadget impacts (impact web, restraint, tech pulse or web pull hits).",
    eventType: PROGRESS_EVENTS.GADGET_HIT,
    target: 15,
    unit: "gadget hits",
    reward: { items: [], suits: ["advanced"], text: "Advanced Tech Suit unlocked" },
  },
  {
    id: CHALLENGES.SPEEDSTER,
    name: "Speedster",
    description: "Travel 500 blocks with the Web Zip (web pull gadget aimed at surfaces).",
    eventType: PROGRESS_EVENTS.ZIP_DISTANCE,
    target: 500,
    unit: "blocks zipped",
    reward: { items: [], suits: ["urban"], text: "Urban Suit unlocked" },
  },
]);

export const CHALLENGE_BY_ID = Object.freeze(
  Object.fromEntries(CHALLENGE_DEFS.map((c) => [c.id, c]))
);

export function isChallengeId(id) {
  return Object.prototype.hasOwnProperty.call(CHALLENGE_BY_ID, id);
}

/**
 * Pure reducer: applies a progression event to the player's challenge state.
 *
 * @param {object} state {activeId|null, progress:number}
 * @param {object} save   persisted save blob (completedChallenges, rewardedChallenges, lifetime)
 * @param {{type:string, amount:number}} event
 * @returns {{state:{activeId,progress}, save:object, completed:object|null, ignored:boolean}}
 *   `completed` is the challenge def when this event finished it.
 */
export function applyProgressEvent(state, save, event) {
  const out = {
    state: { activeId: state?.activeId ?? null, progress: Number(state?.progress) || 0 },
    save,
    completed: null,
    ignored: false,
  };
  if (!event || typeof event.type !== "string") {
    out.ignored = true;
    return out;
  }
  const amount = Number.isFinite(Number(event.amount)) ? Math.max(0, Number(event.amount)) : 0;

  // Lifetime stats always accumulate (bounded).
  const lifetime = { ...(save.lifetime || {}) };
  if (event.type === PROGRESS_EVENTS.SWING_TIME) lifetime.swingSeconds = bounded(lifetime.swingSeconds, amount);
  if (event.type === PROGRESS_EVENTS.CLIMB_UP) lifetime.climbBlocks = bounded(lifetime.climbBlocks, amount);
  if (event.type === PROGRESS_EVENTS.ZIP_DISTANCE) lifetime.zipBlocks = bounded(lifetime.zipBlocks, amount);
  if (event.type === PROGRESS_EVENTS.ENEMY_DEFEATED) lifetime.enemiesDefeated = bounded(lifetime.enemiesDefeated, amount);
  if (event.type === PROGRESS_EVENTS.RESTRAIN) lifetime.restrainsLanded = bounded(lifetime.restrainsLanded, amount);
  if (event.type === PROGRESS_EVENTS.GADGET_HIT) lifetime.gadgetHits = bounded(lifetime.gadgetHits, amount);
  const nextSave = { ...save, lifetime };

  // Only the ACTIVE challenge progresses (one at a time keeps the HUD honest).
  const activeId = out.state.activeId;
  if (!activeId || !isChallengeId(activeId)) {
    out.ignored = true;
    out.save = nextSave;
    return out;
  }
  const def = CHALLENGE_BY_ID[activeId];
  if (def.eventType !== event.type) {
    out.ignored = true;
    out.save = nextSave;
    return out;
  }
  if (nextSave.completedChallenges && nextSave.completedChallenges[activeId] !== undefined) {
    // Already completed earlier — do not re-progress or re-complete.
    out.ignored = true;
    out.state = { activeId: null, progress: 0 };
    out.save = nextSave;
    return out;
  }

  const progress = Math.min(def.target, (Number(out.state.progress) || 0) + amount);
  out.save = nextSave;

  if (progress >= def.target) {
    out.state = { activeId: null, progress: 0 };
    out.save = {
      ...nextSave,
      completedChallenges: { ...(nextSave.completedChallenges || {}), [activeId]: amount === 0 ? 1 : Date.now ? safeNow() : 1 },
    };
    out.completed = def;
  } else {
    out.state = { activeId, progress };
  }
  return out;
}

function safeNow() {
  try {
    return Date.now();
  } catch {
    return 1;
  }
}

function bounded(prev, amount) {
  const n = Number(prev) || 0;
  return Math.min(1e12, n + amount);
}

/**
 * Marks a challenge reward as claimed. Returns null when it was already
 * claimed (idempotent — prevents duplicate rewards on repeated events,
 * spec §13.2 / §25.4).
 */
export function claimReward(save, challengeId) {
  if (!isChallengeId(challengeId)) return null;
  if (!save.completedChallenges || save.completedChallenges[challengeId] === undefined) return null;
  if (save.rewardedChallenges && save.rewardedChallenges[challengeId]) return null; // already claimed
  return {
    ...save,
    rewardedChallenges: { ...(save.rewardedChallenges || {}), [challengeId]: true },
  };
}

/** Progress fraction 0..1 for the active challenge (HUD). */
export function progressFraction(state) {
  const activeId = state?.activeId;
  if (!activeId || !isChallengeId(activeId)) return 0;
  const def = CHALLENGE_BY_ID[activeId];
  return Math.min(1, (Number(state?.progress) || 0) / def.target);
}
