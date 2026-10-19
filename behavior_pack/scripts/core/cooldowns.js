// Pure cooldown bookkeeping. A cooldown is stored as "ready at tick N".
// Starting the same cooldown twice overwrites one entry, so repeated
// activations never create duplicate timers.

export function isReady(cooldowns, id, nowTick) {
  const readyAt = cooldowns.get(id);
  return readyAt === undefined || nowTick >= readyAt;
}

export function remainingTicks(cooldowns, id, nowTick) {
  const readyAt = cooldowns.get(id);
  if (readyAt === undefined) return 0;
  return Math.max(0, readyAt - nowTick);
}

export function startCooldown(cooldowns, id, nowTick, ticks) {
  const safeTicks = Number.isFinite(ticks) && ticks > 0 ? Math.round(ticks) : 0;
  cooldowns.set(id, nowTick + safeTicks);
}

// Drops expired entries so long sessions do not grow the map forever.
export function pruneCooldowns(cooldowns, nowTick) {
  for (const [id, readyAt] of cooldowns) {
    if (readyAt <= nowTick) cooldowns.delete(id);
  }
}
