/**
 * PFO 6.43 — append-only MSF stat corrections; RESEARCH ONLY.
 * The original certified final is revision zero and remains unchanged.
 * Only an authorized server may call with PFO_ACCURACY_DB. Never expose
 * correction rows through a public HTTP route or use Commissioner D1.
 * Schema migration 0002 is NOT APPLIED in development.
 */
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
const ID=/^[A-Za-z0-9_-]{1,75}$/,SHA=/^[a-f0-9]{64}$/i;
const time=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const points=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=200;
const deny=reason=>({status:'withheld',reason,appendOnly:true,liveWritesEnabled:false});
export const MSF_CORRECTION_REVISION_SCHEMA='PFO_643_MSF_FINAL_CORRECTION_REVISION_V1';
export function validateMSFCorrection643({
 game,certificate,providerCorrection,prior,serverNow=new Date()
}={}){
 const now=serverNow instanceof Date?serverNow.getTime():NaN;
 if(!Number.isFinite(now))return deny('server_clock_unverified');
 const gameId=String(game?.id??''),playerId=String(certificate?.playerId??'');
 if(!ID.test(gameId)||!ID.test(playerId)||game?.provider!=='MSF'||
  !['FINAL','COMPLETED','FINAL_OT','FINAL_OVERTIME'].includes(game?.status)||
  game?.providerGameIdVerified!==true||game?.finalBoxScoreVerified!==true||
  game?.playerGameLogsVerified!==true||game?.fullPlayCoverageVerified!==true||
  game?.allScoringEventsReconciled!==true||game?.statCorrectionsChecked!==true||
  !Number.isInteger(game.week)||game.week<1||game.week>18)
  return deny('fully_verified_completed_game_required');
 if(!certificate?.certified||certificate?.provider!=='MSF'||
  certificate?.rulesVersion!==FFL_RULES_VERSION||
  certificate?.gameId!==gameId||certificate?.week!==game.week||
  certificate?.fantasyScoreFromSleeper!==false||
  certificate?.finalPlayerScoreRecomputed!==true||
  certificate?.playerIdentityVerified!==true||
  certificate?.finalBoxScoreVerified!==true||
  certificate?.statCategoriesComplete!==true||
  certificate?.eventBonusesReconciled!==true||
  certificate?.statCorrectionsChecked!==true||!points(certificate.points))
  return deny('independent_revised_score_not_certified');
 if(!prior||!['revision','original_cert'].includes(prior.source)||
  !Number.isInteger(prior.index)||prior.index<0||!points(prior.points))
  return deny('trusted_prior_accuracy_d1_certificate_required');
 if(Math.abs(prior.points-certificate.points)<0.00001)
  return deny('no_actual_score_change');
 const correctionId=String(providerCorrection?.id??'');
 const correctionAt=time(providerCorrection?.correctedAtUtc),
  fetchedAt=time(providerCorrection?.verifiedAtUtc),
  kickoff=time(game?.kickoffAt),
  previous=time(prior.correctionAt);
 if(providerCorrection?.provider!=='MSF'||
  providerCorrection?.authenticatedByServer!==true||
  providerCorrection?.providerHTTPStatus!==200||
  providerCorrection?.independentRevisedPlayerGameLogVerified!==true||
  providerCorrection?.revisedScoringPlayReconciliationVerified!==true||
  providerCorrection?.fieldGoalAndLongTouchdownRechecked!==true||
  providerCorrection?.fullStatCorrectionFeedChecked!==true||
  providerCorrection?.sourceGameId!==gameId||
  providerCorrection?.sourcePlayerId!==playerId||
  !ID.test(correctionId)||
  !SHA.test(String(providerCorrection?.rawProviderResponseSha256??''))||
  !Number.isFinite(correctionAt)||!Number.isFinite(fetchedAt)||
  !Number.isFinite(kickoff)||correctionAt<kickoff||
  fetchedAt<correctionAt||fetchedAt>now||now-fetchedAt>15*60_000||
  Number.isFinite(previous)&&correctionAt<=previous)
  return deny('newer_authenticated_msf_correction_not_proven');
 const r={schema:MSF_CORRECTION_REVISION_SCHEMA,season:2026,
  gameId,playerId,week:game.week,revisionIndex:prior.index+1,
  priorPoints:prior.points,correctedPoints:certificate.points,
  rulesVersion:FFL_RULES_VERSION,
  providerCorrectionId:correctionId,
  msfCorrectedAt:new Date(correctionAt).toISOString(),
  certifiedAt:new Date(now).toISOString(),
  providerResponseSha256:providerCorrection.rawProviderResponseSha256,
  certificate};
 return {status:'revision_proposal_verified',revision:r,
  policyOnly:true,liveWritesEnabled:false};
}
async function priorFromAccuracyDB(db,gameId,playerId){
 const args=[2026,gameId,playerId];
 const revision=await db.prepare(
  'SELECT revision_index,corrected_points,rules_version,msf_corrected_at,payload_json FROM pfo_accuracy_final_revisions WHERE season=? AND game_id=? AND player_id=? ORDER BY revision_index DESC LIMIT 1'
 ).bind(...args).first();
 if(revision){
  const data=JSON.parse(revision.payload_json||'null');
  if(data?.certificate?.certified!==true||data?.certificate?.provider!=='MSF'||
   data?.rulesVersion!==FFL_RULES_VERSION||
   revision.rules_version!==FFL_RULES_VERSION||
   !points(revision.corrected_points)||!Number.isInteger(revision.revision_index)||
   revision.revision_index<1||!Number.isFinite(time(revision.msf_corrected_at)))
   return null;
  return {source:'revision',index:revision.revision_index,
   points:revision.corrected_points,correctionAt:revision.msf_corrected_at};
 }
 const original=await db.prepare(
  'SELECT actual_points,rules_version,payload_json FROM pfo_accuracy_final_certificates WHERE season=? AND game_id=? AND player_id=? LIMIT 1'
 ).bind(...args).first();
 if(!original)return null;
 const data=JSON.parse(original.payload_json||'null');
 if(data?.certified!==true||data?.provider!=='MSF'||
  data?.gameId!==gameId||data?.playerId!==playerId||
  data?.rulesVersion!==FFL_RULES_VERSION||
  original.rules_version!==FFL_RULES_VERSION||!points(original.actual_points))
  return null;
 return {source:'original_cert',index:0,points:original.actual_points,
  correctionAt:null};
}
const INSERT=[
 'INSERT INTO pfo_accuracy_final_revisions',
 '(season,game_id,player_id,revision_index,prior_points,corrected_points,',
 'rules_version,msf_corrected_at,certified_at,provider_correction_id,payload_json)',
 'SELECT ?,?,?,?,?,?,?,?,?,?,?',
 'WHERE EXISTS(SELECT 1 FROM pfo_accuracy_final_certificates',
 'WHERE season=? AND game_id=? AND player_id=? AND rules_version=?)',
 'AND COALESCE((SELECT MAX(revision_index) FROM pfo_accuracy_final_revisions',
 'WHERE season=? AND game_id=? AND player_id=?),0)=?',
 'AND COALESCE((SELECT corrected_points FROM pfo_accuracy_final_revisions',
 'WHERE season=? AND game_id=? AND player_id=?',
 'ORDER BY revision_index DESC LIMIT 1),',
 '(SELECT actual_points FROM pfo_accuracy_final_certificates',
 'WHERE season=? AND game_id=? AND player_id=?))=?',
 'ON CONFLICT DO NOTHING'
].join(' ');
/** Atomic compare-and-append: verifies original, prior revision index and
 * exact prior score inside ONE INSERT statement to resist concurrent retries.
 */
