import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {playerScoringPlayCandidates} from './ffo-gamecast-model.mjs';
import {correlateWeeklyPlayerEvents} from './ffo-same-game-player-evidence.mjs';
import {eventScoreScenarios} from './ffo-msf-event-score-scenarios.mjs';
const rules=JSON.parse(readFileSync(new URL('./FFO_FFL_SCORING_V1.json',import.meta.url),'utf8')).scoring;
const team='GB',gameId='163616';
const identity=[
 {id:'18607',name:'Jordan Love',team,position:'QB',jersey:'10'},
 {id:'39108',name:'Christian Watson',team,position:'WR',jersey:'9'},
 {id:'166697',name:'Matthew Golden',team,position:'WR',jersey:'0'}
];
const p=(id,description)=>({id,description,playStatus:{quarter:2,teamInPossession:{abbreviation:team}}});
const pbp={gameplaybyplay:{plays:[
 p('void','(13:26) 10-J.Love pass to 87-J.Sturdivant for 43 yards, TOUCHDOWN NULLIFIED by Penalty. No Play.'),
 p('td42','(5:57) 10-J.Love pass deep left to 9-C.Watson for 42 yards, TOUCHDOWN.'),
 p('td53','(13:19) 10-J.Love pass deep middle to 9-C.Watson for 53 yards, TOUCHDOWN.'),
 p('2pt','TWO-POINT CONVERSION ATTEMPT. 10-J.Love pass to 0-M.Golden is complete. ATTEMPT SUCCEEDS.')
]}};
const evidence=playerScoringPlayCandidates(pbp,identity,team,rules);
const stats={
 '18607':{passing:{passTD:2}},
 '39108':{receiving:{recTD:2}},
 '166697':{receiving:{receptions:3}}
};
const playerRecords=()=>identity.map(id=>({...id,game:{id:gameId},stats:stats[id.id]}));
const box={sourceFinalVerified:true,scheduleFinalVerified:true,scheduleScoreMatches:true,gameId};
const summary={gameId,finalScoreVerified:true,events:[
 {period:2,scoringSide:team,scoringPoints:2,
  description:'TWO-POINT CONVERSION ATTEMPT. 10-J.Love pass to 0-M.Golden is complete. ATTEMPT SUCCEEDS.'}
]};
const scenario=({players=playerRecords(),boxEvidence=box,scoringSummary=summary,evidenceInput=evidence}={})=>{
 const matched=correlateWeeklyPlayerEvents({gameId,teamAbbreviation:team,
  players,evidence:evidenceInput,boxEvidence,scoringSummary,rules});
 return {matched,out:eventScoreScenarios({ledger:matched.ledger,corroboration:matched.twoPointCorroboration,rules})};
};

test('Week 5 MSF verified event components yield conditional 40+/50+ alternatives, not certified scores',()=>{
 assert.equal(evidence.publishedCandidates,3);
 assert.equal(evidence.excludedNullifiedPlays,1);
 const {matched,out}=scenario();
 assert.equal(matched.sameGameStatMatches,3);
 assert.equal(out.canWriteScores,false);
 assert.equal(out.finalPlayerScoresCertified,false);
 assert.equal(out.fullPlayCoverageCertified,false);
 assert.equal(out.containsOnlyIncrementalBonuses,true);
 assert.equal(out.baseTouchdownPointsIncluded,false);
 const love=out.players.find(p=>p.playerId==='18607');
 const watson=out.players.find(p=>p.playerId==='39108');
 const golden=out.players.find(p=>p.playerId==='166697');
 assert.equal(love.verifiedLongTdCount,2);
 assert.equal(watson.verifiedLongTdCount,2);
 assert.equal(love.twoPtMissingStatSourceCandidates,2);
 assert.equal(golden.twoPtMissingStatSourceCandidates,2);
 assert.equal(watson.twoPtMissingStatSourceCandidates,0);
 assert.equal(love.highestOnlyCandidatePoints,5);
 assert.equal(love.additiveCandidatePoints,6);
 assert.equal(watson.highestOnlyCandidatePoints,3);
 assert.equal(watson.additiveCandidatePoints,4);
 assert.equal(golden.highestOnlyCandidatePoints,2);
 assert.equal(golden.additiveCandidatePoints,2);
 assert.ok(out.players.every(p=>p.conditionalOnly));
});

test('If the weekly MSF 2PT stat is explicitly published, never add that event twice',()=>{
 const changed=playerRecords().map(p=>
  p.id==='18607'?{...p,stats:{...p.stats,twoPointConversions:{twoPtPassMade:1}}}:
  p.id==='166697'?{...p,stats:{...p.stats,twoPointConversions:{twoPtPassRec:1}}}:p);
 const {out}=scenario({players:changed});
 const love=out.players.find(p=>p.playerId==='18607');
 const golden=out.players.find(p=>p.playerId==='166697');
 assert.equal(love.twoPtMissingStatSourceCandidates,0);
 assert.equal(golden.twoPtMissingStatSourceCandidates,0);
 assert.equal(love.twoPtAlreadyPublished,1);
 assert.equal(golden.twoPtAlreadyPublished,1);
 assert.equal(love.highestOnlyCandidatePoints,3);
 assert.equal(golden.highestOnlyCandidatePoints,0);
});

test('A 2PT PBP without a matching independently published scoring summary is NOT a scoring supplement',()=>{
 const {out}=scenario({scoringSummary:null});
 const love=out.players.find(p=>p.playerId==='18607');
 const golden=out.players.find(p=>p.playerId==='166697');
 assert.equal(love.twoPtMissingStatSourceCandidates,0);
 assert.equal(golden.twoPtMissingStatSourceCandidates,0);
 assert.equal(love.twoPtEvidenceUnverified,1);
 assert.equal(golden.twoPtEvidenceUnverified,1);
 assert.equal(love.highestOnlyCandidatePoints,3);
});

