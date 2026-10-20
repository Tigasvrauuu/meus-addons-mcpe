#!/usr/bin/env node
// tools/build.js — packages both packs into one importable .mcaddon.
// A .mcaddon is a ZIP whose top level contains the pack folders, each with its
// manifest.json at the folder root. This tool writes STORE-method ZIP entries
// with a dependency-free writer (reproducible: fixed timestamps, sorted order)
// so builds run anywhere Node runs — including GitHub Actions (spec §26).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BP = path.join(ROOT, "behavior_pack");
const RP = path.join(ROOT, "resource_pack");
const DIST = path.join(ROOT, "dist");

const EXCLUDE_DIRS = new Set(["node_modules", ".git", "__pycache__", "dist"]);
const EXCLUDE_NAMES = new Set([".DS_Store", "Thumbs.db"]);

// ---------------------------------------------------------------- CRC32
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------- collect
function collect(dir, relDir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(e.name) || EXCLUDE_NAMES.has(e.name)) continue;
    const p = path.join(dir, e.name);
    const relHere = path.join(relDir, e.name);
    if (e.isDirectory()) out.push(...collect(p, relHere));
    else out.push({ rel: relHere, abs: p });
  }
  return out;
}

const files = [...collect(BP, "behavior_pack"), ...collect(RP, "resource_pack")].sort((a, b) =>
  a.rel < b.rel ? -1 : 1
);

// integrity pre-checks (spec §26.2)
const required = [
  "behavior_pack/manifest.json",
  "resource_pack/manifest.json",
  "behavior_pack/scripts/main.js",
];
for (const r of required) {
  if (!files.some((f) => f.rel.split(path.sep).join("/") === r)) {
    console.error(`BUILD FAILED: required entry missing: ${r}`);
    process.exit(1);
  }
}
const bpManifest = JSON.parse(fs.readFileSync(path.join(BP, "manifest.json"), "utf8"));
const rpManifest = JSON.parse(fs.readFileSync(path.join(RP, "manifest.json"), "utf8"));
const depsOnRp = (bpManifest.dependencies ?? []).some((d) => d.uuid === rpManifest.header.uuid);
if (!depsOnRp) {
  console.error("BUILD FAILED: BP manifest does not depend on the RP uuid");
  process.exit(1);
}
const version = bpManifest.header.version.join(".");

// ---------------------------------------------------------------- zip write
const FIXED_DATE = ((2026 - 1980) << 9) | (9 << 5) | 25; // deterministic DOS date
const FIXED_TIME = (12 << 11);

class Zip {
  constructor() {
    this.chunks = [];
    this.entries = [];
    this.offset = 0;
  }
  push(buf) {
    this.chunks.push(buf);
    this.offset += buf.length;
  }
  add(name, data) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: store
    local.writeUInt16LE(FIXED_TIME, 10);
    local.writeUInt16LE(FIXED_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    this.push(local);
    this.push(nameBuf);
    this.push(data);
    this.entries.push({ nameBuf, crc, size: data.length, offset: this.offset - 30 - nameBuf.length - data.length });
  }
  finalize() {
    const cdStart = this.offset;
    for (const e of this.entries) {
      const rec = Buffer.alloc(46);
      rec.writeUInt32LE(0x02014b50, 0);
      rec.writeUInt16LE(20, 4);
      rec.writeUInt16LE(20, 6);
      rec.writeUInt16LE(0, 8);
      rec.writeUInt16LE(0, 10);
      rec.writeUInt16LE(FIXED_TIME, 12);
      rec.writeUInt16LE(FIXED_DATE, 14);
      rec.writeUInt32LE(e.crc, 16);
      rec.writeUInt32LE(e.size, 20);
      rec.writeUInt32LE(e.size, 24);
      rec.writeUInt16LE(e.nameBuf.length, 28);
      rec.writeUInt16LE(0, 30); // extra len
      rec.writeUInt16LE(0, 32); // comment len
      rec.writeUInt16LE(0, 34); // disk
      rec.writeUInt16LE(0, 36); // internal attrs
      rec.writeUInt32LE(0, 38); // external attrs
      rec.writeUInt32LE(e.offset, 42);
      this.push(rec);
      this.push(e.nameBuf);
    }
    const cdSize = this.offset - cdStart;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(this.entries.length, 8);
    end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(cdSize, 12);
    end.writeUInt32LE(cdStart, 16);
    end.writeUInt16LE(0, 20);
    this.push(end);
    return Buffer.concat(this.chunks);
  }
}

const zip = new Zip();
let totalBytes = 0;
for (const f of files) {
  const data = fs.readFileSync(f.abs);
  totalBytes += data.length;
  zip.add(f.rel.split(path.sep).join("/"), data);
}
const outBuf = zip.finalize();

fs.mkdirSync(DIST, { recursive: true });
const outName = `Spider-Man-Definitive-Experience-v${version}.mcaddon`;
const outPath = path.join(DIST, outName);
fs.writeFileSync(outPath, outBuf);

console.log(`✅ .mcaddon written: ${path.relative(ROOT, outPath)}`);
console.log(`   entries: ${files.length}  raw bytes: ${totalBytes}  zip bytes: ${outBuf.length}`);
console.log(`   BP: ${bpManifest.header.name} v${version} (min engine ${bpManifest.header.min_engine_version.join(".")})`);
console.log(`   RP: ${rpManifest.header.name} v${rpManifest.header.version.join(".")}`);
console.log(`   dependency BP→RP: ${rpManifest.header.uuid}`);
// show the first entries for the report
for (const e of files.slice(0, 6)) console.log(`   • ${e.rel.split(path.sep).join("/")}`);
console.log(`   • … (${files.length - 6} more entries)`);
