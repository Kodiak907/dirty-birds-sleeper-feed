import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installScoringResearch} from './ffo-scoring-research-controller.mjs';
const games=[
 {id:'gb1',week:1,status:'FINAL',home:'GB',away:'CHI',start:'2026-09-13T17:00:00Z'},
 {id:'gb2',week:2,status:'COMPLETED',home:'MIN',away:'GB',start:'2026-09-20T17:00:00Z'},
 {id:'ny3',week:3,status:'FINAL',home:'NYJ',away:'BUF',start:'2026-09-27T17:00:00Z'}
];
function setup(storage=null,options={}){
 const ui={};
 const root={defaultView:{document:{get visibilityState(){return options.visibility||'visible'}}},getElementById(id){
  if(!ui[id])ui[id]={id,innerHTML:'',textContent:'',disabled:false,handlers:{},
   addEventListener(type,fn){this.handlers[type]=fn}};
  return ui[id];
 }};
 const requests=[];
 const feed=async(name,args)=>{
  requests.push({name,...args});
  if(name==='plays'&&options.failOnce){
   options.failOnce=false;throw Error('MSF rate limit 429');
  }
  if(name==='plays'&&options.alwaysFail)throw Error('MSF gateway 502');
  if(name==='plays'&&options.alwaysRateLimit)throw Error('MSF rate limit 429');
  if(name==='plays'&&options.missingForGame===args.game_id)
   return {available:false,error:'provider_feed_not_found'};
  if(name==='plays'&&options.accessFail)
   return {available:false,error:'provider_auth_or_entitlement_denied'};
  if(name==='plays')return {data:{plays:[{id:'a'}]}};
  if(name==='boxscore')return {data:{gameboxscore:{}}};
  if(name==='gamelogs')return {data:{team:args.team,gameId:'gb1'}};
  throw Error('not supported');
 };
 const model={
  inspectHistoricalGame(){return {diagnostics:{hasPublishedPlays:true,describedCount:25},
   usablePlaySequence:true,boxScorePublished:true,providerFinal:true,matchesSchedule:true}},
  playerRows(payload){return [{id:'1',team:payload.team,
   game:{id:payload.gameId},name:'Verified Actor'}]}
 };
 return {root,requests,ui,api:installScoringResearch({
  root,feed,model,season:'2026-regular',getSchedule:()=>games,storage,
  sleep:options.sleep||(()=>Promise.resolve())
 })};
}
test('PFO read-only scoring research shows MSF source coverage, not certified points',()=>{
 const {api,ui}=setup();
 const c=api.getReadiness();
 assert.equal(c.sourceGames,3);
 assert.equal(c.teamsRepresented,5);
 assert.equal(c.certifiedPlayerGameScores,0);
 assert.equal(c.productionProjectionEligible,false);
 assert.equal(c.productionScoreWriteAllowed,false);
 assert.match(ui['ffo-gc-research-status'].innerHTML,/GB matchups/);
 assert.equal(api.getProductionProjection('18607',8),null);
 assert.equal(api.getCertifiedPlayerScore('18607','gb1'),null);
});
test('GB is first: two user-triggered games read source PBP, boxscore and two team game logs',async()=>{
 const {api,requests,ui}=setup();
 assert.equal(api.getInspectedGames(),0);
 await api.runNextBatch();
 assert.equal(api.getInspectedGames(),2);
 assert.equal(requests.length,8);
 assert.deepEqual(requests.filter(x=>x.name==='plays').map(x=>x.game_id),['gb1','gb2']);
 assert.equal(api.getReadiness().certifiedPlayerGameScores,0);
 assert.match(ui['ffo-gc-research-status'].innerHTML,/0 complete player scores certified/);
 assert.equal(ui['ffo-gc-research-next'].disabled,false);
 await api.runNextBatch();
 assert.equal(api.getInspectedGames(),3);
 assert.deepEqual(requests.filter(x=>x.name==='plays').map(x=>x.game_id),['gb1','gb2','ny3']);
 assert.equal(ui['ffo-gc-research-next'].disabled,true);
});
test('Backtest cannot produce projections from mere MSF source fetches or game-score observations',()=>{
 const {api,ui}=setup();
 const result=api.getBacktest();
 assert.equal(result.status,'insufficient_certified_data');
 assert.equal(result.productionEligible,false);
 assert.match(ui['ffo-gc-research-status'].innerHTML,/Backtest withheld/);
});
test('Scoring controller has no write path and no Sleeper score dependence',()=>{
 const text=readFileSync(new URL('./ffo-scoring-research-controller.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(text,/fetch\(|api\.sleeper|writeScore|updateCommissioner|productionProjectionEligible:true/);
});

test('Historical MSF evidence checkpoints survive reload without storing PBP content or credentials',async()=>{
 const values=new Map(),store={
  getItem:k=>values.get(k)??null,
  setItem:(k,v)=>{values.set(k,v)}
 };
 const first=setup(store);
 await first.api.runNextBatch();
 assert.equal(first.api.getInspectedGames(),2);
 assert.equal(values.size,1);
 const persisted=[...values.values()][0];
 assert.match(persisted,/"schema":1/);
 assert.doesNotMatch(persisted,/MySportsFeeds.*token|sourcePlayRows|playerStatsTotals|passYards|api_key/i);
 const second=setup(store);
 assert.equal(second.api.getInspectedGames(),2);
 assert.equal(second.api.getSourceCheck('gb1')?.checkedAt!=null,true);
 assert.equal(second.api.getProductionProjection('18607',8),null);
 await second.api.runNextBatch();
 assert.equal(second.api.getInspectedGames(),3);
 assert.deepEqual(second.requests.filter(r=>r.name==='plays').map(r=>r.game_id),['ny3']);
});
test('Stale and malicious historical verification cache cannot certify scores',()=>{
 const values=new Map(),store={
  getItem:()=>JSON.stringify({schema:1,entries:{
   '../../outside':{checkedAt:new Date().toISOString(),finalPlayerScoreRecomputed:true},
   gb1:{checkedAt:'2020-01-01T00:00:00Z',finalPlayerScoreRecomputed:true},
   gb2:{checkedAt:new Date().toISOString(),finalPlayerScoreRecomputed:true,credential:'secret',
    playerGameLogsVerified:true}
  }}),
  setItem:(k,v)=>values.set(k,v)
 };
 const {api}=setup(store);
 assert.equal(api.getInspectedGames(),1);
 assert.equal(api.getSourceCheck('gb2').credential,undefined);
 assert.equal(api.getReadiness().certifiedPlayerGameScores,0);
 assert.equal(api.getCertifiedPlayerScore('18607','gb2'),null);
});

test('One-tap auto-scan processes every remaining game, checkpointing and exiting cleanly',async()=>{
 const storeMap=new Map(),storage={
  getItem:key=>storeMap.get(key)||null,
  setItem:(key,value)=>storeMap.set(key,value)
 };
 let delays=0;
 const {api,ui,requests}=setup(storage,{sleep:async()=>{delays++}});
 assert.equal(ui['ffo-gc-research-all'].disabled,false);
 const result=await api.runRemainingChecks();
 assert.deepEqual({reason:result.reason,checked:result.checked,remaining:result.remaining},
  {reason:'complete',checked:3,remaining:0});
 assert.equal(api.getInspectedGames(),3);
 assert.equal(api.getScanState().autoActive,false);
 assert.equal(ui['ffo-gc-research-all'].disabled,true);
 assert.equal(ui['ffo-gc-research-pause'].disabled,true);
 assert.ok(delays>=1);
 assert.equal(requests.filter(x=>x.name==='plays').length,3);
 const reloaded=setup(storage);
 assert.equal(reloaded.api.getInspectedGames(),3);
 assert.equal((await reloaded.api.runRemainingChecks()).started,false);
});
test('Pause stops after current batch; pressing run remaining resumes without duplicates',async()=>{
 let api,pauses=0;
 const options={sleep:async(ms)=>{pauses++;if(ms===4500)api.pauseRemainingChecks()}};
 const instance=setup(null,options);api=instance.api;
 const partial=await api.runRemainingChecks();
 assert.equal(partial.reason,'paused');
 assert.equal(partial.checked,2);
 assert.equal(partial.remaining,1);
 assert.equal(pauses,1);
 const done=await api.runRemainingChecks();
 assert.equal(done.reason,'complete');
 assert.equal(done.checked,1);
 assert.equal(done.remaining,0);
 assert.deepEqual(instance.requests.filter(x=>x.name==='plays').map(x=>x.game_id),['gb1','gb2','ny3']);
});
test('Transient MSF rate limiting gets one paced retry then completes when restored',async()=>{
 const waits=[],options={failOnce:true,sleep:async(ms)=>{waits.push(ms)}};
 const {api,requests}=setup(null,options);
 const scan=await api.runRemainingChecks();
 assert.equal(scan.reason,'complete');
 assert.equal(scan.checked,3);
 assert.equal(scan.remaining,0);
 assert.equal(api.getSourceCheck('gb1').sourceFailure,false);
 assert.ok(waits.filter(ms=>ms===5000).length>=12,'60-second backoff performed in interruptible chunks');
 assert.deepEqual(requests.filter(x=>x.name==='plays').map(x=>x.game_id),
  ['gb1','gb1','gb2','ny3']);
});
test('Per-game missing MSF feed leaves source pending while checking other games',async()=>{
 const {api,requests,ui}=setup(null,{missingForGame:'gb1',sleep:async()=>{}});
 const scan=await api.runRemainingChecks();
 assert.equal(scan.reason,'unavailable_games');
 assert.equal(scan.checked,2);
 assert.equal(scan.failedThisRun,1);
 assert.equal(scan.remaining,1);
 assert.equal(api.getInspectedGames(),3);
 assert.equal(api.getSourceCheck('gb1').sourceFailure,true);
 assert.equal(api.getSourceCheck('gb1').failureKind,'missing_feed');
 assert.match(ui['ffo-gc-research-status'].innerHTML,/2 source requests completed · 3 attempted · 1 source failures/);
 assert.deepEqual(requests.filter(x=>x.name==='plays').map(x=>x.game_id),
  ['gb1','gb2','ny3']);
});
test('Repeated gateway failures hit circuit breaker after 3 games instead of flooding MSF',async()=>{
 const {api}=setup(null,{alwaysFail:true,sleep:async()=>{}});
 const scan=await api.runRemainingChecks();
 assert.equal(scan.reason,'multiple_source_errors');
 assert.equal(scan.checked,0);
 assert.equal(scan.remaining,3);
 assert.equal(scan.failedThisRun,3);
 assert.equal(api.getSourceCheck('gb1').failureKind,'transient');
});
test('Repeated 429 stops after one cautious retry and establishes a cooldown',async()=>{
 const {api,requests}=setup(null,{alwaysRateLimit:true,sleep:async()=>{}});
 const first=await api.runRemainingChecks();
 assert.equal(first.reason,'rate_limit');
 assert.equal(first.checked,0);
 assert.equal(first.remaining,3);
 assert.equal(api.getSourceCheck('gb1').failureKind,'rate_limit');
 assert.equal(requests.filter(x=>x.name==='plays').length,2);
 const retry=await api.runRemainingChecks();
 assert.equal(retry.started,false);
 assert.equal(retry.reason,'cooldown');
 assert.ok(retry.retryAfterSeconds>0);
});
test('Provider entitlement rejection stops without additional game requests',async()=>{
 const {api,requests}=setup(null,{accessFail:true,sleep:async()=>{}});
 const first=await api.runRemainingChecks();
 assert.equal(first.reason,'provider_access');
 assert.equal(first.remaining,3);
 assert.deepEqual(requests.filter(x=>x.name==='plays').map(x=>x.game_id),['gb1']);
});

test('Hidden mobile tab does not start HTTP requests, then can be resumed when visible',async()=>{
 const options={visibility:'hidden',sleep:async()=>{}};
 const {api,requests}=setup(null,options);
 const first=await api.runRemainingChecks();
 assert.equal(first.reason,'page_hidden');
 assert.equal(requests.length,0);
 options.visibility='visible';
 const second=await api.runRemainingChecks();
 assert.equal(second.checked,3);
 assert.equal(second.reason,'complete');
});
test('Automated historical mode never enables final score or projection writes',async()=>{
 const {api}=setup(null,{sleep:async()=>{}});
 await api.runRemainingChecks();
 assert.equal(api.getReadiness().productionScoreWriteAllowed,false);
 assert.equal(api.getProductionProjection('18607',8),null);
 assert.equal(api.getBacktest().status,'insufficient_certified_data');
});
