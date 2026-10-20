// systems/climbing.js — WallClimbingService (spec §7).
// Owns the CLIMBING movement state plus the bounded web-glide fall mitigation
// after traversal. Attach is automatic while airborne next to a solid wall
// (discoverable + works on touch); controls:
//   JUMP held        → climb up
//   SNEAK held       → climb down
//   SNEAK+JUMP       → leap off the wall
//   (on ground)      → detach naturally
// Wall probing uses the same solid-only raycast filter as web anchors, so the
// player never sticks to grass, water or torches.

import { CONFIG } from "../core/config.js";
import { MOVE_STATE, PROGRESS_EVENTS } from "../core/constants.js";
import { isEntityValid, readVelocity, setVelocity, lookDirection, blockPosOf } from "../core/utils.js";
import { passivesOf, settingsOf, pushHudMessage } from "../core/state.js";
import { stepClimb, stepGlide, pickWall } from "./climb_math.js";
import { sfx, fx, toast } from "../ui/hud.js";
import { jumpHeld, sneakHeld, onGround, inWater } from "../core/input.js";
import { emit } from "../core/bus.js";
import { errorThrottled } from "../core/logger.js";

const PROBE_DIRS = Object.freeze([
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
]);

/** True while the climb system is actively controlling the player. */
export function isClimbing(state) {
  return state?.move === MOVE_STATE.CLIMBING;
}

/**
 * Per-tick climbing/glide update (called by the central scheduler for players
 * whose move state is IDLE or CLIMBING — traversal owns SWINGING/ZIPPING).
 */
export function tickClimbing(player, state, now) {
  if (!isEntityValid(player) || state.deadUntilRespawn) {
    detach(state, null, now, "invalid");
    return;
  }

  if (state.move === MOVE_STATE.CLIMBING) {
    tickAttached(player, state, now);
    return;
  }

  if (state.move !== MOVE_STATE.IDLE) return;

  // Web-glide: bounded fall mitigation right after traversal releases.
  if (now < state.glide.untilTick && !onGround(player)) {
    tickGlide(player, state, now);
    return;
  }

  tryAttach(player, state, now);
}

function tryAttach(player, state, now) {
  const settings = settingsOf(state);
  if (!settings.autoClimb) return;
  if (!state.suit.id) return; // suits own the wall-crawl fantasy
  if (onGround(player) || inWater(player)) return;
  if (now < state.traversal.releaseGraceUntil) return; // don't grab mid-release
  // Falling extremely fast → let the fall happen (glide handles the landing).
  const vel = readVelocity(player);
  if (vel.y < -CONFIG.climbing.glideTriggerFallSpeed * 1.6) return;

  const wall = findWall(player);
  if (!wall) return;

  state.move = MOVE_STATE.CLIMBING;
  state.climb.wallNormal = wall.dir;
  state.climb.wallPos = wall.blockPos;
  state.climb.attachedTick = now;
  state.climb.lostWallSince = null;
  state.climb.lastY = player.location.y;
  state.glide.untilTick = 0;

  sfx(player, "CLIMB_ATTACH", { volume: 0.35 });
  fx(player.dimension, "WEB_DOT", { x: player.location.x, y: player.location.y + 1, z: player.location.z });
  toast(player, state, now, "§f🧱 Wall grip §8· JUMP up · SNEAK down · both = leap off", 35, 2);
}

function tickAttached(player, state, now) {
  const cfg = CONFIG.climbing;

  // Natural exits.
  if (onGround(player)) {
    detach(player, state, now, "ground");
    return;
  }
  if (inWater(player)) {
    detach(player, state, now, "water");
    return;
  }
  if (dimensionId(player) !== state.lastDimensionId) {
    detach(null, state, now, "dimension");
    return;
  }

  // Wall re-check (cheap: one short raycast along the stored normal, every tick
  // is fine at this range; grace window prevents detaching on 1-tick jitter).
  const wallStillThere = wallPresent(player, state);
  if (!wallStillThere) {
    if (state.climb.lostWallSince === null) state.climb.lostWallSince = now;
    if (now - state.climb.lostWallSince > cfg.lostWallGraceTicks) {
      detach(player, state, now, "wall_lost");
      // Keep a short glide window so stepping off a ledge feels safe.
      state.glide.untilTick = now + Math.min(20, cfg.glideMaxTicks);
      return;
    }
  } else {
    state.climb.lostWallSince = null;
  }

  const up = jumpHeld(player);
  const down = sneakHeld(player);

  const result = stepClimb({
    pos: player.location,
    vel: readVelocity(player),
    wallNormal: state.climb.wallNormal,
    up,
    down,
    cfg,
    suitClimbSpeed: passivesOf(state).climbSpeed,
  });

  setVelocity(player, result.vel);

  if (result.leap) {
    sfx(player, "CLIMB_DETACH");
    toast(player, state, now, "§f⤴ Wall leap!", 20, 2);
    detach(player, state, now, "leap");
    state.glide.untilTick = now + Math.min(30, cfg.glideMaxTicks);
    return;
  }

  // Progression: count upward climbing (blocks).
  const y = player.location.y;
  const dy = y - state.climb.lastY;
  state.climb.lastY = y;
  if (dy > 0.02) emit("progress", { playerId: state.playerId, type: PROGRESS_EVENTS.CLIMB_UP, amount: dy });

  if (now % CONFIG.performance.hudIntervalTicks === 0) {
    const mode = up && !down ? "§a▲ climbing" : down && !up ? "§7▼ descending" : "§f✋ holding";
    pushHudMessage(state, `§f🧱 ${mode} §8· SNEAK+JUMP leap off`, now, 10, 1);
  }
}

