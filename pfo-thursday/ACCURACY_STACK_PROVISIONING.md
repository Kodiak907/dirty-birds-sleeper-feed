# PFO 6.38–6.42 accuracy lab — isolated infrastructure and release gates

**Status: staged in GitHub; not enabled on the current private preview.**
The live Pages application currently binds a D1 database named \`COMMISSIONER_DB\`.
It MUST NOT be used for accuracy snapshots, final game certificates or metrics.

## Provision before enabling automatic capture

1. Create an independent Cloudflare D1 database named \`pfo-accuracy-lab\`, under the authorized account. Record the actual database ID; never invent an ID or reuse the Commissioner DB.
2. Apply \`accuracy-migrations/0001_accuracy_ledger.sql\` to **that database only** and verify append-only triggers, indexes and constraints.
3. Configure an isolated worker with \`PFO_ACCURACY_DB\` bound to the new D1 ID. Require Cloudflare Access plus a separate read-only audit token for any exposed reporting endpoint; never expose raw projections, member roster records or provider tokens.
4. Bind verified MSF schedule and final-game evidence adapters; bind a first-party PFO forecast adapter that emits the **same independently calculated projections shown in PFO 6.36**. Do not treat a new or independently reimplemented predictor as the same model without parity tests.
5. Schedule capture at least 15 minutes before each verified kickoff (including non-Sunday games) using a five-minute trigger; archive the **first eligible version** per player and game. Run a final score certification pass only after MSF final boxscores, event bonuses and stat corrections are verified.
6. Run the 6.38–6.42 QA workflow; preview deployment remains blocked until dedicated D1 and real adapters are verified. The public demo, production and Commissioner records must not be changed during testing.

## Non-negotiable safeguards

- Sleeper supplies player IDs and roster transactions only, not projected or historical fantasy points.
- The restored FFL scoring version is \`2026-11-05-ffl-screen-recording-verified-v4\`.
- Field-goal scoring requires verified distance; a generic made field goal has no fantasy point base.
- Three-and-outs, 4th-down stops and 40+ non-TD rushes award zero FFL points.
- Prediction timestamps are stamped on the server; a browser-provided timestamp cannot prove pregame eligibility.
- No dataset with unverified historical predictions or final game scores is permitted to produce a claimed MAE, RMSE or accuracy percentage.
- No candidate model is promoted until it beats the frozen baseline on held-out, verified, same-rule examples with adequate samples **for every relevant position**.
- A rollout is not complete until feature and mobile regression QA pass and Coach can see the metrics in the authenticated preview.

## Current blocker

There is no provisioned dedicated \`PFO_ACCURACY_DB\` binding in the existing Pages configuration and no server-side verified replica of the current browser projection calculation. Until those exist, automated capture, real accuracy measurement, model promotion and the live dashboard are NOT operational. Static code, unit QA and transparent readiness reports can still be completed and reviewed.
