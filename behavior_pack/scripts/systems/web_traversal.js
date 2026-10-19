import { CONFIG } from "../core/config.js";
import { STATE, isValidVector, clamp, distance, vecSub, vecNorm, vecScale, vecAdd, vecLen } from "../core/constants.js";
import { diag } from "../core/diagnostics.js";
import { getState, setState, clearSwing, canStartSwing, markDirty } from "../core/player_state.js";
import { GlobalCooldowns } from "../core/cooldowns.js";
import { safeImpulseExport as safeImpulse } from "./movement.js";
import { fullCleanup } from "../core/cleanup.js";

export class WebTraversalService {
  constructor(world, system){
    this.world = world;
    this.system = system;
    this.tickCount = 0;
  }

  tick(players){
    this.tickCount++;
    for(const player of players){
      try{
        if(!player.isValid()) continue;
        const st = getState(player);
        // decrement failure cooldown tracked in st; also recheck anchor periodically
        if(st.state === STATE.SWINGING){
          this.tickSwing(player, st);
        }
        // gravity / edge handling
        if(st.state !== STATE.SWINGING && st.state !== STATE.DEAD){
          // if player fell into water while swinging, already cleaned
          if(this.isInWater(player)){
            if(st.state === STATE.SWINGING){
              this.release(player, st, "water");
            }
          }
        }
        // anchor revalidation interval
        if(st.state === STATE.SWINGING && st.anchor && this.tickCount % CONFIG.web.anchorRecheckInterval === 0){
          if(!this.validateAnchor(player, st.anchor)){
            this.release(player, st, "anchor_invalid");
            player.sendMessage("§7[Web] §fAnchor lost — released safely.");
            try{ player.playSound("item.armor.equip_chain", {volume:0.6, pitch:1.2}); }catch{}
          }
        }
      }catch(e){
        diag.reportOnce("webTick", String(e));
      }
    }
    // cooldown manager cleanup occasional
    if(this.tickCount % 100 === 0) GlobalCooldowns.cleanup(this.tickCount);
  }

  // Main entry: player uses web shooter
  tryFire(player){
    const st = getState(player);
    if(!canStartSwing(st)){
      // if already swinging, treat as release
      if(st.state === STATE.SWINGING){
        this.release(player, st, "manual_release");
        return { success:false, reason:"released" };
      }
      diag.debug("cannot start swing", st.state, st.failCooldown, st.graceTicks);
      return { success:false, reason:"cooldown/grace" };
    }
    // dimension valid?
    const dim = player.dimension;
    if(!dim) return { success:false, reason:"no_dim" };

    // find anchor: raycast via getBlockFromViewDirection, fallback to step ray
    const anchor = this.findAnchor(player);
    if(!anchor){
      st.failCooldown = CONFIG.web.failCooldownTicks;
      this.feedbackFail(player);
      return { success:false, reason:"no_anchor" };
    }
    // validate anchor
    if(!this.validateAnchor(player, anchor, true)){
      st.failCooldown = CONFIG.web.failCooldownTicks;
      this.feedbackFail(player);
      return { success:false, reason:"invalid_anchor" };
    }

    // success: store anchor
    const playerPos = player.location;
    const dist = distance(playerPos, anchor);
    const ropeLen = Math.max(CONFIG.web.minRange, Math.min(dist + CONFIG.web.ropeSlack, CONFIG.web.maxRange));
    st.anchor = { x: anchor.x+0.5, y: anchor.y+0.5, z: anchor.z+0.5 }; // center
    st.ropeLength = ropeLen;
    st.swingTicks = 0;
    st.failCooldown = 0;
    setState(player, STATE.SWINGING, "web_fire");
    player.addTag("spider_swinging");
    st.stats.totalSwings++;
    markDirty(st);

    // initial impulse towards perpendicular to give momentum: add forward + slightly up
    try{
      const view = player.getViewDirection();
      // preserve some existing velocity
      const vel = player.getVelocity();
      const speed = Math.hypot(vel.x, vel.z);
      // small launch nudge
      const launch = { x: view.x*0.35, y: 0.18, z: view.z*0.35 };
      safeImpulse(player, launch);
      // thread visual
      this.spawnThread(player, st.anchor, playerPos, true);
      this.spawnAnchorEffect(anchor);
      player.playSound("minecraft:ui.toast.in", {volume:0.9, pitch:1.4});
      player.onScreenDisplay?.setActionBar?.(`§bWeb §fattached §7[${Math.round(dist)}m] §a▸ swing! §7[use again to release]`);
    }catch(e){ diag.warn("fire effects fail "+e); }

    return { success:true, anchor, ropeLen, dist };
  }

