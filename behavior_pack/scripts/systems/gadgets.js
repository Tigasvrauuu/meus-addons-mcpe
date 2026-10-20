// systems/gadgets.js — GadgetService (spec §10).
// One registry, one activation path, one cooldown model. Each gadget is a real
// item; the itemUse event routes here. Gadgets:
//   web_shooter     → traversal toggle (delegates to traversal.js; no duplicate
//                     implementation, spec §10.1)
//   impact_web      → damaging stagger shot (distinct from restraint)
//   restraint_web   → class-limited immobilization (delegates to combat.js)
//   web_pull        → zip to surface OR bounded pull of an entity
//   tech_pulse      → radial disrupt/slow with knockback
//   threat_scanner  → deliberate extended Spider-Sense window
// Cooldowns are timestamp-based + mirrored to the vanilla cooldown bar via
// player.startItemCooldown, and multiplied by suit passives.

import { CONFIG } from "../core/config.js";
import { GADGETS, ITEMS, COOLDOWN_CATEGORIES, TAGS, PROGRESS_EVENTS, MOVE_STATE } from "../core/constants.js";
import { isEntityValid, readVelocity, setVelocity, lookDirection, blockCenter, chestLocation, distanceBetween } from "../core/utils.js";
import { isReady, nextReadyTick, remaining, formatRemaining } from "../core/cooldowns.js";
import { passivesOf, settingsOf, setCooldown, pushHudMessage } from "../core/state.js";
import { sfx, fx, fxPoints, toast } from "../ui/hud.js";
import { emit } from "../core/bus.js";
import { errorThrottled } from "../core/logger.js";
import * as traversal from "./traversal.js";
import * as combat from "./combat.js";
import * as sense from "./sense.js";
import { strandPoints } from "./swing_math.js";
import { classifyPullTarget } from "./restraint_rules.js";

/** itemId → gadget id. */
const ITEM_TO_GADGET = Object.freeze({
  [ITEMS.WEB_SHOOTER]: GADGETS.WEB_SHOOTER,
  [ITEMS.IMPACT_WEB]: GADGETS.IMPACT_WEB,
  [ITEMS.RESTRAINT_WEB]: GADGETS.RESTRAINT_WEB,
  [ITEMS.WEB_PULL]: GADGETS.WEB_PULL,
  [ITEMS.TECH_PULSE]: GADGETS.TECH_PULSE,
  [ITEMS.THREAT_SCANNER]: GADGETS.THREAT_SCANNER,
});

export function gadgetIdForItem(itemId) {
  return ITEM_TO_GADGET[itemId] ?? null;
}

export function isGadgetItem(itemId) {
  return Object.prototype.hasOwnProperty.call(ITEM_TO_GADGET, itemId);
}

/** Cooldown state for menus/HUD. */
export function gadgetCooldownInfo(state, gadgetId, now) {
  const ready = state.cooldowns[gadgetId];
  return {
    ready: isReady(ready, now),
    remainingTicks: remaining(ready, now),
    label: formatRemaining(ready, now),
  };
}

/**
 * Central activation entry (called from the itemUse event).
 * Returns a human-readable result for logging/tests.
 */
