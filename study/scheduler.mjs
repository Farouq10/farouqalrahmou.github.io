/**
 * StudyLab: FSRS-6 scheduling model + experimental, transparent priority layer.
 * Algorithm description: https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
 * Defaults are the published FSRS-6 weights (July 2026).
 * This is NOT a trained personalised FSRS model; "better than Anki" is NOT a
 * proven performance claim. Confidence/answer quality never replace recall grades.
 */
export const WEIGHTS = Object.freeze([
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194,
  0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629,
  1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542
]);
export const DAY = 86_400_000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const factor = Math.pow(0.9, -1 / WEIGHTS[20]) - 1;

export function probability(stability, elapsedDays) {
  if (!(stability > 0)) return 0;
  return clamp(Math.pow(1 + factor * Math.max(0, elapsedDays) / stability, -WEIGHTS[20]), 0, 1);
}
export function intervalDays(stability, desiredRetention = 0.9) {
  if (!(stability > 0) || !(desiredRetention >= 0.7 && desiredRetention <= 0.98)) {
    throw new RangeError("Invalid stability or retention target");
  }
  return clamp(stability / factor * (Math.pow(desiredRetention, -1 / WEIGHTS[20]) - 1), 1 / 1440, 3650);
}
function initialDifficulty(grade) {
  return clamp(WEIGHTS[4] - Math.exp(WEIGHTS[5] * (grade - 1)) + 1, 1, 10);
}
function nextDifficulty(current, grade) {
  const delta = -WEIGHTS[6] * (grade - 3);
  const damped = current + delta * (10 - current) / 9;
  return clamp(WEIGHTS[7] * initialDifficulty(4) + (1 - WEIGHTS[7]) * damped, 1, 10);
}
function nextStability(previous, grade, elapsed, difficulty) {
  const S = previous.stability;
  const R = probability(S, elapsed);
  if (grade === 1) {
    return clamp(WEIGHTS[11] * Math.pow(difficulty, -WEIGHTS[12]) *
      (Math.pow(S + 1, WEIGHTS[13]) - 1) *
      Math.exp(WEIGHTS[14] * (1 - R)), 0.05, 36500);
  }
  if (elapsed < 1) {
    // FSRS-6 same-day term. Successful recall must not reduce stability.
    return clamp(Math.max(S, S * Math.exp(WEIGHTS[17] * (grade - 3 + WEIGHTS[18])) *
      Math.pow(S, -WEIGHTS[19])), 0.05, 36500);
  }
  const gradeMultiplier = grade === 2 ? WEIGHTS[15] : grade === 4 ? WEIGHTS[16] : 1;
  return clamp(S * (1 + Math.exp(WEIGHTS[8]) * (11 - difficulty) *
    Math.pow(S, -WEIGHTS[9]) *
    (Math.exp(WEIGHTS[10] * (1 - R)) - 1) * gradeMultiplier), 0.05, 36500);
}
export function reviewCard(card, grade, now = Date.now(), { retention = 0.9, seconds = 25 } = {}) {
  if (![1, 2, 3, 4].includes(grade)) throw new RangeError("Grade must be 1..4");
  if (!Number.isFinite(now)) throw new TypeError("Invalid review time");
  const reps = card.reps ?? 0;
  const elapsed = reps ? Math.max(0, (now - card.lastAt) / DAY) : 0;
  const difficulty = reps ? nextDifficulty(card.difficulty, grade) : initialDifficulty(grade);
  const stability = reps
    ? nextStability(card, grade, elapsed, difficulty)
    : WEIGHTS[grade - 1];
  const calculatedInterval = intervalDays(stability, retention);
  // Explicit short-step repair after a failed retrieval; always followed
  // by a fresh UNAIDED attempt, not a second glimpse of the answer.
  const delay = grade === 1 ? 2 / 1440 : calculatedInterval;
  const priorAverage = card.avgSeconds ?? 25;
  return {
    ...card, stability, difficulty, reps: reps + 1,
    lapses: (card.lapses ?? 0) + (grade === 1 ? 1 : 0),
    lastAt: now, dueAt: now + delay * DAY,
    lastGrade: grade, avgSeconds: clamp(priorAverage * 0.8 + clamp(seconds, 3, 300) * 0.2, 3, 300)
  };
}
export function recallAt(card, at) {
  if (!card.reps || !card.lastAt) return 0.20; // heuristic prior for an unseen card
  return probability(card.stability, Math.max(0, (at - card.lastAt) / DAY));
}
export function priority(card, now, deadline, retention = 0.9) {
  if (!card.reps) return 0;
  const urgency = 1 - recallAt(card, now);
  const overdueDays = Math.max(0, (now - card.dueAt) / DAY);
  const errorBoost = 1 + Math.min(card.lapses ?? 0, 5) * 0.12;
  const costMinutes = Math.max(0.15, (card.avgSeconds ?? 25) / 60);
  if (!deadline || !Number.isFinite(deadline) || deadline <= now) {
    return (urgency + 0.04 * Math.min(overdueDays, 7)) * errorBoost / costMinutes;
  }
  // An EXPERIMENTAL gain-per-minute heuristic: assume Good on review,
  // compare projected deadline recall to not reviewing. Not FSRS itself!
  const afterGood = reviewCard(card, 3, now, { retention });
  const baseline = recallAt(card, deadline);
  const after = recallAt(afterGood, deadline);
  const benefit = Math.max(0, after - baseline);
  return (benefit + urgency * 0.08 + Math.min(overdueDays, 7) * 0.01) *
    errorBoost / costMinutes;
}
export function chooseNext(cards, now, { deckId = "all", newLimit = 15, newUsed = 0, deadline = null, retention = 0.9 } = {}) {
  const scoped = cards.filter((card) => deckId === "all" || card.deckId === deckId);
  const due = scoped.filter((card) => (card.reps ?? 0) > 0 && card.dueAt <= now)
    .sort((a, b) =>
      priority(b, now, deadline, retention) - priority(a, now, deadline, retention) ||
      a.dueAt - b.dueAt || a.id.localeCompare(b.id));
  if (due.length) return due[0];
  if (newUsed < newLimit) return scoped.filter((c) => !(c.reps > 0))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))[0] ?? null;
  return null;
}
export function normaliseAnswer(text) {
  return String(text ?? "").normalize("NFKC").trim().toLocaleLowerCase()
    .replace(/[’‘]/g, "'").replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ").trim();
}
export function detectConfusion(card, typed, cards) {
  const answer = normaliseAnswer(typed);
  if (!answer || answer.length < 2 || answer === normaliseAnswer(card.back)) return null;
  return cards.find((other) =>
    other.id !== card.id && other.deckId === card.deckId &&
    normaliseAnswer(other.back) === answer) ?? null;
}
export function todayKey(timestamp = Date.now()) {
  // Browser-local calendar day, not UTC (avoids midnight boundary errors).
  const date = new Date(timestamp);
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"), String(date.getDate()).padStart(2,"0")].join("-");
}
export function estimateIntervalLabel(days) {
  const minutes = days * 1440;
  if (minutes < 60) return Math.max(1, Math.round(minutes)) + "m";
  if (days < 1) return Math.round(days * 24) + "h";
  if (days < 60) return Math.round(days) + "d";
  if (days < 730) return Math.round(days / 30) + "mo";
  return (days / 365).toFixed(1) + "y";
}
