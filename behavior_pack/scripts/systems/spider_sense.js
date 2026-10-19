// Spider-Sense: proximity detection, not prediction. It reports hostile mobs
// within a fixed radius and recent damage taken. It cannot see through walls
// or beyond the query radius, and the alerts say so only by what they report.
import { SPIDER_SENSE } from "../core/config.js";
import { getProfile } from "../core/persistence.js";
import { hostileNear } from "../core/combat.js";
import { horizontal, sub, dot } from "../core/swing_math.js";
import { flash } from "../ui/hud.js";
import { errorOnce } from "../core/diagnostics.js";

const RANK = { none: 0, nearby: 1, close: 2, impact: 3 };

export function runSense(player, rec, now) {
  if (!getProfile(player).settings.senseAlerts) return;
  let level = "none";
  let count = 0;
  let nearest = null;
  let nearestDistance = Infinity;
  try {
    const hostiles = hostileNear(player.dimension, player.location, SPIDER_SENSE.radius);
    for (const mob of hostiles) {
      if (!mob.isValid) continue;
      const d = Math.hypot(
        mob.location.x - player.location.x,
        mob.location.z - player.location.z,
      );
      count += 1;
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = mob;
      }
    }
  } catch (error) {
    errorOnce("sense-scan", error);
    return;
  }

  if (now - rec.lastHurtTick <= SPIDER_SENSE.damageAlertTicks) {
    level = "impact";
  } else if (nearest && nearestDistance <= SPIDER_SENSE.closeRadius) {
    level = "close";
  } else if (nearest) {
    level = "nearby";
  }

  const rank = RANK[level];
  if (rank === 0) {
    if (now - rec.lastAlertTick >= SPIDER_SENSE.alertCooldownTicks) rec.alertRank = 0;
    return;
  }
  const cooledDown = now - rec.lastAlertTick >= SPIDER_SENSE.alertCooldownTicks;
  if (!(rank > rec.alertRank || cooledDown)) return;

  rec.lastAlertTick = now;
  rec.alertRank = rank;
  const bearing = nearest ? bearingOf(player, nearest) : "";
  let text;
  if (level === "impact") text = "§c§lSPIDER-SENSE: DAMAGE TAKEN";
  else if (level === "close") text = `§c§lDANGER CLOSE §r§7(${count} hostile, ${bearing})`;
  else text = `§e§lSPIDER-SENSE: ${count} hostile nearby §r§7(${bearing})`;
  flash(player, text, 40);
  try {
    player.playSound("note.pling");
  } catch (error) {
    // Cosmetic only.
  }
}

// Front / behind / side relative to the camera. Uses only the sign of a dot
// product, so it does not depend on handedness conventions.
function bearingOf(player, mob) {
  const view = horizontal(player.getViewDirection());
  const toMob = horizontal(sub(mob.location, player.location));
  if (view.x === 0 && view.z === 0) return "nearby";
  const d = dot(view, toMob);
  if (d > 0.7) return "ahead";
  if (d < -0.7) return "behind";
  return "to your side";
}
