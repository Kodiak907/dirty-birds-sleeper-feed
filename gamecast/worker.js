// FFO GameCast NFL provider diagnostic; isolated staging only. Never commit API keys.
const FEEDS=Object.freeze({season:"current_season.json",games:"2026-regular/games.json",players:"players.json",season_stats:"2026-regular/player_stats_totals.json",injuries:"injuries.json",latest_updates:"2026-regular/latest_updates.json"});
const BASE="https://api.mysportsfeeds.com/v2.1/pull/nfl/";
const HTML="<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>FFO GameCast</title><style>*{box-sizing:border-box}body{background:#0c1524;color:#edf3ff;font:16px system-ui;margin:0;padding:26px 18px}main{max-width:600px;margin:auto}h1{font-size:27px;margin:15px 0 5px}p{line-height:1.5;color:#b5c2d5}label{display:block;margin-top:15px;font-weight:650}input,select,button{width:100%;font:inherit;background:#1b2a42;color:white;padding:13px;border:1px solid #4c617e;border-radius:10px;margin-top:8px}button{background:#2475c4;font-weight:700}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#132036;border:1px solid #3e536c;border-radius:10px;padding:16px}small{color:#adbed0}.tag{font-size:12px;letter-spacing:1px;color:#9dcdf4}</style><main><div class=\"tag\">FFO • GAMECAST • STAGING</div><h1>NFL Feed Diagnostic</h1><p>Private MySportsFeeds connectivity tester. Your API key stays encrypted inside Cloudflare.</p><p id=\"s\">Checking Worker configuration…</p><form id=\"f\"><label for=\"pw\">FFO diagnostic password</label><input id=\"pw\" type=\"password\" autocomplete=\"off\" required placeholder=\"The password you saved in Cloudflare\"><label for=\"feed\">NFL data feed</label><select id=\"feed\"><option value=\"season\">Current season (start here)</option><option value=\"games\">2026 games and scores</option><option value=\"players\">NFL players</option><option value=\"season_stats\">2026 season player statistics</option><option value=\"injuries\">NFL injuries</option><option value=\"latest_updates\">2026 latest updates</option></select><button type=\"submit\" id=\"b\">Test NFL feed</button></form><h2>Provider response</h2><pre id=\"out\">Not tested</pre><small>Reports provider HTTP code and response field names only. This is not yet the player GameCast interface.</small></main><script>const out=document.getElementById('out'),btn=document.getElementById('b');fetch('/api/status',{cache:'no-store'}).then(r=>r.json()).then(v=>document.getElementById('s').textContent='API key: '+(v.key_configured?'connected':'missing')+' • private test: '+(v.password_configured?'ready':'missing')).catch(()=>{});document.getElementById('f').addEventListener('submit',async e=>{e.preventDefault();btn.disabled=true;out.textContent='Testing connection…';try{const r=await fetch('/api/check',{method:'POST',headers:{'content-type':'application/json','x-ffo-probe-password':document.getElementById('pw').value},body:JSON.stringify({feed:document.getElementById('feed').value})});out.textContent=JSON.stringify(await r.json(),null,2)}catch{out.textContent='Gateway request failed'}finally{btn.disabled=false}})</script></html>";
const result=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const eq=(a,b)=>{if(typeof a!=="string"||typeof b!=="string")return false;let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0};
async function checkProvider(env,feed){const start=Date.now();try{const r=await fetch(BASE+FEEDS[feed],{headers:{Authorization:"Basic "+btoa(env.MSF_API_KEY+":MYSPORTSFEEDS"),Accept:"application/json"},redirect:"manual",signal:AbortSignal.timeout(12000)});const obj={feed,provider_http_status:r.status,provider_ok:r.ok && !(r.status>=300 && r.status<400),elapsed_ms:Date.now()-start,checked_at:new Date().toISOString(),live_latency_verified:false};if(r.ok){try{const data=await r.json();obj.root_keys=data&&typeof data==="object"?Object.keys(data).slice(0,20):[];obj.collection_counts=Object.fromEntries(Object.entries(data||{}).filter(([,v])=>Array.isArray(v)).slice(0,10).map(([k,v])=>[k,v.length]))}catch{obj.parse_error=true}}return obj}catch(e){return {feed,error:"provider_request_failed",category:e?.name==="TimeoutError"?"timeout":"upstream",checked_at:new Date().toISOString()}}}
export default {
 async fetch(req,env){const path=new URL(req.url).pathname;
  if(path==="/"&&req.method==="GET")return new Response(HTML,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'"}});
  if(path==="/api/probe"&&req.method==="GET"){
    const cache=caches.default,ck=new Request("https://ffo-gamecast-cache.invalid/probe-v8");
    const hit=await cache.match(ck);if(hit)return hit;
    if(!env.MSF_API_KEY)return result({error:"missing_key"},503);
    const season="2026-2027-regular";
    let completedGameIds=[];
    const headers={Authorization:"Basic "+btoa(env.MSF_API_KEY+":MYSPORTSFEEDS"),Accept:"application/json"};
    async function check(name,route,extractId=false){
      const begun=Date.now();
      try{
        const response=await fetch(BASE+route,{headers,redirect:"manual",signal:AbortSignal.timeout(8500)});
        const row={feed:name,http_status:response.status,ms:Date.now()-begun,redirect:response.status>=300&&response.status<400};
        if(response.ok){
          const obj=await response.json();row.root_keys=Object.keys(obj||{}).slice(0,12);
          if(extractId){const g=Array.isArray(obj?.games)?obj.games:[];
            row.game_count=g.length;completedGameIds=g.filter(x=>/complete|played|final/i.test(String(x.schedule?.playedStatus||x.schedule?.status||x.status||""))).slice(-3).map(x=>x.schedule?.id||x.game?.id||x.id).filter(Boolean);let choose=g.find(x=>String(x.schedule?.playedStatus||x.schedule?.status||x.status||"").toLowerCase().includes("completed"))||g[0];
            row.first_game_id=choose?.schedule?.id||choose?.game?.id||choose?.id||null;row.game_keys=choose?Object.keys(choose).slice(0,10):[];row.schedule_keys=choose?.schedule?Object.keys(choose.schedule).slice(0,16):[];
          }
          if(name==="boxscore"){const x=obj?.scoring||{};row.scoring_keys=Object.keys(x).slice(0,25);row.scoring_play_shapes=(Array.isArray(x.quarters)?x.quarters:[]).map(q=>({q:q.quarterNumber,count:Array.isArray(q.scoringPlays)?q.scoringPlays.length:0,first_keys:Array.isArray(q.scoringPlays)&&q.scoringPlays[0]?Object.keys(q.scoringPlays[0]).slice(0,22):[]}));row.scoring_fields=Object.fromEntries(Object.entries(x).slice(0,12).map(([k,v])=>[k,Array.isArray(v)?{kind:"array",count:v.length,element_keys:v.length&&typeof v[0]==="object"?Object.keys(v[0]).slice(0,12):[]}:v&&typeof v==="object"?{kind:"object",keys:Object.keys(v).slice(0,16)}:{kind:typeof v}]));}if(name==="season"){row.seasons=Array.isArray(obj?.seasons)?obj.seasons.map(x=>({slug:x.season||x.name||x.label||null})).slice(0,2):[];}
        }else {
          if(name.includes("playbyplay")){
            const limited=await response.text().then(x=>x.slice(0,1600)).catch(()=>"");
            row.error_class=/subscription|not subscribed|not authorized|unauthorized|forbidden|permission|access denied|not allowed|not entitled/i.test(limited)?"subscription_or_permission":/invalid|does not exist|not found/i.test(limited)?"invalid_game_or_route":/not ready|no data|no content|not available/i.test(limited)?"feed_not_ready":"undetermined";
            row.error_body_format=/^\\s*</.test(limited)?"html":/^\\s*[{[]/.test(limited)?"json":"text_or_empty";
          }else await response.body?.cancel();
        }
        return row;
      }catch(e){return {feed:name,error:e?.name||"network",ms:Date.now()-begun};}
    }
    const checks=[await check("season","current_season.json"),await check("games",season+"/games.json?limit=3",true),
      await check("stats",season+"/player_stats_totals.json?limit=1"),
      await check("gamelogs",season+"/week/7/player_gamelogs.json?limit=1"),
      await check("injuries","injuries.json?limit=1"),
      await check("latest_updates",season+"/latest_updates.json")];
    const game=checks[1]?.first_game_id;
    if(game&&/^[0-9A-Za-z_-]+$/.test(String(game))){
      checks.push(await check("playbyplay",season+"/games/"+game+"/playbyplay.json"));
      checks.push(await check("boxscore",season+"/games/"+game+"/boxscore.json"));
      for(const id of completedGameIds.filter(id=>String(id)!==String(game)).slice(0,2)){
        checks.push(await check("playbyplay_completed_"+id,season+"/games/"+id+"/playbyplay.json"));
      }
      checks.push(await check("playbyplay_invalid_control",season+"/games/999999999/playbyplay.json"));
      checks.push(await check("boxscore_invalid_control",season+"/games/999999999/boxscore.json"));
    }
    const out=new Response(JSON.stringify({version:"v8",at:new Date().toISOString(),checks}),{headers:{"content-type":"application/json","cache-control":"public,max-age=90"}});
    await cache.put(ck,out.clone());return out;
  }
  if(path==="/api/status"&&req.method==="GET")return result({app:"FFO GameCast",version:"staging-github-0.2",key_configured:!!env.MSF_API_KEY,password_configured:!!env.FFO_PROBE_PASSWORD,live_verified:false});
  if(path!=="/api/check"||req.method!=="POST")return result({error:"not_found"},404);
  if(!env.MSF_API_KEY||!env.FFO_PROBE_PASSWORD)return result({error:"missing_runtime_secrets"},503);
  if(!eq(req.headers.get("x-ffo-probe-password"),env.FFO_PROBE_PASSWORD))return result({error:"unauthorized"},401);
  if(Number(req.headers.get("content-length")||0)>512)return result({error:"request_too_large"},413);
  let payload;try{payload=await req.json()}catch{return result({error:"invalid_json"},400)}
  const feed=payload?.feed||"season";if(!Object.prototype.hasOwnProperty.call(FEEDS,feed))return result({error:"unsupported_feed"},400);
  const out=await checkProvider(env,feed);return result(out,out.error?502:200);
 }
};
// Private RPC-only entrypoint for Cloudflare Pages service bindings.
// It has no public URL. Pages authenticates the Coach with Cloudflare Access
// before invoking it; the MySportsFeeds key never leaves this Worker.
import { WorkerEntrypoint } from "cloudflare:workers";
export class GamecastInternal extends WorkerEntrypoint {
  async fetch(request) {
    const u=new URL(request.url);
    if(request.method!=="GET"||u.protocol!=="https:"||u.hostname!=="api.mysportsfeeds.com"||!u.pathname.startsWith("/v2.1/pull/nfl/"))
      return new Response(null,{status:403});
    if(!this.env.MSF_API_KEY)return new Response(null,{status:503});
    // No arbitrary upstream hosts, redirects, or client-provided auth headers.
    try {
      const upstream=await fetch(u.href,{method:"GET",headers:{Authorization:"Basic "+btoa(this.env.MSF_API_KEY+":MYSPORTSFEEDS"),Accept:"application/json"},redirect:"manual",signal:AbortSignal.timeout(11500)});
      return new Response(upstream.body,{status:upstream.status,headers:{"content-type":upstream.headers.get("content-type")||"application/json","cache-control":"private, no-store"}});
    }catch{return new Response(JSON.stringify({error:"upstream_unreachable"}),{status:502,headers:{"content-type":"application/json"}});}
  }
}
