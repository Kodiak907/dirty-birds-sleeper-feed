# FFO 5.7 Commissioner Command protected staging-only upload

Coach authorized this single preview release. Uploader `node ci_pages_stadium_http.mjs` fetches GitHub source immutable commit `3d01a0c1923612e8007a6b7d0fb4a4acb2da1139` (11 files) and uploads ONLY `dirtybirdstest` Cloudflare Pages `pfo-thursday-staging` preview branch. Production Pages/main untouched. Retains all existing PFO 5.7 Player QuickView, stadium GameCast, Opportunity Radar, Trade Analyzer, Waivers, Injury Watch, Briefings, Championship, and approved swipeable stat rail. Adds FFO Commissioner private case-linked D1 score ledger, append-only reversals, independent Sleeper score verification and receipt generation. Official Sleeper score changes are NEVER executed by the app.

Restore Worker `ffo-gamecast-api-staging` Git Build command to None after this build; preserve deploy `npx wrangler deploy` and other settings.
