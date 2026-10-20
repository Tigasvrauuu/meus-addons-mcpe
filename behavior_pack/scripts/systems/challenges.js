// systems/challenges.js — ProgressionService (spec §13).
// Runtime wrapper around the pure reducer (challenge_rules.js): subscribes to
// the progression bus, starts/stops challenges, grants rewards exactly once,
// and keeps the save blob dirty-flagged for throttled persistence.

import { ItemStack } from "@minecraft/server";
import { CHALLENGE_DEFS, CHALLENGE_BY_ID, isChallengeId, applyProgressEvent, claimReward, progressFraction } from "./challenge_rules.js";
import { getState, markDirty } from "../core/state.js";
import { loadPlayerSave, persistPlayerSave } from "../core/save.js";
import { sfx, toast } from "../ui/hud.js";
import { on } from "../core/bus.js";
import { errorThrottled, info } from "../core/logger.js";
import * as suits from "./suits.js";

let initialized = false;

/** Called once from lifecycle init: wires the bus subscription. */
export function initChallenges() {
  if (initialized) return; // never subscribe twice (spec §4.4)
  initialized = true;
  on("progress", (evt) => {
    try {
      handleProgress(evt);
    } catch (err) {
      errorThrottled("challenges.progress", err);
    }
  });
}

export function listChallenges() {
  return CHALLENGE_DEFS;
}

export function activeChallenge(state) {
  const id = state?.challenge?.activeId;
  return id && isChallengeId(id) ? CHALLENGE_BY_ID[id] : null;
}

export function isCompleted(state, challengeId) {
  return state?.save?.completedChallenges?.[challengeId] !== undefined;
}

export function startChallenge(player, state, challengeId, now) {
  if (!isChallengeId(challengeId)) return { ok: false, message: "Unknown challenge." };
  if (isCompleted(state, challengeId)) return { ok: false, message: "Already completed — pick another." };
  state.challenge.activeId = challengeId;
  state.challenge.progress = 0;
  markDirty(state);
  const def = CHALLENGE_BY_ID[challengeId];
  sfx(player, "CHALLENGE_START");
  toast(player, state, now, `§b★ Challenge started: §f${def.name}`, 60, 4);
  return { ok: true, message: def.name };
}

export function stopChallenge(player, state, now) {
  const active = activeChallenge(state);
  state.challenge.activeId = null;
  state.challenge.progress = 0;
  markDirty(state);
  if (active) toast(player, state, now, `§7Challenge cancelled: ${active.name}`, 40, 2);
  return { ok: true };
}

/** Progress line for HUD/menus: "12/30 s swung". */
export function progressText(state) {
  const def = activeChallenge(state);
  if (!def) return null;
  const p = Math.floor(Number(state.challenge.progress) || 0);
  return `${def.name}: ${formatAmount(p, def)} / ${formatAmount(def.target, def)} ${def.unit}`;
}

export function progressPct(state) {
  return progressFraction(state.challenge);
}

function formatAmount(v, def) {
  if (def.eventType === "climb_up" || def.eventType === "zip_distance") return Math.floor(v);
  if (def.eventType === "swing_time") return Math.floor(v);
  return Math.floor(v);
}

// ---------------------------------------------------------------------------
// bus handler
// ---------------------------------------------------------------------------

function handleProgress(evt) {
  if (!evt || typeof evt.playerId !== "string") return;
  const state = getState(evt.playerId);
  if (!state) return;

  const before = state.challenge.activeId;
  const result = applyProgressEvent(state.challenge, state.save, { type: evt.type, amount: evt.amount });
  state.challenge = result.state;
  state.save = result.save;

  if (result.state.activeId !== before || result.state.progress !== undefined) markDirty(state);

  if (result.completed) {
    completeChallenge(state, result.completed);
  }
}

function completeChallenge(state, def) {
  // Reward claim is idempotent (guarded in claimReward + rewardedChallenges).
  const claimed = claimReward(state.save, def.id);
  if (!claimed) {
    info(`challenge ${def.id} completed for ${state.playerName} but reward was already claimed`);
    return;
  }
  state.save = claimed;
  markDirty(state);

  const player = resolvePlayer(state.playerId);
  const now = currentTick();

  if (player) {
    sfx(player, "CHALLENGE_DONE");
    toast(player, state, now, `§6★ CHALLENGE COMPLETE: §f${def.name}§6 — ${def.reward.text}`, 100, 5);
    // Grant item rewards.
    for (const grant of def.reward.items ?? []) {
      giveItem(player, grant.typeId, grant.count);
    }
    // Grant suit unlocks.
    for (const suitId of def.reward.suits ?? []) {
      suits.grantSuitItem(player, state, suitId, now, "challenge reward");
    }
    // Persist immediately: rewards must survive a crash right after claim.
    persistPlayerSave(player, state);
  } else {
    info(`challenge ${def.id} completed for offline player ${state.playerName}; rewards stored as claimed`);
    // Items cannot be delivered offline; unlock flags are stored, and the
    // suit can be re-granted from the station's "recover rewards" flow.
  }
}

// ---------------------------------------------------------------------------
// small runtime bridges (kept local so the reducer stays pure)
// ---------------------------------------------------------------------------

let worldRef = null;
let systemRef = null;
export function bindRuntime({ world, system }) {
  worldRef = world;
  systemRef = system;
}

function resolvePlayer(playerId) {
  try {
    if (!worldRef) return null;
    return worldRef.getPlayers().find((p) => p.id === playerId) ?? null;
  } catch {
    return null;
  }
}

function currentTick() {
  try {
    return systemRef?.currentTick ?? 0;
  } catch {
    return 0;
  }
}

function giveItem(player, typeId, count) {
  try {
    const container = player.getComponent("inventory")?.container;
    if (!container) return false;
    const stack = new ItemStack(typeId, count);
    const leftover = container.addItem(stack);
    if (leftover) {
      try { player.dimension.spawnItem(leftover, player.location); } catch { /* ignore */ }
    }
    return true;
  } catch (err) {
    errorThrottled("challenges.giveItem", err);
    return false;
  }
}
