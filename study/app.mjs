/**
 * Public, read-only flashcards; per-browser private review state.
 * This module NEVER accepts front/back content from UI or backup imports:
 * study/published-deck.mjs is the single source of truth.
 */
import {
  reviewCard, chooseNext, detectConfusion, normaliseAnswer,
  estimateIntervalLabel, todayKey, DAY
} from "./scheduler.mjs";
import { PUBLISHED_DECK, syncPublishedDeck } from "./published-deck.mjs";
import {
  openStudyDB, loadState, writeState, validateSnapshot, makeId
} from "./storage.mjs";

const $ = id => document.getElementById(id);
const DECK = PUBLISHED_DECK;
let db, state, active = null, revealed = false;
let attempt = "", beforeConfidence = "uncertain", startedAt = 0;
let view = "review", visibleCards = 35, busy = false;
const cards = () => state.cards.filter(card => card.deckId === DECK.id);
const cardIds = () => new Set(DECK.cards.map(card => card.id));
const localDate = timestamp => new Date(timestamp).toLocaleString(undefined, {
  dateStyle: "medium", timeStyle: "short"
});
const reviewToday = () => {
  const ids = cardIds();
  return state.reviews.filter(entry => ids.has(entry.cardId) &&
    todayKey(entry.at) === todayKey());
};
const newToday = () => reviewToday().filter(entry => entry.isNew).length;
const examDeadline = () => DECK.examDate
  ? new Date(DECK.examDate + "T23:59:59").getTime() : null;

