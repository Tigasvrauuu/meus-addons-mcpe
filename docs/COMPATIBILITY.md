# Compatibility investigation — 2026-10-19

## Baseline

Repository at `c84c15f19524cd7697e03b7fe7e3a7f76c80c57f` contained only a 19-byte README. No packs, UUIDs, game executable, scripting configuration or prior save format existed. New fixed UUIDs were therefore necessary. No existing gameplay was removed.

## Evidence actually consulted

- npm registry exact packages `@minecraft/server@1.19.0`, `@minecraft/server-ui@1.3.0`; installed with lockfile. All gameplay TypeScript checked against those declarations, not an imagined latest API.
- Mojang official `bedrock-samples` repository, commit `46ba6ea985fb5a92d79a9419198f10dda14c199d`, via GitHub API:
  - `behavior_pack/manifest.json` uses `min_engine_version: [1,26,50]`. This is the evidence for internal engine numbering; we did not guess `[26,52,0]`.
  - `behavior_pack/items/apple.json` for numeric food saturation and the icon texture-object shape. We keep an older item format rather than copying newer use-only fields.
  - `resource_pack/attachables/iron_chestplate.json` for attachable materials/texture/render conventions.
  - `resource_pack/models/entity/player_armor.json` for player armor bone naming/pivots and UV layout. Our geometry and textures are independently generated, not copied files.
- Example reference: https://github.com/Mojang/bedrock-samples/tree/46ba6ea985fb5a92d79a9419198f10dda14c199d

## API decisions

Stable 1.x modules were chosen conservatively rather than adopting a newer API solely because npm lists it. `applyImpulse`, velocity access, block/entity view rays, bounded dimension queries, dynamic properties, action-bar display, after-events and ActionFormData all exist in these pinned declarations. First compilation rejected `Block.isSolid`; implementation now uses the stable air/liquid accessors plus an explicit anchor-type allowlist. No custom components, preview input, camera overrides or experiments are requested.

Item content uses the established food use / same-item conversion path to permit use actions from ordinary custom items. This content route and the custom full-body chest attachable **must be verified in the actual game**, because TypeScript does not validate Bedrock content schemas or client behavior.

## Unresolved target-specific evidence

The sandbox cannot launch Minecraft. Microsoft documentation/changelog hosts are outside this environment’s outbound-host allowlist. We could not consult the supplied exact 26.52 hotfix page, inspect an installed client, or run a script-module compatibility probe. The contemporary official manifest is supporting evidence, **not proof** that 26.52 supports the two legacy module versions or every content component in this pack. No complete engine-schema validation was performed.

If import reports unsupported module versions, capture the exact client version and Content Log first; then update manifest dependencies and npm type packages together and repeat all tests. Do not turn on Beta APIs blindly. If item use does not fire, inspect the food/use component errors before changing traversal logic.
