# PFO 5.9.4 Preview-only Cloudflare trigger — 2026-10-28

One-time trigger for existing Cloudflare Git-connected staging Worker build. The build command temporarily runs `node ci_pages_59_preview.mjs` in the `gamecast` directory. The deploy command is a harmless echo, so the Worker itself must not redeploy.

The uploader pins the QA-passed PFO commit `42c9cafd2594b986ae695c2643e5d5e1a469376a`, includes FFO's mobile-navigation files, and targets **Cloudflare Pages project dirtybirdstest, Preview branch pfo-thursday-staging only**. No Pages production/main, D1/R2, protected Commissioner evidence, Sleeper transactions, or secrets may be modified.

After the Pages upload has finished, restore Worker Build = None and Deploy = `npx wrangler deploy` and verify the actual Pages Preview deployment separately.
