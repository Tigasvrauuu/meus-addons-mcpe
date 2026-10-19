import { CONFIG, CHALLENGE_DEFS, SUIT_CONFIG } from "../core/config.js";
import { getState, markDirty, unlockSuit, unlockGadget } from "../core/player_state.js";
import { diag } from "../core/diagnostics.js";

export class ProgressionService {
  constructor(world, suitService, gadgetService){
    this.world = world;
    this.suits = suitService;
    this.gadgets = gadgetService;
    this.tick=0;
  }

  tick(players){
    this.tick++;
    if(this.tick % 40 !== 0) return;
    for(const p of players){
      if(!p.isValid()) continue;
      const st = getState(p);
      this.evaluate(p, st);
    }
  }

  evaluate(player, st){
    for(const [cid, def] of Object.entries(CHALLENGE_DEFS)){
      const prog = st.progression.challenges[cid];
      if(prog && prog.done) continue; // already done
      let done=false;
      if(def.type==="traversal"){
        if(st.progression.swingDistance >= def.goal.swingDistance && st.progression.climbDistance >= def.goal.climbDistance) done=true;
      } else if(def.type==="combat"){
        if(st.progression.kills >= def.goal.kills && st.progression.restrains >= def.goal.restrains) done=true;
      } else if(def.type==="tech"){
        const uses = Object.values(st.progression.gadgetUses).reduce((a,b)=>a+b,0);
        if(uses >= def.goal.gadgetUses && st.progression.pulseUses >= def.goal.pulseUses) done=true;
      } else if(def.type==="stealth"){
        if(st.progression.senseTriggers >= def.goal.senseTriggers) done=true;
      }
      if(done){
        st.progression.challenges[cid] = { done:true, claimed:false, tick:this.tick };
        markDirty(st);
        player.sendMessage(`§6★ Challenge complete: §f${def.name} §7— open Progression menu to claim!`);
        player.playSound("minecraft:entity.player.levelup", {volume:0.8, pitch:1.3});
      }
    }
  }

  claim(player, challengeId){
    const st = getState(player);
    const def = CHALLENGE_DEFS[challengeId];
    if(!def){ player.sendMessage("§cUnknown challenge"); return false; }
    const prog = st.progression.challenges[challengeId];
    if(!prog || !prog.done){ player.sendMessage("§cChallenge not complete yet"); return false; }
    if(prog.claimed){ player.sendMessage("§7Already claimed"); return false; }
    prog.claimed = true;
    markDirty(st);
    // grant rewards
    if(def.reward.suit){
      this.suits.unlock(player, def.reward.suit);
    }
    if(def.reward.tokens){
      st.progression.tokens += def.reward.tokens;
      markDirty(st);
      player.sendMessage(`§a+${def.reward.tokens} Spider-Tokens §7(total ${st.progression.tokens})`);
    }
    // also unlock gadgets associated
    if(challengeId==="tech_1") this.gadgets.unlockForPlayer(player, "tech_pulse");
    if(challengeId==="traversal_1") this.gadgets.unlockForPlayer(player, "web_pull_zip");
    if(challengeId==="combat_1") this.gadgets.unlockForPlayer(player, "threat_scanner");
    player.playSound("minecraft:ui.toast.challenge_complete", {volume:1.0, pitch:1.0});
    player.sendMessage(`§aClaimed: §f${def.name}`);
    return true;
  }

  getForPlayer(player){
    const st = getState(player);
    const out=[];
    for(const [id,def] of Object.entries(CHALLENGE_DEFS)){
      const prog = st.progression.challenges[id] ?? { done:false, claimed:false };
      // progress percent heuristic
      let pct=0;
      if(def.type==="traversal"){
        const a = Math.min(1, st.progression.swingDistance / def.goal.swingDistance);
        const b = Math.min(1, st.progression.climbDistance / def.goal.climbDistance);
        pct = Math.round((a*0.6+b*0.4)*100);
      } else if(def.type==="combat"){
        const a = Math.min(1, st.progression.kills/def.goal.kills);
        const b = Math.min(1, st.progression.restrains/def.goal.restrains);
        pct = Math.round((a+b)/2*100);
      } else if(def.type==="tech"){
        const uses = Object.values(st.progression.gadgetUses).reduce((a,b)=>a+b,0);
        const a = Math.min(1, uses/def.goal.gadgetUses);
        const b = Math.min(1, st.progression.pulseUses/def.goal.pulseUses);
        pct = Math.round((a+b)/2*100);
      } else if(def.type==="stealth"){
        pct = Math.round(Math.min(1, st.progression.senseTriggers/def.goal.senseTriggers)*100);
      }
      out.push({ id, ...def, progress:prog, pct });
    }
    return out;
  }

  grantStarter(player){
    const st = getState(player);
    // starter already unlocked via defaults, but ensure tokens
    if(st.progression.tokens < CONFIG.progression.starterTokenCount){
      const diff = CONFIG.progression.starterTokenCount - st.progression.tokens;
      st.progression.tokens += diff;
      markDirty(st);
    }
    // ensure gadget starter
    for(const g of ["web_shooter","impact_web","web_restraint"]){
      if(!st.gadgetUnlocked.has(g)){
        st.gadgetUnlocked.add(g);
        markDirty(st);
      }
    }
  }
}
