/**
 * PFO 6.43 — single-release evidence gate, distinct from model-calibration
 * and statistical-significance promotion. Zero/low paired sample size can
 * truthfully show "Not enough verified data" after the real pipeline is
 * independently proven. Never infer proof from passing unit tests alone.
 * Input MUST be independently witnessed CI/Cloudflare/real-device evidence,
 * not a client/browser self-assertion.
 */
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';

const verified=x=>x===true;
const integer=x=>Number.isInteger(x)&&x>=0;
const mandatory=[
 ['isolatedSource','Source and rollback',e=>
  e.repo?.isolated643===true&&e.repo?.noUnreviewedMainMerge===true&&
  e.repo?.protectedPreviewUnchangedDuringDevelopment===true&&
  e.repo?.rollbackCommitRecorded===true],
 ['frozenScoring','Official immutable FFL scoring',e=>
  e.scoring?.rulesVersion===FFL_RULES_VERSION&&
  e.scoring?.regressionPassed===true&&e.scoring?.unsupportedCategoriesAwardZero===true&&
  e.scoring?.noFGBaseDoubleCount===true&&e.scoring?.longTDPolicyAdjudicated===true],
 ['licensedTruth','Licensed MSF sources',e=>
  e.msf?.providerAccessVerified===true&&e.msf?.fixturesIdsAndKickoffVerified===true&&
  e.msf?.playerIdentityVerified===true&&e.msf?.finalBoxscoreVerified===true&&
  e.msf?.eventBonusesVerified===true&&e.msf?.postgameCorrectionsVerified===true],
 ['pregameCapture','Actual pregame snapshot provenance',e=>
  e.capture?.fiveMinuteCronOrEquivalentVerified===true&&
  e.capture?.earliestCaptureAtLeast15MinBeforeKickoff===true&&
  e.capture?.liveDisplayedModelParityVerified===true&&
  e.capture?.sourceTimestampsImmutable===true&&
  e.capture?.realFirstSaveAndSecondPreserved===true],
 ['independentResults','Independent final scoring and write safety',e=>
  e.finals?.realSourceScoreCertificateStored===true&&
  e.finals?.allAwardedCategoriesVerified===true&&
  e.finals?.statCorrectionsReconciled===true&&
  e.finals?.noSleeperScoresUsed===true&&
  e.finals?.appendOnlyD1Verified===true],
 ['dashboard','Read-only authenticated accuracy dashboard',e=>
  e.dashboard?.authenticatedPreviewAccessVerified===true&&
  e.dashboard?.readOnlyNoPublicRecords===true&&
  e.dashboard?.realPairsOnly===true&&
  e.dashboard?.truthfulEmptyStateTested===true&&
  e.dashboard?.reportingOfExclusionsAndRuleVersions===true],
 ['crossTool','Ten-slot, cross-tool and other PFO features',e=>
  e.tools?.tenActualSlotsReconciled===true&&
  e.tools?.benchAndIRSeparationVerified===true&&
  e.tools?.modelConsistencyAcrossAllTools===true&&
  e.tools?.startSitTradeWaiverRadarAskFunctional===true&&
  e.tools?.gamecastAndWeeklyRolloverVerified===true&&
  e.tools?.overviewAndLineupVisualizationsVerified===true],
 ['reliability','Provider freshness and recovery',e=>
  e.operations?.freshnessAndNoFalseLiveVerified===true&&
  e.operations?.retryRateLimitOutageVerified===true&&
  e.operations?.safeDegradedModeVerified===true],
 ['mobile','Actual browser and iPhone acceptance',e=>
  e.mobile?.automatedBrowserRegressionPassed===true&&
  e.mobile?.realIphoneSafariVerified===true&&
  e.mobile?.touchAndScrollInteractionsVerified===true],
 ['isolation','Protected database, demo and FFOI boundaries',e=>
  e.isolation?.commissionerDataDiffUnchanged===true&&
  e.isolation?.commissionerD1UnreachableFromAccuracyWorker===true&&
  e.isolation?.publicDemoDiffUnchanged===true&&
  e.isolation?.ffoiNotIntegrated===true]
];
export const PFO_643_REQUIRED_GATES=Object.freeze(mandatory.map(x=>x[0]));
export function evaluatePFO643UnifiedRelease(evidence={}){
 const gates=mandatory.map(([id,title,fn])=>{
  let passed=false;try{passed=fn(evidence)===true}catch{passed=false}
  return {id,title,status:passed?'verified':'blocked'};
 });
 const blockers=gates.filter(g=>g.status!=='verified').map(g=>g.id);
 const ready=blockers.length===0;
 const pairs=evidence.accuracy?.verifiedComparablePairs;
 const comparable=integer(pairs)?pairs:0;
 const enough=integer(evidence.accuracy?.minimumResearchPairs)&&
  comparable>=evidence.accuracy.minimumResearchPairs&&
  evidence.accuracy.minimumResearchPairs>=100;
 const calibration=evidence.calibration||{};
 const promoted=verified(calibration.holdoutProven)&&
  verified(calibration.allPositionsSampled)&&
  verified(calibration.noPositionRegression)&&
  verified(calibration.manualPromotionApproved)&&enough;
 const metricStatus=integer(pairs)&&pairs>0?
  'verified_pairs_reportable_with_uncertainty':'not_enough_verified_data';
 return {
  schema:'PFO_643_UNIFIED_RELEASE_GATE_V1',
  rulesVersion:FFL_RULES_VERSION,
  releaseStatus:ready?'release_candidate_evidence_complete':'release_blocked',
  releaseEligible:ready,
  blockers,gates,
  accuracy:{verifiedComparablePairs:comparable,
   status:metricStatus,
   sampleThresholdMet:enough,statisticalSuperiorityClaimAllowed:false},
  calibration:{candidatePromotionAllowed:promoted,
   status:promoted?'independently_approved':'frozen_baseline_only'},
  privacy:{noPublicRecords:true,commissionerDBExcluded:true,ffoiIntegrated:false},
  releasePolicy:'ONE_protected_preview_only_after_all_gates_verified',
  noAutomaticModelPromotion:true,
  sourceEvidenceRequired:true
 };
}
