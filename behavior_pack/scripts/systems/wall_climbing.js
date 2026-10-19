// Wall-cling: sneak + right-click while looking at a vertical wall within
// reach. Look up to climb, down to descend, hold still to hang. Jump or sneak
// to let go. Horizontal drift is cancelled and the player is held to the wall
// plane with a spring, so the player cannot clip into the block.
import { CLING, WEB } from "../core/config.js";
import { isAnchorAllowed, wallNormalForFace } from "../core/anchor_rules.js";
import { computeClingImpulse, climbTargetVy, dot, sub, scale } from "../core/swing_math.js";
import { clearTraversal } from "../core/player_state.js";
import { flash } from "../ui/hud.js";
import { bump } from "./progression.js";
import { errorOnce } from "../core/diagnostics.js";

export function tryCling(player, rec) {
  if (rec.swing) return releaseSwingForCling(player, rec);
  if (rec.cling) return detach(player, rec, "manual", false);

  let hit;
  try {
    hit = player.getBlockFromViewDirection({ maxDistance: CLING.maxDistance });
  } catch (error) {
    errorOnce("cling-raycast", error);
    return;
  }
  if (!hit || !hit.block) {
    flash(player, "§7No wall in reach. Get within 2.5 blocks and aim at it.");
    return;
  }
  const normal = wallNormalForFace(hit.face);
  if (!normal) {
    flash(player, "§7Aim at a vertical wall to cling.");
    return;
  }
  const block = hit.block;
  if (!isAnchorAllowed(block.typeId, block, WEB.unsafeAnchorTypes)) {
    flash(player, "§cThat surface cannot hold a web.");
    return;
  }

  const wallBlock = { x: block.location.x, y: block.location.y, z: block.location.z };
  rec.cling = {
    wallBlock,
    center: { x: wallBlock.x + 0.5, y: wallBlock.y + 0.5, z: wallBlock.z + 0.5 },
    normal,
    ticks: 0,
    dimensionId: player.dimension.id,
    sneakArmed: !player.isSneaking,
    jumpArmed: !player.isJumping,
  };
  bump(player, "wallClimbs");
  flash(player, "§aWall-cling. §r§7Look up/down to move, jump or sneak to let go.", 80);
}

function releaseSwingForCling(player, rec) {
  clearTraversal(rec);
  flash(player, "§7Web released.", 30);
}

// Called once per tick for every player with an active cling.
export function tickCling(player, rec) {
  const c = rec.cling;
  if (!c) return;
  if (!player.isValid) {
    rec.cling = null;
    return;
  }
  if (player.dimension.id !== c.dimensionId) {
    rec.cling = null;
    return;
  }
  c.ticks += 1;
  if (c.ticks > CLING.maxTicks) return detach(player, rec, "timeout", false);

  if (player.isSneaking) {
    if (c.sneakArmed) return detach(player, rec, "manual", false);
  } else {
    c.sneakArmed = true;
  }
  if (player.isJumping) {
    if (c.jumpArmed) return detach(player, rec, "jump", true);
  } else {
    c.jumpArmed = true;
  }
  if (c.ticks > 5 && player.isOnGround) return detach(player, rec, "ground", false);

  if (c.ticks % 10 === 0) {
    const wall = player.dimension.getBlock(c.wallBlock);
    if (!wall || !wall.isSolid) return detach(player, rec, "wall lost", false);
  }

  const loc = player.location;
  const along = dot(sub(loc, c.center), c.normal);
  const offsetError = CLING.wallOffset - along;
  if (Math.abs(offsetError) > CLING.maxOffsetError) {
    return detach(player, rec, "moved away", false);
  }

  const targetVy = climbTargetVy(player.getRotation().x, CLING);
  const impulse = computeClingImpulse({
    velocity: player.getVelocity(),
    targetVy,
    normal: c.normal,
    offsetError: Math.abs(offsetError) < CLING.maxOffsetHold ? 0 : offsetError,
    stick: CLING.stickImpulse,
  });
  if (impulse.x !== 0 || impulse.y !== 0 || impulse.z !== 0) player.applyImpulse(impulse);
}

function detach(player, rec, reason, jumping) {
  const c = rec.cling;
  rec.cling = null;
  if (!c || !player.isValid) return;
  try {
    let push = scale(c.normal, CLING.pushOff);
    if (jumping) push = { x: push.x, y: CLING.jumpOff, z: push.z };
    player.applyImpulse(push);
  } catch (error) {
    errorOnce("cling-detach", error);
  }
  if (reason === "manual") flash(player, "§7Let go of the wall.", 30);
  else flash(player, `§eWall-cling ended (${reason}).`, 40);
}

export function cancelCling(player, rec, reason) {
  if (!rec.cling) return;
  if (player.isValid) detach(player, rec, reason, false);
  rec.cling = null;
}

