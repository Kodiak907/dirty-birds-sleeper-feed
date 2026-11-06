/**
 * PFO 6.39 independent MSF final-score certification and immutable ledger.
 * A game score with any unverified bonus, identity, return, point-allowed
 * adjustment or stat correction remains withheld. Never use Sleeper points.
 */
import {certifyHistoricalFFLPlayerGame}
 from './ffo-historical-score-certificate.mjs';
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
const VALID_FINAL=new Set(['FINAL','COMPLETED','FINAL_OT','FINAL_OVERTIME']);
const goodString=x=>typeof x==='string'&&x.length>0;
const ts=x=>goodString(x)&&Number.isFinite(Date.parse(x));
const cleanInt=x=>Number.isInteger(x)&&x>=1&&x<=18;
const trustedFixture=({game,rules})=>game?.provider==='MSF'&&
 VALID_FINAL.has(game.status)&&goodString(game.id)&&cleanInt(game.week)&&
 goodString(game.home)&&goodString(game.away)&&game.home!==game.away&&
 ts(game.kickoffAt)&&
 rules?.version===FFL_RULES_VERSION&&rules?.league==='FFL'&&rules?.season===2026;

export function validateAndCertifyMSF({game,player,rules,componentProof,
 bonusPolicy=null,bonusPolicyAdjudicated=false}={}){
 if(!trustedFixture({game,rules}))
  return {status:'withheld',reason:'verified_final_msf_game_and_restored_ffl_scoring_required'};
 if(game?.statCorrectionsChecked!==true||game?.fullPlayCoverageVerified!==true)
  return {status:'withheld',reason:'final_corrections_or_complete_play_data_unverified'};
 if(player?.identityVerified!==true||player?.gameId!==game.id)
  return {status:'withheld',reason:'verified_player_game_identity_required'};
 if(!Array.isArray(componentProof))
  return {status:'withheld',reason:'complete_provider_component_proof_required'};
 const certificate=certifyHistoricalFFLPlayerGame({game,player,rules,
  componentProof,bonusPolicy,bonusPolicyAdjudicated});
 if(!certificate?.certified||certificate.points===null||
  certificate.rulesVersion!==FFL_RULES_VERSION||
  certificate.fantasyScoreFromSleeper!==false)
  return {status:'withheld',reason:'msf_score_certificate_incomplete',
   blockers:certificate?.blockers||[],missingCategories:certificate?.missing||[]};
 if(certificate.gameId!==game.id||certificate.playerId!==String(player.id))
  return {status:'withheld',reason:'certificate_identity_conflict'};
 return {status:'certified_source_score',certificate:{
  ...certificate,season:2026,certified:true,source:'independent verified MSF/FFL',
  gameStatus:game.status,finalBoxScoreVerified:true,
  statCategoriesComplete:true,statCorrectionsChecked:true,
  finalPlayerScoreRecomputed:true,playerIdentityVerified:true,
  eventBonusesReconciled:true
 }};
}
export async function persistVerifiedMSFFinal(db,{game,certificate,serverNow=new Date()}={}){
 if(!db?.prepare)return {status:'blocked',reason:'separate_accuracy_database_not_configured'};
 const gameComplete=game?.providerGameIdVerified===true&&
  game?.scheduleWeekVerified===true&&game?.finalScoreVerified===true&&
  game?.fullPlayCoverageVerified===true&&game?.finalBoxScoreVerified===true&&
  game?.playerGameLogsVerified===true&&game?.allScoringEventsReconciled===true&&
  game?.statCorrectionsChecked===true&&game?.scheduleGamesComplete===true;
 const certificateComplete=certificate?.certified===true&&
  certificate.provider==='MSF'&&certificate.rulesVersion===FFL_RULES_VERSION&&
  certificate.fantasyScoreFromSleeper===false&&
  Number.isFinite(certificate.points)&&
  certificate.playerIdentityVerified===true&&
  certificate.finalBoxScoreVerified===true&&
  certificate.statCategoriesComplete===true&&
  certificate.eventBonusesReconciled===true&&
  certificate.statCorrectionsChecked===true&&
  certificate.finalPlayerScoreRecomputed===true&&
  certificate.gameId===game?.id&&certificate.week===game?.week&&
  ['QB','RB','WR','TE','K','DEF'].includes(certificate.position)&&
  typeof certificate.playerId==='string'&&/^[A-Za-z0-9_-]{1,45}$/.test(certificate.playerId)&&
  Array.isArray(certificate.components)&&
  certificate.components.length>0&&
  certificate.requiredCategoryCount===certificate.verifiedCategoryCount&&
  certificate.verifiedCategoryCount===certificate.components.length&&
  certificate.components.every(c=>c&&typeof c.category==='string'&&
   typeof c.points==='number'&&Number.isFinite(c.points)&&
   ['msf_final_player_log','msf_reconciled_pbp','msf_final_stat','msf_verified_team_log'].includes(c.source));
 if(!certificateComplete||!gameComplete||!trustedFixture({
    game,rules:{league:'FFL',season:2026,version:FFL_RULES_VERSION}
  }))return {status:'withheld',reason:'source_certification_missing_or_mismatched'};
 const time=serverNow instanceof Date&&Number.isFinite(serverNow.getTime())?
  serverNow.toISOString():null;
 if(!time)return {status:'withheld',reason:'invalid_server_certification_time'};
 const verifiedGame={gameId:game.id,week:game.week,kickoffAt:game.kickoffAt,
  status:game.status,provider:'MSF',verified:true};
 const finalData={...certificate,gameId:game.id,playerId:String(certificate.playerId),
  week:game.week,position:certificate.position,
  rulesVersion:FFL_RULES_VERSION,points:certificate.points};
 // D1 batch transaction avoids a final certificate without its independently
 // verified fixture. ON CONFLICT DO NOTHING preserves earlier verified rows.
 const a=db.prepare('INSERT INTO pfo_accuracy_verified_games (season,game_id,week,kickoff_at,provider,verified,status,payload_json) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(season,game_id) DO NOTHING')
  .bind(2026,game.id,game.week,game.kickoffAt,'MSF',1,game.status,JSON.stringify(verifiedGame));
 const b=db.prepare('INSERT INTO pfo_accuracy_final_certificates (season,game_id,player_id,week,position,actual_points,rules_version,certified_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(season,game_id,player_id) DO NOTHING')
  .bind(2026,game.id,String(certificate.playerId),game.week,certificate.position,
   certificate.points,FFL_RULES_VERSION,time,JSON.stringify(finalData));
 if(typeof db.batch!=='function')return {status:'blocked',reason:'transactional_accuracy_db_required'};
 const changes=await db.batch([a,b]);
 return {status:changes?.[1]?.meta?.changes===1?'certified_result_saved':'earlier_certificate_preserved',
  gameId:game.id,playerId:String(certificate.playerId),
  rulesVersion:FFL_RULES_VERSION,independent:true};
}
