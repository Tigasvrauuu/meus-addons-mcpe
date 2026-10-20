// systems/suits.js — SuitService (spec §11).
// Suits are chestplate items rendered by matching attachables (vanilla armor
// pipeline — no player-entity hacking). The equipped suit is DERIVED from the
// equipment component every few ticks (single source of truth: what you wear),
// while unlocks (earned/purchased) are persisted in the save blob.
// Passives are numeric modifiers consumed by the owning systems; the Iron suit
// plating proc is implemented here on the hurt path.

import { ItemStack } from "@minecraft/server";
import { CONFIG } from "../core/config.js";
import { SUITS, ITEMS } from "../core/constants.js";
import { isEntityValid } from "../core/utils.js";
import { passivesOf, markDirty, pushHudMessage } from "../core/state.js";
import { sfx, toast } from "../ui/hud.js";
import { errorThrottled } from "../core/logger.js";

// EquipmentSlot.Chest === "Chest" in @minecraft/server 2.x (string enum).
// Referenced as a literal so this module keeps exactly one API import.
const EQUIP_SLOT_CHEST = "Chest";

/** Suit registry: id ↔ item ↔ copy ↔ how to obtain (spec §11.2). */
export const SUIT_DEFS = Object.freeze([
  {
    id: SUITS.IMPROVISED,
    itemId: ITEMS.SUIT_IMPROVISED,
    name: "Improvised Suit",
    description: "Homemade gray-and-red starter gear. No bonuses, full functionality — everything works.",
    obtain: "Craft: leather chestplate + 4 string + red dye",
    starting: true,
  },
  {
    id: SUITS.CLASSIC,
    itemId: ITEMS.SUIT_CLASSIC,
    name: "Classic Suit",
    description: "Red/blue with black webbing. Balanced: slightly stronger swings, +0.5 melee.",
    obtain: "Starter kit (auto-granted) or craft: leather chestplate + red & blue dye",
    starting: true,
  },
  {
    id: SUITS.STEALTH,
    itemId: ITEMS.SUIT_STEALTH,
    name: "Stealth Suit",
    description: "Black with a white spider. Heightened senses: +25% Spider-Sense radius, faster gadget recharge (-10%), quicker climb.",
    obtain: "Reward: Wall Crawler challenge · or buy at Suit Station (8 iron)",
  },
  {
    id: SUITS.ADVANCED,
    itemId: ITEMS.SUIT_ADVANCED,
    name: "Advanced Tech Suit",
    description: "White/red tech panels. Gadget specialist: -25% gadget cooldowns, slightly faster zip.",
    obtain: "Reward: Gadgeteer challenge · or buy at Suit Station (8 iron + 2 diamond)",
  },
  {
    id: SUITS.URBAN,
    itemId: ITEMS.SUIT_URBAN,
    name: "Urban Suit",
    description: "Dark base, red accents. Mobility: +25% climb speed, -30% dodge cooldown, +10% zip speed.",
    obtain: "Reward: Speedster challenge · or buy at Suit Station (8 iron + 4 gold)",
  },
  {
    id: SUITS.IRON,
    itemId: ITEMS.SUIT_IRON,
    name: "Iron-Armor Suit",
    description: "Segmented plating. Defensive: briefly gains Resistance after taking a hit (8s internal cooldown), +0.5 melee. Slightly slower climbing.",
    obtain: "Reward: Street Sweeper challenge · or buy at Suit Station (12 iron + 2 gold)",
  },
]);

const BY_ID = Object.fromEntries(SUIT_DEFS.map((s) => [s.id, s]));
const BY_ITEM = Object.fromEntries(SUIT_DEFS.map((s) => [s.itemId, s.id]));

export function suitById(id) {
  return BY_ID[id] ?? null;
}

export function suitIdForItem(itemId) {
  return BY_ITEM[itemId] ?? null;
}

