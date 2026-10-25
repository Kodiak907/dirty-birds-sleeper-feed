// Dirty Birds read-only source monitor. Deploy as a separate Cloudflare Worker.
// Checks availability, not proof of player IR activation or new report publication.
const SOURCES = [
  ["fast_sleeper", "https://raw.githubusercontent.com/Kodiak907/dirty-birds-sleeper-feed/main/data/fast_latest.json"],
  ["hourly_sleeper", "https://raw.githubusercontent.com/Kodiak907/dirty-birds-sleeper-feed/main/data/latest.json"],
  ["official_nfl_injuries", "https://www.nfl.com/injuries/"],
  ["espn_injuries", "https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries"]
];
async function inspect(name, url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "application/json,text/html" }, cf: { cacheTtl: 0 } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const body = await response.text();
    if (!body || body.length < 10) throw new Error("Empty response");
    let source_timestamp = null;
    if (url.endsWith(".json")) {
      const value = JSON.parse(body);
      source_timestamp = value.fetched_at_utc ?? value.generated_at ?? value.updated_at ?? value.timestamp ?? null;
    }
    return { name, ok: true, source_timestamp, checked_at: new Date().toISOString() };
  } catch (error) {
    return { name, ok: false, checked_at: new Date().toISOString(), error: String(error.message || error) };
  } finally { clearTimeout(timeout); }
}
async function run(env) {
  const checks = await Promise.all(SOURCES.map(([name,url]) => inspect(name,url)));
  const result = { checked_at: new Date().toISOString(), checks, meaning: "Connectivity checks only. Does not verify player IR activations or publish GitHub reports." };
  if (env.MONITOR_KV) await env.MONITOR_KV.put("last_check", JSON.stringify(result), { expirationTtl: 86400 });
  return result;
}
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(run(env)); },
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === "/health") {
      if (!env.MONITOR_KV) return Response.json({ ok: false, message: "MONITOR_KV binding missing; scheduled checks still run but results are not persisted" }, {status: 503});
      const record = await env.MONITOR_KV.get("last_check", "json");
      return Response.json(record || { ok: false, message: "No scheduled check stored yet" }, { headers: { "cache-control": "no-store" } });
    }
    return new Response("Dirty Birds monitoring Worker", {status:200});
  }
};
