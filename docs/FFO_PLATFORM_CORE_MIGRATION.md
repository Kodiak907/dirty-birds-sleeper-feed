# FFO Platform: phased migration from PFO to a first-party fantasy league

Status: architecture directive, **not** an assertion that any later phase is implemented.
Owner: FFO; November 4, 2026.

## North star

FFO will own end-to-end league creation, Commissioner configuration, member identity,
drafts, roster and lineup state, trades, waivers, FAAB, scheduling, scoring, standings,
playoffs, and audit records. PFO is the initial single-manager proving ground.
External fantasy apps, including Sleeper, must not remain permanent infrastructure.

## Current boundary (implemented)

- PFO presently consumes Sleeper as a **temporary read-only** source for
  team ownership, roster/player IDs, league settings, submitted lineups,
  transactions, FAAB, and legacy league schedule.
- Independent MySportsFeeds (MSF) NFL statistical evidence and frozen FFL rules
  underpin provisional FFO model estimates. No Sleeper fantasy point feed is
  permitted to certify scoring. Missing evidence stays **unknown**, not zero.
- Trade Intelligence 6.0, Trade Finder 6.1, and Waiver Decision Desk 6.1
  operate read-only and never submit transactions.
- 6.1 algorithms take normalized roster objects, player identity objects,
  independently calculated FFL estimates, and lineup slots. They do **not**
  fetch data or require Sleeper-specific scoring endpoints.
- The current PFO client assumes Coach's roster ID '1'; that assumption must be
  replaced with authenticated manager context before enabling general membership.
- FFOI is a distinct, source-verified intelligence provider. Its future API is an
  optional source of information, not a dependency for league ownership.

## First-party platform architecture (future milestones)

1. **Core league database and authenticated identities**
   - Immutable league, season, user, membership, team, roster and player keys.
   - Commissioner / manager / spectator roles enforced server-side.
   - All API requests are scoped by authenticated manager and league ID;
     never trust browser-selected roster IDs as an authorization boundary.
   - Tenant separation, encrypted secrets, restore procedures, and immutable
     privileged-action audit log.
2. **First-party league-rule registry and independent scoring**
   - Versioned FFO scoring rules with frozen effective dates and precise category
     semantics, including long-distance bonuses, K and D/ST, and penalty-nullified events.
   - Verified stat correction replay with idempotent event ledger and adjustment audit.
   - League penalty rules are versioned and adjudicated; Commissioners alone may
     apply authorized score corrections with case number and evidence.
   - Do not seed standings, prediction training, or championship probabilities
     with incomplete or uncertified scores.
3. **First-party roster and competition engine**
   - League schedule, valid positions, lock policy, BYEs, IR/reserve, player ownership,
     accepted lineup snapshots, playoff seeding, waiver claims, FAAB and trade rules.
   - Roster and budget changes are transactional; duplicate submissions are idempotent.
   - Explicit state transitions for proposed, accepted, rejected, expired and processed.
   - Notifications disclose verified timestamps and never imply a transaction has
     processed until the authoritative engine records it.
4. **League-wide, personalized PFO**
   - Dynamic manager identity replaces the temporary fixed Coach roster assumption.
   - Reuse the Trade Finder and Waiver Decision Desk with the first-party ownership
     adapter, retaining player/news/scoring source provenance.
   - Enforce per-league permissions for trades, news, rosters and Commissioner records.
   - Store lightweight, short-lived research caches by league, team, rules version,
     roster snapshot version, statistical evidence version and expiration timestamp.
   - Invalidate caches after finalized transactions, roster adjustments, rule updates
     and verified statistic corrections; never reuse another manager's private state.
5. **FFO-owned draft experience**
   - League lobby; picks and board; keeper and dynasty variants; team needs; queue;
     live player eligibility; draft clock; autopick rules with clear consent.
   - Server-authoritative and idempotent pick recording with clock/reconnect recovery.
   - Commissioner-pause and pick-correction audit; no duplicate drafted ownership.
   - The same verified PFO scouting/waiver/trade intelligence is accessible during
     the draft; draft insights cannot mutate picks.
6. **Retire Sleeper only after parity testing**
   - Shadow-run first-party rosters, lineups, transactions, waivers, scoring, standings
     and draft state against accepted snapshots; document discrepancies.
   - Import and reconcile league history with recorded provenance and consent.
   - Verify multi-manager access, concurrency, scoring and correction cases,
     Commissioner audit, backups, rollback, and privacy before cutover.
   - Remove the temporary Sleeper integration after the first-party system meets
     the required parity tests; not before.

## APIs to design before member rollout

- GET /leagues/{leagueId}/teams/{teamId}/roster
- GET /leagues/{leagueId}/snapshots/{version}
- GET /leagues/{leagueId}/rules/{version}
- GET /leagues/{leagueId}/market/research?team={teamId}
- POST /leagues/{leagueId}/trades (authenticated; server-validated)
- POST /leagues/{leagueId}/waivers (authenticated; server-validated)
- GET /leagues/{leagueId}/drafts/{draftId}/state
- POST /leagues/{leagueId}/drafts/{draftId}/picks (authenticated; idempotent)

These are proposed contracts, **not deployed endpoints**. Detailed auth, rate
limits, validation, transactions, and storage designs must be reviewed before
implementation.

## Safety, licensing and release requirements

- Protect all existing production and Commissioner records; use protected Preview,
  automated tests, controlled migrations, and rollback.
- Confirm that any paid statistics/news license permits the planned number of
  league members, derived-data presentation, and eventual multi-league use
  **before** expanding beyond its currently authorized private usage.
- Preserve sources, timestamps, correction history, and unknown values.
- Maintain Pacific Time for user-visible league deadlines, storing UTC internally.
- No manager receives automatic unsolicited start/sit commands; research is advisory,
  and the final decision is always the manager's.
- No AI-generated acceptance odds, waiver availability, health status, playoff
  probabilities, or certified scoring without adequate evidence.
