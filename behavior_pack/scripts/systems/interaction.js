// Routes item-use events to the right system. Vanilla fires itemUse for air
// clicks and itemStartUseOn for clicks on blocks, so both feed one handler.
// Both can fire for the same click, so a short debounce drops duplicates.
import { system } from "@minecraft/server";
import { getRecord } from "../core/player_state.js";
import { tryLaunch } from "./web_traversal.js";
import { tryCling, cancelCling } from "./wall_climbing.js";
import { useGadget } from "./gadgets.js";
import { openHub } from "../ui/menus.js";

const DEBOUNCE_TICKS = 4;

export function handleItemUse(player, item) {
  if (!player || !player.isValid || !item) return;
  const rec = getRecord(player);
  const now = system.currentTick;
  if (now - rec.lastUseTick < DEBOUNCE_TICKS) return;
  rec.lastUseTick = now;

  switch (item.typeId) {
    case "spider_man:web_shooter":
      if (rec.cling) return cancelCling(player, rec, "manual");
      if (player.isSneaking) return tryCling(player, rec);
      return tryLaunch(player, rec);
    case "spider_man:gadget_launcher":
      if (player.isSneaking) return openHub(player);
      return useGadget(player, rec);
    case "spider_man:spider_hub":
      return openHub(player);
    default:
      return undefined;
  }
}
