import test from 'node:test';
import assert from 'node:assert/strict';
import {readAccuracyDashboard} from './ffo-accuracy-dashboard-640.mjs';
import {MSF_CORRECTION_REVISION_SCHEMA}
 from './ffo-msf-final-corrections-643.mjs';
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
const kickoff='2026-11-08T18:25:00.000Z';
const game={provider:'MSF',verified:true,gameId:'g101',week:10,
 kickoffAt:kickoff,status:'FINAL'};
const forecast={provider:'PFO',scoringSystem:'FFL',sourceProvider:'MSF',
 playerId:'18607',gameId:'g101',position:'QB',week:10,
 points:20,modelVersion:'pfo-636-baseline',
 rulesVersion:FFL_RULES_VERSION,
 fromSleeperActual:false,afterGameKnowledge:false,
 capturedAt:'2026-11-08T18:00:00.000Z',kickoffAt:kickoff};
const certificate={certified:true,provider:'MSF',rulesVersion:FFL_RULES_VERSION,
 gameId:'g101',playerId:'18607',week:10,position:'QB',points:18,
 gameStatus:'FINAL',fantasyScoreFromSleeper:false,
 finalPlayerScoreRecomputed:true,playerIdentityVerified:true,
 finalBoxScoreVerified:true,statCategoriesComplete:true,
 eventBonusesReconciled:true,statCorrectionsChecked:true};
const revision={schema:MSF_CORRECTION_REVISION_SCHEMA,season:2026,
 gameId:'g101',playerId:'18607',week:10,revisionIndex:1,
 priorPoints:18,correctedPoints:19,rulesVersion:FFL_RULES_VERSION,
 providerCorrectionId:'corr_1',providerResponseSha256:'a'.repeat(64),
 msfCorrectedAt:'2026-11-08T22:00:00.000Z',
 certifiedAt:'2026-11-08T22:05:00.000Z',
 certificate:{...certificate,points:19}};
function db({migration=true,revisions=[revision]}={}){
 const calls=[];
 return {calls,connection:{
  prepare(sql){
   calls.push(sql);
   return {async all(){
    if(sql.includes('sqlite_master'))return {results:migration?[{name:'pfo_accuracy_final_revisions'}]:[]};
    if(sql.includes('pfo_accuracy_forecasts'))return {results:[{payload_json:JSON.stringify(forecast)}]};
    if(sql.includes('pfo_accuracy_final_certificates'))return {results:[{payload_json:JSON.stringify(certificate)}]};
    if(sql.includes('pfo_accuracy_verified_games'))return {results:[{payload_json:JSON.stringify(game)}]};
    if(sql.includes('pfo_accuracy_final_revisions'))return {results:revisions.map(r=>({payload_json:typeof r==='string'?r:JSON.stringify(r)}))};
    return {results:[]};
   }};
  }
 }};
}
test('before revision migration the read-only dashboard remains honest about missing correction support',async()=>{
 const x=await readAccuracyDashboard(db({migration:false}).connection);
 assert.equal(x.metrics.n,1);
 assert.equal(x.metrics.mae,2);
 assert.equal(x.correctionLedger.migrationApplied,false);
 assert.equal(x.correctionLedger.evidenceCompleteForRelease,false);
 assert.equal(x.correctionLedger.status,'not_migrated_or_unavailable');
});
test('with source-certified revision chain dashboard uses corrected latest actual, preserving old certificate',async()=>{
 const source=db();
 const x=await readAccuracyDashboard(source.connection);
 assert.equal(x.metrics.n,1);
 assert.equal(x.metrics.mae,1);
 assert.equal(x.correctionLedger.migrationApplied,true);
 assert.equal(x.correctionLedger.correctionDetails.applied,1);
 assert.equal(x.correctionLedger.correctionDetails.correctedPlayerGames,1);
 assert.equal(x.correctionLedger.latestSourceCorrectionFeedVerified,false);
 assert.ok(source.calls.every(sql=>!/\bUPDATE\b|\bDELETE\b|commissioner/i.test(sql)));
});
test('broken correction chain withholds affected pair instead of measuring against the obsolete original',async()=>{
 const bad={...revision,revisionIndex:2};
 const x=await readAccuracyDashboard(db({revisions:[bad]}).connection);
 assert.equal(x.measuredPlayerGames,0);
 assert.equal(x.metrics.mae,null);
 assert.equal(x.correctionLedger.correctionDetails.withheldPairs,1);
});
test('invalid or unreadable revision data closes entire accuracy read gate',async()=>{
 const x=await readAccuracyDashboard(db({revisions:['{bad json}']}).connection);
 assert.equal(x.status,'blocked');
 assert.equal(x.metrics.mae,null);
 assert.equal(x.reason,'incomplete_or_corrupt_correction_revision_ledger');
});
test('empty new correction ledger is still read-only and does not claim a completed provider correction check',async()=>{
 const x=await readAccuracyDashboard(db({revisions:[]}).connection);
 assert.equal(x.metrics.mae,2);
 assert.equal(x.correctionLedger.migrationApplied,true);
 assert.equal(x.correctionLedger.latestSourceCorrectionFeedVerified,false);
});
