/**
 * FFO independent historical form + matchup projection research.
 * No Sleeper fantasy scoring, projection or historical inputs.
 *
 * This is a pure model: it never fetches MSF, and it never writes FFL scores.
 * Only source-verified FINAL game scores, including reconciled scoring events,
 * qualify as game observations. Unverified/missing games never become zeroes.
 *
 * Projected values remain RESEARCH until full historical backtesting passes.
 */
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const validWeek=x=>Number.isInteger(x)&&x>=1&&x<=18;
const finalStatus=x=>['FINAL','COMPLETED','FINAL_OT','FINAL_OVERTIME'].includes(String(x||'').toUpperCase());
const unique=x=>[...new Set(x)];

export function historicalScoringEligibility(row,playerId,asOfWeek) {
 const reasons=[];
 if(!row||typeof row!=='object')return ['no_source_row'];
 if(String(row.playerId??'')!==String(playerId??''))reasons.push('wrong_player');
 if(!validWeek(row.week)||row.week>=asOfWeek)reasons.push('not_prior_week');
 if(!row.gameId)reasons.push('missing_game_identity');
 if(!['MSF','MySportsFeeds'].includes(row.provider))reasons.push('non_msf_source');
 if(!finalStatus(row.gameStatus))reasons.push('game_not_final');
 if(!row.playerIdentityVerified)reasons.push('player_identity_not_verified');
 if(!row.finalBoxScoreVerified)reasons.push('final_box_score_not_verified');
 if(!row.statCategoriesComplete)reasons.push('scoring_categories_incomplete');
 if(!row.eventBonusesReconciled)reasons.push('bonus_event_reconciliation_incomplete');
 if(!row.statCorrectionsChecked)reasons.push('stat_corrections_unchecked');
 if(!finite(row.fflPoints)||row.fflPoints<0&&row.negativeScoreDisallowed===true)
   reasons.push('independent_ffl_score_missing');
 if(row.fantasyScoreFromSleeper===true)reasons.push('disallowed_sleeper_score_input');
 return reasons;
}

/**
 * expectedFinalGames must be individually verified source games already played
 * for this player, excluding bye weeks. If missing, projection stays withheld.
 */
export function buildHistoricalPlayerProfile({
 playerId,asOfWeek,rows=[],expectedFinalGames=[]
}={}) {
 const rejected=[],qualified=[],duplicateConflicts=[],seen=new Map();
 if(!playerId||!validWeek(asOfWeek))return {
   status:'insufficient_source_context',reasons:['invalid_player_or_as_of_week'],games:[],rejected:[],
   expectedFinalGames:[],coverage:null
 };
 const expected=new Map();
 for(const g of expectedFinalGames){
   if(!g||!validWeek(g.week)||g.week>=asOfWeek||!g.gameId||!finalStatus(g.status)||g.playerId&&String(g.playerId)!==String(playerId))continue;
   expected.set(String(g.gameId),{gameId:String(g.gameId),week:g.week});
 }
 for(const row of rows){
   if(String(row?.playerId??'')!==String(playerId))continue;
   const reasons=historicalScoringEligibility(row,playerId,asOfWeek);
   if(!expected.has(String(row.gameId)))reasons.push('game_not_in_verified_final_schedule');
   if(reasons.length){rejected.push({week:row.week??null,gameId:row.gameId??null,reasons:unique(reasons)});continue;}
   const original=seen.get(String(row.gameId));
   if(original) {
     if(original.week!==row.week||original.fflPoints!==row.fflPoints){
       duplicateConflicts.push({gameId:String(row.gameId),reason:'conflicting_scoring_revisions_require_adjudication'});
     }
     continue;
   }
   seen.set(String(row.gameId),row);
   qualified.push({week:row.week,gameId:String(row.gameId),points:round(row.fflPoints),
     opponent:row.opponent||null,team:row.team||null,source:'verified_MSF_final',
     correctedAt:row.correctedAt||null});
 }
 const conflictIDs=new Set(duplicateConflicts.map(x=>x.gameId));
 const games=qualified.filter(x=>!conflictIDs.has(x.gameId)).sort((a,b)=>a.week-b.week);
 const expectedCount=expected.size;
 const missing=[...expected.values()].filter(g=>!games.some(x=>x.gameId===g.gameId));
 const coverage=expectedCount?round(games.length/expectedCount):null;
 const reasons=[];
 if(!expectedCount)reasons.push('verified_final_schedule_missing');
 if(duplicateConflicts.length)reasons.push('conflicting_scoring_revisions');
 if(missing.length)reasons.push('some_historical_game_scores_missing');
 if(games.length<3)reasons.push('fewer_than_three_verified_games');
 if(coverage!==null&&coverage<0.75)reasons.push('historical_coverage_below_75_percent');
 return {
   status:reasons.length===0?'verified_form_sample':'incomplete_historical_profile',
   reasons,playerId:String(playerId),asOfWeek,
   games,verifiedGames:games.length,expectedGames:expectedCount,
   expectedFinalGames:[...expected.values()],missing,coverage,rejected,duplicateConflicts
 };
}
function mean(nums){return nums.length?nums.reduce((s,x)=>s+x,0)/nums.length:null;}
function stddev(nums){if(!nums.length)return null;const m=mean(nums);return Math.sqrt(mean(nums.map(x=>(x-m)**2)));}

