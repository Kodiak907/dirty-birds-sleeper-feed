import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {certifyHistoricalFFLPlayerGame,applicableFFLRuleKeys}
 from './ffo-historical-score-certificate.mjs';
import {buildLeagueHistoryCoverage,nextLeagueHistoryBatch,certifyLeagueGameBatch,NFL_2026_TEAMS}
 from './ffo-league-history-pipeline.mjs';
import {walkForwardBacktest} from './ffo-verified-history-backtest.mjs';
const rules=JSON.parse(readFileSync(new URL('./FFO_FFL_SCORING_V1.json',import.meta.url),'utf8'));
const checks={providerGameIdVerified:true,scheduleWeekVerified:true,finalScoreVerified:true,
 fullPlayCoverageVerified:true,finalBoxScoreVerified:true,playerGameLogsVerified:true,
 allScoringEventsReconciled:true,statCorrectionsChecked:true,scheduleGamesComplete:true};
const game={id:'163616',week:5,home:'GB',away:'CHI',status:'FINAL',provider:'MSF',...checks};
const player={id:'18607',name:'Jordan Love',team:'GB',position:'QB',identityVerified:true,
 gameId:game.id,stats:{passing:{passYards:250,passTD:2}}};
const proof=applicableFFLRuleKeys(rules.scoring,'QB').filter(x=>!['pass_yd','pass_td'].includes(x)).map(category=>({
 category,value:category==='pass_td_40p'?1:category==='pass_td_50p'?1:0,
 playerId:player.id,gameId:game.id,verified:true,
 source:/_td_(40p|50p)$/.test(category)?'msf_reconciled_pbp':'msf_final_stat'
}));
const certify=(changes={})=>certifyHistoricalFFLPlayerGame({
 game:changes.game||game,player:changes.player||player,rules:changes.rules||rules,
 componentProof:changes.componentProof||proof,
 bonusPolicy:changes.bonusPolicy===undefined?'highest_only':changes.bonusPolicy,
 bonusPolicyAdjudicated:changes.adjudicated===undefined?true:changes.adjudicated
});
test('Strict certificate produces exact independently sourced FFL sum only after every scoring field is explicitly verified',()=>{
 const result=certify();
 assert.equal(result.certified,true);
 assert.equal(result.status,'certified');
 assert.equal(result.points,21);
 assert.equal(result.requiredCategoryCount,result.verifiedCategoryCount);
 assert.equal(result.components.find(x=>x.category==='pass_td_40p').value,1);
 assert.equal(result.fantasyScoreFromSleeper,false);
 assert.equal(result.finalPlayerScoreRecomputed,true);
});
test('Actual GB Week 5 policy remains UNKNOWN: never certify synthetic assumptions as real season scores',()=>{
 const c=certify({adjudicated:false,bonusPolicy:null});
 assert.equal(c.certified,false);assert.equal(c.points,null);
 assert.ok(c.blockers.includes('touchdown_bonus_policy_unresolved'));
 assert.ok(c.blockers.includes('touchdown_bonus_policy_unadjudicated'));
});
test('Absent MSF zero remains unknown; never fill from expectation, implied participation or projections',()=>{
 const c=certify({componentProof:proof.filter(x=>x.category!=='fum_lost')});
 assert.equal(c.certified,false);assert.equal(c.points,null);
 assert.ok(c.missing.includes('fum_lost'));
});
test('Source disagreement, incomplete final game, wrong identity, pending corrections all withhold',()=>{
 const conflict=certify({componentProof:[...proof,{category:'pass_td',value:3,
  playerId:player.id,gameId:game.id,verified:true,source:'msf_reconciled_pbp'}]});
 assert.equal(conflict.certified,false);
 assert.ok(conflict.contradictions.some(x=>x.category==='pass_td'));
 assert.equal(certify({game:{...game,statCorrectionsChecked:false}}).certified,false);
 assert.equal(certify({player:{...player,gameId:'wrong'}}).certified,false);
 assert.equal(certify({game:{...game,status:'IN_PROGRESS'}}).certified,false);
 assert.equal(certify({game:{...game,fullPlayCoverageVerified:false}}).certified,false);
});
test('No duplicate fantasy score when stat includes a 2PT and event proof repeats it',()=>{
 const p={...player,stats:{...player.stats,twoPointConversions:{twoPtPassMade:1}}};
 const base=proof.filter(x=>x.category!=='pass_2pt');
 const c=certify({player:p,componentProof:[...base,
  {category:'pass_2pt',value:1,playerId:p.id,gameId:game.id,verified:true,source:'msf_reconciled_pbp'}]});
 assert.equal(c.certified,true);
 assert.equal(c.points,23);
 assert.equal(c.components.filter(x=>x.category==='pass_2pt').length,1);
});
test('32-team historical queue prioritizes Green Bay weeks before remaining NFL and reports missing evidence',()=>{
 const schedule=[
  {id:'a',week:1,weekVerified:true,home:'CHI',away:'GB',status:'FINAL'},
  {id:'b',week:2,weekVerified:true,home:'GB',away:'MIN',status:'COMPLETED'},
  {id:'c',week:1,weekVerified:true,home:'NYG',away:'DAL',status:'FINAL'},
  {id:'d',week:2,weekVerified:true,home:'BAL',away:'BUF',status:'FINAL'}
 ];
 const queue=nextLeagueHistoryBatch(schedule,{}, {maxGames:3});
 assert.equal(queue.pendingGames,4);
 assert.deepEqual(queue.batch.map(x=>x.gameId),['a','b','c']);
 const coverage=buildLeagueHistoryCoverage(schedule,{},[],{fromWeek:1,throughWeek:7});
 assert.equal(coverage.teamsRepresented,7);
 assert.equal(coverage.totalTeams,32);
 assert.equal(coverage.certifiedPlayerGameScores,0);
 assert.equal(coverage.leagueScheduleCertified,false);
 assert.equal(coverage.gb.sourceGames,2);
 assert.equal(coverage.byWeek.length,7);
 assert.equal(NFL_2026_TEAMS.length,32);
});
test('Only correctly identified final MSF certificates enter league dataset',()=>{
 const source=[{id:game.id,week:5,weekVerified:true,home:'GB',away:'CHI',status:'FINAL'}];
 const accepted=certify();
 const rejected=certify({bonusPolicy:null,adjudicated:false});
 const coverage=buildLeagueHistoryCoverage(source,{},[accepted,rejected],{fromWeek:5,throughWeek:5});
 assert.equal(coverage.certifiedPlayerGameScores,1);
 assert.equal(coverage.rejectedCertificates.length,1);
 assert.equal(coverage.certifiedHistoryRows[0].fflPoints,21);
 const batch=certifyLeagueGameBatch([{game,players:[player],proofsByPlayer:{[player.id]:proof}}],
  rules,{bonusPolicy:'highest_only',bonusPolicyAdjudicated:true});
 assert.equal(batch.certified,1);
 assert.equal(batch.productionWriteAllowed,false);
});
test('Walk-forward projection backtest holds out current game and computes MAE, RMSE, bias',()=>{
 const vals=[18,22,15,25,29,20,24];
 const certificates=vals.map((points,i)=>({
  certified:true,playerId:'18607',gameId:'w'+(i+1),week:i+1,
  provider:'MSF',gameStatus:'FINAL',position:'QB',team:'GB',
  opponent:'CHI',points,fantasyScoreFromSleeper:false
 }));
 const expectedFinalGamesByPlayer={18607:certificates.map(x=>({
  gameId:x.gameId,week:x.week,status:'FINAL',playerId:x.playerId
 }))};
 const t=walkForwardBacktest({certificates,expectedFinalGamesByPlayer,
  minWeek:4,maxWeek:7});
 assert.equal(t.status,'research_backtest_only');
 assert.equal(t.projections,4);
 assert.ok(t.global.mae!==null);
 assert.ok(t.global.rmse>=t.global.mae);
 assert.equal(t.noFutureDataLeakage,true);
 assert.ok(t.observations.every(x=>x.maxTrainingWeek<x.week));
 assert.equal(t.productionEligible,false);
 assert.equal(t.backtestCertified,false);
});
test('Withheld/unverified games cannot leak into future projection or backtest truth',()=>{
 const source=[{certified:false,points:80,playerId:'18607',gameId:'a',week:1,provider:'MSF',gameStatus:'FINAL'},
  {certified:true,points:8,playerId:'18607',gameId:'b',week:2,provider:'MSF',gameStatus:'FINAL'}];
 const t=walkForwardBacktest({certificates:source,
  expectedFinalGamesByPlayer:{18607:[{gameId:'a',week:1,status:'FINAL'},{gameId:'b',week:2,status:'FINAL'}]}});
 assert.equal(t.projections,0);
 assert.equal(t.eligibleCertifiedRows,1);
 assert.equal(t.status,'insufficient_certified_data');
});
test('Pipeline contains no Sleeper points, write APIs, or automatic production projections',()=>{
 for(const file of ['ffo-historical-score-certificate.mjs','ffo-league-history-pipeline.mjs','ffo-verified-history-backtest.mjs']){
  const src=readFileSync(new URL('./'+file,import.meta.url),'utf8');
  assert.doesNotMatch(src,/sleeper\.app|api\.sleeper|fetch\(|writeLeagueScore|updateCommissioner|process\.env/);
 }
});
