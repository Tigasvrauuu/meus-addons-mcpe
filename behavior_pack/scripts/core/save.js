// core/save.js — PersistenceService (spec §19). Per-player dynamic property
// "smx:data" holding a JSON blob. All loads pass through validateSaveData
// (schema check + migration + safe defaults); writes are throttled (dirty
// flag + flush cadence) and forced on leave/death/menu actions.

import { SAVE_KEY } from "./constants.js";
import { validateSaveData, serializeSave } from "./save_schema.js";
import { info, errorThrottled } from "./logger.js";

/** Loads (and validates) the save blob for a player. Never throws. */
export function loadPlayerSave(player) {
  try {
    const raw = player.getDynamicProperty(SAVE_KEY);
    const { data, repaired, fresh } = validateSaveData(raw);
    if (repaired.length > 0) {
      info(`save repaired for ${safeName(player)}: ${repaired.join("; ")}`);
    }
    return { data, fresh };
  } catch (err) {
    errorThrottled("save.load", err);
    const { data } = validateSaveData(undefined);
    return { data, fresh: true };
  }
}

/** Serializes the state's save blob onto the player's dynamic property. */
export function persistPlayerSave(player, state) {
  if (!player || !state || !state.save) return false;
  try {
    player.setDynamicProperty(SAVE_KEY, serializeSave(state.save));
    state.dirty = false;
    return true;
  } catch (err) {
    errorThrottled("save.persist", err);
    return false;
  }
}

/** Flushes dirty saves for all players when the cadence has elapsed. */
export function flushDueSaves(playersById, states, now, flushEveryTicks) {
  for (const state of states) {
    if (!state.dirty) continue;
    if (now - state.lastSaveTick < flushEveryTicks) continue;
    const player = playersById.get(state.playerId);
    if (player && persistPlayerSave(player, state)) {
      state.lastSaveTick = now;
    }
  }
}

/** Force-save helper used by lifecycle events (leave/death) and menus. */
export function saveNow(player, state) {
  if (persistPlayerSave(player, state)) {
    state.lastSaveTick = -1e9; // allow immediate re-save later without waiting
  }
}

function safeName(player) {
  try {
    return player.name ?? "unknown";
  } catch {
    return "unknown";
  }
}
