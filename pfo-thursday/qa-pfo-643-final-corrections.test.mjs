import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateMSFCorrection643,appendIndependentMSFCorrection643}
 from './ffo-msf-final-corrections-643.mjs';
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
const original={certified:true,provider:'MSF',gameId:'g101',playerId:'18607',
 rulesVersion:FFL_RULES_VERSION,points:18.0};
const game={id:'g101',provider:'MSF',status:'FINAL',week:10,
 kickoffAt:'2026-11-08T18:25:00.000Z',
 providerGameIdVerified:true,finalBoxScoreVerified:true,
 playerGameLogsVerified:true,fullPlayCoverageVerified:true,
 allScoringEventsReconciled:true,statCorrectionsChecked:true};
const certificate={...original,points:18.5,week:10,position:'QB',
 fantasyScoreFromSleeper:false,finalPlayerScoreRecomputed:true,
 playerIdentityVerified:true,finalBoxScoreVerified:true,
 statCategoriesComplete:true,eventBonusesReconciled:true,
 statCorrectionsChecked:true};
const correction={id:'correction_0001',provider:'MSF',
 authenticatedByServer:true,providerHTTPStatus:200,
 independentRevisedPlayerGameLogVerified:true,
 revisedScoringPlayReconciliationVerified:true,
 fieldGoalAndLongTouchdownRechecked:true,
 fullStatCorrectionFeedChecked:true,sourceGameId:'g101',
 sourcePlayerId:'18607',rawProviderResponseSha256:'a'.repeat(64),
 correctedAtUtc:'2026-11-08T22:00:00Z',
 verifiedAtUtc:'2026-11-08T22:03:00Z'};
