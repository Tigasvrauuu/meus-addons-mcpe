import { Player } from '@minecraft/server';
import { Vec } from './math.js';
import { suits, gadgets } from './config.js';
export type Save={version:1;suit:string;gadget:string;xp:number;kit:boolean;particles:boolean;sense:boolean;challenge:number;best:number};
export type State={save:Save;mode:'idle'|'swing'|'climb';anchor?:Vec;block?:Vec;rope:number;dimension:string;last:Vec;cool:Record<string,number>;menu:boolean;combo:number;lastHit:number;challenge?:{until:number;swings:number;hits:number};alertUntil:number;alert:string};
export const states=new Map<string,State>();
export function decode(value:unknown):Save {
 let d:any={}; try { d=typeof value==='string'?JSON.parse(value):{}; } catch { /* invalid persisted JSON resets to safe defaults */ }
 if(!d||typeof d!=='object')d={};
 const count=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(1000000,Math.floor(n))):0;
 const xp=count(d.xp);
 return {version:1,suit:suits.some(s=>s.id===d.suit&&s.cost<=xp)?d.suit:'classic',gadget:gadgets.some(g=>g.id===d.gadget)?d.gadget:'impact',xp,kit:d.kit===true,particles:d.particles!==false,sense:d.sense!==false,challenge:count(d.challenge),best:count(d.best)};
}
export function state(p:Player):State {
 let s=states.get(p.id); if(!s){s={save:decode(p.getDynamicProperty('spider:save')),mode:'idle',rope:0,dimension:p.dimension.id,last:p.location,cool:{},menu:false,combo:0,lastHit:0,alertUntil:0,alert:''};states.set(p.id,s);}return s;
}
export function persist(p:Player,s:State){p.setDynamicProperty('spider:save',JSON.stringify(s.save));}
export function release(s:State){s.mode='idle';s.anchor=undefined;s.block=undefined;}
