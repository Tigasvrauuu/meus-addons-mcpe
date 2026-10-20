import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.com/meus-addons-mcpe/',pretendToBeVisual:true});
for(const key of ['window','document','MutationObserver','HTMLElement','Node'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
let clipboard='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{clipboard=text;}}});
const files=await readdir(new URL('../dist/assets/',import.meta.url));
await import(new URL('../dist/assets/'+files.find(f=>f.endsWith('.js')),import.meta.url));
const settle=()=>new Promise(r=>setTimeout(r,40));await settle();
const click=async element=>{assert.ok(element);element.click();await settle();};
test('React renders the complete page and every section anchor resolves',()=>{
 assert.match(document.querySelector('h1').textContent,/Sua história/);
 for(const a of document.querySelectorAll('a[href^="#"]'))assert.ok(document.querySelector(a.getAttribute('href')));
 assert.equal(document.querySelectorAll('.ability-card').length,3);
});
test('six suits select real content and arrows wrap around',async()=>{
 const tabs=[...document.querySelectorAll('[role="tab"]')];assert.equal(tabs.length,6);
 await click(tabs[4]);assert.equal(document.querySelector('.suit-detail h3').textContent,'Urban Spark');
 assert.equal(tabs[4].getAttribute('aria-selected'),'true');
 await click(document.querySelector('[aria-label="Próximo traje"]'));assert.equal(document.querySelector('.suit-detail h3').textContent,'Iron Weaver');
 await click(document.querySelector('[aria-label="Próximo traje"]'));assert.equal(document.querySelector('.suit-detail h3').textContent,'Classic');
});
test('mobile navigation opens and closes after a selection',async()=>{
 await click(document.querySelector('.mobile-toggle'));assert.ok(document.querySelector('nav.open'));
 await click(document.querySelector('nav a'));assert.equal(document.querySelector('nav.open'),null);
});
test('FAQ expands, copies the actual command and closes',async()=>{
 await click(document.querySelectorAll('.faq-item>button')[2]);assert.equal(document.querySelector('#answer-2').hidden,false);
 await click(document.querySelector('.copy-command'));assert.equal(clipboard,'/give @s spider:console');
 await click(document.querySelectorAll('.faq-item>button')[2]);assert.equal(document.querySelector('#answer-2').hidden,true);
});
test('download points to a real ZIP package and documentation links are valid GitHub shapes',async()=>{
 const a=document.querySelector('a[download]');assert.ok(a.href.endsWith('.mcaddon'));
 const data=await readFile(new URL('../public/Spider-Man-Definitive-Experience-1.0.0.mcaddon',import.meta.url));assert.equal(data.subarray(0,2).toString(),'PK');
 for(const a of document.querySelectorAll('a[href*="github.com"]'))assert.ok(!a.href.includes('/tree/arena/eb62ae4e-meus-addons-mcpe/blob/'));
});
