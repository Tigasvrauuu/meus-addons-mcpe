// ui/menus.js — UIService (spec §17).
// All forms are built with @minecraft/server-ui 2.x (ActionFormData /
// ModalFormData). Buttons are routed by STABLE IDS via an index table (never
// by display text), cancellations are handled, UserBusy is retried a bounded
// number of times, and opening a menu safely releases traversal state first
// (spec §7.4 explicit transition decision: menus cancel active traversal).

import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData, FormCancelationReason } from "@minecraft/server-ui";
import { SUIT_DEFS, isSuitUnlocked, purchaseSuit, grantStarterKit, grantSuitItem as suitsGrant } from "../systems/suits.js";
import { listChallenges, startChallenge, stopChallenge, isCompleted, progressText } from "../systems/challenges.js";
import { gadgetCooldownInfo, prettyGadgetName } from "../systems/gadgets.js";
import { GADGETS } from "../core/constants.js";
import { CONFIG } from "../core/config.js";
import { saveNow } from "../core/save.js";
import { markDirty, settingsOf } from "../core/state.js";
import * as traversal from "../systems/traversal.js";
import { cancelClimb } from "../systems/climbing.js";
import { sfx } from "./hud.js";
import { errorThrottled } from "../core/logger.js";

const MAX_BUSY_RETRIES = 3;

/**
 * Shows a form with UserBusy retry + cancellation safety. `build` returns the
 * form; `onResult(response, player, state)` routes the selection.
 */
function showForm(player, state, build, onResult, retries = 0) {
  let form;
  try {
    form = build();
  } catch (err) {
    errorThrottled("menus.build", err);
    return;
  }
  state.menuOpen = true;
  form
    .show(player)
    .then((response) => {
      state.menuOpen = false;
      if (!response) return;
      if (response.canceled) {
        if (response.cancelationReason === FormCancelationReason.UserBusy && retries < MAX_BUSY_RETRIES) {
          system.runTimeout(() => showForm(player, state, build, onResult, retries + 1), 10);
        }
        return; // UserClosed → nothing to do (never trap the player)
      }
      try {
        onResult(response, player, state);
      } catch (err) {
        errorThrottled("menus.onResult", err);
      }
    })
    .catch((err) => {
      state.menuOpen = false;
      errorThrottled("menus.show", err);
    });
}

/**
 * Cancels traversal/climb before a menu opens (explicit, safe transition,
 * spec §7.4). releaseWeb() safely ends both swinging and zipping (no-op in
 * other states) and cancelClimb() releases wall contact.
 */
function settleMovement(player, state, now) {
  traversal.releaseWeb(player, state, now, { reason: "menu" });
  cancelClimb(state, now);
}

// ---------------------------------------------------------------------------
// Main menu (Spider Manual item / Suit Station)
// ---------------------------------------------------------------------------

export function openMainMenu(player, state, now) {
  settleMovement(player, state, now);
  sfx(player, "MENU_CLICK");

  const active = progressText(state);
  const body =
    `§l§c🕷 SPIDER-MAN§r§l §r§7— Definitive Experience\n\n` +
    `§fSuit: §7${state.suit.id ? suitLabel(state.suit.id) : "§enone equipped§7 (wear a suit item!)"}` +
    `§f\nChallenge: §7${active ?? "none active"}` +
    `§f\n\n§8Use the buttons below. Close returns you to the game instantly.`;

  const actions = [
    { id: "suits", label: "§c🕷 Suits", run: () => openSuitMenu(player, state, system.currentTick) },
    { id: "gadgets", label: "§f🕸 Gadgets", run: () => openGadgetMenu(player, state, system.currentTick) },
    { id: "challenges", label: "§6★ Challenges", run: () => openChallengeMenu(player, state, system.currentTick) },
    { id: "kit", label: "§a🧰 Starter Kit (resupply)", run: (res) => doStarterKit(player, state, res) },
    { id: "settings", label: "§b⚙ Settings", run: () => openSettings(player, state, system.currentTick) },
    { id: "help", label: "§e❓ Help & Controls", run: () => openHelp(player, state, system.currentTick) },
    { id: "close", label: "§7✖ Close", run: () => {} },
  ];

  showForm(
    player,
    state,
    () => {
      const f = new ActionFormData().title("§c🕷 Spider-Man Menu").body(body);
      for (const a of actions) f.button(a.label);
      return f;
    },
    (response) => {
      const action = actions[response.selection];
      if (action) action.run(response);
    }
  );
}

function doStarterKit(player, state, response) {
  const now = system.currentTick;
  const granted = grantStarterKit(player, state, now, { full: false });
  if (!granted) {
    pushMessage(player, "§7Starter kit: nothing missing — you already carry the core gear.");
  }
}

