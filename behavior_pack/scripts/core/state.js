// core/state.js — central per-player runtime state (spec §4.2 PlayerStateService).
// One map keyed by player.id; every system reads/writes through these helpers
// so state ownership and cleanup stay explicit (spec §7.4, §20).
// Runtime state is memory-only; the persisted slice lives in save.js.

import { MOVE_STATE, COOLDOWN_CATEGORIES, SUITS } from "./constants.js";
import { DEFAULT_SETTINGS } from "./save_schema.js";
import { NEUTRAL_PASSIVES, SUIT_PASSIVES } from "./config.js";
import { pruneCooldowns } from "./cooldowns.js";

/** playerId -> runtime state */
const states = new Map();

export function createState(playerId, playerName, saveData) {
  const state = {
    playerId,
    playerName,
    // --- movement/ability state machine (single owner: traversal/climbing) ---
    move: MOVE_STATE.IDLE,
    traversal: {
      anchor: null, // {x,y,z} block center (validated coordinates, not a Block handle)
      anchorDim: null, // dimension id the anchor lives in
      anchorBlockPos: null, // integer block coords for revalidation
      ropeLen: 0,
      startedTick: 0,
      lastRevalidateTick: 0,
      releaseGraceUntil: 0, // no reattach before this tick (spec §6.6)
      zipStartedTick: 0,
      lastZipPos: null,
    },
    climb: {
      wallNormal: null, // horizontal unit vec pointing wall→player
      wallPos: null, // wall block coords
      attachedTick: 0,
      lostWallSince: null, // tick the wall went missing (grace window)
      lastY: 0, // for climb-up statistics
    },
    glide: { untilTick: 0 },
    // --- combat ---
    combat: {
      comboStacks: 0,
      lastHitTick: -1000,
      lastBonusTick: -1000,
      dodgeReadyTick: 0,
      lastDodgeTick: -1000,
      platingReadyTick: 0,
    },
    // --- suit ---
    suit: { id: null, itemId: null, sinceTick: 0 },
    // --- gadgets ---
    cooldowns: {}, // gadgetId -> readyTick (timestamp based, see cooldowns.js)
    scanner: { untilTick: 0, lastReportTick: 0 },
    // --- spider-sense ---
    sense: { lastAlertTick: -1000, threat: null },
    // --- challenges ---
    challenge: { activeId: null, progress: 0 },
    // --- transient HUD messages ---
    hud: { line: "", untilTick: 0, priority: 0 },
    // --- lifecycle bookkeeping ---
    lastDimensionId: null,
    lastPos: null,
    deadUntilRespawn: false,
    menuOpen: false,
    save: saveData, // validated save blob (schema-checked)
    dirty: false, // persistence throttle flag
    lastSaveTick: 0,
    initialized: true,
  };
  states.set(playerId, state);
  return state;
}

export function getState(playerId) {
  return states.get(playerId) ?? null;
}

export function hasState(playerId) {
  return states.has(playerId);
}

export function getAllStates() {
  return states.values();
}

export function deleteState(playerId) {
  states.delete(playerId);
}

export function markDirty(state) {
  if (state) state.dirty = true;
}

/**
 * Resets everything a death/respawn/dimension change must clear (spec §20).
 * `keepSave` preserves the persisted blob (it lives on the dynamic property).
 */
export function resetTransientState(state, now) {
  if (!state) return;
  state.move = MOVE_STATE.IDLE;
  state.traversal.anchor = null;
  state.traversal.anchorDim = null;
  state.traversal.anchorBlockPos = null;
  state.traversal.ropeLen = 0;
  state.traversal.releaseGraceUntil = (now ?? 0) + 10;
  state.traversal.zipStartedTick = 0;
  state.traversal.lastZipPos = null;
  state.climb.wallNormal = null;
  state.climb.wallPos = null;
  state.climb.lostWallSince = null;
  state.glide.untilTick = 0;
  state.combat.comboStacks = 0;
  state.sense.threat = null;
  state.scanner.untilTick = 0;
  state.hud.line = "";
  state.hud.untilTick = 0;
  state.menuOpen = false;
}

/** True when the movement system currently owns player velocity. */
export function isTraversalOwned(state) {
  return state.move === MOVE_STATE.SWINGING || state.move === MOVE_STATE.ZIPPING;
}

export function isClimbOwned(state) {
  return state.move === MOVE_STATE.CLIMBING;
}

/** Effective suit passives (neutral when no suit equipped). */
export function passivesOf(state) {
  const id = state?.suit?.id;
  if (id && Object.prototype.hasOwnProperty.call(SUIT_PASSIVES, id)) {
    return SUIT_PASSIVES[id];
  }
  return NEUTRAL_PASSIVES;
}

/** Settings accessor with defaults (never returns undefined fields). */
export function settingsOf(state) {
  const s = state?.save?.settings;
  if (!s || typeof s !== "object") return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...s };
}

/** Gadget cooldown bookkeeping (timestamp based — no timers to leak). */
export function setCooldown(state, gadgetId, readyTick) {
  state.cooldowns[gadgetId] = readyTick;
}

export function getCooldown(state, gadgetId) {
  return state.cooldowns[gadgetId];
}

export function pruneStateCooldowns(state, now) {
  state.cooldowns = pruneCooldowns(state.cooldowns, now);
}

/** Transient HUD toast with priority (higher wins; equal → latest replaces). */
export function pushHudMessage(state, line, now, durationTicks = 40, priority = 1) {
  if (!state) return;
  if (priority < state.hud.priority && now < state.hud.untilTick) return; // more important line showing
  state.hud.line = line;
  state.hud.untilTick = now + durationTicks;
  state.hud.priority = priority;
}

/** Cooldown categories used for the vanilla cooldown bar (startItemCooldown). */
export { COOLDOWN_CATEGORIES };