test('Stat count contradiction blocks distance bonuses rather than trusting source candidates',()=>{
 const changed=playerRecords().map(p=>
 p.id==='39108'?{...p,stats:{receiving:{recTD:1}}}:p);
 const {matched,out}=scenario({players:changed});
 assert.ok(matched.ledger.lineItems.filter(p=>p.playerId==='39108'&&p.category==='rec_td')
  .every(p=>p.blockers.includes('play_count_exceeds_final_player_stat_count')));
 const watson=out.players.find(p=>p.playerId==='39108');
 assert.equal(watson.highestOnlyCandidatePoints,0);
 assert.equal(watson.additiveCandidatePoints,0);
});

test('No MSF player game row means no touchdown bonus scenario for that player',()=>{
 const changed=playerRecords().filter(p=>p.id!=='39108');
 const {out}=scenario({players:changed});
 const watson=out.players.find(p=>p.playerId==='39108');
 assert.equal(watson.highestOnlyCandidatePoints,0);
 assert.equal(watson.additiveCandidatePoints,0);
});

test('Duplicated published play IDs or incomplete candidate evidence cannot become certified totals',()=>{
 const {matched}=scenario();
 const wrong={...matched.ledger,globalBlockers:['candidate_evidence_truncated']};
 const out=eventScoreScenarios({ledger:wrong,corroboration:matched.twoPointCorroboration,rules});
 assert.equal(out.canWriteScores,false);
 assert.equal(out.finalPlayerScoresCertified,false);
 assert.ok(out.sourceIssues.includes('source_events_truncated'));
});

test('Conditional scenario module has no Sleeper runtime dependence or score mutation',()=>{
 const src=readFileSync(new URL('./ffo-msf-event-score-scenarios.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/fetch\(|sleeper\.com|writePlayerScore|updateLeagueScore|COMMISSIONER_DB/);
});

test('MSF historical plays with NO native play ID still yield clock-identified long TD scenarios',()=>{
 const withoutIDs={gameplaybyplay:{plays:pbp.gameplaybyplay.plays.map(x=>({
  description:x.description,playStatus:x.playStatus
 }))}};
 const e=playerScoringPlayCandidates(withoutIDs,identity,team,rules);
 assert.equal(e.publishedCandidates,3);
 assert.equal(e.events.filter(x=>x.sourceId===null).length,3);
 const {matched,out}=scenario({evidenceInput:e});
 assert.equal(matched.ledger.lineItems.length,6);
 const love=out.players.find(p=>p.playerId==='18607');
 const watson=out.players.find(p=>p.playerId==='39108');
 const golden=out.players.find(p=>p.playerId==='166697');
 assert.equal(love.highestOnlyCandidatePoints,5);
 assert.equal(love.additiveCandidatePoints,6);
 assert.equal(watson.highestOnlyCandidatePoints,3);
 assert.equal(watson.additiveCandidatePoints,4);
 assert.equal(golden.highestOnlyCandidatePoints,2);
 assert.ok(matched.ledger.lineItems.filter(x=>x.category.endsWith('_td')).every(x=>x.sourceIdentityVerified));
 assert.ok(matched.ledger.lineItems.filter(x=>x.category.endsWith('_2pt')).every(x=>!x.sourceIdentityVerified));
 assert.equal(out.canWriteScores,false);
});

test('Without native ID or verified clock, long TD cannot produce conditional bonus points',()=>{
 const noIdNoClock={gameplaybyplay:{plays:[
  {description:'10-J.Love pass deep middle to 9-C.Watson for 53 yards, TOUCHDOWN.',
   playStatus:{teamInPossession:{abbreviation:team}}}
 ]}};
 const e=playerScoringPlayCandidates(noIdNoClock,identity,team,rules);
 const {out}=scenario({evidenceInput:e});
 assert.equal(out.players.find(p=>p.playerId==='18607').highestOnlyCandidatePoints,0);
 assert.equal(out.players.find(p=>p.playerId==='39108').highestOnlyCandidatePoints,0);
});

test('Two duplicate ID-less two-point PBP records cannot reuse one published MSF scoring play',()=>{
 const duplicates={gameplaybyplay:{plays:[
  {description:'TWO-POINT CONVERSION ATTEMPT. 10-J.Love pass to 0-M.Golden is complete. ATTEMPT SUCCEEDS.',
   playStatus:{quarter:2,teamInPossession:{abbreviation:team}}},
  {description:'TWO-POINT CONVERSION ATTEMPT. 10-J.Love pass to 0-M.Golden is complete. ATTEMPT SUCCEEDS.',
   playStatus:{quarter:2,teamInPossession:{abbreviation:team}}}
 ]}};
 const e=playerScoringPlayCandidates(duplicates,identity,team,rules);
 assert.equal(e.publishedCandidates,2);
 const {matched,out}=scenario({evidenceInput:e});
 assert.equal(matched.twoPointCorroboration.length,2);
 assert.ok(matched.twoPointCorroboration.every(x=>x.sourceTier==='ambiguous_duplicate_pbp_candidates'));
 assert.equal(out.players.find(p=>p.playerId==='18607').twoPtMissingStatSourceCandidates,0);
 assert.equal(out.players.find(p=>p.playerId==='166697').twoPtMissingStatSourceCandidates,0);
 assert.equal(out.finalPlayerScoresCertified,false);
});
