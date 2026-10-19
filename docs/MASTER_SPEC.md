# SPIDER-MAN: DEFINITIVE EXPERIENCE
## One-Shot Master Implementation Specification for Minecraft Bedrock Edition 26.52

**Document type:** Autonomous implementation mandate, technical specification, game-design brief, asset bible, QA checklist, and delivery contract  
**Target platform:** Minecraft Bedrock Edition **26.52** (the target may be informally referred to in project notes as “1.26.52”; verify the exact installed runtime and pack/API versions rather than trusting a label)  
**Distribution target:** Importable `.mcaddon` package, plus editable project source  
**Execution model:** One agent run, using this file as the complete implementation prompt  
**Primary objective:** Deliver the most cohesive, polished, technically reliable Spider-Man gameplay add-on that can realistically be implemented in this run and validated in the available environment.

---

# 0. EXECUTION CONTRACT — READ FIRST

You are not being asked to brainstorm, write a plan, or describe a hypothetical add-on. You are being instructed to **inspect the available project, implement it, integrate the systems, validate the files, fix defects, package the result, and report exactly what was delivered**.

This Markdown document is the complete one-shot brief. Do not ask the user to approve individual features, choose routine implementation details, or repeat information already present in the project context. Use professional judgment, make decisions, and proceed. If the user has supplied an existing project, preserve and improve it; do not replace it with an unrelated blank scaffold.

## 0.1 Required workflow

Execute these stages in order during this run:

1. **Inspect:** inventory the available repository/files, packs, manifest versions, scripts, assets, and existing features.
2. **Determine compatibility:** verify actual Minecraft Bedrock 26.52 capabilities and the APIs available to the project. The installed game version, documentation, and the existing pack configuration are authoritative; do not guess API availability.
3. **Design internally:** settle the architecture and feature priorities without stopping to request approval.
4. **Implement:** modify or create the real source files and assets.
5. **Integrate:** connect the systems through shared interfaces and explicit state management.
6. **Validate:** run available syntax, JSON, manifest, reference, packaging, and automated checks; inspect and correct failures.
7. **Package:** produce an importable `.mcaddon` where the project structure supports it, along with source files.
8. **Report:** distinguish completed, statically validated, runtime tested, manually unverified, and incomplete features.

Do not stop after stages 1–3. Do not produce a plan as a substitute for implementation. Do not claim in-game validation unless an actual in-game test took place. Do not fabricate screenshots, console output, test results, files, or links.

## 0.2 One-shot does not mean careless

The goal is to complete the broadest possible integrated feature set in one execution, not to maximize a checklist by creating empty items, decorative-only menus, placeholder entities, or fake mechanics. Build the core loop first, then add breadth. A smaller number of genuinely working, integrated systems is better than a large catalogue of broken features.

If a feature is blocked by the runtime, unavailable tooling, or an unsupported API, investigate an alternative and keep working. If it still cannot be implemented, document the exact limitation and continue with the remaining work. Never let an optional effect break the main traversal system.

## 0.3 Non-negotiable rules

- Use the **actual source tree and files available**; preserve useful existing work.
- Use only APIs and content formats verified for the target runtime.
- Never invent method names, events, components, manifest capabilities, or UI support.
- Avoid enabling experiments unless a required feature genuinely needs them and the requirement is documented.
- No fake implementation: a visual item is not a working ability; a menu is not a feature if its buttons do nothing.
- Do not silently swallow every exception. Report actionable errors without flooding the log.
- Do not use a command-only workaround as a substitute for the entire gameplay architecture.
- Do not replace vanilla blocks or recipes unnecessarily.
- Do not import copyrighted asset files from commercial games or unlicensed sources. Create original assets or use assets with compatible licenses.
- Do not overpromise compatibility with Realms, dedicated servers, consoles, mobile devices, or third-party packs unless verified.
- Produce real artifacts. The final report must link to or identify actual files created in the current workspace.

---

# 1. PRODUCT VISION

## 1.1 Product definition

Create a high-quality Spider-Man add-on that makes the player feel like Spider-Man inside Minecraft rather than simply wearing a superhero skin. The fantasy must emerge from responsive traversal, purposeful web mechanics, acrobatic combat, readable threat feedback, useful gadgets, distinct suits, and a coherent in-game interface.

The add-on should feel like a compact superhero action game that naturally inhabits a Minecraft world. It must respect the sandbox, block-based environment, survival rules, and visual readability of Minecraft while introducing a clear custom identity.

## 1.2 Pillars

**Pillar A — Movement is the signature.** Web-swinging and wall traversal are the primary differentiators. Their responsiveness, clarity, and stability take precedence over optional content.

**Pillar B — Abilities form a system.** Suits, gadgets, combat, Spider-Sense, UI, and progression must share consistent state and rules. Avoid isolated features that do not cooperate.

**Pillar C — Strong visual identity.** Use a vanilla-compatible visual foundation with purpose-built suits, gadget icons, web effects, particles, custom interface elements, and carefully designed audio.

**Pillar D — Practical compatibility.** Favor robust behavior on the targeted Bedrock release. Design around documented capabilities rather than assuming Java Edition modding techniques are available.

**Pillar E — Real deliverables.** The result must be source-controlled or at least cleanly organized, inspectable, packaged, and accompanied by an honest verification report.

## 1.3 Target experience

A player should be able to enter a world, obtain or equip a starter suit and web-shooters, launch a web toward a plausible anchor, build momentum while swinging, release into a jump or glide-like transition, climb a wall, detect nearby threats, engage enemies using melee and webs, select gadgets, and unlock additional suits or challenges. These actions should use consistent controls and provide meaningful feedback.

The core loop should be enjoyable without requiring a prebuilt city, an elaborate questline, or dozens of rare ingredients. A player in an ordinary Minecraft world should be able to test the main mechanics immediately.

---

# 2. CREATIVE DIRECTION AND IP HANDLING

## 2.1 Visual direction: vanilla-plus

Adopt a **vanilla-plus hybrid visual style**:

- Keep the natural Minecraft world and its existing blocks visually intact.
- Make custom suits, gadgets, enemies, stations, menus, icons, and signature effects clearly recognizable.
- Use pixel-art or block-compatible textures that fit the chosen rendering path.
- Use more detail where it improves readability, but avoid photorealistic assets that clash with the world.
- Keep important colors and silhouettes readable in both bright daylight and dark environments.

The result should be polished and cohesive, not a total replacement texture pack.

## 2.2 Spider-Man identity

Use Spider-Man and comic-book visual language as the product theme: web geometry, spider motifs, red/blue/black/white accents, expressive suit silhouettes, high-energy motion feedback, and compact technology-inspired UI. Create original assets. Do not extract textures, models, sounds, logos, or other files from commercial Spider-Man games, films, or unlicensed packs.

Suit archetypes may evoke familiar Spider-Man eras or visual ideas, but each asset must be made for this project or obtained under an appropriate license. Where names reference a specific character interpretation, keep the content fan-made and avoid claiming official affiliation.

---

# 3. PROJECT AUDIT AND BASELINE

Before editing, establish what already exists.

## 3.1 Inventory

Inspect and list, as applicable:

