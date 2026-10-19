import { world, system } from "@minecraft/server";
import { CONFIG } from "./core/config.js";
import { STATE } from "./core/constants.js";
import { getState, saveIfDirty, markDirty, allStates, deleteState, createDefaultState } from "./core/player_state.js";
import { fullCleanup, onDeath, onRespawn } from "./core/cleanup.js";
import { diag } from "./core/diagnostics.js";

import { WebTraversalService } from "./systems/web_traversal.js";
import { WallClimbingService } from "./systems/wall_climbing.js";
import { MovementService } from "./systems/movement.js";
import { SpiderSenseService } from "./systems/spider_sense.js";
import { CombatService } from "./systems/combat.js";
import { GadgetService } from "./systems/gadgets.js";
import { SuitService } from "./systems/suits.js";
import { ProgressionService } from "./systems/progression.js";
import { InteractionService } from "./systems/interaction.js";

import { UIService } from "./ui/menus.js";
import { HUDService } from "./ui/hud_state.js";

diag.info("Spider-Man DE v1.0.0 initializing...");

// Services
let web, climb, movement, sense, combat, gadgets, suits, progression, interaction, ui, hud;

function initServices(){
  web = new WebTraversalService(world, system);
  climb = new WallClimbingService(world);
  movement = new MovementService();
  sense = new SpiderSenseService(world);
  combat = new CombatService(world);
  suits = new SuitService(world);
  progression = new ProgressionService(world, suits, null); // gadgets placeholder
  gadgets = new GadgetService(world, sense, combat, web);
  progression.gadgets = gadgets; // inject
  interaction = new InteractionService(world, web, climb, gadgets, suits, progression);
  ui = new UIService(world, suits, gadgets, progression);
  hud = new HUDService(world);
}

// Tick loop: single interval handling all systems
let tickCounter = 0;
function mainTick(){
  tickCounter++;
  const players = world.getPlayers();
  // Update player_state internal ticks + persistence cooldown
  for(const p of players){
    try{
      if(!p.isValid()) continue;
      const st = getState(p);
      // update derived stateTicks
      const dimId = p.dimension?.id ?? "minecraft:overworld";
      st.dimension = dimId;
      // call player_state tick helper
      // inline tickState to avoid import cycle
      st.stateTicks = (st.stateTicks??0)+1;
      if(st.graceTicks>0) st.graceTicks--;
      if(st.failCooldown>0) st.failCooldown--;
      if(st.climb && st.climb.grace>0) st.climb.grace--;
      if(st.combat && st.combat.dodgeCooldown>0) st.combat.dodgeCooldown--;
      if(st.persistCooldown>0) st.persistCooldown--;

      // track last pos for stats
      const pos = p.location;
      if(st.lastPos){
        if(st.state === STATE.SWINGING && st.anchor){
          const dx = pos.x - st.lastPos.x, dz = pos.z - st.lastPos.z;
          st.progression.swingDistance += Math.hypot(dx, dz);
        }
        if(st.state === STATE.CLIMBING){
          st.progression.climbDistance += Math.abs(pos.y - st.lastPos.y);
        }
      }
      st.lastPos = {x:pos.x, y:pos.y, z:pos.z};

      // check death via health component
      try{
        const health = p.getComponent("minecraft:health");
        if(health && health.currentValue <= 0 && st.state !== STATE.DEAD){
          onDeath(p, st);
        } else if(health && health.currentValue > 0 && st.state === STATE.DEAD){
          onRespawn(p, st);
        }
      }catch{}

      // check for menu request tag
      if(p.hasTag("spider_request_suit_menu")){
        p.removeTag("spider_request_suit_menu");
        if(!ui.isOpening(p.id)) ui.openMainMenu(p);
      }
      // check for starter kit request tag (set by function)
      if(p.hasTag("spider_request_starter")){
        p.removeTag("spider_request_starter");
        giveStarter(p);
      }

      // dimension change handled inside getState tick but also here
      // ensure passive suit effect stays
      if(tickCounter % 100 === 0){
        const stLocal = getState(p);
        // reapply if missing
        try{
          if(stLocal.suitEquipped && !p.hasTag("spider_suit:"+stLocal.suitEquipped)){
            p.addTag("spider_suit:"+stLocal.suitEquipped);
          }
        }catch{}
      }
    }catch(e){ diag.reportOnce("playerTick", String(e)); }
  }

  // Run services
  try{ web.tick(players); }catch(e){ diag.warn("web tick "+e.stack); }
  try{ climb.tick(players); }catch(e){ diag.warn("climb tick "+e.stack); }
  try{ movement.tick ? movement.tick(players) : null; }catch{}
  // per-player movement tick
  for(const p of players){ try{ movement.tick(p, getState(p)); }catch{} }
  try{ sense.tick(players); }catch(e){ diag.warn("sense tick "+e); }
  try{ combat.tick(players); }catch(e){ diag.warn("combat tick "+e); }
  try{ gadgets.tick(players); }catch(e){ diag.warn("gadget tick "+e); }
  try{ progression.tick(players); }catch(e){ diag.warn("progression tick "+e); }
  try{ hud.tick(players); }catch(e){ diag.warn("hud tick "+e); }

  // persistence
  if(tickCounter % 40 === 0){
    for(const p of players){
      try{
        const st = getState(p);
        if(st.dirtyPersist) saveIfDirty(p, st, false);
      }catch{}
    }
  }
}

