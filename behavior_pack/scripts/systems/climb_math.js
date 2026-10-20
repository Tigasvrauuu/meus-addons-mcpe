// systems/climb_math.js — PURE module (no @minecraft imports; unit-testable in Node).
// Wall-climb velocity model (spec §7). The runtime system (climbing.js) finds
// the wall, builds the intent flags from real input (inputInfo / isJumping /
// isSneaking), applies the returned velocity and decides attachment loss.

import { add, dot, length, scale, sub, toVec, v3 } from "../core/vec.js";

/**
 * Computes the climb velocity for one tick.
 *
 * @param {object} input
 * @param {{x,y,z}} input.pos        player feet position
 * @param {{x,y,z}} input.vel        current velocity
 * @param {{x,y,z}} input.wallNormal horizontal unit vector pointing FROM the
 *                                   wall TOWARD the player
 * @param {boolean} input.up         jump button held → climb up
 * @param {boolean} input.down       sneak button held → climb down
 * @param {{x,y,z}} input.wallPos    position of the wall block (for re-check)
 * @param {object}  input.cfg        CONFIG.climbing
 * @param {number}  input.suitClimbSpeed passive multiplier
 * @returns {{vel:{x,y,z}, leap:boolean}}
 */
export function stepClimb(input) {
  const cfg = input.cfg;
  const vel = toVec(input.vel);
  const n = normalizeHorizontal(input.wallNormal);
  const suit = Number.isFinite(input.suitClimbSpeed) && input.suitClimbSpeed > 0 ? input.suitClimbSpeed : 1;

  // Leap-off wins over everything: sneak + jump together (spec §7.2).
  if (input.up && input.down) {
    const leapVel = add(
      scale(n, cfg.leapForce),
      v3(0, cfg.leapUp, 0)
    );
    return { vel: add(scale(vel, 0.25), leapVel), leap: true };
  }

  let next = { x: vel.x, y: vel.y, z: vel.z };

  // Cancel velocity pushing INTO the wall (prevents jitter/tunneling).
  if (length(n) > 0.5) {
    const vn = dot(next, n);
    if (vn < 0) next = sub(next, scale(n, vn));
    // Gentle pull to keep contact with the surface.
    next = sub(next, scale(n, cfg.stickPull));
  }

  // Vertical control: jump → up, sneak → down, neither → hover in place.
  const upSpeed = cfg.climbUpSpeed * suit;
  const downSpeed = cfg.climbDownSpeed * suit;
  let targetY = 0;
  if (input.up) targetY = upSpeed;
  else if (input.down) targetY = -downSpeed;
  next.y = next.y + (targetY - next.y) * cfg.hoverLerp;

  // Safety caps.
  if (next.y > upSpeed) next.y = upSpeed;
  if (next.y < -Math.max(downSpeed, 0.5)) next.y = -Math.max(downSpeed, 0.5);

  return { vel: next, leap: false };
}

/**
 * Decides whether a fall after traversal should be softened by the web-glide
 * (spec §7.3 — bounded, defined mechanic, not accidental immunity).
 *
 * @returns {{active:boolean, vel:{x,y,z}}}
 */
export function stepGlide(input) {
  const cfg = input.cfg;
  const vel = toVec(input.vel);
  if (vel.y >= -cfg.glideFallSpeedCap) return { active: false, vel };
  return { active: true, vel: v3(vel.x, -cfg.glideFallSpeedCap, vel.z) };
}

/**
 * Chooses the best wall among probe results: the nearest solid hit in front-ish
 * of the player. Pure so the selection rule is testable.
 *
 * @param {Array<{dir:{x,y,z}, hit:object|null, distance:number}>} probes
 *   `hit` is truthy when a solid block was found along `dir`.
 * @param {{x,y,z}} look player's unit look direction (preference weight)
 * @returns {{dir:{x,z}, distance:number}|null} wall normal candidate
 *   `dir` points FROM the wall TOWARD the player (i.e. -probeDir, horizontal).
 */
export function pickWall(probes, look) {
  let best = null;
  for (const p of probes) {
    if (!p || !p.hit) continue;
    const probeDir = normalizeHorizontal(p.dir);
    // Prefer walls the player is actually facing.
    const facing = dot(probeDir, normalizeHorizontal(look));
    const score = p.distance - facing * 0.35;
    if (!best || score < best.score) {
      best = { score, distance: p.distance, dir: scale(probeDir, -1) };
      // Normalize -0 → +0 so results are serialization/diff stable.
      best.dir = { x: best.dir.x + 0, y: best.dir.y + 0, z: best.dir.z + 0 };
    }
  }
  return best ? { dir: best.dir, distance: best.distance } : null;
}

function normalizeHorizontal(v) {
  const flat = toVec(v);
  flat.y = 0;
  const len = length(flat);
  if (len < 1e-6) return v3();
  return scale(flat, 1 / len);
}
