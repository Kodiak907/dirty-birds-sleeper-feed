import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join,extname} from 'node:path';
/* Exact PFO 6.11 frontend plus isolated demonstration-only data. */
const root=process.cwd(),src=join(root,'pfo-thursday'),out=join(root,'demo-exact-dist'),dataDir=join(out,'demo-data');
mkdirSync(dataDir,{recursive:true});
const read=p=>JSON.parse(readFileSync(join(root,p),'utf8'));
const sample=read('demo-exact/sample-rosters.json'),names=read('data/player_names.json'),rules=read('pfo-thursday/FFO_FFL_SCORING_V1.json');
const LEAGUE='2222222222222222222',YEAR=2026,WEEK=9,stamp='2026-11-04T23:00:00.000Z';
const slots=['QB','RB','RB','WR','WR','TE','FLEX','FLEX','K','DEF'];
const teamsList=['The Front Office Collective','Fourth Down Empire','Sunday Syndicate','Goal Line Architects','Gridiron Dynasty','Fourth Quarter Kings','Pocket Pressure','Red Zone Raiders','Sunday Chaos','Two Minute Mafia','The Audible Club','End Zone Collective'];
const idOf=x=>String(x).startsWith('DST_')?String(x).slice(4):String(x);
const positionSet=new Set(['QB','RB','WR','TE','K','DEF']);
for(const [id,p] of Object.entries(sample.players)){const key=idOf(id);if(!names[key]&&p.position&&p.name)names[key]={name:p.name,team:p.team,position:p.position};}
const pool={};for(const pos of positionSet)pool[pos]=Object.entries(names).filter(([id,p])=>p.position===pos&&p.team&&p.name).sort(([a],[b])=>a.localeCompare(b)).map(([id])=>id);
const used=new Set();
function take(pos){const id=pool[pos].find(x=>!used.has(x));if(!id)throw Error('Insufficient unique '+pos+' demo players');used.add(id);return id}
function roster(i){
 if(i<2){const from=sample.rosters[i],players=from.players.map(idOf),starters=from.starters.map(idOf);
  if(starters.length!==10||new Set(starters).size!==10)throw Error('Sample starters invalid');
  for(const id of players){if(!names[id]||used.has(id))throw Error('Duplicate or missing '+id);used.add(id)}
  return {players,starters};}
 const starters=[take('QB'),take('RB'),take('RB'),take('WR'),take('WR'),take('TE'),take('RB'),take('WR'),take('K'),take('DEF')];
 return {starters,players:[...starters,take('QB'),take('RB'),take('RB'),take('WR'),take('WR'),take('TE'),take('DEF')]};
}
const rosters=teamsList.map((team,i)=>{
 const {players,starters}=roster(i),rid=i+1,wins=(i*3+2)%9,losses=8-wins;
 return {roster_id:rid,owner_id:'demo_manager_'+rid,league_id:LEAGUE,players,starters,reserve:[],
  settings:{wins,losses,ties:0,fpts:680+i*19,fpts_decimal:(i*13)%100,waiver_budget_used:(i*11)%125,waiver_position:rid,total_moves:4+i},metadata:{record:'DEMO'}};
});
const users=rosters.map((r,i)=>({user_id:r.owner_id,display_name:'Demo Manager '+(i+1),username:'demo'+(i+1),metadata:{team_name:teamsList[i]},league_id:LEAGUE}));
const league={league_id:LEAGUE,name:'PFO Demonstration League',season:'2026',season_type:'regular',sport:'nfl',status:'in_season',total_rosters:12,
 roster_positions:[...slots,...Array(8).fill('BN')],scoring_settings:rules.scoring,
 settings:{leg:WEEK,num_teams:12,waiver_budget:250,playoff_teams:6,playoff_week_start:15,trade_deadline:11,last_scored_leg:8,reserve_slots:0}};
