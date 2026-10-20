// core/lifecycle.js — LifecycleService + central scheduler (spec §4.2, §20).
// Subscribes to every event EXACTLY ONCE at init, runs ONE shared 1-tick
// scheduler for all systems (no per-activation intervals — spec §22), and owns
// the cleanup matrix: death, respawn, disconnect, dimension change, unload.

import * as mc from "@minecraft/server";
import { system, world } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { BLOCKS, ITEMS, ENTITIES, TAGS, MOVE_STATE } from "./constants.js";
import { info, errorThrottled, initLogger, setDebug, guarded } from "./logger.js";
import { getState, getAllStates, createState, hasState, deleteState, resetTransientState, markDirty, pruneStateCooldowns, settingsOf } from "./state.js";
import { loadPlayerSave, persistPlayerSave, flushDueSaves } from "./save.js";
import { initInput } from "./input.js";
import { isEntityValid } from "./utils.js";
import * as traversal from "../systems/traversal.js";
import * as climbing from "../systems/climbing.js";
import * as combat from "../systems/combat.js";
import * as sense from "../systems/sense.js";
import * as gadgets from "../systems/gadgets.js";
import * as suits from "../systems/suits.js";
import * as challenges from "../systems/challenges.js";
import * as menus from "../ui/menus.js";
import { actionBar } from "../ui/hud.js";

let initialized = false;
let tickCounter = 0;

/** Idempotent init — safe against double module evaluation. */
export function init() {
  if (initialized) {
    info("init() called twice — ignoring (subscriptions must not duplicate)");
    return;
  }
  initialized = true;

  initLogger(() => system.currentTick);
  initInput(mc);
  combat.bindWorld(world);
  challenges.bindRuntime({ world, system });
  challenges.initChallenges();
  menus.setSparringSummoner(summonSparring);

  subscribeEvents();

  // Players already online when scripts (re)load — e.g. after /reload.
  system.run(() => {
    guarded("lifecycle.bootstrap", () => {
      for (const player of world.getPlayers()) ensureState(player, false);
      info(`Spider-Man: Definitive Experience initialized (${world.getPlayers().length} player(s) online)`);
    });
  });

  // The single shared scheduler (1 tick).
  system.runInterval(() => {
    guarded("scheduler", mainTick);
  }, 1);
}

// ---------------------------------------------------------------------------
// events (subscribed once)
// ---------------------------------------------------------------------------

function subscribeEvents() {
  world.afterEvents.playerSpawn.subscribe((event) => {
    guarded("event.playerSpawn", () => onPlayerSpawn(event));
  });

  world.afterEvents.playerLeave.subscribe((event) => {
    guarded("event.playerLeave", () => onPlayerLeave(event));
  });

  world.afterEvents.itemUse.subscribe((event) => {
    guarded("event.itemUse", () => onItemUse(event));
  });

  world.afterEvents.entityHitEntity.subscribe((event) => {
    guarded("event.entityHitEntity", () => onEntityHitEntity(event));
  });

  world.afterEvents.entityHurt.subscribe((event) => {
    guarded("event.entityHurt", () => onEntityHurt(event));
  });

  world.afterEvents.entityDie.subscribe((event) => {
    guarded("event.entityDie", () => onEntityDie(event));
  });

  // Station interaction — feature-detected: if a future runtime renames this
  // signal, the station simply stops opening menus; nothing else breaks.
  if (typeof world.afterEvents.playerInteractWithBlock?.subscribe === "function") {
    world.afterEvents.playerInteractWithBlock.subscribe((event) => {
      guarded("event.playerInteractWithBlock", () => onInteractWithBlock(event));
    });
  } else {
    info("playerInteractWithBlock unavailable — Suit Station interaction disabled");
  }
}

