import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const raw=f=>readFileSync(new URL(f,import.meta.url),'utf8');
const html=raw('./index.html'),js=raw('./showcase.js'),data=JSON.parse(raw('./sample-rosters.json'));
test('showcase retains original PFO visual layout and navigation',()=>{
 assert.match(html,/PRO <span>FRONT OFFICE<\/span>/);
 assert.match(html,/ffo-pfo-core\.css/);
 for(const page of ['overview','roster','scouting','playerhub','gamecast','radar','ask','matchup','coaching','championship','availability','market','privacy'])
  assert.match(html,new RegExp('id="'+page+'"'));
 assert.doesNotMatch(html,/data-page="commissioner"/);
});
test('new demo franchise includes actual sourced NFL names and ten position-legal starters',()=>{
 assert.equal(data.rosters.length,2);
 assert.equal(data.rosters[0].name,'The Front Office Collective');
 assert.equal(data.rosters[0].starters.length,10);
 assert.equal(data.rosters[1].starters.length,10);
 assert.notEqual(data.rosters[0].name,'Dirty Birds');
 const slots=data.roster_slots;
 for(const roster of data.rosters){
  for(let i=0;i<slots.length;i++){
   const id=roster.starters[i],p=data.players[id];
   assert.ok(p&&p.name&&p.position,'every starter has NFL directory identity');
   assert.ok(slots[i]===p.position||(slots[i]==='FLEX'&&['RB','WR','TE'].includes(p.position)),'starter '+p.name+' legal in '+slots[i]);
  }
 }
 assert.ok(Object.values(data.players).some(x=>x.name==='Josh Allen'));
 assert.ok(Object.values(data.players).some(x=>x.name==='Jahmyr Gibbs'));
 assert.ok(Object.values(data.players).some(x=>x.name==='Puka Nacua'));
 assert.ok(data.waivers.length>=8);
});
test('uses real PFO research engines, not a different fake trade engine',()=>{
 assert.match(js,/import \{evaluateFFLTrade,lineupFromFFLResearch\}/);
 assert.match(js,/import \{findWaiverResearch,compareWaiverSwap\}/);
 assert.match(js,/evaluateFFLTrade\(\{/);
 assert.match(js,/findWaiverResearch\(\{/);
 assert.match(js,/compareWaiverSwap\(\{/);
});
test('no real league connectivity, mutations, commissioner access or private snapshots',()=>{
 assert.match(html,/SHOWCASE MODE/);
 assert.match(html,/fictional/i);
 assert.doesNotMatch(js,/https?:\/\/|WebSocket|localStorage|sessionStorage|indexedDB|cookie|\/api\//);
 assert.doesNotMatch(html,/data-page="commissioner"|MSF_API_KEY|dirtybirdstest|\/api\//i);
 assert.doesNotMatch(js,/api\/commissioner|MSF_API_KEY|dirtybirdstest|\/api\//i);
 assert.doesNotMatch(JSON.stringify(data),/1399157532559192064|Dirty Birds|COMMISSIONER|CF_ACCESS|MSF_API_KEY/);
 assert.match(html,/form-action 'none'/);
 assert.match(html,/connect-src 'self'/);
});
