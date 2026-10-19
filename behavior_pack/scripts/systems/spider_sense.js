import { CONFIG } from "../core/config.js";
import { getState, markDirty } from "../core/player_state.js";
import { diag } from "../core/diagnostics.js";

export class SpiderSenseService {
  constructor(world){
    this.world = world;
    this.tick = 0;
    this.lastAlert = new Map(); // playerId -> tick
    this.threatHistory = new Map();
  }

  tick(players){
    this.tick++;
    if(this.tick % CONFIG.spiderSense.intervalTicks !== 0) return;
    for(const p of players){
      try{
        if(!p.isValid()) continue;
        const st = getState(p);
        // cooldown
        const last = this.lastAlert.get(p.id) ?? -9999;
        if(this.tick - last < CONFIG.spiderSense.cooldownTicks) continue;
        // only when enabled; if player has disabled in settings could skip, but default enabled
        if(st.settings && st.settings.senseEnabled === false) continue;

        const threats = this.scanThreats(p);
        if(threats.length >= CONFIG.spiderSense.threatThreshold){
          this.trigger(p, st, threats);
          this.lastAlert.set(p.id, this.tick);
        }
      }catch(e){ diag.reportOnce("senseTick", String(e)); }
    }
  }

  scanThreats(player){
    const pos = player.location;
    const dim = player.dimension;
    const radius = CONFIG.spiderSense.radius;
    let entities = [];
    try{
      // bounded query
      entities = dim.getEntities({ location: pos, maxDistance: radius, excludeTypes: ["minecraft:item","minecraft:xp_orb","minecraft:armor_stand"] });
    }catch{
      // fallback older API: getEntitiesAtBlockLocation? ignore
      return [];
    }
    const threats = [];
    for(const e of entities){
      if(!e.isValid()) continue;
      if(e.id === player.id) continue;
      // skip non-hostile classification? we use typeId heuristic + family
      const typeId = e.typeId;
      if(typeId.includes("player") && !typeId.includes("spider:elite")) continue; // don't alert on other players unless elite
      // hostile check: contains monster/hostile or our custom
      const isHostile = isHostileEntity(e);
      if(!isHostile) continue;
      // distance and LOS-ish: if very close, always threat
      const d = distance(pos, e.location);
      if(d > radius) continue;
      // danger heuristic: closer = higher, plus if recent damage to player, amplify
      let danger = 1 - (d / radius);
      if(d < 6) danger += 0.5;
      // check if entity is targeting player? via target component if available
      try{
        const target = e.target; // may not exist
        if(target && target.id === player.id) danger += 0.4;
      }catch{}
      // projectile near player also threat
      if(typeId.includes("arrow") || typeId.includes("fireball") || typeId.includes("snowball")) danger += 0.6;

      threats.push({ entity:e, typeId, d, danger, pos: e.location });
    }
    // sort by danger descending then distance
    threats.sort((a,b)=> b.danger - a.danger || a.d - b.d);
    return threats.slice(0, CONFIG.spiderSense.maxThreatsTracked);
  }

  trigger(player, st, threats){
    // increment stats
    st.progression.senseTriggers++;
    st.stats.senseTriggers = (st.stats.senseTriggers ?? 0) + 1;
    markDirty(st);
    // challenge check
    // feedback: title + sound + particle
    try{
      const top = threats[0];
      const count = threats.length;
      const dirHint = CONFIG.spiderSense.directional ? directionalHint(player, top.pos) : "";
      const msg = count===1 ? `§c⟡ Spider-Sense §7— §f1 threat ${dirHint}` : `§c⟡ Spider-Sense §7— §f${count} threats ${dirHint}`;
      player.onScreenDisplay?.setActionBar?.(msg);
      // also title for high danger
      if(top.danger > 0.9){
        player.onScreenDisplay?.setTitle?.("§c§l! SENSE !", { stayDuration: 10, fadeInDuration:2, fadeOutDuration:10, subtitle: `§7${top.typeId.replace("minecraft:","").replace("spider:","")} nearby` });
      }
      player.playSound("minecraft:block.note_block.pling", {volume: 0.85, pitch: 1.8});
      // particle pulse
      const pos = player.location;
      player.dimension.spawnParticle("spider:sense_pulse", {x: pos.x, y: pos.y+1.2, z: pos.z});
      // directional particle if possible
      if(dirHint){
        const hintPos = { x: pos.x + topPosDelta(player, top.pos).x*0.8, y: pos.y+1, z: pos.z + topPosDelta(player, top.pos).z*0.8 };
        player.dimension.spawnParticle("minecraft:basic_crit", hintPos);
      }
    }catch(e){ diag.debug("sense feedback fail "+e); }
  }

