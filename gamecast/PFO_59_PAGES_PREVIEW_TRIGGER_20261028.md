# FFO PFO 5.9 One-time Pages Preview upload trigger

This commit triggers the existing Cloudflare Git-connected build for the **ffo-gamecast-staging** branch.

Cloudflare build command temporarily set to `node ci_pages_59_preview.mjs`.
Cloudflare deploy command temporarily set to a harmless echo. No Worker source/production deployment is authorized.
The uploader pins immutable PFO source commit `0d47f3e30ff0597eb54cf46c112471956c08ff8d`, targets Cloudflare Pages project `dirtybirdstest`, `--branch pfo-thursday-staging`.
No main branch, production Pages, Sleeper transactions, Commissioner D1, R2, or secrets should be changed.
After upload, restore Worker Build command to None and Deploy command to `npx wrangler deploy`.
