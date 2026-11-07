/**
 * PFO 6.43: fail-closed licensed MSF schedule normalization and kickoff selection.
 * This is a pure adapter, NOT a network connector or active Worker cron.
 * Caller MUST independently authenticate MSF with a server-held credential.
 * Provenance flags must never be accepted from a public HTTP request body.
 */
export const MSF_FIXTURE_ADAPTER_SCHEMA='PFO_643_MSF_VERIFIED_FIXTURES_V1';
const absTime=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const str=x=>typeof x==='string'?x.trim():'';
const safeId=x=>/^[A-Za-z0-9_-]{1,75}$/.test(String(x??''))?String(x):null;
const utc=x=>absTime.test(str(x))&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
const team=x=>str(x).toUpperCase();
const validTeam=x=>/^[A-Z]{2,3}$/.test(x);
const posInt=x=>Number.isInteger(Number(x))?Number(x):null;
const PLAYABLE=new Set(['SCHEDULED','NOT_STARTED','PRE_GAME']);
// MSF v2 uses UNPLAYED for a scheduled game that has not begun.
const PROVIDER_UPCOMING=new Set([...PLAYABLE,'UNPLAYED']);
const BLOCKED_SCHEDULE=new Set(['CANCELED','CANCELLED','POSTPONED','SUSPENDED','ABANDONED']);
const FINISHED=new Set(['COMPLETED','FINAL','FINAL_OVERTIME','FINAL_OT']);
const normalizedStatus=s=>{
 s=team(s);
 return PROVIDER_UPCOMING.has(s)?(s==='UNPLAYED'?'NOT_STARTED':s):
  FINISHED.has(s)?'FINAL':null;
};
function sourceAuthorized(e,now){
 if(e?.provider!=='MSF'||e.authenticatedByServer!==true||
  e.httpStatus!==200||e.season!==2026||
  !/^\/2026-regular\/games\.json(?:\?team=[A-Z]{2,3})?$/.test(str(e.endpoint)))
  return false;
 const observed=utc(e.fetchedAtUtc);
 return !!observed&&Number.isFinite(now)&&
  Date.parse(observed)<=now&&now-Date.parse(observed)<=10*60_000;
}
function rawGames(payload){
 const p=payload?.data??payload;
 if(Array.isArray(p?.games))return p.games;
 if(Array.isArray(p?.gameScores))return p.gameScores;
 return null;
}
export function normalizeMSF2026Fixtures({payload,evidence,serverNow=new Date()}={}){
 const now=serverNow instanceof Date?serverNow.getTime():NaN;
 const empty={schema:MSF_FIXTURE_ADAPTER_SCHEMA,fixtures:[],withheld:0,issues:[],
  verified:false,source:'MSF',season:2026};
 if(!sourceAuthorized(evidence,now))
  return {...empty,status:'blocked',reason:'trusted_recent_server_msf_response_required'};
 const raw=rawGames(payload);
 if(!raw)return {...empty,status:'blocked',reason:'msf_games_array_schema_missing'};
 const byId=new Map(),conflicts=new Set(),issues=[];
 let withheld=0;
 for(const item of raw){
  const g=item?.schedule||item?.game||item;
  const id=safeId(g?.id??g?.gameId);
  const week=posInt(g?.week??g?.weekNumber);
  const home=team(g?.homeTeam?.abbreviation??g?.homeTeamAbbreviation);
  const away=team(g?.awayTeam?.abbreviation??g?.awayTeamAbbreviation);
  const kickoffAt=utc(g?.startTime??g?.startDateTime??g?.startDateTimeUTC??
   g?.gameStartTime??g?.kickoffAt);
  const status=normalizedStatus(g?.playedStatus??g?.status??item?.playedStatus??item?.status);
  const gameSeason=g?.season??g?.seasonYear??null;
  const scheduleStatus=team(g?.scheduleStatus??item?.scheduleStatus??'');
  if(!id||week===null||week<1||week>18||!validTeam(home)||!validTeam(away)||
   home===away||!kickoffAt||!status||BLOCKED_SCHEDULE.has(scheduleStatus)||
   (gameSeason!==null&&Number(gameSeason)!==2026)){
   withheld++;issues.push('invalid_or_missing_fixture_identity_time_or_status');continue;
  }
  const record={provider:'MSF',verified:true,season:2026,gameId:id,id,week,
   home,away,kickoffAt,status,providerFetchedAt:evidence.fetchedAtUtc,
   sourceEndpoint:evidence.endpoint};
  if(conflicts.has(id)){withheld++;continue}
  if(byId.has(id)){
   const previous=byId.get(id);
   if(previous.week!==record.week||previous.home!==home||previous.away!==away||
     previous.kickoffAt!==kickoffAt||previous.status!==status){
    byId.delete(id);conflicts.add(id);withheld+=2;
    issues.push('conflicting_duplicate_provider_game_id');
   }
   continue;
  }
  byId.set(id,record);
 }
 const fixtures=[...byId.values()].sort((a,b)=>a.kickoffAt.localeCompare(b.kickoffAt));
 return {schema:MSF_FIXTURE_ADAPTER_SCHEMA,
  status:fixtures.length?'fixture_identity_normalized':'no_acceptable_fixtures',
  verified:fixtures.length>0,source:'MSF',season:2026,
  fixtures,withheld,issues:[...new Set(issues)],
  provenance:'authenticated server MSF request; provider fixture fields validated',
  finalFantasyScoresVerified:false,allScoringEventsVerified:false};
}
/** A five-minute cron samples only a 15–30-minute pre-kickoff window, not seven days early.
 * A failed/missed cron must log an explicit gap; it cannot backfill using kickoff knowledge.
 */
export function selectEligiblePregameFixtures(fixtures,{serverNow=new Date(),
 minLeadMinutes=15,maxLeadMinutes=30}={}){
 if(!Number.isInteger(minLeadMinutes)||minLeadMinutes<15||
  !Number.isInteger(maxLeadMinutes)||maxLeadMinutes<=minLeadMinutes||maxLeadMinutes>120)
  return {status:'blocked',reason:'invalid_immutable_pregame_lead_window',eligible:[]};
 const now=serverNow instanceof Date?serverNow.getTime():NaN;
 if(!Number.isFinite(now))return {status:'blocked',reason:'untrusted_server_clock',eligible:[]};
 if(!Array.isArray(fixtures))return {status:'blocked',reason:'verified_fixtures_missing',eligible:[]};
 const eligible=[],withheld=[];
 for(const game of fixtures){
  const kickoff=Date.parse(game?.kickoffAt??''),lead=(kickoff-now)/60_000;
  if(game?.provider!=='MSF'||game?.verified!==true||
   !PLAYABLE.has(game?.status)||!Number.isFinite(lead)){
   withheld.push({gameId:game?.gameId??null,reason:'unverified_or_nonpregame_fixture'});continue;
  }
  if(lead<minLeadMinutes||lead>maxLeadMinutes){
   withheld.push({gameId:game.gameId,reason:lead<minLeadMinutes?
    'too_close_or_after_kickoff':'outside_target_capture_window'});continue;
  }
  eligible.push(game);
 }
 return {status:eligible.length?'eligible_window_found':'no_eligible_kickoff_windows',
  eligible,withheld,cutoffMinutes:minLeadMinutes,targetWindowMinutes:maxLeadMinutes,
  serverTime:new Date(now).toISOString()};
}
