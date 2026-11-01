// Read-only matchup coverage QA: synthetic MSF fixtures, zero live provider requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {planHistoricalMatchups,summarizeHistoricalMatchups,nextHistoricalMatchupBatch}
 from './ffo-historical-matchup-tracker.mjs';

const records=[
 {id:'w1a',week:1,weekVerified:true,home:'GB',away:'CHI',status:'COMPLETED'},
 {id:'w1b',week:1,weekVerified:true,home:'BUF',away:'NYJ',status:'FINAL'},
 {id:'w2a',week:2,weekVerified:true,home:'GB',away:'MIN',status:'COMPLETED'},
 {id:'w3a',week:3,weekVerified:true,home:'SF',away:'GB',status:'IN_PROGRESS'},
 {id:'w4a',week:4,weekVerified:false,home:'SEA',away:'GB',status:'FINAL'},
 {id:'w5a',week:5,home:'CHI',away:'GB',status:'FINAL'},
 {id:'w8future',week:8,weekVerified:true,home:'GB',away:'DET',status:'SCHEDULED'}
];
const verified={pbpPublished:true,pbpChronologyVerified:true,finalBoxVerified:true,
 scoreMatchesSchedule:true,playerGameLogsVerified:true,playerIdentitiesVerified:true,
 requiredStatFieldsVerified:true,scoringEventsReconciled:true,statCorrectionsChecked:true,
 kickerScoreVerified:true,dstScoreVerified:true,finalPlayerScoreRecomputed:true,playCount:150};

test('Tracks all in-window MSF matchups, not one sample per week, and excludes future games',()=>{
 const p=planHistoricalMatchups(records,{fromWeek:1,throughWeek:7});
 assert.equal(p.count,6);
 assert.equal(p.byWeek[0].games,2);
 assert.equal(p.byWeek[6].games,0);
 assert.equal(p.seasonScheduleCertified,false);
 assert.equal(p.games.some(g=>g.id==='w8future'),false);
});
test('Week inferred from calendar cannot become verified just because it has a week number',()=>{
 const p=planHistoricalMatchups(records);
 const r=summarizeHistoricalMatchups(p,{w5a:verified});
 const g=r.games.find(x=>x.id==='w5a');
 assert.equal(g.checks.scheduleWeekVerified,false);
 assert.equal(g.fullFantasyScoreCertified,false);
 assert.ok(g.missingBasic.includes('scheduleWeekVerified'));
});
test('PBP and final box scores alone are insufficient to certify FFL player scores',()=>{
 const p=planHistoricalMatchups(records);
 const r=summarizeHistoricalMatchups(p,{w1a:{pbpPublished:true,finalBoxVerified:true,scoreMatchesSchedule:true}});
 const g=r.games.find(x=>x.id==='w1a');
 assert.equal(g.stage,'source_verification_pending');
 assert.equal(g.fullFantasyScoreCertified,false);
 assert.equal(r.fullyReconciledGames,0);
});
test('Kicking, D/ST and per-play bonuses are independent certification gates',()=>{
 const p=planHistoricalMatchups(records);
 const snap={...verified,scoringEventsReconciled:false,kickerScoreVerified:false,dstScoreVerified:false};
 const r=summarizeHistoricalMatchups(p,{w1a:snap});
 const g=r.games.find(x=>x.id==='w1a');
 assert.equal(g.stage,'player_score_reconciliation_pending');
 assert.equal(g.fullFantasyScoreCertified,false);
 assert.deepEqual(g.missingAdvanced.filter(x=>['scoringEvents','kicking','defense'].includes(x)),
  ['scoringEvents','kicking','defense']);
});
test('One fully reconciled game never certifies the entire NFL weekly schedule',()=>{
 const p=planHistoricalMatchups(records);
 const r=summarizeHistoricalMatchups(p,{w1a:verified});
 assert.equal(r.fullyReconciledGames,1);
 assert.equal(r.scheduleCertified,false);
 assert.equal(r.byWeek[0].playerScoresVerified,1);
 assert.equal(r.byWeek[0].remaining,1);
});
test('Next batch only includes completed matchups with explicitly verified NFL week',()=>{
 const p=planHistoricalMatchups(records);
 const b=nextHistoricalMatchupBatch(p,{w1a:verified},4);
 assert.deepEqual(b.map(x=>x.gameId),['w1b','w2a']);
 assert.ok(b.every(x=>x.requestTypes.includes('plays')));
});
test('Conflicting duplicate game IDs are rejected rather than silently double counted',()=>{
 const dup=[...records,{id:'w1a',week:2,weekVerified:true,home:'GB',away:'SEA',status:'FINAL'}];
 const p=planHistoricalMatchups(dup);
 assert.equal(p.games.some(x=>x.id==='w1a'),false);
 assert.ok(p.errors.some(x=>x.reason==='conflicting_provider_schedule_entries'));
});
test('Unknown source results stay pending, not zeros or automatic certification',()=>{
 const p=planHistoricalMatchups(records);
 const r=summarizeHistoricalMatchups(p,{});
 assert.equal(r.fullyReconciledGames,0);
 assert.equal(r.games.every(x=>x.fullFantasyScoreCertified===false),true);
 assert.equal(r.games.every(x=>x.playCount===null),true);
});