export function activateGadget(player, state, now, itemId) {
  const gadgetId = gadgetIdForItem(itemId);
  if (!gadgetId) return "not_a_gadget";
  if (!isEntityValid(player) || state.deadUntilRespawn) return "invalid_player";

  if (gadgetId === GADGETS.WEB_SHOOTER) {
    const res = traversal.fireOrRelease(player, state, now);
    return `web_shooter:${res}`;
  }

  // Everything else requires a suit (identity gate) and honors cooldowns.
  if (!state.suit.id) {
    toast(player, state, now, "§eEquip a Spider Suit to use gadgets!", 45, 3);
    sfx(player, "THWIP_FAIL");
    return "no_suit";
  }
  if (state.move === MOVE_STATE.CLIMBING) {
    // Gadgets on the wall are fine — but detach first for cleanliness of aim.
  }
  if (!isReady(state.cooldowns[gadgetId], now)) {
    const info = gadgetCooldownInfo(state, gadgetId, now);
    toast(player, state, now, `§7⌛ ${prettyGadgetName(gadgetId)} recharging §8${info.label}`, 20, 2);
    sfx(player, "THWIP_FAIL", { volume: 0.3 });
    return "cooldown";
  }

  const passives = passivesOf(state);
  const base = CONFIG.gadgets.cooldowns[gadgetId] ?? 60;
  const readyAt = nextReadyTick(now, base, passives.gadgetCooldown);
  setCooldown(state, gadgetId, readyAt);
  startVisualCooldown(player, COOLDOWN_CATEGORIES[gadgetId.toUpperCase()], remaining(state.cooldowns[gadgetId], now));

  try {
    switch (gadgetId) {
      case GADGETS.IMPACT_WEB:
        return runImpactWeb(player, state, now);
      case GADGETS.RESTRAINT_WEB:
        return runRestraintWeb(player, state, now);
      case GADGETS.WEB_PULL:
        return runWebPull(player, state, now);
      case GADGETS.TECH_PULSE:
        return runTechPulse(player, state, now);
      case GADGETS.THREAT_SCANNER:
        return runThreatScanner(player, state, now);
      default:
        return "unknown_gadget";
    }
  } catch (err) {
    errorThrottled(`gadgets.${gadgetId}`, err);
    toast(player, state, now, "§c⚠ Gadget misfired", 30, 4);
    return "error";
  }
}

// ---------------------------------------------------------------------------
// Gadget B — Impact Web (spec §10.2): damage + stagger, NOT immobilization
// ---------------------------------------------------------------------------

function runImpactWeb(player, state, now) {
  const cfg = CONFIG.gadgets.impact;
  const target = raycastEntity(player, cfg.range);
  const chest = chestLocation(player);

  if (target) {
    if (target.typeId === "minecraft:player") {
      toast(player, state, now, "§7No friendly fire!", 20, 2);
      return "impact_web:friendly";
    }
    try {
      target.applyDamage(cfg.damage, { cause: "entityAttack", damagingEntity: player });
      // Stagger: brief slowness + knockback (distinct from restraint).
      target.addEffect("slowness", cfg.staggerTicks, { amplifier: 1, showParticles: false });
      target.addTag(TAGS.STAGGERED);
      const kbDir = normalizeHorizontal(subLoc(target.location, player.location));
      const vel = readVelocity(target);
      setVelocity(target, {
        x: vel.x + kbDir.x * cfg.knockback,
        y: Math.min(vel.y + 0.15, 0.6),
        z: vel.z + kbDir.z * cfg.knockback,
      });
      fx(target.dimension, "WEB_SPLAT", { x: target.location.x, y: target.location.y + 1.1, z: target.location.z });
      emit("progress", { playerId: state.playerId, type: PROGRESS_EVENTS.GADGET_HIT, amount: 1 });
      sfx(player, "THWIP");
      sfx(player, "MELEE_HIT", { volume: 0.6 });
      pushHudMessage(state, `§f💥 Impact web §7${cfg.damage} dmg + stagger`, now, 25, 2);
      return "impact_web:hit";
    } catch (err) {
      errorThrottled("gadgets.impact.hit", err);
      return "impact_web:error";
    }
  }

  // No entity: splat on the block being looked at (visual + audio feedback).
  let blockHit = null;
  try {
    blockHit = player.getBlockFromViewDirection({ maxDistance: cfg.range, includeLiquidBlocks: false, includePassableBlocks: false });
  } catch {
    blockHit = null;
  }
  const point = blockHit?.block ? blockCenter(blockHit.block.location) : pointAhead(chest, lookDirection(player), cfg.range * 0.6);
  fx(player.dimension, "WEB_SPLAT", point);
  drawQuickStrand(player, chest, point, state, now);
  sfx(player, "THWIP");
  pushHudMessage(state, "§7💥 Impact web §8(missed — no target)", now, 20, 1);
  return "impact_web:miss";
}

// ---------------------------------------------------------------------------
// Gadget C — Restraint Web (spec §10.3)
// ---------------------------------------------------------------------------

