# Alpha

A small History and English flashcard site. The current edition uses plain navigation, deck rows and a single review card. All 408 existing cards and existing guest backups are retained. Five rating buttons map to the original four scheduling grades (Impossible and No idea both count as a lapse, with different retry positions). This remains an experimental scheduler, not a demonstrated improvement over FSRS.

## Hosting

Production: https://alpha-recall.pages.dev/
Source: `farouqalrahmou/farouqalrahmou.github.io`, directory `alpha`.

Deploy only the public runtime files with Wrangler. Tests, rules, README and provisioning files do not belong in the static upload. The service worker caches an explicit public shell list; authenticated Firebase responses and private resource contents are never put in its cache.

## Firebase activation

The code is ready but `firebase-config.js` remains `null` until an authorised Firebase project is connected. Creating forms does not activate authentication.

Use a dedicated Firebase Spark project for Alpha, or review an existing project's complete rules before merging. `alpha/firestore.rules` is an Alpha-only ruleset; do not overwrite unrelated application rules with it.

1. Create or select the Firebase project and register a Web app.
2. Enable Authentication providers **Google** and **Email/Password**. Set a password policy with a minimum of 8 characters and enable email enumeration protection.
3. Add `alpha-recall.pages.dev` to Authentication's authorised domains. Add `farouqalrahmou.github.io` only if sign-in is also intended on that origin. Prefer the stable production hostname rather than arbitrary preview deployments.
4. Create the default Firestore database on the free tier, in a suitable region such as London (`europe-west2`). Publish the supplied `alpha/firestore.rules` using the Alpha config: `firebase deploy --project PROJECT_ID --config alpha/firebase.json --only firestore:rules`.
5. Put the **public Web app config** in `alpha/firebase-config.js` and redeploy. Public Firebase config is not a service-account credential. Never commit service-account keys or access tokens.
6. Test Google sign-in, email sign-up, verification, password reset, sign-out, separate users and the same account on a second device.
7. After Farouq creates and verifies his account, get his Firebase Auth UID from the authorised admin console. Grant that exact UID the `siteAdmin: true` custom claim with the existing trusted `backend/scripts/set-admin.mjs` admin script. The script requires trusted Application Default Credentials; those must never be placed in the website or Git. Then refresh the user's ID token or sign out and back in.

Only the verified, claim-bearing user's *own* `/users/{uid}/resources/*` can be read or written by that user. A friend cannot create roles, read another UID's progress, query other users or access the private resources. The claim is assigned by a trusted administrator, never by a browser email comparison or a sign-up form.

## Account behaviour

- Google sign-in and email/password sign-up/login, verification resends and password resets are implemented through Firebase Authentication. Alpha never stores raw passwords.
- Firebase uses session-scoped browser sign-in. Sign out on shared school computers.
- Guest progress keeps `tessera-progress-v1`. Accounts use `alpha-user-v2:<UID>` and never automatically adopt guest or another account's progress.
- Signing out clears the rendered account session and private resources and returns to guest progress. The account's offline progress cache remains namespaced in browser storage; users sharing a browser profile should not treat localStorage as encrypted storage.
- Resource text is kept in Firestore and memory only, not localStorage or IndexedDB. Resources support HTTPS links and notes, up to 100 loaded at a time; file upload is not included.
- Progress writes use transactions and revision checks. A newer write by a second device pauses sync rather than silently replacing that device's progress. Reload to reconcile, exporting a backup first if needed.
- To transfer existing guest progress, export a backup, sign in, then import into that account explicitly. Existing Alpha/Tessera backups work.

## Checks

Account-state tests run with `node --test alpha/tests/account-state.test.mjs`.
DOM interaction tests need `linkedom`. Firestore and real account-flow tests need `firebase@12.4.0`, `@firebase/rules-unit-testing@5.0.0`, `firebase-tools@14.20.0` and a Java runtime. Run `npm install --prefix alpha`, `npm test --prefix alpha`, and `npm run test:firebase --prefix alpha`, or install those into a separate development dependency directory and point `ALPHA_TEST_MODULES` at its `package.json` if they are not in the repository's dependencies.

```sh
ALPHA_TEST_MODULES=/path/to/dependencies/package.json node --test alpha/tests/account-state.test.mjs alpha/tests/app.test.mjs
ALPHA_TEST_MODULES=/path/to/dependencies/package.json firebase emulators:exec --project demo-alpha --config alpha/firebase.json --only firestore,auth 'node --test --test-concurrency=1 alpha/tests/firestore.test.mjs alpha/tests/sync.test.mjs'
```

The rules tests cover owner writes, cross-account/anonymous denials, revision conflicts, resource permissions, role escalation and unsafe links. DOM tests cover review, five ratings, saved progress, account transitions and private-route access. Full production Google sign-in and a visual browser check remain separate checks.

## Daily problems and public reading (20 October 2026)

- `problem-bank.js` stores 90 official references: 30 SMC selections, 30 BMO1 selections, and 30 harder BMO1/BMO2/EGMO selections. It does **not** embed copyrighted paper statements or copied solutions. Links open the official paper at the verified PDF page; 83 selections include an official solution source. The remaining seven explicitly say no verified free solution link is included.
- `daily.mjs` rotates three selections at midnight in **Europe/London**, with a 30-day cycle starting 20 October 2026. Day 31 repeats day 1. The current bank is finite; it does not generate new questions indefinitely. The day selector makes all 30 sets browsable. See `problem-sources.md` for provenance and BMO academic-year conventions.
- An open tab rechecks the UK date every 30 seconds and when it regains focus or visibility. Explicit archive browsing is not overridden.
- Attempted/solved markers are stored per date and problem in `prefs.problemLog`, using the same account-isolated saving and backups as review progress. Reading markers use `prefs.readArticles`. Both fields are sanitised on import and login. Existing Firestore rules already permit this bounded preferences map, so this release does not require a rules change.
- `articles.js` contains four original close readings: Kamikaze, The Prelude, Storm on the Island, and Remains compared with Exposure. Each includes a model paragraph, comparison routes, retrieval prompts and primary-text links. Modern poems are not republished. The articles and companion cards are cached with the public app shell for offline reading; official competition papers still require a connection.
- `enrichment.js` adds 64 companion flashcards (472 total). Existing users keep their deck selections; opening a new companion deck adds it explicitly to their reviews.
- All 408 original card IDs are retained. A targeted audit improves 150 original cards, including all 120 poetry prompts now naming their poem, 78 English answer improvements and seven History corrections/clarifications. `content-audit.md` and `card-corrections.json` record the scope and evidence. It is not a claim that every historical fact has been independently reverified.
- No personal identity or additional private material was added in this release. Public reading is separate from the existing owner-only resources route.

The fast checks include UK midnight/DST/month boundaries, all 90 unique problem references, exact retention of the 408 original IDs, companion-deck links, escaped article rendering, account transitions, imports and public/private routes. The selected runtime does not provide the browser-control skill, so visual browser QA is not claimed.
