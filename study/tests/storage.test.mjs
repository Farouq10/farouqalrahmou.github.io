import test from "node:test";
import assert from "node:assert/strict";
import {newSession,applyRating,SESSION_KEY,LEGACY_SESSION_KEY,deckSignature} from "../queue.mjs";
import {loadProgress,saveProgress} from "../persistence.mjs";

const deck={id:"persisted-deck",cards:["a","b","c"].map(id=>({
  id,front:"Question "+id,back:"Answer "+id,focus:"fact"
}))};
const cache=new Map();
globalThis.localStorage={
  getItem:key=>cache.get(key)??null,
  setItem:(key,value)=>cache.set(key,String(value))
};

test("a full browser reload keeps the precise queue and mistakes",async()=>{
  cache.clear();
  let state=newSession(deck,()=>0.99);
  state=applyRating(state,deck,"easy");
  state=applyRating(state,deck,"impossible");
  const saved=await saveProgress(state);
  assert.equal(saved.replicas,1); // Node has no IndexedDB; localStorage fallback works.
  const resumed=await loadProgress(deck);
  assert.deepEqual(resumed.session.queue,state.queue);
  assert.deepEqual(resumed.session.complete,["a"]);
  assert.equal(resumed.session.progress.b.errors,1);
});
test("Study again persists a fresh session even if old revision was higher",async()=>{
  cache.clear();
  let finished=newSession(deck,()=>0.99);
  for(let i=0;i<3;i++)finished=applyRating(finished,deck,"very_easy");
  await saveProgress(finished);
  const restarted=newSession(deck,()=>0.99);
  await saveProgress(restarted);
  const loaded=await loadProgress(deck);
  assert.equal(loaded.session.queue.length,3);
  assert.equal(loaded.session.complete.length,0);
});
test("version 2 progress migrates without discarding grades",async()=>{
  cache.clear();
  let state=newSession(deck,()=>0.99);
  state=applyRating(state,deck,"easy");
  const legacy={
    schema:2,signature:deckSignature(deck),
    queue:state.queue,complete:state.complete,
    progress:state.progress,attempts:state.attempts
  };
  cache.set(LEGACY_SESSION_KEY,JSON.stringify(legacy));
  const restored=await loadProgress(deck);
  assert.deepEqual(restored.session.complete,["a"]);
  assert.equal(restored.session.attempts,1);
  await saveProgress(restored.session);
  assert.ok(cache.get(SESSION_KEY));
});
test("deck update preserves progress through actual save/reload",async()=>{
  cache.clear();
  let state=newSession(deck,()=>0.99);
  state=applyRating(state,deck,"easy");
  await saveProgress(state);
  const updated={...deck,cards:[
    ...deck.cards,{id:"new",front:"New question",back:"New answer",focus:"fact"}
  ]};
  const restored=await loadProgress(updated);
  assert.deepEqual(restored.session.complete,["a"]);
  assert.equal(restored.session.queue[0],"new");
});
test("corrupt local data safely starts a fresh queue",async()=>{
  cache.clear();
  cache.set(SESSION_KEY,"{broken");
  const result=await loadProgress(deck);
  assert.equal(result.session.queue.length,3);
  assert.equal(result.recovered,false); // corrupt JSON cannot be parsed
});
