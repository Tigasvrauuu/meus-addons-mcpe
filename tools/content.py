"""Generate original deterministic pixel art and pack definitions; standard library only."""
from pathlib import Path
import json,struct,zlib
ROOT=Path(__file__).resolve().parents[1]
def js(path,data):
 p=ROOT/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(data,indent=2)+'\n')
class Image:
 def __init__(self,w,h):self.w=w;self.h=h;self.p=[[(0,0,0,0) for _ in range(w)] for _ in range(h)]
 def rect(self,x,y,w,h,c):
  for yy in range(max(0,y),min(self.h,y+h)):
   for xx in range(max(0,x),min(self.w,x+w)):self.p[yy][xx]=tuple(c)+(255,) if len(c)==3 else tuple(c)
 def line(self,x,y,a,b,c):
  n=max(abs(a-x),abs(b-y),1)
  for i in range(n+1):self.rect(round(x+(a-x)*i/n),round(y+(b-y)*i/n),1,1,c)
 def save(self,path):
  def chunk(t,d):return struct.pack('!I',len(d))+t+d+struct.pack('!I',zlib.crc32(t+d)&0xffffffff)
  raw=b''.join(b'\0'+bytes(v for px in row for v in px) for row in self.p)
  p=ROOT/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',self.w,self.h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
BP='d4e12f1b-37a5-4fe7-8d68-755b51c4b141';RP='5fe64e37-c282-4e9c-9b48-81d04ee9af2a'
for pack,uid,modules in [('behavior_pack',BP,[{'type':'data','uuid':'4171a71a-bcc8-483b-b64e-cf48af9e7aab','version':[1,0,0]},{'type':'script','language':'javascript','entry':'scripts/main.js','uuid':'53a2695f-c142-487e-8708-bcbeebce6e63','version':[1,0,0]}]),('resource_pack',RP,[{'type':'resources','uuid':'76602b49-8540-407c-b28b-e496b74eb723','version':[1,0,0]}])]:
 d={'format_version':2,'header':{'name':'Spider-Man: Definitive Experience '+('BP' if pack.startswith('behavior') else 'RP'),'description':'Original fan-made traversal, gadgets and patrols. Runtime QA required.','uuid':uid,'version':[1,0,0],'min_engine_version':[1,26,50]},'modules':modules}
 if pack.startswith('behavior'):d['dependencies']=[{'uuid':RP,'version':[1,0,0]},{'module_name':'@minecraft/server','version':'1.19.0'},{'module_name':'@minecraft/server-ui','version':'1.3.0'}]
 js(f'{pack}/manifest.json',d)
colors={'classic':((194,35,52),(24,52,119),(235,242,249)),'homemade':((159,48,43),(55,71,92),(222,209,180)),'stealth':((26,30,44),(14,18,29),(212,229,241)),'tech':((203,42,56),(23,64,118),(230,249,255)),'urban':((30,31,43),(21,23,33),(237,45,63)),'iron':((143,35,44),(49,32,43),(239,185,69))}
icons={};names={'web_shooter':'Web Shooter','wall_grip':'Wall Grip','gadget':'Gadget Activator','console':'Wrist Console'}
def spider(im,cx,cy,c):
 im.rect(cx-1,cy-2,2,5,c)
 for side in [-1,1]:
  for k in range(4):im.line(cx,cy-1+k,cx+side*4,cy-4+k*2,c)
