// Verified historical scoring -> projection QA. All events are synthetic fixtures.
// No API credentials, production mutations, Sleeper fantasy scoring or guessed zeroes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalScoringEligibility,buildHistoricalPlayerProfile,forecastFromVerifiedHistory}
 from './ffo-verified-history-projection.mjs';

const playerId='18607',nextWeek=8;
const finals=[1,2,3,4,5,6,7].map(week=>({week,gameId:'W'+week,status:'FINAL'}));
const points=[18,22,15,25,29,20,24];
const history=finals.map((g,i)=>({
 playerId,week:g.week,gameId:g.gameId,provider:'MSF',gameStatus:'FINAL',
 playerIdentityVerified:true,finalBoxScoreVerified:true,
 statCategoriesComplete:true,eventBonusesReconciled:true,statCorrectionsChecked:true,
 fflPoints:points[i],opponent:'OP'+g.week,team:'GB'
}));
const profile=()=>buildHistoricalPlayerProfile({playerId,asOfWeek:nextWeek,rows:history,expectedFinalGames:finals});
test('Seven final independently reconciled MSF games form a verified Week 8 baseline',()=>{
 const p=profile();
 assert.equal(p.status,'verified_form_sample');
 assert.equal(p.verifiedGames,7);assert.equal(p.expectedGames,7);assert.equal(p.coverage,1);
 const f=forecastFromVerifiedHistory({profile:p,nextWeek,availabilityStatus:'ACTIVE'});
 assert.equal(f.status,'experimental_verified_history_projection');
 assert.equal(f.formOnly,24.22);
 assert.equal(f.points,24.22);
 assert.equal(f.opponentFactor,1);
 assert.equal(f.productionEligible,false);assert.equal(f.backtestCertified,false);
 assert.equal(f.confidence,'moderate_historical_coverage');
 assert.ok(f.limitations.includes('opponent_adjustment_unverified_neutral_assumed'));
});
test('An unavailable player is withheld, never offered a positive projection',()=>{
 const p=profile();
 for(const availabilityStatus of ['OUT','IR','INACTIVE','BYE']){
  const f=forecastFromVerifiedHistory({profile:p,nextWeek,availabilityStatus});
  assert.equal(f.status,'withheld');assert.equal(f.points,null);
  assert.ok(f.limitations.includes('player_unavailable'));
 }
});
test('Incomplete category coverage, corrections, penalties and provider filters exclude history',()=>{
 const bad={...history[0],statCategoriesComplete:false,eventBonusesReconciled:false,
  statCorrectionsChecked:false,fantasyScoreFromSleeper:true};
 const r=historicalScoringEligibility(bad,playerId,nextWeek);
 assert.ok(r.includes('scoring_categories_incomplete'));
 assert.ok(r.includes('bonus_event_reconciliation_incomplete'));
 assert.ok(r.includes('stat_corrections_unchecked'));
 assert.ok(r.includes('disallowed_sleeper_score_input'));
 const p=buildHistoricalPlayerProfile({playerId,asOfWeek:nextWeek,
  rows:[...history.slice(1),bad],expectedFinalGames:finals});
 assert.equal(p.verifiedGames,6);
 assert.equal(p.missing.length,1);
 assert.ok(p.reasons.includes('some_historical_game_scores_missing'));
});
test('Missing historical games produce withheld score rather than fabricated 0',()=>{
 const p=buildHistoricalPlayerProfile({playerId,asOfWeek:nextWeek,
  rows:history.slice(0,2),expectedFinalGames:finals});
 assert.equal(p.verifiedGames,2);
 assert.equal(p.coverage,.29);
 const f=forecastFromVerifiedHistory({profile:p,nextWeek});
 assert.equal(f.points,null);assert.equal(f.status,'withheld');
});
test('No future game gets into historical projection',()=>{
 const row={...history[0],week:8,gameId:'W8'};
 const p=buildHistoricalPlayerProfile({playerId,asOfWeek:8,
  rows:[...history,row],expectedFinalGames:[...finals,{week:8,gameId:'W8',status:'FINAL'}]});
 assert.equal(p.verifiedGames,7);
 assert.equal(p.games.some(x=>x.week>=8),false);
});
test('A corrected game with conflicting fantasy points blocks that game',()=>{
 const p=buildHistoricalPlayerProfile({playerId,asOfWeek:nextWeek,
  rows:[...history,{...history[0],fflPoints:150}],
  expectedFinalGames:finals});
 assert.equal(p.duplicateConflicts.length,1);
 assert.equal(p.games.length,6);
 const f=forecastFromVerifiedHistory({profile:p,nextWeek});
 assert.equal(f.points,null);
 assert.ok(f.limitations.includes('historical_corrections_unadjudicated'));
});
test('A duplicate snapshot of the same game does not inflate sample size',()=>{
 const p=buildHistoricalPlayerProfile({playerId,asOfWeek:nextWeek,
  rows:[history[0],...history],expectedFinalGames:finals});
 assert.equal(p.verifiedGames,7);
 assert.equal(p.duplicateConflicts.length,0);
});
test('Opponent adjustment uses verified prior-week samples and is capped to 15 percent',()=>{
 const allowed=[1,2,3,4].map((week,i)=>({
  week,gameId:'DEF'+week,provider:'MSF',finalVerified:true,
  fflPointsAllowed:30+i,opponent:'CAR'}));
 const f=forecastFromVerifiedHistory({profile:profile(),nextWeek,opponent:'CAR',
  opponentPositionSamples:allowed,leaguePositionalMean:15,availabilityStatus:'ACTIVE'});
 assert.equal(f.opponentFactor,1.15);
 assert.equal(f.opponentSampleCount,4);
 assert.equal(f.points,27.85);
 assert.ok(f.points>f.formOnly);
});
test('Opponent small sample and mismatched provider do not trigger unjustified adjustment',()=>{
 const allowed=[{week:2,gameId:'X',provider:'Sleeper',finalVerified:true,fflPointsAllowed:80,opponent:'CAR'}];
 const f=forecastFromVerifiedHistory({profile:profile(),nextWeek,
   opponent:'CAR',opponentPositionSamples:allowed,leaguePositionalMean:10});
 assert.equal(f.opponentFactor,1);
 assert.equal(f.opponentSampleCount,0);
 assert.equal(f.points,f.formOnly);
});