function onPlayerSpawn(event) {
  const { player, initialSpawn } = event;
  const state = ensureState(player, initialSpawn);
  if (!state) return;
  const now = system.currentTick;

  if (initialSpawn && !state.save.seenIntro) {
    // First time in this world with the pack: starter kit + welcome (spec §5).
    state.save.seenIntro = true;
    markDirty(state);
    suits.grantStarterKit(player, state, now, { full: true });
    try {
      player.sendMessage(
        "§c🕷 §fSpider-Man: Definitive Experience§7 loaded!\n" +
          "§7You received the §fstarter kit§7. Read the §fSpider Manual§7 item (USE it) for controls.\n" +
          "§8Quick start: equip the Classic Suit, hold the Web-Shooter, aim at a surface above you and USE."
      );
    } catch {
      /* ignore */
    }
  }

  if (!initialSpawn) {
    // Respawn: clear every transient ability state (spec §20).
    state.deadUntilRespawn = false;
    resetTransientState(state, now);
  }
}

function onPlayerLeave(event) {
  const playerId = event.playerId;
  const state = getState(playerId);
  if (!state) return;
  const now = system.currentTick;
  // Persist immediately, then drop all runtime state and owned restraints.
  const player = findPlayer(playerId);
  if (player) persistPlayerSave(player, state);
  combat.dropRestraintsOf(playerId, now);
  deleteState(playerId);
}

function onItemUse(event) {
  const player = event.source;
  const itemStack = event.itemStack;
  if (!player || !itemStack) return;
  const state = ensureState(player, false);
  if (!state) return;
  const now = system.currentTick;
  const itemId = itemStack.typeId;

  if (itemId === ITEMS.MANUAL) {
    menus.openMainMenu(player, state, now);
    return;
  }
  if (gadgets.isGadgetItem(itemId)) {
    gadgets.activateGadget(player, state, now, itemId);
  }
}

function onInteractWithBlock(event) {
  const player = event.player;
  const block = event.block;
  if (!player || !block) return;
  let typeId = null;
  try {
    typeId = block.typeId;
  } catch {
    return;
  }
  if (typeId !== BLOCKS.SUIT_STATION) return;
  const state = ensureState(player, false);
  if (!state) return;
  menus.openStationMenu(player, state, system.currentTick);
}

function onEntityHitEntity(event) {
  const { damagingEntity, hitEntity } = event;
  if (!damagingEntity || damagingEntity.typeId !== "minecraft:player") return;
  const state = getState(damagingEntity.id);
  if (!state) return;
  combat.onPlayerMeleeHit(damagingEntity, state, hitEntity, system.currentTick);
}

function onEntityHurt(event) {
  const hurt = event.hurtEntity;
  if (!hurt || hurt.typeId !== "minecraft:player") return;
  const state = getState(hurt.id);
  if (!state || state.deadUntilRespawn) return;
  const now = system.currentTick;
  sense.onPlayerHurt(hurt, state, now);
  suits.onPlayerHurtSuitProc(hurt, state, now);
}

function onEntityDie(event) {
  const dead = event.deadEntity;
  if (!dead) return;
  const now = system.currentTick;

  if (dead.typeId === "minecraft:player") {
    const state = getState(dead.id);
    if (state) {
      state.deadUntilRespawn = true;
      traversal.cancelTraversal(state, now);
      climbing.cancelClimb(state, now);
      combat.dropRestraintsOf(state.playerId, now);
      // Persist progression so death never costs challenge progress.
      const player = findPlayer(dead.id);
      if (player) persistPlayerSave(player, state);
    }
    return;
  }

  // Enemy kill credit for challenges (attributable to a player only).
  const killer = event.damageSource?.damagingEntity;
  const killerId = killer && killer.typeId === "minecraft:player" ? killer.id : null;
  combat.onEntityDied(dead, killerId, now);
}

// ---------------------------------------------------------------------------
// the single scheduler
// ---------------------------------------------------------------------------

