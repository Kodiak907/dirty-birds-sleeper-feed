import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const worker=readFileSync(new URL('./_worker.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('./ffo-pfo-616.js',import.meta.url),'utf8');
const start=worker.indexOf('function ffo630InspectPossessionSequence(');
const end=worker.indexOf('async function ffo629DefenseSourceAuditRoute(',start);
assert.ok(start>=0&&end>start,'locate protected MSF D/ST audit helpers');
const ctx=createContext({});
new Script(worker.slice(start,end)+
 ';this.api={attribution:ffo634ReviewDefensiveAttribution,inspect:ffo629InspectDefensePlayFields};')
 .runInContext(ctx);
const {attribution,inspect}=ctx.api;
const fixture={id:'163656',home:'BUF',away:'MIN'};
const e=(team,sec,down,kind='pass',description='Ordinary NFL action',distance=10)=>({
 description,playStatus:{quarter:1,secondsElapsed:sec,currentDown:down,
  yardsRemaining:distance,lineOfScrimmage:55,
  overallDriveNum:null,teamDriveNum:null,
  teamInPossession:{abbreviation:team}},
 ...(kind==='pass'?{pass:{attempt:true}}:
    kind==='rush'?{rush:{attempt:true}}:
    kind==='sack'?{sack:{event:true}}:
    kind==='punt'?{punt:{yards:48}}:
    kind==='penalty'?{penalty:{flag:true}}:{})
});
const sample=[
 e('BUF',10,1),
 e('MIN',20,1),e('MIN',30,2,'rush'),e('MIN',40,3,'sack'),
 e('MIN',50,4,'punt','Minnesota punts'),
 e('BUF',60,1)
];
const wrap=r=>({gameplaybyplay:{plays:r}});
test('source-side possession allows provisional opponent attribution, never a completed fantasy score',()=>{
 const d=inspect(wrap(sample),fixture,'BUF','2026-11-05');
 const a=d.defense_candidate_attribution;
 assert.equal(a.chronological_order,'forward');
 assert.equal(a.observed_possession_segments,3);
 assert.equal(a.breakdown.observed_punt_segments,1);
 assert.equal(a.breakdown.candidate_attribution_only,1);
 assert.equal(a.defense_review_by_team.BUF.review_candidates,1);
 assert.equal(a.defense_review_by_team.MIN.review_candidates,0);
 assert.equal(a.defense_review_by_team.BUF.verified_three_and_outs,null);
 assert.equal(a.defense_review_by_team.BUF.awarded_ffl_points,0);
 assert.equal(a.awarded_ffl_points,0);
 assert.equal(a.eligible_for_scoring,false);
 assert.equal(a.team_attribution_certified,false);
 assert.equal(d.three_and_out_scoring_ready,false);
 assert.equal(d.dst_points_certified,false);
});
test('reverse chronology preserves provisional counts by defense',()=>{
 const a=attribution([...sample].reverse(),fixture);
 assert.equal(a.chronological_order,'reverse');
 assert.equal(a.defense_review_by_team.BUF.review_candidates,1);
 assert.equal(a.eligible_for_scoring,false);
});
test('both defenses can receive different review candidates without assigning points',()=>{
 const both=[e('BUF',10,1),
 e('MIN',20,1),e('MIN',30,2),e('MIN',40,3),e('MIN',50,4,'punt','MIN punts'),
 e('BUF',60,1),e('BUF',70,2),e('BUF',80,3),e('BUF',90,4,'punt','BUF punts'),
 e('MIN',100,1)];
 const a=attribution(both,fixture);
 assert.equal(a.defense_review_by_team.BUF.review_candidates,1);
 assert.equal(a.defense_review_by_team.MIN.review_candidates,1);
 assert.equal(a.awarded_ffl_points,0);
});
test('a first down reset or extra play cannot masquerade as a three-and-out',()=>{
 const reset=[...sample];reset[3]=e('MIN',40,1);
 assert.equal(attribution(reset,fixture).breakdown.excluded_nonsequential_down,1);
 const extra=[...sample];extra.splice(4,0,e('MIN',45,3,'rush'));
 assert.equal(attribution(extra,fixture).breakdown.excluded_non_four_plays,1);
});
test('missing distance, missing snap type, or no structured punt excludes a candidate',()=>{
 const missingDist=[...sample];missingDist[2]=e('MIN',30,2,'rush','Ordinary play',null);
 assert.equal(attribution(missingDist,fixture).breakdown.excluded_down_or_distance,1);
 const unclassified=[...sample];unclassified[2]=e('MIN',30,2,'other','No raw play-type data');
 assert.equal(attribution(unclassified,fixture).breakdown.excluded_missing_structured_type,1);
 const unverifiedPunt=[...sample];unverifiedPunt[4]=e('MIN',50,4,'other','Punts it away');
 assert.equal(attribution(unverifiedPunt,fixture).breakdown.observed_punt_segments,0);
});
test('fake punts, penalties and turnovers block attribution',()=>{
 const penalty=[...sample];penalty[2]=e('MIN',30,2,'penalty','Holding - no play');
 assert.equal(attribution(penalty,fixture).breakdown.excluded_penalty_or_turnover,1);
 const fake=[...sample];fake[4]=e('MIN',50,4,'punt','Fake punt run');
 assert.equal(attribution(fake,fixture).breakdown.excluded_penalty_or_turnover,1);
 const turnover=[...sample];turnover[3]=e('MIN',40,3,'pass','Intercepted');
 assert.equal(attribution(turnover,fixture).breakdown.excluded_penalty_or_turnover,1);
});
test('ambiguous possession and first/last edge sequences never infer a defensive stop',()=>{
 const unknown=[...sample];unknown[2]=e('UNK',30,2);
 assert.equal(attribution(unknown,fixture).breakdown.excluded_incomplete,1);
 const only=[...sample.slice(1)];
 assert.equal(attribution(only,fixture).breakdown.excluded_edge,1);
});
test('mixed or missing timestamps fail closed on candidate attribution',()=>{
 const mixed=[sample[0],sample[2],sample[1],...sample.slice(3)];
 const a=attribution(mixed,fixture);
 assert.equal(a.chronological_order,'mixed');
 assert.equal(a.observed_possession_segments,null);
 assert.equal(a.breakdown.candidate_attribution_only,0);
 const absent=sample.map(p=>({...p,playStatus:{...p.playStatus,secondsElapsed:null}}));
 const b=attribution(absent,fixture);
 assert.equal(b.chronological_order,'unknown');
 assert.equal(b.breakdown.candidate_attribution_only,0);
});
test('no play descriptions or player data leak in source audit response',()=>{
 const z=sample.map((p,i)=>({...p,description:'PRIVATE_LICENSED_PLAY_TEXT_'+i,
  player:{fullName:'PRIVATE PLAYER'}}));
 const d=inspect(wrap(z),fixture,'BUF','2026-11-05');
 const json=JSON.stringify(d);
 assert.ok(!json.includes('PRIVATE_LICENSED_PLAY_TEXT_'));
 assert.ok(!json.includes('PRIVATE PLAYER'));
 assert.equal(d.defense_candidate_attribution.source_data_not_republished,true);
 assert.equal(d.defense_candidate_attribution.read_only,true);
});
test('Data Health labels candidate defense attribution as unverified and no scoring',()=>{
 assert.match(ui,/Provisional defensive attribution:/);
 assert.match(ui,/candidates \(unverified\)/);
 assert.match(ui,/Team attribution remains uncertified; no fantasy points were awarded/);
 assert.match(ui,/D\/ST points NOT certified/);
 assert.match(worker,/defense_candidate_attribution:ffo634ReviewDefensiveAttribution\(rows,fixture\)/);
});
