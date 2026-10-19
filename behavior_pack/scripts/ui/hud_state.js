import { getState } from "../core/player_state.js";
import { SUIT_CONFIG, GADGET_CONFIG } from "../core/config.js";

export class HUDService {
  constructor(world){
    this.world = world;
    this.tick=0;
  }
  tick(players){
    this.tick++;
    if(this.tick % 40 !== 0) return; // every 2 seconds only
    for(const p of players){
      try{
        if(!p.isValid()) continue;
        const st = getState(p);
        if(!st.settings.hudEnabled) continue;
        // only show when not in active traversal to avoid spam (traversal has its own actionbar)
        if(st.state === "swinging" || st.state === "climbing") continue;
        if(st.state === "dead_or_unavailable") continue;
        // occasional subtle HUD reminder
        if(this.tick % 120 === 0){
          // we don't spam actionbar every 2 sec; we send only when idle and every 6 sec maybe
          if(Math.random() < 0.15){
            const suit = SUIT_CONFIG[st.suitEquipped]?.name ?? st.suitEquipped;
            const gadget = GADGET_CONFIG[st.gadgetSelected]?.name ?? st.gadgetSelected;
            p.onScreenDisplay?.setActionBar?.(`§c⬢ §f${suit} §7| §b${gadget} §7| §a${st.progression.tokens} tokens`);
          }
        }
      }catch{}
    }
  }
}
