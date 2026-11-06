/**
 * PFO 6.37 — read-only, SAME-RULE pregame prediction accuracy audit.
 *
 * Does not fetch providers, synthesize predictions, recalibrate models, or
 * write scores. Historical source certificates are required for truth.
 * Archived predictions produced under older FFL scoring rules are excluded.
 */
const POS=new Set(['QB','RB','WR','TE','K','DEF']);
const done=x=>['FINAL','COMPLETED','FINAL_OT','FINAL_OVERTIME'].includes(String(x||'').toUpperCase());
const num=x=>typeof x==='number'&&Number.isFinite(x);
const id=x=>x===null||x===undefined||String(x).trim()===''?null:String(x);
const date=x=>typeof x==='string'&&x.trim()?Date.parse(x):NaN;
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const avg=a=>a.length?a.reduce((n,v)=>n+v,0)/a.length:null;
const percentile=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.max(0,Math.ceil(a.length*p)-1)]:null;
const metrics=rows=>{
 if(!rows.length)return {n:0,mae:null,rmse:null,bias:null,medianAbsoluteError:null,p90AbsoluteError:null};
 const e=rows.map(x=>x.projected-x.actual),abs=e.map(Math.abs);
 return {n:rows.length,mae:round(avg(abs)),rmse:round(Math.sqrt(avg(e.map(x=>x*x)))),
  bias:round(avg(e)),medianAbsoluteError:round(percentile(abs,.5)),
  p90AbsoluteError:round(percentile(abs,.9))};
};
const expectedSnapshot=s=>s&&s.provider==='PFO'&&s.scoringSystem==='FFL';
const validCert=(c,version)=>c?.certified===true&&c?.provider==='MSF'&&
 c?.rulesVersion===version&&c?.fantasyScoreFromSleeper===false&&
 c?.finalPlayerScoreRecomputed===true&&c?.playerIdentityVerified===true&&
 c?.finalBoxScoreVerified===true&&c?.statCategoriesComplete===true&&
 c?.eventBonusesReconciled===true&&c?.statCorrectionsChecked===true&&
 done(c.gameStatus)&&num(c.points)&&id(c.playerId)&&id(c.gameId)&&
 Number.isInteger(c.week)&&c.week>=1&&c.week<=18&&POS.has(String(c.position||'').toUpperCase());
const key=x=>id(x.playerId)+'|'+id(x.gameId);
const inc=(obj,name)=>{obj[name]=(obj[name]||0)+1};
const emptyReasons=()=>Object.create(null);

/**
 * Returns a trustworthy measured error only for actual saved PFO pregame
 * snapshots and independently CERTIFIED final MSF/FFL game scores.
 * MINIMUM sample size is a reporting threshold, not a proof of calibration.
 * Duplicate source keys always fail closed, even if values are identical.
 */
