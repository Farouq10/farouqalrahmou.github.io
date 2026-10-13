import {
  reviewCard, chooseNext, detectConfusion, normaliseAnswer,
  intervalDays, estimateIntervalLabel, todayKey, DAY, recallAt
} from "./scheduler.mjs";
import {
  openStudyDB, loadState, writeState, validateSnapshot, makeId, newDeck, newCard
} from "./storage.mjs";

const $ = (id) => document.getElementById(id);
const app = $("study-app");
let db, state;
let active = null;
let revealed = false;
let attempt = "";
let beforeConfidence = "uncertain";
let startedAt = 0;
let view = "review";
let visibleCards = 30;
let busy = false;
const dateLabel = (date) => new Date(date).toLocaleString(undefined, {dateStyle:"medium",timeStyle:"short"});
const selected = () => state.settings.selectedDeck;
const chosenDeck = () => state.decks.find((deck) => deck.id === selected());
const deckName = (id) => state.decks.find((deck) => deck.id === id)?.name ?? "Unknown deck";
const examDeadline = () => {
  const date = chosenDeck()?.examDate;
  return date ? new Date(date + "T23:59:59").getTime() : null;
};
const reviewsToday = () => state.reviews.filter((entry) => todayKey(entry.at) === todayKey());
const newToday = () => reviewsToday().filter((entry) => entry.isNew).length;
const scopedCards = () => state.cards.filter((card) => selected() === "all" || card.deckId === selected());
function text(id, value) { $(id).textContent = String(value); }
function tell(message, error = false) {
  text(error ? "app-error" : "app-status", message);
  if (error) $("app-error").hidden = false;
  else { $("app-error").hidden = true; text("app-error", ""); }
}
async function change(fn) {
  if (busy) return;
  busy = true;
  try {
    await fn();
    validateSnapshot(state);
    await writeState(db, state);
    tell("Saved in this browser.");
    render();
  } catch (err) {
    try { state = await loadState(db); } catch { /* preserve in-memory state for export */ }
    tell(err?.message ?? "Could not save study data", true);
    render();
  } finally {
    busy = false;
  }
}
function setView(next) {
  view = next;
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === next);
    button.setAttribute("aria-pressed", String(button.dataset.view === next));
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.hidden = section.id !== "view-" + next;
  });
  render();
}
function fillDecks() {
  const control = $("deck-select");
  const previous = selected();
  control.replaceChildren(new Option("All decks", "all"));
  for (const deck of state.decks) control.add(new Option(deck.name, deck.id));
  if (previous !== "all" && !state.decks.some((deck) => deck.id === previous)) {
    state.settings.selectedDeck = "all";
  }
  control.value = selected();
}
function renderSummary() {
  const cards = scopedCards(), now = Date.now();
  const due = cards.filter((c) => c.reps > 0 && c.dueAt <= now).length;
  const unseen = cards.filter((c) => !c.reps).length;
  const summary = $("study-summary");
  summary.replaceChildren();
  for (const [name, value] of [
    ["Due now", due], ["New", unseen], ["Studied today", reviewsToday().length],
    ["Cards", cards.length]
  ]) {
    const item = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = value;
    item.append(strong, document.createTextNode(" " + name));
    summary.append(item);
  }
}
function clearActive() {
  active = null; revealed = false; attempt = ""; startedAt = 0;
}
function getActive() {
  if (active) {
    const card = state.cards.find((candidate) => candidate.id === active.id);
    if (card && (selected() === "all" || card.deckId === selected())) return card;
  }
  clearActive();
  active = chooseNext(state.cards, Date.now(), {
    deckId: selected(), newLimit: state.settings.newLimit, newUsed: newToday(),
    deadline: examDeadline(), retention: state.settings.retention
  });
  startedAt = Date.now();
  return active;
}
function renderReview() {
  const card = getActive();
  $("no-review").hidden = Boolean(card);
  $("review-card").hidden = !card;
  const reviewed = reviewsToday().length;
  text("review-progress", reviewed ? reviewed + " reviews recorded today." :
    "Begin with a genuine attempt to remember, then reveal the answer.");
  if (!card) {
    const cards = scopedCards();
    const next = cards.filter((c) => c.reps > 0 && c.dueAt > Date.now())
      .sort((a,b) => a.dueAt-b.dueAt)[0];
    const exhausted = newToday() >= state.settings.newLimit &&
      cards.some((c) => !c.reps);
    text("empty-title", cards.length ? "All caught up for now" : "Your study library is empty");
    text("empty-description", !cards.length ?
      "Create a deck and add some cards, or load the optional Cold War examples." :
      exhausted ? "Today's new-card limit has been reached. " +
        (next ? "Next review: " + dateLabel(next.dueAt) : "Increase the limit in Settings to continue.") :
      next ? "The next card is due " + dateLabel(next.dueAt) + "." :
      "There are no reviews due.");
    return;
  }
  const deck = deckName(card.deckId);
  text("card-meta", deck + " · " + card.focus +
    (card.reps > 0 ? " · " + card.reps + " earlier reviews" : " · new"));
  text("card-question", card.front);
  $("typed-answer").value = revealed ? attempt : "";
  $("typed-answer").disabled = revealed;
  $("confidence").value = revealed ? beforeConfidence : "uncertain";
  $("confidence").disabled = revealed;
  $("reveal-answer").hidden = revealed;
  $("answer-panel").hidden = !revealed;
  if (revealed) {
    text("correct-answer", card.back);
    text("your-answer", attempt.trim() ? "Your answer: " + attempt.trim() :
      "No answer typed — judge whether you actually recalled it before revealing.");
    const confused = detectConfusion(card, attempt, state.cards);
    $("confusion-hint").hidden = !confused;
    if (confused) text("confusion-hint",
      "Possible mix-up: that is the answer to “" + confused.front + "”. Compare the two prompts.");
    for (const button of $("rating-buttons").querySelectorAll("[data-grade]")) {
      const grade = Number(button.dataset.grade);
      const trial = reviewCard(card,grade,Date.now(),{retention:state.settings.retention});
      button.querySelector("small").textContent =
        estimateIntervalLabel((trial.dueAt-Date.now())/DAY);
    }
  }
}
function makeAction(textLabel, fn) {
  const button=document.createElement("button");
  button.type="button";
  button.className="subtle";
  button.textContent=textLabel;
  button.addEventListener("click", fn);
  return button;
}
function renderLibrary() {
  const deck = chosenDeck();
  $("deck-editor").hidden = !deck;
  if (deck) $("edit-exam-date").value = deck.examDate ?? "";
  const term = $("library-search").value.trim().toLocaleLowerCase();
  const rows = scopedCards().filter((card) =>
    [card.front,card.back,deckName(card.deckId)].some((str) => str.toLocaleLowerCase().includes(term)))
    .sort((a,b) => b.createdAt-a.createdAt);
  text("library-count", rows.length + " cards");
  $("show-more-cards").hidden = rows.length <= visibleCards;
  const list = $("card-list"); list.replaceChildren();
  for (const card of rows.slice(0, visibleCards)) {
    const li=document.createElement("li"), description=document.createElement("div");
    const title=document.createElement("strong"), answer=document.createElement("small");
    title.textContent=card.front;
    answer.textContent=card.back + (selected()==="all" ? " · "+deckName(card.deckId) : "");
    description.append(title,answer);
    const actions=document.createElement("div");actions.className="actions";
    actions.append(
      makeAction("Edit", ()=>editCard(card.id)),
      makeAction("Delete", ()=>removeCard(card.id))
    );
    li.append(description,actions);
    list.append(li);
  }
}
function renderStatistics() {
  const rows = scopedCards();
  const ids=new Set(rows.map((card)=>card.id));
  const events=state.reviews.filter((event)=>ids.has(event.cardId));
  const recent=events.filter((event)=>event.at>=Date.now()-30*DAY);
  const successful=recent.filter((event)=>event.grade>=2).length;
  const incorrect=recent.filter((event)=>event.grade===1).length;
  const confused=recent.filter((event)=>event.confusedWith).length;
  const due=rows.filter((card)=>card.reps>0&&card.dueAt<=Date.now()).length;
  const pieces=[
    ["Cards",rows.length],["Due",due],["Reviews in last 30 days",recent.length],
    ["Self-rated recall success",recent.length ? (successful/recent.length*100).toFixed(1)+"%":"—"],
    ["Forgotten",incorrect],["Possible answer mix-ups",confused]
  ];
  const root=$("stats-content"); root.replaceChildren();
  for (const [label,value] of pieces) {
    const p=document.createElement("p");p.textContent=label+": "+value;root.append(p);
  }
  const p=document.createElement("p");p.className="quiet";
  p.textContent="Note: a review rated Hard, Good or Easy counts as successful. " +
    "Statistics rely on honest self-grading.";
  root.append(p);
  const accuracy = {};
  for (const event of recent) {
    const level=event.confidence ?? "uncertain";
    accuracy[level] ??= {correct:0,total:0};
    accuracy[level].total++;
    if (event.grade>=2) accuracy[level].correct++;
  }
  for (const level of ["uncertain","moderate","certain"]) {
    const item=accuracy[level];
    if (item) {
      const row=document.createElement("p");row.textContent=
        "Pre-feedback confidence “"+level+"”: "+item.correct+"/"+item.total+
        " remembered ("+Math.round(100*item.correct/item.total)+"%).";
      root.append(row);
    }
  }
}
function render() {
  fillDecks(); renderSummary();
  if (view==="review") renderReview();
  if (view==="library") renderLibrary();
  if (view==="statistics") renderStatistics();
  if (view==="settings") {
    $("settings-form").elements.retention.value=state.settings.retention;
    $("settings-form").elements.newLimit.value=state.settings.newLimit;
  }
}
function editCard(id) {
  const card=state.cards.find((item)=>item.id===id);
  if(!card)return;
  const front=window.prompt("Edit question",card.front);
  if(front===null)return;
  const back=window.prompt("Edit answer",card.back);
  if(back===null)return;
  let replacement;
  try { replacement=newCard(card.deckId,front,back,card.focus); }
  catch(err){tell(err.message,true);return;}
  if(!window.confirm("Changing a question resets its review schedule and removes its old history. Continue?"))return;
  change(()=>{
    const index=state.cards.findIndex((item)=>item.id===id);
    state.cards[index]={...replacement,id,createdAt:card.createdAt};
    state.reviews=state.reviews.filter((event)=>event.cardId!==id);
    if(active?.id===id)clearActive();
  });
}
function removeCard(id) {
  const card=state.cards.find((item)=>item.id===id);
  if(!card||!window.confirm("Permanently delete this card and its review history?"))return;
  change(()=>{
    state.cards=state.cards.filter((item)=>item.id!==id);
    state.reviews=state.reviews.filter((event)=>event.cardId!==id);
    if(active?.id===id)clearActive();
  });
}
function bind() {
  document.querySelectorAll(".tab").forEach((button)=>{
    button.addEventListener("click",()=>setView(button.dataset.view));
  });
  $("deck-select").addEventListener("change",(event)=>{
    state.settings.selectedDeck=event.target.value;
    clearActive();visibleCards=30;
    change(()=>{});
  });
  $("empty-library").addEventListener("click",()=>setView("library"));
  $("reveal-answer").addEventListener("click",()=>{
    if(!active||revealed)return;
    attempt=$("typed-answer").value.slice(0,2000);
    beforeConfidence=$("confidence").value;
    revealed=true;renderReview();
  });
  $("typed-answer").addEventListener("keydown",(event)=>{
    if((event.ctrlKey||event.metaKey)&&event.key==="Enter"&&!revealed){
      event.preventDefault();$("reveal-answer").click();
    }
  });
  $("rating-buttons").querySelectorAll("[data-grade]").forEach((button)=>{
    button.addEventListener("click",()=>{
      if(!active||!revealed)return;
      const id=active.id, grade=Number(button.dataset.grade);
      const elapsed=Math.max(3,Math.round((Date.now()-startedAt)/1000));
      change(()=>{
        const index=state.cards.findIndex((card)=>card.id===id);
        if(index<0)throw new Error("Card was removed");
        const card=state.cards[index], now=Date.now();
        const related=grade===1?detectConfusion(card,attempt,state.cards):null;
        state.cards[index]=reviewCard(card,grade,now,{
          retention:state.settings.retention,seconds:elapsed
        });
        if(related){
          state.cards[index].confusionCount=(card.confusionCount??0)+1;
          const other=state.cards.find((c)=>c.id===related.id);
          if(other&&other.reps>0)other.dueAt=Math.min(other.dueAt,now+5*60000);
        }
        state.reviews.push({
          id:makeId(),cardId:id,deckId:card.deckId,at:now,grade,
          isNew:!card.reps,confidence:beforeConfidence,
          typedExact:normaliseAnswer(attempt)===normaliseAnswer(card.back),
          confusedWith:related?.id ?? null,seconds:elapsed
        });
        if(state.reviews.length>50000)state.reviews=state.reviews.slice(-50000);
        clearActive();
      });
    });
  });
  $("new-deck-form").addEventListener("submit",(event)=>{
    event.preventDefault();
    const form=event.currentTarget;
    change(()=>{
      const data=new FormData(form);
      const deck=newDeck(data.get("deckName"),data.get("examDate"));
      state.decks.push(deck);state.settings.selectedDeck=deck.id;
      clearActive();form.reset();
    });
  });
  $("new-card-form").addEventListener("submit",(event)=>{
    event.preventDefault();const form=event.currentTarget;
    change(()=>{
      const data=new FormData(form), deck=chosenDeck();
      if(!deck)throw new Error("Select a deck first");
      state.cards.push(newCard(deck.id,data.get("front"),data.get("back"),data.get("focus")));
      clearActive();form.reset();
    });
  });
  $("bulk-form").addEventListener("submit",(event)=>{
    event.preventDefault();const form=event.currentTarget;
    change(()=>{
      const deck=chosenDeck();
      if(!deck)throw new Error("Select a deck first");
      const lines=String(new FormData(form).get("bulk")).split(/\r?\n/).filter((line)=>line.trim());
      if(lines.length<1||lines.length>500)throw new Error("Import requires 1-500 lines");
      const imported=lines.map((line,i)=>{
        const at=line.indexOf("\t");
        if(at<1)throw new Error("Line "+(i+1)+" needs a TAB between prompt and answer");
        return newCard(deck.id,line.slice(0,at),line.slice(at+1),"fact");
      });
      state.cards.push(...imported);clearActive();form.reset();
      tell("Imported "+imported.length+" cards.");
    });
  });
  $("deck-options-form").addEventListener("submit",(event)=>{
    event.preventDefault();
    change(()=>{
      const deck=chosenDeck();if(!deck)throw new Error("Select a deck");
      deck.examDate=$("edit-exam-date").value;
    });
  });
  $("delete-deck").addEventListener("click",()=>{
    const deck=chosenDeck();if(!deck)return;
    if(!window.confirm("Permanently delete deck “"+deck.name+"” and ALL of its flashcards and history?"))return;
    change(()=>{
      state.decks=state.decks.filter((item)=>item.id!==deck.id);
      const ids=new Set(state.cards.filter((card)=>card.deckId===deck.id).map((card)=>card.id));
      state.cards=state.cards.filter((card)=>!ids.has(card.id));
      state.reviews=state.reviews.filter((event)=>!ids.has(event.cardId));
      state.settings.selectedDeck="all";clearActive();
    });
  });
  $("library-search").addEventListener("input",()=>{visibleCards=30;renderLibrary();});
  $("show-more-cards").addEventListener("click",()=>{visibleCards+=30;renderLibrary();});
  $("settings-form").addEventListener("submit",(event)=>{
    event.preventDefault();const form=event.currentTarget;
    change(()=>{
      const data=new FormData(form);
      const retention=Number(data.get("retention")),newLimit=Number(data.get("newLimit"));
      if(!(retention>=0.7&&retention<=0.98)||!Number.isInteger(newLimit)||
          newLimit<0||newLimit>200)throw new Error("Invalid settings");
      state.settings={...state.settings,retention,newLimit};
      clearActive();
    });
  });
  $("export-backup").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],
      {type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="scientific-study-"+todayKey()+".json";
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    tell("Backup exported. Save it somewhere you can find again.");
  });
  $("import-backup").addEventListener("change",async(event)=>{
    const file=event.target.files?.[0];
    if(!file)return;
    try {
      if(file.size>12_000_000)throw new Error("Backup exceeds 12 MB limit");
      const restored=validateSnapshot(JSON.parse(await file.text()));
      if(!window.confirm("Replace ALL decks, reviews and settings on this browser with this backup?"))return;
      await change(()=>{state=restored;clearActive();visibleCards=30;});
      tell("Backup restored in this browser.");
    } catch(err){tell("Restore failed: "+err.message,true);}
    finally{$("import-backup").value="";}
  });
  $("load-demo").addEventListener("click",()=>{
    if(!window.confirm("Add the ten optional Cold War examples as a new deck?"))return;
    const prompts=[
      ["When did the Yalta Conference take place?","February 1945","date"],
      ["When did the Potsdam Conference take place?","July–August 1945","date"],
      ["What year was Churchill's 'Iron Curtain' speech?","1946","date"],
      ["In which year was the Truman Doctrine announced?","1947","date"],
      ["In which year was the Marshall Plan announced?","1947","date"],
      ["When did the Berlin Blockade begin?","June 1948","date"],
      ["When did the Berlin Blockade end?","May 1949","date"],
      ["In which year was NATO founded?","1949","date"],
      ["What important nuclear event happened in the USSR in 1949?","Its first successful atomic bomb test.","event"],
      ["When was the Warsaw Pact established?","1955","date"]
    ];
    change(()=>{
      const deck=newDeck("Cold War (1945–55) · examples");
      state.decks.push(deck);
      for(const [front,back,focus] of prompts)state.cards.push(newCard(deck.id,front,back,focus));
      state.settings.selectedDeck=deck.id;clearActive();
    });
  });
}
async function start() {
  try {
    db=await openStudyDB();
    state=await loadState(db);
    $("study-app").hidden=false;
    bind();setView("review");
    setInterval(()=>{
      if(view==="review"&&!revealed&&!active) {
        renderSummary();renderReview();
      }
    },30000);
  } catch(err) {
    tell("Study could not start: "+err.message+
      ". Allow browser site storage and reload.",true);
  }
}
start();
