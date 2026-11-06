/**
 * PFO 6.42 — cross-tool projection reliability release gate.
 *
 * This is not a "green because code exists" dashboard. Green requires
 * production-like infrastructure proof, verified independent MSF data,
 * pregame model parity, sample-size adequacy, and frozen-rule arithmetic.
 */
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
const POS=['QB','RB','WR','TE','K','DEF'];
const checks={
  '6.38':'Immutable pregame capture',
  '6.39':'Independent MSF final-score certification',
  '6.40':'Accuracy dashboard',
  '6.41':'Held-out calibration',
  '6.42':'Projection-tool reliability and release'
};
const boolean=x=>x===true;
const integer=x=>Number.isInteger(x)&&x>=0;
const money=x=>typeof x==='number'&&Number.isFinite(x);
const summary=(id,ready,reason)=>({
 phase:id,title:checks[id],status:ready?'verified':'blocked',
 blockingReason:ready?null:reason
});
export function auditProjectionSurfaces({sourceVersion,modules={},staticHtml='',sampleRows=[]}={}){
 const errors=[];
 if(sourceVersion!==FFL_RULES_VERSION)errors.push('source_scoring_contract_version_mismatch');
 for(const [name,key] of [['Team HQ','teamHQ'],['Matchups','matchups'],
  ['Market','market'],['Waivers','waivers'],['Start/Sit','startSit'],['GameCast','gamecast']]){
  const surface=modules[key];
  if(!surface||surface.projectionSource!=='PFO'||
    surface.rulesVersion!==sourceVersion||surface.fromSleeperScore!==false)
   errors.push('source_mismatch_'+key);
 }
 if(!staticHtml.includes('ffo-pfo-core.js?v=636')||
  !staticHtml.includes('ffo-pfo-597.js?v=636')||
  !staticHtml.includes('ffo-pfo-616.js?v=636'))
  errors.push('frozen_preview_asset_versions_unverified');
 for(const row of sampleRows){
  if(!row||!integer(row.required)||!integer(row.covered)||row.covered>row.required||
   !money(row.subtotal)||!Array.isArray(row.starters)){
   errors.push('invalid_starter_total_sample');continue
  }
  const seen=new Set();
  let total=0,count=0;
  for(const p of row.starters){
   if(typeof p?.id!=='string'||seen.has(p.id)){
    errors.push('missing_or_duplicate_starter_identifier');continue
   }
   seen.add(p.id);
   if(money(p.points)){total+=p.points;count++}
  }
  if(count!==row.covered||Math.abs(Math.round(total*100)/100-row.subtotal)>.011)
   errors.push('arithmetic_disagrees_with_starter_models');
  if(row.labelCertified===true)errors.push('provisional_projection_mislabeled_certified');
 }
 return {status:errors.length?'blocked':'static_surface_contract_passed',
  rulesVersion:FFL_RULES_VERSION,failedChecks:[...new Set(errors)],
  staticContractOnly:true,realUIEndToEndVerified:false,productionEligible:false};
}
/**
 * Accept only independently witnessed evidence, never booleans inferred
 * because code or a workflow exists.
 */
export function evaluatePFOReleaseReadiness({
 sourceVersion,storage={},capture={},finals={},accuracy={},calibration={},
 screens={},mobile={},isolation={}
}={}){
 const versions=sourceVersion===FFL_RULES_VERSION&&
 [capture,finals,accuracy,calibration].every(x=>x.rulesVersion===FFL_RULES_VERSION);
 const sep=storage.accuracyBound===true&&
  storage.commissionerSeparate===true&&
  storage.schemaApplied===true&&
  storage.appendOnlyTestPassed===true&&
  storage.realBindingIdVerified===true;
 const first=versions&&sep&&capture.schedulerActive===true&&
  capture.pfoModelParityVerified===true&&capture.msfFixtureVerified===true&&
  capture.stampedServerSide===true&&integer(capture.savedSnapshots)&&
  capture.savedSnapshots>0;
 const second=versions&&sep&&finals.completeMSFFinalEvidenceVerified===true&&
  finals.zeroUnverifiedBonuses===true&&finals.sourceCorrectionsReconciled===true&&
  integer(finals.certifiedScores)&&finals.certifiedScores>0;
 const third=versions&&first&&second&&accuracy.realIndependentPairs===true&&
  accuracy.sampleGatePassed===true&&accuracy.confidenceLabelsVisible===true&&
  Number.isInteger(accuracy.pairs)&&accuracy.pairs>=100;
 const fourth=versions&&third&&calibration.heldOutWeeksVerified===true&&
  calibration.allPositionsAdequatelySampled===true&&
  calibration.noPositionRegression===true&&calibration.improvementVerified===true&&
  calibration.manualPromotionApproved===true;
 const fifth=versions&&fourth&&screens.projectionSurfacesConsistent===true&&
  screens.starterTotalsReconciled===true&&
  screens.kickerAndDefensiveCategoriesChecked===true&&
  mobile.safariRegressionPass===true&&mobile.realDeviceQA===true&&
  isolation.commissionerRecordsUnchanged===true&&
  isolation.publicDemoUnchanged===true&&
  isolation.ffoiNotIntegrated===true;
 const phases=[
  summary('6.38',first,'separate accuracy D1 + live MSF schedule + same PFO model snapshots not proven'),
  summary('6.39',second,'complete MSF final-game and event certificate corpus not proven'),
  summary('6.40',third,'100+ independently matched verified pregame/final examples and visible confidence not proven'),
  summary('6.41',fourth,'adequately sampled strictly held-out improvement and explicit promotion approval not proven'),
  summary('6.42',fifth,'full mobile, cross-tool projection parity and isolation verification not proven')
 ];
 return {schema:'FFO_PFO_RELIABILITY_GATE_V1',
  rulesVersion:FFL_RULES_VERSION,
  status:fifth?'release_candidate_approved':'not_ready_for_live_accuracy_claim',
  phases,unmetPhases:phases.filter(p=>p.status!=='verified').map(p=>p.phase),
  allPositions:POS,
  productionEligible:fifth,
  automaticModelPromotion:false,
  reportOnly:true,
  commissionerRecordsModified:false,
  ffoiIntegrationAuthorized:false
 };
}
export function produceResearchReadinessReport({rulesVersion,hasSeparateDB=false,
 modelAdapterVerified=false,liveCaptures=0,certifiedScores=0,
 independentMatches=0,mobileQA=false}={}){
 return evaluatePFOReleaseReadiness({sourceVersion:rulesVersion,
  storage:{accuracyBound:hasSeparateDB,commissionerSeparate:true,
   schemaApplied:false,appendOnlyTestPassed:false,realBindingIdVerified:false},
  capture:{rulesVersion,schedulerActive:false,pfoModelParityVerified:modelAdapterVerified,
   msfFixtureVerified:false,stampedServerSide:true,savedSnapshots:liveCaptures},
  finals:{rulesVersion,completeMSFFinalEvidenceVerified:false,certifiedScores},
  accuracy:{rulesVersion,realIndependentPairs:false,pairs:independentMatches},
  calibration:{rulesVersion,heldOutWeeksVerified:false,manualPromotionApproved:false},
  screens:{projectionSurfacesConsistent:false},
  mobile:{safariRegressionPass:mobileQA,realDeviceQA:false},
  isolation:{commissionerRecordsUnchanged:true,publicDemoUnchanged:true,ffoiNotIntegrated:true}
 });
}
