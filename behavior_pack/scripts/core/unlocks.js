// Pure unlock rules. A suit or gadget unlocks once its stat reaches the
// configured minimum, and an unlock is never revoked or granted twice.
import { GADGETS, GADGET_ORDER, SUITS, SUIT_ORDER } from "./config.js";

export function meetsRequirement(profile, requirement) {
  if (!requirement) return true;
  const value = profile.stats[requirement.stat] ?? 0;
  return value >= requirement.min;
}

export function isSuitUnlocked(profile, suitId) {
  return profile.unlockedSuits.includes(suitId);
}

export function isGadgetUnlocked(profile, gadgetId) {
  return profile.unlockedGadgets.includes(gadgetId);
}

// Adds every newly earned suit/gadget to the profile and returns their names,
// e.g. [{ kind: "gadget", id: "tech_pulse" }]. Idempotent: repeated calls with
// no new progress return an empty list.
export function applyNewUnlocks(profile) {
  const added = [];
  for (const id of SUIT_ORDER) {
    if (isSuitUnlocked(profile, id)) continue;
    if (meetsRequirement(profile, SUITS[id].unlock)) {
      profile.unlockedSuits.push(id);
      added.push({ kind: "suit", id });
    }
  }
  for (const id of GADGET_ORDER) {
    if (isGadgetUnlocked(profile, id)) continue;
    if (meetsRequirement(profile, GADGETS[id].unlock)) {
      profile.unlockedGadgets.push(id);
      added.push({ kind: "gadget", id });
    }
  }
  return added;
}

export function requirementText(kind, id) {
  const def = kind === "suit" ? SUITS[id] : GADGETS[id];
  if (!def || !def.unlock) return "Available from the start";
  return def.unlock.text;
}
