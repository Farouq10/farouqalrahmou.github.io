/**
 * One-deck successive-relearning queue (NOT FSRS).
 *
 * Research-backed principles: test retrieval, reveal corrective feedback,
 * repeat mistakes with intervening material, finish when corrected.
 * All concrete offsets below are simple design choices, not an
 * empirically trained or proven-superior algorithm.
 *
 * Invariants:
 *   - all unseen questions occur before failed questions repeat;
 *   - Very easy/Easy retires a never-missed card for this session;
 *   - Not quite/No idea/Impossible requeue at 4/2/1 positions respectively;
 *   - a missed card requires TWO later successes to retire;
 *   - a failed reattempt resets this streak;
 *   - completed cards cannot reappear until a new session is started.
 */
export const RATINGS=Object.freeze([
  {id:"very_easy",label:"Very easy",detail:"Immediately and completely correct",lag:12,correct:true},
  {id:"easy",label:"Easy",detail:"Completely correct",lag:7,correct:true},
  {id:"not_quite",label:"Not quite",detail:"Partly correct or unsure",lag:4,correct:false},
  {id:"no_idea",label:"No idea",detail:"Did not recall it",lag:2,correct:false},
  {id:"impossible",label:"Impossible",detail:"Could not begin",lag:1,correct:false}
]);
export const SESSION_KEY="study-queue-v3";
export const LEGACY_SESSION_KEY="study-queue-v2";
const SCHEMA=3;
const isId=id=>typeof id==="string"&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
const newProgress=()=>({seen:0,errors:0,correctAfterError:0});
const content=card=>[card.front,card.back,card.focus??""];
const sameContent=(one,two)=>JSON.stringify(one)===JSON.stringify(two);

