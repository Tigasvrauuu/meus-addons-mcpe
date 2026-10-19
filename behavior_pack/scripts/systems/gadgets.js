// Gadget Launcher: fires the currently selected gadget. Each gadget has its
// own cooldown, its own effect and its own failure message. Cooldowns only
// start after a successful use, so a miss never costs the player time.
import { system } from "@minecraft/server";
import { GADGETS, SUITS } from "../core/config.js";
import { getProfile } from "../core/persistence.js";
import { isGadgetUnlocked, requirementText } from "../core/unlocks.js";
import { isReady, remainingTicks, startCooldown } from "../core/cooldowns.js";
import { dealImpactDamage, restrainTarget, hostileNear, isHostileTarget } from "../core/combat.js";
import { flash } from "../ui/hud.js";
import { bump } from "./progression.js";
import { errorOnce } from "../core/diagnostics.js";

const EXCLUDED_TYPES = ["minecraft:player", "minecraft:item", "minecraft:xp_orb"];

export function useGadget(player, rec) {
  const profile = getProfile(player);
  const id = profile.gadget;
  const def = GADGETS[id];
  if (!def) return;
  if (!isGadgetUnlocked(profile, id)) {
    flash(player, `§cLocked: ${def.name}. ${requirementText("gadget", id)}.`);
    return;
  }
  const now = system.currentTick;
  if (!isReady(rec.cooldowns, id, now)) {
    const secs = (remainingTicks(rec.cooldowns, id, now) / 20).toFixed(1);
    flash(player, `§7${def.name} recharging (${secs}s).`, 30);
    return;
  }

  let outcome;
  try {
    outcome = fire(player, id, now);
  } catch (error) {
    errorOnce(`gadget-${id}`, error);
    flash(player, "§cGadget malfunction. Try again.");
    return;
  }
  if (!outcome.ok) {
    flash(player, `§7${def.name}: ${outcome.reason}`, 40);
    return;
  }

  const multiplier = (SUITS[profile.suit] ?? SUITS.classic).cooldownMultiplier;
  startCooldown(rec.cooldowns, id, now, Math.round(def.cooldownTicks * multiplier));
  bump(player, "gadgetUses");
  flash(player, `§a${def.name}: ${outcome.message}`, 40);
}

function fire(player, id, now) {
  if (id === "impact_web") return fireImpactWeb(player);
  if (id === "web_restraint") return fireRestraint(player, now);
  if (id === "tech_pulse") return firePulse(player);
  return { ok: false, reason: "unknown gadget" };
}

function findTarget(player, range) {
  const hits = player.getEntitiesFromViewDirection({
    maxDistance: range,
    excludeTypes: EXCLUDED_TYPES,
  });
  for (const hit of hits) {
    const entity = hit.entity;
    if (entity && entity.id !== player.id && isHostileTarget(player, entity)) return entity;
  }
  return null;
}

function fireImpactWeb(player) {
  const def = GADGETS.impact_web;
  const target = findTarget(player, def.range);
  if (!target) return { ok: false, reason: "no target in your line of sight." };
  if (!dealImpactDamage(player, target, def.damage, def.knockback)) {
    return { ok: false, reason: "the web did not connect." };
  }
  bump(player, "impactHits");
  return { ok: true, message: "impact connected!" };
}

function fireRestraint(player, now) {
  const def = GADGETS.web_restraint;
  const target = findTarget(player, def.range);
  if (!target) return { ok: false, reason: "no target in range." };
  const tier = restrainTarget(player, target, now);
  if (!tier) return { ok: false, reason: "the target resisted the web." };
  bump(player, "restraints");
  const note = tier === "boss" ? "boss resisted, only slowed." : tier === "heavy" ? "heavy target slowed." : "target webbed.";
  return { ok: true, message: note };
}

function firePulse(player) {
  const def = GADGETS.tech_pulse;
  const targets = hostileNear(player.dimension, player.location, def.radius);
  let hits = 0;
  for (const target of targets) {
    if (!target.isValid) continue;
    if (!dealImpactDamage(player, target, def.damage, def.knockback)) continue;
    try {
      target.addEffect("slowness", def.slowDurationTicks, {
        amplifier: def.slowAmplifier,
        showParticles: true,
      });
    } catch (error) {
      errorOnce("pulse-slow", error);
    }
    hits += 1;
  }
  if (hits === 0) return { ok: false, reason: "no hostile mobs within 6 blocks." };
  bump(player, "pulses");
  return { ok: true, message: `pulse hit ${hits} foe${hits === 1 ? "" : "s"}.` };
}
