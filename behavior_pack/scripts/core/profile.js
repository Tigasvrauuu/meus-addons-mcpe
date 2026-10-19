// Pure profile model: defaults, validation and migration of saved data.
// Every field read from storage passes through normalizeProfile, so corrupted
// or outdated data falls back to safe defaults instead of crashing.
import { GADGETS, GADGET_ORDER, SUITS, SUIT_ORDER, UNLOCK_STATS, MAX_STAT, PACK } from "./config.js";

export function defaultProfile() {
  const stats = {};
  for (const stat of UNLOCK_STATS) stats[stat] = 0;
  return {
    schema: PACK.profileSchema,
    suit: "classic",
    gadget: "impact_web",
    unlockedSuits: ["classic"],
    unlockedGadgets: ["impact_web"],
    stats,
    starterGiven: false,
    settings: { senseAlerts: true },
  };
}

function cleanStat(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(MAX_STAT, Math.max(0, Math.floor(value)));
}

function cleanIdList(list, known, required) {
  const out = [];
  if (Array.isArray(list)) {
    for (const id of list) {
      if (typeof id === "string" && known.includes(id) && !out.includes(id)) out.push(id);
    }
  }
  if (required && !out.includes(required)) out.unshift(required);
  return out;
}

// Accepts any value (parsed JSON or undefined) and returns a valid profile.
// Returns { profile, repaired } where repaired is true if anything was fixed.
export function normalizeProfile(raw) {
  const base = defaultProfile();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { profile: base, repaired: raw !== undefined && raw !== null };
  }
  let repaired = raw.schema !== PACK.profileSchema;

  const unlockedSuits = cleanIdList(raw.unlockedSuits, SUIT_ORDER, "classic");
  const unlockedGadgets = cleanIdList(raw.unlockedGadgets, GADGET_ORDER, "impact_web");

  let suit = typeof raw.suit === "string" && SUITS[raw.suit] ? raw.suit : "classic";
  if (!unlockedSuits.includes(suit)) {
    suit = "classic";
    repaired = true;
  }
  let gadget = typeof raw.gadget === "string" && GADGETS[raw.gadget] ? raw.gadget : "impact_web";
  if (!unlockedGadgets.includes(gadget)) {
    gadget = "impact_web";
    repaired = true;
  }

  const stats = {};
  for (const stat of UNLOCK_STATS) {
    stats[stat] = cleanStat(raw.stats ? raw.stats[stat] : 0);
  }

  const settings = {
    senseAlerts: raw.settings && typeof raw.settings.senseAlerts === "boolean" ? raw.settings.senseAlerts : true,
  };

  const profile = {
    schema: PACK.profileSchema,
    suit,
    gadget,
    unlockedSuits,
    unlockedGadgets,
    stats,
    starterGiven: raw.starterGiven === true,
    settings,
  };
  return { profile, repaired };
}

export function serializeProfile(profile) {
  return JSON.stringify(profile);
}

export function parseProfile(text) {
  if (typeof text !== "string" || text.length === 0) {
    return { profile: defaultProfile(), repaired: false };
  }
  try {
    return normalizeProfile(JSON.parse(text));
  } catch (error) {
    return { profile: defaultProfile(), repaired: true, error: String(error) };
  }
}
