// core/vec.js — PURE module (no @minecraft imports; unit-testable in Node).
// Minimal 3D vector helpers used by the physics modules. All functions are
// null/NaN-safe: they normalize garbage input to finite numbers so a single
// bad tick can never poison player velocity.

export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });

const finite = (n) => (Number.isFinite(n) ? n : 0);

export const toVec = (v) =>
  v && typeof v === "object" ? v3(finite(Number(v.x)), finite(Number(v.y)), finite(Number(v.z))) : v3();

export const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a, s) => v3(a.x * s, a.y * s, a.z * s);
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

export const lengthSq = (a) => a.x * a.x + a.y * a.y + a.z * a.z;
export const length = (a) => Math.sqrt(lengthSq(a));

export const distance = (a, b) => length(sub(a, b));

/** Unit vector; returns zero vector for degenerate input (never NaN). */
export const normalize = (a) => {
  const len = length(a);
  if (len < 1e-9) return v3();
  return v3(a.x / len, a.y / len, a.z / len);
};

/** Clamp a vector's length to maxLen (no-op when already shorter). */
export const clampLength = (a, maxLen) => {
  const len = length(a);
  if (len <= maxLen || len < 1e-9) return a;
  return scale(a, maxLen / len);
};

export const lerpVec = (a, b, t) => v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);

/** Horizontal (x,z) component only. */
export const horizontal = (a) => v3(a.x, 0, a.z);

/** Horizontal length. */
export const horizontalLength = (a) => Math.sqrt(a.x * a.x + a.z * a.z);

export const isFiniteVec = (a) =>
  !!a && Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z);

/** Component-wise min/max clamp. */
export const clampComponents = (a, min, max) =>
  v3(
    Math.min(max.x, Math.max(min.x, a.x)),
    Math.min(max.y, Math.max(min.y, a.y)),
    Math.min(max.z, Math.max(min.z, a.z))
  );
