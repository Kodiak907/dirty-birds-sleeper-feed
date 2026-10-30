/** Feed parsing and FFL scoring support. NEVER claim scoring is complete before verifying all fields. */
export const normalizeName=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const num=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
export function resolvePlayer(sleeper,msfRows){
 const n=normalizeName(sleeper.name),tm=String(sleeper.team||'').toUpperCase();
 const matches=msfRows.filter(r=>normalizeName(r.name)===n&&(!tm||String(r.team||'').toUpperCase()===tm));
 return matches.length===1?{player:matches[0],status:'unique_name_team_match'}:{player:null,status:matches.length?'ambiguous_player_identity':'not_mapped'};
}
export function playerRows(payload){
 const candidates=[
 ['playerStatsTotals',payload?.playerStatsTotals],
 ['playerGamelogs',payload?.playerGamelogs],
 ['playerGameLogs',payload?.playerGameLogs],
 ['gamelogs',payload?.gamelogs],
 ['playerStats',payload?.playerStats],
 ['players',payload?.players]
 ];
 const found=candidates.find(([name,rows])=>Array.isArray(rows))||[null,[]];
 const rows=found[1];
 return rows.map(x=>{
  const p=x.player||x.playerInfo||{},t=x.team||x.teamInfo||{};
  const pos=p.primaryPosition||p.position||x.position||'';
  const id=p.id??x.playerId??'';
  return {id:id===null||id===undefined?'':String(id),
   image:p.officialImageSrc||p.officialImageUrl||p.headshot||p.headshotUrl||p.imageUrl||p.photoUrl||null,
   name:String(p.fullName||p.displayName||[p.firstName,p.lastName].filter(Boolean).join(' ')||x.name||''),
   team:String(t.abbreviation||t.abbr||x.teamAbbreviation||'').toUpperCase(),
   position:String(typeof pos==='object'?(pos.abbreviation||pos.name||''):pos).toUpperCase(),
   jersey:String(p.jerseyNumber??p.jersey??x.jerseyNumber??''),
   game:x.game||null,stats:x.stats||x.playerStats||null,raw:x};
 }).filter(x=>x.name);
}
export function playerFeedShape(payload){
 for(const key of ['playerStatsTotals','playerGamelogs','playerGameLogs','gamelogs','playerStats','players']){
  if(Array.isArray(payload?.[key]))return {collection:key,rawCount:payload[key].length};
 }
 return {collection:'unrecognized',rawCount:null};
}
/** One raw MSF NFL game play record per item. Other-provider scoring fallbacks
 * are never treated as licensed full play-by-play. */
export function sourcePlayRows(payload){
 const candidates=[payload?.gameplaybyplay?.plays,payload?.gamePlayByPlay?.plays,payload?.plays,payload?.gameplaybyplay?.gameplays,payload?.gameplaybyplay?.gamePlays,payload?.gamePlayByPlay?.gamePlays];
 return candidates.find(Array.isArray)||[];
}
const playSourceId=x=>{
 const v=x?.id??x?.playId??x?.eventId;
 return v===null||v===undefined||v===''?null:String(v);
};
const playClock=x=>{
 const st=x?.playStatus||{},q=Number(st.quarter??x.quarter??x.period);
 const hasQuarter=Number.isInteger(q)&&q>=1&&q<=7;
 const period=hasQuarter?String(q):'';
 const explicit=String(x.time||x.gameClock||x.clock||'').trim();
 const match=explicit.match(/^(\d{1,2}):([0-5]\d)$/);
 const fromText=String(x.description||x.playDescription||x.text||'').match(/^\s*\((\d{1,2}):([0-5]\d)\)/);
 const elapsed=Number(st.secondsElapsed);
 // MSF secondsElapsed is 15-minute regulation-quarter-relative. NFL regular
 // season overtime can be 10 minutes; never calculate a fake 15-minute OT
 // clock from elapsed without provider period duration.
 const valid=st.secondsElapsed!==null&&st.secondsElapsed!==undefined&&
   Number.isFinite(elapsed)&&elapsed>=0&&elapsed<=900;
 const remain=valid&&q>=1&&q<=4?900-elapsed:null;
 const derived=remain===null?'':Math.floor(remain/60)+':'+String(remain%60).padStart(2,'0');
 return {period,clock:match?explicit:fromText?fromText[1]+':'+fromText[2]:derived,
  source:match?'provider_clock':fromText?'published_description':derived?'regulation_elapsed':'unknown'};
};
// Deterministic, non-cryptographic fingerprint for identity fallback only;
// do not represent this as an actual MSF play identifier.
const playFingerprint=text=>{
 let h=2166136261;
 for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
 return (h>>>0).toString(36);
};
export function plays(payload){
 const raw=sourcePlayRows(payload);
 const nativeCounts=new Map();
 for(const x of raw){
  const id=playSourceId(x);
  if(id!==null)nativeCounts.set(id,(nativeCounts.get(id)||0)+1);
 }
 const seen=new Map();
 return raw.map((x,i)=>{
  const {period,clock}=playClock(x);
  const text=String(x.description||x.playDescription||x.text||'');
  const native=playSourceId(x),repeated=native!==null&&nativeCounts.get(native)>1;
  // If the provider recycles a play ID, scope it to quarter and clock.
  // For records without native IDs, use a fingerprint of the actual play,
  // not an array index which may shift when MSF truncates its feed.
  const base=native!==null?
   (repeated?'msf:'+native+':q'+period+':'+clock:'msf:'+native):
   'observed:q'+period+':'+clock+':'+playFingerprint(text);
  const occurrence=(seen.get(base)||0)+1;seen.set(base,occurrence);
  const id=base+(occurrence>1?':occ'+occurrence:'');
  return {id,text,period,clock,raw:x,providerId:native,
   identitySource:native===null?'derived_from_published_play':repeated?'scoped_repeated_provider_id':'provider_id'};
 }).filter(x=>x.text).slice(-360);
}
/** Audit diagnostics never confuse absent provider IDs with actual duplicates.
 * 360 recent plays can be displayed without claiming an entire-game archive. */
