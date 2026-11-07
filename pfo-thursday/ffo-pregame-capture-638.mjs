/**
 * PFO 6.38 — immutable independent, pre-kickoff FFL forecast capture.
 * This is a server-side library, not a browser form or a public write API.
 * Does not scrape Sleeper, infer kickoffs, or use Commissioner D1 storage.
 */
import {selectEligiblePregameFixtures} from './ffo-msf-fixtures-643.mjs';
export const FFL_RULES_VERSION='2026-11-05-ffl-screen-recording-verified-v4';
export const ACCURACY_SCHEMA='FFO_PFO_ACCURACY_LEDGER_V1';
const POS=new Set(['QB','RB','WR','TE','K','DEF']);
const str=x=>typeof x==='string'?x.trim():'';
const utc=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(x)&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const decimal=x=>typeof x==='number'&&Number.isFinite(x);
const bool=x=>x===true;
const selected=o=>Object.fromEntries(Object.entries(o).filter(([,x])=>x!==undefined));

export function validatePregameCapture({forecast,game,serverNow=new Date(),minLeadMinutes=15}={}){
 const reasons=[];
 const now=serverNow instanceof Date?serverNow.getTime():NaN;
 const kickoff=utc(game?.kickoffAt);
 if(!Number.isFinite(now))reasons.push('untrusted_server_clock');
 if(!Number.isFinite(kickoff))reasons.push('kickoff_unverified');
 if(!game||game.provider!=='MSF'||!bool(game.verified)||
  !Number.isInteger(game.week)||game.week<1||game.week>18||
  str(game.gameId)===''||!['SCHEDULED','PRE_GAME','NOT_STARTED'].includes(game.status))
  reasons.push('msf_verified_upcoming_game_required');
 if(!Number.isInteger(minLeadMinutes)||minLeadMinutes<5||minLeadMinutes>120)
  reasons.push('invalid_lead_window');
 if(Number.isFinite(kickoff)&&Number.isFinite(now)&&
  (now>kickoff-minLeadMinutes*60_000||now<kickoff-7*86400_000))
  reasons.push('outside_safe_pregame_window');
 if(!forecast||forecast.provider!=='PFO'||forecast.scoringSystem!=='FFL'||
  forecast.rulesVersion!==FFL_RULES_VERSION)
  reasons.push('incorrect_forecast_scoring_version');
 if(forecast?.sourceProvider!=='MSF'||forecast?.fromSleeperActual!==false||
  forecast?.afterGameKnowledge!==false||forecast?.gameId!==game?.gameId||
  forecast?.week!==game?.week)
  reasons.push('unverified_provider_or_game_identity');
 const playerId=str(forecast?.playerId);
 const modelVersion=str(forecast?.modelVersion);
 const position=str(forecast?.position).toUpperCase();
 const team=str(forecast?.team).toUpperCase();
 const opponent=str(forecast?.opponent).toUpperCase();
 if(!/^[A-Za-z0-9_-]{1,45}$/.test(playerId)||!POS.has(position)||
  !/^[A-Z]{2,3}$/.test(team)||!/^[A-Z]{2,3}$/.test(opponent)||
  team===opponent||!modelVersion||modelVersion.length>100)
  reasons.push('unverified_player_or_model_identity');
 const home=str(game?.home).toUpperCase(),away=str(game?.away).toUpperCase();
 if(!((team===home&&opponent===away)||(team===away&&opponent===home)))
  reasons.push('forecast_teams_do_not_match_verified_fixture');
 if(!decimal(forecast?.points)||Math.abs(forecast.points)>200)
  reasons.push('invalid_numeric_projection');
 const sourceAsOf=utc(forecast?.asOfUtc);
 if(!Number.isFinite(sourceAsOf)||Number.isFinite(now)&&sourceAsOf>now||
  Number.isFinite(now)&&sourceAsOf<now-36*3600_000||
  Number.isFinite(kickoff)&&sourceAsOf>=kickoff)
  reasons.push('source_projection_timestamp_unverified_or_stale');
 if(forecast?.partial!==true||forecast?.certified!==false)
  reasons.push('projection_must_preserve_provisional_status');
 if(reasons.length)return {accepted:false,reasons};
 return {accepted:true,reasons:[],record:selected({
  schema:ACCURACY_SCHEMA,season:2026,playerId,gameId:String(game.gameId),
  week:game.week,position,team,opponent,points:forecast.points,
  provider:'PFO',scoringSystem:'FFL',sourceProvider:'MSF',
  rulesVersion:FFL_RULES_VERSION,modelVersion,partial:true,certified:false,
  fromSleeperActual:false,afterGameKnowledge:false,
  capturedAt:new Date(now).toISOString(),kickoffAt:new Date(kickoff).toISOString(),
  sourceAsOf:new Date(sourceAsOf).toISOString(),sourceEvidence:forecast.sourceEvidence||'partial-msf'
 })};
}
export function captureSQL(record){
 if(!record||record.schema!==ACCURACY_SCHEMA)throw Error('validated_accuracy_record_required');
 return {
  statement:'INSERT INTO pfo_accuracy_forecasts (season,game_id,player_id,week,position,team,opponent,projected_points,rules_version,model_version,captured_at,kickoff_at,source_asof,provisional,source_provider,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(season,game_id,player_id) DO NOTHING',
  params:[record.season,record.gameId,record.playerId,record.week,record.position,
   record.team,record.opponent,record.points,record.rulesVersion,record.modelVersion,
   record.capturedAt,record.kickoffAt,record.sourceAsOf,1,'MSF',JSON.stringify(record)]
 };
}
/** First accepted snapshot for a player/game is forever immutable. No UPDATE. */
export async function insertImmutablePregameForecast(db,request){
 if(!db?.prepare)return {status:'blocked',reason:'separate_accuracy_database_not_configured'};
 const validation=validatePregameCapture(request);
 if(!validation.accepted)return {status:'withheld',reasons:validation.reasons};
 const {statement,params}=captureSQL(validation.record);
 const change=await db.prepare(statement).bind(...params).run();
 return {status:(change?.meta?.changes===1?'stored':'existing_snapshot_preserved'),
  accepted:true,recordKey:[validation.record.season,validation.record.gameId,
   validation.record.playerId].join(':'),scoringVersion:FFL_RULES_VERSION};
}
/** A cron run must independently resolve the upcoming MSF schedule and PFO model.
 * Missing either input is a visible BLOCKED result, never an empty success.
 */
