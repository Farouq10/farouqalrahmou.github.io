import { PUBLISHED_DECK } from "./published-deck.mjs";
import {
  RATINGS, SESSION_KEY, validateDeck, newSession, restoreSession,
  currentCard, applyRating, remainingMistakes
} from "./queue.mjs";
import { loadProgress, saveProgress } from "./persistence.mjs";
import { cloudIsConfigured, openCloud } from "./cloud.mjs";
import { decideFirstSync } from "./cloud-policy.mjs";

// Firebase is an optional private sync layer; all practice still saves locally.
// No uploaded flashcard text or site redesign is required.
const $=id=>document.getElementById(id);
const deck=validateDeck(PUBLISHED_DECK);
let session, flipped=false, busy=false;
let cloudAPI=null,cloudUid=null,cloudVersion=null,cloudReady=false;
let cloudQueue=Promise.resolve(), pendingDecision=null;
const BACKUP_KEY="study-cloud-safety-copy";
function cloudStatus(message){ $("cloud-status").textContent=message; }
function keepSafetyCopy(snapshot){
  // Preserve the losing copy before any initial sync conflict is resolved.
  localStorage.setItem(BACKUP_KEY,JSON.stringify(snapshot));
}
function cloudLater(snapshot) {
  if(!cloudReady||!cloudAPI||!cloudUid)return;
  const uid=cloudUid;
  cloudStatus("Saving to cloud…");
  cloudQueue=cloudQueue.then(async()=>{
    if(!cloudReady||uid!==cloudUid)return;
    cloudVersion=await cloudAPI.push(uid,snapshot,cloudVersion);
    cloudStatus("Saved to cloud");
  }).catch(error=>{
    cloudReady=false;
    cloudStatus("Cloud sync paused: "+error.message+
      ". Local saving still works. Reload to reconcile.");
  });
}
async function useCloud() {
  if(!pendingDecision||busy)return;
  busy=true;
  try{
    const decision=pendingDecision;
    keepSafetyCopy(session);
    await saveProgress(decision.session);
    session=decision.session;flipped=false;
    cloudVersion=decision.version;cloudReady=true;
    pendingDecision=null;$("cloud-conflict").hidden=true;
    render();cloudStatus("Saved progress loaded from cloud");
  }catch(error){cloudStatus("Could not load cloud copy: "+error.message);}
  finally{busy=false;}
}
async function useDevice(){
  if(!pendingDecision||busy)return;
  busy=true;
  try{
    const decision=pendingDecision;
    keepSafetyCopy(decision.session);
    cloudVersion=await cloudAPI.push(cloudUid,session,decision.version);
    cloudReady=true;pendingDecision=null;
    $("cloud-conflict").hidden=true;
    cloudStatus("This device's progress saved to cloud");
  }catch(error){cloudStatus("Could not save this device: "+error.message);}
  finally{busy=false;}
}
async function connectForUser(user){
  cloudUid=user.uid;cloudReady=false;cloudVersion=null;pendingDecision=null;
  $("cloud-conflict").hidden=true;
  $("cloud-button").textContent="Sign out";
  if(busy) {
    cloudStatus("Cloud sign-in is ready. Reload when your current review finishes.");
    return;
  }
  busy=true;
  cloudStatus("Checking cloud progress…");
  try{
    const remote=await cloudAPI.read(user.uid);
    if(cloudUid!==user.uid)return;
    const choice=decideFirstSync(session,remote,deck);
    if(choice.action==="invalid")throw new Error(choice.reason);
    if(choice.action==="conflict"){
      pendingDecision=choice;
      $("cloud-conflict").hidden=false;
      cloudStatus("Different progress was found. Choose which to keep.");
    }else if(choice.action==="download"){
      keepSafetyCopy(session);
      await saveProgress(choice.session);
      session=choice.session;flipped=false;
      cloudVersion=choice.version;cloudReady=true;
      render();cloudStatus("Cloud progress restored");
    }else if(choice.action==="upload"){
      cloudVersion=await cloudAPI.push(user.uid,session,choice.version);
      cloudReady=true;
      cloudStatus("Progress saved to cloud");
    }else{
      cloudVersion=choice.version;cloudReady=true;
      cloudStatus("Cloud progress is up to date");
    }
  }catch(error){
    cloudReady=false;
    cloudStatus("Cloud unavailable: "+error.message+". Local progress is safe.");
  }finally{busy=false;}
}
async function initCloud(){
  if(!cloudIsConfigured()){
    cloudStatus("Cloud sync is not connected yet.");
    return;
  }
  $("cloud-button").hidden=false;
  try{
    cloudAPI=await openCloud();
    cloudAPI.onAuth(async user=>{
      if(!user) {
        cloudUid=null;cloudVersion=null;cloudReady=false;pendingDecision=null;
        $("cloud-conflict").hidden=true;
        $("cloud-button").textContent="Sign in to sync";
        cloudStatus("Not signed in — saved on this browser");
      }else await connectForUser(user);
    });
  }catch(error){cloudStatus("Cloud initialization failed: "+error.message);}
}
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
    cloudLater(structuredClone(next));
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
  $("export-progress").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify({format:"farouq-study-backup-v1",session},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download="farouq-study-progress.json";link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $("import-progress").addEventListener("change",async event=>{
    const file=event.target.files[0];
    if(!file||busy)return;
    busy=true;
    try{
      if(file.size>5000000)throw new Error("Backup is too large");
      const raw=JSON.parse(await file.text());
      const restored=restoreSession(raw.format==="farouq-study-backup-v1"?raw.session:raw,deck);
      if(!restored)throw new Error("Invalid backup or different deck");
      if(!window.confirm("Replace current progress with this backup? A safety copy of current progress will be kept."))return;
      keepSafetyCopy(session);
      restored.revision=Math.max(restored.revision,session.revision)+1;
      restored.updatedAt=Math.max(Date.now(),session.updatedAt+1);
      await saveProgress(restored);
      session=restored;flipped=false;render();
      cloudLater(structuredClone(restored));
      status("Backup restored and saved on this browser.");
    }catch(error){showError("Could not restore backup: "+error.message);}
    finally{busy=false;event.target.value="";}
  });
  $("flip-card").addEventListener("click",flip);
  $("cloud-button").addEventListener("click",async ()=>{
    if(!cloudAPI)return;
    try{
      if(cloudAPI.user())await cloudAPI.signOut();
      else await cloudAPI.signIn();
    }catch(error){cloudStatus("Sign-in failed: "+error.message);}
  });
  $("use-cloud").addEventListener("click",useCloud);
  $("use-device").addEventListener("click",useDevice);
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
      cloudLater(structuredClone(next));
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
    void initCloud();
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

