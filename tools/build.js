import fs from "fs";
import path from "path";
import {execSync} from "child_process";

const version = "1.0.0";
const outDir = "dist";
const packs = ["behavior_pack","resource_pack"];
const addonName = `SPIDER_MAN_DE_v${version}.mcaddon`;
const addonPath = path.join(outDir, addonName);

function rmRecursive(p){
  if(fs.existsSync(p)) fs.rmSync(p, {recursive:true, force:true});
}
function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p,{recursive:true}); }

ensureDir(outDir);
rmRecursive(path.join(outDir, "tmp_build"));
ensureDir(path.join(outDir,"tmp_build"));

console.log("→ Validating JSON...");
try{ execSync("node tools/validate.js", {stdio:"inherit"}); }catch(e){ console.error("Validation failed"); process.exit(1); }

console.log("→ Preparing mcaddon structure...");
const tmp = path.join(outDir,"tmp_build");
// copy packs
for(const pack of packs){
  const dest = path.join(tmp, pack);
  ensureDir(path.dirname(dest));
  // copy via cp
  execSync(`cp -r ${pack} "${dest}"`, {stdio:"inherit"});
  // remove unwanted
  execSync(`find "${dest}" -name "*.psd" -o -name "*.xcf" -delete`, {stdio:"inherit"});
  // remove .DS_Store
  execSync(`find "${dest}" -name ".DS_Store" -delete`, {stdio:"inherit"});
}

// Ensure packs have valid manifests
for(const pack of packs){
  const mf = path.join(tmp, pack, "manifest.json");
  if(!fs.existsSync(mf)) { console.error(`Missing ${mf}`); process.exit(1); }
}

// Create .mcaddon (zip with two pack folders at root)
console.log("→ Creating .mcaddon archive...");
rmRecursive(addonPath);
execSync(`cd "${tmp}" && zip -r "${path.resolve(addonPath)}" ${packs.join(" ")} -x "*.git*" -x "*__MACOSX*"`, {stdio:"inherit"});
let stats = fs.statSync(addonPath);
console.log(`✓ Created ${addonPath} (${(stats.size/1024).toFixed(1)} KB)`);

// Also create separate .mcpack zips
for(const pack of packs){
  const mcpack = path.join(outDir, `${pack}_v${version}.mcpack`);
  if(fs.existsSync(mcpack)) fs.rmSync(mcpack);
  execSync(`cd "${tmp}" && zip -r "${path.resolve(mcpack)}" "${pack}" -x "*.git*"`, {stdio:"inherit"});
  console.log(`✓ Created ${mcpack}`);
}

console.log("→ Verifying archive contents...");
execSync(`unzip -l "${addonPath}" | head -n 40`, {stdio:"inherit"});
execSync(`unzip -l "${addonPath}" | grep -q "behavior_pack/manifest.json" && echo "✓ BP manifest inside" || (echo "✗ BP manifest missing"; exit 1)`, {stdio:"inherit"});
execSync(`unzip -l "${addonPath}" | grep -q "resource_pack/manifest.json" && echo "✓ RP manifest inside" || (echo "✗ RP manifest missing"; exit 1)`, {stdio:"inherit"});

console.log("✅ Build complete");
