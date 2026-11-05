/** Safe, feed-specific diagnostics for the existing MSF historical source scanner.
 * Only error codes, HTTP layers and bounded size metadata are retained.
 * No provider payloads, authentication headers, player stats or request URLs.
 */
const allowedCode=x=>{
 const raw=String(x??'');
 return /^[a-z][a-z0-9_-]{0,79}$/i.test(raw)?raw.toLowerCase():null;
};
const status=x=>{
 const n=Number(x);
 return Number.isInteger(n)&&n>=100&&n<=599?n:null;
};
const size=x=>{
 const n=Number(x);
 return Number.isInteger(n)&&n>=0&&n<=1000000000?n:null;
};
const feedName=x=>/^(plays|boxscore|gamelogs_home|gamelogs_away|gamelogs)$/.test(String(x))?String(x):'unspecified_feed';
const transport=x=>x==='direct_msf'?'direct_msf':x==='legacy_gamecast_service_binding'?'service_binding':'unknown_transport';
function sourceError(entry,index){
 const tagged=entry?.result||entry?.settled||entry||{};
 const feed=feedName(entry?.feed);
 if(tagged.status==='fulfilled'&&tagged.value?.available!==false&&!tagged.value?.error)return null;
 if(tagged.status!=='rejected'&&tagged.status!=='fulfilled')return null;
 const e=tagged.status==='rejected'?tagged.reason||{}:tagged.value||{};
 const message=String(e?.message||e?.reason||e?.error||e||'');
 let code=allowedCode(e.gatewayCode)||allowedCode(e.code)||allowedCode(e.error)||
  allowedCode(e.reason)||allowedCode(message);
 if(!code){
  const match=message.match(/\b(provider_[a-z_]+|invalid_[a-z_]+|feed_not_ready|upstream_unreachable|mysportsfeeds_key_not_configured|body_read_failed)\b/i);
  code=allowedCode(match?.[1])||'unclassified_request_failure';
 }
 const gatewayStatus=status(e.gatewayHttpStatus??e.status??e.gateway_http_status);
 const bindingStatus=status(e.bindingHttpStatus??e.binding_http_status);
 // MSF status is only labeled direct/reported when the gateway explicitly says so.
 const msfDirect=e.provider_status_direct===true?
  status(e.providerHttpStatusDirect??e.provider_http_status):status(e.providerHttpStatusDirect);
 const msfReported=status(e.msfStatusViaBinding??e.msf_http_status_via_binding);
 const innerCode=allowedCode(e.innerGatewayError??e.inner_gateway_error);
 const reportedBytes=size(e.reportedSizeBytes??e.reported_content_length_bytes??e.received_characters);
 const maxBytes=size(e.responseLimitBytes??e.limit_bytes);
 const layer=transport(e.transport);
 const signs=message.toLowerCase()+' '+code+' '+(msfDirect||'')+' '+(msfReported||'')+
  ' '+(gatewayStatus||'')+' '+(innerCode||'');
 let kind='unknown',retryable=false,delayMs=0,description='MSF source response could not be verified';
 if(/rate[_ .-]?limit|too[_ .-]?many|\b429\b/.test(signs)||msfDirect===429||msfReported===429){
  kind='rate_limit';retryable=true;delayMs=60000;description='MSF rate limit or throttled gateway';
 }else if(/auth|entitlement|forbidden|access_required|key_not_configured|\b401\b|\b403\b/.test(signs)||
  msfDirect===401||msfDirect===403||msfReported===401||msfReported===403){
  kind='access';description='MSF authorization or feed entitlement unavailable';
 }else if(/invalid[_ -]?(season|team|game)|request[_ -]?rejected|\b400\b/.test(signs)||
  msfDirect===400||msfReported===400){
  kind='bad_request';description='MSF feed request rejected';
 }else if(/payload_exceeds_limit|payload_too_large|body_too_large|entity_too_large/.test(signs)){
  kind='payload_limit';description='MSF response exceeds protected gateway size limit';
 }else if(/json_invalid|schema_invalid|unrecognized_schema|schema_unverified/.test(signs)){
  kind='invalid_payload';description='MSF response JSON or schema could not be verified';
 }else if(/not[_ -]?found|\b404\b|feed_not_ready/.test(signs)||msfDirect===404||msfReported===404){
  kind='missing_feed';description='MSF historical feed missing or not ready';
 }else if(/timeout|abort|network|upstream|unreachable|gateway|temporar|body_read_failed|server[_ -]?error|\b50[0234]\b/.test(signs)||
  [500,502,503,504].includes(gatewayStatus)){
  kind='transient';retryable=true;delayMs=6500;description='Temporary MSF or gateway error';
 }
 return {feed,index,code,kind,retryable,delayMs,description,
  gatewayStatus,bindingStatus,msfDirect,msfReported,innerCode,transport:layer,
  reportedBytes,maxBytes};
}
export function classifyMSFScanFailure(entries=[]){
 const failures=entries.map((item,i)=>sourceError(item,i)).filter(Boolean);
 if(!failures.length)return null;
 const order=['rate_limit','access','bad_request','payload_limit','invalid_payload','missing_feed','transient','unknown'];
 const chosen=failures.slice().sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind))[0];
 const checks=failures.slice(0,4).map(x=>({
  feed:x.feed,code:x.code,kind:x.kind,gatewayStatus:x.gatewayStatus,
  bindingStatus:x.bindingStatus,msfDirect:x.msfDirect,msfReported:x.msfReported,
  transport:x.transport,innerCode:x.innerCode,reportedBytes:x.reportedBytes,maxBytes:x.maxBytes
 }));
 const diagnostic=failures.map(x=>{
  const data=[x.feed,x.code,
   x.gatewayStatus?'gateway '+x.gatewayStatus:null,
   x.msfDirect?'MSF direct '+x.msfDirect:null,
   x.msfReported?'MSF via binding '+x.msfReported:null,
   x.reportedBytes!==null?'size '+x.reportedBytes:null,
   x.maxBytes!==null?'limit '+x.maxBytes:null].filter(Boolean);
  return data.join(' / ');
 }).join(' | ').slice(0,170);
 return {kind:chosen.kind,retryable:chosen.retryable,delayMs:chosen.delayMs,
  description:chosen.description,diagnostic,checks};
}
export function scanFailurePolicy(failure){
 if(!failure)return {action:'accept',delayMs:0};
 if(failure.kind==='rate_limit')return {action:'stop',delayMs:60000};
 if(failure.kind==='access'||failure.kind==='bad_request')return {action:'stop',delayMs:0};
 return {action:'skip_game',delayMs:failure.retryable?6500:0};
}
