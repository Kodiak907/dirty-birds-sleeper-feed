import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reconcileLongTDComponents643}
 from './ffo-long-td-policy-643.mjs';
import {applicableFFLRuleKeys}
 from './ffo-historical-score-certificate.mjs';
import {validateAndCertifyMSF}
 from './ffo-final-score-certification-639.mjs';

const rules=JSON.parse(readFileSync(new URL('./FFO_FFL_SCORING_V1.json',import.meta.url),'utf8'));
const game={
 id:'G10',gameId:'G10',provider:'MSF',status:'FINAL',
 week:10,season:2026,home:'BUF',away:'MIA',
 kickoffAt:'2026-11-08T18:25:00Z',
 providerGameIdVerified:true,scheduleWeekVerified:true,
 finalScoreVerified:true,fullPlayCoverageVerified:true,
 finalBoxScoreVerified:true,playerGameLogsVerified:true,
 allScoringEventsReconciled:true,statCorrectionsChecked:true,
 scheduleGamesComplete:true
};
const player={id:'P100',position:'QB',team:'BUF',gameId:'G10',
 identityVerified:true,stats:{}};
const source=(policy)=>({
 verified:true,source:'commissioner_ffl_scoring_semantics_plus_msf_pbp',
 thresholdCountMode:'nested_40plus_includes_50plus',
 adjudicatedPolicy:policy,independentMSFEventsReconciled:true
});
function proofs({pass40=1,pass50=1}={}){
 const counts={pass_yd:55,pass_td:1,pass_td_40p:pass40,pass_td_50p:pass50};
 return applicableFFLRuleKeys(rules.scoring,'QB').map(category=>({
  category,value:counts[category]??0,
  source:/_td_(40p|50p)$/.test(category)?'msf_reconciled_pbp':'msf_final_stat',
  gameId:'G10',playerId:'P100',verified:true
 }));
}
function certify({policy='highest_only',evidence=null,componentProof=proofs()}={}){
 return validateAndCertifyMSF({game,player,rules,componentProof,
  bonusPolicy:policy,bonusPolicyAdjudicated:true,
  longTDThresholdEvidence:evidence});
}
test('verified 50+ yard passing TD is WITHHELD absent official stacking semantics',()=>{
 const result=certify();
 assert.equal(result.status,'withheld');
 assert.ok(result.blockers.includes('msf_score_certificate_incomplete')||result.reason==='msf_score_certificate_incomplete');
 const high=certify({policy:'highest_only',evidence:source('highest_only')});
 assert.equal(high.status,'certified_source_score');
 assert.equal(high.certificate.points,8.2);
 assert.equal(high.certificate.longTDBonusPolicySource,
  'commissioner_ffl_scoring_semantics_plus_msf_pbp');
});
test('policy calculations are different candidates, NEVER an assumed FFL interpretation',()=>{
 const top=certify({policy:'highest_only',evidence:source('highest_only')});
 const stacked=certify({policy:'additive',evidence:source('additive')});
 assert.equal(top.certificate.points,8.2);
 assert.equal(stacked.certificate.points,9.2);
 assert.equal(stacked.certificate.points-top.certificate.points,1);
 const top40=top.certificate.components.find(x=>x.category==='pass_td_40p');
 assert.equal(top40.providerThresholdCount,1);
 assert.equal(top40.value,0);
 assert.equal(top40.points,0);
 const stacked40=stacked.certificate.components.find(x=>x.category==='pass_td_40p');
 assert.equal(stacked40.value,1);
 assert.equal(stacked40.points,1);
});
test('50+ provider count cannot exceed nested verified 40+ count',()=>{
 const bad=certify({componentProof:proofs({pass40:0,pass50:1}),
  evidence:source('highest_only')});
 assert.equal(bad.status,'withheld');
 assert.ok(bad.blockers.includes('50_plus_long_tds_exceed_verified_40_plus_count'));
});
test('incorrect official policy statement or PBP reconciliation blocks even when numerical data seems valid',()=>{
 for(const e of [
  {...source('highest_only'),verified:false},
  {...source('highest_only'),independentMSFEventsReconciled:false},
  {...source('additive')},
  {...source('highest_only'),thresholdCountMode:'exclusive_40_to_49'},
  {...source('highest_only'),source:'unknown_sleeper_guess'}
 ]){
  const r=certify({evidence:e});
  assert.equal(r.status,'withheld');
  assert.equal(r.certificate,undefined);
 }
});
test('verified 40–49 touchdown with no 50+ score is unaffected by unresolved overlap',()=>{
 const r=certify({componentProof:proofs({pass40:1,pass50:0})});
 assert.equal(r.status,'certified_source_score');
 assert.equal(r.certificate.points,7.2);
 assert.equal(r.certificate.longTDBonusPolicySource,
  'no_50_plus_long_touchdown_in_verified_game');
});
test('zero count event proof is never a reason to invent additional positive bonus',()=>{
 const a=reconcileLongTDComponents643({components:[
  {category:'pass_td_40p',value:0,weight:1,points:0,source:'msf_reconciled_pbp'},
  {category:'pass_td_50p',value:0,weight:2,points:0,source:'msf_reconciled_pbp'}
 ],bonusPolicy:'highest_only'});
 assert.equal(a.accepted,true);
 assert.equal(a.components.reduce((n,x)=>n+x.points,0),0);
 assert.equal(a.approvedFFLBonusPolicy,false);
});
