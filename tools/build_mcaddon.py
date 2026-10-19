#!/usr/bin/env python3
"""Builds the importable .mcaddon for the Spider-Man add-on.

A .mcaddon is a ZIP archive containing one folder per pack. Each folder holds
that pack's manifest.json and assets. Bedrock imports both packs in one step
when the archive is opened (or the file is double-clicked).

Output: dist/<name>.mcaddon  (not committed; built by GitHub Actions)
Usage:  python3 tools/build_mcaddon.py [--version X.Y.Z]
"""
import argparse
import hashlib
import json
import os
import sys
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PACKS = [
    ("behavior_pack", "Spider-Man_BP"),
    ("resource_pack", "Spider-Man_RP"),
]
EXCLUDE_NAMES = {".DS_Store", "Thumbs.db"}
EXCLUDE_DIRS = {"__pycache__", "node_modules", ".git"}


def pack_version(pack_dir):
    with open(os.path.join(ROOT, pack_dir, "manifest.json"), encoding="utf-8") as fh:
        return ".".join(str(x) for x in json.load(fh)["header"]["version"])


def collect(pack_dir, arc_root):
    base = os.path.join(ROOT, pack_dir)
    entries = []
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDE_DIRS)
        for name in sorted(filenames):
            if name in EXCLUDE_NAMES or name.endswith((".pyc", ".log")):
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, base).replace(os.sep, "/")
            entries.append((full, f"{arc_root}/{rel}"))
    return entries


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", default=os.path.join(ROOT, "dist"))
    parser.add_argument("--version", default=None, help="Override the version in the file name")
    args = parser.parse_args()

    version = args.version or pack_version("behavior_pack")
    os.makedirs(args.out_dir, exist_ok=True)
    out_path = os.path.join(args.out_dir, f"SpiderMan-Definitive-Experience-v{version}.mcaddon")
    if os.path.exists(out_path):
        os.remove(out_path)

    entries = []
    for pack_dir, arc_root in PACKS:
        entries.extend(collect(pack_dir, arc_root))

    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for full, arc in entries:
            archive.write(full, arc)

    # Read the archive back to prove it opens and contains both manifests.
    with zipfile.ZipFile(out_path) as archive:
        names = archive.namelist()
        bad = archive.testzip()
        if bad is not None:
            print(f"Corrupt member in archive: {bad}", file=sys.stderr)
            return 1
        for required in ("Spider-Man_BP/manifest.json", "Spider-Man_RP/manifest.json",
                         "Spider-Man_BP/scripts/main.js"):
            if required not in names:
                print(f"Missing required entry: {required}", file=sys.stderr)
                return 1

    digest = hashlib.sha256(open(out_path, "rb").read()).hexdigest()
    print(f"Built {os.path.relpath(out_path, ROOT)} ({len(names)} entries)")
    print(f"sha256 {digest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
