# Manual (in-game) test plan

This repository's automation cannot launch Minecraft. Until someone runs this
list in-game, every runtime behavior stays labeled **Not runtime-verified**.
Run in order; each step states the expected result and what to report if it
differs.

Setup: import the `.mcaddon`, new Creative→Survival world with both packs,
cheats ON only for step 9.

1. **First join:** starter kit arrives (Web Shooter, Spider Manual, Classic
   suit) + intro toast. Equip the Classic suit chestplate.
2. **Swing:** look up ~45° at a building/trees, use with Web Shooter. Expect:
   web strand particles to the anchor, pendulum arc (NOT a teleport), speed
   building with forward input, sneak reels in.
3. **Release:** use again → clean release keeping momentum; jump while
   swinging → boosted launch. Fall from height right after: brief glide,
   then normal fall damage rules (no permanent immunity).
4. **Wall climb:** jump at a wall mid-air → attach toast; Jump climbs,
   Sneak descends, both = leap off. Walk off a ledge while attached →
   detaches safely (no fall lock).
5. **Safety exits:** swing then `/tp` to another dimension (or die): web state
   clears, no frozen velocity on respawn. Swing into water: releases.
6. **Gadgets:** impact web staggers a mob; restraint web fully locks a thug,
   slows a brute, refuses the Enforcer (toast explains); web pull zips to a
   wall and pulls a light mob; tech pulse knocks back a group; scanner shows
   periodic threat reports. Cooldown bar appears on the item each use.
7. **Spider-Sense:** stand near mobs → HUD ping with direction arrow,
   rate-limited (no spam); get hurt → ping. Toggle sound/shake in Settings.
8. **Suits & station:** craft/place Suit Station, open menu, browse suits,
   buy/equip Stealth (black) — worn look changes. Improvised suit shows
   goggles texture. Iron suit shows plated texture.
9. **Challenges:** manual → Challenges → start "First Swing", swing 10s →
   completion toast; claim reward once (second claim refused).
10. **Enemies:** night surface — thugs/gunners can spawn (monster rules);
    gunner shoots web bullets; brute/shadow/enforcer via spawn eggs: check
    textures, names, loot drops.
11. **Persistence:** play, then leave/rejoin: stats, unlocked suits, active
    challenge and settings persist per player. Second player has their own.
12. **Menus:** open manual mid-swing → swing cancels cleanly first (no stuck
    state). Close forms with Esc → no crash, no double-open.
13. **Performance:** 5 minutes of play — actionbar stays responsive, no
    console error spam (a few throttled warnings acceptable only after
    deliberate edge cases).

Report format: step, expected, actual, world seed/version, pack version.