- Repository root and directory tree.
- Behavior Pack(s) and Resource Pack(s).
- `manifest.json` files, UUIDs, module types, versions, dependencies, and minimum engine version.
- JavaScript or TypeScript sources and build configuration.
- Imported script modules and declared API dependencies.
- Entity definitions, component groups, events, animations, animation controllers, render controllers, geometries, and spawn rules.
- Custom item and block definitions, recipes, loot tables, trade tables, functions, and feature definitions.
- Particles, sounds, textures, UI JSON, localization, and icons.
- Existing test scripts, build tasks, validation tools, and packaging scripts.
- Existing documentation and known issues.

## 3.2 Baseline record

Create an internal baseline before changes. Identify what works, what is incomplete, and what is broken. Preserve identifiers and save data when possible. Do not casually regenerate UUIDs for packs that are already installed by the user, since this can affect world references and update behavior. Create new UUIDs only for genuinely new packs or modules, using valid values and avoiding collisions.

## 3.3 Compatibility investigation

Treat Minecraft Bedrock **26.52** as the target. Some project notes may refer to “1.26.52”; confirm the exact game build and use terminology consistent with the installed environment.

Consult the official Creator documentation and inspect the project's current `manifest.json` before choosing API versions. In particular, verify:

- `@minecraft/server` version and stable/preview status.
- `@minecraft/server-ui` version if forms are used.
- Supported entity, item, block, event, movement, camera, input, dynamic-property, and UI capabilities.
- Whether any feature requires experiments or a preview API.
- Whether the pack currently uses JavaScript or TypeScript and whether a transpilation step is configured.

Do not automatically upgrade every API dependency to the newest documented version. Use a dependency version supported by the target runtime and compatible with the project. If a current docs page describes a newer release, verify that the specific method exists in the target API version before using it.

Useful official references to consult during implementation:

- Minecraft Creator documentation: https://learn.microsoft.com/en-us/minecraft/creator/
- Script API reference: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/
- `@minecraft/server` reference: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/minecraft-server
- `@minecraft/server-ui` reference: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/minecraft-server-ui
- Scripting v2 overview (only relevant if considering API v2): https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/v2-overview
- Bedrock 26.52 hotfix notes: https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog

The official references are a starting point, not a substitute for runtime verification.

---

# 4. TECHNICAL ARCHITECTURE

## 4.1 Recommended separation of responsibilities

Preserve the project's existing good architecture. Where no architecture exists, introduce modular files with clear responsibilities. Suggested logical modules include:

```text
project/
├── behavior_pack/
│   ├── manifest.json
│   ├── scripts/
│   │   ├── main.js
│   │   ├── core/
│   │   │   ├── config.js
│   │   │   ├── constants.js
│   │   │   ├── player_state.js
│   │   │   ├── cooldowns.js
│   │   │   ├── cleanup.js
│   │   │   └── diagnostics.js
│   │   ├── systems/
│   │   │   ├── web_traversal.js
│   │   │   ├── wall_climbing.js
│   │   │   ├── movement.js
│   │   │   ├── spider_sense.js
│   │   │   ├── combat.js
│   │   │   ├── gadgets.js
│   │   │   ├── suits.js
│   │   │   ├── progression.js
│   │   │   ├── persistence.js
│   │   │   └── interaction.js
│   │   └── ui/
│   │       ├── menus.js
│   │       └── hud_state.js
│   ├── entities/
│   ├── items/
│   ├── blocks/
│   ├── recipes/
│   └── loot_tables/
├── resource_pack/
│   ├── manifest.json
│   ├── textures/
│   ├── models/entity/
│   ├── animations/
│   ├── animation_controllers/
│   ├── render_controllers/
│   ├── particles/
│   ├── sounds/
│   ├── texts/
│   └── ui/ (only where supported and necessary)
├── tools/ (validation/build scripts when useful)
├── tests/ (static/unit checks if feasible)
├── README.md
└── CHANGELOG.md
```

This is a logical guide, not a demand to restructure a working project or to create empty folders. Follow the established pack conventions. Files and paths must match actual Bedrock schemas.

## 4.2 Core systems and interfaces

Create or adapt a central player-state manager that coordinates ability states. Avoid each feature inventing its own unrelated flags.

Represent states such as:

- `idle`
- `web_aiming` (only if supported by the input design)
- `swinging`
- `climbing`
- `air_mobility`
- `attacking`
- `dodging`
- `menu_open` (only if the UI event can be tracked reliably)
- `dead_or_unavailable`

A player may possess independent modifiers—equipped suit, selected gadget, cooldowns, progression—alongside one or more compatible movement/combat states. Do not force every attribute into one oversized mutually exclusive enum if that would prevent normal combinations. Instead, define explicit constraints and priorities.

Suggested conceptual services:

- `PlayerStateService`: validated per-player state and transitions.
- `WebTraversalService`: target search, anchor validation, swing dynamics, release behavior, and cleanup.
- `MovementService`: climb, jump boost, air correction, and movement modifiers.
- `CombatService`: damage rules, attack windows, target validation, and crowd-control effects.
- `GadgetService`: selection, activation, cooldown, charge, and effect dispatch.
- `SuitService`: unlocks, equip/unequip, visual choice, passive modifiers.
- `SpiderSenseService`: threat filtering, prioritization, notifications, and cooldown.
- `ProgressionService`: challenge state and rewards.
- `PersistenceService`: validated saved data.
- `UIService`: forms, notifications, menu routing, and player-facing state.
- `LifecycleService`: initialization, death, disconnect, dimension changes, and timed cleanup.

Use these names only if they fit the project. Equivalent names are acceptable. The important point is clear ownership of responsibilities.

## 4.3 Data-driven configuration

Place tunable values in a configuration module rather than scattering constants across scripts. Examples:

- Maximum web range.
- Preferred anchor validation rules.
- Swing stiffness/damping or equivalent tuning values.
- Speed caps and safety thresholds.
- Climb refresh intervals.
- Gadget cooldowns.
- Damage and crowd-control duration.
- Spider-Sense radius and notification interval.
- Maximum number of active temporary entities/effects.
- Particle density.
- Challenge completion conditions.

Keep server-authoritative gameplay values separate from cosmetic preferences. Validate all configured values and provide safe fallbacks.

## 4.4 API and event rules

- Subscribe to events once during initialization, not repeatedly during per-player updates.
- Keep callbacks short. Defer nontrivial mutations when required by restricted execution contexts or event semantics.
- Validate an entity/player before reading components or changing state; stale entities can become invalid.
- Avoid relying on object references surviving indefinitely across ticks or dimensions.
- Use stable IDs and coordinates when a durable reference is needed; re-resolve safely.
- Avoid running world-wide entity searches every tick for every player.
- Use raycasts, block queries, or nearby-entity queries only where supported and with reasonable bounds.
- Use documented dimension and coordinate rules. Be careful around unloaded chunks, invalid locations, and cross-dimension transitions.
- Do not mutate world state from an event context that disallows it.
- Handle errors at feature boundaries, not through a blanket catch that hides defects.

---

# 5. CENTRAL GAMEPLAY REQUIREMENTS

## 5.1 Player onboarding

The first-use experience should be obvious without requiring a long tutorial. Provide a brief form or guide accessible through a dedicated starter item, station, or interaction.

The starting flow should explain:

- How to equip the starter suit.
- How to launch a web.
- How to swing and release.
- How to climb.
- How to access gadgets and Spider-Sense.
- Where to find the suit/gadget menu.

