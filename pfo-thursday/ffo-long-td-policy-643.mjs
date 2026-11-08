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
  if(ff.value>0)longFiftyObserved=true;
 }
 if(longFiftyObserved){
  if(thresholdEvidence?.verified!==true||
   thresholdEvidence?.source!=='commissioner_ffl_scoring_semantics_plus_msf_pbp'||
   thresholdEvidence?.thresholdCountMode!=='nested_40plus_includes_50plus'||
   thresholdEvidence?.adjudicatedPolicy!==bonusPolicy||
   thresholdEvidence?.independentMSFEventsReconciled!==true)
   return rejected('50_plus_bonus_stacking_not_officially_adjudicated');
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
  policySource:longFiftyObserved?'commissioner_ffl_scoring_semantics_plus_msf_pbp':
   'no_50_plus_long_touchdown_in_verified_game',
  bonusPolicy,usedOverlappingDistanceSemantics:longFiftyObserved};
}