function runRestraintWeb(player, state, now) {
  const range = 18;
  const target = raycastEntity(player, range);
  const chest = chestLocation(player);

  if (!target) {
    let blockHit = null;
    try {
      blockHit = player.getBlockFromViewDirection({ maxDistance: range, includeLiquidBlocks: false, includePassableBlocks: false });
    } catch {
      blockHit = null;
    }
    const point = blockHit?.block ? blockCenter(blockHit.block.location) : pointAhead(chest, lookDirection(player), range * 0.6);
    fx(player.dimension, "WEB_SPLAT", point);
    drawQuickStrand(player, chest, point, state, now);
    sfx(player, "THWIP");
    pushHudMessage(state, "§7🕸 Restraint web §8(missed — aim at a target)", now, 20, 1);
    return "restraint_web:miss";
  }

  const cls = combat.applyRestraint(player, state, target, now);
  drawQuickStrand(player, chest, target.location, state, now);
  sfx(player, "THWIP");
  if (cls.cls === "immune") {
    sfx(player, "RESISTED");
    pushHudMessage(state, "§c✕ TARGET RESISTED §7the webbing!", now, 30, 3);
    return "restraint_web:immune";
  }
  if (cls.cls === "invalid") return "restraint_web:invalid";
  if (cls.cls === "heavy") {
    emit("progress", { playerId: state.playerId, type: PROGRESS_EVENTS.GADGET_HIT, amount: 1 });
    pushHudMessage(state, "§e🕸 Heavy target §7slowed (not locked)", now, 30, 2);
    return "restraint_web:heavy";
  }
  emit("progress", { playerId: state.playerId, type: PROGRESS_EVENTS.GADGET_HIT, amount: 1 });
  pushHudMessage(state, `§f🕸 Webbed! §7${(cls.durationTicks / 20).toFixed(0)}s`, now, 25, 2);
  return "restraint_web:hit";
}

// ---------------------------------------------------------------------------
// Gadget D — Web Pull / Zip (spec §10.4)
// ---------------------------------------------------------------------------

function runWebPull(player, state, now) {
  const cfg = CONFIG.gadgets.pull;
  const target = raycastEntity(player, cfg.entityRange);

  if (target && target.typeId !== "minecraft:player") {
    const cls = classifyPullTarget({ typeId: target.typeId, isPlayer: false, alive: true });
    if (cls.mode === "none") {
      sfx(player, "RESISTED");
      pushHudMessage(state, "§c✕ Too heavy to pull!", now, 25, 3);
      return "web_pull:immune";
    }
    const force = cls.mode === "weak" ? cfg.heavyPullForce : cfg.entityPullForce;
    const dir = normalizeHorizontal(subLoc(player.location, target.location));
    try {
      const vel = readVelocity(target);
      setVelocity(target, {
        x: vel.x * 0.3 + dir.x * force,
        y: Math.max(vel.y * 0.3, 0.05),
        z: vel.z * 0.3 + dir.z * force,
      });
      fx(target.dimension, "WEB_SPLAT", { x: target.location.x, y: target.location.y + 1.2, z: target.location.z });
      drawQuickStrand(player, chestLocation(player), target.location, state, now);
      sfx(player, "ZIP");
      emit("progress", { playerId: state.playerId, type: PROGRESS_EVENTS.GADGET_HIT, amount: 1 });
      pushHudMessage(state, "§f🕸 Target pulled!", now, 25, 2);
      return "web_pull:entity";
    } catch (err) {
      errorThrottled("gadgets.pull.entity", err);
      return "web_pull:error";
    }
  }

  // Surface mode: zip the player toward the anchor (bounded, abortable).
  let blockHit = null;
  try {
    blockHit = player.getBlockFromViewDirection({ maxDistance: cfg.blockRange, includeLiquidBlocks: false, includePassableBlocks: false });
  } catch {
    blockHit = null;
  }
  if (!blockHit?.block) {
    sfx(player, "THWIP_FAIL");
    pushHudMessage(state, "§7✕ No surface to zip to", now, 25, 2);
    return "web_pull:no_anchor";
  }
  const anchor = blockCenter(blockHit.block.location);
  const started = traversal.startZip(player, state, now, anchor);
  if (!started) {
    pushHudMessage(state, "§7✕ Can't zip right now", now, 20, 2);
    return "web_pull:busy";
  }
  drawQuickStrand(player, chestLocation(player), anchor, state, now);
  return "web_pull:zip";
}