const nfl_state={season:YEAR,week:WEEK,display_week:WEEK,season_type:'regular'};
const points=(id,w)=>{const n=[...String(id)].reduce((a,c)=>a+c.charCodeAt(0),0);return Math.round((7+n%31*.35+(w%5)*.45)*100)/100};
const matchups_by_week=Object.fromEntries(Array.from({length:18},(_,i)=>{const w=i+1;return [String(w),rosters.map((r,j)=>({
 roster_id:r.roster_id,matchup_id:Math.floor(j/2)+1,starters:r.starters,players:r.players,
 points:r.starters.reduce((sum,id)=>sum+points(id,w),0),players_points:Object.fromEntries(r.players.map(id=>[id,points(id,w)])),
 starters_points:r.starters.map(id=>points(id,w))}))]}));
const transactions_by_week=Object.fromEntries(Array.from({length:18},(_,i)=>[String(i+1),[]]));
const snapshot={source:'SYNTHETIC DEMONSTRATION',league_id:LEAGUE,league,rosters,users,nfl_state,matchups_by_week,transactions_by_week,
 fetched_at_utc:stamp,drafts:[],draft_picks:[],traded_picks:[]};
const fast={schema_version:'PFO_DEMO',source:'SYNTHETIC DEMONSTRATION',league_id:LEAGUE,league,rosters,users,nfl_state,transactions_by_week,
 transactions_scope:'fictional',fetched_at_utc:stamp};
const write=(file,obj)=>writeFileSync(join(dataDir,file),JSON.stringify(obj,null,2)+'\n');
const safeScoring={...rules,league:LEAGUE,league_name:'PFO Demonstration League',authority:'Sample league scoring configuration',source_mirror_saved_at:stamp};
write('FFO_FFL_SCORING_V1.json',safeScoring);
writeFileSync(join(out,'FFO_FFL_SCORING_V1.json'),JSON.stringify(safeScoring,null,2)+'\n');
write('latest.json',snapshot);write('fast_latest.json',fast);write('player_names.json',names);write('demo-fixture.json',snapshot);
const first=rosters[0].starters;
const lineups=Object.fromEntries(Array.from({length:18},(_,i)=>[String(i+1),{
 starters:first.map((id,k)=>({position:slots[k],name:names[id].name,opponent:'DEMO',ppg:points(id,i+1)})),
 ppg:first.reduce((sum,id)=>sum+points(id,i+1),0)}]));
write('WEEKLY_LINEUPS.json',{source:'PFO DEMO',generated_at_utc:stamp,weeks:lineups});
write('FULL_SEASON_PLAYOFF_SIMULATION.json',{source:'PFO DEMO',generated_at_utc:stamp,
 teams:rosters.map((r,i)=>({name:teamsList[i],record:r.settings.wins+'-'+r.settings.losses,
  championship_probability:(12-i)/120,playoff_probability:(12-i)/15}))});
write('AVAILABILITY_INTELLIGENCE.json',{source:'PFO DEMO',dirty_birds_watch:[],generated_at_utc:stamp});
write('GAMEDAY_DECISION.json',{source:'PFO DEMO',third_party_inactive_source_status:'Demo data only',generated_at_utc:stamp});
write('ACTIONABLE_GM_BOARD.json',{source:'PFO DEMO',recommendations:[],generated_at_utc:stamp});
write('DECISION_BACKTEST.json',{source:'PFO DEMO',decisions:[],generated_at_utc:stamp});

/* These are the ancillary JSON feeds consumed by the UNCHANGED PFO research
 * panels. No privately generated trade research, injury notes or manager
 * decisions from the real league are copied. */
const demoOwned=new Set(rosters.flatMap(r=>r.players.map(String)));
const sampleWaivers=sample.waivers.map(idOf).filter(id=>names[id]&&!demoOwned.has(id)).slice(0,35);
const demoPerson=id=>({id:String(id),name:names[id].name,pos:names[id].position,team:names[id].team,
 projected_ppg:points(id,WEEK)});
write('TRADE_IDEAS.json',{source:'PFO DEMO',generated_at_utc:stamp,suggestions:[],
 model:'Original PFO trade evaluator uses fictional 12-team rosters; no offers sent.',
 warnings:['No real FFL trade proposals included']});
