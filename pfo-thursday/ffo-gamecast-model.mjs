/** Feed parsing and FFL scoring support. NEVER claim scoring is complete before verifying all fields. */
export const normalizeName=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const num=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
export function resolvePlayer(sleeper,msfRows){
 const n=normalizeName(sleeper.name),tm=String(sleeper.team||'').toUpperCase();
 const matches=msfRows.filter(r=>normalizeName(r.name)===n&&(!tm||String(r.team||'').toUpperCase()===tm));
 return matches.length===1?{player:matches[0],status:'unique_name_team_match'}:{player:null,status:matches.length?'ambiguous_player_identity':'not_mapped'};
}
export function playerRows(payload){
 const rows=payload?.playerStatsTotals||payload?.playerGamelogs||payload?.playerGameLogs||payload?.playerStats||[];
 if(!Array.isArray(rows))return [];
 return rows.map(x=>{
  const p=x.player||x.playerInfo||{},t=x.team||x.teamInfo||{};
  return {id:String(p.id??x.playerId??''),name:String(p.fullName||p.displayName||[p.firstName,p.lastName].filter(Boolean).join(' ')||x.name||''),team:String(t.abbreviation||t.abbr||x.teamAbbreviation||'').toUpperCase(),position:String(p.primaryPosition||p.position||x.position||''),game:x.game||null,stats:x.stats||x.playerStats||null,raw:x};
 }).filter(x=>x.name);
}
export function plays(payload){
 const candidates=[payload?.gameplaybyplay?.plays,payload?.gamePlayByPlay?.plays,payload?.plays,payload?.gameplaybyplay?.gameplays,payload?.gameplaybyplay?.gamePlays,payload?.gamePlayByPlay?.gamePlays];
 const a=candidates.find(Array.isArray)||[];
 return a.map((x,i)=>{
  const state=x?.playStatus||{},q=Number(state.quarter),elapsed=Number(state.secondsElapsed);
  const hasQuarter=Number.isInteger(q)&&q>=1&&q<=5;
  // In MSF NFL v2, playStatus.secondsElapsed is quarter-relative.
  // Do not synthesize a timestamp when the provider sends no usable clock.
  const validElapsed=state.secondsElapsed!==null&&state.secondsElapsed!==undefined&&Number.isFinite(elapsed)&&elapsed>=0&&elapsed<=900;
  const remain=validElapsed?900-elapsed:null;
  const clock=remain===null?String(x.time||x.gameClock||x.clock||''):
    String(Math.floor(remain/60))+':'+String(remain%60).padStart(2,'0');
  return {id:String(x.id||x.playId||'seq-'+i),text:String(x.description||x.playDescription||x.text||''),
   period:hasQuarter?String(q):String(x.quarter||x.period||''),clock,raw:x};
 }).filter(x=>x.text).slice(-360);
}
function first(root,paths){for(const path of paths){let x=root;for(const part of path.split('.'))x=x?.[part];const v=num(x);if(v!==null)return v;}return null;}
const PATHS={
 pass_yd:['passing.passYards','passing.passingYards','passing.yards','passYards','pass_yd'],
 pass_td:['passing.passTD','passing.passTds','passing.passTouchdowns','passTD','pass_td'],
 pass_int:['passing.passInt','passing.interceptions','passInt','pass_int'],
 pass_cmp:['passing.passCompletions','passing.completions','passCompletions','pass_cmp'],
 pass_att:['passing.passAttempts','passing.attempts','passAttempts','pass_att'],
 rush_yd:['rushing.rushYards','rushing.yards','rushYards','rush_yd'],
 rush_td:['rushing.rushTD','rushing.rushTouchdowns','rushTD','rush_td'],
 rush_att:['rushing.rushAttempts','rushing.attempts','rushAttempts','carries'],
 rec:['receiving.receptions','receiving.rec','receptions','rec'],
 rec_yd:['receiving.recYards','receiving.receivingYards','recYards','rec_yd'],
 rec_td:['receiving.recTD','receiving.recTouchdowns','recTD','rec_td'],
 targets:['receiving.targets','receiving.recTargets','targets'],
 fum:['fumbles.fumbles','fumbles.total','fumbles'],
 fum_lost:['fumbles.fumblesLost','fumbles.lost','fumblesLost','fum_lost'],
 fgm:['fieldGoals.fieldGoalsMade','fieldGoals.fgMade','fieldGoals.made','kicking.fieldGoalsMade','fieldGoalsMade','fgm'],
 fga:['fieldGoals.fieldGoalAttempts','fieldGoals.attempts','kicking.fieldGoalsAttempted','fieldGoalAttempts','fga'],
 fgmiss:['fieldGoals.fieldGoalsMissed','fieldGoals.missed','fieldGoalsMissed','fgmiss'],
 xpm:['extraPoints.extraPointsMade','extraPoints.made','kicking.extraPointsMade','extraPointsMade','xpm'],
 xpmiss:['extraPoints.extraPointsMissed','extraPoints.missed','extraPointsMissed','xpmiss'],
 fgm_40_49:['fieldGoals.fieldGoalsMade40To49','kicking.fieldGoalsMade40to49','fgm_40_49'],
 fgm_50p:['fieldGoals.fieldGoalsMade50Plus','kicking.fieldGoalsMade50Plus','fgm_50p'],
 rush_2pt:['rushing.rushTwoPt','rushing.twoPointConversions','rush_2pt'],
 rec_2pt:['receiving.recTwoPt','receiving.twoPointConversions','rec_2pt'],
 pass_2pt:['passing.passTwoPt','passing.twoPointConversions','pass_2pt']
};
export function normalizeStats(source){if(!source||typeof source!=='object')return {};const out={};for(const [k,paths] of Object.entries(PATHS)){const v=first(source,paths);if(v!==null)out[k]=v;}return out;}
/** Compute only rule weights applicable to the player's position; never substitute 0 for absent stats. */
const FILTERS={
 QB:k=>/^(pass_|rush_|fum_|bonus_pass|bonus_rush)/.test(k),
 RB:k=>/^(rush_|rec|rec_|fum_|bonus_rush|bonus_rec)/.test(k),
 WR:k=>/^(rush_|rec|rec_|fum_|bonus_rush|bonus_rec)/.test(k),
 TE:k=>/^(rush_|rec|rec_|fum_|bonus_rush|bonus_rec)/.test(k),
 K:k=>/^(fg|xp|bonus_fg|bonus_xp)/.test(k),
 DEF:k=>/^(def_|dst_|sack|int|fum_rec|pts_allow|yds_allow|blk_kick|safe|td)/.test(k)
};
/**
 * Source coverage is intentionally conservative; a legitimate 0 must be supplied by the source.
 * Scoring bonuses, special teams, and opponent points must be verified from independent NFL/MSF events. Sleeper comparison is optional external validation, never a scoring input.
 */
