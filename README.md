# Spider-Man: Definitive Experience

A **Minecraft Bedrock Edition add-on** (behavior pack + resource pack) that turns
any survival world into a spider-powered playground: real momentum-based web
swinging, wall crawling, web gadgets, Spider-Sense, a 6-suit roster, original
enemies, progression challenges and in-game menus — all built on the official
`@minecraft/server` Script API with **zero experiments required**.

> **Status:** Implemented + statically validated + unit-tested.
> **Not runtime-verified:** this repository's CI cannot launch Minecraft
> Bedrock, so no claim of in-game testing is made anywhere. See
> [docs/VALIDATION.md](docs/VALIDATION.md) for the honest evidence matrix and
> [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) for the first-play test plan.

---

## Target platform

| | |
|---|---|
| Game | Minecraft Bedrock Edition |
| Minimum engine version | **1.26.40** (`min_engine_version: [1, 26, 40]`) |
| Developed against | stable 1.26.50 line |
| Script modules | `@minecraft/server` **2.9.0**, `@minecraft/server-ui` **2.1.0** |
| Experiments | **none enabled or required** |
| Platforms | Any Bedrock build that imports `.mcaddon` (Windows, Android, iOS, consoles via realms/import). Not applicable to Java Edition. |

Older games (< 1.26.40) will refuse the packs by manifest design rather than
half-load them.

## Installation

1. Grab the artifact **`Spider-Man-Definitive-Experience-v1.0.0.mcaddon`**
   from the latest GitHub Actions run (artifact
   `spider-man-definitive-experience-mcaddon`), or build it locally:
   `npm run verify` (needs Node ≥ 20 and Python 3 + Pillow for textures).
2. Double-click / open the `.mcaddon` with Minecraft — both packs import.
3. Create or edit a world and activate **both** packs
   ("Spider-Man: Definitive Experience [BP]" and "[RP]").
4. Join the world. First join grants the **starter kit**: Web Shooter,
   Spider Manual and the Classic suit (chestplate — equip it!).

Manual fallback: unzip the `.mcaddon`; copy `behavior_pack/` and
`resource_pack/` into your `development_behavior_packs` /
`development_resource_packs` folders (or `behavior_packs` / `resource_packs`).

## Controls

| Input | Effect |
|---|---|
| **Use (right-click / tap) holding Web Shooter** | Fire a web anchor and start swinging; use again to release |
| **Jump while swinging** | Release **with momentum launch** (the good part) |
| **Sneak while swinging** | Reel in (shorten rope) |
| **Move / sprint while swinging** | Pump the swing for speed |
| **Touch a wall mid-air (suit equipped)** | Auto wall-grip: **Jump** climb up, **Sneak** climb down, **Jump+Sneak** leap off |
| **Use holding Impact Web** | Damaging stagger shot |
| **Use holding Restraint Web** | Web-restrain a target (class-limited: elites resist) |
| **Use holding Web Pull** | Zip to a surface, or pull a light/medium entity toward you |
| **Use holding Tech Pulse** | Radial disrupt: slow + knockback around you |
| **Use holding Threat Scanner** | Extended Spider-Sense scan window with periodic reports |
| **Punch** | Melee combat (suit-scaled damage, knockback, combo window) |
| **Use holding Spider Manual** | Main menu: help, suits, gadgets, challenges, settings |
| **Use a Suit Station block** | Full station menu: suits, shop, sparring, challenges |

All abilities require **any SMX suit chestplate equipped** — the suits own the
fantasy. Settings (sense sound/shake, auto-climb, particles, HUD) are in the
manual's Settings page.

## What's inside

- **Traversal (P0):** pendulum web-swing with real velocity manipulation
  (anchor raycast → rope constraint → momentum-preserving release), web-zip,
  wall climb with safe detach, bounded post-release web-glide.
- **Gadgets (P1/P2):** impact web, restraint web, web pull, tech pulse,
  threat scanner — one registry, timestamp cooldowns mirrored to the vanilla
  cooldown bar.
- **Spider-Sense (P1):** bounded proximity scan (radius + threat cap), severity
  tiers, cooldown-gated HUD arrows/pings, hurt-ping, optional camera shake on
  1.26.50+ (feature-detected, silently skipped below).
- **Suits (P1):** 6 original suits (Improvised, Classic, Stealth, Advanced,
  Urban, Iron-armor-inspired) with distinct textures, protection/durability
  and passive modifiers; rendered when worn via chestplate attachables.
- **Combat (P1):** melee scaling, restraint classes (light/heavy/immune),
  drop-on-death cleanup.
- **Enemies (P2):** 5 original humanoids (Street Thug, Alley Gunner,
  Dock Brute, Shadow Runner, The Enforcer) + web bullet projectile; thug &
  gunner have night spawn rules, the rest are station/spawn-egg only.
- **Progression (P1):** 8 challenges with claimable rewards, records,
  lifetime stats — persisted per player.
- **Persistence (P1):** validated, versioned, per-player dynamic properties;
  corrupted saves are repaired field-by-field, never trusted blindly.
- **UI (P1):** HUD action-bar line + toasts, main menu, settings modal,
  station menu — index-routed forms with cancel/UserBusy handling.
- **Content:** Suit Station block, 10 crafting recipes, loot tables,
  spawn eggs, pt-BR + en-US texts, procedurally generated original textures.

## Repository layout

```
behavior_pack/   manifest, scripts/ (core, systems, ui), items, blocks,
                 entities, loot_tables, recipes, spawn_rules
resource_pack/   manifest, attachables, models, animations, entities,
                 render_controllers, particles, textures, texts
tools/           texture_gen.py (procedural art), validate.js, build.js
tests/           node:test unit tests for the pure modules
docs/            ARCHITECTURE, VALIDATION (evidence matrix), MANUAL_TESTING
.github/         CI: validate → test → build → .mcaddon artifact
```

## Development

```bash
npm run textures   # regenerate every PNG deterministically (Python + Pillow)
npm run validate   # 345+ static cross-reference checks, manifests, UUIDs…
npm test           # unit tests (pure physics/rules modules)
npm run build      # package dist/*.mcaddon (STORE zip, reproducible)
npm run verify     # validate + test + build
```

`dist/` and `reports/` are git-ignored; CI is the artifact producer.

## Known limitations (honest)

- **No in-game verification yet.** Every runtime behavior in this repo is
  labeled *Not runtime-verified* until a human plays it (see
  docs/MANUAL_TESTING.md).
- Suit visuals use **attachable chestplates** (vanilla players cannot gain
  custom geometry); silhouettes follow the player rig.
- Spider-Sense camera shake requires `@minecraft/server` **2.10+**
  (game 1.26.50+); on 1.26.40 it is skipped without error.
- No custom sounds (vanilla sound IDs only) and no boss fight in v1.0.0 —
  both are documented future work, not fake features.
- Enemy AI uses vanilla goal composition only (no custom navigation).

## License & credits

Code: MIT. All textures/models/text are **original, procedurally generated
or hand-authored** for this project — see [CREDITS.md](CREDITS.md).
Not affiliated with Marvel, Sony or Mojang/Microsoft.
