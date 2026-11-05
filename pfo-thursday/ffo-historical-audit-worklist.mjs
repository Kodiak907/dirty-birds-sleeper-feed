/**
 * PFO historical MSF audit exception worklist, READ-ONLY.
 * Summarizes existing per-team, per-week evidence without silently promoting
 * source retrieval, partial totals or scoring candidates to certification.
 * Contains no credentials, no fantasy-score mutations and no provider fetches.
 */
const WEEKS=6;
const truth=x=>x===true;
const arr=x=>Array.isArray(x)?x:[];
const at=(rows,week)=>arr(rows).find(x=>Number(x?.week)===week)||null;
const isVerifiedPlayerWeek=row=>truth(row?.audit?.supported)&&truth(row?.teamFilterVerified)&&!row?.error;
function nextSteps(week,report){
 const stats=at(report?.weeks,week);
 const event=at(report?.playerEventWeeks,week);
 const kick=at(report?.kickWeeks,week);
 const dst=at(report?.teamWeeks,week);
 const box=at(report?.dstBoxWeeks,week);
 const tasks=[];
 const push=(code,label,category,priority)=>tasks.push({code,label,category,priority});
 if(!isVerifiedPlayerWeek(stats))
  push('player_gamelog_unverified','Verify final MSF player game logs and IDs','source',1);
 if(!event?.evidence||event?.error)
  push('pbp_event_sample_missing','Retrieve MSF play-by-play for this verified game','source',1);
 if(!box?.evidence||box?.error)
  push('final_boxscore_crosscheck_missing','Verify independent final MSF scoreboard','source',1);
 else if(!(truth(box.evidence.sourceFinalVerified)&&
  truth(box.evidence.scheduleFinalVerified)&&truth(box.evidence.scheduleScoreMatches)))
  push('final_score_not_agreed','Resolve final score or schedule disagreement','source',1);
 const rec=event?.sameGameReconciliation;
 if(event?.evidence&&(!rec||!truth(rec.finalScoreboardVerified)))
  push('same_game_event_crosscheck_incomplete','Reconcile MSF event actors by game ID and player ID','event',2);
 if(arr(rec?.missingOrAmbiguousPlayerIds).length||arr(rec?.duplicateSameGamePlayerIds).length)
  push('event_player_identity_conflict','Resolve duplicate or unknown player identities','event',1);
 const candidates=Number.isInteger(event?.evidence?.publishedCandidates)?
  event.evidence.publishedCandidates:null;
 if(candidates!==null&&candidates>0&&
   (event.evidence.unverifiedCandidateEvents>0||
    arr(rec?.ledger?.lineItems).some(x=>arr(x.blockers).includes('team_possession_unverified'))))
  push('scoring_candidates_unverified','Resolve unverified scoring-play candidates','event',2);
 if(arr(rec?.twoPointCorroboration).some(x=>x.sourceTier!=='two_independent_msf_feeds_agree'))
  push('two_point_corroboration_missing','Cross-check 2PT scorer and receiving player against independent scoring summary','event',2);
 // Completeness of the entire play sequence cannot be inferred from a PBP
 // sample; this requires a separate verified game-completeness attestation.
 push('whole_game_play_coverage_unverified','Verify complete play inventory, nullifications and scoring corrections','certification',3);
 push('forty_fifty_bonus_policy_pending','Adjudicate official 40+/50+ touchdown stacking and deduplication','rules',3);
 if(!kick?.evidence||kick?.error)
  push('kicker_play_reconciliation_incomplete','Reconcile FG/XP made and missed against player and team totals','specialists',3);
 else if(kick.evidence?.fullKickerScoreCertified!==true)
  push('kicker_score_unverified','Complete kicker FG/XP and statistical correction checks','specialists',3);
 if(!dst?.evidence||dst?.error)
  push('dst_team_logs_unverified','Verify MSF team defense game log','specialists',3);
 push('dst_points_allowed_and_returns_unverified','Reconcile adjusted points allowed, returns, blocks and D/ST score','specialists',4);
 return {week,gameId:event?.gameId||box?.evidence?.gameId||null,
  game:event?.game||box?.game||null,
  playerLogParsed:isVerifiedPlayerWeek(stats),
  publishedScoringCandidates:candidates,
  matchedPlayerIds:Number.isInteger(rec?.sameGameStatMatches)?rec.sameGameStatMatches:null,
  rawPbpCandidateCount:Number.isInteger(event?.evidence?.rawPlayCount)?event.evidence.rawPlayCount:null,
  tasks:tasks.sort((a,b)=>a.priority-b.priority||a.code.localeCompare(b.code)),
  scoreCertified:false};
}
export function buildHistoricalAuditWorklist(report,{weeks=WEEKS}={}){
 const count=Number.isInteger(weeks)&&weeks>=1&&weeks<=18?weeks:WEEKS;
 const games=Array.from({length:count},(_,i)=>nextSteps(i+1,report||{}));
 const counts={};
 for(const g of games)for(const t of g.tasks)counts[t.code]=(counts[t.code]||0)+1;
 const sourceParsed=games.filter(g=>g.playerLogParsed).length;
 return {stage:'SOURCE_AUDIT_EXCEPTION_TRIAGE',team:String(report?.team||'UNKNOWN'),
  games,sourceParsed,sourceWeeks:count,scoreCertifiedCount:0,
  next:games.find(g=>g.tasks.length)?.week??null,
  topBlockers:Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10)
   .map(([code,affectedGames])=>({code,affectedGames})),
  researchOnly:true,productionScoreWriteAllowed:false,productionProjectionEligible:false,
  note:'Source check and candidate extraction are NOT complete scoring proof. No missing field is treated as zero.'};
}
/** Source-only checkpoint queue: never re-downloads an already inspected game. */
export function buildCertificationWorklistFromCheckpoints(schedule=[],snapshots={},{
 fromWeek=1,throughWeek=7,priorityTeam='GB',maxDisplay=7
}={}){
 const list=(Array.isArray(schedule)?schedule:[]).filter(g=>Number.isInteger(g.week)&&
  g.week>=fromWeek&&g.week<=throughWeek&&g.id!=null);
 const unique=new Map(list.map(g=>[String(g.id),g]));
 const cards=[...unique.values()].map(g=>{
  const saved=snapshots[String(g.id)]||null;
  const fetched=!!saved?.checkedAt,healthy=fetched&&saved?.sourceFailure!==true;
  const missing=[];
  if(!healthy)missing.push(fetched?'source_read_failed':'source_not_checked');
  if(!saved?.pbpPublished)missing.push('published_pbp_unverified');
  if(!saved?.finalBoxVerified||!saved?.scoreMatchesSchedule)
    missing.push('final_boxscore_crosscheck_unverified');
  if(!saved?.playerGameLogsVerified)missing.push('both_team_player_logs_unverified');
  // The source checkpoint intentionally does NOT store scoring or correction proof.
  missing.push('full_play_coverage_unverified','scoring_categories_and_events_unreconciled',
   'stat_corrections_unverified','bonus_stacking_unadjudicated');
  return {gameId:String(g.id),week:g.week,home:g.home,away:g.away,
   sourceChecked:healthy,sourceFailure:fetched&&!healthy,
   certificationReady:false,missing,sourceEvidenceOnly:true};
 }).sort((a,b)=>{
  const ap=a.home===priorityTeam||a.away===priorityTeam?0:1;
  const bp=b.home===priorityTeam||b.away===priorityTeam?0:1;
  return ap-bp||a.week-b.week||a.gameId.localeCompare(b.gameId);
 });
 return {sourceGames:cards.length,sourceChecked:cards.filter(g=>g.sourceChecked).length,
  sourcePendingOrFailed:cards.filter(g=>!g.sourceChecked).length,
  certifiedPlayerScores:0,worklist:cards.slice(0,Math.max(1,Math.min(12,maxDisplay))),
  previewOnly:true,productionEligible:false,
  note:'This worklist is generated from local source checkpoints. It never certifies player points.'};
}
