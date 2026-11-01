/**
 * Independent GameCast week navigation & 2026 Sunday slate cross-check.
 * Schedule and score values are ALWAYS supplied by authenticated MSF.
 * Official NFL Week 8 matchups are reference identifiers only, never
 * alternative play-by-play or invented game scores.
 */
export const MIN_WEEK=1,MAX_WEEK=18;
const MS=86400000;
const validWeek=w=>Number.isInteger(w)&&w>=1&&w<=18;
const validDate=x=>Number.isFinite(Date.parse(String(x||'')));
export function calendarWeek(date,season=2026){
 const kickoff=Date.parse(String(date||''));
 if(!Number.isFinite(kickoff)||!Number.isInteger(season))return null;
 // 2026 NFL regular season starts Thursday, September 10. A calendar week
 // labels fixtures for navigation ONLY, not source-confirmed game identity.
 if(season!==2026)return null;
 const start=Date.parse('2026-09-10T00:00:00Z');
 const w=Math.floor((kickoff-start)/ (7*MS))+1;
 return validWeek(w)?w:null;
}
export function gameWeek(g,season=2026){
 const w=Number(g?.week);
 if(validWeek(w)&&g?.weekVerified!==false)return {week:w,source:'msf'};
 const estimated=calendarWeek(g?.start,season);
 return {week:estimated,source:estimated?'calendar_estimate':'unknown'};
}
export function currentCalendarWeek(now=new Date(),season=2026){
 const current=now instanceof Date?now:new Date(now);
 return calendarWeek(current.toISOString(),season);
}
export function pacificDay(date){
 if(!validDate(date))return null;
 const dateObj=new Date(date);
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(dateObj);
 const x=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return x.year+'-'+x.month+'-'+x.day;
}
export function scheduleForWeek(games,week,season=2026){
 if(!validWeek(Number(week))||!Array.isArray(games))return [];
 const found=new Map();
 for(const g of games){
  if(!g?.id)continue;
  const x=gameWeek(g,season);
  if(x.week!==Number(week))continue;
  const key=String(g.id);
  if(!found.has(key))found.set(key,{...g,week:Number(week),weekSource:x.source});
 }
 return [...found.values()].sort((a,b)=>Date.parse(a.start||'')-Date.parse(b.start||'')||String(a.id).localeCompare(String(b.id)));
}
export function groupWeekGames(games,now=new Date()){
 const today=pacificDay(now instanceof Date?now.toISOString():now);
 const groups={today:[],earlier:[],upcoming:[],unknown:[]};
 for(const g of games||[]){
  const date=pacificDay(g?.start);
  if(!date)groups.unknown.push(g);
  else if(date===today)groups.today.push(g);
  else if(date<today)groups.earlier.push(g);
  else groups.upcoming.push(g);
 }
 return groups;
}
export function preferredGame(games,now=new Date()){
 if(!games?.length)return null;
 const nowMs=+(now instanceof Date?now:new Date(now));
 const {today,upcoming}=groupWeekGames(games,now);
 const isLive=g=>/^(LIVE|IN_PROGRESS|INPROGRESS|INPROGRESS_OVERTIME|OVERTIME|OT|HALFTIME)$/i.test(g.status||'');
 return today.find(isLive)||upcoming[0]||today[0]||games[0];
}
// Grounded in the official 2026 NFL Week 8 Sunday Nov 1 schedule.
// Used ONLY to warn about schedule completeness, never to synthesize games.
const NOV1_2026=[
 ['BAL','BUF'],['TEN','CIN'],['ARI','DAL'],['MIN','DET'],
 ['IND','JAX'],['LV','NYJ'],['CLE','PIT'],['ATL','TB'],
 ['LAC','LAR'],['KC','DEN'],['NE','MIA'],['PHI','WSH']
];
const abbr={WAS:'WSH',GBP:'GB',GNB:'GB',KAN:'KC',KCC:'KC',JAC:'JAX',LA:'LAR',STL:'LAR',SD:'LAC',ARZ:'ARI',OAK:'LV'};
const norm=x=>abbr[String(x||'').toUpperCase()]||String(x||'').toUpperCase();
export function todayCoverage(games,now=new Date(),season=2026){
 const today=pacificDay(now instanceof Date?now.toISOString():now);
 const actual=(games||[]).filter(g=>pacificDay(g?.start)===today);
 const pairs=new Set(actual.map(g=>norm(g.away)+'-'+norm(g.home)));
 const reference=today==='2026-11-01'&&season===2026?NOV1_2026:null;
 const missing=reference?reference.filter(([away,home])=>!pairs.has(away+'-'+home)).map(x=>x.join(' @ ')):[];
 const extra=reference?actual.filter(g=>!reference.some(([away,home])=>away===norm(g.away)&&home===norm(g.home))).map(g=>norm(g.away)+' @ '+norm(g.home)):[];
 return {
  day:today,observedGames:actual.length,uniqueMatchups:pairs.size,
  expectedGames:reference?reference.length:null,missing,extra,
  slateVerified:!!reference&&missing.length===0&&extra.length===0&&actual.length===reference.length,
  // Never conflate schedule completeness with live PBP entitlement.
  playByPlayVerifiedForAllGames:false
 };
}