function giveStarter(player){
  const st = getState(player);
  progression.grantStarter(player);
  // give items if not already in inventory (we check container)
  try{
    const inv = player.getComponent("minecraft:inventory");
    if(!inv) return;
    const container = inv.container;
    const toGive = [
      "spider:web_shooter",
      "spider:impact_web",
      "spider:web_restraint",
      "spider:suit_changer",
      "spider:spider_token",
    ];
    for(const id of toGive){
      // simple check: try to find existing
      let has=false;
      for(let i=0;i<container.size;i++){
        const it = container.getItem(i);
        if(it && it.typeId===id){ has=true; break; }
      }
      if(!has){
        // create item via give command fallback: use container.addItem? Use runCommand
        try{
          player.runCommand(`give @s ${id} 1`);
        }catch{
          // alternative: container add
          try{
            const item = { typeId: id, amount:1 };
            // use spawn attempt: player.addItem not exists; use give command is best
          }catch{}
        }
      }
    }
    player.sendMessage("§a[Spider-DE] §fStarter kit granted §7— Web-Shooter, gadgets, Suit Changer, Token");
    player.playSound("minecraft:entity.experience_orb.pickup", {volume:0.9, pitch:1.2});
  }catch(e){ diag.warn("giveStarter fail "+e); }
}

// Event subscriptions — registered once

system.run(()=>{ initServices(); diag.info("Services initialized"); });

// Player spawn
world.afterEvents.playerSpawn.subscribe((ev)=>{
  const player = ev.player;
  if(!player || !player.isValid()) return;
  const isInitial = ev.initialSpawn;
  const st = getState(player);
  // ensure tags & passive
  try{
    player.addTag("spider_player");
    suits.onPlayerSpawn(player);
    // give starter on first join if no tokens and distance 0
    if(isInitial || st.progression.tokens===0 && st.progression.kills===0 && st.progression.swingDistance<5){
      // delay a tick to allow inventory ready
      system.runTimeout(()=>{
        if(player.isValid()){
          giveStarter(player);
          // show guide if first time
          if(isInitial) {
            player.sendMessage("§c§lSPIDER-MAN DE §r§7— Welcome! Use §fWeb-Shooter §7to swing, §fSneak §7near wall to climb. Open menu with §fSuit Changer §7or §f/function spider:menu");
          }
        }
      }, 20);
    } else {
      // returning player, sync suit passive
      suits.applyPassive(player, st);
    }
  }catch(e){ diag.warn("playerSpawn handle "+e); }
});

