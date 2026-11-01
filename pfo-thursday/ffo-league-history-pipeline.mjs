/**
 * FFO historical season processing and readiness. Source schedule in, verified
 * MSF scoring certificates out. Never creates games, scores, or "verified" zeros.
 * Works in bounded, user-triggered batches and cannot write production points.
 */
import {planHistoricalMatchups,summarizeHistoricalMatchups} from './ffo-historical-matchup-tracker.mjs';
import {certifyHistoricalFFLPlayerGame} from './ffo-historical-score-certificate.mjs';
const TEAMS=['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN',
 'DET','GB','HOU','IND','JAX','KC','LV','LAC','LAR','MIA','MIN','NE',
 'NO','NYG','NYJ','PHI','PIT','SF','SEA','TB','TEN','WSH'];
const ALIASES={WAS:'WSH',JAC:'JAX',LA:'LAR',OAK:'LV',SD:'LAC',STL:'LAR',ARZ:'ARI',GBP:'GB',GNB:'GB'};
const canon=x=>ALIASES[String(x||'').toUpperCase()]||String(x||'').toUpperCase();
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const final=x=>/^(FINAL|COMPLETED|FINAL_OT|FINAL_OVERTIME)$/i.test(String(x||''));
export const NFL_2026_TEAMS=Object.freeze([...TEAMS]);
export const scoreCertificateToHistoryRow=c=>c?.certified===true&&Number.isFinite(c.points)?{
 playerId:c.playerId,gameId:c.gameId,week:c.week,provider:'MSF',
 gameStatus:c.gameStatus,playerIdentityVerified:true,finalBoxScoreVerified:true,
 statCategoriesComplete:true,eventBonusesReconciled:true,statCorrectionsChecked:true,
 fflPoints:c.points,team:c.team,opponent:c.opponent,certification:'ffo_full_score_v1',
 rulesVersion:c.rulesVersion,fantasyScoreFromSleeper:false
}:null;

/** Source coverage, not a declaration that the 2026 season has been ingested. */
export function buildLeagueHistoryCoverage(schedule=[],snapshots={},certificates=[],{
 fromWeek=1,throughWeek=7
}={}){
 const normalized=(Array.isArray(schedule)?schedule:[]).map(g=>({
  ...g,home:canon(g.home),away:canon(g.away)
 }));
 const plan=planHistoricalMatchups(normalized,{fromWeek,throughWeek});
 const report=summarizeHistoricalMatchups(plan,snapshots);
 const represented=new Set(plan.games.flatMap(g=>[g.home,g.away]).filter(t=>TEAMS.includes(t)));
 const active=TEAMS.filter(t=>represented.has(t));
 const unknown=TEAMS.filter(t=>!represented.has(t));
 const byId=new Map();
 const rejected=[];
 for(const c of certificates||[]){
  if(c?.certified!==true||!Number.isFinite(c.points)||!c.gameId||!c.playerId){
   rejected.push({gameId:c?.gameId||null,playerId:c?.playerId||null,reason:'uncertified_or_missing_points'});
   continue;
  }
  const g=plan.games.find(g=>g.id===String(c.gameId));
  if(!g||!g.final||!g.sourceWeekVerified||g.week!==c.week||!TEAMS.includes(c.team)){
   rejected.push({gameId:c.gameId,playerId:c.playerId,reason:'game_not_in_verified_final_schedule'});
   continue;
  }
  const key=String(c.gameId)+'|'+String(c.playerId);
  if(!byId.has(key))byId.set(key,c);
  else if(byId.get(key).points!==c.points||byId.get(key).rulesVersion!==c.rulesVersion){
   byId.delete(key);rejected.push({gameId:c.gameId,playerId:c.playerId,reason:'conflicting_score_revisions'});
  }
 }
 const accepted=[...byId.values()].map(scoreCertificateToHistoryRow).filter(Boolean);
 const byWeek=report.byWeek.map(w=>({...w,certifiedPlayerScores:accepted.filter(c=>c.week===w.week).length}));
 const gbGames=plan.games.filter(g=>g.home==='GB'||g.away==='GB');
 const gbMissing=gbGames.filter(g=>!g.sourceWeekVerified||!g.final||!snapshots[g.id]?.finalPlayerScoreRecomputed)
  .map(g=>({week:g.week,gameId:g.id,missing:summarizeHistoricalMatchups({
   games:[g],byWeek:[{week:g.week,games:1}]
  },snapshots).games[0]?.missingBasic||[]}));
 return {
  season:2026,fromWeek,throughWeek,teamsRepresented:active.length,totalTeams:32,
  representedTeams:active,unseenTeams:unknown,sourceGames:plan.games.length,
  sourceFinalGames:plan.games.filter(g=>g.final).length,
  sourceWeeksWithGames:byWeek.filter(w=>w.games>0).length,
  leagueScheduleCertified:false,
  fullyReconciledGames:report.fullyReconciledGames,
  certifiedPlayerGameScores:accepted.length,
  rejectedCertificates:rejected,
  certifiedHistoryRows:accepted,
  gb:{sourceGames:gbGames.length,missing:gbMissing},
  byWeek,
  blockers:[
   ...(unknown.length?['some_nfl_teams_not_present_in_source_schedule']:[]),
   ...(byWeek.some(w=>w.games===0)?['one_or_more_source_weeks_empty']:[]),
   ...(report.games.some(g=>!g.fullFantasyScoreCertified)?['historical_games_not_fully_reconciled']:[]),
   ...(!accepted.length?['no_certified_player_game_scores']:[])
  ]
 };
}

