# FFO PFO 5.9.6 — Coach's October 28 acceptance changes
**Status:** Development branch only; not approved for protected Cloudflare Preview deployment, production, or a live Commissioner/FFL change.
**Source branch:** \`pfo-59-commissioner-ui-20261028\`, based on protected \`pfo-thursday-staging\`. All writes in this change set were code and test commits to the development branch.

## Coach-required changes implemented in development source

1. **Trade Command freeze:** \`ffo-pfo-59.js\` caches trade player forecast lookups and incrementally updates picks, comparison button and counts without building all roster DOM per tap. Partner selection no longer synchronously invokes expensive legacy Trade Laboratory render. \`ffo-pfo-core.js\` prevents that laboratory's redraw until its disclosure is expanded; opening the disclosure explicitly hydrates it. Keep one 3-for-3 research evaluator; no actual offers.
2. **Team HQ → News & Intel:** Replaced the former four shortcut buttons with the \`ffo-pfo-596.js\` newsroom. Its articles are matched to actual Dirty Birds roster names. Editorial items come from the ESPN NFL news feed, verified club roster actions from the saved \`NFL_ROSTER_ACTIONS.json\`, and NFL/ESPN injury reports and verified NFL schedule byes from the existing source interfaces. Each item shows athlete, event, date, publisher and HTTPS source link. Missing feeds are declared; articles are not invented. ESPN is editorial research only; no ESPN GameCast or scoring.
3. **Overview:** Preserved the Morning/Pregame/Postgame modes, condensed them to three actionable sourced sections, and suppressed duplicate buttons to Injury Watch / Radar / Market / Ask on Overview. Live inactives and current source freshness remain accessible; dedicated navigation remains intact.
4. **Weekly Matchup BYE:** Added distinct text \`BYE\` to player lineup rows and roster pills for independently verified team bye weeks. \`pfo52Points\` returns null, never positive points or an invented zero. During schedule retrieval for an unverified future week, forecast is withheld instead of falsely displaying a playing-week projection.
5. **Championship:** Preserved 100,000-trial playoff/title odds and the archived model, but displays all current Dirty Birds position-eligible players together for Weeks 15–17 without suggesting current bench/starter status forecasts the playoff lineup. Bye rows are marked.
6. **Injury Watch:** A successful NFL report with no matched listed injury is displayed as \`NOT LISTED · NFL report checked\` with checked timestamp, report link and explicit warning that this is not game-day clearance; an unavailable source is labeled \`STATUS UNVERIFIED\`. Ollie Gordon II had no listed injury in the published October 28 Week 8 Patriots-Dolphins official practice report, but there is no automatic guarantee he will play. See official club Week 8 source: https://www.patriots.com/news/week-8-injury-report-patriots-at-dolphins-x9227.

## Verification / release blockers

- GitHub Actions workflow \`.github/workflows/pfo-59-qa.yml\` includes \`node --test pfo-thursday/qa-596.test.mjs\`, frozen FFO scoring & MySportsFeeds regression, and isolated Playwright mobile viewport browser smoke. Latest full suite after change set must be checked before release.
- Existing Cloudflare Access-protected Preview remains unchanged. The protected Preview and Commissioner status were unauthenticated-login-required during the earlier perimeter check. A development GitHub commit or mocked CI test **is not a deployment or iOS Safari E2E verification**.
- Authenticated real-iPhone testing needs cold load, repeated Trades switching and 3-for-3 selections, Team News current articles, Overview mode changes, a known NFL BYE week, Championship unified player list, official Ollie injury row with source timestamp, preserved Commissioner PIN and existing D1/R2 records.
- Never release to new unprotected Pages aliases, deploy using the obsolete uploader pinned to immutable 5.8.1, expose MySportsFeeds credentials, or mutate Sleeper/FFL/Commissioner actions without Coach approval.

LONG LIVE THE FUCKERY.
