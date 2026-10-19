// Only a deterministic test double. Does not emulate Minecraft physics or input delivery.
const event=()=>({handlers:[],subscribe(f){this.handlers.push(f);}});
export const world={afterEvents:{playerSpawn:event(),playerLeave:event(),entityDie:event(),entityHurt:event(),itemUse:event()},getAllPlayers:()=>[]};
export const system={currentTick:100,run:f=>f(),runInterval:()=>0};
export const EquipmentSlot={Chest:'Chest'};
export class ItemStack{constructor(typeId,amount=1){this.typeId=typeId;this.amount=amount;}}
export const EntityDamageCause={entityAttack:'entityAttack'};
