import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const load=p=>JSON.parse(read(p));
const html=read('./index.html'),core=read('./ffo-pfo-core.js'),worker=read('./_worker.js'),
 com=read('./ffo-commissioner-57.js'),newUI=read('./ffo-pfo-59.js'),
 champ=read('./ffo-championship-59.js'),chart=load('./FFO_CHAMPIONSHIP_100K.json');

test('Every changed browser script and Worker parses',()=>{
 for(const [name,code] of Object.entries({core,com,newUI,champ,worker:worker.replace(/\bexport\s+default\s+/,'const workerDefault = ')}))
  assert.doesNotThrow(()=>new Script(code,{filename:name}),name);
});

test('Original overview, GameCast, roster and matchup continue to exist',()=>{
 for(const id of ['overview','roster','matchup','championship','gamecast','market','commissioner','availability','radar'])
  assert.match(html,new RegExp('id="'+id+'"'));
 for(const file of ['ffo-pfo-core.js','ffo-quickview.js','ffo-pfo-59.js','ffo-championship-59.js','ffo-commissioner-57.js'])
  assert.ok(html.includes('/'+file),file);
 const overview=html.split('<section class="page active" id="overview">')[1]?.split('<section class="page" id="roster">')[0];
 assert.ok(overview&&overview.length>1000);
 assert.doesNotMatch(overview,/pfo59-champ-odds|100,000.*title|championship_probability/);
 assert.match(champ,/const page=\$\('championship'\)/);
});