// Player leave — save and delete state
world.afterEvents.playerLeave.subscribe((ev)=>{
  const id = ev.playerId;
  // We no longer have player object, but we have stored state; try to find via id in allStates
  for(const [pid, st] of allStates()){
    if(pid===id){
      // we cannot call setDynamicProperty without player object; rely on periodic save already
      // just delete
      deleteState(pid);
      break;
    }
  }
  // also cleanup cooldown entries handled internally
});

// Item use routing
world.afterEvents.itemUse.subscribe((ev)=>{
  try{
    interaction.onItemUse(ev);
  }catch(e){ diag.reportOnce("itemUse", String(e)); }
});

// Entity hit
world.afterEvents.entityHitEntity.subscribe((ev)=>{
  try{
    // combat service
    combat.onPlayerHit(ev);
  }catch(e){ diag.reportOnce("entityHit", String(e)); }
});
// Also subscribe to entity hurt for feedback (player being hurt)
world.afterEvents.entityHurt.subscribe((ev)=>{
  try{
    if(ev.hurtEntity.typeId==="minecraft:player") combat.onPlayerHurt(ev);
  }catch{}
});

world.afterEvents.entityDie.subscribe((ev)=>{
  try{ combat.onEntityDie(ev); }catch{}
});

// Block interact? use playerInteractWithBlock if available (server 1.14+)
try{
  if(world.afterEvents.playerInteractWithBlock){
    world.afterEvents.playerInteractWithBlock.subscribe((ev)=>{
      try{
        const player = ev.player;
        const block = ev.block;
        interaction.onBlockInteract(player, block);
      }catch(e){ diag.reportOnce("blockInteract", String(e)); }
    });
  }
}catch{}

// Death handling via entityDie for player
world.afterEvents.entityDie.subscribe((ev)=>{
  try{
    const dead = ev.deadEntity;
    if(dead.typeId==="minecraft:player"){
      const st = getState(dead);
      onDeath(dead, st);
    }
  }catch{}
});

// Dimension change? there is world.afterEvents.playerDimensionChange
try{
  if(world.afterEvents.playerDimensionChange){
    world.afterEvents.playerDimensionChange.subscribe((ev)=>{
      const player = ev.player;
      const st = getState(player);
      fullCleanup(player, st, "dimension_change");
      st.dimension = ev.toDimension?.id ?? "minecraft:overworld";
    });
  }
}catch{}

// Chat command fallback: /tag @s add spider:menu etc? We support via player message event interception
// Script API: world.beforeEvents.chatSend
try{
  if(world.beforeEvents.chatSend){
    world.beforeEvents.chatSend.subscribe((ev)=>{
      const msg = ev.message.trim().toLowerCase();
      const player = ev.sender;
      if(msg === "!spider" || msg === "!menu" || msg === "!spider menu" || msg === "spider:menu"){
        ev.cancel = true;
        system.run(()=> ui.openMainMenu(player));
      } else if(msg === "!starter" || msg === "!kit"){
        ev.cancel = true;
        giveStarter(player);
      } else if(msg === "!suit"){
        ev.cancel = true;
        system.run(()=> ui.openSuitMenu(player));
      } else if(msg === "!gadgets"){
        ev.cancel = true;
        system.run(()=> ui.openGadgetMenu(player));
      } else if(msg.startsWith("!climb")){
        ev.cancel = true;
        climb.tryAttach(player);
      } else if(msg.startsWith("!detach")){
        ev.cancel = true;
        climb.tryDetach(player, msg.includes("leap"));
      } else if(msg.startsWith("!zip")){
        ev.cancel = true;
        web.tryZip(player);
      } else if(msg.startsWith("!dodge")){
        ev.cancel = true;
        combat.tryDodge(player);
      }
    });
  }
}catch{}

// Periodic tick scheduling
system.runInterval(mainTick, 1);

// Additional scheduled cleanup for webbed entities
system.runInterval(()=>{
  try{
    const dim = world.getDimension("overworld");
    // we cannot enumerate all dimensions easily; player dim is enough for helper cleanup
    // Instead, handle per-player webbed tag cleanup via timeout already
  }catch{}
}, 20);

diag.info("Spider-Man DE — main.js loaded, tick scheduled");
