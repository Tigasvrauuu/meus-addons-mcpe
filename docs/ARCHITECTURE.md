# Architecture

Single entry point: `scripts/main.js` → `core/lifecycle.js#init()` (idempotent:
double-init is a no-op). One `system.runInterval` scheduler drives every tick
service; every event subscription is wrapped in a `guarded()` handler that
logs throttled errors instead of killing the loop (spec §4.4: a broken tick
must never brick the world).

## Module map

```
core/
  constants.js   ids, tags, move states, cooldown categories, challenge ids
  config.js      ALL tuning numbers (RAW_CONFIG → buildConfig with clamping)
  vec.js         PURE vector math (NaN-safe)
  utils.js       PURE-ish helpers (yaw/arrow conventions, validity probe)
  cooldowns.js   PURE timestamp cooldown math
  save_schema.js PURE save validation/repair (versioned, per-field fallbacks)
  state.js       per-player runtime state (Map by playerId), passives, HUD queue
  save.js        world dynamic properties ("smx:data" world key + per-player
                 keys), throttled writes, load-on-join, save-on-leave
  logger.js      throttled console.error wrapper (never silent-swallow)
  bus.js         tiny event bus: emit("progress", …) couples systems → challenges
  input.js       inputInfo bridge (button states, movement vector; null-safe)
  lifecycle.js   init: subscriptions + scheduler + bootstrap of online players
systems/
  swing_math.js  PURE pendulum solver (rope constraint, pumping, caps)
  climb_math.js  PURE climb/glide/wall-pick math
  restraint_rules.js PURE target classification (light/heavy/immune/pull)
  challenge_rules.js PURE progression state machine
  traversal.js   swing/zip runtime (raycast anchor, web entities, particles)
  climbing.js    wall attach/detach, glide window
  combat.js      melee, restraints registry, death cleanup
  sense.js       bounded proximity scan, alerts, scanner mode
  gadgets.js     one registry/activation/cooldown path for all gadgets
  suits.js       roster, passives, equip, purchases, starter kit
  challenges.js  runtime façade over challenge_rules + rewards
ui/
  hud.js         actionbar line, toasts, sfx/fx wrappers (feature-safe)
  menus.js       main menu / settings / station (index-routed forms)
```

## Design rules enforced by tests & validator

- **Pure core:** physics/rules/schema math never imports `@minecraft/*`, so
  Node unit tests exercise the real production functions.
- **Timestamp cooldowns:** no timers/intervals per gadget; readiness is
  derived from `system.currentTick` deltas (leak-proof, save-friendly).
- **Single source of truth per concept:** e.g. web_shooter delegates to
  `traversal.fireOrRelease` (no duplicate swing code), challenges listen only
  to `bus.emit("progress", …)`.
- **Bounded everything:** scan radius + threat caps, rope min/max, speed caps,
  restraint classes, form retry limits, cooldown floors/ceilings — all in
  `config.js` and clamped at build time.
- **Safety exits:** dimension change, death, water, anchor loss, physics
  exception → traversal/climb states are force-released (P0: never trap the
  player).
- **Cross-version honesty:** 2.10-only APIs (camera.addShake) are
  feature-detected; `isValid` handled as property-or-method.

## Data flow (typical swing)

itemUse(Web Shooter) → gadgets.activateGadget → traversal.fireOrRelease →
raycast anchor (`getBlockFromViewDirection`) → state.move=SWINGING →
scheduler tick: traversal.tickTraversal → swing_math.stepSwing (pure) →
utils.setVelocity (`applyImpulse` delta) → strand particles between chest and
anchor → jump edge → releaseWeb(launch) → velocity preserved (capped) +
glide window → progress events → challenges.
