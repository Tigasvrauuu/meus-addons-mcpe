import { CONFIG } from "../core/config.js";
import { getState, markDirty } from "../core/player_state.js";
import { GlobalCooldowns } from "../core/cooldowns.js";
import { diag } from "../core/diagnostics.js";

export class CombatService {
  constructor(world){
    this.world = world;
    this.tick = 0;
  }

  tick(players){
    this.tick++;
    // combo reset checks
    for(const p of players){
      try{
        if(!p.isValid()) continue;
        const st = getState(p);
        if(st.combat.lastHitTick !== -9999 && this.tick - st.combat.lastHitTick > CONFIG.combat.comboResetTicks){
          if(st.combat.combo !== 0){
            st.combat.combo = 0;
          }
        }
      }catch{}
    }
  }

  // Called from entityHitEntity event when player hits target
  onPlayerHit(event){
    const { damageSource, hitEntity } = event;
    if(!hitEntity || !hitEntity.isValid()) return;
    const attacker = damageSource?.damagingEntity;
    if(!attacker || attacker.typeId !== "minecraft:player") return;
    try{
      const player = attacker;
      const st = getState(player);
      // prevent self
      if(hitEntity.id === player.id) return;

      // combo window
      const now = this.tick;
      let combo = st.combat.combo;
      if(now - st.combat.lastHitTick <= CONFIG.combat.comboWindowTicks){
        combo = Math.min(combo+1, CONFIG.combat.comboMultiplier.length-1);
      } else if(now - st.combat.lastHitTick > CONFIG.combat.comboResetTicks){
        combo = 0;
      } else {
        // outside window but inside reset => keep but not increment? we reset to 0 then increment
        combo = 0;
      }
      st.combat.lastHitTick = now;
      st.combat.combo = combo;

      const base = CONFIG.combat.meleeDamage;
      const mult = CONFIG.combat.comboMultiplier[combo] ?? 1;
      let dmg = Math.round(base * mult);

      // air strike bonus
      if(!player.isOnGround){
        dmg += CONFIG.combat.airStrikeBonus;
        player.dimension.spawnParticle("minecraft:critical_hit_emitter", hitEntity.location);
      }

      // suit bonus: defense is passive, speed affects? we give modest boost per suit
      // classic etc not add dmg, iron gives defense not damage

      // Apply damage via script if possible without double-apply
      // We already are in hit event which will apply vanilla damage; we add extra via effect?
      // Strategy: add bonus dmg as additional health removal if hitEntity has health component
      const extra = dmg - base; // only extra; base already applied by vanilla hit
      if(extra > 0){
        try{
          const health = hitEntity.getComponent("minecraft:health");
          if(health){
            const cur = health.currentValue;
            const next = Math.max(0, cur - extra);
            health.setCurrentValue(next);
            // Check kill
            if(next <= 0 && cur > 0){
              this.onEntityDefeated(player, hitEntity);
            }
          }
        }catch{}
      }

      // knockback only for our custom extra hits, not to overspam
      try{
        const dir = player.getViewDirection();
        const hk = CONFIG.combat.knockbackH * (0.9 + combo*0.15);
        hitEntity.applyKnockback(dir.x, dir.z, hk, CONFIG.combat.knockbackV);
      }catch{}

      // feedback
      player.onScreenDisplay?.setActionBar?.(`§aHit §f${hitEntity.typeId.replace("minecraft:","").replace("spider:","")} §7x${combo+1} §e${dmg} dmg`);
      hitEntity.dimension.spawnParticle("spider:web_impact", hitEntity.location);

      // finisher check
      try{
        const health = hitEntity.getComponent("minecraft:health");
        if(health){
          const ratio = health.currentValue / health.effectiveMax;
          if(ratio <= CONFIG.combat.finisherThreshold){
            player.onScreenDisplay?.setActionBar?.("§c§lFINISHER READY §7— §fSneak+Hit for extra!");
          }
        }
      }catch{}

      // progression kill tracking happens in entityDie event, but we also mark
      diag.debug(`hit combo ${combo} dmg ${dmg}`);

    }catch(e){ diag.reportOnce("combatHit", String(e)); }
  }

  onPlayerHurt(event){
    // if victim is spider player tagged, spider-sense already; could add cooldown
  }

  onEntityDie(event){
    try{
      const dead = event.deadEntity;
      const source = event.damageSource?.damagingEntity;
      if(!dead || !source || source.typeId !== "minecraft:player") return;
      const player = source;
      const st = getState(player);
      st.progression.kills++;
      markDirty(st);
      player.sendMessage(`§7Defeated §f${dead.typeId.replace("spider:","")} §7(${st.progression.kills} total)`);
      // reward token occasionally
      if(Math.random() < 0.25){
        st.progression.tokens++;
        markDirty(st);
        player.sendMessage("§a+1 Spider-Token §7(found)");
        try{
          player.dimension.spawnParticle("minecraft:villager_happy", dead.location);
          player.playSound("minecraft:entity.experience_orb.pickup", {volume:0.8, pitch:1.5});
        }catch{}
      }
      this.checkChallenges(player, st);
    }catch{}
  }

