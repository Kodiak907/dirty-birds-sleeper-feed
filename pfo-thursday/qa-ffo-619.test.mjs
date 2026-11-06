import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const read=n=>readFileSync(new URL('./'+n,import.meta.url),'utf8');
const worker=read('_worker.js');
const client=read('ffo-pfo-616.js');
const html=read('index.html');
const start=worker.indexOf('function ffo598NormalizeSeason(');
const end=worker.indexOf('const ffo598SeasonCache=',start);
assert.ok(start>=0&&end>start);
const build=(fetchFn)=>{
 const ctx=createContext({
  fetch:fetchFn,Response,Request,AbortSignal,btoa,URL,
  MSF_ROOT:'https://api.mysportsfeeds.com/v2.1/pull/nfl',
  comIdentity:async()=>true,
  ffoReply:(data,status=200)=>new Response(JSON.stringify(data),{status}),
 });
 new Script("const ffo598NFLTeams=new Set('MIN PHI LAR SEA'.split(' '));\n"+
  worker.slice(start,end)+
  "\nthis.routes={player:ffo616PlayerGameRoute,team:ffo616DefenseRoute};this.slug=ffo619TeamSlug;"
 ).runInContext(ctx);
 return ctx;
};
const logs={gamelogs:[1,2].map(id=>({
 player:{id:765,firstName:'Will',lastName:'Reichard',primaryPosition:{abbreviation:'K'}},
 team:{abbreviation:'MIN'},game:{id},
 stats:{extraPoints:{xpMade:2},fieldGoals:{fgMade40To49:1}}
}))};
test('player game-log recovery uses documented player identity filter; 400 on ID retries named slug without fetching team-wide logs',async()=>{
 const seen=[];
 const ctx=build(async url=>{
  seen.push(String(url));
  const u=new URL(url);
  assert.equal(u.pathname.endsWith('/player_gamelogs.json'),true);
  assert.equal(u.searchParams.has('team'),false);
  return u.searchParams.get('player')==='765'?
   new Response('{"error":"bad filter"}',{status:400}):
   new Response(JSON.stringify(logs),{status:200});
 });
 const data=await ctx.routes.player(new Request('https://private.example/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&msf_id=765&week=9'),{MSF_API_KEY:'fake-key'});
 const body=await data.json();
 assert.notEqual(body.available,false);
 assert.equal(body.source,'MySportsFeeds');
 assert.equal(body.team,'MIN');
 assert.equal(body.games_observed,2);
 assert.equal(body.forecast.xpm,2);
 assert.equal(body.forecast.fgm_40_49,1);
 assert.equal(seen.length,2);
 assert.match(seen[0],/\?player=765$/);
 assert.match(seen[1],/\?player=will-reichard$/);
});
test('provider player id mismatch withholds projections despite matching name',async()=>{
 const ctx=build(async()=>new Response(JSON.stringify(logs),{status:200}));
 const response=await ctx.routes.player(new Request('https://private.example/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&msf_id=123&week=9'),{MSF_API_KEY:'fake-key'});
 const data=await response.json();
 assert.equal(data.available,false);
 assert.match(data.error,/insufficient_verified_player_game_logs/);
});
test('provider HTTP 403 is not repeatedly retried and credentials never enter error response',async()=>{
 let count=0;
 const ctx=build(async()=>{count++;return new Response('{}',{status:403});});
 const response=await ctx.routes.player(new Request('https://private.example/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&msf_id=765&week=9'),{MSF_API_KEY:'fake-key'});
 const data=await response.json();
 assert.equal(data.available,false);
 assert.equal(count,1);
 assert.match(data.error,/player_filter_id_http_403/);
 assert.doesNotMatch(JSON.stringify(data),/fake-key/);
});
test('team defense switches rejected abbreviations to documented hyphenated team identities without changing scoring',()=>{
 const ctx=build(async()=>new Response('{}',{status:400}));
 assert.equal(ctx.slug.MIN,'minnesota-vikings');
 assert.equal(ctx.slug.PHI,'philadelphia-eagles');
 assert.equal(ctx.slug.SEA,'seattle-seahawks');
 assert.match(worker,/team_gamelogs\.json\?team='\+encodeURIComponent\(teamFilter\)/);
 assert.match(worker,/team_stats_totals\.json\?team='\+encodeURIComponent\(teamFilter\)/);
 assert.match(worker,/team_stats_totals\.json'\}/);
 assert.match(worker,/MSF_TEAM_RESPONSE_TOO_LARGE/);
 assert.match(worker,/const target=MSF_ROOT\+'\/2026-regular\/games\.json\?team='\+encodeURIComponent\(team\)/);
 assert.match(worker,/comIdentity\(req,env\)/);
});
test('client supplies uniquely mapped licensed MSF identifier and does not copy Sleeper fantasy points',()=>{
 assert.match(client,/row\?\.msf_id/);
 assert.match(client,/&msf_id=/);
 assert.match(client,/player_game_logs_do_not_cover_FFL_scoring_fields/);
 assert.match(html,/ffo-pfo-616\.js\?v=627/);
 assert.doesNotMatch(client,/trade-fold|trade-intel|pfo59-trade-existing/);
});

test('MSF player logs without per-row team are accepted only with sourced ID and a verified game involving the NFL team',async()=>{
 const source={gamelogs:[1,2].map(id=>({
  player:{id:765,firstName:'Will',lastName:'Reichard',position:'K'},
  game:{id,homeTeamAbbreviation:'MIN',awayTeamAbbreviation:'BUF'},
  stats:{extraPoints:{xpMade:2}}
 }))};
 const ctx=build(async()=>new Response(JSON.stringify(source),{status:200}));
 const r=await ctx.routes.player(new Request('https://private.example/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&msf_id=765&week=9'),{MSF_API_KEY:'fake-key'});
 const data=await r.json();
 assert.equal(data.games_observed,2);
 assert.equal(data.forecast.xpm,2);
 const noId=await ctx.routes.player(new Request('https://private.example/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&week=9'),{MSF_API_KEY:'fake-key'});
 const noIdData=await noId.json();
 assert.equal(noIdData.available,false);
});
test('no-team MSF gamelog from an unrelated game is never attributed to the selected roster team',async()=>{
 const source={gamelogs:[1,2].map(id=>({
  player:{id:765,firstName:'Will',lastName:'Reichard',position:'K'},
  game:{id,homeTeamAbbreviation:'NE',awayTeamAbbreviation:'BUF'},
  stats:{extraPoints:{xpMade:2}}
 }))};
 const ctx=build(async()=>new Response(JSON.stringify(source),{status:200}));
 const r=await ctx.routes.player(new Request('https://private.example/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&msf_id=765&week=9'),{MSF_API_KEY:'fake-key'});
 const data=await r.json();
 assert.equal(data.available,false);
 assert.match(data.error,/insufficient_verified_player_game_logs/);
});
