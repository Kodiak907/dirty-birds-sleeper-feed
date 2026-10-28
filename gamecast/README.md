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

## Verification checkpoint — October 27, 2026
Cloudflare MySportsFeeds current-season route has been verified HTTP 200 using subscription credentials. Runtime secrets are present, GameCast staging status returns true/true. Additional NFL feed entitlement audit is pending; do not mistake this for fully live play-by-play or integrated PFO deployment. This README update triggers a one-time redacted CI feed audit on the isolated `ffo-gamecast-staging` branch.

## Thursday protected PFO preview
2026-10-27: Trigger staging-only Cloudflare Pages PREVIEW deployment from pfo-thursday-staging source into dirtybirdstest project via isolated GameCast staging CI. Pages production branch main is not modified by this script. Review build logs before promotion.

## Preview upload retry (Pages-scoped token)
The 2026-10-27 preview build now uses PFO_PAGES_DEPLOY_TOKEN (Account Pages Edit, 7-day) only inside the `wrangler pages deploy` subprocess, targeting project dirtybirdstest branch pfo-thursday-staging. Does NOT deploy Pages production/main.

2026-10-27: Re-upload Pages preview after configuring preview-only GAMECAST_INTERNAL service binding and FFO_GAMECAST_ENABLED=true. Production Pages remains untouched.
