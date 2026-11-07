/**
 * PFO 6.43: source-of-truth browser model regression investigation.
 * Evaluate the ACTUAL 6.36 browser scoring/forecast snippets in Node VM.
 * This is NOT a certified server-side replica or live capture.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {BROWSER_SUPPORTED_FFL_STATS,scoreFrozenBrowserStats643,
 forecastBrowserSourceCandidate643,forecastBrowserDefenseOverlay643} from './ffo-server-forecast-643.mjs';

const read=name=>readFileSync(new URL('./'+name,import.meta.url),'utf8');
const core=read('ffo-pfo-core.js'),client=read('ffo-pfo-597.js'),
 defense=read('ffo-pfo-616.js'),html=read('index.html');
const rules=JSON.parse(read('FFO_FFL_SCORING_V1.json'));
const fragment=(source,begin,end)=>{
 const i=source.indexOf(begin),j=i<0?-1:source.indexOf(end,i+begin.length);
 assert.ok(i>=0&&j>i,'Review actual browser model source markers: '+begin);
 return source.slice(i,j);
};
const originalFunctions=fragment(core,'function pfo50Score(stats){','function pfo50StatTile(');
const frozenScoreSource=fragment(client,' const FFL_SUPPORTED_STATS=',' const loadFFLRules=');
const evidenceSource=fragment(client,' const ffo636RulesVersion=',' const sourceForecast=id=>{');
const forecastSource=fragment(client,' const sourceForecast=id=>{',' // A single independently scored forecast');
const sha=s=>createHash('sha256').update(s).digest('hex');

function actualBrowserModel({rows={},players={}}={}){
 const context=createContext({rules,rows,players});
 const program=[
  'const frozenFFLRules=rules.scoring;',
  'let pfo49ScoreFromStats=()=>null;',
  'const pfo50Indexed=new Map(Object.entries(rows));',
  'function pfo50StatsFor(id){return pfo50Indexed.get(String(id))||null;}',
  'function pfo52Info(id){return players[String(id)]||null;}',
  "function canonical(t){return String(t||'').toUpperCase();}",
  "function norm(n){return String(n||'').toLowerCase().replace(/[^a-z0-9]/g,'');}",
  originalFunctions, frozenScoreSource, evidenceSource,
  'const originalEstimate=pfo50Estimate;',
  'let estimateIndexRef=null; const estimateCache=new Map();',
  forecastSource,
  'this.model={original:pfo50Estimate,wrapped:sourceForecast,score:frozenScore,audit:ffo636AuditStatCoverage};'
 ].join('\n');
 new Script(program,{filename:'PFO_6_36_ACTUAL_BROWSER_SOURCE_EVAL'}).runInContext(context,{timeout:2000});
 return context.model;
}
const person=position=>({name:'Verified Fixture Player',team:'BUF',position});
function one(position,stats){
 return actualBrowserModel({rows:{'100':{name:'Verified Fixture Player',team:'BUF',position,forecast:stats}},
  players:{'100':person(position)}});
}

test('real application loads model baseline, scoring patch and D/ST companion in order',()=>{
 const paths=['/ffo-pfo-core.js?v=636','/ffo-pfo-597.js?v=636','/ffo-pfo-616.js?v=636'];
 const indices=paths.map(p=>html.indexOf(p));
 assert.ok(indices.every(n=>n>=0),'Model script missing from application');
 assert.ok(indices[0]<indices[1]&&indices[1]<indices[2]);
 assert.match(client,/pfo50Estimate=function\(id\)/);
 assert.match(client,/pfo52Points=function\(id,week,past=false\)/);
 assert.match(defense,/PFO_616_MSF_TEAM_DEFENSE_V1/);
});
test('current browser code (not an invented parallel model) is the test subject',()=>{
 assert.match(originalFunctions,/row\?\.forecast\?pfo50Score/);
 assert.match(forecastSource,/0\.65\*last\+0\.35\*seasonMean/);
 assert.match(frozenScoreSource,/points\+=multiplier\*count/);
 assert.match(evidenceSource,/scoringEvidenceComplete:false/);
 assert.equal(rules.version,'2026-11-05-ffl-screen-recording-verified-v4');
 for(const stat of ['fgm','def_3_and_out','def_4_and_stop','rush_40p'])assert.equal(rules.scoring[stat],0);
 assert.equal(sha(frozenScoreSource).length,64);
});
test('QB/RB/WR/TE: original and wrapped real browser model numeric parity',()=>{
 for(const [pos,stats,expected] of [
  ['QB',{pass_yd:250,pass_td:2,pass_int:1,fum_lost:1},14],
  ['RB',{rush_yd:70,rec:4,rec_yd:35},12.5],
  ['WR',{rec:6,rec_yd:100,rec_td:1},19],
  ['TE',{rec:4,rec_yd:60,rec_td:1},14]
 ]){
  const model=one(pos,stats),native=model.original('100'),wrapped=model.wrapped('100');
  assert.equal(native,expected,pos+' core score');
  assert.equal(wrapped.points,native,pos+' wrapper parity');
  assert.equal(wrapped.partial,true);
  assert.equal(wrapped.certified,false);
  assert.equal(wrapped.rulesVersion,rules.version);
 }
});
test('K: only explicitly verified distance categories score; unknown tier stays unknown',()=>{
 const model=one('K',{fgm:3,fgm_40_49:2,fgm_50_59:1,xpm:3});
 const projected=model.wrapped('100');
 assert.equal(projected.points,16);
 assert.equal(projected.points,model.original('100'));
 assert.equal(projected.certified,false);
 assert.ok(Array.from(projected.missingEvidence).includes('full_field_goal_distance_distribution_unverified'));
 const unknown=one('K',{fgm:1});
 assert.equal(unknown.original('100'),null);
 assert.equal(unknown.wrapped('100'),null);
});
test('D/ST: verified PA scoring and 0 for non-scoring three-and-outs / stops',()=>{
 const model=one('DEF',{sack:3,int:1,pts_allow_14_20:1,def_3_and_out:5,def_4_and_stop:3});
 assert.equal(model.original('100'),6);
 assert.equal(model.wrapped('100').points,6);
 assert.equal(model.wrapped('100').certified,false);
});
test('actual 6.36 fallback reproduces 65/35 recent-to-season calculation',()=>{
 const model=actualBrowserModel({
  rows:{'100':{name:'Verified Fixture Player',team:'BUF',position:'RB',
   season_totals:{rush_yd:220},games_played:2,
   games:[{week:1,stats:{rush_yd:50}},{week:2,stats:{rush_yd:80}}]}},
  players:{'100':person('RB')}
 });
 assert.equal(model.original('100'),null);
 const fallback=model.wrapped('100');
 assert.ok(Math.abs(fallback.points-8.075)<1e-9);
 assert.match(fallback.source,/65% last 3/);
 assert.equal(fallback.partial,true);
 assert.equal(fallback.certified,false);
});
test('missing independent player forecast and unknown identity do not become invented points',()=>{
 const model=actualBrowserModel({rows:{'100':{name:'Verified Fixture Player',team:'BUF',position:'RB'}},
  players:{'100':person('RB')}});
 assert.equal(model.wrapped('100'),null);
 assert.equal(model.wrapped('101'),null);
});

test('Worker-compatible stat whitelist exactly matches the live browser source',()=>{
 const context=createContext({});
 new Script(frozenScoreSource+'\nthis.keys=FFL_SUPPORTED_STATS;').runInContext(context);
 assert.deepEqual([...context.keys],[...BROWSER_SUPPORTED_FFL_STATS]);
});
test('candidate server source forecast equals actual 6.36 browser for six positions and fallback',()=>{
 const inputs=[
  ['QB',{pass_yd:250,pass_td:2,pass_int:1,fum_lost:1}],
  ['RB',{rush_yd:70,rec:4,rec_yd:35}],
  ['WR',{rec:6,rec_yd:100,rec_td:1}],
  ['TE',{rec:4,rec_yd:60,rec_td:1}],
  ['K',{fgm:3,fgm_40_49:2,fgm_50_59:1,xpm:3}],
  ['DEF',{sack:3,int:1,pts_allow_14_20:1,def_3_and_out:5}]
 ];
 for(const [position,stats] of inputs){
  const row={name:'Verified Fixture Player',team:'BUF',position,forecast:stats};
  const player=person(position);
  const browser=actualBrowserModel({rows:{'100':row},players:{'100':player}}).wrapped('100');
  const candidate=forecastBrowserSourceCandidate643({
   row,player,rules,uniqueMSFIdentityVerified:true
  });
  assert.equal(candidate.points,browser.points,position+' numeric parity');
  assert.equal(candidate.source,browser.source,position+' source wording');
  assert.equal(candidate.partial,browser.partial);
  assert.equal(candidate.certified,browser.certified);
  assert.deepEqual(candidate.missingEvidence,[...browser.missingEvidence]);
  assert.equal(candidate.sourceCategoriesObserved,browser.sourceCategoriesObserved);
  assert.equal(candidate.verifiedServerParity,false,'fixture equality alone is not certified live parity');
  assert.equal(scoreFrozenBrowserStats643(stats,rules).points,
   actualBrowserModel({rows:{'100':row},players:{'100':player}}).score(stats).points);
 }
 const row={name:'Verified Fixture Player',team:'BUF',position:'RB',
  season_totals:{rush_yd:220},games_played:2,
  games:[{week:1,stats:{rush_yd:50}},{week:2,stats:{rush_yd:80}}]};
 const player=person('RB');
 const a=actualBrowserModel({rows:{'100':row},players:{'100':player}}).wrapped('100');
 const b=forecastBrowserSourceCandidate643({row,player,rules,uniqueMSFIdentityVerified:true});
 assert.equal(a.points,b.points);
 assert.equal(a.source,b.source);
});
test('candidate cannot produce snapshot-compatible results without separately verified provider identity',()=>{
 const row={name:'Verified Fixture Player',team:'BUF',forecast:{rec:6}};
 const player=person('WR');
 assert.equal(forecastBrowserSourceCandidate643({row,player,rules}),null);
 assert.equal(forecastBrowserSourceCandidate643({row:{...row,team:'MIA'},player,rules,uniqueMSFIdentityVerified:true}),null);
});

test('current 6.16 D/ST override matches the separately extracted browser overlay, NOT generic core forecast',()=>{
 const source=fragment(defense,' const score=(row)=>{',' function renderDiagnostics(){');
 const raw={schema:'FFO_MSF_DEFENSE_GAMELOG_V1',games_observed:5,
  coverage:{points_allowed_games:5,defensive_stat_games:5},
  forecast:{sack:2.5,int:0.5,fum_rec:0.2,pts_allow_14_20:0.3}};
 const model=actualBrowserModel();
 const ctx=createContext({row:raw,window:{ffoPfo597:{scoreFrozen:stats=>model.score(stats)}}});
 new Script(source+'\nthis.projected=score(row);').runInContext(ctx);
 const candidate=forecastBrowserDefenseOverlay643({row:raw,rules,
  uniqueMSFIdentityVerified:true,
  weekFixture:{provider:'MSF',verified:true,bye:false,opponent:'MIA'}});
 assert.equal(candidate.points,ctx.projected.points);
 assert.equal(candidate.source,ctx.projected.source);
 assert.equal(candidate.model,ctx.projected.model);
 assert.equal(candidate.partial,true);
 assert.equal(candidate.certified,false);
 assert.equal(candidate.verifiedServerParity,false);
 for(const invalid of [
  {weekFixture:{provider:'MSF',verified:true,bye:true,opponent:'MIA'},
   uniqueMSFIdentityVerified:true},
  {weekFixture:{provider:'MSF',verified:true,bye:false,opponent:'MIA'},
   uniqueMSFIdentityVerified:false},
  {weekFixture:{provider:'Sleeper',verified:true,bye:false,opponent:'MIA'},
   uniqueMSFIdentityVerified:true}
 ])assert.equal(forecastBrowserDefenseOverlay643({row:raw,rules,...invalid}),null);
});
