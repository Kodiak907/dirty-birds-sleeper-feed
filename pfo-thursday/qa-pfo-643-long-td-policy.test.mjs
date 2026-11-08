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
const officialEvidence=(policy='additive')=>({
 verified:true,source:'official_sleeper_pass_td_stacking_2026_09_17_plus_msf_pbp',
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
function certify({policy='additive',evidence=null,componentProof=proofs()}={}){
 return validateAndCertifyMSF({game,player,rules,componentProof,
  bonusPolicy:policy,bonusPolicyAdjudicated:true,
  longTDThresholdEvidence:evidence});
}
test('official Sleeper establishes additive passing TD tiers but MSF event proof is still mandatory',()=>{
 const r=certify();
 assert.equal(r.status,'withheld');
 assert.equal(r.reason,'msf_score_certificate_incomplete');
 assert.ok(r.blockers.includes('50_plus_bonus_stacking_or_msf_play_evidence_not_adequately_verified'));
 const verified=certify({evidence:officialEvidence()});
 assert.equal(verified.status,'certified_source_score');
 assert.equal(verified.certificate.points,9.2);
 assert.equal(verified.certificate.longTDBonusPolicySource,
  'official_sleeper_pass_td_stacking_2026_09_17_plus_msf_pbp');
 assert.equal(verified.certificate.certified,true);
});
test('highest-only passing TD score is rejected despite plausible synthetic event counts',()=>{
 const r=certify({policy:'highest_only',evidence:officialEvidence('highest_only')});
 assert.equal(r.status,'withheld');
 assert.ok(r.blockers.includes('official_sleeper_passing_td_40_and_50_bonuses_are_additive'));
 assert.equal(r.certificate,undefined);
});
test('valid additive 50+ play scores base pass TD, passing yards and BOTH 40+/50+ bonuses',()=>{
 const result=certify({evidence:officialEvidence()});
 assert.equal(result.certificate.points,9.2);
 const comps=result.certificate.components;
 const forty=comps.find(x=>x.category==='pass_td_40p');
 const fifty=comps.find(x=>x.category==='pass_td_50p');
 assert.equal(forty.value,1);
 assert.equal(forty.points,1);
 assert.equal(fifty.value,1);
 assert.equal(fifty.points,2);
 assert.equal(forty.points+fifty.points,3);
});
test('50+ provider threshold count cannot exceed verified inclusive 40+ count',()=>{
 const r=certify({componentProof:proofs({pass40:0,pass50:1}),
  evidence:officialEvidence()});
 assert.equal(r.status,'withheld');
 assert.ok(r.blockers.includes('50_plus_long_tds_exceed_verified_40_plus_count'));
});
test('wrong policy source or missing official/PBP corroboration withholds 50+ score',()=>{
 for(const invalid of [
  {...officialEvidence(),verified:false},
  {...officialEvidence(),independentMSFEventsReconciled:false},
  {...officialEvidence(),thresholdCountMode:'exclusive_40_to_49'},
  {...officialEvidence(),source:'unknown_sleeper_guess'},
  {...officialEvidence(),adjudicatedPolicy:'highest_only'}
 ]){
  const r=certify({evidence:invalid});
  assert.equal(r.status,'withheld',JSON.stringify(invalid));
 }
});
test('verified 40–49 TD without any 50+ count remains scoreable under additive rules',()=>{
 const r=certify({componentProof:proofs({pass40:1,pass50:0})});
 assert.equal(r.status,'certified_source_score');
 assert.equal(r.certificate.points,7.2);
 assert.equal(r.certificate.longTDBonusPolicySource,
  'no_50_plus_long_touchdown_in_verified_game');
});
test('official passing-only language does not falsely adjudicate 50+ rushing or receiving TDs',()=>{
 const components=[
  {category:'rec_td_40p',value:1,weight:1,points:1,source:'msf_reconciled_pbp'},
  {category:'rec_td_50p',value:1,weight:2,points:2,source:'msf_reconciled_pbp'}
 ];
 const notYet=reconcileLongTDComponents643({
  components,bonusPolicy:'additive',thresholdEvidence:officialEvidence()
 });
 assert.equal(notYet.accepted,false);
 const futureIndependentEvidence={...officialEvidence(),
  source:'commissioner_ffl_scoring_semantics_plus_msf_pbp'};
 const conditional=reconcileLongTDComponents643({
  components,bonusPolicy:'additive',thresholdEvidence:futureIndependentEvidence
 });
 assert.equal(conditional.accepted,true);
 assert.equal(conditional.components.reduce((sum,c)=>sum+c.points,0),3);
});
test('zero-count verified PBP never becomes invented 50+ fantasy points',()=>{
 const c=[
  {category:'pass_td_40p',value:0,weight:1,points:0,source:'msf_reconciled_pbp'},
  {category:'pass_td_50p',value:0,weight:2,points:0,source:'msf_reconciled_pbp'}
 ];
 const result=reconcileLongTDComponents643({components:c,bonusPolicy:'additive'});
 assert.equal(result.accepted,true);
 assert.equal(result.components.reduce((sum,x)=>sum+x.points,0),0);
 assert.equal(result.approvedFFLBonusPolicy,false);
});