Do not force a long unskippable tutorial. Prefer a concise guide and optional practice challenge.

## 5.2 Starter loadout

The player should be able to access the essential systems without an unreasonable grind. Use a clear approach: starter grant, accessible crafting recipes, or a suit station. If the project already has a progression economy, integrate it without making the core traversal inaccessible.

Minimum playable loadout:

- Classic starter suit.
- Web-shooter or equivalent activation item.
- One web-control gadget.
- Access to suit/gadget selection.
- Basic Spider-Sense.
- Access to the settings/help menu.

Use one clearly defined acquisition strategy. Prevent repeated respawns or relogs from duplicating unique rewards without intent.

---

# 6. WEB-SHOOTER AND WEB TRAVERSAL SYSTEM

This is the signature system. Spend the largest proportion of implementation and test effort here.

## 6.1 Design goals

Web traversal should feel responsive, readable, and controllable. It must not merely spawn a white particle, teleport the player, or apply unlimited upward velocity. The player should understand whether a shot succeeded, what it attached to, how to build momentum, and how to release safely.

The implementation may approximate physical swinging using the capabilities of the target API. A robust approximation is preferable to a mathematically elaborate system that is unstable under Minecraft's collision and tick model.

## 6.2 Web-shooting flow

For each launch attempt:

1. Confirm the player is valid and the web-shooter is available.
2. Confirm the player is not in a conflicting state.
3. Determine the aim direction using the best supported camera/look or player-rotation information. Do not assume arbitrary input interception is available.
4. Raycast or otherwise search for an eligible block/surface in the intended direction, within a configurable range.
5. Apply a deterministic rule for valid anchors. Prefer solid, reachable, non-fluid surfaces; tune the rule to avoid anchoring to irrelevant or hazardous targets.
6. If no anchor is found, provide a brief failure response and leave the player state unchanged.
7. If an anchor is found, store validated anchor coordinates, current distance, and start state. Avoid storing a stale block object as the only source of truth.
8. Spawn or render the thread effect if supported by the selected approach.
9. Start or update the swing controller.

A successful web should have a discernible point of contact. If the rendering system cannot draw a perfectly continuous dynamic line, use the best stable approximation available—particles, a managed temporary visual entity, or another verified technique. Do not sacrifice the physics or leak thousands of entities for a perfectly continuous visual.

## 6.3 Anchor validation

A valid anchor should be:

- Within the allowed range.
- In a loaded/accessible region where validation is possible.
- A solid or otherwise intentionally supported surface.
- Not in a location that would cause immediate invalid motion.
- In the same dimension as the player, unless cross-dimension traversal is explicitly supported (normally it should not be).

Revalidate the anchor periodically or upon meaningful events. If the anchor disappears, becomes unavailable, or becomes invalid, end or transition the swing gracefully.

## 6.4 Swing movement model

Implement a controlled movement approximation based on a stored anchor and radius/rope length. Suitable approaches include:

- Constraining player-to-anchor distance while preserving tangential velocity.
- Applying limited directional acceleration while respecting a swing radius.
- Using a damped pendulum approximation with velocity clamping.
- A hybrid method that preserves momentum but corrects excessive stretching.

Select the approach based on what the documented target API can actually control.

Required behavior:

- The player gains momentum naturally during the arc.
- Gravity and existing motion contribute in a believable way where supported.
- Forward input influences travel without overriding all physics.
- The player can steer, release, and reattach.
- Speed and acceleration are capped.
- Horizontal and vertical movement remain controllable.
- The system remains stable when the player hits or passes close to terrain.
- Collisions do not create infinite acceleration or send the player to arbitrary coordinates.
- Loss of a valid anchor triggers a safe exit.

Do not forcibly reset the player's velocity to a fixed number every tick. Preserve useful momentum and apply bounded corrections. Avoid a hard position teleport loop that tunnels through walls. If true collision-constrained physics is not available, use conservative speed limits and frequent validity checks.

## 6.5 Swing controls

Support a discoverable control scheme that works within Bedrock's real input model. Since Add-Ons cannot necessarily bind arbitrary keys or gestures like a standalone game, choose compatible activation methods after inspecting the API and input constraints.

Baseline interaction model:

- Use the web-shooter item or supported interaction to fire/attach.
- Use a clear second action or repeat interaction to release, where the platform permits it.
- Allow the player to trigger a new attachment after release.
- Provide alternate menu/item interactions if one control cannot be captured on every platform.

Do not promise identical keyboard, controller, and touch behavior unless verified. Ensure a mobile player can activate the core functions without needing inaccessible keyboard-only actions.

## 6.6 Momentum and release

When releasing a web:

- Stop applying anchor corrections.
- Remove only the movement modifiers owned by the web system.
- Preserve a bounded portion of current velocity.
- Permit transitions into falling, jumping, or another swing.
- Clear the thread visual and anchor data.
- Return the player to a valid normal state.

Offer a short, configurable release grace period if needed to avoid accidental immediate reattachment or state oscillation.

## 6.7 Web traversal edge cases

Handle:

- Player death.
- Player disconnection.
- Dimension change.
- Teleportation caused by another pack or command.
- Anchor destruction.
- Anchor chunk unloading.
- Player entering water.
- Player entering a vehicle, if supported.
- Player opening a menu.
- Missing/removed web-shooter.
- Repeated activation in quick succession.
- Server lag or delayed updates.
- Collision with walls, ceilings, and terrain.
- Another system applying knockback or velocity.

All of these must lead to a defined, safe result, not a permanently stuck state.

## 6.8 Optional web techniques

Only after basic swinging is stable, add:

- Rapid re-attachment to a new anchor.
- Web zip toward an anchor.
- Short web pull toward a valid entity.
- Web wall-run or launch if supported.
- Aerial web shot.
- Momentum-assisted leap after release.

Each technique must have a separate activation rule and clearly documented interaction with the core swing state. Do not add optional techniques that make the main controls confusing.

---

# 7. WALL CLIMBING AND MOVEMENT

## 7.1 Climbing behavior

Implement a wall-climb state that lets the player attach to suitable vertical surfaces, move up/down, traverse laterally when feasible, and detach safely.

A robust climbing implementation should:

1. Check whether climbing is active or can be initiated.
2. Determine whether the player is close enough to a suitable surface.
3. Validate the face and nearby block space.
4. Avoid initiating inside a solid block or in an invalid location.
5. Apply controlled movement toward/along the surface using verified movement APIs.
6. Recheck the surface and player state at a moderate cadence.
7. Exit on explicit release, loss of the surface, death, dimension change, or conflicting ability.
8. Restore movement properties or modifiers only if they were applied by this system.

Do not permanently overwrite unrelated player movement attributes. Track whether the climbing system actually changed a modifier so that cleanup does not undo another pack's changes.

## 7.2 Climbing requirements

- Upward and downward motion.
- Lateral movement if supported.
- Controlled detachment.
- Jump away from the surface if supported.
- No infinite wall attachment after death or menu transitions.
- No repeated teleport into the wall.
- No climbing through a block's solid volume.
- Clear visual/audio feedback when attaching or detaching.

## 7.3 Jump and air mobility

Where stable and supported, add:

- Enhanced jump.
- Short air boost.
- Controlled air steering.
- A safe landing/fall-damage mitigation effect.
- A transition from swing release to air mobility.

