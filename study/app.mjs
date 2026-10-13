import { PUBLISHED_DECK } from "./published-deck.mjs";
import {
  RATINGS, SESSION_KEY, validateDeck, newSession, restoreSession,
  currentCard, applyRating, remainingMistakes
} from "./queue.mjs";
import { loadProgress, saveProgress } from "./persistence.mjs";

// No Firebase, account, uploads, deck creator, scheduler settings or analytics.
// Published flashcards come exclusively from versioned code in GitHub.
// Each browser saves only its independent queue; previous IndexedDB data remains untouched.
const $=id=>document.getElementById(id);
const deck=validateDeck(PUBLISHED_DECK);
let session, flipped=false, busy=false;
function status(message){ $("save-message").textContent=message; }
function showError(message){
  $("error").textContent=message;
  $("error").hidden=false;
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
async function rate(id){
  if(busy||!flipped||!session.queue.length)return;
  busy=true;
  try{
    const next=applyRating(session,deck,id);
    const saved=await saveProgress(next);
    session=next;flipped=false;
    status(saved.replicas===2?"Progress saved on this browser.":
      "Progress saved in one browser store; cloud sync is not enabled.");
    $("error").hidden=true;
    render();
    if(session.queue.length)$("flip-card").focus();
  }catch(error){
    showError("Your last answer was not saved. Try again: "+error.message);
  }finally{busy=false;}
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
  $("again").addEventListener("click",async ()=>{
    if(busy||session.queue.length)return;
    busy=true;
    try{
      const next=newSession(deck);
      // A reset must outrank the just-completed queue in BOTH storage copies,
      // even if the two writes happen in the same millisecond.
      next.revision=session.revision+1;
      next.updatedAt=Math.max(Date.now(),session.updatedAt+1);
      await saveProgress(next);
      session=next;flipped=false;render();
      status("Progress saved on this browser.");
      $("error").hidden=true;
      $("flip-card").focus();
    }catch(error){showError("Could not restart safely: "+error.message);}
    finally{busy=false;}
  });
  window.addEventListener("storage",event=>{
    if(event.key!==SESSION_KEY||!event.newValue||!session)return;
    try{
      const other=restoreSession(JSON.parse(event.newValue),deck);
      if(other&&(other.updatedAt>session.updatedAt||
         (other.updatedAt===session.updatedAt&&other.revision>session.revision))){
        session=other;flipped=false;render();
        status("Progress updated from another tab.");
      }
    }catch{ /* ignore invalid external writes */ }
  });
}
async function start(){
  try{
    const restored=await loadProgress(deck);
    session=restored.session;
    bind();render();
    $("app").hidden=false;
    try{
      const result=await saveProgress(session);
      if(restored.recovered)
        status("Earlier progress could not be restored safely; started a new session.");
      else
        status(result.replicas===2?"Progress saved on this browser.":
          "Progress saved in one browser store; cloud sync is not enabled.");
    }catch(error){
      showError("Progress could not be saved: "+error.message);
    }
  }catch(error){
    showError("Could not open flashcards: "+error.message);
  }
}
start();
