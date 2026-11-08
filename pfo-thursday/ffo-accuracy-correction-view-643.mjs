/**
 * PFO 6.43 — read-only append-only final-correction reconciliation.
 * Never turn a missing/contradictory revision chain into an original, stale
 * "verified" actual. No SQL writes, no Sleeper scoring, no Commissioner data.
 */
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
import {MSF_CORRECTION_REVISION_SCHEMA}
 from './ffo-msf-final-corrections-643.mjs';
const validScore=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=200;
const ISO=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&
 /^\d{4}-\d\d-\d\dT/.test(x);
const fingerprint=x=>typeof x==='string'&&/^[a-f0-9]{64}$/i.test(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,75}$/.test(x);
const key=x=>x&&id(x.gameId)&&id(x.playerId)?x.gameId+'|'+x.playerId:null;
const certificateValid=(c,rulesVersion)=>c?.certified===true&&
 c?.provider==='MSF'&&c?.rulesVersion===rulesVersion&&
 c?.fantasyScoreFromSleeper===false&&c?.finalPlayerScoreRecomputed===true&&
 c?.playerIdentityVerified===true&&c?.finalBoxScoreVerified===true&&
 c?.statCategoriesComplete===true&&c?.eventBonusesReconciled===true&&
 c?.statCorrectionsChecked===true&&validScore(c.points)&&key(c);
const fail=reason=>({
 status:'correction_integrity_blocked',
 reason,certificates:[],revisionsApplied:0,withheldKeys:[],
 correctedResultsCertified:false,readOnly:true
});
export function reconcileFinalCorrections643({
 originals=[],revisions=[],rulesVersion=FFL_RULES_VERSION
}={}){
 if(rulesVersion!==FFL_RULES_VERSION||!Array.isArray(originals)||!Array.isArray(revisions))
  return fail('frozen_scoring_or_payload_arrays_missing');
 const roots=new Map(),duplicates=new Set();
 for(const c of originals){
  const k=key(c);
  if(!k||!certificateValid(c,rulesVersion))
   return fail('original_certificate_integrity_unverified');
  if(roots.has(k))duplicates.add(k);
  roots.set(k,c);
 }
 if(duplicates.size)return fail('duplicate_original_final_certificates');
 const byKey=new Map();
 for(const r of revisions){
  const k=key(r);
  if(!k||r.schema!==MSF_CORRECTION_REVISION_SCHEMA||
   !Number.isInteger(r.revisionIndex)||r.revisionIndex<1||
   r.rulesVersion!==rulesVersion||!fingerprint(r.providerResponseSha256)||
   !id(r.providerCorrectionId)||!ISO(r.msfCorrectedAt)||
   !ISO(r.certifiedAt)||!validScore(r.priorPoints)||
   !validScore(r.correctedPoints)||!certificateValid(r.certificate,rulesVersion)||
   key(r.certificate)!==k||r.certificate.points!==r.correctedPoints)
   return fail('revision_payload_integrity_unverified');
  if(!roots.has(k))return fail('orphan_revision_without_original_certification');
  const rows=byKey.get(k)||[];
  rows.push(r);byKey.set(k,rows);
 }
 const final=new Map(roots),withheldKeys=[],issues=[],byGame={},applied=[];
 for(const [k,chain] of byKey){
  chain.sort((a,b)=>a.revisionIndex-b.revisionIndex);
  let index=0,score=roots.get(k).points,prevTime=NaN,ok=true;
  const seenIds=new Set();
  for(const r of chain){
   const correctedAt=Date.parse(r.msfCorrectedAt),
    certifiedAt=Date.parse(r.certifiedAt);
   if(r.revisionIndex!==index+1||r.priorPoints!==score||
    seenIds.has(r.providerCorrectionId)||Math.abs(score-r.correctedPoints)<0.00001||
    certifiedAt<correctedAt||
    Number.isFinite(prevTime)&&correctedAt<=prevTime){
    issues.push('broken_or_non_monotonic_revision_chain');ok=false;break;
   }
   index=r.revisionIndex;score=r.correctedPoints;prevTime=correctedAt;
   seenIds.add(r.providerCorrectionId);
  }
  if(!ok){
   final.delete(k);withheldKeys.push(k);continue;
  }
  const latest=chain.at(-1);
  final.set(k,latest.certificate);
  applied.push({key:k,count:chain.length,lastSourceCorrectionAt:latest.msfCorrectedAt});
  const gameId=latest.gameId;
  byGame[gameId]=(byGame[gameId]||0)+1;
 }
 return {
  status:withheldKeys.length?'corrections_partially_withheld':'correction_chains_verified',
  certificates:[...final.values()],
  revisionsApplied:applied.reduce((n,x)=>n+x.count,0),
  correctedPlayerGames:applied.length,
  correctedByGame:byGame,withheldKeys,
  issues:[...new Set(issues)],
  originalCertifiedCount:roots.size,
  outputCertifiedCount:final.size,
  correctedResultsCertified:withheldKeys.length===0,
  readOnly:true,ffoiIntegrated:false,
  commissionerDataRead:false,source:'verified_immutable_msf_correction_chain_only'
 };
}
