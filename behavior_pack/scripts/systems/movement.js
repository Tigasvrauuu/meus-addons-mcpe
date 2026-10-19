import { CONFIG } from "../core/config.js";
import { diag } from "../core/diagnostics.js";

export class MovementService {
  constructor(){}

  applyJumpBoost(player, st){
    try{
      // Enhanced jump: apply impulse upward, with forward boost
      const dir = player.getViewDirection();
      const horiz = { x: dir.x * 0.35, y: 0, z: dir.z * 0.35 };
      const imp = { x: horiz.x, y: CONFIG.movement.enhancedJump, z: horiz.z };
      safeImpulse(player, imp);
      player.addEffect("jump_boost", 40, { amplifier: 1, showParticles: false });
      return true;
    }catch(e){ diag.warn("jumpBoost failed "+e); return false; }
  }

  applyAirSteer(player, st){
    // air steering is handled in tick via small corrections when swinging
    return false;
  }

  mitigateFallDamage(player, st){
    // apply slow_falling briefly after release/climb detach
    try{
      player.addEffect("slow_falling", CONFIG.movement.landingGraceTicks, { amplifier:0, showParticles:false });
      player.addEffect("resistance", 30, { amplifier:1, showParticles:false });
      st.landingGrace = CONFIG.movement.landingGraceTicks;
      return true;
    }catch{ return false; }
  }

  tick(player, st){
    // mitigate fall damage grace countdown
    if(st.landingGrace > 0){
      st.landingGrace--;
      // ensure effect stays if still falling fast
      if(st.landingGrace % 10 === 0){
        try{
          const vel = player.getVelocity();
          if(vel.y < -0.6){
            player.addEffect("slow_falling", 20, { amplifier:0, showParticles:false });
          }
        }catch{}
      }
    }
  }
}

function safeImpulse(player, vec){
  try{
    // clamp and apply
    const cap = CONFIG.web.impulseCap;
    const len = Math.hypot(vec.x, vec.y, vec.z);
    let v = vec;
    if(len > cap){
      const s = cap/len;
      v = {x:vec.x*s, y:vec.y*s, z:vec.z*s};
    }
    if(typeof player.applyImpulse === "function"){
      player.applyImpulse(v);
    } else if(typeof player.applyKnockback === "function"){
      // fallback: convert to knockback
      const horiz = Math.hypot(v.x, v.z);
      const dirX = horiz ? v.x/horiz : 0;
      const dirZ = horiz ? v.z/horiz : 0;
      player.applyKnockback(dirX, dirZ, horiz, v.y);
    } else {
      // last resort: small teleport nudge + velocity preservation
      const loc = player.location;
      player.teleport({x: loc.x + v.x*0.5, y: loc.y + v.y*0.5, z: loc.z + v.z*0.5});
    }
  }catch(e){
    // ignore
  }
}

export function safeImpulseExport(player, vec){
  return safeImpulse(player, vec);
}
