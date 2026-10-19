# Changelog

## 1.0.0 — 2026-10-19
- Initial release for Minecraft Bedrock 26.52 (min_engine 1.21.60).
- Core traversal: web anchor raycast (native + fallback step), pendulum approximation, stiffness/damping, speed caps, grace periods, water/dimension/death handling, visual thread via particles.
- Wall climbing: face detection, sneak-attach, pitch-steered ascent/descent, leap, auto-detach + grace.
- Air mobility: enhanced jump, controlled air steer, slow_falling fall mitigation.
- Combat: combo system, air strike bonus, dodge, finisher hint, restraint/impact paths, cooldown manager, cleanup.
- Gadgets: 6 distinct gadgets with registry, cooldown, unlock, activation, fallback target scanning.
- Spider-Sense: proximity scan, priority, directional hint, throttled alerts, manual scanner.
- Suits: 6 archetypes, data model, equip/unlock lifecycle, passive modifiers, persistence.
- Entities: Thug/Brute/Elite with roles, health, attacks, loot, spawn rules (weight 0 controlled).
- Blocks: Suit Station block + recipes (web_shooter, station, token).
- Particles: 7 original definitions.
- UI: Main Hub, Suit/Gadget/Progression/Help/Settings forms with resilience + chat fallback.
- Persistence: Dynamic Properties per player, schema version, validation, save cadence, multiplayer isolation.
- Lifecycle: death/respawn/dimension/anchor/ target/ timer cleanup, ownership model.
- Assets: original vanilla-plus textures (16×16 icons, 64×64 entities, 128px pack icons) + models/controllers.
- Tooling: validate.js (JSON, UUID, imports, textures), unit.test.js, build.js (mcaddon + mcpack), GitHub Actions workflow.
- Docs: README, CREDITS, GUIDE, honest validation report.

