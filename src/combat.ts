import { Player, Entity, EntityDamageCause, system } from '@minecraft/server';
import { State, persist } from './state.js';
import { gadgets } from './config.js';
import { anchor, dots, tip } from './traversal.js';
import { sub,unit,mul,add } from './math.js';
export function hostile(e:Entity){return e.isValid()&&e.typeId!=='minecraft:player'&&(e.matches({families:['monster']})||['minecraft:slime','minecraft:magma_cube','minecraft:phantom'].includes(e.typeId));}
export function nearby(p:Player,r:number){return p.dimension.getEntities({location:p.location,maxDistance:r}).filter(hostile).slice(0,8);}
function target(p:Player,range:number){
 const wall=p.getBlockFromViewDirection({maxDistance:range});
 const max=wall?Math.min(range,Math.hypot(wall.block.x-p.location.x,wall.block.y-p.location.y,wall.block.z-p.location.z)):range;
 return p.getEntitiesFromViewDirection({maxDistance:max}).find(h=>hostile(h.entity))?.entity;
}
function damage(p:Player,e:Entity,n:number){if(hostile(e))e.applyDamage(n,{cause:EntityDamageCause.entityAttack,damagingEntity:p});}
export function activate(p:Player,s:State){
 const g=gadgets.find(g=>g.id===s.save.gadget)!;
 if((s.cool[g.id]??0)>system.currentTick){tip(p,`${g.name}: recharging`);return;}
 let success=false;
 if(g.id==='zip'){
 const a=anchor(p);if(a){p.applyImpulse(mul(unit(sub(a.point,p.location)),s.save.suit==='urban'?0.86:0.75));dots(p,s,p.getHeadLocation(),a.point);p.addEffect('slow_falling',30,{showParticles:false});success=true;}
 }else if(g.id==='pulse'||g.id==='scanner'){
 const targets=nearby(p,g.id==='pulse'?6:16);
 if(g.id==='pulse')for(const e of targets)e.addEffect('slowness',40,{amplifier:1,showParticles:true});
 tip(p,`${g.name}: ${targets.length}${targets.length===8?'+':''} nearby threats (proximity only)`);success=true;
 }else if(g.id==='dodge'){
 p.applyImpulse(add(mul(p.getViewDirection(),-0.5),{x:0,y:0.13,z:0}));success=true;
 }else{
 const e=target(p,g.id==='strike'?4:18);
 if(e){
 if(g.id==='restraint'){
 const heavy=['minecraft:warden','minecraft:ravager','minecraft:iron_golem','minecraft:wither','minecraft:ender_dragon'].includes(e.typeId);
 e.addEffect('slowness',heavy?20:60,{amplifier:heavy?0:3,showParticles:true});
 }else{
 s.combo=system.currentTick-s.lastHit<30?(s.combo%3)+1:1;s.lastHit=system.currentTick;
 damage(p,e,g.id==='strike'?3+s.combo+(p.isOnGround?0:1):5);
 if(e.isValid())e.applyImpulse(mul(p.getViewDirection(),0.35));
 }
 if(e.isValid())dots(p,s,p.getHeadLocation(),e.location);
 s.challenge&&(s.challenge.hits++);success=true;
 }
 }
 if(success)s.cool[g.id]=system.currentTick+Math.ceil(g.cooldown*(s.save.suit==='tech'?0.8:1));else tip(p,'No eligible target — aim at a hostile or solid anchor');
}
export function progression(p:Player,s:State){
 if(!s.challenge)return;
 const c=s.challenge;
 if(c.swings>=3&&c.hits>=3){
 s.save.challenge++;s.save.xp+=6;s.challenge=undefined;persist(p,s);p.sendMessage('§bPatrol complete! +6 research. Repeat patrols to unlock suits.');
 }else if(system.currentTick>c.until){s.challenge=undefined;tip(p,'Patrol expired. Restart from the wrist console.');}
}
