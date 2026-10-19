import { CONFIG, SUIT_CONFIG, CHALLENGE_DEFS } from "../core/config.js";
import { getState, markDirty, unlockSuit, equipSuit } from "../core/player_state.js";
import { diag } from "../core/diagnostics.js";

export class SuitService {
  constructor(world){
    this.world = world;
  }

  equip(player, suitId){
    const st = getState(player);
    if(!SUIT_CONFIG[suitId]){
      player.sendMessage("§cUnknown suit: "+suitId);
      return false;
    }
    if(!st.suitUnlocked.has(suitId)){
      player.sendMessage("§cSuit locked: §f"+SUIT_CONFIG[suitId].name+" §7— "+this.unlockHint(suitId));
      return false;
    }
    // remove old tag
    for(const id of [...st.suitUnlocked]){
      if(player.hasTag("spider_suit:"+id)) player.removeTag("spider_suit:"+id);
    }
    st.suitEquipped = suitId;
    player.addTag("spider_suit:"+suitId);
    markDirty(st);
    this.applyPassive(player, st);
    player.sendMessage(`§aSuit equipped: §f${SUIT_CONFIG[suitId].name} §7— ${SUIT_CONFIG[suitId].desc}`);
    player.playSound("minecraft:item.armor.equip_chain", {volume:0.9, pitch:1.2});
    player.dimension.spawnParticle("spider:suit_unlock", player.location);
    // update nameTag? keep vanilla nametag
    return true;
  }

  unlock(player, suitId, silent=false){
    const st = getState(player);
    if(!SUIT_CONFIG[suitId]) return false;
    if(st.suitUnlocked.has(suitId)) return false;
    st.suitUnlocked.add(suitId);
    markDirty(st);
    if(!silent){
      player.sendMessage(`§6★ Suit unlocked! §f${SUIT_CONFIG[suitId].name} §7— equip via Suit Station or menu`);
      player.playSound("minecraft:ui.toast.challenge_complete", {volume:1.0, pitch:1.3});
      player.dimension.spawnParticle("minecraft:totem_particle", player.location);
    }
    return true;
  }

  applyPassive(player, st){
    // Re-apply armor-like effects based on suit passive.
    // We clear previous resistance/speed owned, then apply new.
    try{
      // remove old
      player.removeEffect("resistance");
      player.removeEffect("speed");
      player.removeEffect("jump_boost");
      // suit passive defense -> resistance
      const passive = SUIT_CONFIG[st.suitEquipped]?.passive;
      if(!passive) return;
      if(passive.defense >= 2){
        player.addEffect("resistance", 2000000, {amplifier:0, showParticles:false});
      } else if(passive.defense === 1){
        // lighter resistance temporary refreshed
        player.addEffect("resistance", 2000000, {amplifier:0, showParticles:false});
      }
      if(passive.speed > 0){
        const amp = passive.speed >= 0.08 ? 1 : 0;
        player.addEffect("speed", 2000000, {amplifier:amp, showParticles:false});
      }
      // advanced tech gadget efficiency is handled via cooldown scaling elsewhere (we notify)
    }catch(e){ diag.debug("applyPassive fail "+e); }
  }

  unlockHint(suitId){
    const suit = SUIT_CONFIG[suitId];
    if(!suit) return "unknown";
    if(suit.unlock === "starter") return "starter — already unlocked";
    // map challenge id to suit
    for(const ch of Object.values(CHALLENGE_DEFS)){
      if(ch.reward.suit === suitId) return `complete ${ch.name}`;
    }
    return suit.unlock;
  }

  listForPlayer(player){
    const st = getState(player);
    const arr=[];
    for(const [id,cfg] of Object.entries(SUIT_CONFIG)){
      arr.push({
        id,
        name: cfg.name,
        desc: cfg.desc,
        unlocked: st.suitUnlocked.has(id),
        equipped: st.suitEquipped === id,
        rarity: cfg.rarity,
        hint: this.unlockHint(id)
      });
    }
    return arr;
  }

  onPlayerSpawn(player){
    const st = getState(player);
    // ensure tag sync
    for(const id of st.suitUnlocked){
      // keep tag for equipped only
    }
    player.addTag("spider_suit:"+st.suitEquipped);
    this.applyPassive(player, st);
  }

  cycleNext(player){
    const st = getState(player);
    const order = [...st.suitUnlocked];
    if(order.length===0) return false;
    const idx = order.indexOf(st.suitEquipped);
    const next = order[(idx+1)%order.length];
    return this.equip(player, next);
  }
}
