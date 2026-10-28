# FFO PFO Live Data Source Contract — Coach Directive, October 28, 2026

## Hard requirement for tomorrow's October 29 Packers–Panthers test
1. MySportsFeeds (via the existing private `/api/ffo/gamecast/` Cloudflare gateway) is the **primary and only live input to the GameCast scoring test**. Use licensed live game stats, boxscore, player gamelogs and play-by-play. A provider auth/entitlement failure is a failure to surface, not a reason to silently switch feeds.
2. FFO owns and applies the complete 2026 FFL rulebook from `FFO_FFL_SCORING_V1.json` to independently calculate fantasy points. **Never use Sleeper player/fantasy scores as the source or as an arithmetic input.**
3. Sleeper remains authorized for league roster/player ownership mapping, lineup/start assignments, league transactions, waivers and FAAB. Sleeper's separately published final score may be examined **only to validate FFO's independent output after calculation**, highlighting discrepancies.
4. NFL and teams provide official verification and injury facts. ESPN provides secondary verification/research **only, not live feed replacement or a separate ESPN-powered live matchup board**.
5. The primary UI is the already existing PFO `GameCast` tab and relevant player intelligence panels, **not a new standalone matchup board**. Retain Stadium GameCast, team roster/trade/waiver workflows.
6. **Do not infer completeness from a successful provider HTTP response.** MSF historical Week 7 play-by-play returned HTTP 200 for selected games in the October 27 audit, but tomorrow's real-time latency, per-game coverage and 100% FFL scoring categories have NOT yet been demonstrated.
7. Exact FFL scoring involves long-touchdown bonuses, kicker distance categories, defensive/ST plays, turnovers and corrections. If an event or stat isn't unambiguously available in MSF, report **provisional** FFO points with missing categories and provider provenance; never show a fabricated zero or certified final.
8. First validation targets on DeeboSix0's Sleeper roster: Chuba Hubbard (CAR RB) and Christian Watson (GB WR), subject to actual lineup/activity. Validate per event, per scoring category, date/timestamp, and compare independently calculated values with Sleeper secondarily.
9. Tests `qa-ffo-msf.test.mjs` and the `pfo-59-qa.yml` workflow enforce frozen rules, MSF-only primary GameCast, no ESPN scoring endpoint, stable play parsing and source boundaries.
10. This code is on the **development branch**, and has **not yet been confirmed deployed to protected Cloudflare Preview**. The live Pages preview remains an independent acceptance gate. Do not claim Tomorrow readiness without a real authenticated MSF gateway check.

**Coach's wording:** We are testing the real-time live features of MySportsFeeds. FFO must independently calculate scores now—not 'eventually.'
