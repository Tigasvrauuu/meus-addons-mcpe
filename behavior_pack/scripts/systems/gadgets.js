import { CONFIG, GADGET_CONFIG } from "../core/config.js";
import { getState, markDirty } from "../core/player_state.js";
import { GlobalCooldowns } from "../core/cooldowns.js";
import { diag } from "../core/diagnostics.js";
import { safeImpulseExport as safeImpulse } from "./movement.js";

export class GadgetService {
  constructor(world, spiderSense, combat, webTraversal){
    this.world = world;
    this.spiderSense = spiderSense;
    this.combat = combat;
    this.web = webTraversal;
    this.tick = 0;
  }

  tick(players){
    this.tick++;
  }

  selectGadget(player, gadgetId){
    const st = getState(player);
    if(!GADGET_CONFIG[gadgetId]) {
      player.sendMessage("§cUnknown gadget: "+gadgetId);
      return false;
    }
    if(!st.gadgetUnlocked.has(gadgetId)){
      player.sendMessage("§cGadget locked: "+GADGET_CONFIG[gadgetId].name+" — complete challenges to unlock.");
      return false;
    }
    st.gadgetSelected = gadgetId;
    markDirty(st);
    player.onScreenDisplay?.setActionBar?.(`§aGadget selected: §f${GADGET_CONFIG[gadgetId].name}`);
    player.playSound("minecraft:ui.button.click", {volume:0.7, pitch:1.5});
    return true;
  }

  getSelected(player){
    const st = getState(player);
    return st.gadgetSelected;
  }

  // Universal activate: uses player selected gadget
  activateSelected(player){
    const st = getState(player);
    const id = st.gadgetSelected;
    return this.activate(player, id);
  }

  activate(player, gadgetId){
    if(!GADGET_CONFIG[gadgetId]) return { success:false, reason:"unknown" };
    const st = getState(player);
    if(!st.gadgetUnlocked.has(gadgetId)) return { success:false, reason:"locked" };

    switch(gadgetId){
      case "web_shooter": return this.activateWebShooter(player);
      case "impact_web": return this.activateImpactWeb(player);
      case "web_restraint": return this.activateRestraint(player);
      case "web_pull_zip": return this.activatePullZip(player);
      case "tech_pulse": return this.activatePulse(player);
      case "threat_scanner": return this.activateScanner(player);
      default: return { success:false, reason:"not_implemented" };
    }
  }

  activateWebShooter(player){
    // delegate to web traversal tryFire (which handles release logic)
    const result = this.web.tryFire(player);
    if(result.success){
      const st = getState(player);
      st.progression.gadgetUses["web_shooter"] = (st.progression.gadgetUses["web_shooter"]||0)+1;
      markDirty(st);
    }
    return result;
  }

  activateImpactWeb(player){
    const target = this.findTarget(player, CONFIG.gadgets.restraintRange);
    if(!target){
      player.onScreenDisplay?.setActionBar?.("§cNo target for Impact Web");
      player.playSound("minecraft:ui.button.click", {volume:0.4, pitch:0.7});
      return { success:false, reason:"no_target" };
    }
    return this.combat.tryImpactWeb(player, target);
  }

  activateRestraint(player){
    const target = this.findTarget(player, CONFIG.gadgets.restraintRange);
    if(!target){
      player.onScreenDisplay?.setActionBar?.("§cNo target for Web Restraint");
      return { success:false, reason:"no_target" };
    }
    return this.combat.tryWebRestraint(player, target);
  }