function mainTick() {
  const now = system.currentTick;
  tickCounter += 1;

  // Global restraint manager (bounded list, runs once per tick).
  combat.tickRestraints(world, now);

  const players = world.getPlayers();
  const playersById = new Map(players.map((p) => [p.id, p]));

  for (const player of players) {
    const state = getState(player.id);
    if (!state) continue;

    // Dimension change → reset traversal/climb (spec §6.7, §7.4).
    const dimId = safeDimId(player);
    if (state.lastDimensionId !== null && dimId !== state.lastDimensionId) {
      resetTransientState(state, now);
      try {
        player.sendMessage("§7🌀 Dimension change — web systems reset.");
      } catch {
        /* ignore */
      }
    }
    state.lastDimensionId = dimId;

    // Equipment poll → suit state (every 4 ticks).
    if (tickCounter % 4 === 0) {
      guarded("tick.equipment", () => suits.pollEquipment(player, state, now));
    }

    // Movement systems (ownership is exclusive by move-state).
    if (state.move === MOVE_STATE.SWINGING || state.move === MOVE_STATE.ZIPPING) {
      guarded("tick.traversal", () => traversal.tickTraversal(player, state, now));
    } else {
      guarded("tick.climbing", () => climbing.tickClimbing(player, state, now));
    }

    // Combat windows (combo expiry, dodge input).
    guarded("tick.combat", () => combat.tickCombat(player, state, now));

    // Spider-Sense on its own interval (never every tick — spec §8.4).
    if (tickCounter % CONFIG.sense.scanIntervalTicks === 0) {
      guarded("tick.sense", () => sense.scan(player, state, now));
    }

    // Periodic cooldown pruning (bounded memory).
    if (tickCounter % 200 === 0) pruneStateCooldowns(state, now);

    // Debug setting changes take effect live.
    if (tickCounter % 100 === 0) setDebug(settingsOf(state).debug);
  }

  // HUD refresh on its cadence.
  if (tickCounter % CONFIG.performance.hudIntervalTicks === 0) {
    for (const player of players) {
      const state = getState(player.id);
      if (!state) continue;
      guarded("tick.hud", () => flushHud(player, state, now));
    }
  }

  // Throttled persistence.
  if (tickCounter % CONFIG.progression.saveFlushTicks === 0) {
    guarded("tick.save", () => flushDueSaves(playersById, Array.from(getAllStates()), now, CONFIG.progression.saveFlushTicks));
  }
}

/** Action-bar flush: show ours while relevant; clear once when done. */
function flushHud(player, state, now) {
  if (state.menuOpen) return; // never fight a form with HUD updates
  if (state.hud.untilTick > now && state.hud.line) {
    actionBar(player, state.hud.line);
    state._hudShown = true;
    return;
  }
  if (state._hudShown) {
    actionBar(player, " ");
    state._hudShown = false;
    state.hud.priority = 0;
    state.hud.line = "";
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function ensureState(player, isInitialSpawn) {
  try {
    if (!player?.id) return null;
    if (hasState(player.id)) return getState(player.id);
    const { data } = loadPlayerSave(player);
    const state = createState(player.id, safeName(player), data);
    state.lastDimensionId = safeDimId(player);
    return state;
  } catch (err) {
    errorThrottled("lifecycle.ensureState", err);
    return null;
  }
}

function findPlayer(playerId) {
  try {
    return world.getPlayers().find((p) => p.id === playerId) ?? null;
  } catch {
    return null;
  }
}

function safeDimId(player) {
  try {
    return player.dimension?.id ?? null;
  } catch {
    return null;
  }
}

function safeName(player) {
  try {
    return player.name ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Suit-station sparring: summons a bounded number of persistent thugs around
 * the player (spec §12.4 — intentional, controlled spawns; they count toward
 * the Street Sweeper challenge and never spawn on their own from this path).
 */
function summonSparring(player, state, now) {
  const cfg = CONFIG.progression;
  let spawned = 0;
  for (let i = 0; i < cfg.sparringCount; i++) {
    const angle = (Math.PI * 2 * i) / Math.max(1, cfg.sparringCount) + Math.random() * 0.6;
    const r = cfg.sparringRadius;
    const loc = {
      x: player.location.x + Math.cos(angle) * r,
      y: player.location.y + 1,
      z: player.location.z + Math.sin(angle) * r,
    };
    try {
      const thug = player.dimension.spawnEntity(ENTITIES.THUG, loc, { initialPersistence: true });
      thug.addTag(TAGS.SPARRING);
      spawned += 1;
    } catch (err) {
      errorThrottled("lifecycle.summonSparring", err);
    }
  }
  return spawned;
}
