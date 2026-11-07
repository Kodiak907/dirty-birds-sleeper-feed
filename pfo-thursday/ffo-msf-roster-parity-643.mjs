/**
 * PFO 6.43 — deterministic, private identity bridge:
 * Sleeper is roster/player-ID authority ONLY, MSF is the sourced stat model.
 * Absolutely no Sleeper fantasy scores, projections, or D1 writes.
 * Fails closed on stale/unverified schedule, duplicate names or IDs and
 * requires a live browser/server parity attestation before any capture.
 */
import {forecastBrowserSourceCandidate643,SERVER_MODEL_CANDIDATE}
 from './ffo-server-forecast-643.mjs';
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';

const validId=x=>/^[A-Za-z0-9_-]{1,45}$/.test(String(x??''));
const canon=x=>String(x??'').trim().toUpperCase();
const normPos=x=>canon(x).replace(/^D\/?ST$/,'DEF');
const nameKey=x=>String(x??'').normalize('NFKD').toLowerCase()
 .replace(/[\u0300-\u036f]/g,'')
 .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g,'')
 .replace(/[^a-z0-9]/g,'');
const positions=new Set(['QB','RB','WR','TE','K','DEF']);
const validUTC=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&
 /^\d{4}-\d\d-\d\dT/.test(x)&&/(Z|[+-]\d\d:\d\d)$/.test(x);
const status=(kind,reason,more={})=>({schema:'PFO_643_PRIVATE_MSF_ROSTER_MODEL_BRIDGE_V1',
 status:kind,reason,sourceOfFantasyPoints:'independent_msf_ffl',
 sourceOfPlayerIdentity:'authorized_sleeper_roster_only',
 ffoiIntegrated:false,writeAuthorized:false,
 liveParityVerified:false,...more});
export function joinVerifiedPFOIdentity643({
 team,week,rosterPlayers,msfIndex,fixture,rules,
 sourceAsOfUtc=null
}={}){
 const t=canon(team),now=Date.parse(sourceAsOfUtc||'');
 if(!validUTC(sourceAsOfUtc)||msfIndex?.status!=='verified'||
  msfIndex?.team!==t||!Array.isArray(msfIndex.players)||
  !Array.isArray(rosterPlayers)||!rosterPlayers.length||
  rules?.version!==FFL_RULES_VERSION||rules?.league!=='FFL'||
  fixture?.provider!=='MSF'||fixture?.verified!==true||!validId(fixture?.gameId)||
  !['SCHEDULED','PRE_GAME','NOT_STARTED'].includes(fixture.status)||
  !Number.isInteger(week)||week!==fixture?.week||
  ![fixture.home,fixture.away].includes(t)||
  !validUTC(fixture.kickoffAt)||
  !Number.isFinite(now)||now>=Date.parse(fixture.kickoffAt))
  return status('blocked','complete_verified_fixture_msf_index_roster_and_ffl_rules_required');
 const byName=new Map(),ambiguous=new Set();
 for(const p of msfIndex.players){
  const key=nameKey(p.name)+'|'+canon(p.team)+'|'+normPos(p.position);
  if(!nameKey(p.name)||!validId(p.id)||!positions.has(normPos(p.position)))continue;
  if(byName.has(key))ambiguous.add(key);
  else byName.set(key,p);
 }
 for(const key of ambiguous)byName.delete(key);
 const rosterSeen=new Set(),mappedIds=new Set(),out=[],withheld=[];
 for(const p of rosterPlayers){
  const id=String(p?.player_id??p?.id??'');
  const pos=normPos(p?.position),key=nameKey(p?.name)+'|'+canon(p?.team)+'|'+pos;
  if(!validId(id)||!nameKey(p?.name)||!positions.has(pos)||
   ![fixture.home,fixture.away].includes(canon(p.team))||
   rosterSeen.has(id)){
   withheld.push({sleeperPlayerId:validId(id)?id:null,reason:'invalid_duplicate_or_nonfixture_roster_identity'});
   continue;
  }
  rosterSeen.add(id);
  if(canon(p.team)!==t)continue;
  const mapped=byName.get(key);
  if(!mapped||!validId(mapped.id)){
   withheld.push({sleeperPlayerId:id,reason:'no_unique_same_team_position_msf_identity'});
   continue;
  }
  if(mappedIds.has(String(mapped.id))){
   withheld.push({sleeperPlayerId:id,reason:'msf_identity_already_assigned_to_other_roster_player'});continue;
  }
  mappedIds.add(String(mapped.id));
  const result=forecastBrowserSourceCandidate643({
   player:{name:p.name,team:p.team,position:pos},row:mapped.row,
   rules,uniqueMSFIdentityVerified:true
  });
  if(!result||!Number.isFinite(result.points)){
   withheld.push({sleeperPlayerId:id,reason:'existing_pfo_model_has_no_supported_forecast'});
   continue;
  }
  out.push({
   forecast:{
    provider:'PFO',scoringSystem:'FFL',
    sourceProvider:'MSF',rulesVersion:FFL_RULES_VERSION,
    playerId:id,msfPlayerId:String(mapped.id),position:pos,
    team:t,opponent:t===fixture.home?fixture.away:fixture.home,
    gameId:fixture.gameId,week,modelVersion:SERVER_MODEL_CANDIDATE,
    points:result.points,partial:true,certified:false,
    sourceAsOfUtc,asOfUtc:sourceAsOfUtc,fromSleeperActual:false,
    afterGameKnowledge:false,sourceEvidence:'trusted_msf_identity_match_parity_pending',
    missingEvidence:result.missingEvidence
   },
   sourceIdentity:{msfId:String(mapped.id),sleeperId:id,
    resolvedBy:'unique_exact_team_position_normalized_name'},
   verifiedServerParity:false,
   eligibleForAccuracyCapture:false
  });
 }
 return status(out.length?'candidate_forecasts_not_capture_eligible':'no_trustworthy_model_candidates',
  'real_browser_vs_server_parity_and_current_fixture_source_not_proven',
  {team:t,week,gameId:fixture.gameId,sourceAsOfUtc,
   candidates:out,withheld,modelCandidate:SERVER_MODEL_CANDIDATE,
   comparedWithActualBrowser:false,captureAllowed:false});
}
