// core/save_schema.js — PURE module (no @minecraft imports; unit-testable in Node).
// Validation & migration of the persisted per-player save blob (spec §19.1).
// Everything loaded from dynamic properties passes through validateSaveData:
// missing/corrupted fields fall back to safe defaults and are reported so the
// runtime can log repairs instead of crashing initialization.

import { SAVE_SCHEMA } from "./constants.js";
import { CONFIG } from "./config.js";
import { CHALLENGES } from "./constants.js";

const CHALLENGE_IDS = new Set(Object.values(CHALLENGES));

export const DEFAULT_SETTINGS = Object.freeze({
  senseEnabled: true,
  senseSound: true,
  senseShake: true,
  autoClimb: CONFIG.climbing.enabledByDefault,
  reducedParticles: false,
  debug: false,
});

/** Shape of a valid save blob (schema v1). */
function blankSave() {
  return {
    schema: SAVE_SCHEMA,
    seenIntro: false,
    settings: { ...DEFAULT_SETTINGS },
    unlockedSuits: ["improvised", "classic"], // earned/purchased/granted suit ids
    completedChallenges: {}, // id -> completion tick (number)
    rewardedChallenges: {}, // id -> true (reward claim guard, spec §13.2)
    records: {}, // id -> best numeric record
    lifetime: {
      swingSeconds: 0,
      climbBlocks: 0,
      zipBlocks: 0,
      enemiesDefeated: 0,
      restrainsLanded: 0,
      gadgetHits: 0,
    },
  };
}

const asBool = (v, fallback) => (typeof v === "boolean" ? v : fallback);
const asNum = (v, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
};
const asStringArray = (v, fallback) =>
  Array.isArray(v) ? v.filter((s) => typeof s === "string") : fallback;

/**
 * Validates (and migrates) raw persisted data.
 * @param {unknown} raw value read from the dynamic property (string → parse)
 * @returns {{data:object, repaired:string[], fresh:boolean}}
 */
export function validateSaveData(raw) {
  const repaired = [];
  let parsed = raw;

  if (typeof raw === "string") {
    if (raw.trim() === "") {
      return { data: blankSave(), repaired, fresh: true };
    }
    try {
      parsed = JSON.parse(raw);
    } catch {
      repaired.push("payload was not valid JSON; reset to defaults");
      return { data: blankSave(), repaired, fresh: true };
    }
  }

  if (parsed === undefined || parsed === null) {
    return { data: blankSave(), repaired, fresh: true };
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    repaired.push("payload was not an object; reset to defaults");
    return { data: blankSave(), repaired, fresh: true };
  }

  let data = migrate(parsed, repaired);

  const out = blankSave();
  out.schema = SAVE_SCHEMA;
  out.seenIntro = asBool(data.seenIntro, false);

  if (data.settings && typeof data.settings === "object") {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      out.settings[key] = asBool(data.settings[key], DEFAULT_SETTINGS[key]);
    }
  } else if (data.settings !== undefined) {
    repaired.push("settings block corrupted; defaults restored");
  }

  out.unlockedSuits = Array.from(
    new Set(asStringArray(data.unlockedSuits, out.unlockedSuits))
  ).filter((s) => typeof s === "string" && s.length > 0 && s.length < 40);
  if (!out.unlockedSuits.includes("classic")) out.unlockedSuits.push("classic");
  if (!out.unlockedSuits.includes("improvised")) out.unlockedSuits.push("improvised");

  out.completedChallenges = sanitizeIdMap(data.completedChallenges, repaired, "completedChallenges");
  out.rewardedChallenges = sanitizeBoolMap(data.rewardedChallenges, repaired, "rewardedChallenges");
  out.records = sanitizeNumMap(data.records, repaired, "records");

  if (data.lifetime && typeof data.lifetime === "object") {
    for (const key of Object.keys(out.lifetime)) {
      out.lifetime[key] = asNum(data.lifetime[key], 0, 0, 1e12);
    }
  } else if (data.lifetime !== undefined) {
    repaired.push("lifetime stats corrupted; zeroed");
  }

  return { data: out, repaired, fresh: false };
}

/** Serializes to the compact string stored in the dynamic property. */
export function serializeSave(data) {
  return JSON.stringify(data);
}

/**
 * Forward migrations. Each step upgrades one schema version and records what
 * it changed. Unknown future schemas are clamped down defensively.
 */
function migrate(data, repaired) {
  let current = { ...data };
  let schema = asNum(current.schema, 0, 0, 9999);

  if (schema > SAVE_SCHEMA) {
    // Saved by a newer version of the pack: keep compatible fields only.
    repaired.push(`save schema ${schema} is newer than ${SAVE_SCHEMA}; compatible fields kept`);
    schema = SAVE_SCHEMA;
  }

  // v0 (unversioned/legacy) → v1: nothing structural to convert yet; the
  // validator below fills every missing field. Hook kept for future use.
  if (schema < 1) {
    repaired.push("legacy save migrated to schema v1");
    schema = 1;
  }

  current.schema = schema;
  return current;
}

function sanitizeIdMap(raw, repaired, label) {
  const out = {};
  if (raw === undefined || raw === null) return out;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    repaired.push(`${label} corrupted; cleared`);
    return out;
  }
  for (const [k, v] of Object.entries(raw)) {
    if (!CHALLENGE_IDS.has(k)) continue; // unknown ids are dropped, never trusted
    out[k] = asNum(v, 0, 0, Number.MAX_SAFE_INTEGER);
  }
  return out;
}

function sanitizeBoolMap(raw, repaired, label) {
  const out = {};
  if (raw === undefined || raw === null) return out;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    repaired.push(`${label} corrupted; cleared`);
    return out;
  }
  for (const [k, v] of Object.entries(raw)) {
    if (!CHALLENGE_IDS.has(k)) continue;
    out[k] = asBool(v, false);
  }
  return out;
}

function sanitizeNumMap(raw, repaired, label) {
  const out = {};
  if (raw === undefined || raw === null) return out;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    repaired.push(`${label} corrupted; cleared`);
    return out;
  }
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== "string" || k.length > 40) continue;
    out[k] = asNum(v, 0, -1e12, 1e12);
  }
  return out;
}