/**
 * Opponent input is independently observed historical FFL points ALLOWED
 * to the selected position, for games before the projected week.
 * A verified league-wide positional baseline is required for adjustment.
 */
export function forecastFromVerifiedHistory({
 profile,nextWeek,opponent=null,opponentPositionSamples=[],leaguePositionalMean=null,
 availabilityStatus='unknown'
}={}) {
 const result={
   playerId:profile?.playerId??null,nextWeek:nextWeek??null,opponent:opponent||null,
   status:'withheld',points:null,formOnly:null,seasonAverage:null,last3Average:null,
   volatility:null,opponentFactor:1,opponentSampleCount:0,confidence:'unrated',
   verifiedGames:profile?.games?.length??0,expectedGames:profile?.expectedGames??0,
   coverage:profile?.coverage??null,limitations:[],source:'FFO-owned scoring on verified MSF historical games',
   productionEligible:false,backtestCertified:false
 };
 const errors=[];
 if(!profile||!Array.isArray(profile.games))errors.push('missing_historical_profile');
 if(!validWeek(nextWeek)||profile?.asOfWeek!==nextWeek)errors.push('projection_week_mismatch');
 if(profile?.duplicateConflicts?.length)errors.push('historical_corrections_unadjudicated');
 if(profile?.coverage===null||profile.coverage<0.75)errors.push('historical_coverage_insufficient');
 if((profile?.games?.length||0)<3)errors.push('fewer_than_three_verified_games');
 if(profile?.games?.some(g=>g.week>=nextWeek))errors.push('future_game_leakage');
 if(['OUT','IR','INACTIVE','BYE'].includes(String(availabilityStatus).toUpperCase()))
   errors.push('player_unavailable');
 if(errors.length){result.limitations=unique([...errors,...(profile?.reasons||[])]);return result;}
 const points=profile.games.map(x=>x.points);
 if(points.some(x=>!finite(x))){result.limitations=['invalid_verified_points'];return result;}
 const season=mean(points),last3=mean(points.slice(-3));
 result.seasonAverage=round(season);result.last3Average=round(last3);
 result.formOnly=round(0.35*season+0.65*last3);
 result.volatility=round(stddev(points));
 const allowed=opponentPositionSamples.filter(g=>
   g&&g.provider==='MSF'&&g.finalVerified===true&&validWeek(g.week)&&g.week<nextWeek&&
   finite(g.fflPointsAllowed)&&g.fflPointsAllowed>=0&&
   (!opponent||String(g.opponent||'').toUpperCase()===String(opponent).toUpperCase())
 ).sort((a,b)=>a.week-b.week);
 // Prevent a single high/low opponent game from causing misleading spikes.
 const uniqueAllowed=[...new Map(allowed.map(g=>[String(g.gameId),g])).values()];
 if(uniqueAllowed.length>=4&&finite(leaguePositionalMean)&&leaguePositionalMean>0){
   const ratio=mean(uniqueAllowed.map(x=>x.fflPointsAllowed))/leaguePositionalMean;
   // Shrink historical positional matchup difference halfway toward neutral,
   // and cap single-matchup modifiers to +/-15%.
   result.opponentFactor=Math.max(.85,Math.min(1.15,1+(ratio-1)*.5));
   result.opponentSampleCount=uniqueAllowed.length;
 }else result.limitations.push('opponent_adjustment_unverified_neutral_assumed');
 result.points=round(result.formOnly*result.opponentFactor);
 result.opponentFactor=round(result.opponentFactor);
 result.status='experimental_verified_history_projection';
 result.confidence=profile.games.length>=6&&profile.coverage>=.9?
   'moderate_historical_coverage':'limited_historical_coverage';
 if(String(availabilityStatus).toLowerCase()==='unknown')
   result.limitations.push('player_availability_unverified');
 result.limitations.push('backtest_not_completed');
 return result;
}
