# Spider-Man: Definitive Experience

A Spider-Man gameplay add-on for **Minecraft Bedrock Edition 26.52**. It adds a
web-shooter that swings you across the world, wall-clinging, a gadget launcher
with three gadgets, Spider-Sense proximity alerts, three suits with unlocks,
and an in-game Spider Hub menu.

- Pack version: **1.0.0**
- Target runtime: Minecraft Bedrock **26.52** (`@minecraft/server` `2.11.0-beta.1.26.52-stable`,
  `@minecraft/server-ui` `2.3.0-beta.1.26.52-stable`)
- Packs: `behavior_pack/` (Script API + items + recipes) and `resource_pack/` (icons, particle, language)
- Output: `SpiderMan-Definitive-Experience-v1.0.0.mcaddon`, built by GitHub Actions

> **Verification status:** the code passes static checks, unit tests and package
> checks (see [Verification](#verification)). **It has not been run inside Minecraft
> yet.** Treat in-game behaviour as unverified until you have run the manual test in
> [Testing it yourself](#testing-it-yourself).

## Installing

1. Download `SpiderMan-Definitive-Experience-v1.0.0.mcaddon` from the latest
   GitHub release (or from the **Actions** run artifacts).
2. Open the file. Bedrock imports both packs. Confirm the "import successful" message.
3. Create or edit a world, enable **Behavior Pack** and **Resource Pack** for the world
   (Add-Ons are listed under Behavior Packs / Resource Packs).
4. Make sure the world has the Script API enabled for the pack. If the game reports the
   script module as unsupported, check whether the Beta APIs experiment is required for the
   Script API build in use. This has not been verified (see Known limitations).

No experiments are required by the manifests as written.

## Getting the starter kit

On the first join, the game gives you:

- **Web-Shooter** (main traversal tool)
- **Gadget Launcher** (fires the selected gadget)
- **Spider Hub** (menu: suits, gadgets, settings, progress, guide)

The kit is granted once per player and saved, so respawning or relogging does not
duplicate it. If you lose an item, craft a replacement at a crafting table:

- Web-Shooter: iron ingot / redstone / iron ingot, string / cobweb / string, space / gunpowder / space
- Gadget Launcher: iron / redstone / iron, slime ball / cobweb / slime ball, iron / redstone / iron
- Spider Hub: black dye / cobweb / black dye, cobweb / book / cobweb, black dye / cobweb / black dye

## Controls

| Action | How |
|---|---|
| Launch a web | Hold the **Web-Shooter** and right-click (aim at a surface up to 30 blocks away) |
| Steer the swing | Turn the camera. The swing nudges toward where you look |
| Release a swing | Right-click the Web-Shooter again (small forward boost) or sneak |
| Cling to a wall | **Sneak + right-click** the Web-Shooter while aiming at a vertical wall within 2.6 blocks |
| Climb / descend while clinging | Look **up** to climb, **down** to descend, look level to hang |
| Let go of a wall | Jump, sneak, or right-click the Web-Shooter |
| Fire the selected gadget | Right-click the **Gadget Launcher** |
| Open the Spider Hub | Right-click the **Spider Hub**, or **sneak + right-click** the Gadget Launcher |

### Gadgets

| Gadget | Effect | Cooldown | Unlock |
|---|---|---|---|
| Impact Web | Hits the first hostile mob in your line of sight for 6 damage and knocks it back | 3 s | Starter |
| Web Restraint | Holds light mobs almost still for 3 s, slows heavy mobs, only lightly slows bosses | 6 s | Make 10 web swings |
| Tech Pulse | Hits every hostile mob within 6 blocks for 2 damage, slows and pushes them | 8 s | Cling to walls 5 times |

Pick a gadget in the Spider Hub under **Gadgets**. Only unlocked gadgets can be selected.

### Suits

Suits change only numbers (no textures or models yet). The starter suit is
always available.

| Suit | Effect | Unlock |
|---|---|---|
| Classic Red & Blue | None | Starter |
| Advanced Tech | Gadget cooldowns 25% shorter | Use gadgets 30 times |
| Urban Burst | Swing speed cap +15% | Make 20 web swings |

### Spider-Sense

Spider-Sense is **proximity detection**. It warns when hostile mobs are within 16 blocks
(priority alert within 6 blocks) and when you have just taken damage. It does not see
through walls or predict attacks. You can turn alerts off under **Spider-Sense Settings**.

## Repository layout

```
behavior_pack/
  manifest.json              Behavior pack (data + script modules)
  scripts/main.js            Entry point: subscribes to events once, runs the two loops
  scripts/core/              Config, profile/persistence, cooldowns, unlocks, swing math,
                             anchor rules, combat (shared damage/restraint), diagnostics
  scripts/systems/           Web traversal, wall-cling, gadgets, Spider-Sense, progression,
                             starter kit, item-use routing
  scripts/ui/                Spider Hub forms and HUD/action-bar helpers
  items/ recipes/            Item definitions and crafting recipes
resource_pack/
  manifest.json              Resource pack
  textures/                  Item icons (pixel art) and item atlas
  particles/                 web_thread particle used for the web line and impacts
  texts/                     en_US language strings
tests/                       Node unit tests for the pure gameplay logic
tools/
  generate_assets.py         Regenerates the original pixel-art PNGs (stdlib only)
  check_syntax.mjs           Parses every script module with Node
  validate_packs.py          Static checks: JSON, manifests, UUIDs, references, PNGs
  build_mcaddon.py           Builds dist/*.mcaddon and reads it back to verify it
.github/workflows/build.yml  CI: check, test, validate, build, upload; release on tags
```

## Building locally

Requires Node 22+ and Python 3.10+. No third-party Python packages are needed.

```bash
npm run check      # syntax-check all script modules
npm test           # unit tests (swing physics, profile repair, unlocks, cooldowns, anchors)
npm run validate   # static pack validation
npm run build      # writes dist/SpiderMan-Definitive-Experience-v1.0.0.mcaddon
```

Regenerate the art with `python3 tools/generate_assets.py`.

## Continuous integration

`.github/workflows/build.yml` runs on every push and pull request:

1. `npm run check`, then `npm test`, then `npm run validate`
2. `python3 tools/build_mcaddon.py`, which also reads the archive back
3. Uploads the `.mcaddon` as the workflow artifact `SpiderMan-Definitive-Experience-mcaddon`

Pushing a tag such as `v1.0.0` also checks that the tag matches the pack version and
publishes a GitHub release with the `.mcaddon` attached.

## Verification

| Check | Status |
|---|---|
| Every script module parses (`node --check`) | Run locally and in CI |
| Unit tests for pure logic (26 tests) | Run locally and in CI |
| Pack validation (JSON, manifests, UUIDs, references, PNGs, lang keys, imports) | Run locally and in CI |
| `.mcaddon` built and read back | Run locally and in CI |
| Import into Minecraft Bedrock 26.52 | **Not run** |
| In-game behaviour of swing, cling, gadgets, UI, Spider-Sense | **Not run** |
| Multiplayer, Realms, mobile and console behaviour | **Not tested** |

## Known limitations

These are concrete, not hypothetical:

- **Not runtime-tested.** Nothing has been run inside Minecraft. Swing feel, steering
  strength and release boost are estimates. The constants in `behavior_pack/scripts/core/config.js`
  are the place to tune them.
- **Velocity units are assumed.** The code treats `Entity.getVelocity()` and
  `applyImpulse()` as blocks per tick. Verify in game.
- **Suit visuals are not implemented.** Suits change numbers only. Custom armour, skins or
  attachables were not built, so there is no unique suit appearance yet.
- **No custom enemies, boss, challenge course, suit station or workbench.** The features listed
  in the design brief beyond the systems above are not included.
- **No melee combo system.** Combat is limited to the Impact Web, Web Restraint and Tech Pulse
  gadgets.
- **No lateral wall movement.** Wall-cling supports up, down, hanging and letting go.
- **Heavy and boss classes** come from the `heavy` and `boss` type families. No vanilla mob is
  in the `heavy` family, so only the boss family (for example the Wither) is treated differently
  out of the box.
- **Sneak-based controls may be hard on touch devices.** Wall-cling and sneak-release depend on
  sneak input. Right-click release and the Spider Hub item are the touch-friendly alternatives.
- **Restraint and pulse slowness** use the vanilla `slowness` effect. A target that already has
  Slowness from another source may be cleared when our restraint expires.
- **Dirty profile data can be lost on disconnect.** Saves happen on a 5-second debounce and at
  unlocks, equips and settings changes. A change made in the few seconds before leaving can be
  lost.
- **Script API beta status.** The `-beta` / `-stable` version strings are pinned exactly as
  released for 26.52. Whether the game needs a Beta APIs toggle for these modules has not been
  verified here.
- **Realms and dedicated servers** are not verified. Multiple players are isolated by player id
  in code, but this has not been tested with two players.

## Testing it yourself

Run this sequence on a fresh world with both packs enabled:

1. Join the world. Confirm you received the three items and the kit message.
2. Open the Spider Hub and check Suits, Gadgets, Progress and How to Play. Confirm each one returns
   with its Back button.
3. Stand on flat ground. Right-click the Web-Shooter at a stone block 10–20 blocks away. Confirm
   "Web attached", and that the thread appears.
4. Keep right-clicking after the first swing to release, or sneak. Confirm you keep speed and
   the "Web released" message appears.
5. Swing off a cliff or tall structure. Confirm the swing gains speed and does not fling you
   sideways or through walls.
6. Sneak + right-click at a wall within 2 blocks. Look up and confirm you climb. Look down, jump
   and confirm you let go.
7. Spawn a zombie 4 blocks away. Right-click the Gadget Launcher and aim at it. Confirm the
   Impact Web damage message and that a second shot shows the cooldown.
8. Check the action bar for Spider-Sense alerts when a zombie is near.

## Credits and licensing

All art, text and code in this repository are original work for this project. See
[CREDITS.md](CREDITS.md). Sounds are vanilla Minecraft sound event names. Nothing is copied from a
commercial Spider-Man game or film.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
