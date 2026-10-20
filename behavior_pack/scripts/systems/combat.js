// systems/combat.js — CombatService (spec §9).
// Single damage/control path for all custom attacks:
//  - melee bonuses on vanilla hits (entityHitEntity), with a time-window combo
//    and an air-strike bonus (bounded, no infinite escalation)
//  - dodge dash (SNEAK held + JUMP on the ground), with cooldown
//  - the web restraint manager: bounded list, per-target expiry, cleanup on
//    invalid/dead targets, heavy/immune classification (restraint_rules.js)
//  - enemy kill tracking feeding progression
// Damage is applied with applyDamage(cause=entityAttack) so vanilla death,
// loot and hurt feedback all stay intact.

import { CONFIG } from "../core/config.js";
import { ENEMY_TYPES, TAGS, PROGRESS_EVENTS, MOVE_STATE } from "../core/constants.js";
import { isEntityValid, readVelocity, setVelocity, distanceBetween } from "../core/utils.js";
import { passivesOf, settingsOf, pushHudMessage } from "../core/state.js";
import { isReady, nextReadyTick } from "../core/cooldowns.js";
import { classifyRestraintTarget, TARGET_CLASS } from "./restraint_rules.js";
import { sfx, fx } from "../ui/hud.js";
import { jumpPressed, sneakHeld, onGround, lookDirection } from "../core/input.js";
import { emit } from "../core/bus.js";
import { errorThrottled } from "../core/logger.js";

/** Active restraints: [{entityId, ownerPlayerId, dimId, endTick, cls, amplifier}] */
const restraints = [];

// ---------------------------------------------------------------------------
// Melee
// ---------------------------------------------------------------------------

/**
 * Handles a vanilla melee hit by the player (entityHitEntity after-event).
 * Applies suit bonus + combo + air-strike through one path.
 */
export function onPlayerMeleeHit(player, state, target, now) {
  if (!state || !state.suit.id || state.deadUntilRespawn) return;
  if (!isEntityValid(player) || !isEntityValid(target)) return;
  if (target.typeId === "minecraft:player") return; // no friendly fire via bonus
  const cfg = CONFIG.combat;

  // Duplicate-event guard: at most one bonus application per few ticks.
  if (now - state.combat.lastBonusTick < cfg.bonusRetriggerTicks) return;

  // Reach sanity: the event fires for real attacks, but validate anyway.
  let dist = 99;
  try {
    dist = distanceBetween(player.location, target.location);
  } catch {
    return;
  }
  if (dist > cfg.attackReach) return;

  state.combat.lastBonusTick = now;

  // Combo window (time based, spec §9.4).
  if (now - state.combat.lastHitTick <= cfg.comboWindowTicks) {
    state.combat.comboStacks = Math.min(cfg.comboMaxStacks, state.combat.comboStacks + 1);
  } else {
    state.combat.comboStacks = 1;
  }
  state.combat.lastHitTick = now;

  const passives = passivesOf(state);
  const airborne = !onGround(player);
  const comboBonus = (state.combat.comboStacks - 1) * cfg.comboDamagePerStack;
  const airBonus = airborne ? cfg.airStrikeBonusDamage : 0;
  const total = cfg.baseBonusDamage + comboBonus + airBonus + (passives.meleeBonus ?? 0);

  if (total > 0) {
    try {
      target.applyDamage(total, { cause: "entityAttack", damagingEntity: player });
    } catch (err) {
      errorThrottled("combat.applyDamage", err);
    }
  }

  // Knockback: base direction player→target + combo/air scaling (bounded).
  try {
    const look = lookDirection(player);
    const kb =
      0.28 +
      (state.combat.comboStacks - 1) * cfg.comboKnockbackPerStack +
      (airborne ? cfg.airStrikeKnockback : 0);
    const vel = readVelocity(target);
    setVelocity(target, {
      x: vel.x + look.x * kb,
      y: Math.min(vel.y + (airborne ? 0.32 : 0.12), 0.8),
      z: vel.z + look.z * kb,
    });
  } catch (err) {
    errorThrottled("combat.knockback", err);
  }

  // Feedback (no chat spam — action bar + particles + sound only).
  sfx(player, "MELEE_HIT", { volume: 0.5 + Math.min(0.4, state.combat.comboStacks * 0.1) });
  try {
    fx(target.dimension, "HIT_SPARK", { x: target.location.x, y: target.location.y + 1.2, z: target.location.z }, { skip: settingsOf(state).reducedParticles });
  } catch {
    /* target dimension read can fail mid-death */
  }
  if (airborne) {
    pushHudMessage(state, `§6⚡ AIR STRIKE! §7+${airBonus.toFixed(1)}`, now, 25, 3);
  } else if (state.combat.comboStacks >= 2) {
    pushHudMessage(state, `§eCOMBO x${state.combat.comboStacks} §7+${total.toFixed(1)} dmg`, now, 20, 2);
  }
}

