/**
 * PFO 6.43 — guarded pregame capture ORCHESTRATOR (NOT deployed).
 *
 * This module is intentionally inaccessible from any public Worker route.
 * Only a future scheduled Cloudflare Worker with an explicitly verified,
 * isolated PFO_ACCURACY_DB binding should invoke it. It cannot establish
 * credentials or a live browser attestation by itself. Callers must supply
 * independently witnessed evidence from protected PFO at the same MSF as-of.
 *
 * 6.38's generic research helper is deliberately NOT an authorization gate.
 * New automated capture code must use this 6.43 wrapper, which requires
 * policy-valid proof before it can construct even a single D1 INSERT.
 */
import {selectEligiblePregameFixtures} from './ffo-msf-fixtures-643.mjs';
import {validateLiveParityForCapture643} from './ffo-capture-parity-643.mjs';
import {captureSQL,FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';

const blocked=(reason,extras={})=>({
 schema:'PFO_643_GUARDED_PREGAME_CAPTURE_V1',status:'blocked',reason,
 stored:0,preserved:0,withheld:0,source:'licensed_MSF_and_actual_PFO_browser',
 ffoiIntegrated:false,commissionerDataAccessible:false,...extras
});
export async function runGuardedPregameCapture643({
 db,serverNow=new Date(),runtime=null,gameFeed,forecastFeed
}={}){
 if(!db?.prepare||typeof db.prepare!=='function')
  return blocked('dedicated_accuracy_database_missing');
 if(runtime?.kind!=='cloudflare_scheduled_worker'||
  runtime?.bindingName!=='PFO_ACCURACY_DB'||
  runtime?.dedicatedBindingVerified!==true||
  runtime?.httpRequestTriggered===true)
  return blocked('trusted_non_http_scheduled_accuracy_runtime_required');
 if(typeof gameFeed!=='function'||typeof forecastFeed!=='function')
  return blocked('trusted_provider_and_live_parity_feeds_missing');
 if(!(serverNow instanceof Date)||!Number.isFinite(serverNow.getTime()))
  return blocked('untrusted_server_clock');
 let fixtures;
 try{fixtures=await gameFeed()}catch{
  return blocked('trusted_msf_schedule_provider_unavailable');
 }
 if(!Array.isArray(fixtures)||!fixtures.length)
  return blocked('verified_msf_upcoming_schedule_missing');
 const due=selectEligiblePregameFixtures(fixtures,{
  serverNow,minLeadMinutes:15,maxLeadMinutes:30
 });
 if(!due.eligible.length)return blocked('no_eligible_verified_kickoff_windows',{
  withheld:due.withheld?.length||0,cutoffMinutes:15
 });
 let stored=0,preserved=0,withheld=due.withheld.length,attempted=0;
 const issues=new Set();
 for(const game of due.eligible.slice(0,32)){
  let pairs;
  try{pairs=await forecastFeed(game)}catch{
   withheld++;issues.add('trusted_live_model_or_parity_feed_failed');continue;
  }
  if(!Array.isArray(pairs)||!pairs.length){
   withheld++;issues.add('no_actual_browser_parity_pairs');continue;
  }
  const seen=new Set();
  for(const pair of pairs.slice(0,300)){
   const forecast=pair?.forecast,parity=pair?.parity,
    identity=String(forecast?.playerId??'');
   if(!identity||seen.has(identity)){
    withheld++;issues.add('duplicate_or_missing_player_identity');continue;
   }
   seen.add(identity);
   const evidence=validateLiveParityForCapture643({
    forecast,game,parity,serverNow
   });
   if(evidence.authorized!==true){
    withheld++;issues.add(evidence.reason);continue;
   }
   const record={
    ...evidence.forecastRecord,modelVersion:forecast.modelVersion,
    sourceEvidence:'verified_live_pfo_636_model_parity',
    parityWitness:{
     verifierRunId:evidence.verifierRunId,
     verifiedAtUtc:parity.verifiedAtUtc,
     browserObservedAtUtc:parity.browserObservedAtUtc,
     browserSourceSha256:parity.browserSourceSha256,
     serverSourceSha256:parity.serverSourceSha256,
     scoringContractSha256:parity.scoringContractSha256,
     sourceAsOfUtc:parity.sourceAsOfUtc,
     authenticatedSameFixture:true
    }
   };
   // 6.38's existing immutable insert remains the only SQL contract.
   // We enrich its JSON payload with provenance; the column schema is
   // unchanged and ON CONFLICT DO NOTHING preserves first accepted capture.
   const {statement,params}=captureSQL(record);
   attempted++;
   try{
    const out=await db.prepare(statement).bind(...params).run();
    if(out?.meta?.changes===1)stored++;
    else if(out?.meta?.changes===0)preserved++;
    else{withheld++;issues.add('accuracy_d1_write_result_unverified');}
   }catch{withheld++;issues.add('dedicated_accuracy_d1_write_failed')}
  }
 }
 return {
  schema:'PFO_643_GUARDED_PREGAME_CAPTURE_V1',
  status:stored?'verified_snapshots_stored':
   preserved?'immutable_existing_snapshots_preserved':'nothing_stored_without_verified_parity',
  stored,preserved,withheld,attempted,
  issueCodes:[...issues],
  modelSource:'same_fixture_live_PFO_browser_and_server_FFL',
  rulesVersion:FFL_RULES_VERSION,cutoffMinutes:15,
  firstWriteImmutable:true,ffoiIntegrated:false,
  commissionerDataAccessible:false,
  liveSchedulerEnabledByThisModule:false
 };
}
