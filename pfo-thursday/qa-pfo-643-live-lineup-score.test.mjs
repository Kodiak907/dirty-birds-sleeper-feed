import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {FFL_STARTER_SLOTS} from './ffo-lineup-reconciliation-643.mjs';
const core=readFileSync(new URL('./ffo-pfo-core.js',import.meta.url),'utf8');
const start=core.indexOf('function pfo52LineupScore(team,assignments,w,past){');
const end=core.indexOf('function pfo52PointLabel(',start);
assert.ok(start>0&&end>start,'actual PFO source scoring function must remain extractable');
const source=core.slice(start,end);
const POS=['QB','RB','RB','WR','WR','TE','WR','RB','K','DEF'];
const slots=()=>FFL_STARTER_SLOTS.map((slot,i)=>({slot,id:'P'+i}));
const person=Object.fromEntries(POS.map((position,i)=>['P'+i,{position}]));
const base=Object.fromEntries(POS.map((_,i)=>['P'+i,i===9?0:10+i]));
const evaluate=(assignments=slots(),points=base)=>{
 const vm=createContext({positions:person,points,submitted:assignments});
 new Script([
  'function pfo52Slots(){return '+JSON.stringify(FFL_STARTER_SLOTS)+';}',
  'function pfo52Info(id){return positions[id]||null;}',
  'function pfo52Legal(slot,p){const pos=p?.position;return slot==="FLEX"?["RB","WR","TE"].includes(pos):slot===pos;}',
  'function pfo52Value(team,id){return Object.hasOwn(points,id)?points[id]:null;}',
  source,
  'this.result=pfo52LineupScore(null,submitted,10,false);'
 ].join('\n')).runInContext(vm,{timeout:1000});
 return vm.result;
};
test('PFO application actual score code uses exactly ten roster slots and preserves valid zero',()=>{
 const result=evaluate();
 assert.equal(result.known,10);
 assert.equal(result.total,126);
 assert.equal(result.subtotal,126);
 assert.equal(result.complete,true);
 assert.equal(result.required,10);
 assert.equal(result.issues.length,0);
});
test('one unknown value blocks full team total but reports numeric subtotal separately',()=>{
 const points={...base};delete points.P9;
 const r=evaluate(slots(),points);
 assert.equal(r.known,9);
 assert.equal(r.complete,false);
 assert.equal(r.total,null);
 assert.equal(r.subtotal,126);
 assert.ok(Array.from(r.issues).includes('independent_projection_unavailable'));
});
test('legacy nine-slot fallback can never be falsely labeled complete',()=>{
 const a=slots().slice(0,9);
 const r=evaluate(a);
 assert.equal(r.complete,false);
 assert.equal(r.total,null);
 assert.equal(r.known,9);
 assert.ok(Array.from(r.issues).includes('ten_official_ffl_starter_slots_required'));
});
test('duplicate starter or wrong slot position blocks total despite 10 numeric points',()=>{
 const a=slots();a[8]={slot:'K',id:'P7'};
 let r=evaluate(a);
 assert.equal(r.complete,false);
 assert.equal(r.total,null);
 assert.ok(Array.from(r.issues).includes('duplicate_starter'));
 a[8]={slot:'K',id:'P8'};a[3]={slot:'RB',id:'P3'};
 r=evaluate(a);
 assert.equal(r.complete,false);
 assert.ok(Array.from(r.issues).includes('starter_slot_order_mismatch'));
});
test('non-finite model values withheld, never interpreted as zero',()=>{
 const points={...base,P2:NaN};
 const r=evaluate(slots(),points);
 assert.equal(r.total,null);
 assert.equal(r.known,9);
 assert.equal(r.subtotal,114);
});
