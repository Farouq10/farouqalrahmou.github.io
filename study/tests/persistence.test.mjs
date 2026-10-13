import test from "node:test";
import assert from "node:assert/strict";
import {newSession,applyRating,restoreSession,isValidSession,deckSignature} from "../queue.mjs";
const deck={
  id:"one-deck",
  cards:["a","b","c","d"].map(id=>({id,front:"Question "+id,back:"Answer "+id,focus:"fact"}))
};
const fresh=()=>newSession(deck,()=>0.99);
test("existing progress is unchanged when deck content is unchanged",()=>{
  let session=fresh();
  session=applyRating(session,deck,"very_easy");
  session=applyRating(session,deck,"impossible");
  const resumed=restoreSession(structuredClone(session),deck);
  assert.deepEqual(resumed,session);
  assert.equal(resumed.complete.length,1);
  assert.equal(resumed.queue[0],"c");
});
test("adding cards retains original queue, mastered pile, and grades",()=>{
  let session=fresh();
  session=applyRating(session,deck,"very_easy");
  session=applyRating(session,deck,"no_idea");
  const upgraded={...deck,cards:[...deck.cards,{id:"e",front:"New question",back:"New answer",focus:"date"}]};
  const restored=restoreSession(session,upgraded);
  assert.ok(isValidSession(restored,upgraded));
  assert.deepEqual(restored.complete,["a"]);
  assert.equal(restored.queue[0],"e");
  assert.equal(restored.progress.b.errors,1);
  assert.equal(restored.progress.e.seen,0);
  assert.deepEqual(restored.queue.slice(1),session.queue);
});
test("revising one answer resets only the affected card",()=>{
  let session=fresh();
  session=applyRating(session,deck,"easy"); // a complete
  session=applyRating(session,deck,"impossible"); // b failed
  const changed={...deck,cards:deck.cards.map(c=>c.id==="b"?{...c,back:"New answer B"}:c)};
  const resumed=restoreSession(session,changed);
  assert.ok(isValidSession(resumed,changed));
  assert.equal(resumed.queue[0],"b");
  assert.equal(resumed.progress.b.errors,0);
  assert.deepEqual(resumed.complete,["a"]);
  assert.deepEqual(resumed.queue.slice(1),session.queue.filter(id=>id!=="b"));
});
test("deleted cards are removed, other progress is kept",()=>{
  let session=fresh();
  session=applyRating(session,deck,"easy");
  const smaller={...deck,cards:deck.cards.filter(c=>c.id!=="c")};
  const restored=restoreSession(session,smaller);
  assert.ok(isValidSession(restored,smaller));
  assert.deepEqual(restored.complete,["a"]);
  assert.ok(!restored.queue.includes("c"));
});
test("legacy v2 progress migrates only if the deck is identical",()=>{
  let session=fresh();
  session=applyRating(session,deck,"easy");
  const legacy={
    schema:2,signature:deckSignature(deck),
    queue:session.queue,complete:session.complete,
    progress:session.progress,attempts:session.attempts
  };
  const restored=restoreSession(legacy,deck);
  assert.ok(isValidSession(restored,deck));
  assert.deepEqual(restored.queue,session.queue);
  assert.deepEqual(restored.complete,session.complete);
  assert.equal(restored.attempts,session.attempts);
  const revised={...deck,cards:deck.cards.map(c=>c.id==="a"?{...c,back:"X"}:c)};
  assert.equal(restoreSession(legacy,revised),null);
});
test("corrupted snapshots never become active",()=>{
  const session=fresh();
  session.queue.push("a");
  assert.equal(restoreSession(session,deck),null);
});
