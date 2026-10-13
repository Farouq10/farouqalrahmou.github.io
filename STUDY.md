# Study: one deck, five buttons, saved progress

Open https://farouqalrahmou.github.io/study.html .

## Precise queue rules

All cards come from the single source file \`study/published-deck.mjs\`.
The interface contains only one two-sided card, five ratings and the
completion/restart control. There are no separate decks, Review, Statistics
or Settings screens.

1. Shuffle the cards on a new session.
2. Show every unseen card once before repeating any missed cards.
3. **Very easy** or **Easy** on a never-missed card => leave this session.
4. **Not quite** => an error; put the card back after up to 4 other cards.
5. **No idea** => an error; put it after up to 2 other cards.
6. **Impossible** => an error; put it after up to 1 other card.
7. Once a card was missed, it must be answered completely correctly on
   TWO later presentations to leave the session. After the first correct
   recovery, Easy puts it back after up to 7 cards, Very easy after up
   to 12. Another failure resets the correct-streak count.
8. As the queue shrinks, retries may be closer than their requested
   offsets because there are fewer cards left.
9. Finish when EVERY card has left the queue. Then Study again starts
   a shuffled fresh session (it does not start automatically).

All numbers (1, 2, 4, 7, 12 and two recovery successes) are transparent
design decisions, not trained optimal intervals. The model borrows ideas
from retrieval practice, corrective feedback and successive relearning,
but does not claim superior long-term outcomes to Anki or FSRS.

## How progress survives

**After each rating**, the app calculates the next queue state and saves
it BEFORE moving on. It writes to two independent browser APIs:
localStorage (\`study-queue-v3\`) and IndexedDB
(\`study-progress-v3\`), so one can fail without losing the rating.
If neither save succeeds, the card stays on screen and an error appears.

Reloading the same website in the same browser restores:
- exact active queue order and completed cards;
- which cards were missed and how many times;
- each card's successful corrective recall streak;
- total attempts and the session's place.

An old \`study-queue-v2\` queue is migrated if the deck text matches.
Card additions and modifications no longer reset all progress:
unchanged cards keep their position and completion, while new/changed
cards enter as unseen. Removed cards disappear from the active session.
A completed session reset is saved with a newer version so it wins over
the older completed state on reload.

These are **local** saves and do not follow the user to another browser,
another device, or an emptied browser profile. Neither localStorage nor
IndexedDB is a true backup against clearing site data. Firebase remains
unconnected; enabling cross-device saving needs a real backend and a
means to authenticate or recover the user's identity. Avoid pretending
single-user access alone solves this limitation.

Older IndexedDB records from the previous multi-deck implementation
are not deleted or migrated into this new queue.

## Verification

Run \`node --test study/tests/*.test.mjs\` locally. The GitHub Actions
workflow runs these tests and JavaScript syntax checks whenever Study
code changes. Tests cover queue positions, all-unseen-first, repairing
mistakes, restart, reload, legacy conversion, corrupted data, and changes
to published cards. A full multi-browser end-to-end test is still a
separate validation task.
