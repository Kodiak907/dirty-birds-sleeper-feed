/**
 * PFO 6.43 Worker-compatible, pure research replica of the current browser
 * 6.36 source forecast. Not wired to Pages or Accuracy Worker, and NOT yet
 * certified for production/snapshot provenance. All inputs must be from
 * separately authenticated, uniquely mapped MSF data.
 *
 * Keep source-level parity tests against the REAL ffo-pfo-597.js browser code
 * whenever updating the scoring contract, forecast formula or quality flags.
 */
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
export const SERVER_MODEL_CANDIDATE='PFO_643_BROWSER_636_SOURCE_PARITY_CANDIDATE';
export const BROWSER_SUPPORTED_FFL_STATS=Object.freeze([
 'pass_yd','pass_td','pass_int','pass_int_td','rush_yd','rush_td','rush_att',
 'rush_40p','rush_td_40p','rush_td_50p','rec','rec_yd','rec_td',
 'rec_td_40p','rec_td_50p','pass_td_40p','pass_td_50p','pass_cmp_40p',
 'rec_30_39','rec_40p','fum_lost','fum','rush_2pt','rec_2pt','pass_2pt',
 'pass_cmp','pass_att','fgm','fgm_0_19','fgm_20_29','fgm_30_39',
 'fgm_40_49','fgm_50_59','fgm_60p','fgmiss','xpm','xpmiss','sack',
 'int','def_td','ff','fum_rec','safe','blk_kick','def_st_ff',
 'def_st_fum_rec','def_st_td','def_2pt','def_3_and_out','st_ff',
 'st_fum_rec','st_td','pts_allow_0','pts_allow_1_6','pts_allow_7_13',
 'pts_allow_14_20','pts_allow_21_27','pts_allow_28_34','pts_allow_35p'
]);
const FG=['fgm_0_19','fgm_20_29','fgm_30_39','fgm_40_49','fgm_50_59','fgm_60p'];
const has=(obj,key)=>obj?.[key]!==null&&obj?.[key]!==undefined&&
 obj?.[key]!==''&&Number.isFinite(Number(obj[key]));
const validRules=rules=>rules?.schema==='FFO_SCORING_RULES_V1'&&
 rules?.league==='FFL'&&rules?.season===2026&&
 rules?.version===FFL_RULES_VERSION&&rules?.scoring&&
 rules.scoring.fgm===0&&rules.scoring.def_3_and_out===0&&
 rules.scoring.def_4_and_stop===0;
