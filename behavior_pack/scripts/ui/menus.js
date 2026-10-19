// Spider Hub: suits, gadgets, Spider-Sense settings, progress and a short
// guide. Every form returns to a known state; cancelling or closing a form
// never leaves the player trapped. Opening the hub ends active traversal,
// so the player never swings or clings while a menu is open.
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { GADGETS, GADGET_ORDER, SUITS, SUIT_ORDER } from "../core/config.js";
import { getProfile, markDirty, saveNow } from "../core/persistence.js";
import { getRecord } from "../core/player_state.js";
import { isGadgetUnlocked, isSuitUnlocked, requirementText } from "../core/unlocks.js";
import { flash } from "./hud.js";
import { cancelSwing } from "../systems/web_traversal.js";
import { cancelCling } from "../systems/wall_climbing.js";
import { errorOnce } from "../core/diagnostics.js";

const GUIDE = [
  "§lWEB-SHOOTER§r (right-click)",
  "Aim at a surface up to 30 blocks away and right-click to attach.",
  "Right-click again (or sneak) to release. Releasing keeps your momentum.",
  "",
  "§lWALL-CLING§r (sneak + right-click)",
  "Aim at a wall within reach. Look up to climb, down to descend.",
  "Jump or sneak to let go.",
  "",
  "§lGADGET LAUNCHER§r (right-click)",
  "Fires the selected gadget. Sneak + right-click opens this hub.",
  "",
  "§lSPIDER-SENSE§r",
  "Warns when hostile mobs are close or when you take damage.",
  "It is proximity detection only. It cannot see through walls.",
].join("\n");

export function openHub(player) {
  const rec = getRecord(player);
  cancelSwing(player, rec, "menu");
  cancelCling(player, rec, "menu");
  const profile = getProfile(player);
  const body = [
    `Suit: §l${SUITS[profile.suit].name}§r`,
    `Gadget: §l${GADGETS[profile.gadget].name}§r`,
    `Spider-Sense alerts: ${profile.settings.senseAlerts ? "on" : "off"}`,
  ].join("\n");
  const form = new ActionFormData()
    .title("SPIDER HUB")
    .body(body)
    .button("Suits")
    .button("Gadgets")
    .button("Spider-Sense Settings")
    .button("Progress")
    .button("How to Play");
  show(player, form, (selection) => {
    if (selection === 0) openSuits(player);
    else if (selection === 1) openGadgets(player);
    else if (selection === 2) openSettings(player);
    else if (selection === 3) openProgress(player);
    else if (selection === 4) openGuide(player);
  });
}

function show(player, form, onSelect) {
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined) return;
      onSelect(response.selection);
    })
    .catch((error) => errorOnce("hub-form", error));
}

function openSuits(player) {
  const profile = getProfile(player);
  const lines = SUIT_ORDER.map((id) => {
    const suit = SUITS[id];
    const status = isSuitUnlocked(profile, id) ? "" : " (locked)";
    return `§l${suit.name}§r${status}\n${suit.description}`;
  });
  const form = new ActionFormData().title("SUITS").body(lines.join("\n\n"));
  for (const id of SUIT_ORDER) {
    const suit = SUITS[id];
    let label = suit.name;
    if (profile.suit === id) label += " [EQUIPPED]";
    else if (!isSuitUnlocked(profile, id)) label += " [LOCKED]";
    form.button(label);
  }
  form.button("Back");
  show(player, form, (selection) => {
    if (selection === SUIT_ORDER.length) return openHub(player);
    const id = SUIT_ORDER[selection];
    if (!id) return;
    if (!isSuitUnlocked(profile, id)) {
      return showLocked(player, "suit", id, () => openSuits(player));
    }
    profile.suit = id;
    markDirty(player);
    saveNow(player);
    flash(player, `§aSuit equipped: ${SUITS[id].name}`);
    openSuits(player);
  });
}

function openGadgets(player) {
  const profile = getProfile(player);
  const lines = GADGET_ORDER.map((id) => {
    const gadget = GADGETS[id];
    const status = isGadgetUnlocked(profile, id) ? "" : " (locked)";
    return `§l${gadget.name}§r${status}\n${gadget.description}`;
  });
  const form = new ActionFormData().title("GADGETS").body(lines.join("\n\n"));
  for (const id of GADGET_ORDER) {
    const gadget = GADGETS[id];
    let label = gadget.name;
    if (profile.gadget === id) label += " [SELECTED]";
    else if (!isGadgetUnlocked(profile, id)) label += " [LOCKED]";
    form.button(label);
  }
  form.button("Back");
  show(player, form, (selection) => {
    if (selection === GADGET_ORDER.length) return openHub(player);
    const id = GADGET_ORDER[selection];
    if (!id) return;
    if (!isGadgetUnlocked(profile, id)) {
      return showLocked(player, "gadget", id, () => openGadgets(player));
    }
    profile.gadget = id;
    markDirty(player);
    saveNow(player);
    flash(player, `§aGadget selected: ${GADGETS[id].name}`);
    openGadgets(player);
  });
}

function showLocked(player, kind, id, back) {
  const profile = getProfile(player);
  const def = kind === "suit" ? SUITS[id] : GADGETS[id];
  const stat = def.unlock ? def.unlock.stat : null;
  const have = stat ? profile.stats[stat] ?? 0 : 0;
  const need = def.unlock ? def.unlock.min : 0;
  const form = new ActionFormData()
    .title("LOCKED")
    .body(`${def.name}\nRequirement: ${requirementText(kind, id)}\nProgress: ${Math.min(have, need)}/${need}`)
    .button("Back");
  show(player, form, () => back());
}

function openSettings(player) {
  const profile = getProfile(player);
  const form = new ModalFormData()
    .title("SPIDER-SENSE SETTINGS")
    .toggle("Show Spider-Sense alerts", { defaultValue: profile.settings.senseAlerts });
  form
    .show(player)
    .then((response) => {
      if (response.canceled) return openHub(player);
      profile.settings.senseAlerts = response.formValues[0] === true;
      markDirty(player);
      saveNow(player);
      flash(player, `§aSpider-Sense alerts ${profile.settings.senseAlerts ? "on" : "off"}`);
      openHub(player);
    })
    .catch((error) => errorOnce("settings-form", error));
}

function openProgress(player) {
  const profile = getProfile(player);
  const s = profile.stats;
  const body = [
    `Web swings: ${s.swings}`,
    `Wall-clings: ${s.wallClimbs}`,
    `Gadget uses: ${s.gadgetUses}`,
    `Impact hits: ${s.impactHits}`,
    `Restraints: ${s.restraints}`,
    `Pulses: ${s.pulses}`,
    "",
    `Suits unlocked: ${profile.unlockedSuits.length}/${SUIT_ORDER.length}`,
    `Gadgets unlocked: ${profile.unlockedGadgets.length}/${GADGET_ORDER.length}`,
  ].join("\n");
  const form = new ActionFormData().title("PROGRESS").body(body).button("Back");
  show(player, form, () => openHub(player));
}

function openGuide(player) {
  const form = new ActionFormData().title("HOW TO PLAY").body(GUIDE).button("Back");
  show(player, form, () => openHub(player));
}
