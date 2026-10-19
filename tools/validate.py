"""Static content graph and archive checks, not a Minecraft engine/schema test."""
from pathlib import Path
import json,uuid,re,zipfile,struct
root=Path(__file__).resolve().parents[1];bp=root/'behavior_pack';rp=root/'resource_pack'
count=0
for pack in [bp,rp]:
 for file in pack.rglob('*.json'):
  json.loads(file.read_text());count+=1
manifest=[json.loads((p/'manifest.json').read_text()) for p in [bp,rp]]
uids=[]
for m in manifest:
 assert m['format_version']==2
 for entry in [m['header']]+m['modules']:
  uuid.UUID(entry['uuid']);uids.append(entry['uuid']);assert entry['version']==[1,0,0]
assert len(uids)==len(set(uids))
assert manifest[0]['dependencies'][0]['uuid']==manifest[1]['header']['uuid']
assert manifest[0]['dependencies'][0]['version']==manifest[1]['header']['version']
package=json.loads((root/'package.json').read_text())
for dep in manifest[0]['dependencies'][1:]:assert package['devDependencies'][dep['module_name']]==dep['version']
assert (bp/manifest[0]['modules'][1]['entry']).exists()
atlas=json.loads((rp/'textures/item_texture.json').read_text())['texture_data']
ids=set()
lang=(rp/'texts/en_US.lang').read_text()
for item in (bp/'items').glob('*.json'):
 d=json.loads(item.read_text())['minecraft:item'];id=d['description']['identifier'];assert id not in ids;ids.add(id)
 c=d['components'];assert c['minecraft:display_name']['value']+'=' in lang
 tex=atlas[c['minecraft:icon']['textures']['default']]['textures'];assert (rp/(tex+'.png')).exists()
 if 'minecraft:food' in c:assert c['minecraft:food']['using_converts_to']==id
for f in (rp/'attachables').glob('*.json'):
 d=json.loads(f.read_text())['minecraft:attachable']['description'];assert d['identifier'] in ids
 assert (rp/(d['textures']['default']+'.png')).exists()
 geo=json.loads((rp/'models/entity/suit.geo.json').read_text())['minecraft:geometry'][0]
 assert geo['description']['identifier']==d['geometry']['default']
 assert set(d['render_controllers'])<=set(json.loads((rp/'render_controllers/suit.json').read_text())['render_controllers'])
for f in (bp/'scripts').rglob('*.js'):
 for module in re.findall(r'from\s+[\'"]([^\'"]+)',f.read_text()):
  if module.startswith('.'):assert (f.parent/module).exists(),(f,module)
  else:assert module in ['@minecraft/server','@minecraft/server-ui'],module
for f in rp.rglob('*.png'):
 data=f.read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n';w,h=struct.unpack('!II',data[16:24]);assert w>0 and h>0
path=root/'dist/Spider-Man-Definitive-Experience-1.0.0.mcaddon'
with zipfile.ZipFile(path) as z:
 assert z.testzip() is None
 names=z.namelist();assert len(names)==len(set(names))
 for p in [bp,rp]:
  for f in p.rglob('*'):
   if f.is_file():assert z.read(f.relative_to(root).as_posix())==f.read_bytes()
 assert not any('node_modules' in n or '..' in n for n in names)
 print(f'PASS: {count} JSON files, {len(ids)} item IDs, UUID/dependency graph, localization, textures, attachables, script imports and {len(names)} archive entries.')
