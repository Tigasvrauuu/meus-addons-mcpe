// systems/traversal.js — WebTraversalService (spec §6, the signature system).
// Owns the SWINGING and ZIPPING movement states. Responsibilities:
//  - anchor acquisition via view-direction raycast with deterministic rules
//  - pendulum swing integration via the pure swing_math module
//  - momentum-preserving release with grace period
//  - web-zip toward a stored anchor (used by the web-pull gadget)
//  - periodic anchor revalidation + safe exits for every edge case (death,
//    dimension change, water, anchor destruction, chunk unload)
//  - strand/anchor particle feedback + sound cues
//
// All state is stored as validated coordinates (never Block handles) per
// spec §6.2 point 7.

import { CONFIG } from "../core/config.js";
import { MOVE_STATE, GADGETS, COOLDOWN_CATEGORIES, PROGRESS_EVENTS } from "../core/constants.js";
import { isEntityValid, readVelocity, setVelocity, chestLocation, lookDirection, blockCenter, blockPosOf, isSolidAnchorBlock, distanceBetween } from "../core/utils.js";
import { isReady, nextReadyTick, remaining } from "../core/cooldowns.js";
import { getState, isTraversalOwned, passivesOf, settingsOf, setCooldown, pushHudMessage } from "../core/state.js";
import { stepSwing, computeReleaseVelocity, stepZip, strandPoints, horizontalDelta } from "./swing_math.js";
import { sfx, fx, fxPoints, toast } from "../ui/hud.js";
import { jumpPressed, jumpHeld, sneakHeld, forwardInput, sprinting, onGround, inWater } from "../core/input.js";
import { emit } from "../core/bus.js";
import { errorThrottled } from "../core/logger.js";

export const FIRE_RESULT = Object.freeze({
  FIRED: "fired",
  NO_ANCHOR: "no_anchor",
  TOO_CLOSE: "too_close",
  TOO_LOW: "too_low",
  COOLDOWN: "cooldown",
  NO_SUIT: "no_suit",
  BUSY: "busy",
  GRACE: "grace",
  INVALID: "invalid",
  RELEASED: "released",
});

/**
 * Attempts to fire a web. When already swinging, firing again releases the
 * current web (toggle control that works on every platform, spec §6.5).
 */
export function fireOrRelease(player, state, now) {
  if (!isEntityValid(player) || !state) return FIRE_RESULT.INVALID;
  if (state.deadUntilRespawn) return FIRE_RESULT.INVALID;

  if (state.move === MOVE_STATE.SWINGING) {
    releaseWeb(player, state, now, { launch: false, reason: "toggle" });
    return FIRE_RESULT.RELEASED;
  }
  if (state.move === MOVE_STATE.ZIPPING) {
    // Interrupting a zip is always allowed and safe.
    endZip(player, state, now, "interrupted");
    return FIRE_RESULT.RELEASED;
  }
  if (state.move !== MOVE_STATE.IDLE) return FIRE_RESULT.BUSY; // climbing: detach happens via leap

  if (!state.suit.id) {
    toast(player, state, now, "§eEquip a Spider Suit first! §7(open the Spider Manual)", 50, 3);
    sfx(player, "THWIP_FAIL");
    return FIRE_RESULT.NO_SUIT;
  }
  if (now < state.traversal.releaseGraceUntil) return FIRE_RESULT.GRACE;
  if (!isReady(state.cooldowns[GADGETS.WEB_SHOOTER], now)) return FIRE_RESULT.COOLDOWN;

  const cfg = CONFIG.traversal;
  let hit;
  try {
    hit = player.getBlockFromViewDirection({
      maxDistance: cfg.maxWebRange,
      includeLiquidBlocks: false,
      includePassableBlocks: false,
    });
  } catch (err) {
    errorThrottled("traversal.raycast", err);
    return FIRE_RESULT.INVALID;
  }

  if (!hit || !hit.block) {
    sfx(player, "THWIP_FAIL");
    toast(player, state, now, "§7✕ No anchor in range §8— aim at a solid surface", 30, 2);
    return FIRE_RESULT.NO_ANCHOR;
  }

  const chest = chestLocation(player);
  const anchor = blockCenter(hit.block.location);
  const dist = distanceBetween(chest, anchor);
  if (dist < cfg.minAnchorDistance) {
    sfx(player, "THWIP_FAIL");
    toast(player, state, now, "§7✕ Too close §8— aim further out", 25, 2);
    return FIRE_RESULT.TOO_CLOSE;
  }
  if (anchor.y < player.location.y + cfg.minAnchorHeightAboveFeet) {
    sfx(player, "THWIP_FAIL");
    toast(player, state, now, "§7✕ Aim higher §8— webs need a point above you", 30, 2);
    return FIRE_RESULT.TOO_LOW;
  }

  attach(player, state, now, anchor, dist);
  return FIRE_RESULT.FIRED;
}