const pos=p=>String(p||'').toUpperCase().replace(/^D\/?ST$/,'DEF');
const canon=s=>String(s||'').toUpperCase();
export function scoreFrozenBrowserStats643(stats,rules){
 if(!stats||!validRules(rules))return null;
 let points=0,observed=0;
 const buckets=FG.map(k=>stats[k]).filter(x=>x!==null&&x!==undefined&&
  x!==''&&Number.isFinite(Number(x))&&Number(x)>=0);
 const made=has(stats,'fgm')&&Number(stats.fgm)>=0;
 const impliedFG=made?Number(stats.fgm):buckets.length?
  buckets.reduce((sum,n)=>sum+Number(n),0):null;
 for(const stat of BROWSER_SUPPORTED_FFL_STATS){
  const multiplier=Number(rules.scoring[stat]||0);
  if(!Number.isFinite(multiplier)||multiplier===0)continue;
  const raw=stat==='fgm'?impliedFG:stats[stat];
  if(raw===null||raw===undefined||raw==='')continue;
  const count=Number(raw);
  if(!Number.isFinite(count))continue;
  points+=multiplier*count;observed++;
 }
 return observed?{points,partial:true,
  source:'FFL 2026-11-05 full-video restored scoring × independent MSF stats · missing FG distance or bonus evidence stays partial'}:null;
}
export function auditBrowserStatCoverage643(stats,position,rules){
 if(!validRules(rules))return null;
 const p=pos(position),observed=stats&&typeof stats==='object'?stats:{};
 const missing=[];
 const base={QB:['pass_yd','pass_td','pass_int','fum_lost'],
  RB:['rush_yd','rush_td','rec','rec_yd','fum_lost'],
  WR:['rec','rec_yd','rec_td','fum_lost'],
  TE:['rec','rec_yd','rec_td','fum_lost'],
  K:['xpm','xpmiss','fgmiss'],DEF:['sack','int','fum_rec','def_td']};
 for(const key of base[p]||[])
  if(Number(rules.scoring[key]||0)!==0&&!has(observed,key))missing.push(key);
 const longTds={QB:['pass_td','pass_td_40p','pass_td_50p'],
  RB:['rush_td','rush_td_40p','rush_td_50p'],
  WR:['rec_td','rec_td_40p','rec_td_50p'],
  TE:['rec_td','rec_td_40p','rec_td_50p']};
 const td=longTds[p];
 if(td&&has(observed,td[0])&&Number(observed[td[0]])>0&&
  (!has(observed,td[1])||!has(observed,td[2])))
  missing.push('long_touchdown_distance_evidence');
 if(p==='K'){
  const represented=FG.reduce((n,key)=>n+(has(observed,key)?Number(observed[key]):0),0);
  if(!has(observed,'fgm'))missing.push('made_field_goal_count_unverified');
  else if(Number(observed.fgm)>represented+1e-6)missing.push('field_goal_distance_buckets_incomplete');
  else if(represented>Number(observed.fgm)+1e-6)missing.push('field_goal_bucket_total_conflict');
  if(!FG.every(key=>has(observed,key)))missing.push('full_field_goal_distance_distribution_unverified');
 }
 if(p==='DEF'){
  const bands=['pts_allow_0','pts_allow_1_6','pts_allow_7_13',
   'pts_allow_14_20','pts_allow_21_27','pts_allow_28_34','pts_allow_35p'];
  if(!bands.some(key=>has(observed,key)))missing.push('defense_points_allowed_tier_unverified');
 }
 if(!Object.keys(observed).length)missing.push('independent_stat_forecast_missing');
 return {rulesVersion:FFL_RULES_VERSION,partial:true,certified:false,
  scoringEvidenceComplete:false,missingEvidence:[...new Set(missing)],
  sourceCategoriesObserved:Object.keys(observed).filter(key=>has(observed,key)).length};
}
export function forecastBrowserSourceCandidate643({
 player,row,rules,uniqueMSFIdentityVerified=false
}={}){
 if(!validRules(rules)||uniqueMSFIdentityVerified!==true||
  !player?.name||!player?.team||!row||
  canon(row.team)!==canon(player.team)||
  !['QB','RB','WR','TE','K','DEF'].includes(pos(player.position)))return null;
 const score=stats=>scoreFrozenBrowserStats643(stats,rules)?.points??null;
 const quality=(stats,points,source)=>({
  points,source,...auditBrowserStatCoverage643(stats,player.position,rules),
  modelCandidate:SERVER_MODEL_CANDIDATE,verifiedServerParity:false
 });
 // The original browser pfo50Estimate() uses row.forecast if present.
 const native=row.forecast?score(row.forecast):null;
 if(native!==null&&Number.isFinite(native))
  return quality(row.forecast||row.season_totals||null,native,
   'FFO independent NFL-stat forecast under restored FFL scoring · provisional');
 if(row.forecast){
  const pts=score(row.forecast);
  if(pts!==null&&Number.isFinite(pts))
   return quality(row.forecast,pts,'FFO NFL-stat model · verified same-team player mapping');
 }
 const games=(row.games||[]).filter(x=>Number.isFinite(Number(x.week)))
  .sort((a,b)=>Number(a.week)-Number(b.week));
 const scores=games.map(g=>score(g.stats||g))
  .filter(v=>v!==null&&Number.isFinite(v));
 const seasonTotal=row.season_totals?score(row.season_totals):null;
 const played=Number(row.games_played||row.season_totals?.games_played||
  row.season_totals?.games||scores.length||0);
 const seasonMean=seasonTotal!==null&&Number.isFinite(played)&&played>0?
  seasonTotal/played:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null;
 if(seasonMean===null)return null;
 if(scores.length>=2){
  const recent=scores.slice(-3),last=recent.reduce((a,b)=>a+b,0)/recent.length;
  return quality(row.forecast||row.season_totals||null,0.65*last+0.35*seasonMean,
   'FFO independently reconstructed FFL points · 65% last 3 / 35% season · no unsupported injury adjustment');
 }
 if(played>=2)return quality(row.forecast||row.season_totals||null,seasonMean,
  'FFO independent NFL-season stats / verified games played · low-confidence average');
 return null;
}


/**
 * Replicates the distinct PFO 6.16 D/ST override, which takes priority over
 * pfo50Estimate for an upcoming game. The generic six-position parity tests
 * alone are insufficient to establish ACTUALLY DISPLAYED D/ST parity.
 * Caller must independently check exact team/provider identity and game week.
 */
export function forecastBrowserDefenseOverlay643({
 row,weekFixture,rules,uniqueMSFIdentityVerified=false
}={}){
 if(!validRules(rules)||uniqueMSFIdentityVerified!==true||
  !weekFixture||weekFixture.provider!=='MSF'||weekFixture.verified!==true||
  weekFixture.bye===true||!weekFixture.opponent||!row?.forecast||
  Number(row.games_observed)<2)return null;
 const pa=Number(row?.coverage?.points_allowed_games||0);
 const defense=Number(row?.coverage?.defensive_stat_games||0);
 if(!pa&&!defense)return null;
 const scored=scoreFrozenBrowserStats643(row.forecast,rules);
 if(typeof scored?.points!=='number'||!Number.isFinite(scored.points))return null;
 return {points:Math.round(scored.points*100)/100,source:
  'MySportsFeeds '+(row.schema==='FFO_MSF_DEFENSE_SEASON_V1'?
   'team season totals':'verified team gamelogs')+
  ' · '+row.games_observed+' observed games · '+
  (pa?'PA scoring bands included':'PA tiers unavailable')+
  ' · FFO frozen D/ST scoring · partial model',
  partial:true,certified:false,coverage:row.coverage,
  model:'PFO_616_MSF_TEAM_DEFENSE_V1',
  modelCandidate:SERVER_MODEL_CANDIDATE,verifiedServerParity:false};
}