/** Resets the combo when the window lapses (scheduler-driven). */
export function tickCombat(player, state, now) {
  if (state.combat.comboStacks > 0 && now - state.combat.lastHitTick > CONFIG.combat.comboWindowTicks) {
    state.combat.comboStacks = 0;
  }
  if (state.move === MOVE_STATE.IDLE) tickDodge(player, state, now);
}

// ---------------------------------------------------------------------------
// Dodge (SNEAK held + JUMP press while idle on the ground)
// ---------------------------------------------------------------------------

function tickDodge(player, state, now) {
  if (!state.suit.id || state.deadUntilRespawn) return;
  if (!onGround(player)) return;
  if (!sneakHeld(player)) return;
  if (!jumpPressed(state, player)) return;
  if (!isReady(state.combat.dodgeReadyTick, now)) return;

  const cfg = CONFIG.combat;
  const passives = passivesOf(state);
  const look = lookDirection(player);
  const dirX = Math.abs(look.x) + Math.abs(look.z) < 0.05 ? 0 : look.x;
  const dirZ = Math.abs(look.x) + Math.abs(look.z) < 0.05 ? 0 : look.z;
  const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;

  try {
    player.applyImpulse({
      x: (dirX / len) * cfg.dodgeImpulse,
      y: cfg.dodgeUp,
      z: (dirZ / len) * cfg.dodgeImpulse,
    });
  } catch (err) {
    errorThrottled("combat.dodge", err);
    return;
  }

  state.combat.dodgeReadyTick = nextReadyTick(now, cfg.dodgeCooldownTicks, passives.dodgeCooldown);
  state.combat.lastDodgeTick = now;
  sfx(player, "DODGE");
  pushHudMessage(state, "§f💨 Dodge!", now, 20, 2);
}

// ---------------------------------------------------------------------------
// Web restraints (applied by the restraint-web gadget; managed here)
// ---------------------------------------------------------------------------

/**
 * Applies a web restraint to a target. Returns the classification result so
 * the gadget layer can give honest feedback ("resisted" etc.).
 */
export function applyRestraint(player, state, target, now) {
  if (!isEntityValid(target)) return { cls: TARGET_CLASS.INVALID };
  const info = { typeId: target.typeId, isPlayer: target.typeId === "minecraft:player", alive: true };
  const cls = classifyRestraintTarget(info, CONFIG.combat);

  if (cls.cls === TARGET_CLASS.INVALID || cls.cls === TARGET_CLASS.IMMUNE) return cls;
  if (restraints.length >= CONFIG.combat.maxActiveRestraints) {
    // Evict the oldest restraint instead of growing unbounded (spec §22).
    const oldest = restraints.shift();
    releaseOne(oldest, now, "evicted");
  }

  const dimId = safeDimId(target);
  restraints.push({
    entityId: target.id,
    dimId,
    ownerPlayerId: state.playerId,
    endTick: now + cls.durationTicks,
    cls: cls.cls,
    amplifier: cls.slownessAmplifier,
    fullLock: cls.fullLock,
    lastParticleTick: 0,
  });

  try {
    target.addTag(TAGS.WEBBED);
    target.addEffect("slowness", cls.durationTicks, { amplifier: cls.slownessAmplifier, showParticles: false });
  } catch (err) {
    errorThrottled("combat.applyRestraint", err);
  }

  emit("progress", { playerId: state.playerId, type: PROGRESS_EVENTS.RESTRAIN, amount: 1 });
  sfx(player, "RESTRAINT_HIT");
  try {
    fx(target.dimension, "WEB_SPLAT", { x: target.location.x, y: target.location.y + 1, z: target.location.z });
  } catch {
    /* cosmetic */
  }
  return cls;
}

