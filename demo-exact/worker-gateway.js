/* Exact PFO demo worker layer.
 * The PFO application's original public-research routes remain, but ANY
 * private league, commissioner, licensed, or monitoring endpoints are replaced.
 * Must be concatenated AFTER original worker with its export renamed realWorker.
 */
const DEMO_LEAGUE='2222222222222222222';
const DEMO_SAFE_GET_ROUTES=new Set([
 '/api/gameday-news','/api/independent-stats','/api/season-schedule',
 '/api/player-news','/api/target-share','/api/game-plays','/api/nfl-week',
 '/api/player-health','/api/nfl-transactions','/api/injuries','/api/nfl-official'
]);
const demoHeaders={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=5',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const demoReply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:demoHeaders});
const demoAsset=async(request,env,name)=>{
 const url=new URL('/demo-data/'+name,new URL(request.url));
 const res=await env.ASSETS.fetch(new Request(url.toString(),{method:'GET'}));
 if(!res.ok)throw Error('DEMO_FIXTURE_MISSING_'+name);
 return res.json();
};
const DEMO_DENIED={source:'PFO SHOWCASE',available:false,verified:false,error:'private_feature_disabled_in_public_demo',
 message:'The original PFO control remains visible but private data and administrative operations are not exposed.'};
const noPrivate=()=>demoReply(DEMO_DENIED,403);
async function demoRoster(request,env){
 const u=new URL(request.url),rid=Number(u.searchParams.get('roster_id')||1);
 const snapshot=await demoAsset(request,env,'demo-fixture.json');
 const roster=snapshot.rosters.find(x=>Number(x.roster_id)===rid)||snapshot.rosters[0];
 const names=await demoAsset(request,env,'player_names.json');
 return demoReply({source:'PFO DEMO SYNTHETIC SLEEPER ROSTER',checked_at:snapshot.fetched_at_utc,
  league_id:DEMO_LEAGUE,roster_id:roster.roster_id,
  players:roster.players.map(id=>({player_id:id,name:names[id]?.name||id,
   team:names[id]?.team||null,position:names[id]?.position||null,
   sleeper_injury_status:null,status:'DEMO_NOT_VERIFIED'})),
  players_count:roster.players.length,starters:roster.starters.map(String),
  starting_slots:snapshot.league.roster_positions.filter(x=>!['BN','IR','TAXI','RESERVE'].includes(x)),
  reserve:roster.reserve||[],roster_player_ids:roster.players.map(String),
  warning:'Demonstration roster with real NFL player identities; not connected to any real FFL league.'});
}
async function demoSleeper(request,env){
 const path=new URL(request.url).pathname.slice('/demo-sleeper/v1'.length);
 const snapshot=await demoAsset(request,env,'demo-fixture.json');
 if(path==='/state/nfl')return demoReply(snapshot.nfl_state);
 if(path==='/players/nfl'){
  const names=await demoAsset(request,env,'player_names.json');
  return demoReply(Object.fromEntries(Object.entries(names).map(([id,x])=>[id,{
   player_id:id,full_name:x.name,first_name:x.name?.split(' ')[0]||'',last_name:x.name?.split(' ').slice(1).join(' ')||'',
   position:x.position,team:x.team,status:'Active',injury_status:null}])));
 }
 if(path.startsWith('/players/nfl/trending/'))return demoReply([]);
 const leader=path.match(/^\/league\/(\d{10,22})(?:\/(rosters|users|matchups\/\d{1,2}|transactions\/\d{1,2}|traded_picks|drafts))?$/);
 if(!leader)return demoReply({error:'demo_league_only'},404);
 if(leader[1]!==DEMO_LEAGUE)return demoReply({error:'real_league_access_disabled'},403);
 const q=leader[2];
 if(!q)return demoReply(snapshot.league);
 if(q==='rosters')return demoReply(snapshot.rosters);
 if(q==='users')return demoReply(snapshot.users);
 if(q==='traded_picks'||q==='drafts')return demoReply([]);
 if(q.startsWith('transactions/'))return demoReply(snapshot.transactions_by_week[q.split('/')[1]]||[]);
 if(q.startsWith('matchups/'))return demoReply(snapshot.matchups_by_week[q.split('/')[1]]||[]);
 return demoReply({error:'demo_route_not_found'},404);
}
export default {async fetch(request,env,ctx){
 const url=new URL(request.url),p=url.pathname;
 if(p.startsWith('/api/commissioner/')||p==='/api/monitor-health'||p.startsWith('/api/ffo/gamecast/'))
  return noPrivate();
 if(p==='/api/roster')return request.method==='GET'?demoRoster(request,env):demoReply({error:'read_only'},405);
 if(p.startsWith('/demo-sleeper/v1/'))return request.method==='GET'?demoSleeper(request,env):demoReply({error:'read_only'},405);
 if(p==='/api/ffo/stats/season'){
  if(request.method!=='GET')return demoReply({error:'read_only'},405);
  const result=await demoAsset(request,env,'demo-model.json'),team=url.searchParams.get('team')?.toUpperCase();
  if(team){result.players=result.players.filter(x=>x.team===team);result.players_count=result.players.length;result.team=team;}
  return demoReply(result);
 }
 if(p.startsWith('/api/')){
  if(request.method!=='GET'||!DEMO_SAFE_GET_ROUTES.has(p))return noPrivate();
  // Delegate ONLY unprivileged NFL public data queries to unchanged PFO source.
  return realWorker.fetch(request,{ASSETS:env.ASSETS},ctx);
 }
 if(p==='/commissioner-pin-setup.html')return noPrivate();
 return env.ASSETS.fetch(request);
}};
