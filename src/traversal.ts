import { Player, system, Block } from '@minecraft/server';
import { CFG } from './config.js';
import { State, release } from './state.js';
import { add,sub,mul,len,unit,cap,swingForce,Vec } from './math.js';
// Conservative allowlist: the pinned stable API has no Block.isSolid property.
export const solid=(b:Block|undefined)=>!!b&&!b.isAir&&!b.isLiquid&&/^(minecraft:)(.*(stone|deepslate|granite|diorite|andesite|brick|planks|_log|_wood|concrete|terracotta|ore|obsidian|quartz|sandstone|prismarine)|dirt|grass_block|netherrack|end_stone|bedrock|packed_mud|clay)$/.test(b.typeId);
export const tip=(p:Player,text:string)=>p.onScreenDisplay.setActionBar(text);
export function anchor(p:Player){
 const h=p.getBlockFromViewDirection({maxDistance:CFG.range,includeLiquidBlocks:false,includePassableBlocks:false});
 if(!h||!solid(h.block))return;
 return {point:add(h.block.location,h.faceLocation),block:h.block.location};
}
export function web(p:Player,s:State){
 if(s.mode==='swing'){release(s);s.cool.web=system.currentTick+5;tip(p,'Web released — momentum preserved');return;}
 if((s.cool.web??0)>system.currentTick)return;
 const a=anchor(p);if(!a){tip(p,'No solid anchor within 32 blocks');return;}
 const distance=len(sub(a.point,p.location));if(distance<3){tip(p,'Anchor too close');return;}
 release(s);s.mode='swing';s.anchor=a.point;s.block=a.block;s.rope=Math.max(3,distance*0.88);
 s.challenge&&(s.challenge.swings++);tip(p,'WEB ATTACHED • Use again to release • Look to steer');
}
export function climb(p:Player,s:State){
 if(s.mode==='climb'){release(s);tip(p,'Wall released');return;}
 const hit=p.getBlockFromViewDirection({maxDistance:1.6,includeLiquidBlocks:false,includePassableBlocks:false});
 if(!hit||!solid(hit.block)||['Up','Down'].includes(hit.face)){tip(p,'Face a solid wall within 1.6 blocks');return;}
 release(s);s.mode='climb';tip(p,'WALL GRIP • Look up/down to move • Sneak to descend • Use to release');
}
export function dots(p:Player,s:State,a:Vec,b:Vec){
 if(!s.save.particles)return;
 for(let i=1;i<=CFG.particleSteps;i++)p.dimension.spawnParticle('spider:thread',add(a,mul(sub(b,a),i/CFG.particleSteps)));
}
export function move(p:Player,s:State){
 const pos=p.location;
 if(s.dimension!==p.dimension.id||len(sub(pos,s.last))>CFG.teleport||p.isSwimming||p.getComponent('minecraft:riding')?.entityRidingOn){release(s);s.challenge=undefined;}
 s.dimension=p.dimension.id;s.last=pos;
 if(s.menu||p.getComponent('minecraft:health')?.currentValue===0){release(s);return;}
 if(s.mode==='idle')return;
 // Losing the traversal tool cancels its controller, without touching other inventory.
 const inv=p.getComponent('minecraft:inventory')?.container;
 const held=inv?.getItem(p.selectedSlotIndex)?.typeId;
 if(held!==(s.mode==='swing'?'spider:web_shooter':'spider:wall_grip')){release(s);return;}
 const v=p.getVelocity();
 if(len(v)>CFG.speed){p.applyImpulse(cap(mul(v,-0.15),0.2));return;}
 if(s.mode==='swing'&&s.anchor&&s.block){
 const block=p.dimension.getBlock(s.block);
 if(!solid(block)||len(sub(s.anchor,pos))>CFG.range+8){release(s);return;}
 p.applyImpulse(swingForce(p.getHeadLocation(),s.anchor,v,s.rope,p.getViewDirection()));
 if(system.currentTick%4===0)dots(p,s,p.getHeadLocation(),s.anchor);
 }else if(s.mode==='climb'){
 // Horizontal ray remains stable while looking vertically to control ascent/descent.
 const look=p.getViewDirection(),h=unit({x:look.x,y:0,z:look.z});
 const hit=p.dimension.getBlockFromRay(p.getHeadLocation(),h,{maxDistance:1.4,includeLiquidBlocks:false,includePassableBlocks:false});
 if(!solid(hit?.block)){release(s);return;}
 const desired=p.isSneaking?-0.12:Math.max(-0.12,Math.min(0.16,look.y*0.25));
 p.applyImpulse(cap({x:h.x*0.012,y:desired-v.y+0.075,z:h.z*0.012},0.2));
 }
 // Short, owned slow-falling windows. No blanket effect removal on cleanup.
 p.addEffect('slow_falling',8,{showParticles:false});
}
