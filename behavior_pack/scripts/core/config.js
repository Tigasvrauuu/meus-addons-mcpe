// core/config.js — PURE module (no @minecraft imports; unit-testable in Node).
// Every tunable gameplay value lives here (spec §4.3). Values are validated on
// load with safe fallbacks so a bad edit can never break traversal.

const clampNumber = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/** Raw tunables. Edit these to re-balance the add-on. */
export const RAW_CONFIG = Object.freeze({
  traversal: {
    maxWebRange: 42, // blocks — web raycast distance
    minAnchorDistance: 3.5, // reject anchors closer than this
    minAnchorHeightAboveFeet: 0.5, // anchor must be at/above feet + this
    ropeSlack: 1.2, // allowed stretch before spring correction (blocks)
    springStiffness: 0.06, // pull-back acceleration per block of overshoot
    maxSpringCorrection: 0.35, // per-tick velocity cap for spring pull
    radialKill: 0.92, // how much outward radial velocity is removed when taut (0..1)
    pumpAccel: 0.016, // forward-input pump acceleration (per tick)
    pumpAccelSprint: 0.024, // pump acceleration while sprinting
    damping: 0.995, // per-tick velocity damping while swinging
    maxSpeed: 1.9, // hard speed cap while swinging (blocks/tick)
    maxUpwardSpeed: 1.2, // hard upward cap (prevents rocket launches)
    reelSpeed: 0.35, // rope shortening per tick while holding sneak
    minRopeLength: 4, // rope cannot reel shorter than this
    releaseLaunchBoost: 0.18, // upward boost applied on jump-release
    releaseRetain: 1.0, // fraction of velocity kept on release (1 = full momentum)
    releaseGraceTicks: 6, // ticks before a new web can attach after release
    anchorRevalidateTicks: 10, // how often the anchor block is re-checked
    zipAccel: 0.09, // web-zip acceleration toward anchor
    zipMaxSpeed: 1.6, // web-zip speed cap
    zipFinishDistance: 2.6, // stop zipping this close to the anchor
    zipMaxTicks: 80, // hard time cap for one zip
    strandSpacing: 0.9, // particle spacing along the web strand
    strandMaxPoints: 26, // particle cap per strand draw
    strandIntervalTicks: 2, // how often the strand is redrawn
  },
  climbing: {
    enabledByDefault: true,
    wallProbeDistance: 1.05, // raycast distance to find a wall
    climbUpSpeed: 0.24, // blocks/tick upward while holding jump
    climbDownSpeed: 0.2, // blocks/tick downward while holding sneak
    hoverLerp: 0.6, // how quickly vertical velocity settles to hover (0..1)
    stickPull: 0.03, // gentle inward pull to keep contact with the wall
    leapForce: 0.62, // horizontal leap-away impulse (sneak+jump)
    leapUp: 0.42, // vertical leap-away impulse
    lostWallGraceTicks: 6, // detach after wall is missing this long
    glideTriggerFallSpeed: 1.35, // falling faster than this after traversal → glide
    glideMaxTicks: 60, // glide duration cap
    glideFallSpeedCap: 0.35, // max downward speed while gliding
  },
  combat: {
    baseBonusDamage: 1, // bonus melee damage with any suit equipped
    comboWindowTicks: 40, // hits within this window escalate the combo
    comboMaxStacks: 3, // combo damage cap (stacks)
    comboDamagePerStack: 0.5, // bonus damage per combo stack
    comboKnockbackPerStack: 0.12, // extra knockback per combo stack
    airStrikeBonusDamage: 1, // extra damage when hitting while airborne
    airStrikeKnockback: 0.45, // extra knockback for air strikes
    attackReach: 4.2, // sanity reach for bonus application (blocks)
    bonusRetriggerTicks: 4, // min ticks between bonus applications per player
    dodgeImpulse: 0.85, // horizontal dodge dash impulse
    dodgeUp: 0.12, // small vertical lift on dodge
    dodgeCooldownTicks: 60, // 3s at 20tps
    restraintBaseTicks: 120, // 6s full restraint (light targets)
    restraintHeavyTicks: 60, // 3s slow-only restraint (heavy targets)
    restraintSlownessAmplifier: 5, // light targets: near-total immobilization
    restraintHeavyAmplifier: 2, // heavy targets: slowed, not locked
    restraintParticleInterval: 5, // cocoon particle cadence
    maxActiveRestraints: 12, // global cap on simultaneously webbed targets
  },
  gadgets: {
    // Cooldowns in ticks (20 = 1s). Suit passives multiply these.
    cooldowns: {
      web_shooter: 8,
      impact_web: 80,
      restraint_web: 120,
      web_pull: 100,
      tech_pulse: 400,
      threat_scanner: 300,
    },
    impact: { range: 22, damage: 2, knockback: 0.5, staggerTicks: 20 },
    pull: { entityRange: 18, blockRange: 30, entityPullForce: 0.85, heavyPullForce: 0.3 },
    pulse: { radius: 6, damage: 3, slownessTicks: 80, knockback: 0.7 },
    scanner: { durationTicks: 240, radiusMultiplier: 1.8, reportIntervalTicks: 40 },
  },
  sense: {
    radius: 14, // threat scan radius (blocks)
    scanIntervalTicks: 10, // scan cadence (never every tick)
    alertCooldownTicks: 30, // min ticks between audible/visual alerts
    closeAlertDistance: 4, // threats closer than this escalate feedback
    hurtPing: true, // always ping when the player takes damage
    shakeIntensity: 0.22, // camera shake for very close threats (if API present)
    shakeDurationSeconds: 0.3,
    // Lower score = higher priority. typeWeights multiply distance.
    typeWeights: {
      "minecraft:creeper": 0.55,
      "smx:enforcer": 0.6,
      "smx:brute": 0.75,
      "smx:gunner": 0.85,
      "smx:shadow": 0.85,
      "smx:thug": 0.9,
      default: 1.0,
    },
  },
  suits: {
    // Station purchase costs (itemTypeId -> count). Consumed on purchase.
    purchaseCosts: {
      stealth: { "minecraft:iron_ingot": 8 },
      advanced: { "minecraft:iron_ingot": 8, "minecraft:diamond": 2 },
      urban: { "minecraft:iron_ingot": 8, "minecraft:gold_ingot": 4 },
      iron: { "minecraft:iron_ingot": 12, "minecraft:gold_ingot": 2 },
    },
    ironPlating: {
      resistanceAmplifier: 1, // Resistance II for a moment after being hurt
      resistanceTicks: 30,
      internalCooldownTicks: 160, // 8s between plating procs
    },
  },
  progression: {
    sparringCount: 2, // thugs summoned from the station
    sparringRadius: 4,
    saveFlushTicks: 100, // throttled persistence cadence (5s)
  },
  performance: {
    hudIntervalTicks: 5, // action bar refresh cadence during states
    senseMaxThreatsTracked: 8,
    maxParticlesPerDraw: 30,
  },
});

