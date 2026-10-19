# Changelog

## 1.0.0 - initial release (unverified in game)

Target: Minecraft Bedrock 26.52 (`@minecraft/server` 2.11.0-beta.1.26.52-stable,
`@minecraft/server-ui` 2.3.0-beta.1.26.52-stable).

### Added
- Web-Shooter: aim-based anchoring within 30 blocks, a rope-constrained swing with
  camera steering, a speed cap, a release nudge, automatic release on landing, water,
  dimension change, timeout or anchor loss.
- Wall-cling: sneak + right-click at a vertical wall within 2.6 blocks. Look up/down to
  climb/descend, jump or sneak to let go, automatic detach when the wall disappears.
- Gadget Launcher with three gadgets: Impact Web, Web Restraint (tiered by target class),
  Tech Pulse (area). Each has its own cooldown and failure message.
- Spider-Sense: proximity alerts for hostile mobs (within 16 and 6 blocks) and a
  damage alert. Can be turned off in settings.
- Spider Hub menu: suits, gadget selection, Spider-Sense settings, progress, guide.
- Three suits with passive numbers (Classic Red & Blue, Advanced Tech, Urban Burst).
- Persistent per-player profile (suit, gadget, unlocks, counters, settings) with
  validation and repair of corrupted data.
- Starter kit granted once per player. Crafting recipes as a fallback.
- Original pixel-art icons and a web-thread particle.
- Build pipeline: syntax check, unit tests, static pack validation, `.mcaddon` build, CI artifact,
  and release on version tags.

### Not included yet
- Suit visuals, custom enemies, bosses, challenge courses, suit station, workbench, melee combos.
