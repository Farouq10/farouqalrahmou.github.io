# Edexcel date flashcards

159 date-only cards: 75 Medicine/Western Front and 84 Cold War. Four FSRS ratings, five visual memory-strength stacks, due-first weakest-recall ordering, and optional early review. No card editor or accounts.

Study entrypoint: study.html. Requires study/date-app.mjs, date-cards.mjs, scheduler.mjs, local-save.mjs, fsrs.mjs, minimal.css and sources.html. Bundle is local: no CDN or runtime network dependencies. Preserve the existing Cloudflare site when adding this route.

FSRS is bundled from upstream MIT source commit c8ca282edc3fe1cdfa1c24912437938b63a25cb3. License: study/FSRS-LICENSE.txt. Settings use default upstream parameters, 90% retention, no fuzz. Five stack boundaries are display choices, not a new trained algorithm. Parameters are not personally optimised.

Browser saving uses localStorage and IndexedDB. Backup/restore is hidden under a details panel. Earlier queue snapshots remain untouched; they lack timestamps needed to reconstruct FSRS histories. No Firebase setup required.

Seven FSRS integration tests pass: card integrity, grading times/immutability, failure stacks, due versus ahead selection, date revival, content reconciliation and invalid data. Browser UI validation and final card-by-card source audit remain outstanding. Broad historical coverage is not an official exhaustive list.

Cloudflare deployment remains blocked by proxy connection refusal; farouq.pages.dev has not changed. Do not merge expecting this GitHub Pages repository to deploy the Cloudflare site automatically. Identify its actual deployment project/source first.
