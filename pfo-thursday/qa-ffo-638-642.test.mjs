import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePregameCapture,insertImmutablePregameForecast,runPregameCapture,
 captureSQL,FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
import {validateAndCertifyMSF,persistVerifiedMSFFinal}
 from './ffo-final-score-certification-639.mjs';
import {readAccuracyDashboard,reportAccuracyFromVerifiedRecords}
 from './ffo-accuracy-dashboard-640.mjs';
import {evaluateFFLCalibration} from './ffo-projection-calibration-641.mjs';
import {auditProjectionSurfaces,evaluatePFOReleaseReadiness,produceResearchReadinessReport}
 from './ffo-projection-reliability-642.mjs';
import {auditFFLProjectionAccuracy} from './ffo-projection-accuracy-audit-637.mjs';
import {applicableFFLRuleKeys} from './ffo-historical-score-certificate.mjs';

const rules=JSON.parse(readFileSync(new URL('./FFO_FFL_SCORING_V1.json',import.meta.url),'utf8'));
const now=new Date('2026-11-22T18:00:00Z');
const fixture={
 gameId:'163656',id:'163656',week:12,provider:'MSF',verified:true,
 home:'BUF',away:'MIN',status:'SCHEDULED',
 kickoffAt:'2026-11-22T21:25:00Z'
};
const forecast={
 provider:'PFO',scoringSystem:'FFL',sourceProvider:'MSF',
 rulesVersion:FFL_RULES_VERSION,modelVersion:'pfo-636-baseline',
 playerId:'18607',gameId:'163656',week:12,position:'QB',
 team:'BUF',opponent:'MIN',points:18.75,partial:true,certified:false,
 asOfUtc:'2026-11-22T17:55:00Z',
 fromSleeperActual:false,afterGameKnowledge:false
};
const validCapture=()=>({forecast:{...forecast},game:{...fixture},serverNow:now});
const finalGame={
 ...fixture, status:'FINAL',
 providerGameIdVerified:true,scheduleWeekVerified:true,finalScoreVerified:true,
 fullPlayCoverageVerified:true,finalBoxScoreVerified:true,
 playerGameLogsVerified:true,allScoringEventsReconciled:true,
 statCorrectionsChecked:true,scheduleGamesComplete:true
};
const samplePlayer={
 id:'18607',gameId:fixture.gameId,position:'QB',team:'BUF',
 identityVerified:true,stats:{passing:{passYards:250,passTD:2}}
};
const componentProof=applicableFFLRuleKeys(rules.scoring,'QB')
 .filter(k=>!['pass_yd','pass_td'].includes(k)).map(category=>({
 category,value:0,source:/_td_(40p|50p)$/.test(category)?
  'msf_reconciled_pbp':'msf_final_stat',
 gameId:fixture.gameId,playerId:samplePlayer.id,verified:true
}));
const pregame={
 provider:'PFO',scoringSystem:'FFL',rulesVersion:FFL_RULES_VERSION,
 modelVersion:'pfo-636-baseline',playerId:'18607',gameId:'163656',week:12,
 position:'QB',points:18.75,capturedAt:now.toISOString(),
 kickoffAt:fixture.kickoffAt,fromSleeperActual:false,afterGameKnowledge:false
};
const fakeDb=(responses={})=>{
 const calls=[];
 const db={
 prepare(sql){
  const entry={sql,args:[]};calls.push(entry);
  const statement={
   bind(...args){entry.args=args;return statement},
   async run(){return responses.run||{meta:{changes:1}}},
   async all(){
    if(sql.includes('pfo_accuracy_forecasts'))return {results:(responses.forecasts||[]).map(payload_json=>({payload_json}))};
    if(sql.includes('pfo_accuracy_final_certificates'))return {results:(responses.certificates||[]).map(payload_json=>({payload_json}))};
    if(sql.includes('pfo_accuracy_verified_games'))return {results:(responses.games||[]).map(payload_json=>({payload_json}))};
    return {results:[]};
   }
  };
  return statement;
 },
 async batch(args){return responses.batch||args.map(()=>({meta:{changes:1}}));}
 };
 return {db,calls};
};

