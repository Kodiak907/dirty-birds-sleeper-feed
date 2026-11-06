import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const read=n=>readFileSync(new URL('./'+n,import.meta.url),'utf8');
const worker=read('_worker.js'),client=read('ffo-pfo-616.js'),html=read('index.html');
const start=worker.indexOf('function ffo598NormalizeSeason(');
const stop=worker.indexOf('const ffo598SeasonCache=',start);
assert.ok(start>=0&&stop>start);
function harness(fetchFn){
 const ctx=createContext({fetch:fetchFn,Response,Request,URL,AbortSignal,btoa,
  MSF_ROOT:'https://api.mysportsfeeds.com/v2.1/pull/nfl',
  comIdentity:async()=>true,
  ffoReply:(body,status=200)=>new Response(JSON.stringify(body),{status})
 });
 new Script("const ffo598NFLTeams=new Set('MIN PHI LAR SEA'.split(' '));\n"+
  worker.slice(start,stop)+
  "\nthis.api={player:ffo616PlayerGameRoute,parse:ffo623KickerBoxRow,repair:ffo623RecoverKicker};"
 ).runInContext(ctx);
 return ctx.api;
}
const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const route='https://private.example/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&msf_id=765&position=K&week=9';
const rawGames=()=>({games:[
 {schedule:{id:7008,week:8,playedStatus:'COMPLETED',homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'BUF'}}},
 {schedule:{id:7007,week:7,playedStatus:'FINAL',homeTeam:{abbreviation:'GB'},awayTeam:{abbreviation:'MIN'}}},
 {schedule:{id:7009,week:9,playedStatus:'SCHEDULED',homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'CHI'}}}
]});
function box(id,{badPlayer=false,unscored=false,wrongGame=false,duplicate=false}={}){
 const home=id===7008,player={id:badPlayer?999:765,firstName:'Will',lastName:'Reichard',position:'K'};
 const entry={player,playerStats:[unscored?{rushing:{rushYards:0}}:
  {extraPoints:{xpMade:2},fieldGoals:{fgMade40To49:1}}]};
 const rows=duplicate?[entry,entry]:[entry];
 return {gameboxscore:{game:{id:wrongGame?6666:id,
  homeTeam:{abbreviation:home?'MIN':'GB'},awayTeam:{abbreviation:home?'BUF':'MIN'}},
  stats:{home:{players:home?rows:[]},away:{players:home?[]:rows}}}};
}
test('published per-game MSF boxscore supports a uniquely identified kicker on either team and never assumes zero missing fields',async()=>{
 const requested=[];
 const api=harness(async endpoint=>{
  const u=new URL(endpoint);requested.push(u.pathname);
  if(u.pathname.endsWith('/games.json'))return send(rawGames());
  const m=u.pathname.match(/\/games\/(\d+)\/boxscore\.json$/);
  assert.ok(m,'no rejected season/player/weekly gamelog route is used');
  return send(box(Number(m[1])));
 });
 const r=await api.player(new Request(route),{MSF_API_KEY:'fake-key'});
 const d=await r.json();
 assert.equal(d.games_observed,2);
 assert.equal(d.forecast.xpm,2);
 assert.equal(d.forecast.fgm_40_49,1);
 assert.equal(d.forecast.fgm_50_59,undefined);
 assert.equal(d.position,'K');
 assert.equal(d.partial,true);
 assert.equal(d.certified,false);
 assert.match(d.projection_method,/completed-game kicker boxscores/);
 assert.equal(requested.length,3);
 assert.ok(requested.every(x=>!x.includes('gamelogs')));
 const again=await api.player(new Request(route),{MSF_API_KEY:'fake-key'});
 const d2=await again.json();
 assert.equal(d2.games_observed,2);
 assert.equal(requested.length,3,'cache avoids repeated licensed provider calls');
});
test('do not fetch ongoing, future or unsupported scheduled team games as historic kicker evidence',async()=>{
 const requested=[];
 const api=harness(async endpoint=>{
  const u=new URL(endpoint);requested.push(u.pathname);
  if(u.pathname.endsWith('/games.json'))return send({games:[rawGames().games[0],
   {schedule:{id:7007,week:7,playedStatus:'IN_PROGRESS',homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'BUF'}}},
   rawGames().games[2]]});
  return send(box(7008));
 });
 const r=await api.player(new Request(route),{MSF_API_KEY:'fake-key'});
 const d=await r.json();
 assert.equal(d.available,false);
 assert.match(d.error,/insufficient_completed_team_games/);
 assert.equal(requested.length,1);
});
test('wrong player identity, duplicate player IDs, and absent supported kicking categories all fail closed',()=>{
 const api=harness(async()=>send({}));
 const fixture={id:'7008',week:8,home:'MIN',away:'BUF'};
 const wrong=api.parse(box(7008,{badPlayer:true}),fixture,'MIN','Will Reichard','765','2026-11-05');
 assert.equal(wrong.available,false);
 const repeated=api.parse(box(7008,{duplicate:true}),fixture,'MIN','Will Reichard','765','2026-11-05');
 assert.equal(repeated.available,false);
 const unscored=api.parse(box(7008,{unscored:true}),fixture,'MIN','Will Reichard','765','2026-11-05');
 assert.equal(unscored.available,false);
 const game=api.parse(box(7008,{wrongGame:true}),fixture,'MIN','Will Reichard','765','2026-11-05');
 assert.equal(game.available,false);
 assert.equal(game.error,'boxscore_game_identity_conflict');
});
test('MSF boxscore 502 withholds kicker projection instead of guessing a value',async()=>{
 const api=harness(async endpoint=>{
  const u=new URL(endpoint);
  if(u.pathname.endsWith('/games.json'))return send(rawGames());
  return send({message:'upstream unavailable'},502);
 });
 const r=await api.player(new Request(route),{MSF_API_KEY:'fake-key'});
 const d=await r.json();
 assert.equal(d.available,false);
 assert.equal(d.forecast,undefined);
 assert.match(d.error,/kicker_boxscore_http_502/);
});
test('kicker projection recovery is source-isolated and no season, trade or Commissioner writes are touched',()=>{
 assert.match(worker,/ffo623RecoverKicker\(team,name,playerId,targetWeek,env,checked_at\)/);
 assert.match(worker,/2026-regular\/games\/'\+encodeURIComponent\(id\)\+'\/boxscore\.json/);
 assert.match(worker,/source_type:'licensed_primary'/);
 assert.match(worker,/ffo623BoxCache/);
 assert.match(client,/&position=/);
 assert.match(client,/PFO 6\.24 · bounded kicker provider recovery/);
 assert.match(html,/ffo-pfo-616\.js\?v=624/);
 assert.doesNotMatch(client,/trade-fold|trade-intel|pfo59-trade-existing/);
});
