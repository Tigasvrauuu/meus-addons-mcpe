// core/input.js — cross-platform input reading (spec §18).
// Uses the stable player.inputInfo API (buttons + movement vector, works on
// keyboard/gamepad/touch — verified present in @minecraft/server 2.9.0) with
// edge detection, and falls back to isJumping/isSneaking/isSprinting flags if
// inputInfo is unavailable or throws on a given platform.

import { errorThrottled } from "./logger.js";

let InputButtonRef = null;
let ButtonStateRef = null;

/** Late-binds the enums (kept optional so tests/older hosts don't explode). */
export function initInput(serverModule) {
  try {
    InputButtonRef = serverModule?.InputButton ?? null;
    ButtonStateRef = serverModule?.ButtonState ?? null;
  } catch {
    InputButtonRef = null;
    ButtonStateRef = null;
  }
}

function buttonState(player, button) {
  try {
    if (!InputButtonRef || !ButtonStateRef) return null;
    return player.inputInfo?.getButtonState?.(button) ?? null;
  } catch {
    return null;
  }
}

/** True while the jump button is held (any platform). */
export function jumpHeld(player) {
  const st = buttonState(player, InputButtonRef?.Jump);
  if (st !== null) return st === ButtonStateRef?.Pressed;
  try {
    return !!player.isJumping;
  } catch {
    return false;
  }
}

/** True while the sneak button is held. */
export function sneakHeld(player) {
  const st = buttonState(player, InputButtonRef?.Sneak);
  if (st !== null) return st === ButtonStateRef?.Pressed;
  try {
    return !!player.isSneaking;
  } catch {
    return false;
  }
}

/**
 * Edge detection for the jump button. `state.input` stores the previous raw
 * level so a single press yields exactly one "pressed" tick even if the main
 * loop hiccups.
 */
export function jumpPressed(state, player) {
  const held = jumpHeld(player);
  const prev = state.input?.jumpPrev ?? false;
  if (!state.input) state.input = {};
  state.input.jumpPrev = held;
  return held && !prev;
}

export function sneakPressed(state, player) {
  const held = sneakHeld(player);
  const prev = state.input?.sneakPrev ?? false;
  if (!state.input) state.input = {};
  state.input.sneakPrev = held;
  return held && !prev;
}

/**
 * Forward/backward movement input as -1..1 (positive = forward).
 * inputInfo.getMovementVector() returns the real analog input on every
 * platform; when unavailable we approximate with the sprint flag so pumping
 * still works ("sprint to pump").
 */
export function forwardInput(player) {
  try {
    const mv = player.inputInfo?.getMovementVector?.();
    if (mv && Number.isFinite(mv.y)) {
      // Bedrock movement vector: y = forward(+)/back(-); clamp to -1..1.
      return Math.min(1, Math.max(-1, mv.y));
    }
  } catch (err) {
    errorThrottled("input.forwardInput", err);
  }
  try {
    return player.isSprinting ? 1 : 0;
  } catch {
    return 0;
  }
}

export function sprinting(player) {
  try {
    return !!player.isSprinting;
  } catch {
    return false;
  }
}

export function onGround(player) {
  try {
    return !!player.isOnGround;
  } catch {
    return false;
  }
}

export function inWater(player) {
  try {
    return !!player.isInWater;
  } catch {
    return false;
  }
}

/** Which input device the player last used (for docs/debug only). */
export function lastInputMode(player) {
  try {
    return player.inputInfo?.lastInputModeUsed ?? "unknown";
  } catch {
    return "unknown";
  }
}
