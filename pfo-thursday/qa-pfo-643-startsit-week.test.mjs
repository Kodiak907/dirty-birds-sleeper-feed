import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const file=readFileSync(new URL('./ffo-startsit-63.js',import.meta.url),'utf8');
const a=file.indexOf(' const weekNow=()=>');
const b=file.indexOf(' const pos=p=>',a);
assert.ok(a>=0&&b>a,'extract current Start/Sit week selection from real UI');
const actual=file.slice(a,b);
function select({explicit=null,manual=false,selected=8,canonical=9,provider=8}={}){
 const context=createContext({state:{week:explicit},
  pfo52ManualWeek:manual,pfo52Week:selected,
  pfo52Cur:()=>canonical,window:{dbNflWeek:provider}});
 new Script(actual+'\nthis.week=weekNow();').runInContext(context);
 return context.week;
}
test('Start/Sit uses canonical 2026 Pacific rollover not stale displayed week',()=>{
 assert.equal(select({selected:8,canonical:9,manual:false,provider:8}),9);
});
test('manual matchup week is honored when explicitly selected',()=>{
 assert.equal(select({selected:7,canonical:9,manual:true}),7);
});
test('explicit Start/Sit API week overrides both canonical and manually selected week',()=>{
 assert.equal(select({explicit:12,selected:7,canonical:9,manual:true}),12);
});
test('fallback to provider week only if no canonical or valid selector exists',()=>{
 const c=createContext({state:{week:null},window:{dbNflWeek:10}});
 new Script(actual+'\nthis.week=weekNow();').runInContext(c);
 assert.equal(c.week,10);
});
test('the core Pacific rollover rule and Start/Sit share the same canonical selector',()=>{
 const core=readFileSync(new URL('./ffo-pfo-core.js',import.meta.url),'utf8');
 assert.match(core,/function pfo66WeekAt\(/);
 assert.match(core,/function pfo52Cur\(\)\{return pfo66WeekAt/);
 assert.match(actual,/typeof pfo52Cur==='function'\?pfo52Cur\(\)/);
});
