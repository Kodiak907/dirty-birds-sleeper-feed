import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
const load=name=>readFileSync(new URL('./'+name,import.meta.url),'utf8');
const html=load('index.html'),core=load('ffo-pfo-core.js'),worker=load('_worker.js');
const start=load('ffo-startsit-63.js'),trade=load('ffo-trade-60.js');
test('duplicate GM navigation retired but legacy source evidence retained for Start/Sit',()=>{
 assert.doesNotMatch(html,/<button data-page="scouting">/);
 assert.match(html,/id="scouting"/);
 assert.match(start,/gm47Analysis/);
 assert.match(start,/gm47Card/);
 assert.match(start,/data-pfo612-deep/);
 assert.match(start,/pfo52Points/);
 assert.match(start,/pfo50StatsFor/);
 assert.doesNotMatch(start,/players_points\s*\[/i);
});
test('data-health diagnostics collapsed but status IDs preserved',()=>{
 assert.match(html,/<details class="pfo612-data-health"[^>]*>/);
 assert.match(html,/id="ffo69-stats-status"/);
 assert.match(html,/id="ffo69-retry-stats"/);
 assert.match(html,/<\/button><\/details><div id="ffo55-lineup-audit"/);
});
test('independent forecast no longer falls back to Sleeper-scored weekly points',()=>{
 const method=core.slice(core.indexOf('function pfo52Points('),core.indexOf('function pfo52DefenseAdjustment('));
 assert.doesNotMatch(method,/players_points/);
 assert.doesNotMatch(method,/Sleeper previous scored weeks/);
 assert.match(method,/pfo50Estimate/);
});
test('worker preserves absent kicker input as unknown and supports additional published aliases',()=>{
 const beginning=worker.indexOf('function ffo598NormalizeSeason('),ending=worker.indexOf('const ffo598SeasonCache');
 assert.ok(beginning>0&&ending>beginning,'MSF normalizer extraction');
 const ctx=createContext({});
 new Script(worker.slice(beginning,ending)+'\nthis.run=ffo598NormalizeSeason;').runInContext(ctx);
 const out=ctx.run({playerStatsTotals:[{
  player:{fullName:'Will Reichard',id:'demo-id',primaryPosition:{abbreviation:'K'}},
  team:{abbreviation:'MIN'},
  stats:{gamesPlayedTotal:8,fieldGoals:{fgMade40To49:4},kicking:{fgMade20To29:2,xpMade:18}}
 }]},'2026-11-05T12:00:00Z');
 assert.equal(out.players[0].position,'K');
 assert.equal(out.players[0].games_observed,8);
 assert.equal(out.players[0].forecast.fgm_40_49,0.5);
 assert.equal(out.players[0].forecast.fgm_20_29,0.25);
 assert.equal(out.players[0].forecast.xpm,2.25);
 assert.equal(out.players[0].forecast.fgm_60p,undefined,'missing buckets not fabricated');
});
test('same-team and position matching stays strict',()=>{
 const a=core.indexOf('function pfo50StatsFor('),b=core.indexOf('function pfo50Score(');
 const ctx=createContext({pfo49Info:()=>({name:'Kyren Williams Jr.',team:'LAR',position:'RB'}),
  pfo50Key:(n,t)=>n+'|'+t,
  gm47CanonicalTeam:x=>x,
  pfo50Indexed:new Map([['a',{name:'Kyren Williams',team:'LAR',position:'RB'}],['b',{name:'Kyren Williams',team:'SF',position:'RB'}]])
 });
 new Script(core.slice(a,b)+'\nthis.lookup=pfo50StatsFor;').runInContext(ctx);
 assert.equal(ctx.lookup('x').team,'LAR');
 ctx.pfo50Indexed.set('c',{name:'Kyren Williams',team:'LAR',position:'RB'});
 assert.equal(ctx.lookup('x'),null,'ambiguous aliases withheld');
});
test('trade evaluation keeps two-sided model and conditional warnings',()=>{
 assert.match(trade,/starterDelta\.ours/);
 assert.match(trade,/starterDelta\.theirs/);
 assert.match(trade,/r\.rosterCuts\.ours/);
 assert.match(trade,/FFL starter deltas are research estimates/);
 assert.match(trade,/No acceptance implied/);
});
test('source and script syntax parsed without runtime API dependency',()=>{
 new Script(start,{filename:'ffo-startsit-63.js'});
 new Script(trade,{filename:'ffo-trade-60.js'});
});