  tickSwing(player, st){
    if(!st.anchor) { this.release(player, st, "no_anchor_data"); return; }
    const pos = player.location;
    const anchor = st.anchor;
    const toAnchor = vecSub(anchor, pos);
    const dist = vecLen(toAnchor);
    const vel = player.getVelocity();

    // Core pendulum approximation:
    // 1) if stretched beyond ropeLength, pull toward anchor proportional to excess
    // 2) apply slight damping + gravity compensation
    // 3) allow steering via view direction (small impulse)
    // 4) cap speed

    const excess = dist - st.ropeLength;
    let correction = {x:0,y:0,z:0};

    if(excess > 0.4){
      const norm = vecNorm(toAnchor);
      const pullStrength = CONFIG.web.stiffness * excess; // e.g. 0.22 * excess meters
      // clamp pull
      const pull = clamp(pullStrength, 0, CONFIG.web.impulseCap);
      correction = vecScale(norm, pull);

      // Also preserve tangential velocity: remove radial component partially
      // tangential = vel - (vel·norm)*norm * dampingFactor
      const velAlong = (vel.x*norm.x + vel.y*norm.y + vel.z*norm.z);
      // if moving away from anchor too fast, damp radial outward
      if(velAlong < 0){
        // moving towards anchor is ok; moving away (positive along toAnchor? wait sign)
        // toAnchor is anchor - pos, so positive velAlong means moving toward anchor
        // negative means moving away; we want to allow outward but not stretch
      }
      // For simplicity, apply correction impulse
      safeImpulse(player, correction);

      // visual thread every few ticks
      if(st.swingTicks % 3 === 0){
        this.spawnThread(player, anchor, pos, false);
      }
    } else if(excess < -3){
      // too close: push slightly away to avoid anchor teleport stuck
      // we can shorten rope gradually
      st.ropeLength = Math.max(CONFIG.web.minRange, st.ropeLength - 0.35);
    } else {
      // within slack, provide gentle gravity and momentum preservation
      // small forward steering
      if(st.swingTicks % 5 === 0){
        try{
          const view = player.getViewDirection();
          // only steer if player is looking roughly along motion
          const steer = { x: view.x * CONFIG.movement.airSteer *0.5, y: 0, z: view.z * CONFIG.movement.airSteer *0.5 };
          safeImpulse(player, steer);
        }catch{}
      }
      if(st.swingTicks % 4 === 0) this.spawnThread(player, anchor, pos, false);
    }

    // Apply gentle downward gravity tweak if not pulling (to feel arc)
    if(st.swingTicks % 4 === 0){
      // add slight downward when high arc to avoid float
      if(pos.y > anchor.y - 2){
        safeImpulse(player, {x:0, y: -CONFIG.web.gravity, z:0});
      }
    }

    // Speed caps
    try{
      const curVel = player.getVelocity();
      const horiz = Math.hypot(curVel.x, curVel.z);
      if(horiz > CONFIG.web.maxHorizontalSpeed){
        const scale = CONFIG.web.maxHorizontalSpeed / horiz;
        // we cannot set velocity directly; we apply counter impulse
        const counter = { x: -curVel.x * 0.18, y:0, z: -curVel.z*0.18 };
        safeImpulse(player, counter);
      }
      if(Math.abs(curVel.y) > CONFIG.web.maxVerticalSpeed){
        const counterY = { x:0, y: -curVel.y*0.12, z:0 };
        safeImpulse(player, counterY);
      }
      const total = Math.hypot(curVel.x, curVel.y, curVel.z);
      if(total > CONFIG.web.maxSpeed){
        const scale = CONFIG.web.maxSpeed/total;
        // soft clamp via drag
        safeImpulse(player, {x: -curVel.x*0.1, y: -curVel.y*0.06, z: -curVel.z*0.1});
      }
    }catch{}

    // collision safety: if player is on ground and excess large, shorten rope
    try{
      if(player.isOnGround && dist > st.ropeLength * 0.9){
        // on ground while swinging is weird; allow release hint
        if(st.swingTicks > 30){
          player.onScreenDisplay?.setActionBar?.("§aOn ground §7- §fuse web again to release or jump");
        }
      }
    }catch{}

    // update state ticks
    st.swingTicks++;

    // HUD update occasionally
    if(st.swingTicks % 10 === 0){
      const speed = vecLen(player.getVelocity());
      player.onScreenDisplay?.setActionBar?.(`§bSwinging §7| §f${Math.round(dist)}m §7| §a${speed.toFixed(1)} m/s §7| §e[use again to release]`);
    }

    // handle falling out of world safety
    if(pos.y < -60){
      this.release(player, st, "void");
    }
  }

