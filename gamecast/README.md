# FFO GameCast - staging diagnostic
This directory is **isolated** from the production Dirty Birds monitoring Worker and PFO Pages site.
Branch: `ffo-gamecast-staging`. Never merge this branch into `main` as-is.

## Cloudflare Workers Builds
Existing Worker: `ffo-gamecast-api-staging`
Repository: `Kodiak907/dirty-birds-sleeper-feed`
Production branch for this specific staging Worker: `ffo-gamecast-staging`
**Root directory:** `gamecast`
Deploy command: `npx wrangler deploy` (no build command required).

This folder contains its own `wrangler.jsonc` with the exact Worker name.
It does **not** use the root Wrangler configuration that deploys `dirty-birds-monitor-git`.

## Secrets — Cloudflare Settings > Variables and Secrets
- `MSF_API_KEY`: MySportsFeeds API token; use a rotated token if possible.
- `FFO_PROBE_PASSWORD`: independent strong diagnostic password.
Both must be Secret values. Never commit them to GitHub.
No credentials are currently present in this source.

## After deploying
GET /api/status returns `version: staging-github-0.1` and whether secrets are configured.
POST /api/check with JSON `{"feed":"season"}` and header `x-ffo-probe-password` verifies live API reachability and shows only response metadata, not licensed data.
Expected HTTP 200 for a successful auth and valid endpoint. Other upstream codes (401/403/404/204/304) are surfaced safely.
This does not prove the 15-20-second latency target, detailed stats, or PFO integration.
