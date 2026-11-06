import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const worker=readFileSync(new URL('./_worker.js',import.meta.url),'utf8');
const start=worker.indexOf('function ffo598NormalizeSeason(');
const end=worker.indexOf('const ffo616DefenseCache=',start);
assert.ok(start>=0&&end>start,'find protected MSF normalizers');

const ctx=createContext({});
new Script(worker.slice(start,end)+';this.audit={fixtures:ffo618VerifiedFixtures,defense:ffo616NormalizeDefense,team:ffo616NormalizeTeamSeason};').runInContext(ctx);
const {fixtures,defense,team}=ctx.audit;
const games=fixtures({games:[
 {schedule:{id:11,playedStatus:'COMPLETED',homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'BUF'}},score:{homeScoreTotal:27,awayScoreTotal:17}},
 {schedule:{id:12,playedStatus:'COMPLETED',homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'GB'}},score:{homeScoreTotal:28,awayScoreTotal:3}}
]});
const input=(id,stats)=>({team:{abbreviation:'MIN'},game:{id},stats});

test('generic standings pointsAgainst cannot become fantasy D/ST points-allowed tier',()=>{
 const out=defense({teamGamelogs:[input(11,{defense:{sacks:3},standings:{pointsAgainst:17}})]},'MIN','2026-11-05',games);
 assert.equal(out.games_observed,1);
 assert.equal(out.forecast.sack,3);
 assert.equal(out.coverage.points_allowed_games,0);
 assert.ok(!Object.keys(out.forecast).some(x=>x.startsWith('pts_allow_')));
 assert.equal(out.coverage.three_and_out_games,0);
 assert.ok(Array.from(out.coverage.unresolved_scoring_categories).includes('pts_allow'));
 assert.ok(Array.from(out.coverage.unresolved_scoring_categories).includes('def_3_and_out'));
 assert.equal(out.certified,false);
});

test('invalid noninteger or implausible defense.pointsAllowed never earns a PA tier or counts as verified',()=>{
 const out=defense({teamGamelogs:[
  input(11,{defense:{sacks:3,pointsAllowed:2.5}}),
  input(12,{defense:{sacks:2,pointsAllowed:101}})
 ]},'MIN','2026-11-05',games);
 assert.equal(out.games_observed,2);
 assert.equal(out.coverage.points_allowed_games,0);
 assert.ok(!Object.keys(out.forecast).some(x=>x.startsWith('pts_allow_')));
 assert.ok(Array.from(out.coverage.unresolved_scoring_categories).includes('pts_allow'));
});

test('exact source-owned defense.pointsAllowed is included but unknown three-and-outs remain unresolved',()=>{
 const out=defense({teamGamelogs:[
  input(11,{defense:{sacks:3,pointsAllowed:6}}),
  input(12,{defense:{sacks:2,pointsAllowed:3}})
 ]},'MIN','2026-11-05',games);
 assert.equal(out.coverage.points_allowed_games,2);
 assert.equal(out.forecast.pts_allow_1_6,1);
 assert.equal(out.forecast.sack,2.5);
 assert.deepEqual(Array.from(out.coverage.unresolved_scoring_categories),['def_3_and_out']);
 assert.ok(!Object.keys(out.forecast).includes('def_3_and_out'));
 assert.equal(out.certified,false);
});

test('scoreboard is completion proof but never synthetic points allowed',()=>{
 const out=defense({teamGamelogs:[input(11,{defense:{sacks:1}})]},'MIN','2026-11-05',games);
 assert.equal(out.coverage.points_allowed_games,0);
 assert.ok(!Object.keys(out.forecast).some(x=>x.startsWith('pts_allow_')));
 assert.equal(out.certified,false);
});

test('season D/ST source and Data Health both disclose partial coverage',()=>{
 const out=team({teamStatsTotals:[{team:{abbreviation:'MIN'},stats:{
  gamesPlayed:8,tackles:{sacks:24},interceptions:{interceptions:10}
 }}]},'MIN','2026-11-05',games);
 assert.ok(Array.from(out.coverage.scoring_categories).includes('sack'));
 assert.equal(out.coverage.three_and_out_games,0);
 assert.deepEqual(Array.from(out.coverage.unresolved_scoring_categories),['pts_allow','def_3_and_out']);
 const ui=readFileSync(new URL('./ffo-pfo-616.js',import.meta.url),'utf8');
 assert.match(ui,/D\/ST observed fields:/);
 assert.match(ui,/D\/ST scoring evidence:/);
 assert.match(ui,/unresolved_scoring_categories/);
 assert.match(ui,/partial\/uncertified/);
});