Keep these modifiers bounded and distinguish them from the normal jump. Make fall-damage mitigation a defined, balanced mechanic rather than accidental immunity.

## 7.4 Movement priority

Specify conflict rules. For example:

- Dead/unavailable state cancels all active traversal.
- A confirmed teleport or dimension change resets traversal state.
- Swing and wall-climb should not both apply movement corrections simultaneously.
- Menus should not leave a movement loop stuck; if opening a form is possible during a traversal, decide whether to pause, cancel, or continue in a safe way.
- Knockback may suspend or terminate a controlled movement state when continuing it would be unstable.

Use explicit transitions, not scattered boolean toggles.

---

# 8. SPIDER-SENSE

## 8.1 Purpose

Spider-Sense warns the player about credible danger and reinforces the character fantasy. It must not emit random notifications or claim to foresee events the script cannot inspect.

## 8.2 Threat types

Where the API and event model allow, detect or infer:

- Hostile entities approaching within a configured radius.
- Recent damage to the player.
- Observable projectiles or nearby entities that present immediate danger.
- A target preparing a script-controlled attack, if the add-on's own enemy AI exposes this state.
- Active combat situations.

Prioritize detected threats based on distance, hostile classification, recent damage, direction, and danger level. Separate direct facts from heuristics: if the system only checks proximity, describe it as proximity detection rather than guaranteed prediction.

## 8.3 Feedback

Potential feedback:

- A brief HUD indicator or icon.
- A subtle visual pulse.
- A short original sound cue.
- A directional hint only if direction can be calculated reliably.
- Stronger feedback for higher-priority threats.

Do not continuously shake the camera or play an alarm while any hostile entity exists. Use thresholds, cooldowns, and suppression rules. The effect must remain readable during combat and must not obstruct most of the screen.

## 8.4 Performance

- Query only within a bounded radius.
- Avoid scanning all entities globally each tick.
- Use a modest update interval.
- Reuse known event data where possible.
- Skip or reduce work when Spider-Sense is unavailable, disabled, or the player is invalid.

---

# 9. COMBAT SYSTEM

## 9.1 Combat goals

Combat should reward mobility and positioning rather than only repeated clicking. It should be energetic, easy to understand, balanced for survival play, and compatible with standard Bedrock combat where reasonable.

## 9.2 Core attacks

Implement a practical baseline:

1. **Basic melee strike:** a short-range attack with defined damage and cooldown.
2. **Combo follow-up:** optional additional attacks or a multiplier when activations occur within a valid window.
3. **Air strike:** an aerial attack or downward hit if the API can identify the state reliably.
4. **Web impact:** a ranged control/impact ability.
5. **Dodge or evade:** a bounded movement effect or short defensive window if reliably supported.
6. **Finisher-like action:** optional contextual strong hit against a sufficiently weakened target; do not implement cinematic animation dependencies that the platform cannot support.

## 9.3 Single source of truth for damage

All custom attacks should route through shared combat logic where feasible. Use consistent rules for:

- Target validity.
- Range and line of sight.
- Damage amount/type.
- Cooldown and attack window.
- Knockback or launch strength.
- Temporary stun/webbing duration.
- Friendly fire and self-target protection.
- Duplicate event prevention.
- Target immunity rules.

Avoid applying damage both through a native projectile and a script handler unless the design explicitly accounts for the two paths. Validate that target entities still exist immediately before applying effects.

## 9.4 Combos and rhythm

If implemented, combos should use time windows rather than brittle tick counts tied to assumed performance. Combo reset must be predictable. Provide hit feedback and ensure the combo does not keep escalating indefinitely.

## 9.5 Enemy control

Webbing should be temporary and have explicit limits. Consider separate behavior for light, heavy, and boss targets. Heavy enemies may be slowed rather than fully immobilized; bosses should not be permanently trivialized by repeated webbing.

Clear all status tags, effects, scheduled tasks, or helper entities when the control duration expires or the target becomes invalid.

## 9.6 Combat readability

Feedback should tell the player when an attack connects, misses, is blocked, or fails because the target is out of range. Use modest damage indicators, particles, sound, or animation triggers according to the resource capability. Do not spam chat messages for ordinary hits.

---

# 10. GADGET SYSTEM

Implement a small, differentiated set of gadgets with real, distinct gameplay behavior. Each gadget needs a registry/configuration entry, name, description, icon, unlock requirement if any, activation path, cooldown or cost when relevant, effect, validation, and cleanup.

## 10.1 Gadget A — Web Shooter

The primary traversal and web interaction tool. It must be available from the start. It handles valid anchoring, swing initiation/release, and basic web feedback. Do not duplicate the whole traversal implementation inside the item handler; call the central traversal service.

## 10.2 Gadget B — Impact Web

Fires a short-range or medium-range web projectile/effect. It may cause modest damage, interrupt an enemy, or apply brief stagger. It must not behave identically to the restraint web. Use a clear cooldown and projectile/target validation.

## 10.3 Gadget C — Web Restraint

Applies temporary webbing, slowness, or immobilization depending on the target class and supported capabilities. The restraint must expire, respect boss/heavy target limits, and clean itself up when the target disappears.

## 10.4 Gadget D — Web Pull / Zip

Pulls the player toward a valid anchor or, for eligible targets, pulls the target closer. The direction and force must be bounded. A failed pull must not teleport the player or target to arbitrary coordinates.

## 10.5 Gadget E — Tech Pulse

A limited area pulse that briefly disrupts, slows, or reveals nearby eligible threats. It should have a clear radius and cooldown. Do not turn it into an enormous destructive explosion or cause excessive entity scans.

## 10.6 Gadget F — Threat Scanner

An optional, more deliberate mode of Spider-Sense. It may highlight nearby eligible entities or report a threat count for a short interval. Avoid pretending it can reveal entities outside supported query ranges or through walls unless the design and API truly support that behavior.

## 10.7 Gadget selection

Provide a simple, consistent selection system. Do not fill the entire hotbar with redundant items unless the existing project already intentionally uses hotbar slots as ability bindings. If using hotbar slots as virtual ability inputs, document the mapping, validate unlocked abilities, and ensure ordinary items do not accidentally trigger abilities.

The selected gadget must be reflected in the UI and state manager. Repeated selection must not duplicate cooldown timers or spawn new listener subscriptions.

---

# 11. SUITS, UNLOCKS, AND PASSIVE SPECIALIZATIONS

## 11.1 Initial suit roster

Implement these design archetypes if assets and scope allow. Create original project assets; names may be adjusted to avoid implying official licensing.

| Suit archetype | Visual identity | Gameplay emphasis | Balance constraint |
|---|---|---|---|
| Classic Red/Blue | Red and blue panels, black web pattern, prominent spider emblem | Balanced starter suit | No restrictive unlock requirement |
| Stealth Black | Dark palette with a high-contrast spider motif | Stealth or reduced threat attention, if supported | Must not create invisibility exploits by default |
| Advanced Tech | Modern red/blue/white accents and clean panel design | Gadget efficiency or cooldown specialization | No unlimited gadget use |
| Urban/Miles-inspired | Dark base with red accents and expressive graphic lines | Mobility or short burst utility | Do not stack into extreme speed |
| Iron-Armor-inspired | Segmented metallic-looking panels and distinct emblem | Defensive utility | Defensive effect must be modest |
| Improvised Starter | Simple homemade-looking design with minimal details | Starter identity, no advanced bonuses | Fully usable for core mechanics |

