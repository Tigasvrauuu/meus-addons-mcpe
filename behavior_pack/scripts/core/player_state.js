// Runtime, per-player state. Keyed by player.id so two players never share
// a swing, a wall-cling, a cooldown or a HUD message.
//
// Nothing here survives a restart: active traversal is never saved, because
// restoring a swing or a wall-cling after a reload could leave a player stuck.

import { system } from "@minecraft/server";

const records = new Map();

export function getRecord(player) {
  let rec = records.get(player.id);
  if (!rec) {
    rec = {
      id: player.id,
      player,
      cooldowns: new Map(),
      swing: null,            // { anchor, anchorBlock, rope, ticks, dimensionId, lastDraw }
      cling: null,            // { wallBlock, center, normal, ticks, dimensionId, sneakArmed, jumpArmed }
      lastSwingEnd: -1000,
      lastUseTick: -1000,
      lastHurtTick: -1000,
      lastAlertTick: -1000,
      alertRank: 0,
      hud: { text: "", until: 0 },
    };
    records.set(player.id, rec);
  }
  rec.player = player; // refresh the reference on every event
  return rec;
}

export function allRecords() {
  return records.values();
}

export function dropRecord(playerId) {
  records.delete(playerId);
}

// Clears any active traversal without side effects. Used by every cleanup
// path (death, dimension change, menu open, disconnect). Only the state owned
// by this add-on is cleared; no vanilla attribute is ever modified, so there
// is nothing else to restore.
export function clearTraversal(rec) {
  const hadSwing = rec.swing !== null;
  const hadCling = rec.cling !== null;
  rec.swing = null;
  rec.cling = null;
  if (hadSwing) rec.lastSwingEnd = system.currentTick;
  return hadSwing || hadCling;
}

