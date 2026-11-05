import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
const source=readFileSync(new URL('./ffo-pfo-611.js',import.meta.url),'utf8');
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
test('automatic independent MSF loader is included after core hydration',()=>{
 assert.match(html,/ffo-pfo-core\.js\?v=(?:690|614)/);
 assert.match(html,/ffo-pfo-611\.js\?v=611/);
 assert.ok(html.indexOf('ffo-pfo-611.js')>html.indexOf('ffo-pfo-core.js'));
 assert.match(source,/loadLiveRoster=function/);
 assert.match(source,/pfo50LoadIndependent\(changed\)/);
 assert.match(source,/initial-visible-workspace/);
 assert.match(source,/roster-ready/);
 assert.match(source,/return-to-app/);
 assert.match(source,/periodic-staleness/);
 assert.doesNotMatch(source,/sleeper.*projection/i);
});
test('loaded roster automatically starts independent stats without any manual button click',async()=>{
 const timers=[],events={};let calls=0;
 const roster={roster_id:1,players:[{player_id:'123',name:'Demo QB',team:'KC',position:'QB'}],starters:['123']};
 const doc={
  readyState:'loading',hidden:false,querySelector:s=>s.includes('.page.active')?{}:null,
  querySelectorAll:()=>[],getElementById:()=>null,
  addEventListener:(type,fn)=>{events[type]=fn}
 };
 const ctx=createContext({
  console,Promise,Number,Date,Map,Set,
  window:{dbLeagueId:'example'},
  document:doc,
  liveRosterSnapshot:roster,
  loadLiveRoster:async()=>roster,
  pfo50LoadIndependent:async()=>{calls++;return {source:'MySportsFeeds'}},
  setTimeout:fn=>{timers.push(fn);return timers.length},
  setInterval:()=>1,
  pfo52Cur:()=>9,
  pfo52Info:()=>({name:'Demo QB',position:'QB'}),
  pfo52Pos:()=> 'QB',pfo52Points:()=>({points:12}),
  pfo52RosterPoints:()=>{},pfo52Render:()=>{}
 });
 new Script(source).runInContext(ctx);
 assert.equal(calls,0);
 events.DOMContentLoaded();
 for(let i=0;i<5;i++){
  const now=timers.splice(0);
  for(const fn of now)fn();
  await Promise.resolve();
 }
 assert.equal(calls,1,'MSF stats should start automatically once a roster exists');
});