/**
 * Validates a raw config object and returns a fully-populated, clamped config.
 * Missing/invalid values fall back to RAW_CONFIG defaults (spec §4.3).
 */
export function buildConfig(raw = RAW_CONFIG) {
  const src = raw && typeof raw === "object" ? raw : RAW_CONFIG;
  const d = RAW_CONFIG;
  const section = (name) => (src[name] && typeof src[name] === "object" ? src[name] : d[name]);

  const t = section("traversal");
  const c = section("climbing");
  const k = section("combat");
  const g = section("gadgets");
  const s = section("sense");
  const su = section("suits");
  const p = section("progression");
  const perf = section("performance");

  const num = (obj, key, min, max, fallback) =>
    clampNumber(obj ? obj[key] : undefined, min, max, fallback);

  return {
    traversal: {
      maxWebRange: num(t, "maxWebRange", 8, 96, d.traversal.maxWebRange),
      minAnchorDistance: num(t, "minAnchorDistance", 1, 20, d.traversal.minAnchorDistance),
      minAnchorHeightAboveFeet: num(t, "minAnchorHeightAboveFeet", -10, 20, d.traversal.minAnchorHeightAboveFeet),
      ropeSlack: num(t, "ropeSlack", 0, 8, d.traversal.ropeSlack),
      springStiffness: num(t, "springStiffness", 0.001, 0.5, d.traversal.springStiffness),
      maxSpringCorrection: num(t, "maxSpringCorrection", 0.05, 1, d.traversal.maxSpringCorrection),
      radialKill: num(t, "radialKill", 0, 1, d.traversal.radialKill),
      pumpAccel: num(t, "pumpAccel", 0, 0.2, d.traversal.pumpAccel),
      pumpAccelSprint: num(t, "pumpAccelSprint", 0, 0.2, d.traversal.pumpAccelSprint),
      damping: num(t, "damping", 0.9, 1, d.traversal.damping),
      maxSpeed: num(t, "maxSpeed", 0.2, 4, d.traversal.maxSpeed),
      maxUpwardSpeed: num(t, "maxUpwardSpeed", 0.1, 3, d.traversal.maxUpwardSpeed),
      reelSpeed: num(t, "reelSpeed", 0.05, 1, d.traversal.reelSpeed),
      minRopeLength: num(t, "minRopeLength", 2, 20, d.traversal.minRopeLength),
      releaseLaunchBoost: num(t, "releaseLaunchBoost", 0, 1, d.traversal.releaseLaunchBoost),
      releaseRetain: num(t, "releaseRetain", 0, 1, d.traversal.releaseRetain),
      releaseGraceTicks: num(t, "releaseGraceTicks", 0, 60, d.traversal.releaseGraceTicks),
      anchorRevalidateTicks: num(t, "anchorRevalidateTicks", 4, 60, d.traversal.anchorRevalidateTicks),
      zipAccel: num(t, "zipAccel", 0.01, 0.5, d.traversal.zipAccel),
      zipMaxSpeed: num(t, "zipMaxSpeed", 0.2, 3, d.traversal.zipMaxSpeed),
      zipFinishDistance: num(t, "zipFinishDistance", 1, 8, d.traversal.zipFinishDistance),
      zipMaxTicks: num(t, "zipMaxTicks", 10, 400, d.traversal.zipMaxTicks),
      strandSpacing: num(t, "strandSpacing", 0.25, 4, d.traversal.strandSpacing),
      strandMaxPoints: num(t, "strandMaxPoints", 2, 64, d.traversal.strandMaxPoints),
      strandIntervalTicks: num(t, "strandIntervalTicks", 1, 20, d.traversal.strandIntervalTicks),
    },
    climbing: {
      enabledByDefault: typeof c.enabledByDefault === "boolean" ? c.enabledByDefault : d.climbing.enabledByDefault,
      wallProbeDistance: num(c, "wallProbeDistance", 0.5, 3, d.climbing.wallProbeDistance),
      climbUpSpeed: num(c, "climbUpSpeed", 0.05, 0.6, d.climbing.climbUpSpeed),
      climbDownSpeed: num(c, "climbDownSpeed", 0.05, 0.6, d.climbing.climbDownSpeed),
      hoverLerp: num(c, "hoverLerp", 0.05, 1, d.climbing.hoverLerp),
      stickPull: num(c, "stickPull", 0, 0.2, d.climbing.stickPull),
      leapForce: num(c, "leapForce", 0.1, 2, d.climbing.leapForce),
      leapUp: num(c, "leapUp", 0.1, 1.5, d.climbing.leapUp),
      lostWallGraceTicks: num(c, "lostWallGraceTicks", 2, 40, d.climbing.lostWallGraceTicks),
      glideTriggerFallSpeed: num(c, "glideTriggerFallSpeed", 0.5, 4, d.climbing.glideTriggerFallSpeed),
      glideMaxTicks: num(c, "glideMaxTicks", 10, 400, d.climbing.glideMaxTicks),
      glideFallSpeedCap: num(c, "glideFallSpeedCap", 0.1, 1.5, d.climbing.glideFallSpeedCap),
    },
    combat: {
      baseBonusDamage: num(k, "baseBonusDamage", 0, 10, d.combat.baseBonusDamage),
      comboWindowTicks: num(k, "comboWindowTicks", 10, 200, d.combat.comboWindowTicks),
      comboMaxStacks: num(k, "comboMaxStacks", 1, 10, d.combat.comboMaxStacks),
      comboDamagePerStack: num(k, "comboDamagePerStack", 0, 3, d.combat.comboDamagePerStack),
      comboKnockbackPerStack: num(k, "comboKnockbackPerStack", 0, 1, d.combat.comboKnockbackPerStack),
      airStrikeBonusDamage: num(k, "airStrikeBonusDamage", 0, 5, d.combat.airStrikeBonusDamage),
      airStrikeKnockback: num(k, "airStrikeKnockback", 0, 2, d.combat.airStrikeKnockback),
      attackReach: num(k, "attackReach", 2, 10, d.combat.attackReach),
      bonusRetriggerTicks: num(k, "bonusRetriggerTicks", 0, 40, d.combat.bonusRetriggerTicks),
      dodgeImpulse: num(k, "dodgeImpulse", 0.1, 2, d.combat.dodgeImpulse),
      dodgeUp: num(k, "dodgeUp", 0, 1, d.combat.dodgeUp),
      dodgeCooldownTicks: num(k, "dodgeCooldownTicks", 10, 400, d.combat.dodgeCooldownTicks),
      restraintBaseTicks: num(k, "restraintBaseTicks", 20, 600, d.combat.restraintBaseTicks),
      restraintHeavyTicks: num(k, "restraintHeavyTicks", 10, 600, d.combat.restraintHeavyTicks),
      restraintSlownessAmplifier: num(k, "restraintSlownessAmplifier", 0, 10, d.combat.restraintSlownessAmplifier),
      restraintHeavyAmplifier: num(k, "restraintHeavyAmplifier", 0, 10, d.combat.restraintHeavyAmplifier),
      restraintParticleInterval: num(k, "restraintParticleInterval", 2, 40, d.combat.restraintParticleInterval),
      maxActiveRestraints: num(k, "maxActiveRestraints", 1, 64, d.combat.maxActiveRestraints),
    },
    gadgets: {
      cooldowns: {
        web_shooter: num(g.cooldowns ?? {}, "web_shooter", 0, 200, d.gadgets.cooldowns.web_shooter),
        impact_web: num(g.cooldowns ?? {}, "impact_web", 0, 600, d.gadgets.cooldowns.impact_web),
        restraint_web: num(g.cooldowns ?? {}, "restraint_web", 0, 600, d.gadgets.cooldowns.restraint_web),
        web_pull: num(g.cooldowns ?? {}, "web_pull", 0, 600, d.gadgets.cooldowns.web_pull),
        tech_pulse: num(g.cooldowns ?? {}, "tech_pulse", 0, 1200, d.gadgets.cooldowns.tech_pulse),
        threat_scanner: num(g.cooldowns ?? {}, "threat_scanner", 0, 1200, d.gadgets.cooldowns.threat_scanner),
      },
      impact: {
        range: num(g.impact ?? {}, "range", 4, 48, d.gadgets.impact.range),
        damage: num(g.impact ?? {}, "damage", 0, 10, d.gadgets.impact.damage),
        knockback: num(g.impact ?? {}, "knockback", 0, 2, d.gadgets.impact.knockback),
        staggerTicks: num(g.impact ?? {}, "staggerTicks", 0, 100, d.gadgets.impact.staggerTicks),
      },
      pull: {
        entityRange: num(g.pull ?? {}, "entityRange", 4, 40, d.gadgets.pull.entityRange),
        blockRange: num(g.pull ?? {}, "blockRange", 4, 60, d.gadgets.pull.blockRange),
        entityPullForce: num(g.pull ?? {}, "entityPullForce", 0.1, 2, d.gadgets.pull.entityPullForce),
        heavyPullForce: num(g.pull ?? {}, "heavyPullForce", 0.05, 1, d.gadgets.pull.heavyPullForce),
      },
      pulse: {
        radius: num(g.pulse ?? {}, "radius", 2, 16, d.gadgets.pulse.radius),
        damage: num(g.pulse ?? {}, "damage", 0, 10, d.gadgets.pulse.damage),
        slownessTicks: num(g.pulse ?? {}, "slownessTicks", 0, 200, d.gadgets.pulse.slownessTicks),
        knockback: num(g.pulse ?? {}, "knockback", 0, 2, d.gadgets.pulse.knockback),
      },
      scanner: {
        durationTicks: num(g.scanner ?? {}, "durationTicks", 40, 1200, d.gadgets.scanner.durationTicks),
        radiusMultiplier: num(g.scanner ?? {}, "radiusMultiplier", 1, 3, d.gadgets.scanner.radiusMultiplier),
        reportIntervalTicks: num(g.scanner ?? {}, "reportIntervalTicks", 10, 200, d.gadgets.scanner.reportIntervalTicks),
      },
    },
    sense: {
      radius: num(s, "radius", 4, 48, d.sense.radius),
      scanIntervalTicks: num(s, "scanIntervalTicks", 4, 100, d.sense.scanIntervalTicks),
      alertCooldownTicks: num(s, "alertCooldownTicks", 10, 200, d.sense.alertCooldownTicks),
      closeAlertDistance: num(s, "closeAlertDistance", 1, 16, d.sense.closeAlertDistance),
      hurtPing: typeof s.hurtPing === "boolean" ? s.hurtPing : d.sense.hurtPing,
      shakeIntensity: num(s, "shakeIntensity", 0, 1, d.sense.shakeIntensity),
      shakeDurationSeconds: num(s, "shakeDurationSeconds", 0.05, 2, d.sense.shakeDurationSeconds),
      typeWeights: s.typeWeights && typeof s.typeWeights === "object" ? s.typeWeights : d.sense.typeWeights,
    },
    suits: {
      purchaseCosts:
        su.purchaseCosts && typeof su.purchaseCosts === "object"
          ? su.purchaseCosts
          : d.suits.purchaseCosts,
      ironPlating: {
        resistanceAmplifier: num(su.ironPlating ?? {}, "resistanceAmplifier", 0, 4, d.suits.ironPlating.resistanceAmplifier),
        resistanceTicks: num(su.ironPlating ?? {}, "resistanceTicks", 5, 200, d.suits.ironPlating.resistanceTicks),
        internalCooldownTicks: num(su.ironPlating ?? {}, "internalCooldownTicks", 20, 600, d.suits.ironPlating.internalCooldownTicks),
      },
    },
    progression: {
      sparringCount: num(p, "sparringCount", 0, 8, d.progression.sparringCount),
      sparringRadius: num(p, "sparringRadius", 2, 12, d.progression.sparringRadius),
      saveFlushTicks: num(p, "saveFlushTicks", 20, 1200, d.progression.saveFlushTicks),
    },
    performance: {
      hudIntervalTicks: num(perf, "hudIntervalTicks", 2, 40, d.performance.hudIntervalTicks),
      senseMaxThreatsTracked: num(perf, "senseMaxThreatsTracked", 1, 32, d.performance.senseMaxThreatsTracked),
      maxParticlesPerDraw: num(perf, "maxParticlesPerDraw", 4, 128, d.performance.maxParticlesPerDraw),
    },
  };
}

