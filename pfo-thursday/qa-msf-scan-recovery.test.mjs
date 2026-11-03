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
