import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const read=n=>readFileSync(new URL('./'+n,import.meta.url),'utf8');
const worker=read('_worker.js'),lib=read('ffo-pfo-616.js'),core=read('ffo-pfo-core.js');
const ffl=read('ffo-pfo-597.js'),health=read('ffo-pfo-611.js');
const html=read('index.html'),scoring=JSON.parse(read('FFO_FFL_SCORING_V1.json')).scoring;
const between=(a,b)=>{const i=worker.indexOf(a),j=worker.indexOf(b,i);assert.ok(i>=0&&j>i,'worker extraction: '+a);return worker.slice(i,j)};
const normalizers=between('function ffo598NormalizeSeason(','const ffo598SeasonCache=');
const ctx=createContext({});
new Script(normalizers+
 '\nthis.fns={season:ffo598NormalizeSeason,team:ffo616NormalizeDefense,teamSeason:ffo616NormalizeTeamSeason,player:ffo616NormalizePlayerGames}').runInContext(ctx);
const {season,team,teamSeason,player}=ctx.fns;

test('MSF field-goal distance aliases and observed game denominators survive provider normalization',()=>{
 const out=season({playerStatsTotals:[{player:{id:101,fullName:'Will Reichard',primaryPosition:{abbreviation:'K'}},
  team:{abbreviation:'MIN'},stats:{gamesPlayed:7,fieldGoals:{fgMade40To49:4,fgMade20To29:2},
   kicking:{xpMade:21}}}]},'2026-11-05');
 assert.equal(out.players[0].position,'K');
 assert.equal(out.players[0].games_observed,7);
 assert.equal(out.players[0].forecast.fgm_40_49,4/7);
 assert.equal(out.players[0].forecast.fgm_20_29,2/7);
 assert.equal(out.players[0].forecast.xpm,3);
 assert.equal(out.players[0].forecast.fgm_60p,undefined,'unpublished stats are not filled with zeros');
});

test('team defensive game logs derive only independently supported component averages and PA tiers',()=>{
 const out=team({teamGamelogs:[
 {team:{abbreviation:'MIN'},game:{id:1,playedStatus:'FINAL',homeTeamAbbreviation:'MIN',
   awayTeamAbbreviation:'BUF',homeScoreTotal:27,awayScoreTotal:13},stats:{defense:{sacks:4,interceptions:1,forcedFumbles:1,fumbleRecoveries:1,pointsAllowed:13}}},
 {team:{abbreviation:'MIN'},game:{id:2,playedStatus:'FINAL',homeTeamAbbreviation:'GB',
   awayTeamAbbreviation:'MIN',homeScoreTotal:30,awayScoreTotal:22},stats:{defense:{sacks:3,interceptions:0,pointsAllowed:30}}}
 ]},'MIN','2026-11-05');
 assert.equal(out.team,'MIN');
 assert.equal(out.games_observed,2);
 assert.equal(out.forecast.sack,3.5);
 assert.equal(out.forecast.int,0.5);
 assert.equal(out.forecast.def_st_ff,0.5);
 assert.equal(out.forecast.def_st_fum_rec,0.5);
 assert.equal(out.forecast.pts_allow_7_13,0.5);
 assert.equal(out.forecast.pts_allow_28_34,0.5);
 assert.equal(out.coverage.points_allowed_games,2);
 assert.equal(out.coverage.defensive_stat_games,2);
 assert.equal(out.certified,false);
 assert.ok(!Object.keys(out.forecast).includes('pts_allow_0'),'no inferred shutouts');
});

test('nonfinal/scheduled games never contribute to a defense model',()=>{
 const x=team({teamGameLogs:[{team:{abbreviation:'MIN'},game:{id:13,status:'SCHEDULED',
  homeTeamAbbreviation:'MIN',awayTeamAbbreviation:'BUF',homeScoreTotal:0,awayScoreTotal:0},
  stats:{defense:{sacks:0}}}]},'MIN','2026-11-05');
 assert.equal(x.available,false);
 assert.equal(x.games_observed,0);
});

test('independent season team totals fallback explicitly withholds unknown PA tiers',()=>{
 const x=teamSeason({teamStatsTotals:[{team:{abbreviation:'MIN'},stats:{
  gamesPlayed:8,defense:{sacks:24,interceptions:12,forcedFumbles:10}
 }}]},'MIN','2026-11-05');
 assert.equal(x.games_observed,8);
 assert.equal(x.forecast.sack,3);
 assert.equal(x.forecast.def_st_ff,1.25);
 assert.equal(x.coverage.points_allowed_games,0);
 assert.equal(x.partial,true);
 assert.ok(!Object.keys(x.forecast).some(k=>k.startsWith('pts_allow_')));
});