// ---------------------------------------------------------------------------
// Gadget E — Tech Pulse (spec §10.5)
// ---------------------------------------------------------------------------

function runTechPulse(player, state, now) {
  const cfg = CONFIG.gadgets.pulse;
  sfx(player, "PULSE");
  fx(player.dimension, "PULSE_RING", { x: player.location.x, y: player.location.y + 1, z: player.location.z });

  let affected = 0;
  let entities;
  try {
    entities = player.dimension.getEntities({
      location: player.location,
      maxDistance: cfg.radius,
      families: ["monster"],
    });
  } catch (err) {
    errorThrottled("gadgets.pulse.query", err);
    return "tech_pulse:error";
  }

  for (const e of entities) {
    if (!isEntityValid(e) || e.typeId === "minecraft:player") continue;
    affected += 1;
    try {
      e.applyDamage(cfg.damage, { cause: "entityAttack", damagingEntity: player });
      e.addEffect("slowness", cfg.slownessTicks, { amplifier: 2, showParticles: false });
      const dir = normalizeHorizontal(subLoc(e.location, player.location));
      const vel = readVelocity(e);
      setVelocity(e, {
        x: vel.x + dir.x * cfg.knockback,
        y: Math.min(vel.y + 0.2, 0.7),
        z: vel.z + dir.z * cfg.knockback,
      });
      fx(e.dimension, "PULSE_RING", { x: e.location.x, y: e.location.y + 1, z: e.location.z }, { skip: settingsOf(state).reducedParticles });
    } catch (err) {
      errorThrottled("gadgets.pulse.apply", err);
    }
  }
  if (affected > 0) emit("progress", { playerId: state.playerId, type: PROGRESS_EVENTS.GADGET_HIT, amount: affected });
  pushHudMessage(state, affected > 0 ? `§b⚡ Tech pulse §7disrupted ${affected} hostiles` : "§b⚡ Tech pulse §8(no targets)", now, 30, 2);
  return affected > 0 ? "tech_pulse:hit" : "tech_pulse:empty";
}

// ---------------------------------------------------------------------------
// Gadget F — Threat Scanner (spec §10.6)
// ---------------------------------------------------------------------------

function runThreatScanner(player, state, now) {
  sense.activateScanner(state, now);
  sfx(player, "CHALLENGE_START");
  pushHudMessage(state, "§b⌖ Threat scanner active §8— extended sense window", now, 40, 3);
  return "threat_scanner:on";
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function raycastEntity(player, maxDistance) {
  try {
    const hits = player.getEntitiesFromViewDirection({ maxDistance, ignoreBlockCollision: false });
    if (hits && hits.length > 0) return hits[0].entity ?? null;
  } catch (err) {
    errorThrottled("gadgets.entityRaycast", err);
  }
  return null;
}

function drawQuickStrand(player, from, to, state, now) {
  try {
    const settings = settingsOf(state);
    const points = strandPoints(from, to, settings.reducedParticles ? 1.6 : 0.8, 18);
    fxPoints(player.dimension, "WEB_DOT", points, {});
  } catch {
    /* cosmetic only */
  }
}

function subLoc(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function normalizeHorizontal(v) {
  const len = Math.sqrt(v.x * v.x + v.z * v.z);
  if (len < 1e-6) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: 0, z: v.z / len };
}

function pointAhead(from, dir, dist) {
  return { x: from.x + dir.x * dist, y: from.y + dir.y * dist, z: from.z + dir.z * dist };
}

function startVisualCooldown(player, category, ticks) {
  if (!category || ticks <= 0) return;
  try {
    player.startItemCooldown?.(category, ticks);
  } catch {
    /* cosmetic */
  }
}

export function prettyGadgetName(gadgetId) {
  switch (gadgetId) {
    case GADGETS.WEB_SHOOTER: return "Web-Shooter";
    case GADGETS.IMPACT_WEB: return "Impact Web";
    case GADGETS.RESTRAINT_WEB: return "Restraint Web";
    case GADGETS.WEB_PULL: return "Web Pull / Zip";
    case GADGETS.TECH_PULSE: return "Tech Pulse";
    case GADGETS.THREAT_SCANNER: return "Threat Scanner";
    default: return gadgetId;
  }
}