A larger roster is welcome only after the initial suit pipeline is sound. Do not sacrifice texture quality or core gameplay to add many nearly identical suits.

## 11.2 Suit data model

Represent suits with stable IDs and explicit properties such as:

- `id`
- display name and description
- texture/model references
- icon reference
- unlock condition
- passive modifiers
- enabled abilities or special variant flags
- rarity/category if useful

Use whatever structure fits the existing system. Validate all IDs and asset references. Avoid encoding gameplay identity only in display names.

## 11.3 Equip/unequip lifecycle

When a suit is equipped:

1. Validate that it is unlocked and exists.
2. Apply the appearance using a supported approach.
3. Remove or replace modifiers owned by the previous suit.
4. Set the new suit ID in the central state.
5. Update the UI.
6. Persist at an appropriate time.

When unequipped or replaced, restore only the properties that the add-on owns. Never blindly reset all player properties to defaults, which can conflict with other add-ons.

## 11.4 Unlock and economy rules

Use accessible materials, achievements, challenges, or a suit station. The starter suit and traversal must not be locked behind an unreasonable grind. Unlock descriptions must explain the actual requirement. Grant each unique reward once unless repeatability is explicitly intended.

---

# 12. ENEMIES AND ENCOUNTERS

## 12.1 Enemy roster

Build a small, functional roster before scaling variety:

- **Street Thug:** standard close-range hostile, low-to-medium durability.
- **Ranged Thug:** maintains distance and uses a supported ranged attack.
- **Brute:** slow, durable, resistant to full web immobilization.
- **Agile Opponent:** closes distance quickly and punishes stationary play.
- **Elite Enemy:** combines a readable set of attacks and has a clear opening for counterplay.
- **Optional Boss:** one distinct encounter with a small, stable move set.

Use custom entities only where the behavior, model, or attributes add value. Vanilla entities may be used as temporary development targets, but do not present a reskinned generic mob as a bespoke boss.

## 12.2 Behavior requirements

Each custom enemy must have:

- Correct identifier and valid entity JSON.
- Health, damage, movement, and target behavior appropriate to its role.
- Sensible target acquisition.
- Clear attacks and attack intervals.
- Reactions to damage and crowd control.
- Death/removal behavior.
- Loot or rewards only if relevant.
- Compatibility rules for webs, pull effects, and boss resistance.
- Appropriate model, textures, animation/render setup if custom visuals are included.

Use native behavior components where they are sufficient. Script custom AI only when necessary. Avoid a per-tick global AI simulation when vanilla behavior can achieve the intended result.

## 12.3 Boss requirements

Only implement a boss after the core combat is stable. A viable first boss needs:

- A distinct silhouette or presentation.
- At least two readable attack patterns if the environment supports them.
- A meaningful cooldown/opening after major attacks.
- Resistance to permanent immobilization.
- Consistent damage and death handling.
- An encounter that can be triggered without needing an entire custom city.
- Reward and cleanup behavior.

Do not claim a boss is complete if it only has inflated health and damage.

## 12.4 Spawning and progression

Avoid flooding existing survival worlds with new hostile entities. Use controlled spawn rules, crafted/summoned encounters, configured challenge points, or another intentional trigger. Ensure custom entities do not spawn endlessly due to duplicate rules.

---

# 13. MISSIONS, CHALLENGES, AND REWARDS

Build a reusable challenge framework before building many challenges. A challenge should define a stable ID, display name, description, start condition, objective, progress tracking, completion condition, reward, and cleanup behavior.

## 13.1 Challenge types

Prioritize:

- **Traversal course:** reach checkpoints in sequence while using swinging or climbing.
- **Time trial:** finish a route within a target time, using a safe timer lifecycle.
- **Combat encounter:** defeat a configured set of enemies.
- **Web restraint challenge:** restrain eligible targets within a limit.
- **Mobility challenge:** reach height or distance thresholds.
- **Gadget training:** use a specified gadget successfully.

Make challenges functional even in a normal world. Use configurable positions, blocks, items, or a simple interaction to create/start them. Do not require a giant prebuilt map.

## 13.2 Progress and rewards

Track progress without saving every tick. Complete objectives based on real events or periodic checks with bounded cost. Avoid awarding the same reward on every load or repeated event. Make progress visible through the relevant UI.

Potential rewards:

- Suit unlocks.
- Gadget unlocks.
- Cosmetic variations.
- Achievements or records.
- Optional, modest passive upgrades.

Do not make progression grant runaway combat power. The core traversal should remain fun from the beginning.

---

# 14. CUSTOM ITEMS, BLOCKS, STATIONS, AND RECIPES

## 14.1 Item catalogue

At minimum, where supported by the existing pack structure, define and integrate:

- Web-shooter / traversal activator.
- Impact-web gadget.
- Restraint-web gadget.
- Web-pull or zip gadget.
- Tech pulse gadget.
- Threat scanner or Spider-Sense activator where needed by the control design.
- Suit unlock tokens or suit items only if the project uses such a model.

Every item must have a namespaced ID, display name, description where supported, icon/texture, valid behavior, acquisition route, and cleanup rules. Keep item names and IDs consistent across scripts, recipes, and localization.

Do not create a new item for every minor ability if a menu or selection state is a better experience. Avoid overlapping functions.

## 14.2 Optional blocks and stations

Implement custom blocks only when they have meaningful gameplay utility:

**Suit Display / Suit Station**
- Opens the suit selection interface or performs a clear interaction.
- Provides a stable point to equip/unlock suits.
- Uses a fully textured, readable model.

**Gadget Workbench**
- Provides access to gadget crafting or unlocking.
- Uses accessible recipes and consistent visual language.
- Does not duplicate vanilla crafting UI functionality without a benefit.

**Challenge Marker**
- Activates a configured challenge or course.
- Provides visible feedback when a challenge starts or finishes.

A single station may combine several related functions if that produces a cleaner system. Do not add decorative-only blocks solely to inflate the feature list.

## 14.3 Recipes and materials

Recipes should use sensible, accessible ingredients and not alter unrelated vanilla recipes. The starter traversal tool must be readily obtainable. Advanced content may require stronger ingredients or challenge completion, but all requirements must be documented.

Verify exact recipe schema and item identifiers. Never leave recipes pointing to nonexistent custom IDs.

## 14.4 Item behavior tests

Test valid use, invalid use, no target, cooldown active, insufficient requirements, inventory changes, death, respawn, reconnect, and multiplayer isolation where applicable.

---

# 15. VISUAL ASSET BIBLE

## 15.1 General quality bar

Every visible asset should look intentional. Avoid plain colored placeholder squares, missing textures, mismatched UV maps, inconsistent outlines, random anti-aliasing choices, unreferenced texture files, and icons too detailed to read at inventory scale.

Use a consistent palette and visual grammar:

- Primary: Spider-Man red.
- Secondary: deep blue.
- Dark neutral: black/charcoal.
- Highlight: white or pale gray for web and interface contrast.
- Optional tech accent: cyan or restrained electric blue.

Do not let every asset become equally saturated. Reserve the strongest contrast for important player-facing elements.

## 15.2 Suit textures

For each suit:

