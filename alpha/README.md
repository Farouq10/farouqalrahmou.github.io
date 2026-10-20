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
