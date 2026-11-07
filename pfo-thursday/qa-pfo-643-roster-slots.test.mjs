import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
import {FFL_STARTER_SLOTS} from './ffo-lineup-reconciliation-643.mjs';
const read=name=>readFileSync(new URL('./'+name,import.meta.url),'utf8');
const core=read('ffo-pfo-core.js');
const src=core.match(/function pfo52Slots\(\)\{[\s\S]*?\}\nfunction pfo52Pos/);
assert.ok(src,'actual application lineup slot function found');
function slots(rosterPositions){
 const context=createContext({gm47Snapshot:rosterPositions?{
  league:{roster_positions:rosterPositions}
 }:null});
 new Script(src[0].replace(/\nfunction pfo52Pos$/,'')+'\nthis.slots=pfo52Slots();')
 .runInContext(context);
 return [...context.slots];
}
test('actual PFO default when league settings are missing has exactly ten official slots, including two flex',()=>{
 assert.deepEqual(slots(null),[...FFL_STARTER_SLOTS]);
});
test('official server league slots override fallback; bench and IR are excluded',()=>{
 const official=['QB','RB','RB','WR','WR','TE','FLEX','FLEX','K','DEF',
  'BN','BN','BN','IR'];
 assert.deepEqual(slots(official),[...FFL_STARTER_SLOTS]);
});
test('existing Pacific Tuesday 08:30 rollover has its separate immutable regression',()=>{
 assert.match(core,/function pfo66WeekAt\(/);
 const qa=read('qa-ffo-66.test.mjs');
 assert.match(qa,/2026 Pacific Tuesday 08:30 boundary/);
});