/**
 * GB W1-7 first for reconstruction, then other teams/games. Each game
 * appears once even though it covers two teams; do not triple-run a batch.
 */
export function nextLeagueHistoryBatch(schedule=[],snapshots={},{
 fromWeek=1,throughWeek=7,maxGames=4,priorityTeam='GB',allowEstimatedWeekForSourceDiscovery=false,skipPreviouslyInspected=false
}={}){
 if(!Number.isInteger(maxGames)||maxGames<1||maxGames>8)throw Error('batch_size_1_to_8');
 const plan=planHistoricalMatchups((schedule||[]).map(g=>({...g,home:canon(g.home),away:canon(g.away)})),
  {fromWeek,throughWeek});
 const summary=summarizeHistoricalMatchups(plan,snapshots);
 // Estimated schedule weeks may be investigated for SOURCE DISCOVERY ONLY.
 // Such games cannot be certified until MSF independently verifies the week.
 const pending=summary.games.filter(g=>g.final&&
  (g.sourceWeekVerified||allowEstimatedWeekForSourceDiscovery)&&!g.fullFantasyScoreCertified&&
  (!skipPreviouslyInspected||!snapshots[g.id]?.checkedAt));
 const priority=canon(priorityTeam);
 const ordered=pending.sort((a,b)=>{
  const av=a.home===priority||a.away===priority?0:1;
  const bv=b.home===priority||b.away===priority?0:1;
  return av-bv||a.week-b.week||a.id.localeCompare(b.id);
 });
 return {pendingGames:ordered.length,batch:ordered.slice(0,maxGames).map(g=>({
  gameId:g.id,week:g.week,home:g.home,away:g.away,stage:g.stage,
  weekSource:g.sourceWeekVerified?'msf_verified':'calendar_estimate_not_certifiable',
  required:!g.checks.publishedPbp||!g.checks.finalBoxScore?['plays','boxscore']:
   ['gamelogs','teamgamelogs','event_reconciliation','stat_corrections'],
  blockers:[...new Set([...g.missingBasic,...g.missingAdvanced])]
 })),sourceSeasonScheduleCertified:false};
}

/**
 * Source inputs keyed by canonical provider game ID. Used by server side
 * ingesters or authorized read-only preview tasks, never by fixture scores.
 */
export function certifyLeagueGameBatch(gameInputs=[],rules,{bonusPolicy=null,bonusPolicyAdjudicated=false}={}){
 if(!Array.isArray(gameInputs)||gameInputs.length>8)throw Error('bounded_game_batch_required');
 const results=[];
 for(const item of gameInputs){
  for(const player of item.players||[]){
   results.push(certifyHistoricalFFLPlayerGame({
    game:item.game,player,rules,componentProof:item.proofsByPlayer?.[String(player.id)]||[],
    bonusPolicy,bonusPolicyAdjudicated
   }));
  }
 }
 return {total:results.length,certified:results.filter(x=>x.certified).length,
  withheld:results.filter(x=>!x.certified).length,
  certificates:results,productionWriteAllowed:false,source:'read_only_ffo_msf'};
}
