# Tessera — Make it stick

A separate GCSE revision website, ready for free static hosting on **Cloudflare Pages**. The live URL is created **by you** when you deploy; a `.pages.dev` name is not reserved by these files.

## What's in the app

- **History:** four Edexcel GCSE units, **exactly 50 dated events each**: Medicine in Britain, Weimar and Nazi Germany, Superpower relations and the Cold War, and Early Elizabethan England. Every card pairs a dated event with an explanation of significance.
- **English:** **88** analytical *An Inspector Calls* cards, plus **120** analysis and comparison cards across all **15** AQA Power & Conflict poems. Cards use brief anchors and original analytical summaries rather than reproducing long copyrighted extracts.
- **Revision:** focused mixed reviews, an interleaved queue, in-session repeated mistakes, delayed intervals, optional confidence predictions, timing, progress statistics and a searchable date atlas.
- **Data:** browser storage and portable JSON backups; optional Google sign-in and cloud progress after Firebase setup.
- **No subscriptions, trackers, advertisements or runtime build framework.**

## Deploy as a different Cloudflare Pages website

1. Sign in to [Cloudflare](https://dash.cloudflare.com/) and open **Workers & Pages → Create → Pages → Connect to Git**.
2. Connect GitHub and select the existing `farouqalrahmou/farouqalrahmou.github.io` repository. This creates a **separate Cloudflare Pages project**; it does not replace the GitHub Pages portfolio.
3. Choose project name such as `tessera-recall` (subject to availability), production branch **main**, framework **None**, **no build command**, build output directory **tessera**.
4. Deploy. Your independent revision site will have the chosen **project-name.pages.dev** hostname. Updates to the tessera folder will redeploy automatically after Git commits.

**Important:** GitHub Pages also allows previewing the app at `https://farouqalrahmou.github.io/tessera/` when the site's Pages deployment is enabled. This path is not a separate hostname, and the deployment status is not confirmed by these files.

Cloudflare documentation: [static asset requests are free and unlimited](https://developers.cloudflare.com/pages/functions/pricing/); [Pages limits](https://developers.cloudflare.com/pages/platform/limits/). Free currently supports 500 builds/month, 20,000 static files per site and a 25 MiB maximum individual static asset.

## Enable real Google login and cross-device sync (optional)

The site works *immediately* offline from any authentication setup, with local browser storage. The sign-in button **does not work as a login until you complete these steps**:

1. Create a Firebase project at https://console.firebase.google.com/ on the **Spark / free** plan (no billing account).
2. In Authentication → Sign-in method enable **Google**.
3. In Authentication → Settings → Authorized domains, add the exact Cloudflare hostname you created (plus the GitHub Pages hostname if you want to use both).
4. In Firestore Database, create the initial standard database and replace its rules with the contents of `firestore.rules` in this directory. These rules allow each signed-in user to access only their own review-state document.
5. Project Settings → Your apps → Add a Web App → copy its *public* Firebase configuration (apiKey, authDomain, projectId, appId). Replace `null` in `firebase-config.js` with that object; commit and let Cloudflare redeploy.
6. Test on two devices and test a signed-out session. A working sign-in needs BOTH the configuration AND the database rules.

**Never** put an admin SDK service-account key, private key, account password or Firebase bearer token in this repository. The browser-side Firebase API key is a public identifier and is not a server secret; database security depends on authentication and strict Firestore rules. Google handles account credentials.

Free Firebase Spark Firestore quota (check for changes): 1 GiB stored, 50,000 document reads/day and 20,000 document writes/day, with 10 GiB outbound data/month. As the deck library is static, only each person's review state consumes Firestore storage. The app debounces cloud writes and checks for concurrent updates. If conflicting states are detected, it **does not silently merge** them. Export backups periodically.

## About the scheduler: Tessera R1

**No honest evidence currently establishes that Tessera R1 outperforms modern Anki FSRS.** Anki's current FSRS scheduler is a serious research-backed baseline; simply adding more features would not establish superiority.

R1 is a transparent experimental hybrid:
- A card carries a learned **90%-retention interval** (stability).
- Expected recall at elapsed time `t` is approximated by `p = exp(ln(0.9) * t / stability)`.
- After feedback, stability changes according to the grade and its forgetting probability; the next interval is `stability × ln(targetRetention)/ln(0.9)`. Initial stability is grade-dependent.
- Forgotten cards are scheduled soon and appear again within the current review session until they are correctly recalled twice.
- Due cards are prioritised over new cards, and high-value / different-topic cards are deliberately mixed when similarly urgent.
- Before revealing an answer, users can optionally predict confidence. These predictions and recall times are saved for later calibration analysis. They are **not** claimed to improve recall by themselves.

This is an initial product, not a clinical or educational efficacy claim. Proper comparison requires randomised assignment of cards to R1 vs FSRS, **delayed recall testing at equal total review time**, a predefined retention measure, and enough observations to draw a conclusion. A scheduler that increases recall by using much more time is not automatically better.

Evidence background:
- [Anki manual: FSRS and desired retention](https://docs.ankiweb.net/deck-options.html)
- [Carpenter, Pan & Butler (2022), spacing and retrieval practice](https://doi.org/10.1038/s44159-022-00089-1)
- [Onan et al. (2024), interleaving](https://www.nature.com/articles/s41539-024-00245-7)

## Data, safety and maintenance

- Card data is versioned within `history.js` and `english.js`. Avoid changing stable card IDs once people have studied them; the review history keys off these IDs.
- Browser data can be cleared by the user or their browser. Always keep an occasional JSON backup, particularly before changing sync providers.
- A public revision resource can help, but every historical fact and interpretation should still be cross-checked against the final exam-board specification, school teaching and trusted references.
- Not designed to run a public leaderboard or collect minors' personal details. No account information is stored in the flashcard files.
- Code is intentionally framework-free so that it can be moved to Cloudflare, GitHub Pages, Netlify or other free static hosts without a build step.