  activatePullZip(player){
    const st = getState(player);
    if(!GlobalCooldowns.isReady(player.id, "pullzip", this.tick)) {
      const rem = GlobalCooldowns.remaining(player.id,"pullzip", this.tick);
      player.onScreenDisplay?.setActionBar?.(`§7Pull/Zip cooldown §f${rem/20}s`);
      return { success:false, reason:"cooldown" };
    }
    // If swinging, zip toward anchor
    if(st.anchor && st.state === "swinging"){
      const ok = this.web.tryZip(player);
      if(ok){
        GlobalCooldowns.set(player.id, "pullzip", CONFIG.gadgets.pullCooldown, this.tick);
        st.progression.gadgetUses["web_pull_zip"] = (st.progression.gadgetUses["web_pull_zip"]||0)+1;
        markDirty(st);
        return { success:true, mode:"zip" };
      }
    }
    // else try pull entity or zip to block
    const target = this.findTarget(player, 22);
    if(target){
      // pull target toward player (small impulse opposite)
      try{
        const pPos = player.location;
        const tPos = target.location;
        const dir = { x: pPos.x - tPos.x, y: (pPos.y - tPos.y)*0.5, z: pPos.z - tPos.z };
        const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
        const imp = { x: dir.x/len * CONFIG.web.pullStrength, y: dir.y/len*0.4 + 0.15, z: dir.z/len*CONFIG.web.pullStrength };
        if(typeof target.applyImpulse === "function") target.applyImpulse(imp);
        else target.applyKnockback(-imp.x, -imp.z, 0.8, 0.25);
        target.addEffect("slowness", 30, {amplifier:2, showParticles:true});
        target.dimension.spawnParticle("spider:web_thread", tPos);
        GlobalCooldowns.set(player.id, "pullzip", CONFIG.gadgets.pullCooldown, this.tick);
        st.progression.gadgetUses["web_pull_zip"] = (st.progression.gadgetUses["web_pull_zip"]||0)+1;
        markDirty(st);
        player.playSound("minecraft:entity.fishing_bobber.retrieve", {volume:0.9, pitch:1.4});
        player.onScreenDisplay?.setActionBar?.("§aPulled target");
        return { success:true, mode:"pull" };
      }catch(e){ return { success:false, reason:String(e)}; }
    } else {
      // zip to block if not swinging: do web zip to anchor directly (instant move)
      const anchor = this.web.findAnchor(player);
      if(anchor){
        try{
          const dest = {x: anchor.x+0.5, y: anchor.y+1.2, z: anchor.z+0.5};
          const dir = { x: dest.x - player.location.x, y: dest.y - player.location.y, z: dest.z - player.location.z };
          const len = Math.hypot(dir.x, dir.y, dir.z);
          if(len <= CONFIG.web.maxRange){
            const norm = {x: dir.x/len, y: dir.y/len, z: dir.z/len};
            const imp = {x: norm.x * CONFIG.web.zipSpeed, y: norm.y*0.55 + 0.25, z: norm.z*CONFIG.web.zipSpeed};
            safeImpulse(player, imp);
            player.dimension.spawnParticle("spider:web_thread", player.location);
            player.dimension.spawnParticle("spider:web_anchor", dest);
            player.playSound("minecraft:entity.ender_dragon.flap", {volume:0.7, pitch:1.9});
            GlobalCooldowns.set(player.id, "pullzip", CONFIG.gadgets.pullCooldown, this.tick);
            st.progression.gadgetUses["web_pull_zip"] = (st.progression.gadgetUses["web_pull_zip"]||0)+1;
            markDirty(st);
            player.onScreenDisplay?.setActionBar?.("§aWeb-Zip!");
            return { success:true, mode:"zip_to_block" };
          }
        }catch{}
      }
      player.onScreenDisplay?.setActionBar?.("§cNo valid pull target or zip anchor");
      return { success:false, reason:"no_target_or_anchor" };
    }
  }

  activatePulse(player){
    if(!GlobalCooldowns.isReady(player.id, "pulse", this.tick)){
      const rem = GlobalCooldowns.remaining(player.id,"pulse", this.tick);
      player.onScreenDisplay?.setActionBar?.(`§7Pulse cooldown §f${(rem/20).toFixed(1)}s`);
      return { success:false, reason:"cooldown" };
    }
    try{
      const radius = CONFIG.gadgets.pulseRadius;
      const dim = player.dimension;
      const pos = player.location;
      const ents = dim.getEntities({location:pos, maxDistance: radius});
      let affected=0;
      for(const e of ents){
        if(e.id === player.id) continue;
        if(!e.isValid()) continue;
        if(e.typeId.includes("item")||e.typeId.includes("xp_orb")) continue;
        // only hostiles
        if(!e.typeId.includes("spider:") && !isHostileQuick(e.typeId)) continue;
        try{
          e.addEffect("slowness", CONFIG.gadgets.pulseSlowDuration, {amplifier:3, showParticles:true});
          e.addEffect("weakness", 40, {amplifier:1, showParticles:true});
          e.dimension.spawnParticle("spider:pulse_wave", e.location);
          affected++;
        }catch{}
      }
      dim.spawnParticle("spider:pulse_wave", pos);
      player.playSound("minecraft:block.beacon.power_select", {volume:1.0, pitch:1.6});
      player.onScreenDisplay?.setActionBar?.(`§bTech Pulse §7— affected §f${affected} §7targets`);
      GlobalCooldowns.set(player.id, "pulse", CONFIG.gadgets.pulseCooldown, this.tick);
      const st = getState(player);
      st.progression.pulseUses++;
      st.progression.gadgetUses["tech_pulse"] = (st.progression.gadgetUses["tech_pulse"]||0)+1;
      markDirty(st);
      return { success:true, affected };
    }catch(e){ return { success:false, reason:String(e)}; }
  }

