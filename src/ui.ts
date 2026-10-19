import { Player, ItemStack, EquipmentSlot } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { State, persist, release } from './state.js';
import { suits,gadgets } from './config.js';
import { system } from '@minecraft/server';
export const HELP='WEB SHOOTER: use at a solid block within 32 blocks; use again to release. Look to steer. Keep shooter selected. WALL GRIP: use facing a wall within 1.6 blocks. Look up/down; sneak descends. Use again or switch items to detach. GADGET: use to activate the selected function. CONSOLE: suits, gadgets, patrol, effects and replacement tools. Opening menus cancels traversal. Slow falling briefly softens traversal exits; ordinary falls remain dangerous.';
export function equip(p:Player,s:State,id:string){
 const suit=suits.find(x=>x.id===id);if(!suit||suit.cost>s.save.xp){p.sendMessage('Suit locked: earn research through patrol challenges.');return;}
 const equipment=p.getComponent('minecraft:equippable');if(!equipment)return;
 const old=equipment.getEquipment(EquipmentSlot.Chest);
 if(old&&!old.typeId.startsWith('spider:suit_')){p.sendMessage('Remove your chest armor first. No items were replaced.');return;}
 if(!equipment.setEquipment(EquipmentSlot.Chest,new ItemStack(`spider:suit_${id}`)))return;
 s.save.suit=id;persist(p,s);p.sendMessage(`§b${suit.name} equipped.`);
}
export function kit(p:Player,s:State){
 const container=p.getComponent('minecraft:inventory')?.container;if(!container)return;
 for(const id of ['web_shooter','wall_grip','gadget','console']){
 let found=false;for(let i=0;i<container.size;i++)if(container.getItem(i)?.typeId===`spider:${id}`)found=true;
 if(!found){const rest=container.addItem(new ItemStack(`spider:${id}`));if(rest)p.dimension.spawnItem(rest,p.location);}
 }
 s.save.kit=true;persist(p,s);
}
export async function menu(p:Player,s:State){
 if(s.menu)return;release(s);s.menu=true;
 try {
 const main=await new ActionFormData().title('§cSPIDER-MAN §8/ §fWRIST OS').body(`Research: ${s.save.xp} • Patrols: ${s.save.challenge}\n${s.challenge?'Patrol active: 3 attachments + 3 gadget hits in 90 seconds.':'Start a patrol to earn 6 research.'}`).button('Suit lab').button('Gadget loadout').button(s.challenge?'Cancel patrol':'Start patrol • 90s').button('Controls / help').button(`Web particles: ${s.save.particles?'ON':'OFF'}`).button(`Spider-Sense: ${s.save.sense?'ON':'OFF'}`).button('Replace missing tools').button('Close').show(p);
 if(main.canceled||!p.isValid())return;
 if(main.selection===0){
 const form=new ActionFormData().title('SUIT LAB').body('Suit replaces only this add-on’s chest armor. Remove vanilla armor first. All appearances are original full-body armor overlays.');
 for(const suit of suits)form.button(`${suit.name} • ${suit.cost>s.save.xp?`${suit.cost} research required`:'Equip'}\n${suit.description}`,`textures/items/suit_${suit.id}`);
 const r=await form.show(p);if(!r.canceled&&r.selection!==undefined&&p.isValid())equip(p,s,suits[r.selection].id);
 }else if(main.selection===1){
 const form=new ActionFormData().title('GADGET LOADOUT').body('All gadgets unlocked. One activator; independent cooldowns.');
 for(const g of gadgets)form.button(`${g.name}\n${g.description}`);
 const r=await form.show(p);if(!r.canceled&&r.selection!==undefined&&p.isValid()){s.save.gadget=gadgets[r.selection].id;persist(p,s);}
 }else if(main.selection===2){if(s.challenge)s.challenge=undefined;else s.challenge={until:system.currentTick+1800,swings:0,hits:0};}
 else if(main.selection===3)await new ActionFormData().title('FIELD GUIDE').body(HELP).button('Got it').show(p);
 else if(main.selection===4){s.save.particles=!s.save.particles;persist(p,s);}
 else if(main.selection===5){s.save.sense=!s.save.sense;persist(p,s);}
 else if(main.selection===6)kit(p,s);
 }finally{s.menu=false;}
}
