import {test} from 'node:test';
import assert from 'node:assert/strict';
import {swingForce,len,dot,unit,sub} from '../behavior_pack/scripts/math.js';
import {decode,release} from '../behavior_pack/scripts/state.js';
import {suits,gadgets} from '../behavior_pack/scripts/config.js';
test('spring never emits a nonfinite or oversized correction',()=>{
 for(let i=0;i<10000;i++){
 const a={x:Math.sin(i)*32,y:i%40,z:Math.cos(i)*32};
 const f=swingForce({x:0,y:0,z:0},a,{x:i%5,y:-3,z:1},i%32,{x:0,y:0,z:1});
 assert.ok(Number.isFinite(len(f)));assert.ok(len(f)<=0.250001);
 }
});
test('slack rope does not pull a motionless player without steering',()=>{
 assert.equal(len(swingForce({x:0,y:0,z:0},{x:0,y:10,z:0},{x:0,y:0,z:0},12,{x:0,y:0,z:0})),0);
});
test('stretched rope pulls inward, release only clears owned anchor',()=>{
 const p={x:0,y:0,z:0},a={x:10,y:10,z:0};
 const force=swingForce(p,a,{x:0,y:0,z:0},3,{x:0,y:0,z:0});assert.ok(dot(force,unit(sub(a,p)))>0);
 const s={mode:'swing',anchor:a,block:a,save:{xp:6},cool:{impact:5}};release(s);
 assert.equal(s.mode,'idle');assert.equal(s.anchor,undefined);assert.equal(s.block,undefined);assert.equal(s.save.xp,6);assert.equal(s.cool.impact,5);
});
test('corrupted persistence is normalized, locked suits rejected',()=>{
 for(const raw of [null,undefined,'null','[]','42','bad','{"xp":-5}','{"xp":1e999}'])assert.equal(decode(raw).xp,0);
 assert.equal(decode('{"suit":"iron","xp":0}').suit,'classic');
 assert.equal(decode('{"suit":"iron","xp":24}').suit,'iron');
 assert.equal(decode('{"xp":9000000}').xp,1000000);
 assert.equal(decode('{"gadget":"oops"}').gadget,'impact');
 assert.equal(decode('{"particles":false}').particles,false);
});
test('registry IDs are unique and cooldowns are positive',()=>{
 for(const a of [suits,gadgets])assert.equal(new Set(a.map(x=>x.id)).size,a.length);
 for(const g of gadgets)assert.ok(g.cooldown>0);
});