export async function appendIndependentMSFCorrection643(db,{
 game,certificate,providerCorrection,serverNow=new Date()
}={}){
 if(!db?.prepare)return deny('dedicated_accuracy_d1_required');
 try{
  const gameId=String(game?.id??''),playerId=String(certificate?.playerId??'');
  if(!ID.test(gameId)||!ID.test(playerId))return deny('game_or_player_id_missing');
  const prior=await priorFromAccuracyDB(db,gameId,playerId);
  if(!prior)return deny('prior_verified_accuracy_score_unavailable');
  const result=validateMSFCorrection643({game,certificate,providerCorrection,
   prior,serverNow});
  if(result.status!=='revision_proposal_verified')return result;
  const r=result.revision,params=[
   2026,r.gameId,r.playerId,r.revisionIndex,r.priorPoints,r.correctedPoints,
   r.rulesVersion,r.msfCorrectedAt,r.certifiedAt,r.providerCorrectionId,
   JSON.stringify(r),
   2026,r.gameId,r.playerId,r.rulesVersion,
   2026,r.gameId,r.playerId,r.revisionIndex-1,
   2026,r.gameId,r.playerId,
   2026,r.gameId,r.playerId,r.priorPoints
  ];
  const out=await db.prepare(INSERT).bind(...params).run();
  if(out?.meta?.changes!==1)return deny('correction_already_saved_or_concurrent_revision_changed');
  return {status:'append_only_revision_saved',gameId:r.gameId,
   playerId:r.playerId,revisionIndex:r.revisionIndex,
   originalCertificateOverwritten:false,commissionerDatabaseTouched:false,
   separateAccuracyD1Only:true};
 }catch{return deny('correction_schema_or_immutable_transaction_unavailable')}
}
