// systems/swing_math.js — PURE module (no @minecraft imports; unit-testable in Node).
// The pendulum approximation for web-swinging (spec §6.4). The runtime system
// (traversal.js) feeds real player state in and applies the returned impulse
// delta via entity.applyImpulse(). Pure = fully covered by automated tests.
//
// Model (per tick):
//  1. Rope constraint: when the player is farther than ropeLen + slack from the
//     anchor, remove most of the outward radial velocity (taut rope) and apply
//     a bounded spring correction proportional to the overshoot. Gravity and
//     tangential momentum are preserved → a believable pendulum arc builds.
//  2. Pumping: forward input (and sprint) add bounded tangential acceleration
//     in the aim direction, projected perpendicular to the rope.
//  3. Damping + hard speed caps keep the system stable against terrain
//     collisions and long chains of swings.

import { add, clampLength, dot, length, normalize, scale, sub, toVec, v3, horizontal, horizontalLength } from "../core/vec.js";

/**
 * @param {object} input
 * @param {{x,y,z}} input.pos        player chest position
 * @param {{x,y,z}} input.vel        current velocity (blocks/tick)
 * @param {{x,y,z}} input.anchor     anchor point (block center)
 * @param {number}  input.ropeLen    current rope length (may be reeled)
 * @param {{x,y,z}} input.look       unit look direction (for pumping)
 * @param {number}  input.forwardInput 0..1 forward movement intensity
 * @param {boolean} input.sprint     sprinting flag
 * @param {boolean} input.reel       holding sneak → shorten rope
 * @param {object}  input.cfg        CONFIG.traversal
 * @param {number}  input.suitSwingPower passive multiplier (>=0.8, <=1.3 expected)
 * @returns {{vel:{x,y,z}, ropeLen:number, taut:boolean, overshoot:number, speed:number}}
 */
export function stepSwing(input) {
  const cfg = input.cfg;
  const pos = toVec(input.pos);
  let vel = toVec(input.vel);
  const anchor = toVec(input.anchor);
  let ropeLen = Math.max(cfg.minRopeLength, Number(input.ropeLen) || cfg.minRopeLength);
  const look = normalize(toVec(input.look));
  const suitPower = Number.isFinite(input.suitSwingPower) && input.suitSwingPower > 0 ? input.suitSwingPower : 1;

  // Reel-in shortens the rope (bounded).
  if (input.reel) {
    ropeLen = Math.max(cfg.minRopeLength, ropeLen - cfg.reelSpeed);
  }

  const toAnchor = sub(anchor, pos);
  const dist = length(toAnchor);
  let taut = false;
  let overshoot = 0;

  if (dist < 1e-6) {
    // Degenerate: sitting on the anchor — no correction (runtime will release).
    return finish(vel, ropeLen, false, 0, cfg);
  }

  const radial = scale(toAnchor, 1 / dist); // unit pos→anchor

  // 1) Rope constraint when stretched beyond rope + slack.
  const limit = ropeLen + cfg.ropeSlack;
  if (dist > limit) {
    taut = true;
    overshoot = dist - limit;
    // vr < 0 means moving away from the anchor (radial points toward anchor).
    const vr = dot(vel, radial);
    if (vr < 0) {
      vel = add(vel, scale(radial, -vr * cfg.radialKill));
    }
    // Bounded spring pull toward the anchor.
    const spring = Math.min(cfg.maxSpringCorrection, overshoot * cfg.springStiffness);
    vel = add(vel, scale(radial, spring));
  }

  // 2) Pumping: tangential acceleration along the aim direction.
  const forward = Number.isFinite(input.forwardInput) ? Math.min(1, Math.max(0, input.forwardInput)) : 0;
  const pumpStrength = forward * (input.sprint ? cfg.pumpAccelSprint : cfg.pumpAccel) * suitPower;
  if (pumpStrength > 0) {
    const tangent = normalize(sub(look, scale(radial, dot(look, radial))));
    vel = add(vel, scale(tangent, pumpStrength));
  }

  // 3) Damping + caps.
  vel = scale(vel, cfg.damping);
  if (vel.y > cfg.maxUpwardSpeed) vel = v3(vel.x, cfg.maxUpwardSpeed, vel.z);
  vel = clampLength(vel, cfg.maxSpeed);

  return finish(vel, ropeLen, taut, overshoot, cfg);
}

/**
 * Computes the release velocity: keeps a bounded portion of momentum and
 * optionally adds the jump-release launch boost (spec §6.6).
 */
export function computeReleaseVelocity(input) {
  const cfg = input.cfg;
  let vel = scale(toVec(input.vel), cfg.releaseRetain);
  if (input.launch) {
    vel = add(vel, v3(0, cfg.releaseLaunchBoost, 0));
  }
  if (vel.y > cfg.maxUpwardSpeed) vel = v3(vel.x, cfg.maxUpwardSpeed, vel.z);
  return clampLength(vel, cfg.maxSpeed * 1.15);
}

/**
 * One step of the web-zip: accelerate along the line to the anchor.
 * Returns the new velocity and whether the zip should finish (arrived).
 */
export function stepZip(input) {
  const cfg = input.cfg;
  const pos = toVec(input.pos);
  const anchor = toVec(input.anchor);
  const vel = toVec(input.vel);
  const suitZip = Number.isFinite(input.suitZipSpeed) && input.suitZipSpeed > 0 ? input.suitZipSpeed : 1;

  const toAnchor = sub(anchor, pos);
  const dist = length(toAnchor);
  if (dist < 1e-6) return { vel, finished: true, dist: 0 };

  const dir = scale(toAnchor, 1 / dist);
  let next = add(vel, scale(dir, cfg.zipAccel * suitZip));
  // Kill velocity fighting the zip line so the ride feels direct.
  const along = dot(next, dir);
  const lateral = sub(next, scale(dir, along));
  next = add(scale(dir, Math.max(along, 0)), scale(lateral, 0.6));
  next = clampLength(next, cfg.zipMaxSpeed * suitZip);
  return { vel: next, finished: dist <= cfg.zipFinishDistance, dist };
}

/**
 * Pure geometry for the web strand particle line (spec §6.2 point 8):
 * returns evenly spaced sample points between start and end.
 */
export function strandPoints(start, end, spacing, maxPoints) {
  const a = toVec(start);
  const b = toVec(end);
  const delta = sub(b, a);
  const dist = length(delta);
  if (dist < 1e-6 || spacing <= 0) return [];
  const count = Math.min(maxPoints, Math.max(2, Math.floor(dist / spacing) + 1));
  const step = scale(delta, 1 / (count - 1));
  const out = [];
  for (let i = 0; i < count; i++) out.push(add(a, scale(step, i)));
  return out;
}

/** Horizontal distance travelled this tick (for zip/swing distance stats). */
export function horizontalDelta(prevPos, pos) {
  return horizontalLength(horizontal(sub(toVec(pos), toVec(prevPos))));
}

function finish(vel, ropeLen, taut, overshoot) {
  // The runtime applies (vel - liveVelocity) via entity.applyImpulse().
  return { vel, ropeLen, taut, overshoot, speed: length(vel) };
}
