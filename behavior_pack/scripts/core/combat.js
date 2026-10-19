// Shared damage and crowd-control path. Every gadget and effect routes through
// here so target validation, friendly-fire rules and restraint limits stay in
// one place.
import { EntityDamageCause } from "@minecraft/server";
import { GADGETS, SPIDER_SENSE } from "./config.js";
import { horizontal, sub } from "./swing_math.js";
import { errorOnce } from "./diagnostics.js";

const PLAYER_TYPE = "minecraft:player";
const restrained = new Map(); // entity.id -> { entity, expiresAt }

// Gadgets only affect hostile mobs (the vanilla "monster" family). Players,
// pets, villagers and passive animals are never valid targets.
export function isHostileTarget(attacker, target) {
  if (!target || !target.isValid) return false;
  if (target.id === attacker.id) return false;
  if (target.typeId === PLAYER_TYPE) return false;
  if (!target.hasComponent("minecraft:health")) return false;
  const family = target.getComponent("minecraft:type_family");
  return family !== undefined && family.hasTypeFamily(SPIDER_SENSE.hostileFamily);
}

// Applies web-impact damage and a horizontal knockback away from the attacker.
export function dealImpactDamage(attacker, target, damage, knockback) {
  if (!isHostileTarget(attacker, target)) return false;
  try {
    const dealt = target.applyDamage(damage, {
      cause: EntityDamageCause.entityAttack,
      damagingEntity: attacker,
    });
    const dir = horizontal(sub(target.location, attacker.location));
    if (dir.x !== 0 || dir.z !== 0) {
      target.applyKnockback({ x: dir.x * knockback, z: dir.z * knockback }, 0.3);
    }
    return dealt;
  } catch (error) {
    errorOnce("impact-damage", error);
    return false;
  }
}

// Heavy and boss classes come from type families. Vanilla mobs in the boss
// family (e.g. the Wither, Ender Dragon) are treated as bosses.
export function classifyTarget(target) {
  const family = target.getComponent("minecraft:type_family");
  if (family && family.hasTypeFamily(SPIDER_SENSE.bossFamily)) return "boss";
  if (family) {
    for (const name of SPIDER_SENSE.heavyFamilies) {
      if (family.hasTypeFamily(name)) return "heavy";
    }
  }
  return "light";
}

// Applies a tiered Slowness effect. Light targets are held almost still,
// heavy targets are slowed, bosses only lightly slowed. Returns the tier used
// or null if the target could not be restrained.
export function restrainTarget(attacker, target, now) {
  if (!isHostileTarget(attacker, target)) return null;
  const tierName = classifyTarget(target);
  const tier = GADGETS.web_restraint[tierName];
  try {
    target.addEffect("slowness", tier.durationTicks, {
      amplifier: tier.amplifier,
      showParticles: true,
    });
  } catch (error) {
    errorOnce("restraint-apply", error);
    return null;
  }
  restrained.set(target.id, { entity: target, expiresAt: now + tier.durationTicks });
  return tierName;
}

// Removes restraints whose duration ended or whose target is gone.
export function tickRestraints(now) {
  for (const [id, record] of restrained) {
    if (!record.entity.isValid) {
      restrained.delete(id);
      continue;
    }
    if (now >= record.expiresAt) {
      try {
        record.entity.removeEffect("slowness");
      } catch (error) {
        errorOnce("restraint-clear", error);
      }
      restrained.delete(id);
    }
  }
}

export function hostileNear(dimension, location, radius) {
  try {
    return dimension.getEntities({
      location,
      maxDistance: radius,
      families: [SPIDER_SENSE.hostileFamily],
    });
  } catch (error) {
    errorOnce("hostile-query", error);
    return [];
  }
}
