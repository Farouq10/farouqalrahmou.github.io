/**
 * THE ONLY AUTHORITATIVE DECK CONTENT.
 * Edit this file in GitHub to change questions/answers for ALL visitors.
 * Keep card IDs stable when only fixing wording; changing an answer resets
 * the local scheduling state for that card automatically.
 * Review histories remain private to each visitor's browser.
 */
export const PUBLISHED_DECK = Object.freeze({
  id: "published-cold-war-1945-55",
  name: "Cold War: 1945–55",
  description: "Core dates, events and historical significance for Edexcel GCSE History.",
  examDate: "", // Optional YYYY-MM-DD; affects experimental deadline ranking.
  cards: Object.freeze([
    {id:"cw-yalta-date",front:"When was the Yalta Conference?",back:"February 1945.",focus:"date"},
    {id:"cw-potsdam-date",front:"When was the Potsdam Conference?",back:"July–August 1945.",focus:"date"},
    {id:"cw-potsdam-disagreement",front:"What caused tension between Truman and Stalin at Potsdam?",back:"Disagreements over Germany's future, reparations and Soviet control of Eastern Europe.",focus:"significance"},
    {id:"cw-iron-curtain",front:"In which month and year was Churchill's 'Iron Curtain' speech?",back:"March 1946.",focus:"date"},
    {id:"cw-truman-date",front:"When was the Truman Doctrine announced?",back:"March 1947.",focus:"date"},
    {id:"cw-truman-policy",front:"What did the Truman Doctrine commit the USA to doing?",back:"Supporting countries threatened by communist expansion, initially Greece and Turkey.",focus:"significance"},
    {id:"cw-marshall-date",front:"When was the Marshall Plan announced?",back:"June 1947.",focus:"date"},
    {id:"cw-marshall-purpose",front:"What was the main purpose of Marshall Aid?",back:"To fund European recovery and reduce the appeal of communism.",focus:"significance"},
    {id:"cw-cominform-date",front:"When was Cominform established?",back:"September 1947.",focus:"date"},
    {id:"cw-cominform-role",front:"What was Cominform's role?",back:"To coordinate and tighten Soviet control over European communist parties.",focus:"fact"},
    {id:"cw-czech-coup",front:"When did the communist takeover of Czechoslovakia occur?",back:"February 1948.",focus:"date"},
    {id:"cw-blockade-begin",front:"When did the Berlin Blockade begin?",back:"June 1948.",focus:"date"},
    {id:"cw-blockade-end",front:"When was the Berlin Blockade lifted?",back:"May 1949.",focus:"date"},
    {id:"cw-airlift",front:"How did the Western powers respond to the Berlin Blockade?",back:"They supplied West Berlin by air through the Berlin Airlift.",focus:"event"},
    {id:"cw-comecon",front:"When was Comecon founded?",back:"January 1949.",focus:"date"},
    {id:"cw-nato",front:"When was NATO established?",back:"April 1949.",focus:"date"},
    {id:"cw-frg",front:"When was West Germany (FRG) established?",back:"May 1949.",focus:"date"},
    {id:"cw-gdr",front:"When was East Germany (GDR) established?",back:"October 1949.",focus:"date"},
    {id:"cw-soviet-bomb",front:"When did the USSR test its first atomic bomb?",back:"August 1949.",focus:"date"},
    {id:"cw-korea",front:"When did the Korean War begin?",back:"June 1950.",focus:"date"},
    {id:"cw-stalin-death",front:"When did Stalin die?",back:"March 1953.",focus:"date"},
    {id:"cw-warsaw",front:"When was the Warsaw Pact established?",back:"May 1955.",focus:"date"},
    {id:"cw-warsaw-role",front:"Why was the Warsaw Pact created?",back:"A Soviet-led military alliance formed after West Germany joined NATO.",focus:"significance"}
  ])
});

const PUBLIC_DATE = Date.UTC(2026, 9, 13);

/**
 * Overlay the code-defined deck onto browser-local state.
 * Legacy user-created decks and their history remain preserved in IndexedDB
 * and JSON backups but cannot be accessed/edited through this page.
 * A tampered/imported backup cannot alter published card content.
 */
export function syncPublishedDeck(state) {
  if (!state || !Array.isArray(state.decks) || !Array.isArray(state.cards)) {
    throw new TypeError("Invalid study state");
  }
  if (PUBLISHED_DECK.cards.length > 20000) throw new Error("Published deck too large");
  const deck = PUBLISHED_DECK;
  const seen = new Set();
  const originals = new Map(state.cards.filter(c => c.deckId === deck.id).map(c => [c.id,c]));
  const canonical = deck.cards.map((item, idx) => {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || seen.has(item.id)) {
      throw new Error("Card IDs must be unique, stable and URL-safe");
    }
    seen.add(item.id);
    if (!["fact","date","event","significance"].includes(item.focus) ||
        typeof item.front !== "string" || !item.front.trim() || item.front.length > 500 ||
        typeof item.back !== "string" || !item.back.trim() || item.back.length > 2000) {
      throw new Error("Invalid published card: " + item.id);
    }
    const previous = originals.get(item.id);
    const unchanged = previous && previous.front === item.front &&
      previous.back === item.back && previous.focus === item.focus;
    const basis = unchanged ? previous : {
      reps: 0, lapses: 0, dueAt: 0
    };
    return {
      ...basis, id: item.id, deckId: deck.id,
      front: item.front, back: item.back, focus: item.focus,
      createdAt: previous?.createdAt ?? PUBLIC_DATE + idx
    };
  });
  state.decks = [
    ...state.decks.filter(item => item.id !== deck.id),
    {id:deck.id, name:deck.name, examDate:deck.examDate, createdAt:PUBLIC_DATE}
  ];
  state.cards = [
    ...state.cards.filter(card => card.deckId !== deck.id),
    ...canonical
  ];
  state.settings.selectedDeck = deck.id;
  return state;
}
