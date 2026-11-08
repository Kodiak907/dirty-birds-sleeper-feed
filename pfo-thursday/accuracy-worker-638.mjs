/**
 * PFO Accuracy Lab — isolated D1 binding/readiness only.
 * No production PFO/FFOI integration; no public data reads or writes.
 * Automatic snapshot capture remains disabled until parity-verified adapters
 * and secured schedule are approved.
 */
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';

const HEADERS={'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store, private','x-content-type-options':'nosniff'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method!=='GET'||url.pathname!=='/health')
   return reply({error:'route_not_found'},404);
  if(!env?.PFO_ACCURACY_DB?.prepare)
   return reply({schema:'PFO_ACCURACY_HEALTH_V1',status:'blocked',
    database:'isolated_pfo_accuracy_lab',reason:'dedicated_accuracy_d1_binding_missing',
    rulesVersion:FFL_RULES_VERSION,automaticCaptureActive:false,
    independentResultsActive:false,ffoiIntegrated:false},503);
  try{
   const rows=await env.PFO_ACCURACY_DB.prepare(
    "SELECT type,name FROM sqlite_master WHERE (name IN ('pfo_accuracy_forecasts','pfo_accuracy_final_certificates','pfo_accuracy_verified_games','pfo_accuracy_final_revisions') AND type='table') OR (name LIKE 'immutable_accuracy_%' AND type='trigger') ORDER BY type,name"
   ).all();
   const objects=Array.isArray(rows?.results)?rows.results:[];
   const tables=objects.filter(o=>o.type==='table').map(o=>o.name);
   const triggers=objects.filter(o=>o.type==='trigger').map(o=>o.name);
   const needed=['pfo_accuracy_forecasts','pfo_accuracy_final_certificates',
    'pfo_accuracy_verified_games'];
   const baseTriggerNames=['immutable_accuracy_forecasts_update','immutable_accuracy_forecasts_delete',
    'immutable_accuracy_final_update','immutable_accuracy_final_delete',
    'immutable_accuracy_games_update','immutable_accuracy_games_delete'];
   const revisionTriggerNames=['immutable_accuracy_revisions_update','immutable_accuracy_revisions_delete'];
   const baseReady=needed.every(n=>tables.includes(n))&&
    baseTriggerNames.every(n=>triggers.includes(n));
   const revisionTable=tables.includes('pfo_accuracy_final_revisions');
   const revisionTriggerCount=revisionTriggerNames.filter(n=>triggers.includes(n)).length;
   const correctionReady=revisionTable&&revisionTriggerCount===2;
   const consistent=(revisionTable&&correctionReady&&!triggers.some(n=>
     !baseTriggerNames.includes(n)&&!revisionTriggerNames.includes(n)))||
    (!revisionTable&&revisionTriggerCount===0&&
     triggers.every(n=>baseTriggerNames.includes(n)));
   const ready=baseReady&&consistent;
   return reply({schema:'PFO_ACCURACY_HEALTH_V1',
    status:ready?'schema_verified':'schema_incomplete',
    rulesVersion:FFL_RULES_VERSION,database:'isolated_pfo_accuracy_lab',
    tablesVerified:tables.length,immutableTriggersVerified:triggers.length,
    schemaVersion:correctionReady?2:1,correctionRevisionTableReady:correctionReady,
    schemaReady:ready,automaticCaptureActive:false,
    independentResultsActive:false,accuraciesCertified:false,
    ffoiIntegrated:false,commissionerDatabaseAccessible:false,
    nextStep:'verify exact PFO 6.36 forecast parity and licensed MSF fixtures before scheduling capture'
   },ready?200:503);
  }catch{
   return reply({schema:'PFO_ACCURACY_HEALTH_V1',status:'blocked',
    reason:'dedicated_accuracy_schema_query_failed',
    automaticCaptureActive:false,independentResultsActive:false,
    commissionerDatabaseAccessible:false},503);
  }
 }
};
