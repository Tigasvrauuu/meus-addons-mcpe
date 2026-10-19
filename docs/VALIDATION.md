# Validation report

## Implemented and statically validated

| System | Evidence | Runtime status |
|---|---|---|
| Web traversal | persistent anchor/rope; bounded force; release; invalidation | Not in-game tested |
| Climbing | wall ray, look-driven ascent/descent, cancellation | Not in-game tested |
| Combat | hostile-only aimed hit path, occlusion, combo, aerial bonus | Not in-game tested |
| Spider-Sense | bounded proximity query and observed damage warning | Not in-game tested |
| Gadgets | seven registry entries, behavior dispatch and independent cooldowns | Not in-game tested |
| Suits | six items, textures, attachables, geometry, thresholds and actual-equipment passives | Not in-game tested |
| UI | real suit/gadget/challenge/help/settings actions, cancel/finally cleanup | Not in-game tested |
| Progression | timed repeatable patrol, persistent research and unlock thresholds | Not in-game tested |
| Persistence | validated versioned dynamic-property JSON; corrupt-value defaults | Parser unit-tested; game storage unverified |
| Enemies/blocks | Not implemented; vanilla targets instead | Incomplete |

## Commands actually executed

- `npm install`, then `npm run ci` (TypeScript 5.7.3 check and compile).
- `node --import ./tests/register.mjs --test tests/*.test.js` through the npm script: **12 passing tests**, including 10,000 bounded force samples, persistence normalization and registry checks, plus mock integration flows for anchor failure/attach/release, two-player isolation, destroyed anchors, tool swaps, dimension transitions, wall descent, recovery idempotence, armor preservation, gadget cooldowns, challenge payout-once, menu cancellation and single event subscriptions. The Minecraft mock does not emulate game physics or actual input delivery.
- `python3 tools/content.py`: deterministic original content generation.
- `python3 tools/package.py`: ZIP `.mcaddon` with both complete pack roots and SHA-256.
- `python3 tools/validate.py`: all pack JSON parses; fixed UUID uniqueness; BP→RP dependency; script dependency/type package consistency; item/localization/texture graph; attachable/geometry/render graph; local script imports; PNG signatures/dimensions; ZIP CRC and source-byte equivalence.

The build checks are repeatable in `.github/workflows/build.yml`; every push and pull request builds and uploads the add-on. Job output is the source of truth for remote CI status.

## Scope of evidence

Static validation is **not** full Bedrock schema validation. Numerical tests cannot prove collision-constrained physics, mobile feel, item event delivery or visual correctness. No game process, world import, screenshot, client Content Log, Realms session or dedicated server was available. All those remain unverified.

## GitHub Actions delivery blocker

The implementation was committed locally on the session branch. The push was attempted using `git push origin arena/eb62ae4e-meus-addons-mcpe`, but GitHub rejected it with:

> refusing to allow a GitHub App to create or update workflow `.github/workflows/build.yml` without `workflows` permission

Therefore **no remote Actions run or remote artifact upload is claimed**. The workflow is ready locally and the local `.mcaddon` is built. The GitHub connection must be reconnected with workflow access before pushing and running CI. No permission-bypass workaround was attempted.
