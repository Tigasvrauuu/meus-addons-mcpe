// systems/sense.js — SpiderSenseService (spec §8).
// Honest proximity-based threat detection: bounded-radius entity queries on an
// interval (never every tick, never global), prioritized by distance × type
// weight. Feedback = action-bar alert with a directional arrow, a subtle sound
// ping and (where the runtime provides it, 2.10+) a light camera shake for
// very close threats. The Threat Scanner gadget temporarily extends radius and
// reports a summary — it never claims to see through walls beyond the query.

import { CONFIG } from "../core/config.js";
import { GADGETS } from "../core/constants.js";
import { isEntityValid, distanceBetween, readVelocity } from "../core/utils.js";
import { passivesOf, settingsOf, pushHudMessage } from "../core/state.js";
import { threatScore } from "./restraint_rules.js";
import { sfx, fx, senseAlertText, arrowTo } from "../ui/hud.js";
import { errorThrottled } from "../core/logger.js";

/**
 * Periodic scan for one player (called by the scheduler every
 * cfg.scanIntervalTicks). Returns the current threat (or null) and stores it
 * on the state for the HUD.
 */
export function scan(player, state, now) {
  const settings = settingsOf(state);
  if (!state.suit.id || !settings.senseEnabled || state.deadUntilRespawn) {
    state.sense.threat = null;
    return null;
  }
  if (!isEntityValid(player)) return null;

  const cfg = CONFIG.sense;
  const passives = passivesOf(state);
  const scannerActive = now < state.scanner.untilTick;
  const radius = cfg.radius * passives.senseRadius * (scannerActive ? CONFIG.gadgets.scanner.radiusMultiplier : 1);

  let entities;
  try {
    entities = player.dimension.getEntities({
      location: player.location,
      maxDistance: radius,
      families: ["monster"],
      excludeTypes: ["minecraft:armor_stand"],
    });
  } catch (err) {
    errorThrottled("sense.scan", err);
    return null;
  }

  // Prioritize: lowest score = closest/most dangerous.
  let best = null;
  let bestScore = Infinity;
  let count = 0;
  const tracked = Math.min(entities.length, CONFIG.performance.senseMaxThreatsTracked * 4);
  for (let i = 0; i < tracked; i++) {
    const e = entities[i];
    if (!isEntityValid(e)) continue;
    count += 1;
    let dist;
    try {
      dist = distanceBetween(player.location, e.location);
    } catch {
      continue;
    }
    const score = threatScore(e.typeId, dist, cfg);
    if (score < bestScore) {
      bestScore = score;
      best = { entityId: e.id, typeId: e.typeId, dist, location: { ...e.location }, at: now };
    }
  }

  state.sense.threat = best;

  if (best) {
    const severity = best.dist < cfg.closeAlertDistance ? 2 : best.dist < radius * 0.55 ? 1 : 0;
    // Audible/visual alert with cooldown (no spam, spec §8.3).
    // Close-range (severity 2) threats may re-alert on a shorter cooldown.
    const sevCooldown =
      severity === 2 ? Math.floor(cfg.alertCooldownTicks / 3) : cfg.alertCooldownTicks;
    if (now - state.sense.lastAlertTick >= sevCooldown) {
      state.sense.lastAlertTick = now;
      const arrow = arrowTo(player, best.location);
      pushHudMessage(
        state,
        senseAlertText(best.dist, arrow, severity),
        now,
        cfg.alertCooldownTicks,
        severity === 2 ? 4 : 3
      );
      if (settings.senseSound) sfx(player, severity >= 1 ? "SENSE_STRONG" : "SENSE_PING");
      fx(player.dimension, "SENSE_PING", { x: player.location.x, y: player.location.y + 1.6, z: player.location.z }, { skip: settings.reducedParticles });
      if (severity === 2 && settings.senseShake) tryCameraShake(player);
    }
    // Scanner mode: deliberate periodic summary (spec §10.6).
    if (scannerActive && now - state.scanner.lastReportTick >= CONFIG.gadgets.scanner.reportIntervalTicks) {
      state.scanner.lastReportTick = now;
      pushHudMessage(
        state,
        `§b⌖ SCAN §7${count} hostile${count === 1 ? "" : "s"} §8· nearest ${best.dist.toFixed(1)}m ${arrowTo(player, best.location)}`,
        now,
        CONFIG.gadgets.scanner.reportIntervalTicks - 2,
        3
      );
    }
  }
  return best;
}

/** Immediate reactive ping when the player takes damage (spec §8.2). */
export function onPlayerHurt(player, state, now) {
  const settings = settingsOf(state);
  if (!settings.senseEnabled || !state.suit.id) return;
  if (!CONFIG.sense.hurtPing) return;
  state.sense.lastAlertTick = now;
  pushHudMessage(state, "§c⚠ SPIDER-SENSE!!! §4you're being hit!", now, 30, 5);
  if (settings.senseSound) sfx(player, "SENSE_HURT");
}

/** Activates scanner mode (Threat Scanner gadget). */
export function activateScanner(state, now) {
  state.scanner.untilTick = now + CONFIG.gadgets.scanner.durationTicks;
  state.scanner.lastReportTick = now;
}

export function isScannerActive(state, now) {
  return now < state.scanner.untilTick;
}

/** Camera shake only exists on newer runtimes — feature-detect, never assume. */
function tryCameraShake(player) {
  try {
    const cam = player.camera;
    if (cam && typeof cam.addShake === "function") {
      cam.addShake({
        intensity: CONFIG.sense.shakeIntensity,
        duration: CONFIG.sense.shakeDurationSeconds,
      });
    }
  } catch {
    /* not available on this runtime — feedback still delivered via HUD/sound */
  }
}
