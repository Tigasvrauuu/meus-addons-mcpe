export const STATE = {
  IDLE: "idle",
  SWINGING: "swinging",
  CLIMBING: "climbing",
  AIR_MOBILITY: "air_mobility",
  ATTACKING: "attacking",
  DODGING: "dodging",
  MENU_OPEN: "menu_open",
  DEAD: "dead_or_unavailable",
};

export const GADGET_SLOT_TAG = "spider_gadget_selected";
export const SUIT_TAG_PREFIX = "spider_suit:";
export const WEB_ANCHOR_TAG = "spider_web_anchor";
export const WEBBED_TAG = "spider_webbed";
export const SPIDER_PLAYER_TAG = "spider_player";

export const EVENT = {
  WEB_FIRE: "spider:web_fire",
  WEB_RELEASE: "spider:web_release",
  CLIMB_ATTACH: "spider:climb_attach",
  CLIMB_DETACH: "spider:climb_detach",
};

export const DYN = {
  SCHEMA_VERSION: "spider:schema_version",
  SUIT_EQUIPPED: "spider:suit_equipped",
  SUIT_UNLOCKED: "spider:suit_unlocked_json",
  GADGET_SELECTED: "spider:gadget_selected",
  GADGET_UNLOCKED: "spider:gadget_unlocked_json",
  PROGRESSION: "spider:progression_json",
  SETTINGS: "spider:settings_json",
  STATS: "spider:stats_json",
  TOKEN_COUNT: "spider:token_count",
};

export const ITEMS = {
  WEB_SHOOTER: "spider:web_shooter",
  IMPACT_WEB: "spider:impact_web",
  WEB_RESTRAINT: "spider:web_restraint",
  ZIP_DEVICE: "spider:zip_device",
  TECH_PULSE: "spider:tech_pulse",
  THREAT_SCANNER: "spider:threat_scanner",
  SUIT_CHANGER: "spider:suit_changer",
  TOKEN: "spider:spider_token",
};

export const ENTITIES = {
  THUG: "spider:thug",
  BRUTE: "spider:brute",
  ELITE: "spider:elite",
};

export const BLOCKS = {
  SUIT_STATION: "spider:suit_station",
};

export function isValidVector(v){
  return v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}
export function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
export function lerp(a,b,t){ return a + (b-a)*t; }
export function vecLen(v){ return Math.hypot(v.x, v.y, v.z); }
export function vecNorm(v){ const l = vecLen(v) || 1; return {x:v.x/l, y:v.y/l, z:v.z/l}; }
export function vecAdd(a,b){ return {x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}; }
export function vecSub(a,b){ return {x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}; }
export function vecScale(v,s){ return {x:v.x*s,y:v.y*s,z:v.z*s}; }
export function vecDot(a,b){ return a.x*b.x+a.y*b.y+a.z*b.z; }
export function distance(a,b){ return Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z); }
