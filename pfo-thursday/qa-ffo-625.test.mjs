import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const read=n=>readFileSync(new URL('./'+n,import.meta.url),'utf8');
const worker=read('_worker.js'),client=read('ffo-pfo-616.js'),html=read('index.html');
const start=worker.indexOf('function ffo598NormalizeSeason('),stop=worker.indexOf('const ffo598SeasonCache=',start);
assert.ok(start>=0&&stop>start);
function harness(fetchFn){
 const ctx=createContext({fetch:fetchFn,Response,Request,URL,AbortSignal,btoa,
  MSF_ROOT:'https://api.mysportsfeeds.com/v2.1/pull/nfl',
  comIdentity:async()=>true,
  ffoReply:(body,status=200)=>new Response(JSON.stringify(body),{status})
 });
 new Script("const ffo598NFLTeams=new Set('MIN PHI LAR SEA'.split(' '));\n"+worker.slice(start,stop)+
  "\nthis.api={route:ffo616PlayerGameRoute,parse:ffo623KickerBoxRow,audit:ffo625KickerFieldAudit};").runInContext(ctx);
 return ctx.api;
}
const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const route='https://private.example/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&msf_id=765&position=K&week=9';
const games={games:[7,8].map(week=>({schedule:{id:7000+week,week,
 playedStatus:'COMPLETED',homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'BUF'}}}))};
function box(week,playerStats) {
 return {gameboxscore:{game:{id:7000+week,homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'BUF'}},
  stats:{home:{players:[{player:{id:765,firstName:'Will',lastName:'Reichard',position:'K'},
   playerStats}]},away:{players:[]}}}};
}
test('MSF boxscore category-grouped FG and XP playerStats are normalized without guessing any FG distance',()=>{
 const api=harness(async()=>send({}));
 const fixture={id:'7008',home:'MIN',away:'BUF'};
 const row=api.parse(box(8,[
  {category:'Field Goals',stats:{fgMade40To49:1,fgAttempts:2}},
  {category:'Extra Points',stats:{xpMade:2,xpMissed:1}}
 ]),fixture,'MIN','Will Reichard','765','2026-11-05');
 assert.equal(row.available,true);
 assert.equal(row.stats.fgm_40_49,1);
 assert.equal(row.stats.xpm,2);
 assert.equal(row.stats.xpmiss,1);
 assert.equal(row.stats.fgm_50_59,undefined);
 assert.equal(row.stats.fgm_20_29,undefined);
});
test('unmapped verified kicking statistics produce only redacted field paths, never provider numerical values or secret field names',()=>{
 const api=harness(async()=>send({}));
 const row=api.parse(box(8,[{category:'Field Goals',stats:{
  fgMade:129,fgAttempts:3,secretToken:'DO_NOT_SHOW',apiKey:'PRIVATE',longest:52
 }}]),{id:'7008',home:'MIN',away:'BUF'},'MIN','Will Reichard','765','2026-11-05');
 assert.equal(row.available,false);
 assert.match(row.error,/scoring_categories_missing|no_supported_ffl_kicker_scoring_fields/);
 assert.match(row.schema_audit,/fgMade/);
 assert.match(row.schema_audit,/fgAttempts/);
 assert.doesNotMatch(row.schema_audit,/secret|token|private|apikey|129|52/i);
});
test('live protected kicker coverage route includes a redacted schema audit, without returning raw boxscores',async()=>{
 const api=harness(async url=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/games.json'))return send(games);
  const m=u.pathname.match(/\/games\/(\d+)\/boxscore\.json$/);
  assert.ok(m);
  return send(box(Number(m[1])-7000,[{category:'Field Goals',
   stats:{fgMadePct:75,fgAtt:4,secretToken:'NOT_VISIBLE'}}]));
 });
 const result=await api.route(new Request(route),{MSF_API_KEY:'fake-secret'});
 const data=await result.json();
 assert.equal(data.available,false);
 assert.match(data.error,/kicker_boxscore_/);
 assert.match(data.schema_audit,/fgMade/);
 assert.doesNotMatch(JSON.stringify(data),/NOT_VISIBLE|fake-secret|secretToken/);
 assert.equal(data.forecast,undefined);
});
test('kicker audit stays bounded, stat-value-free, scoring-independent and only edits source paths',()=>{
 const api=harness(async()=>send({}));
 const output=api.audit([{stats:{fieldGoals:{fgMade:2345,fgAtt:2},extraPoints:{xpMade:2}}}]);
 assert.match(output,/fieldGoals\.fgMade/);
 assert.match(output,/extraPoints\.xpMade/);
 assert.doesNotMatch(output,/2345/);
 assert.ok(output.length<=240);
 assert.match(client,/verified_kicker_field_paths/);
 assert.match(client,/PFO 6\.27 · kicker scoring-play and data-quality audit/);
 assert.match(html,/ffo-pfo-616\.js\?v=636/);
 assert.doesNotMatch(client,/trade-fold|trade-intel|pfo59-trade-existing/);
});