  release(player, st, reason="release"){
    if(st.state !== STATE.SWINGING && !st.anchor) return;
    const pos = player.location;
    // preserve bounded velocity: we already have velocity, just ensure not zeroed
    try{
      const vel = player.getVelocity();
      const keep = { x: clamp(vel.x, -CONFIG.web.maxSpeed, CONFIG.web.maxSpeed), y: clamp(vel.y, -CONFIG.web.maxSpeed, CONFIG.web.maxSpeed), z: clamp(vel.z, -CONFIG.web.maxSpeed, CONFIG.web.maxSpeed) };
      // small release boost forward/up to make it feel nice
      const view = player.getViewDirection();
      const boost = { x: view.x*0.22 + keep.x*0.15, y: Math.max(0.12, keep.y*0.25), z: view.z*0.22 + keep.z*0.15 };
      // clear Swing state before applying impulse so state machine doesn't block
      clearSwing(st);
      player.removeTag("spider_swinging");
      safeImpulse(player, boost);
      // slow falling grace
      player.addEffect("slow_falling", 40, { amplifier:0, showParticles:false });
      this.spawnReleaseEffect(pos);
      player.playSound("minecraft:item.armor.equip_leather", {volume:0.7, pitch:1.6});
      player.onScreenDisplay?.setActionBar?.("§7Released §f— momentum kept §7("+reason+")");
    }catch(e){
      clearSwing(st);
      diag.warn("release fail "+e);
    }
  }

  forceReleaseAll(player){
    const st = getState(player);
    if(st.state === STATE.SWINGING) this.release(player, st, "force");
  }

