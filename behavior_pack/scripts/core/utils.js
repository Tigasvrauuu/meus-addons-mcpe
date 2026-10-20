// core/utils.js — small runtime helpers that bridge the Script API safely.
// (Mostly thin wrappers; heavier pure logic lives in vec.js / *_math.js.)

import { toVec, v3 } from "./vec.js";

/**
 * Cross-version validity check. In @minecraft/server 2.x `isValid` is a
 * boolean property; older builds used a method. Stale entity handles are a
 * constant hazard after death/dimension changes/unloads (spec §4.4).
 */
export function isEntityValid(entity) {
  if (!entity) return false;
  try {
    const iv = entity.isValid;
    if (typeof iv === "boolean") return iv;
    if (typeof iv === "function") return iv.call(entity);
    // No isValid marker at all: assume the handle is usable and let the next
    // component access surface a real error.
    return true;
  } catch {
    return false;
  }
}

export function isBlockValid(block) {
  if (!block) return false;
  try {
    const iv = block.isValid;
    if (typeof iv === "boolean") return iv;
    if (typeof iv === "function") return iv.call(block);
    return true;
  } catch {
    return false;
  }
}

/** Safe velocity read (blocks/tick). Returns zero vector on failure. */
export function readVelocity(entity) {
  try {
    if (typeof entity.getVelocity === "function") return toVec(entity.getVelocity());
    // Legacy fallback (1.x component) — harmless if unused on 2.x runtimes.
    const comp = entity.getComponent?.("velocity");
    if (comp?.currentVelocity) return toVec(comp.currentVelocity);
  } catch {
    /* invalid entity */
  }
  return v3();
}

/**
 * Applies a target velocity by adding the delta (2.x has no setVelocity;
 * applyImpulse adds directly to current velocity, so delta = target - current).
 */
export function setVelocity(entity, target) {
  const current = readVelocity(entity);
  const t = toVec(target);
  const delta = v3(t.x - current.x, t.y - current.y, t.z - current.z);
  if (!Number.isFinite(delta.x + delta.y + delta.z)) return;
  try {
    entity.applyImpulse(delta);
  } catch {
    /* entity became invalid mid-tick — caller's validity checks catch this */
  }
}

/** Player chest-height origin used by traversal math. */
export function chestLocation(entity) {
  try {
    const loc = entity.location;
    return v3(loc.x, loc.y + 1.1, loc.z);
  } catch {
    return v3();
  }
}

/** Direction the player is looking (unit vector, zero on failure). */
export function lookDirection(entity) {
  try {
    return toVec(entity.getViewDirection());
  } catch {
    return v3();
  }
}

/** Block position (integers) containing a point. */
export function blockPosOf(point) {
  const p = toVec(point);
  return { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };
}

/** Center point of the block at integer coords. */
export function blockCenter(pos) {
  return v3(Math.floor(pos.x) + 0.5, Math.floor(pos.y) + 0.5, Math.floor(pos.z) + 0.5);
}

/**
 * Solid-enough anchor test for a block handle. The view-direction raycast
 * already skips air/passable/liquid by default; this double-checks handles
 * resolved by position (revalidation, zip targets).
 */
export function isSolidAnchorBlock(block) {
  if (!isBlockValid(block)) return false;
  try {
    if (block.isAir || block.isLiquid) return false;
    const id = typeof block.typeId === "string" ? block.typeId : block.type?.id;
    if (typeof id !== "string") return false;
    if (NON_ANCHOR_IDS.has(id)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Ids that pass the isAir/isLiquid filter but must never hold a web. */
const NON_ANCHOR_IDS = new Set([
  "minecraft:cave_air",
  "minecraft:void_air",
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava",
  "minecraft:cobweb", // thematically wrong to anchor to a cobweb
  "minecraft:fire",
  "minecraft:soul_fire",
  "minecraft:ladder", // climbable — would fight the climb system
  "minecraft:vine",
  "minecraft:weeping_vines",
  "minecraft:twisting_vines",
  "minecraft:cave_vines",
  "minecraft:bubble_column",
  "minecraft:powder_snow",
]);

/** Distance between two {x,y,z} points. */
export function distanceBetween(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Relative compass arrow from player yaw to a target (HUD hint, spec §8.3). */
export function relativeArrow(playerYawDegrees, playerPos, targetPos) {
  const dx = targetPos.x - playerPos.x;
  const dz = targetPos.z - playerPos.z;
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return "•";
  // Bedrock yaw: 0 = +Z (south), +90 = -X (west) → targetYaw = atan2(-dx, dz).
  const targetYaw = (Math.atan2(-dx, dz) * 180) / Math.PI;
  const yaw = Number.isFinite(Number(playerYawDegrees)) ? Number(playerYawDegrees) : 0;
  const rel = ((targetYaw - yaw + 540) % 360) - 180; // [-180, 180), 0 = directly ahead
  // rel > 0 → target is on the player's RIGHT half of the screen.
  if (rel >= -22.5 && rel < 22.5) return "↑";
  if (rel >= 22.5 && rel < 67.5) return "↗";
  if (rel >= 67.5 && rel < 112.5) return "→";
  if (rel >= 112.5 && rel < 157.5) return "↘";
  if (rel >= -67.5 && rel < -22.5) return "↖";
  if (rel >= -112.5 && rel < -67.5) return "←";
  if (rel >= -157.5 && rel < -112.5) return "↙";
  return "↓";
}

/** Clamps a number into [min,max]; NaN → fallback. */
export function clampNum(n, min, max, fallback = min) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}