export function diagnosePlayFeed(payload,metadata={}){
 const raw=sourcePlayRows(payload);
 const available=raw.filter(x=>String(x?.description||x?.playDescription||x?.text||''));
 const normalized=plays(payload);
 const nativeIds=available.map(playSourceId).filter(x=>x!==null);
 const seen=new Set();
 let repeatedNative=0;
 for(const id of nativeIds){if(seen.has(id))repeatedNative++;else seen.add(id);}
 const resolved=new Set(normalized.map(p=>p.id));
 const quarters=[...new Set(normalized.map(p=>p.period).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
 const withClock=normalized.filter(p=>p.clock).length;
 const withoutNative=available.length-nativeIds.length;
 const scoringOnly=metadata.coverage==='scoring_only'||metadata.full_playbyplay_authorized===false;
 const supported=available.length>0&&!scoringOnly;
 return {rawCount:raw.length,describedCount:available.length,displayedCount:normalized.length,
  capped:available.length>normalized.length,providerIdCount:nativeIds.length,
  missingProviderIds:withoutNative,repeatedProviderIds:repeatedNative,
  duplicateResolvedIds:normalized.length-resolved.size,
  quarters,withClock,missingClock:normalized.length-withClock,
  source:metadata.source||'MySportsFeeds',coverage:metadata.coverage||'unspecified',
  providerHttpStatus:metadata.provider_http_status??null,
  scoringOnly,hasPublishedPlays:supported,
  limitedIdentity:withoutNative>0||repeatedNative>0,
  // Provider success + parseable plays is evidence of historical access,
  // never automatic proof of complete PBP or every game's entitlement.
  fullGameVerified:false};
}


/**
 * Read-only historical QA. Checks source order, regulation vs OT clock
 * provenance, and independent MSF final box-score evidence. No fabricated
 * event totals, no claim that one sample certifies full-game coverage.
 */
export function inspectHistoricalGame(playResponse,boxResponse=null,scheduleGame={}){
 const payload=playResponse?.data||playResponse||{};
 const raw=sourcePlayRows(payload).filter(x=>String(x?.description||x?.playDescription||x?.text||''));
 const diagnostics=diagnosePlayFeed(payload,playResponse||{});
 const entries=raw.map((x,i)=>{
  const clock=playClock(x),q=Number(clock.period),elapsed=num(x?.playStatus?.secondsElapsed);
  return {index:i,quarter:Number.isInteger(q)&&q>=1&&q<=7?q:null,
   elapsed:elapsed!==null&&elapsed>=0&&elapsed<=900?elapsed:null,
   clock:clock.clock,clockSource:clock.source,
   description:String(x?.description||x?.playDescription||x?.text||'')};
 });
 let forwardViolations=0,reverseViolations=0,comparablePairs=0;
 for(let i=1;i<entries.length;i++){
  const a=entries[i-1],b=entries[i];
  if(a.quarter===null||b.quarter===null)continue;
  if(a.quarter===b.quarter&&(a.elapsed===null||b.elapsed===null))continue;
  comparablePairs++;
  if(b.quarter<a.quarter||(b.quarter===a.quarter&&b.elapsed<a.elapsed))forwardViolations++;
  if(b.quarter>a.quarter||(b.quarter===a.quarter&&b.elapsed>a.elapsed))reverseViolations++;
 }
 const chronologicalOrder=!comparablePairs?'unknown':
  forwardViolations===0?'forward':
  reverseViolations===0?'reverse':'mixed';
 const ordered=chronologicalOrder==='reverse'?[...entries].reverse():entries;
 const first=ordered[0]||null,last=ordered[ordered.length-1]||null;
 const lastQ=last?.quarter||null;
 const ot=entries.filter(x=>x.quarter!==null&&x.quarter>4);
 const otClockUnknown=ot.filter(x=>!x.clock).length;
 const missingClocks=entries.filter(x=>!x.clock);
 const regulationClockUnknown=missingClocks.filter(x=>x.quarter===null||x.quarter<=4).length;
 const clockCoverage=missingClocks.length===0?'all_verified':regulationClockUnknown===0&&otClockUnknown===missingClocks.length?'ot_exception':'incomplete';
 const checkGame={id:scheduleGame.id??'',status:'Unverified',homePoints:null,awayPoints:null};
 const scored=boxResponse&&boxResponse.available!==false?
  gameScoreUpdate(checkGame,boxResponse):checkGame;
 const boxScorePublished=scored.scoreSource==='MySportsFeeds game boxscore'&&
  scored.homePoints!==null&&scored.awayPoints!==null;
 const scheduleHome=num(scheduleGame.homePoints),scheduleAway=num(scheduleGame.awayPoints);
 const matchesSchedule=boxScorePublished&&scheduleHome!==null&&scheduleAway!==null?
  scored.homePoints===scheduleHome&&scored.awayPoints===scheduleAway:null;
 const providerFinal=gamePhase(scored.status)==='final';
 const scheduledFinal=gamePhase(scheduleGame.status)==='final';
 const warnings=[];
 if(diagnostics.scoringOnly)warnings.push('Scoring-only fallback, not full PBP');
 if(diagnostics.capped)warnings.push('Visible timeline capped at 360 plays');
 if(chronologicalOrder==='mixed')warnings.push('Published play chronology is inconsistent');
 if(chronologicalOrder==='unknown')warnings.push('Insufficient native clock/order evidence');
 if(regulationClockUnknown)warnings.push(regulationClockUnknown+' regulation/unknown-period plays lack a verifiable clock');
 if(otClockUnknown)warnings.push(otClockUnknown+' overtime play'+(otClockUnknown===1?'':'s')+' lack'+(otClockUnknown===1?'s':'')+' a verifiable clock');
 if(!boxScorePublished)warnings.push('Independent MSF final box-score values unavailable');
 if(matchesSchedule===false)warnings.push('MSF box score differs from MSF schedule');
 if(!providerFinal&&!scheduledFinal)warnings.push('Final status not verified');
 const boxData=boxResponse?.data||boxResponse||{};
 const body=boxData.gameboxscore||boxData.gameBoxscore||boxData.boxscore||boxData;
 const score=body.scoring||body.score||body.gameScore||{};
 const quarters=Array.isArray(score.quarters)?score.quarters:[];
 const val=(o,names)=>{for(const n of names){const x=num(o?.[n]);if(x!==null)return x}return null};
 let quarterScoreMatches=null;
 if(quarters.length&&boxScorePublished){
  const qScores=quarters.map(q=>({
   home:val(q,['homeScore','homeScoreTotal','homePoints']),
   away:val(q,['awayScore','awayScoreTotal','awayPoints'])
  }));
  if(qScores.every(q=>q.home!==null&&q.away!==null)){
   const home=qScores.reduce((sum,q)=>sum+q.home,0),away=qScores.reduce((sum,q)=>sum+q.away,0);
   quarterScoreMatches=home===scored.homePoints&&away===scored.awayPoints;
   if(!quarterScoreMatches)warnings.push('Box-score period totals disagree with final');
  }
 }
 return {diagnostics,chronologicalOrder,comparablePairs,forwardViolations,reverseViolations,
  first:{quarter:first?.quarter??null,clock:first?.clock||null,description:first?.description||null},
  last:{quarter:last?.quarter??null,clock:last?.clock||null,description:last?.description||null},
  lastQuarter:lastQ,otPlayCount:ot.length,otClockUnknown,regulationClockUnknown,clockCoverage,
  boxScorePublished,boxHome:boxScorePublished?scored.homePoints:null,
  boxAway:boxScorePublished?scored.awayPoints:null,
  boxStatus:scored.status,providerFinal,scheduledFinal,
  matchesSchedule,quarterScoreMatches,warnings,
  // Evidence tier only. Never certify full history from a six-game sample.
  usablePlaySequence:diagnostics.hasPublishedPlays&&
   diagnostics.duplicateResolvedIds===0&&
   chronologicalOrder!=='mixed',
  fullGameCertified:false};
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
 // Only explicit MSF distance band fields qualify; do not infer 50–59 from 50+.
 fgm_0_19:['fieldGoals.fieldGoalsMade0To19','fieldGoals.fieldGoalsMade1To19','fgm_0_19'],
 fgm_20_29:['fieldGoals.fieldGoalsMade20To29','fieldGoals.fieldGoalsMade20to29','fgm_20_29'],
 fgm_30_39:['fieldGoals.fieldGoalsMade30To39','fieldGoals.fieldGoalsMade30to39','fgm_30_39'],
 fgm_40_49:['fieldGoals.fieldGoalsMade40To49','kicking.fieldGoalsMade40to49','fgm_40_49'],
 fgm_50_59:['fieldGoals.fieldGoalsMade50To59','fieldGoals.fieldGoalsMade50to59','fgm_50_59'],
 fgm_60p:['fieldGoals.fieldGoalsMade60Plus','fieldGoals.fieldGoalsMade60p','fgm_60p'],
 fgm_50p:['fieldGoals.fieldGoalsMade50Plus','kicking.fieldGoalsMade50Plus','fgm_50p'],
 rush_2pt:['rushing.rushTwoPt','rushing.twoPointConversions','rush_2pt'],
 rec_2pt:['receiving.recTwoPt','receiving.twoPointConversions','rec_2pt'],
 pass_2pt:['passing.passTwoPt','passing.twoPointConversions','pass_2pt']
};
export function normalizeStats(source){if(!source||typeof source!=='object')return {};const out={};for(const [k,paths] of Object.entries(PATHS)){const v=first(source,paths);if(v!==null)out[k]=v;}return out;}
/** Compute only rule weights applicable to the player's position; never substitute 0 for absent stats. */
const FILTERS={
 QB:k=>/^(pass_|rush_|rec|rec_|fum_|bonus_pass|bonus_rush|bonus_rec)/.test(k),
 RB:k=>/^(pass_|rush_|rec|rec_|fum_|bonus_pass|bonus_rush|bonus_rec)/.test(k),
 WR:k=>/^(pass_|rush_|rec|rec_|fum_|bonus_pass|bonus_rush|bonus_rec)/.test(k),
 TE:k=>/^(pass_|rush_|rec|rec_|fum_|bonus_pass|bonus_rush|bonus_rec)/.test(k),
 K:k=>/^(fg|xp|bonus_fg|bonus_xp)/.test(k),
 DEF:k=>/^(def_|dst_|sack|int|fum_rec|pts_allow|yds_allow|blk_kick|safe|td)/.test(k)
};
const CORE_SCORING_GROUPS={
 QB:['pass_yd','pass_td','pass_int','rush_yd','rush_td','fum_lost'],
 RB:['rush_yd','rush_td','rec','rec_yd','rec_td','fum_lost'],
 WR:['rec','rec_yd','rec_td','rush_yd','rush_td','fum_lost'],
 TE:['rec','rec_yd','rec_td','fum_lost'],
 K:['fgm_0_19','fgm_20_29','fgm_30_39','fgm_40_49','fgm_50_59','fgm_60p','fgmiss','xpm','xpmiss'],
 DEF:['pts_allow_0','pts_allow_1_6','pts_allow_7_13','pts_allow_14_20','pts_allow_21_27','pts_allow_28_34','pts_allow_35p','sack','int','def_td','fum_rec','safe','blk_kick']
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
 let subtotal=0;const covered=[],missing=[],components=[];
 for(const [key,weight] of selected){
  if(!Object.prototype.hasOwnProperty.call(stats,key)) {missing.push(key);continue;}
  covered.push(key);const contribution=stats[key]*Number(weight);subtotal+=contribution;components.push({key,stat:stats[key],weight:Number(weight),points:Math.round(contribution*100)/100});
 }
 // Never equate an incomplete reconstruction to recorded Sleeper points.
 return {points:covered.length?Math.round(subtotal*100)/100:null,complete:covered.length>0&&missing.length===0,missing,covered,components,source:'FFO provisional unless complete · MySportsFeeds stats × frozen FFO FFL rules',raw_stat_categories:Object.keys(stats),position:pos};
}
export function fflProjection(gameRows,rules,position=''){
 const values=gameRows.map(r=>fflScore(r.stats,rules,position||r.position)).filter(x=>x.points!==null);
 if(!values.length)return {points:null,complete:false,n:0,missing:['no_usable_gamelogs']};
 const season=values.reduce((a,b)=>a+b.points,0)/values.length, recent=values.slice(-3).reduce((a,b)=>a+b.points,0)/Math.min(values.length,3);
 const missing=[...new Set(values.flatMap(x=>x.missing))];
 return {points:Math.round((.65*recent+.35*season)*100)/100,complete:values.every(x=>x.complete),n:values.length,missing,season_average:Math.round(season*100)/100,last3_average:Math.round(recent*100)/100,source:'FFO 65% recent + 35% season baseline; not opponent-adjusted / NOT Sleeper actual points'};
}



/** Independently observed player-stat scoring components; never full FFL certification. */
/**
 * Return *field names only* from provider stat objects. This is schema
 * discovery, NOT a claim that an unknown field maps to FFL scoring.
 * Private GameCast only; do not serialize any raw player values.
 */
export function statFieldPaths(source,{maxDepth=4,limit=48}={}){
 const out=[],walk=(node,prefix,depth)=>{
  if(!node||typeof node!=='object'||Array.isArray(node)||depth>maxDepth)return;
  for(const [key,value] of Object.entries(node)){
   if(out.length>=limit)return;
   if(!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(key))continue;
   const path=prefix?prefix+'.'+key:key;
   if(value!==null&&typeof value==='object')walk(value,path,depth+1);
   else if((typeof value==='number'&&Number.isFinite(value))||
     (typeof value==='string'&&value.length<24&&value.trim()!==''&&Number.isFinite(Number(value))))
    out.push(path);
  }
 };
 walk(source,'',0);
 return [...new Set(out)].slice(0,limit);
}
/** A D/ST is a team, not a player. Verify access to team gamelogs separately. */
export function auditTeamGameFeed(payload,team='',rules={}){
 const candidates=[
  ['teamgamelogs',payload?.teamgamelogs],
  ['teamGameLogs',payload?.teamGameLogs],
  ['teamGamelogs',payload?.teamGamelogs],
  ['gamelogs',payload?.gamelogs],
  ['teamStats',payload?.teamStats]
 ];
 const [collection,rows]=candidates.find(x=>Array.isArray(x[1]))||['unrecognized',[]];
 const wanted=String(team||'').toUpperCase();
 const components=[
  {key:'sack',label:'Defensive sacks',paths:['tackles.sacks','defense.sacks']},
  {key:'int',label:'Defensive interceptions',paths:['interceptions.interceptions','defense.interceptions']}
 ];
 const records=rows.map(x=>{
  const o=x.team||x.teamInfo||{},abbr=String(o.abbreviation||o.abbr||x.teamAbbreviation||'').toUpperCase();
  const stats=x.stats||x.teamStats||{};
  const all=statFieldPaths(stats,{limit:120});
  const defensivelyRelevant=all.filter(k=>/^(tackles|interceptions|fumbles|kickoffReturns|puntReturns|defense)\./i.test(k));
  const published=components.map(c=>{
   const value=first(stats,c.paths);
   return {category:c.key,label:c.label,value,weight:Number(rules[c.key]||0),
    points:value!==null?Math.round(value*Number(rules[c.key]||0)*100)/100:null};
  });
  return {team:abbr,gameId:String(x.game?.id??x.game?.gameId??''),
   published,defensiveFieldPaths:defensivelyRelevant.slice(0,24),
   hasNumericFields:all.length>0};
 });
 const teamFilterVerified=records.length>0&&records.every(x=>x.team===wanted);
 const known=teamFilterVerified?records.flatMap(x=>x.published).filter(x=>x.value!==null):[];
 const missing=components.filter(c=>!known.some(x=>x.category===c.key)).map(x=>x.label);
 return {collection,rawCount:rows.length,team:wanted,teamFilterVerified,
  records:records.length,numericRecords:records.filter(x=>x.hasNumericFields).length,
  exampleFieldPaths:[...new Set(records.flatMap(x=>x.defensiveFieldPaths))].slice(0,24),
  observedComponents:teamFilterVerified?records.flatMap(x=>x.published):[],
  knownComponentCount:known.length,missingComponents:missing,
  // Final opponent points do not equal D/ST points allowed when there are
  // defensive, return, or other non-offensive touchdowns.
  dstScoreCertified:false};
}
/** PBP evidence for specialist *candidate* plays, not game-complete FG scoring.
 * Do not infer player credit or successful kicks from unsupported text. */
export function kickingPlayEvidence(payload,rules={},msfPlayers=[]){
 const events=sourcePlayRows(payload).map((x,i)=>{
  const description=String(x?.description||x?.playDescription||x?.text||'').trim();
  if(!description)return null;
  const fg=/\bfield[\s-]?goal\b|\bFG (?:attempt|kick|is good|is no good)\b/i.test(description);
  const xp=/\bextra[\s-]?point\b|\bPAT (?:attempt|kick|is good|is no good)\b/i.test(description);
  if(!fg&&!xp)return null;
  // PBP mentions blocked kicks or attempts in many spellings. Keep status
  // tentative unless an unambiguous phrase actually appears in the play.
  const made=/\b(?:is good|was good|good!|kick good|successful|made)\b/i.test(description);
  const failed=/\b(?:no good|missed|blocked|wide (?:left|right)|unsuccessful)\b/i.test(description);
  const distance=fg?(description.match(/\b(\d{1,2})[\s-]?yard(?:s)?\s+(?:field[\s-]?goal|FG)\b/i)||
   description.match(/\b(?:field[\s-]?goal|FG)\s+(?:attempt\s+)?(?:of\s+|from\s+)?(\d{1,2})[\s-]?yards?\b/i))?.[1]:null;
  const quarter=Number(x?.playStatus?.quarter??x?.quarter);
  return {index:i,kind:fg?'FG':'XP',quarter:Number.isInteger(quarter)?quarter:null,
   distance:distance!==undefined&&distance!==null?Number(distance):null,
   publishedOutcome:made!==failed?(made?'reported_good':'reported_missed'):'unverified',
   description:description.slice(0,180)};
 }).filter(Boolean);
 const source=sourcePlayRows(payload),seen=new Set();
 const unique=events.filter(ev=>{
  const p=source[ev.index],id=p?.id??p?.playId??null;
  if(id==null)return true;
  const key=[id,ev.quarter,ev.description].join('|');
  if(seen.has(key))return false;
  seen.add(key);return true;
 });
 const scored=unique.map(ev=>{
  // Use the leading kicker in each play, never the center/holder later in text.
  const m=ev.description.match(/^\s*(?:\(?\d{1,2}:\d{2}\)?\s*)?(\d{1,2})-([A-Za-z])\.([A-Za-z][A-Za-z'-]+)(?=\s|$)/);
  const kickerToken=m?m[1]+'-'+m[2].toUpperCase()+'.'+m[3]:null;
  let component=null;
  if(ev.publishedOutcome==='reported_missed')component=ev.kind==='FG'?'fgmiss':'xpmiss';
  else if(ev.publishedOutcome==='reported_good'&&ev.kind==='XP')component='xpm';
  else if(ev.publishedOutcome==='reported_good'&&ev.kind==='FG'&&Number.isInteger(ev.distance))
   component='fgm_'+(ev.distance<20?'0_19':ev.distance<30?'20_29':ev.distance<40?'30_39':ev.distance<50?'40_49':ev.distance<60?'50_59':'60p');
  const observedEventPoints=component&&Number.isFinite(Number(rules[component]))?Number(rules[component]):null;
  return {...ev,kickerToken,component,observedEventPoints};
 });
 const actors=new Map();
 for(const ev of scored)if(ev.kickerToken){
  if(!actors.has(ev.kickerToken))actors.set(ev.kickerToken,[]);
  actors.get(ev.kickerToken).push(ev);
 }
 const kickers=[...actors].map(([token,actorEvents])=>{
  const m=token.match(/^(\d{1,2})-([A-Z])\.([A-Za-z][A-Za-z'-]+)$/),matched=new Map();
  if(m)for(const p of (Array.isArray(msfPlayers)?msfPlayers:[])){
   if(String(p.position||'').toUpperCase()!=='K'||!p.team||!p.id||
      String(p.jersey??p.jerseyNumber??'')!==m[1])continue;
   const name=normalizeName(p.name||'').split(' ');
   if(name.length>=2&&name[0][0]===m[2].toLowerCase()&&name.at(-1)===normalizeName(m[3]))
    matched.set(String(p.id),p);
  }
  const player=matched.size===1?[...matched.values()][0]:null;
  const known=actorEvents.filter(x=>x.observedEventPoints!==null);
  return {kickerToken:token,playerName:player?.name||null,playerTeam:player?.team||null,
   providerId:player?.id||null,identityVerified:!!player,events:actorEvents.length,
   unknownEvents:actorEvents.length-known.length,
   observedSubtotal:known.length?Math.round(known.reduce((sum,x)=>sum+x.observedEventPoints,0)*100)/100:null,
   certified:false};
 });
 return {candidatePlays:unique.length,fgCandidates:unique.filter(x=>x.kind==='FG').length,
  xpCandidates:unique.filter(x=>x.kind==='XP').length,
  unattributedEvents:scored.filter(x=>!x.kickerToken).length,kickers,
  publishedEvents:scored.slice(0,18),kickingFantasyScoreCertified:false,
  note:'PBP kicker labels and frozen FFL rule components are observed evidence only. Game completeness and corrections are not verified; no final kicker fantasy score is certified.'};
}

export function scoringEvidence(weeklyPayloads=[],rules={},team=''){
 const wanted=String(team||'').toUpperCase(),positions=['QB','RB','WR','TE','K','DEF'],samples=[];
 for(const [index,entry] of weeklyPayloads.entries()){
  const payload=entry?.payload||entry,week=Number.isInteger(entry?.week)?entry.week:index+1;
  for(const row of playerRows(payload)){
   if(wanted&&row.team!==wanted)continue;
   if(!positions.includes(row.position)||!row.stats)continue;
   const stats=normalizeStats(row.stats),result=fflScore(row.stats,rules,row.position);
   samples.push({player:row.name,id:row.id,position:row.position,week,
    rawFieldPaths:statFieldPaths(row.stats,{limit:40}),
    observedPoints:result.points,complete:result.complete,covered:result.covered,
    missing:result.missing,components:result.components||[],hasKnownStats:Object.keys(stats).length>0});
  }
 }
 const groups={};
 for(const position of positions){
  const rows=samples.filter(x=>x.position===position),counts=new Map();
  for(const row of rows)for(const c of row.covered)counts.set(c,(counts.get(c)||0)+1);
  const coveredCategories=[...counts].sort((a,b)=>b[1]-a[1]).map(([name,records])=>({name,records}));
  const best=rows.filter(r=>r.observedPoints!==null)
   .sort((a,b)=>b.covered.length-a.covered.length||a.missing.length-b.missing.length).slice(0,2)
   .map(r=>({player:r.player,id:r.id,week:r.week,covered:r.covered,
    missing:r.missing.slice(0,12),components:r.components,
    observedPoints:r.observedPoints,complete:r.complete}));
  groups[position]={records:rows.length,withAnyStats:rows.filter(r=>r.hasKnownStats).length,
   withPartialPoints:rows.filter(r=>r.observedPoints!==null).length,
   fullyCovered:rows.filter(r=>r.complete).length,coveredCategories,
   observedRawFieldPaths:[...new Set(rows.flatMap(r=>r.rawFieldPaths))].sort().slice(0,55),
   missingCategories:[...new Set(rows.flatMap(r=>r.missing))].sort(),
   coreCoverage:CORE_SCORING_GROUPS[position].filter(k=>Number(rules[k]||0)!==0)
    .map(k=>({category:k,records:rows.filter(r=>r.covered.includes(k)).length,
      gaps:rows.filter(r=>r.missing.includes(k)).length})),samples:best};
 }
 return {team:wanted,weekFeeds:weeklyPayloads.length,records:samples.length,
  byPosition:groups,exactFantasyPointsCertified:false,
  reason:'Only published component values were scored. Missing categories, long TD bonuses, K and D/ST events require independent evidence.'};
}

/** Read-only MSF stats/schema verification. Partial FFL reconstruction never
 * becomes an authoritative league score or projection. */
export function auditStatFeed(payload,rules){
 const shape=playerFeedShape(payload),rows=playerRows(payload);
 const positions=['QB','RB','WR','TE','K','DEF'];
 const withStats=rows.filter(r=>r.stats&&typeof r.stats==='object'&&Object.keys(normalizeStats(r.stats)).length);
 const ids=new Set(rows.map(r=>r.id).filter(Boolean));
 const observed={};
 for(const pos of positions){
  const group=rows.filter(r=>r.position===pos),scored=group.filter(r=>r.stats)
   .map(r=>({row:r,result:fflScore(r.stats,rules,pos)}));
  const partial=scored.filter(x=>x.result.points!==null),complete=scored.filter(x=>x.result.complete);
  const unavailable=[...new Set(scored.flatMap(x=>x.result.missing))].sort();
  observed[pos]={records:group.length,withNumericEvidence:scored.filter(x=>Object.keys(normalizeStats(x.row.stats)).length>0).length,
   partialScoring:partial.length,completeScoring:complete.length,
   example:partial.slice(0,1).map(x=>({player:x.row.name,team:x.row.team,providerId:x.row.id||null,
     provisionalPoints:x.result.points,covered:x.result.covered.slice(0,12),missing:x.result.missing.slice(0,12)})),
   missingCategories:unavailable.slice(0,15)};
 }
 const supported=shape.collection!=='unrecognized'&&rows.length>0;
 return {supported,collection:shape.collection,rawCount:shape.rawCount,
  parsedCount:rows.length,uniqueProviderIds:ids.size,missingProviderIds:rows.filter(r=>!r.id).length,
  statsRecognized:withStats.length,positionCoverage:observed,
  // A usable list is not proof of complete statistics, accurate FFL totals, or a license for all games.
  scoringCertified:false};
}
/** A six-week window is only a lower bound on season-to-date counting stats,
 * not a full season reconciliation. Compare only unambiguously matched MSF IDs,
 * and only attributes actually published by both feeds. */
export function auditSeasonLowerBound(weeklyFeeds=[],seasonPayload={}){
 const season=playerRows(seasonPayload),byId=new Map();
 for(const row of season){if(row.id&&!byId.has(row.id))byId.set(row.id,row);}
 const weekly=new Map(),seenGame=new Set();
 for(const feed of weeklyFeeds)for(const row of playerRows(feed)){
  if(!row.id||!row.stats)continue;
  const key=row.id+'|'+String(row.game?.id??row.game?.gameId??'');
  // A missing game ID cannot safely be deduplicated across multiple weeks.
  if(row.game?.id&&seenGame.has(key))continue;
  if(row.game?.id)seenGame.add(key);
  const entry=weekly.get(row.id)||[];
  entry.push(row);weekly.set(row.id,entry);
 }
 const keys=['pass_yd','pass_td','pass_int','rush_yd','rush_td','rec','rec_yd','rec_td','fgm','xpm'];
 let matchedPlayers=0,comparedCategories=0,overSeasonTotals=0;
 const examples=[];
 for(const [id,logs] of weekly){
  const current=byId.get(id);if(!current?.stats)continue;
  const base=normalizeStats(current.stats);matchedPlayers++;
  for(const category of keys){
   const values=logs.map(x=>normalizeStats(x.stats)[category]);
   if(!values.length||values.some(x=>x===undefined)||base[category]===undefined)continue;
   const sum=values.reduce((a,b)=>a+b,0);
   comparedCategories++;
   if(sum>base[category]+0.0001){
    overSeasonTotals++;
    if(examples.length<4)examples.push({player:current.name,category,weekSum:sum,seasonValue:base[category]});
   }
  }
 }
 return {seasonRecords:season.length,playersWithWeeklyLogs:weekly.size,matchedPlayers,
  comparedCategories,overSeasonTotals,examples,
  // Only a comparison floor: no claim that six-week logs sum to season-to-date.
  certifiedSeasonReconciliation:false};
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
