# Activate private cloud sync for Study

## Current state

- Website code for Google sign-in, private Firestore progress, change
  detection, and first-time conflict resolution: **implemented in GitHub**.
- Local saving stays enabled (two browser stores).
- Live Firebase project connection: **NOT activated**.
- This repository deliberately has \`study/firebase-config.mjs\` exporting
  \`null\`. The website will show "Cloud sync is not connected yet" until the
  Firebase project exists and this file is configured.
- There is no secret, Firebase project ID, OAuth credential, or database
  access in the repository.

## What to connect (Spark / free)

1. In https://console.firebase.google.com create or select a Firebase project
   on the **Spark** plan (no billing account). Register a **Web app**.
2. In that project, enable **Cloud Firestore**, Standard edition, in a
   region suitable for UK users. Use production/locked rules initially.
3. Under **Authentication → Sign-in method**, enable **Google**.
   Under authorised domains, add \`farouqalrahmou.github.io\`.
4. Copy the *public web app config* (apiKey, authDomain, projectId, appId)
   from Firebase Console → Project settings → General → Your apps.
   These are project identifiers, not passwords. Never share service-account
   credentials, private keys, or access tokens.
5. Replace \`null\` in \`study/firebase-config.mjs\` with the public config
   object. Do not touch \`study/published-deck.mjs\` or the website design.
6. Authenticate the Firebase CLI (\`npx firebase login\`) and deploy the
   repository's tested database rules only after checking the project:
   \`npx firebase deploy --project YOUR_PROJECT_ID --only firestore:rules,firestore:indexes\`.
   WARNING: Firestore rule deployment replaces the existing rules of the
   target database; do not point this at an unrelated project.
7. Open the Study page. Click **Sign in to sync** and use the SAME Google
   account on each device. The first connected browser saves its current
   local progress; on another device the remote session is restored.

The user's separate first-party Firebase connector may also support
provisioning these services once the user connects it. This ChatGPT session
currently has no connected Firebase project access, so deployment cannot
be completed by changing GitHub alone.

## Conflict safety

- Each cloud account has a private Firestore document:
  \`studyProgress/{firebaseAuthUid}\`.
- Security rules restrict reads and writes to the owner UID, prevent list
  queries, enforce a strict session shape, require server timestamps and
  monotonic document version numbers, and deny document deletion.
- The SDK writes with transactions and checks expected cloud versions.
  Another device's newer write cannot silently be overwritten by a stale
  snapshot.
- If the browser and remote account both hold divergent progressed sessions
  on first sign-in, the user must choose **Use cloud progress** or
  **Use this device**. The displaced copy is first retained under a safety
  key in browser localStorage. If safety-copy creation fails, replacement
  is not allowed.
- On an offline/failed cloud write, the local queue remains usable and the
  cloud status shows that syncing is paused. Reload and reconcile when
  internet connectivity returns.
- A session is always written to localStorage and IndexedDB before the
  visible card advances. Cloud writes happen after the local save.
- On Firebase sign-out, cloud sync stops; browser progress remains.
- These conflict operations resolve entire queues, not individual card
  attempts. A true multi-device event-log merge would require a more
  complex model; this design intentionally avoids silent data loss.
- The site's flashcard content remains public, fixed by GitHub source,
  separate from private cloud study progress.

## Costs and usage

Firestore's Spark allowance (as of Oct 2026) is 1 GiB, 50,000
reads/day, 20,000 writes/day, 20,000 deletes/day and 10 GiB monthly
outbound data. For one account and one small session document this should
easily fit, though quotas and pricing can change. No Cloud Storage,
Cloud Functions, paid backups or hosting migration are required.

## Verification

- \`npm run test:rules\` checks Firestore rule ownership, field validation,
  versioning and timestamp permissions via an emulator.
- \`node --test study/tests/*.test.mjs\` checks queue behaviour and
  initial sync conflict policy.
- The current GitHub Actions checks are NOT proof that live Firebase
  authentication and network synchronization work before configuration.
- After activation, test with one browser, refresh, then a second browser
  signed in to the same Google account, including disconnected/reconnected
  conditions. Confirm no additional accounts can read the private document.
