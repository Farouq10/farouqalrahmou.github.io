# Study — shared, code-controlled flashcards

Live URL: https://farouqalrahmou.github.io/study.html

## Publishing and changing the flashcards

Every visitor sees the *same* published deck. There are NO deck-creation,
card-addition, editing, deleting, demo-loading, or bulk-import controls.

**Edit only** \`study/published-deck.mjs\` in the GitHub repository to
add, remove or revise cards. Commit to main; GitHub Pages publishes the changes.
Each card must have a stable, unique ID, question (\`front\`),
answer (\`back\`) and \`focus\` in fact/date/event/significance.
The page reflects updated code the next time visitors reload it.

The initial public deck contains Cold War (1945–55) revision cards.
Keep IDs stable for unchanged cards so their saved review progress continues.
If you change a published card's question/answer/type, that card's scheduled
state resets automatically when the site is opened again.

## What is saved, and where?

- **Published content:** in GitHub source code, delivered identically to everyone.
  It is shared without accounts or Firestore.
- **Individual study progress:** browser-local IndexedDB, including FSRS
  scheduling, confidence, mistakes, history, preferences. It persists across
  reloads on the same browser unless website storage is cleared.
- **Previous user-created cards:** remain in the same IndexedDB state and
  are included in JSON exports, but are no longer shown or editable by the
  current site; this preserves previous data rather than destroying it.
- **Other devices:** progress does NOT currently transfer between devices.
  Export/restore the JSON backup to move it manually.

No global shared review state: one visitor's reviews must not alter
another visitor's due dates. True cross-device progress without login
requires an identity strategy such as anonymous Firebase Auth with
account linking/recovery, and an actual configured Firebase project.
Anonymous auth alone does not recover history on a different device.

Backup import *cannot* overwrite the published card content. The code
catalogue is reapplied to every imported backup and startup.

## Scheduling

FSRS-6 with published default parameters; typed recall before feedback,
confidence collected before reveal, Again/Hard/Good/Easy self-assessment,
targeted answer-confusion prompts, exam-date experimental priority, and
a same-day unaided recheck after lapses. Additional priority rules are
experimental. They have NOT been shown to outperform Anki's FSRS.

Tests: \`node --test study/tests/*.test.mjs\`.
Automated CI also runs JavaScript syntax checks on the study modules.
No Firebase billing, third-party scripts, or separate hosting is required.

## Security notes

Since the source repository is public, everyone can READ the cards.
Only someone who can commit to the repository can edit the globally
published deck. Visitors can always modify data on *their own device*
using browser development tools; this does not change the shared deck.
Website scripts do not treat card text as HTML. Back up important progress.
