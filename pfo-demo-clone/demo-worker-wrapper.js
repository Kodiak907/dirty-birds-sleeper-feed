/* Authentic PFO clone API perimeter. Original backend is retained internally for
 * PUBLIC NFL research methods only; no private FFL or Commissioner data leaves.
 * Static fantasy rosters / model stats are entirely synthetic.
 */
const PFO_DEMO_LEAGUE='909090909090909090';
const demoJSON=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
const demoSafeMethods=new Set(['/api/nfl-official','/api/injuries','/api/player-health',
 '/api/player-news','/api/target-share','/api/season-schedule','/api/nfl-week',
 '/api/gameday-news','/api/game-plays','/api/nfl-transactions','/api/independent-stats']);
const demoAsset=async(req,env,filename)=>{
 const u=new URL(filename,req.url);
 const response=await env.ASSETS.fetch(new Request(u,{headers:{accept:'application/json'}}));
 if(!response.ok)throw Error('demo fixture missing: '+filename);
 return await response.json();
};
async function demoSleeper(req,env,path){
 const d=await demoAsset(req,env,'/demo-data/latest.json');
 if(path==='/state/nfl')return demoJSON(d.nfl_state);
 if(path==='/players/nfl'){
  const names=await demoAsset(req,env,'/demo-data/player_names.json');
  return demoJSON(Object.fromEntries(Object.entries(names).map(([id,p])=>[id,{
   player_id:id,full_name:p.name,position:p.position,team:p.team,
   status:'Active',injury_status:null}])));
 }
 if(path.startsWith('/players/nfl/trending/'))return demoJSON(
  Object.keys(await demoAsset(req,env,'/demo-data/player_names.json')).slice(0,30)
   .map(id=>({player_id:id,count:Math.max(1,30-id.length)})));
 const parts=path.split('/').filter(Boolean);
 if(parts[0]!=='league'||parts[1]!==PFO_DEMO_LEAGUE)return demoJSON({error:'not_a_demo_league'},404);
 if(parts.length===2)return demoJSON(d.league);
 if(parts[2]==='rosters')return demoJSON(d.rosters);
 if(parts[2]==='users')return demoJSON(d.users);
 if(parts[2]==='matchups'&&/^(?:[1-9]|1[0-8])$/.test(parts[3]||'')){
  return demoJSON(d.matchups_by_week[parts[3]]||[]);
 }
 if(parts[2]==='transactions')return demoJSON(d.transactions_by_week?.[parts[3]]||[]);
 if(parts[2]==='traded_picks')return demoJSON([]);
 return demoJSON({error:'unsupported_demo_sleeper_route'},404);
}
export default {async fetch(req,env){
 const u=new URL(req.url),p=u.pathname;
 if(!p.startsWith('/api/'))return env.ASSETS.fetch(req);
 if(req.method!=='GET'&&req.method!=='HEAD')
  return demoJSON({error:'read_only_demo'},405);
 if(p.startsWith('/api/commissioner/')||p==='/api/monitor-health'||
    p.startsWith('/api/ffo/gamecast/')||p.startsWith('/api/ffo/internal/'))
  return demoJSON({error:'private_feature_disabled_in_public_demo',
   message:'Same PFO user interface; private Commissioner and licensed live feeds remain protected.'},403);
 try{
  if(p==='/api/roster'){
   const league=u.searchParams.get('league_id')||PFO_DEMO_LEAGUE;
   const rid=Number(u.searchParams.get('roster_id')||1);
   if(league!==PFO_DEMO_LEAGUE||!Number.isInteger(rid)||rid<1||rid>12)
    return demoJSON({error:'demo_league_only'},403);
   const d=await demoAsset(req,env,'/demo-data/latest.json');
   const catalog=await demoAsset(req,env,'/demo-data/player_names.json');
   const r=d.rosters.find(x=>x.roster_id===rid);
   if(!r)return demoJSON({error:'demo_roster_not_found'},404);
   const players=r.players.map(id=>({player_id:id,name:catalog[id]?.name||String(id),
    team:catalog[id]?.team||null,position:catalog[id]?.position||null,
    sleeper_injury_status:null}));
   return demoJSON({source:'FFO DEMONSTRATION ROSTER — NOT SLEEPER LIVE',demo:true,
    checked_at:d.fetched_at_utc,league_id:PFO_DEMO_LEAGUE,roster_id:rid,players,
    players_count:players.length,starters:r.starters,roster_player_ids:r.players,
    starting_slots:d.league.roster_positions.filter(x=>!['BN','IR','TAXI'].includes(x)),
    reserve:[],warning:'Fictional franchise and ownership. Read-only. No Sleeper actions.'});
  }
  if(p.startsWith('/api/demo-sleeper')){
   return demoSleeper(req,env,p.slice('/api/demo-sleeper'.length));
  }
  if(p==='/api/ffo/stats/season'){
   const j=await demoAsset(req,env,'/demo-data/independent-stats.json');
   const team=String(u.searchParams.get('team')||'').toUpperCase();
   if(team&&!/^[A-Z]{2,3}$/.test(team))return demoJSON({error:'invalid_team'},400);
   if(team){
    j.players=j.players.filter(x=>x.team===team);
    j.players_count=j.players.length;j.team=team;j.scope='selected_teams';
   }
   return demoJSON(j);
  }
  if(demoSafeMethods.has(p))return ORIGINAL_PFO_BACKEND.fetch(req,env);
  return demoJSON({error:'demo_route_not_available'},404);
 }catch(err){
  return demoJSON({error:'demo_source_unavailable',message:'This read-only demo source could not be loaded.'},503);
 }
}};
