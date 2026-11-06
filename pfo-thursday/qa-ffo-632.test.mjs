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
 ';this.audit={values:ffo632AuditDriveRawValues,inspect:ffo629InspectDefensePlayFields};')
 .runInContext(ctx);
const {values,inspect}=ctx.audit;
const fixture={id:'163656',home:'MIN',away:'BUF'};
const ev=(overall,team,sec=10)=>({description:'Licensed source text must stay private',
 playStatus:{quarter:1,secondsElapsed:sec,teamInPossession:{abbreviation:'MIN'},
  currentDown:1,overallDriveNum:overall,teamDriveNum:team}});
test('fields appearing in every record but always null are explicitly reported as unusable',()=>{
 const rows=[ev(null,null),ev(null,null,20),ev(null,null,30)];
 const data=inspect({gameplaybyplay:{plays:rows}},fixture,'BUF','2026-11-05');
 const d=data.drive_value_diagnostics;
 assert.equal(d.overallDriveNum.present,3);
 assert.equal(d.overallDriveNum.null,3);
 assert.equal(d.overallDriveNum.missing,0);
 assert.equal(d.overallDriveNum.all_present_values_null,true);
 assert.equal(d.overallDriveNum.usable_positive_coverage,0);
 assert.equal(d.teamDriveNum.null,3);
 assert.equal(data.observed_fields.drive_id,0);
 assert.equal(data.observed_fields.overall_drive_num,0);
 assert.equal(data.three_and_out_scoring_ready,false);
 assert.equal(data.dst_points_certified,false);
});
test('zero-valued MSF counters are visible but never certified as drive identifiers',()=>{
 const rows=[ev(0,0),ev('0','0',20),ev(' 0 ',' 0 ',30)];
 const d=values(rows);
 assert.equal(d.overallDriveNum.zero,3);
 assert.equal(d.overallDriveNum.positive_integer,0);
 assert.equal(d.overallDriveNum.numeric_string,2);
 assert.equal(d.overallDriveNum.zero_only,true);
 assert.equal(d.overallDriveNum.distinct_supported_values,1);
 assert.equal(d.overallDriveNum.zero_semantics_verified,false);
 const data=inspect({gameplaybyplay:{plays:rows}},fixture,'MIN','2026-11-05');
 assert.equal(data.observed_fields.drive_id,0);
 assert.equal(data.sequence_diagnostics.native_numbered_drive_groups,0);
 assert.equal(data.sequence_diagnostics.eligible_for_scoring,false);
});
test('positive integer provider counters count, but remain read-only until drive boundaries are verified',()=>{
 const rows=[ev(1,1),ev('1','1',20),ev(2,1,30),ev(2,1,40)];
 const data=inspect({gameplaybyplay:{plays:rows}},fixture,'BUF','2026-11-05');
 const d=data.drive_value_diagnostics;
 assert.equal(d.overallDriveNum.positive_integer,4);
 assert.equal(d.overallDriveNum.numeric_string,1);
 assert.equal(d.overallDriveNum.distinct_supported_values,2);
 assert.equal(data.observed_fields.drive_id,4);
 assert.equal(data.observed_fields.distinct_drive_ids,2);
 assert.equal(data.dst_points_certified,false);
 assert.equal(data.points_allowed_scoring_ready,false);
});
test('absent, undefined, blank, negative, fractional, high, object, boolean, invalid drive counters are accounted for',()=>{
 const rows=[
  {playStatus:{}}, {playStatus:{overallDriveNum:undefined}},
  ev('',null),ev(-1,null),ev(1.5,null),ev(300,null),
  ev({id:4},null),ev(true,null),ev('not-a-drive',null)
 ];
 const d=values(rows).overallDriveNum;
 assert.equal(d.records,9);
 assert.equal(d.missing,1);
 assert.equal(d.undefined,1);
 assert.equal(d.blank,1);
 assert.equal(d.negative_integer,1);
 assert.equal(d.fractional,1);
 assert.equal(d.above_supported_range,1);
 assert.equal(d.object,1);
 assert.equal(d.boolean,1);
 assert.equal(d.non_numeric,1);
 assert.equal(d.usable_positive_coverage,0);
});
test('no licensed play descriptions or raw field values are exposed, only aggregates',()=>{
 const data=inspect({gameplaybyplay:{plays:[ev('not-a-drive',null)]}},fixture,'BUF','2026-11-05');
 const serialized=JSON.stringify(data);
 assert.ok(!serialized.includes('Licensed source text must stay private'));
 assert.ok(!serialized.includes('not-a-drive'));
 assert.equal(data.drive_value_diagnostics.read_only,true);
 assert.equal(data.drive_value_diagnostics.eligible_for_scoring,false);
 assert.equal(data.full_game_certified,false);
});
test('mobile diagnostic differentiates field presence and valid values without altering scores',()=>{
 assert.match(client,/Drive value classifications:/);
 assert.match(client,/Zero counter values are NOT certified as drive identifiers/);
 assert.match(client,/positive_integer/);
 assert.match(client,/D\/ST points NOT certified/);
 assert.match(worker,/drive_value_diagnostics:ffo632AuditDriveRawValues\(rows\)/);
});
