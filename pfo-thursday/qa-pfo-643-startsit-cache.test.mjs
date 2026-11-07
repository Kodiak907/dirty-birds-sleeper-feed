import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const source=readFileSync(new URL('./ffo-pfo-core.js',import.meta.url),'utf8');
const a=source.indexOf('let pfo52AllowanceRows=null,pfo52AllowanceCache=new Map();');
const b=source.indexOf('function pfo52Value(',a);
assert.ok(a>0&&b>a,'source contains actual 6.43 memoized opponent allowance');
const code=source.slice(a,b);
const teams='ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' ');
const model=(multiplier=1)=>teams.map((team,i)=>({name:'player-'+team,position:'QB',
 games:[1,2,3].map(week=>({week,opponent:team,stats:{pts:(i+1)*(team==='DAL'?multiplier:1)}}))}));
function setup(){
 const ctx=createContext({calls:0,
  pfo50Independent:{players:model()},
  window:{ffoPfo597:{hasFrozenRules:()=>true}},
  gm47CanonicalTeam:t=>String(t).toUpperCase(),
  pfo50Score:s=>{ctx.calls++;return s?.pts??null}
 });
 new Script(code+'\nthis.allowance=pfo52DefenseAdjustment;').runInContext(ctx);
 return ctx;
}
test('first provider-specific opponent adjustment applies original shrunk and clamped equation',()=>{
 const ctx=setup();
 const data=ctx.allowance('QB','DAL');
 const expected=1+.25*(9/16.5-1);
 assert.ok(Math.abs(data-expected)<1e-9);
 assert.equal(ctx.calls,teams.length*3);
});
test('repeated Start/Sit selection reuses prior licensed-stat computation instead of refetching/reducing 96 rows per tap',()=>{
 const ctx=setup();
 const first=ctx.allowance('QB','DAL'),calls=ctx.calls;
 for(let i=0;i<20;i++)assert.equal(ctx.allowance('QB','DAL'),first);
 assert.equal(ctx.calls,calls,'same provider data must not repeatedly recompute');
});
test('new provider season source array invalidates cache, preserving model correctness',()=>{
 const ctx=setup(),first=ctx.allowance('QB','DAL'),n=ctx.calls;
 ctx.pfo50Independent={players:model(4)};
 const second=ctx.allowance('QB','DAL');
 assert.notEqual(first,second);
 assert.ok(ctx.calls>n);
});
test('missing frozen FFL rules never computes/caches an unverified defensive adjustment',()=>{
 const ctx=setup();
 ctx.window.ffoPfo597.hasFrozenRules=()=>false;
 assert.equal(ctx.allowance('QB','DAL'),null);
 assert.equal(ctx.calls,0);
 ctx.window.ffoPfo597.hasFrozenRules=()=>true;
 assert.notEqual(ctx.allowance('QB','DAL'),null);
 assert.equal(ctx.calls,teams.length*3);
});
test('unsupported positions and unknown opponents do not invent defense adjustments',()=>{
 const ctx=setup();
 assert.equal(ctx.allowance('K','DAL'),null);
 assert.equal(ctx.allowance('QB','XYZ'),null);
});