write('trade_market.json',{source:'PFO DEMO',generated_at_utc:stamp,
 note:'Fictional profiles for demo trade research; no actual manager intelligence.',
 profiles:rosters.map((r,i)=>({id:r.roster_id,manager:teamsList[i],
  record:r.settings.wins+'-'+r.settings.losses,faab_used:r.settings.waiver_budget_used,
  points_for:r.settings.fpts+r.settings.fpts_decimal/100,
  positions:Object.fromEntries(['QB','RB','WR','TE','K','DEF'].map(pos=>[pos,
   r.players.filter(id=>names[id]?.position===pos).map(id=>names[id].name)])),
  successful_paid_waivers:[]}))});
write('WAIVER_CATALYSTS.json',{schema_version:1,source:'PFO DEMO',last_curated_at_utc:stamp,catalysts:[],
 method:'No fabricated injury news or coach quotes in public demonstration'});
write('MARKET_OFFER_GUIDE.json',{source:'PFO DEMO',generated_at_utc:stamp,
 source_as_of:stamp,market_baseline:'Synthetic illustration, not paid market quotes',
 qualified_top_five:[],priced_candidates:0,no_automatic_trade_offers:true});
write('AUTOMATED_WAIVER_SCOUTING.json',{source:'PFO DEMO',generated_at_utc:stamp,
 candidate_count:sampleWaivers.length,news_status:'not_connected',
 candidates:sampleWaivers.map(id=>({...demoPerson(id),position:names[id].position,
  id,source_player_id:id,snap_share_pct:null,news:[],signals:[]})),
 limitations:['Sample ownership; no verified role, depth chart or injury updates']});
write('TRADE_QUALITY_43.json',{source:'PFO DEMO',generated_at_utc:stamp,
 candidates_evaluated:0,qualified:[],market_matched:0,
 limitations:['No actual external market price or manager acceptance probabilities']});
write('TRADE_BLOCK_SCOUTING.json',{source:'PFO DEMO',generated_at_utc:stamp,tested:0,
 market_screened:0,focus_assets:['Josh Allen','CeeDee Lamb','Breece Hall'].map(name=>{
  const id=rosters[0].players.find(id=>names[id]?.name===name);
  return {id,name};}),reports:[]});
write('NFL_ROSTER_ACTIONS.json',{schema_version:1,source:'PFO DEMO',reviewed_at_utc:stamp,
 records:[],warning:'No official current NFL player-status claims are bundled with demo fantasy ownership.'});
write('external_metrics.json',{source:'PFO DEMO',as_of:stamp,
 data_status:{player_stats:'synthetic_only',advanced_receiving:'not_verified',advanced_rushing:'not_verified',injuries:'not_verified'},
 players:Object.fromEntries(Object.entries(names).filter(([id,p])=>p.team&&p.position).map(([id,p])=>[id,{
  name:p.name,team:p.team,position:p.position,nfl_team:p.team,
  targets_per_game:['WR','TE'].includes(p.position)?Math.round(points(id,WEEK)*.56*100)/100:null,
  receptions_per_game:['WR','TE'].includes(p.position)?Math.round(points(id,WEEK)*.32*100)/100:null,
  carries_per_game:p.position==='RB'?Math.round(points(id,WEEK)*.8*100)/100:null,
  snap_share_pct:['QB','RB','WR','TE'].includes(p.position)?68+(id.length*3%25):null
 }]))});
write('market_values.json',{source:'PFO DEMO',as_of:stamp,attribution:'illustrative example valuations; not third-party pricing',
 players:Object.fromEntries(Object.entries(names).filter(([id,p])=>p.team&&p.position)
  .map(([id,p])=>[id,{name:p.name,position:p.position,value:Math.round(points(id,WEEK)*3*100)/100}]))});
write('CHAMPIONSHIP_SIMULATION.json',{source:'PFO DEMO',generated_at_utc:stamp,
 limitations:['Illustrative fantasy league with fictional standings'],teams:[]});
