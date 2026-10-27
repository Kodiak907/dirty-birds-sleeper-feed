// One-time authorised staging build audit. Never print/commit API keys or response bodies.
const apiKey = process.env.MSF_API_KEY;
const base = 'https://api.mysportsfeeds.com/v2.1/pull/nfl/';
const probes = [
 ['games', '2026-regular/games.json?limit=1'],
 ['season_player_stats', '2026-regular/player_stats_totals.json?limit=1'],
 ['player_gamelogs', '2026-regular/player_gamelogs.json?limit=1'],
 ['injuries', 'injuries.json?limit=1'],
 ['latest_updates', '2026-regular/latest_updates.json'],
 ['players', 'players.json?limit=1']
];
if (!apiKey) {
 console.log('FFO_FEED_AUDIT',JSON.stringify({error:'missing_cloudflare_build_secret'}));
} else {
 for (const [feed,path] of probes) {
  const start=Date.now();
  let summary={feed};
  try {
   const res=await fetch(base+path,{
    headers:{Authorization:'Basic '+Buffer.from(apiKey+':MYSPORTSFEEDS').toString('base64'),Accept:'application/json'},
    redirect:'error',signal:AbortSignal.timeout(10000)
   });
   summary.http_status=res.status;summary.ok=res.ok;summary.elapsed_ms=Date.now()-start;
   const len=Number(res.headers.get('content-length')||0);
   if(res.ok && len<=4_000_000){
    try{
     const data=await res.json();
     summary.root_keys=Object.keys(data||{}).slice(0,12);
     summary.array_lengths=Object.fromEntries(Object.entries(data||{}).filter(([,v])=>Array.isArray(v)).slice(0,5).map(([k,v])=>[k,v.length]));
    }catch{summary.body='non_json'}
   } else if (res.body) await res.body.cancel();
  } catch(e) {summary.error = e?.name==='TimeoutError'?'timeout':'upstream_unreachable';summary.elapsed_ms=Date.now()-start;}
  console.log('FFO_FEED_AUDIT',JSON.stringify(summary));
 }
}