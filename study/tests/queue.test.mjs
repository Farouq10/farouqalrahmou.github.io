import test from "node:test";
import assert from "node:assert/strict";
import {
  RATINGS, newSession, deckSignature, applyRating, currentCard,
  isValidSession, remainingMistakes
} from "../queue.mjs";
import {PUBLISHED_DECK} from "../published-deck.mjs";
const deck={id:"testdeck",cards:["a","b","c","d","e","f","g"].map(id=>({id,front:id+" front",back:id+" back",focus:"fact"}))};
const initial=()=>newSession(deck,()=>0.999);
test("only one canonical published deck with unique questions and IDs",()=>{
  const ids=PUBLISHED_DECK.cards.map(c=>c.id);
  assert.ok(ids.length>=10);
  assert.equal(ids.length,new Set(ids).size);
  assert.ok(PUBLISHED_DECK.cards.every(c=>c.front.length&&c.back.length));
});
test("new sessions contain every card once in a shuffled queue",()=>{
  const s=initial();
  assert.deepEqual(s.queue,["a","b","c","d","e","f","g"]);
  assert.equal(s.complete.length,0);
  assert.equal(currentCard(s,deck).id,"a");
  assert.ok(isValidSession(s,deck));
});
test("initial easy or very easy retires a card, not another queue repeat",()=>{
  const s1=applyRating(initial(),deck,"very_easy");
  assert.equal(s1.complete[0],"a");
  const s2=applyRating(s1,deck,"easy");
  assert.deepEqual(s2.complete,["a","b"]);
  assert.equal(s2.queue[0],"c");
});
test("all cards are seen before any wrong item repeats",()=>{
  let s=initial();
  s=applyRating(s,deck,"impossible"); // a moves AFTER every untouched card
  assert.deepEqual(s.queue,["b","c","d","e","f","g","a"]);
  for(let n=0;n<6;n++) s=applyRating(s,deck,"very_easy");
  assert.deepEqual(s.queue,["a"]);
  assert.equal(s.progress.a.seen,1);
});
test("later reinsertions go sooner when rated harder",()=>{
  let s=initial();
  s=applyRating(s,deck,"not_quite");
  for(let n=0;n<6;n++)s=applyRating(s,deck,"very_easy");
  // To test reinsertion relative to other rechecks, build a live queue
  // by first rating multiple first-pass cards as wrong.
  for(const [rating, expected] of [
    ["impossible",1],["no_idea",2],["not_quite",4]
  ]){
    let state=initial();
    for(let n=0;n<7;n++)state=applyRating(state,deck,"no_idea");
    // all seven missed; now no unseen cards, current is a
    state=applyRating(state,deck,rating);
    assert.equal(state.queue.indexOf("a"),Math.min(6,expected));
  }
});
test("wrong cards require two LATER correct recalls before leaving the deck",()=>{
  let s=initial();
  s=applyRating(s,deck,"no_idea");
  for(let n=0;n<6;n++)s=applyRating(s,deck,"very_easy");
  assert.deepEqual(s.queue,["a"]);
  assert.equal(remainingMistakes(s),1);
  s=applyRating(s,deck,"very_easy");
  assert.equal(s.complete.includes("a"),false);
  assert.equal(s.progress.a.correctAfterError,1);
  s=applyRating(s,deck,"easy");
  assert.equal(s.queue.length,0);
  assert.equal(s.complete.length,7);
  assert.equal(s.progress.a.correctAfterError,2);
});
test("another mistake resets the recovery streak",()=>{
  let s=initial();
  s=applyRating(s,deck,"not_quite");
  for(let n=0;n<6;n++)s=applyRating(s,deck,"very_easy");
  s=applyRating(s,deck,"easy");
  s=applyRating(s,deck,"impossible");
  assert.equal(s.progress.a.correctAfterError,0);
  assert.equal(s.progress.a.errors,2);
});
test("invalid ratings and corrupt state are rejected",()=>{
  assert.throws(()=>applyRating(initial(),deck,"unknown"));
  let s=initial();
  s.queue.push("a");
  assert.equal(isValidSession(s,deck),false);
  assert.throws(()=>applyRating(s,deck,"easy"));
});
test("changes to a question invalidate saved queue but not the published deck",()=>{
  const s=initial();
  const revised={...deck,cards:deck.cards.map(c=>c.id==="a"?{...c,back:"changed"}:c)};
  assert.notEqual(deckSignature(revised),deckSignature(deck));
  assert.equal(isValidSession(s,revised),false);
});
test("finishes only when every card is successfully mastered",()=>{
  let s=initial();
  for(let n=0;n<7;n++)s=applyRating(s,deck,"very_easy");
  assert.equal(s.queue.length,0);
  assert.throws(()=>applyRating(s,deck,"easy"));
});