const now=new Date('2026-11-08T22:04:00Z');
const prior={index:0,points:18,correctionAt:null,source:'original_cert'};
const run=extra=>validateMSFCorrection643({game,certificate,providerCorrection:correction,prior,serverNow:now,...extra});
function fake({base=original,revision=null,changes=1,throwQuery=false}={}){
 const calls=[];
 return {calls,db:{prepare(sql){
  if(/COMMISSIONER_DB|commissioner_cases/i.test(sql))throw Error('forbidden');
  return {bind(...args){
   const row={sql,args};calls.push(row);
   return {
    async first(){
     if(throwQuery)throw Error('migration missing');
     if(sql.includes('FROM pfo_accuracy_final_revisions'))return revision;
     if(sql.includes('FROM pfo_accuracy_final_certificates'))return base?{
      actual_points:base.points,rules_version:FFL_RULES_VERSION,payload_json:JSON.stringify(base)
     }:null;
     throw Error('unknown SELECT');
    },
    async run(){return {meta:{changes}}}
   };
  }};
 }}};
}
test('append-only correction migration exists separately, with immutable update/delete triggers',()=>{
 const sql=readFileSync(new URL('./accuracy-migrations/0002_final_correction_revisions.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS pfo_accuracy_final_revisions/);
 assert.match(sql,/FOREIGN KEY\(season,game_id,player_id\)/);
 assert.match(sql,/CREATE TRIGGER IF NOT EXISTS immutable_accuracy_revisions_update/);
 assert.match(sql,/CREATE TRIGGER IF NOT EXISTS immutable_accuracy_revisions_delete/);
 assert.doesNotMatch(sql,/CREATE TABLE.*commissioner/i);
 assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM|UPDATE pfo_accuracy_final_certificates/i);
});
test('pure candidate validates independently corrected final but does not enable any Worker or live write',()=>{
 const r=run();
 assert.equal(r.status,'revision_proposal_verified');
 assert.equal(r.liveWritesEnabled,false);
 assert.equal(r.revision.revisionIndex,1);
 assert.equal(r.revision.priorPoints,18);
 assert.equal(r.revision.correctedPoints,18.5);
 assert.equal(r.revision.rulesVersion,FFL_RULES_VERSION);
});
test('missing, unverified, stale, wrong-player, or unchanged final scores are withheld',()=>{
 for(const x of [
  {providerCorrection:{...correction,authenticatedByServer:false}},
  {providerCorrection:{...correction,sourcePlayerId:'someone_else'}},
  {providerCorrection:{...correction,sourceGameId:'wrong'}},
  {providerCorrection:{...correction,fieldGoalAndLongTouchdownRechecked:false}},
  {providerCorrection:{...correction,rawProviderResponseSha256:'bad'}},
  {providerCorrection:{...correction,verifiedAtUtc:'2026-11-08T19:00:00Z'}},
  {certificate:{...certificate,fantasyScoreFromSleeper:true}},
  {certificate:{...certificate,points:18}},
  {certificate:{...certificate,statCorrectionsChecked:false}},
  {game:{...game,fullPlayCoverageVerified:false}},
  {prior:{...prior,source:'client_supplied'}}
 ]){
  const r=run(x);
  assert.equal(r.status,'withheld');
 }
});
test('real ledger prerequisite is checked before first revision, no originating certificate means no insert',async()=>{
 const {db,calls}=fake({base:null});
 const r=await appendIndependentMSFCorrection643(db,{game,certificate,providerCorrection:correction,serverNow:now});
 assert.equal(r.status,'withheld');
 assert.equal(r.reason,'prior_verified_accuracy_score_unavailable');
 assert.equal(calls.length,2);
});
test('dedicated accuracy D1 base leads to conditional, compare-and-append correction',async()=>{
 const {db,calls}=fake();
 const r=await appendIndependentMSFCorrection643(db,{game,certificate,providerCorrection:correction,serverNow:now});
 assert.equal(r.status,'append_only_revision_saved');
 assert.equal(r.revisionIndex,1);
 assert.equal(r.originalCertificateOverwritten,false);
 assert.equal(r.commissionerDatabaseTouched,false);
 const writes=calls.filter(x=>x.sql.startsWith('INSERT'));
 assert.equal(writes.length,1);
 const w=writes[0];
 assert.match(w.sql,/INSERT INTO pfo_accuracy_final_revisions/);
 assert.match(w.sql,/MAX\(revision_index\)/);
 assert.match(w.sql,/COALESCE\(\(SELECT corrected_points/);
 assert.match(w.sql,/ON CONFLICT DO NOTHING/);
 assert.doesNotMatch(w.sql,/\bUPDATE\b|\bDELETE\b|commissioner/i);
 assert.equal(w.args.length,26);
 assert.equal(w.args[3],1);
 assert.equal(w.args[4],18);
 assert.equal(w.args[5],18.5);
 assert.equal(w.args.at(-1),18);
});
test('second independent correction appends revision 2 without altering original score',async()=>{
 const prev={revision_index:1,corrected_points:18.5,
  msf_corrected_at:correction.correctedAtUtc,
  rules_version:FFL_RULES_VERSION,
  payload_json:JSON.stringify({certificate,rulesVersion:FFL_RULES_VERSION})};
 const {db,calls}=fake({revision:prev});
 const c={...certificate,points:19.5};
 const next={...correction,id:'correction_0002',
  correctedAtUtc:'2026-11-08T22:05:00Z',
  verifiedAtUtc:'2026-11-08T22:06:00Z'};
 const out=await appendIndependentMSFCorrection643(db,{game,certificate:c,
  providerCorrection:next,serverNow:new Date('2026-11-08T22:07:00Z')});
 assert.equal(out.status,'append_only_revision_saved');
 assert.equal(out.revisionIndex,2);
 const w=calls.find(x=>x.sql.startsWith('INSERT'));
 assert.equal(w.args[3],2);
 assert.equal(w.args[4],18.5);
 assert.equal(w.args[5],19.5);
});
test('late or repeated same correction and failed D1 migration cannot falsely succeed',async()=>{
 const db=fake({changes:0});
 const blocked=await appendIndependentMSFCorrection643(db.db,{game,certificate,
  providerCorrection:correction,serverNow:now});
 assert.equal(blocked.status,'withheld');
 assert.equal(blocked.reason,'correction_already_saved_or_concurrent_revision_changed');
 const uncreated=fake({throwQuery:true});
 const x=await appendIndependentMSFCorrection643(uncreated.db,{game,certificate,
  providerCorrection:correction,serverNow:now});
 assert.equal(x.status,'withheld');
 assert.equal(x.reason,'correction_schema_or_immutable_transaction_unavailable');
 assert.equal((await appendIndependentMSFCorrection643(null,{})).status,'withheld');
});