test('New market and team hub are distinct and feature preserving',()=>{
 for(const a of ['trade','waiver','transactions'])
  assert.ok(newUI.includes('data-pfo59-market-panel="'+a+'"'),a);
 for(const a of ['roster','schedule','news'])
  assert.ok(newUI.includes('data-pfo59-team-panel="'+a+'"'),a);
 assert.match(newUI,/ffoQuickView\?\.open/);
 assert.match(newUI,/id==='3'/);
 assert.match(newUI,/Number\(r\.roster_id\)===3/);
 assert.match(core,/function pfo53Simulate\(/);
 assert.match(html,/id="trade-fold"/);
 assert.match(html,/id="waiver-fold"/);
 assert.match(html,/id="faabpanel"/);
 assert.match(newUI,/Array\.from\(\{length:14\}/);
 assert.match(newUI,/const missing=Array\.from\(\{length:14\}/);
 assert.match(newUI,/Playoffs · opponent TBD/);
 assert.match(newUI,/if\(result\.status==='fulfilled'&&Array\.isArray\(result\.value\)&&result\.value\.length===12\)/);
 assert.doesNotMatch(newUI,/\[\.\.\.Array\(18\)\]/);
});

test('100,000-trial Monte Carlo report conserves entrants, byes, finalists and winners',()=>{
 assert.equal(chart.schema,'FFO_CHAMPIONSHIP_100K_V1');
 assert.equal(chart.simulations,100000);
 assert.equal(chart.teams.length,12);
 const totals={playoff:0,bye:0,final:0,title:0};
 for(const t of chart.teams){
  for(const key of Object.keys(totals)){totals[key]+=t.counts[key];assert.equal(t[key==='playoff'?'playoff_probability':key==='title'?'championship_probability':key+'_probability'],t.counts[key]/chart.simulations);}
  assert.ok(t.playoff_probability>=t.final_probability&&t.final_probability>=t.championship_probability);
 }
 assert.deepEqual(totals,{playoff:600000,bye:200000,final:200000,title:100000});
 assert.ok(chart.teams.some(t=>t.roster_id===1));
});

test('Commissioner Log actions remain separated and protected, with video evidence allowed',()=>{
 assert.match(com,/data-com57-tab="log"/);
 assert.match(com,/data-com57-panel="scores"/);
 assert.match(com,/data-com57-panel="audit"/);
 assert.match(com,/log\.appendChild\(node\)/);
 assert.match(core,/const comSubmissionInFlight=new Set\(\)/);
 assert.match(core,/comUploadEvidence\(c\.id,file\)/);
 assert.match(html,/General league administration/);
 assert.match(worker,/COMMISSIONER_EVIDENCE\.put/);
 assert.match(worker,/new FixedLengthStream\(declared\)/);
 assert.match(worker,/new crypto\.DigestStream\('SHA-256'\)/);
 assert.match(worker,/Promise\.allSettled\(tasks\)/);
 assert.match(worker,/video\/quicktime/);
 assert.match(worker,/75\*1024\*1024/);
 assert.match(worker,/FILE_CONTENT_INVALID/);
 assert.match(worker,/await comSession\(/);
});

test('Team-specific waiver ranking uses completed FFL weekly scores, not one list for all',()=>{
 const instrument=newUI.replace(' window.ffoPfo59={openMarket:marketView,refreshAdvisory:loadAdvisory};',
  ' window.__qa={state,needs,entryPool,waiver,trade,scheduleRender};');
 assert.notEqual(instrument,newUI);
 const elements=new Map(),doc={readyState:'loading',addEventListener:()=>{},
  getElementById(id){if(!elements.has(id))elements.set(id,{innerHTML:'',querySelector:()=>null});return elements.get(id)},
  querySelectorAll:()=>[]};
 const win={};new Function('document','window',instrument)(doc,win);
 const qa=win.__qa;assert.ok(qa);
 const snap=load('../data/fast_latest.json'),history=load('../data/latest.json'),
 names=load('../data/player_names.json'),scout=load('../data/AUTOMATED_WAIVER_SCOUTING.json'),
 ideas=load('../data/TRADE_IDEAS.json');
 Object.assign(qa.state,{snap,history,names,scout,ideas});
 const m1=qa.needs('1'),m4=qa.needs('4'),m11=qa.needs('11');
 assert.ok(Object.keys(m1.historical).length>0);
 assert.ok(Object.keys(m4.historical).length>0);
 assert.notDeepEqual(m1.historical,m4.historical);
 assert.notDeepEqual(m4.historical,m11.historical);
 const pool=qa.entryPool();
 assert.ok(pool.length>0&&pool.every(p=>!snap.rosters.some(r=>(r.players||[]).includes(p.id))));
 const available=new Set(pool.map(p=>p.id));
 assert.ok(available.size===pool.length);
 qa.state.manager='1';qa.waiver();
 const dirty=elements.get('pfo59-waiver-board').innerHTML;
 assert.match(dirty,/Recorded FFL scoring weaknesses:/);
 assert.match(dirty,/data-pfo59-player/);
 qa.state.manager='4';qa.waiver();
 assert.notEqual(dirty,elements.get('pfo59-waiver-board').innerHTML);
 qa.state.manager='9';qa.trade();
 assert.match(elements.get('pfo59-trade-board').innerHTML,/Choose any trade-eligible FFL manager/);
 qa.state.manager='9';qa.trade();assert.match(elements.get('pfo59-trade-board').innerHTML,/data-pfo59-pick=/);
 assert.match(elements.get('pfo59-trade-board').innerHTML,/Dirty Birds · Give/);
 assert.match(elements.get('pfo59-trade-board').innerHTML,/Receive/);
});

test('Real Sleeper manager-independent archive retains completed weeks and sensible timestamp',()=>{
 const snap=load('../data/latest.json');
 assert.equal(snap.rosters.length,12);
 assert.ok(new Date(chart.roster_snapshot_as_of)<new Date(Date.now()+300000));
 assert.ok(chart.roster_snapshot_as_of&&chart.fixture_source.complete);
 assert.deepEqual(chart.fixture_source.weeks,[8,9,10,11,12,13,14]);
 for(const week of [1,2,3,4,5,6,7])
  assert.equal(snap.matchups_by_week[String(week)]?.length,12);
});