/**
 * Scheduler tick: refreshes slowness (so it cannot be milked out), holds
 * full-lock targets in place, expires restraints and cleans up invalid ones.
 */
export function tickRestraints(worldRef, now) {
  for (let i = restraints.length - 1; i >= 0; i--) {
    const r = restraints[i];
    let target = null;
    try {
      target = worldRef.getEntity(r.entityId) ?? null;
    } catch {
      target = null;
    }
    if (!target || !isEntityValid(target)) {
      restraints.splice(i, 1); // target died/unloaded — nothing left to clean
      continue;
    }
    if (now >= r.endTick) {
      releaseOne(r, now, "expired");
      restraints.splice(i, 1);
      continue;
    }
    try {
      // Keep our owned effect alive (refresh slightly past the remaining time).
      const remainingTicks = r.endTick - now;
      target.addEffect("slowness", Math.min(remainingTicks + 4, 200), { amplifier: r.amplifier, showParticles: false });
      if (r.fullLock) {
        // Hard lock: zero velocity so light targets cannot hop away.
        const v = readVelocity(target);
        if (Math.abs(v.x) > 0.01 || Math.abs(v.z) > 0.01 || v.y > 0.01) {
          setVelocity(target, { x: v.x * 0.1, y: Math.min(v.y, 0), z: v.z * 0.1 });
        }
      }
      if (now - r.lastParticleTick >= CONFIG.combat.restraintParticleInterval) {
        r.lastParticleTick = now;
        fx(target.dimension, "WEB_DOT", { x: target.location.x, y: target.location.y + 1.2, z: target.location.z }, {});
      }
    } catch (err) {
      errorThrottled("combat.tickRestraints", err);
      restraints.splice(i, 1);
    }
  }
}

function releaseOne(r, now, reason) {
  if (!r) return;
  try {
    // Only clean up what we own: the WEBBED tag marks our ownership (spec §20).
    const world = getWorldSafe();
    const target = world?.getEntity?.(r.entityId);
    if (target && isEntityValid(target) && target.hasTag?.(TAGS.WEBBED)) {
      target.removeTag(TAGS.WEBBED);
      target.removeEffect("slowness");
    }
  } catch {
    /* target gone — nothing to clean */
  }
}

/** Called on player leave/death: drop restraints owned by that player. */
export function dropRestraintsOf(playerId, now) {
  for (let i = restraints.length - 1; i >= 0; i--) {
    if (restraints[i].ownerPlayerId === playerId) {
      releaseOne(restraints[i], now, "owner_gone");
      restraints.splice(i, 1);
    }
  }
}

export function activeRestraintCount() {
  return restraints.length;
}

/** Test hook: clear everything (used by lifecycle hard-reset). */
export function clearAllRestraints(now) {
  for (const r of restraints) releaseOne(r, now, "reset");
  restraints.length = 0;
}

// ---------------------------------------------------------------------------
// Kill tracking → progression
// ---------------------------------------------------------------------------

export function onEntityDied(deadEntity, playerIdOrNull, now) {
  if (!deadEntity || typeof deadEntity.typeId !== "string") return;
  if (!ENEMY_TYPES.includes(deadEntity.typeId)) return;
  if (!playerIdOrNull) return; // only credit a player's challenge when attributable
  emit("progress", { playerId: playerIdOrNull, type: PROGRESS_EVENTS.ENEMY_DEFEATED, amount: 1 });
}

// world access for cleanup paths (set by lifecycle during init)
let worldRefHolder = null;
export function bindWorld(worldRef) {
  worldRefHolder = worldRef;
}
function getWorldSafe() {
  return worldRefHolder;
}

function safeDimId(entity) {
  try {
    return entity.dimension.id;
  } catch {
    return null;
  }
}
