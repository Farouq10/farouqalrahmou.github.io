# Flashcard migration — prepared, not deployed

Copy `study.html` and the complete `study/` directory to the existing farouq.pages.dev site's source/output and add a navigation link to `/study.html`. The included `index.html` is the original GitHub site's index for reference; do not replace an existing Cloudflare home page without checking its source.

The original queue.mjs, persistence.mjs, cloud.mjs and cloud-policy.mjs are copied from farouqalrahmou/farouqalrahmou.github.io. Queue delivery logic is unchanged. The published deck retains its original ID and its 23 original cards so stored v3 progress can reconcile with the added cards.

237 cards total: 23 original cards plus 214 added date/significance cards. Coverage assumes Edexcel options 11 and P4 because the original deck identifies Edexcel. This is a broad revision set, not a claim that date recall alone guarantees Grade 9. See study/sources.html.

## Saving

LocalStorage and IndexedDB save each answer. Export/import creates a portable JSON backup. Existing progress on github.io is not automatically accessible on pages.dev. A valid old session snapshot can be imported and reconciled with the expanded deck.

## Optional Firebase

The original Firebase configuration is null, so cloud sync is not active. To enable it, provide public Web app configuration in study/firebase-config.mjs; enable Google authentication; authorise farouq.pages.dev and the Firebase auth domain; create Firestore; deploy owner-only security rules using the owner's actual UID. The existing adapter stores progress at studyProgress/{uid}. Test reads, writes, conflict resolution and signed-out access before claiming cloud saving works. Do not use open database rules or anonymous global progress just because only one person is expected to visit.

The existing cloud adapter references Firebase SDK 13.0.0. That remote dependency was not verified in this workspace; verify it or bundle a supported SDK before enabling sync.

## Hosting

Serve all files over HTTP(S). Allow local module scripts in your CSP. If cloud sync is enabled, configure CSP to permit the Firebase SDK and the project's required Auth/Firestore connections, then test it. Preserve the rest of the existing site's content and headers.

Deployment was blocked: the managed network proxy refused connections, including the authorised Cloudflare API. No Cloudflare project was modified.

