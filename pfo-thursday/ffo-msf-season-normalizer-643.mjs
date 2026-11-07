/**
 * Exact isolated copy of PFO Pages' existing licensed MSF season normalizer.
 * Frozen source-equivalence checked against _worker.js in CI.
 * No provider HTTP, credentials, fantasy-platform points or D1 writes here.
 * Keeping the SAME stat forecast normalization is mandatory for PFO parity.
 */
export function ffo598NormalizeSeason(payload,checkedAt){
 const rows=payload?.playerStatsTotals;
 if(!Array.isArray(rows))throw Error('MSF_SEASON_SCHEMA_UNRECOGNIZED');
 const fields={
 pass_yd:['passing.passYards','passing.passingYards','passing.yards','passYards'],
 pass_td:['passing.passTD','passing.passTouchdowns','passing.passTds','passTD'],
 pass_int:['passing.passInt','passing.interceptions','passInt'],
 pass_cmp:['passing.passCompletions','passing.completions','passCompletions'],
 pass_att:['passing.passAttempts','passing.attempts','passAttempts'],
 rush_yd:['rushing.rushYards','rushing.yards','rushYards'],
 rush_td:['rushing.rushTD','rushing.rushTouchdowns','rushTD'],
 rush_att:['rushing.rushAttempts','rushing.attempts','rushAttempts'],
 rec:['receiving.receptions','receiving.rec','receptions'],
 rec_yd:['receiving.recYards','receiving.receivingYards','recYards'],
 rec_td:['receiving.recTD','receiving.recTouchdowns','recTD'],
 targets:['receiving.targets','receiving.recTargets','targets'],
 fum_lost:['fumbles.fumblesLost','fumbles.lost','fumblesLost'],
 fum:['fumbles.fumbles','fumbles.total'],
 rush_2pt:['rushing.rushTwoPt','rushing.twoPointConversions'],
 rec_2pt:['receiving.recTwoPt','receiving.twoPointConversions'],
 pass_2pt:['passing.passTwoPt','passing.twoPointConversions'],
 fgm:['fieldGoals.fgMade','fieldGoals.fieldGoalsMade','kicking.fgMade',
  'kicking.fieldGoalsMade','fgMade','fieldGoalsMade'],
 fgm_0_19:['fieldGoals.fieldGoalsMade0To19','kicking.fieldGoalsMade0To19','fieldGoals.fgMade0To19','kicking.fgMade0To19','fieldGoalsMade0To19','kicking.fieldGoalsMade0To19','fieldGoals.fieldGoalsMade0to19'],
 fgm_20_29:['fieldGoals.fieldGoalsMade20To29','kicking.fieldGoalsMade20To29','fieldGoals.fgMade20To29','kicking.fgMade20To29','fieldGoalsMade20To29','kicking.fieldGoalsMade20To29','fieldGoals.fieldGoalsMade20to29'],
 fgm_30_39:['fieldGoals.fieldGoalsMade30To39','kicking.fieldGoalsMade30To39','fieldGoals.fgMade30To39','kicking.fgMade30To39','fieldGoalsMade30To39','kicking.fieldGoalsMade30To39','fieldGoals.fieldGoalsMade30to39'],
 fgm_40_49:['fieldGoals.fieldGoalsMade40To49','kicking.fieldGoalsMade40To49','fieldGoals.fgMade40To49','kicking.fgMade40To49','fieldGoalsMade40To49','kicking.fieldGoalsMade40To49','fieldGoals.fieldGoalsMade40to49'],
 fgm_50_59:['fieldGoals.fieldGoalsMade50To59','kicking.fieldGoalsMade50To59','fieldGoals.fgMade50To59','kicking.fgMade50To59','fieldGoalsMade50To59','kicking.fieldGoalsMade50To59','fieldGoals.fieldGoalsMade50to59'],
 fgm_60p:['fieldGoals.fieldGoalsMade60Plus','kicking.fieldGoalsMade60Plus','fieldGoals.fgMade60Plus','kicking.fgMade60Plus','fieldGoalsMade60Plus','kicking.fieldGoalsMade60Plus','fieldGoals.fieldGoalsMade60Plus'],
 xpm:['extraPoints.extraPointsMade','extraPoints.xpMade','extraPoints.made',
  'extraPointAttempts.xpMade','kicking.extraPointsMade','kicking.xpMade','xpMade'],
 xpmiss:['extraPoints.extraPointsMissed','extraPoints.xpMissed','extraPoints.missed',
  'extraPointAttempts.xpMissed','kicking.extraPointsMissed','kicking.xpMissed','xpMissed'],
 fgmiss:['fieldGoals.fieldGoalsMissed','fieldGoals.missed','kicking.fieldGoalsMissed','kicking.fgMissed'],
 sack:['defense.sacks','defensive.sacks','defense.sacksMade'],
 int:['defense.interceptions','defensive.interceptions'],
 ff:['defense.forcedFumbles','defensive.forcedFumbles'],
 fum_rec:['defense.fumbleRecoveries','defensive.fumbleRecoveries'],
 safe:['defense.safeties','defensive.safeties'],
 blk_kick:['defense.blockedKicks','defensive.blockedKicks']
 };
 // Upstream sometimes varies the "To/to" capitalization in FG distance
 // buckets. Match exact first, then a case-insensitive key; never guess
 // missing FG distances from generic field goals made.
 const get=(o,path)=>path.split('.').reduce((x,k)=>{
  if(!x||typeof x!=='object')return undefined;
  if(Object.hasOwn(x,k))return x[k];
  const match=Object.keys(x).find(v=>v.toLowerCase()===k.toLowerCase());
  return match?x[match]:undefined;
 },o);
 const number=x=>x===null||x===undefined||x===''||typeof x==='object'?null:Number.isFinite(Number(x))?Number(x):null;
 const players=[];
 for(const item of rows){
  const p=item?.player||item?.playerInfo||{},raw=item?.stats||item?.playerStats||{};
  const team=item?.team?.abbreviation||item?.teamInfo?.abbreviation||p?.currentTeam?.abbreviation||item?.teamAbbreviation||'';
  const name=String(p.fullName||p.displayName||[p.firstName,p.lastName].filter(Boolean).join(' ')||item.name||'').trim();
  if(!name||!team)continue;
  const gp=number(raw.gamesPlayed??raw.gamesPlayedTotal??(typeof raw.games==='number'?raw.games:null)??
   raw.games?.played??raw.games?.gamesPlayed??item.gamesPlayed??item.gamesPlayedTotal??
   p.gamesPlayed??p.gamesPlayedTotal);
  const games=gp!==null&&Number.isInteger(gp)&&gp>=0&&gp<=18?gp:null;
  const totals={};
  for(const [key,aliases] of Object.entries(fields)){
   for(const a of aliases){const n=number(get(raw,a));if(n!==null){totals[key]=n;break}}
  }
  // MSF NFL boxscores can contain fgAndXpPts (actual scoreboard kicking
  // points: 3 per made field goal + 1 per made PAT) and xpMade. When both
  // independent measurements yield an exact nonnegative whole-number FG
  // count, recover ONLY generic FG makes; distance-specific bonuses remain
  // unavailable unless their made counts are explicitly sourced. Percentage
  // fields (fg1_19Pct etc.) are NEVER treated as made kicks.
  const fgPoints=number(get(raw,'extraPointAttempts.fgAndXpPts'));
  const xpMade=number(get(raw,'extraPointAttempts.xpMade'));
  const fgAttempts=number(get(raw,'fieldGoals.fgAtt')??get(raw,'fieldGoals.fgAttempts'));
  if(totals.fgm!=null&&(!Number.isInteger(totals.fgm)||totals.fgm<0||
      (fgAttempts!==null&&(!Number.isInteger(fgAttempts)||totals.fgm>fgAttempts)))){
   delete totals.fgm; // refuse inconsistent counts rather than scoring them
  }
  const xpAttempts=number(get(raw,'extraPointAttempts.xpAtt'));
  // MSF confirms xpAtt/xpMade as attempts and makes. Blocked kicks count as
  // misses in the recorded FFL settings, so att - made includes those blocks.
  if(totals.xpmiss==null&&xpMade!==null&&xpAttempts!==null&&
     Number.isInteger(xpAttempts)&&Number.isInteger(xpMade)&&
     xpAttempts>=xpMade&&xpMade>=0)totals.xpmiss=xpAttempts-xpMade;
  if(totals.fgm==null&&fgPoints!==null&&xpMade!==null&&
     Number.isInteger(fgPoints)&&Number.isInteger(xpMade)&&
     fgPoints>=xpMade&&xpMade>=0&&
     (fgPoints-xpMade)%3===0){
    const made=(fgPoints-xpMade)/3;
    if(fgAttempts===null||(Number.isInteger(fgAttempts)&&fgAttempts>=made)){
     totals.fgm=made;
    }
  }
  if(games!==null)totals.games_played=games;
  const hasStats=Object.keys(totals).some(k=>k!=='games_played');
  const forecast=games>0&&hasStats?Object.fromEntries(Object.entries(totals).filter(([k])=>k!=='games_played').map(([k,v])=>[k,v/games])):null;
  players.push({msf_id:p.id??item.playerId??null,name,team:String(team).toUpperCase(),
   position:String(p.primaryPosition?.abbreviation||p.primaryPosition?.name||p.primaryPosition||p.position?.abbreviation||p.position||item.position||'').toUpperCase(),
   season_totals:totals,games_observed:games,games_played:games,latest:null,games:[],forecast,
   coverage:forecast?'season_per_game_partial':'season_or_games_played_unavailable'});
 }
 if(!players.length)throw Error('MSF_NO_IDENTIFIABLE_PLAYER_ROWS');
 return {schema:'FFO_MSF_SEASON_V1',source:'MySportsFeeds',source_type:'licensed_primary',checked_at:checkedAt,
  provider_updated_at:payload.lastUpdatedOn||null,history_available:false,
  projection_method:'MSF-reported season totals divided by sourced games played (no last-three trends)',
  players_count:players.length,players};
}
