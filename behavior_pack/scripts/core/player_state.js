import { STATE, DYN } from "./constants.js";
import { CONFIG, SUIT_CONFIG, GADGET_CONFIG } from "./config.js";

const playerStates = new Map(); // playerId -> state

export function createDefaultState(){
  return {
    state: STATE.IDLE,
    prevState: STATE.IDLE,
    stateTicks: 0,
    anchor: null, // {x,y,z}
    ropeLength: 0,
    swingTicks: 0,
    graceTicks: 0,
    failCooldown: 0,
    climb: {
      active: false,
      ticks: 0,
      surface: null,
      grace: 0,
    },
    combat: {
      combo: 0,
      lastHitTick: -9999,
      airTime: 0,
      dodgeCooldown: 0,
    },
    gadgetSelected: "web_shooter",
    gadgetUnlocked: new Set(["web_shooter","impact_web","web_restraint"]),
    suitEquipped: "classic",
    suitUnlocked: new Set(["classic","homemade"]),
    progression: {
      swingDistance: 0,
      climbDistance: 0,
      kills: 0,
      restrains: 0,
      gadgetUses: {},
      pulseUses: 0,
      senseTriggers: 0,
      challenges: {}, // id -> { done, claimed }
      tokens: 0,
    },
    settings: {
      particleIntensity: 1,
      senseVolume: 1,
      hudEnabled: true,
    },
    stats: {
      totalSwings: 0,
      totalClimb: 0,
    },
    webVisualTick: 0,
    lastPos: null,
    velocityHint: {x:0,y:0,z:0},
    pendingTeleportCheck: null,
    dimension: "overworld",
    isValid: true,
    dirtyPersist: false,
    persistCooldown: 0,
  };
}

export function getState(player){
  const id = player.id;
  if(!playerStates.has(id)){
    const s = createDefaultState();
    // try load persisted
    tryLoad(player, s);
    playerStates.set(id, s);
  }
  return playerStates.get(id);
}

export function hasState(playerId){ return playerStates.has(playerId); }
export function deleteState(playerId){ playerStates.delete(playerId); }
export function allStates(){ return playerStates; }

export function setState(player, newState, reason=""){
  const st = getState(player);
  if(st.state === newState) return false;
  // priority rules: DEAD overrides all, but IDLE->anything allowed, SWINGING <-> CLIMBING exclusive
  if(st.state === STATE.DEAD && newState !== STATE.IDLE) return false;
  if(st.state === STATE.SWINGING && newState === STATE.CLIMBING){
    // must release swing first
    clearSwing(st);
  }
  if(st.state === STATE.CLIMBING && newState === STATE.SWINGING){
    clearClimb(st);
  }
  st.prevState = st.state;
  st.state = newState;
  st.stateTicks = 0;
  return true;
}

export function clearSwing(st){
  st.anchor = null;
  st.ropeLength = 0;
  st.swingTicks = 0;
  st.graceTicks = CONFIG.web.reAttachGraceTicks;
  if(st.state === STATE.SWINGING) st.state = STATE.IDLE;
}

export function clearClimb(st){
  st.climb.active = false;
  st.climb.ticks = 0;
  st.climb.surface = null;
  st.climb.grace = CONFIG.climb.wallStickGrace;
  if(st.state === STATE.CLIMBING) st.state = STATE.IDLE;
}

export function tickState(player, st){
  st.stateTicks++;
  if(st.graceTicks > 0) st.graceTicks--;
  if(st.failCooldown > 0) st.failCooldown--;
  if(st.climb.grace > 0) st.climb.grace--;
  if(st.combat.dodgeCooldown > 0) st.combat.dodgeCooldown--;
  st.swingTicks = st.state === STATE.SWINGING ? st.swingTicks+1 : st.swingTicks;

  // dimension tracking
  try{
    const dim = player.dimension?.id ?? "minecraft:overworld";
    if(st.dimension !== dim){
      // dimension change resets traversal
      clearSwing(st);
      clearClimb(st);
      st.dimension = dim;
      st.state = STATE.IDLE;
    }
    // pos tracking for distance stats
    const pos = player.location;
    if(st.lastPos){
      if(st.state === STATE.SWINGING && st.anchor){
        st.progression.swingDistance += distanceXZ(pos, st.lastPos);
      }
      if(st.state === STATE.CLIMBING){
        st.progression.climbDistance += Math.abs(pos.y - st.lastPos.y);
      }
    }
    st.lastPos = {x:pos.x, y:pos.y, z:pos.z};
  }catch{}
}

function distanceXZ(a,b){ return Math.hypot(a.x-b.x, a.z-b.z); }

export function isInTraversal(st){
  return st.state === STATE.SWINGING || st.state === STATE.CLIMBING;
}

export function canStartSwing(st){
  if(st.failCooldown > 0) return false;
  if(st.graceTicks > 0) return false;
  if(st.state === STATE.DEAD) return false;
  if(st.state === STATE.SWINGING) return false; // need release first, unless rapid zip
  return true;
}
export function canStartClimb(st){
  if(st.state === STATE.DEAD) return false;
  if(st.state === STATE.SWINGING) return false;
  if(st.climb.grace > 0) return false;
  return true;
}