/**
 * Resolve a weekly MSF games row without guessing scores. Require matching
 * stable game ID and both teams from the initial season schedule, and preserve
 * newer selected-game box scores when the weekly provider timestamp is older.
 * A correction may legitimately REDUCE a score; never assume monotonic points.
 */
export function mergeVerifiedWeekScore(previous,weekly,{providerUpdatedAt=null,checkedAt=null}={}){
 if(!previous?.id||!weekly?.id||String(previous.id)!==String(weekly.id))
  return {accepted:false,reason:'game_id_mismatch',game:previous};
 const normTeam=x=>({GBP:'GB',GNB:'GB',JAC:'JAX',KAN:'KC',KCC:'KC',
  WAS:'WSH',LA:'LAR'}[String(x||'').toUpperCase()]||String(x||'').toUpperCase());
 if(normTeam(previous.home)!==normTeam(weekly.home)||normTeam(previous.away)!==normTeam(weekly.away))
  return {accepted:false,reason:'game_team_mismatch',game:previous};
 const points=x=>x===null||x===undefined||x===''||typeof x==='object'?null:
  Number.isInteger(Number(x))&&Number(x)>=0&&Number(x)<=300?Number(x):null;
 const home=points(weekly.homePoints),away=points(weekly.awayPoints);
 const incomingAt=Number.isFinite(Date.parse(providerUpdatedAt||''))?Date.parse(providerUpdatedAt):null;
 const previousAt=Number.isFinite(Date.parse(previous.scoreProviderUpdatedAt||''))?
  Date.parse(previous.scoreProviderUpdatedAt):null;
 if(incomingAt!==null&&previousAt!==null&&incomingAt<previousAt)
  return {accepted:false,reason:'older_provider_update',game:previous};
 const prevFinal=/^(final|completed)$/i.test(String(previous.status||''));
 const isFinal=/^(final|completed)$/i.test(String(weekly.status||''));
 if(prevFinal&&!isFinal)
  return {accepted:false,reason:'final_status_downgrade',game:previous};
 // Missing or partial score evidence never erases a previously verified score.
 if(home===null||away===null)
  return {accepted:false,reason:'score_not_published',game:previous};
 // When the box score has no comparable native provider timestamp, a
 // weekboard snapshot lacking one is NOT proof of a more recent correction.
 if(incomingAt===null&&previousAt!==null)
  return {accepted:false,reason:'provider_update_time_missing',game:previous};
 const game={...previous,
  homePoints:home,awayPoints:away,
  status:weekly.status&&weekly.status!=='Unverified game status'?weekly.status:previous.status,
  scoreSource:'MySportsFeeds weekly games',scoreProviderUpdatedAt:providerUpdatedAt||previous.scoreProviderUpdatedAt||null,
  scoreCheckedAt:checkedAt||null};
 return {accepted:true,reason:'verified_msf_weekly_score',game};
}
export function backgroundPlayCandidates(games,selectedId,seen={},now=Date.now(),minimumIntervalMs=60000){
 const eligible=(games||[]).filter(g=>g.id!==selectedId&&
  /^(LIVE|IN_PROGRESS|INPROGRESS|INPROGRESS_OVERTIME|OVERTIME|OT|HALFTIME)$/i.test(String(g.status||''))&&
  (!seen[g.id]||now-seen[g.id]>=minimumIntervalMs));
 return eligible.sort((a,b)=>(seen[a.id]||0)-(seen[b.id]||0));
}
