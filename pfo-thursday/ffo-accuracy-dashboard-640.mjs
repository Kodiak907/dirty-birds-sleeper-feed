/**
 * PFO 6.40 — independent FFL accuracy metrics from the dedicated D1 ledger.
 * Read-only. No synthetic actuals, Sleeper score lookups or model changes.
 */
import {auditFFLProjectionAccuracy} from './ffo-projection-accuracy-audit-637.mjs';
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
const STATUSES=new Set(['research_metrics_only','no_verified_pregame_pairs']);
const getRows=async(db,sql)=>{
 const result=await db.prepare(sql).all();
 if(!Array.isArray(result?.results))throw Error('accuracy_database_query_unavailable');
 return result.results;
};
const parse=(row,type)=>{
 try{
  const object=JSON.parse(row.payload_json);
  return object&&typeof object==='object'?object:null;
 }catch{return null}
};
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const summary=rows=>{
 if(!rows.length)return {n:0,mae:null,rmse:null,bias:null};
 const errors=rows.map(r=>r.projected-r.actual);
 return {n:errors.length,mae:round(errors.reduce((v,n)=>v+Math.abs(n),0)/errors.length),
  rmse:round(Math.sqrt(errors.reduce((v,n)=>v+n*n,0)/errors.length)),
  bias:round(errors.reduce((v,n)=>v+n,0)/errors.length)};
};
export function reportAccuracyFromVerifiedRecords({forecasts=[],certificates=[],games=[]}={}){
 const raw=auditFFLProjectionAccuracy({rulesVersion:FFL_RULES_VERSION,
  forecasts,certificates,verifiedGames:games});
 const players=new Map();
 for(const row of raw.analysisRows||[]){
  if(!players.has(row.playerId))players.set(row.playerId,[]);
  players.get(row.playerId).push(row);
 }
 const byPlayer=Object.fromEntries([...players]
  .filter(([,rows])=>rows.length>=3)
  .sort(([a],[b])=>a.localeCompare(b))
  .slice(0,150).map(([id,rows])=>[id,summary(rows)]));
 return {
  schema:'FFO_PFO_ACCURACY_DASHBOARD_V1',version:'PFO 6.40',
  status:STATUSES.has(raw.status)?raw.status:'withheld',
  rulesVersion:FFL_RULES_VERSION,
  measuredPlayerGames:raw.measuredPlayerGames,
  acceptedPregameForecasts:raw.acceptedPregameForecasts,
  eligibleCertifiedScores:raw.eligibleCertifiedScores,
  metrics:raw.metrics,
  byPosition:raw.byPosition,byWeek:raw.byWeek,byPlayer,
  sampleThresholdMet:raw.sampleThresholdMet,
  sampleGaps:raw.perPositionSampleGaps,
  exclusions:raw.exclusions,
  limitations:raw.limitation,
  authority:'MSF independently certified FFL actuals + PFO server-stamped pregame snapshots',
  trainingOrProductionChanges:false,
  readOnly:true,modelApprovedForDeployment:false
 };
}
export async function readAccuracyDashboard(db){
 if(!db?.prepare)return {schema:'FFO_PFO_ACCURACY_DASHBOARD_V1',
  version:'PFO 6.40',status:'blocked',
  reason:'dedicated_accuracy_database_binding_missing',
  measuredPlayerGames:0,metrics:{n:0,mae:null,rmse:null,bias:null},
  readOnly:true,modelApprovedForDeployment:false};
 try{
  const [f,c,g]=await Promise.all([
   getRows(db,'SELECT payload_json FROM pfo_accuracy_forecasts ORDER BY captured_at DESC LIMIT 15000'),
   getRows(db,'SELECT payload_json FROM pfo_accuracy_final_certificates ORDER BY certified_at DESC LIMIT 15000'),
   getRows(db,'SELECT payload_json FROM pfo_accuracy_verified_games ORDER BY week DESC LIMIT 1000')
  ]);
  // NULL or corrupt payloads are never silently converted to a zero-point score.
  const validF=f.map(x=>parse(x)).filter(Boolean),validC=c.map(x=>parse(x)).filter(Boolean),
   validG=g.map(x=>parse(x)).filter(Boolean);
  const report=reportAccuracyFromVerifiedRecords({
   forecasts:validF,certificates:validC,games:validG});
  return {...report,ledgerCounts:{forecasts:f.length,certificates:c.length,games:g.length,
   discardedUnreadableRows:f.length-validF.length+c.length-validC.length+g.length-validG.length}};
 }catch{
  return {schema:'FFO_PFO_ACCURACY_DASHBOARD_V1',version:'PFO 6.40',
   status:'blocked',reason:'isolated_ledger_schema_or_query_unavailable',
   measuredPlayerGames:0,metrics:{n:0,mae:null,rmse:null,bias:null},
   readOnly:true,modelApprovedForDeployment:false};
 }
}