- Use the correct UV mapping for the chosen player/entity geometry.
- Verify front, back, sides, head, arms, legs, and any additional model parts.
- Keep spider emblems centered and proportionate.
- Make the web pattern consistent over seams.
- Avoid blurry scaling, accidental transparency, and off-by-one pixel artifacts.
- Test appearance in first- and third-person views where the selected rendering pipeline supports it.
- Ensure custom geometry and animation references resolve correctly.

## 15.3 Gadget icons

Icons must remain legible at small scale. Use distinct silhouettes and consistent backgrounds/outline thickness. Do not make every gadget a recolored copy of a web-shooter.

## 15.4 Web effects and particles

Create a restrained but recognizable effect language for:

- Web launch.
- Anchor hit.
- Swing line or connection feedback.
- Web impact.
- Restraint.
- Web release.
- Spider-Sense alert.
- Tech pulse.
- Suit unlock.

Particles should be short-lived and appropriately sized. Avoid effects that cover the player's screen, obscure combat, or overwhelm lower-end mobile hardware.

## 15.5 Custom enemy assets

Use unique silhouettes, role-appropriate palettes, and clear material separation. Texture size should match visual importance and performance constraints. If high-quality custom models cannot be produced reliably in this run, prioritize working behavior and clean, consistent textures rather than shipping invalid geometry.

## 15.6 Licensing and provenance

Use original or appropriately licensed art/audio. Do not fetch or extract assets from commercial Spider-Man games or films. Record third-party asset licenses in a simple credits file where relevant.

---

# 16. ANIMATION, AUDIO, AND FEEDBACK

## 16.1 Feedback matrix

For every important player action, define success, failure, and interruption feedback.

| Action | Success feedback | Failure/interrupt feedback |
|---|---|---|
| Web shot | Brief thread/impact visual and sound | Subtle dry click or short message only when useful |
| Anchor acquired | Clear connection effect | No false connection animation |
| Swing starts | Visual state/line confirmation | Safe cancellation if anchor becomes invalid |
| Swing release | Thread disappears and momentum remains | State cleanup if forcefully interrupted |
| Wall attach | Small contact effect | Detach cleanly if the surface is invalid |
| Melee hit | Impact effect and concise hit cue | Avoid misleading hit feedback on misses |
| Web restraint | Visible web effect/status cue | Resist or fail clearly when target is immune |
| Spider-Sense | Short, prioritized alert | Suppress repeats during cooldown |
| Suit equipped | Confirmed menu state and optional effect | Explain locked/invalid selection |
| Challenge complete | Clear completion cue and reward state | Prevent duplicate rewards |

## 16.2 Audio

Use original or licensed sounds. Keep volumes and repetition controlled. Provide suitable fallback behavior if the audio asset or event is unavailable. Avoid embedding unlicensed film dialogue, actor likeness recordings, or commercial game audio.

## 16.3 Animation capability honesty

Use player/entity animation systems only where the required target supports them. If a true player-body swing animation cannot be attached through supported APIs, emphasize motion, camera-independent effects, suit visuals, and web feedback rather than faking an unsupported player animation controller.

---

# 17. UI, GUI, AND PLAYER EXPERIENCE

## 17.1 Interface philosophy

The UI must be functional first and visually coherent second, with both standards met. It should feel designed for a Spider-Man add-on: compact panels, clean hierarchy, strong contrast, spider/web motifs used sparingly, and minimal distraction during traversal.

Do not assume that unrestricted custom HUD rendering or arbitrary button binding is available in a Bedrock Add-On. Verify supported UI JSON and Script UI forms for the target. Use the most capable stable option that actually works.

## 17.2 Main HUD

Show only useful, current information, such as:

- Equipped suit name/icon, if available without crowding.
- Selected gadget.
- Cooldown/charge status where supported.
- Swing/anchor state.
- Active challenge information.
- Spider-Sense threat alert.

Avoid permanent oversized panels, repeated chat output, debug numbers, or speculative indicators. Do not expose internal state in normal gameplay.

## 17.3 Suit menu

Provide:

- Suit name and short description.
- Unlock/equipped state.
- Selection action.
- Specialization summary based on actual applied effects.
- Clear response for locked suits.
- Back/close behavior.

Do not claim a specialization that is not implemented in gameplay.

## 17.4 Gadget menu

Provide:

- Gadget list.
- Selected gadget.
- Short description.
- Unlock and cooldown/charge state.
- A reliable select/activate route.

Use stable IDs to route button results. Avoid mapping solely by display name, which can change with translation.

## 17.5 Progression and challenge UI

Show current objective, progress, completion, and reward. Provide a practical way to start and cancel a challenge. The UI must not trap the player or prevent world interaction after closing.

## 17.6 Help/settings menu

Include a concise control guide and, where feasible, settings such as effect intensity, alert frequency, and optional notifications. Settings must persist only if supported and appropriate. Do not add cosmetic toggles that do nothing.

## 17.7 UI resilience

Handle:

- Player closing a form.
- Form cancellation.
- Player disconnect/death while a menu is open.
- Invalid or stale selection.
- Locked options.
- Missing optional assets.
- Multiple players opening menus.
- Mobile-size text and buttons.

Keep all UI strings in localization files if the project uses localization; otherwise keep string definitions centralized so they can be localized later.

---

# 18. INPUT AND CONTROL DESIGN

## 18.1 Reality check

Bedrock Add-Ons have specific interaction and input constraints. Do not assume the same input hook system as a custom PC game or a Java Edition mod. Inspect the supported events, item interactions, UI mechanisms, and controller/touch behavior before choosing controls.

## 18.2 Recommended control philosophy

- Keep the core web action easy to trigger.
- Keep release and re-attachment predictable.
- Avoid requiring simultaneous precision inputs that are difficult on mobile.
- Use the current item, form selection, or interaction events where suitable.
- Do not commandeer vanilla inputs globally without a justified, verified mechanism.
- Clearly explain any control trade-offs in the in-game guide.

## 18.3 Avoid hotbar clutter

The hotbar should remain usable for normal Minecraft gameplay. If the project maps unlocked abilities to selected hotbar slots, ensure slot changes are observed correctly and do not consume or replace unrelated items. Prefer a small number of contextual activators plus a menu when that is more robust.

## 18.4 Platform limitations

Document verified behavior for keyboard/mouse, controller, and touch separately when testing is possible. If only one platform is available for testing, state that fact. Do not state “works on all platforms” based solely on code inspection.

---

# 19. PERSISTENCE AND PLAYER DATA

Persist useful player-specific data using supported, documented storage mechanisms. Data may include:

- Unlocked suits.
- Equipped suit.
- Unlocked gadgets.
- Selected gadget.
- Completed challenges and records.
- Configuration preferences.
- Progression level or achievement state.

## 19.1 Validation and migrations

- Assign a data schema version if the save structure may evolve.
- Validate the loaded type and range of every important field.
- Provide safe defaults for missing/corrupted data.
- Avoid crashing initialization due to stale save data.
- Preserve compatible fields during upgrades.
- Do not trust user-provided dynamic values without validation.

## 19.2 Multiplayer isolation

Use player-specific keys/state. Confirm that unlocking a suit for one player does not accidentally unlock it for all players unless shared progression is an explicit design choice. Validate ownership before awarding rewards.

## 19.3 Save cadence

Do not write every tick. Save after meaningful changes, with throttling/debouncing when appropriate. Avoid excessive serialization or large per-player objects.

---

