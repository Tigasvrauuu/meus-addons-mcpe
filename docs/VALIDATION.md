# Validation & evidence matrix

Every claim about this add-on carries one of the spec's evidence labels:

| Label | Meaning |
|---|---|
| **Implemented** | Code/content exists in the packs and is wired into the runtime. |
| **Static-validated** | `tools/validate.js` checks it (345+ assertions: JSON validity, manifest/UUID rules, cross-references, texture existence, lang parity, script syntax & import graph, pure-module boundary). |
| **Automated-tested** | Covered by `node --test tests/*.test.js` unit tests (48 assertions groups over the pure modules). |
| **In-game tested** | Verified by a human inside Minecraft. **No system currently carries this label.** |
| **Not runtime-verified** | Implemented and static/unit-checked, but never executed in a live Bedrock runtime (this CI has no Minecraft). |
| **Incomplete** | Partially delivered; scope and reason stated. |

CI (`build-addon`) runs, in order: texture generation → `validate.js` →
unit tests → `build.js` → uploads the `.mcaddon` + validation report.

## System matrix

| System | Status | Evidence |
|---|---|---|
| Manifests / pack wiring | Implemented | Static-validated (UUID format/uniqueness, BP→RP dependency, module entries, semver deps, min_engine) |
| Central player state + cleanup | Implemented | Static-validated; save schema **Automated-tested** (`save_schema.test.js`) |
| Persistence (validated, per-player, throttled) | Implemented | Automated-tested (corruption repair, version migration, round-trip); storage calls Not runtime-verified |
| Starter loadout | Implemented | Static-validated (item ids ↔ definitions); grant flow Not runtime-verified |
| Web launch / anchor / swing / release | Implemented | Physics **Automated-tested** (`swing_math.test.js`: bounded rope, momentum preservation, caps, NaN safety, release boost); runtime Not runtime-verified |
| Momentum physics (no fake particles) | Implemented | Automated-tested (velocity math); visual strand particles are real Bedrock particles |
| Wall climb + safe detach | Implemented | Automated-tested (`climb_math.test.js`: attach/leap/caps, no tunneling); runtime Not runtime-verified |
| Web-glide fall mitigation | Implemented | Automated-tested (bounded cap); runtime Not runtime-verified |
| Melee combat | Implemented | Static-validated; runtime Not runtime-verified |
| Impact / restraint webs | Implemented | Rules **Automated-tested** (`restraint_rules.test.js`: classes, immunity, pull limits); runtime Not runtime-verified |
| Spider-Sense (bounded, no spam) | Implemented | Static-validated (cooldowns/radius config); scan loop Not runtime-verified |
| Gadget selection & cooldowns | Implemented | Cooldown math **Automated-tested**; UI flow Not runtime-verified |
| Suit roster (6 suits, unique visuals) | Implemented | Static-validated (attachable ↔ item ↔ texture ↔ lang); appearance Not runtime-verified |
| Progression / challenges | Implemented | Rules **Automated-tested** (`challenge_rules.test.js`: single-active, one-time completion, idempotent rewards); runtime Not runtime-verified |
| Help / settings UI | Implemented | Static-validated (form API usage per d.ts); interaction Not runtime-verified |
| Extra gadgets (zip/pull, pulse, scanner) | Implemented | Pull classification Automated-tested; runtime Not runtime-verified |
| Custom enemies (5 + projectile) | Implemented | Static-validated (entity JSON ↔ client entity ↔ geometry/texture/loot/spawn eggs); behavior Not runtime-verified |
| Suit Station block | Implemented | Static-validated (block JSON, terrain atlas, recipe); interaction Not runtime-verified |
| Recipes (10) | Implemented | Static-validated (results/ingredients exist); crafting Not runtime-verified |
| Textures / models / particles | Implemented | Generated deterministically by `tools/texture_gen.py` (v2 HD 4× pass: 64² items, 256² skins, 512² icons, supersampled AA); existence static-validated; visual QA Not runtime-verified (pixel-reviewed only) |
| Sounds | Implemented (vanilla IDs only) | Static-validated against a verified ID list; **no custom sound files (Incomplete by design, documented)** |
| Camera shake on 1.26.50+ | Implemented (feature-guarded) | Guard verified against d.ts (2.10 API); runtime Not runtime-verified |
| Boss fight | **Not implemented (deferred)** | Deliberate scope decision: v1.0.0 ships the framework (spawner hook + challenge events) without a boss entity. Documented in CHANGELOG. |
| In-game testing | — | **0 systems** — requires a human with Minecraft; plan in MANUAL_TESTING.md |

## What the validator actually checks (tools/validate.js)

- Every `.json` in both packs parses.
- Manifest rules: format_version 2, UUID format/uniqueness, entry file
  exists, BP depends on the exact RP uuid+version, semver module deps.
- Items/blocks/entities/particles all define identifiers; items ↔ icon keys
  ↔ `item_texture.json` ↔ PNG files on disk; blocks ↔ terrain atlas ↔ PNGs.
- Lang parity: every item/block/entity has `en_US` **and** `pt_BR` names.
- Client entities ↔ geometry/animation/render-controller/texture/spawn-egg
  references all resolve; attachable identifier == suit item id; every suit
  item has an attachable (worn visibility).
- Recipes: results defined in-pack, ingredients resolvable; loot tables
  referenced by entities exist.
- Scripts: `node --check` on all 26 files; every relative import resolves;
  every `"smx:*"` literal in code maps to a defined content id (the single
  runtime id `smx:data`, the world dynamic-property key, is allowlisted and
  documented).
- Pure modules (the ones Node unit-tests import) contain no `@minecraft/*`
  import and import cleanly in plain Node.

## Commands actually executed (local, 2026-10-20)

```
python3 tools/texture_gen.py            → 38 PNGs written
node tools/validate.js                  → 65 JSON parsed, 345 checks, 0 errors
node --test tests/*.test.js             → 48 tests, 48 pass, 0 fail
node tools/build.js                     → dist/Spider-Man-Definitive-Experience-v1.0.0.mcaddon (131 entries)
python3 -m zipfile -t …(CRC check)      → OK
```
