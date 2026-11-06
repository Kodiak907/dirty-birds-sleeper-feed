import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditFFLProjectionAccuracy,auditLegacyForecastArchives}
 from './ffo-projection-accuracy-audit-637.mjs';

const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const rules=read('pfo-thursday/FFO_FFL_SCORING_V1.json');
const version=rules.version;
const game=(gameId='game-12',week=12)=>({
 gameId,week,kickoffAt:'2026-11-22T21:25:00Z',status:'FINAL',provider:'MSF',verified:true
});
const proof=(playerId='P1',gameId='game-12',week=12,points=10,position='WR')=>({
 certified:true,provider:'MSF',rulesVersion:version,playerId,gameId,week,points,position,
 gameStatus:'FINAL',fantasyScoreFromSleeper:false,
 finalPlayerScoreRecomputed:true,playerIdentityVerified:true,
 finalBoxScoreVerified:true,statCategoriesComplete:true,
 eventBonusesReconciled:true,statCorrectionsChecked:true
});
const pred=(playerId='P1',gameId='game-12',week=12,points=12,position='WR')=>({
 provider:'PFO',scoringSystem:'FFL',rulesVersion:version,
 modelVersion:'pfo-6.36',playerId,gameId,week,points,position,
 capturedAt:'2026-11-22T18:00:00Z',kickoffAt:'2026-11-22T21:25:00Z',
 fromSleeperActual:false,afterGameKnowledge:false
});
const run=(options={})=>auditFFLProjectionAccuracy({
 rulesVersion:version,forecasts:[pred()],certificates:[proof()],
 verifiedGames:[game()],...options
});

