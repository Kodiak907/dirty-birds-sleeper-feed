/**
 * PFO 6.43 — explicit reconciliation for long-TD overlapping thresholds.
 * This is NOT a declaration of Sleeper's actual stacking rules. Until the
 * Commissioner's documented FFL scoring semantics are adjudicated, 50+ event
 * bonuses are withheld from certified historical scoring.
 *
 * Provider source counts must reflect inclusive 40+ and inclusive 50+ play
 * thresholds, verified against complete independent MSF play-by-play.
 */
const KINDS=['pass','rush','rec'];
const finiteInteger=x=>Number.isInteger(x)&&x>=0;
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const rejected=reason=>({accepted:false,reason,components:[],
 approvedFFLBonusPolicy:false});
export function reconcileLongTDComponents643({
 components,bonusPolicy,thresholdEvidence=null
}={}){
 if(!Array.isArray(components)||
  !['highest_only','additive'].includes(bonusPolicy))
  return rejected('complete_reconciled_bonus_policy_required');
 const out=components.map(c=>({...c}));
 let longFiftyObserved=false;
 const observedFiftyKinds=[];
 for(const kind of KINDS){
  const f=out.find(x=>x.category===kind+'_td_40p');
  const ff=out.find(x=>x.category===kind+'_td_50p');
  if(!f&&!ff)continue;
  if(!f||!ff||!finiteInteger(f.value)||!finiteInteger(ff.value)||
   !Number.isFinite(f.weight)||!Number.isFinite(ff.weight)||
   f.source!=='msf_reconciled_pbp'||ff.source!=='msf_reconciled_pbp')
   return rejected('long_td_threshold_counts_or_provider_play_evidence_unverified');
  if(ff.value>f.value)
   return rejected('50_plus_long_tds_exceed_verified_40_plus_count');
  if(ff.value>0){longFiftyObserved=true;observedFiftyKinds.push(kind);}
 }
 if(longFiftyObserved){
  // Sleeper's first-party "What Stacks?" (2026-09-17) explicitly establishes
  // additive 40+ and 50+ PASSING touchdown bonuses. A highest-tier-only
  // passing calculation is therefore NOT an eligible FFL final certificate.
  // Rushing/receiving threshold treatment is not explicitly established
  // by that example and remains gated pending separately verified semantics.
  if(observedFiftyKinds.includes('pass')&&bonusPolicy!=='additive')
   return rejected('official_sleeper_passing_td_40_and_50_bonuses_are_additive');
  const officialPassEvidence=
   thresholdEvidence?.source==='official_sleeper_pass_td_stacking_2026_09_17_plus_msf_pbp'&&
   observedFiftyKinds.every(k=>k==='pass')&&bonusPolicy==='additive';
  const separatelyAdjudicatedAllTypes=
   thresholdEvidence?.source==='commissioner_ffl_scoring_semantics_plus_msf_pbp';
  if(thresholdEvidence?.verified!==true||
   (!officialPassEvidence&&!separatelyAdjudicatedAllTypes)||
   thresholdEvidence?.thresholdCountMode!=='nested_40plus_includes_50plus'||
   thresholdEvidence?.adjudicatedPolicy!==bonusPolicy||
   thresholdEvidence?.independentMSFEventsReconciled!==true)
   return rejected('50_plus_bonus_stacking_or_msf_play_evidence_not_adequately_verified');
 }
 for(const kind of KINDS){
  const f=out.find(x=>x.category===kind+'_td_40p'),
   ff=out.find(x=>x.category===kind+'_td_50p');
  if(!f||!ff)continue;
  if(ff.value>0&&bonusPolicy==='highest_only'){
   // Provider counts: 40+ includes every 50+ TD. Highest-only awards
   // the 40+ bonus to 40–49 TDs, and only 50+ tier for longer TDs.
   f.providerThresholdCount=f.value;
   f.value=f.value-ff.value;
   f.points=round(f.value*f.weight);
   f.resolvedThresholdMeaning='40_to_49_only_after_verified_overlap_subtraction';
   ff.resolvedThresholdMeaning='50_plus_highest_tier_only';
  }else if(ff.value>0){
   f.resolvedThresholdMeaning='40_plus_additive_for_verified_50_plus_TD';
   ff.resolvedThresholdMeaning='50_plus_additive_for_verified_50_plus_TD';
  }
 }
 return {accepted:true,components:out,
  approvedFFLBonusPolicy:longFiftyObserved,
  policySource:longFiftyObserved?thresholdEvidence.source:
   'no_50_plus_long_touchdown_in_verified_game',
  bonusPolicy,usedOverlappingDistanceSemantics:longFiftyObserved};
}
