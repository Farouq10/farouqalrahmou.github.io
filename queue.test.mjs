import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLISHED_DECK} from './study/published-deck.mjs';
import {validateDeck,newSession,applyRating,restoreSession,isValidSession} from './study/queue.mjs';
const deck={id:'test',name:'Test',cards:Array.from({length:8},(_,i)=>({id:'c'+i,front:'Q'+i,back:'A'+i}))};
const fresh=()=>newSession(deck,()=>0.5);
test('expanded deck has unique valid cards',()=>{assert.equal(validateDeck(PUBLISHED_DECK).cards.length,237);});
test('correct unseen card retires and does not repeat',()=>{
 let s=fresh();const id=s.queue[0];s=applyRating(s,deck,'easy');
 assert.ok(s.complete.includes(id));assert.ok(!s.queue.includes(id));
});
test('all unseen cards precede a failed repeat; mistake needs two later successes',()=>{
 let s=fresh();const id=s.queue[0];s=applyRating(s,deck,'impossible');
 assert.equal(s.queue.at(-1),id);
 for(let i=0;i<7;i++)s=applyRating(s,deck,'easy');
 assert.equal(s.queue[0],id);s=applyRating(s,deck,'easy');
 assert.deepEqual(s.queue,[id]);assert.equal(s.progress[id].correctAfterError,1);
 s=applyRating(s,deck,'easy');assert.deepEqual(s.queue,[]);assert.ok(s.complete.includes(id));
});
test('another failure resets the correction streak',()=>{
 let s=fresh();const id=s.queue[0];s=applyRating(s,deck,'no_idea');
 for(let i=0;i<7;i++)s=applyRating(s,deck,'easy');
 s=applyRating(s,deck,'easy');s=applyRating(s,deck,'not_quite');
 assert.equal(s.progress[id].correctAfterError,0);assert.ok(s.queue.includes(id));
});
test('post-initial-pass mistakes use original 4/2/1 positions',()=>{
 for(const [rating,lag] of [['not_quite',4],['no_idea',2],['impossible',1]]){
  let s=fresh();for(let i=0;i<8;i++)s=applyRating(s,deck,'impossible');
  const id=s.queue[0];s=applyRating(s,deck,rating);assert.equal(s.queue.indexOf(id),lag);
 }
});
test('new cards preserve unchanged progress and completed pile',()=>{
 let s=fresh();const id=s.queue[0];s=applyRating(s,deck,'easy');
 const expanded={...deck,cards:[...deck.cards,{id:'new',front:'New?',back:'New.'}]};
 const restored=restoreSession(JSON.parse(JSON.stringify(s)),expanded);
 assert.ok(isValidSession(restored,expanded));assert.ok(restored.complete.includes(id));
 assert.equal(restored.queue[0],'new');assert.deepEqual(restored.progress[id],s.progress[id]);
});
test('corrupt backups are rejected',()=>{assert.equal(restoreSession({schema:3},deck),null);});
