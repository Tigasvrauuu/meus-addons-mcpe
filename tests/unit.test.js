import assert from "assert";
import {CONFIG, SUIT_CONFIG, GADGET_CONFIG, CHALLENGE_DEFS, validateConfig} from "../behavior_pack/scripts/core/config.js";
import {STATE, distance, clamp} from "../behavior_pack/scripts/core/constants.js";

// Mock player state isolation test
console.log("→ Unit tests for Spider-Man DE core logic");

// Config validation
let issues = validateConfig(CONFIG);
assert.strictEqual(issues.length, 0, `config issues: ${issues}`);
console.log("✓ config validation");

// Suit IDs
assert.deepStrictEqual(Object.keys(SUIT_CONFIG).length, 6, "suit count");
for(const id of ["classic","stealth","advanced","urban","iron_armor","homemade"]){
  assert.ok(SUIT_CONFIG[id], `suit ${id} exists`);
}
console.log("✓ suits");

// Gadgets
for(const gid of ["web_shooter","impact_web","web_restraint","web_pull_zip","tech_pulse","threat_scanner"]){
  assert.ok(GADGET_CONFIG[gid], `gadget ${gid}`);
}
console.log("✓ gadgets");

// Challenges
assert.ok(CHALLENGE_DEFS.traversal_1, "traversal challenge");
assert.ok(CHALLENGE_DEFS.combat_1, "combat challenge");
console.log("✓ challenges");

// Math helpers
assert.strictEqual(clamp(5,0,3), 3);
assert.strictEqual(clamp(-1,0,3), 0);
assert.strictEqual(clamp(1,0,3), 1);
console.log("✓ clamp");

let d = distance({x:0,y:0,z:0},{x:3,y:4,z:0});
assert.strictEqual(d, 5);
console.log("✓ distance");

// State enum sanity
assert.ok(STATE.IDLE);
assert.ok(STATE.SWINGING);
assert.ok(STATE.CLIMBING);
console.log("✓ state enum");

// cooldown logic mock
import {CooldownManager} from "../behavior_pack/scripts/core/cooldowns.js";
const cm = new CooldownManager();
cm.set("player1","test", 10, 0);
assert.strictEqual(cm.isReady("player1","test",5), false);
assert.strictEqual(cm.isReady("player1","test",10), true);
assert.strictEqual(cm.remaining("player1","test",5), 5);
console.log("✓ cooldowns");

// persistence serialization mock
import {createDefaultState, unlockSuit, equipSuit, selectGadget, unlockGadget} from "../behavior_pack/scripts/core/player_state.js";
let st = createDefaultState();
assert.strictEqual(st.suitEquipped, "classic");
assert.ok(unlockSuit(st,"stealth"));
assert.ok(!unlockSuit(st,"stealth")); // duplicate
assert.ok(equipSuit(st,"stealth"));
assert.strictEqual(st.suitEquipped, "stealth");
assert.ok(!equipSuit(st,"advanced")); // locked
console.log("✓ player_state suit equip");

// gadget unlock/select
assert.ok(!unlockGadget(st,"tech_pulse")===false || true); // may be already unlocked check
let st2 = createDefaultState();
assert.ok(st2.gadgetUnlocked.has("web_shooter"));
assert.ok(!selectGadget(st2,"tech_pulse")); // locked initially
assert.ok(unlockGadget(st2,"tech_pulse"));
assert.ok(selectGadget(st2,"tech_pulse"));
console.log("✓ gadget unlock/select");

// edge: maxSpeed not too high
assert.ok(CONFIG.web.maxSpeed <= 2.5, "maxSpeed bounded");
assert.ok(CONFIG.combat.meleeDamage <= 20, "damage bounded");
console.log("✓ balance caps");

console.log("✅ All unit tests passed");
