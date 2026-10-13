/**
 * A small, session-based adaptive queue.
 * Scientific basis: retrieval practice, corrective feedback, successive
 * relearning, and interleaving. The numeric queue distances are design
 * heuristics, NOT experimentally calibrated intervals and NOT FSRS.
 *
 * All cards get one first exposure before retry cards can reappear.
 * An initially successful card retires immediately.
 * A missed card needs TWO later fully correct recalls to retire.
 * One fixed code-published deck, one independent local session per browser.
 */
export const RATINGS = Object.freeze([
  { id:"very_easy", label:"Very easy", detail:"Instant, completely correct", lag:12, correct:true },
  { id:"easy", label:"Easy", detail:"Correct without much difficulty", lag:7, correct:true },
  { id:"not_quite", label:"Not quite", detail:"Partly correct", lag:4, correct:false },
  { id:"no_idea", label:"No idea", detail:"Didn't remember the answer", lag:2, correct:false },
  { id:"impossible", label:"Impossible", detail:"Couldn't begin or understand it", lag:1, correct:false }
]);
export const SESSION_KEY = "study-queue-v2";
const SCHEMA = 2;
const isId = id => typeof id==="string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id);

export function deckSignature(deck) {
  // A stable content fingerprint: reload with new code starts a new session,
  // instead of accidentally applying grades to revised questions.
  const data=JSON.stringify([deck.id,deck.cards.map(c=>[c.id,c.front,c.back,c.focus])]);
  let hash=2166136261;
  for(let i=0;i<data.length;i++){
    hash^=data.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return deck.id+":"+data.length+":"+(hash>>>0).toString(16);
}
export function validateDeck(deck) {
  if(!deck||!isId(deck.id)||!Array.isArray(deck.cards) ||
     !deck.cards.length||deck.cards.length>20000) throw new Error("Invalid published deck");
  const used=new Set();
  for(const card of deck.cards){
    if(!card||!isId(card.id)||used.has(card.id)||
       typeof card.front!=="string"||!card.front.trim()||card.front.length>500||
       typeof card.back!=="string"||!card.back.trim()||card.back.length>2000)
      throw new Error("Invalid or repeated published card");
    used.add(card.id);
  }
  return deck;
}
export function newSession(deck, random=Math.random) {
  validateDeck(deck);
  const order=deck.cards.map(c=>c.id);
  for(let i=order.length-1;i>0;i--){
    const value=random();
    if(!(value>=0 && value<1)) throw new RangeError("Random function must return [0,1)");
    const j=Math.floor(value*(i+1));
    [order[i],order[j]]=[order[j],order[i]];
  }
  return {
    schema:SCHEMA,signature:deckSignature(deck),
    queue:order,complete:[],
    progress:Object.fromEntries(order.map(id=>[id,{seen:0,errors:0,correctAfterError:0}])),
    attempts:0
  };
}
export function isValidSession(value,deck) {
  if(!value||value.schema!==SCHEMA||value.signature!==deckSignature(deck) ||
     !Array.isArray(value.queue)||!Array.isArray(value.complete) ||
     !value.progress||typeof value.progress!=="object" ||
     !Number.isInteger(value.attempts)||value.attempts<0||value.attempts>10000000)
    return false;
  const ids=new Set(deck.cards.map(c=>c.id));
  const all=[...value.queue,...value.complete];
  if(all.length!==ids.size || new Set(all).size!==ids.size ||
     all.some(id=>!ids.has(id))) return false;
  if(Object.keys(value.progress).length!==ids.size)return false;
  for(const id of ids) {
    const p=value.progress[id];
    if(!p||!Number.isInteger(p.seen)||p.seen<0||p.seen>1000000||
       !Number.isInteger(p.errors)||p.errors<0||p.errors>p.seen||
       !Number.isInteger(p.correctAfterError)||p.correctAfterError<0||
       p.correctAfterError>2)return false;
  }
  return true;
}
export function currentCard(session,deck) {
  const id=session.queue[0];
  return id ? deck.cards.find(c=>c.id===id)??null : null;
}
export function remainingMistakes(session) {
  return session.queue.filter(id=>session.progress[id].errors>0).length;
}
export function applyRating(session,deck,ratingId) {
  if(!isValidSession(session,deck))throw new Error("Invalid or outdated study session");
  const rating=RATINGS.find(r=>r.id===ratingId);
  if(!rating)throw new RangeError("Unknown rating");
  if(!session.queue.length)throw new Error("Session is already complete");
  // Immutable update: persist only after obtaining a valid next state.
  const next=structuredClone(session);
  const id=next.queue.shift();
  const p=next.progress[id];
  p.seen++;
  next.attempts++;
  if(rating.correct){
    if(p.errors>0)p.correctAfterError++;
    // No error: remove at once. Prior error: require two spaced successes.
    if(p.errors===0 || p.correctAfterError>=2){
      next.complete.push(id);
    } else {
      // A partially repaired card returns late, unlike an urgent failure.
      const position=Math.min(next.queue.length,rating.lag);
      next.queue.splice(position,0,id);
    }
  } else {
    p.errors++;
    p.correctAfterError=0;
    // Completing the FIRST pass avoids earlier difficult cards starving
    // cards that the learner has never encountered.
    const unseenRemain=next.queue.some(cid=>next.progress[cid].seen===0);
    const position=unseenRemain ? next.queue.length
      : Math.min(next.queue.length,rating.lag);
    next.queue.splice(position,0,id);
  }
  if(!isValidSession(next,deck))throw new Error("Unexpected invalid queue transition");
  return next;
}
