import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const read=n=>readFileSync(new URL('./'+n,import.meta.url),'utf8');
const worker=read('_worker.js'),client=read('ffo-pfo-616.js'),html=read('index.html');
const start=worker.indexOf('function ffo598NormalizeSeason('),stop=worker.indexOf('const ffo598SeasonCache=',start);
assert.ok(start>=0&&stop>start);
const harness=fetchFn=>{
 const context=createContext({fetch:fetchFn,Response,Request,URL,AbortSignal,btoa,
  MSF_ROOT:'https://api.mysportsfeeds.com/v2.1/pull/nfl',
  comIdentity:async()=>true,
  ffoReply:(body,status=200)=>new Response(JSON.stringify(body),{status})
 });
 new Script("const ffo598NFLTeams=new Set('MIN PHI LAR SEA'.split(' '));\n"+worker.slice(start,stop)+
  "\nthis.api={team:ffo616NormalizeTeamSeason,player:ffo616PlayerGameRoute,teamRoute:ffo616DefenseRoute};"
 ).runInContext(context);
 return context.api;
};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
test('real MSF NFL team stat categories map to FFL D/ST without conflating passing turnovers',()=>{
 const api=harness(async()=>response({}));
 const input={teamStatsTotals:[{team:{abbreviation:'MIN'},stats:{
  gamesPlayed:8,
  tackles:{sacks:24,tackleSolo:90},
  interceptions:{interceptions:10,intTD:1,safeties:1,kb:2},
  fumbles:{fumForced:12,fumOppRec:7},
  passing:{passInt:22}
 }}]};
 const out=api.team(input,'MIN','2026-11-05');
 assert.equal(out.games_observed,8);
 assert.equal(out.forecast.sack,3);
 assert.equal(out.forecast.int,1.25);
 assert.equal(out.forecast.def_st_ff,1.5);
 assert.equal(out.forecast.def_st_fum_rec,0.875);
 assert.equal(out.forecast.safe,0.125);
 assert.equal(out.forecast.blk_kick,0.25);
 assert.equal(out.forecast.def_st_td,0.125);
 assert.equal(out.forecast.pass_int,undefined);
 assert.equal(out.coverage.points_allowed_games,0);
 assert.equal(out.partial,true);
});
test('unsupported team defense fields are not invented as zero or borrowed from offensive passing interceptions',()=>{
 const api=harness(async()=>response({}));
 const out=api.team({teamStatsTotals:[{team:{abbreviation:'PHI'},stats:{
  gamesPlayed:8,passing:{passInt:15,passSacked:20},fumbles:{fumLost:9}
 }}]},'PHI','2026-11-05');
 assert.equal(out.available,false);
 assert.equal(out.error,'team_defense_scoring_stats_unavailable');
});
test('HTTP400 season gamelogs fall back to bounded weekly NFL provider paths and verified player games',async()=>{
 const seen=[];
 const api=harness(async url=>{
  const u=new URL(url);seen.push(u);
  if(u.pathname.endsWith('/2026-regular/player_gamelogs.json'))
   return response({message:'Bad request'},400);
  const found=u.pathname.match(/\/2026-regular\/week\/(\d+)\/player_gamelogs\.json$/);
  assert.ok(found,'weekly pathname must match documented MSF route');
  const week=Number(found[1]);
  assert.ok(week>=3&&week<=8,'only six finished prior weeks');
  const game={id:1000+week,homeTeamAbbreviation:'MIN',awayTeamAbbreviation:'BUF',week};
  return response({gamelogs:[{player:{id:765,firstName:'Will',lastName:'Reichard',position:'K'},
   game,stats:{extraPoints:{xpMade:2}}}]});
 });
 const result=await api.player(new Request('https://private.example/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&msf_id=765&week=9'),{MSF_API_KEY:'placeholder'});
 const data=await result.json();
 assert.notEqual(data.available,false);
 assert.equal(data.games_observed,3);
 assert.equal(data.forecast.xpm,2);
 assert.equal(seen.length,5);
 assert.ok(seen.slice(2).every(u=>!u.searchParams.has('player')&&!u.searchParams.has('team')));
 assert.ok(seen.slice(2).every(u=>/\/week\/[6-8]\//.test(u.pathname)));
});
test('weekly fallback never treats unverified team or guessed player id as a scored appearance',async()=>{
 const api=harness(async url=>{
  const u=new URL(url);
  if(!u.pathname.includes('/week/'))return response({message:'Bad request'},400);
  const week=Number(u.pathname.match(/week\/(\d+)/)[1]);
  return response({gamelogs:[{
   player:{id:9999,firstName:'Will',lastName:'Reichard',position:'K'},
   game:{id:week,homeTeamAbbreviation:'NE',awayTeamAbbreviation:'BUF'},
   stats:{extraPoints:{xpMade:2}}
  }]});
 });
 const result=await api.player(new Request('https://private.example/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&msf_id=765&week=9'),{MSF_API_KEY:'placeholder'});
 const data=await result.json();
 assert.equal(data.available,false);
 assert.equal(data.forecast,undefined);
 assert.match(data.error,/weekly_insufficient_verified_player_game_logs/);
});
test('client supplies target week and retains partial independent scoring boundaries',()=>{
 assert.match(client,/&week=/);
 assert.match(client,/PFO 6\.27 · kicker scoring-play and data-quality audit/);
 assert.match(worker,/week\/'\+week\+'\/player_gamelogs\.json/);
 assert.match(worker,/ffo621PlayerWeekCache/);
 assert.match(worker,/comIdentity\(req,env\)/);
 assert.match(html,/ffo-pfo-616\.js\?v=636/);
 assert.doesNotMatch(client,/trade-fold|trade-intel|pfo59-trade-existing/);
});
