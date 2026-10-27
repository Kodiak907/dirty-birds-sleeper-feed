// FFO GameCast - isolated Cloudflare staging diagnostic
// Never place MySportsFeeds credentials here. Use Worker encrypted secrets.
const FEEDS = Object.freeze({
  season: "current_season.json",
  games: "current/games.json"
});
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer"
    }
  });
}
function equal(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/status") {
      return json({
        app: "FFO GameCast",
        version: "staging-github-0.1",
        key_configured: !!env.MSF_API_KEY,
        password_configured: !!env.FFO_PROBE_PASSWORD,
        live_verified: false
      });
    }
    if (url.pathname !== "/api/check" || request.method !== "POST") {
      return json({error: "not_found"}, 404);
    }
    if (!env.MSF_API_KEY || !env.FFO_PROBE_PASSWORD) {
      return json({error: "missing_secrets"}, 503);
    }
    if (!equal(request.headers.get("x-ffo-probe-password"), env.FFO_PROBE_PASSWORD)) {
      return json({error: "unauthorized"}, 401);
    }
    let payload;
    try {
      if (Number(request.headers.get("content-length") || 0) > 2048) {
        return json({error: "request_too_large"}, 413);
      }
      payload = await request.json();
    } catch {
      return json({error: "invalid_json"}, 400);
    }
    const feed = typeof payload?.feed === "string" ? payload.feed : "season";
    if (!Object.prototype.hasOwnProperty.call(FEEDS, feed)) {
      return json({error: "unsupported_feed"}, 400);
    }
    const started = Date.now();
    try {
      const response = await fetch(
        "https://api.mysportsfeeds.com/v2.1/pull/nfl/" + FEEDS[feed],
        {
          method: "GET",
          headers: {
            "Authorization": "Basic " + btoa(env.MSF_API_KEY + ":MYSPORTSFEEDS"),
            "Accept": "application/json"
          },
          redirect: "error",
          signal: AbortSignal.timeout(12000)
        }
      );
      const result = {
        feed,
        provider_status: response.status,
        provider_ok: response.ok,
        elapsed_ms: Date.now() - started,
        checked_at: new Date().toISOString(),
        live_update_latency_verified: false
      };
      if (response.ok && response.status !== 204) {
        const data = await response.json();
        result.root_keys = data && typeof data === "object" ? Object.keys(data).slice(0, 16) : [];
      }
      return json(result);
    } catch (error) {
      return json({
        error: "upstream_unreachable_or_non_json",
        category: error?.name === "TimeoutError" ? "timeout" : "upstream_error"
      }, 502);
    }
  }
};