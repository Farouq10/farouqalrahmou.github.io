import test from "node:test";
import assert from "node:assert/strict";
import { probability, intervalDays, reviewCard, chooseNext, priority, detectConfusion, todayKey, DAY } from "../scheduler.mjs";
import { newCard, validateSnapshot, freshState } from "../storage.mjs";
const now = Date.parse("2026-10-13T12:00:00Z");
const base = { id:"card1", deckId:"d1", front:"When?", back:"1948", createdAt:now-10000, reps:0, lapses:0, dueAt:0 };
test("FSRS-6 curve is anchored at 90% on stability day", () => {
  for (const s of [0.25, 1, 3, 31, 300]) assert.ok(Math.abs(probability(s,s) - 0.9) < 1e-12);
});
test("interval inversion is consistent with recall target", () => {
  for (const r of [0.75,0.85,0.9,0.95]) {
    const d=intervalDays(10,r);
    assert.ok(Math.abs(probability(10,d)-r)<1e-10);
  }
});
test("initial FSRS-6 Good creates approximately 2.3065d stability", () => {
  const card=reviewCard(base,3,now);
  assert.equal(card.stability,2.3065);
  assert.equal(card.reps,1);
  assert.ok(Math.abs((card.dueAt-now)/DAY-2.3065)<1e-9);
});
test("Again schedules delayed unaided recheck and increments lapses", () => {
  const card=reviewCard(base,1,now);
  assert.equal(card.lapses,1);
  assert.equal(Math.round((card.dueAt-now)/60000),2);
});
test("successful same-day recall does not shrink stability", () => {
  const c=reviewCard(base,3,now);
  const next=reviewCard(c,2,now+3*60000);
  assert.ok(next.stability>=c.stability);
  assert.ok(next.difficulty>=1 && next.difficulty<=10);
});
test("long-delay successful recall grows stability", () => {
  const c=reviewCard(base,3,now);
  const next=reviewCard(c,3,now+4*DAY);
  assert.ok(next.stability>c.stability);
});
test("prioritise due before new while respecting new limit", () => {
  const due=reviewCard(base,3,now-5*DAY);
  assert.equal(chooseNext([base,{...due,id:"reviewed"}],now).id,"reviewed");
  assert.equal(chooseNext([base],now,{newLimit:0}),null);
  assert.equal(chooseNext([base],now,{newLimit:2}).id,"card1");
});
test("exam priority remains finite and deterministic", () => {
  const c=reviewCard(base,3,now-4*DAY);
  assert.ok(Number.isFinite(priority(c,now,now+9*DAY)));
});
test("detect specific wrong-answer confusion without changing grade", () => {
  const other={...base,id:"card2",back:"1949"};
  assert.equal(detectConfusion(base," 1949 ",[base,other])?.id,"card2");
  assert.equal(detectConfusion(base,"1948",[base,other]),null);
});
test("backup validates deck-card ownership and settings", () => {
  const s=freshState();
  s.decks.push({id:"d1",name:"Cold War",createdAt:now,examDate:""});
  s.cards.push(base);
  assert.equal(validateSnapshot(s),s);
  assert.throws(()=>validateSnapshot({...s,cards:[{...base,deckId:"unknown"}]}));
});
test("locally dated log key is formatted", () => {
  assert.match(todayKey(now),/^\d{4}-\d{2}-\d{2}$/);
});
test("new card validates fields", () => {
  const c=newCard("d1","What happened in 1948?","Berlin Blockade","event");
  assert.equal(c.reps,0);
  assert.throws(()=>newCard("d1","","1948"));
});
