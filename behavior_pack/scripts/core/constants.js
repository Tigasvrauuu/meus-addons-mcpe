// core/constants.js — PURE module (no @minecraft imports; unit-testable in Node).
// Central registry of every namespaced identifier, tag, key and feedback id used
// by the add-on. Keeping them here avoids magic strings scattered across systems.

export const NS = "smx";
export const PACK_TAG = "smx_managed";

/** Dynamic property key holding the serialized per-player save blob. */
export const SAVE_KEY = "smx:data";
/** Current save schema version (bump + migrate in save_schema.js when changing). */
export const SAVE_SCHEMA = 1;

/** Item identifiers (behavior_pack/items/*.json). */
export const ITEMS = Object.freeze({
  WEB_SHOOTER: "smx:web_shooter",
  IMPACT_WEB: "smx:impact_web",
  RESTRAINT_WEB: "smx:restraint_web",
  WEB_PULL: "smx:web_pull",
  TECH_PULSE: "smx:tech_pulse",
  THREAT_SCANNER: "smx:threat_scanner",
  MANUAL: "smx:spider_manual",
  // Suits (armor chestplate items rendered by matching attachables):
  SUIT_IMPROVISED: "smx:suit_improvised",
  SUIT_CLASSIC: "smx:suit_classic",
  SUIT_STEALTH: "smx:suit_stealth",
  SUIT_ADVANCED: "smx:suit_advanced",
  SUIT_URBAN: "smx:suit_urban",
  SUIT_IRON: "smx:suit_iron",
});

/** Block identifiers (behavior_pack/blocks/*.json). */
export const BLOCKS = Object.freeze({
  SUIT_STATION: "smx:suit_station",
});

/** Entity identifiers (behavior_pack/entities/*.json). */
export const ENTITIES = Object.freeze({
  THUG: "smx:thug",
  GUNNER: "smx:gunner",
  BRUTE: "smx:brute",
  SHADOW: "smx:shadow",
  ENFORCER: "smx:enforcer",
  BULLET: "smx:bullet",
});

/** Enemy type ids (everything hostile we spawn/track). */
export const ENEMY_TYPES = Object.freeze([
  ENTITIES.THUG,
  ENTITIES.GUNNER,
  ENTITIES.BRUTE,
  ENTITIES.SHADOW,
  ENTITIES.ENFORCER,
]);

/** Entity tags. */
export const TAGS = Object.freeze({
  WEBBED: "smx_webbed", // target currently restrained by us (we own its slowness)
  STAGGERED: "smx_staggered", // briefly interrupted by impact web
  SPARRING: "smx_sparring", // summoned from the suit station
});

/** Custom particle effect identifiers (resource_pack/particles/*.json). */
export const PARTICLES = Object.freeze({
  WEB_DOT: "smx:web_dot",
  WEB_ANCHOR: "smx:web_anchor",
  HIT_SPARK: "smx:hit_spark",
  SENSE_PING: "smx:sense_ping",
  PULSE_RING: "smx:pulse_ring",
  WEB_SPLAT: "smx:web_splat",
});

/** Fallback (vanilla) particles used when a custom effect cannot spawn. */
export const FALLBACK_PARTICLES = Object.freeze({
  WEB_DOT: "minecraft:endrod",
  WEB_ANCHOR: "minecraft:endrod",
  HIT_SPARK: "minecraft:basic_crit_particle",
  SENSE_PING: "minecraft:villager_angry",
  PULSE_RING: "minecraft:sonic_explosion",
  WEB_SPLAT: "minecraft:snowball_explosion",
});

/**
 * Vanilla sound ids (verified present in Bedrock 26.5x sound_definitions).
 * Using vanilla audio avoids shipping/licensing third-party sound files.
 */
