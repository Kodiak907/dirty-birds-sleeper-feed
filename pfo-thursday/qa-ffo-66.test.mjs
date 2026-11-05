import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {modeledStarterTotal,screenTradePackages} from './ffo-market-quality-63.mjs';
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const core=read('./ffo-pfo-core.js'),sit=read('./ffo-startsit-63.js');
const extract=core.match(/function pfo66WeekAt\([\s\S]*?\n}\n/);
assert.ok(extract,'Pure Pacific rollover helper must be present');
const weekAt=new Function(extract[0]+';return pfo66WeekAt;')();
test('2026 Pacific Tuesday 08:30 boundary moves Week 8 to Week 9 independent of stale NFL provider week',()=>{
 assert.equal(weekAt(new Date('2026-11-03T16:29:00Z'),2026,8),8);
 assert.equal(weekAt(new Date('2026-11-03T16:30:00Z'),2026,8),9);
 assert.equal(weekAt(new Date('2026-11-04T23:59:00Z'),2026,8),9);
 assert.equal(weekAt(new Date('2026-11-02T21:00:00Z'),2026,8),8);
 assert.equal(weekAt(new Date('2026-10-27T15:30:00Z'),2026,7),8);
});
test('Pacific rollover is DST-aware and does not silently extend schedule to other unverified seasons',()=>{
 assert.equal(weekAt(new Date('2026-09-15T15:29:00Z'),2026,1),1);
 assert.equal(weekAt(new Date('2026-09-15T15:30:00Z'),2026,1),2);
 assert.equal(weekAt(new Date('2027-11-03T18:00:00Z'),2027,11),11);
});
test('User selected historical week remains selectable; returning to Matchup defaults to live research week',()=>{
 assert.match(core,/pfo52ManualWeek=true;pfo52Week=/);
 assert.match(core,/pfo52ManualWeek=false;pfo52Week=pfo52Cur\(\);pfo52Render/);
 assert.match(core,/const w=pfo52Week,current=pfo52Cur\(\),past=w<current/);
 assert.match(core,/pfo52GetWeek\(pfo52Week\)/);
});
test('Bench and IR remain distinct, including when directory tags differ from fantasy reserve slots',()=>{
 assert.match(core,/const bench=players\.filter\(p=>!starterIds\.has/);
 assert.match(core,/const reservePlayers=players\.filter/);
 assert.match(core,/Directory IR\/PUP tags/);
 assert.match(core,/class="pfo64-bench"/);
 assert.match(core,/class="pfo64-reserve"/);
 assert.match(core,/knownReserve\|\|tagged\.size/);
 assert.match(core,/filter\(p=>!reserved\.has\(String\(p\.id\|\|p\.player_id\)\)/);
});
test('Start/Sit opens directly from rostered players without Market advisory hydration',()=>{
 assert.match(sit,/typeof liveRosterSnapshot/);
 assert.match(sit,/typeof gm47Snapshot/);
 assert.doesNotMatch(sit,/marketResearchContext|loadAdvisory|refreshAdvisory/);
 assert.match(sit,/requestAnimationFrame/);
 assert.match(sit,/data-pfo63-horizon/);
 assert.match(sit,/fantasy-reserve player/);
});
test('Lineup impact rejects misleading sums and does not require kicker or D/ST estimates for skill-player trades',()=>{
 const names={
  qb:{position:'QB'},rb1:{position:'RB'},rb2:{position:'RB'},rb3:{position:'RB'},
  wr1:{position:'WR'},wr2:{position:'WR'},te:{position:'TE'},k:{position:'K'},dst:{position:'DEF'}};
 const values={qb:20,rb1:17,rb2:11,rb3:9,wr1:15,wr2:10,te:8,k:null,dst:null};
 const slots=['QB','RB','RB','WR','WR','TE','FLEX','K','DEF'];
 const base=['qb','rb1','rb2','rb3','wr1','wr2','te','k','dst'];
 const result=modeledStarterTotal(base,names,p=>values[p],slots);
 assert.equal(result,90);
 const upgraded=modeledStarterTotal(base.concat('rb4'),{...names,rb4:{position:'RB'}},p=>p==='rb4'?19:values[p],slots);
 assert.equal(upgraded,100);
});
test('No unpriced fair or fleece deal claims a certified result',()=>{
 const rows=screenTradePackages({rosters:[],names:{},starterSlots:[]});
 assert.deepEqual(rows.results,[]);
});
