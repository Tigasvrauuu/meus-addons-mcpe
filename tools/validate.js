#!/usr/bin/env node
import fs from "fs";
import path from "path";
const root = path.resolve(".");
let errors=0, warnings=0;
function log(msg){ console.log(msg); }
function err(msg){ console.error("✗ "+msg); errors++; }
function warn(msg){ console.warn("⚠ "+msg); warnings++; }
function ok(msg){ console.log("✓ "+msg); }
function walk(dir, cb){
  for(const entry of fs.readdirSync(dir, {withFileTypes:true})){
    const p = path.join(dir, entry.name);
    if(entry.isDirectory()){
      if(entry.name==="node_modules"||entry.name===".git"||entry.name==="dist"||entry.name===".github") continue;
      walk(p, cb);
    } else cb(p);
  }
}
log("== Spider-Man DE Validation ==");
let jsonFiles=[];
walk(root, (p)=>{
  if(p.endsWith(".json")){
    jsonFiles.push(p);
    try{ JSON.parse(fs.readFileSync(p,"utf8")); }catch(e){ err(`JSON parse fail: ${p} -> ${e.message}`); }
  }
});
ok(`JSON scan: ${jsonFiles.length} files parsed`);
for(const manifest of ["behavior_pack/manifest.json","resource_pack/manifest.json"]){
  if(!fs.existsSync(manifest)) err(`Missing manifest: ${manifest}`);
  else {
    const m=JSON.parse(fs.readFileSync(manifest,"utf8"));
    if(!m.header || !m.header.uuid) err(`Manifest missing header.uuid: ${manifest}`);
    else {
      const uuid=m.header.uuid;
      const re=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if(!re.test(uuid)) err(`Invalid UUID in ${manifest}: ${uuid}`);
    }
  }
}
ok("Manifest headers checked");
let uuids=new Map();
for(const f of jsonFiles){
  try{
    const j=JSON.parse(fs.readFileSync(f,"utf8"));
    const collect = (obj, srcFile)=>{
      if(!obj || typeof obj!=="object") return;
      if(obj.uuid && typeof obj.uuid==="string") {
        // Allow BP dependency UUID == RP header UUID (expected linkage)
        const isDependency = obj.uuid==="c538f8d4-8bbf-4544-a80d-1baed3c9b317";
        if(uuids.has(obj.uuid) && !isDependency){
          warn(`Duplicate UUID ${obj.uuid} in ${f} and ${uuids.get(obj.uuid)}`);
        } else if(!uuids.has(obj.uuid)){
          uuids.set(obj.uuid, f);
        }
      }
      for(const v of Object.values(obj)) collect(v, srcFile);
    };
    collect(j, f);
  }catch{}
}
ok(`UUIDs collected: ${uuids.size}`);
let scriptFiles=[];
walk(path.join(root,"behavior_pack/scripts"), (p)=>{ if(p.endsWith(".js")) scriptFiles.push(p); });
for(const f of scriptFiles){
  const txt=fs.readFileSync(f,"utf8");
  const importRe=/from\s+["'](\.[^"']+)["']/g;
  let m;
  while(m=importRe.exec(txt)){
    const rel=m[1];
    let target=path.resolve(path.dirname(f), rel);
    if(!target.endsWith(".js")) target+=".js";
    if(!fs.existsSync(target)) err(`Missing import ${rel} in ${path.relative(root,f)} -> ${path.relative(root,target)} not found`);
  }
  if(txt.includes("TODO")||txt.includes("PLACEHOLDER")) warn(`TODO/PLACEHOLDER in ${path.relative(root,f)}`);
}
ok(`Scripts checked: ${scriptFiles.length}`);
let definedIds=new Set();
let referencedIds=[];
for(const f of jsonFiles){
  const j=JSON.parse(fs.readFileSync(f,"utf8"));
  if(j["minecraft:item"]?.description?.identifier) definedIds.add(j["minecraft:item"].description.identifier);
  if(j["minecraft:block"]?.description?.identifier) definedIds.add(j["minecraft:block"].description.identifier);
  if(j["minecraft:entity"]?.description?.identifier) definedIds.add(j["minecraft:entity"].description.identifier);
}
log(`Defined custom IDs: ${[...definedIds].join(", ")}`);
for(const f of jsonFiles){
  if(f.includes("recipes/")){
    const j=JSON.parse(fs.readFileSync(f,"utf8"));
    const recipe = j["minecraft:recipe_shaped"] || j["minecraft:recipe_shapeless"] || j["minecraft:recipe_furnace"];
    if(recipe){
      const result=recipe.result?.item || recipe.result?.name;
      if(result && !definedIds.has(result) && !result.startsWith("minecraft:")) warn(`Recipe ${f} result unknown: ${result}`);
    }
  }
}
let missingTex=[];
for(const texJson of ["resource_pack/textures/item_texture.json","resource_pack/textures/terrain_texture.json"]){
  if(fs.existsSync(texJson)){
    const j=JSON.parse(fs.readFileSync(texJson,"utf8"));
    const data=j.texture_data || {};
    for(const [k,v] of Object.entries(data)){
      const texPath = `resource_pack/${v.textures}.png`;
      if(!fs.existsSync(texPath)) err(`Missing texture file for ${k}: ${texPath}`);
    }
  }
}
ok("Texture refs checked");
let particleIds=new Set();
walk(path.join(root,"resource_pack/particles"), (p)=>{
  if(p.endsWith(".json")){
    const j=JSON.parse(fs.readFileSync(p,"utf8"));
    const id=j.particle_effect?.description?.identifier;
    if(id) particleIds.add(id);
  }
});
for(const f of scriptFiles){
  const txt=fs.readFileSync(f,"utf8");
  const partRe=/spawnParticle\(\s*["']([^"']+)["']/g;
  let m;
  while(m=partRe.exec(txt)){
    const pid=m[1];
    if(pid.startsWith("spider:") && !particleIds.has(pid)){
      warn(`Particle not defined but used: ${pid} in ${path.relative(root,f)}`);
    }
  }
}
ok(`Particles defined: ${particleIds.size}, usages checked`);
for(const f of scriptFiles){
  const txt=fs.readFileSync(f,"utf8");
  if(txt.includes("return false") && txt.trim().length < 200) warn(`Potential empty handler in ${path.relative(root,f)}`);
}
log(`\nValidation complete: ${errors} errors, ${warnings} warnings`);
if(errors>0) process.exit(1);
else process.exit(0);