function pushMessage(player, text) {
  try {
    player.sendMessage(text);
  } catch {
    /* ignore */
  }
}

function suitLabel(suitId) {
  const def = SUIT_DEFS.find((s) => s.id === suitId);
  return def ? def.name : suitId;
}

// ---------------------------------------------------------------------------
// Suit menu (spec §17.3)
// ---------------------------------------------------------------------------

export function openSuitMenu(player, state, now) {
  const equippedItemId = currentChestItemId(player);
  const actions = [];

  for (const def of SUIT_DEFS) {
    const equipped = equippedItemId === def.itemId;
    const unlocked = isSuitUnlocked(state, def.id);
    const cost = CONFIG.suits.purchaseCosts[def.id];
    let label;
    if (equipped) label = `§a✔ EQUIPPED §f${def.name}`;
    else if (unlocked || def.starting) label = `§f${def.name} §7— owned`;
    else label = `§8🔒 §f${def.name}`;
    actions.push({ id: def.id, label, def, equipped, unlocked, cost });
  }
  actions.push({ id: "back", label: "§7← Back" });

  const body =
    `§7Suits are chestplate items — equip one from your inventory to activate its passives.\n` +
    `§8Locked suits: complete a challenge or buy at this station.\n\n`;

  showForm(
    player,
    state,
    () => {
      const f = new ActionFormData().title("§c🕷 Suits").body(body);
      for (const a of actions) f.button(a.label);
      return f;
    },
    (response) => {
      const action = actions[response.selection];
      if (!action || action.id === "back") {
        openMainMenu(player, state, system.currentTick);
        return;
      }
      openSuitDetail(player, state, action);
    }
  );
}

function openSuitDetail(player, state, action) {
  const def = action.def;
  const now = system.currentTick;
  const lines = [
    `§l§f${def.name}§r`,
    ``,
    def.description,
    ``,
    `§7How to get: §f${def.obtain}`,
  ];
  if (action.equipped) lines.push(`§aCurrently equipped.`);
  else if (action.unlocked || def.starting) lines.push(`§eOwned — equip the item from your inventory (chest slot).`);
  else if (action.cost) lines.push(`§6Buy here: ${costText(action.cost)}§7. Materials are consumed on purchase.`);
  else lines.push(`§cNot available at this station.`);

  const actions = [];
  const canBuy = !action.unlocked && !def.starting && !!action.cost;
  if (canBuy) actions.push({ id: "buy", label: `§6Buy (${costText(action.cost)}§6)` });
  if (action.unlocked || def.starting) actions.push({ id: "spare", label: "§aGet a spare copy (free)" });
  actions.push({ id: "back", label: "§7← Back to suits" });

  showForm(
    player,
    state,
    () => {
      const f = new ActionFormData().title(def.name).body(lines.join("\n"));
      for (const a of actions) f.button(a.label);
      return f;
    },
    (response) => {
      const picked = actions[response.selection];
      if (!picked || picked.id === "back") {
        openSuitMenu(player, state, system.currentTick);
        return;
      }
      if (picked.id === "buy") {
        const result = purchaseSuit(player, state, def.id, system.currentTick);
        pushMessage(player, result.ok ? `§a${result.message}` : `§c${result.message}`);
        saveNow(player, state);
        openSuitMenu(player, state, system.currentTick);
        return;
      }
      if (picked.id === "spare") {
        const result = grantSuitItemSafe(player, state, def.id);
        pushMessage(player, result.ok ? `§a${result.message}` : `§c${result.message}`);
        openSuitMenu(player, state, system.currentTick);
      }
    }
  );
}

function grantSuitItemSafe(player, state, suitId) {
  try {
    return suitsGrant(player, state, suitId, system.currentTick, "spare copy");
  } catch (err) {
    errorThrottled("menus.grantSuit", err);
    return { ok: false, message: "Grant failed." };
  }
}

function costText(cost) {
  return Object.entries(cost)
    .map(([id, n]) => `${n}x ${id.replace("minecraft:", "").replace(/_/g, " ")}`)
    .join(", ");
}

