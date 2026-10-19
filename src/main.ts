import { world,system,EquipmentSlot } from '@minecraft/server';
import { state,states,persist,release } from './state.js';
import { web,climb,move,tip } from './traversal.js';
import { activate,nearby,progression } from './combat.js';
import { kit,equip,menu } from './ui.js';
import { gadgets,suits,CFG } from './config.js';
const errors=new Map<string,number>();
function guard(key:string,fn:()=>void){try{fn();}catch(error){if((errors.get(key)??-1000)+200<system.currentTick){console.warn(`[Spider/${key}] ${String(error)}`);errors.set(key,system.currentTick);}}}
world.afterEvents.playerSpawn.subscribe(({player,initialSpawn})=>system.run(()=>guard('spawn',()=>{
 states.delete(player.id);const s=state(player);
 if(!s.save.kit){kit(player,s);equip(player,s,'classic');player.sendMessage('§cSpider-Man: Definitive Experience§r\nYour starter tools are ready. Use the Wrist Console for controls and patrols.');}
 if(!initialSpawn)release(s);
})));
world.afterEvents.playerLeave.subscribe(({playerId})=>{states.delete(playerId);});
world.afterEvents.entityDie.subscribe(({deadEntity})=>{if(deadEntity.typeId==='minecraft:player')states.delete(deadEntity.id);});
world.afterEvents.entityHurt.subscribe(({hurtEntity})=>{if(hurtEntity.typeId==='minecraft:player'){const s=states.get(hurtEntity.id);if(s&&s.save.sense){s.alert='§cSPIDER-SENSE • Damage detected';s.alertUntil=system.currentTick+40;}}});
world.afterEvents.itemUse.subscribe(({source,itemStack})=>guard('itemUse',()=>{
 const s=state(source);if(s.menu)return;
 switch(itemStack.typeId){
 case 'spider:web_shooter':web(source,s);break;
 case 'spider:wall_grip':climb(source,s);break;
 case 'spider:gadget':activate(source,s);break;
 case 'spider:console':void menu(source,s).catch(e=>guard('menu',()=>{throw e;}));break;
 }
}));
system.runInterval(()=>{
 for(const p of world.getAllPlayers())guard(`tick:${p.id}`,()=>{
 const s=state(p);
 // Passive specialization follows actual equipped item, not just saved menu choice.
 const chest=p.getComponent('minecraft:equippable')?.getEquipment(EquipmentSlot.Chest)?.typeId;
 const actual=suits.find(x=>chest===`spider:suit_${x.id}`)?.id??'';
 if(s.save.suit!==actual){s.save.suit=actual;persist(p,s);}
 try{move(p,s);}catch(e){release(s);throw e;}
 if(system.currentTick%10!==0)return;
 progression(p,s);
 if(s.save.sense&&system.currentTick%40===0){
 const threats=nearby(p,s.save.suit==='stealth'?16:CFG.sense);
 if(threats.length){s.alert=`§eSPIDER-SENSE • ${threats.length}${threats.length===8?'+':''} nearby hostiles`;s.alertUntil=system.currentTick+25;}
 }
 if(s.menu)return;
 const held=p.getComponent('minecraft:inventory')?.container?.getItem(p.selectedSlotIndex)?.typeId;
 if(!held?.startsWith('spider:'))return;
 const g=gadgets.find(x=>x.id===s.save.gadget)!;
 const seconds=Math.max(0,Math.ceil(((s.cool[g.id]??0)-system.currentTick)/20));
 const patrol=s.challenge?` | Patrol ${s.challenge.swings}/3 webs ${s.challenge.hits}/3 hits ${Math.max(0,Math.ceil((s.challenge.until-system.currentTick)/20))}s`:'';
 tip(p,s.alertUntil>system.currentTick?s.alert:`§b${s.mode.toUpperCase()} §f• ${g.name} ${seconds?`${seconds}s`:'READY'}${patrol}`);
 });
},1);
