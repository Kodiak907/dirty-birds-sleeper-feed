/**
 * PFO 6.43 verified accuracy capture authorization.
 *
 * This is a PURE policy gate. It cannot authenticate a caller and MUST NOT be
 * wired directly to a public route. Only an authenticated Cloudflare scheduled
 * Worker should provide independently witnessed browser/server parity.
 *
 * Source-level unit-test parity is insufficient. The gate requires a real
 * same-fixture/same-player, same-asof browser-vs-server observation with
 * immutable source and build fingerprints. Evidence remains research-only
 * unless independently witnessed in the protected Pages app.
 */
import {FFL_RULES_VERSION,validatePregameCapture}
 from './ffo-pregame-capture-638.mjs';
export const PARITY_EVIDENCE_SCHEMA='PFO_643_LIVE_BROWSER_SERVER_PARITY_V1';
const SH=/^[a-f0-9]{64}$/i;
const ID=/^[A-Za-z0-9_-]{1,75}$/;
const utctime=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(x)&&
 /(Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const deny=(reason)=>({authorized:false,reason,eligibleForD1Write:false,
 status:'withheld',realCaptureActivated:false});
export function validateLiveParityForCapture643({
 forecast,game,parity,serverNow=new Date()
}={}){
 const now=serverNow instanceof Date?serverNow.getTime():NaN;
 if(!Number.isFinite(now))return deny('server_clock_unverified');
 const clock=validatePregameCapture({forecast,game,serverNow,minLeadMinutes:15});
 if(!clock.accepted)return {...deny('ordinary_pregame_validation_failed'),
  issues:clock.reasons};
 if(parity?.schema!==PARITY_EVIDENCE_SCHEMA||
  parity?.verificationMethod!=='authenticated_live_browser_vs_server_recomputation'||
  parity?.sourceProvider!=='MSF'||parity?.rulesVersion!==FFL_RULES_VERSION||
  parity?.trustedServerWitness!==true||
  parity?.actualProtectedBrowserObservation!==true||
  parity?.realLicensedProviderResponseVerified!==true||
  parity?.fixtureVerified!==true||parity?.uniquePlayerIdentityVerified!==true)
  return deny('real_authenticated_live_model_parity_not_witnessed');
 if(!ID.test(String(parity.gameId??''))||parity.gameId!==game.gameId||
  String(parity.playerId??'')!==forecast.playerId||
  parity.position!==forecast.position||
  parity.modelVersion!==forecast.modelVersion||
  parity.week!==game.week||
  parity.kickoffAtUtc!==game.kickoffAt||
  parity.sourceAsOfUtc!==forecast.asOfUtc)
  return deny('model_player_fixture_or_source_timestamp_conflict');
 if(!SH.test(String(parity.browserSourceSha256??''))||
  !SH.test(String(parity.serverSourceSha256??''))||
  !SH.test(String(parity.scoringContractSha256??''))||
  !ID.test(String(parity.verifierRunId??'')))
  return deny('auditable_source_fingerprints_or_verifier_id_missing');
 // Source hashes of separately authored model runtimes need not be equal.
 // What must equal is their observed output on the SAME trusted source input.
 const a=parity.browserProjectionPoints,b=parity.serverProjectionPoints;
 if(!Number.isFinite(a)||!Number.isFinite(b)||!Number.isFinite(forecast.points)||
  Math.abs(a-b)>0.005||Math.abs(b-forecast.points)>0.005||
  round(a)!==round(b)||round(b)!==round(forecast.points))
  return deny('browser_and_server_forecasts_not_the_same_numeric_output');
 const observedAt=utctime(parity.browserObservedAtUtc),
  witnessedAt=utctime(parity.verifiedAtUtc),sourceAt=utctime(parity.sourceAsOfUtc),
  kickoffAt=utctime(game.kickoffAt);
 if(!Number.isFinite(observedAt)||!Number.isFinite(witnessedAt)||
  !Number.isFinite(sourceAt)||!Number.isFinite(kickoffAt)||
  sourceAt>observedAt||observedAt>witnessedAt||
  witnessedAt>now||now-witnessedAt>5*60_000||
  witnessedAt>kickoffAt-15*60_000)
  return deny('real_parity_observation_outside_verified_live_capture_window');
 return {
  authorized:true,eligibleForD1Write:true,status:'verified_parity_policy',
  rulesVersion:FFL_RULES_VERSION,forecastRecord:clock.record,
  verifierRunId:parity.verifierRunId,sourceFingerprint:parity.scoringContractSha256,
  realCaptureActivated:false,
  note:'Policy eligibility only; no scheduled Worker or D1 write is activated by this function'
 };
}
