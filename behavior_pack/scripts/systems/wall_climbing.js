import { CONFIG } from "../core/config.js";
import { STATE } from "../core/constants.js";
import { getState, setState, clearClimb, canStartClimb } from "../core/player_state.js";
import { diag } from "../core/diagnostics.js";
import { safeImpulseExport as safeImpulse } from "./movement.js";

export class WallClimbingService {
  constructor(world){
    this.world = world;
    this.tick = 0;
  }

  tick(players){
    this.tick++;
    for(const p of players){
      try{
        if(!p.isValid()) continue;
        const st = getState(p);
        if(st.state === STATE.CLIMBING){
          this.tickClimb(p, st);
        } else if(st.state !== STATE.SWINGING && st.state !== STATE.DEAD){
          // auto detect opportunity? we keep climbing as manual toggle via sneak+jump logic
          // For now, if player is sneaking near wall and airborne, suggest climb via actionbar occasional
          if(this.tick % 60 === 0 && !st.climb.active){
            const wall = this.findWall(p);
            if(wall){
              // hint
              if(p.isSneaking){
                // auto attach if sneaking+looking at wall
                this.tryAttach(p);
              }
            }
          }
        }
        // grace tick handled in player_state
      }catch(e){ diag.reportOnce("climbTick", String(e)); }
    }
  }

  tryAttach(player){
    const st = getState(player);
    if(!canStartClimb(st)) return { success:false, reason:"cannot_climb_state" };
    const wall = this.findWall(player);
    if(!wall){
      player.onScreenDisplay?.setActionBar?.("§7No wall to cling");
      return { success:false, reason:"no_wall" };
    }
    // validate not inside solid
    const pos = player.location;
    const dim = player.dimension;
    const feetBlock = dim.getBlock({x: Math.floor(pos.x), y: Math.floor(pos.y-1), z: Math.floor(pos.z)});
    // we allow climbing even if feet have air; just need wall face
    st.climb.active = true;
    st.climb.surface = wall;
    st.climb.ticks = 0;
    st.climb.grace = 0;
    setState(player, STATE.CLIMBING, "climb_attach");
    player.addTag("spider_climbing");
    safeImpulse(player, {x:0,y:0.05,z:0}); // tiny stick
    player.playSound("minecraft:block.wool.place", {volume:0.7, pitch:1.3});
    player.dimension.spawnParticle("spider:web_impact", {x: pos.x, y: pos.y+0.8, z: pos.z});
    player.onScreenDisplay?.setActionBar?.("§aWall attached §7| §fSneak§7=stay §fJump§7=detach/leap §7| §fLook§7 to steer");
    return { success:true, wall };
  }

  tryDetach(player, leap=false){
    const st = getState(player);
    if(st.state !== STATE.CLIMBING) return false;
    const pos = player.location;
    clearClimb(st);
    player.removeTag("spider_climbing");
    if(leap){
      try{
        const dir = player.getViewDirection();
        // push away from wall + forward
        const wall = st.climb.surface;
        let push = {x: dir.x*0.55, y: 0.42, z: dir.z*0.55};
        if(wall && wall.face){
          // push opposite face
          const facePush = wallFaceVector(wall.face);
          push = { x: push.x + facePush.x*0.35, y: push.y, z: push.z + facePush.z*0.35 };
        }
        safeImpulse(player, push);
        player.addEffect("slow_falling", 30, {amplifier:0, showParticles:false});
      }catch{}
      player.playSound("minecraft:entity.bat.takeoff", {volume:0.8, pitch:1.2});
    } else {
      player.playSound("minecraft:item.armor.equip_leather", {volume:0.5, pitch:0.9});
    }
    player.onScreenDisplay?.setActionBar?.(leap ? "§aLeapt from wall" : "§7Detached from wall");
    return true;
  }