write('AVAILABILITY_STATE.json',{source:'PFO DEMO',generated_at_utc:stamp,players:[],warnings:['No real injury determination']});

writeFileSync(join(dataDir,'WAIVER_WATCHLIST.md'),'# PFO DEMO\n\nSample league only. No private transactions or data.\n');
function model(id,p){
 const v=points(id,WEEK),pos=p.position;
 const f=pos==='QB'?{pass_yd:215+v*3,pass_td:1.3+v/25,pass_int:.6,rush_yd:20+v,rush_td:.15}:
 pos==='RB'?{rush_yd:62+v,rush_td:.3,rec:2.5,rec_yd:22+v/2,rush_att:13+v/5}:
 ['WR','TE'].includes(pos)?{rec:3+v/7,rec_yd:30+v*2,rec_td:.25,targets:5+v/5}:
 pos==='K'?{fgm_0_19:.1,fgm_20_29:.35,fgm_30_39:.55,fgm_40_49:.4,fgm_50_59:.2,fgm_60p:.03,xpm:2.2}:
 {sack:2.2,int:1,ff:.4};
 return {msf_id:null,name:p.name,team:p.team,position:pos,games_observed:8,games_played:8,
  season_totals:Object.fromEntries(Object.entries(f).map(([k,v])=>[k,+(v*8).toFixed(1)])),
  forecast:f,latest:null,games:[],coverage:'synthetic_demonstration'};
}
const models=Object.entries(names).filter(([id,p])=>p.name&&p.team&&positionSet.has(p.position)).map(([id,p])=>model(id,p));
write('demo-model.json',{schema:'PFO_DEMO_MODEL',source:'PFO DEMO',source_type:'synthetic_sample',checked_at:stamp,players_count:models.length,
 players:models,history_available:false,projection_method:'Illustrative data ONLY, not licensed MSF'});