# 20. LIFECYCLE, ERROR HANDLING, AND CLEANUP

This is a required system, not optional polish.

Track and clean up temporary state when:

- Player dies.
- Player respawns.
- Player disconnects.
- Player changes dimension.
- An anchor or target is removed.
- A timer expires.
- A form is canceled.
- An entity becomes invalid.
- A cooldown or restraint completes.
- A script operation fails.
- The owning system is disabled or reset.

Maintain a clear ownership model for status effects, temporary entities, timers, particles, and movement modifiers. Never remove an effect or restore a property unless the addon knows it owns that effect/property or has a safe way to preserve other systems' changes.

Use bounded timer/interval handling. Avoid creating a new repeating interval every time a player activates an ability. Prefer one shared update loop where justified or centrally managed, cancellable tasks. Make sure subscriptions are registered only once.

For every error path, answer:

1. What state was active?
2. What cleanup is required?
3. What should the player experience?
4. What should be logged for developers?

---

# 21. BALANCING PRINCIPLES

Suggested values should be configurable, then tuned through real tests where possible. Do not treat suggested values as scientifically precise.

- Traversal should feel powerful without becoming uncontrollable.
- Swing speed and acceleration must be capped.
- Web range should reward looking at plausible anchor points rather than attaching across enormous distances.
- Gadgets should have different tactical purposes.
- Crowds of enemies should not cause permanent immobilization loops.
- Bosses should resist hard crowd control enough to remain interactive.
- Suits should provide interesting but modest specialization.
- Unlocks should be satisfying without locking the core fun behind hours of grinding.
- The player should remain vulnerable to normal world dangers unless an explicit, balanced ability changes them.
- Effects should be legible in a busy world and performant on mobile hardware.

Expose balance values centrally and document the main ones. Prefer playtest-informed iteration to arbitrarily large multipliers.

---

# 22. PERFORMANCE TARGETS AND LIMITS

The add-on should avoid self-inflicted performance problems. Where numeric measurements are possible, record them, but do not invent target frame rates without a tested environment.

Required practices:

- Avoid global entity scans.
- Bound every query by relevant dimension/area/radius when possible.
- Keep per-tick math lightweight.
- Run Spider-Sense on an interval, not needlessly every tick.
- Use a central scheduler instead of creating duplicate loops.
- Cap active webs, projectiles, visual helper entities, and particles.
- Remove expired objects and state immediately or on a reliable cleanup schedule.
- Avoid repeatedly loading/parsing the same data.
- Minimize persistent data writes.
- Avoid excessive UI updates.
- Provide reduced visual intensity when it is easy and reliable to do so.

When load testing is not available, perform static review for likely cost centers and label runtime performance as unverified.

---

# 23. MULTIPLAYER AND COEXISTENCE

Design per-player state and world mutations carefully so the add-on can support multiplayer when the underlying APIs and hosting context allow it.

- Separate player-specific state from global definitions.
- Avoid global variables that are overwritten by each player's selected suit/gadget.
- Validate the acting player and target on every ability request.
- Prevent duplicate reward claims.
- Handle disconnected players promptly.
- Ensure one player's temporary web restraint does not accidentally alter every player.
- Limit cross-player effect attribution and friendly fire according to a clear policy.
- Test simultaneous activations by two players where possible.
- Do not claim fully tested Realm/dedicated-server support unless tested in that environment.

When coexisting with other add-ons, do not assume exclusive ownership of all player attributes. Apply reversible, namespaced modifiers and avoid unnecessary edits to vanilla entities or global rules. Document known conflicts.

---

# 24. ACCESSIBILITY AND USABILITY

- Use concise, plain-language labels.
- Make crucial controls discoverable.
- Avoid relying on color alone to communicate every state.
- Use sufficient contrast.
- Avoid repeated flashing or aggressive screen shake.
- Keep combat UI out of the main field of view as much as practical.
- Give the player a way to cancel active traversal.
- Ensure menus have clear back/close behavior.
- Make important features accessible on touch devices when technically possible.
- Avoid hiding core ability activation behind obscure commands.

Do not add accessibility settings that do not actually modify behavior. A smaller real settings menu is better than a large decorative one.

---

# 25. TEST PLAN AND DEFINITION OF DONE

The agent must execute all feasible checks and record the actual results.

## 25.1 Static checks

- Parse every JSON file.
- Validate manifests and module/dependency versions.
- Check UUID format and collisions across packs/modules.
- Check that every referenced custom identifier is defined.
- Check for missing texture, geometry, animation, sound, item, block, and entity references.
- Check recipe outputs/ingredients.
- Check localization keys.
- Check imported script modules and file paths.
- Run lint, type checks, or build commands if the project has them.
- Search for TODOs, placeholder stubs, empty handlers, `return` statements that disable intended features, or swallowed errors.
- Verify all package entries are present.

## 25.2 Automated/script tests

Where feasible, test pure logic independently of the runtime:

- State transitions.
- Cooldown calculations.
- Gadget unlock and selection rules.
- Suit unlock and equip rules.
- Challenge completion logic.
- Data validation/migration.
- Cleanup idempotence.
- Attack range and damage calculation helpers.

Do not build a large mock framework merely to make the test count look impressive. Test the highest-risk logic that can be isolated realistically.

## 25.3 Runtime checks

If an actual Bedrock environment is available, import the package and test:

1. Pack enables and initializes without script errors.
2. Starter suit and web-shooter can be obtained and used.
3. Aiming/launching produces expected feedback.
4. Web anchoring works against suitable surfaces.
5. Swinging gains controlled momentum.
6. Releasing preserves useful motion and clears state.
7. Reattaching works.
8. Invalid shots fail safely.
9. Destroying or invalidating an anchor ends the swing safely.
10. Wall climbing begins, moves, and detaches.
11. Melee attacks hit the intended targets once.
12. Web effects expire correctly.
13. Spider-Sense warns about actual detectable threats without spamming.
14. Gadgets have distinct behavior and correct cooldowns.
15. Suit selection changes the actual equipped state/effects.
16. Menus can open, select, cancel, and close without trapping the player.
17. Progress and rewards survive the intended lifecycle.
18. Death, respawn, disconnect, and dimension change clean up correctly.
19. A long session does not accumulate obvious helper entities or timers.
20. Other existing project features still work.

## 25.4 Regression and edge cases

Test as many as possible:

- No valid web anchor.
- Range boundary.
- Repeated activations.
- Invalid/stale entity.
- World or dimension transition.
- Death during swing/climb/attack.
- Target death during restraint.
- Player disconnection during active ability.
- Gadget changed during cooldown.
- Locked suit selected.
- Corrupted/missing progression data.
- Two players using the system at once.
- Low-end/mobile performance constraints, if the device is available.

## 25.5 Severity-based defect handling

- **P0:** pack does not load, script fails to initialize, or core traversal corrupts/locks player state. Must be fixed before delivery if possible.
- **P1:** core feature is unusable, UI cannot exit, abilities conflict, progression is corrupted, or frequent runtime errors occur. Fix before delivery if possible.
- **P2:** secondary feature defect, visual mismatch, uncommon edge-case bug. Fix if time/environment permits; otherwise document.
- **P3:** minor polish or optional content.

Do not ship known P0 failures without an explicit blocker report and the best feasible mitigation.

## 25.6 Evidence honesty

