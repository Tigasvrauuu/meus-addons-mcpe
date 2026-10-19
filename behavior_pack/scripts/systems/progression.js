// Counts player actions and announces newly earned unlocks exactly once.
import { getProfile, markDirty, saveNow } from "../core/persistence.js";
import { applyNewUnlocks } from "../core/unlocks.js";
import { GADGETS, SUITS, MAX_STAT } from "../core/config.js";
import { flash } from "../ui/hud.js";

export function bump(player, stat, amount = 1) {
  const profile = getProfile(player);
  profile.stats[stat] = Math.min(MAX_STAT, (profile.stats[stat] ?? 0) + amount);
  markDirty(player);
  const added = applyNewUnlocks(profile);
  if (added.length === 0) return;
  for (const unlock of added) {
    const name = unlock.kind === "suit" ? SUITS[unlock.id].name : GADGETS[unlock.id].name;
    flash(player, `§6§lUNLOCKED: §r${name}`, 100);
  }
  try {
    player.playSound("random.levelup");
  } catch (error) {
    // Sound is cosmetic.
  }
  saveNow(player);
}
