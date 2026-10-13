// Offline-first, origin-scoped IndexedDB storage. Data stays on THIS browser.
// A single versioned snapshot ensures import and reviews update atomically.
const NAME = "scientific-study-v1";
const STORE = "snapshots";
const KEY = "current";
const MAX_CARDS = 20000;
const EMPTY = () => ({
  schema: 1,
  decks: [],
  cards: [],
  reviews: [],
  settings: { newLimit: 15, retention: 0.9, selectedDeck: "all" }
});
function asText(value, max, name) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new TypeError(name + " must contain 1-" + max + " characters");
  }
  return value.trim();
}
const validId = (value) => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
export function makeId() {
  return crypto.randomUUID().replace(/-/g, "");
}
export function newDeck(name, examDate = "") {
  return { id: makeId(), name: asText(name, 80, "Deck name"),
    examDate: examDate || "", createdAt: Date.now() };
}
export function newCard(deckId, front, back, focus = "fact") {
  if (!validId(deckId)) throw new TypeError("Invalid deck ID");
  if (!["fact","date","event","significance"].includes(focus)) throw new TypeError("Invalid focus");
  return { id: makeId(), deckId, front: asText(front, 500, "Question"),
    back: asText(back, 2000, "Answer"), focus, createdAt: Date.now(),
    reps: 0, lapses: 0, dueAt: 0 };
}
export function validateSnapshot(value) {
  if (!value || value.schema !== 1 || !Array.isArray(value.decks) ||
      !Array.isArray(value.cards) || !Array.isArray(value.reviews) ||
      !value.settings || typeof value.settings !== "object" ||
      value.decks.length > 2000 || value.cards.length > MAX_CARDS ||
      value.reviews.length > 200000) throw new TypeError("Invalid backup format");
  const ids = new Set();
  const deckIds = new Set();
  for (const d of value.decks) {
    if (!validId(d.id) || deckIds.has(d.id)) throw new TypeError("Invalid/duplicate deck ID");
    asText(d.name,80,"Deck name");
    if (d.examDate && !/^\d{4}-\d{2}-\d{2}$/.test(d.examDate)) throw new TypeError("Invalid exam date");
    deckIds.add(d.id);
  }
  for (const c of value.cards) {
    if (!validId(c.id) || ids.has(c.id) || !deckIds.has(c.deckId)) throw new TypeError("Invalid/duplicate card");
    asText(c.front,500,"Question"); asText(c.back,2000,"Answer");
    if (!Number.isInteger(c.reps) || c.reps < 0 || c.reps > 100000 ||
        (c.reps > 0 && (!Number.isFinite(c.stability) || !(c.stability > 0) ||
        !Number.isFinite(c.difficulty) || !Number.isFinite(c.lastAt) ||
        !Number.isFinite(c.dueAt))))
      throw new TypeError("Corrupted review state");
    ids.add(c.id);
  }
  if (!Number.isInteger(value.settings.newLimit) ||
      value.settings.newLimit < 0 || value.settings.newLimit > 200 ||
      !(value.settings.retention >= 0.7 && value.settings.retention <= 0.98)) {
    throw new TypeError("Invalid study settings");
  }
  for (const r of value.reviews) {
    if (!validId(r.id) || !Number.isFinite(r.at) || ![1,2,3,4].includes(r.grade)) {
      throw new TypeError("Invalid review log");
    }
  }
  return value;
}
export function openStudyDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) { reject(new Error("IndexedDB is not available")); return; }
    const request = indexedDB.open(NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}
export function loadState(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      try { resolve(request.result ? validateSnapshot(request.result) : EMPTY()); }
      catch (err) { reject(err); }
    };
  });
}
export function writeState(db, state) {
  validateSnapshot(state);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(state, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Database transaction aborted"));
  });
}
export function freshState() { return EMPTY(); }
