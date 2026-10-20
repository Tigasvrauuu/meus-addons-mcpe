# Credits

## Authorship
- **Design, code, content and all art** in this repository are original work
  created for this project. Every texture (items, suits, enemies, blocks,
  particles, pack icons) is generated procedurally by `tools/texture_gen.py`
  (Pillow) from original color/geometry decisions — no ripped, scraped or
  commercial assets are included, and no copyrighted artwork was reproduced.
- Suit/enemy names and silhouettes are original interpretations of generic
  archetypes (homemade suit, stealth suit, armored suit, street criminals…),
  not reproductions of any licensed costume artwork.

## Not affiliated
This project is **not affiliated with, endorsed by, or sponsored by** Marvel,
Sony Pictures, Mojang Studios or Microsoft. Minecraft is a trademark of Mojang
Synergies AB. Character-concept inspiration is acknowledged purely as
fan-made homage; all shipped assets are original.

## Third-party technology (tooling only, not shipped content)
- [Pillow](https://python-pillow.org/) (HPND-style license) — used at
  build time to rasterize the procedural textures.
- [Node.js](https://nodejs.org/) — validation, tests and packaging tooling.
- [bedrock-samples](https://github.com/Mojang/bedrock-samples) (MIT) and the
  official `@minecraft/server*` type definitions — consulted **as format/API
  reference only**; no sample content is copied into the packs.
- GitHub Actions — CI execution.

## Sound
All in-game sounds are **vanilla Minecraft sound events** referenced by ID
(e.g. `random.bow`, `block.bowhit`, `mob.spider.say`, `armor.equip_leather`).
No audio files are bundled.

## Special thanks
- The Bedrock creator community, whose public documentation of JSON formats
  and Script API behavior made cross-version correctness achievable.
