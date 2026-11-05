/* Generate completely new, self-contained fantasy league feeds for the
 * ORIGINAL PFO dashboard. No current FFL roster/user/matchup IDs are copied.
 * Real NFL identities originate from the existing public NFL player directory.
 * All ownership, stats, projections and matchup outcomes below are synthetic.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve('.'),dest=resolve(process.argv[2]||'.pfo-exact-demo-output');
const readJSON=file=>JSON.parse(readFileSync(join(root,file),'utf8'));
const names=readJSON('data/player_names.json'),meta=readJSON('data/player_metadata.json'),
 seed=readJSON('pfo-demo-clone/seed-rosters.json'),
 realSettings=readJSON('data/fast_latest.json').league.scoring_settings;
const out=(name,obj)=>{
 const base=join(dest,'demo-data');mkdirSync(base,{recursive:true});
 writeFileSync(join(base,name),typeof obj==='string'?obj:JSON.stringify(obj));
};
const LEAGUE_ID='909090909090909090',stamp='2026-11-04T21:00:00Z';
const slots=['QB','RB','RB','WR','WR','TE','FLEX','FLEX','K','DEF'];
const teamNames=['The Front Office Collective','Fourth Down Empire','Sunday Blitz',
 'Gridiron Royals','Red Zone Society','Fourth & Fearless','The Route Runners',
 'Sunday Syndicate','Pocket Command','End Zone Architects','The Yardage Union','The Fantasy Collective'];
const all=new Map(Object.entries(names).filter(([id,p])=>p&&p.name&&
 ['QB','RB','WR','TE','K','DEF'].includes(p.position)&&
 meta[id]?.active!==false&&(p.team||p.position==='DEF')));
for(const [id,p] of Object.entries(seed.players))all.set(String(id),p);
const claimed=new Set(),banWaivers=new Set(seed.waivers);
const claim=id=>{const key=String(id);if(!id||claimed.has(key))throw Error('Duplicate demo NFL player '+key);claimed.add(key);return key};
function settings(t){const w=3+(t*7%6);return {wins:w,losses:9-w,ties:0,fpts:760+t*17,
 fpts_decimal:t*13%100,fpts_against:840+t*7,fpts_against_decimal:8,
 waiver_budget_used:t*7%67,waiver_position:t+1,total_moves:t+2,ppts:890+t*10,ppts_decimal:14}}
const rosters=seed.rosters.map((r,i)=>{
 const players=r.players.map(claim),starters=r.starters.map(String);
 if(starters.length!==10||starters.some(id=>!players.includes(id)))
  throw Error('Demo seed starter mismatch for '+r.name);
 return {roster_id:i+1,owner_id:String(910000000000000000+i+1),league_id:LEAGUE_ID,
  metadata:{record:'SIMULATED'},players,starters,reserve:[],taxi:null,
  settings:settings(i),co_owners:null,keepers:null,player_map:null};
});
const eligible=[...all].filter(([id,p])=>/^\d+$/.test(id)&&p.team&&
 !claimed.has(id)&&!banWaivers.has(id)&&p.position!=='DEF')
 .sort((a,b)=>Number(b[0])-Number(a[0]));
const buckets=Object.fromEntries(['QB','RB','WR','TE','K'].map(pos=>
 [pos,eligible.filter(([id,p])=>p.position===pos).map(([id])=>id)]));
const cursor={QB:0,RB:0,WR:0,TE:0,K:0};
function take(pos){const b=buckets[pos];let id;
 do{id=b[cursor[pos]++];if(!id)throw Error('Not enough NFL catalog players: '+pos)}while(claimed.has(id));
 return claim(id);
}
const defCodes=['BUF','DET','PHI','DEN','LAR','KC','SF','MIA','CIN','SEA'];
for(let i=2;i<12;i++){
 const starters=[take('QB'),take('RB'),take('RB'),take('WR'),take('WR'),take('TE'),
 take('RB'),take('WR'),take('K'),'DEF_'+defCodes[i-2]];
 const id=starters[9];all.set(id,{name:defCodes[i-2]+' D/ST',team:defCodes[i-2],position:'DEF'});claim(id);
 const bench=[take('QB'),take('RB'),take('RB'),take('WR'),take('WR'),take('TE')];
 rosters.push({roster_id:i+1,owner_id:String(910000000000000000+i+1),league_id:LEAGUE_ID,
  metadata:{record:'SIMULATED'},players:[...starters,...bench],starters,reserve:[],taxi:null,
  co_owners:null,keepers:null,player_map:null,settings:settings(i)});
}
const directory={};
for(const [id,p] of all)if(claimed.has(id)||banWaivers.has(id))
 directory[id]={name:p.name,position:p.position,team:p.team||null};
const waive=seed.waivers.filter(id=>!claimed.has(String(id))&&directory[id]);
const users=rosters.map((r,i)=>({user_id:r.owner_id,display_name:teamNames[i],
 username:'sample_front_office_'+(i+1),league_id:LEAGUE_ID,
 metadata:{team_name:teamNames[i]},avatar:null,settings:{},is_bot:false}));
const league={name:'FFO Demonstration Fantasy League',status:'in_season',season:'2026',
 sport:'nfl',league_id:LEAGUE_ID,roster_positions:slots.concat(Array(7).fill('BN')),
 scoring_settings:realSettings,
 settings:{waiver_budget:100,playoff_teams:6,playoff_week_start:15,num_teams:12,leg:9,
  daily_waivers_hour:0,playoff_type:0},metadata:{demo_only:true},avatar:null};
const nfl_state={season:'2026',season_type:'regular',week:9,leg:9,display_week:9,league_season:'2026'};
function stats(id,w=9){
 const p=directory[id]||{},pos=p.position,n=[...String(id)].reduce((a,c)=>a+c.charCodeAt(0),0);
 const mult=(.82+(n*5%26)/100)*(.91+((w*13+n*7)%17)/100);
 const v=a=>Math.round(a*mult*100)/100;
 if(pos==='QB')return {pass_att:v(34),pass_cmp:v(23),pass_inc:v(11),pass_yd:v(265),
 pass_td:v(1.95),pass_int:v(.67),rush_att:v(4.3),rush_yd:v(32),rush_td:v(.23)};
 if(pos==='RB')return {rush_att:v(17),rush_yd:v(84),rush_td:v(.51),rec:v(3.1),
 rec_yd:v(25),rec_td:v(.13),targets:v(4.2)};
 if(pos==='WR')return {targets:v(8.7),rec:v(5.9),rec_yd:v(85),rec_td:v(.53)};
 if(pos==='TE')return {targets:v(6.7),rec:v(4.5),rec_yd:v(59),rec_td:v(.43)};
 if(pos==='K')return {fgm:v(2),fgm_0_19:v(.18),fgm_20_29:v(.36),
 fgm_30_39:v(.61),fgm_40_49:v(.55),fgm_50p:v(.28),xpm:v(2.6)};
 if(pos==='DEF')return {sack:v(2.6),int:v(.78),ff:v(.65),fum_rec:v(.6),pts_allow:v(20)};
 return {};
}
function pts(id,w){
 const s=stats(id,w),p=directory[id]?.position;
 const n=p==='QB'?(s.pass_yd||0)/25+4*(s.pass_td||0)-2*(s.pass_int||0)+(s.rush_yd||0)/10+6*(s.rush_td||0):
 ['RB','WR','TE'].includes(p)?(s.rush_yd||0)/10+6*(s.rush_td||0)+(s.rec_yd||0)/10+
 6*(s.rec_td||0)+(s.rec||0)*.5:
 p==='K'?3*(s.fgm||0)+(s.xpm||0):
 p==='DEF'?3+(s.sack||0)+2*(s.int||0)+(s.ff||0):0;
 return Math.round(Math.max(.3,n)*100)/100;
}
const matchups=Object.fromEntries(Array.from({length:17},(_,i)=>{
 const w=i+1,arr=rosters.map(r=>{
  const playerPoints=w<9?Object.fromEntries(r.players.map(id=>[id,pts(id,w)])):{};
  const score=w<9?Math.round(r.starters.reduce((a,id)=>a+playerPoints[id],0)*100)/100:null;
  const pairIndex=(r.roster_id-1+w*5)%12;
  return {roster_id:r.roster_id,matchup_id:Math.floor(pairIndex/2)+1,
   players:r.players,starters:r.starters,points:score,players_points:playerPoints,
   starters_points:w<9?r.starters.map(id=>playerPoints[id]):[]};
 });
 return [String(w),arr];
}));
const transactions=Object.fromEntries(Array.from({length:18},(_,i)=>[String(i),[]]));
const snapshot={schema_version:1,source:'FFO PUBLIC DEMO • FICTIONAL FANTASY LEAGUE',
 demo:true,fetched_at_utc:stamp,league_id:LEAGUE_ID,league,rosters,users,
 nfl_state,transactions_by_week:transactions,transactions_scope:'simulated demo only'};
const latest={...snapshot,matchups_by_week:matchups,traded_picks:[],drafts:{},draft_picks:{}};
out('fast_latest.json',snapshot);out('latest.json',latest);
out('player_names.json',directory);out('player_metadata.json',directory);
const statPlayers=Object.entries(directory).filter(([_,p])=>p.team).map(([id,p])=>{
 const games=[5,6,7,8].map(w=>({week:w,opponent:null,stats:stats(id,w)}));
 const cats=[...new Set(games.flatMap(g=>Object.keys(g.stats)))];
 const forecast=Object.fromEntries(cats.map(k=>[k,Math.round(games.reduce((sum,g)=>sum+(g.stats[k]||0),0)/4*100)/100]));
 const totals=Object.fromEntries(cats.map(k=>[k,Math.round(forecast[k]*400)/100]));
 return {name:p.name,team:p.team,position:p.position,games,latest:{week:8,...games[3].stats},
 last_three:games.slice(1),forecast,season_totals:totals,games_observed:4,
 targets_per_game:forecast.targets??null,receptions_per_game:forecast.rec??null,
 carries_per_game:forecast.rush_att??null,pass_att_per_game:forecast.pass_att??null};
});
const independ={schema:'PFO_DEMO_STATS_V1',source:'FFO Demonstration Statistics',
 source_type:'synthetic_illustrative',available:true,season:2026,checked_at:stamp,
 scope:'demonstration_league',players_count:statPlayers.length,players:statPlayers,
 projection_method:'Simulated NFL per-game stats; illustrative FFL scoring (NOT MSF)'};
out('independent-stats.json',independ);
out('external_metrics.json',{as_of:stamp,source:'Illustrative public demo metrics',
 players:Object.fromEntries(Object.entries(directory).map(([id,p])=>[id,{
  name:p.name,nfl_team:p.team,position:p.position,targets_per_game:stats(id,8).targets??null,
  receptions_per_game:stats(id,8).rec??null,carries_per_game:stats(id,8).rush_att??null,
  snap_share_pct:['QB','RB','WR','TE'].includes(p.position)?68+(id.length*4%25):null}]))});
const empty={generated_at_utc:stamp,demo:true,warnings:['Fantasy league ownership and projections are simulated.']};
const files={
 'TRADE_IDEAS.json':{...empty,suggestions:[]},
 'trade_market.json':{...empty,profiles:[]},
 'WAIVER_CATALYSTS.json':{...empty,catalysts:[]},
 'MARKET_OFFER_GUIDE.json':{...empty,qualified_top_five:[]},
 'TRADE_QUALITY_43.json':{...empty,qualified:[],candidates_evaluated:0},
 'TRADE_BLOCK_SCOUTING.json':{...empty,reports:[],tested:0},
 'NFL_ROSTER_ACTIONS.json':{records:[],reviewed_at_utc:stamp},
 'WAIVER_WATCHLIST.md':'# Demonstration Waiver Market\n\nThis sample league has fictional player ownership.\n',
 'DECISION_BACKTEST.json':{...empty,completed_comparable_weeks:0,evaluations:[],guardrails:[]},
 'FULL_SEASON_PLAYOFF_SIMULATION.json':{...empty,season_week:9,simulations:100000,
  teams:rosters.map((r,i)=>({roster_id:r.roster_id,name:teamNames[i],record:r.settings.wins+'-'+r.settings.losses,
   playoff_probability:(18+(i*23)%68)/100,final_probability:(4+(i*11)%27)/100,
   championship_probability:(1+(i*3)%14)/100,bye_probability:(i%4)/25}))},
 'WEEKLY_LINEUPS.json':{...empty,roster_id:1,weeks:Object.fromEntries(Array.from({length:10},(_,i)=>{
  const w=i+8;return [String(w),{complete:true,ppg:Math.round(rosters[0].starters.reduce((x,id)=>x+pts(id,w),0)*100)/100,
  starters:rosters[0].starters.map((id,j)=>({position:slots[j],id,player_id:id,
   name:directory[id].name,opponent:'Sample matchup',ppg:pts(id,w)}))}]}))},
 'AVAILABILITY_INTELLIGENCE.json':{...empty,dirty_birds_watch:[],alerts:[],injury_feed_loaded:false},
 'GAMEDAY_DECISION.json':{...empty,week:9,baseline_fantasy_reserve_excluded:{complete:true,missing_projection:[],starters:[]}},
 'ACTIONABLE_GM_BOARD.json':{...empty,trade_qualified_for_negotiation_review:[],
  waiver_research_shortlist:waive.map(id=>({player:directory[id].name,position:directory[id].position,
   team:directory[id].team,source_player_id:id,research_tier:'demonstration'}))},
 'AUTOMATED_WAIVER_SCOUTING.json':{...empty,candidates:waive.map(id=>({
  id,source_player_id:id,name:directory[id].name,team:directory[id].team,
  position:directory[id].position,model_points_ppg:pts(id,9),news:[]}))},
 'market_values.json':{...empty,players:Object.fromEntries(Object.entries(directory).map(([id,p])=>[id,{
  name:p.name,position:p.position,value:Math.round(pts(id,9)*3*100)/100}]))}
};
for(const [k,v] of Object.entries(files))out(k,v);
out('demo.json',{league_id:LEAGUE_ID,week:9,team:teamNames[0],demo:true,rosters:rosters.map(r=>({id:r.roster_id,players:r.players,starters:r.starters}))});
if(rosters.length!==12||statPlayers.length<100||!rosters.every(r=>r.starters.length===10))
 throw Error('Demo league incomplete');
console.log(JSON.stringify({fictional_teams:rosters.length,unique_owned_players:claimed.size,
 stat_players:statPlayers.length,waiver_targets:waive.length,privacy:'no real manager snapshots'}));
