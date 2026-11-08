/**
 * PFO 6.40 — independent FFL accuracy metrics from the dedicated D1 ledger.
 * Read-only. No synthetic actuals, Sleeper score lookups or model changes.
 */
import {auditFFLProjectionAccuracy} from './ffo-projection-accuracy-audit-637.mjs';
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
import {reconcileFinalCorrections643} from './ffo-accuracy-correction-view-643.mjs';
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
  // A LIMIT boundary can hide earlier entries. Withhold instead of
  // calculating deceptively complete accuracy from a truncated ledger.
  if(f.length>=15000||c.length>=15000||g.length>=1000){
   return {schema:'FFO_PFO_ACCURACY_DASHBOARD_V1',version:'PFO 6.43',
    status:'blocked',reason:'accuracy_ledger_query_limit_reached',
    measuredPlayerGames:0,metrics:{n:0,mae:null,rmse:null,bias:null},
    readOnly:true,modelApprovedForDeployment:false};
  }
  // Any malformed record means results may have been biased by missing truth.
  const validF=f.map(x=>parse(x)).filter(Boolean),validC=c.map(x=>parse(x)).filter(Boolean),
   validG=g.map(x=>parse(x)).filter(Boolean);
  if(validF.length!==f.length||validC.length!==c.length||validG.length!==g.length){
   return {schema:'FFO_PFO_ACCURACY_DASHBOARD_V1',version:'PFO 6.43',
    status:'blocked',reason:'incomplete_or_corrupt_primary_accuracy_ledger',
    measuredPlayerGames:0,metrics:{n:0,mae:null,rmse:null,bias:null},
    ledgerCounts:{forecasts:f.length,certificates:c.length,games:g.length,
     discardedUnreadableRows:f.length-validF.length+c.length-validC.length+g.length-validG.length},
    readOnly:true,modelApprovedForDeployment:false};
  }
  // 6.43: correction history is OPTIONAL before the separate D1 migration,
  // but never silently claim that an untracked revised actual is certified.
  const schema=await getRows(db,
   "SELECT name FROM sqlite_master WHERE type='table' AND name='pfo_accuracy_final_revisions' LIMIT 1");
  const revisionSchemaPresent=schema.some(x=>x.name==='pfo_accuracy_final_revisions');
  let actuals=validC,correctionStatus='not_migrated_or_unavailable',correctionDetails=null;
  let revisionRows=0,unreadableRevisions=0;
  if(revisionSchemaPresent){
   const rows=await getRows(db,
    'SELECT payload_json FROM pfo_accuracy_final_revisions ORDER BY certified_at DESC LIMIT 15000');
   revisionRows=rows.length;
   const parsed=rows.map(x=>parse(x)).filter(Boolean);
   unreadableRevisions=rows.length-parsed.length;
   if(unreadableRevisions>0||rows.length>=15000){
    return {schema:'FFO_PFO_ACCURACY_DASHBOARD_V1',version:'PFO 6.43',
     status:'blocked',reason:'incomplete_or_corrupt_correction_revision_ledger',
     measuredPlayerGames:0,metrics:{n:0,mae:null,rmse:null,bias:null},
     readOnly:true,modelApprovedForDeployment:false};
   }
   const reviewed=reconcileFinalCorrections643({
    originals:validC,revisions:parsed,rulesVersion:FFL_RULES_VERSION});
   if(reviewed.status==='correction_integrity_blocked'){
    return {schema:'FFO_PFO_ACCURACY_DASHBOARD_V1',version:'PFO 6.43',
     status:'blocked',reason:'correction_revision_integrity_unverified',
     measuredPlayerGames:0,metrics:{n:0,mae:null,rmse:null,bias:null},
     readOnly:true,modelApprovedForDeployment:false};
   }
   actuals=reviewed.certificates;
   correctionStatus=reviewed.status;
   correctionDetails={applied:reviewed.revisionsApplied,
    correctedPlayerGames:reviewed.correctedPlayerGames,
    withheldPairs:reviewed.withheldKeys.length,
    issues:reviewed.issues};
  }
  const report=reportAccuracyFromVerifiedRecords({
   forecasts:validF,certificates:actuals,games:validG});
  return {...report,correctionLedger:{
    status:correctionStatus,migrationApplied:revisionSchemaPresent,
    evidenceCompleteForRelease:false,latestSourceCorrectionFeedVerified:false,
    correctionDetails,revisionRows,unreadableRevisions},
   ledgerCounts:{forecasts:f.length,certificates:c.length,games:g.length,
    discardedUnreadableRows:f.length-validF.length+c.length-validC.length+
     g.length-validG.length+unreadableRevisions}};
 }catch{
  return {schema:'FFO_PFO_ACCURACY_DASHBOARD_V1',version:'PFO 6.40',
   status:'blocked',reason:'isolated_ledger_schema_or_query_unavailable',
   measuredPlayerGames:0,metrics:{n:0,mae:null,rmse:null,bias:null},
   readOnly:true,modelApprovedForDeployment:false};
 }
}