const forbidden=/1399157532559192064|dirty-birds-sleeper-feed|dirty-birds-monitor|tvega2924|BigOlBoyle|@DMccolley03/i;
let count=0;
for(const file of readdirSync(src)){
 const ext=extname(file);
 if(!['.html','.css','.js','.mjs','.json'].includes(ext)||file.startsWith('qa-')||
 file==='commissioner-pin-setup.html'||file==='_worker.js'||file==='wrangler.jsonc'||
 ext==='.json')continue;
 let s=readFileSync(join(src,file),'utf8');
 if(['.js','.mjs','.html'].includes(ext)){
  s=s.replaceAll('https://raw.githubusercontent.com/Kodiak907/dirty-birds-sleeper-feed/main/data/','/demo-data/');
  s=s.replaceAll('https://api.sleeper.app/v1','/demo-sleeper/v1');
  s=s.replaceAll('https://dirty-birds-monitor-git.tvega2924.workers.dev/health','/api/monitor-health');
  s=s.replaceAll(/https:\/\/github\.com\/Kodiak907\/dirty-birds-sleeper-feed\/blob\/main\/data\//g,'/demo-data/');
  s=s.replaceAll(/https:\/\/github\.com\/Kodiak907\/dirty-birds-sleeper-feed/g,'/demo-data/');
  s=s.replaceAll('Dirty Birds','The Front Office Collective').replaceAll('BigOlBoyle','Excluded Demo Manager').replaceAll('@DMccolley03','Demo Manager');
  s=s.replaceAll('const TRADE_VIEW_ONLY_ROSTER_ID=3;','const TRADE_VIEW_ONLY_ROSTER_ID=-1;').replaceAll('/boyle/i','/no-demo-manager-exclusions/i');
  s=s.replaceAll('Coach’s Trade Block','Demo Trade Research').replaceAll('Coach priorities','Demo team priorities')
   .replaceAll('Coach’s','Manager’s').replaceAll("Coach's","Manager's");
  s=s.replaceAll('Garrett Wilson · A.J. Brown · Patrick Mahomes','Josh Allen · CeeDee Lamb · Breece Hall');
  if(file==='ffo-pfo-59.js'){
   s=s.replaceAll("Number(r.roster_id)===3?", "Number(r.roster_id)===-1?")
    .replaceAll("state.manager!=='3'", "state.manager!=='-1'")
    .replaceAll("String(x.opponent_roster_id)!=='3'", "String(x.opponent_roster_id)!=='-1'");
  }

  if(file==='ffo-pfo-core.js'){
   const from=s.indexOf('const CURATED_WAIVER_CONTEXT='),end=s.indexOf(';\n',from);
   if(from>=0){if(end<from||end-from>60000)throw Error('Private curated context boundary unmatched');
    s=s.slice(0,from)+'const CURATED_WAIVER_CONTEXT=[]'+s.slice(end);}
   const actionStart=s.indexOf('const CURATED_ACTIONS=');
   if(actionStart>=0){
    const actionEnd=s.indexOf(';\n',actionStart);
    if(actionEnd<actionStart||actionEnd-actionStart>25000)throw Error('Original manager action notes could not be isolated');
    s=s.slice(0,actionStart)+'const CURATED_ACTIONS=[]'+s.slice(actionEnd);
   }
   s=s.replace("const focus=[{name:'Garrett Wilson',id:'8146'},{name:'A.J. Brown',id:'5859'},{name:'Patrick Mahomes',id:'4046'}];",
      "const focus=[{name:'Josh Allen',id:'4984'},{name:'CeeDee Lamb',id:'6786'},{name:'Breece Hall',id:'8155'}];");
   s=s.replaceAll("data.source!=='MySportsFeeds'","!['MySportsFeeds','PFO DEMO'].includes(data.source)");
   s=s.replaceAll("part?.source!=='MySportsFeeds'","!['MySportsFeeds','PFO DEMO'].includes(part?.source)");
  }
  if(file==='index.html'){
   s=s.replaceAll('Private Front Office','PFO Demonstration Front Office');
   s=s.replaceAll("Coach's read-only command center",'Original PFO application · synthetic league');
   s=s.replace('</head><body>','</head><body><div id="pfo-exact-demo-label" role="note" style="position:sticky;top:0;z-index:150;padding:7px;text-align:center;background:#173a35;color:#c1f5df;font:700 11px system-ui;border-bottom:1px solid #4a897a">PFO ACTUAL CLONE · REAL NFL PLAYERS · SAMPLE LEAGUE · NO PRIVATE FFL DATA</div>');
   s=s.replace('</body></html>','<script src="/demo-exact-overlay.js?v=1" defer></script></body></html>');
  }
 }
 if(forbidden.test(s))throw Error('Private identifier retained in '+file);
 writeFileSync(join(out,file),s);count++;
}
const overlay="(function(){document.title='PFO League Demo · The Front Office Collective';window.ffoExactDemo=true;document.addEventListener('DOMContentLoaded',function(){const pane=document.getElementById('commissioner');if(pane){const n=document.createElement('div');n.className='note';n.textContent='COMMISSIONER SYSTEM LOCKED: public demonstration only; no private case records or administrative actions.';pane.prepend(n)}const game=document.getElementById('gamecast');if(game){const note=document.createElement('div');note.className='note';note.style.cssText='border-left:3px solid #e8bd75;margin-bottom:12px;font-weight:700';note.textContent='GAMECAST DEMO · All matchups, scores, field positions and plays shown here are fictional. This open site is NOT connected to paid MySportsFeeds or real-time NFL games.';game.prepend(note)}})})();\n";
writeFileSync(join(out,'demo-exact-overlay.js'),overlay);
const originalWorker=readFileSync(join(src,'_worker.js'),'utf8');
if(!originalWorker.includes('export default {async fetch'))throw Error('Original PFO worker export boundary missing');
const mergedWorker=originalWorker.replace('export default {async fetch','const realWorker={async fetch')+
 '\n'+readFileSync(join(root,'demo-exact/worker-gateway.js'),'utf8')+'\n';
writeFileSync(join(out,'_worker.js'),mergedWorker);
console.log('Exact PFO frontend files: '+count+'; fictional teams: '+rosters.length+'; synthetic modeled players: '+models.length);
