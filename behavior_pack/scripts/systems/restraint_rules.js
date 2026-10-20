// systems/restraint_rules.js — PURE module (no @minecraft imports; unit-testable).
// Crowd-control classification (spec §9.5): light targets are fully webbed,
// heavy targets are slowed, elites/boss-class targets resist immobilization.

import { ENTITIES } from "../core/constants.js";
import { CONFIG } from "../core/config.js";

/** Target classes. */
export const TARGET_CLASS = Object.freeze({
  LIGHT: "light",
  HEAVY: "heavy",
  IMMUNE: "immune",
  INVALID: "invalid",
});

const HEAVY_TYPES = new Set([ENTITIES.BRUTE]);
const IMMUNE_TYPES = new Set([ENTITIES.ENFORCER]);

/**
 * Classifies a target for web restraint.
 *
 * @param {object} targetInfo
 * @param {string} targetInfo.typeId entity type id ("smx:brute", "minecraft:zombie", ...)
 * @param {boolean} [targetInfo.isPlayer] players are never valid targets
 * @param {boolean} [targetInfo.alive] false → invalid
 * @returns {{cls:string, durationTicks:number, slownessAmplifier:number, fullLock:boolean}}
 */
export function classifyRestraintTarget(targetInfo, cfg = CONFIG.combat) {
  if (!targetInfo || typeof targetInfo !== "object" || targetInfo.isPlayer || targetInfo.alive === false) {
    return { cls: TARGET_CLASS.INVALID, durationTicks: 0, slownessAmplifier: 0, fullLock: false };
  }
  const typeId = typeof targetInfo.typeId === "string" ? targetInfo.typeId : "";
  if (!typeId) {
    // Unknown/garbage target descriptor: refuse instead of guessing (spec §0.3).
    return { cls: TARGET_CLASS.INVALID, durationTicks: 0, slownessAmplifier: 0, fullLock: false };
  }

  if (IMMUNE_TYPES.has(typeId)) {
    return { cls: TARGET_CLASS.IMMUNE, durationTicks: 0, slownessAmplifier: 0, fullLock: false };
  }
  if (HEAVY_TYPES.has(typeId)) {
    return {
      cls: TARGET_CLASS.HEAVY,
      durationTicks: cfg.restraintHeavyTicks,
      slownessAmplifier: cfg.restraintHeavyAmplifier,
      fullLock: false,
    };
  }
  return {
    cls: TARGET_CLASS.LIGHT,
    durationTicks: cfg.restraintBaseTicks,
    slownessAmplifier: cfg.restraintSlownessAmplifier,
    fullLock: true,
  };
}

/**
 * Pull-ability for the web-pull gadget: heavy targets are pulled weakly,
 * immune targets not at all (spec §10.4 — bounded, no teleport surprises).
 * @returns {{mode:"none"|"weak"|"strong"}}
 */
export function classifyPullTarget(targetInfo) {
  if (!targetInfo || targetInfo.isPlayer || targetInfo.alive === false) return { mode: "none" };
  const typeId = typeof targetInfo.typeId === "string" ? targetInfo.typeId : "";
  if (IMMUNE_TYPES.has(typeId)) return { mode: "none" };
  if (HEAVY_TYPES.has(typeId)) return { mode: "weak" };
  return { mode: "strong" };
}

/**
 * Threat weight for Spider-Sense prioritization (spec §8.2). Lower = scarier.
 */
export function threatScore(typeId, dist, cfg = CONFIG.sense) {
  const d = Number.isFinite(dist) ? Math.max(0, dist) : cfg.radius;
  const w = Object.prototype.hasOwnProperty.call(cfg.typeWeights, typeId)
    ? Number(cfg.typeWeights[typeId]) || 1
    : Number(cfg.typeWeights.default) || 1;
  return d * w;
}