export function deckSignature(deck) {
  // Only required when migrating the ORIGINAL version-2 browser snapshot.
  const data=JSON.stringify([deck.id,deck.cards.map(c=>[c.id,c.front,c.back,c.focus])]);
  let hash=2166136261;
  for(let i=0;i<data.length;i++){hash^=data.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return deck.id+":"+data.length+":"+(hash>>>0).toString(16);
}
export function validateDeck(deck) {
  if(!deck||!isId(deck.id)||!Array.isArray(deck.cards)||
    !deck.cards.length||deck.cards.length>20000)throw new Error("Invalid published deck");
  const seen=new Set();
  for(const card of deck.cards){
    if(!card||!isId(card.id)||seen.has(card.id)||
      typeof card.front!=="string"||!card.front.trim()||card.front.length>500||
      typeof card.back!=="string"||!card.back.trim()||card.back.length>2000)
      throw new Error("Invalid or repeated published card");
    seen.add(card.id);
  }
  return deck;
}
function manifest(deck){
  return Object.fromEntries(deck.cards.map(c=>[c.id,content(c)]));
}
function shuffledIds(deck,random){
  const result=deck.cards.map(c=>c.id);
  for(let i=result.length-1;i>0;i--){
    const value=random();
    if(!(value>=0&&value<1))throw new RangeError("Invalid random number");
    const j=Math.floor(value*(i+1));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}
export function newSession(deck,random=Math.random){
  validateDeck(deck);
  const queue=shuffledIds(deck,random);
  return {
    schema:SCHEMA,deckId:deck.id,
    manifest:manifest(deck),queue,complete:[],
    progress:Object.fromEntries(queue.map(id=>[id,newProgress()])),
    attempts:0,revision:0,updatedAt:Date.now()
  };
}
function validCounters(p){
  return p&&Number.isInteger(p.seen)&&p.seen>=0&&p.seen<=1000000&&
    Number.isInteger(p.errors)&&p.errors>=0&&p.errors<=p.seen&&
    Number.isInteger(p.correctAfterError)&&p.correctAfterError>=0&&
    p.correctAfterError<=2&&(p.errors>0||p.correctAfterError===0);
}
/** Verify a stored v3 snapshot against ITS OWN historical manifest.
 * This allows safe reconciliation after code changes to the deck.
 */
export function isStructurallyValidSession(value){
  if(!value||value.schema!==SCHEMA||!isId(value.deckId)||
     !value.manifest||typeof value.manifest!=="object"||
     !Array.isArray(value.queue)||!Array.isArray(value.complete)||
     !value.progress||typeof value.progress!=="object"||
     !Number.isInteger(value.attempts)||value.attempts<0||value.attempts>10000000||
     !Number.isInteger(value.revision)||value.revision<0||
     !Number.isFinite(value.updatedAt)||value.updatedAt<0)return false;
  const ids=Object.keys(value.manifest);
  if(!ids.length||ids.length>20000||ids.some(id=>!isId(id)))return false;
  const all=[...value.queue,...value.complete];
  if(all.length!==ids.length||new Set(all).size!==ids.length||
     all.some(id=>!Object.hasOwn(value.manifest,id)))return false;
  if(Object.keys(value.progress).length!==ids.length)return false;
  for(const id of ids){
    const entry=value.manifest[id];
    if(!Array.isArray(entry)||entry.length!==3||
       typeof entry[0]!=="string"||typeof entry[1]!=="string"||
       typeof entry[2]!=="string"||!validCounters(value.progress[id]))return false;
  }
  for(const id of value.complete){
    const p=value.progress[id];
    if(p.seen<1||(p.errors>0&&p.correctAfterError<2))return false;
  }
  return true;
}
export function isValidSession(value,deck){
  if(!isStructurallyValidSession(value)||value.deckId!==deck.id)return false;
  const expected=manifest(deck),old=value.manifest;
  return Object.keys(expected).length===Object.keys(old).length&&
    Object.keys(expected).every(id=>Object.hasOwn(old,id)&&sameContent(expected[id],old[id]));
}
function validLegacy(value,deck){
  if(!value||value.schema!==2||value.signature!==deckSignature(deck)||
    !Array.isArray(value.queue)||!Array.isArray(value.complete)||
    !value.progress||typeof value.progress!=="object"||
    !Number.isInteger(value.attempts)||value.attempts<0)return false;
  const ids=new Set(deck.cards.map(c=>c.id));
  const all=[...value.queue,...value.complete];
  if(all.length!==ids.size||new Set(all).size!==ids.size||all.some(id=>!ids.has(id))||
     Object.keys(value.progress).length!==ids.size)return false;
  return [...ids].every(id=>validCounters(value.progress[id]));
}
export function restoreSession(value,deck){
  validateDeck(deck);
  if(isValidSession(value,deck))return value;
  if(validLegacy(value,deck)){
    const upgraded={
      schema:SCHEMA,deckId:deck.id,manifest:manifest(deck),
      queue:[...value.queue],complete:[...value.complete],
      progress:structuredClone(value.progress),attempts:value.attempts,
      revision:value.attempts,updatedAt:Date.now()
    };
    if(isValidSession(upgraded,deck))return upgraded;
  }
  if(!isStructurallyValidSession(value)||value.deckId!==deck.id)return null;
  const fresh=manifest(deck);
  const preserved=new Set(Object.keys(fresh).filter(id=>
    Object.hasOwn(value.manifest,id)&&sameContent(value.manifest[id],fresh[id])));
  const newcomer=deck.cards.map(c=>c.id).filter(id=>!preserved.has(id));
  // New/reworded questions appear first. Unchanged queue order and mastered
  // pile are preserved. Deleted cards disappear from the active deck only.
  const rebuilt={
    schema:SCHEMA,deckId:deck.id,manifest:fresh,
    queue:[...newcomer,...value.queue.filter(id=>preserved.has(id))],
    complete:value.complete.filter(id=>preserved.has(id)),
    progress:Object.fromEntries(deck.cards.map(c=>[
      c.id,preserved.has(c.id)?structuredClone(value.progress[c.id]):newProgress()
    ])),
    attempts:value.attempts,revision:value.revision+1,updatedAt:Date.now()
  };
  return isValidSession(rebuilt,deck)?rebuilt:null;
}
export function currentCard(session,deck){
  const id=session.queue[0];
  return id?deck.cards.find(card=>card.id===id)??null:null;
}
export function remainingMistakes(session){
  return session.queue.filter(id=>session.progress[id].errors>0).length;
}
export function applyRating(session,deck,ratingId){
  if(!isValidSession(session,deck))throw new Error("Invalid or outdated study session");
  const rating=RATINGS.find(item=>item.id===ratingId);
  if(!rating)throw new RangeError("Unknown rating");
  if(!session.queue.length)throw new Error("Session already complete");
  const next=structuredClone(session);
  const id=next.queue.shift(),p=next.progress[id];
  p.seen++;next.attempts++;next.revision++;next.updatedAt=Date.now();
  if(rating.correct){
    if(p.errors>0)p.correctAfterError++;
    if(p.errors===0||p.correctAfterError>=2)next.complete.push(id);
    else next.queue.splice(Math.min(next.queue.length,rating.lag),0,id);
  }else{
    p.errors++;p.correctAfterError=0;
    const remainingUnseen=next.queue.some(other=>next.progress[other].seen===0);
    // Never repeat a missed card before the initial unseen pass finishes.
    const position=remainingUnseen?next.queue.length:Math.min(next.queue.length,rating.lag);
    next.queue.splice(position,0,id);
  }
  if(!isValidSession(next,deck))throw new Error("Invalid queue transition");
  return next;
}
