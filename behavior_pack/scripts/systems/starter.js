// Starter kit: granted once per player, tracked by a persisted flag so
// respawns, relogs and deaths cannot duplicate it. Crafting recipes are the
// fallback if items are lost.
import { ItemStack } from "@minecraft/server";
import { getProfile, markDirty, saveNow } from "../core/persistence.js";
import { flash } from "../ui/hud.js";
import { errorOnce } from "../core/diagnostics.js";

export const STARTER_KIT = Object.freeze([
  "spider_man:web_shooter",
  "spider_man:gadget_launcher",
  "spider_man:spider_hub",
]);

export function grantStarterKit(player) {
  const profile = getProfile(player);
  if (profile.starterGiven) return false;
  try {
    const inventory = player.getComponent("minecraft:inventory");
    const container = inventory ? inventory.container : undefined;
    for (const typeId of STARTER_KIT) {
      const stack = new ItemStack(typeId, 1);
      const leftover = container ? container.addItem(stack) : stack;
      if (leftover) player.dimension.spawnItem(leftover, player.location);
    }
  } catch (error) {
    errorOnce("starter-kit", error);
    return false;
  }
  profile.starterGiven = true;
  markDirty(player);
  saveNow(player);
  flash(player, "§a§lSpider-Man kit received. §r§7Open the Spider Hub for the guide.", 120);
  return true;
}
