// Temporary staging build check. No credentials or licensed plays are logged.
const key = process.env.MSF_API_KEY;
if (!key) { console.log("FFO_HISTORY_AUDIT",JSON.stringify({error:"build_secret_missing"})); process.exit(1); }
const root="https://api.mysportsfeeds.com/v2.1/pull/nfl/2026-2027-regular/";
const auth="Basic "+Buffer.from(key+":MYSPORTSFEEDS").toString("base64");
async function check(path,inspect=false){
 const start=Date.now();
 try {
  const r=await fetch(root+path,{headers:{Authorization:auth,Accept:"application/json"},signal:AbortSignal.timeout(9000)});
  const status=r.status,ms=Date.now()-start;
  if(inspect && r.ok) return {status,ms,data:await r.json()};
  await r.body?.cancel();
  return {status,ms};
 } catch(e){return {error:e.name==="TimeoutError"?"timeout":"network_error",ms:Date.now()-start};}
}
const schedule=await check("games.json",true);
if(!schedule.data?.games){console.log("FFO_HISTORY_AUDIT",JSON.stringify({error:"schedule_failed",http_status:schedule.status}));process.exit(1);}
const games=schedule.data.games,results=[];
for(let week=1;week<=7;week++){
 const candidate=games.find(g=>Number(g.schedule?.week)===week&&String(g.schedule?.playedStatus).toUpperCase()==="COMPLETED");
 if(!candidate){results.push({week,reason:"no_completed_game"});continue;}
 const id=candidate.schedule.id;
 const pbp=await check("games/"+id+"/playbyplay.json");
 const box=pbp.status===403?await check("games/"+id+"/boxscore.json"):undefined;
 results.push({week,game_id:id,played_status:"COMPLETED",playbyplay_http:pbp.status??null,boxscore_http:box?.status??null,request_ms:pbp.ms,error:pbp.error??null});
}
for(const id of [163541,163651]){
 if(results.some(x=>String(x.game_id)===String(id)))continue;
 const source=games.find(g=>Number(g.schedule?.id)===id);
 const pbp=await check("games/"+id+"/playbyplay.json");
 const box=pbp.status===403?await check("games/"+id+"/boxscore.json"):undefined;
 results.push({week:source?.schedule?.week??null,game_id:id,played_status:source?.schedule?.playedStatus??"unknown",playbyplay_http:pbp.status??null,boxscore_http:box?.status??null,request_ms:pbp.ms,error:pbp.error??null});
}
console.log("FFO_HISTORY_AUDIT",JSON.stringify({season:"2026-2027-regular",checked_at:new Date().toISOString(),sample_size:results.length,results}));
