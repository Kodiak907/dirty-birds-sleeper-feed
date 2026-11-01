import test from 'node:test';
import assert from 'node:assert/strict';
import {correlateWeeklyPlayerEvents} from './ffo-same-game-player-evidence.mjs';
import {playerScoringPlayCandidates} from './ffo-gamecast-model.mjs';
import {readFileSync} from 'node:fs';
const rules=JSON.parse(readFileSync(new URL('./FFO_FFL_SCORING_V1.json',import.meta.url),'utf8')).scoring;
const team='GB',gameId='G5';
const row=(id,name,position,jersey,stats,game='G5')=>({
 id,name,team,position,jersey,stats,game:{id:game}
});
const players=[
 row('18607','Jordan Love','QB','10',{passing:{passTD:2},twoPointConversions:{twoPtPassMade:1}}),
 row('39108','Christian Watson','WR','9',{receiving:{recTD:2}}),
 row('166697','Matthew Golden','WR','0',{twoPointConversions:{twoPtPassRec:1}})
];
const roster=players.map(x=>({id:x.id,name:x.name,team:x.team,position:x.position,jersey:x.jersey}));
const p=(id,description)=>({id,description,playStatus:{quarter:2,teamInPossession:{abbreviation:'GB'}}});
const feed={gameplaybyplay:{plays:[
 p('42','(5:57) 10-J.Love pass deep left to 9-C.Watson for 42 yards, TOUCHDOWN.'),
 p('53','(13:19) 10-J.Love pass deep middle to 9-C.Watson for 53 yards, TOUCHDOWN.'),
 p('2pt','TWO-POINT CONVERSION ATTEMPT. 10-J.Love pass to 0-M.Golden is complete. ATTEMPT SUCCEEDS.')
]}};
const evidence=playerScoringPlayCandidates(feed,roster,team,rules);
const box={sourceFinalVerified:true,scheduleFinalVerified:true,scheduleScoreMatches:true,gameId};
const check=x=>correlateWeeklyPlayerEvents({gameId,teamAbbreviation:team,players,evidence,
 boxEvidence:box,rules,...x});
test('Same-game ID joins three verified MSF players; potential awards are never credited',()=>{
 const r=check();
 assert.equal(r.sameGamePlayerRecords,3);
 assert.equal(r.matchedCandidatePlayerIds,3);
 assert.equal(r.sameGameStatMatches,3);
 assert.deepEqual(r.missingOrAmbiguousPlayerIds,[]);
 assert.equal(r.finalScoreboardVerified,true);
 assert.equal(r.ledger.lineItems.length,6);
 assert.equal(r.ledger.readyCount,0);
 assert.equal(r.ledger.pendingCount,6);
 assert.ok(r.ledger.lineItems.every(x=>x.creditedFantasyPoints===null&&x.proposedPoints===null));
 assert.ok(r.ledger.globalBlockers.includes('missing_fullPlayCoverageVerified'));
 assert.ok(r.ledger.globalBlockers.includes('missing_statCorrectionsChecked'));
});
test('An identical player ID with wrong game cannot satisfy MSF player evidence',()=>{
 const bad=players.map(p=>p.id==='39108'?{...p,game:{id:'G4'}}:p);
 const r=check({players:bad});
 assert.equal(r.sameGameStatMatches,2);
 assert.ok(r.missingOrAmbiguousPlayerIds.includes('39108'));
 assert.ok(r.ledger.lineItems.filter(x=>x.playerId==='39108').every(x=>
  x.blockers.includes('final_player_stat_not_verified')));
});
test('Duplicate weekly player IDs never silently elect an arbitrary stat line',()=>{
 const r=check({players:[...players,{...players[1],stats:{receiving:{recTD:8}}}]});
 assert.ok(r.duplicateSameGamePlayerIds.includes('39108'));
 assert.ok(r.missingOrAmbiguousPlayerIds.includes('39108'));
});
test('A final box score for another game does not validate our game',()=>{
 const r=check({boxEvidence:{...box,gameId:'G4'}});
 assert.equal(r.finalScoreboardVerified,false);
 assert.ok(r.ledger.globalBlockers.includes('missing_gameFinal'));
});
test('No box score or source players cannot become a certified zero',()=>{
 const r=check({players:[],boxEvidence:null});
 assert.equal(r.ledger.readyCount,0);
 assert.equal(r.certifiedBonusPoints,null);
 assert.equal(r.certifiedFantasyPlayerTotals,false);
 assert.ok(r.missingOrAmbiguousPlayerIds.length===3);
});
