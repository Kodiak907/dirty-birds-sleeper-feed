/**
 * FFO player scoring event SCENARIOS, read-only; no historical score writes.
 * Complements MSF ordinary player stat point calculations.
 * Important:
 *  - A pass/rec/rush TD base value already belongs to MSF player game-log stats.
 *    This module only models incremental distance bonuses.
 *  - Successful passing/receiving 2PT values are modelled ONLY when the exact
 *    corresponding category is absent from the independently verified weekly
 *    player statistics; when the stat is published this is already part of
 *    ordinary FFL stat scoring and MUST NOT be counted twice.
 *  - No bonus is released into official score totals. Stacking remains unknown
 *    until the FFL rule is documented and historical stat corrections checked.
 */
const allowedTd = new Set(['pass_td','rec_td','rush_td']);
const allowedTwo = new Set(['pass_2pt','rec_2pt','rush_2pt']);
const num=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
function validPlay(item){
 return item&&item.playerId&&item.sourceId!==null&&item.sourceId!==undefined&&
  item.sourceId!==''&&item.sourceObservedCount>=1 &&
  !item.blockers.some(x=>[
   'team_possession_unverified','result_unverified_or_unsuccessful','player_identity_unverified',
   'duplicate_or_colliding_event_identity','event_identity_insufficient','event_category_mismatch',
   'long_touchdown_distance_unverified','play_count_exceeds_final_player_stat_count'
  ].includes(x));
}
function dataByPlayer(rows){
 const out={};
 for(const r of rows){
  if(!r.playerId)continue;
  if(!out[r.playerId])out[r.playerId]={
   playerId:r.playerId,player:r.player||null,
   verifiedLongTdCount:0,scoringEvidenceCount:0,
   fortyPlusBonus:0,fiftyPlusHighestOnly:0,fiftyPlusAdditive:0,
   twoPtMissingStatSourceCandidates:0,twoPtAlreadyPublished:0,twoPtEvidenceUnverified:0,
   incrementalScenarioMin:0,incrementalScenarioMax:0,
   highestOnlyCandidatePoints:0,additiveCandidatePoints:0,
   scenarioInputsMatched:false,conditionalOnly:true
  };
 }
 return out;
}

export function eventScoreScenarios({ledger,corroboration=[],rules={}}={}){
 const items=Array.isArray(ledger?.lineItems)?ledger.lineItems:[];
 const players=dataByPlayer(items);
 const problems=new Set();
 if(!items.length)problems.add('no_source_scoring_events');
 if(ledger?.globalBlockers?.includes('candidate_evidence_truncated'))problems.add('source_events_truncated');
 if(ledger?.globalBlockers?.includes('unverified_source_candidates'))problems.add('some_source_events_unresolved');
 const twoEvents=Array.isArray(corroboration)?corroboration:[];
 const twoBySource=new Map(twoEvents.filter(x=>x?.sourceId!=null)
  .map(x=>[String(x.sourceId),x]));
 const seenTD=new Set(),seenTwo=new Set();
 for(const item of items){
  if(!item?.playerId||!players[item.playerId])continue;
  const p=players[item.playerId];
  const k=[item.playerId,item.category,item.sourceId].join('|');
  if(allowedTd.has(item.category)){
   if(seenTD.has(k)){problems.add('duplicate_player_event');continue;}
   seenTD.add(k);
   if(!validPlay(item))continue;
   if(num(item.statCount)===null||num(item.statCount)<item.sourceObservedCount)continue;
   if(num(item.yards)===null||item.yards<40)continue;
   const forty=num(rules[item.category+'_40p']);
   const fifty=num(rules[item.category+'_50p']);
   if(forty===null||item.yards>=50&&fifty===null){problems.add('distance_bonus_rule_missing');continue;}
   const highest=item.yards>=50?fifty:forty;
   const additive=forty+(item.yards>=50?fifty:0);
   p.scoringEvidenceCount++;
   p.verifiedLongTdCount++;
   p.fiftyPlusHighestOnly=round(p.fiftyPlusHighestOnly+highest);
   p.fiftyPlusAdditive=round(p.fiftyPlusAdditive+additive);
   if(item.yards<50)p.fortyPlusBonus=round(p.fortyPlusBonus+forty);
  }else if(allowedTwo.has(item.category)){
   if(seenTwo.has(k)){problems.add('duplicate_player_event');continue;}
   seenTwo.add(k);
   if(!validPlay(item)){p.twoPtEvidenceUnverified++;continue;}
   const independent=twoBySource.get(String(item.sourceId));
   const independentlyAgreed=independent?.sourceTier==='two_independent_msf_feeds_agree' &&
    Array.isArray(independent.playerIds)&&independent.playerIds.includes(String(item.playerId));
   if(!independentlyAgreed){p.twoPtEvidenceUnverified++;continue;}
   // Exact published category wins; never supplement a 2PT twice.
   if(num(item.statCount)!==null){
    if(item.statCount>=item.sourceObservedCount)p.twoPtAlreadyPublished++;
    else p.twoPtEvidenceUnverified++;
    continue;
   }
   const weight=num(rules[item.category]);
   if(weight===null){problems.add('two_point_rule_missing');continue;}
   p.twoPtMissingStatSourceCandidates=round(p.twoPtMissingStatSourceCandidates+weight);
   p.scoringEvidenceCount++;
  }
 }
 for(const p of Object.values(players)){
  // Conditional possibilities ONLY; not certified player fantasy scores.
  p.incrementalScenarioMin=round(p.fiftyPlusHighestOnly+p.twoPtMissingStatSourceCandidates);
  p.incrementalScenarioMax=round(p.fiftyPlusAdditive+p.twoPtMissingStatSourceCandidates);
  p.highestOnlyCandidatePoints=p.incrementalScenarioMin;
  p.additiveCandidatePoints=p.incrementalScenarioMax;
  p.scenarioInputsMatched=problems.size===0&&p.twoPtEvidenceUnverified===0&&
   Number.isFinite(p.incrementalScenarioMin)&&Number.isFinite(p.incrementalScenarioMax);
 }
 const summary=Object.values(players).sort((a,b)=>a.player.localeCompare(b.player));
 return {
  status:'SOURCE_BASED_SCENARIO_ONLY',
  meaning:'Potential event-derived supplements only, never final FFL player totals',
  baseTouchdownPointsIncluded:false,
  containsOnlyIncrementalBonuses:true,
  stackingAdjudicated:false,
  fullPlayCoverageCertified:false,
  statCorrectionsCertified:false,
  finalPlayerScoresCertified:false,
  canWriteScores:false,
  sourceIssues:[...problems],
  players:summary
 };
}
