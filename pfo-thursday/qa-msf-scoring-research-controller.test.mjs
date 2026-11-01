import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installScoringResearch} from './ffo-scoring-research-controller.mjs';
const games=[
 {id:'gb1',week:1,status:'FINAL',home:'GB',away:'CHI',start:'2026-09-13T17:00:00Z'},
 {id:'gb2',week:2,status:'COMPLETED',home:'MIN',away:'GB',start:'2026-09-20T17:00:00Z'},
 {id:'ny3',week:3,status:'FINAL',home:'NYJ',away:'BUF',start:'2026-09-27T17:00:00Z'}
];
function setup(storage=null){
 const ui={};
 const root={getElementById(id){
  if(!ui[id])ui[id]={id,innerHTML:'',textContent:'',disabled:false,handlers:{},
   addEventListener(type,fn){this.handlers[type]=fn}};
  return ui[id];
 }};
 const requests=[];
 const feed=async(name,args)=>{
  requests.push({name,...args});
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
  root,feed,model,season:'2026-regular',getSchedule:()=>games,storage
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
