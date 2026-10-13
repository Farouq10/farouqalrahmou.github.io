import { PUBLISHED_DECK } from "./published-deck.mjs";
import {
  RATINGS, SESSION_KEY, validateDeck, newSession, isValidSession,
  currentCard, applyRating, remainingMistakes
} from "./queue.mjs";

// No Firebase, account, uploads, deck creator, scheduler settings or analytics.
// Published flashcards come exclusively from versioned code in GitHub.
// Each browser saves only its independent queue; previous IndexedDB data remains untouched.
const $=id=>document.getElementById(id);
const deck=validateDeck(PUBLISHED_DECK);
let session, flipped=false;
let storageAvailable=true;

function save(){
  try { localStorage.setItem(SESSION_KEY,JSON.stringify(session)); }
  catch {storageAvailable=false; }
  $("save-message").textContent=storageAvailable ? "" :
    "This browser blocked local storage, so progress will not survive a refresh.";
}
function load(){
  try {
    const raw=localStorage.getItem(SESSION_KEY);
    const parsed=raw ? JSON.parse(raw) : null;
    if(isValidSession(parsed,deck)) return parsed;
  } catch { storageAvailable=false; }
  return newSession(deck);
}
function render(){
  const total=deck.cards.length;
  const done=session.complete.length;
  $("deck-name").textContent=deck.name+" · "+total+" cards";
  $("progress-text").textContent=done+" / "+total+" complete";
  $("remaining-text").textContent=remainingMistakes(session)+" still need correcting";
  $("progress-fill").style.width=(100*done/total)+"%";
  $("progress-track").setAttribute("aria-valuenow",String(Math.round(100*done/total)));
  const finished=!session.queue.length;
  $("study-card").hidden=finished;
  $("finished").hidden=!finished;
  if(finished)return;
  const card=currentCard(session,deck);
  $("side-label").textContent=flipped?"ANSWER":"QUESTION";
  $("flashcard-text").textContent=flipped?card.back:card.front;
  $("flip-hint").textContent=flipped?"Click to see question":"Click to flip · Space ↵";
  $("flip-card").setAttribute("aria-label",flipped?"Show question":"Show answer");
  $("rating-options").hidden=!flipped;
}
function flip(){
  if(!session.queue.length)return;
  flipped=!flipped;
  render();
}
function rate(id){
  if(!flipped||!session.queue.length)return;
  try{
    session=applyRating(session,deck,id);
    flipped=false;
    save();render();
    $("flip-card").focus();
  }catch(error){
    $("error").textContent="Could not record the answer: "+error.message;
    $("error").hidden=false;
  }
}
function bind(){
  $("flip-card").addEventListener("click",flip);
  const row=$("ratings");
  RATINGS.forEach((rating,index)=>{
    const button=document.createElement("button");
    button.type="button";button.className="rating";
    button.title=rating.detail;
    button.dataset.rating=rating.id;
    button.append(document.createTextNode(rating.label));
    const small=document.createElement("small");
    small.textContent=String(index+1);
    button.append(small);
    button.addEventListener("click",()=>rate(rating.id));
    row.append(button);
  });
  document.addEventListener("keydown",event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.repeat)return;
    const target=event.target;
    if(target?.matches?.("input, textarea, select"))return;
    // Don't hijack Space/Enter from buttons; their native click works.
    if((event.key===" "||event.key==="Enter") &&
        !(target instanceof HTMLButtonElement)){
      event.preventDefault();flip();return;
    }
    if(flipped&&/^[1-5]$/.test(event.key)){
      event.preventDefault();rate(RATINGS[Number(event.key)-1].id);
    }
  });
  $("again").addEventListener("click",()=>{
    if(!session.queue.length){
      session=newSession(deck);
      flipped=false;save();render();$("flip-card").focus();
    }
  });
}
function start(){
  try{
    session=load();
    save();
    bind();render();
    $("app").hidden=false;
  }catch(error){
    $("error").textContent="Could not open flashcards: "+error.message;
    $("error").hidden=false;
  }
}
start();
