import { CONFIG } from "./config.js";

const LEVELS = { debug:0, info:1, warn:2, error:3 };
let current = LEVELS[CONFIG.general.logLevel] ?? 1;

export function setLogLevel(lv){ if(LEVELS[lv]!==undefined) current = LEVELS[lv]; }

function log(level, ...args){
  if(LEVELS[level] < current) return;
  const prefix = `[Spider-DE][${level}]`;
  try{
    if(level==="error") console.error(prefix, ...args);
    else if(level==="warn") console.warn(prefix, ...args);
    else console.log(prefix, ...args);
  }catch{}
}

export const diag = {
  debug: (...a)=>log("debug",...a),
  info: (...a)=>log("info",...a),
  warn: (...a)=>log("warn",...a),
  error: (...a)=>log("error",...a),
  // bounded error reporter to avoid spam
  _recent: new Map(),
  reportOnce(key, msg, level="warn"){
    const now = Date.now();
    const last = this._recent.get(key) ?? 0;
    if(now - last < 5000) return;
    this._recent.set(key, now);
    log(level, `${key}: ${msg}`);
    if(this._recent.size > 100) this._recent.clear();
  }
};
