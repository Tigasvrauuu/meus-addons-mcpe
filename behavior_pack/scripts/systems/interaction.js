import { ITEMS, BLOCKS } from "../core/constants.js";
import { diag } from "../core/diagnostics.js";

// Centralizes item/block use handlers so main.js stays clean
export class InteractionService {
  constructor(world, web, climb, gadgets, suits, progression){
    this.world = world;
    this.web = web;
    this.climb = climb;
    this.gadgets = gadgets;
    this.suits = suits;
    this.progression = progression;
  }

  // itemUse event: when player uses item (right click)
  onItemUse(event){
    const { source: player, itemStack } = event;
    if(!player || player.typeId !== "minecraft:player") return;
    const id = itemStack?.typeId;
    if(!id) return;

    // Route by item
    if(id === ITEMS.WEB_SHOOTER){
      // web shooter is primary; try fire
      this.web.tryFire(player);
    } else if(id === ITEMS.IMPACT_WEB){
      this.gadgets.activate(player, "impact_web");
    } else if(id === ITEMS.WEB_RESTRAINT){
      this.gadgets.activate(player, "web_restraint");
    } else if(id === ITEMS.ZIP_DEVICE){
      this.gadgets.activate(player, "web_pull_zip");
    } else if(id === ITEMS.TECH_PULSE){
      this.gadgets.activate(player, "tech_pulse");
    } else if(id === ITEMS.THREAT_SCANNER){
      this.gadgets.activate(player, "threat_scanner");
    } else if(id === ITEMS.SUIT_CHANGER){
      // suit changer opens suit menu via UI service (handled in main)
      // we tag to indicate menu request
      player.addTag("spider_request_suit_menu");
    }
  }

  // itemUseOn? for block interactions

  // Handle sneaking interactions: player sneak+use web shooter = wall climb attach tentative
  onSneakInteract(player){
    // we probe in tick; this is alternative manual
  }

  onBlockInteract(player, block){
    if(!block) return;
    if(block.typeId === BLOCKS.SUIT_STATION){
      player.addTag("spider_request_suit_menu");
      player.sendMessage("§a[Suit Station] §7Opening wardrobe...");
    }
  }
}
