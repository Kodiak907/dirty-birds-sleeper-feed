import test from 'node:test';
import assert from 'node:assert/strict';
import {
 tradeSlotEligibility,validateTradeSelection,lineupFromFFLResearch,evaluateFFLTrade
} from './ffo-trade-decision-60.mjs';
const slots=['QB','RB','WR','FLEX','TE','K','DEF'];
const ours=['q1','r1','w1','t1','k1','d1','r2','w2','r3'];
const theirs=['q2','r4','w4','t2','k2','d2','r5','w3','r6'];
const pos=(p)=>({q:'QB',r:'RB',w:'WR',t:'TE',k:'K',d:'DEF'})[p];
const values={q1:20,r1:15,w1:12,t1:8,k1:7,d1:6,r2:10,w2:7,r3:4,
 q2:19,r4:16,w4:11,t2:8,k2:7,d2:6,r5:9,w3:11,r6:3};
const playerIndex=Object.fromEntries(Object.entries(values).map(([id,ppg])=>[
 id,{name:'Player '+id,ppg,position:pos(id[0]),team:'NFL',injury:null}
]));
const base=()=>({
 ourRoster:ours,theirRoster:theirs,give:['r2'],take:['w3'],
 partnerRosterId:'5',playerIndex,starterSlots:slots,rosterCap:9,
 ruleReady:true,snapshotAt:new Date().toISOString(),ourFAAB:0,theirFAAB:0
});
test('FFL roster slot optimizer fills every starter with disjoint players and maximizes FLEX value',()=>{
 const v=lineupFromFFLResearch(ours,slots,playerIndex);
 assert.equal(v.status,'conditional');
 assert.equal(v.points,78);
 assert.equal(v.starters.length,7);
 assert.equal(v.starters.find(x=>x.slot==='FLEX').id,'r2');
 assert.equal(new Set(v.starters.map(x=>x.id)).size,7);
});
test('FLEX, superflex, K and DEF have correct eligibility, not a simple PPG total',()=>{
 assert.equal(tradeSlotEligibility('FLEX','QB'),false);
 assert.equal(tradeSlotEligibility('FLEX','TE'),true);
 assert.equal(tradeSlotEligibility('SUPER_FLEX','QB'),true);
 assert.equal(tradeSlotEligibility('W/R','TE'),false);
 assert.equal(tradeSlotEligibility('K','DEF'),false);
 assert.equal(tradeSlotEligibility('DEF','D/ST'),true);
});
test('Package PPG is distinct from lineup improvement, and both sides recalculate',()=>{
 const v=evaluateFFLTrade(base());
 assert.equal(v.status,'research_only');
 assert.equal(v.outgoingPPG,10);
 assert.equal(v.incomingPPG,11);
 assert.equal(v.packageNetPPG,1);
 assert.equal(v.starterDelta.ours,1);
 assert.equal(v.starterDelta.theirs,-1);
 assert.equal(v.coverage.present,2);
 assert.equal(v.source.managerAcceptanceProbability,null);
 assert.equal(v.source.productionScoringCertified,false);
 assert.ok(!v.issues.includes('ownership_snapshot_stale_or_undated'));
});
test('3-for-1 roster impacts withhold numeric starter verdict when hypothetical cuts are unresolved',()=>{
 const p=base();p.give=['r2'];p.take=['r5','w3','r6'];
 const v=evaluateFFLTrade(p);
 assert.ok(v.issues.includes('hypothetical_roster_cuts_required'));
 assert.equal(v.rosterCuts.ours,2);
 assert.equal(v.starterDelta.ours,null);
 assert.equal(v.starterDelta.theirs,null);
});
test('Missing forecasts, stale ownership and missing rules never generate an unjustified definite projection',()=>{
 const p=base();p.playerIndex={...playerIndex,r2:{...playerIndex.r2,ppg:null}};
 p.snapshotAt='2025-01-01T00:00:00Z';p.ruleReady=false;
 const v=evaluateFFLTrade(p);
 assert.ok(v.issues.includes('selected_player_projections_incomplete'));
 assert.ok(v.issues.includes('ownership_snapshot_stale_or_undated'));
 assert.ok(v.issues.includes('ffl_rule_feed_not_ready'));
 assert.equal(v.packageNetPPG,null);
 assert.equal(v.starterDelta.ours,null);
});
test('Current Sleeper ownership and roster 3 exclusion are enforced',()=>{
 const p=base();
 assert.ok(validateTradeSelection({...p,partnerRosterId:'3'}).includes('trade_partner_not_eligible'));
 assert.ok(validateTradeSelection({...p,take:['r2']}).includes('incoming_ownership_unverified'));
 assert.ok(validateTradeSelection({...p,give:['r1','r1']}).includes('duplicate_player'));
 assert.ok(validateTradeSelection({...p,give:['r1','r2','w1','w2']}).includes('package_exceeds_player_limit'));
});
test('FAAB is validated separately and never priced using fantasy points or converted to package value',()=>{
 const p=base();p.ourFAAB=15;p.theirFAAB=25;
 const missing=evaluateFFLTrade(p);
 assert.ok(missing.issues.includes('our_faab_balance_unconfirmed'));
 assert.ok(missing.issues.includes('opponent_faab_balance_unconfirmed'));
 assert.equal(missing.packageNetPPG,1);
 p.confirmedOurSpendable=10;p.confirmedTheirSpendable=50;
 const high=evaluateFFLTrade(p);
 assert.ok(high.issues.includes('our_faab_exceeds_spendable'));
 assert.equal(high.faab.netForUs,10);
 p.confirmedOurSpendable=20;
 const verified=evaluateFFLTrade(p);
 assert.equal(verified.faab.ourBalanceVerified,true);
 assert.ok(!verified.issues.includes('our_faab_exceeds_spendable'));
 assert.equal(verified.starterDelta.ours,1);
});
test('A flagged injury is shown for review, not treated as an actual verified inactive or zero points',()=>{
 const p=base();p.playerIndex={...playerIndex,w3:{...playerIndex.w3,injury:'QUESTIONABLE'}};
 const result=evaluateFFLTrade(p);
 assert.equal(result.health.length,1);
 assert.equal(result.health[0].status,'QUESTIONABLE');
 assert.equal(result.outgoingPPG,10);
});
test('Unknown roster cap cannot certify cuts, and unknown starter positions withhold lineup totals',()=>{
 const p=base();p.rosterCap=null;
 const uncertain=evaluateFFLTrade(p);
 assert.equal(uncertain.rosterCuts.ours,null);
 assert.equal(uncertain.starterDelta.ours,null);
 p.starterSlots=[];
 const none=evaluateFFLTrade(p);
 assert.equal(none.before.ours.points,null);
});
test('Engine never reads Sleeper scoring endpoints, private FAAB balances or writes offers',()=>{
 const fs=await import('node:fs');
 const text=fs.readFileSync(new URL('./ffo-trade-decision-60.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(text,/fetch\s*\(|sleeper\.app|writeOffer|submitTrade|postTrade/);
});
