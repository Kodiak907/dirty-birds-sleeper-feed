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
  return {id:String(p.id??x.playerId??''),image: p.officialImageSrc||p.officialImageUrl||p.headshot||p.headshotUrl||p.imageUrl||p.photoUrl||null,name:String(p.fullName||p.displayName||[p.firstName,p.lastName].filter(Boolean).join(' ')||x.name||''),team:String(t.abbreviation||t.abbr||x.teamAbbreviation||'').toUpperCase(),position:String(p.primaryPosition||p.position||x.position||''),game:x.game||null,stats:x.stats||x.playerStats||null,raw:x};
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

/**
 * Only explicit licensed provider status can end an NFL game.
 * A zero Q4 clock is NOT final (review, untimed down and OT are possible).
 */
export function gamePhase(value){
 const v=String(value??'').trim().toLowerCase().replace(/[_-]+/g,' ');
 if(!v)return 'unknown';
 if(/^(final|finished|complete|completed|closed|game over|postgame|post game|ended|official final|final ot|final overtime)(?:\b|$)/.test(v))return 'final';
 if(/^(ot|overtime|in overtime|extra period)(?:\b|$)/.test(v))return 'overtime';
 if(/^(live|in progress|inprogress|started|playing|halftime|half time|half|q[1-4]|quarter [1-4]|1st quarter|2nd quarter|3rd quarter|4th quarter)(?:\b|$)/.test(v))return 'live';
 if(/^(scheduled|not started|notstarted|pre game|pregame|unplayed|future|pending)(?:\b|$)/.test(v))return 'scheduled';
 return 'unknown';
}
export function gameStatusLabel(value){
 const phase=gamePhase(value);
 return phase==='final'?'FINAL':phase==='overtime'?'OT':phase==='live'?'LIVE':phase==='scheduled'?'SCHEDULED':String(value||'STATUS UNVERIFIED').toUpperCase();
}
/** Never regress a verified final to an older game schedule snapshot. */
export function mergeScheduledGame(previous,incoming){
 if(!previous)return incoming;
 const final=gamePhase(previous.status)==='final';
 return {...incoming,
  status:final?previous.status:gamePhase(incoming.status)==='unknown'?previous.status:incoming.status,
  homePoints:final?(previous.homePoints??incoming.homePoints):(incoming.homePoints??previous.homePoints),
  awayPoints:final?(previous.awayPoints??incoming.awayPoints):(incoming.awayPoints??previous.awayPoints),
  scoreSource:final?(previous.scoreSource||incoming.scoreSource):
    (incoming.homePoints!=null&&incoming.awayPoints!=null?'MySportsFeeds schedule':previous.scoreSource)};
}
/** Preserve last published events if MSF briefly truncates/rewrites a play feed.
 * The provider's stable play ID is authoritative for corrections and de-duplication.
 */
export function mergePlayTimeline(previous=[],incoming=[]){
 const key=p=>String(p?.id||[p?.period,p?.clock,p?.text].join('|'));
 const canon=p=>{const {update,...body}=p;return JSON.stringify(body)};
 const dedup=new Map(),old=new Map(previous.map(p=>[key(p),p]));
 for(const p of previous){if(p?.text)dedup.set(key(p),p);}
 for(const p of incoming){
  if(!p?.text)continue;
  const k=key(p),before=old.get(k),changed=before&&canon(before)!==canon(p);
  dedup.set(k,{...p,update:!before?'new':changed?'corrected':'unchanged'});
 }
 const full=incoming.length>=previous.length&&previous.every(p=>incoming.some(n=>key(n)===key(p)));
 const ordered=full?[...new Map(incoming.filter(p=>p?.text).map(p=>[key(p),dedup.get(key(p))])).values()]:
  [...dedup.values()];
 return ordered.slice(-360);
}
export const versionedPlays=mergePlayTimeline;
/** Postgame verification remains at live cadence briefly, then drops to idle. */
export function gamePollInterval({status,finalObservedAt=0,now=Date.now(),kickoff=null,failures=0}={}){
 const phase=gamePhase(status),t=Date.parse(kickoff||'');
 let interval=120000;
 if(phase==='final')interval=finalObservedAt&&now-finalObservedAt<90000?5000:120000;
 else if(phase==='live'||phase==='overtime')interval=5000;
 else if(phase==='unknown'&&Number.isFinite(t)&&now>=t&&now<=t+6*3600000)interval=5000;
 return interval*Math.min(4,2**Math.max(0,Math.min(3,failures)));
}

/** Verified game scoreboard from MSF game_boxscore or games response.
 * This deliberately does not infer scores from offensive yardage/play text.
 * Missing values stay null, not zero. */
export function gameScoreUpdate(game,boxResponse){
 const payload=boxResponse?.data||boxResponse||{};
 const body=payload.gameboxscore||payload.gameBoxscore||payload.boxscore||payload;
 const info=body.game||body.schedule||payload.game||{};
 const score=body.scoring||body.score||body.gameScore||body.scores||
   info.scoring||info.score||payload.scoring||payload.score||{};
 const get=(o,paths)=>{for(const path of paths){
  const v=path.split('.').reduce((a,k)=>a?.[k],o);
  if(v!==null&&v!==undefined&&v!=='')return v;
 }return null;};
 const n=v=>v===null||v===undefined||v===''||typeof v==='object'?null:
  Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=300?Number(v):null;
 const id=String(info.id??info.gameId??body.gameId??'');
 if(id&&String(game?.id||'')&&id!==String(game.id))return {...game};
 const home=n(get(score,['homeScoreTotal','homeScore','homeTotal','home.score','home.scoreTotal','homeTeamScore','homeTeam.score','homeTeam.scoreTotal','homeTeam.totalScore'])??
   get(body,['homeScoreTotal','homeScore','homeTeamScore','homeTeam.score','homeTeam.scoreTotal'])??get(info,['homeScoreTotal','homeScore','homeTeamScore','homeTeam.score']));
 const away=n(get(score,['awayScoreTotal','awayScore','awayTotal','away.score','away.scoreTotal','awayTeamScore','awayTeam.score','awayTeam.scoreTotal','awayTeam.totalScore'])??
   get(body,['awayScoreTotal','awayScore','awayTeamScore','awayTeam.score','awayTeam.scoreTotal'])??get(info,['awayScoreTotal','awayScore','awayTeamScore','awayTeam.score']));
 const state=get(info,['playedStatus','gameStatus','status'])??get(body,['playedStatus','gameStatus','status']);
 return {...game,
  homePoints:home===null?game?.homePoints??null:home,
  awayPoints:away===null?game?.awayPoints??null:away,
  status:state?(gamePhase(game?.status)==='final'&&gamePhase(state)!=='final'?game.status:String(state)):game?.status||'Unverified',
  scoreSource:home!==null||away!==null?'MySportsFeeds game boxscore':game?.scoreSource||null};
}
