import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildHistoricalAuditWorklist,buildCertificationWorklistFromCheckpoints}
 from './ffo-historical-audit-worklist.mjs';
import {compareFFLForecasts} from './ffo-projection-benchmark.mjs';
const src=x=>readFileSync(new URL(x,import.meta.url),'utf8');
test('GB Week 1 audit becomes prioritized source-backed exception worklist, not scores',()=>{
 const report={team:'GB',
  weeks:[{week:1,audit:{supported:true},teamFilterVerified:true}],
  playerEventWeeks:[{week:1,gameId:'163553',game:'GB @ MIN',
   evidence:{rawPlayCount:130,publishedCandidates:2,unverifiedCandidateEvents:1},
   sameGameReconciliation:{
    sameGameStatMatches:2,finalScoreboardVerified:true,
    missingOrAmbiguousPlayerIds:[],duplicateSameGamePlayerIds:[],
    twoPointCorroboration:[{sourceTier:'pbp_outcome_or_identity_unverified'}],
    ledger:{lineItems:[{blockers:['team_possession_unverified']}]}
   }}],
  dstBoxWeeks:[{week:1,evidence:{gameId:'163553',sourceFinalVerified:true,
   scheduleFinalVerified:true,scheduleScoreMatches:true}}],
  kickWeeks:[{week:1,evidence:{fullKickerScoreCertified:false}}],
  teamWeeks:[{week:1,evidence:{teamFilterVerified:true}}]
 };
 const w=buildHistoricalAuditWorklist(report,{weeks:1});
 assert.equal(w.sourceParsed,1);
 assert.equal(w.games[0].gameId,'163553');
 assert.ok(w.games[0].tasks.some(x=>x.code==='two_point_corroboration_missing'));
 assert.ok(w.games[0].tasks.some(x=>x.code==='whole_game_play_coverage_unverified'));
 assert.ok(w.games[0].tasks.some(x=>x.code==='forty_fifty_bonus_policy_pending'));
 assert.equal(w.scoreCertifiedCount,0);
 assert.equal(w.productionScoreWriteAllowed,false);
});
test('Incomplete audit never turns omitted week, zero categories or missing stats into certified points',()=>{
 const w=buildHistoricalAuditWorklist({team:'GB',weeks:[]});
 assert.equal(w.games.length,6);
 assert.equal(w.sourceParsed,0);
 assert.ok(w.games.every(x=>!x.scoreCertified&&x.tasks.length>0));
 assert.ok(w.games.every(x=>x.publishedScoringCandidates===null));
});
test('All 107 source-checks can be complete while certification remains withheld',()=>{
 const schedule=Array.from({length:7},(_,i)=>({id:String(100+i),week:i+1,home:'GB',away:'MIN'}));
 const snapshots=Object.fromEntries(schedule.map(g=>[g.id,{
  checkedAt:new Date().toISOString(),pbpPublished:true,finalBoxVerified:true,
  scoreMatchesSchedule:true,playerGameLogsVerified:true,sourceFailure:false
 }]));
 const w=buildCertificationWorklistFromCheckpoints(schedule,snapshots);
 assert.equal(w.sourceChecked,7);
 assert.equal(w.sourcePendingOrFailed,0);
 assert.equal(w.certifiedPlayerScores,0);
 assert.ok(w.worklist.every(x=>x.missing.includes('stat_corrections_unverified')));
 assert.ok(w.worklist.every(x=>x.certificationReady===false));
});
test('PFO versus Sleeper comparisons use only same FFL rules and previously captured projections',()=>{
 const kickoffAt='2026-10-18T17:00:00Z',rulesVersion='2026-10-28-rules-v1';
 const mk=(provider,points,capturedAt='2026-10-18T16:20:00Z')=>({
  provider,points,capturedAt,kickoffAt,playerId:'p1',gameId:'g1',week:6,
  scoringSystem:'FFL',rulesVersion
 });
 const target={certified:true,provider:'MSF',fantasyScoreFromSleeper:false,
  playerId:'p1',gameId:'g1',week:6,position:'QB',gameStatus:'FINAL',points:21,
  rulesVersion};
 const result=compareFFLForecasts({pfoForecasts:[mk('PFO',20)],
  sleeperForecasts:[mk('Sleeper',18)],certificates:[target],rulesVersion});
 assert.equal(result.matchedPlayerGames,1);
 assert.equal(result.pfo.mae,1);
 assert.equal(result.sleeper.mae,3);
 assert.equal(result.maeImprovementAgainstSleeper,2);
 assert.equal(result.evidenceSufficientForSuperiorityClaim,false);
 assert.equal(result.productionEligible,false);
 const after=compareFFLForecasts({pfoForecasts:[mk('PFO',21,'2026-10-18T17:05:00Z')],
  sleeperForecasts:[mk('Sleeper',18)],certificates:[target],rulesVersion});
 assert.equal(after.matchedPlayerGames,0);
 assert.equal(after.pfo.mae,null);
 const mismatch=compareFFLForecasts({pfoForecasts:[mk('PFO',20)],
  sleeperForecasts:[{...mk('Sleeper',18),rulesVersion:'SLEEPER_DEFAULT'}],
  certificates:[target],rulesVersion});
 assert.equal(mismatch.matchedPlayerGames,0);
 const noTruth=compareFFLForecasts({pfoForecasts:[mk('PFO',20)],
  sleeperForecasts:[mk('Sleeper',18)],certificates:[{...target,certified:false}],rulesVersion});
 assert.equal(noTruth.matchedPlayerGames,0);
});
test('Benchmark requires paired predictions from comparable pregame capture windows',()=>{
 const basic=(provider,capturedAt,points=17)=>({
  provider,points,capturedAt,kickoffAt:'2026-10-18T17:00:00Z',
  playerId:'p1',gameId:'g1',week:6,scoringSystem:'FFL',rulesVersion:'rules'
 });
 const target={certified:true,provider:'MSF',fantasyScoreFromSleeper:false,
  playerId:'p1',gameId:'g1',week:6,position:'RB',gameStatus:'FINAL',points:18,
  rulesVersion:'rules'};
 const w=compareFFLForecasts({rulesVersion:'rules',certificates:[target],
  pfoForecasts:[basic('PFO','2026-10-18T15:00:00Z')],
  sleeperForecasts:[basic('Sleeper','2026-10-18T16:00:00Z')],maxCaptureGapMinutes:30});
 assert.equal(w.matchedPlayerGames,0);
 assert.equal(w.excluded.captureWindowMismatch,1);
 assert.equal(w.productionEligible,false);
});
test('UI files refer to audit triage but never auto-publish scoring or projections',()=>{
 const game=src('./ffo-gamecast.js'),ctrl=src('./ffo-scoring-research-controller.mjs');
 assert.match(game,/renderAuditWorklist/);
 assert.match(game,/renderAuditWorklist\(report\)/);
 assert.match(ctrl,/getCertificationWorklist/);
 assert.doesNotMatch(src('./ffo-historical-audit-worklist.mjs'),/fetch\(|writeScore|updateCommissioner|api\.sleeper/);
 assert.doesNotMatch(src('./ffo-projection-benchmark.mjs'),/fetch\(|writeScore|updateCommissioner|api\.sleeper/);
});
