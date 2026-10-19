// Server-authoritative tuning values. Keep every balance number here.
// Units: blocks for distance, ticks (20 per second) for time,
// blocks-per-tick for velocity (Script API velocity/impulse units).
// Pure data: no imports, so it can be unit-tested outside the game.

export const PACK = Object.freeze({
  name: "Spider-Man: Definitive Experience",
  version: "1.0.0",
  profileKey: "spiderman:profile",
  profileSchema: 1,
});

export const WEB = Object.freeze({
  maxRange: 30,                // anchor raycast distance
  minRope: 3,                  // minimum rope length
  maxRope: 30,                 // maximum rope length
  pivotHeight: 1.4,            // rope attaches near the shoulders (player feet + this)
  maxSwingTicks: 20 * 25,      // automatic release after 25 seconds
  maxSpeed: 1.3,               // speed cap while swinging (blocks/tick), before suit mods
  steerImpulse: 0.025,         // steering added per tick toward the view direction
  pullGain: 0.08,              // rope correction per block of overstretch
  pullMax: 0.35,               // cap on a single tick's rope correction
  releaseBoost: 0.12,          // forward nudge when releasing on purpose
  releaseMaxSpeed: 1.2,        // speed cap applied right after release
  reattachCooldownTicks: 8,    // short gap between release and the next shot
  anchorCheckTicks: 5,         // how often the anchor is revalidated
  minSwingTicksBeforeLanding: 10, // ignore "on ground" during the first ticks
  ropeParticleStep: 2,         // draw the thread every N ticks
  unsafeAnchorTypes: Object.freeze([
    "minecraft:magma",
    "minecraft:cactus",
    "minecraft:fire",
    "minecraft:soul_fire",
    "minecraft:sweet_berry_bush",
    "minecraft:tnt",
  ]),
});

export const CLING = Object.freeze({
  maxDistance: 2.6,            // a wall must be this close to attach
  wallOffset: 0.8,             // preferred distance between player centre and wall centre
  maxOffsetError: 1.6,         // detach if the player drifts this far from the wall
  maxTicks: 20 * 30,           // automatic detach after 30 seconds
  climbSpeed: 0.12,            // blocks/tick upward while looking up
  descendSpeed: 0.14,          // blocks/tick downward while looking down
  lookUpPitch: -20,            // pitch below this climbs (Bedrock pitch: negative = up)
  lookDownPitch: 30,           // pitch above this descends
  stickImpulse: 0.2,           // gain of the spring that holds the player to the wall
  pushOff: 0.25,               // outward push on manual detach
  jumpOff: 0.5,                // extra upward push when jumping off a wall
  maxOffsetHold: 0.05,         // ignore tiny offset errors
});

// Gadget definitions. Each gadget has a stable id used in saves and menus.
export const GADGETS = Object.freeze({
  impact_web: Object.freeze({
    id: "impact_web",
    name: "Impact Web",
    description: "Fires a short-range web ball. Deals impact damage and knocks the target back. Ray-cast: walls block it.",
    cooldownTicks: 60,
    range: 14,
    damage: 6,
    knockback: 1.1,
    unlock: null,
  }),
  web_restraint: Object.freeze({
    id: "web_restraint",
    name: "Web Restraint",
    description: "Wraps a target in web. Light foes are held firmly, heavy foes slowed, bosses only lightly slowed.",
    cooldownTicks: 120,
    range: 16,
    light: Object.freeze({ amplifier: 4, durationTicks: 60 }),
    heavy: Object.freeze({ amplifier: 2, durationTicks: 50 }),
    boss: Object.freeze({ amplifier: 0, durationTicks: 40 }),
    unlock: { stat: "swings", min: 10, text: "Make 10 web swings" },
  }),
  tech_pulse: Object.freeze({
    id: "tech_pulse",
    name: "Tech Pulse",
    description: "Short-radius electric pulse. Hits hostile mobs around you, slows them and pushes them away.",
    cooldownTicks: 160,
    radius: 6,
    damage: 2,
    knockback: 0.9,
    slowAmplifier: 1,
    slowDurationTicks: 60,
    unlock: { stat: "wallClimbs", min: 5, text: "Cling to walls 5 times" },
  }),
});

export const GADGET_ORDER = Object.freeze(["impact_web", "web_restraint", "tech_pulse"]);

// Suits only change passive numbers. None of them touch vanilla attributes,
// so there is nothing to undo when a suit is swapped.
export const SUITS = Object.freeze({
  classic: Object.freeze({
    id: "classic",
    name: "Classic Red & Blue",
    description: "The starter suit. No bonuses, fully usable for every core mechanic.",
    cooldownMultiplier: 1,
    swingSpeedMultiplier: 1,
    unlock: null,
  }),
  advanced_tech: Object.freeze({
    id: "advanced_tech",
    name: "Advanced Tech",
    description: "Modern red/white/blue panels. Gadgets recharge 25% faster.",
    cooldownMultiplier: 0.75,
    swingSpeedMultiplier: 1,
    unlock: { stat: "gadgetUses", min: 30, text: "Use gadgets 30 times" },
  }),
  urban_burst: Object.freeze({
    id: "urban_burst",
    name: "Urban Burst",
    description: "Dark base with red accents. Swing speed cap raised by 15%.",
    cooldownMultiplier: 1,
    swingSpeedMultiplier: 1.15,
    unlock: { stat: "swings", min: 20, text: "Make 20 web swings" },
  }),
});

export const SUIT_ORDER = Object.freeze(["classic", "advanced_tech", "urban_burst"]);

export const SPIDER_SENSE = Object.freeze({
  radius: 16,                  // hostile detection radius (proximity only)
  closeRadius: 6,              // "close" priority
  intervalTicks: 10,           // scan cadence
  alertCooldownTicks: 60,      // minimum time between repeated alerts
  damageAlertTicks: 40,        // how long a damage alert stays active
  hostileFamily: "monster",    // vanilla hostile family
  heavyFamilies: Object.freeze(["heavy"]),
  bossFamily: "boss",
});

export const HUD = Object.freeze({
  intervalTicks: 10,
  flashTicks: 50,
});

export const SAVE = Object.freeze({
  debounceTicks: 100,          // dirty profiles are written at most this often
  flushIntervalTicks: 100,
});

export const UNLOCK_STATS = Object.freeze([
  "swings",
  "wallClimbs",
  "gadgetUses",
  "impactHits",
  "restraints",
  "pulses",
]);

export const MAX_STAT = 1_000_000_000;
