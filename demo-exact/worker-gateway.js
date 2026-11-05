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
/* Synthetic GameCast adapter for the UNCHANGED PFO field and play-rail UI.
 * These events are NEVER claimed to be real NFL games or licensed MSF data. */
const DEMO_GC_TEAMS=[['BUF','KC'],['DET','GB'],['PHI','DAL'],['BAL','CIN'],['LAR','SF'],['MIA','NYJ']];
const DEMO_GC_AT='2026-11-04T23:00:00.000Z';
function demoGames(week){
 const w=Number(week);
 const selected=[0,1,2].map(i=>DEMO_GC_TEAMS[(w-1+i)%DEMO_GC_TEAMS.length]);
 return selected.map(([away,home],i)=>{
  const id=50000+w*10+i;
  return {schedule:{id,week:w,weekNumber:w,
    awayTeam:{abbreviation:away},homeTeam:{abbreviation:home},
    playedStatus:'COMPLETED',
    startTime:'2026-10-28T20:00:00Z'},
   score:{awayScoreTotal:10+(w*3+i*7)%25,homeScoreTotal:13+(w*5+i*3)%23}};
 });
}
function demoAllGames(){return Array.from({length:18},(_,i)=>demoGames(i+1)).flat()}
function demoPlayRows(id){
 const n=Number(id),away=DEMO_GC_TEAMS[(Math.floor((n-50000)/10)-1+(n%10))%DEMO_GC_TEAMS.length]?.[0]||'BUF';
 return [
  {id:String(id)+'-1',description:'DEMO: kickoff returned to the 29-yard line',playStatus:{quarter:1,secondsElapsed:5,down:1,yardsToGo:10}},
  {id:String(id)+'-2',description:'DEMO: '+away+' running back carries up the middle for 6 yards',playStatus:{quarter:1,secondsElapsed:41,down:2,yardsToGo:4}},
  {id:String(id)+'-3',description:'DEMO: short pass completed for 12 yards and a first down',playStatus:{quarter:1,secondsElapsed:85,down:1,yardsToGo:10}},
  {id:String(id)+'-4',description:'DEMO: quarterback rushes for 9 yards on second down',playStatus:{quarter:1,secondsElapsed:133,down:3,yardsToGo:1}},
  {id:String(id)+'-5',description:'DEMO: touchdown pass to the end zone',playStatus:{quarter:1,secondsElapsed:177,down:1,yardsToGo:10,homeScoreTotal:7,awayScoreTotal:0}},
  {id:String(id)+'-6',description:'DEMO: extra point is good',playStatus:{quarter:1,secondsElapsed:187,down:1,yardsToGo:10,homeScoreTotal:7,awayScoreTotal:0}}
 ];
}
async function demoGameCast(request,env){
 const u=new URL(request.url),route=u.pathname.slice('/api/ffo/gamecast/'.length);
 const wrap=(data,more={})=>demoReply({
  source:'PFO FICTIONAL GAMECAST',source_type:'synthetic_scenario',
  checked_at:DEMO_GC_AT,provider_updated_at:DEMO_GC_AT,
  available:true,licensed:false,live:false,live_verified:false,
  demo:true,warning:'FICTIONAL GAMECAST: no actual NFL scores, plays or MSF content.',
  ...more,data
 });
 const season=String(u.searchParams.get('season')||'2026-regular');
 if(!/^2026(?:-regular)?$/.test(season))return demoReply({error:'demo_2026_only'},400);
 const w=Number(u.searchParams.get('week')||9);
 if(route==='health')return demoReply({source:'PFO FICTIONAL GAMECAST',demo:true,ready:true,
  live:false,licensed:false,live_verified:false,provider_credential_configured:false,checked_at:DEMO_GC_AT,
  warning:'Synthetic sample plays, not licensed MSF or real NFL scores.'});
 if(route==='schedule')return wrap({games:demoAllGames()},{coverage:'fictional_schedule'});
 if(route==='weekboard'){
  if(!Number.isInteger(w)||w<1||w>18)return demoReply({error:'invalid_week'},400);
  return wrap({games:demoGames(w)},{coverage:'fictional_weekboard'});
 }
 if(route==='plays'||route==='boxscore'){
  const id=Number(u.searchParams.get('game_id'));
  if(!Number.isInteger(id)||!demoAllGames().some(g=>g.schedule.id===id))
   return demoReply({error:'unknown_demo_game'},404);
  const game=demoAllGames().find(g=>g.schedule.id===id);
  if(route==='plays')return wrap({gameplaybyplay:{plays:demoPlayRows(id)}} ,{coverage:'fictional_six_play_sample',full_playbyplay_authorized:false});
  return wrap({gameboxscore:{scoring:{
   homeScoreTotal:game.score.homeScoreTotal,awayScoreTotal:game.score.awayScoreTotal,
   currentQuarter:4},game:{id}}},{coverage:'fictional_boxscore'});
 }
 if(route==='stats'||route==='gamelogs'){
  const model=await demoAsset(request,env,'demo-model.json');
  if(route==='gamelogs')return wrap({playerGamelogs:[]},{coverage:'no_verified_historical_logs'});
  const payload={playerStatsTotals:model.players.slice(0,200).map((p,i)=>({
   player:{id:i+1,fullName:p.name,primaryPosition:p.position},
   team:{abbreviation:p.team},stats:p.season_totals||{}
  }))};
  return wrap(payload,{coverage:'synthetic_sample_player_totals'});
 }
 if(route==='portraits')return wrap({players:[]},{coverage:'player_portraits_unavailable'});
 if(route==='injuries')return wrap({injuries:[]},{coverage:'no_authenticated_injury_status'});
 if(route==='updates')return wrap({updates:[]});
 return demoReply({error:'demo_gamecast_route_not_supported'},404);
}

export default {async fetch(request,env,ctx){
 const url=new URL(request.url),p=url.pathname;
 if(p.startsWith('/api/commissioner/')||p==='/api/monitor-health')return noPrivate();
 if(p.startsWith('/api/ffo/gamecast/'))return request.method==='GET'?demoGameCast(request,env):noPrivate();
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
