import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const read=n=>readFileSync(new URL('./'+n,import.meta.url),'utf8');
const worker=read('_worker.js'),client=read('ffo-pfo-616.js'),health=read('ffo-pfo-611.js'),html=read('index.html');
const start=worker.indexOf('function ffo598NormalizeSeason(');
const stop=worker.indexOf('const ffo598SeasonCache=',start);
assert.ok(start>=0&&stop>start);
const fastSignal={timeout:()=>{
 const ctl=new AbortController();
 setTimeout(()=>ctl.abort(),25);
 return ctl.signal;
}};
function harness(fetchFn){
 const ctx=createContext({fetch:fetchFn,Response,Request,URL,btoa,AbortSignal:fastSignal,
  MSF_ROOT:'https://api.mysportsfeeds.com/v2.1/pull/nfl',
  comIdentity:async()=>true,
  ffoReply:(body,status=200)=>new Response(JSON.stringify(body),{status})
 });
 new Script("const ffo598NFLTeams=new Set('MIN PHI LAR SEA'.split(' '));\n"+worker.slice(start,stop)+
  "\nthis.api={route:ffo616PlayerGameRoute,read:ffo624KickerBoundedJSON};"
 ).runInContext(ctx);
 return ctx.api;
}
const route='https://private.example/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&msf_id=765&position=K&week=9';
test('hard deadline returns failure for internal gateway that never resolves, without browser abort',async()=>{
 const api=harness(async()=>new Promise(()=>{}));
 const env={GAMECAST_INTERNAL:{fetch:async()=>new Promise(()=>{})}};
 const t=Date.now();
 const r=await api.route(new Request(route),env);
 const data=await r.json();
 assert.equal(data.available,false);
 assert.equal(data.error,'kicker_boxscore_completed_game_schedule_provider_timeout');
 assert.equal(data.forecast,undefined);
 assert.ok(Date.now()-t<800,'timeout is bounded at the Worker regardless of binding behavior');
});
test('hard deadline includes HTTP body reading, not only receipt of response headers',async()=>{
 const stream=new ReadableStream({start(){}});
 const api=harness(async()=>new Response(stream,{status:200}));
 await assert.rejects(
  ()=>api.read('https://api.mysportsfeeds.com/v2.1/pull/nfl/2026-regular/games.json',
   {MSF_API_KEY:'fake'},6500,1000),
  /kicker_provider_deadline_exceeded/
 );
});
test('per-game HTTP 502 is not retried into five more failing requests or turned into a fantasy estimate',async()=>{
 const called=[];
 const api=harness(async target=>{
  const u=new URL(target);called.push(u.pathname);
  if(u.pathname.endsWith('/games.json'))return new Response(JSON.stringify({games:[
   {schedule:{id:7008,week:8,playedStatus:'COMPLETED',homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'BUF'}}},
   {schedule:{id:7007,week:7,playedStatus:'FINAL',homeTeam:{abbreviation:'GB'},awayTeam:{abbreviation:'MIN'}}},
   {schedule:{id:7006,week:6,playedStatus:'FINAL',homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'CHI'}}}
  ]}),{status:200});
  return new Response('{"error":"upstream bad gateway"}',{status:502});
 });
 const r=await api.route(new Request(route),{MSF_API_KEY:'fake'});
 const d=await r.json();
 assert.equal(d.available,false);
 assert.equal(d.forecast,undefined);
 assert.match(d.error,/kicker_boxscore_http_502/);
 assert.equal(called.length,3,'one schedule query and only one 2-game batch');
});
test('kicker gateway recovery retains hard budgets and explicitly reports source gap',()=>{
 assert.match(worker,/ffo624KickerBoundedJSON\(endpoint,env,6500,1500000\)/);
 assert.match(worker,/ffo624KickerBoundedJSON\(endpoint,env,6500,2800000\)/);
 assert.match(worker,/Promise\.race\(\[task,deadline\]\)/);
 assert.match(worker,/sort\(\(a,b\)=>b\.week-a\.week\)\.slice\(0,4\)/);
 assert.match(worker,/http_\(400\|401\|403\|429\|502\|503\|504\)\|provider_timeout/);
 assert.match(client,/checking_verified_kicker_boxscores/);
 assert.match(client,/PFO 6\.25 · verified kicker field schema audit/);
 assert.match(health,/checking licensed completed-game kicker boxscores/);
 assert.match(html,/ffo-pfo-616\.js\?v=625/);
 assert.match(html,/ffo-pfo-611\.js\?v=624/);
 assert.doesNotMatch(client,/trade-fold|trade-intel|pfo59-trade-existing/);
});
