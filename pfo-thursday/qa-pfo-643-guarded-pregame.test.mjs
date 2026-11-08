import test from 'node:test';
import assert from 'node:assert/strict';
import {runGuardedPregameCapture643} from './ffo-guarded-pregame-643.mjs';
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
import {PARITY_EVIDENCE_SCHEMA} from './ffo-capture-parity-643.mjs';

const now=new Date('2026-11-08T18:00:00Z');
const game={provider:'MSF',verified:true,id:'g101',gameId:'g101',
  week:10,kickoffAt:'2026-11-08T18:25:00.000Z',home:'BUF',away:'MIA',
  status:'NOT_STARTED'};
const forecast={
  provider:'PFO',scoringSystem:'FFL',sourceProvider:'MSF',
  fromSleeperActual:false,afterGameKnowledge:false,
  gameId:'g101',week:10,position:'QB',playerId:'18607',
  modelVersion:'pfo-636-frozen',rulesVersion:FFL_RULES_VERSION,
  team:'BUF',opponent:'MIA',points:18.75,partial:true,certified:false,
  asOfUtc:'2026-11-08T17:57:00Z'
};
const parity={
 schema:PARITY_EVIDENCE_SCHEMA,
 verificationMethod:'authenticated_live_browser_vs_server_recomputation',
 sourceProvider:'MSF',rulesVersion:FFL_RULES_VERSION,
 trustedServerWitness:true,actualProtectedBrowserObservation:true,
 realLicensedProviderResponseVerified:true,fixtureVerified:true,
 uniquePlayerIdentityVerified:true,gameId:game.gameId,
 playerId:forecast.playerId,position:forecast.position,
 modelVersion:forecast.modelVersion,week:game.week,
 kickoffAtUtc:game.kickoffAt,sourceAsOfUtc:forecast.asOfUtc,
 browserSourceSha256:'f'.repeat(64),serverSourceSha256:'e'.repeat(64),
 scoringContractSha256:'d'.repeat(64),verifierRunId:'test_only_456',
 browserProjectionPoints:18.75,serverProjectionPoints:18.75,
 browserObservedAtUtc:'2026-11-08T17:58:00Z',
 verifiedAtUtc:'2026-11-08T17:59:00Z'
};
const runtime={kind:'cloudflare_scheduled_worker',bindingName:'PFO_ACCURACY_DB',
 dedicatedBindingVerified:true,httpRequestTriggered:false};
const pair={forecast,parity};
function mock({changes=1}={}){
 const calls=[];
 const db={prepare(sql){
  const obj={sql,values:[]};calls.push(obj);
  return {bind(...values){obj.values=values;return {
   async run(){return {meta:{changes}};}
  };}};
 }};
 return {db,calls};
}
function run({db,runtime:rt=runtime,gameFeed=async()=>[game],
 forecastFeed=async()=>[pair],serverNow=now}={}){
 return runGuardedPregameCapture643({db,serverNow,runtime:rt,gameFeed,forecastFeed});
}
test('no independently verified Cloudflare scheduled accuracy D1 binding: no provider or write calls',async()=>{
 const {db,calls}=mock();
 let gameCalls=0,modelCalls=0;
 const result=await run({db,runtime:{...runtime,httpRequestTriggered:true},
  gameFeed:async()=>{gameCalls++;return [game]},
  forecastFeed:async()=>{modelCalls++;return [pair]}});
 assert.equal(result.status,'blocked');
 assert.equal(gameCalls,0);
 assert.equal(modelCalls,0);
 assert.equal(calls.length,0);
});
test('missing independent protected browser parity: no forecast INSERT',async()=>{
 const {db,calls}=mock();
 const result=await run({db,forecastFeed:async()=>[{forecast,parity:null}]});
 assert.equal(result.stored,0);
 assert.equal(result.withheld,1);
 assert.equal(calls.length,0);
 assert.equal(result.status,'nothing_stored_without_verified_parity');
});
test('all synthetic evidence may satisfy pure runner policy, but actual deployment remains off',async()=>{
 const {db,calls}=mock();
 const result=await run({db});
 assert.equal(result.status,'verified_snapshots_stored');
 assert.equal(result.stored,1);
 assert.equal(result.firstWriteImmutable,true);
 assert.equal(result.liveSchedulerEnabledByThisModule,false);
 assert.equal(calls.length,1);
 assert.match(calls[0].sql,/ON CONFLICT\(season,game_id,player_id\) DO NOTHING/);
 assert.doesNotMatch(calls[0].sql,/\bUPDATE\b|\bDELETE\b|commissioner/i);
 const saved=JSON.parse(calls[0].values.at(-1));
 assert.equal(saved.parityWitness.authenticatedSameFixture,true);
 assert.equal(saved.parityWitness.verifierRunId,'test_only_456');
 assert.equal(saved.modelVersion,forecast.modelVersion);
 assert.equal(saved.capturedAt,now.toISOString());
 assert.equal(saved.rulesVersion,FFL_RULES_VERSION);
 assert.equal(saved.partial,true);
 assert.equal(saved.certified,false);
});
test('repeat proposal with existing immutable row never claims a second capture',async()=>{
 const {db,calls}=mock({changes:0});
 const result=await run({db});
 assert.equal(result.status,'immutable_existing_snapshots_preserved');
 assert.equal(result.stored,0);
 assert.equal(result.preserved,1);
 assert.equal(calls.length,1);
});
test('source-level-only witness or mismatched values never write',async()=>{
 for(const update of [
  {verificationMethod:'source_level_unit_test'},
  {browserProjectionPoints:19.25},
  {sourceAsOfUtc:'2026-11-08T17:55:00Z'},
  {trustedServerWitness:false}
 ]){
  const {db,calls}=mock();
  const result=await run({db,forecastFeed:async()=>[{forecast,parity:{...parity,...update}}]});
  assert.equal(result.stored,0,JSON.stringify(update));
  assert.equal(calls.length,0,JSON.stringify(update));
 }
});
test('late kickoff, final status, and invalid schedule cannot trigger forecast feed or writes',async()=>{
 for(const changed of [
  {...game,kickoffAt:'2026-11-08T18:10:00.000Z'},
  {...game,status:'FINAL'},
  {...game,verified:false}
 ]){
  const {db,calls}=mock();
  let predictions=0;
  const result=await run({db,gameFeed:async()=>[changed],
   forecastFeed:async()=>{predictions++;return [pair]}});
  assert.equal(result.stored,0);
  assert.equal(predictions,0);
  assert.equal(calls.length,0);
 }
});
test('no runtime, no DB and source failure all report blocker rather than a false empty success',async()=>{
 assert.equal((await run({db:null})).status,'blocked');
 const {db,calls}=mock();
 const failures=[
  await run({db,runtime:null}),
  await run({db,gameFeed:async()=>{throw Error('provider down')}}),
  await run({db,forecastFeed:async()=>{throw Error('model down')}})
 ];
 assert.equal(failures[0].status,'blocked');
 assert.equal(failures[1].status,'blocked');
 assert.equal(failures[2].stored,0);
 assert.equal(calls.length,0);
});
test('duplicate player IDs in single feed cannot write a second competing model',async()=>{
 const {db,calls}=mock();
 const result=await run({db,forecastFeed:async()=>[pair,pair]});
 assert.equal(result.stored,1);
 assert.equal(result.withheld,1);
 assert.equal(calls.length,1);
});
