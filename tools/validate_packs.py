#!/usr/bin/env python3
"""Static validation for the Spider-Man add-on packs.

Checks performed (no Minecraft runtime needed):
  * every JSON file parses
  * manifests: format_version, valid unique UUIDs, versions, dependency links
  * script module versions match the Script API versions in the manifest
  * item / recipe / particle / texture / language references resolve
  * every "spider_man:*" identifier used by the scripts is defined by content
  * every relative JS import resolves to an existing file
  * PNG files carry a valid PNG signature and IHDR
  * no placeholder markers (TODO/FIXME/XXX) remain in shipped scripts
Exit code 0 = all checks passed, 1 = at least one failure.
"""
import json
import os
import re
import struct
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BP = os.path.join(ROOT, "behavior_pack")
RP = os.path.join(ROOT, "resource_pack")
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
SEMVER_ARR = lambda v: isinstance(v, list) and len(v) == 3 and all(isinstance(x, int) for x in v)

errors = []
checked = 0


def fail(msg):
    errors.append(msg)
    print("FAIL:", msg)


def ok(msg):
    global checked
    checked += 1
    print("ok:  ", msg)


def load_json(path):
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        ok(f"parses {os.path.relpath(path, ROOT)}")
        return data
    except (OSError, ValueError) as exc:
        fail(f"cannot parse {os.path.relpath(path, ROOT)}: {exc}")
        return None


def walk_files(base, suffix):
    out = []
    for dirpath, _dirs, files in os.walk(base):
        for name in files:
            if name.endswith(suffix):
                out.append(os.path.join(dirpath, name))
    return sorted(out)


def check_png(path):
    with open(path, "rb") as fh:
        head = fh.read(33)
    if head[:8] != b"\x89PNG\r\n\x1a\n" or head[12:16] != b"IHDR":
        fail(f"invalid PNG: {os.path.relpath(path, ROOT)}")
        return
    ok(f"valid PNG {os.path.relpath(path, ROOT)}")


# ---------------------------------------------------------------- manifests
bp_manifest = load_json(os.path.join(BP, "manifest.json"))
rp_manifest = load_json(os.path.join(RP, "manifest.json"))

uuids = []
if bp_manifest and rp_manifest:
    for label, m, expected_modules in (
        ("behavior", bp_manifest, {"data", "script"}),
        ("resource", rp_manifest, {"resources"}),
    ):
        h = m.get("header", {})
        if m.get("format_version") != 2:
            fail(f"{label} manifest format_version must be 2")
        if not UUID_RE.match(h.get("uuid", "")):
            fail(f"{label} header uuid invalid: {h.get('uuid')}")
        uuids.append(h.get("uuid"))
        if not SEMVER_ARR(h.get("version")):
            fail(f"{label} header version must be [x,y,z]")
        if not SEMVER_ARR(h.get("min_engine_version")):
            fail(f"{label} min_engine_version must be [x,y,z]")
        types = {mod.get("type") for mod in m.get("modules", [])}
        if not expected_modules.issubset(types):
            fail(f"{label} manifest missing modules {expected_modules - types}")
        for mod in m.get("modules", []):
            if not UUID_RE.match(mod.get("uuid", "")):
                fail(f"{label} module uuid invalid: {mod.get('uuid')}")
            uuids.append(mod.get("uuid"))
            if not SEMVER_ARR(mod.get("version")):
                fail(f"{label} module version must be [x,y,z]")
    if len(set(uuids)) != len(uuids):
        fail("duplicate UUIDs across manifests")
    else:
        ok("all manifest UUIDs are valid and unique")

    # The behavior pack must depend on the resource pack by its header UUID.
    rp_uuid = rp_manifest["header"]["uuid"]
    dep_uuids = [d.get("uuid") for d in bp_manifest.get("dependencies", [])]
    if rp_uuid in dep_uuids:
        ok("behavior pack depends on resource pack UUID")
    else:
        fail("behavior pack does not depend on the resource pack UUID")

    # Script API versions must match the ones the project was built against.
    deps = {d.get("module_name"): d.get("version") for d in bp_manifest.get("dependencies", []) if "module_name" in d}
    expected = {
        "@minecraft/server": "2.11.0-beta.1.26.52-stable",
        "@minecraft/server-ui": "2.3.0-beta.1.26.52-stable",
    }
    for name, version in expected.items():
        if deps.get(name) == version:
            ok(f"{name} pinned to {version}")
        else:
            fail(f"{name} version is {deps.get(name)!r}, expected {version!r}")

    script_mods = [m for m in bp_manifest.get("modules", []) if m.get("type") == "script"]
    if script_mods and script_mods[0].get("language") == "javascript":
        entry = os.path.join(BP, script_mods[0].get("entry", ""))
        if os.path.isfile(entry):
            ok(f"script entry exists: {script_mods[0]['entry']}")
        else:
            fail(f"script entry missing: {script_mods[0].get('entry')}")
    else:
        fail("behavior pack must declare a javascript script module")

# ---------------------------------------------------------------- all JSON
json_files = walk_files(BP, ".json") + walk_files(RP, ".json")
parsed = {}
for path in json_files:
    if path.endswith(("manifest.json",)):
        continue  # already parsed above
    parsed[path] = load_json(path)

