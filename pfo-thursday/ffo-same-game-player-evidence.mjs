/** FFO read-only same-game MSF player evidence crosscheck.
 * Do not assert a historical game score is certified from a six-week sample.
 */
import {reconcilePlayerScoringEvidence} from './ffo-scoring-reconciliation.mjs';

const id=x=>x===undefined||x===null||x===''?'':String(x);
const team=x=>String(x||'').trim().toUpperCase();

/** Join by immutable MSF game ID + MSF player ID, not name or Sleeper ID. */
export function correlateWeeklyPlayerEvents({gameId,teamAbbreviation,players=[],evidence,boxEvidence=null,rules={}}={}){
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
  certifiedBonusPoints:null,certifiedFantasyPlayerTotals:false,
  ledger
 };
}
