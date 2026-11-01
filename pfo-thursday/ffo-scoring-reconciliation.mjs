/**
 * FFO / PFO Week-5 reconciliation gate — evidence-to-points, NOT a score writer.
 *
 * Uses the output of playerScoringPlayCandidates plus independently sourced
 * FINAL MySportsFeeds player box-score lines. Never uses Sleeper fantasy points.
 * No inferred zeroes, no silent 50+ touchdown stacking decisions.
 * API deliberately returns proposed awards only; does not mutate player totals.
 */
import {normalizeStats} from './ffo-gamecast-model.mjs';

const VALID_CATEGORIES = new Set(['pass_td','rec_td','rush_td','pass_2pt','rec_2pt','rush_2pt']);
const READY = ['gameFinal','fullPlayCoverageVerified','finalPlayerBoxScoreVerified','statCorrectionsChecked'];
const integerStat = x => Number.isInteger(x) && x >= 0;
const rounded = x => Math.round((x + Number.EPSILON) * 100) / 100;

export function reconcilePlayerScoringEvidence({
 evidence, playerBoxStats={}, rules={}, checks={}, fiftyPlusPolicy=null
}={}) {
 const candidates=Array.isArray(evidence?.events)?evidence.events:[];
 const globalBlockers=[];
 for(const key of READY) if(checks[key]!==true)globalBlockers.push('missing_'+key);
 if(!evidence||!Array.isArray(evidence.events))globalBlockers.push('missing_pbp_candidate_evidence');
 if(evidence&&Number(evidence.publishedCandidates)!==candidates.length)
   globalBlockers.push('candidate_evidence_truncated');
 if(evidence&&Number(evidence.unverifiedCandidateEvents)>0)
   globalBlockers.push('unverified_source_candidates');
 // The candidate parser has already discarded explicitly nullified plays;
 // it does not establish completeness of the MSF provider response.
 if(!['additive','highest_only'].includes(fiftyPlusPolicy)&&fiftyPlusPolicy!==null)
   globalBlockers.push('invalid_fifty_plus_policy');
 const eventKeys=new Map();
 for(const e of candidates){
   const native=e.sourceId!=null&&String(e.sourceId).trim()!==''?String(e.sourceId):'';
   const clock=e.clock==null?'':String(e.clock),period=e.period==null?'':String(e.period);
   const fingerprint=period+'|'+clock+'|'+String(e.description||'').trim();
   const key=native?'id:'+native:'clock:'+fingerprint;
   if(!native&&(!clock||!period))continue;
   const list=eventKeys.get(key)||[];list.push(fingerprint);eventKeys.set(key,list);
 }
 const allCandidates=[];
 for(const [eventIndex,e] of candidates.entries()){
   const reasons=[];
   if(!e.teamPossessionVerified)reasons.push('team_possession_unverified');
   if(!['reported_good','touchdown_reported'].includes(e.publishedResult))
     reasons.push('result_unverified_or_unsuccessful');
   if(!Array.isArray(e.matched)||e.matched.length===0)
     reasons.push('no_attributed_player');
   if(e.matched?.some(x=>!x.verifiedIdentity||!x.providerId))
     reasons.push('player_identity_unverified');
   const native=e.sourceId!=null&&String(e.sourceId).trim()!==''?String(e.sourceId):'';
   const clock=e.clock==null?'':String(e.clock),period=e.period==null?'':String(e.period);
   const fingerprint=period+'|'+clock+'|'+String(e.description||'').trim();
   const key=native?'id:'+native:'clock:'+fingerprint;
   if(!native&&(!clock||!period))reasons.push('event_identity_insufficient');
   if((eventKeys.get(key)||[]).length!==1)reasons.push('duplicate_or_colliding_event_identity');
   for(const m of e.matched||[]){
     const category=String(m.category||'');
     const ruleNames=category.endsWith('_2pt')?[category]:Array.isArray(m.weightedRules)?m.weightedRules:[];
     const possible50=ruleNames.some(x=>x.endsWith('_50p'));
     const bonusRules=possible50&&fiftyPlusPolicy==='highest_only'
       ?ruleNames.filter(x=>x.endsWith('_50p')):ruleNames;
     const local=[...reasons];
     if(!VALID_CATEGORIES.has(category))local.push('unsupported_category');
     if(possible50&&!fiftyPlusPolicy)local.push('fifty_plus_stacking_not_adjudicated');
     if(!m.verifiedIdentity||!m.providerId)local.push('player_identity_unverified');
     const pId=String(m.providerId||'');
     const source=playerBoxStats[pId];
     const line=source&&typeof source==='object'?normalizeStats(source):{};
     if(!integerStat(line[category]))local.push('final_player_stat_not_verified');
     const weights=bonusRules.map(name=>[name,Number(rules[name])]);
     if(weights.some(([,w])=>!Number.isFinite(w)))local.push('weighted_rule_missing');
     if(e.eventType==='two_point_attempt'&&m.yards!=null)
       local.push('invalid_two_point_yardage');
     if(e.eventType==='long_touchdown'&&!(Number.isFinite(m.yards)&&m.yards>=40))
       local.push('long_touchdown_distance_unverified');
     if((e.eventType==='two_point_attempt')!==category.endsWith('_2pt'))
       local.push('event_category_mismatch');
     const potential=weights.reduce((n,[,weight])=>n+weight,0);
     allCandidates.push({
       eventIndex,sourceId:e.sourceId??null,period:e.period??null,clock:e.clock??null,
       playerId:pId||null,player:m.player||null,category,yards:m.yards??null,
       statCount:integerStat(line[category])?line[category]:null,
       weightedRules:bonusRules,
       potentialPoints:rounded(potential),checks:local
     });
   }
 }
 // Count every uniquely attributed, successful source event independently
 // of bonus stacking and whether the provider published the stat field. A
 // held 50+ TD MUST still count toward a player's TD count reconciliation.
 const validPlayCounts=new Map();
 const provisionalOnly=new Set([
   'fifty_plus_stacking_not_adjudicated','final_player_stat_not_verified',
   'weighted_rule_missing'
 ]);
 for(const c of allCandidates){
   if(!c.playerId||c.checks.some(reason=>!provisionalOnly.has(reason)))continue;
   const k=c.playerId+'|'+c.category;
   validPlayCounts.set(k,(validPlayCounts.get(k)||0)+1);
 }
 const ledger=allCandidates.map(c=>{
   const key=c.playerId+'|'+c.category;
   const sourceObservedCount=validPlayCounts.get(key)||0;
   const blockers=[...globalBlockers,...c.checks];
   if(c.statCount!==null&&sourceObservedCount>c.statCount)
     blockers.push('play_count_exceeds_final_player_stat_count');
   const unique=[...new Set(blockers)],eligible=unique.length===0;
   const sourceCategoryAgreement=
     !c.playerId?'player_unresolved':
     c.statCount===null?'player_stat_unpublished':
     sourceObservedCount>c.statCount?'source_plays_exceed_stat':
     sourceObservedCount===c.statCount?'source_event_count_equals_stat':
     'source_events_are_subset_of_stat';
   return {...c,sourceObservedCount,sourceCategoryAgreement,
     status:eligible?'ready_for_scoring_integration':'pending_verification',
     blockers:unique,creditedFantasyPoints:null,
     proposedPoints:eligible?c.potentialPoints:null};
 });
 const byPlayer={};
 for(const c of ledger)if(c.status==='ready_for_scoring_integration'&&c.playerId){
   byPlayer[c.playerId]=rounded((byPlayer[c.playerId]||0)+c.proposedPoints);
 }
 return {
   source:'MSF play-by-play + independently verified FINAL MSF player box score + FFO rules',
   stage:'read_only_reconciliation_not_integrated_with_team_totals',
   publishedCandidates:evidence?.publishedCandidates??null,
   excludedNullifiedPlays:evidence?.excludedNullifiedPlays??null,
   checksRequired:READY,globalBlockers:[...new Set(globalBlockers)],
   lineItems:ledger,readyCount:ledger.filter(c=>c.status==='ready_for_scoring_integration').length,
   pendingCount:ledger.filter(c=>c.status!=='ready_for_scoring_integration').length,
   proposedBonusPointsByPlayer:byPlayer,
   finalFFLPlayerTotalsCertified:false
 };
}