// Persistence helpers

export function markDirty(st){ st.dirtyPersist = true; }

function tryLoad(player, st){
  try{
    const v = player.getDynamicProperty(DYN.SCHEMA_VERSION);
    // suits
    const suitEq = player.getDynamicProperty(DYN.SUIT_EQUIPPED);
    if(typeof suitEq === "string" && SUIT_CONFIG[suitEq]) st.suitEquipped = suitEq;
    const unlocked = player.getDynamicProperty(DYN.SUIT_UNLOCKED);
    if(typeof unlocked === "string"){
      const arr = JSON.parse(unlocked);
      if(Array.isArray(arr)) st.suitUnlocked = new Set(arr.filter(id=>SUIT_CONFIG[id]));
    }
    const gadgetSel = player.getDynamicProperty(DYN.GADGET_SELECTED);
    if(typeof gadgetSel === "string" && GADGET_CONFIG[gadgetSel]) st.gadgetSelected = gadgetSel;
    const gadgetUnlocked = player.getDynamicProperty(DYN.GADGET_UNLOCKED);
    if(typeof gadgetUnlocked === "string"){
      const arr = JSON.parse(gadgetUnlocked);
      if(Array.isArray(arr)) st.gadgetUnlocked = new Set(arr.filter(id=>GADGET_CONFIG[id]));
    }
    const prog = player.getDynamicProperty(DYN.PROGRESSION);
    if(typeof prog === "string"){
      const obj = JSON.parse(prog);
      if(obj && typeof obj === "object"){
        Object.assign(st.progression, obj);
        // restore Sets/maps if needed
        if(obj.challenges) st.progression.challenges = obj.challenges;
        if(obj.gadgetUses) st.progression.gadgetUses = obj.gadgetUses;
      }
    }
    const settings = player.getDynamicProperty(DYN.SETTINGS);
    if(typeof settings === "string"){
      const obj = JSON.parse(settings);
      if(obj) Object.assign(st.settings, obj);
    }
    const stats = player.getDynamicProperty(DYN.STATS);
    if(typeof stats === "string"){
      const obj = JSON.parse(stats);
      if(obj) Object.assign(st.stats, obj);
    }
    const tokens = player.getDynamicProperty(DYN.TOKEN_COUNT);
    if(typeof tokens === "number") st.progression.tokens = tokens;
  }catch(e){
    // ignore corrupted, use defaults
  }
}

export function saveIfDirty(player, st, force=false){
  if(!force && !st.dirtyPersist) return false;
  if(st.persistCooldown > 0 && !force) return false;
  try{
    player.setDynamicProperty(DYN.SCHEMA_VERSION, CONFIG.version);
    player.setDynamicProperty(DYN.SUIT_EQUIPPED, st.suitEquipped);
    player.setDynamicProperty(DYN.SUIT_UNLOCKED, JSON.stringify([...st.suitUnlocked]));
    player.setDynamicProperty(DYN.GADGET_SELECTED, st.gadgetSelected);
    player.setDynamicProperty(DYN.GADGET_UNLOCKED, JSON.stringify([...st.gadgetUnlocked]));
    player.setDynamicProperty(DYN.PROGRESSION, JSON.stringify({
      swingDistance: Math.round(st.progression.swingDistance),
      climbDistance: Math.round(st.progression.climbDistance),
      kills: st.progression.kills,
      restrains: st.progression.restrains,
      gadgetUses: st.progression.gadgetUses,
      pulseUses: st.progression.pulseUses,
      senseTriggers: st.progression.senseTriggers,
      challenges: st.progression.challenges,
      tokens: st.progression.tokens,
    }));
    player.setDynamicProperty(DYN.SETTINGS, JSON.stringify(st.settings));
    player.setDynamicProperty(DYN.STATS, JSON.stringify(st.stats));
    player.setDynamicProperty(DYN.TOKEN_COUNT, st.progression.tokens);
    st.dirtyPersist = false;
    st.persistCooldown = CONFIG.progression.saveIntervalTicks;
    return true;
  }catch{
    return false;
  }
}

export function unlockSuit(st, suitId){
  if(!SUIT_CONFIG[suitId]) return false;
  if(st.suitUnlocked.has(suitId)) return false;
  st.suitUnlocked.add(suitId);
  markDirty(st);
  return true;
}
export function equipSuit(st, suitId){
  if(!SUIT_CONFIG[suitId]) return false;
  if(!st.suitUnlocked.has(suitId)) return false;
  st.suitEquipped = suitId;
  markDirty(st);
  return true;
}
export function unlockGadget(st, gadgetId){
  if(!GADGET_CONFIG[gadgetId]) return false;
  if(st.gadgetUnlocked.has(gadgetId)) return false;
  st.gadgetUnlocked.add(gadgetId);
  markDirty(st);
  return true;
}
export function selectGadget(st, gadgetId){
  if(!GADGET_CONFIG[gadgetId]) return false;
  if(!st.gadgetUnlocked.has(gadgetId)) return false;
  st.gadgetSelected = gadgetId;
  markDirty(st);
  return true;
}
