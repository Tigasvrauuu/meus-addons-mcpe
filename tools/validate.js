#!/usr/bin/env node
// tools/validate.js — static validator for the add-on (spec §25.1).
// Checks JSON validity, manifests, UUIDs, cross-references (items ↔ icons ↔
// textures ↔ lang ↔ recipes ↔ entities ↔ particles ↔ attachables), script
// syntax + import graph, and pure-module boundaries. Exits non-zero on any
// ERROR; WARNINGS are informational.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BP = path.join(ROOT, "behavior_pack");
const RP = path.join(ROOT, "resource_pack");

const errors = [];
const warnings = [];
const stats = { json: 0, checks: 0 };

const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const check = () => (stats.checks += 1);

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

function readJson(p) {
  stats.json += 1;
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, "utf8")) };
  } catch (e) {
    err(`JSON parse failed: ${rel(p)} — ${e.message}`);
    return { ok: false, data: null };
  }
}

// --------------------------------------------------------------------------
// 1. JSON inventory + manifests
// --------------------------------------------------------------------------
const allJson = [...walk(BP, [".json"]), ...walk(RP, [".json"])];
const jsonByRel = new Map();
for (const p of allJson) {
  const r = readJson(p);
  jsonByRel.set(rel(p), r.data);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const bpManifest = jsonByRel.get("behavior_pack/manifest.json");
const rpManifest = jsonByRel.get("resource_pack/manifest.json");
check();
if (!bpManifest || !rpManifest) {
  err("Missing behavior or resource manifest.json");
} else {
  const uuids = new Set();
  for (const [label, m] of [["BP", bpManifest], ["RP", rpManifest]]) {
    check();
    if (m.format_version !== 2) err(`${label} manifest format_version must be 2`);
    const h = m.header ?? {};
    for (const k of ["name", "description", "uuid"]) if (!h[k]) err(`${label} manifest header missing ${k}`);
    if (!UUID_RE.test(h.uuid ?? "")) err(`${label} header uuid invalid: ${h.uuid}`);
    if (uuids.has(h.uuid)) err(`${label} header uuid duplicate`);
    uuids.add(h.uuid);
    if (!Array.isArray(h.version) || h.version.length !== 3) err(`${label} header version malformed`);
    if (!Array.isArray(h.min_engine_version)) err(`${label} min_engine_version missing`);
    for (const mod of m.modules ?? []) {
      if (!UUID_RE.test(mod.uuid ?? "")) err(`${label} module uuid invalid`);
      if (uuids.has(mod.uuid)) err(`${label} module uuid duplicate`);
      uuids.add(mod.uuid);
      if (mod.entry) {
        const entryPath = path.join(ROOT, label === "BP" ? "behavior_pack" : "resource_pack", mod.entry);
        check();
        if (!fs.existsSync(entryPath)) err(`${label} manifest entry file missing: ${mod.entry}`);
      }
    }
  }
  // BP must depend on RP (uuid + version match) and on the script APIs
  check();
  const rpDep = (bpManifest.dependencies ?? []).find((d) => d.uuid === rpManifest.header.uuid);
  if (!rpDep) err("BP manifest must depend on the RP uuid");
  else if (JSON.stringify(rpDep.version) !== JSON.stringify(rpManifest.header.version)) {
    err("BP→RP dependency version mismatch");
  }
  const mods = (bpManifest.dependencies ?? []).filter((d) => d.module_name);
  const names = mods.map((d) => d.module_name);
  if (!names.includes("@minecraft/server")) err("BP must depend on @minecraft/server");
  if (!names.includes("@minecraft/server-ui")) err("BP must depend on @minecraft/server-ui");
  for (const d of mods) {
    if (!/^\d+\.\d+\.\d+$/.test(d.version ?? "")) err(`dependency ${d.module_name} version not semver: ${d.version}`);
  }
}

// --------------------------------------------------------------------------
// 2. defined identifiers
// --------------------------------------------------------------------------
const itemDefs = new Map(); // id -> rel path
for (const p of walk(path.join(BP, "items"), [".json"])) {
  const d = jsonByRel.get(rel(p));
  const id = d?.["minecraft:item"]?.description?.identifier;
  if (!id) err(`item file without identifier: ${rel(p)}`);
  else itemDefs.set(id, rel(p));
}
const blockDefs = new Map();
for (const p of walk(path.join(BP, "blocks"), [".json"])) {
  const id = jsonByRel.get(rel(p))?.["minecraft:block"]?.description?.identifier;
  if (!id) err(`block file without identifier: ${rel(p)}`);
  else blockDefs.set(id, rel(p));
}
const entityDefs = new Map();
for (const p of walk(path.join(BP, "entities"), [".json"])) {
  const id = jsonByRel.get(rel(p))?.["minecraft:entity"]?.description?.identifier;
  if (!id) err(`entity file without identifier: ${rel(p)}`);
  else entityDefs.set(id, rel(p));
}
const particleDefs = new Set();
for (const p of walk(path.join(RP, "particles"), [".json"])) {
  const id = jsonByRel.get(rel(p))?.particle_effect?.description?.identifier;
  if (!id) err(`particle file without identifier: ${rel(p)}`);
  else particleDefs.add(id);
}
const lootDefs = new Set(
  walk(path.join(BP, "loot_tables"), [".json"]).map((p) => rel(p).replace(/^behavior_pack\//, ""))
);
const recipeResults = [];
const recipeIngredients = [];
for (const p of walk(path.join(BP, "recipes"), [".json"])) {
  const r = jsonByRel.get(rel(p))?.["minecraft:recipe_shaped"];
  if (!r) { err(`recipe file missing minecraft:recipe_shaped: ${rel(p)}`); continue; }
  const res = r.result;
  if (typeof res?.item === "string") recipeResults.push(res.item);
  else err(`recipe ${rel(p)} has no result item`);
  for (const [k, v] of Object.entries(r.key ?? {})) {
    if (typeof v?.item === "string") recipeIngredients.push(v.item);
    else err(`recipe ${rel(p)} key ${k} invalid`);
  }
  for (const u of r.unlock ?? []) if (typeof u?.item === "string") recipeIngredients.push(u.item);
}

// --------------------------------------------------------------------------
// 3. textures & atlases
// --------------------------------------------------------------------------
const itemAtlas = jsonByRel.get("resource_pack/textures/item_texture.json") ?? {};
const terrainAtlas = jsonByRel.get("resource_pack/textures/terrain_texture.json") ?? {};
const itemAtlasKeys = new Set(Object.keys(itemAtlas.texture_data ?? {}));
const terrainAtlasKeys = new Set(Object.keys(terrainAtlas.texture_data ?? {}));

function textureExists(texPath) {
  check();
  const candidates = [path.join(RP, `${texPath}.png`), path.join(RP, texPath)];
  return candidates.some((c) => fs.existsSync(c));
}
for (const [key, val] of Object.entries(itemAtlas.texture_data ?? {})) {
  const t = typeof val.textures === "string" ? val.textures : val.textures?.default;
  if (!t) err(`item_texture entry ${key} has no texture path`);
  else if (!textureExists(t)) err(`item_texture ${key} → missing file ${t}.png`);
}
for (const [key, val] of Object.entries(terrainAtlas.texture_data ?? {})) {
  const t = typeof val.textures === "string" ? val.textures : val.textures?.default;
  if (!t) err(`terrain_texture entry ${key} has no texture path`);
  else if (!textureExists(t)) err(`terrain_texture ${key} → missing file ${t}.png`);
}

// items reference atlas keys
for (const [id, p] of itemDefs) {
  const icon = jsonByRel.get(p)?.["minecraft:item"]?.components?.["minecraft:icon"];
  const key = typeof icon === "string" ? icon : icon?.textures?.default;
  check();
  if (!key) err(`item ${id} missing icon`);
  else if (!itemAtlasKeys.has(key)) err(`item ${id} icon "${key}" not in item_texture.json`);
}
// blocks reference terrain atlas keys
for (const [id, p] of blockDefs) {
  const mats = jsonByRel.get(p)?.["minecraft:block"]?.components?.["minecraft:material_instances"];
  check();
  if (!mats) err(`block ${id} missing material_instances`);
  else {
    for (const [face, m] of Object.entries(mats)) {
      if (!terrainAtlasKeys.has(m.texture)) err(`block ${id} face ${face} texture "${m.texture}" not in terrain_texture.json`);
    }
  }
}

// --------------------------------------------------------------------------
// 4. lang keys
// --------------------------------------------------------------------------
const langs = {};
for (const code of ["en_US", "pt_BR"]) {
  const p = path.join(RP, "texts", `${code}.lang`);
  if (!fs.existsSync(p)) { err(`missing lang file ${code}`); continue; }
  langs[code] = new Map(
    fs.readFileSync(p, "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
  );
}
const langCodesFile = jsonByRel.get("resource_pack/texts/languages.json");
check();
if (!Array.isArray(langCodesFile) || langCodesFile.length !== Object.keys(langs).length) {
  err("languages.json must list exactly the shipped lang files");
}
function needLang(key) {
  for (const code of Object.keys(langs)) {
    check();
    if (!langs[code].has(key)) err(`lang ${code} missing key ${key}`);
  }
}
for (const id of itemDefs.keys()) needLang(`item.${id}.name`);
for (const id of blockDefs.keys()) needLang(`tile.${id}.name`);
for (const id of entityDefs.keys()) needLang(`entity.${id}.name`);
// lang key parity between languages
if (langs.en_US && langs.pt_BR) {
  for (const k of langs.en_US.keys()) if (!langs.pt_BR.has(k)) warn(`pt_BR missing key ${k}`);
  for (const k of langs.pt_BR.keys()) if (!langs.en_US.has(k)) warn(`en_US missing key ${k}`);
}

// --------------------------------------------------------------------------
// 5. entity client / geometry / animations / render controllers / attachables
// --------------------------------------------------------------------------
const geoIds = new Set();
for (const p of walk(path.join(RP, "models"), [".json"])) {
  const d = jsonByRel.get(rel(p));
  for (const g of d?.["minecraft:geometry"] ?? []) geoIds.add(g.description?.identifier);
}
const animIds = new Set();
for (const p of walk(path.join(RP, "animations"), [".json"])) {
  Object.keys(jsonByRel.get(rel(p))?.animations ?? {}).forEach((a) => animIds.add(a));
}
const rcIds = new Set();
for (const p of walk(path.join(RP, "render_controllers"), [".json"])) {
  Object.keys(jsonByRel.get(rel(p))?.render_controllers ?? {}).forEach((r) => rcIds.add(r));
}

for (const p of walk(path.join(RP, "entity"), [".json"])) {
  const desc = jsonByRel.get(rel(p))?.["minecraft:client_entity"]?.description;
  if (!desc) { err(`client entity without description: ${rel(p)}`); continue; }
  const id = desc.identifier;
  check();
  if (!entityDefs.has(id)) err(`client entity ${id} has no behavior definition`);
  for (const g of Object.values(desc.geometry ?? {})) {
    if (!geoIds.has(g)) err(`entity ${id} geometry ${g} undefined`);
  }
  for (const t of Object.values(desc.textures ?? {})) {
    if (!textureExists(t)) err(`entity ${id} texture ${t} missing`);
  }
  for (const a of Object.values(desc.animations ?? {})) {
    if (!animIds.has(a)) err(`entity ${id} animation ${a} undefined`);
  }
  for (const r of desc.render_controllers ?? []) {
    if (!rcIds.has(r)) err(`entity ${id} render controller ${r} undefined`);
  }
  const egg = desc.spawn_egg?.texture;
  if (egg) {
    check();
    if (!itemAtlasKeys.has(egg)) err(`entity ${id} spawn_egg texture "${egg}" not in item_texture.json`);
  }
  for (const a of desc.scripts?.animate ?? []) {
    if (!animIds.has(a) && !Object.keys(desc.animations ?? {}).includes(a)) {
      // animate entries may reference animation short names from `animations` map
      warn(`entity ${id} animates unknown short name "${a}"`);
    }
  }
}

// attachables: identifier must equal a suit item id; refs must resolve
const attachIds = new Set();
for (const p of walk(path.join(RP, "attachables"), [".json"])) {
  const desc = jsonByRel.get(rel(p))?.["minecraft:attachable"]?.description;
  if (!desc) { err(`attachable without description: ${rel(p)}`); continue; }
  attachIds.add(desc.identifier);
  check();
  if (!itemDefs.has(desc.identifier)) err(`attachable ${desc.identifier} does not match any item id`);
  for (const g of Object.values(desc.geometry ?? {})) if (!geoIds.has(g)) err(`attachable ${desc.identifier} geometry ${g} undefined`);
  for (const [k, t] of Object.entries(desc.textures ?? {})) {
    if (k === "enchanted") continue;
    if (!textureExists(t)) err(`attachable ${desc.identifier} texture ${t} missing`);
  }
  for (const r of desc.render_controllers ?? []) if (!rcIds.has(r)) err(`attachable ${desc.identifier} rc ${r} undefined`);
}
// every wearable suit item should have an attachable
for (const id of itemDefs.keys()) {
  if (id.includes("suit_") && !attachIds.has(id)) err(`suit item ${id} has no attachable (would render invisible when worn)`);
}

// particle textures exist + identifiers referenced by scripts are defined
for (const p of walk(path.join(RP, "particles"), [".json"])) {
  const t = jsonByRel.get(rel(p))?.particle_effect?.description?.basic_render_parameters?.texture;
  if (t && !textureExists(t)) err(`particle ${rel(p)} texture ${t} missing`);
}

// --------------------------------------------------------------------------
// 6. recipes / loot cross-refs
// --------------------------------------------------------------------------
const knownVanillaPrefixes = new Set(["minecraft:"]);
function idExists(id) {
  if (itemDefs.has(id) || blockDefs.has(id) || entityDefs.has(id)) return true;
  if (knownVanillaPrefixes.has(id.split(":")[0] + ":")) return true; // vanilla ids accepted
  return false;
}
for (const id of recipeResults) { check(); if (!itemDefs.has(id) && !blockDefs.has(id)) err(`recipe result not defined in pack: ${id}`); }
for (const id of recipeIngredients) { check(); if (!idExists(id)) err(`recipe ingredient unknown: ${id}`); }
for (const [id, p] of entityDefs) {
  const loot = jsonByRel.get(p)?.["minecraft:entity"]?.components?.["minecraft:loot"]?.table;
  if (loot) { check(); if (!lootDefs.has(loot)) err(`entity ${id} loot table missing: ${loot}`); }
}

// --------------------------------------------------------------------------
// 7. scripts: syntax, import graph, ids referenced, pure-module boundary
// --------------------------------------------------------------------------
const scriptFiles = walk(path.join(BP, "scripts"), [".js"]);
if (scriptFiles.length === 0) err("no scripts found");
for (const p of scriptFiles) {
  const res = spawnSync(process.execPath, ["--check", p], { encoding: "utf8" });
  check();
  if (res.status !== 0) err(`script syntax error: ${rel(p)}\n${(res.stderr ?? "").slice(0, 600)}`);
}

// "smx:data" is the world dynamic-property key used by core/save.js — a
// runtime data identifier, not a pack content id (documented in README).
const RUNTIME_IDS = new Set(["smx:data"]);
const definedIds = new Set([...itemDefs.keys(), ...blockDefs.keys(), ...entityDefs.keys(), ...particleDefs, ...RUNTIME_IDS]);
for (const p of scriptFiles) {
  const src = fs.readFileSync(p, "utf8");
  // every smx:* string literal in scripts must be a defined content id
  for (const m of src.matchAll(/["'`](smx:[a-z_0-9]+)["'`]/g)) {
    check();
    if (!definedIds.has(m[1])) err(`script ${rel(p)} references undefined content id ${m[1]}`);
  }
  // relative imports resolve
  for (const m of src.matchAll(/from\s+"(\.[^"]+)"/g)) {
    const target = path.resolve(path.dirname(p), m[1]);
    check();
    if (!fs.existsSync(target)) err(`script ${rel(p)} imports missing file ${m[1]}`);
  }
}

// pure modules (unit-tested in Node) must not import @minecraft/*
const PURE = [
  "behavior_pack/scripts/core/vec.js",
  "behavior_pack/scripts/core/utils.js",
  "behavior_pack/scripts/core/cooldowns.js",
  "behavior_pack/scripts/core/config.js",
  "behavior_pack/scripts/core/constants.js",
  "behavior_pack/scripts/core/save_schema.js",
  "behavior_pack/scripts/systems/swing_math.js",
  "behavior_pack/scripts/systems/climb_math.js",
  "behavior_pack/scripts/systems/restraint_rules.js",
  "behavior_pack/scripts/systems/challenge_rules.js",
];
for (const p of PURE) {
  const full = path.join(ROOT, p);
  check();
  if (!fs.existsSync(full)) { err(`declared pure module missing: ${p}`); continue; }
  const src = fs.readFileSync(full, "utf8");
  const importsMc = src.split(/\r?\n/).some((line) =>
    /^\s*(import|export)\b.*from\s*["']@minecraft\//.test(line) || /^\s*import\s*["']@minecraft\//.test(line)
  );
  if (importsMc) err(`pure module ${p} must not import @minecraft (breaks Node tests)`);
  const res = spawnSync(process.execPath, ["--check", full], { encoding: "utf8" });
  if (res.status !== 0) err(`pure module syntax error: ${p}`);
  // importable by Node (the tests do exactly this)
  const imp = spawnSync(process.execPath, ["-e", `import('${path.join(ROOT, p).replace(/\\/g, "/")}')`], { encoding: "utf8" });
  if (imp.status !== 0) err(`pure module not importable in Node: ${p}\n${(imp.stderr ?? "").slice(0, 400)}`);
}

// --------------------------------------------------------------------------
// report
// --------------------------------------------------------------------------
const lines = [];
lines.push("Spider-Man: Definitive Experience — static validation report");
lines.push(`date: ${new Date().toISOString()}`);
lines.push(`json files parsed: ${stats.json}`);
lines.push(`checks executed:   ${stats.checks}`);
lines.push(`items: ${itemDefs.size}, blocks: ${blockDefs.size}, entities: ${entityDefs.size}, particles: ${particleDefs.size}, recipes: ${recipeResults.length}, scripts: ${scriptFiles.length}`);
lines.push("");
if (warnings.length) {
  lines.push(`WARNINGS (${warnings.length}):`);
  for (const w of warnings) lines.push(`  ⚠ ${w}`);
  lines.push("");
}
if (errors.length) {
  lines.push(`ERRORS (${errors.length}):`);
  for (const e of errors) lines.push(`  ✗ ${e}`);
} else {
  lines.push("ERRORS: none — all static checks passed.");
}
const report = lines.join("\n");
console.log(report);

const outArg = process.argv[2];
if (outArg === "--report" && process.argv[3]) {
  const dest = path.resolve(process.argv[3]);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, report + "\n");
}
process.exit(errors.length ? 1 : 0);
