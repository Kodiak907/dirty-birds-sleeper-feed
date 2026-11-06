/**
 * PFO 6.41 — isolated bias-calibration experiment against an untuned baseline.
 * Input rows are ONLY 6.40 pairs independently verified under restored FFL
 * rules; this module has no output path to PFO production projections.
 */
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
const POS=['QB','RB','WR','TE','K','DEF'];
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const score=(rows,project)=>!rows.length?{n:0,mae:null,rmse:null,bias:null}:(()=>{
 const errors=rows.map(r=>project(r)-r.actual);
 return {n:rows.length,mae:round(errors.reduce((a,b)=>a+Math.abs(b),0)/rows.length),
  rmse:round(Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/rows.length)),
  bias:round(errors.reduce((a,b)=>a+b,0)/rows.length)};
})();
const average=a=>a.reduce((n,v)=>n+v,0)/a.length;
const safeRow=r=>r&&POS.includes(r.position)&&Number.isInteger(r.week)&&
 r.week>=1&&r.week<=18&&typeof r.projected==='number'&&Number.isFinite(r.projected)&&
 typeof r.actual==='number'&&Number.isFinite(r.actual)&&
 typeof r.playerId==='string'&&r.playerId.length>0&&
 typeof r.gameId==='string'&&r.gameId.length>0;
export function evaluateFFLCalibration({
 auditReport,expectedVersion=FFL_RULES_VERSION,trainingThroughWeek=null,
 minTrainPerPosition=12,minValidationPerPosition=6,minValidationOverall=90,
 minImprovementMae=0.1,maxPositionRegression=0.25,maxAbsoluteAdjustment=3
}={}){
 const blocked=reason=>({schema:'FFO_PFO_CALIBRATION_RESEARCH_V1',version:'PFO 6.41',
  status:'withheld',reason,rulesVersion:expectedVersion,productionEligible:false,
  candidateApproved:false});
 if(!auditReport||auditReport.rulesVersion!==expectedVersion||
  !auditReport.independentMSFTruthOnly||auditReport.status!=='research_metrics_only')
  return blocked('verified_same_version_accuracy_report_required');
 const rows=auditReport.analysisRows||[];
 if(!Array.isArray(rows)||!rows.length||!rows.every(safeRow))
  return blocked('complete_source_verified_prediction_pairs_required');
 const keys=new Set();
 for(const row of rows){
  const key=row.playerId+'|'+row.gameId;
  if(keys.has(key))return blocked('duplicate_player_game_pairs');
  keys.add(key);
 }
 const weeks=[...new Set(rows.map(x=>x.week))].sort((a,b)=>a-b);
 if(weeks.length<4)return blocked('at_least_four_distinct_completed_weeks_required');
 const split=trainingThroughWeek??weeks[Math.floor(weeks.length*.6)-1];
 if(!Number.isInteger(split)||split<=weeks[0]||split>=weeks.at(-1))
  return blocked('no_strictly_held_out_validation_period');
 const train=rows.filter(r=>r.week<=split),holdout=rows.filter(r=>r.week>split);
 if(holdout.length<minValidationOverall)
  return blocked('insufficient_heldout_accuracy_samples');
 const missing={};
 for(const position of POS){
  const tr=train.filter(r=>r.position===position).length,
   val=holdout.filter(r=>r.position===position).length;
  if(tr<minTrainPerPosition||val<minValidationPerPosition)
   missing[position]={train:tr,validation:val,
    requiredTrain:minTrainPerPosition,requiredValidation:minValidationPerPosition};
 }
 if(Object.keys(missing).length)
  return {...blocked('position_coverage_below_calibration_threshold'),positionGaps:missing,
   trainingSamples:train.length,validationSamples:holdout.length};
 const corrections=Object.fromEntries(POS.map(position=>{
  const src=train.filter(x=>x.position===position);
  const rawBias=average(src.map(x=>x.actual-x.projected));
  const offset=Math.max(-maxAbsoluteAdjustment,Math.min(maxAbsoluteAdjustment,rawBias));
  return [position,round(offset)];
 }));
 const baseline=score(holdout,r=>r.projected);
 const adjusted=score(holdout,r=>r.projected+corrections[r.position]);
 const byPosition=Object.fromEntries(POS.map(p=>{
  const sample=holdout.filter(x=>x.position===p);
  return [p,{baseline:score(sample,r=>r.projected),
   candidate:score(sample,r=>r.projected+corrections[r.position])}];
 }));
 const noRegression=POS.every(p=>
  byPosition[p].candidate.mae<=byPosition[p].baseline.mae+maxPositionRegression);
 const improvement=round(baseline.mae-adjusted.mae);
 const researchPass=improvement>=minImprovementMae&&noRegression;
 return {schema:'FFO_PFO_CALIBRATION_RESEARCH_V1',version:'PFO 6.41',
  status:researchPass?'heldout_candidate_passed':'heldout_candidate_rejected',
  rulesVersion:expectedVersion,trainingThroughWeek:split,
  firstValidationWeek:Math.min(...holdout.map(r=>r.week)),
  trainingSamples:train.length,validationSamples:holdout.length,
  baseline,adjusted,improvementMae:improvement,byPosition,corrections,
  noFutureLeakage:train.every(r=>r.week<=split)&&holdout.every(r=>r.week>split),
  source:'PFO captured pregame projections and independently certified MSF FFL actuals',
  modelChangesApplied:false,productionEligible:false,candidateApproved:false,
  separateApprovalNeeded:true,
  caveat:'Candidate is only an out-of-sample historical research hypothesis. No model, live projection, lineups, trades or production data have been changed.'};
}