/** Internal: commits a validated anchor and enters the swing state. */
function attach(player, state, now, anchor, dist) {
  const cfg = CONFIG.traversal;
  state.move = MOVE_STATE.SWINGING;
  state.traversal.anchor = anchor;
  state.traversal.anchorDim = dimensionIdOf(player);
  state.traversal.anchorBlockPos = blockPosOf(anchor);
  state.traversal.ropeLen = Math.min(Math.max(cfg.minRopeLength, dist), cfg.maxWebRange);
  state.traversal.startedTick = now;
  state.traversal.lastRevalidateTick = now;
  state.traversal.lastZipPos = null;
  state.climb.wallNormal = null; // swing owns movement now (spec §7.4)
  state.glide.untilTick = 0;

  const passives = passivesOf(state);
  setCooldown(state, GADGETS.WEB_SHOOTER, nextReadyTick(now, CONFIG.gadgets.cooldowns.web_shooter, passives.gadgetCooldown));
  startVisualCooldown(player, COOLDOWN_CATEGORIES.WEB_SHOOTER, remaining(state.cooldowns[GADGETS.WEB_SHOOTER], now));

  sfx(player, "THWIP");
  sfx(player, "ANCHOR_HIT", { volume: 0.5 });
  fx(player.dimension, "WEB_ANCHOR", anchor);
  toast(player, state, now, `§f🕸 Web attached §7${dist.toFixed(0)}m §8· JUMP to release-launch`, 30, 2);
}

/**
 * Releases the web, preserving bounded momentum (spec §6.6).
 * @param {{launch?:boolean, reason?:string}} opts launch = jump-release boost
 */
export function releaseWeb(player, state, now, opts = {}) {
  if (state.move !== MOVE_STATE.SWINGING) return;
  const cfg = CONFIG.traversal;

  if (isEntityValid(player)) {
    const vel = readVelocity(player);
    const next = computeReleaseVelocity({ vel, launch: !!opts.launch, cfg });
    setVelocity(player, next);
    // Falling fast after release → brief web-glide window (bounded mitigation).
    if (next.y < -CONFIG.climbing.glideTriggerFallSpeed) {
      state.glide.untilTick = now + CONFIG.climbing.glideMaxTicks;
    }
    sfx(player, "RELEASE");
    if (opts.launch) {
      toast(player, state, now, "§f⤴ Web launch!", 25, 2);
    }
  }

  state.move = MOVE_STATE.IDLE;
  state.traversal.anchor = null;
  state.traversal.anchorDim = null;
  state.traversal.anchorBlockPos = null;
  state.traversal.ropeLen = 0;
  state.traversal.releaseGraceUntil = now + cfg.releaseGraceTicks;
}

/** Silent cleanup for death/dimension change/unload (no feedback, no velocity). */
export function cancelTraversal(state, now) {
  if (!state) return;
  if (state.move === MOVE_STATE.SWINGING || state.move === MOVE_STATE.ZIPPING) {
    state.move = MOVE_STATE.IDLE;
  }
  state.traversal.anchor = null;
  state.traversal.anchorDim = null;
  state.traversal.anchorBlockPos = null;
  state.traversal.ropeLen = 0;
  state.traversal.lastZipPos = null;
  state.traversal.releaseGraceUntil = (now ?? 0) + 4;
}

/** Starts a web-zip toward an anchor (web-pull gadget, spec §10.4). */
export function startZip(player, state, now, anchor) {
  if (state.move !== MOVE_STATE.IDLE && state.move !== MOVE_STATE.SWINGING) return false;
  state.move = MOVE_STATE.ZIPPING;
  state.traversal.anchor = anchor;
  state.traversal.anchorDim = dimensionIdOf(player);
  state.traversal.anchorBlockPos = blockPosOf(anchor);
  state.traversal.zipStartedTick = now;
  state.traversal.lastZipPos = chestLocation(player);
  state.traversal.releaseGraceUntil = 0;
  sfx(player, "ZIP");
  return true;
}

