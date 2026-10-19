// Player data storage using per-player dynamic properties.
//  - Loaded once per player and cached.
//  - Written only when marked dirty (debounced by the main loop), not every tick.
//  - Every loaded value is validated by profile.js before use.
import { PACK } from "./config.js";
import { parseProfile, serializeProfile } from "./profile.js";
import { warnOnce, errorOnce } from "./diagnostics.js";

const cache = new Map(); // player.id -> { player, profile }
const dirty = new Map(); // player.id -> player

export function getProfile(player) {
  return loadProfile(player);
}

export function loadProfile(player) {
  const cached = cache.get(player.id);
  if (cached) {
    cached.player = player;
    return cached.profile;
  }
  let text;
  try {
    text = player.getDynamicProperty(PACK.profileKey);
  } catch (error) {
    errorOnce("profile-read", error);
  }
  const parsed = parseProfile(typeof text === "string" ? text : undefined);
  if (parsed.repaired && text !== undefined) {
    warnOnce("profile-repair", `Saved profile for ${player.name} was invalid and has been repaired.`);
  }
  cache.set(player.id, { player, profile: parsed.profile });
  if (parsed.repaired) markDirty(player);
  return parsed.profile;
}

export function markDirty(player) {
  dirty.set(player.id, player);
}

export function saveNow(player) {
  const entry = cache.get(player.id);
  if (!entry || !player.isValid) return false;
  try {
    player.setDynamicProperty(PACK.profileKey, serializeProfile(entry.profile));
    dirty.delete(player.id);
    return true;
  } catch (error) {
    errorOnce("profile-write", error);
    return false;
  }
}

export function flushDirty() {
  for (const [id, player] of dirty) {
    if (!player.isValid) {
      dirty.delete(id);
      continue;
    }
    saveNow(player);
  }
}

// Forget a player's cache when they leave. Dirty data for a player who has
// already left cannot be written; the periodic flush keeps that window short.
export function evictProfile(playerId) {
  cache.delete(playerId);
  dirty.delete(playerId);
}