  tickClimb(player, st){
    if(!st.climb.active){ clearClimb(st); return; }
    // re-validate wall every interval
    if(this.tick % CONFIG.climb.checkInterval === 0){
      const wall = this.findWall(player);
      if(!wall){
        st.climb.grace--;
        if(st.climb.grace <= -2){
          this.tryDetach(player, false);
          return;
        }
      } else {
        st.climb.surface = wall;
        st.climb.grace = CONFIG.climb.wallStickGrace;
      }
    }

    // movement control: upward when sneaking? Actually in Minecraft Bedrock, sneaking on edge? We'll interpret:
    // - Holding jump (space) => climb up
    // - Sneaking => climb down / stay
    // - Otherwise hover

    // Bedrock API cannot directly detect jump key, but we can infer via velocity and isOnGround etc.
    // We'll use combination: if player is sneaking, apply slight downward; if not sneaking but looking up, go up.
    try{
      const view = player.getViewDirection();
      const isSneaking = player.isSneaking;
      // Detect jump: player velocity y positive and not on ground and we can check isJumping? not exists. Use workaround: if player is not sneaking and pitch < -25 deg -> up
      const pitch = player.getRotation().x; // -90 up, 90 down
      let vy = 0;
      if(isSneaking){
        // hold position or descend
        if(pitch > 30) vy = -CONFIG.climb.downSpeed; // look down to descent
        else vy = -0.02; // stick
        // lateral move still allowed
      } else {
        if(pitch < -20){
          vy = CONFIG.climb.upSpeed;
        } else if(pitch > 45){
          vy = -CONFIG.climb.downSpeed * 0.6;
        } else {
          vy = 0.02; // hover
        }
      }

      // lateral based on view x/z and strafing? We approximate via view direction
      const lateral = { x: view.x * CONFIG.climb.lateralSpeed * 0.35, y: vy, z: view.z * CONFIG.climb.lateralSpeed * 0.35 };
      // apply tiny impulse to stick to wall: small pull toward wall face
      if(st.climb.surface){
        const faceVec = wallFaceVector(st.climb.surface.face);
        // pull toward wall slightly (inverse face)
        const stick = { x: -faceVec.x * 0.08, y: 0, z: -faceVec.z * 0.08 };
        lateral.x += stick.x;
        lateral.z += stick.z;
      }

      // only apply if not on ground
      if(!player.isOnGround){
        safeImpulse(player, lateral);
      } else {
        // on ground while climbing = just idle; detach suggestion
        if(this.tick % 20 === 0) player.onScreenDisplay?.setActionBar?.("§7On ground — §fJump§7 to leap or §fSneak§7+look up to climb");
      }

      // visual occasional
      if(this.tick % 10 === 0){
        const pos = player.location;
        player.dimension.spawnParticle("minecraft:basic_crit", {x: pos.x, y: pos.y+1, z: pos.z});
      }

      // check for invalid inside block
      const dim = player.dimension;
      const here = dim.getBlock({x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z)});
      if(here && !here.isAir && here.typeId !== "minecraft:ladder" && here.typeId !== "minecraft:vine"){
        // inside solid -> nudge out
        const nudge = { x: (Math.random()-0.5)*0.2, y: 0.15, z: (Math.random()-0.5)*0.2 };
        safeImpulse(player, nudge);
      }

    }catch(e){ diag.reportOnce("climbMove", String(e)); }

    st.climb.ticks++;

    // timeout failsafe: don't stick forever (> 400 ticks without movement)
    if(st.climb.ticks > 800){
      this.tryDetach(player, false);
    }
  }

  findWall(player){
    try{
      const dim = player.dimension;
      const pos = player.location;
      const head = player.getHeadLocation();
      // check 4 horizontal neighbours at feet and head level
      const checks = [
        {x:1,y:0,z:0,face:"west"}, {x:-1,y:0,z:0,face:"east"},
        {x:0,y:0,z:1,face:"north"}, {x:0,y:0,z:-1,face:"south"},
        // diagonals
        {x:1,y:0,z:1,face:"northwest"}, {x:-1,y:0,z:1,face:"northeast"},
      ];
      const dist = CONFIG.climb.detectDistance;
      // we check blocks within ~1 block
      for(const off of checks){
        // check at feet, body, head
        for(const yOff of [0, 1]){
          const blockPos = {x: Math.floor(pos.x + off.x*0.9), y: Math.floor(pos.y + yOff), z: Math.floor(pos.z + off.z*0.9)};
          const block = dim.getBlock(blockPos);
          if(!block || block.isAir) continue;
          const id = block.typeId;
          if(id.includes("air") || id.includes("water") || id.includes("lava")) continue;
          // consider leaves, glass etc as valid but avoid climbing through foliage transparent? allow
          // solid check: if solid, valid wall
          return { pos: blockPos, face: off.face, typeId: id };
        }
      }
      // raycast forward like web but short
      if(typeof player.getBlockFromViewDirection === "function"){
        const hit = player.getBlockFromViewDirection({maxDistance: CONFIG.climb.detectDistance+0.3, includeLiquidBlocks:false, includePassableBlocks:false});
        if(hit && hit.block && !hit.block.isAir){
          const face = hit.face ?? "unknown";
          return { pos: hit.block.location, face };
        }
      }
    }catch{}
    return null;
  }
}

function wallFaceVector(face){
  switch(face){
    case "north": return {x:0,y:0,z:-1};
    case "south": return {x:0,y:0,z:1};
    case "east": return {x:1,y:0,z:0};
    case "west": return {x:-1,y:0,z:0};
    case "northeast": return {x: -0.6, y:0, z:0.6};
    case "northwest": return {x: 0.6, y:0, z:0.6};
    default: return {x:0,y:0,z:0};
  }
}
