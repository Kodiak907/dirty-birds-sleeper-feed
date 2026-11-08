import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePFO643UnifiedRelease,PFO_643_REQUIRED_GATES}
 from './ffo-release-gate-643.mjs';
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
// Synthetic positive fixture ONLY — does not reflect actual repo/provider readiness.
const full=()=>({
 repo:{isolated643:true,noUnreviewedMainMerge:true,
  protectedPreviewUnchangedDuringDevelopment:true,rollbackCommitRecorded:true},
 scoring:{rulesVersion:FFL_RULES_VERSION,regressionPassed:true,
  unsupportedCategoriesAwardZero:true,noFGBaseDoubleCount:true,longTDPolicyAdjudicated:true},
 msf:{providerAccessVerified:true,fixturesIdsAndKickoffVerified:true,
  playerIdentityVerified:true,finalBoxscoreVerified:true,eventBonusesVerified:true,
  postgameCorrectionsVerified:true},
 capture:{fiveMinuteCronOrEquivalentVerified:true,earliestCaptureAtLeast15MinBeforeKickoff:true,
  liveDisplayedModelParityVerified:true,sourceTimestampsImmutable:true,
  realFirstSaveAndSecondPreserved:true},
 finals:{realSourceScoreCertificateStored:true,allAwardedCategoriesVerified:true,
  statCorrectionsReconciled:true,noSleeperScoresUsed:true,appendOnlyD1Verified:true},
 dashboard:{authenticatedPreviewAccessVerified:true,readOnlyNoPublicRecords:true,
  realPairsOnly:true,truthfulEmptyStateTested:true,reportingOfExclusionsAndRuleVersions:true},
 tools:{tenActualSlotsReconciled:true,benchAndIRSeparationVerified:true,
  modelConsistencyAcrossAllTools:true,startSitTradeWaiverRadarAskFunctional:true,
  gamecastAndWeeklyRolloverVerified:true,overviewAndLineupVisualizationsVerified:true},
 operations:{freshnessAndNoFalseLiveVerified:true,retryRateLimitOutageVerified:true,
  safeDegradedModeVerified:true},
 mobile:{automatedBrowserRegressionPassed:true,realIphoneSafariVerified:true,
  touchAndScrollInteractionsVerified:true},
 isolation:{commissionerDataDiffUnchanged:true,commissionerD1UnreachableFromAccuracyWorker:true,
  publicDemoDiffUnchanged:true,ffoiNotIntegrated:true},
 accuracy:{verifiedComparablePairs:0,minimumResearchPairs:100},
 calibration:{holdoutProven:false,allPositionsSampled:false,
  noPositionRegression:false,manualPromotionApproved:false}
});
test('actual unproven 6.43 baseline is release BLOCKED, with every missing required evidence gate listed',()=>{
 const report=evaluatePFO643UnifiedRelease();
 assert.equal(report.releaseEligible,false);
 assert.deepEqual(report.blockers,[...PFO_643_REQUIRED_GATES]);
 assert.equal(report.accuracy.verifiedComparablePairs,0);
 assert.equal(report.accuracy.status,'not_enough_verified_data');
 assert.equal(report.calibration.candidatePromotionAllowed,false);
});
test('if every REAL operational gate is independently evidenced, system may ship with honest zero pairs',()=>{
 const report=evaluatePFO643UnifiedRelease(full());
 assert.equal(report.releaseEligible,true,'synthetic unit fixture only, not production assertion');
 assert.equal(report.releaseStatus,'release_candidate_evidence_complete');
 assert.equal(report.accuracy.status,'not_enough_verified_data');
 assert.equal(report.accuracy.verifiedComparablePairs,0);
 assert.equal(report.calibration.candidatePromotionAllowed,false);
 assert.equal(report.calibration.status,'frozen_baseline_only');
 assert.equal(report.accuracy.statisticalSuperiorityClaimAllowed,false);
});
test('no one can bypass real authenticated MSF, model parity, independently verified actual or iPhone QA',()=>{
 for(const [area,key] of [
  ['msf','providerAccessVerified'],
  ['capture','liveDisplayedModelParityVerified'],
  ['finals','realSourceScoreCertificateStored'],
  ['mobile','realIphoneSafariVerified'],
  ['isolation','commissionerDataDiffUnchanged'],
  ['dashboard','truthfulEmptyStateTested']
 ]){
  const x=full();x[area][key]=false;
  const report=evaluatePFO643UnifiedRelease(x);
  assert.equal(report.releaseEligible,false,area+'/'+key);
  assert.ok(report.blockers.length>0);
 }
});
test('full deployment cannot bypass unsettled 50+ bonus or generic field goal stacking',()=>{
 for(const key of ['longTDPolicyAdjudicated','noFGBaseDoubleCount','unsupportedCategoriesAwardZero']){
  const x=full();x.scoring[key]=false;
  const report=evaluatePFO643UnifiedRelease(x);
  assert.equal(report.releaseEligible,false);
  assert.ok(report.blockers.includes('frozenScoring'));
 }
});
test('100 matches alone cannot promote a model without heldout evidence/approval',()=>{
 const x=full();x.accuracy.verifiedComparablePairs=145;
 const report=evaluatePFO643UnifiedRelease(x);
 assert.equal(report.releaseEligible,true);
 assert.equal(report.accuracy.sampleThresholdMet,true);
 assert.equal(report.calibration.candidatePromotionAllowed,false);
});
test('research promotion stays a separate explicit all-criteria decision',()=>{
 const x=full();x.accuracy.verifiedComparablePairs=145;
 x.calibration={holdoutProven:true,allPositionsSampled:true,
  noPositionRegression:true,manualPromotionApproved:true};
 const report=evaluatePFO643UnifiedRelease(x);
 assert.equal(report.calibration.candidatePromotionAllowed,true);
 assert.equal(report.accuracy.statisticalSuperiorityClaimAllowed,false,
  'never auto-claim model superiority just because heldout gate passed');
});
