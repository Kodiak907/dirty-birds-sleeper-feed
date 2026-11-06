import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const worker=readFileSync(new URL('./_worker.js',import.meta.url),'utf8');
const client=readFileSync(new URL('./ffo-pfo-616.js',import.meta.url),'utf8');
const start=worker.indexOf('function ffo630InspectPossessionSequence(');
const end=worker.indexOf('async function ffo629DefenseSourceAuditRoute(',start);
assert.ok(start>=0&&end>start);
const context=createContext({});
new Script(worker.slice(start,end)+
 ';this.api={inspect:ffo629InspectDefensePlayFields,sequence:ffo630InspectPossessionSequence};')
 .runInContext(context);
const {inspect,sequence}=context.api;
const fixture={id:'163656',home:'MIN',away:'BUF'};
const event=(clock,team,overall,teamDrive,currentDown,description='Ordinary snap')=>({
 description,
 playStatus:{quarter:1,secondsElapsed:clock,teamInPossession:{abbreviation:team},
  overallDriveNum:overall,teamDriveNum:teamDrive,currentDown,yardsRemaining:10,lineOfScrimmage:55}
});
const plays=[
 event(10,'BUF',1,1,1),event(20,'BUF',1,1,2),
 event(30,'BUF',1,1,3),event(40,'BUF',1,1,4,'Punt by Buffalo'),
 event(50,'MIN',2,1,1),event(60,'MIN',2,1,2),
 event(70,'BUF',3,2,1),event(80,'BUF',3,2,2)
];
const payload=arr=>({gameplaybyplay:{plays:arr}});

test('MSF overallDriveNum and teamDriveNum count actual provider-numbered drives despite absent id',()=>{
 const data=inspect(payload(plays),fixture,'BUF','2026-11-05');
 const fields=data.observed_fields,diag=data.sequence_diagnostics;
 assert.equal(fields.provider_id,0);
 assert.equal(fields.down,8);
 assert.equal(fields.overall_drive_num,8);
 assert.equal(fields.team_drive_num,8);
 assert.equal(fields.drive_id,8);
 assert.equal(fields.distinct_drive_ids,3);
 assert.equal(diag.native_numbered_drive_groups,3);
 assert.equal(diag.native_numbered_drive_groups_coherent,3);
 assert.equal(diag.native_drive_group_conflicts,0);
 assert.equal(diag.native_drive_field_coverage.overallDriveNum,8);
 assert.equal(diag.native_drive_field_coverage.teamDriveNum,8);
 assert.ok(!Array.from(data.missing_evidence).includes('provider_drive_identifiers_unavailable'));
 assert.ok(Array.from(diag.play_status_fields).includes('overallDriveNum'));
 assert.ok(Array.from(diag.play_status_fields).includes('teamDriveNum'));
 assert.ok(Array.from(diag.play_status_fields).includes('currentDown'));
 assert.equal(data.three_and_out_scoring_ready,false);
 assert.equal(data.dst_points_certified,false);
 assert.equal(diag.candidate_three_and_out_points,0);
 assert.equal(diag.eligible_for_scoring,false);
});

test('provider-native numbered drives classify short punt drives for review, never score',()=>{
 const diag=sequence(plays,fixture);
 assert.equal(diag.time_order,'forward');
 assert.equal(diag.native_punt_drive_review_candidates,0); // first drive is boundary, not full-history proof
 assert.equal(diag.candidate_three_and_out_points,0);
 const longer=[event(1,'MIN',1,1,1),...plays.slice(0,4).map((p,i)=>({
  ...p,playStatus:{...p.playStatus,overallDriveNum:2,teamDriveNum:1,secondsElapsed:(i+2)*10}
 })),event(70,'MIN',3,2,1)];
 const x=sequence(longer,fixture);
 assert.equal(x.native_numbered_drive_groups,3);
 assert.equal(x.native_punt_drive_review_candidates,1);
 assert.equal(x.eligible_for_scoring,false);
});

test('conflicting team and per-team number inside a native drive fails coherent grouping',()=>{
 const changed=plays.map((p,i)=>i===2?{...p,playStatus:{...p.playStatus,
  teamInPossession:{abbreviation:'MIN'},teamDriveNum:3}}:p);
 const d=sequence(changed,fixture);
 assert.ok(d.native_drive_group_conflicts>=2);
 assert.ok(d.native_numbered_drive_groups_coherent<d.native_numbered_drive_groups);
 assert.equal(d.eligible_for_scoring,false);
});

test('a repeated overallDriveNum in separated sections cannot count as clean complete drive',()=>{
 const changed=plays.map((p,i)=>i===7?{...p,
  playStatus:{...p.playStatus,overallDriveNum:1}}:p);
 const d=sequence(changed,fixture);
 assert.ok(d.native_drive_group_conflicts>=1);
 assert.equal(d.eligible_for_scoring,false);
});

test('reverse chronological MSF records have identical aggregate drive counts',()=>{
 const a=sequence(plays,fixture),b=sequence([...plays].reverse(),fixture);
 assert.equal(b.time_order,'reverse');
 assert.equal(b.native_numbered_drive_groups,a.native_numbered_drive_groups);
 assert.equal(b.native_numbered_drive_groups_coherent,a.native_numbered_drive_groups_coherent);
 assert.equal(b.native_drive_group_conflicts,0);
});

test('zero and malformed drive counters do not manufacture source drive identifiers',()=>{
 const altered=plays.map(p=>({...p,playStatus:{...p.playStatus,
  overallDriveNum:0,teamDriveNum:'fake'}}));
 const data=inspect(payload(altered),fixture,'BUF','2026-11-05');
 assert.equal(data.observed_fields.overall_drive_num,0);
 assert.equal(data.observed_fields.team_drive_num,0);
 assert.equal(data.observed_fields.drive_id,0);
 assert.ok(Array.from(data.missing_evidence).includes('provider_drive_identifiers_unavailable'));
 assert.equal(data.dst_points_certified,false);
});

test('native drive evidence alone never certifies full game, PA or scoring categories',()=>{
 const data=inspect(payload(plays),fixture,'BUF','2026-11-05');
 assert.equal(data.full_game_certified,false);
 assert.equal(data.points_allowed_scoring_ready,false);
 assert.equal(data.three_and_out_scoring_ready,false);
 assert.equal(data.sequence_diagnostics.inference_only,true);
 assert.ok(Array.from(data.missing_evidence).includes('complete_drive_boundaries_not_certified'));
 assert.ok(Array.from(data.missing_evidence).includes('offensive_vs_return_score_attribution_not_certified'));
});

test('mobile UI distinguishes drive-labeled plays from distinct drives and maintains scoring firewall',()=>{
 assert.match(client,/drive-labeled plays/);
 assert.match(client,/Distinct numbered drives/);
 assert.match(client,/Native overall drive nums/);
 assert.match(client,/Native punt-drive review candidates/);
 assert.match(client,/D\/ST points NOT certified/);
 assert.match(client,/no score changes/);
});