  manualScan(player){
    const st = getState(player);
    const threats = this.scanThreats(player);
    if(threats.length===0){
      player.sendMessage("§a[Scanner] §7No threats detected within "+CONFIG.spiderSense.radius+"m. You're clear.");
      player.playSound("minecraft:random.orb", {volume:0.7, pitch:1.4});
      return { count:0, threats };
    }
    player.sendMessage(`§c[Scanner] §fDetected ${threats.length} threat(s):`);
    for(const t of threats){
      player.sendMessage(` §7- §f${t.typeId} §7@ §f${Math.round(t.d)}m §7danger §c${t.danger.toFixed(2)}`);
      try{
        t.entity.addEffect("glowing", 60, {amplifier:0, showParticles:false});
        player.dimension.spawnParticle("minecraft:villager_happy", t.pos);
      }catch{}
    }
    player.playSound("minecraft:block.beacon.activate", {volume:0.9, pitch:1.1});
    return { count: threats.length, threats };
  }
}

function isHostileEntity(e){
  const id = e.typeId.toLowerCase();
  // vanilla hostile list
  const hostiles = ["zombie","skeleton","creeper","spider","enderman","witch","husk","stray","pillager","vindicator","evoker","ravager","phantom","drowned","guardian","slime","magma_cube","blaze","ghast","piglin","hoglin","warden","shulker","zoglin","spider:thug","spider:brute","spider:elite"];
  for(const h of hostiles){
    if(id.includes(h)) return true;
  }
  // family check if available
  try{
    if(e.hasTag("hostile")) return true;
    if(e.hasTag("spider_enemy")) return true;
  }catch{}
  // generic: if entity has health and targets player? assume hostile if not passive animal
  if(id.includes("cow")||id.includes("pig")||id.includes("sheep")||id.includes("chicken")||id.includes("villager")||id.includes("iron_golem")) return false;
  // unknown: treat as not hostile unless custom
  if(id.startsWith("spider:")) return true;
  return false;
}

function distance(a,b){ return Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z); }

function directionalHint(player, targetPos){
  try{
    const p = player.location;
    const rot = player.getRotation().y; // yaw: 0 = south? need approximate
    const dx = targetPos.x - p.x;
    const dz = targetPos.z - p.z;
    let angle = Math.atan2(dz, dx) * 180/Math.PI; // world angle
    // convert player yaw to similar system: yaw 0 = -z? approximate; we give quadrant only
    // Simplified: compare dx,dz quadrants
    if(Math.abs(dx) < 2 && Math.abs(dz) < 2) return "§e(very close)";
    if(Math.abs(dx) > Math.abs(dz)){
      return dx > 0 ? "§e→ east" : "§e← west";
    } else {
      return dz > 0 ? "§e↓ south" : "§e↑ north";
    }
  }catch{ return ""; }
}
function topPosDelta(player, targetPos){
  const p = player.location;
  const dx = targetPos.x - p.x;
  const dz = targetPos.z - p.z;
  const len = Math.hypot(dx,dz) || 1;
  return {x: dx/len, y:0, z: dz/len};
}
