// ui/hud.js — feedback layer (spec §16.1, §17.2). Action-bar HUD, transient
// toasts, sound cues and particles. Every effect is optional/cosmetic: all
// calls are guarded so a missing particle or sound can never break traversal
// (spec §0.2). Reduced-particles setting is honored here in one place.

import { SOUNDS, PARTICLES, FALLBACK_PARTICLES } from "../core/constants.js";
import { cosmetic, errorThrottled } from "../core/logger.js";
import { pushHudMessage } from "../core/state.js";
import { relativeArrow } from "../core/utils.js";

/** Play a named sound cue for one player. */
export function sfx(player, key, overrides = {}) {
  const cue = SOUNDS[key];
  if (!cue) return;
  cosmetic(`sfx.${key}`, () => {
    player.playSound(cue.id, {
      volume: overrides.volume ?? cue.volume,
      pitch: overrides.pitch ?? cue.pitch,
    });
  });
}

/** Play a sound at a world location (dimension-scoped, for enemy-side cues). */
export function sfxAt(dimension, key, location, overrides = {}) {
  const cue = SOUNDS[key];
  if (!cue) return;
  cosmetic(`sfxAt.${key}`, () => {
    dimension.playSound(cue.id, location, {
      volume: overrides.volume ?? cue.volume,
      pitch: overrides.pitch ?? cue.pitch,
    });
  });
}

/**
 * Spawns a custom particle; falls back to a vanilla effect when the custom
 * emitter cannot be resolved (e.g. resource pack missing). Returns true when
 * something was spawned.
 */
export function fx(dimension, key, location, opts = {}) {
  if (opts.skip) return false;
  const name = PARTICLES[key];
  if (!name) return false;
  const ok = cosmetic(`fx.${key}`, () => {
    dimension.spawnParticle(name, location);
    return true;
  });
  if (ok) return true;
  const fallback = FALLBACK_PARTICLES[key];
  if (!fallback) return false;
  return !!cosmetic(`fx.fb.${key}`, () => {
    dimension.spawnParticle(fallback, location);
    return true;
  });
}

/** Spawns a particle at every point (bounded caller-side). */
export function fxPoints(dimension, key, points, opts = {}) {
  for (const p of points) fx(dimension, key, p, opts);
}

/** Transient toast shown on the action bar with priority. */
export function toast(player, state, now, text, durationTicks = 40, priority = 1) {
  pushHudMessage(state, text, now, durationTicks, priority);
}

/** Sets the persistent contextual action-bar line (state display). */
export function actionBar(player, text) {
  cosmetic("hud.actionBar", () => {
    player.onScreenDisplay.setActionBar(text);
  });
}

/** Clears the action bar (used when the player returns to plain idle). */
export function clearActionBar(player) {
  actionBar(player, " ");
}

/** Spider-sense alert line: symbol + direction + distance (spec §8.3). */
export function senseAlertText(distance, arrowChar, severity) {
  const bangs = severity >= 2 ? "!!!" : severity === 1 ? "!!" : "!";
  return `§c⚠ SPIDER-SENSE${bangs} §r${arrowChar} §c${distance.toFixed(1)}m`;
}

/** Directional arrow for a threat relative to the player's view. */
export function arrowTo(player, targetPos) {
  try {
    const rot = player.getRotation();
    return relativeArrow(rot.y, player.location, targetPos);
  } catch (err) {
    errorThrottled("hud.arrowTo", err);
    return "•";
  }
}

/** Cooldown pip strings for menus/HUD ("■■■□□"). */
export function cooldownPips(fraction, width = 5) {
  const f = Math.min(1, Math.max(0, Number(fraction) || 0));
  const filled = Math.round(f * width);
  return "■".repeat(filled) + "□".repeat(width - filled);
}
