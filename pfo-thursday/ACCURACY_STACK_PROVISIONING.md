# PFO 6.43 unified upgrade — Accuracy Lab infrastructure and release gates

**Verified infrastructure checkpoint: November 6, 2026 (Pacific Time).** The dedicated accuracy database and isolated Worker EXIST, but end-to-end forecasting and result certification remain DISABLED. This is not a production release or a working accuracy dashboard.

## Already created and verified (not tasks awaiting provisioning)

- Independent Cloudflare D1 database: `pfo-accuracy-lab` (dedicated ID tracked in `wrangler.accuracy.toml`).
- D1 migration: `accuracy-migrations/0001_accuracy_ledger.sql`; **3 tables, 3 indexes and 6 immutable UPDATE/DELETE triggers** were established. The deployed Worker queries the real schema, rather than simulating D1.
- Isolated Cloudflare Worker: `pfo-accuracy-lab-worker`, binding **only** `PFO_ACCURACY_DB`.
- Deployment Action: [42323844423](https://github.com/Kodiak907/dirty-birds-sleeper-feed/actions/runs/42323844423) — successful independent Worker deploy.
- Live health Action: [42324536276](https://github.com/Kodiak907/dirty-birds-sleeper-feed/actions/runs/42324536276) — successful live `/health` schema verification and HTTP 404 check for `/records`.
- Accuracy-stack Action: [42324536215](https://github.com/Kodiak907/dirty-birds-sleeper-feed/actions/runs/42324536215) — successful research and isolation QA.
- Workflow-scoped deployment secret: `CLOUDFLARE_ACCURACY_WORKER_TOKEN` (secret value must not be copied into the repository or chat).
- Research stack stays in draft [PR #4](https://github.com/Kodiak907/dirty-birds-sleeper-feed/pull/4). It is NOT merged or promoted to Pages.

The Worker is **health-only**: `automaticCaptureActive=false`, `independentResultsActive=false`, `accuraciesCertified=false`, `ffoiIntegrated=false`. Its `/records` route is not available.

## What is still genuinely blocked

1. **Exact PFO browser/server model provenance.** The visible projection uses `ffo-pfo-core.js`'s `pfo50Estimate`, the 6.36 `ffo-pfo-597.js` scoring/quality wrapper, fallback weighted recent/season scoring, and `ffo-pfo-616.js`'s D/ST recovery. A source-excerpt regression test (`qa-pfo-643-browser-model-parity.test.mjs`) executes existing browser code; it does **not** prove parity against a live server adapter. The server may not stamp a different forecast as `PFO 6.36`.
2. **Verified MSF fixture/event adapters.** Resolve exact licensed schedule IDs, player IDs, all kickoff times, final box scores, scoring-play distances and corrections. Use established production provider credentials through authorized Worker/CI access only. A historical data endpoint being reachable does not prove all needed categories are licensed or complete.
3. **Trusted scheduled capture.** Only enable a Worker cron after schedule provenance, same-model server-side forecasts, 15+ minute kickoff cutoff, first-write immutability and authorization pass full checks. No unauthenticated browser write route.
4. **Independent finals.** Append verified player-game certificates only with all scoring categories reconciled. Do not interpret unknown bonus events/FG distances or corrections as zero. Sleeper fantasy outcomes are not accuracy truth.
5. **Authenticated read-only dashboard.** Report only comparable versioned pregame/final pairs, sample sizes, exclusions and 'Not measurable yet' when appropriate. Never expose individual league roster or provider data publicly.
6. **Unified PFO QA / one protected preview.** Reconcile models and projections across Team HQ, Matchups, Start/Sit, Lineup Lab, Trades, Waivers and Championship, fix interactions/performance, run real iPhone Safari checks, then make one versioned protected-preview 6.43 deployment. Preserve private and public demos, production, FFOI and all Commissioner database bindings/data.

## Rules that cannot change

- Source-of-truth scoring: `FFO_FFL_SCORING_V1.json`, version `2026-11-05-ffl-screen-recording-verified-v4`.
- Zero scoring: generic FG base, three-and-outs, fourth-down stops, defensive 2-point returns and non-TD 40+ yard rush bonuses.
- Kicker FGs require a specific verified distance. Do not count a generic FG and a tier simultaneously.
- 50+ yard TD bonus stacking remains under adjudication until exact scoring semantics and events are verified.
- Sleeper only for authorized roster, identity, transactions, waiver and matchup state, not forecast/actual score inputs.
- Model scoring coverage is **not** certified scoring completeness. Report partial evidence and zeros distinctly.
- Use the independent D1 binding; never use `COMMISSIONER_DB` for accuracy metrics or touch disciplinary records.
- No TinyFish, paid browser sessions or unnecessary new costs; no FFOI→PFO integration without Coach's separate authorization.
- No new Worker cron, D1 writes, accuracy screen or private-preview deployment simply because a source-level QA test passes.

## Clear separation of environments

- Protected Pages preview: `https://pfo-598-msf-core-and-mobile.dirtybirdstest.pages.dev/`
- Public fictional demo: `https://ffo-pfo-exact-demo.pages.dev/`
- Independent Worker health: `https://pfo-accuracy-lab-worker.tvega2924.workers.dev/health`
- 6.43 feature branch: `pfo-643-unified-production-upgrade-20261106` (created from `75bc73890a2d5112583c8eb1b169f9ba9b0e47b4`; no premature merge).

**Note:** Existing 6.42 readiness code may describe `separateAccuracyD1Bound=false` because the **Pages application** does not have an accuracy binding. This must not be confused with the independently deployed Worker, which has a live verified accuracy binding. The distinct meaning must remain explicit in future reports.

## Immediate next gate

Pass the source-excerpt browser parity CI, then implement a Worker-compatible exact-model forecast path and an authenticated live browser/server comparison over real MSF player and game fixtures. Without real parity and verified provider fixture coverage, automatic capture remains off.
