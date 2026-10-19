# Spider-Man: Definitive Experience

Original, unofficial Minecraft Bedrock fan add-on: web traversal, wall grip, seven selectable gadgets, six original suit overlays and repeatable patrol progression. **Version 1.0.0 — implemented and statically checked; not yet tested inside Minecraft.**

## Download / install

1. Open this repository’s **Actions → Build Bedrock Add-on → latest successful run**.
2. Download **Spider-Man-Definitive-Experience**, unzip the Actions download, and open `Spider-Man-Definitive-Experience-1.0.0.mcaddon` with Minecraft.
3. Use a **backup/test world**. Activate both **Spider-Man: Definitive Experience BP** and **RP**. The BP depends on the RP.
4. No experimental toggles are requested. Allow scripts normally; cheats are not required for normal play.
5. Join the world. Your first spawn grants four tools and attempts to equip Classic armor. Remove existing chest armor first, then use the console’s Suit Lab if needed.

**Compatibility target:** Bedrock **26.52**. The pack’s engine floor is `[1,26,50]`, matching Mojang’s contemporary sample manifest. Script modules are deliberately pinned to stable `@minecraft/server` **1.19.0** and `@minecraft/server-ui` **1.3.0**; no beta APIs. These exact declaration packages were type-checked. There is no installed game here to verify whether the specific 26.52 client accepts these legacy stable module versions, item activation, or attachable rendering. See [compatibility evidence](docs/COMPATIBILITY.md). Do not interpret the build as game certification.

## Controls

| Tool | Use / interact |
|---|---|
| Web Shooter | Aim at an eligible solid anchor within 32 blocks and use to attach. Use again to release. Look to steer. Keep the shooter selected. |
| Wall Grip | Face a wall within 1.6 blocks and use to attach. Look up/down to ascend/descend; sneak to descend. Use again or switch tools to detach. |
| Gadget Activator | Use the gadget selected in the console. Aim directly at a hostile for ranged gadgets. |
| Wrist Console | Suits, gadget selection, timed patrol, controls, particles, Spider-Sense and replacement tools. |

Use is the normal item interaction button; tools use a short non-nutritive food-use path and return the same item. The use/eat animation is a compatibility compromise, not a custom hand animation. Touch/controller/keyboard input have **not been device-tested**. Menus cancel traversal; do not open them over a dangerous fall. Changing away from a traversal tool detaches. Short slow-falling windows soften traversal exits but are not permanent fall immunity.

**Recovery:** craft one Wrist Console from **1 string + 1 iron ingot** at a crafting table, then select **Replace missing tools**. This only grants tools missing from your inventory; it never clears or overwrites ordinary inventory. Optional cheat recovery: `/give @s spider:console`.

## Gameplay

### Traversal

A 32-block view ray acquires eligible masonry, ores, wood or natural stone/dirt anchors. A conservative block allowlist intentionally excludes leaves, glass, plants, fluids, fences and many specialty blocks. The stored anchor and rope length drive a bounded spring/radial damping approximation, retaining tangential momentum; this is **not** a rigid rope constraint. A 12-dot thread refreshes every four ticks, with a per-player particle toggle. Release stops corrections instead of zeroing velocity.

Invalid anchors, swimming, riding, large location discontinuities, dimension changes, item changes, menus and lifecycle events clear traversal. Wall grip uses a short horizontal ray with look-controlled vertical force. Ordinary movement can move along a wall; there is no bespoke wall-run or automatic ledge vault.

### Gadgets

All seven functions are available from the start. Only the activator occupies a hotbar slot; changing selection does not reset cooldowns.

| Gadget | Real behavior | Cooldown |
|---|---|---|
| Impact Web | Aimed hostile hit, 5 damage, small knockback; 18-block maximum | 2.25s |
| Web Restraint | 3s slowness IV; heavy/boss types receive only 1s slowness I | 4.5s |
| Web Zip | Bounded impulse toward an eligible block, not teleportation | 2.5s |
| Tech Pulse | Slow up to eight nearby hostiles within 6 blocks for 2s | 8s |
| Threat Scanner | Report up to eight nearby hostiles within 16 blocks; count shows `8+` when saturated | 3s |
| Acrobatic Strike | 4-block aimed custom melee, three-hit rhythm, aerial damage bonus | 0.6s |
| Evade | Short backward impulse; no invulnerability | 1.75s |

Targeted attacks stop at the first visible block and do not target players or pets. Native melee is left unchanged; the custom strike is a gadget, avoiding duplicate native-plus-script damage. Web restraint is a temporary vanilla slowness effect, not a physical cocoon. It can overlap other packs’ slowness; no blanket effect clearing occurs.

Spider-Sense checks nearby monster-family entities at two-second intervals, plus observed player damage. It is **proximity feedback**, not attack/projectile prediction or guaranteed aggression detection. HUD uses the action bar only while holding add-on tools. Effects have bounded entity searches and no helper-entity spawning.

### Suits and patrols

Start a **90-second patrol** from the console: make three successful web attachments and three successful aimed gadget hits. Completing it earns **6 cumulative research**; repeatable, with no spending. The console displays progress and supports cancellation. This is a compact practice challenge, not a city campaign or anti-farming economy.

| Suit | Research threshold | Specialization |
|---|---|---|
| Classic | 0 | Standard armor/traversal |
| Homemade | 0 | Original stitched palette; standard mechanics |
| Night Weaver | 6 | Spider-Sense radius increases from 12 to 16 blocks; no stealth AI changes |
| Advanced Tech | 12 | Gadget cooldowns reduced 20% |
| Urban Spark | 18 | Zip impulse increased 15% |
| Iron Weaver | 24 | Chest protection 6 instead of 3 |

Each suit is one chest-slot wearable with an original full-body armor overlay; it does not replace your player skin. Suit selection refuses to replace vanilla chest armor. Other armor may visually overlap. Armor appearance (including slim skins and first person) needs in-game verification. Passive specialization follows the actual chest item, not the menu label. No player animation overrides are shipped.

Research, selected gadget/suit, onboarding and settings are stored in a versioned player dynamic property. Temporary traversal, cooldowns and patrols are session state and reset on death/rejoin. Respawns do not auto-duplicate tools. Missing/corrupt saved values have conservative defaults.

## Build from source

Requires Node.js 22 and Python 3.12 (Python 3.11 also tested locally).

```sh
npm ci
npm run ci
```

This type-checks, runs tests, compiles editable TypeScript into `behavior_pack/scripts`, builds a deterministic `.mcaddon`, checks asset references and archive contents, and writes SHA-256 under `dist/`. Generated scripts and artifacts are intentionally ignored by Git; Actions uploads the actual distributable. All pack JSON and original textures are committed.

To regenerate artwork/content deterministically: `python3 tools/content.py`. No Python dependencies or downloaded art are needed. UUIDs are fixed in that generator so builds preserve world references. Keep `src/` as the source of truth for scripts.

## Verification and limits

See [validation report](docs/VALIDATION.md), [manual QA](docs/MANUAL_QA.md), [credits](CREDITS.md) and [changelog](CHANGELOG.md).

**Not included:** bespoke enemies/bosses, custom stations/blocks, cinematic animations, custom audio, web projectiles, timed waypoint courses or world generation. Vanilla hostiles provide combat targets. No claims of Realms, dedicated-server, console, touch or other-pack compatibility. Do not install on an important world until the manual smoke test passes.

Spider-Man is a trademark/character associated with Marvel and its rights holders. This is unofficial fan work, not affiliated with or endorsed by them; no commercial-game assets are included.
