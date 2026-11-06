import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const worker=readFileSync(new URL('./_worker.js',import.meta.url),'utf8');
const client=readFileSync(new URL('./ffo-pfo-616.js',import.meta.url),'utf8');
const start=worker.indexOf('function ffo630InspectPossessionSequence(');
const end=worker.indexOf('async function ffo629DefenseSourceAuditRoute(',start);
assert.ok(start>=0&&end>start);
const ctx=createContext({});
new Script(worker.slice(start,end)+
 ';this.audit={sequence:ffo630InspectPossessionSequence,inspect:ffo629InspectDefensePlayFields};')
 .runInContext(ctx);
const {sequence,inspect}=ctx.audit;
const fixture={id:'163656',home:'MIN',away:'BUF'};
const event=(id,sec,team,down,description='Ordinary offensive snap',fields={})=>({
 id,description,
 playStatus:{quarter:1,secondsElapsed:sec,teamInPossession:{abbreviation:team},down},
 ...fields
});
const plays=[
 event(null,10,'BUF',1),
 event(null,20,'MIN',1),
 event(null,30,'MIN',2),
 event(null,40,'MIN',3),
 event(null,50,'MIN',4,'Punt by Minnesota'),
 event(null,60,'BUF',1)
];
const payload=p=>({gameplaybyplay:{plays:p}});
test('MSF possession and down sequence creates read-only short punt candidate, never D/ST points',()=>{
 const x=inspect(payload(plays),fixture,'BUF','2026-11-05');
 assert.equal(x.available,true);
 assert.equal(x.observed_fields.plays,6);
 assert.equal(x.observed_fields.possession_team,6);
 assert.equal(x.observed_fields.down,6);
 assert.equal(x.observed_fields.drive_id,0);
 assert.equal(x.sequence_diagnostics.time_order,'forward');
 assert.equal(x.sequence_diagnostics.observed_possession_transitions,2);
 assert.equal(x.sequence_diagnostics.candidate_possession_segments,3);
 assert.equal(x.sequence_diagnostics.short_punt_sequence_candidates,1);
 assert.equal(x.sequence_diagnostics.candidate_three_and_out_points,0);
 assert.equal(x.sequence_diagnostics.eligible_for_scoring,false);
 assert.equal(x.three_and_out_scoring_ready,false);
 assert.equal(x.points_allowed_scoring_ready,false);
 assert.equal(x.dst_points_certified,false);
 assert.equal(x.full_game_certified,false);
});

test('reversed provider order is normalized only for aggregate diagnostics',()=>{
 const x=sequence([...plays].reverse(),fixture);
 assert.equal(x.time_order,'reverse');
 assert.equal(x.observed_possession_transitions,2);
 assert.equal(x.short_punt_sequence_candidates,1);
 assert.equal(x.eligible_for_scoring,false);
});
test('mixed chronology blocks all drive candidate grouping rather than making up an order',()=>{
 const mix=[plays[0],plays[2],plays[1],plays[3],plays[4],plays[5]];
 const x=sequence(mix,fixture);
 assert.equal(x.time_order,'mixed');
 assert.equal(x.observed_possession_transitions,null);
 assert.equal(x.candidate_possession_segments,null);
 assert.equal(x.short_punt_sequence_candidates,null);
 assert.equal(x.eligible_for_scoring,false);
});
test('no usable clocks prevents inferred drive series',()=>{
 const rows=plays.map(p=>({...p,playStatus:{down:p.playStatus.down,teamInPossession:p.playStatus.teamInPossession}}));
 const x=sequence(rows,fixture);
 assert.equal(x.time_order,'unknown');
 assert.equal(x.timestamped_plays,0);
 assert.equal(x.candidate_possession_segments,null);
 assert.equal(x.short_punt_sequence_candidates,null);
});
test('penalties, kickoffs, and extra plays reject spurious three-and-out candidate',()=>{
 const extra=plays.slice();
 extra.splice(3,0,event(null,35,'MIN',2,'Holding penalty, no play'));
 const x=sequence(extra,fixture);
 assert.equal(x.short_punt_sequence_candidates,0);
 const canceled=plays.slice();
 canceled[3]=event(null,40,'MIN',3,'Penalty declined, no play');
 assert.equal(sequence(canceled,fixture).short_punt_sequence_candidates,0);
});
test('source field names are visible but private licensed play descriptions and sensitive values are not',()=>{
 const p=plays.map((e,i)=>({...e,
  description:'PRIVATE LICENSED PLAY DETAIL '+i,
  bearerToken:'PRIVATE API TOKEN',
  playStatus:{...e.playStatus,unknownUsefulField:5,authorization:'hidden'}
 }));
 const x=inspect(payload(p),fixture,'MIN','2026-11-05');
 const serialized=JSON.stringify(x);
 assert.ok(Array.from(x.sequence_diagnostics.play_fields).includes('playStatus'));
 assert.ok(Array.from(x.sequence_diagnostics.play_status_fields).includes('unknownUsefulField'));
 assert.ok(!Array.from(x.sequence_diagnostics.play_fields).includes('bearerToken'));
 assert.ok(!serialized.includes('PRIVATE LICENSED PLAY DETAIL'));
 assert.ok(!serialized.includes('PRIVATE API TOKEN'));
 assert.ok(!serialized.includes('hidden'));
});
test('small-screen diagnostic keeps missing details collapsed and never turns candidate into fantasy score',()=>{
 assert.match(client,/document\.createElement\('details'\)/);
 assert.match(client,/Potential short punt sequences/);
 assert.match(client,/NOT verified three-and-outs/);
 assert.match(client,/D\/ST points NOT certified/);
 assert.match(client,/source fields/i);
 assert.match(worker,/sequence_diagnostics:ffo630InspectPossessionSequence\(rows,fixture\)/);
});