  findAnchor(player){
    const range = CONFIG.web.maxRange;
    // Try native getBlockFromViewDirection first
    try{
      if(typeof player.getBlockFromViewDirection === "function"){
        const hit = player.getBlockFromViewDirection({ maxDistance: range, includeLiquidBlocks:false, includePassableBlocks:false });
        if(hit && hit.block){
          // ensure solid
          const typeId = hit.block.typeId;
          if(!typeId.includes("air") && !typeId.includes("water") && !typeId.includes("lava")){
            return hit.block.location; // Vector3
          }
        }
      }
    }catch{}

    // Fallback: step ray manually using view vector
    try{
      const start = player.getHeadLocation();
      const dir = player.getViewDirection();
      const dim = player.dimension;
      // step 0.6 blocks per iteration ~ range/0.6 steps
      const steps = Math.ceil(range / 0.5);
      for(let i=1; i<=steps; i++){
        const p = { x: start.x + dir.x * i * 0.5, y: start.y + dir.y * i * 0.5, z: start.z + dir.z * i * 0.5 };
        const block = dim.getBlock({x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z)});
        if(!block) continue;
        const id = block.typeId;
        if(id === "minecraft:air" || id === "minecraft:cave_air" || id === "minecraft:void_air") continue;
        if(id.includes("water") || id.includes("lava")) continue;
        // check if solid: use isAir or tags; fallback assume solid if not air
        if(block.isAir) continue;
        // success
        return block.location;
      }
    }catch(e){ diag.debug("ray fallback fail "+e); }
    return null;
  }

  validateAnchor(player, anchor, initial=false){
    try{
      if(!isValidVector(anchor)) return false;
      const dim = player.dimension;
      if(!dim) return false;
      // must be in same dimension (we track dimension id string)
      // distance check
      const pos = player.location;
      const d = distance(pos, {x: anchor.x+0.5, y: anchor.y+0.5, z: anchor.z+0.5});
      if(d > CONFIG.web.maxRange + 5) return false;
      if(d < CONFIG.web.minRange -2 && initial) {
        // too close anchor not useful
        // still allow but discourage
      }
      // block still solid?
      const block = dim.getBlock(anchor);
      if(!block) return false;
      if(block.isAir) return false;
      const id = block.typeId;
      if(id.includes("water")||id.includes("lava")) return false;
      return true;
    }catch{
      return false;
    }
  }

  isInWater(player){
    try{
      const dim = player.dimension;
      const pos = player.location;
      const block = dim.getBlock({x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z)});
      if(!block) return false;
      return block.typeId.includes("water");
    }catch{ return false; }
  }

  spawnThread(player, anchor, playerPos, isInitial){
    try{
      const dim = player.dimension;
      // Use particle line approximation: spawn several points along anchor->player
      const from = anchor;
      const to = playerPos;
      const steps = 6;
      for(let i=1;i<=steps;i++){
        const t = i/steps;
        const pt = { x: from.x + (to.x - from.x)*t, y: from.y + (to.y - from.y)*t, z: from.z + (to.z - from.z)*t };
        // alternate particle types for contrast
        if(i===steps) dim.spawnParticle("spider:web_anchor", pt);
        else dim.spawnParticle("spider:web_thread", pt);
      }
      if(isInitial){
        dim.spawnParticle("spider:web_impact", {x: anchor.x+0.5, y: anchor.y+0.5, z: anchor.z+0.5});
      }
    }catch(e){ /* particles optional */ }
  }

  spawnAnchorEffect(anchor){
    try{
      const dim = playerDim(anchor);
    }catch{}
  }

  spawnReleaseEffect(pos){
    try{
      const dim = this.world.getDimension("overworld"); // fallback; use player dim normally
      // actual player dim used in release caller; this is lightweight
    }catch{}
  }

  feedbackFail(player){
    try{
      player.playSound("minecraft:ui.button.click", {volume:0.5, pitch:0.6});
      player.onScreenDisplay?.setActionBar?.("§cNo anchor §7— aim at a solid surface within §f"+CONFIG.web.maxRange+"m");
      player.dimension.spawnParticle("minecraft:critical_hit_emitter", player.location);
    }catch{}
  }

  // Optional zip: pull player toward anchor rapidly
  tryZip(player){
    const st = getState(player);
    if(st.state !== STATE.SWINGING || !st.anchor) return false;
    try{
      const pos = player.location;
      const toAnchor = vecSub(st.anchor, pos);
      const dir = vecNorm(toAnchor);
      const imp = vecScale(dir, CONFIG.web.zipSpeed);
      safeImpulse(player, imp);
      player.playSound("minecraft:entity.ender_dragon.flap", {volume:0.6, pitch:1.8});
      player.dimension.spawnParticle("spider:web_thread", pos);
      return true;
    }catch{ return false; }
  }
}

function playerDim(anchor){ return null; }