test('6.38 immutable pregame capture is server-timestamped and uses restored FFL rule version',()=>{
 const x=validatePregameCapture(validCapture());
 assert.equal(x.accepted,true);
 assert.equal(x.record.capturedAt,'2026-11-22T18:00:00.000Z');
 assert.equal(x.record.rulesVersion,rules.version);
 assert.equal(x.record.fromSleeperActual,false);
 assert.equal(x.record.certified,false);
 assert.equal(x.record.partial,true);
 const q=captureSQL(x.record);
 assert.match(q.statement,/ON CONFLICT\(season,game_id,player_id\) DO NOTHING/);
 assert.doesNotMatch(q.statement,/\bUPDATE\b|\bDELETE\b/);
 assert.equal(q.params.length,16);
 assert.equal(q.params[7],18.75);
});
test('6.38 cannot capture after kickoff, unknown kickoff or unverified MSF fixtures',()=>{
 for(const entry of [
  {serverNow:new Date('2026-11-22T21:20:00Z')},
  {game:{...fixture,kickoffAt:null}},
  {game:{...fixture,status:'FINAL'}},
  {game:{...fixture,verified:false}},
  {game:{...fixture,home:'NYG'}},
  {forecast:{...forecast,sourceProvider:'Sleeper'}},
  {forecast:{...forecast,rulesVersion:'old-rules'}},
  {forecast:{...forecast,asOfUtc:'2026-11-23T00:30:00Z'}},
  {forecast:{...forecast,afterGameKnowledge:true}},
  {forecast:{...forecast,partial:false}},
  {forecast:{...forecast,points:Infinity}},
 ]){
  const x=validatePregameCapture({...validCapture(),...entry});
  assert.equal(x.accepted,false,JSON.stringify(entry));
  assert.ok(x.reasons.length>0);
 }
});
test('6.38 missing DB and feed adapters explicitly block automatic capture',async()=>{
 assert.equal((await runPregameCapture({})).status,'blocked');
 assert.equal((await runPregameCapture({db:fakeDb().db})).status,'blocked');
 const a=await runPregameCapture({db:fakeDb().db,
  gameFeed:async()=>[],forecastFeed:async()=>[],serverNow:now});
 assert.equal(a.status,'blocked');
 assert.equal(a.captured,0);
});
test('6.38 first accepted player/game projection preserved on repeated saves',async()=>{
 const {db,calls}=fakeDb();
 const first=await insertImmutablePregameForecast(db,validCapture());
 assert.equal(first.status,'stored');
 assert.equal(calls.length,1);
 assert.ok(calls[0].sql.includes('DO NOTHING'));
 const repeatDb=fakeDb({run:{meta:{changes:0}}});
 const second=await insertImmutablePregameForecast(repeatDb.db,validCapture());
 assert.equal(second.status,'existing_snapshot_preserved');
});
test('6.38 batch captures verified fixture only with trusted PFO forecast adapter',async()=>{
 const {db,calls}=fakeDb();
 const other={...fixture,gameId:'163700',id:'163700',verified:false};
 const out=await runPregameCapture({db,serverNow:new Date('2026-11-22T21:00:00Z'),
  gameFeed:async()=>[fixture,other],
  forecastFeed:async(game)=>[{...forecast,gameId:game.gameId}]
 });
 assert.equal(out.captured,1);
 assert.equal(calls.length,1);
 assert.equal(out.separateCommissionerStorage,true);
});

