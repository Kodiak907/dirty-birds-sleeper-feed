import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const source=readFileSync(new URL('./ffo-overview-62.js',import.meta.url),'utf8');
const start=source.indexOf(' function pfo643OverviewCoverage(');
const end=source.indexOf(' function brief(){',start);
assert.ok(start>=0&&end>start,'extract actual Overview function from browser');
const body=source.slice(start,end);
const vm=createContext({});
new Script(body+'\nthis.audit=pfo643OverviewCoverage;').runInContext(vm);
const audit=vm.audit;
const lineup=Array.from({length:10},(_,i)=>'S'+i);
const points=Array.from({length:10},(_,i)=>i===9?0:10+i);
test('all ten DISTINCT submitted FFL slots and ten numeric projections show full provisional total',()=>{
 const r=audit(lineup,points);
 assert.equal(r.covered,true);
 assert.equal(r.projected,126);
 assert.equal(r.measured.length,10);
 assert.equal(r.required,10);
 assert.equal(r.distinctStarterSlots,true);
});
test('nine numeric submitted starters must never be called ten of ten',()=>{
 const r=audit(lineup.slice(0,9),points.slice(0,9));
 assert.equal(r.covered,false);
 assert.equal(r.projected,null);
 assert.equal(r.measured.length,9);
 assert.equal(r.required,10);
});
test('duplicate player identity and empty Sleeper slot do not masquerade as complete',()=>{
 for(const ids of [
  [...lineup.slice(0,9),lineup[0]],
  [...lineup.slice(0,9),'0'],
  [...lineup.slice(0,9),'']
 ]){
  const r=audit(ids,points);
  assert.equal(r.covered,false);
  assert.equal(r.projected,null);
 }
});
test('a real independently modelled zero is valid; unknown is not auto-zero',()=>{
 assert.equal(audit(lineup,points).covered,true);
 const missing=[...points];missing[9]=null;
 const r=audit(lineup,missing);
 assert.equal(r.covered,false);
 assert.equal(r.projected,null);
 assert.equal(r.measured.length,9);
 const missingNaN=[...points];missingNaN[0]=Number.NaN;
 assert.equal(audit(lineup,missingNaN).covered,false);
});
test('extra non-official starting slot and numerical score strings are blocked',()=>{
 assert.equal(audit([...lineup,'EXTRA'],[...points,12]).covered,false);
 const stringProjection=[...points];stringProjection[1]='11';
 assert.equal(audit(lineup,stringProjection).covered,false);
});
test('actual overview implementation uses one PFO source and full ten-slot denominator',()=>{
 assert.match(source,/typeof pfo52Points==='function'\?pfo52Points/);
 assert.match(source,/pfo643OverviewCoverage\(starters,values\)/);
 assert.match(source,/measured.length\+'\/10'/);
 assert.match(source,/Submitted starter slots are incomplete or duplicated/);
 assert.doesNotMatch(source,/covered=values.length>0&&measured.length===values.length/);
 new Script(source,{filename:'ffo-overview-62.js'});
});
