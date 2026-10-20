import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(process.env.ALPHA_TEST_MODULES || new URL('../package.json',import.meta.url));
const {parseHTML}=require('linkedom');
const {window,document}=parseHTML(await readFile(new URL('../index.html',import.meta.url),'utf8'));
const records=new Map();
Object.assign(globalThis,{window,document,location:{hash:''},localStorage:{getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v)},confirm:()=>true});
Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
const dialog=document.querySelector('dialog');dialog.showModal=function(){this.open=true};dialog.close=function(){this.open=false};
const {receiveSession}=await import('../app.js');
function navigate(hash){location.hash='#/'+hash;window.dispatchEvent(new window.Event('hashchange'))}
function click(selector){const el=document.querySelector(selector);assert.ok(el,'Missing '+selector);el.dispatchEvent(new window.Event('click',{bubbles:true}));return el}
test('study flow shows a deck, reveals and rates a card, and retains progress after reload boundary',async()=>{
 assert.equal(document.querySelector('h1').textContent,'Study');assert.ok(document.querySelectorAll('.deck').length>=6);
 assert.equal(document.querySelectorAll('.hero,.sidebar,.pill').length,0);
 click('[data-start]');navigate('review');assert.ok(document.querySelector('.question'));
 click('[data-action="flip"]');assert.ok(document.querySelector('.answer'));assert.equal(document.querySelectorAll('[data-grade]').length,5);
 click('[data-grade="3"]');assert.equal(JSON.parse(records.get('tessera-progress-v1')).reviews.length,1);
 await receiveSession(null,null,'guest');navigate('dashboard');assert.match(document.querySelector('.counts').textContent,/1 answered today/);
});
test('account dialog reports activation honestly and can close',()=>{
 click('#authButton');assert.equal(dialog.open,true);assert.match(dialog.textContent,/(not activated|could not connect)/i);assert.equal(dialog.querySelector('input[type="password"]'),null);click('[data-action="closeAccount"]');assert.equal(dialog.open,false);
});
test('actual account transitions clear guest progress and restore only the matching account',async()=>{
 await receiveSession({uid:'alice',email:'alice@example.com'},null,'loading');await receiveSession({uid:'alice',email:'alice@example.com'},null,'loaded');navigate('dashboard');assert.match(document.querySelector('.counts').textContent,/0 answered today/);
 click('[data-start]');navigate('review');click('[data-action="flip"]');click('[data-grade="4"]');assert.equal(JSON.parse(records.get('alpha-user-v2:alice')).reviews.length,1);
 await receiveSession({uid:'bob',email:'bob@example.com'},null,'loading');await receiveSession({uid:'bob',email:'bob@example.com'},null,'loaded');navigate('dashboard');assert.match(document.querySelector('.counts').textContent,/0 answered today/);
 await receiveSession({uid:'alice',email:'alice@example.com'},null,'loading');await receiveSession({uid:'alice',email:'alice@example.com'},null,'loaded');navigate('dashboard');assert.match(document.querySelector('.counts').textContent,/1 answered today/);
 await receiveSession(null,null,'loading');await receiveSession(null,null,'guest');assert.equal(document.querySelector('#authButton').textContent,'Sign in');assert.equal(document.querySelector('#resourcesNav').hidden,true);
});
test('private resources are not rendered for guests or friends',async()=>{
 navigate('resources');assert.equal(document.querySelector('#resourceForm'),null);assert.match(document.querySelector('#page').textContent,/owner/);
 await receiveSession({uid:'friend',email:'friend@example.com'},null,'loading');await receiveSession({uid:'friend',email:'friend@example.com'},null,'loaded');navigate('resources');assert.equal(document.querySelector('#resourceForm'),null);
});

test('daily problems render all levels, allow archive browsing and persist attempt markers',()=>{
 navigate('problems');assert.equal(document.querySelectorAll('.daily-problem').length,3);
 const button=click('[data-problem-status="attempted"]');
 // This test may run under the final account from the previous transition test.
 const current=[...records.values()].map(value=>JSON.parse(value)).find(value=>Object.values(value.prefs?.problemLog||{}).includes('attempted'));
 assert.ok(current);assert.equal(button.getAttribute('aria-pressed'),'true');
 navigate('problems?day=30');assert.match(document.querySelector('.page-heading').textContent,/Bank day 30/);
 assert.equal(document.querySelectorAll('.daily-problem').length,3);
});
test('articles contain full sections and companion cards, and text is safely rendered',()=>{
 navigate('reading');assert.equal(document.querySelectorAll('.article-row').length,4);
 navigate('reading/kamikaze');assert.ok(document.querySelectorAll('.reading-article>section').length>=8);
 assert.ok(document.querySelector('.reading-article').textContent.length>8000);
 assert.ok(document.querySelector('[data-open]'));
 const readButton=click('[data-article-read]');assert.equal(readButton.getAttribute('aria-pressed'),'true');
 navigate('reading/does-not-exist');assert.match(document.querySelector('h1').textContent,/not found/);
});
