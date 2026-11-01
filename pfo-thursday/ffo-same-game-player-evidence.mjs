/** FFO read-only same-game MSF player evidence crosscheck.
 * Do not assert a historical game score is certified from a six-week sample.
 */
import {reconcilePlayerScoringEvidence} from './ffo-scoring-reconciliation.mjs';

const id=x=>x===undefined||x===null||x===''?'':String(x);
const team=x=>String(x||'').trim().toUpperCase();

/** Cross-check a successful PBP 2PT pass against a SEPARATE, independently
 * published MSF scoring-play ledger. This is evidence only, not points credit.
 * A final scoreboard alone does not certify the scorer or the conversion.
 */
export function corroborateTwoPointSummary(evidence,summary,gameId,teamAbbreviation){
 const target=team(teamAbbreviation),game=id(gameId);
 const summaryReady=!!(game&&summary?.gameId&&id(summary.gameId)===game&&
   summary.finalScoreVerified===true&&Array.isArray(summary.events));
 const rows=Array.isArray(evidence?.events)?evidence.events.map((e,index)=>({e,index}))
  .filter(x=>x.e.eventType==='two_point_attempt'):[];
 const matches=rows.map(({e,index})=>{
  const actors=(e.matched||[]).filter(m=>m.verifiedIdentity&&m.providerId&&m.sourceToken);
  const passes=actors.filter(m=>m.category==='pass_2pt');
  const receivers=actors.filter(m=>m.category==='rec_2pt');
  const passConfirmed=e.publishedResult==='reported_good'&&e.teamPossessionVerified===true&&
   passes.length===1&&receivers.length===1;
  const output={eventIndex:index,sourceCandidateIndex:index,sourceId:e.sourceId??null,period:e.period??null,
   playerIds:actors.map(m=>String(m.providerId)),publishedResult:e.publishedResult,
   pbpVerifiedSuccessfulPass:passConfirmed,scoringSummaryMatchCount:0,
   sourceTier:passConfirmed?'pbp_success_player_ids_verified':'pbp_outcome_or_identity_unverified',
   finalTwoPointPointsCertified:false};
  if(!passConfirmed||!summaryReady)return output;
  const tokenMatch=(description,token)=>description.toLowerCase().includes(String(token).toLowerCase());
  const choices=summary.events.map((sc,summaryIndex)=>({sc,summaryIndex})).filter(({sc})=>{
   const desc=String(sc.description||'');
   if(sc.scoringSide!==target||sc.scoringPoints!==2||
    !/\b(?:two[\s-]?point|2[\s-]?point|2pt)\b/i.test(desc)||
    !/\b(?:succeeds?|successful|converted|is good|was good)\b/i.test(desc)||
    /\b(?:no[\s-]?play|nullified|disallowed|fails?|failed|incomplete|intercepted|unsuccessful)\b/i.test(desc))return false;
   if(e.period!==null&&sc.period!==e.period)return false;
   return tokenMatch(desc,passes[0].sourceToken)&&tokenMatch(desc,receivers[0].sourceToken);
  });
  output.scoringSummaryMatchCount=choices.length;
  output.matchedScoringSummaryIndex=choices.length===1?choices[0].summaryIndex:null;
  output.sourceTier=choices.length===1?'two_independent_msf_feeds_agree':
   choices.length>1?'ambiguous_duplicate_scoring_summary':'pbp_success_summary_not_confirmed';
  return output;
 });
 // A single boxscore scoring-play row cannot validate two separate PBP
 // conversions. If source PBP duplicated a conversion without IDs, reject
 // ALL candidates rather than applying the same summary twice.
 const claims=new Map();
 for(const x of matches){
  if(x.sourceTier!=='two_independent_msf_feeds_agree')continue;
  const key=String(x.matchedScoringSummaryIndex);
  claims.set(key,(claims.get(key)||0)+1);
 }
 for(const x of matches){
  if(x.sourceTier==='two_independent_msf_feeds_agree'&&
   claims.get(String(x.matchedScoringSummaryIndex))>1)
   x.sourceTier='ambiguous_duplicate_pbp_candidates';
 }
 return matches;
}

/** Join by immutable MSF game ID + MSF player ID, not name or Sleeper ID. */
export function correlateWeeklyPlayerEvents({gameId,teamAbbreviation,players=[],evidence,boxEvidence=null,scoringSummary=null,rules={}}={}){
 const game=id(gameId),wanted=team(teamAbbreviation),observed=new Map(),duplicates=new Set();
 const source=Array.isArray(players)?players:[];
 for(const p of source){
  if(!p?.id||team(p.team)!==wanted)continue;
  const recordGame=id(p.game?.id??p.game?.gameId??p.raw?.game?.id);
  if(!recordGame||recordGame!==game)continue;
  const pid=id(p.id);
  if(observed.has(pid))duplicates.add(pid);
  else observed.set(pid,p);
 }
 for(const playerId of duplicates)observed.delete(playerId);
 const mentioned=new Set((evidence?.events||[]).flatMap(e=>
   (e.matched||[]).filter(x=>x.verifiedIdentity&&x.providerId).map(x=>id(x.providerId))));
 const withVerifiedSameGameStats=[...mentioned].filter(playerId=>observed.get(playerId)?.stats);
 const unverifiedPlayerIds=[...mentioned].filter(playerId=>!observed.get(playerId)?.stats);
 const sourceRecords=Object.fromEntries(withVerifiedSameGameStats.map(playerId=>
   [playerId,observed.get(playerId).stats]));
 const boxIsFinal=boxEvidence?.sourceFinalVerified===true&&
  boxEvidence.scheduleFinalVerified===true&&boxEvidence.scheduleScoreMatches===true&&
  id(boxEvidence.gameId)===game;
 const twoPointCorroboration=corroborateTwoPointSummary(evidence,scoringSummary,game,wanted);
 const ledger=reconcilePlayerScoringEvidence({
   evidence,
   playerBoxStats:sourceRecords,
   rules,
   // The published six-week PBP audit does not certify full play coverage.
   // Individual game logs alone do not prove score corrections are complete.
   checks:{
     gameFinal:boxIsFinal,
     fullPlayCoverageVerified:false,
     finalPlayerBoxScoreVerified:boxIsFinal&&unverifiedPlayerIds.length===0&&mentioned.size>0,
     statCorrectionsChecked:false
   },
   fiftyPlusPolicy:null
 });
 return {
  gameId:game||null,team:wanted,
  msfWeeklyPlayerRecords:source.length,sameGamePlayerRecords:observed.size,
  matchedCandidatePlayerIds:mentioned.size,
  sameGameStatMatches:withVerifiedSameGameStats.length,
  missingOrAmbiguousPlayerIds:unverifiedPlayerIds,
  duplicateSameGamePlayerIds:[...duplicates],
  finalScoreboardVerified:boxIsFinal,
  longTdPolicy:'not_adjudicated',
  twoPointCorroboration,
  certifiedBonusPoints:null,certifiedFantasyPlayerTotals:false,
  ledger
 };
}
