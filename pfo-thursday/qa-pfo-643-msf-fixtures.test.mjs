import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMSF2026Fixtures,selectEligiblePregameFixtures}
 from './ffo-msf-fixtures-643.mjs';
import {validatePregameCapture,runPregameCapture,FFL_RULES_VERSION}
 from './ffo-pregame-capture-638.mjs';

const now=new Date('2026-11-08T18:00:00Z');
const evidence={provider:'MSF',authenticatedByServer:true,httpStatus:200,season:2026,
 endpoint:'/2026-regular/games.json',fetchedAtUtc:'2026-11-08T17:59:00Z'};
const game=(id,start,status='NOT_STARTED')=>({schedule:{id,week:10,
 homeTeam:{abbreviation:'BUF'},awayTeam:{abbreviation:'MIA'},
 playedStatus:status,startTime:start}});
const normalize=(games,ev=evidence)=>normalizeMSF2026Fixtures({
 payload:{games},evidence:ev,serverNow:now
});
test('trusted scheduled MSF game becomes verified fixture; exact 25-minute window is eligible',()=>{
 const data=normalize([game('g101','2026-11-08T18:25:00Z')]);
 assert.equal(data.status,'fixture_identity_normalized');
 assert.equal(data.fixtures.length,1);
 const g=data.fixtures[0];
 assert.equal(g.gameId,'g101');
 assert.equal(g.week,10);
 assert.equal(g.provider,'MSF');
 assert.equal(g.verified,true);
 assert.equal(g.kickoffAt,'2026-11-08T18:25:00.000Z');
 assert.equal(g.status,'NOT_STARTED');
 const due=selectEligiblePregameFixtures(data.fixtures,{serverNow:now});
 assert.equal(due.status,'eligible_window_found');
 assert.deepEqual(due.eligible.map(g=>g.gameId),['g101']);
});
test('authenticated MSF provenance is required: no browser-asserted or stale fixture',()=>{
 for(const ev of [
  {...evidence,authenticatedByServer:false},
  {...evidence,httpStatus:403},
  {...evidence,provider:'Sleeper'},
  {...evidence,endpoint:'/untrusted/games.json'},
  {...evidence,fetchedAtUtc:'2026-11-08T17:40:00Z'}
 ]){
  const data=normalize([game('g101','2026-11-08T18:25:00Z')],ev);
  assert.equal(data.status,'blocked');
  assert.equal(data.fixtures.length,0);
 }
});
test('missing timezone, kickoff, duplicate conflicting IDs, wrong week or wrong year withheld',()=>{
 const games=[
  game('badclock','2026-11-08T18:25:00'), // cannot infer location timezone
  game('missing',null),
  {...game('badweek','2026-11-08T18:25:00Z'),schedule:{...game('x','2026-11-08T18:25:00Z').schedule,week:19,id:'badweek'}},
  {...game('badyear','2026-11-08T18:25:00Z'),schedule:{...game('x','2026-11-08T18:25:00Z').schedule,season:2025,id:'badyear'}},
  game('collision','2026-11-08T18:25:00Z'),
  game('collision','2026-11-08T19:25:00Z')
 ];
 const result=normalize(games);
 assert.equal(result.fixtures.length,0);
 assert.ok(result.withheld>=6);
 assert.ok(result.issues.includes('conflicting_duplicate_provider_game_id'));
});
test('a completed game is never accepted for live pregame capture',()=>{
 const data=normalize([game('final1','2026-11-08T18:25:00Z','COMPLETED')]);
 assert.equal(data.fixtures[0].status,'FINAL');
 const due=selectEligiblePregameFixtures(data.fixtures,{serverNow:now});
 assert.equal(due.eligible.length,0);
 assert.equal(due.withheld[0].reason,'unverified_or_nonpregame_fixture');
 assert.equal(data.finalFantasyScoresVerified,false);
});
test('missed 15-minute lead and too-early 7-day snapshots are refused',()=>{
 const data=normalize([
  game('tooLate','2026-11-08T18:14:59Z'),
  game('rightAt15','2026-11-08T18:15:00Z'),
  game('rightAt30','2026-11-08T18:30:00Z'),
  game('tooEarly','2026-11-09T01:15:00Z')
 ]);
 const due=selectEligiblePregameFixtures(data.fixtures,{serverNow:now});
 assert.deepEqual(due.eligible.map(x=>x.gameId),['rightAt15','rightAt30']);
 assert.equal(due.withheld.length,2);
 assert.equal(due.cutoffMinutes,15);
});
test('normalization output can enter existing immutable capture validator, no writer enabled',()=>{
 const data=normalize([game('g101','2026-11-08T18:25:00Z')]);
 const gameRecord=data.fixtures[0];
 const forecast={provider:'PFO',scoringSystem:'FFL',rulesVersion:FFL_RULES_VERSION,
  sourceProvider:'MSF',fromSleeperActual:false,afterGameKnowledge:false,
  gameId:gameRecord.gameId,week:gameRecord.week,
  playerId:'player_100',position:'RB',team:'BUF',opponent:'MIA',
  modelVersion:'pfo-6.36-source-parity-PENDING',points:12.5,
  asOfUtc:'2026-11-08T17:59:00Z',partial:true,certified:false};
 const result=validatePregameCapture({forecast,game:gameRecord,serverNow:now});
 assert.equal(result.accepted,true);
 assert.equal(result.record.kickoffAt,'2026-11-08T18:25:00.000Z');
 assert.equal(result.record.certified,false);
});

test('capture runner refuses a seven-day-early fixture before calling any model or storage',async()=>{
 let forecastCalls=0,writeCalls=0;
 const db={prepare(){writeCalls++;throw Error('writes must be skipped')}};
 const gameRecord=normalize([game('g101','2026-11-08T18:25:00Z')]).fixtures[0];
 const result=await runPregameCapture({db,serverNow:new Date('2026-11-06T18:00:00Z'),
  gameFeed:async()=>[gameRecord],
  forecastFeed:async()=>{forecastCalls++;return [];}});
 assert.equal(result.status,'no_eligible_kickoff_windows');
 assert.equal(result.captured,0);
 assert.equal(forecastCalls,0);
 assert.equal(writeCalls,0);
});

test('actual MSF UNPLAYED status maps to verified not-started pregame capture eligibility',()=>{
 const data=normalize([game('msf-unplayed','2026-11-08T18:25:00Z','UNPLAYED')]);
 assert.equal(data.status,'fixture_identity_normalized');
 assert.equal(data.fixtures[0].status,'NOT_STARTED');
 assert.equal(selectEligiblePregameFixtures(data.fixtures,{serverNow:now}).eligible.length,1);
});
test('MSF postponement, active gameplay and postgame review cannot be captured as pregame',()=>{
 const postponed=game('postponed','2026-11-08T18:25:00Z','UNPLAYED');
 postponed.schedule.scheduleStatus='POSTPONED';
 const rows=[
  postponed,
  game('inprogress','2026-11-08T18:25:00Z','IN_PROGRESS'),
  game('reviewing','2026-11-08T18:25:00Z','POSTGAME_REVIEWING')
 ];
 const out=normalize(rows);
 assert.equal(out.fixtures.length,0);
 assert.equal(out.withheld,3);
 const due=selectEligiblePregameFixtures(out.fixtures,{serverNow:now});
 assert.equal(due.eligible.length,0);
});