test('verified pregame prediction and independently certified final score produce actual error and position metrics',()=>{
 const report=run();
 assert.equal(report.status,'research_metrics_only');
 assert.equal(report.measuredPlayerGames,1);
 assert.equal(report.metrics.n,1);
 assert.equal(report.metrics.mae,2);
 assert.equal(report.metrics.rmse,2);
 assert.equal(report.metrics.bias,2);
 assert.equal(report.byPosition.WR.mae,2);
 assert.equal(report.byWeek['12'].n,1);
 assert.equal(report.independentMSFTruthOnly,true);
 assert.equal(report.productionEligible,false);
 assert.equal(report.backtestCertified,false);
 assert.equal(report.sampleThresholdMet,false);
});
test('a final score of zero is valid if explicitly certified; a negative score is valid too',()=>{
 const rows=[proof('P1','game-12',12,0),proof('P2','game-13',13,-2,'DEF')];
 const forecasts=[pred('P1','game-12',12,0),pred('P2','game-13',13,-1,'DEF')];
 const second={...game('game-13',13)};
 const x=run({forecasts,certificates:rows,verifiedGames:[game(),second]});
 assert.equal(x.measuredPlayerGames,2);
 assert.equal(x.metrics.mae,.5);
 assert.equal(x.byPosition.DEF.n,1);
});
test('old scoring versions never enter restored FFL accuracy claims',()=>{
 const x=run({forecasts:[{...pred(),rulesVersion:'2026-10-29-old'}]});
 assert.equal(x.measuredPlayerGames,0);
 assert.equal(x.exclusions.legacy_or_wrong_scoring_version,1);
 const y=run({certificates:[{...proof(),rulesVersion:'old'}]});
 assert.equal(y.measuredPlayerGames,0);
 assert.equal(y.exclusions.uncertified_or_wrong_scoring_version,1);
});
test('unreconciled final score and Sleeper fantasy actual fail closed even with numeric points',()=>{
 for(const update of [{certified:false},{finalPlayerScoreRecomputed:false},
  {eventBonusesReconciled:false},{statCategoriesComplete:false},
  {fantasyScoreFromSleeper:true},{provider:'Sleeper'},{gameStatus:'LIVE'}]){
  const x=run({certificates:[{...proof(),...update}]});
  assert.equal(x.measuredPlayerGames,0,JSON.stringify(update));
 }
});
test('unknown, inconsistent, after-kickoff and too-old pregame timestamps excluded',()=>{
 for(const update of [{capturedAt:null},{capturedAt:'2026-11-22T21:20:00Z'},
  {capturedAt:'2026-11-22T22:00:00Z'},{capturedAt:'2026-11-01T21:25:00Z'},
  {kickoffAt:'2026-11-22T20:30:00Z'}]){
  const x=run({forecasts:[{...pred(),...update}]});
  assert.equal(x.measuredPlayerGames,0,JSON.stringify(update));
  assert.equal(x.exclusions.pregame_time_or_kickoff_unverified,1);
 }
});
test('forecast model identity, matched game identity, position and verified kickoff are required',()=>{
 assert.equal(run({forecasts:[{...pred(),modelVersion:null}]}).measuredPlayerGames,0);
 assert.equal(run({forecasts:[{...pred(),position:'RB'}]}).measuredPlayerGames,0);
 assert.equal(run({verifiedGames:[]}).measuredPlayerGames,0);
 assert.equal(run({verifiedGames:[{...game(),verified:false}]}).measuredPlayerGames,0);
 assert.equal(run({certificates:[{...proof(),gameId:'another-game'}]}).measuredPlayerGames,0);
});
test('repeated source certificates and forecasts never inflate sample count',()=>{
 const c=proof(),f=pred();
 const a=run({certificates:[c,c]});
 assert.equal(a.measuredPlayerGames,0);
 assert.equal(a.exclusions.duplicate_certified_game,1);
 const b=run({forecasts:[f,f]});
 assert.equal(b.measuredPlayerGames,0);
 assert.equal(b.exclusions.duplicate_forecast,1);
});
test('hindsight and Sleeper-derived score masquerading as forecast are blocked',()=>{
 for(const update of [{afterGameKnowledge:true},{fromSleeperActual:true},
  {provider:'Sleeper'},{scoringSystem:'PPR'}]){
  const x=run({forecasts:[{...pred(),...update}]});
  assert.equal(x.measuredPlayerGames,0);
 }
});
test('insufficient samples are never promoted to certified model accuracy',()=>{
 const x=run({minOverall:1,minPosition:1});
 assert.equal(x.measuredPlayerGames,1);
 assert.equal(x.sampleThresholdMet,false); // other positions unrepresented
 assert.equal(x.productionEligible,false);
 assert.equal(x.backtestCertified,false);
 assert.ok(x.perPositionSampleGaps.K>0);
});
test('legacy Week 7/8 archived predictions and calibration report are preserved but disqualified',()=>{
 const archives=[
  read('data/forecast_archive/week_07_first.json'),
  read('data/forecast_archive/week_08_first.json')];
 const locked=[
  read('data/forecast_archive/week_07_locked_players.json'),
  read('data/forecast_archive/week_08_locked_players.json')];
 const calibration=read('data/PREGAME_CALIBRATION.json');
 const out=auditLegacyForecastArchives({archives,lockedArchives:locked,calibration,
  rulesVersion:version});
 assert.equal(out.archivedItems.length,4);
 assert.equal(out.legacyForecastRecords,452);
 assert.equal(out.legacyCalibrationSamples,14);
 assert.equal(out.restoredRuleCertifiedComparisons,0);
 assert.equal(out.legacyCalibrationAccuraciesComparable,false);
 assert.ok(out.archivedItems[1].reasons.includes('legacy_explicitly_marked_ineligible'));
 assert.ok(out.archivedItems.every(x=>x.eligiblePairedGameScores===0));
 assert.equal(out.productionEligible,false);
});
test('no model, provider, production, Sleeper actual or commissioner update calls in independent accuracy audit',()=>{
 const src=readFileSync(new URL('./ffo-projection-accuracy-audit-637.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/\bfetch\s*\(|process\.env|api\.sleeper\.|sleeper\.app|writeLeagueScore|updateCommissioner|wrangler|secret/i);
 assert.match(src,/restored_ffl_rule_version_required/);
});
