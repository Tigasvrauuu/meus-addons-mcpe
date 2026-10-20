// main.js — entry point (declared in the behavior pack manifest).
// Boots the lifecycle service exactly once. Nothing else runs at module
// evaluation time: all event subscriptions and the scheduler are set up
// inside lifecycle.init() with error boundaries (spec §0.3, §20).

import { init } from "./core/lifecycle.js";

try {
  init();
} catch (err) {
  // Fatal boot failure must be visible, actionable, and logged exactly once.
  const msg = err && err.stack ? err.stack : String(err);
  try {
    console.error(`[SMX] FATAL: initialization failed — add-on disabled. ${msg}`);
  } catch {
    /* no console on this host */
  }
}
