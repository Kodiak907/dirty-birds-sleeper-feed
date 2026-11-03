/** Recoverable, source-attributed MSF historical scan diagnostics. */
const safe=(x)=>String(x??'').replace(/[^a-zA-Z0-9 _.-]/g,'_').slice(0,110);
export function classifyMSFScanFailure(entries=[]){
 const errors=[];
 for(const item of entries){
  if(!item)continue;
  if(item.status==='rejected'){
   const e=item.reason||{};
   errors.push({code:String(e.message||e||'request_failed'),status:Number(e.status)||null});
  }else if(item.status==='fulfilled'&&
   (item.value?.available===false||item.value?.error)){
   const v=item.value||{};
   errors.push({code:String(v.error||v.reason||'provider_unavailable'),
    status:Number(v.provider_http_status)||Number(v.msf_http_status_via_binding)||null});
  }
 }
 if(!errors.length)return null;
 const diagnostic=errors.map(e=>safe(e.code)).join(' | ').slice(0,170);
 const statuses=errors.map(e=>e.status);
 const joined=errors.map(e=>e.code+' '+(e.status||'')).join(' ').toLowerCase();
 if(/rate[_ .-]?limit|too[_ .-]?many|\b429\b/.test(joined)||statuses.includes(429))
  return {kind:'rate_limit',retryable:true,delayMs:60000,description:'MSF rate limit or throttled gateway',diagnostic};
 if(/auth|entitlement|forbidden|access_required|key_not_configured|\b401\b|\b403\b/.test(joined))
  return {kind:'access',retryable:false,delayMs:0,description:'MSF authentication or feature entitlement unavailable',diagnostic};
 if(/invalid[_ -]?season|invalid[_ -]?team|invalid[_ -]?game|request[_ -]?rejected|\b400\b/.test(joined))
  return {kind:'bad_request',retryable:false,delayMs:0,description:'MSF feed request invalid',diagnostic};
 if(/not[_ -]?found|\b404\b|not[_ -]?authorized|feed[_ -]?not[_ -]?ready/.test(joined))
  return {kind:'missing_feed',retryable:false,delayMs:0,description:'MSF historical feed unavailable for this game',diagnostic};
 if(/timeout|abort|network|upstream|unreachable|gateway|temporar|body_read_failed|server[_ -]?error|\b50[0234]\b/.test(joined)||
  statuses.some(x=>x===502||x===503||x===504))
  return {kind:'transient',retryable:true,delayMs:6500,description:'Temporary MSF or gateway error',diagnostic};
 return {kind:'unknown',retryable:false,delayMs:0,description:'MSF source response could not be verified',diagnostic};
}
export function scanFailurePolicy(failure){
 if(!failure)return {action:'accept',delayMs:0};
 if(failure.kind==='rate_limit')return {action:'stop',delayMs:60000};
 if(failure.kind==='access'||failure.kind==='bad_request')return {action:'stop',delayMs:0};
 return {action:'skip_game',delayMs:failure.retryable?6500:0};
}
