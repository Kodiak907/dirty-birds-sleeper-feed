import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyMSFScanFailure,scanFailurePolicy} from './ffo-msf-scan-recovery.mjs';
const rejection=(message,status)=>({status:'rejected',reason:Object.assign(new Error(message),{status})});
const fulfilled=(v)=>({status:'fulfilled',value:v});
test('MSF failures classified using useful but sanitized gateway diagnostics',()=>{
 const cases=[
  [rejection('provider_rate_limited · binding HTTP 502 · MSF status reported by binding 429',502),'rate_limit'],
  [fulfilled({error:'provider_feed_not_found',provider_http_status:404}),'missing_feed'],
  [fulfilled({available:false,reason:'feed_not_ready'}),'missing_feed'],
  [rejection('provider_gateway_or_server_error (502)',502),'transient'],
  [rejection('upstream_unreachable',502),'transient'],
  [rejection('provider_auth_or_entitlement_denied',502),'access'],
  [rejection('invalid_team_filter',400),'bad_request'],
  [rejection('unrecognized statistical category',502),'transient']
 ];
 for(const [entry,expected] of cases){
  const x=classifyMSFScanFailure([entry]);
  assert.equal(x.kind,expected,entry.reason?.message||entry.value?.error);
  assert.equal(typeof x.diagnostic,'string');
  assert.ok(x.diagnostic.length<=170);
 }
 assert.equal(classifyMSFScanFailure([fulfilled({available:true,data:{}})]),null);
 assert.equal(classifyMSFScanFailure([]),null);
});
test('Throttle and entitlement failures stop globally; missing historical feeds stay game-scoped',()=>{
 assert.equal(scanFailurePolicy({kind:'rate_limit'}).action,'stop');
 assert.equal(scanFailurePolicy({kind:'access'}).action,'stop');
 assert.equal(scanFailurePolicy({kind:'missing_feed'}).action,'skip_game');
 assert.equal(scanFailurePolicy({kind:'transient',retryable:true}).action,'skip_game');
 assert.equal(scanFailurePolicy(null).action,'accept');
});
test('MSF diagnostics cannot inject markup into PFO audit log',()=>{
 const x=classifyMSFScanFailure([rejection('<script>alert(1)</script> provider_unreachable',502)]);
 assert.equal(x.kind,'transient');
 assert.doesNotMatch(x.diagnostic,/[<>]/);
});


test('Specific gateway failures retain safe feed, HTTP-layer and size diagnostics',()=>{
 const payload=Object.assign(Error('provider_payload_exceeds_limit · secret=DO_NOT_PERSIST'),{
  status:502,gatewayCode:'provider_payload_exceeds_limit',gatewayHttpStatus:502,
  transport:'legacy_gamecast_service_binding',bindingHttpStatus:502,
  msfStatusViaBinding:413,reportedSizeBytes:5000000,responseLimitBytes:4000000
 });
 const report=classifyMSFScanFailure([{feed:'plays',result:{status:'rejected',reason:payload}}]);
 assert.equal(report.kind,'payload_limit');
 assert.equal(report.checks[0].feed,'plays');
 assert.equal(report.checks[0].code,'provider_payload_exceeds_limit');
 assert.equal(report.checks[0].gatewayStatus,502);
 assert.equal(report.checks[0].msfReported,413);
 assert.equal(report.checks[0].reportedBytes,5000000);
 assert.equal(report.checks[0].maxBytes,4000000);
 assert.doesNotMatch(JSON.stringify(report),/DO_NOT_PERSIST|secret=/);
 assert.equal(scanFailurePolicy(report).action,'skip_game');
});
test('Provider authority and gateway HTTP layer are not mislabeled',()=>{
 const e=Object.assign(Error('provider_feed_not_found'),{
  gatewayCode:'provider_feed_not_found',gatewayHttpStatus:502,
  bindingHttpStatus:502,transport:'legacy_gamecast_service_binding',
  msfStatusViaBinding:404
 });
 const missing=classifyMSFScanFailure([{feed:'boxscore',result:{status:'rejected',reason:e}}]);
 assert.equal(missing.kind,'missing_feed');
 assert.equal(missing.checks[0].msfReported,404);
 assert.equal(missing.checks[0].msfDirect,null);
 assert.equal(missing.checks[0].gatewayStatus,502);
 assert.match(missing.diagnostic,/boxscore/);
 const invalid=classifyMSFScanFailure([{feed:'gamelogs_away',result:{
  status:'fulfilled',value:{error:'provider_json_invalid',provider_http_status:502,
   provider_status_direct:true,transport:'direct_msf'}
 }}]);
 assert.equal(invalid.kind,'invalid_payload');
 assert.equal(invalid.checks[0].msfDirect,502);
 assert.equal(invalid.checks[0].feed,'gamelogs_away');
});
