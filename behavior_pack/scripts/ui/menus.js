import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { SUIT_CONFIG, GADGET_CONFIG, CHALLENGE_DEFS, CONFIG } from "../core/config.js";
import { getState } from "../core/player_state.js";

// UIService: forms, actionbar, titles, HUD
export class UIService {
  constructor(world, suitService, gadgetService, progressionService){
    this.world = world;
    this.suits = suitService;
    this.gadgets = gadgetService;
    this.progression = progressionService;
    this.opening = new Set(); // playerId -> true while form open to prevent double
  }

  isOpening(playerId){ return this.opening.has(playerId); }

  async openMainMenu(player){
    if(this.opening.has(player.id)) return;
    this.opening.add(player.id);
    try{
      const st = getState(player);
      const form = new ActionFormData()
        .title("§cSPIDER-MAN §7| Main Hub")
        .body(`§7Suit: §f${SUIT_CONFIG[st.suitEquipped].name}\n§7Gadget: §f${GADGET_CONFIG[st.gadgetSelected].name}\n§7Tokens: §a${st.progression.tokens} §7| Sense: §f${st.progression.senseTriggers}\n\n§8Choose a panel:`)
        .button("§4Suit Wardrobe\n§7Change appearance & passives")
        .button("§bGadget Wheel\n§7Select active gadget")
        .button("§aProgression\n§7Challenges & rewards")
        .button("§eSpider Guide\n§7Controls & tips")
        .button("§8Settings\n§7HUD & effects")
        .button("§cClose");
      const res = await form.show(player);
      if(res.canceled) return;
      switch(res.selection){
        case 0: await this.openSuitMenu(player); break;
        case 1: await this.openGadgetMenu(player); break;
        case 2: await this.openProgressionMenu(player); break;
        case 3: await this.openHelpMenu(player); break;
        case 4: await this.openSettingsMenu(player); break;
        default: break;
      }
    }catch(e){
      // if ui unavailable, fallback to chat
      player.sendMessage("§cMenu error, using chat fallback.");
      this.chatFallback(player);
    }finally{
      this.opening.delete(player.id);
    }
  }

  async openSuitMenu(player){
    this.opening.add(player.id);
    try{
      const suits = this.suits.listForPlayer(player);
      const form = new ActionFormData().title("§cSuit Wardrobe").body("§7Select a suit to equip. Locked suits show unlock hint.");
      for(const s of suits){
        const icon = s.unlocked ? "§a● " : "§c🔒 ";
        const eq = s.equipped ? " §e[EQUIPPED]" : "";
        form.button(`${icon}§f${s.name}${eq}\n§7${s.unlocked ? s.desc : "Locked: "+s.hint}`);
      }
      form.button("§7◀ Back");
      const res = await form.show(player);
      if(res.canceled) return;
      if(res.selection === suits.length){ await this.openMainMenu(player); return; }
      const chosen = suits[res.selection];
      if(!chosen) return;
      if(!chosen.unlocked){
        player.sendMessage(`§cLocked: §f${chosen.name} §7— ${chosen.hint}`);
        // offer to re-open
        await this.openSuitMenu(player);
        return;
      }
      const ok = this.suits.equip(player, chosen.id);
      if(ok) await this.openSuitMenu(player);
    }finally{ this.opening.delete(player.id); }
  }

  async openGadgetMenu(player){
    this.opening.add(player.id);
    try{
      const st = getState(player);
      const form = new ActionFormData().title("§bGadget Wheel").body(`§7Current: §f${GADGET_CONFIG[st.gadgetSelected].name}\n§7Tap a gadget to select & activate. Cooldowns shown.`);
      const ids = Object.keys(GADGET_CONFIG);
      for(const id of ids){
        const cfg = GADGET_CONFIG[id];
        const unlocked = st.gadgetUnlocked.has(id);
        const sel = st.gadgetSelected===id ? " §e[SELECTED]" : "";
        const lock = unlocked ? "§a" : "§c[LOCKED] ";
        form.button(`${lock}${cfg.name}${sel}\n§7${cfg.desc}`);
      }
      form.button("§a▶ Activate Selected");
      form.button("§7◀ Back");
      const res = await form.show(player);
      if(res.canceled) return;
      if(res.selection === ids.length){ // activate
        this.gadgets.activateSelected(player);
        return;
      }
      if(res.selection === ids.length+1){ await this.openMainMenu(player); return; }
      const chosenId = ids[res.selection];
      if(!chosenId) return;
      const ok = this.gadgets.selectGadget(player, chosenId);
      if(ok){
        // also activate preview?
        await this.openGadgetMenu(player);
      } else {
        await this.openGadgetMenu(player);
      }
    }finally{ this.opening.delete(player.id); }
  }

  async openProgressionMenu(player){
    this.opening.add(player.id);
    try{
      const list = this.progression.getForPlayer(player);
      const form = new ActionFormData().title("§aProgression & Challenges").body("§7Track progress and claim rewards. Progress saves automatically.");
      for(const ch of list){
        const state = ch.progress.claimed ? "§a✓ Claimed" : ch.progress.done ? "§eREADY TO CLAIM" : `§7${ch.pct}%`;
        form.button(`§f${ch.name} §7(${state})\n§7${ch.desc}`);
      }
      form.button("§7◀ Back");
      const res = await form.show(player);
      if(res.canceled) return;
      if(res.selection === list.length){ await this.openMainMenu(player); return; }
      const chosen = list[res.selection];
      if(!chosen) return;
      // show detail message form
      await this.openChallengeDetail(player, chosen);
    }finally{ this.opening.delete(player.id); }
  }