Use separate labels in the final report:

- **Implemented:** code/assets exist and are wired into the project.
- **Static-validated:** checks such as parsing, references, or build succeeded.
- **Automated-tested:** a repeatable test was actually executed.
- **In-game tested:** was run inside Minecraft and the behavior was observed.
- **Not runtime-verified:** cannot be confirmed in the available environment.
- **Incomplete:** partially implemented or intentionally deferred.

Never convert “implemented” into “working” unless the available evidence justifies it.

---

# 26. PACKAGING AND RELEASE HYGIENE

## 26.1 Deliverable structure

Deliver, as applicable:

1. The `.mcaddon` import package.
2. The editable source tree, with Behavior Pack and Resource Pack clearly separated.
3. `README.md` with installation and setup instructions.
4. `CHANGELOG.md` or release summary.
5. `CREDITS.md` for third-party assets/licensing, if any.
6. Validation/test report.
7. Build/package script if it improves reproducibility.

Do not bundle development caches, temporary logs, credentials, or unrelated build outputs into the final package.

## 26.2 `.mcaddon` integrity

A `.mcaddon` is a packaged add-on distribution, not merely a ZIP with a renamed extension. Validate the actual expected pack folder layout and confirm that the package contains the intended behavior/resource packs and all required assets. Use the correct archive format and internal structure.

Verify:

- Both pack manifests are present when both packs are required.
- Dependencies and UUID references match.
- No required scripts or assets are excluded.
- Resource paths/casing are correct.
- The archive can be opened and its contents inspected.
- The final path points to the artifact that was actually created.

If the environment can launch or import Minecraft, perform that import test. If not, say that packaging was structurally checked but not imported in-game.

## 26.3 Source quality

Keep source files organized and readable. Do not minify the source solely to make the package look more professional. Preserve useful comments and make rebuilds possible. If compiling TypeScript or bundling scripts, include the source and exact build instructions unless there is a strong reason not to.

## 26.4 README requirements

Document:

- Target game version.
- Pack names and versions.
- Required experiments/settings, if any.
- Installation/import instructions.
- How to obtain the starter kit.
- How to control swinging, climbing, gadgets, and menus.
- Known limitations.
- Test coverage and unverified behaviors.
- Credits/licensing.

Do not write instructions for features that are not actually implemented.

---

# 27. PRIORITY AND RESOURCE ALLOCATION

The implementation is one continuous task, with priorities to prevent optional content from displacing the core.

## P0 — Playable foundation

- Valid manifests and initialization.
- Central player-state model and cleanup.
- Accessible starter loadout.
- Functional web launch/anchor/release flow.
- Stable web swing approximation.
- Wall climbing and controlled detachment.
- Essential feedback.
- Basic suit selection/equip.
- Robust error handling.

## P1 — Integrated game loop

- Core melee combat.
- Web restraint and impact gadget.
- Spider-Sense.
- Gadget menu/selection.
- Functional suit roster with unique visuals.
- Persistent unlocks.
- Basic challenge/progression system.
- Usable help/settings UI.

## P2 — Premium breadth and polish

- Additional gadgets.
- More suit variants.
- Distinct custom enemies.
- Optional boss encounter.
- Workbench/suit station/challenge marker.
- More particles, sounds, and animations.
- Timed courses and challenge rewards.
- Further visual/UI polish.

This is **not permission to skip P1/P2 automatically**. It is the implementation order. Continue adding features after P0 is stable, and complete every feature that can be genuinely integrated in the available run. If choosing between an optional fifth enemy and fixing swing stability, fix swing stability.

---

# 28. ACCEPTANCE CRITERIA

The deliverable is acceptable only if the following claims are true or the exception is clearly documented:

### Core gameplay
- [ ] The add-on has a coherent Spider-Man identity and not merely a suit texture.
- [ ] The starter loadout can be acquired without unreasonable grinding.
- [ ] Web launch distinguishes success and failure.
- [ ] Swinging uses a persistent anchor and controlled movement rather than only a visual particle.
- [ ] Releasing the web preserves safe, useful momentum and clears owned state.
- [ ] Reattachment and invalid-anchor handling work or are explicitly marked unverified.
- [ ] Wall climbing can attach, move, and detach without leaving the player stuck.
- [ ] Combat has a consistent damage/control path.
- [ ] At least the core gadgets have meaningfully different behavior.
- [ ] Spider-Sense only reports threats the code can actually detect or reasonably infer.

### Content and presentation
- [ ] Suit IDs, descriptions, icons, textures, and equip logic are connected.
- [ ] Custom item definitions resolve and have real behaviors.
- [ ] Any custom blocks have functional use.
- [ ] UI menus contain working navigation/actions and can be dismissed.
- [ ] Textures, geometries, animations, and sounds referenced by the packs exist.
- [ ] Visual assets share a deliberate vanilla-plus style.

### Engineering
- [ ] The add-on uses APIs compatible with the target build or documents necessary experiments.
- [ ] JSON and manifests validate.
- [ ] Repeated events do not duplicate listeners/timers.
- [ ] Death/disconnect/dimension changes have cleanup paths.
- [ ] Player-specific data is isolated in multiplayer-capable systems.
- [ ] Persistent data is validated and saved at sensible times.
- [ ] No known P0 issue is concealed.

### Delivery
- [ ] A real `.mcaddon` artifact exists when packaging is possible.
- [ ] The package structure and required contents are verified.
- [ ] The editable source is available.
- [ ] Installation and controls are documented.
- [ ] The final report truthfully identifies what was tested and what remains uncertain.

The checklist is an acceptance tool, not an invitation to tick boxes without evidence.

---

# 29. FINAL REPORT FORMAT

At the end of the run, respond with a concise but precise report using this structure:

## Delivered
- Exact artifact paths/links.
- Pack names and target version.
- Brief inventory of systems and content.

## Implementation status
For each major system—web traversal, climbing, combat, Spider-Sense, gadgets, suits, UI, progression, custom enemies/blocks, persistence—state whether it is implemented, validated, runtime-tested, unverified, or incomplete.

## Validation results
- Commands/tools actually executed.
- JSON/manifest/build results.
- Package integrity results.
- In-game test results, only if performed.

## Known limitations
State concrete limitations, not vague statements. Separate API/runtime limitations from work that simply remains incomplete.

## Installation
Give exact import steps and list experiments/settings only if actually required.

## Next test to perform manually
If in-game testing was unavailable, give the single most important manual test sequence, starting with importing the pack and verifying the web-swing core.

Never claim “everything works” solely because the build passed. Never report an artifact path that does not exist.

---

# 30. FINAL DIRECTIVE TO THE AGENT

You have full implementation autonomy within the existing project and the tools available to you. Make the technically strongest decisions, reuse good existing work, and execute the complete pipeline in this one run.

**Do not answer with a plan. Do not ask the user to approve every detail. Do not stop after describing the architecture. Do not replace missing implementation with promises.**

Inspect the project, confirm the target API, implement the systems, create or refine the assets, connect state and UI, validate the result, correct defects, produce the `.mcaddon`, preserve the source, and deliver an honest report.

The most important quality standard is this: **the player must be able to experience a cohesive Spider-Man gameplay loop, especially web traversal, rather than a disconnected collection of superhero-themed assets.**

Aim for premium quality, but let verified technical behavior—not the size of the claims—determine what is considered finished.
