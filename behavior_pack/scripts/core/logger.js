// core/logger.js — diagnostics with deduplication (spec §0.3: report actionable
// errors without flooding the log; §4.4: handle errors at feature boundaries).

const PREFIX = "[SMX]";

/** message key -> {count, lastTick} for dedupe. Bounded map. */
const recent = new Map();
const DEDUPE_WINDOW_TICKS = 200;
const MAX_KEYS = 64;

let debugEnabled = false;
let tickSource = () => 0;

/** Wire the logger to system.currentTick so dedupe windows work. */
export function initLogger(getTick, opts = {}) {
  if (typeof getTick === "function") tickSource = getTick;
  debugEnabled = !!opts.debug;
}

export function setDebug(enabled) {
  debugEnabled = !!enabled;
}

export function isDebugEnabled() {
  return debugEnabled;
}

export function info(message) {
  try {
    // eslint-disable-next-line no-console
    console.warn(`${PREFIX} ${message}`);
  } catch {
    /* console may be unavailable in some hosts — never throw from logging */
  }
}

export function debug(message) {
  if (!debugEnabled) return;
  info(message);
}

/**
 * Logs an error at most once per DEDUPE_WINDOW_TICKS per unique context+message
 * pair; repeats are counted and the count is included when it logs again.
 */
export function errorThrottled(context, err) {
  try {
    const key = String(context);
    const message = err && err.message ? err.message : String(err);
    const now = tickSource() || 0;
    let entry = recent.get(key);
    if (!entry) {
      if (recent.size >= MAX_KEYS) {
        // Evict the oldest entry to bound memory.
        const oldestKey = recent.keys().next().value;
        if (oldestKey !== undefined) recent.delete(oldestKey);
      }
      entry = { count: 0, lastTick: -DEDUPE_WINDOW_TICKS - 1 };
    }
    entry.count += 1;
    if (now - entry.lastTick >= DEDUPE_WINDOW_TICKS) {
      entry.lastTick = now;
      const repeat = entry.count > 1 ? ` (x${entry.count} since last report)` : "";
      info(`ERROR in ${context}: ${message}${repeat}`);
      entry.count = 0;
    }
    recent.set(key, entry);
  } catch {
    /* logging must never throw */
  }
}

/**
 * Runs `fn` inside an error boundary tied to a feature context. Returns
 * `fallback` when it throws (used to keep optional effects — particles, sounds,
 * HUD — from ever breaking traversal, spec §0.2).
 */
export function guarded(context, fn, fallback = undefined) {
  try {
    return fn();
  } catch (err) {
    errorThrottled(context, err);
    return fallback;
  }
}

/**
 * Like guarded() but for optional cosmetics: on failure it silently falls back
 * and only counts the failure (no log spam even at debug level).
 */
const cosmeticFailures = new Map();
export function cosmetic(context, fn) {
  try {
    return fn();
  } catch {
    cosmeticFailures.set(context, (cosmeticFailures.get(context) || 0) + 1);
    return undefined;
  }
}

export function cosmeticFailureCount(context) {
  return cosmeticFailures.get(context) || 0;
}
