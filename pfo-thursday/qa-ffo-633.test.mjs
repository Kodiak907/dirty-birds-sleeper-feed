import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const worker=readFileSync(new URL('./_worker.js',import.meta.url),'utf8');
const client=readFileSync(new URL('./ffo-pfo-616.js',import.meta.url),'utf8');
const start=worker.indexOf('function ffo630InspectPossessionSequence(');
const end=worker.indexOf('async function ffo629DefenseSourceAuditRoute(',start);
assert.ok(start>=0&&end>start,'locate bounded MSF D/ST diagnostic helpers');
const ctx=createContext({});
new Script(worker.slice(start,end)+
 ';this.audit={three:ffo633ReviewThreeAndOutSequences,source:ffo629InspectDefensePlayFields};')
 .runInContext(ctx);
const {three,source}=ctx.audit;
const fixture={id:'163656',home:'MIN',away:'BUF'};
const record=(team,sec,down,kind,description='Ordinary NFL play')=>({
 description,
 playStatus:{quarter:1,secondsElapsed:sec,currentDown:down,yardsRemaining:10,
   lineOfScrimmage:60,overallDriveNum:null,teamDriveNum:null,
   teamInPossession:{abbreviation:team}},
 ...(kind==='pass'?{pass:{attempted:true}}:kind==='rush'?{rush:{attempted:true}}:
  kind==='sack'?{sack:{made:true}}:kind==='punt'?{punt:{distance:45}}:
  kind==='penalty'?{penalty:{flag:true}}:kind==='kickoff'?{kick:{type:'kickoff'}}:{})
});
const completed=[
 record('BUF',10,1,'pass'),
 record('MIN',20,1,'pass'),
 record('MIN',30,2,'rush'),
 record('MIN',40,3,'sack'),
 record('MIN',50,4,'punt','Minnesota punts 45 yards'),
 record('BUF',60,1,'pass')
];
const wrapped=rows=>({gameplaybyplay:{plays:rows}});
test('review-only 3 offensive snaps + 4th-down punt, with missing native counters, does NOT score',()=>{
 const result=source(wrapped(completed),fixture,'BUF','2026-11-05');
 const d=result.three_and_out_evidence;
 assert.equal(d.chronological_order,'forward');
 assert.equal(d.observed_possession_segments,3);
 assert.equal(d.punt_ending_segments_for_review,1);
 assert.equal(d.strict_three_snap_punt_review_candidates,1);
 assert.equal(d.observed_fields.with_current_down,6);
 assert.equal(d.observed_fields.with_yards_remaining,6);
 assert.equal(d.observed_fields.with_line_of_scrimmage,6);
 assert.equal(d.observed_fields.classified_offensive_snap,5);
 assert.equal(d.observed_fields.classified_punt,1);
 assert.equal(result.drive_value_diagnostics.overallDriveNum.null,6);
 assert.equal(result.sequence_diagnostics.native_numbered_drive_groups,0);
 assert.equal(d.verified_three_and_outs,null);
 assert.equal(d.candidate_fantasy_points,0);
 assert.equal(d.eligible_for_scoring,false);
 assert.equal(result.dst_points_certified,false);
 assert.equal(result.three_and_out_scoring_ready,false);
 assert.equal(result.points_allowed_scoring_ready,false);
});
test('reverse chronological records preserve review results without scores',()=>{
 const x=three([...completed].reverse(),fixture);
 assert.equal(x.chronological_order,'reverse');
 assert.equal(x.strict_three_snap_punt_review_candidates,1);
 assert.equal(x.eligible_for_scoring,false);
});
test('mixed or absent clocks refuse candidate reconstruction',()=>{
 const mixed=[completed[0],completed[2],completed[1],completed[3],completed[4],completed[5]];
 const x=three(mixed,fixture);
 assert.equal(x.chronological_order,'mixed');
 assert.equal(x.strict_three_snap_punt_review_candidates,null);
 const n=three(completed.map(p=>({...p,playStatus:{...p.playStatus,secondsElapsed:null}})),fixture);
 assert.equal(n.chronological_order,'unknown');
 assert.equal(n.strict_three_snap_punt_review_candidates,null);
});
test('penalties, no-plays and turnovers exclude potentially misleading punts',()=>{
 const penalty=[...completed];
 penalty[2]=record('MIN',30,2,'penalty','Holding, replay down');
 const x=three(penalty,fixture);
 assert.equal(x.strict_three_snap_punt_review_candidates,0);
 assert.equal(x.excluded_punt_segment_reasons.penalty_or_turnover,1);
 const turnover=[...completed];
 turnover[2]=record('MIN',30,2,'pass','Pass is intercepted, turnover');
 const y=three(turnover,fixture);
 assert.equal(y.strict_three_snap_punt_review_candidates,0);
 assert.equal(y.excluded_punt_segment_reasons.penalty_or_turnover,1);
});
test('fourth-down conversions, extra snaps and fake punts are not three-and-out evidence',()=>{
 const extended=[...completed];extended.splice(4,0,record('MIN',45,1,'pass'));
 const x=three(extended,fixture);
 assert.equal(x.strict_three_snap_punt_review_candidates,0);
 assert.equal(x.excluded_punt_segment_reasons.not_three_offensive_snaps,1);
 const wrongDown=[...completed];wrongDown[2]=record('MIN',30,1,'rush');
 assert.equal(three(wrongDown,fixture).excluded_punt_segment_reasons.down_sequence_unverified,1);
 const fake=[...completed];fake[4]=record('MIN',50,4,'punt','Fake punt completed');
 assert.equal(three(fake,fixture).strict_three_snap_punt_review_candidates,0);
});
test('kickoff and unclassified team events are excluded from strict candidates',()=>{
 const withKickoff=[...completed];withKickoff.splice(4,0,record('MIN',45,4,'kickoff','Kickoff'));
 const k=three(withKickoff,fixture);
 assert.equal(k.strict_three_snap_punt_review_candidates,0);
 assert.equal(k.excluded_punt_segment_reasons.play_type_ambiguous,1);
 const withUnknown=[...completed];withUnknown.splice(4,0,record('MIN',45,3,'other','Timeout'));
 const z=three(withUnknown,fixture);
 assert.equal(z.strict_three_snap_punt_review_candidates,0);
 assert.equal(z.excluded_punt_segment_reasons.play_type_ambiguous,1);
});
test('missing down never becomes an assumed 4th-down punt',()=>{
 const p=[...completed];p[4]=record('MIN',50,null,'punt','Punts away');
 const x=three(p,fixture);
 assert.equal(x.strict_three_snap_punt_review_candidates,0);
 assert.equal(x.excluded_punt_segment_reasons.missing_down_or_clock,1);
});
test('edge segment and missing possession evidence stay uncertified',()=>{
 const p=[...completed.slice(1,5),record('BUF',60,1,'pass')];
 const x=three(p,fixture);
 assert.equal(x.strict_three_snap_punt_review_candidates,0);
 assert.equal(x.excluded_punt_segment_reasons.edge_segment,1);
 const q=[...completed];q[2]=record('UNKNOWN',30,2,'rush');
 const y=three(q,fixture);
 assert.equal(y.strict_three_snap_punt_review_candidates,0);
 assert.equal(y.excluded_punt_segment_reasons.incomplete_possession,1);
});
test('source response contains only aggregate counts, not private play text',()=>{
 const r=source(wrapped(completed.map((p,i)=>({...p,
  description:'PRIVATE LICENSED TEXT FROM MSF '+i}))),fixture,'BUF','2026-11-05');
 const json=JSON.stringify(r);
 assert.ok(!json.includes('PRIVATE LICENSED TEXT FROM MSF'));
 assert.equal(r.three_and_out_evidence.source_data_not_republished,true);
 assert.equal(r.three_and_out_evidence.read_only,true);
});
test('UI clearly exposes category diagnostics without awarding or claiming missing zero scores',()=>{
 assert.match(client,/Three-snap \+ punt REVIEW candidates/);
 assert.match(client,/Three-and-out review exclusions/);
 assert.match(client,/Verified three-and-outs: unavailable \(NOT zero\)/);
 assert.match(client,/D\/ST points NOT certified/);
 assert.match(worker,/three_and_out_evidence:ffo633ReviewThreeAndOutSequences\(rows,fixture\)/);
});