function endZip(player, state, now, reason) {
  if (state.move !== MOVE_STATE.ZIPPING) return;
  if (isEntityValid(player)) {
    // Soft landing: keep a bounded portion of momentum, kill the rest.
    const vel = readVelocity(player);
    setVelocity(player, { x: vel.x * 0.45, y: Math.max(vel.y * 0.3, -0.2), z: vel.z * 0.45 });
    if (reason === "arrived") {
      state.glide.untilTick = now + 20; // brief cushion at the end of a zip
    }
    if (reason === "arrived") sfx(player, "RELEASE", { volume: 0.4 });
  }
  state.move = MOVE_STATE.IDLE;
  state.traversal.anchor = null;
  state.traversal.anchorDim = null;
  state.traversal.anchorBlockPos = null;
  state.traversal.lastZipPos = null;
  state.traversal.releaseGraceUntil = now + CONFIG.traversal.releaseGraceTicks;
}

/**
 * Per-tick traversal update for one player (called by the central scheduler).
 * Handles swing physics, zip physics, revalidation, feedback and progression
 * event emission. Any unexpected error → safe release, never a stuck state.
 */
export function tickTraversal(player, state, now) {
  if (state.move !== MOVE_STATE.SWINGING && state.move !== MOVE_STATE.ZIPPING) return;

  // --- edge-case exits (spec §6.7) ---
  if (!isEntityValid(player) || state.deadUntilRespawn) {
    cancelTraversal(state, now);
    return;
  }
  if (dimensionIdOf(player) !== state.traversal.anchorDim) {
    cancelTraversal(state, now);
    return;
  }
  if (inWater(player)) {
    if (state.move === MOVE_STATE.SWINGING) releaseWeb(player, state, now, { reason: "water" });
    else endZip(player, state, now, "water");
    toast(player, state, now, "§7💧 Web released (water)", 25, 1);
    return;
  }
  if (!revalidateAnchor(player, state, now)) {
    if (state.move === MOVE_STATE.SWINGING) releaseWeb(player, state, now, { reason: "anchor_lost" });
    else endZip(player, state, now, "anchor_lost");
    toast(player, state, now, "§7✂ Anchor lost §8— web cut safely", 30, 2);
    return;
  }

  try {
    if (state.move === MOVE_STATE.SWINGING) tickSwing(player, state, now);
    else tickZip(player, state, now);
  } catch (err) {
    // A physics failure must never lock the player in a traversal state (P0).
    errorThrottled("traversal.tick", err);
    cancelTraversal(state, now);
    pushHudMessage(state, "§c⚠ Web system reset (report this)", now, 40, 5);
  }
}

function tickSwing(player, state, now) {
  const cfg = CONFIG.traversal;
  const passives = passivesOf(state);

  // Jump press = release WITH launch boost (spec §6.6 momentum leap).
  if (jumpPressed(state, player)) {
    releaseWeb(player, state, now, { launch: true, reason: "jump" });
    return;
  }

  const chest = chestLocation(player);
  const vel = readVelocity(player);
  const result = stepSwing({
    pos: chest,
    vel,
    anchor: state.traversal.anchor,
    ropeLen: state.traversal.ropeLen,
    look: lookDirection(player),
    forwardInput: Math.max(0, forwardInput(player)),
    sprint: sprinting(player),
    reel: sneakHeld(player) && !jumpHeld(player),
    cfg,
    suitSwingPower: passives.swingPower,
  });

  state.traversal.ropeLen = result.ropeLen;
  setVelocity(player, result.vel);

  // Landed with a slack rope → graceful exit (prevents ground dragging).
  if (onGround(player) && !result.taut) {
    releaseWeb(player, state, now, { reason: "landed" });
    return;
  }

  // Progression: 1 second of swinging per 20 ticks (emitted at most 1/sec).
  if ((now - state.traversal.startedTick) % 20 === 0) {
    emitProgress(state, PROGRESS_EVENTS.SWING_TIME, 1);
  }

  // Strand visual (bounded particle count; honors reduced-particles setting).
  const settings = settingsOf(state);
  const interval = settings.reducedParticles ? cfg.strandIntervalTicks * 2 : cfg.strandIntervalTicks;
  if (now % interval === 0) {
    const spacing = settings.reducedParticles ? cfg.strandSpacing * 2 : cfg.strandSpacing;
    const maxPts = Math.min(cfg.strandMaxPoints, CONFIG.performance.maxParticlesPerDraw);
    const points = strandPoints(chest, state.traversal.anchor, spacing, maxPts);
    fxPoints(player.dimension, "WEB_DOT", points, {});
  }

  // Contextual action bar (refreshed by the HUD cadence in lifecycle).
  if (now % CONFIG.performance.hudIntervalTicks === 0) {
    const dist = distanceBetween(chest, state.traversal.anchor);
    const spd = Math.sqrt(result.vel.x ** 2 + result.vel.y ** 2 + result.vel.z ** 2);
    const line =
      `§f🕸 §7${dist.toFixed(1)}m §8| §f${(spd * 20).toFixed(1)} m/s §8| ` +
      `§7USE §8release · §7JUMP §8launch · §7SNEAK §8reel (${state.traversal.ropeLen.toFixed(0)}m)`;
    if (settings.debug) {
      state.hud.line = `${line} §8· taut=${result.taut ? 1 : 0} ovs=${result.overshoot.toFixed(2)}`;
      state.hud.untilTick = now + 10;
      state.hud.priority = 1;
    } else {
      pushHudMessage(state, line, now, 10, 1);
    }
  }
}

