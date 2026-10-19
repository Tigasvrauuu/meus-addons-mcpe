// Pure anchor and wall rules. Decides what a web may attach to.

// Bedrock Direction names mapped to the unit normal pointing from the block
// face back toward the player (i.e. away from the wall).
const FACE_NORMALS = Object.freeze({
  North: Object.freeze({ x: 0, y: 0, z: -1 }),
  South: Object.freeze({ x: 0, y: 0, z: 1 }),
  East: Object.freeze({ x: 1, y: 0, z: 0 }),
  West: Object.freeze({ x: -1, y: 0, z: 0 }),
});

// Returns the outward wall normal for a vertical face, or null for Up/Down.
export function wallNormalForFace(face) {
  return FACE_NORMALS[face] ?? null;
}

// A block can anchor a web if it is solid, not liquid and not a hazard.
export function isAnchorAllowed(typeId, { isSolid, isLiquid }, unsafeTypes) {
  if (typeof typeId !== "string") return false;
  if (!isSolid || isLiquid) return false;
  return !unsafeTypes.includes(typeId);
}