function currentChestItemId(player) {
  try {
    return player.getComponent("equippable")?.getEquipment?.("Chest")?.typeId ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gadget menu (spec §17.4) — status display; activation stays on items
// ---------------------------------------------------------------------------

export function openGadgetMenu(player, state, now) {
  const gadgetRows = [
    { id: GADGETS.WEB_SHOOTER, desc: "Fire a web at a solid surface to swing. USE again (or JUMP) to release. SNEAK reels in." },
    { id: GADGETS.IMPACT_WEB, desc: "Damaging web shot: 2 dmg + stagger + knockback. Not an immobilizer." },
    { id: GADGETS.RESTRAINT_WEB, desc: "Webs a target in place (light) or slows it (heavy). Elites resist." },
    { id: GADGETS.WEB_PULL, desc: "Aim at an enemy to yank it close; aim at a surface to ZIP yourself there." },
    { id: GADGETS.TECH_PULSE, desc: "Radial pulse: 3 dmg, slow + knockback to every hostile within 6 blocks." },
    { id: GADGETS.THREAT_SCANNER, desc: "Extends Spider-Sense radius and reports threat counts for 12s." },
  ];

  const lines = gadgetRows.map((g) => {
    const info = gadgetCooldownInfo(state, g.id, system.currentTick);
    const status = info.ready ? "§aREADY" : `§c⌛ ${info.label}`;
    return `§f${prettyGadgetName(g.id)} §8[${status}§8]\n§7${g.desc}\n`;
  });

  const actions = [
    { id: "kit", label: "§a🧰 Resupply missing gadget items" },
    { id: "back", label: "§7← Back" },
  ];

  showForm(
    player,
    state,
    () => {
      const f = new ActionFormData()
        .title("§f🕸 Gadgets")
        .body(`§7Gadgets are real items — hold one and USE it.\nCooldown bars appear on the hotbar.\n\n${lines.join("\n")}`);
      for (const a of actions) f.button(a.label);
      return f;
    },
    (response) => {
      const picked = actions[response.selection];
      if (picked?.id === "kit") {
        grantStarterKit(player, state, system.currentTick, { full: true });
        openGadgetMenu(player, state, system.currentTick);
      } else {
        openMainMenu(player, state, system.currentTick);
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Challenge menu (spec §17.5)
// ---------------------------------------------------------------------------

export function openChallengeMenu(player, state, now) {
  const defs = listChallenges();
  const actions = [];
  const activeText = progressText(state);

  for (const def of defs) {
    const done = isCompleted(state, def.id);
    const isActive = state.challenge.activeId === def.id;
    const label = done
      ? `§a✔ §f${def.name} §7(completed)`
      : isActive
        ? `§e▶ ${def.name} §7(active)`
        : `§f${def.name}`;
    actions.push({ id: def.id, label, def, done, isActive });
  }
  if (activeText) actions.push({ id: "cancel", label: "§c✖ Cancel active challenge" });
  actions.push({ id: "back", label: "§7← Back" });

  const body =
    `§7One challenge at a time — progress tracks automatically.\n` +
    (activeText ? `§eActive: ${activeText}\n\n` : `\n`) +
    `§8Rewards are granted once and persist across sessions.`;

  showForm(
    player,
    state,
    () => {
      const f = new ActionFormData().title("§6★ Challenges").body(body);
      for (const a of actions) f.button(a.label);
      return f;
    },
    (response) => {
      const picked = actions[response.selection];
      if (!picked || picked.id === "back") {
        openMainMenu(player, state, system.currentTick);
        return;
      }
      if (picked.id === "cancel") {
        stopChallenge(player, state, system.currentTick);
        openChallengeMenu(player, state, system.currentTick);
        return;
      }
      openChallengeDetail(player, state, picked.def);
    }
  );
}

function openChallengeDetail(player, state, def) {
  const done = isCompleted(state, def.id);
  const recommended = def.recommended ? "§a(Recommended first challenge)\n" : "";
  const body = `${recommended}\n${def.description}\n\n§6Reward: §f${def.reward.text}`;
  const actions = [];
  if (!done) actions.push({ id: "start", label: "§a▶ Start challenge" });
  else actions.push({ id: "noop", label: "§a✔ Completed" });
  actions.push({ id: "back", label: "§7← Back" });

  showForm(
    player,
    state,
    () => {
      const f = new ActionFormData().title(`★ ${def.name}`).body(body);
      for (const a of actions) f.button(a.label);
      return f;
    },
    (response) => {
      const picked = actions[response.selection];
      if (picked?.id === "start") {
        const result = startChallenge(player, state, def.id, system.currentTick);
        if (!result.ok) pushMessage(player, `§c${result.message}`);
        saveNow(player, state);
      }
      openChallengeMenu(player, state, system.currentTick);
    }
  );
}

// ---------------------------------------------------------------------------
// Help (spec §17.6 — concise control guide)
// ---------------------------------------------------------------------------

export function openHelp(player, state, now) {
  const body = [
    `§l§c🕷 CONTROLS§r`,
    ``,
    `§fWeb-Shooter §7(hold item + USE):`,
    `  §8• §7Aim at a solid surface above you → web attaches`,
    `  §8• §7Forward movement pumps the swing (sprint = stronger)`,
    `  §8• §7Hold SNEAK → reel the rope in`,
    `  §8• §7Press JUMP → release with an upward launch`,
    `  §8• §7USE again → release safely`,
    ``,
    `§fWall climbing §7(any suit, while airborne):`,
    `  §8• §7Move into a wall mid-air → auto grip`,
    `  §8• §7Hold JUMP → climb up · Hold SNEAK → climb down`,
    `  §8• §7SNEAK + JUMP → leap off`,
    ``,
    `§fDodge §7(on ground): §8hold SNEAK + press JUMP → dash`,
    ``,
    `§fGadgets: §7hold the gadget item and USE it.`,
    `  §8Impact Web (dmg+stagger) · Restraint Web (immobilize)`,
    `  §8Web Pull (yank enemy / zip to surface) · Tech Pulse (AoE)`,
    `  §8Threat Scanner (extended Spider-Sense)`,
    ``,
    `§fMenus: §7USE the §fSpider Manual§7 item, or interact with a §fSuit Station§7 block.`,
    ``,
    `§fSpider-Sense: §7passive proximity alert while a suit is worn —`,
    `  §7directional arrow + distance + ping. Toggle in Settings.`,
    ``,
    `§8Notes: swing physics is an approximation tuned for stability;`,
    `§8abilities require a worn suit; fall protection is a brief web-glide`,
    `§8after releases, not permanent immunity. Touch: use the on-screen`,
    `§8USE/JUMP/SNEAK buttons — all actions map to them.`,
  ].join("\n");

  showForm(
    player,
    state,
    () => new ActionFormData().title("§e❓ Help & Controls").body(body).button("§7← Back"),
    () => openMainMenu(player, state, system.currentTick)
  );
}

// ---------------------------------------------------------------------------
// Settings (spec §17.6 — every toggle is wired to real behavior)
// ---------------------------------------------------------------------------

export function openSettings(player, state, now) {
  const s = settingsOf(state);
  showForm(
    player,
    state,
    () =>
      new ModalFormData()
        .title("§b⚙ Settings")
        .toggle("Spider-Sense alerts", { defaultValue: s.senseEnabled })
        .toggle("Spider-Sense sound", { defaultValue: s.senseSound })
        .toggle("Spider-Sense camera shake (close threats only, where supported)", { defaultValue: s.senseShake })
        .toggle("Auto wall-grip when airborne near walls", { defaultValue: s.autoClimb })
        .toggle("Reduced particles (low-end devices)", { defaultValue: s.reducedParticles })
        .toggle("Debug HUD info", { defaultValue: s.debug }),
    (response) => {
      const v = response.formValues ?? [];
      state.save.settings = {
        senseEnabled: v[0] === true,
        senseSound: v[1] === true,
        senseShake: v[2] === true,
        autoClimb: v[3] === true,
        reducedParticles: v[4] === true,
        debug: v[5] === true,
      };
      markDirty(state);
      saveNow(player, state);
      sfx(player, "MENU_CLICK");
      pushMessage(player, "§bSettings saved.");
      openMainMenu(player, state, system.currentTick);
    }
  );
}

// ---------------------------------------------------------------------------
// Suit Station interaction (spec §14.2 — one combined station)
// ---------------------------------------------------------------------------

export function openStationMenu(player, state, now) {
  settleMovement(player, state, now);
  sfx(player, "MENU_CLICK");
  const actions = [
    { id: "suits", label: "§c🕷 Suits — browse, buy & unlock", run: () => openSuitMenu(player, state, system.currentTick) },
    { id: "sparring", label: "§e⚔ Summon sparring thugs (Street Sweeper practice)", run: () => summonSparring(player, state) },
    { id: "challenges", label: "§6★ Challenges", run: () => openChallengeMenu(player, state, system.currentTick) },
    { id: "main", label: "§7Full Spider-Man menu", run: () => openMainMenu(player, state, system.currentTick) },
    { id: "close", label: "§7✖ Close", run: () => {} },
  ];
  showForm(
    player,
    state,
    () => {
      const f = new ActionFormData()
        .title("§c🕷 Suit Station")
        .body(`§7Web workshop terminal.\n§8Buy suits with materials, unlock via challenges, or spar against summoned thugs.`);
      for (const a of actions) f.button(a.label);
      return f;
    },
    (response) => {
      const action = actions[response.selection];
      if (action) action.run();
    }
  );
}

let sparringSummoner = null;
export function setSparringSummoner(fn) {
  sparringSummoner = fn;
}

function summonSparring(player, state) {
  try {
    if (typeof sparringSummoner === "function") {
      const n = sparringSummoner(player, state, system.currentTick);
      pushMessage(player, `§e⚔ ${n} sparring thug(s) summoned nearby — defeat them for the Street Sweeper challenge.`);
    } else {
      pushMessage(player, "§cSparring is unavailable right now.");
    }
  } catch (err) {
    errorThrottled("menus.summonSparring", err);
    pushMessage(player, "§cSparring summon failed.");
  }
  openStationMenu(player, state, system.currentTick);
}
