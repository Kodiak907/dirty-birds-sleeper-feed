// PFO 5.9.7 source-scoped regression suite. Never executes Sleeper writes or Commissioner operations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
const js=read('./ffo-pfo-597.js'),market=read('./ffo-pfo-59.js'),core=read('./ffo-pfo-core.js'),mobile=read('./ffo-mobile-594.js'),html=read('./index.html'),css=read('./ffo-pfo-597.css'),meta=read('./ffo-waiver-meta-597.js');
test('5.9.7 assets parse, load after previous model and preserve Commissioner boundaries',()=>{
 for(const [name,src] of Object.entries({js,market,core,mobile,meta}))assert.doesNotThrow(()=>new Script(src,{filename:name}),name);
 assert.match(html,/5\.9\.7 COACH REVIEW/);
 assert.match(html,/ffo-waiver-meta-597\.js\?v=597/);
 assert.match(html,/ffo-pfo-597\.js\?v=597/);
 assert.match(html,/ffo-pfo-597\.css\?v=597/);
 assert.doesNotMatch(js,/\/api\/commissioner\/.*POST/);
 assert.match(css,/#pfo59-waiver-board/);
});
test('Trade Clear fully resets the opposing manager and stale evaluation on request',()=>{
 const at=market.indexOf("if(ev.target.closest('[data-pfo59-clear]'))"),end=market.indexOf("if(ev.target.closest('[data-pfo59-compare]'))",at);
 assert.ok(at>=0&&end>at);
 const action=market.slice(at,end);
 assert.match(action,/state\.tradeGive=\[\];state\.tradeTake=\[\]/);
 assert.match(action,/querySelectorAll\('\[data-pfo59-pick\]'\)/);
 assert.match(action,/state\.manager='1'/);
 assert.match(action,/managerOptions\(\);trade\(\)/);
 assert.match(action,/clearEvaluation/);
});
test('Original waiver views include personalized All, neutral positions, Veterans, IR and Leaders',()=>{
 assert.match(market,/waiverView:'available'/);
 assert.match(market,/data-pfo597-waiver-view/);
 assert.match(market,/data-pfo597-waiver-pos/);
 assert.match(market,/VETS/);
 assert.match(market,/INJURED\[_-]\?RESERVE|INJURED/);
 assert.match(market,/state\.waiverView==='available'&&state\.position==='ALL'/);
 assert.match(market,/pfo50Score/);
 assert.match(market,/broadenWaiverDirectory/);
 assert.doesNotMatch(mobile,/searchInput/);
 assert.match(css,/#nav button\[data-page="overview"\]/);
});
test('Both matchup teams open player cards; no Sleeper scoring for live estimates',()=>{
 assert.match(core,/class="pfo597-player-link" type="button" data-pfo49-id/);
 assert.match(core,/class="pfo52-pill pfo597-player-pill" data-pfo49-id/);
 assert.match(js,/FFO independent NFL-stat forecast under FFL scoring/);
 assert.match(js,/pfo50Score\(g\.stats\|\|g\)/);
 assert.doesNotMatch(js,/sleeperGet\(/);
});
test('A sourced playing week gets an independent FFL projection while a verified bye gets BYE',async()=>{
 const teams=Object.fromEntries(Array.from({length:32},(_,i)=>['TEAM'+i,{weeks:{}}]));
 teams.MIA={weeks:{8:{opponent:'NE'}}};teams.SF={weeks:{8:{bye:true}}};
 let callback=null;
 const doc={readyState:'loading',getElementById:()=>null,querySelector:()=>null,addEventListener(name,cb){if(name==='DOMContentLoaded')callback=cb;}};
 const ctx=createContext({window:{dbNflWeek:8},document:doc,console,Date,Map,
  pfo52Points:()=>({points:null,schedulePending:true,source:'Schedule unverified'}),
  pfo52Info:id=>id==='bye'?{name:'X',team:'SF',position:'WR'}:{name:'Y',team:'MIA',position:'RB'},
  pfo50Estimate:()=>12.4,
  tb48ReportHTML:()=>'<div>old full PPR reference</div>',
  tb45Player:id=>({name:'Player '+id}),
  tb45Manager:()=> 'Opponent',
  fetchReport:async()=>({teams}),
  navigator:{clipboard:{writeText:async()=>{}}}
 });
 new Script(js).runInContext(ctx);
 assert.ok(callback,'startup lifecycle registered');
 await ctx.window.ffoPfo597.loadSchedule();
 const playing=ctx.pfo52Points('play',8),bye=ctx.pfo52Points('bye',8);
 assert.equal(playing.points,12.4);
 assert.equal(playing.opponent,'NE');
 assert.equal(bye.points,null);
 assert.equal(bye.bye,true);
});
test('Two-sided trade research is FFL-derived, never reports misleading full-PPR percentage',()=>{
 const ctx=createContext({window:{},document:{readyState:'loading',getElementById:()=>null,querySelector:()=>null,addEventListener(){}},navigator:{},console,Date,
  pfo52Points:()=>null,pfo50Estimate:()=>9.7,pfo52Info:()=>({team:'MIA',position:'RB'}),
  tb48ReportHTML:()=>'',tb45Player:id=>({name:'Player '+id}),tb45Manager:()=> 'Opponent'
 });
 new Script(js).runInContext(ctx);
 const report=ctx.tb48ReportHTML({give:['1'],take:['2'],x:{opponent:'4'},ourDelta:3.1,theirDelta:-3.1,ourBenchDelta:0,theirBenchDelta:0,ourCut:[],theirCut:[],injuryFlags:[]});
 assert.match(report,/FFL-specific trade evaluation/);
 assert.match(report,/FFL PPG/);
 assert.doesNotMatch(report,/55\.6%|listed market value|full-PPR market units/);
});

test('Frozen FFL league rules, not Sleeper market pricing, determine player point values',async()=>{
 const official=JSON.parse(read('./FFO_FFL_SCORING_V1.json'));
 const doc={readyState:'loading',getElementById:()=>null,querySelector:()=>null,addEventListener(){}};
 const ctx=createContext({window:{},document:doc,console,Date,Map,
  pfo49ScoreFromStats:()=>({points:-999}),pfo50Estimate:()=>null,
  fetch:async()=>({ok:true,json:async()=>official})});
 new Script(js).runInContext(ctx);
 await ctx.window.ffoPfo597.loadFFLRules();
 assert.equal(ctx.window.ffoPfo597.hasFrozenRules(),true);
 const row=ctx.pfo49ScoreFromStats({rec:6,rec_yd:80,rec_td:1});
 const expectation=6*official.scoring.rec+80*official.scoring.rec_yd+official.scoring.rec_td;
 assert.equal(row.points,expectation);
 assert.equal(ctx.pfo49ScoreFromStats({made_up_stat:7}),null);
 assert.equal(row.source.includes('FFO_FFL_SCORING_V1.json'),true);
});
