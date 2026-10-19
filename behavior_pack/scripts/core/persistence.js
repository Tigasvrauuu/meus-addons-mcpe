import { saveIfDirty } from "./player_state.js";

export function tickPersistence(players, currentTick){
  for(const p of players){
    try{
      const st = players.getState ? players.getState(p) : null;
      if(!st) continue;
      if(st.persistCooldown > 0) st.persistCooldown--;
      if(st.dirtyPersist && currentTick % 40 === 0){
        saveIfDirty(p, st, false);
      }
    }catch{}
  }
}

export function forceSave(player, st){
  saveIfDirty(player, st, true);
}
