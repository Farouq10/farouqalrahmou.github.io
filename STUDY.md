# Study — evidence-informed flashcards

URL (after GitHub Pages deploy): https://farouqalrahmou.github.io/study.html

This is an offline-first, no-cost browser flashcard app. **It is not a scientifically
validated improvement over Anki.** Its memory model is FSRS-6 with published
default weights, not an independently trained scheduler. The priority policy
and interventions are experimental hypotheses proposed in an earlier study
design, with no evidence of superiority from a controlled comparison.

## Features

- Separate study page retaining minimalist typography and navigation.
- Deck creation, individual and TSV bulk cards, editable items and removal.
- Typed free recall BEFORE exposing answers; confidence BEFORE feedback.
- Four self-grades: Again/Hard/Good/Easy. Exact-string match is only a
  diagnostic hint; only the learner can judge equivalent free-form answers.
- FSRS-6 predicted retrievability, stability and difficulty updates.
- Short (2-minute) unaided recheck after forgetting.
- Optional per-deck exam deadline; experimental priority estimates
  extra target-date recall per minute. Without a deadline, due risk and
  lateness are prioritised. Reviews that are not yet due are not forced.
- Detects when an incorrect typed response exactly matches another
  card answer in the same deck and prompts targeted confusion repair.
- Local review history, successes/failures, daily new-card limit and stats.
- Complete JSON backup/restore (import REPLACES all local data).
- Optional 10-card Cold War dates example deck, NOT silently inserted.
- No third-party JS dependencies, account, Firebase, fees or build step.
- Automated unit tests for the scheduling formulas and invariants.

## Storage and privacy

Study data stays in IndexedDB on the current browser and origin. The
previous Firebase integration is NOT deployed/configured and this study page
does NOT cloud-sync. Review histories will not follow you between school,
home or private-mode sessions. Export JSON backups regularly.

Study module never uses innerHTML with flashcard content. All personal
card text is rendered as textContent. Browser data is accessible to scripts
running on this origin, so only commit trusted changes to the same site.

## Research foundations and limitations

- FSRS-6 model: https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
- Predictions come from published fixed 21-parameter FSRS-6 defaults. Custom
  optimisation of those parameters to review histories has NOT been built.
- Review confidence is stored separately from recall grades. There is no
  validated confidence-calibration model or learned intervention value yet.
- Deadline utility is a **simple estimate** assuming a successful Good review,
  not the trained expected causal gain; the one-card-per-minute heuristic has
  not been calibrated on learner data.
- Local loaded-page search and exact-answer confusion detection are not
  semantic retrieval, full database search, or automatic correctness grading.
- No actual Firebase sync, cross-device login, Anki imports, service worker,
  offline file caching, encryption at rest, telemetry or automated backups.
- Need a controlled comparison with Anki+FSRS at equal study time and blind
  unaided 7- and 30-day tests before asserting an improvement.

## Next engineering phases

1. Connect the Firebase project and write private user-owned collections
   under per-user security rules, then migrate local data with explicit
   conflict resolution (avoid silent overwrites).
2. Add import/export of standard Anki deck formats with media support.
3. Validate deadline prioritisation on user history and compare against a
   pure FSRS-6 baseline in a properly controlled study.
