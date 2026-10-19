import {test} from 'node:test';
import assert from 'node:assert/strict';
import {world,system} from '@minecraft/server';
import {state,states} from '../behavior_pack/scripts/state.js';
import {web,move,climb,solid} from '../behavior_pack/scripts/traversal.js';
import {activate,progression} from '../behavior_pack/scripts/combat.js';
import {kit,equip,menu} from '../behavior_pack/scripts/ui.js';
function player(id='p'){
 const inventory=Array(12),equipped={};
 const container={size:12,getItem:i=>inventory[i],addItem:item=>{const i=inventory.findIndex(x=>!x);if(i<0)return item;inventory[i]=item;}};
 const p={id,location:{x:0,y:0,z:0},dimension:{id:'overworld',getBlock:()=>({typeId:'minecraft:stone',isAir:false,isLiquid:false}),spawnParticle:()=>{},getEntities:()=>[],spawnItem:()=>{},getBlockFromRay:()=>({block:{typeId:'minecraft:stone'}})},selectedSlotIndex:0,isSwimming:false,isOnGround:false,isSneaking:false,props:{},impulses:[],effects:[],messages:[],
 getDynamicProperty:k=>p.props[k],setDynamicProperty:(k,v)=>p.props[k]=v,getHeadLocation:()=>({x:0,y:1.6,z:0}),getVelocity:()=>({x:0,y:0,z:0}),getViewDirection:()=>({x:0,y:0.6,z:0.8}),getBlockFromViewDirection:()=>p.hit,
 getComponent:name=>name==='minecraft:inventory'?{container}:name==='minecraft:health'?{currentValue:20}:name==='minecraft:equippable'?{getEquipment:slot=>equipped[slot],setEquipment:(slot,item)=>{equipped[slot]=item;return true;}}:undefined,
 isValid:()=>true,applyImpulse:f=>p.impulses.push(f),addEffect:(...a)=>p.effects.push(a),sendMessage:s=>p.messages.push(s),onScreenDisplay:{setActionBar:s=>p.hud=s}};
 p.inventory=inventory;p.equipped=equipped;return p;
}
test('mock flow: no anchor, valid attach, release grace and independent players',()=>{
 states.clear();system.currentTick=100;const a=player('a'),b=player('b'),sa=state(a),sb=state(b);
 web(a,sa);assert.equal(sa.mode,'idle');assert.match(a.hud,/No solid/);
 a.hit={block:{location:{x:0,y:16,z:8},typeId:'minecraft:stone'},faceLocation:{x:0.5,y:0.5,z:0.5}};
 web(a,sa);assert.equal(sa.mode,'swing');assert.equal(sb.mode,'idle');
 a.inventory[0]={typeId:'spider:web_shooter'};move(a,sa);assert.equal(a.impulses.length,1);
 web(a,sa);assert.equal(sa.mode,'idle');assert.equal(sa.anchor,undefined);
 web(a,sa);assert.equal(sa.mode,'idle');system.currentTick+=6;web(a,sa);assert.equal(sa.mode,'swing');
});
test('mock flow: anchor destruction, tool swap and dimension transition clean up',()=>{
 states.clear();system.currentTick=100;const p=player(),s=state(p);
 const attach=()=>{p.hit={block:{location:{x:0,y:10,z:10},typeId:'minecraft:stone'},faceLocation:{x:0,y:0,z:0}};p.inventory[0]={typeId:'spider:web_shooter'};s.cool.web=0;web(p,s);};
 attach();p.dimension.getBlock=()=>({isAir:true,typeId:'minecraft:air'});move(p,s);assert.equal(s.mode,'idle');
 attach();p.inventory[0]={typeId:'minecraft:stick'};move(p,s);assert.equal(s.mode,'idle');
 attach();p.dimension.id='nether';move(p,s);assert.equal(s.mode,'idle');
});
test('mock flow: wall attach, descent correction and explicit detach',()=>{
 states.clear();const p=player(),s=state(p);p.inventory[0]={typeId:'spider:wall_grip'};
 p.hit={block:{typeId:'minecraft:stone'},face:'North'};climb(p,s);assert.equal(s.mode,'climb');
 p.isSneaking=true;move(p,s);assert.ok(p.impulses[0].y<0);climb(p,s);assert.equal(s.mode,'idle');
 assert.equal(solid({typeId:'minecraft:water',isLiquid:true}),false);assert.equal(solid({typeId:'minecraft:oak_leaves'}),false);
});
test('mock flow: kit recovery is idempotent and vanilla armor is preserved',()=>{
 states.clear();const p=player(),s=state(p);kit(p,s);kit(p,s);assert.equal(p.inventory.filter(Boolean).length,4);
 p.equipped.Chest={typeId:'minecraft:diamond_chestplate'};equip(p,s,'classic');assert.equal(p.equipped.Chest.typeId,'minecraft:diamond_chestplate');
 delete p.equipped.Chest;equip(p,s,'iron');assert.equal(p.equipped.Chest,undefined);
 equip(p,s,'classic');assert.equal(p.equipped.Chest.typeId,'spider:suit_classic');
});
test('mock flow: gadget cooldown survives selection and patrol pays only once',()=>{
 states.clear();system.currentTick=100;const p=player(),s=state(p);s.save.gadget='dodge';activate(p,s);assert.equal(p.impulses.length,1);activate(p,s);assert.equal(p.impulses.length,1);
 s.save.gadget='scanner';activate(p,s);s.save.gadget='dodge';activate(p,s);assert.equal(p.impulses.length,1);
 s.challenge={until:200,swings:3,hits:3};progression(p,s);progression(p,s);assert.equal(s.save.xp,6);assert.equal(s.save.challenge,1);assert.equal(s.challenge,undefined);
 s.challenge={until:0,swings:0,hits:0};progression(p,s);assert.equal(s.challenge,undefined);assert.equal(s.save.xp,6);
});
test('mock flow: canceled form exits and resets traversal/menu state',async()=>{
 states.clear();const p=player(),s=state(p);s.mode='swing';s.anchor={x:0,y:5,z:0};await menu(p,s);assert.equal(s.menu,false);assert.equal(s.mode,'idle');assert.equal(s.anchor,undefined);
});
test('initialization subscribes once per event',async()=>{
 await import('../behavior_pack/scripts/main.js');
 for(const e of Object.values(world.afterEvents))assert.equal(e.handlers.length,1);
});