export function fflScore(raw,settings,position=''){
 if(!raw||!settings||typeof settings!=='object')return {points:null,complete:false,missing:['scoring_rules_or_stats_missing'],covered:[],source:'FFL Scoring Model'};
 const stats=normalizeStats(raw),pos=String(position||'').toUpperCase(),filter=FILTERS[pos]||(()=>true);
 const selected=Object.entries(settings).filter(([key,val])=>filter(key)&&Number.isFinite(Number(val))&&Number(val)!==0);
 if(!selected.length)return {points:null,complete:false,missing:['no_applicable_scoring_categories'],covered:[],source:'FFL Scoring Model'};
 let subtotal=0;const covered=[],missing=[];
 for(const [key,weight] of selected){
  if(!Object.prototype.hasOwnProperty.call(stats,key)) {missing.push(key);continue;}
  covered.push(key);subtotal+=stats[key]*Number(weight);
 }
 // Never equate an incomplete reconstruction to recorded Sleeper points.
 return {points:covered.length?Math.round(subtotal*100)/100:null,complete:covered.length>0&&missing.length===0,missing,covered,source:'FFO provisional unless complete · MySportsFeeds stats × frozen FFO FFL rules',raw_stat_categories:Object.keys(stats),position:pos};
}
export function fflProjection(gameRows,rules,position=''){
 const values=gameRows.map(r=>fflScore(r.stats,rules,position||r.position)).filter(x=>x.points!==null);
 if(!values.length)return {points:null,complete:false,n:0,missing:['no_usable_gamelogs']};
 const season=values.reduce((a,b)=>a+b.points,0)/values.length, recent=values.slice(-3).reduce((a,b)=>a+b.points,0)/Math.min(values.length,3);
 const missing=[...new Set(values.flatMap(x=>x.missing))];
 return {points:Math.round((.65*recent+.35*season)*100)/100,complete:values.every(x=>x.complete),n:values.length,missing,season_average:Math.round(season*100)/100,last3_average:Math.round(recent*100)/100,source:'FFO 65% recent + 35% season baseline; not opponent-adjusted / NOT Sleeper actual points'};
}

export function versionedPlays(prev,next){const canonical=p=>{const {update,...body}=p;return JSON.stringify(body)};const map=new Map(prev.map(p=>[p.id||p.text,canonical(p)]));return next.map(p=>({...p,update:!map.has(p.id||p.text)?'new':map.get(p.id||p.text)!==canonical(p)?'corrected':'unchanged'}));}
/** Kickoff takes precedence over stale "scheduled" labels; terminal status wins. */
export function shouldPollGameLive(game,nowMs=Date.now()){
 const state=String(game?.status||'').toLowerCase();
 if(/final|completed|complete|postponed|cancelled|canceled|suspended|abandoned/.test(state))return false;
 const kickoff=Date.parse(game?.start||'');
 return /in.progress|in progress|live|half.time|halftime|ongoing/.test(state)||
  (Number.isFinite(kickoff)&&nowMs>=kickoff&&nowMs<=kickoff+6*3600000);
}
/** Do not erase a published PBP sequence because a refresh is empty. */
export function retainPublishedPlays(previous,updated){
 if(!Array.isArray(updated)||updated.length===0)return Array.isArray(previous)?previous:[];
 return versionedPlays(Array.isArray(previous)?previous:[],updated);
}