function text(id, value) { $(id).textContent = String(value); }
function tell(message, error = false) {
  text(error ? "app-error" : "app-status", message);
  $("app-error").hidden = !error;
  if (error) text("app-status", "");
  else text("app-error", "");
}
function resetActive() {
  active = null; revealed = false; attempt = ""; startedAt = 0;
}
/** Writes scheduling/settings data, never the authoritative card content. */
async function change(mutator) {
  if (busy) return;
  busy = true;
  try {
    mutator();
    syncPublishedDeck(state);
    validateSnapshot(state);
    await writeState(db, state);
    tell("Progress saved on this device.");
    render();
  } catch (err) {
    try { state = syncPublishedDeck(await loadState(db)); }
    catch { /* Retain state so an export might still be possible. */ }
    tell(err?.message ?? "The browser could not save progress.", true);
    render();
  } finally { busy = false; }
}
function setView(next) {
  view = next;
  document.querySelectorAll(".tab").forEach(button => {
    const selected = button.dataset.view === next;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  document.querySelectorAll(".view").forEach(element => {
    element.hidden = element.id !== "view-" + next;
  });
  render();
}
function renderSummary() {
  const now = Date.now(), scoped = cards();
  const due = scoped.filter(c => c.reps > 0 && c.dueAt <= now).length;
  const newCount = scoped.filter(c => !c.reps).length;
  const summary = $("study-summary");
  summary.replaceChildren();
  for (const [label,value] of [
    ["Due now",due],["New",newCount],["Studied today",reviewToday().length],["Cards",scoped.length]
  ]) {
    const span = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = String(value);
    span.append(strong,document.createTextNode(" " + label));
    summary.append(span);
  }
}
function activeCard() {
  if (active) {
    const card = cards().find(item => item.id === active.id);
    if (card) return card;
  }
  resetActive();
  active = chooseNext(cards(), Date.now(), {
    deckId: DECK.id, newLimit: state.settings.newLimit,
    newUsed: newToday(), deadline: examDeadline(),
    retention: state.settings.retention
  });
  startedAt = Date.now();
  return active;
}
function renderReview() {
  const card = activeCard();
  $("no-review").hidden = Boolean(card);
  $("review-card").hidden = !card;
  const amount = reviewToday().length;
  text("review-progress", amount
    ? amount + " reviews recorded today."
    : "Try to recall the answer before revealing it.");
  if (!card) {
    const scoped = cards();
    const nextDue = scoped.filter(c => c.reps > 0 && c.dueAt > Date.now())
      .sort((a,b) => a.dueAt-b.dueAt)[0];
    const newLimitReached = newToday() >= state.settings.newLimit &&
      scoped.some(c => !c.reps);
    text("empty-title", "All caught up for now");
    text("empty-description",
      newLimitReached
        ? "Today's new-card limit has been reached. " +
          (nextDue ? "Next review: " + localDate(nextDue.dueAt) : "You can adjust this in Settings.")
        : nextDue ? "Next review: " + localDate(nextDue.dueAt) + "."
        : "There are no reviews due.");
    return;
  }
  text("card-meta", DECK.name + " · " + card.focus +
    (card.reps > 0 ? " · " + card.reps + " previous reviews" : " · new"));
  text("card-question", card.front);
  $("typed-answer").value = revealed ? attempt : "";
  $("typed-answer").disabled = revealed;
  $("confidence").value = revealed ? beforeConfidence : "uncertain";
  $("confidence").disabled = revealed;
  $("reveal-answer").hidden = revealed;
  $("answer-panel").hidden = !revealed;
  if (revealed) {
    text("correct-answer", card.back);
    text("your-answer", attempt.trim() ? "Your answer: " + attempt.trim()
      : "No answer typed. Grade according to what you actually recalled.");
    const confused = detectConfusion(card, attempt, cards());
    $("confusion-hint").hidden = !confused;
    if (confused) text("confusion-hint",
      "Possible mix-up with “" + confused.front + "”. Compare the two questions.");
    for (const button of $("rating-buttons").querySelectorAll("[data-grade]")) {
      const grade = Number(button.dataset.grade);
      const trial = reviewCard(card,grade,Date.now(),{retention:state.settings.retention});
      button.querySelector("small").textContent =
        estimateIntervalLabel((trial.dueAt - Date.now()) / DAY);
    }
  }
}
function renderCards() {
  const query = $("library-search").value.trim().toLocaleLowerCase();
  const list = $("card-list");
  const selected = cards().filter(card =>
    [card.front,card.back].some(value => value.toLocaleLowerCase().includes(query)));
  text("library-count", selected.length + " cards");
  list.replaceChildren();
  $("show-more-cards").hidden = selected.length <= visibleCards;
  for (const card of selected.slice(0,visibleCards)) {
    const item = document.createElement("li");
    const content = document.createElement("div");
    const front = document.createElement("strong");
    const back = document.createElement("small");
    front.textContent = card.front;
    back.textContent = card.back;
    content.append(front,back);
    const stateLabel = document.createElement("small");
    stateLabel.textContent = card.reps ? (card.dueAt <= Date.now()
      ? "Due" : "Next: " + localDate(card.dueAt)) : "Not yet reviewed";
    item.append(content,stateLabel);
    list.append(item);
  }
}
function renderStatistics() {
  const allowed = cardIds();
  const now = Date.now();
  const scoped = cards();
  const recent = state.reviews.filter(event =>
    allowed.has(event.cardId) && event.at >= now - 30 * DAY);
  const success = recent.filter(event => event.grade >= 2).length;
  const confused = recent.filter(event => event.confusedWith).length;
  const pieces = [
    ["Cards",scoped.length],
    ["Due now",scoped.filter(c => c.reps > 0 && c.dueAt <= now).length],
    ["Reviews in last 30 days",recent.length],
    ["Self-graded recall success",recent.length ? (100*success/recent.length).toFixed(1)+"%" : "—"],
    ["Forgotten",recent.length-success],
    ["Possible answer mix-ups",confused]
  ];
  const root = $("stats-content");root.replaceChildren();
  for (const [label,value] of pieces) {
    const p = document.createElement("p");
    p.textContent = label + ": " + value;
    root.append(p);
  }
  for (const level of ["uncertain","moderate","certain"]) {
    const subset = recent.filter(event => event.confidence === level);
    if (!subset.length) continue;
    const accurate = subset.filter(event => event.grade >= 2).length;
    const p = document.createElement("p");
    p.textContent = "Pre-feedback confidence “" + level + "”: " +
      accurate + "/" + subset.length + " recalled (" +
      Math.round(100*accurate/subset.length) + "%).";
    root.append(p);
  }
}
function render() {
  renderSummary();
  if (view === "review") renderReview();
  if (view === "cards") renderCards();
  if (view === "statistics") renderStatistics();
  if (view === "settings") {
    $("settings-form").elements.retention.value = state.settings.retention;
    $("settings-form").elements.newLimit.value = state.settings.newLimit;
  }
}
function bind() {
  document.querySelectorAll(".tab").forEach(button => {
    button.addEventListener("click",()=>setView(button.dataset.view));
  });
  $("empty-cards").addEventListener("click",()=>setView("cards"));
  $("reveal-answer").addEventListener("click",()=>{
    if (!active || revealed) return;
    attempt = $("typed-answer").value.slice(0,2000);
    beforeConfidence = $("confidence").value;
    revealed = true;
    renderReview();
  });
  $("typed-answer").addEventListener("keydown",event=>{
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !revealed) {
      event.preventDefault();
      $("reveal-answer").click();
    }
  });
  $("rating-buttons").querySelectorAll("[data-grade]").forEach(button=>{
    button.addEventListener("click",()=>{
      if (!active || !revealed || busy) return;
      const id = active.id, grade = Number(button.dataset.grade);
      const elapsed = Math.max(3,Math.round((Date.now()-startedAt)/1000));
      change(()=>{
        const index = state.cards.findIndex(card=>card.id===id && card.deckId===DECK.id);
        if (index === -1) throw new Error("Published card not found");
        const previous = state.cards[index], now = Date.now();
        const confused = grade === 1 ? detectConfusion(previous,attempt,cards()) : null;
        state.cards[index] = reviewCard(previous,grade,now,{
          retention:state.settings.retention,seconds:elapsed
        });
        if (confused) {
          state.cards[index].confusionCount = (previous.confusionCount ?? 0) + 1;
          const other = state.cards.find(card=>card.id===confused.id && card.deckId===DECK.id);
          if (other?.reps > 0) other.dueAt = Math.min(other.dueAt,now+5*60000);
        }
        state.reviews.push({
          id:makeId(), cardId:id, deckId:DECK.id, at:now, grade,
          isNew:!previous.reps,confidence:beforeConfidence,
          typedExact:normaliseAnswer(attempt) === normaliseAnswer(previous.back),
          confusedWith:confused?.id ?? null,seconds:elapsed
        });
        if (state.reviews.length > 50000) state.reviews = state.reviews.slice(-50000);
        resetActive();
      });
    });
  });
  $("library-search").addEventListener("input",()=>{visibleCards=35;renderCards();});
  $("show-more-cards").addEventListener("click",()=>{visibleCards+=35;renderCards();});
  $("settings-form").addEventListener("submit",event=>{
    event.preventDefault();
    const form = event.currentTarget;
    change(()=>{
      const data = new FormData(form);
      const retention=Number(data.get("retention")), newLimit=Number(data.get("newLimit"));
      if (!(retention>=0.7&&retention<=0.98) || !Number.isInteger(newLimit) ||
          newLimit<0 || newLimit>200) throw new Error("Invalid review settings");
      state.settings={...state.settings,retention,newLimit};
      resetActive();
    });
  });
  $("export-backup").addEventListener("click",()=>{
    if (!state) return;
    const blob = new Blob([JSON.stringify({
      ...state, exportedAt: new Date().toISOString()
    },null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "study-backup-"+todayKey()+".json";
    document.body.append(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    tell("Backup exported. Keep it somewhere safe.");
  });
  $("import-backup").addEventListener("change",async event=>{
    const file=event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size>12_000_000) throw new Error("Backup exceeds 12 MB limit");
      const restored=validateSnapshot(JSON.parse(await file.text()));
      if (!window.confirm("Replace current browser-local study progress with this backup?")) return;
      await change(()=>{
        state=syncPublishedDeck(restored);
        resetActive();
      });
      tell("Backup restored; published questions remain controlled by code.");
    } catch (err) {tell("Restore failed: "+err.message,true);}
    finally {$("import-backup").value="";}
  });
}
async function start() {
  try {
    db=await openStudyDB();
    const saved=await loadState(db);
    state=syncPublishedDeck(saved);
    validateSnapshot(state);
    await writeState(db,state);
    text("deck-description",DECK.name+" — "+DECK.description);
    text("published-deck-name",DECK.name);
    $("study-app").hidden=false;
    bind();setView("review");
    setInterval(()=>{
      if (view==="review" && !revealed && !active) render();
    },30000);
  } catch (err) {
    tell("Study could not start: " + err.message +
      ". Allow browser site storage and reload.",true);
  }
}
start();
