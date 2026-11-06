import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const read=name=>readFileSync(new URL('./'+name,import.meta.url),'utf8');
const rules=JSON.parse(read('FFO_FFL_SCORING_V1.json'));
const client=read('ffo-pfo-597.js'),core=read('ffo-pfo-core.js'),
 health=read('ffo-pfo-616.js'),html=read('index.html');
const start=client.indexOf(' const ffo636RulesVersion=');
const stop=client.indexOf(' const sourceForecast=id=>{',start);
assert.ok(start>=0&&stop>start,'identify PFO 6.36 independent quality and subtotal helpers');
const ctx=createContext({rules:rules.scoring});
new Script('const frozenFFLRules=rules;\n'+client.slice(start,stop)+
 '\nthis.api={auditStat:ffo636AuditStatCoverage,auditLineup:ffo636AuditLineup};').runInContext(ctx);
const {auditStat,auditLineup}=ctx.api;

test('every audit is pinned to the authoritative Sleeper-video rules version',()=>{
 assert.equal(rules.version,'2026-11-05-ffl-screen-recording-verified-v4');
 const a=auditStat({pass_yd:250,pass_td:1,pass_int:0,fum_lost:0},'QB');
 assert.equal(a.rulesVersion,rules.version);
 assert.equal(a.partial,true);
 assert.equal(a.certified,false);
 assert.equal(a.scoringEvidenceComplete,false);
 assert.ok(Array.from(a.missingEvidence).includes('long_touchdown_distance_evidence'));
});

test('kicker generic makes do not establish distance tiers, even if a projection exists',()=>{
 const q=auditStat({fgm:2,fgm_40_49:1,xpm:2,xpmiss:0,fgmiss:0},'K');
 assert.ok(Array.from(q.missingEvidence).includes('field_goal_distance_buckets_incomplete'));
 assert.ok(Array.from(q.missingEvidence).includes('full_field_goal_distance_distribution_unverified'));
 assert.equal(q.certified,false);
 const none=auditStat({xpm:2,xpmiss:0,fgmiss:0},'K');
 assert.ok(Array.from(none.missingEvidence).includes('made_field_goal_count_unverified'));
});

test('known-zero defensive three-and-out points do not mask actual PA-tier evidence gaps',()=>{
 const q=auditStat({sack:3,int:1,fum_rec:0,def_td:0,def_3_and_out:5},'DEF');
 assert.ok(Array.from(q.missingEvidence).includes('defense_points_allowed_tier_unverified'));
 assert.equal(q.partial,true);
 assert.equal(rules.scoring.def_3_and_out,0);
 assert.equal(rules.scoring.def_4_and_stop,0);
});

test('10/10 starter estimates are numeric COVERAGE, never 10/10 independently certified scoring',()=>{
 const rows=Array.from({length:10},(_,i)=>({id:String(i+1),projection:{
  points:i===0?0:10+i/10,partial:true,certified:false
 }}));
 const a=auditLineup(rows,10);
 assert.equal(a.covered,10);
 assert.equal(a.required,10);
 assert.equal(a.partial,10);
 assert.equal(a.missing,0);
 assert.equal(a.certified,false);
 assert.ok(Array.from(a.issues).includes('one_or_more_scoring_profiles_uncertified'));
 const sum=rows.reduce((n,x)=>n+x.projection.points,0);
 assert.equal(a.subtotal,Math.round((sum+Number.EPSILON)*100)/100);
 assert.equal(a.rulesVersion,rules.version);
});

test('missing projections remain unknown and a legitimate forecast of zero counts as covered',()=>{
 const rows=[{id:'QB',projection:{points:0,partial:true}},
  {id:'RB',projection:{points:null}},
  {id:'WR',projection:null}];
 const a=auditLineup(rows,3);
 assert.equal(a.covered,1);
 assert.equal(a.subtotal,0);
 assert.equal(a.missing,2);
 assert.equal(a.partial,1);
 assert.equal(a.certified,false);
 assert.ok(Array.from(a.issues).includes('some_starter_projections_missing'));
});

test('duplicate starter IDs cannot be counted as distinct projected players',()=>{
 const a=auditLineup([
  {id:'same',projection:{points:9,partial:true}},
  {id:'same',projection:{points:9,partial:true}}],2);
 assert.equal(a.covered,1);
 assert.equal(a.subtotal,9);
 assert.equal(a.missing,1);
 assert.ok(Array.from(a.issues).includes('duplicate_starter_identity'));
});

test('one known full projection does not declare the entire incomplete lineup certified',()=>{
 const a=auditLineup([{id:'1',projection:{points:17,certified:true,partial:false}},
  {id:'2',projection:{points:5,certified:false,partial:true}}],2);
 assert.equal(a.partial,1);
 assert.equal(a.certified,false);
 assert.equal(a.subtotal,22);
});

test('UI propagates numeric/partial distinction through all forecast surfaces',()=>{
 assert.match(client,/partial:true/);
 assert.match(client,/ffo636AuditStatCoverage/);
 assert.match(client,/auditLineup:ffo636AuditLineup/);
 assert.match(client,/modelStatus:'provisional'/);
 assert.match(core,/numeric starter estimates/);
 assert.match(core,/scoring-evidence profiles provisional/);
 assert.match(core,/NOT a certified final team score/);
 assert.match(core,/Partial MSF scoring evidence/);
 assert.doesNotMatch(core,/complete independent model coverage/);
 assert.match(health,/Our submitted starters:/);
 assert.match(health,/three-and-outs award 0 FFL points/);
});

test('updated scripts are cache-busted on mobile; scoring contract itself is unchanged',()=>{
 assert.match(html,/ffo-pfo-core\.js\?v=636/);
 assert.match(html,/ffo-pfo-597\.js\?v=636/);
 assert.match(html,/ffo-pfo-616\.js\?v=636/);
 assert.match(client,/FFO_FFL_SCORING_V1\.json\?v=635/);
 assert.equal(rules.scoring.pass_td,4);
 assert.equal(rules.scoring.fgm,0);
 assert.equal(rules.scoring.fgm_40_49,4);
});
