import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarWeek,currentCalendarWeek,gameWeek,scheduleForWeek,groupWeekGames,todayCoverage,preferredGame} from './ffo-gamecast-weeks.mjs';

const early=[
 ['BAL','BUF'],['TEN','CIN'],['ARI','DAL'],['MIN','DET'],
 ['IND','JAX'],['LV','NYJ'],['CLE','PIT'],['ATL','TB']
];
const late=[['LAC','LAR'],['KC','DEN'],['NE','MIA']];
const all=[...early,...late,['PHI','WSH']];
const entries=all.map(([away,home],i)=>({
 id:'w8-'+i,away,home,start:i<8?'2026-11-01T18:00:00Z':
 i<11?'2026-11-01T21:25:00Z':'2026-11-02T01:20:00Z',
 week:i%2?null:8,status:'SCHEDULED',homePoints:null,awayPoints:null
}));
const season=[{id:'w8-thu',week:8,away:'CAR',home:'GB',status:'FINAL',start:'2026-10-30T00:15:00Z'},
 ...entries,{id:'w8-mon',week:8,away:'CHI',home:'SEA',start:'2026-11-03T01:15:00Z'},
 {id:'w9',week:9,away:'JAX',home:'BAL',start:'2026-11-06T01:15:00Z'}];

test('2026 NFL week calendar derives Week 8 on November 1 and Week 9 Nov 5',()=>{
 assert.equal(calendarWeek('2026-11-01T17:00:00Z'),8);
 assert.equal(calendarWeek('2026-11-06T01:15:00Z'),9);
 assert.equal(currentCalendarWeek(new Date('2026-11-01T17:20:00Z')),8);
});
test('Week 8 includes all twelve Sunday games plus Thursday and Monday',()=>{
 const g=scheduleForWeek(season,8);
 assert.equal(g.length,14);
 assert.equal(g.filter(x=>x.weekSource==='calendar_estimate').length,6);
 assert.ok(g.some(x=>x.away==='CHI'&&x.home==='SEA'));
 assert.equal(scheduleForWeek(season,9).length,1);
});
test('Verify twelve source-scheduled Sunday games with independent official slate',()=>{
 const c=todayCoverage(season,new Date('2026-11-01T17:00:00Z'));
 assert.equal(c.day,'2026-11-01');
 assert.equal(c.uniqueMatchups,12);
 assert.equal(c.expectedGames,12);
 assert.equal(c.slateVerified,true);
 assert.deepEqual(c.missing,[]);
 assert.equal(c.playByPlayVerifiedForAllGames,false);
});
test('One missing Sunday matchup explicitly triggers incomplete-slate warning',()=>{
 const without=season.filter(x=>x.away!=='KC');
 const r=todayCoverage(without,new Date('2026-11-01T17:00:00Z'));
 assert.equal(r.slateVerified,false);
 assert.ok(r.missing.includes('KC @ DEN'));
});
test('Do not silently deduplicate provider contradictions or invent scores',()=>{
 const duplicate={...entries[0],homePoints:100};
 const w=scheduleForWeek([...season,duplicate],8);
 assert.equal(w.length,14);
 assert.equal(w.find(x=>x.id===duplicate.id).homePoints,null);
});
test('Day groups are Pacific-local, including Sunday night game',()=>{
 const {earlier,today,upcoming}=groupWeekGames(scheduleForWeek(season,8),new Date('2026-11-01T19:00:00Z'));
 assert.equal(earlier.length,1);
 assert.equal(today.length,12);
 assert.equal(upcoming.length,1);
 assert.ok(today.some(x=>x.away==='PHI'&&x.home==='WSH'));
});
test('Live game preference never implies every game has source PBP',()=>{
 const g=scheduleForWeek(season,8);
 g.find(x=>x.away==='BAL').status='LIVE';
 assert.equal(preferredGame(g,new Date('2026-11-01T19:00:00Z')).away,'BAL');
});
test('Invalid provider week falls back to calendar and never certifies that week',()=>{
 const r=gameWeek({week:31,start:'2026-11-01T18:00:00Z'});
 assert.equal(r.week,8);
 assert.equal(r.source,'calendar_estimate');
 assert.equal(gameWeek({start:null}).week,null);
});
