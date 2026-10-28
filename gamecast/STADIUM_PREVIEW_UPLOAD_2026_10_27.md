# FFO GameCast Stadium v1 — staging-only preview upload trigger

Date: 2026-10-27 (Pacific)

Requested by Coach: publish the protected `dirtybirdstest` Pages preview branch `pfo-thursday-staging` containing these committed files:
- `pfo-thursday/ffo-gamecast-stadium.mjs`
- `pfo-thursday/ffo-gamecast-stadium.css`
- `pfo-thursday/ffo-gamecast.js`

This note intentionally changes **no worker code, runtime behavior, or production `main`**. Its sole purpose is to trigger the existing isolated Cloudflare staging Git build. The Cloudflare Worker `ffo-gamecast-api-staging` now has a temporary build command `node ci_pages_preview.mjs`; that script fetches the latest PFO preview branch and uses the encrypted, scoped Pages token to upload **only** the Cloudflare Pages preview branch. Never merge `pfo-thursday-staging` into `ffo-gamecast-staging` to deploy a preview.

QA checkpoint: verify preview deployment reports success, verify both new static files are served, and verify GameCast functionality and existing stat scroll. Restore the Worker Git Build command to empty after successful upload.
