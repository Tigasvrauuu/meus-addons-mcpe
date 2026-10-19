// Web-shooter traversal: attach to an anchor, swing on a rope constraint,
// steer with the camera, release with momentum. All state lives in the
// player's runtime record; no vanilla attribute is modified.
import { system } from "@minecraft/server";
import { WEB, SUITS } from "../core/config.js";
import { isAnchorAllowed } from "../core/anchor_rules.js";
import {
  computeSwingImpulse,
  computeReleaseImpulse,
  horizontal,
  length,
  sub,
} from "../core/swing_math.js";
import { getProfile } from "../core/persistence.js";
import { clearTraversal } from "../core/player_state.js";
import { flash } from "../ui/hud.js";
import { bump } from "./progression.js";
import { errorOnce } from "../core/diagnostics.js";

const THREAD_PARTICLE = "spider_man:web_thread";

function pivotOf(player) {
  const loc = player.location;
  return { x: loc.x, y: loc.y + WEB.pivotHeight, z: loc.z };
}

function suitFor(player) {
  return SUITS[getProfile(player).suit] ?? SUITS.classic;
}

export function tryLaunch(player, rec) {
  if (rec.swing) {
    releaseSwing(player, rec, "manual", true);
    return;
  }
  const now = system.currentTick;
  if (now - rec.lastSwingEnd < WEB.reattachCooldownTicks) return;

  let hit;
  try {
    hit = player.getBlockFromViewDirection({ maxDistance: WEB.maxRange });
  } catch (error) {
    errorOnce("web-raycast", error);
    return;
  }
  if (!hit || !hit.block) {
    flash(player, "§7Web missed: no anchor in range.");
    return;
  }
  const block = hit.block;
  if (!isAnchorAllowed(block.typeId, block, WEB.unsafeAnchorTypes)) {
    flash(player, "§cWeb failed: that surface cannot hold a web.");
    return;
  }

  const anchor = hit.faceLocation ?? {
    x: block.location.x + 0.5,
    y: block.location.y + 0.5,
    z: block.location.z + 0.5,
  };
  const rope = Math.min(WEB.maxRope, Math.max(WEB.minRope, length(sub(anchor, pivotOf(player)))));

  rec.swing = {
    anchor,
    anchorBlock: { x: block.location.x, y: block.location.y, z: block.location.z },
    rope,
    ticks: 0,
    dimensionId: player.dimension.id,
    lastDraw: 0,
  };
  flash(player, "§bWeb attached. §r§7Right-click again to release.", 60);
  try {
    player.playSound("random.bow");
  } catch (error) {
    // Cosmetic only.
  }
  drawThread(player, pivotOf(player), anchor);
  bump(player, "swings");
}

// Called once per tick for every player with an active swing.
export function tickSwing(player, rec) {
  const s = rec.swing;
  if (!s) return;
  if (!player.isValid) {
    rec.swing = null;
    return;
  }
  if (player.dimension.id !== s.dimensionId) {
    releaseSwing(player, rec, "dimension", false);
    return;
  }
  s.ticks += 1;
  if (s.ticks > WEB.maxSwingTicks) return releaseSwing(player, rec, "timeout", false);
  if (player.isInWater) return releaseSwing(player, rec, "water", false);
  if (s.ticks > WEB.minSwingTicksBeforeLanding && player.isOnGround) {
    return releaseSwing(player, rec, "landed", false);
  }
  if (player.isSneaking) return releaseSwing(player, rec, "manual", true);

  if (s.ticks % WEB.anchorCheckTicks === 0) {
    const anchorBlock = player.dimension.getBlock(s.anchorBlock);
    if (!anchorBlock || !isAnchorAllowed(anchorBlock.typeId, anchorBlock, WEB.unsafeAnchorTypes)) {
      return releaseSwing(player, rec, "anchor lost", false);
    }
  }

  const pivot = pivotOf(player);
  const suit = suitFor(player);
  const impulse = computeSwingImpulse({
    playerPos: pivot,
    anchor: s.anchor,
    rope: s.rope,
    velocity: player.getVelocity(),
    steerDir: horizontal(player.getViewDirection()),
    maxSpeed: WEB.maxSpeed * suit.swingSpeedMultiplier,
    steer: WEB.steerImpulse,
    pullGain: WEB.pullGain,
    pullMax: WEB.pullMax,
  });
  if (length(impulse) > 0) player.applyImpulse(impulse);

  if (s.ticks - s.lastDraw >= WEB.ropeParticleStep) {
    s.lastDraw = s.ticks;
    drawThread(player, pivot, s.anchor);
  }
}

// Ends a swing. boost=true (manual release) adds a small forward nudge so the
// release feels like a deliberate throw. Automatic ends never boost.
export function releaseSwing(player, rec, reason, boost) {
  if (!rec.swing) return;
  clearTraversal(rec);
  if (boost && player.isValid) {
    try {
      const impulse = computeReleaseImpulse({
        velocity: player.getVelocity(),
        aimDir: horizontal(player.getViewDirection()),
        boost: WEB.releaseBoost,
        maxSpeed: WEB.releaseMaxSpeed,
      });
      player.applyImpulse(impulse);
    } catch (error) {
      errorOnce("release-impulse", error);
    }
  }
  if (reason === "manual") flash(player, "§7Web released.", 30);
  else flash(player, `§eWeb released (${reason}).`, 40);
}

// Clean cancel used by menus, death, dimension change and disconnect.
export function cancelSwing(player, rec, reason) {
  if (rec.swing) releaseSwing(player, rec, reason, false);
}

function drawThread(player, from, to) {
  const dim = player.dimension;
  const span = length(sub(to, from));
  const count = Math.max(2, Math.min(8, Math.ceil(span / 1.5)));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const point = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      z: from.z + (to.z - from.z) * t,
    };
    try {
      dim.spawnParticle(THREAD_PARTICLE, point);
    } catch (error) {
      errorOnce("thread-particle", error);
      return;
    }
  }
}
