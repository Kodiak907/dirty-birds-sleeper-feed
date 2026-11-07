/**
 * PFO 6.43 — tightly scoped, read-only MySportsFeeds retrieval adapter.
 * Only server-side Workers/Actions may call this module. Never expose payloads
 * as public HTTP responses, never log tokens, and never write to Accuracy D1.
 * Direct MSF 2026 NFL endpoints only; no URL supplied by a browser is accepted.
 */
import {normalizeMSF2026Fixtures} from './ffo-msf-fixtures-643.mjs';
import {ffo598NormalizeSeason} from './ffo-msf-season-normalizer-643.mjs';

const ORIGIN='https://api.mysportsfeeds.com/v2.1/pull/nfl';
const TEAMS=new Set('ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' '));
const boundedTime=x=>x instanceof Date&&Number.isFinite(x.getTime())?x:null;
const upper=x=>String(x||'').trim().toUpperCase();
const safeResult=(status,reason,other={})=>({schema:'PFO_643_MSF_TRUSTED_READ_V1',status,reason,
 source:'MySportsFeeds',provider:'MSF',licensedStatsOnly:true,readOnly:true,
  accuracyWritesEnabled:false,...other});
const int=x=>typeof x==='number'&&Number.isInteger(x)&&x>=0;

function pathFor(feed,team){
 if(feed!=='fixtures'&&feed!=='season')return null;
 if(!TEAMS.has(team))return null; // strictly one verified team; bounded requests
 return '/2026-regular/'+(feed==='fixtures'?'games.json':'player_stats_totals.json')+'?team='+team;
}
/** Pure validation of first-party MSF player identity and normalization.
 * Never assume a non-null name guarantees a unique player ID.
 */
export function verifyNormalizedMSFPlayerIndex(data,{team}={}){
 if(data?.source!=='MySportsFeeds'||data.schema!=='FFO_MSF_SEASON_V1'||
  !Array.isArray(data.players)||!TEAMS.has(upper(team)))
  return safeResult('blocked','normalized_msf_team_feed_required');
 const selected=data.players.filter(p=>upper(p.team)===upper(team));
 const byProviderId=new Map(),byName=new Map(),invalid=[],conflicts=new Set();
 for(const p of selected){
  const id=String(p.msf_id??'').trim();
  const name=String(p.name??'').trim();
  const position=upper(p.position);
  const key=name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
   .replace(/[^a-z0-9]/g,'')+'|'+upper(team)+'|'+position;
  if(!/^[A-Za-z0-9_-]{1,45}$/.test(id)||!name||!/^(QB|RB|WR|TE|K|DEF)$/.test(position)){
   invalid.push({id:id||null,reason:'player_id_name_or_position_unverified'});continue;
  }
  if(byProviderId.has(id)||byName.has(key)){
   conflicts.add(id);conflicts.add(byName.get(key)?.id||id);
   continue;
  }
  const x={id,playerId:id,name,team:upper(team),position,row:p,
   source:'authenticated_msf_normalized_season'};
  byProviderId.set(id,x);byName.set(key,x);
 }
 for(const id of conflicts)byProviderId.delete(id);
 const rows=[...byProviderId.values()];
 return safeResult(rows.length?'verified':'blocked',
  rows.length?'unique_msf_player_ids_and_team_position_verified':'no_valid_msf_player_ids',
  {team:upper(team),players:rows,playerCount:rows.length,
   rejectedIdentityRows:invalid.length,conflictingProviderIdentities:conflicts.size,
   sourceAsOf:data.checked_at??null,season:2026,verified:rows.length>0});
}

/**
 * Read once. Caller-supplied auth/URL cannot substitute for env.MSF_API_KEY.
 * Use small, team-scoped reads in smoke tests; no retry loops or 429 hammering.
 */
export async function readTrustedMSF2026({
 env,feed,team,now=new Date(),transport=fetch,maxBytes=6_500_000
}={}){
 const at=boundedTime(now),t=upper(team),path=pathFor(feed,t);
 if(!at)return safeResult('blocked','trusted_server_clock_required');
 if(!path)return safeResult('blocked','unsupported_feed_or_nfl_team');
 const directSecret=typeof env?.MSF_API_KEY==='string'&&!!env.MSF_API_KEY.trim();
 const internalMSF=typeof env?.GAMECAST_INTERNAL?.fetch==='function';
 if(!directSecret&&!internalMSF)
  return safeResult('blocked','no_trusted_licensed_provider_binding',{team:t,feed});
 if(typeof transport!=='function'||!int(maxBytes)||maxBytes<1000||maxBytes>6_500_000)
  return safeResult('blocked','invalid_server_transport_or_response_limit');
 const url=ORIGIN+path, checkedAtUtc=at.toISOString();
 let response;
 try{
  if(directSecret){
   const credentials=btoa(env.MSF_API_KEY+':MYSPORTSFEEDS');
   response=await transport(url,{method:'GET',
    headers:{authorization:'Basic '+credentials,accept:'application/json'},
    redirect:'error',signal:AbortSignal.timeout(12_000)});
  }else{
   // Cloudflare's existing private GamecastInternal entrypoint only; no
   // Internet URL or provider credentials are received from the browser.
   response=await env.GAMECAST_INTERNAL.fetch(new Request(url,{method:'GET',
    headers:{accept:'application/json'}}));
  }
 }catch{
  return safeResult('blocked','provider_unreachable_or_timeout',{team:t,feed,checkedAtUtc});
 }
 const code=response?.status;
 if(code!==200||response?.ok!==true){
  const reason=code===401?'provider_auth_denied':code===403?'provider_entitlement_denied':
   code===429?'provider_rate_limited':code===404?'provider_feed_unavailable':
   Number.isInteger(code)&&code>=500?'provider_unavailable':'provider_http_not_verified';
  return safeResult('blocked',reason,{team:t,feed,providerHttpStatus:Number.isInteger(code)?code:null,
   checkedAtUtc});
 }
 const size=Number(response.headers?.get?.('content-length')||0);
 if(Number.isFinite(size)&&size>maxBytes)
  return safeResult('blocked','provider_response_too_large',{team:t,feed,checkedAtUtc});
 let raw;
 try{
  raw=await response.text();
  if(typeof raw!=='string'||raw.length>maxBytes)return safeResult('blocked','provider_response_too_large',{team:t,feed,checkedAtUtc});
 }catch{return safeResult('blocked','provider_response_unreadable',{team:t,feed,checkedAtUtc})}
 let payload;
 try{payload=JSON.parse(raw)}catch{
  return safeResult('blocked','provider_json_invalid',{team:t,feed,checkedAtUtc});
 }
 if(!payload||typeof payload!=='object'||payload?.available===false||payload?.error||
  Number.isInteger(payload?.provider_http_status)&&payload.provider_http_status!==200)
  return safeResult('blocked','provider_payload_not_verified',{team:t,feed,checkedAtUtc});
 const p=payload?.data??payload;
 const evidence={provider:'MSF',authenticatedByServer:true,httpStatus:200,
  endpoint:path,season:2026,fetchedAtUtc:checkedAtUtc};
 if(feed==='fixtures'){
  const normalized=normalizeMSF2026Fixtures({payload:p,evidence,serverNow:at});
  const games=normalized.fixtures.filter(g=>g.home===t||g.away===t);
  if(normalized.status==='blocked'||!games.length)
   return safeResult('blocked','verified_msf_game_identity_or_kickoff_unavailable',
    {team:t,feed,checkedAtUtc,providerHttpStatus:200,
     withheld:normalized.withheld,issues:normalized.issues});
  return safeResult('verified','authenticated_msf_fixture_normalization',
   {team:t,feed,checkedAtUtc,providerHttpStatus:200,
    viaTrustedGamecastInternal:!directSecret,
    fixtures:games,withheld:normalized.withheld,issues:normalized.issues,
    gameCount:games.length});
 }
 try{
  const normalized=ffo598NormalizeSeason(p,checkedAtUtc);
  const identities=verifyNormalizedMSFPlayerIndex(normalized,{team:t});
  if(identities.status!=='verified')
   return safeResult('blocked','msf_player_identity_coverage_not_verified',
    {team:t,feed,checkedAtUtc,providerHttpStatus:200,
     rejectedIdentityRows:identities.rejectedIdentityRows??null});
  return safeResult('verified','authenticated_msf_season_normalized_like_existing_pfo',
   {team:t,feed,checkedAtUtc,providerHttpStatus:200,
    viaTrustedGamecastInternal:!directSecret,normalized:identities,
    playerCount:identities.playerCount,providerUpdatedAtUtc:normalized.provider_updated_at});
 }catch{
  return safeResult('blocked','provider_season_normalization_unverified',
   {team:t,feed,checkedAtUtc,providerHttpStatus:200});
 }
}
