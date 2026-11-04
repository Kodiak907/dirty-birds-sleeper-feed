import test from 'node:test';
import assert from 'node:assert/strict';
import {screenTradePackages,recommendWaiverPairs} from './ffo-market-quality-63.mjs';
import {readFileSync} from 'node:fs';
const slots=['QB','RB','RB','WR','WR','TE','FLEX','K','DEF'];
const yours=['q1','r1','r2','r3','w1','w2','w3','w4','w9','t1','t2','k1','d1'];
const theirs=['q2','r4','r5','r6','r7','r8','w5','w6','w7','t3','t4','k2','d2'];
const amounts={q1:23,q2:21,r1:17,r2:10,r3:9,r4:15,r5:12,r6:9,r7:6,r8:8,
 w1:19,w2:14,w3:11,w4:6,w9:9,w5:20,w6:15,w7:11,w8:16,
 t1:9,t2:5,t3:10,t4:7,k1:7,k2:6,d1:6,d2:6};
const pos=id=>({q:'QB',r:'RB',w:'WR',t:'TE',k:'K',d:'DEF'})[id[0]];
const names=Object.fromEntries(Object.keys(amounts).map(x=>[x,{name:'Fixture '+x,position:pos(x),team:'DEN'}]));
const roster1={roster_id:1,players:yours,reserve:[],starters:['q1','r1','r2','w1','w2','t1','w3','k1','d1']};
const roster5={roster_id:5,players:theirs,reserve:[],starters:['q2','r4','r5','w5','w6','t3','r6','k2','d2']};
const rosters=[roster1,{roster_id:3,players:[]},roster5];
const estimate=id=>amounts[id]??null;
const base=()=>({rosters,names,estimate,ownerRosterId:'1',excludedRosterIds:['3'],
 starterSlots:slots,snapshotAt:new Date().toISOString(),rulesReady:true});
test('Screened Trade Finder ranks covered two-sided roster-fit packages rather than unpriced junk',()=>{
 const r=screenTradePackages(base());
 assert.ok(r.diagnostics.considered>0);
 assert.ok(r.results.length>0,'Expected covered reciprocal WR/RB trade research');
 for(const row of r.results){
  assert.equal(row.partnerId,'5');
  assert.equal(row.completeness,(row.give.length+row.take.length)+'/'+(row.give.length+row.take.length));
  assert.ok(row.give.every(x=>yours.includes(x.id)));
  assert.ok(row.take.every(x=>theirs.includes(x.id)));
  assert.ok(!row.give.some(x=>x.position==='K'||x.position==='DEF'));
  assert.ok(row.balanced);
  assert.equal(row.acceptanceProbability,null);
  assert.equal(row.fairnessConfidence,null);
 }
});
test('Protections and manager-scoped untouchable players are hard exclusions',()=>{
 const a=screenTradePackages({...base(),protectedMine:['w1'],protectedByManager:{'5':['r4']}});
 assert.ok(a.results.every(r=>r.give.every(p=>p.id!=='w1')&&r.take.every(p=>p.id!=='r4')));
 assert.deepEqual(screenTradePackages({...base(),selectedPartnerId:'3'}).results,[]);
});
test('Uncertified or missing model estimates never become fair trade suggestions',()=>{
 const noRules=screenTradePackages({...base(),rulesReady:false});
 assert.equal(noRules.results.length,0);
 assert.match(noRules.diagnostics.reason,/not_ready/);
 const missing=screenTradePackages({...base(),estimate:()=>null});
 assert.equal(missing.results.length,0);
 assert.equal(missing.diagnostics.priced,0);
});
test('Automatic waiver pairs choose a covered bench drop without asking the manager',()=>{
 const r=recommendWaiverPairs({...base(),roster:roster1,
  unrostered:[{id:'w8',name:'Fixture w8',position:'WR',team:'DEN',modelPPG:16}]});
 assert.ok(r.results.length>0);
 const row=r.results[0];assert.equal(row.id,'w8');
 assert.ok(row.selectedDrop&&yours.includes(row.selectedDrop.id));
 assert.ok(!roster1.starters.includes(row.selectedDrop.id));
 assert.ok(typeof row.modelGap==='number');
 assert.equal(row.faabRecommendation,null);
 assert.equal(row.researchOnly,true);
});
test('No automatic drops of protected assets, current starters, or uncovered players',()=>{
 const a=recommendWaiverPairs({...base(),roster:roster1,
  unrostered:[{id:'w8',name:'Fixture w8',position:'WR',team:'DEN'}],
  protectedMine:yours.filter(id=>!roster1.starters.includes(id))});
 assert.equal(a.results.length,0);
 const b=recommendWaiverPairs({...base(),roster:roster1,
  unrostered:[{id:'w8',name:'Fixture w8',position:'WR',team:'DEN'}],estimate:()=>null});
 assert.equal(b.results.length,0);
});
test('No write endpoints, fake odds or speculative FFOI results in the new research engine',()=>{
 const js=readFileSync(new URL('./ffo-market-quality-63.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(js,/fetch\s*\(|submitTrade|claimWaiver|sleeper\.app|Math\.random\(/);
 assert.match(js,/acceptanceProbability:null/);
});

test('Officially blocked and unresolved injured players are excluded from automatic trade candidates',()=>{
 const changed={...names,w1:{...names.w1,injury_status:'Out'}};
 const report=screenTradePackages({...base(),names:changed,
  availability:(id)=>({standardEligible:id!=='r4'})});
 assert.ok(report.results.every(r=>
  r.give.every(p=>p.id!=='w1')&&r.take.every(p=>p.id!=='r4')));
});

test('Independent trade screens expose fair, favorable ask, and multi-player selection modes',()=>{
 const fair=screenTradePackages({...base(),mode:'FAIR'});
 assert.ok(fair.diagnostics.considered>0);
 assert.ok(fair.results.every(x=>x.balanced&&x.mode==='FAIR'));
 const fleece=screenTradePackages({...base(),mode:'FLEECE'});
 assert.ok(fleece.results.every(x=>x.favorableToUs&&x.needs.theirs>0&&x.mode==='FLEECE'));
 const multi=screenTradePackages({...base(),mode:'MULTI',shapeFilter:'2 for 2'});
 assert.ok(multi.results.every(x=>x.format==='2 for 2'&&x.give.length+x.take.length>=3));
 const incompatible=screenTradePackages({...base(),mode:'MULTI',shapeFilter:'1 for 1'});
 assert.equal(incompatible.diagnostics.considered,0);
 assert.equal(incompatible.results.length,0);
});
test('Favorable research asks make no claims about acceptance or executable transactions',()=>{
 const report=screenTradePackages({...base(),mode:'FLEECE',preferUneven:true});
 assert.ok(report.results.every(x=>x.acceptanceProbability===null&&x.fairnessConfidence===null&&x.researchOnly));
});
