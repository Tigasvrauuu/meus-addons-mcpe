// SPIDER-MAN DE - Central configuration
// All tunable balance values are centralized here. Safe defaults provided.

export const CONFIG = {
  version: 1,
  web: {
    maxRange: 38,
    minRange: 4,
    ropeSlack: 1.2,
    stiffness: 0.22,
    damping: 0.92,
    gravity: 0.05,
    maxSpeed: 1.8,
    maxHorizontalSpeed: 1.6,
    maxVerticalSpeed: 1.4,
    impulseCap: 1.2,
    reAttachGraceTicks: 10,
    anchorRecheckInterval: 10, // ticks
    failCooldownTicks: 12,
    zipSpeed: 1.9,
    pullStrength: 0.9,
    particleDensity: 1, // 0..2
  },
  climb: {
    detectDistance: 1.1,
    checkInterval: 4,
    upSpeed: 0.28,
    downSpeed: 0.22,
    lateralSpeed: 0.18,
    detachImpulse: 0.6,
    wallStickGrace: 8,
    maxAttachHeight: 320,
  },
  movement: {
    enhancedJump: 0.52,
    airBoost: 0.42,
    airSteer: 0.14,
    fallDamageMitigationHeight: 22, // blocks before mitigation kicks
    landingGraceTicks: 40,
  },
  combat: {
    meleeRange: 3.2,
    meleeDamage: 7,
    comboWindowTicks: 30,
    comboMultiplier: [1, 1.15, 1.35, 1.6],
    comboResetTicks: 60,
    knockbackH: 0.55,
    knockbackV: 0.35,
    airStrikeBonus: 4,
    dodgeImpulse: 0.85,
    dodgeCooldown: 30,
    finisherThreshold: 0.25, // target health ratio
    webbedDurationLight: 80, // ticks
    webbedDurationHeavy: 40,
    bossWebResist: 0.3,
  },
  gadgets: {
    impactCooldown: 40,
    restraintCooldown: 60,
    restraintRange: 18,
    impactDamage: 6,
    pullCooldown: 70,
    pulseCooldown: 120,
    pulseRadius: 12,
    pulseSlowDuration: 100,
    scannerCooldown: 100,
    scannerRadius: 28,
  },
  spiderSense: {
    radius: 22,
    intervalTicks: 12,
    cooldownTicks: 40,
    threatThreshold: 1,
    directional: true,
    maxThreatsTracked: 6,
  },
  progression: {
    tokenId: "spider:spider_token",
    starterTokenCount: 3,
    saveIntervalTicks: 100,
  },
  general: {
    tickBudgetMs: 12,
    maxWebThreadsPerPlayer: 1,
    maxHelperEntities: 32,
    logLevel: "info", // debug|info|warn|error
  }
};

export const SUIT_IDS = ["classic", "stealth", "advanced", "urban", "iron_armor", "homemade"];

export function getSuit(id){
  return SUIT_CONFIG[id];
}

export const SUIT_CONFIG = {
  classic: { id:"classic", name:"Classic Red/Blue", desc:"Balanced starter suit. Web pattern and classic emblem.", icon:"textures/items/suit_changer", unlock:"starter", passive:{ defense:0, speed:0, gadgetEfficiency:1.0 }, rarity:"common"},
  homemade: { id:"homemade", name:"Homemade Starter", desc:"Improvised suit. Light, honest, fully functional.", icon:"textures/items/suit_changer", unlock:"starter", passive:{ defense:0, speed:0, gadgetEfficiency:1.0 }, rarity:"common"},
  stealth: { id:"stealth", name:"Stealth Black", desc:"Dark palette, reduced ambient detection.", icon:"textures/items/suit_changer", unlock:"challenge_stealth", passive:{ defense:0, speed:0.05, gadgetEfficiency:1.05 }, rarity:"rare"},
  advanced: { id:"advanced", name:"Advanced Tech", desc:"Modern paneling, gadget cooldown -12%.", icon:"textures/items/suit_changer", unlock:"challenge_tech", passive:{ defense:1, speed:0, gadgetEfficiency:1.12 }, rarity:"epic"},
  urban: { id:"urban", name:"Urban Pulse", desc:"Dark base with red accents, burst mobility +10%.", icon:"textures/items/suit_changer", unlock:"challenge_traversal", passive:{ defense:0, speed:0.08, gadgetEfficiency:1.0 }, rarity:"rare"},
  iron_armor: { id:"iron_armor", name:"Iron-Armor Inspired", desc:"Segmented armor plating, +2 defense (modest).", icon:"textures/items/suit_changer", unlock:"challenge_combat", passive:{ defense:2, speed:-0.02, gadgetEfficiency:1.0 }, rarity:"epic"},
};

export const GADGET_IDS = ["web_shooter","impact_web","web_restraint","web_pull_zip","tech_pulse","threat_scanner"];

export const GADGET_CONFIG = {
  web_shooter: { id:"web_shooter", name:"Web-Shooter", desc:"Primary traversal tool. Fire to anchor, fire again to release.", item:"spider:web_shooter", cooldown: 0, unlock:"starter"},
  impact_web: { id:"impact_web", name:"Impact Web", desc:"Fires a concussive web burst. Interrupts and damages.", item:"spider:impact_web", cooldown: 40, unlock:"starter"},
  web_restraint: { id:"web_restraint", name:"Web Restraint", desc:"Tethers targets in webbing. Temporary.", item:"spider:web_restraint", cooldown: 60, unlock:"starter"},
  web_pull_zip: { id:"web_pull_zip", name:"Web-Zip / Pull", desc:"Zip to anchor or pull eligible target.", item:"spider:zip_device", cooldown: 70, unlock:"challenge_traversal"},
  tech_pulse: { id:"tech_pulse", name:"Tech Pulse", desc:"Area pulse: slows nearby hostiles.", item:"spider:tech_pulse", cooldown: 120, unlock:"challenge_tech"},
  threat_scanner: { id:"threat_scanner", name:"Threat Scanner", desc:"Active scan highlights nearby threats.", item:"spider:threat_scanner", cooldown: 100, unlock:"challenge_combat"},
};

export const CHALLENGE_DEFS = {
  traversal_1: { id:"traversal_1", name:"Rooftop Flow I", desc:"Swing 300 blocks total distance, climb 20 blocks.", type:"traversal", goal:{ swingDistance:300, climbDistance:20 }, reward:{ suit:"urban", tokens:2 }},
  combat_1: { id:"combat_1", name:"Street Patrol I", desc:"Defeat 10 thugs, restrain 5.", type:"combat", goal:{ kills:10, restrains:5 }, reward:{ suit:"iron_armor", tokens:3 }},
  tech_1: { id:"tech_1", name:"Gadget Field Test", desc:"Use each gadget at least 5 times, pulse 3 times.", type:"tech", goal:{ gadgetUses:5, pulseUses:3 }, reward:{ suit:"advanced", tokens:2 }},
  stealth_1: { id:"stealth_1", name:"Silent Night", desc:"Trigger Spider-Sense 10 times, complete without dying.", type:"stealth", goal:{ senseTriggers:10 }, reward:{ suit:"stealth", tokens:2 }},
};

export function validateConfig(cfg){
  const issues=[];
  if(cfg.web.maxRange < 10 || cfg.web.maxRange > 80) issues.push("web.maxRange out of 10..80");
  if(cfg.web.maxSpeed > 3) issues.push("web.maxSpeed too high");
  if(cfg.combat.meleeDamage > 20) issues.push("meleeDamage too high");
  return issues;
}