export function isSuitUnlocked(state, suitId) {
  return Array.isArray(state?.save?.unlockedSuits) && state.save.unlockedSuits.includes(suitId);
}

export function unlockSuit(state, suitId) {
  if (!BY_ID[suitId]) return false;
  if (isSuitUnlocked(state, suitId)) return false;
  state.save.unlockedSuits = [...state.save.unlockedSuits, suitId];
  markDirty(state);
  return true;
}

/**
 * Equipment poll (every few ticks): the chest slot decides the equipped suit.
 * Handles equip/unequip transitions, feedback and owned-state cleanup
 * (spec §11.3). We never touch unrelated player attributes.
 */
export function pollEquipment(player, state, now) {
  if (!isEntityValid(player)) return;
  let chestItemId = null;
  try {
    const equippable = player.getComponent("equippable");
    const chest = equippable?.getEquipment?.(EQUIP_SLOT_CHEST);
    chestItemId = chest?.typeId ?? null;
  } catch (err) {
    // Component missing/unreadable → treat as unequipped, don't spam.
    errorThrottled("suits.pollEquipment", err);
    chestItemId = null;
  }

  const suitId = chestItemId ? suitIdForItem(chestItemId) : null;
  if (suitId === state.suit.id) return; // no change

  const prev = state.suit.id;
  state.suit.id = suitId;
  state.suit.itemId = suitId ? BY_ID[suitId].itemId : null;
  state.suit.sinceTick = now;

  if (suitId) {
    const def = BY_ID[suitId];
    sfx(player, "SUIT_EQUIP");
    toast(player, state, now, `§f🕷 ${def.name} equipped`, 40, 3);
  } else if (prev) {
    toast(player, state, now, "§7Suit unequipped §8— abilities offline", 40, 3);
  }
}

/**
 * Iron-suit plating proc (called from the hurt lifecycle hook).
 * Applies Resistance briefly, on an internal cooldown. Owned effect only.
 */
export function onPlayerHurtSuitProc(player, state, now) {
  const passives = passivesOf(state);
  if (!passives.plating || state.deadUntilRespawn) return;
  if (!isEntityValid(player)) return;
  if (now < state.combat.platingReadyTick) return;
  const cfg = CONFIG.suits.ironPlating;
  state.combat.platingReadyTick = now + cfg.internalCooldownTicks;
  try {
    player.addEffect("resistance", cfg.resistanceTicks, { amplifier: cfg.resistanceAmplifier, showParticles: false });
    pushHudMessage(state, "§6🛡 Plating absorbed the blow", now, 30, 3);
    sfx(player, "MELEE_HIT", { volume: 0.35, pitch: 0.5 });
  } catch (err) {
    errorThrottled("suits.plating", err);
  }
}

/**
 * Purchases a locked suit at the station: validates unlock path, consumes the
 * exact materials from the player's inventory, grants the item (spec §11.4:
 * accessible, honest requirements, granted once).
 */
export function purchaseSuit(player, state, suitId, now) {
  const def = suitById(suitId);
  if (!def) return { ok: false, message: "Unknown suit." };
  if (isSuitUnlocked(state, suitId)) {
    return grantSuitItem(player, state, suitId, now, "already unlocked");
  }
  const costs = CONFIG.suits.purchaseCosts[suitId];
  if (!costs) return { ok: false, message: "This suit is not sold here — earn it via a challenge." };

  // 1) Verify all materials present.
  const container = getContainer(player);
  if (!container) return { ok: false, message: "Inventory unavailable." };
  const counts = countItems(container, Object.keys(costs));
  for (const [itemId, need] of Object.entries(costs)) {
    if ((counts[itemId] ?? 0) < need) {
      return { ok: false, message: `Missing materials: ${need}x ${shortName(itemId)} (you have ${counts[itemId] ?? 0}).` };
    }
  }
  // 2) Consume.
  for (const [itemId, need] of Object.entries(costs)) {
    if (!consumeItems(container, itemId, need)) {
      return { ok: false, message: "Could not consume materials (inventory changed?)." };
    }
  }
  // 3) Grant unlock + item.
  unlockSuit(state, suitId);
  return grantSuitItem(player, state, suitId, now, "purchased");
}

