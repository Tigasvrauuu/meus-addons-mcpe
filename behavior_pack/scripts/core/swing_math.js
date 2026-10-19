// Pure vector math for the swing and wall-cling controllers.
// No Script API imports, so every rule here is unit-tested in tests/.
// Vectors are {x, y, z}. Impulses are returned as velocity deltas.

export const ZERO = Object.freeze({ x: 0, y: 0, z: 0 });

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (v) => Math.hypot(v.x, v.y, v.z);

export function normalize(v) {
  const len = length(v);
  if (len < 1e-6) return { x: 0, y: 0, z: 0 };
  return scale(v, 1 / len);
}

// Horizontal (XZ) unit vector, zero if the input has no horizontal part.
export function horizontal(v) {
  return normalize({ x: v.x, y: 0, z: v.z });
}

export function clampLength(v, max) {
  const len = length(v);
  if (len <= max || len < 1e-9) return v;
  return scale(v, max / len);
}

// Impulse keeping a swinging player inside a rope of length `rope` around
// `anchor`, plus steering and a speed cap. Gravity is left to the game.
//  - Outward radial velocity is removed once the rope is taut (inelastic
//    constraint, so tangential momentum survives).
//  - A small bounded correction pulls back a rope that is overstretched.
//  - Steering nudges the swing toward the view direction.
//  - The predicted velocity is clamped to maxSpeed.
export function computeSwingImpulse({
  playerPos,
  anchor,
  rope,
  velocity,
  steerDir,
  maxSpeed,
  steer,
  pullGain,
  pullMax,
}) {
  let impulse = { ...ZERO };
  const offset = sub(playerPos, anchor);
  const distance = length(offset);

  if (distance > 1e-4) {
    const radial = scale(offset, 1 / distance);
    const outward = dot(velocity, radial);
    if (distance >= rope) {
      if (outward > 0) impulse = add(impulse, scale(radial, -outward));
      const over = distance - rope;
      if (over > 0) {
        impulse = add(impulse, scale(radial, -Math.min(pullMax, over * pullGain)));
      }
    }
  }

  if (steerDir && (steerDir.x !== 0 || steerDir.z !== 0)) {
    impulse = add(impulse, scale(steerDir, steer));
  }

  const predicted = add(velocity, impulse);
  const speed = length(predicted);
  if (speed > maxSpeed && speed > 1e-9) {
    const capped = scale(predicted, maxSpeed / speed);
    impulse = add(impulse, sub(capped, predicted));
  }
  return impulse;
}

// Small forward nudge when the player releases a swing on purpose.
// Keeps the momentum, then caps the total speed so release can never spike.
export function computeReleaseImpulse({ velocity, aimDir, boost, maxSpeed }) {
  const nudge = scale(aimDir, boost);
  const predicted = add(velocity, nudge);
  const speed = length(predicted);
  if (speed > maxSpeed && speed > 1e-9) {
    return add(nudge, sub(scale(predicted, maxSpeed / speed), predicted));
  }
  return nudge;
}

// Holds a clinging player: cancels horizontal drift, drives vertical speed
// toward targetVy (0 holds position against gravity), and springs the player
// back onto the wall plane along `normal` (unit vector pointing away from wall).
export function computeClingImpulse({ velocity, targetVy, normal, offsetError, stick }) {
  const horiz = { x: -velocity.x, y: 0, z: -velocity.z };
  const vertical = { x: 0, y: targetVy - velocity.y, z: 0 };
  const spring = scale(normal, offsetError * stick);
  return add(add(horiz, vertical), spring);
}

// Converts a camera pitch (Bedrock: negative = looking up) into a target
// vertical speed for wall climbing.
export function climbTargetVy(pitch, { lookUpPitch, lookDownPitch, climbSpeed, descendSpeed }) {
  if (pitch <= lookUpPitch) return climbSpeed;
  if (pitch >= lookDownPitch) return -descendSpeed;
  return 0;
}
