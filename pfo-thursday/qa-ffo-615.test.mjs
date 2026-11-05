import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
const read=n=>readFileSync(new URL('./'+n,import.meta.url),'utf8');
const core=read('ffo-pfo-core.js'),market=read('ffo-pfo-59.js'),intro=read('ffo-overview-62.js'),
 compare=read('ffo-startsit-63.js'),gc=read('ffo-gamecast.js'),html=read('index.html'),
 layoutCss=read('ffo-layout-64.css'),health=read('ffo-pfo-611.js');

test('automatic Team HQ schedule fetches every remaining regular-season week without manual button or cached-history dependency',async()=>{
 const a=market.indexOf('async function loadSchedule(full=false)'),b=market.indexOf('function teamTxnRender()',a);
 assert.ok(a>0&&b>a);
 const schedule=new Map(),visited=[],scope=createContext({console,Date,Promise,Map,
  state:{snap:{nfl_state:{week:9}},schedule,history:null,scheduleAt:0,loadingSchedule:false},
  window:{dbNflWeek:9},
  scheduleRender:()=>{},fetchReport:async()=>{throw Error('offline archived snapshot')},
  pfo52GetWeek:async w=>{visited.push(w);return Array.from({length:12},(_,i)=>({roster_id:i+1,matchup_id:i+1}))},
  $:()=>null});
 new Script(market.slice(a,b)+'\nthis.schedule=loadSchedule;').runInContext(scope);
 await scope.schedule();
 assert.deepEqual(visited.sort((a,b)=>a-b),[9,10,11,12,13,14]);
 assert.equal(schedule.size,6);
 assert.ok(scope.state.scheduleAt>0);
});
test('MSF fallback prioritizes submitted starters before any 16-team truncation',()=>{
 const a=core.indexOf('function pfo69RelevantTeams()'),b=core.indexOf('function pfo69SourceStatus()',a);
 assert.ok(a>=0&&b>a);
 const teams='ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' ');
 const people=teams.map((team,i)=>({player_id:String(i+1),team}));
 const starts=['21','16','12','1','2','3','4','5','6','7'];
 const ctx=createContext({liveRosterSnapshot:{players:people,starters:starts},gm47Snapshot:{rosters:[{roster_id:1,players:people.map(p=>p.player_id),starters:starts}]},
  window:{dbRosterId:1,dbNflWeek:9},pfo69TeamCodes:new Set(teams),
  gm47CanonicalTeam:x=>x,pfo49Info:id=>people[Number(id)-1],
  pfo52Cur:()=>9,pfo52Match:()=>null});
 new Script(core.slice(a,b)+'\nthis.teams=pfo69RelevantTeams;').runInContext(ctx);
 const result=ctx.teams();
 assert.equal(result[0],'MIN');
 assert.equal(result.length,24);
 assert.ok(starts.every(id=>result.includes(people[Number(id)-1].team)));
});
test('Ask Front Office does not confuse targets/snaps metric requests with growth trends',()=>{
 const a=core.indexOf('function pfo51FindPlayers(q)'),b=core.indexOf('function pfo51Ask(q)',a);
 assert.ok(a>=0&&b>a);
 const ctx=createContext({pfo49Players:[{id:'w1',name:'Wide Receiver Test',team:'SEA',position:'WR'}],
  pfo49Dir:()=>[],liveRosterSnapshot:{players:[]},leagueOwnedIds:new Set(),ownershipCheckedMs:Date.now(),
  waiverIsRostered:()=>false,pfo51PlayerSummary:id=>({row:{season_totals:{targets:36}},
   week:0,forecast:10.2,p:{position:'WR',team:'SEA'}}),pfo49Signal:()=>null});
 new Script(core.slice(a,b)+'\nthis.search=pfo51FindPlayers;').runInContext(ctx);
 const x=ctx.search('WRs with targets above five');
 assert.equal(x.total,1);
 assert.equal(x.trend,false);
 const y=ctx.search('rising WR targets');
 assert.equal(y.total,1,'sourced baseline leads remain visible when weekly trend evidence is missing');
 assert.equal(y.trendUnverified,true);
});
test('trade lab is only visible in Analyzer and maintains direct result navigation',()=>{
 assert.match(layoutCss,/data-pfo64-trade="finder"] #trade-fold\{display:none!important/);
 assert.match(layoutCss,/data-pfo64-trade="lab"] #trade-fold/);
 assert.match(read('ffo-layout-64.js'),/data-pfo61-review/);
});
test('lineup lab visibly identifies every submitted-to-preview swap and preserves Sleeper',()=>{
 assert.match(core,/pfo615-swapped/);
 assert.match(core,/pfo615-swap-summary/);
 assert.match(core,/IN: /);
 assert.match(core,/OUT: /);
 assert.match(core,/Green highlight identifies changes/);
 assert.match(core,/Sleeper has not been modified/);
});
test('Start/Sit has compact evidence matrix, not two duplicated expanded scouting reports',()=>{
 assert.match(compare,/pfo615-matrix/);
 assert.match(compare,/At a glance/);
 assert.match(compare,/Missing is shown as/);
 assert.match(compare,/Full original GM research/);
});
test('all briefing modes reuse the same independent weekly points and give per-player insight',()=>{
 assert.match(intro,/pfo52Points\(String\(id\),Number\(week\)\)/);
 assert.match(intro,/Submitted lineup · individual model coverage/);
 assert.match(intro,/Bench research · flexibility and coverage/);
 assert.match(intro,/Opponent intelligence/);
 assert.match(intro,/Player news · source-linked developments/);
 assert.doesNotMatch(intro,/index\?\.estimate\?\./);
});
test('GameCast restores previously visited authenticated MSF weeks, never manufactures results',()=>{
 assert.match(gc,/weekboardHistory=new Map/);
 assert.match(gc,/function restoreWeekboard\(week\)/);
 assert.match(gc,/weekNav\.mergeVerifiedWeekScore/);
 assert.match(gc,/requestedWeek<current&&cached&&Date\.now\(\)-cached\.at<10\*60\*1000/);
 assert.match(gc,/drawGames\(\);restoreWeekboard\(n\);drawPlays\(\)/);
});
test('Data Health discloses exact source-specific reasons for missing starter projections',()=>{
 assert.match(health,/pfo615-coverage-details/);
 assert.match(health,/MSF did not load/);
 assert.match(health,/MSF games-played denominator missing/);
 assert.match(health,/FG-distance\/XP/);
 assert.match(health,/model validation or availability pending/);
});
test('modified browser scripts parse under Node',()=>{
 for(const name of ['ffo-pfo-core.js','ffo-overview-62.js','ffo-startsit-63.js',
  'ffo-pfo-59.js','ffo-gamecast.js','ffo-pfo-611.js'])
  new Script(read(name),{filename:name});
});
