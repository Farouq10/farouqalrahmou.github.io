# Study: One Deck, One Card, Five Ratings

Public URL: https://farouqalrahmou.github.io/study.html

## Interface
A single card shows a question. Click (or press Space) to flip it to the answer;
rate it with one of: Very easy (1), Easy (2), Not quite (3), No idea (4),
Impossible (5). The next question appears instantly. No decks list, deck
creator, edit buttons, statistics, settings, calendar, notifications or
account.

Only the owner of the GitHub repository can change shared cards in
\`study/published-deck.mjs\`. All visitors see that same content, and there
is exactly ONE published deck.

## Queue rules
- Everyone gets an initial shuffled pass through all of the cards.
- Very easy or Easy on first attempt => leaves this session (mastered pile).
- Not quite => partial/incorrect => retry after up to 4 other cards.
- No idea => retry after up to 2 other cards.
- Impossible => retry after up to 1 other card.
- During the initial pass, missed cards are appended after *all unseen
  cards*. This guarantees no unseen card gets starved by hard repeats.
- After a missed card, TWO later Easy/Very easy responses are necessary
  before it joins the mastered pile. The first successful recovery is
  reinserted late (Easy: up to 7 others; Very easy: up to 12).
- When few cards remain, queues naturally shrink, so repeats are closer.
- When everything has been mastered, the interface says "Deck complete"
  and offers one button to study the whole deck again.

The numeric queue lags and two-success rule are design hypotheses
rather than experimentally optimised parameters. We chose a minimal
session-based queue rather than Anki/FSRS calendar spacing, per the
requested product behaviour.

## Data, privacy and continuity
- Shared flashcard content lives in GitHub source code. No users can
  modify it through the site. Changing source changes it for everyone.
- Individual progress (queue + mastered pile + mistakes) is stored in
  browser \`localStorage\` under \`study-queue-v2\`. Refreshing the same
  browser resumes the current session.
- Data does not sync between devices or users; there is no Firebase
  configuration or identity system yet.
- Old IndexedDB decks, answers and scheduling histories remain stored
  under the earlier implementation and are NOT deleted by this change.
  They're no longer displayed through this simplified interface.
- If source cards change, a content fingerprint invalidates the old
  session and safely starts a fresh session. This avoids mismatched cards.
- On storage permission errors, the interface continues to work but
  shows a warning that position cannot persist.

## Research grounding

Rawson & Dunlosky, *Successive Relearning*, 2022:
https://doi.org/10.1177/09637214221100484

Karpicke & Roediger, *The Critical Importance of Retrieval for Learning*, 2008:
https://doi.org/10.1126/science.1152408

Balota, Duchek & Logan etc. retrieval lag research:
https://pubmed.ncbi.nlm.nih.gov/17576148/

What the research supports: testing, feedback, and delayed retesting, ideally
in more than one session. It does not establish that our precise 1/2/4/7/12
queue offsets are optimal or superior to Anki. Do not claim that.

Tests: \`node --test study/tests/queue.test.mjs\`.