test('6.39 independent MSF certifier rejects missing corrected play evidence',()=>{
 assert.equal(validateAndCertifyMSF({
  game:{...finalGame,fullPlayCoverageVerified:false},player:samplePlayer,rules,
  componentProof,bonusPolicy:'highest_only',bonusPolicyAdjudicated:true
 }).status,'withheld');
 assert.equal(validateAndCertifyMSF({
  game:finalGame,player:{...samplePlayer,identityVerified:false},rules,
  componentProof,bonusPolicy:'highest_only',bonusPolicyAdjudicated:true
 }).status,'withheld');
 assert.equal(validateAndCertifyMSF({
  game:finalGame,player:samplePlayer,rules,
  componentProof,bonusPolicy:null,bonusPolicyAdjudicated:false
 }).status,'withheld');
 const bad=validateAndCertifyMSF({
  game:finalGame,player:samplePlayer,rules,
  componentProof:componentProof.filter(x=>x.category!=='fum_lost'),
  bonusPolicy:'highest_only',bonusPolicyAdjudicated:true
 });
 assert.equal(bad.status,'withheld');
 assert.ok(bad.missingCategories.includes('fum_lost'));
});
test('6.39 a fully sourced simulated game can certify, but that fixture is not a real 2026 result',()=>{
 const x=validateAndCertifyMSF({game:finalGame,player:samplePlayer,rules,
  componentProof,bonusPolicy:'highest_only',bonusPolicyAdjudicated:true});
 assert.equal(x.status,'certified_source_score');
 assert.equal(x.certificate.provider,'MSF');
 assert.equal(x.certificate.points,18);
 assert.equal(x.certificate.finalPlayerScoreRecomputed,true);
 assert.equal(x.certificate.rulesVersion,FFL_RULES_VERSION);
});
test('6.39 persistence disallows forged game or certificate, uses separate D1 atomic batch',async()=>{
 const {db,calls}=fakeDb();
 const cert=validateAndCertifyMSF({game:finalGame,player:samplePlayer,rules,
  componentProof,bonusPolicy:'highest_only',bonusPolicyAdjudicated:true}).certificate;
 assert.equal((await persistVerifiedMSFFinal(null,{game:finalGame,certificate:cert})).status,'blocked');
 for(const entry of [
  {certificate:{...cert,playerIdentityVerified:false}},
  {certificate:{...cert,gameId:'mismatch'}},
  {certificate:{...cert,finalBoxScoreVerified:false}},
  {certificate:{...cert,verifiedCategoryCount:0}},
  {certificate:{...cert,provider:'Sleeper'}},
  {game:{...finalGame,statCorrectionsChecked:false}},
  {game:{...finalGame,status:'IN_PROGRESS'}}
 ]){
  const z=await persistVerifiedMSFFinal(db,{game:finalGame,certificate:cert,...entry});
  assert.equal(z.status,'withheld');
 }
 assert.equal(calls.length,0);
 const result=await persistVerifiedMSFFinal(db,{game:finalGame,certificate:cert,
  serverNow:new Date('2026-11-24T12:00:00Z')});
 assert.equal(result.status,'certified_result_saved');
 assert.equal(calls.length,2);
 assert.ok(calls.every(x=>/ON CONFLICT.*DO NOTHING/.test(x.sql)));
 assert.ok(calls.every(x=>!x.sql.includes('commissioner')));
});
test('6.40 report yields only same-rule verified forecast/actual pairs; no fabricated errors',()=>{
 const cert=validateAndCertifyMSF({game:finalGame,player:samplePlayer,rules,
  componentProof,bonusPolicy:'highest_only',bonusPolicyAdjudicated:true}).certificate;
 const x=reportAccuracyFromVerifiedRecords({
  forecasts:[pregame],
  certificates:[cert],
  games:[{gameId:fixture.gameId,week:12,kickoffAt:fixture.kickoffAt,
   provider:'MSF',verified:true,status:'FINAL'}]
 });
 assert.equal(x.status,'research_metrics_only');
 assert.equal(x.measuredPlayerGames,1);
 assert.equal(x.metrics.mae,.75);
 assert.equal(x.byPosition.QB.n,1);
 assert.equal(x.readOnly,true);
 assert.equal(x.modelApprovedForDeployment,false);
});
test('6.40 no dedicated database and corrupt data fail closed, without a misleading zero MAE',async()=>{
 const r=await readAccuracyDashboard(null);
 assert.equal(r.status,'blocked');
 assert.equal(r.metrics.mae,null);
 const empty=await readAccuracyDashboard(fakeDb().db);
 assert.equal(empty.status,'no_verified_pregame_pairs');
 assert.equal(empty.measuredPlayerGames,0);
 const corrupt=await readAccuracyDashboard(fakeDb({
  forecasts:['{bad json}'],certificates:[],games:[]
 }).db);
 assert.equal(corrupt.ledgerCounts.discardedUnreadableRows,1);
 assert.equal(corrupt.metrics.mae,null);
});

