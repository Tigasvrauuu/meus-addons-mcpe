// core/cooldowns.js — PURE module (no @minecraft imports; unit-testable in Node).
// Timestamp-based cooldown math. No per-activation timers are created (spec
// §20): readiness is always derived from `system.currentTick`, so cooldowns
// survive lag, cannot duplicate, and need no cleanup.

/**
 * @param {number|undefined|null} readyTick tick at which the ability is ready (undefined = ready)
 * @param {number} now current tick
 */
export function isReady(readyTick, now) {
  if (readyTick === undefined || readyTick === null) return true;
  const r = Number(readyTick);
  if (!Number.isFinite(r)) return true; // corrupted value → fail open, never lock a player out
  return now >= r;
}

/** Ticks remaining (never negative). */
export function remaining(readyTick, now) {
  if (isReady(readyTick, now)) return 0;
  return Math.ceil(Number(readyTick) - now);
}

/** Human friendly "3.5s" style string for HUD/menus. */
export function formatRemaining(readyTick, now, ticksPerSecond = 20) {
  const rem = remaining(readyTick, now);
  if (rem <= 0) return "READY";
  const secs = rem / ticksPerSecond;
  return `${secs >= 10 ? Math.round(secs) : secs.toFixed(1)}s`;
}

/**
 * Computes the next ready tick, applying a cooldown multiplier (suit passive).
 * Multiplier is clamped to [0.25, 2] so a corrupted passive can never create
 * zero or infinite cooldowns.
 */
export function nextReadyTick(now, baseTicks, multiplier = 1) {
  const base = Number(baseTicks);
  const mult = Number(multiplier);
  const b = Number.isFinite(base) ? Math.max(0, base) : 0;
  const m = Number.isFinite(mult) ? Math.min(2, Math.max(0.25, mult)) : 1;
  return now + Math.round(b * m);
}

/**
 * A tiny per-entity cooldown map helper (used for gadget cooldowns stored on
 * the player's runtime state). Pure: takes and returns plain objects.
 */
export function markCooldown(map, key, readyTick) {
  const next = { ...map };
  next[key] = readyTick;
  return next;
}

/** Drops entries that expired more than `graceTicks` ago (bounded memory). */
export function pruneCooldowns(map, now, graceTicks = 400) {
  const out = {};
  for (const [k, v] of Object.entries(map || {})) {
    if (Number(v) > now - graceTicks) out[k] = v;
  }
  return out;
}
