/**
 * Walk-forward FFL projection validation. Historical MSF certified points only.
 * Every forecast is computed with strictly earlier weeks; target is held out.
 * Never publishes model output to production lineup, trade, waiver or PFO scores.
 */
import {buildHistoricalPlayerProfile,forecastFromVerifiedHistory}
 from './ffo-verified-history-projection.mjs';
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const average=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const median=values=>values.length?([...values].sort((a,b)=>a-b)[Math.floor((values.length-1)/2)]):null;
const isFinal=x=>/^(FINAL|COMPLETED|FINAL_OT|FINAL_OVERTIME)$/i.test(String(x||''));
// PFO 6.37: synthetic walk-forward form testing is NOT evidence that the
// real preview's past predictions were made before kickoff. Never mix scores
// certified against a different FFL ruleset or ignore missing MSF proofs.
const eligibleRow=(c,rulesVersion)=>!!rulesVersion&&c?.rulesVersion===rulesVersion&&
 c?.certified===true&&Number.isFinite(c.points)&&
 c.fantasyScoreFromSleeper===false&&c.provider==='MSF'&&
 c.finalPlayerScoreRecomputed===true&&c.playerIdentityVerified===true&&
 c.finalBoxScoreVerified===true&&c.statCategoriesComplete===true&&
 c.eventBonusesReconciled===true&&c.statCorrectionsChecked===true&&
 Number.isInteger(c.week)&&c.week>=1&&c.week<=18&&
 c.gameId&&c.playerId&&isFinal(c.gameStatus);
function score(reports){
 const n=reports.length;
 if(!n)return {n:0,mae:null,rmse:null,bias:null,medianAbsoluteError:null,baselineMae:null};
 const errors=reports.map(r=>r.projected-r.actual);
 return {n,mae:round(average(errors.map(Math.abs))),
  rmse:round(Math.sqrt(average(errors.map(e=>e*e)))),
  bias:round(average(errors)),medianAbsoluteError:round(median(errors.map(Math.abs))),
  baselineMae:round(average(reports.map(r=>Math.abs(r.baseline-r.actual))))};
}
/**
 * All observations and expected final games must come from verified, unique
 * past MSF records; one player + one game identity yields one score.
 */
export function walkForwardBacktest({certificates=[],expectedFinalGamesByPlayer={},
 minWeek=4,maxWeek=18,availabilityByPlayerWeek={},opponentHistory={},
 rulesVersion=''}={}){
 const candidates=(certificates||[]).filter(c=>eligibleRow(c,rulesVersion));
 const conflicts=[],byIdentity=new Map();
 for(const c of candidates){
  const key=String(c.playerId)+'|'+String(c.gameId);
  const existing=byIdentity.get(key);
  if(existing&&existing.points!==c.points){
   conflicts.push({playerId:String(c.playerId),gameId:String(c.gameId)});
   byIdentity.delete(key);
  }else if(!conflicts.some(x=>x.playerId===String(c.playerId)&&x.gameId===String(c.gameId))){
   byIdentity.set(key,c);
  }
 }
 const rows=[...byIdentity.values()],players=[...new Set(rows.map(c=>String(c.playerId)))];
 const results=[],withheld=[];
 for(const playerId of players){
  const playerRows=rows.filter(c=>String(c.playerId)===playerId).sort((a,b)=>a.week-b.week);
  const schedule=expectedFinalGamesByPlayer[playerId]||[];
  for(const target of playerRows){
   if(target.week<minWeek||target.week>maxWeek)continue;
   const targetId=String(target.gameId);
   const targetSchedule=schedule.filter(g=>g.week===target.week&&String(g.gameId)===targetId);
   if(targetSchedule.length!==1||!isFinal(targetSchedule[0].status)){
    withheld.push({playerId,week:target.week,reason:'target_game_not_in_verified_schedule'});continue;
   }
   const prior=playerRows.filter(c=>c.week<target.week).map(c=>({
    playerId,week:c.week,gameId:c.gameId,provider:c.provider,gameStatus:c.gameStatus,
    playerIdentityVerified:true,finalBoxScoreVerified:true,statCategoriesComplete:true,
    eventBonusesReconciled:true,statCorrectionsChecked:true,fflPoints:c.points,
    team:c.team,opponent:c.opponent,fantasyScoreFromSleeper:false
   }));
   const priorExpected=schedule.filter(g=>Number.isInteger(g.week)&&g.week<target.week&&isFinal(g.status));
   const profile=buildHistoricalPlayerProfile({
    playerId,asOfWeek:target.week,rows:prior,expectedFinalGames:priorExpected
   });
   const status=availabilityByPlayerWeek[playerId+'|'+target.week]||'unknown';
   const forecast=forecastFromVerifiedHistory({profile,nextWeek:target.week,
    opponent:target.opponent||null,
    opponentPositionSamples:(opponentHistory[target.opponent+'|'+target.position]||[])
      .filter(x=>x.week<target.week),
    availabilityStatus:status
   });
   if(forecast.points===null||!Number.isFinite(forecast.points)){
    withheld.push({playerId,week:target.week,reason:'forecast_withheld',
     details:forecast.limitations});continue;
   }
   const history=prior.map(x=>x.fflPoints),baseline=average(history);
   results.push({playerId,gameId:targetId,week:target.week,position:target.position||'UNKNOWN',
    opponent:target.opponent||null,
    projected:forecast.points,actual:target.points,baseline:round(baseline),
    absoluteError:round(Math.abs(target.points-forecast.points)),
    forecastFormOnly:forecast.formOnly,
    trainingGames:profile.games.length,maxTrainingWeek:Math.max(...prior.map(x=>x.week)),
    provider:'MSF',status:'out_of_sample_research'});
  }
 }
 const positions={};
 for(const position of [...new Set(results.map(x=>x.position))].sort())
  positions[position]=score(results.filter(r=>r.position===position));
 const weeks={};
 for(const week of [...new Set(results.map(x=>x.week))].sort((a,b)=>a-b))
  weeks[week]=score(results.filter(r=>r.week===week));
 return {
  status:results.length?'research_backtest_only':'insufficient_certified_data',
  rulesVersion:rulesVersion||null,
  certificationVersionMissing:!rulesVersion,
  rejectedUnversionedOrIncompleteCertificates:(certificates||[]).length-candidates.length,
  realPregamePredictionAccuracyMeasured:false,
  projections:results.length,eligibleCertifiedRows:rows.length,
  rejectedDuplicateRevisions:conflicts,
  global:score(results),byPosition:positions,byWeek:weeks,
  withheld,observations:results,
  verifiedZeroPointsCount:rows.filter(c=>c.points===0).length,
  noFutureDataLeakage:results.every(x=>x.maxTrainingWeek<x.week),
  backtestCertified:false,productionEligible:false,
  // Success depends on actual source coverage plus manager-approved error bars.
  limitation:'Walk-forward historical form research is not evaluation of saved pregame PFO forecasts. Same-version certified MSF actuals required; synthetic model results cannot establish PFO accuracy.',
  source:'verified historical MSF/FFL score certificates',
  fantasyScoreFromSleeper:false
 };
}
