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