  activateScanner(player){
    if(!GlobalCooldowns.isReady(player.id, "scanner", this.tick)){
      const rem = GlobalCooldowns.remaining(player.id,"scanner", this.tick);
      player.onScreenDisplay?.setActionBar?.(`§7Scanner cooldown §f${(rem/20).toFixed(1)}s`);
      return { success:false, reason:"cooldown" };
    }
    const res = this.spiderSense.manualScan(player);
    GlobalCooldowns.set(player.id, "scanner", CONFIG.gadgets.scannerCooldown, this.tick);
    const st = getState(player);
    st.progression.gadgetUses["threat_scanner"] = (st.progression.gadgetUses["threat_scanner"]||0)+1;
    markDirty(st);
    return { success:true, ...res };
  }

  findTarget(player, range=18){
    try{
      const view = player.getViewDirection();
      const pos = player.getHeadLocation();
      const dim = player.dimension;
      // method 1: getEntitiesFromViewDirection
      if(typeof player.getEntitiesFromViewDirection === "function"){
        const ents = player.getEntitiesFromViewDirection({maxDistance: range});
        if(ents && ents.length){
          for(const hit of ents){
            if(hit.entity && hit.entity.isValid() && hit.entity.id !== player.id) {
              // filter passable like items
              if(hit.entity.typeId.includes("item")) continue;
              return hit.entity;
            }
          }
        }
      }
      // fallback: ray step + getEntities around point
      const steps = Math.ceil(range/0.8);
      for(let i=1;i<=steps;i++){
        const p = {x: pos.x + view.x*i*0.8, y: pos.y + view.y*i*0.8, z: pos.z + view.z*i*0.8};
        const ents = dim.getEntities({location:p, maxDistance: 1.8});
        for(const e of ents){
          if(e.id === player.id) continue;
          if(e.typeId.includes("item")||e.typeId.includes("xp_orb")||e.typeId.includes("armor_stand")) continue;
          return e;
        }
      }
      // fallback near player
      const near = dim.getEntities({location: player.location, maxDistance: range});
      // pick closest hostile looking at
      let best=null, bestScore=Infinity;
      for(const e of near){
        if(e.id===player.id) continue;
        if(e.typeId.includes("item")) continue;
        const d = distance(player.location, e.location);
        // dot product with view direction to prefer looking at
        const toEnt = {x: e.location.x - pos.x, y: e.location.y - pos.y, z: e.location.z - pos.z};
        const len = Math.hypot(toEnt.x, toEnt.y, toEnt.z) || 1;
        const dot = (toEnt.x/len)*view.x + (toEnt.y/len)*view.y + (toEnt.z/len)*view.z;
        if(dot < 0.55) continue; // not facing
        const score = d - dot*2;
        if(score < bestScore){ best=e; bestScore=score; }
      }
      return best;
    }catch(e){ diag.warn("findTarget fail "+e); return null; }
  }

  unlockForPlayer(player, gadgetId){
    const st = getState(player);
    if(!st.gadgetUnlocked.has(gadgetId)){
      st.gadgetUnlocked.add(gadgetId);
      markDirty(st);
      player.sendMessage(`§aGadget unlocked: §f${GADGET_CONFIG[gadgetId].name}`);
      return true;
    }
    return false;
  }
}

function distance(a,b){ return Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z); }
function isHostileQuick(typeId){
  const id = typeId.toLowerCase();
  return id.includes("zombie")||id.includes("skeleton")||id.includes("creeper")||id.includes("spider")||id.includes("witch")||id.includes("pillager")||id.includes("husk")||id.includes("stray")||id.includes("drowned")||id.includes("phantom")||id.includes("brute")||id.includes("thug")||id.includes("elite");
}