function tickGlide(player, state, now) {
  const result = stepGlide({ vel: readVelocity(player), cfg: CONFIG.climbing });
  if (result.active) setVelocity(player, result.vel);
  if (onGround(player)) {
    state.glide.untilTick = 0;
    return;
  }
  if (now % CONFIG.performance.hudIntervalTicks === 0) {
    pushHudMessage(state, "§f🕸 Web glide", now, 10, 1);
  }
}

/** Detaches from the wall and restores plain movement (we never touched attributes). */
function detach(player, state, now, reason) {
  if (!state || state.move !== MOVE_STATE.CLIMBING) return;
  state.move = MOVE_STATE.IDLE;
  state.climb.wallNormal = null;
  state.climb.wallPos = null;
  state.climb.lostWallSince = null;
  if (player && isEntityValid(player) && reason !== "leap" && reason !== "ground") {
    sfx(player, "CLIMB_DETACH", { volume: 0.3 });
  }
  if (reason === "wall_lost" && player && isEntityValid(player)) {
    toast(player, state, now ?? 0, "§7✋ Lost grip", 20, 1);
  }
}

/** Force-detach without feedback (death/dimension cleanup paths). */
export function cancelClimb(state, now) {
  if (!state) return;
  if (state.move === MOVE_STATE.CLIMBING) state.move = MOVE_STATE.IDLE;
  state.climb.wallNormal = null;
  state.climb.wallPos = null;
  state.climb.lostWallSince = null;
  state.glide.untilTick = 0;
}

/**
 * Finds the nearest solid wall around the player using four short raycasts at
 * chest height. Returns {dir(normal wall→player), blockPos, distance} or null.
 */
function findWall(player) {
  const probes = [];
  const look = lookDirection(player);
  const chest = { x: player.location.x, y: player.location.y + 1.0, z: player.location.z };
  for (const dir of PROBE_DIRS) {
    try {
      const hit = player.dimension.getBlockFromRay(
        chest,
        dir,
        {
          maxDistance: CONFIG.climbing.wallProbeDistance,
          includeLiquidBlocks: false,
          includePassableBlocks: false,
        }
      );
      if (hit && hit.block) {
        probes.push({ dir, hit, distance: hit.distance ?? CONFIG.climbing.wallProbeDistance, blockPos: blockPosOf(hit.block.location) });
      }
    } catch {
      // unloaded/edge position — treat this direction as empty
    }
  }
  if (probes.length === 0) return null;
  const picked = pickWall(probes.map((p) => ({ dir: p.dir, hit: p.hit, distance: p.distance })), look);
  if (!picked) return null;
  const source = probes.find((p) => p.dir.x === -Math.sign(picked.dir.x || 0) || p.dir.z === -Math.sign(picked.dir.z || 0));
  return {
    dir: { x: picked.dir.x, y: 0, z: picked.dir.z },
    blockPos: source ? source.blockPos : blockPosOf(chest),
    distance: picked.distance,
  };
}

function wallPresent(player, state) {
  if (!state.climb.wallNormal) return false;
  const n = state.climb.wallNormal;
  const chest = { x: player.location.x, y: player.location.y + 1.0, z: player.location.z };
  try {
    const hit = player.dimension.getBlockFromRay(
      chest,
      { x: -n.x, y: 0, z: -n.z }, // probe back into the wall
      {
        maxDistance: CONFIG.climbing.wallProbeDistance + 0.35,
        includeLiquidBlocks: false,
        includePassableBlocks: false,
      }
    );
    if (hit && hit.block) {
      state.climb.wallPos = blockPosOf(hit.block.location);
      return true;
    }
    return false;
  } catch (err) {
    errorThrottled("climbing.wallPresent", err);
    return false;
  }
}

function dimensionId(player) {
  try {
    return player.dimension.id;
  } catch {
    return null;
  }
}