  tryDodge(player){
    const st = getState(player);
    if(!GlobalCooldowns.isReady(player.id, "dodge", this.tick)) return false;
    try{
      const dir = player.getViewDirection();
      // dodge perpendicular to view for evasive
      const dodgeVec = { x: -dir.x * CONFIG.combat.dodgeImpulse, y: 0.22, z: -dir.z * CONFIG.combat.dodgeImpulse };
      if(player.isSneaking){
        // behind
        dodgeVec.x *= 1.2; dodgeVec.z *=1.2;
      }
      // apply
      if(typeof player.applyImpulse === "function") player.applyImpulse(dodgeVec);
      else player.applyKnockback(dodgeVec.x, dodgeVec.z, CONFIG.combat.dodgeImpulse, 0.22);
      GlobalCooldowns.set(player.id, "dodge", CONFIG.combat.dodgeCooldown, this.tick);
      st.combat.dodgeCooldown = CONFIG.combat.dodgeCooldown;
      player.addEffect("resistance", 12, {amplifier:1, showParticles:false});
      player.dimension.spawnParticle("minecraft:critical_hit_emitter", player.location);
      player.playSound("minecraft:entity.player.attack.sweep", {volume:0.9, pitch:1.4});
      return true;
    }catch{ return false; }
  }

  tryWebRestraint(player, target){
    if(!target || !target.isValid()) return { success:false, reason:"invalid_target" };
    const st = getState(player);
    if(!GlobalCooldowns.isReady(player.id, "restraint", this.tick)){
      return { success:false, reason:"cooldown", remaining: GlobalCooldowns.remaining(player.id,"restraint", this.tick)};
    }
    try{
      const dist = distance(player.location, target.location);
      if(dist > CONFIG.gadgets.restraintRange){
        player.onScreenDisplay?.setActionBar?.("§cToo far for restraint");
        return { success:false, reason:"out_of_range"};
      }
      // heavy/boss resistance
      let duration = CONFIG.combat.webbedDurationLight;
      const typeId = target.typeId;
      const isHeavy = typeId.includes("brute") || typeId.includes("ravager") || typeId.includes("iron_golem");
      const isBoss = typeId.includes("elite") || typeId.includes("warden") || typeId.includes("ender_dragon");
      if(isHeavy) duration = CONFIG.combat.webbedDurationHeavy;
      if(isBoss) duration = Math.round(CONFIG.combat.webbedDurationHeavy * CONFIG.combat.bossWebResist);

      // apply slowness + immobilize via movement component or tag
      target.addTag("spider_webbed");
      try{
        target.addEffect("slowness", duration, {amplifier: 4, showParticles:true});
        target.addEffect("weakness", duration, {amplifier:1, showParticles:true});
      }catch{}
      target.dimension.spawnParticle("spider:web_restraint", target.location);

      GlobalCooldowns.set(player.id, "restraint", CONFIG.gadgets.restraintCooldown, this.tick);
      st.progression.restrains++;
      markDirty(st);
      this.checkChallenges(player, st);

      // schedule cleanup
      this.world.getDimension(target.dimension.id).runTimeout?.(()=> {
        try{
          if(target.isValid() && target.hasTag("spider_webbed")) target.removeTag("spider_webbed");
        }catch{}
      }, duration);

      player.onScreenDisplay?.setActionBar?.(`§aRestrained §f${typeId.replace("spider:","")} §7for ${Math.round(duration/20)}s`);
      player.playSound("minecraft:block.web.place", {volume:0.9, pitch:1.2});
      return { success:true, duration, target };
    }catch(e){ return { success:false, reason:String(e)}; }
  }

  tryImpactWeb(player, target){
    if(!target || !target.isValid()) return { success:false, reason:"invalid_target" };
    if(!GlobalCooldowns.isReady(player.id, "impact", this.tick)) return { success:false, reason:"cooldown", remaining: GlobalCooldowns.remaining(player.id,"impact",this.tick) };
    try{
      const dmg = CONFIG.gadgets.impactDamage;
      const health = target.getComponent("minecraft:health");
      if(health){
        const cur = health.currentValue;
        health.setCurrentValue(Math.max(0, cur - dmg));
        if(cur - dmg <= 0) this.onEntityDefeated(player, target);
      }
      // knockback
      const dir = player.getViewDirection();
      target.applyKnockback(dir.x, dir.z, 0.9, 0.35);
      target.dimension.spawnParticle("spider:web_impact", target.location);
      player.dimension.spawnParticle("minecraft:critical_hit_emitter", player.location);
      GlobalCooldowns.set(player.id, "impact", CONFIG.gadgets.impactCooldown, this.tick);
      // track
      const st = getState(player);
      st.progression.gadgetUses["impact_web"] = (st.progression.gadgetUses["impact_web"]||0)+1;
      markDirty(st);
      this.checkChallenges(player, st);
      player.onScreenDisplay?.setActionBar?.(`§eImpact Web §7— §f${dmg} dmg`);
      player.playSound("minecraft:entity.arrow.hit_player", {volume:0.8, pitch:1.6});
      return { success:true };
    }catch(e){ return { success:false, reason:String(e)}; }
  }

  checkChallenges(player, st){
    // called after progression changes; actual check in progression service
  }

  onEntityDefeated(player, entity){
    // hook for progression
  }
}

function distance(a,b){ return Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z); }
