import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const read=n=>readFileSync(new URL('./'+n,import.meta.url),'utf8');
const worker=read('_worker.js');
const lib=read('ffo-pfo-616.js');
const health=read('ffo-pfo-611.js');
const html=read('index.html');
const start=worker.indexOf('function ffo598NormalizeSeason(');
const stop=worker.indexOf('const ffo616DefenseCache=',start);
assert.ok(start>=0&&stop>start);
const ctx=createContext({});
new Script(worker.slice(start,stop)+';this.normalizers={season:ffo598NormalizeSeason,def:ffo616NormalizeDefense,team:ffo616NormalizeTeamSeason,fixtures:ffo618VerifiedFixtures};').runInContext(ctx);
const normalize=ctx.normalizers;

test('K: recognize exact MSF extraPoints.xpMade and distance case variants without inventing missing FG bands',()=>{
 const item={player:{fullName:'Will Reichard',id:13,primaryPosition:{abbreviation:'K'}},
  team:{abbreviation:'MIN'},stats:{gamesPlayed:7,extraPoints:{xpMade:21,xpMissed:1},
    fieldGoals:{fgMade40to49:4,fgMade:11}}};
 const row=normalize.season({playerStatsTotals:[item]},'2026-11-05').players[0];
 assert.equal(row.games_observed,7);
 assert.equal(row.forecast.xpm,3);
 assert.equal(row.forecast.xpmiss,1/7);
 assert.equal(row.forecast.fgm_40_49,4/7);
 assert.equal(row.forecast.fgm_50_59,undefined);
 assert.equal(row.forecast.fgm_20_29,undefined);
});

test('completed MSF schedules link logged games by immutable game id while requiring independently published points allowed',()=>{
 const fixtures=normalize.fixtures({games:[
  {schedule:{id:12,playedStatus:'COMPLETED',homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'BUF'}},score:{homeScoreTotal:20,awayScoreTotal:10}},
  {schedule:{id:14,playedStatus:'FINAL',homeTeam:{abbreviation:'GB'},awayTeam:{abbreviation:'MIN'}},score:{homeScoreTotal:27,awayScoreTotal:21}},
  {schedule:{id:19,playedStatus:'IN_PROGRESS',homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'NYJ'}},score:{homeScoreTotal:6,awayScoreTotal:0}},
  {schedule:{id:20,playedStatus:'SCHEDULED',homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'NYG'}},score:{homeScoreTotal:0,awayScoreTotal:0}}
 ]});
 assert.equal(fixtures.size,2);
 const data={teamGamelogs:[
  {team:{abbreviation:'MIN'},game:{id:12},stats:{defense:{sacks:4,interceptions:2,pointsAllowed:10}}},
  {team:{abbreviation:'MIN'},game:{id:14},stats:{defense:{sacks:2,interceptions:1,pointsAllowed:27}}},
  {team:{abbreviation:'MIN'},game:{id:19,playedStatus:'IN_PROGRESS'},stats:{defense:{sacks:5}}}
 ]};
 const out=normalize.def(data,'MIN','2026-11-05',fixtures);
 assert.equal(out.games_observed,2);
 assert.equal(out.forecast.sack,3);
 assert.equal(out.forecast.int,1.5);
 assert.equal(out.forecast.pts_allow_7_13,0.5);
 assert.equal(out.forecast.pts_allow_21_27,0.5);
 assert.equal(out.coverage.points_allowed_games,2);
 assert.equal(out.certified,false);
});

test('in-progress team games are excluded even if embedded score fields exist',()=>{
 const out=normalize.def({teamGamelogs:[{
  team:{abbreviation:'MIN'},game:{id:1,playedStatus:'IN_PROGRESS',homeTeamAbbreviation:'MIN',awayTeamAbbreviation:'BUF',homeScoreTotal:20,awayScoreTotal:13},stats:{defense:{sacks:8}}
 }]},'MIN','2026-11-05');
 assert.equal(out.available,false);
});

test('team D/ST season totals use verified finished team games for denominator if provider does not publish it',()=>{
 const fixtures=normalize.fixtures({games:[
  {schedule:{id:1,playedStatus:'COMPLETED',homeTeamAbbreviation:'MIN',awayTeamAbbreviation:'CHI'},score:{homeScoreTotal:21,awayScoreTotal:13}},
  {schedule:{id:2,playedStatus:'FINAL',homeTeamAbbreviation:'MIN',awayTeamAbbreviation:'DET'},score:{homeScoreTotal:10,awayScoreTotal:28}}
 ]});
 const row=normalize.team({teamStatsTotals:[{
  team:{abbreviation:'MIN'},stats:{defense:{sacks:8,interceptions:4}}
 }]},'MIN','2026-11-05',fixtures);
 assert.equal(row.games_observed,2);
 assert.equal(row.forecast.sack,4);
 assert.equal(row.forecast.int,2);
 assert.ok(!Object.keys(row.forecast).some(k=>k.startsWith('pts_allow_')),'raw final scoreboard is never FFL PA');
 assert.equal(row.coverage.points_allowed_games,0);
 assert.equal(row.coverage.denominator_source,'verified_finished_nfl_schedule');
 assert.equal(row.partial,true);
});
test('season totals never assume games played when neither provider nor completed games support it',()=>{
 const row=normalize.team({teamStatsTotals:[{
  team:{abbreviation:'MIN'},stats:{defense:{sacks:8}}
 }]},'MIN','2026-11-05',new Map());
 assert.equal(row.available,false);
 assert.equal(row.error,'team_games_played_unverified');
});
test('recover league opponent starters and defenses, disclose source errors before manual retry, preserve Trade Lab',()=>{
 assert.match(lib,/const relevantStarters=\(\)=>/);
 assert.match(lib,/opponent=row\.starters\.map\(String\)/);
 assert.match(lib,/relevantStarters\(\)\.all/);
 assert.match(lib,/button\.before\(panel\)/);
 assert.match(health,/playerErrors\.get\(id\)/);
 assert.match(health,/defenseErrors\.get\(team\)/);
 assert.match(worker,/2026-regular\/games\.json\?team=/);
 assert.match(worker,/ffo618VerifiedFixtures\(raw\?\.data\?\?raw\)/);
 assert.match(html,/ffo-pfo-616\.js\?v=620/);
 assert.doesNotMatch(lib,/trade-fold|trade-intel|pfo59-trade-existing/);
});

test('raw opposing scoreboard never becomes a fantasy defense points-allowed tier without supported provider accounting',()=>{
 const fixtures=normalize.fixtures({games:[{
  schedule:{id:12,playedStatus:'COMPLETED',homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'BUF'}},
  score:{homeScoreTotal:20,awayScoreTotal:10}
 }]});
 const row=normalize.def({teamGamelogs:[{
  team:{abbreviation:'MIN'},game:{id:12},stats:{defense:{sacks:3,interceptions:1}}
 }]},'MIN','2026-11-05',fixtures);
 assert.equal(row.games_observed,1);
 assert.equal(row.forecast.sack,3);
 assert.equal(row.coverage.points_allowed_games,0);
 assert.ok(!Object.keys(row.forecast).some(k=>k.startsWith('pts_allow_')));
 assert.equal(row.certified,false);
});
