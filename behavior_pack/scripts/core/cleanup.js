import { clearSwing, clearClimb } from "./player_state.js";
import { STATE } from "./constants.js";

export function fullCleanup(player, st, reason="generic"){
  // Remove traversal owned modifiers only. We track ownership via state, so safe to clear.
  try{
    // clear swing anchor visual tag
    if(player.hasTag("spider_swinging")) player.removeTag("spider_swinging");
    if(player.hasTag("spider_climbing")) player.removeTag("spider_climbing");
    // Effects owned by this addon: slow_falling, resistance, speed, jump_boost applied by us.
    // We only remove if we applied; heuristic: remove and reapply suit passive if needed elsewhere.
    // For now, we clear webbed-tag helpers but preserve suit effects via SuitService reapply.
    // Position safe: do not teleport; preserve velocity bounded.
    // Clear movement modifiers: we used applyImpulse only, no persistent attribute.
  }catch{}
  clearSwing(st);
  clearClimb(st);
  st.state = STATE.IDLE;
  st.graceTicks = 6;
}

export function onDeath(player, st){
  fullCleanup(player, st, "death");
  st.state = STATE.DEAD;
}

export function onRespawn(player, st){
  st.state = STATE.IDLE;
  st.graceTicks = 20;
}

export function onDisconnect(playerId){
  // handled via world.afterEvents.playerLeave -> delete state after save attempt
}

export function sanitizeVelocity(vec, cap=1.8){
  const len = Math.hypot(vec.x, vec.y, vec.z);
  if(len > cap){
    const s = cap/len;
    return {x:vec.x*s, y:vec.y*s, z:vec.z*s};
  }
  return vec;
}
