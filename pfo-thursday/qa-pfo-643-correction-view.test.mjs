import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileFinalCorrections643} from './ffo-accuracy-correction-view-643.mjs';
import {MSF_CORRECTION_REVISION_SCHEMA} from './ffo-msf-final-corrections-643.mjs';
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
const root={provider:'MSF',certified:true,gameId:'g101',playerId:'18607',
 week:10,position:'QB',rulesVersion:FFL_RULES_VERSION,
 fantasyScoreFromSleeper:false,finalPlayerScoreRecomputed:true,
 playerIdentityVerified:true,finalBoxScoreVerified:true,
 statCategoriesComplete:true,eventBonusesReconciled:true,
 statCorrectionsChecked:true,gameStatus:'FINAL',points:18};
const revision=(n,before,after,minute)=>({
 schema:MSF_CORRECTION_REVISION_SCHEMA,season:2026,
 gameId:'g101',playerId:'18607',week:10,
 revisionIndex:n,priorPoints:before,correctedPoints:after,
 rulesVersion:FFL_RULES_VERSION,providerResponseSha256:'a'.repeat(64),
 providerCorrectionId:'correction_'+n,
 msfCorrectedAt:'2026-11-08T22:'+String(minute).padStart(2,'0')+':00.000Z',
 certifiedAt:'2026-11-08T22:'+String(minute+1).padStart(2,'0')+':00.000Z',
 certificate:{...root,points:after}
});
test('original unchanged when no revision exists and 0 corrections are honestly reported',()=>{
 const r=reconcileFinalCorrections643({originals:[root],revisions:[]});
 assert.equal(r.status,'correction_chains_verified');
 assert.equal(r.certificates[0].points,18);
 assert.equal(r.revisionsApplied,0);
 assert.equal(r.correctedPlayerGames,0);
});
test('two ordered official revisions replace dashboard truth with latest corrected certificate',()=>{
 const r=reconcileFinalCorrections643({
  originals:[root],
  revisions:[revision(2,18.5,19.5,10),revision(1,18,18.5,5)]
 });
 assert.equal(r.status,'correction_chains_verified');
 assert.equal(r.certificates.length,1);
 assert.equal(r.certificates[0].points,19.5);
 assert.equal(r.revisionsApplied,2);
 assert.equal(r.correctedPlayerGames,1);
 assert.equal(r.correctedByGame.g101,1);
 assert.equal(r.originalCertifiedCount,1);
});
test('missing revision zero/one or contradictory prior score withholds the whole player/game, never stale original',()=>{
 for(const bad of [
  [revision(2,18.5,19.5,10)],
  [revision(1,19,18.5,5)],
  [revision(1,18,18.5,5),revision(2,17,19.5,10)],
  [revision(1,18,18.5,10),revision(2,18.5,19.5,5)]
 ]){
  const r=reconcileFinalCorrections643({originals:[root],revisions:bad});
  assert.equal(r.status,'corrections_partially_withheld');
  assert.equal(r.certificates.length,0);
  assert.deepEqual(r.withheldKeys,['g101|18607']);
 }
});
test('orphan revision, duplicate original, wrong scoring version and bad provider hash block all metrics',()=>{
 const badRoot={...root,gameId:'another'};
 for(const input of [
  {originals:[badRoot],revisions:[revision(1,18,18.5,5)]},
  {originals:[root,root],revisions:[]},
  {originals:[root],revisions:[{...revision(1,18,18.5,5),providerResponseSha256:'bad'}]},
  {originals:[root],revisions:[],rulesVersion:'generic-PPR'}
 ]){
  const r=reconcileFinalCorrections643(input);
  assert.equal(r.status,'correction_integrity_blocked');
  assert.equal(r.certificates.length,0);
 }
});
test('corrected player and unaffected original are individually reconciled',()=>{
 const other={...root,playerId:'18608',points:10};
 const r=reconcileFinalCorrections643({originals:[root,other],
  revisions:[revision(1,18,18.5,5)]});
 assert.equal(r.certificates.length,2);
 assert.equal(r.certificates.find(x=>x.playerId==='18608').points,10);
 assert.equal(r.certificates.find(x=>x.playerId==='18607').points,18.5);
});
test('malformed/out-of-time correction never becomes legitimate final score',()=>{
 for(const x of [
  {certificate:{...root,points:18.5,fantasyScoreFromSleeper:true}},
  {providerCorrectionId:''},
  {msfCorrectedAt:'invalid'},
  {correctedPoints:NaN}
 ]){
  const r=reconcileFinalCorrections643({originals:[root],
   revisions:[{...revision(1,18,18.5,5),...x}]});
  assert.equal(r.status,'correction_integrity_blocked');
 }
});