export function grantSuitItem(player, state, suitId, now, reason) {
  const def = suitById(suitId);
  if (!def) return { ok: false, message: "Unknown suit." };
  const container = getContainer(player);
  if (!container) return { ok: false, message: "Inventory unavailable." };
  try {
    const stack = new ItemStack(def.itemId, 1);
    const leftover = container.addItem(stack);
    if (leftover) {
      // Inventory full: drop at feet instead of silently destroying the reward.
      try {
        player.dimension.spawnItem(leftover, player.location);
      } catch {
        return { ok: false, message: "Inventory full — free a slot and try again." };
      }
    }
    unlockSuit(state, suitId);
    sfx(player, "UNLOCK");
    toast(player, state, now, `§6★ ${def.name} obtained! §7Equip it from your inventory.`, 60, 4);
    return { ok: true, message: `${def.name} granted (${reason}).` };
  } catch (err) {
    errorThrottled("suits.grant", err);
    return { ok: false, message: "Grant failed (see log)." };
  }
}

/** Starter kit: guarantees the minimum playable loadout (spec §5.2). */
export function grantStarterKit(player, state, now, opts = {}) {
  const container = getContainer(player);
  if (!container) return false;
  const grants = [ITEMS.WEB_SHOOTER, ITEMS.SUIT_CLASSIC, ITEMS.MANUAL];
  if (opts.full) grants.push(ITEMS.IMPACT_WEB);
  const owned = new Set(countItemIds(container));
  let granted = 0;
  for (const itemId of grants) {
    if (owned.has(itemId)) continue;
    try {
      const stack = new ItemStack(itemId, 1);
      const leftover = container.addItem(stack);
      if (leftover) {
        try { player.dimension.spawnItem(leftover, player.location); } catch { /* ignore */ }
      }
      granted += 1;
    } catch (err) {
      errorThrottled("suits.starterKit", err);
    }
  }
  if (granted > 0) {
    sfx(player, "UNLOCK");
    toast(player, state, now, `§f🕷 Starter kit §7received (${granted} items) §8— read the Spider Manual!`, 80, 4);
  }
  return granted > 0;
}

// ---------------------------------------------------------------------------
// inventory helpers
// ---------------------------------------------------------------------------

function getContainer(player) {
  try {
    return player.getComponent("inventory")?.container ?? null;
  } catch {
    return null;
  }
}

function countItems(container, itemIds) {
  const wanted = new Set(itemIds);
  const counts = {};
  try {
    for (let i = 0; i < container.size; i++) {
      const it = container.getItem(i);
      if (it && wanted.has(it.typeId)) counts[it.typeId] = (counts[it.typeId] ?? 0) + (it.amount ?? 1);
    }
  } catch {
    /* container iteration can fail on closed inventories */
  }
  return counts;
}

function countItemIds(container) {
  const ids = [];
  try {
    for (let i = 0; i < container.size; i++) {
      const it = container.getItem(i);
      if (it) ids.push(it.typeId);
    }
  } catch {
    /* ignore */
  }
  return ids;
}

function consumeItems(container, itemId, amount) {
  try {
    let left = amount;
    for (let i = 0; i < container.size && left > 0; i++) {
      const it = container.getItem(i);
      if (!it || it.typeId !== itemId) continue;
      const take = Math.min(left, it.amount);
      if (take >= it.amount) {
        container.setItem(i, undefined);
      } else {
        it.amount -= take;
        container.setItem(i, it);
      }
      left -= take;
    }
    return left <= 0;
  } catch (err) {
    errorThrottled("suits.consume", err);
    return false;
  }
}

export function shortName(itemId) {
  return String(itemId).split(":").pop().replace(/_/g, " ");
}