for id,(red,blue,light) in colors.items():
 im=Image(64,32);im.rect(0,0,64,32,red);im.rect(0,16,16,16,blue);im.rect(16,24,24,8,blue)
 # Net lattice with shaded panel borders; UVs follow documented box layout.
 dark=tuple(max(0,c//3) for c in red)
 for x in range(0,64,4):im.line(x,0,x,31,dark)
 for y in range(0,32,4):im.line(0,y,63,y,dark)
 im.rect(8,10,3,3,light);im.rect(13,10,3,3,light);spider(im,24,23,light)
 im.save(f'resource_pack/textures/models/armor/{id}.png')
 icon=Image(32,32);icon.rect(6,5,20,23,(9,14,26));icon.rect(8,7,16,19,red);icon.rect(8,24,16,3,blue);spider(icon,16,16,light);icon.save(f'resource_pack/textures/items/suit_{id}.png')
 names['suit_'+id]=id.title()+' Suit';icons['suit_'+id]={'textures':f'textures/items/suit_{id}'}
 desc={'identifier':f'spider:suit_{id}','materials':{'default':'armor','enchanted':'armor_enchanted'},'textures':{'default':f'textures/models/armor/{id}','enchanted':'textures/misc/enchanted_actor_glint'},'geometry':{'default':'geometry.spider.suit'},'render_controllers':['controller.render.spider_suit']}
 js(f'resource_pack/attachables/{id}.json',{'format_version':'1.10.0','minecraft:attachable':{'description':desc}})
for i,id in enumerate(['web_shooter','wall_grip','gadget','console']):
 im=Image(32,32);ink=(10,16,30);white=(219,240,250);red=(219,43,61);cyan=(57,199,222)
 if id=='web_shooter':
  im.rect(5,12,20,12,ink);im.rect(7,14,16,8,red);im.rect(21,10,7,7,white);im.rect(11,16,7,4,cyan)
  for n in range(3):im.line(23,9,20+n*4,3,white)
 elif id=='wall_grip':
  im.rect(9,13,15,13,ink);im.rect(11,14,11,10,red)
  for n in range(4):im.rect(9+n*4,5+n%2*2,3,12,red)
  im.rect(5,16,5,7,red);spider(im,17,20,white)
 elif id=='gadget':
  for n in range(4):im.line(16,4,4+n*8,16,cyan);im.line(16,28,4+n*8,16,cyan)
  im.rect(9,9,14,14,ink);im.rect(12,12,8,8,red);im.rect(14,14,4,4,white)
 else:
  im.rect(5,7,22,19,ink);im.rect(7,9,18,15,red);im.rect(9,11,14,11,(15,48,65));spider(im,16,16,cyan)
 im.save(f'resource_pack/textures/items/{id}.png');icons[id]={'textures':f'textures/items/{id}'}
for id,name in names.items():
 comp={'minecraft:display_name':{'value':f'item.spider:{id}.name'},'minecraft:icon':{'textures':{'default':id}},'minecraft:max_stack_size':1,'minecraft:hand_equipped':True}
 if id.startswith('suit_'):
  comp['minecraft:wearable']={'slot':'slot.armor.chest','protection':6 if id=='suit_iron' else 3}
 else:
  comp.update({'minecraft:use_animation':'eat','minecraft:use_modifiers':{'use_duration':0.15,'movement_modifier':1.0},'minecraft:food':{'nutrition':0,'saturation_modifier':0,'can_always_eat':True,'using_converts_to':f'spider:{id}'}})
 js(f'behavior_pack/items/{id}.json',{'format_version':'1.21.60','minecraft:item':{'description':{'identifier':f'spider:{id}','menu_category':{'category':'equipment'}},'components':comp}})
js('resource_pack/textures/item_texture.json',{'resource_pack_name':'spider_definitive','texture_name':'atlas.items','texture_data':icons})
(ROOT/'resource_pack/texts/en_US.lang').write_text('## Original fan-made add-on\n'+'\n'.join(f'item.spider:{id}.name={name}' for id,name in names.items())+'\n')
js('resource_pack/texts/languages.json',['en_US'])
# Original geometry: one chest wearable drives full-body overlay with standard player bones.
bones=[{'name':'waist','pivot':[0,12,0]},]
for name,parent,pivot,origin,size,uv,mirror in [
 ('body','waist',[0,24,0],[-4,12,-2],[8,12,4],[16,16],False),
 ('head','body',[0,24,0],[-4,24,-4],[8,8,8],[0,0],False),
 ('rightArm','body',[-5,22,0],[-8,12,-2],[4,12,4],[40,16],False),
 ('leftArm','body',[5,22,0],[4,12,-2],[4,12,4],[40,16],True),
 ('rightLeg','body',[-1.9,12,0],[-3.9,0,-2],[4,12,4],[0,16],False),
 ('leftLeg','body',[1.9,12,0],[-0.1,0,-2],[4,12,4],[0,16],True)]:
 bones.append({'name':name,'parent':parent,'pivot':pivot,'mirror':mirror,'cubes':[{'origin':origin,'size':size,'uv':uv,'inflate':0.35}]})
js('resource_pack/models/entity/suit.geo.json',{'format_version':'1.12.0','minecraft:geometry':[{'description':{'identifier':'geometry.spider.suit','texture_width':64,'texture_height':32,'visible_bounds_width':3,'visible_bounds_height':3,'visible_bounds_offset':[0,1,0]},'bones':bones}]})
js('resource_pack/render_controllers/suit.json',{'format_version':'1.8.0','render_controllers':{'controller.render.spider_suit':{'geometry':'Geometry.default','materials':[{'*':'Material.default'}],'textures':['Texture.default']}}})
# White dot is also used for the bounded 12-point web thread.
im=Image(8,8);im.rect(2,2,4,4,(230,245,255));im.save('resource_pack/textures/thread.png')
js('resource_pack/particles/thread.json',{'format_version':'1.10.0','particle_effect':{'description':{'identifier':'spider:thread','basic_render_parameters':{'material':'particles_alpha','texture':'textures/thread'}},'components':{'minecraft:emitter_rate_instant':{'num_particles':1},'minecraft:emitter_lifetime_once':{'active_time':0.01},'minecraft:emitter_shape_point':{},'minecraft:particle_lifetime_expression':{'max_lifetime':0.22},'minecraft:particle_appearance_billboard':{'size':[0.025,0.025],'facing_camera_mode':'lookat_xyz','uv':{'texture_width':8,'texture_height':8,'uv':[0,0],'uv_size':[8,8]}},'minecraft:particle_motion_dynamic':{'linear_acceleration':[0,0,0]}}}})
# Independent original cover icon.
im=Image(128,128);im.rect(0,0,128,128,(9,16,32));
for y in range(0,128,16):im.line(0,y,127,y,(23,36,58))
for x in range(0,128,16):im.line(x,0,x,127,(23,36,58))
im.rect(30,20,68,86,(192,35,54));im.rect(38,30,52,62,(14,27,46))
for side in [-1,1]:
 for k in range(4):im.line(64,50+k*8,64+side*26,34+k*20,(232,243,251))
im.rect(59,45,10,34,(232,243,251));im.rect(62,34,4,10,(232,243,251))
for pack in ['behavior_pack','resource_pack']:im.save(f'{pack}/pack_icon.png')
# Accessible recovery recipe; no vanilla recipes overridden.
js('behavior_pack/recipes/console.json',{'format_version':'1.20.10','minecraft:recipe_shapeless':{'description':{'identifier':'spider:console'},'tags':['crafting_table'],'ingredients':[{'item':'minecraft:string'},{'item':'minecraft:iron_ingot'}],'result':{'item':'spider:console','count':1}}})
print('Generated 10 items, 6 suits, original textures, geometry, thread, manifests and recovery recipe.')
