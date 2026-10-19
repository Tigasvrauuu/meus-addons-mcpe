export class CooldownManager {
  constructor(){ this.map = new Map(); } // key -> tickEnd
  set(playerId, key, ticks, currentTick){
    const end = currentTick + ticks;
    this.map.set(`${playerId}:${key}`, end);
  }
  isReady(playerId, key, currentTick){
    const v = this.map.get(`${playerId}:${key}`);
    if(v===undefined) return true;
    return currentTick >= v;
  }
  remaining(playerId, key, currentTick){
    const v = this.map.get(`${playerId}:${key}`);
    if(v===undefined) return 0;
    return Math.max(0, v - currentTick);
  }
  clear(playerId, key){
    this.map.delete(`${playerId}:${key}`);
  }
  cleanup(currentTick){
    for(const [k,end] of this.map){
      if(currentTick > end+200) this.map.delete(k);
    }
    if(this.map.size > 800){
      // prevent unbounded
      const toDelete = this.map.size - 600;
      let i=0;
      for(const k of this.map.keys()){
        if(i++ >= toDelete) break;
        this.map.delete(k);
      }
    }
  }
}

export const GlobalCooldowns = new CooldownManager();
