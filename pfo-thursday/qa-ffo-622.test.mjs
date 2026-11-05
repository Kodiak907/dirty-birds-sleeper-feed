import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const read=n=>readFileSync(new URL('./'+n,import.meta.url),'utf8');
const worker=read('_worker.js'),client=read('ffo-pfo-616.js'),
 scheduleLib=read('ffo-pfo-597.js'),html=read('index.html');
const stored=JSON.parse(readFileSync(new URL('../data/nfl_schedule.json',import.meta.url),'utf8'));
const start=worker.indexOf('function ffo598NormalizeSeason('),
 end=worker.indexOf('const ffo598SeasonCache=',start);
assert.ok(start>=0&&end>start);
function harness(fetchFn){
 const ctx=createContext({fetch:fetchFn,Response,Request,URL,AbortSignal,btoa,
  MSF_ROOT:'https://api.mysportsfeeds.com/v2.1/pull/nfl',
  comIdentity:async()=>true,
  ffoReply:(body,status=200)=>new Response(JSON.stringify(body),{status})
 });
 new Script("const ffo598NFLTeams=new Set('MIN PHI LAR SEA'.split(' '));\n"+
  worker.slice(start,end)+
  "\nthis.player=ffo616PlayerGameRoute;"
 ).runInContext(ctx);
 return ctx.player;
}
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status});
const route='https://private.example/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&msf_id=765&week=9';
const row=week=>({player:{id:765,firstName:'Will',lastName:'Reichard',position:'K'},
 game:{id:1000+week,homeTeamAbbreviation:'MIN',awayTeamAbbreviation:'BUF'},
 stats:{extraPoints:{xpMade:2},fieldGoals:{fgMade40To49:1}}});
test('published NFLverse schedule LA alias resolves LAR Week 9 and Week 11 bye without modifying original data',()=>{
 assert.equal(stored.teams.LA.weeks['9'].opponent,'WAS');
 assert.equal(stored.teams.LA.weeks['11'].bye,true);
 assert.equal(stored.teams.LAR,undefined);
 const first=scheduleLib.indexOf('const ffo622NormalizeSchedule=d=>'),
 last=scheduleLib.indexOf(' async function loadSchedule()',first);
 assert.ok(first>=0&&last>first,'shared canonical schedule adapter is present');
 const vm=createContext({});
 new Script(scheduleLib.slice(first,last)+';this.adapt=ffo622NormalizeSchedule;').runInContext(vm);
 const adapted=vm.adapt(stored);
 assert.equal(adapted.teams.LAR.weeks['9'].opponent,'WAS');
 assert.equal(adapted.teams.LAR.weeks['11'].bye,true);
 assert.equal(adapted.teams.LAR,adapted.teams.LA,'no invented games or altered schedule');
 assert.equal(adapted.teams.MIN.weeks['9'].opponent,'BUF');
 assert.equal(stored.teams.LAR,undefined,'source object remains immutable');
 assert.match(scheduleLib,/verifiedSchedule=ffo622NormalizeSchedule\(d\)/);
});
test('completed prior-week recovery fetches first three weeks concurrently and stops early with verified evidence',async()=>{
 const seen=[];
 let release=()=>{};
 const barrier=new Promise(resolve=>{release=resolve});
 const player=harness(async url=>{
  const u=new URL(url),m=u.pathname.match(/\/week\/(\d+)\/player_gamelogs\.json$/);
  if(!m)return reply({message:'bad request'},400);
  const week=Number(m[1]);seen.push(week);
  if(seen.length===3)release();
  await barrier;
  return reply({gamelogs:[row(week)]});
 });
 const response=await player(new Request(route),{MSF_API_KEY:'placeholder'});
 const data=await response.json();
 assert.equal(data.games_observed,3);
 assert.equal(data.forecast.xpm,2);
 assert.deepEqual(seen.slice().sort((a,b)=>a-b),[6,7,8]);
 assert.match(data.projection_method,/up to six completed prior MSF weeks, batched/);
});
test('fetches older completed weeks in a second batch only when recent weeks lack two verifiable games',async()=>{
 const seen=[];
 const player=harness(async url=>{
  const u=new URL(url),m=u.pathname.match(/\/week\/(\d+)\/player_gamelogs\.json$/);
  if(!m)return reply({message:'bad request'},400);
  const wk=Number(m[1]);seen.push(wk);
  return reply({gamelogs:[wk<=5?row(wk):{
   player:{id:999,fullName:'Different Player',position:'K'},
   game:{id:1000+wk,homeTeamAbbreviation:'BUF',awayTeamAbbreviation:'MIN'},
   stats:{extraPoints:{xpMade:1}}
  }]});
 });
 const r=await player(new Request(route),{MSF_API_KEY:'placeholder'});
 const data=await r.json();
 assert.equal(data.games_observed,3);
 assert.equal(data.forecast.xpm,2);
 assert.deepEqual(seen.slice().sort((a,b)=>a-b),[3,4,5,6,7,8]);
});
test('unsupported weekly feeds remain unavailable rather than guessing zero',async()=>{
 const seen=[];
 const player=harness(async url=>{
  const u=new URL(url);seen.push(u.pathname);
  return reply({message:'Unsupported feed'},400);
 });
 const r=await player(new Request(route),{MSF_API_KEY:'placeholder'});
 const data=await r.json();
 assert.equal(data.available,false);
 assert.equal(data.forecast,undefined);
 assert.equal(seen.filter(x=>x.includes('/week/')).length,0,'explicit unsupported feed does not trigger probing');
});
test('mobile fetch permits bounded two-wave backend time while leaving models and Trade Lab untouched',()=>{
 assert.match(client,/AbortController\(\),timer=setTimeout\(\(\)=>ctl\.abort\(\),32000\)/);
 assert.match(worker,/Promise\.allSettled\(weeks\.map\(w=>ffo621PlayerWeekLogs\(w,env\)\)\)/);
 assert.match(worker,/Math\.min\(3,first-start\+1\)/);
 assert.match(worker,/AbortSignal\.timeout\(12000\)/);
 assert.match(client,/PFO 6\.22 · Rams schedule alias and accelerated player recovery/);
 assert.match(html,/ffo-pfo-616\.js\?v=622/);
 assert.doesNotMatch(client,/trade-fold|trade-intel|pfo59-trade-existing/);
});
