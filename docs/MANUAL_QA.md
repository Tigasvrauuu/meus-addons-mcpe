# Required first in-game test

1. Back up a world; import the `.mcaddon` into the actual Bedrock 26.52 client. Activate BP + RP with experiments OFF. Turn on the Content Log. Check for missing dependencies, schema errors, texture errors and script startup exceptions.
2. Join a creative test world and confirm exactly four tools are granted. Place a tall stone arch with at least 12 blocks of clearance. Aim near its top with the Web Shooter, use once, walk/jump into the arc, steer, and use again to release. **Stop here and report the log if use does not attach.** Verify useful momentum and no item loss/duplication from the use path.
3. Try sky/no anchor, leaves/fluid, anchors at 31/33 blocks; destroy the active anchor. Switch tools, teleport, enter water, mount a vehicle, open the console mid-swing, die, respawn and change dimension. Confirm no ongoing owned corrections, crashes or frozen state. Slow-falling should expire naturally.
4. Face a stone wall with Wall Grip; attach, look up/down, sneak, move sideways, release, and move away. Do not accept clipping, indefinite attachment or runaway speed.
5. Spawn vanilla hostiles in an enclosed test area. Test impact, restraint expiration, heavy-target resistance, line-of-sight blocking, pulse, strike combos, zip and evade. Confirm other players/pets cannot be hit by scripted attacks and cooldowns persist across gadget selection.
6. Complete a patrol (three attachments + three gadget hits in 90s). Confirm +6 research once; repeat for suit thresholds. Cancel/expire another patrol. Open and dismiss every form. Change particle/Sense settings and rejoin to verify saving. Try equipping while wearing vanilla chest armor; it must not disappear.
7. Inspect every suit in third and first person, including slim skins, armor overlaps and animation alignment. Unequip Tech/Urban/Night Weaver and verify their bonuses stop. Inspect hotbar icons and thread particles on a low-end device.
8. Test a second player: independent anchors, gadgets, research, settings and UI; disconnect during each ability. Run 20 minutes of repeated use, monitor Content Log and entity counts. No helper entities should accumulate.

Record exact runtime version, platform, experiments, API errors, observed input behavior and reproduction steps. None of this manual checklist has been executed by the coding agent.