const synthRow=(position,week,i,actualDelta)=>({
 playerId:position+i,gameId:'G'+week+position+i,position,week,
 projected:10,actual:10+actualDelta
});
const makeCalibrationRows=()=>{
 const out=[];
 for(let week=1;week<=8;week++){
  for(const pos of ['QB','RB','WR','TE','K','DEF']){
   for(let i=0;i<4;i++){
    const correction=week<=5?2:1.5;
    out.push(synthRow(pos,week,i,correction));
   }
  }
 }
 return out;
};
test('6.41 refuses deployment without verified same-rule pairs and enough held-out samples',()=>{
 assert.equal(evaluateFFLCalibration({}).status,'withheld');
 const report={rulesVersion:FFL_RULES_VERSION,status:'research_metrics_only',
  independentMSFTruthOnly:true,analysisRows:makeCalibrationRows()};
 const missing=evaluateFFLCalibration({auditReport:report,minValidationOverall:999});
 assert.equal(missing.status,'withheld');
 assert.equal(missing.productionEligible,false);
});
test('6.41 chronological held-out candidate can beat baseline in synthetic QA, never auto-promote',()=>{
 const report={rulesVersion:FFL_RULES_VERSION,status:'research_metrics_only',
  independentMSFTruthOnly:true,analysisRows:makeCalibrationRows()};
 const x=evaluateFFLCalibration({auditReport:report,
  minTrainPerPosition:12,minValidationPerPosition:6,minValidationOverall:70});
 assert.equal(x.status,'heldout_candidate_passed');
 assert.equal(x.noFutureLeakage,true);
 assert.ok(x.improvementMae>=0.1);
 assert.ok(x.baseline.mae>x.adjusted.mae);
 assert.equal(x.productionEligible,false);
 assert.equal(x.modelChangesApplied,false);
 assert.equal(x.candidateApproved,false);
});
test('6.41 duplicate and insufficient-position datasets cannot be used to tune',()=>{
 const rows=makeCalibrationRows();
 const report={rulesVersion:FFL_RULES_VERSION,status:'research_metrics_only',
  independentMSFTruthOnly:true,analysisRows:[...rows,rows[0]]};
 assert.equal(evaluateFFLCalibration({auditReport:report}).reason,'duplicate_player_game_pairs');
 const x=evaluateFFLCalibration({auditReport:{...report,
  analysisRows:rows.filter(r=>r.position!=='K')},
  minValidationOverall:70});
 assert.equal(x.reason,'position_coverage_below_calibration_threshold');
});
test('6.42 static surface scorer detects unsupported inputs and incorrect team subtotals',()=>{
 const modules=Object.fromEntries(['teamHQ','matchups','market','waivers','startSit','gamecast']
  .map(k=>[k,{projectionSource:'PFO',rulesVersion:FFL_RULES_VERSION,
   fromSleeperScore:false}]));
 const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 const good=auditProjectionSurfaces({sourceVersion:FFL_RULES_VERSION,
  modules,staticHtml:html,sampleRows:[{required:2,covered:2,subtotal:11.25,
   starters:[{id:'p1',points:9.25},{id:'p2',points:2}],labelCertified:false}]});
 assert.equal(good.status,'static_surface_contract_passed');
 assert.equal(good.productionEligible,false);
 assert.equal(good.realUIEndToEndVerified,false);
 assert.equal(auditProjectionSurfaces({sourceVersion:FFL_RULES_VERSION,
  modules:{...modules,market:{...modules.market,fromSleeperScore:true}},
  staticHtml:html}).status,'blocked');
 assert.equal(auditProjectionSurfaces({sourceVersion:FFL_RULES_VERSION,modules,
  staticHtml:html,sampleRows:[{required:2,covered:2,subtotal:100,
   starters:[{id:'p1',points:9},{id:'p2',points:2}],labelCertified:true}]}).status,'blocked');
});
test('6.42 missing separate D1, real source integration and real-device QA is a BLOCKER, not green',()=>{
 const x=produceResearchReadinessReport({rulesVersion:FFL_RULES_VERSION});
 assert.equal(x.status,'not_ready_for_live_accuracy_claim');
 assert.deepEqual(x.unmetPhases,['6.38','6.39','6.40','6.41','6.42']);
 assert.equal(x.productionEligible,false);
 assert.equal(x.commissionerRecordsModified,false);
 assert.equal(x.ffoiIntegrationAuthorized,false);
});
test('6.42 even complete looking booleans do not bypass all phase requirements',()=>{
 const x=evaluatePFOReleaseReadiness({
  sourceVersion:FFL_RULES_VERSION,
  storage:{accuracyBound:true,commissionerSeparate:true,schemaApplied:true,
   appendOnlyTestPassed:true,realBindingIdVerified:true},
  capture:{rulesVersion:FFL_RULES_VERSION,schedulerActive:true,pfoModelParityVerified:true,
   msfFixtureVerified:true,stampedServerSide:true,savedSnapshots:120},
  finals:{rulesVersion:FFL_RULES_VERSION,completeMSFFinalEvidenceVerified:true,
   zeroUnverifiedBonuses:true,sourceCorrectionsReconciled:true,certifiedScores:140},
  accuracy:{rulesVersion:FFL_RULES_VERSION,realIndependentPairs:true,pairs:120,
   sampleGatePassed:true,confidenceLabelsVisible:true},
  calibration:{rulesVersion:FFL_RULES_VERSION,heldOutWeeksVerified:true,
   allPositionsAdequatelySampled:true,noPositionRegression:true,
   improvementVerified:true,manualPromotionApproved:false},
  screens:{projectionSurfacesConsistent:true,starterTotalsReconciled:true,
   kickerAndDefensiveCategoriesChecked:true},
  mobile:{safariRegressionPass:true,realDeviceQA:true},
  isolation:{commissionerRecordsUnchanged:true,publicDemoUnchanged:true,ffoiNotIntegrated:true}
 });
 assert.deepEqual(x.unmetPhases,['6.41','6.42']);
 assert.equal(x.productionEligible,false);
});
test('6.38–6.42 implementation never loads Sleeper fantasy points or Commissioner database',()=>{
 const files=[
  'ffo-pregame-capture-638.mjs','ffo-final-score-certification-639.mjs',
  'ffo-accuracy-dashboard-640.mjs','ffo-projection-calibration-641.mjs',
  'ffo-projection-reliability-642.mjs'
 ];
 for(const file of files){
  const raw=readFileSync(new URL('./'+file,import.meta.url),'utf8');
  assert.doesNotMatch(raw,/COMMISSIONER_DB|api\.sleeper\.app|\/league\/.*\/matchups\/|updateCommissioner|wrangler pages deploy/i);
 }
});
