// Spider-Man: Definitive Experience - entry point.
// Subscribes to every event ONCE at load time and runs two shared loops:
//   fast loop (every tick): active swings, wall-clings
//   slow loop (every 10 ticks): Spider-Sense, HUD, restraint expiry, saves
import { world, system } from "@minecraft/server";
import { HUD, SAVE, SUITS, GADGETS, PACK } from "./core/config.js";
import { getRecord, allRecords, dropRecord, clearTraversal } from "./core/player_state.js";
import { getProfile, loadProfile, flushDirty, evictProfile, markDirty } from "./core/persistence.js";
import { tickRestraints } from "./core/combat.js";
import { pruneCooldowns } from "./core/cooldowns.js";
import { tickSwing, cancelSwing } from "./systems/web_traversal.js";
import { tickCling, cancelCling } from "./systems/wall_climbing.js";
import { runSense } from "./systems/spider_sense.js";
import { grantStarterKit } from "./systems/starter.js";
import { handleItemUse } from "./systems/interaction.js";
import { activeFlash } from "./ui/hud.js";
import { errorOnce } from "./core/diagnostics.js";

const PLAYER_TYPE = "minecraft:player";
let flushCounter = 0;

function safe(key, fn) {
  try {
    fn();
  } catch (error) {
    errorOnce(key, error);
  }
}

// ---- fast loop: traversal -------------------------------------------------
system.runInterval(() => {
  for (const rec of allRecords()) {
    if (!rec.swing && !rec.cling) continue;
    const player = rec.player;
    if (!player || !player.isValid) {
      clearTraversal(rec);
      continue;
    }
    if (rec.swing) safe("swing-tick", () => tickSwing(player, rec));
    if (rec.cling) safe("cling-tick", () => tickCling(player, rec));
  }
}, 1);

// ---- slow loop: sense, HUD, restraints, saves ----------------------------
system.runInterval(() => {
  const now = system.currentTick;
  safe("restraints", () => tickRestraints(now));
  for (const player of world.getAllPlayers()) {
    safe("slow-player", () => {
      const rec = getRecord(player);
      pruneCooldowns(rec.cooldowns, now);
      loadProfile(player);
      runSense(player, rec, now);
      renderHud(player, rec, now);
    });
  }
  for (const rec of allRecords()) {
    if (!rec.player || !rec.player.isValid) dropRecord(rec.id);
  }
  flushCounter += HUD.intervalTicks;
  if (flushCounter >= SAVE.flushIntervalTicks) {
    flushCounter = 0;
    safe("flush", flushDirty);
  }
}, HUD.intervalTicks);

function renderHud(player, rec, now) {
  const flashText = activeFlash(rec, now);
  if (flashText) {
    player.onScreenDisplay.setActionBar(flashText);
    return;
  }
  const holding = heldSpiderItem(player);
  if (!holding && !rec.swing && !rec.cling) return;
  const profile = getProfile(player);
  const state = rec.swing ? "§bSWINGING" : rec.cling ? "§aCLINGING" : "§7Ready";
  const gadget = GADGETS[profile.gadget];
  player.onScreenDisplay.setActionBar(
    `§l${SUITS[profile.suit].name}§r §8|§r ${gadget.name} §8|§r ${state}`,
  );
}

function heldSpiderItem(player) {
  try {
    const inv = player.getComponent("minecraft:inventory");
    const item = inv && inv.container ? inv.container.getItem(player.selectedSlotIndex) : undefined;
    return item !== undefined && item.typeId.startsWith("spider_man:");
  } catch (error) {
    return false;
  }
}

// ---- events (subscribed once) --------------------------------------------
world.afterEvents.itemUse.subscribe((event) => {
  safe("item-use", () => handleItemUse(event.source, event.itemStack));
});

world.afterEvents.itemStartUseOn.subscribe((event) => {
  safe("item-use-on", () => handleItemUse(event.source, event.itemStack));
});

world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;
  if (!player) return;
  safe("spawn", () => {
    loadProfile(player);
    if (event.initialSpawn) grantStarterKit(player);
  });
});

world.afterEvents.playerLeave.subscribe((event) => {
  dropRecord(event.playerId);
  evictProfile(event.playerId);
});

world.afterEvents.playerDimensionChange.subscribe((event) => {
  const player = event.player;
  if (!player) return;
  safe("dimension", () => {
    const rec = getRecord(player);
    cancelSwing(player, rec, "dimension change");
    cancelCling(player, rec, "dimension change");
  });
});

world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  if (!dead || dead.typeId !== PLAYER_TYPE) return;
  safe("death", () => {
    const rec = getRecord(dead);
    clearTraversal(rec);
    markDirty(dead);
  });
});

world.afterEvents.entityHurt.subscribe((event) => {
  const victim = event.hurtEntity;
  if (!victim || victim.typeId !== PLAYER_TYPE) return;
  safe("hurt", () => {
    getRecord(victim).lastHurtTick = system.currentTick;
  });
});

console.warn(`[SpiderMan] ${PACK.name} v${PACK.version} loaded.`);
