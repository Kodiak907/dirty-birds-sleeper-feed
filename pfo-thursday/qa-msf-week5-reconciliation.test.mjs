// Read-only historical MSF scoring reconciliation QA. No live API key or score writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {playerScoringPlayCandidates} from './ffo-gamecast-model.mjs';
import {reconcilePlayerScoringEvidence} from './ffo-scoring-reconciliation.mjs';
import {readFileSync} from 'node:fs';
const scoring=JSON.parse(readFileSync(new URL('./FFO_FFL_SCORING_V1.json',import.meta.url),'utf8')).scoring;
const players=[
 {id:'18607',name:'Jordan Love',team:'GB',position:'QB',jersey:'10'},
 {id:'39108',name:'Christian Watson',team:'GB',position:'WR',jersey:'9'},
 {id:'166697',name:'Matthew Golden',team:'GB',position:'WR',jersey:'0'},
 {id:'208628',name:'J. Michael Sturdivant',team:'GB',position:'WR',jersey:'87'}
];
const play=(id,description,secondsElapsed)=>({id,description,playStatus:{
 quarter:2,secondsElapsed,teamInPossession:{abbreviation:'GB'}}});
const feed={gameplaybyplay:{plays:[
 play('n1','(13:26) 10-J.Love pass deep right to 87-J.Sturdivant for 43 yards, TOUCHDOWN NULLIFIED by Penalty. No Play.',94),
 play('w42','(5:57) 10-J.Love pass deep left to 9-C.Watson for 42 yards, TOUCHDOWN.',543),
 play('w53','(13:19) 10-J.Love pass deep middle to 9-C.Watson for 53 yards, TOUCHDOWN.',101),
 play('pt','(13:18) TWO-POINT CONVERSION ATTEMPT. 10-J.Love pass to 0-M.Golden is complete. ATTEMPT SUCCEEDS.',102)
]}};
const evidence=playerScoringPlayCandidates(feed,players,'GB',scoring);
const stats={
 '18607':{passing:{passTD:2},twoPointConversions:{twoPtPassMade:1}},
 '39108':{receiving:{recTD:2}},
 '166697':{twoPointConversions:{twoPtPassRec:1}}
};
const checks={gameFinal:true,fullPlayCoverageVerified:true,finalPlayerBoxScoreVerified:true,statCorrectionsChecked:true};
const reconcile=extra=>reconcilePlayerScoringEvidence({evidence,playerBoxStats:stats,rules:scoring,checks,
 fiftyPlusPolicy:'additive',...extra});
test('Week 5 source candidates: nullified TD excluded and three legitimate events',()=>{
 assert.equal(evidence.excludedNullifiedPlays,1);
 assert.equal(evidence.publishedCandidates,3);
 assert.equal(evidence.identifiedCandidateEvents,3);
});
test('Read-only ledger: source-verified Week 5 awards additively only when prerequisites verified',()=>{
 const r=reconcile();
 assert.equal(r.stage,'read_only_reconciliation_not_integrated_with_team_totals');
 assert.equal(r.readyCount,6);
 assert.equal(r.pendingCount,0);
 assert.deepEqual(r.proposedBonusPointsByPlayer,{'18607':6,'39108':4,'166697':2});
 assert.equal(r.finalFFLPlayerTotalsCertified,false);
 assert.ok(r.lineItems.every(e=>e.creditedFantasyPoints===null));
 assert.ok(r.lineItems.every(e=>e.status==='ready_for_scoring_integration'));
});
test('Without verified 50+ stacking policy, hold 53-yard bonus while 42-yard and 2PT can be separately verified',()=>{
 const r=reconcile({fiftyPlusPolicy:null});
 assert.equal(r.readyCount,4);
 assert.equal(r.pendingCount,2);
 assert.ok(r.lineItems.filter(x=>x.yards===53).every(x=>x.blockers.includes('fifty_plus_stacking_not_adjudicated')));
});
test('Highest-only interpretation does not double-count 40+ and 50+ bonuses',()=>{
 const r=reconcile({fiftyPlusPolicy:'highest_only'});
 assert.deepEqual(r.proposedBonusPointsByPlayer,{'18607':5,'39108':3,'166697':2});
});
test('Absent game completeness or corrected final stats never releases points',()=>{
 const r=reconcile({checks:{...checks,fullPlayCoverageVerified:false,statCorrectionsChecked:false}});
 assert.equal(r.readyCount,0);
 assert.equal(r.pendingCount,6);
 assert.deepEqual(r.proposedBonusPointsByPlayer,{});
 assert.ok(r.lineItems.every(x=>x.proposedPoints===null));
});
test('Missing MSF player two-point statistic stays unknown rather than silently zero',()=>{
 const s=structuredClone(stats);delete s['166697'].twoPointConversions;
 const r=reconcile({playerBoxStats:s});
 assert.ok(r.lineItems.some(x=>x.playerId==='166697'&&x.blockers.includes('final_player_stat_not_verified')));
 assert.equal(r.proposedBonusPointsByPlayer['166697'],undefined);
});
test('Stat totals below published successful event counts block both suspected duplicate credits',()=>{
 const s=structuredClone(stats);s['39108'].receiving.recTD=1;
 const r=reconcile({playerBoxStats:s});
 assert.ok(r.lineItems.filter(x=>x.playerId==='39108').every(x=>x.blockers.includes('play_count_exceeds_final_player_stat_count')));
 assert.equal(r.proposedBonusPointsByPlayer['39108'],undefined);
});
test('No one may certify scoring from truncated 30-event candidate audit',()=>{
 const r=reconcile({evidence:{...evidence,publishedCandidates:31}});
 assert.equal(r.readyCount,0);
 assert.ok(r.globalBlockers.includes('candidate_evidence_truncated'));
});
test('No Sleeper scoring dependency and no awarding scores to user fantasy totals',()=>{
 const source=readFileSync(new URL('./ffo-scoring-reconciliation.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/sleeper\.com|sleeperScore|scoring_settings/);
 assert.doesNotMatch(source,/updatePlayerFantasyPoints|updateLeagueScore|writeFantasyScore/);
});
