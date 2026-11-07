import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLiveParityForCapture643,PARITY_EVIDENCE_SCHEMA} from './ffo-capture-parity-643.mjs';
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
const now=new Date('2026-11-08T18:00:00Z');
const game={provider:'MSF',verified:true,id:'g101',gameId:'g101',week:10,
 kickoffAt:'2026-11-08T18:25:00.000Z',home:'BUF',away:'MIA',status:'NOT_STARTED'};
const forecast={provider:'PFO',scoringSystem:'FFL',sourceProvider:'MSF',
 fromSleeperActual:false,afterGameKnowledge:false,gameId:'g101',week:10,
 rulesVersion:FFL_RULES_VERSION,modelVersion:'pfo-636-frozen',playerId:'18607',
 position:'QB',team:'BUF',opponent:'MIA',points:18.75,partial:true,certified:false,
 asOfUtc:'2026-11-08T17:57:00Z'};
const h='f'.repeat(64);
const parity={
 schema:PARITY_EVIDENCE_SCHEMA,
 verificationMethod:'authenticated_live_browser_vs_server_recomputation',
 sourceProvider:'MSF',rulesVersion:FFL_RULES_VERSION,trustedServerWitness:true,
 actualProtectedBrowserObservation:true,realLicensedProviderResponseVerified:true,
 fixtureVerified:true,uniquePlayerIdentityVerified:true,
 gameId:game.gameId,playerId:forecast.playerId,position:forecast.position,
 modelVersion:forecast.modelVersion,week:game.week,kickoffAtUtc:game.kickoffAt,
 sourceAsOfUtc:forecast.asOfUtc,browserSourceSha256:h,
 serverSourceSha256:h,scoringContractSha256:h,verifierRunId:'verified_run_123',
 browserProjectionPoints:forecast.points,serverProjectionPoints:forecast.points,
 browserObservedAtUtc:'2026-11-08T17:58:00Z',verifiedAtUtc:'2026-11-08T17:59:00Z'
};
const run=extra=>validateLiveParityForCapture643({
 forecast,game,parity,serverNow:now,...extra
});
test('policy rejects missing LIVE witness even when conventional timestamp/scoring tests pass',()=>{
 const noWitness=run({parity:null});
 assert.equal(noWitness.authorized,false);
 assert.equal(noWitness.reason,'real_authenticated_live_model_parity_not_witnessed');
 assert.equal(noWitness.eligibleForD1Write,false);
});
test('complete synthetic witness satisfies pure POLICY only, never activates a scheduled worker',()=>{
 const report=run();
 assert.equal(report.status,'verified_parity_policy');
 assert.equal(report.authorized,true);
 assert.equal(report.eligibleForD1Write,true);
 assert.equal(report.realCaptureActivated,false);
 assert.equal(report.forecastRecord.capturedAt,'2026-11-08T18:00:00.000Z');
});
test('each live witness and provider requirement independently blocks an unproven model',()=>{
 for(const key of ['trustedServerWitness','actualProtectedBrowserObservation',
  'realLicensedProviderResponseVerified','fixtureVerified','uniquePlayerIdentityVerified']){
  const r=run({parity:{...parity,[key]:false}});
  assert.equal(r.authorized,false,key);
  assert.equal(r.eligibleForD1Write,false);
 }
});
test('no synthetic source-level result substitutes for actual protected-browser observation',()=>{
 const p={...parity,verificationMethod:'source_level_unit_test'};
 const r=run({parity:p});
 assert.equal(r.reason,'real_authenticated_live_model_parity_not_witnessed');
});
test('identity/rules/model/version/timestamp mismatch refuses capture',()=>{
 for(const [key,value] of [['gameId','g102'],['playerId','wrong'],
  ['position','RB'],['week',9],['rulesVersion','generic-PPR'],
  ['modelVersion','other-model'],['sourceAsOfUtc','2026-11-08T17:56:00Z'],
  ['kickoffAtUtc','2026-11-08T18:20:00.000Z']]){
  const r=run({parity:{...parity,[key]:value}});
  assert.equal(r.authorized,false,key);
 }
});
test('numeric disagreement, invalid hash or missing independent verifier blocks candidate',()=>{
 for(const p of [
  {...parity,browserProjectionPoints:18.78},
  {...parity,serverProjectionPoints:18.74},
  {...parity,browserProjectionPoints:Infinity},
  {...parity,scoringContractSha256:'not-a-hash'},
  {...parity,verifierRunId:''}
 ]){
  const r=run({parity:p});
  assert.equal(r.authorized,false);
 }
});
test('expired witness, future result, after-cutoff verification or future browser use is blocked',()=>{
 for(const p of [
  {...parity,verifiedAtUtc:'2026-11-08T17:54:00Z'},
  {...parity,verifiedAtUtc:'2026-11-08T18:01:00Z'},
  {...parity,browserObservedAtUtc:'2026-11-08T18:05:00Z'},
  {...parity,browserObservedAtUtc:'2026-11-08T17:56:00Z'},
  {...parity,sourceAsOfUtc:'2026-11-08T18:10:00Z'}
 ]){
  const r=run({parity:p});
  assert.equal(r.authorized,false,JSON.stringify(p));
 }
});
test('after the 15-minute pregame cutoff the ordinary snapshot gate wins',()=>{
 const r=run({serverNow:new Date('2026-11-08T18:11:00Z')});
 assert.equal(r.authorized,false);
 assert.equal(r.reason,'ordinary_pregame_validation_failed');
});
