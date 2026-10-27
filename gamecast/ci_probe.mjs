// One-time redacted MySportsFeeds provider check from Cloudflare's own build environment.
// Runs only when explicitly invoked from the GameCast staging deploy command.
// Never outputs or persists the key, password, Authorization header or response body.
const key=process.env.MSF_API_KEY;
if(!key){
 console.log("FFO_MSF_TEST",JSON.stringify({result:"not_run",reason:"build_secret_unavailable"}));
} else {
 try{
  const started=Date.now();
  const r=await fetch("https://api.mysportsfeeds.com/v2.1/pull/nfl/current_season.json",{
    headers:{Authorization:"Basic "+Buffer.from(key+":MYSPORTSFEEDS").toString("base64"),Accept:"application/json"},
    redirect:"error",signal:AbortSignal.timeout(12000)
  });
  const info={provider_http_status:r.status,provider_ok:r.ok,elapsed_ms:Date.now()-started,checked_at:new Date().toISOString()};
  if(r.ok){try{const obj=await r.json();info.root_keys=Object.keys(obj||{}).slice(0,12)}catch{info.parse_error=true}}
  console.log("FFO_MSF_TEST",JSON.stringify(info));
 }catch(e){console.log("FFO_MSF_TEST",JSON.stringify({result:"connection_failed",category:e?.name==="TimeoutError"?"timeout":"network"}))}
}