function tickZip(player, state, now) {
  const cfg = CONFIG.traversal;
  const passives = passivesOf(state);

  if (jumpPressed(state, player)) {
    endZip(player, state, now, "jump_cancel");
    return;
  }
  if (now - state.traversal.zipStartedTick > cfg.zipMaxTicks) {
    endZip(player, state, now, "timeout");
    toast(player, state, now, "§7Zip ended (max distance)", 25, 1);
    return;
  }

  const chest = chestLocation(player);
  const vel = readVelocity(player);
  const result = stepZip({
    pos: chest,
    vel,
    anchor: state.traversal.anchor,
    cfg,
    suitZipSpeed: passives.zipSpeed,
  });
  setVelocity(player, result.vel);

  // Progression + strand.
  const prev = state.traversal.lastZipPos;
  if (prev) {
    const moved = horizontalDelta(prev, chest);
    if (moved > 0.01) emitProgress(state, PROGRESS_EVENTS.ZIP_DISTANCE, moved);
  }
  state.traversal.lastZipPos = chest;

  if (now % 2 === 0) {
    const settings = settingsOf(state);
    const points = strandPoints(chest, state.traversal.anchor, settings.reducedParticles ? 1.8 : 0.9, 24);
    fxPoints(player.dimension, "WEB_DOT", points, {});
  }

  if (result.finished) {
    endZip(player, state, now, "arrived");
    toast(player, state, now, "§f🕸 Zip complete", 20, 2);
    return;
  }

  if (now % CONFIG.performance.hudIntervalTicks === 0) {
    pushHudMessage(state, `§f➤ Zipping §7${result.dist.toFixed(1)}m §8· JUMP to cancel`, now, 10, 1);
  }
}

/**
 * Re-checks the anchor block still exists and is solid (spec §6.3). Returns
 * false when the anchor is gone (destroyed/unloaded/invalid).
 */
function revalidateAnchor(player, state, now) {
  const t = state.traversal;
  if (!t.anchor || !t.anchorBlockPos) return false;
  if (now - t.lastRevalidateTick < CONFIG.traversal.anchorRevalidateTicks) return true;
  t.lastRevalidateTick = now;
  try {
    const block = player.dimension.getBlock(t.anchorBlockPos);
    if (!isSolidAnchorBlock(block)) return false;
    // Anchor drifted? (shouldn't happen — coordinates are the source of truth)
    return true;
  } catch {
    // Unloaded chunk or invalid position → treat as lost, exit gracefully.
    return false;
  }
}

function emitProgress(state, type, amount) {
  emit("progress", { playerId: state.playerId, type, amount });
}

function startVisualCooldown(player, category, ticks) {
  if (ticks <= 0) return;
  try {
    player.startItemCooldown?.(category, ticks);
  } catch {
    /* purely cosmetic — never fatal */
  }
}

export function dimensionIdOf(player) {
  try {
    return player.dimension.id;
  } catch {
    return null;
  }
}

/** Convenience for other systems: is this player currently web-owned? */
export function isWebOwned(playerId) {
  const s = getState(playerId);
  return !!s && isTraversalOwned(s);
}
