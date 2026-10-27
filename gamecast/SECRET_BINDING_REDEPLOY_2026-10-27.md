# FFO GameCast staging redeploy

Triggered by Coach's confirmation that MSF_API_KEY and FFO_PROBE_PASSWORD are stored as encrypted Cloudflare Worker secrets. This commit contains no credentials or configuration changes; its purpose is to trigger the existing staging-only GitHub deployment pipeline. Expected post-deployment endpoint: /api/status.
