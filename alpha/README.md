# α Alpha — Knowledge that lasts

Alpha is a free-to-host, offline-capable GCSE revision site, with optional Google sign-in and cross-device sync.

## What's included
- 50 high-value dates each in Medicine, Weimar and Nazi Germany, Cold War, and Elizabethan England (200 dates total).
- 88 An Inspector Calls cards and 120 Power & Conflict poetry cards (15 poems), including cloze quotations, arguments and comparisons.
- In-session repeated mistakes, responsive interface, mixed review, adaptive due dates, date atlas, confidence calibration, review analytics, browser persistence, JSON backups, and offline-capable shell.
- Account sync code is present, but Google sign-in requires Firebase configuration before it will function.

## Cloudflare Pages (free, separate hostname)
Create a Cloudflare Pages project connected to `farouqalrahmou/farouqalrahmou.github.io`. Use:
- Project name: `alpha-recall` if available
- Production branch: `main`
- Framework: `None`
- Build command: none
- Build output directory: `alpha`

Cloudflare then assigns a project-specific `.pages.dev` address. The build is static and incurs no database usage for downloading flashcards.

## Existing GitHub Pages
If GitHub Pages is enabled for this repository, the alpha directory is accessible at `https://farouqalrahmou.github.io/alpha/`. The site still has to finish deploying after commits.

## Optional Firebase setup for sign-in and account sync
1. Create a Firebase project using the **Spark/free** tier at https://console.firebase.google.com.
2. Enable Authentication → Google provider and authorise the website's domain in Authentication settings.
3. Create Firestore and publish the supplied `firestore.rules` as its database rules.
4. In Firebase Project Settings → Web app, obtain the public web config. Edit `firebase-config.js` to export that config instead of `null`.
5. Commit, redeploy and test sign-in, local backup, saving, reload and account switching on a second device.

Never put Firebase service-account keys, passwords or other private credentials in repository files. A browser Firebase API key is a public identifier; Firestore rules control user access. The cloud sync currently stores up to 2,000 recent review events plus each card's complete scheduling state, to stay within database document-size limits.

## Scheduler
Alpha R1 uses card-specific stability estimates, due-first interleaving, mistake recycling and optional confidence recording. It is an *experimental*, evidence-informed memory model. **There is no proof that it outperforms Anki FSRS.** Any superiority claim requires a fair study comparing delayed recall at equal total study time.

## Backward compatibility
The browser storage key remains `tessera-progress-v1` deliberately, so reviews on the original site's origin are not lost. Existing `tessera-v1` JSON backups remain importable alongside `alpha-v1`. The historical `tessera` folder is retained as a fallback; Alpha is served from `alpha`.