export function auditFFLProjectionAccuracy({
 rulesVersion,forecasts=[],certificates=[],verifiedGames=[],
 cutoffMinutes=15,minOverall=100,minPosition=20
}={}){
 const excluded=emptyReasons(),byKey=new Map(),forecastByKey=new Map();
 const schedule=new Map(),badGames=new Set();
 for(const g of verifiedGames||[]){
  const gId=id(g?.gameId);
  if(!gId)continue;
  const valid=g?.provider==='MSF'&&g?.verified===true&&done(g?.status)&&
   Number.isInteger(g.week)&&g.week>=1&&g.week<=18&&
   Number.isFinite(date(g.kickoffAt));
  if(!valid||schedule.has(gId)){badGames.add(gId);schedule.delete(gId)}
  else if(!badGames.has(gId))schedule.set(gId,g);
 }
 if(!rulesVersion||typeof rulesVersion!=='string'){
  return {status:'withheld',reason:'restored_ffl_rule_version_required',
   measuredPlayerGames:0,metrics:metrics([]),byPosition:{},byWeek:{},
   exclusions:{missing_rules_version:1},productionEligible:false,
   backtestCertified:false,readOnly:true};
 }
 for(const c of certificates||[]){
  if(!validCert(c,rulesVersion)){inc(excluded,'uncertified_or_wrong_scoring_version');continue}
  const k=key(c);
  if(byKey.has(k)){byKey.delete(k);inc(excluded,'duplicate_certified_game');badGames.add('cert:'+k);continue}
  if(badGames.has('cert:'+k))continue;
  byKey.set(k,c);
 }
 for(const f of forecasts||[]){
  if(!expectedSnapshot(f)){inc(excluded,'non_pfo_or_non_ffl_forecast');continue}
  if(f.rulesVersion!==rulesVersion){inc(excluded,'legacy_or_wrong_scoring_version');continue}
  if(f.fromSleeperActual===true||f.afterGameKnowledge===true){
   inc(excluded,'hindsight_or_sleeper_score_input');continue
  }
  if(!num(f.points)||!id(f.playerId)||!id(f.gameId)||!POS.has(String(f.position||'').toUpperCase())||
    !Number.isInteger(f.week)||f.week<1||f.week>18){
    inc(excluded,'invalid_forecast_identity_or_points');continue
  }
  const k=key(f);
  if(forecastByKey.has(k)){forecastByKey.delete(k);badGames.add('forecast:'+k);inc(excluded,'duplicate_forecast');continue}
  if(badGames.has('forecast:'+k))continue;
  forecastByKey.set(k,f);
 }
 const paired=[];
 for(const [k,cert] of byKey){
  if(!forecastByKey.has(k)){inc(excluded,'missing_matching_pregame_forecast');continue}
  const f=forecastByKey.get(k),game=schedule.get(String(cert.gameId));
  if(!game||badGames.has(String(cert.gameId))){
   inc(excluded,'verified_game_kickoff_or_schedule_missing');continue
  }
  if(game.week!==cert.week||f.week!==cert.week||
    String(f.position).toUpperCase()!==String(cert.position).toUpperCase()){
   inc(excluded,'week_or_position_mismatch');continue
  }
  const kick=date(game.kickoffAt),forecastKick=date(f.kickoffAt),capture=date(f.capturedAt);
  if(!Number.isFinite(capture)||!Number.isFinite(forecastKick)||forecastKick!==kick||
    capture>kick-cutoffMinutes*60_000||capture<kick-7*86_400_000){
   inc(excluded,'pregame_time_or_kickoff_unverified');continue
  }
  if(!f.modelVersion||typeof f.modelVersion!=='string'){
   inc(excluded,'model_version_missing');continue
  }
  paired.push({playerId:String(cert.playerId),gameId:String(cert.gameId),
   position:String(cert.position).toUpperCase(),week:cert.week,
   actual:cert.points,projected:f.points,modelVersion:f.modelVersion,
   error:round(f.points-cert.points),
   absoluteError:round(Math.abs(f.points-cert.points))});
 }
 const group=(getter)=>Object.fromEntries(
  [...new Set(paired.map(getter))].sort().map(group=>[group,metrics(paired.filter(x=>getter(x)===group))]));
 const byPosition=group(x=>x.position),byWeek=group(x=>String(x.week));
 const positionGaps=Object.fromEntries([...POS].sort().filter(p=>(byPosition[p]?.n||0)<minPosition)
  .map(p=>[p,Math.max(0,minPosition-(byPosition[p]?.n||0))]));
 const sufficientSample=paired.length>=minOverall&&Object.keys(positionGaps).length===0;
 return {status:paired.length?'research_metrics_only':'no_verified_pregame_pairs',
  rulesVersion,measuredPlayerGames:paired.length,
  eligibleCertifiedScores:byKey.size,acceptedPregameForecasts:forecastByKey.size,
  metrics:metrics(paired),byPosition,byWeek,exclusions:{...excluded},
  perPositionSampleGaps:positionGaps,sampleThresholdMet:sufficientSample,
  analysisRows:paired,readOnly:true,productionEligible:false,
  backtestCertified:false,independentMSFTruthOnly:true,
  limitation:sufficientSample?
   'Sample gate reached; scoring completeness, calibration and deployment still require separate approval.':
   'Not enough comparable player-games for an accuracy claim; historical archives do not establish restored-rule forecasts.',
  source:'Source-certified MSF player-game scores and saved pregame PFO FFL forecasts'};
}

/**
 * Triage legacy prediction archives rather than converting unsupported
 * snapshots into fake backtest observations.
 */
export function auditLegacyForecastArchives({archives=[],lockedArchives=[],calibration=null,
 rulesVersion=''}={}){
 const items=[];
 for(const a of archives||[]){
  const rows=Object.keys(a?.players||{}).length;
  const reasons=['rule_version_not_attested','player_game_ids_and_positions_missing',
   'verified_kickoff_per_player_not_proven','independent_msf_final_certificates_missing'];
  if(a?.backtest_eligible===false)reasons.push('legacy_explicitly_marked_ineligible');
  items.push({week:a?.week??null,forecastCount:rows,modelVersion:a?.model_version||null,
   restoredRulesCompatible:false,eligiblePairedGameScores:0,reasons});
 }
 for(const a of lockedArchives||[]){
  const rows=Object.keys(a?.locked||{}).length;
  items.push({week:a?.week??null,forecastCount:rows,
   modelVersion:'legacy_locked_player_snapshot',
   restoredRulesCompatible:false,eligiblePairedGameScores:0,
   reasons:['rule_version_not_attested','independent_msf_final_certificates_missing',
    'legacy_provider_scoring_not_recomputed_under_restored_ffl_rules']});
 }
 return {status:'legacy_archive_excluded',rulesVersion,
  archivedItems:items,legacyForecastRecords:items.reduce((n,x)=>n+x.forecastCount,0),
  legacyCalibrationSamples:Number(calibration?.eligible_completed_week_samples||0),
  legacyCalibrationAccuraciesComparable:false,
  restoredRuleCertifiedComparisons:0,productionEligible:false,readOnly:true,
  note:'Historical snapshots and the old calibration report remain preserved. Rebuild comparisons only from source-certified matching scoring-version predictions and actuals.'};
}
