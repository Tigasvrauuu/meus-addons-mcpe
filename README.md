# Spider-Man: Definitive Experience — Minecraft Bedrock 26.52

> **Fan-made, original assets.** Not affiliated with Marvel, Sony or Mojang. All textures, models, sounds and code are original and created for this project.

A polished, vanilla-plus Spider-Man gameplay addon for **Minecraft Bedrock Edition 26.52** (tested against 1.21.60+ API). Focus: responsive web-swinging, wall climbing, Spider-Sense, tactical gadgets, distinct suits, and a light progression loop — all working in a normal survival world without needing a custom city map.

![Pack Icon](pack_icon.png)

## Features

### Core Movements (P0 — Playable Foundation)
- **Web-Shooter & Swing** — Raycast to solid anchor (38m), rope physics with stiffness/damping, tangential momentum, speed caps, grace periods, safe release with momentum preservation + `slow_falling` grace. Handles death/dimension/water/anchor loss cleanly.
- **Wall Climbing** — Detects vertical faces within 1.1m, attach via Sneak, climb up/down with pitch + sneak, lateral steering, jump-to-leap, automatic detach on lost surface.
- **Air Mobility** — Enhanced jump, air impulse, fall-damage mitigation (bounded slow_falling window).

### Integrated Game Loop (P1)
- **Combat** — Melee combo (4 stages) with window, air-strike bonus, knockback, dodge w/ cooldown + resistance, finisher hint, unified damage path, target validation, friendly-fire guard.
- **Gadgets (6)** — Web-Shooter (starter), Impact Web (damage), Web Restraint (temp movement 0.02), Web-Zip/Pull (zip to anchor or pull entity), Tech Pulse (AoE slow, 12m), Threat Scanner (highlight scan). Each has separate cooldown, unlock rule, activation route, cleanup.
- **Spider-Sense** — Interval scan (12 ticks, 22m), hostile priority, directional hint, title + actionbar + particles + sound, throttled cooldown, manual scanner mode.
- **Suits (6)** — Classic, Homemade, Stealth Black, Advanced Tech (-12% cooldown), Urban Pulse (+mobility), Iron-Armor (+defense). Data-driven IDs, equip cycle, passive effects, unlock via challenges.
- **Progression** — 4 challenges (traversal, combat, tech, stealth) with distance/kills/gadget counters, rewards (suits + tokens), persistent dynamic properties with validation + migrations.
- **UI** — Main Hub (Suit/Gadget/Progression/Guide/Settings) via `server-ui` ActionForm/ModalForm, resilient to close/cancel/disconnect, chat fallback (`!menu`, `!starter`, etc.).

### Polish (P2)
- Custom entities: Thug (24hp), Brute (48hp heavy resist), Elite (80hp ranged+melee boss-lite) with loot + webbed component group.
- Blocks: Suit Station (interactive, light 6, crafting recipe).
- Particles: web_thread, web_anchor, web_impact, web_restraint, sense_pulse, pulse_wave, suit_unlock — all vanilla-compatible.
- Vanilla-plus textures: original 16×16 icons, 64×64 entity skins, block textures, pack icons (128px).
- Sounds & feedback matrix (success/fail/interrupt distinct).

## Quick Start

1. Download `SPIDER_MAN_DE_v1.0.0.mcaddon` from Releases or `dist/` build artifact.
2. Double-click / import via Minecraft Bedrock 26.52. Enable both packs in world: Behavior Pack + Resource Pack. No experimental toggles required (uses stable `@minecraft/server` 1.16.0 + `@minecraft/server-ui` 1.4.0).
3. Create/open world. On first join you automatically receive starter kit: Web-Shooter, Impact Web, Web Restraint, Suit Changer, 3 Spider-Tokens.
4. Equip Web-Shooter, look at a block ≤38m, **Use** to fire. Use again to release. Chat hint appears.
5. Near a wall, **Sneak** to attach, look up to rise, **Jump** to leap.
6. Open menu: use Suit Changer item, interact with Suit Station, or chat `!menu` / `/function spider:menu`. Guide inside.

## Controls