/** The single validated config instance used at runtime. */
export const CONFIG = buildConfig(RAW_CONFIG);

/**
 * Suit passive modifier sets. Honest, code-implemented effects only (spec §11).
 * Multipliers are applied by the owning systems (traversal/gadgets/combat/climb).
 */
export const SUIT_PASSIVES = Object.freeze({
  improvised: { swingPower: 1.0, climbSpeed: 1.0, gadgetCooldown: 1.0, meleeBonus: 0, senseRadius: 1.0, dodgeCooldown: 1.0, zipSpeed: 1.0, plating: false },
  classic: { swingPower: 1.05, climbSpeed: 1.0, gadgetCooldown: 1.0, meleeBonus: 0.5, senseRadius: 1.0, dodgeCooldown: 1.0, zipSpeed: 1.0, plating: false },
  stealth: { swingPower: 1.0, climbSpeed: 1.05, gadgetCooldown: 0.9, meleeBonus: 0, senseRadius: 1.25, dodgeCooldown: 0.9, zipSpeed: 1.0, plating: false },
  advanced: { swingPower: 1.0, climbSpeed: 1.0, gadgetCooldown: 0.75, meleeBonus: 0, senseRadius: 1.1, dodgeCooldown: 1.0, zipSpeed: 1.05, plating: false },
  urban: { swingPower: 1.02, climbSpeed: 1.25, gadgetCooldown: 0.95, meleeBonus: 0, senseRadius: 1.0, dodgeCooldown: 0.7, zipSpeed: 1.1, plating: false },
  iron: { swingPower: 0.98, climbSpeed: 0.9, gadgetCooldown: 1.0, meleeBonus: 0.5, senseRadius: 1.0, dodgeCooldown: 1.1, zipSpeed: 1.0, plating: true },
});

/** Default passive set used when no suit is registered for some reason. */
export const NEUTRAL_PASSIVES = Object.freeze({
  swingPower: 1, climbSpeed: 1, gadgetCooldown: 1, meleeBonus: 0, senseRadius: 1, dodgeCooldown: 1, zipSpeed: 1, plating: false,
});
