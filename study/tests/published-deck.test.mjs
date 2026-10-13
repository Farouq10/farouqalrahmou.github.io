import test from "node:test";
import assert from "node:assert/strict";
import { PUBLISHED_DECK, syncPublishedDeck } from "../published-deck.mjs";
import { freshState, validateSnapshot } from "../storage.mjs";
import { reviewCard } from "../scheduler.mjs";
const now=Date.parse("2026-10-13T12:00:00Z");
test("all published cards have unique stable IDs",()=>{
  assert.ok(PUBLISHED_DECK.cards.length >= 10);
  assert.equal(new Set(PUBLISHED_DECK.cards.map(c=>c.id)).size,PUBLISHED_DECK.cards.length);
});
test("fresh browser gets every code-owned card",()=>{
  const state=syncPublishedDeck(freshState());
  assert.equal(state.cards.length,PUBLISHED_DECK.cards.length);
  assert.equal(state.decks.length,1);
  assert.equal(state.cards[0].front,PUBLISHED_DECK.cards[0].front);
  assert.equal(state.settings.selectedDeck,PUBLISHED_DECK.id);
  assert.equal(validateSnapshot(state),state);
});
test("reopening preserves spaced-repetition state but never edits shared content",()=>{
  const state=syncPublishedDeck(freshState());
  const original=state.cards[0];
  const after=reviewCard(original,3,now);
  state.cards[0]=after;
  syncPublishedDeck(state);
  assert.equal(state.cards[0].dueAt,after.dueAt);
  assert.equal(state.cards[0].reps,1);
  assert.equal(state.cards[0].front,PUBLISHED_DECK.cards[0].front);
  assert.equal(state.cards[0].back,PUBLISHED_DECK.cards[0].back);
});
test("imported changes to a published answer are rejected/reset by code",()=>{
  const state=syncPublishedDeck(freshState());
  state.cards[0]={...reviewCard(state.cards[0],3,now),back:"ALTERED"};
  syncPublishedDeck(state);
  assert.equal(state.cards[0].back,PUBLISHED_DECK.cards[0].back);
  assert.equal(state.cards[0].reps,0);
});
test("legacy local decks/cards are not erased by migration",()=>{
  const state=freshState();
  state.decks.push({id:"olddeck",name:"Older private deck",examDate:"",createdAt:now});
  state.cards.push({id:"oldcard",deckId:"olddeck",front:"old front",back:"old back",focus:"fact",reps:0,lapses:0,dueAt:0,createdAt:now});
  state.reviews.push({id:"rev1",cardId:"oldcard",at:now,grade:3});
  syncPublishedDeck(state);
  assert.ok(state.decks.some(d=>d.id==="olddeck"));
  assert.ok(state.cards.some(c=>c.id==="oldcard"));
  assert.ok(state.reviews.some(r=>r.id==="rev1"));
  assert.equal(validateSnapshot(state),state);
});
test("rogue extra published cards never show up in canonical deck",()=>{
  const state=syncPublishedDeck(freshState());
  state.cards.push({id:"injected",deckId:PUBLISHED_DECK.id,front:"malicious",back:"malicious",createdAt:now,reps:0,lapses:0,dueAt:0});
  syncPublishedDeck(state);
  assert.ok(!state.cards.some(c=>c.id==="injected"));
});
