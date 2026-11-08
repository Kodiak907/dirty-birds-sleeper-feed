# PFO 6.43 — isolated development status and single-release gate

Checkpoint: November 6, 2026, Pacific Time  
Development branch: `pfo-643-unified-production-upgrade-20261106`  
Starting point / rollback baseline: `75bc73890a2d5112583c8eb1b169f9ba9b0e47b4`

**RELEASE DECISION: NOT READY.** Everything below is branch-only. Do not deploy the protected Pages preview, main, public exact-clone demo, Commissioner portal, or FFOI.

The previously deployed standalone Accuracy Lab Worker remains read-only health with no cron. Its D1 has three tables and six immutable triggers, independently verified by successful live-health Actions run [42324536276](https://github.com/Kodiak907/dirty-birds-sleeper-feed/actions/runs/42324536276).

## Evidence-backed outcome matrix — one release only after all gates pass

| Scope | Progress in 6.43 branch | Remaining production proof |
|---|---|---|
| 1. Licensed MSF fixtures/stat adapters | **PARTIAL** — new fail-closed authenticated fixture normalizer, IDs/week/teams/UTC kickoff, duplicate rejection; existing protected Pages MSF reads inspected | Real live licensed MSF fixture/stat requests from isolated trusted runtime; source coverage, provider IDs, entitlement, completed score/bonus proof |
| 2. Immutable scheduled pregame capture | **PARTIAL** — existing append-only D1 capture runner hardened to process only verified 15–30-minute pre-kickoff windows | Server-side trusted same-model forecasts, cron, live immutable first-write smoke tests at Thu/Sat/Sun/Mon kickoffs |
| 3. Independent final FFL scoring | **PARTIAL** — existing 6.39 certificate gate and immutable D1 structures preserved | Real provider game logs/FG distances/long TDs/DST PA/bonuses/stat corrections fully verified and certified in D1 |
| 4. All-position projection coverage | **PARTIAL** — actual 6.36 source and separate 6.16 DEF overlay parity harness, null-vs-zero and gap quality assertions | Provider data completion and verified quality for missing QB/RB/WR/TE/K/DST, actual frontend player checks |
| 5. Quality tuning | **BLOCKED** — frozen baseline maintained, no invented accuracy gains | Enough real matched pregame model predictions and independent results for holdout validation |
| 6. Read-only Accuracy dashboard | **BLOCKED** — existing 6.40 independent D1 dashboard library preserved | Authenticated read-only UI in protected preview, real D1 pairs, empty-state/samples and exclusions QA |
| 7. One forecast/scoring engine across tools | **PARTIAL** — original 6.36 browser source extracted; worker-compatible six-position scoring/fallback candidate and DEF overlay candidate pass synthetic source-level regression | Live authenticated browser/server parity and actual use from every PFO surface; no source aliasing or false provenance |
| 8. Starter/bench/team totals and swaps | **PARTIAL** — pure official 10-slot sum and changed-slot/in/out logic; app nine-slot default corrected to two FLEX | Wire to real submitted/bench player IDs, verify all frontend screens/mobile source values and show only defensible totals |
| 9. Start/Sit, GameCast and workflow reliability | **BLOCKED** — existing weekly rollover logic retained with regression test | Reproduce/fix interaction and latency failures in real protected preview, perform web/mobile QA |
| 10. UI/UX polish | **BLOCKED** — existing UI preserved; no untested modifications | Rich overview, clear matchup cards, bench vs IR, iPhone usability and tech diagnostics suppressed |
| 11. Monitoring/retries/recovery | **PARTIAL** — pure MSF freshness/coverage/rate-limit/circuit-breaker policy and tests | Bind to trusted ingestion runtime with scheduled retries, provider responses and automatic recovery, explicit stale labels |
| 12. Single protected preview release | **BLOCKED** — branch-only Actions CI; no deploy path | All mandatory gates green, actual browser/iPhone QA, separate D1 and Commissioner/demo comparison, one versioned preview deploy/rollback |

## Concrete new sources

- `ffo-msf-fixtures-643.mjs` and `qa-pfo-643-msf-fixtures.test.mjs`: timestamped fixture identity, 15–30 min kickoff selection and duplicate/conflict rejection
- `ffo-server-forecast-643.mjs`: **candidate** for existing 6.36 browser FFL score/fallback and 6.16 DEF override; explicitly **not certified live parity**
- `qa-pfo-643-browser-model-parity.test.mjs`: executes actual browser source snippets and compares candidate functions across QB/RB/WR/TE/K/DEF, long unsupported category policies and fallback
- `ffo-lineup-reconciliation-643.mjs` and QA: exact 10 FFL starter slots, strict rules/provenance, partial numeric subtotals, changed slot and player swaps; no automatic Sleeper writes
- `ffo-msf-ingestion-health-643.mjs` and QA: fail-closed stale provider, missing categories, 429 backoff, authorization errors and no invented live data
- `qa-pfo-643-roster-slots.test.mjs`: source-level check for official two-FLEX fallback and previously implemented Tuesday 08:30 PT advancement
- `.github/workflows/pfo-643-model-parity-qa.yml`: branch-only no-deploy tests; source of exact latest pass/fail in GitHub Actions
- `ACCURACY_STACK_PROVISIONING.md` corrected from outdated missing-infrastructure assertions.

## Source and security limitations

- Unit/source-level parity on controlled inputs is **not** parity with the true PFO forecast displayed from current live MSF inputs. The latter remains required before any D1 forecast writes.
- A true score cannot be fabricated from missing kicker distance, uncertain 50+ long TD bonus overlap, incomplete defensive scoring event attribution or unverified corrections.
- `pfo-accuracy-lab-worker` has only the dedicated D1 binding. Do not assume it has the production Pages `MSF_API_KEY` secret or `GAMECAST_INTERNAL` service binding. Verify existing authorized capabilities through CI; request narrow secret/binding changes only after an actual proven blocker, never secret values in chat.
- No FFOI integration, no reliance on Sleeper fantasy scores, no new paid tools, and no mixing Commissioner or Accuracy D1.
- Existing `pfo66WeekAt` advances the 2026 calendar Tuesday at 08:30 America/Los_Angeles, with an independent QA test already present. A stale UI display could still be caused by other state; browser end-to-end validation remains pending.

## Next implementation objective

Using preexisting, authorized MSF access, build a **non-public trusted Worker-side MSF fixture/normalized player feed** and a **live browser-vs-server parity test** for the same player, verified game and source timestamp (including D/ST's independent override). Do not schedule snapshot writes or touch the protected Pages preview until those sources are proven, then proceed with certified final results and the consolidated remaining PFO functionality. No additional access requests unless an actual GitHub Actions/provider check identifies the missing capability.

## Continued 6.43 checkpoint — November 6, 2026 (Pacific)

- Draft review-only [PR #5](https://github.com/Kodiak907/dirty-birds-sleeper-feed/pull/5) targets the isolated accuracy-stack branch. **DO NOT MERGE OR DEPLOY** until every acceptance gate passes.
- Exact copy of the existing private Pages MSF season normalizer is in 'ffo-msf-season-normalizer-643.mjs'; source-equivalence tests prevent divergence. The new trusted reader uses fixed 2026 team-scoped MSF endpoints, a single GET, bounded response size, private Basic authentication and no D1 writes.
- [One-shot Actions access probe #42328252985](https://github.com/Kodiak907/dirty-birds-sleeper-feed/actions/runs/42328252985) did not run a provider request: 'MSF_API_KEY' is **not available in GitHub Actions environment pfo-preview**. Its successful workflow status only means the restricted diagnostic completed, not that provider access succeeded. Existing Cloudflare Pages credentials / internal Gamecast binding are not proven missing.
- The private roster/player identity bridge requires unique matching of roster ID with licensed MSF player ID, exact team and position, verified fixture, frozen FFL scoring, and a pre-kickoff source as-of. Every candidate remains marked **live browser/server parity NOT verified / capture NOT allowed**.
- Public MySportsFeeds SDK confirms upcoming game status 'UNPLAYED'. Our fixture adapter now normalizes it to internal NOT_STARTED and excludes cancelled/postponed, active-game and postgame-review records. Source: https://pkg.go.dev/github.com/MySportsFeeds/mysportsfeeds-go . Live schema verification remains mandatory.
- Actual existing PFO browser lineup code now rejects partial, duplicate or nine-slot projected totals, and the optimizer shares that computation. A subtotal is distinct from a complete ten-slot projected team total. The roster no longer calls an independent partial stat reconstruction verified final points.
- Start/Sit now respects the canonical Tuesday 08:30 Pacific rollover unless Coach explicitly selects a manual week; source-level tests cover both.
- New separate 6.43 unified release gate allows shipping with truthful Not enough verified data after all operational proof, while keeping 100+ independent pairs and heldout research gates for **candidate model promotion only**. Static tests do not certify live PFO readiness.
- Added a no-deployment local Chromium/browser regression workflow for navigation, matchup, mobile, trade and GameCast source checks.

**Still blocked:** trusted live MSF provider fixture/player/final evidence, real browser/server model parity, cron and first-write immutable snapshots, certified final scores, authenticated accuracy UI, integrated cross-tool fixes, real iPhone QA and ONE protected preview release. No new costs, TinyFish, FFOI integration, Commissioner D1 or public-demo changes.

## Browser and performance QA checkpoint — November 6 PT

- Local Chromium/browser, lineup, trade, mobile-layout and GameCast baseline regressions passed in [Action #42329114977](https://github.com/Kodiak907/dirty-birds-sleeper-feed/actions/runs/42329114977). This is **not** real-device iPhone QA, and no Cloudflare Pages release occurred.
- The first browser QA run revealed a stale legacy assertion expecting the D/ST companion asset at version 627, whereas actual frozen PFO 6.36 serves version 636. The test was corrected; production source was not changed to satisfy the stale check.
- Start/Sit and the Interactive Lineup Lab now memoize identical MSF-based opponent allowances per position/source data array rather than recomputing over every player's games on every comparison. Cache invalidates on provider data refresh; tests check frozen-rule arithmetic, re-use, stale-source invalidation, and withholding without FFL scoring rules.
- Existing Tuesday 08:30 PT week advancement and all official ten starter slots remain unchanged and covered by tests.
- These QA outcomes confirm isolated regression behavior only. Live provider access, real PFO dashboard, complete scores, scheduled snapshots, Commissioner/demo isolation checks and iPhone Safari proof remain **NOT PASSED**.

## 6.43 third engineering round — November 6, 2026 PT

**Status remains NOT READY.** Everything staged in draft [PR #5](https://github.com/Kodiak907/dirty-birds-sleeper-feed/pull/5); protected private preview, live Accuracy D1, Commissioner DB, production, public demo and FFOI were not deployed or migrated.

### New development and verified controls

- **Real model parity gating (partial; no live proof):** 'ffo-capture-parity-643.mjs' tests strict authenticated real browser/server observation, same player/game/position/source timestamp/FFL version, source SHA-256 fingerprints and a fresh pregame witness. A source-level synthetic test alone cannot activate capture. No new D1 writes or cron.
- **Official stat correction handling (research-only):** staged migration 'accuracy-migrations/0002_final_correction_revisions.sql' adds the fourth accuracy-only table and two UPDATE/DELETE immutability triggers. The original final certificate stays revision zero forever. 'ffo-msf-final-corrections-643.mjs' requires a truly certified revised MSF player/game score, server-observed correction provenance, a prior certified D1 result and a monotonic compare-and-append statement. Existing live D1 is **still three tables/six triggers**; proposed upgrade is **four/eight** but NOT migrated.
- **SQLite verification:** [CI #42331701058](https://github.com/Kodiak907/dirty-birds-sleeper-feed/actions/runs/42331701058) passed an offline Python SQLite test of the actual 0001 + draft 0002 migrations, first/second revisions, failed concurrent/incorrect writes, immutable triggers and unchanged source certificate.
- **Accuracy reader:** 'ffo-accuracy-correction-view-643.mjs' validates full ordered revision chains. An invalid chain withholds that player/game rather than using a stale original score. 'ffo-accuracy-dashboard-640.mjs' now supports revision-aware *read-only research* metrics while explicitly reporting when the migration or correction-feed verification is unavailable; no live public endpoint.
- **Accuracy screen component:** 'ffo-accuracy-ui-643.mjs' provides server-authenticated-only display logic for MAE, RMSE, bias, position/week/player samples, exclusions, honest 'Not measurable yet' and no false scoring/correction freshness claim. Component is **not mounted or publicly routed**.
- **Dedicated Worker health future compatibility:** health code in this isolated branch accepts 3/6 original or correctly verified 4/8 revision schema, refusing inconsistent partial migration; it continues to expose only GET /health and 404 for /records. Existing live Worker remains unchanged.
- **Historical matchup truth labels:** recorded Sleeper historical matchup scores are explicitly labeled league-reported, NOT independently MSF-certified FFL actuals; they still cannot enter the Accuracy Lab. No roster/scoring settings modified.
- **Local Chromium/browser source suite:** [CI #42332228239](https://github.com/Kodiak907/dirty-birds-sleeper-feed/actions/runs/42332228239) succeeded after the historical-source label fixes, alongside Start/Sit week and exact ten-slot reconciliation regression tests.
- **Credential-free internal feed path:** 'ffo-msf-trusted-read-643.mjs' can use the existing private 'GAMECAST_INTERNAL' Cloudflare service binding when available rather than copying the MSF key. The remote wrapped HTTP status must also be 200 and the MSF payload must pass strict normalization. This path is only unit-tested with fixtures; **no live provider session proven**.

### Existing-service read-only investigations

- [Pages project metadata CI #42331857737](https://github.com/Kodiak907/dirty-birds-sleeper-feed/actions/runs/42331857737) authenticated successfully (HTTP 200) using the preexisting Pages CI token. The returned Pages project deployment-config metadata did **not** list 'MSF_API_KEY' in either reported environment. This finding does **not** establish that the separate internal GameCast Worker lacks a licensed key.
- [GameCast Worker settings metadata CI #42332283380](https://github.com/Kodiak907/dirty-birds-sleeper-feed/actions/runs/42332283380) returned **HTTP 403**. That existing token cannot inspect the Worker script's bindings through this route. No values, source content or provider records were read; the presence of the GameCast Worker/MSF binding is still **unverified** by this test.
- All remote diagnostics required positively confirmed US egress before an external request. No TinyFish, paid browser sessions, new token, secret value copy, public endpoint or infrastructure mutation.

### Still required before one PFO 6.43 protected-preview release

Licensed MSF data physically received and verified through an existing authorized internal runtime, a true displayed PFO browser/server same-asof forecast comparison for all position paths, verified actual game/player/play-by-play categories and 50+ touchdown bonus semantics, completed kickoff capture scheduler and original/duplicate D1 write smoke, official correction-feed proof, read-only authenticated Accuracy UI wired privately, full cross-tool trade/waiver/start-sit/overview/GameCast performance and functional QA, live protected Preview version parity, real iPhone Safari verification, and Commissioner/public-demo/data isolation diff. **Current upgrade not released.** No MSF credential or API key should be pasted into chat.

## PFO 6.43 resumed operations — November 7, 2026 PT

**Release remains NOT READY. No protected-preview deploy or D1 migration.** Draft PR #5 is open and unmerged. This fourth engineering round focused on immutable prediction provenance, corrected final-score integrity and FFL touchdown bonus safety.

### Engineering changes staged

- Added `ffo-guarded-pregame-643.mjs` and regression tests. A **future** scheduled Worker must identify its dedicated `PFO_ACCURACY_DB`, pass a verified 15–30-minute pre-kickoff window, and provide real protected-PFO browser/server SAME-model/SAME-source parity evidence before it can construct an immutable forecast INSERT. A source-level unit test or missing witness cannot write. Existing generic 6.38 research helper is not a production authorization path; no Worker cron, browser write endpoint or real forecasts were activated.
- Hardened `ffo-accuracy-dashboard-640.mjs` to **withhold all error metrics** when raw ledger queries hit their safety LIMIT or contain malformed primary records; these conditions previously risked reporting a biased subset. Research dashboard now counts only pregame forecasts carrying the exact verified live-parity witness written by the guarded 6.43 capture path. Older archived/unattested forecasts are explicitly excluded rather than silently accepted for measured 6.43 accuracy.
- Added `ffo-long-td-policy-643.mjs` and integrated its gate into both independent historical and 6.39 final-score certificate paths. A 50+ yard TD with overlapping 40+ thresholds cannot certify while the **actual Commissioner/Sleeper FFL stacking policy** is unadjudicated. When future independent MSF PBP and official scoring semantics prove one interpretation, the engine handles highest-tier-only vs additive correctly. Current frozen FFL scoring weights were **not changed**.
- Git SHA-1 blob of the EXACT full official FFL JSON is pinned in branch-only CI: `0e61cbe05f83419834c5d6619edd5ffbac5b2013`; any changed scoring bytes block deployment QA until reviewed. Contract version remains `2026-11-05-ffl-screen-recording-verified-v4`.
- New and existing Node tests cover guarded D1 writes, no-parity refusal, no-status/no-kickoff failures, first-write immutability, corrupt/truncated record blocking, source witnesses, disputed 50+ TD bonus candidates, and 6.39 certifier fail-closed behavior. These are synthetic/isolated, NOT live MSF scoring proof.

### Environment and acceptance

The latest source-level CI pass and the Playwright browser regression should be checked at the branch head before any promotion. Browser QA does not equal real iPhone acceptance. Official game/provider coverage, pregame cron activation and authenticated dashboard routing remain unproven and disabled. The independent Worker still exposes only GET /health; live Accuracy D1 remains at the existing unmodified 3-table/6-trigger schema. The draft 0002 migration is offline-only.

**Known blocker:** GitHub Actions pfo-preview lacks MSF_API_KEY; Pages metadata did not show the secret name; GameCast Worker binding metadata check received HTTP 403. None proves the separately running licensed internal GameCast has lost access. A real trusted internal feed and authenticated same-asof PFO browser/server comparison remain necessary before any live prediction capture. Do not copy secrets, buy automation or use TinyFish to compensate.

**Next concrete gate:** establish provider proof through an existing authorized server-side Cloudflare binding or verify exact missing scope, then implement a real private same-source PFO browser/server comparison for QB/RB/WR/TE/K/DEF. Only then enable an audited scheduled capture and independent final-certificate pipeline. Finish cross-tool and real iPhone QA before the ONE protected-preview 6.43 release. Commissioner D1, public demo, production and FFOI remain segregated.

## November 7 evidence addendum: official Sleeper touchdown stacking

Sleeper HQ's September 17, 2026 [official What Stacks? guidance](https://support.sleeper.com/en/articles/3186339-what-stacks) explicitly confirms that **40+ and 50+ passing-TD bonuses add together**. Given the already-verified frozen FFL +1/+2 weights, a separately MSF-PBP-certified 50+ PASSING touchdown receives **+3 incremental long-TD bonus**. This is a platform scoring semantics clarification, NOT a scoring-settings change.

The tested 6.43 certificate now rejects highest-tier-only passing TD values and still requires fully verified inclusive 40+/50+ event proof before certifying any actual player score. **Receiving/rushing 50+ TD source semantics remain separately gated** because the published official example explicitly covers passing. See `PFO_643_SLEEPER_LONG_TD_SEMANTICS_EVIDENCE.md`. Do not modify the frozen original scoring JSON silently or use Sleeper fantasy point totals as score truth.

The latest full no-deploy browser regression after GameCast dependency and Overview ten-slot fixes passed [Action #42455199757](https://github.com/Kodiak907/dirty-birds-sleeper-feed/actions/runs/42455199757). This establishes isolated Chromium fixture behavior, NOT live Cloudflare or real iPhone success.

**Release still BLOCKED** by real licensed MSF server evidence, same-asof displayed PFO parity, actual timed captures, corrected final game certificates, fully authenticated private UI, cross-tool QA and protected preview/iPhone/isolation gates.
