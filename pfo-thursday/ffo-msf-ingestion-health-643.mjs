/**
 * PFO 6.43 — pure provider freshness and safe recovery policy.
 * Read-only; NO live scheduled recovery, provider network calls or deployed hooks.
 * Source: licensed MSF only; never claim LIVE or success on an unsuccessful fetch.
 */
export const INGESTION_STATUS_SCHEMA='PFO_643_MSF_INGESTION_HEALTH_V1';
const validIso=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT/.test(x)&&
 Number.isFinite(Date.parse(x))?Date.parse(x):null;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const integer=x=>Number.isInteger(x)&&x>=0;
const round=n=>Math.round(n*100)/100;
export function msfIngestionHealth({
 checkedAtUtc=null,lastSuccessAtUtc=null,providerUpdatedAtUtc=null,
 httpStatus=null,consecutiveFailures=0,requiredCategories=[],
 verifiedCategories=[],requiredPlayers=0,numericProjections=0,
 responseVerified=false,now=new Date(),mode='pregame'
}={}){
 const time=now instanceof Date?now.getTime():NaN;
 const checked=validIso(checkedAtUtc),lastSuccess=validIso(lastSuccessAtUtc),
  providerUpdate=validIso(providerUpdatedAtUtc);
 const maxAge=mode==='in_game'?60_000:mode==='final'?30*60_000:15*60_000;
 const problems=[];
 if(!Number.isFinite(time))problems.push('server_clock_unverified');
 if(!Number.isInteger(consecutiveFailures)||consecutiveFailures<0)
  problems.push('invalid_failure_counter');
 if(!['pregame','in_game','final'].includes(mode))
  problems.push('unknown_ingestion_mode');
 if(!Array.isArray(requiredCategories)||!Array.isArray(verifiedCategories)||
  !integer(requiredPlayers)||!integer(numericProjections)||
  numericProjections>requiredPlayers)problems.push('invalid_coverage_inputs');
 if(checked!==null&&Number.isFinite(time)&&checked>time+5_000)
  problems.push('check_timestamp_in_future');
 if(lastSuccess!==null&&Number.isFinite(time)&&lastSuccess>time+5_000)
  problems.push('success_timestamp_in_future');
 if(providerUpdate!==null&&Number.isFinite(time)&&providerUpdate>time+5_000)
  problems.push('provider_timestamp_in_future');
 const success=Number.isInteger(httpStatus)&&httpStatus>=200&&httpStatus<300&&responseVerified===true;
 if(success&&Number.isInteger(consecutiveFailures)&&consecutiveFailures>0)
  problems.push('success_cannot_keep_prior_failure_counter');
 if(success&&(!lastSuccess||!checked||checked<lastSuccess))
  problems.push('claimed_success_time_unverifiable');
 if(responseVerified!==true)problems.push('provider_response_not_verified');
 if(lastSuccess===null)problems.push('no_verified_successful_ingestion');
 if(checked===null)problems.push('no_verified_recent_check');
 const age=lastSuccess!==null&&Number.isFinite(time)?
  time-lastSuccess:null;
 if(age!==null&&age>maxAge)problems.push('provider_data_stale');
 const needed=new Set(Array.isArray(requiredCategories)?requiredCategories:[]),
  observed=new Set(Array.isArray(verifiedCategories)?verifiedCategories:[]);
 const missing=[...needed].filter(k=>!observed.has(k));
 if(missing.length)problems.push('required_categories_unverified');
 const complete=integer(requiredPlayers)&&integer(numericProjections)&&
  requiredPlayers>0?round(numericProjections/requiredPlayers*100):null;
 const rateLimited=httpStatus===429;
 const authBlocked=httpStatus===401||httpStatus===403;
 if(rateLimited)problems.push('provider_rate_limited');
 if(authBlocked)problems.push('provider_auth_or_entitlement_denied');
 if(Number.isInteger(httpStatus)&&httpStatus>=500)problems.push('provider_server_outage');
 if(checked!==null&&lastSuccess!==null&&checked>lastSuccess&&(!success||!responseVerified))
  problems.push('most_recent_check_failed');
 const valid=problems.length===0;
 const status=authBlocked?'access_blocked':rateLimited?'rate_limited':
  !Number.isFinite(time)||lastSuccess===null?'unavailable':
  age>maxAge?'stale':problems.includes('provider_server_outage')?'outage':
  problems.length?'partial_or_unverified':'fresh';
 const failures=integer(consecutiveFailures)?consecutiveFailures:1;
 const retryAfterSeconds=rateLimited?clamp(120*2**Math.min(failures,5),120,1800):
  authBlocked?null:status==='fresh'?null:clamp(30*2**Math.min(failures,6),30,1800);
 const freshnessAsOf=lastSuccess!==null?new Date(lastSuccess).toISOString():null;
 return {
  schema:INGESTION_STATUS_SCHEMA,source:'licensed_MySportsFeeds',
  mode,status,sourceAsOfUtc:freshnessAsOf,
  checkedAtUtc:checked!==null?new Date(checked).toISOString():null,
  providerUpdatedAtUtc:providerUpdate!==null?new Date(providerUpdate).toISOString():null,
  sourceAgeSeconds:age!==null?round(Math.max(0,age)/1000):null,
  numericCoveragePercent:complete,requiredPlayers,numericProjections,
  verifiedCategoryCount:observed.size,requiredCategoryCount:needed.size,
  missingCategories:missing,problems:[...new Set(problems)],
  retryAfterSeconds,circuitOpen:authBlocked||rateLimited||failures>=5,
  canShowFresh:valid&&success,
  canShowLive:mode==='in_game'&&valid&&success,
  canCertifyFinalResults:false,
  canWriteAccuracyRecords:false,
  ffoiIntegrated:false
 };
}