# ---------------------------------------------------------------- items
item_ids = set()
item_textures = {}
for path in walk_files(os.path.join(BP, "items"), ".json"):
    data = parsed.get(path)
    if not data:
        continue
    comp = data.get("minecraft:item", {})
    ident = comp.get("description", {}).get("identifier")
    if not ident or not ident.startswith("spider_man:"):
        fail(f"item identifier missing or not namespaced: {os.path.relpath(path, ROOT)}")
        continue
    item_ids.add(ident)
    icon = comp.get("components", {}).get("minecraft:icon", {}).get("textures", {}).get("default")
    display = comp.get("components", {}).get("minecraft:display_name", {}).get("value")
    item_textures[ident] = icon
    if not icon:
        fail(f"item {ident} has no icon")
    if not display or not display.startswith("item."):
        fail(f"item {ident} display_name must be a localization key")
    ok(f"item definition {ident}")

# texture atlas
atlas_path = os.path.join(RP, "textures", "item_texture.json")
atlas = parsed.get(atlas_path)
if atlas:
    tex = atlas.get("texture_data", {})
    for name, entry in tex.items():
        png = os.path.join(RP, entry.get("textures", "") + ".png")
        if os.path.isfile(png):
            ok(f"atlas texture {name} exists")
        else:
            fail(f"atlas texture {name} missing file {entry.get('textures')}.png")
    for ident, icon in item_textures.items():
        if icon not in tex:
            fail(f"item {ident} icon '{icon}' not in item_texture.json")

# ---------------------------------------------------------------- recipes
for path in walk_files(os.path.join(BP, "recipes"), ".json"):
    data = parsed.get(path)
    if not data:
        continue
    recipe = data.get("minecraft:recipe_shaped")
    if not recipe:
        fail(f"unsupported recipe type in {os.path.relpath(path, ROOT)}")
        continue
    result = recipe.get("result", {}).get("item")
    if result not in item_ids:
        fail(f"recipe output {result} is not defined")
    pattern = recipe.get("pattern", [])
    keys = recipe.get("key", {})
    for row in pattern:
        for ch in row:
            if ch != " " and ch not in keys:
                fail(f"recipe {os.path.basename(path)} pattern key '{ch}' undefined")
    for key, value in keys.items():
        item = value.get("item", "")
        if item.startswith("spider_man:") and item not in item_ids:
            fail(f"recipe ingredient {item} is not defined")
    ok(f"recipe {os.path.basename(path)} resolves")

# ---------------------------------------------------------------- particles
particle_ids = set()
for path in walk_files(os.path.join(RP, "particles"), ".json"):
    data = parsed.get(path)
    if not data:
        continue
    desc = data.get("particle_effect", {}).get("description", {})
    particle_ids.add(desc.get("identifier"))
    texture = desc.get("basic_render_parameters", {}).get("texture")
    if texture and os.path.isfile(os.path.join(RP, texture + ".png")):
        ok(f"particle texture {texture} exists")
    else:
        fail(f"particle texture missing: {texture}")

# ---------------------------------------------------------------- language
lang_path = os.path.join(RP, "texts", "en_US.lang")
lang_keys = set()
if os.path.isfile(lang_path):
    with open(lang_path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                lang_keys.add(line.split("=", 1)[0])
    ok("en_US.lang readable")
else:
    fail("resource_pack/texts/en_US.lang missing")
langs = parsed.get(os.path.join(RP, "texts", "languages.json"))
if langs is not None and "en_US" in langs:
    ok("languages.json lists en_US")
else:
    fail("languages.json must list en_US")
for ident in item_ids:
    key = f"item.{ident}.name"
    if key in lang_keys:
        ok(f"lang key {key}")
    else:
        fail(f"missing lang key {key}")

# ---------------------------------------------------------------- png
for path in walk_files(RP, ".png") + walk_files(BP, ".png"):
    check_png(path)

# ---------------------------------------------------------------- scripts
script_root = os.path.join(BP, "scripts")
js_files = walk_files(script_root, ".js")
ident_re = re.compile(r"""["'](spider_man:[a-z_]+)["']""")
used_idents = set()
import_re = re.compile(r"""from\s+["'](\.[^"']+)["']""")
for path in js_files:
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    for match in ident_re.findall(text):
        used_idents.add(match)
    for match in import_re.findall(text):
        target = os.path.normpath(os.path.join(os.path.dirname(path), match))
        if not os.path.isfile(target):
            fail(f"broken import '{match}' in {os.path.relpath(path, ROOT)}")
    if re.search(r"\b(TODO|FIXME|XXX|PLACEHOLDER)\b", text):
        fail(f"placeholder marker in {os.path.relpath(path, ROOT)}")
ok(f"checked imports and markers in {len(js_files)} script files")

for ident in sorted(used_idents):
    if ident.startswith("spider_man:") and ident.count(":") == 1:
        if ident in item_ids or ident in particle_ids:
            ok(f"script identifier {ident} defined")
        elif ident == "spider_man:profile":
            continue  # dynamic property key, not content
        else:
            fail(f"script uses undefined identifier {ident}")

for ident in sorted(particle_ids):
    if ident and ident not in used_idents:
        print("note: particle", ident, "is defined but unused by scripts")

# ---------------------------------------------------------------- summary
print()
print(f"Checks passed: {checked}, failures: {len(errors)}")
sys.exit(1 if errors else 0)