| Action | How | Notes |
|--------|-----|-------|
| Fire web | Use Web-Shooter item toward solid block | Fail feedback if no anchor/cooldown |
| Release | Use again while swinging | Keeps momentum + slow_falling |
| Zip to anchor | While swinging, use Zip gadget or chat `!zip` | Also pulls entity if not swinging |
| Pull target | Zip gadget facing entity (<18m) | Bounded impulse |
| Impact Web | Use Impact gadget facing target | Damage + knockback, cooldown 40 ticks |
| Restraint | Use Restraint facing target | Slowness IV, heavy targets shortened |
| Tech Pulse | Use Pulse item | Slows hostiles 12m, 100 ticks, cd 120 |
| Scan | Use Scanner | Glowing highlight + list, cd 100 |
| Climb attach | Sneak near wall (<1.1m) | Auto hint |
| Climb up | Look up (pitch < -20) while climbing | 0.28 speed |
| Descend | Sneak + look down | 0.22 speed |
| Leap | Jump while climbing | Forward+up impulse |
| Dodge | Chat `!dodge` (or bind via addon UI) | Cd 30, resistance |
| Menu | Suit Changer / Suit Station / `!menu` | ActionForm, back/close safe |

Mobile: all actions available via items + menu; no keyboard-only bindings.

## Progression & Unlocks

- **Traversal I** — Swing 300m + climb 20m → Urban suit + 2 tokens
- **Combat I** — 10 kills + 5 restrains → Iron-Armor + 3 tokens (+ scanner unlock)
- **Tech I** — 5 gadget uses + 3 pulses → Advanced + 2 tokens (+ pulse unlock)
- **Stealth I** — 10 sense triggers → Stealth + 2 tokens

Track in Progression menu, claim rewards there. Data persists via per-player Dynamic Properties with schema version and safe defaults on corruption.

## Recipes

- Web-Shooter: `R` redstone, `I` iron, `S` string, `L` leather pattern (see `behavior_pack/recipes/web_shooter.json`)
- Suit Station: Iron, redstone, copper, smithing table, obsidian, blue dye
- Spider-Token: string + diamond pattern (also rare mob drops)

## Installation Notes

- Target: Bedrock 26.52 / min_engine 1.21.60. Works on 1.21.0+ with stable APIs.
- No cheats required except starter `/function` alternative; world host should allow scripting.
- Multiplayer: per-player state isolated, tags namespaced (`spider_*`), rewards not duplicated.
- Coexistence: only touches `spider:*` IDs + player tags/effects it owns; reversible modifiers.

## Validation

- JSON: 100% parse checks via `tools/validate.js`
- Unit: `tests/unit.test.js` (config, math, cooldowns, suit/gadget state)
- Static: UUID collisions, texture refs, particle refs, recipe sanity
- Runtime: structurally verified (pack import not manually run in this environment — reported honestly)

Run locally:
```bash
node tools/validate.js
node tests/unit.test.js
node tools/build.js
```

## Known Limitations (honest)

- **Runtime testing**: Built and statically verified; import/run not observed in actual Minecraft client in this sandbox (no device). Physics caps tuned by spec, not playtest — may need iteration.
- **Player animation**: Bedrock has no official player-body swing animation for addons; we use tag-driven controller stubs + particles/impulse. True skeletal swing would need experimental molang.
- **Velocity API**: Bedrock scripting limits direct velocity set; we use `applyImpulse`/`applyKnockback` + soft caps. Extreme terrain collisions may still clip; we bound speeds conservatively.
- **Spawn rules**: weighted 0 by default to avoid world flood; spawn via egg / `/summon spider:thug` / challenge areas.
- **Controller/touch parity**: core uses item-use, validated for touch; dedicated gamepad keybinds not hookable without beta APIs.
- **Audio**: placeholder .ogg stubs (original sounds not embedded in this run); no unlicensed commercial audio.

## Credits

- Design/spec: Spider-Man DE Master Spec (Definitive Experience)
- Implementation: Arena AI agent — original code & textures (PIL-generated vanilla-plus pixel art)
- Licenses: Custom fan-made. No extraction from commercial Spider-Man games/films. Minecraft assets via Mojang EULA.

## Next Manual Test

1. Import `SPIDER_MAN_DE_v1.0.0.mcaddon` → enable both packs → create world.
2. Verify starter kit granted. Use Web-Shooter at a wall 20m away → anchor + thread particles + actionbar “attached”. Swing, gain speed, release → momentum + slow_falling, no stuck state.
3. Sneak near vertical wall → auto-cling hint → attach, climb up 5 blocks, jump to leap, confirm no wall penetration and safe landing.

—

**Deliverable:** `dist/SPIDER_MAN_DE_v1.0.0.mcaddon` (behavior_pack + resource_pack + scripts + assets) | Source tree in repo | GitHub Actions builds on push.

