import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findTradeResearch,findWaiverResearch,compareWaiverSwap} from './ffo-market-finder-61.mjs';
const slots=['QB','RB','WR','FLEX','TE','K','DEF'];
const ours=['q1','r1','w1','t1','k1','d1','r2','w2','r3'];
const theirs=['q2','r4','w4','t2','k2','d2','r5','w3','r6'];
const value={q1:20,r1:15,w1:12,t1:8,k1:7,d1:6,r2:10,w2:7,r3:4,
 q2:19,r4:16,w4:11,t2:8,k2:7,d2:6,r5:9,w3:11,r6:3,w5:13};
const position=x=>({q:'QB',r:'RB',w:'WR',t:'TE',k:'K',d:'DEF'})[x[0]];
const names=Object.fromEntries(Object.keys(value).map(x=>[x,{name:'Player '+x,position:position(x),team:'GB',active:true}]));
const rosters=[
 {roster_id:1,players:ours,reserve:[],starters:['q1','r1','w1','r2','t1','k1','d1']},
 {roster_id:3,players:['q3'],reserve:[]},
 {roster_id:5,players:theirs,reserve:[]}
];
const opts=()=>({rosters,names,estimate:id=>value[id]??null,
 ownerRosterId:'1',excludedRosterIds:['3'],starterSlots:slots,
 snapshotAt:new Date().toISOString(),rulesReady:true,maxResults:12});
test('Finder returns authentic, eligible roster players and excludes reserved partner 3',()=>{
 const ideas=findTradeResearch(opts());
 assert.ok(ideas.length>2);
 assert.ok(ideas.every(x=>x.partnerId==='5'));
 assert.ok(ideas.every(x=>x.give.every(p=>ours.includes(p.id))));
 assert.ok(ideas.every(x=>x.take.every(p=>theirs.includes(p.id))));
 assert.ok(ideas.some(x=>x.format==='1 for 1'));
 assert.ok(ideas.some(x=>x.format==='2 for 1'||x.format==='1 for 2'));
 assert.ok(ideas.every(x=>x.acceptanceProbability===null&&x.fairnessConfidence===null));
 assert.ok(ideas.every(x=>x.researchOnly===true));
});
test('Manager filtering and reserve exclusions are enforced across the finder',()=>{
 const args=opts();
 args.rosters=[{...rosters[0],reserve:['r1']},...rosters.slice(1)];
 const ideas=findTradeResearch({...args,selectedPartnerId:'5'});
 assert.ok(ideas.length>0);
 assert.ok(ideas.every(r=>r.give.every(p=>p.id!=='r1')));
 assert.deepEqual(findTradeResearch({...args,selectedPartnerId:'3'}),[]);
});
test('Stale ownership or unknown scoring rules withholds numerical model PPG',()=>{
 const stale=findTradeResearch({...opts(),snapshotAt:'2025-01-01T00:00:00Z'});
 assert.ok(stale.length>0);
 assert.ok(stale.every(x=>x.outgoingPPG===null&&x.incomingPPG===null));
 const noRules=findTradeResearch({...opts(),rulesReady:false});
 assert.ok(noRules.every(x=>x.outgoingPPG===null&&x.warning.includes('not verified')));
});
test('Waiver board only proposes ownership-filtered players and non-automatic research',()=>{
 const available=[{id:'w5',name:'Player w5',position:'WR',team:'GB',modelPPG:13},
 {id:'w1',name:'Rostered player',position:'WR',modelPPG:30}];
 const a=findWaiverResearch({roster:rosters[0],names,unrostered:available,
  estimate:id=>value[id]??null,starterSlots:slots,
  snapshotAt:new Date().toISOString(),rulesReady:true});
 assert.equal(a.length,1);
 assert.equal(a[0].id,'w5');
 assert.ok(a[0].dropOptions.some(x=>x.id==='r3'));
 assert.equal(a[0].faabRecommendation,null);
});
test('Add/drop comparison captures starter effect and withholds gaps instead of zero-filling',()=>{
 const args={roster:rosters[0],addId:'w5',dropId:'r3',names,
  estimate:id=>value[id]??null,starterSlots:slots,
  snapshotAt:new Date().toISOString(),rulesReady:true};
 const result=compareWaiverSwap(args);
 assert.equal(result.status,'conditional');
 assert.equal(result.delta,3);
 assert.equal(compareWaiverSwap({...args,dropId:'nobody'}).status,'invalid');
 assert.equal(compareWaiverSwap({...args,rulesReady:false}).delta,null);
 assert.equal(compareWaiverSwap({...args,estimate:id=>id==='w5'?null:value[id]??null}).delta,null);
});
test('Finder never submits league transactions, relies on Sleeper score endpoints or fabricates acceptance odds',()=>{
 const source=readFileSync(new URL('./ffo-market-finder-61.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/fetch\s*\(|sleeper\.app|submitTrade|claimWaiver|postTrade|writeRoster/);
 assert.match(source,/acceptanceProbability:null/);
});
