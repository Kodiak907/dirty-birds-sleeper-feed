import test from 'node:test';
import assert from 'node:assert/strict';
import {msfIngestionHealth} from './ffo-msf-ingestion-health-643.mjs';
const at=new Date('2026-11-08T18:00:00Z');
const fresh={
 checkedAtUtc:'2026-11-08T17:59:00Z',
 lastSuccessAtUtc:'2026-11-08T17:59:00Z',
 providerUpdatedAtUtc:'2026-11-08T17:58:00Z',
 httpStatus:200,responseVerified:true,consecutiveFailures:0,
 requiredCategories:['pass_yd','pass_td','fgm_40_49'],
 verifiedCategories:['pass_yd','pass_td','fgm_40_49'],
 requiredPlayers:10,numericProjections:10,now:at,mode:'pregame'
};
test('only verified, recent, complete licensed MSF response qualifies as fresh',()=>{
 const r=msfIngestionHealth(fresh);
 assert.equal(r.status,'fresh');
 assert.equal(r.canShowFresh,true);
 assert.equal(r.canShowLive,false);
 assert.equal(r.sourceAgeSeconds,60);
 assert.equal(r.numericCoveragePercent,100);
 assert.equal(r.canCertifyFinalResults,false);
 assert.equal(r.canWriteAccuracyRecords,false);
});
test('stale but numeric projections do not carry LIVE or fresh labels',()=>{
 const r=msfIngestionHealth({...fresh,lastSuccessAtUtc:'2026-11-08T17:30:00Z',
  checkedAtUtc:'2026-11-08T17:59:00Z',responseVerified:false,httpStatus:503,
  consecutiveFailures:3,mode:'in_game'});
 assert.equal(r.status,'stale');
 assert.equal(r.canShowLive,false);
 assert.equal(r.canShowFresh,false);
 assert.ok(r.problems.includes('provider_data_stale'));
 assert.ok(r.retryAfterSeconds>=30);
});
test('rate-limited responses stop calls and do not manufacture success',()=>{
 const r=msfIngestionHealth({...fresh,httpStatus:429,responseVerified:false,
  consecutiveFailures:2});
 assert.equal(r.status,'rate_limited');
 assert.equal(r.circuitOpen,true);
 assert.ok(r.retryAfterSeconds>=120);
 assert.equal(r.canShowFresh,false);
});
test('authentication or entitlement failure opens circuit without retrying secrets',()=>{
 for(const code of [401,403]){
  const r=msfIngestionHealth({...fresh,httpStatus:code,responseVerified:false,consecutiveFailures:1});
  assert.equal(r.status,'access_blocked');
  assert.equal(r.circuitOpen,true);
  assert.equal(r.retryAfterSeconds,null);
 }
});
test('missing scoring categories, unknown FG distances and partial position coverage remain visible',()=>{
 const r=msfIngestionHealth({...fresh,
  requiredCategories:['fgm_40_49','fgm_50_59','pts_allow_14_20'],
  verifiedCategories:['fgm_40_49'],
  numericProjections:8});
 assert.equal(r.status,'partial_or_unverified');
 assert.equal(r.canShowFresh,false);
 assert.equal(r.numericCoveragePercent,80);
 assert.deepEqual(r.missingCategories,['fgm_50_59','pts_allow_14_20']);
});
test('provider clock or fabricated healthy state must fail closed',()=>{
 const bad=msfIngestionHealth({...fresh,checkedAtUtc:'2026-11-08T18:25:00Z',
  requiredCategories:{oops:1},requiredPlayers:-1,numericProjections:10,
  consecutiveFailures:5});
 assert.equal(bad.canShowFresh,false);
 assert.equal(bad.circuitOpen,true);
 assert.ok(bad.problems.includes('invalid_coverage_inputs'));
 assert.ok(bad.problems.includes('check_timestamp_in_future'));
});
test('in-game 60-second freshness is stricter than pregame; no false live scoring',()=>{
 const live=msfIngestionHealth({...fresh,mode:'in_game'});
 assert.equal(live.canShowLive,true,'one-minute old is at allowed threshold');
 const stale=msfIngestionHealth({...fresh,mode:'in_game',now:new Date('2026-11-08T18:00:01Z')});
 assert.equal(stale.canShowLive,false);
 assert.equal(stale.status,'stale');
});