test('individual player gamelog recovery uses actual games, strict same-team identity, and FFL-scoring fields',()=>{
 const out=player({playerGamelogs:[{player:{id:101,fullName:'Will Reichard',primaryPosition:'K'},
  team:{abbreviation:'MIN'},game:{id:21},stats:{fieldGoals:{fgMade40To49:2},kicking:{xpMade:3}}},
 {player:{id:101,fullName:'Will Reichard',primaryPosition:'K'},
  team:{abbreviation:'MIN'},game:{id:22},stats:{fieldGoals:{fgMade40To49:0},kicking:{xpMade:2}}},
 {player:{id:101,fullName:'Will Reichard',primaryPosition:'K'},
  team:{abbreviation:'GB'},game:{id:23},stats:{fieldGoals:{fgMade40To49:9}}}
 ]},'MIN','Will Reichard','2026-11-05');
 assert.equal(out.games_observed,2);
 assert.equal(out.forecast.fgm_40_49,1);
 assert.equal(out.forecast.xpm,2.5);
 assert.equal(out.season_totals.games_played,2);
 assert.equal(out.forecast.fgm_20_29,undefined);
 assert.equal(out.source_type,'licensed_primary');
});

test('ambiguous provider IDs withheld; no data zeroes are invented',()=>{
 const x=player({playerGamelogs:[
 {player:{id:11,fullName:'Kyren Williams'},team:{abbreviation:'LAR'},game:{id:1},stats:{rushing:{rushYards:45}}},
 {player:{id:22,fullName:'Kyren Williams'},team:{abbreviation:'LAR'},game:{id:2},stats:{rushing:{rushYards:40}}}
 ]},'LAR','Kyren Williams','2026-11-05');
 assert.equal(x.available,false);
 assert.match(x.error,/ambiguous/);
});

test('FFL scoring includes team-specific forced fumbles, TDs and exact PA tiers',()=>{
 for(const k of ['def_st_ff','def_st_fum_rec','def_st_td','pts_allow_0','pts_allow_7_13','pts_allow_35p'])
  assert.match(ffl,new RegExp("'"+k+"'"));
 const stats={sack:3.5,int:.5,def_st_ff:.5,def_st_fum_rec:.5,pts_allow_7_13:.5,pts_allow_28_34:.5};
 const expected=Object.entries(stats).reduce((sum,[k,v])=>sum+Number(scoring[k]||0)*v,0);
 assert.ok(Number.isFinite(expected));
 assert.equal(expected,7,'fixture arithmetic is independent and deterministic');
});

test('team defense and individual gamelog routes are protected and scoped',()=>{
 assert.match(worker,/async function ffo616DefenseRoute\(req,env\)/);
 assert.match(worker,/async function ffo616PlayerGameRoute\(req,env\)/);
 for(const key of ['ffo616DefenseRoute','ffo616PlayerGameRoute']){
  const start=worker.indexOf('async function '+key);
  const end=worker.indexOf('\n}\n',start);
  const src=worker.slice(start,end);
  assert.match(src,/comIdentity\(req,env\)/,'Cloudflare access is mandatory');
  assert.match(src,/ffo598NFLTeams\.has\(team\)/,'valid teams only');
 }
 assert.match(worker,/url\.pathname==='\/api\/ffo\/stats\/defense'/);
 assert.match(worker,/url\.pathname==='\/api\/ffo\/stats\/player-coverage'/);
 assert.match(worker,/team_gamelogs\.json\?team=/);
 assert.match(worker,/player_gamelogs\.json\?team=/);
 assert.doesNotMatch(lib,/players_points|Sleeper previous scored weeks/);
});

test('same week independent FFL score model gets licensed team defense with explicit partial classification',()=>{
 assert.match(lib,/pfo52Points=function\(id,week,past=false\)/);
 assert.match(lib,/source:'licensed MSF, never Sleeper projections'/);
 assert.match(lib,/partial:true,certified:false/);
 assert.match(lib,/playerRecovered.add\(id\)/);
 assert.match(lib,/pfo50Indexed=copy/);
 assert.match(lib,/scoreFrozen/);
 assert.match(lib,/coverage:/);
 assert.match(health,/Partial D\/ST estimates/);
 assert.match(html,/ffo-pfo-616\.js\?v=619/);
});

test('never mutate the Trade Laboratory workspace in this release',()=>{
 assert.doesNotMatch(lib,/trade-fold|trade-intel|pfo59-trade-existing/);
 assert.match(html,/ffo-pfo-613\.js/);
});

test('browser source scripts compile without runtime dependencies',()=>{
 for(const name of ['ffo-pfo-core.js','ffo-pfo-597.js','ffo-pfo-616.js','ffo-pfo-611.js','ffo-startsit-63.js'])
  new Script(read(name),{filename:name});
});
