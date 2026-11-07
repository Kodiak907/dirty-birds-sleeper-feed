import test from 'node:test';
import assert from 'node:assert/strict';
import {FFL_STARTER_SLOTS,evaluateFFLLineup,compareFFLLineups}
 from './ffo-lineup-reconciliation-643.mjs';
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
const POS=['QB','RB','RB','WR','WR','TE','WR','RB','K','DEF'];
const lineup=()=>FFL_STARTER_SLOTS.map((slot,i)=>({slot,
 playerId:'P'+i,position:POS[i]}));
const proj=(n=10,extra={})=>({
 points:n,rulesVersion:FFL_RULES_VERSION,modelVersion:'PFO-6.36',
 partial:true,certified:false,source:'independent MSF partial',...extra
});
const projections=()=>Object.fromEntries(FFL_STARTER_SLOTS.map((_,i)=>['P'+i,proj(i===9?0:10+i)]));
test('ten exact position slots sum independent FFL model points and explicitly remain partial',()=>{
 const result=evaluateFFLLineup({slots:lineup(),projections:projections()});
 assert.equal(result.numericCovered,10);
 assert.equal(result.missingOrInvalid,0);
 assert.equal(result.knownSubtotal,126);
 assert.equal(result.projectedTotal,126);
 assert.equal(result.partialModels,10);
 assert.equal(result.certified,false);
 assert.equal(result.totalStatus,'complete_numeric_partial_scoring_evidence');
 assert.equal(result.rows[9].points,0,'real 0-point K/DST forecast counts as numeric');
});
test('a single missing projected score never becomes a zero or complete team total',()=>{
 const ps=projections();
 delete ps.P8;
 const result=evaluateFFLLineup({slots:lineup(),projections:ps});
 assert.equal(result.numericCovered,9);
 assert.equal(result.missingOrInvalid,1);
 assert.equal(result.projectedTotal,null);
 assert.equal(result.knownSubtotal,126);
 assert.equal(result.rows[8].points,null);
 assert.ok(result.issueCodes.includes('missing_or_invalid_ffl_projection'));
});
test('a wrong scoring rule version is rejected even when all ten numbers exist',()=>{
 const ps=projections();
 ps.P2=proj(100,{rulesVersion:'generic-PPR'});
 const result=evaluateFFLLineup({slots:lineup(),projections:ps});
 assert.equal(result.projectedTotal,null);
 assert.ok(result.issueCodes.includes('projection_rules_version_mismatch'));
});
test('wrong slot, positional ineligibility, duplicated starter and conflicting surface forecasts block totals',()=>{
 const slots=lineup();
 slots[0].position='WR';
 slots[1].playerId='P0';
 slots[2].projection=proj(555);
 const report=evaluateFFLLineup({slots,projections:projections()});
 assert.equal(report.projectedTotal,null);
 assert.ok(report.issueCodes.includes('starter_position_ineligible'));
 assert.ok(report.issueCodes.includes('duplicate_starter_identity'));
 assert.ok(report.issueCodes.includes('conflicting_projection_across_tools'));
});
test('lineup comparator marks changed slots AND actual players in/out without trading/auto-submitting',()=>{
 const old=lineup(),now=lineup(),ps=projections();
 now[6]={slot:'FLEX',playerId:'NEW',position:'WR'};
 ps.NEW=proj(23);
 const data=compareFFLLineups({submitted:old,optimized:now,projections:ps});
 assert.deepEqual(data.playersOut,['P6']);
 assert.deepEqual(data.playersIn,['NEW']);
 assert.equal(data.changedSlots.length,1);
 assert.equal(data.changedSlots[0].slot,'FLEX');
 assert.equal(data.projectedDelta,7);
 assert.equal(data.dataComplete,true);
 assert.equal(data.autoSubmitsLineup,false);
 assert.equal(data.coachDecisionRequired,true);
 assert.equal(data.uncertifiedScoringEvidence,true);
});
test('never invent a valid optimized comparison when the forecast is unverified',()=>{
 const old=lineup(),now=lineup(),ps=projections();
 now[6]={slot:'FLEX',playerId:'MISSING',position:'WR'};
 const data=compareFFLLineups({submitted:old,optimized:now,projections:ps});
 assert.equal(data.dataComplete,false);
 assert.equal(data.projectedDelta,null);
 assert.equal(data.optimized.projectedTotal,null);
});