export async function runPregameCapture({db,gameFeed,forecastFeed,serverNow=new Date()}={}){
 if(!db?.prepare)return {status:'blocked',reason:'accuracy_d1_binding_missing',captured:0};
 if(typeof gameFeed!=='function'||typeof forecastFeed!=='function')
  return {status:'blocked',reason:'trusted_schedule_or_pfo_forecast_feed_missing',captured:0};
 const fixtures=await gameFeed();
 if(!Array.isArray(fixtures)||fixtures.length===0)
  return {status:'blocked',reason:'no_verified_upcoming_msf_games',captured:0};
 const due=selectEligiblePregameFixtures(fixtures,{serverNow,minLeadMinutes:15,maxLeadMinutes:30});
 if(!due.eligible.length)return {status:'no_eligible_kickoff_windows',
  captured:0,preserved:0,withheld:due.withheld?.length||0,
  reason:due.reason||'capture_runs_only_15_to_30_minutes_before_verified_kickoff',
  cutoffMinutes:15,source:'verified_msf_fixtures'};
 let stored=0,preserved=0,withheld=due.withheld.length;
 for(const game of due.eligible.slice(0,32)){
  if(game?.verified!==true)continue;
  const forecasts=await forecastFeed(game);
  if(!Array.isArray(forecasts)){withheld++;continue}
  for(const forecast of forecasts.slice(0,300)){
   const result=await insertImmutablePregameForecast(db,{forecast,game,serverNow});
   if(result.status==='stored')stored++;
   else if(result.status==='existing_snapshot_preserved')preserved++;
   else withheld++;
  }
 }
 return {status:stored?'capture_records_saved':preserved?'existing_records_preserved':'capture_not_verified',
  captured:stored,preserved,withheld,source:'independent MSF fixtures and PFO forecasts',
  separateCommissionerStorage:true};
}
