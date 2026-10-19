// Action-bar HUD and short feedback messages.
// A flash message overrides the base HUD line until it expires, so important
// feedback (failed shot, unlock, alert) is not overwritten on the next refresh.
import { system } from "@minecraft/server";
import { getRecord } from "../core/player_state.js";
import { HUD } from "../core/config.js";

export function flash(player, text, ticks = HUD.flashTicks) {
  const rec = getRecord(player);
  rec.hud = { text, until: system.currentTick + ticks };
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch (error) {
    // Player may have disconnected between event and call. Nothing to do.
  }
}

export function activeFlash(rec, now) {
  return rec.hud.text && now < rec.hud.until ? rec.hud.text : null;
}
