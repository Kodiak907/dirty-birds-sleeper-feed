import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
const read=n=>readFileSync(new URL('./'+n,import.meta.url),'utf8');
const core=read('ffo-pfo-core.js'),quick=read('ffo-quickview.js'),sit=read('ffo-startsit-63.js');

test('season-only usage signals appear without fabricating a per-week trend',()=>{
 const a=core.indexOf('function pfo49Signal(id)'),b=core.indexOf('function pfo49RadarPool()',a);
 assert.ok(a>=0&&b>a);
 const ctx=createContext({pfo50StatsFor:()=>({team:'SEA',games_observed:8,season_totals:{targets:48,rec:28},games:[]}),
  pfo49Metric:()=>null,pfo49Info:()=>({id:'te1',team:'SEA',name:'Fixture TE',position:'TE'}),
  pfo49Trend:new Map()});
 new Script(core.slice(a,b)+'\nthis.signal=pfo49Signal;').runInContext(ctx);
 const x=ctx.signal('te1');
 assert.equal(x.coverage,'season');
 assert.equal(x.targets,6);
 assert.equal(x.catches,3.5);
 assert.equal(x.volumeChange,null);
 assert.equal(x.newestWeek,null);
});

test('radar does not empty merely because a cached Sleeper ownership snapshot became stale',()=>{
 const a=core.indexOf('function pfo49RadarPool()'),b=core.indexOf('function pfo49SignalHTML(',a);
 assert.ok(a>=0&&b>a);
 const ctx=createContext({pfo49Players:[{id:'te1',name:'Fixture TE',team:'SEA'}],
  pfo49Dir:()=>[],pfo49Metrics:{players:{te1:{}}},pfo50Indexed:new Map(),
  leagueOwnedIds:new Set(),ownershipCheckedMs:1,waiverIsRostered:()=>false,
  pfo49Signal:()=>({id:'te1',coverage:'season',newestWeek:null}),
  pfo50Key:(n,t)=>n+'|'+t,window:{dbNflWeek:9}});
 new Script(core.slice(a,b)+'\nthis.radar=pfo49RadarPool;').runInContext(ctx);
 assert.equal(ctx.radar().length,1);
 ctx.leagueOwnedIds=null;
 assert.equal(ctx.radar().length,0,'without any ownership source, no availability-oriented Radar results');
});

test('general NFL research remains available through stale ownership, but certified waivers do not',()=>{
 const a=core.indexOf('const pfo52OldFind=pfo51FindPlayers;'),b=core.indexOf('const pfo52OldAsk=pfo51Ask;',a);
 assert.ok(a>=0&&b>a);
 const ctx=createContext({pfo51FindPlayers:()=>({entries:[{id:'te1',stat:{}}],total:1}),
  leagueOwnedIds:new Set(),ownershipCheckedMs:1,
  liveRosterSnapshot:{players:[]},pfo52Info:()=>({name:'Fixture TE'}),
  waiverIsRostered:()=>false,Date});
 new Script(core.slice(a,b)+'\nthis.find=pfo51FindPlayers;').runInContext(ctx);
 const general=ctx.find('tight ends with season volume');
 assert.equal(general.total,1);
 assert.equal(general.ownershipUnverified,true);
 assert.match(ctx.find('available tight ends').error,/ownership|Sleeper/i);
});

test('Player Intel uses sourced season averages if weekly splits are absent and does not call current zero final',()=>{
 assert.match(quick,/const observed=Number\(d\.ind\?\.games_observed/);
 assert.match(quick,/2026 season average/);
 assert.match(quick,/season\[key\]/);
 assert.match(quick,/current&&zero&&!hasGame/);
 assert.match(quick,/Pregame \/ current-week result unverified/);
});

test('Championship Week 15–17 model identical numbers clearly marked season baseline',()=>{
 const a=core.indexOf('// Championship is entirely Dirty Birds playoff player research.');
 const b=core.indexOf('// Scouting K/DST',a);
 assert.ok(a>=0&&b>a);
 const s=core.slice(a,b);
 assert.match(s,/SEASON BASELINE/);
 assert.match(s,/not matchup-certified/);
 assert.match(s,/OPP-ADJUSTED/);
 assert.doesNotMatch(s,/past recorded FFL point averages/);
});

test('Start/Sit contains compact GM evidence and preserves original full source card on demand',()=>{
 assert.match(sit,/pfo614-gm-digest/);
 assert.match(sit,/Full original GM research/);
 assert.match(sit,/gm47Card\(report,true\)/);
 assert.match(sit,/Period forecast not certified/);
 assert.match(sit,/Weekly model pending/);
});

test('core and modified mobile scripts parse',()=>{
 new Script(core,{filename:'ffo-pfo-core.js'});
 new Script(quick,{filename:'ffo-quickview.js'});
 new Script(sit,{filename:'ffo-startsit-63.js'});
});
