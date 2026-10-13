import test from "node:test";
import assert from "node:assert/strict";
import {newSession,applyRating} from "../queue.mjs";
import {comparable,decideFirstSync} from "../cloud-policy.mjs";
const deck={id:"a",cards:["1","2","3"].map(id=>({id,front:id,back:"answer "+id,focus:"fact"}))};
const fresh=()=>newSession(deck,()=>0.99);
const cloud=(session,version=1)=>({schema:1,version,session});
test("fresh account uploads saved browser progress",()=>{
  const local=applyRating(fresh(),deck,"easy");
  assert.equal(decideFirstSync(local,null,deck).action,"upload");
});
test("new device fetches existing account progress",()=>{
  const remote=applyRating(fresh(),deck,"no_idea");
  assert.equal(decideFirstSync(fresh(),cloud(remote),deck).action,"download");
});
test("matching data does not overwrite either side",()=>{
  const reviewed=applyRating(fresh(),deck,"easy");
  const result=decideFirstSync(reviewed,cloud(structuredClone(reviewed)),deck);
  assert.equal(result.action,"identical");
  assert.equal(comparable(result.session),comparable(reviewed));
});
test("two divergent used queues cause explicit conflict",()=>{
  const local=applyRating(fresh(),deck,"no_idea");
  const remote=applyRating(fresh(),deck,"easy");
  assert.equal(decideFirstSync(local,cloud(remote),deck).action,"conflict");
});
test("invalid remote data must never overwrite the browser",()=>{
  const local=fresh();
  assert.equal(decideFirstSync(local,{schema:1,version:1,session:{queue:["bad"]}},deck).action,"invalid");
});
test("adding cards to the code deck retains cloud review progress",()=>{
  const old=applyRating(fresh(),deck,"easy");
  const expanded={...deck,cards:[...deck.cards,{id:"4",front:"4",back:"answer 4",focus:"fact"}]};
  const output=decideFirstSync(newSession(expanded,()=>0.99),cloud(old),expanded);
  assert.equal(output.action,"download");
  assert.deepEqual(output.session.complete,["1"]);
  assert.equal(output.session.queue[0],"4");
});