  async openChallengeDetail(player, ch){
    this.opening.add(player.id);
    try{
      const prog = ch.progress;
      let body = `§7${ch.desc}\n\n`;
      body += `§7Type: §f${ch.type} §7| Progress: §f${ch.pct}%\n`;
      body += `§7Done: ${prog.done ? "§aYes" : "§cNo"}  §7Claimed: ${prog.claimed ? "§aYes" : "§cNo"}\n`;
      if(ch.reward.suit) body += `§7Reward Suit: §f${SUIT_CONFIG[ch.reward.suit].name}\n`;
      if(ch.reward.tokens) body += `§7Reward Tokens: §a+${ch.reward.tokens}\n`;
      const form = new MessageFormData()
        .title(ch.name)
        .body(body)
        .button1("Claim Reward")
        .button2("Back");
      const res = await form.show(player);
      if(res.canceled) return;
      if(res.selection === 0){
        this.progression.claim(player, ch.id);
      }
      await this.openProgressionMenu(player);
    }finally{ this.opening.delete(player.id); }
  }

  async openHelpMenu(player){
    this.opening.add(player.id);
    try{
      const form = new MessageFormData()
        .title("§eSpider Guide")
        .body(
          "§l§cSPIDER-MAN: Definitive Experience §r§7— Quick Guide\n\n"+
          "§f§lTraversal:\n"+
          "§7• Hold §fWeb-Shooter §7(use) to fire toward where you look. A solid block within 38m is needed.\n"+
          "§7• While swinging, §fuse again §7to release and keep momentum (slow falling protects you).\n"+
          "§7• Quick §fzip §7to anchor available when swinging; also via gadget §fWeb-Zip/Pull§7.\n\n"+
          "§f§lClimbing:\n"+
          "§7• Get close to a wall, §fSneak §7to cling (auto-detect). Look up to climb, look down+Sneak to descend.\n"+
          "§7• §fJump §7to leap off with boost.\n"+
          "§7• Wall stick lasts while surface exists; moving away detaches safely.\n\n"+
          "§f§lGadgets:\n"+
          "§7• Open §fGadget Wheel §7from main menu or via Suit Station.\n"+
          "§7• Impact Web = damage + knockback; Restraint = temporary trap; Tech Pulse = AoE slow; Scanner = highlight threats.\n\n"+
          "§f§lSpider-Sense:\n"+
          "§7• Passive proximity scan every ~0.6s within 22m. Alerts show direction and count.\n"+
          "§7• Use §fThreat Scanner gadget §7for active scan with glow.\n\n"+
          "§f§lCombat:\n"+
          "§7• Melee hits build combo (up to 4x). Air hits add bonus. Dodging gives brief resistance.\n"+
          "§7• Finisher hint when target low.\n\n"+
          "§f§lSuits & Progression:\n"+
          "§7• Starter: Classic & Homemade. Others unlock via challenges (see Progression menu).\n"+
          "§7• Equip at §fSuit Station block §7or via menu.\n"+
          "§7• Tokens from kills/challenges.\n\n"+
          "§8Tip: On mobile, keep Web-Shooter in main hand, menu via suit_changer item or /function spider:menu"
        )
        .button1("Close")
        .button2("Open Main Menu");
      const res = await form.show(player);
      if(res.selection === 1) await this.openMainMenu(player);
    }finally{ this.opening.delete(player.id); }
  }

  async openSettingsMenu(player){
    this.opening.add(player.id);
    try{
      const st = getState(player);
      const form = new ModalFormData().title("§8Settings")
        .slider("Particle Intensity", 0, 2, 1, st.settings.particleIntensity ?? 1)
        .toggle("HUD ActionBar enabled", st.settings.hudEnabled ?? true)
        .toggle("Spider-Sense enabled", st.settings.senseEnabled ?? true)
        .slider("Sense volume (UI pitch)", 0, 2, 1, st.settings.senseVolume ?? 1);
      // ModalFormData requires submit button; we use show default
      const res = await form.show(player);
      if(res.canceled) return;
      const [part, hud, sense, vol] = res.formValues;
      st.settings.particleIntensity = part;
      st.settings.hudEnabled = hud;
      st.settings.senseEnabled = sense;
      st.settings.senseVolume = vol;
      // persist hint
      player.sendMessage("§aSettings saved");
    }finally{ this.opening.delete(player.id); }
  }

  chatFallback(player){
    player.sendMessage("§c[Spider-DE] Menu fallback: use commands:");
    player.sendMessage(" §7/function spider:menu  §f- open main menu");
    player.sendMessage(" §7/function spider:suit_next §f- cycle suit");
    player.sendMessage(" §7Web-Shooter use §f= swing, §fSneak near wall §f= climb");
  }

  sendHUD(player, st){
    // actionbar HUD consolidated elsewhere; this is helper for persistent HUD updates
    if(!st.settings.hudEnabled) return;
    // called occasionally from tick, not every tick
  }

}