export const SOUNDS = Object.freeze({
  THWIP: { id: "random.bow", volume: 0.8, pitch: 1.5 },
  THWIP_FAIL: { id: "random.click", volume: 0.5, pitch: 1.8 },
  ANCHOR_HIT: { id: "dig.cloth", volume: 0.7, pitch: 1.2 },
  RELEASE: { id: "step.cloth", volume: 0.6, pitch: 0.9 },
  MELEE_HIT: { id: "step.cloth", volume: 0.9, pitch: 0.7 },
  RESTRAINT_HIT: { id: "mob.spider.say", volume: 0.55, pitch: 1.2 },
  SENSE_PING: { id: "note.pling", volume: 0.35, pitch: 2.0 },
  SENSE_STRONG: { id: "note.pling", volume: 0.5, pitch: 1.6 },
  SENSE_HURT: { id: "note.bass", volume: 0.7, pitch: 0.9 },
  PULSE: { id: "fire.ignite", volume: 0.8, pitch: 0.7 },
  ZIP: { id: "random.bow", volume: 0.7, pitch: 1.1 },
  UNLOCK: { id: "random.levelup", volume: 0.8, pitch: 1.0 },
  MENU_CLICK: { id: "random.click", volume: 0.6, pitch: 1.2 },
  SUIT_EQUIP: { id: "armor.equip_leather", volume: 0.8, pitch: 1.0 },
  CLIMB_ATTACH: { id: "step.cloth", volume: 0.45, pitch: 1.1 },
  CLIMB_DETACH: { id: "step.cloth", volume: 0.5, pitch: 0.8 },
  DODGE: { id: "random.bow", volume: 0.5, pitch: 1.8 },
  CHALLENGE_START: { id: "random.orb", volume: 0.7, pitch: 1.2 },
  CHALLENGE_DONE: { id: "random.levelup", volume: 0.9, pitch: 1.1 },
  RESISTED: { id: "random.break", volume: 0.5, pitch: 0.8 },
});

/** Gadget ids (registry keys — also used for cooldown tracking). */
export const GADGETS = Object.freeze({
  WEB_SHOOTER: "web_shooter",
  IMPACT_WEB: "impact_web",
  RESTRAINT_WEB: "restraint_web",
  WEB_PULL: "web_pull",
  TECH_PULSE: "tech_pulse",
  THREAT_SCANNER: "threat_scanner",
});

/** Suit ids (registry keys). */
export const SUITS = Object.freeze({
  IMPROVISED: "improvised",
  CLASSIC: "classic",
  STEALTH: "stealth",
  ADVANCED: "advanced",
  URBAN: "urban",
  IRON: "iron",
});

/** Challenge ids. */
export const CHALLENGES = Object.freeze({
  FIRST_SWING: "first_swing",
  WALL_CRAWLER: "wall_crawler",
  BUG_CATCHER: "bug_catcher",
  STREET_SWEEPER: "street_sweeper",
  GADGETEER: "gadgeteer",
  SPEEDSTER: "speedster",
});

/** Progression event types fed into the pure challenge reducer. */
export const PROGRESS_EVENTS = Object.freeze({
  SWING_TIME: "swing_time", // seconds spent swinging (cumulative)
  CLIMB_UP: "climb_up", // blocks climbed upward (cumulative)
  RESTRAIN: "restrain", // enemies restrained (count)
  ENEMY_DEFEATED: "enemy_defeated", // smx enemies defeated (count)
  GADGET_HIT: "gadget_hit", // successful gadget impacts (count)
  ZIP_DISTANCE: "zip_distance", // blocks travelled by web zip (cumulative)
});

/** Item cooldown categories (script-driven via player.startItemCooldown). */
export const COOLDOWN_CATEGORIES = Object.freeze({
  WEB_SHOOTER: "smx_web_shooter",
  IMPACT_WEB: "smx_impact_web",
  RESTRAINT_WEB: "smx_restraint_web",
  WEB_PULL: "smx_web_pull",
  TECH_PULSE: "smx_tech_pulse",
  THREAT_SCANNER: "smx_threat_scanner",
  DODGE: "smx_dodge",
});

/** Movement/ability state machine values (traversal & climbing ownership). */
export const MOVE_STATE = Object.freeze({
  IDLE: "idle",
  SWINGING: "swinging",
  ZIPPING: "zipping",
  CLIMBING: "climbing",
});
