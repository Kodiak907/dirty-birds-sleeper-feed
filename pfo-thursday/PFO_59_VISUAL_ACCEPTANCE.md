# FFO PFO 5.9 — Coach visual reference / acceptance plan
Date: 2026-10-28 Pacific. Status: DEVELOPMENT BRANCH ONLY. **Not a deployed/accepted Pages Preview release.**
Branch: `pfo-59-commissioner-ui-20261028` off `pfo-thursday-staging`.
Private user videos were reviewed locally. **Do not upload screen recordings to public GitHub.**

## Coach's source-of-truth UX requirements
- ScreenRecording_10-28-2026 09-19-20_1.mp4: compact player search and browsing, All/position player lists, trending/leaders, player profile sheets, trade-block and trade-proposal workflow. Interaction reference only; preserve distinctive FFO design.
- ScreenRecording_10-28-2026 09-21-45_1.mp4: Dirty Birds team context, roster, week-by-week schedule, transaction history and news/league navigation. Team HQ should feel like one cohesive team screen.
- ScreenRecording_10-28-2026 09-22-59_1.mp4: concise side-by-side matchup Overview with role leaders. **Coach explicitly instructed that existing Matchup remain unchanged for now.**

## Implementation commits on this development branch
- Market home now opens dedicated Trade, Waiver and Transactions workspaces. Original Trade Laboratory and existing waiver intelligence remain in their destination sections; FAAB ledger resides in Transactions.
- Waiver board uses compact tappable position rows and FFO QuickView, per-manager chooser, position filter, search and independently published model leader chips. Owner-specific rank considers source-known depth and, where enough model samples exist, starter projected PPG relative to league mean.
- Trade partner chooser displays league owners and links to existing read-only trade laboratory. Roster #3 (Boyle) remains view-only, never a trade proposal target. Independently published two-sided scenario screens remain clearly distinct from real offers.
- Roster becomes Team HQ with Roster & Tester / Schedule / Transactions / News & Intel sections. The original submitted lineup, bench/IR, model and lineup tester remain intact. Weekly pairings are sourced from Sleeper; absent pairings are marked unverified.
- Player QuickView preserved with existing independently sourced summary, game log, usage, health and research tabs; now opens from compact waiver results.
- Commissioner Log is the new label for case actions, with general administration category and optional team, manager and consequence. Existing D1 case records remain immutable and unchanged.
- Commissioner Log is isolated from Score Adjustments, Score Audit and Toolbox. Existing point deductions are an FFO private ledger, not Sleeper changes.
- Evidence entry creation permits optional multi-file upload after a case has been created; existing case files can upload too. Approved media: JPEG/PNG/WebP/HEIC/HEIF, PDF (8 MiB/file); MP4/MOV/WebM (75 MiB/file). Client and Worker both enforce MIME and size; Worker verifies magic bytes and stores privately in R2 with digest and D1 metadata.
- Commissioner event and evidence submission guards prevent duplicate submits and no longer synchronously wait on full case redraw. Upload progress is nonblocking; post-save refresh occurs asynchronously.

## Important limitations to resolve before release
1. **Not a complete NFL player pool:** `data/player_names.json` currently includes a partial directory (282 entries at inspection); available list is only those not owned in published Sleeper snapshot. Never advertise it as every NFL player or verified waiver clearance. Build/cache a complete eligible directory, validated ownership, and paginated query before acceptance.
2. **Leader rankings currently model-based**, not a universal verified season points leaderboard. Publish source-backed league/NFL season performance leaderboards and filters before acceptance.
3. **Personalized needs are advisory/provisional**, based on roster depth and source-covered model PPG (only where adequate coverage). Expand with weekly positional production, byes, health, roster legality, transaction constraints and scored replacement value.
4. **Trading is research-only.** Do not submit proposals. Extend player selector UX and trade-block flows to video-level compact navigation with explicit two-sided comparisons, respecting Boyle exclusion.
5. **Team News & Intel section currently links existing source-backed tools**, not a newly built separate chronological news feed. Do not claim the new feed is complete.
6. **No Cloudflare live staging deploy verified.** GitHub commit and Worker parse do not establish Pages Preview release.
7. **Commissioner evidence needs actual Access+PIN, iOS Safari and R2/D1 E2E testing**, including 5MB picture, 30–60MB MOV/MP4, allowed/blocked formats, failed network, duplicate taps, revisit case, download with correct filename, 20-minute session expiry and clean navigation.
8. **Performance:** measure iPhone cold-start, market switching, roster switching, returning from QuickView and Commissioner post-save, with timings before promising 'instant.'
9. Preserve gamecast, independent stats, existing scoring, historical championship odds and horizontally scrolling stat fields, inactives, both league/trade displays, and matchup untouched.
10. **No main / production writes, penalties, notices, lineup changes, trades, claims, FAAB submissions or Sleeper score edits.**

## Acceptance criteria
- On iPhone, entry into Team HQ loads usable Roster & Tester immediately; separate tabs switch without full page reload.
- Schedule displays actual opponent for every week where Sleeper matchup data is available; never invent unknown weeks.
- Market opens distinct screens with working return navigation. All Available defaults to personalized roster needs, with position and free-text filters.
- Tapping a player row opens existing FFO QuickView and returns to the same research state after closing.
- Chosen manager changes waiver priorities and read-only trade scenarios without executing a Sleeper operation.
- Commissioner Log visible only when that subtab is selected; Score Adjustments shows scoring controls and its audit only, never Log forms/entries. The existing case remains unmodified.
- Creating general Log records works without mandatory sanction; can move around app immediately after submitting.
- Evidence can be attached on creation or afterward and reliably re-opened, with server-side authorization and format/size verification.
- Actual Pages Preview URL and /api/commissioner/status checked after build; never treat a green Worker build as Pages release success.

FFO motto: Embrace the Fuckery. Respect the Competition.

## Coach's October 28 Championship-only odds specification — built in development branch
- The Overview page is explicitly **unchanged**. Do not add playoff or title odds to Overview.
- Preserve existing Championship historical odds, existing 100,000-player-score simulations and all Championship player research.
- New `ffo-championship-59.js` and `.css` render a 100,000-trial **full FFL league season/playoff simulation** only inside the Championship tab, with Dirty Birds probabilities for Playoffs, Bye, Reach Championship Final and Win Title plus an expandable twelve-manager comparison.
- Private/front-office static report path: `pfo-thursday/FFO_CHAMPIONSHIP_100K.json`. Data source: actual Sleeper public league records and completed Week 1–7 fantasy scores as of Oct 28, 2026; Sleeper fixture pairings Week 8–14. 100,000 trials, deterministic RNG seed 20261028; six playoff berths, two byes, two finalists and one winner per trial, validated conservation checks.
- **The 100,000 model is historical-scoring-form based**, whereas the archived 10,000 model used position/player forward projections. It is a distinct model, not an increased sample of exactly the earlier distribution. Never imply 100,000 draws alone increased predictive accuracy.
- Static JS checks 15/15 pass (source report dimensions and conservation, no Overview changes, preserved archived Championship + score simulator, browser JS parse). Still needs Cloudflare Pages Preview deployment, private on-device verification and update pipeline for future weeks.
