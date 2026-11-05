import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
const file=n=>readFileSync(new URL(n,import.meta.url),'utf8');
const raw=file('./_worker.js'),core=file('./ffo-pfo-core.js'),
 patch=file('./ffo-pfo-597.js'),html=file('./index.html');
function createWorkerHarness(){
 const calls=[],records=[
  {player:{id:18,firstName:'Test',lastName:'Packer',primaryPosition:'WR'},
   team:{abbreviation:'GB'},stats:{gamesPlayed:4,receiving:{receptions:20,recYards:290,recTouchdowns:3}}},
  {player:{id:19,firstName:'Test',lastName:'Chief',primaryPosition:'QB'},
   team:{abbreviation:'KC'},stats:{gamesPlayed:4,passing:{passYards:700,passTD:5}}}
 ];
 const mockedFetch=async(url)=>{
  const u=String(url);calls.push(u);
  assert.match(u,/player_stats_totals\.json/);
  return new Response(JSON.stringify({playerStatsTotals:records,lastUpdatedOn:'2026-11-04'}),
   {status:200,headers:{'content-type':'application/json'}});
 };
 const ctx=createContext({Response,Request,Headers,URL,console,Date,Number,Map,Set,
  AbortController,AbortSignal,TextDecoder,TextEncoder,btoa,atob,fetch:mockedFetch});
 new Script(raw.replace(/\bexport\s+default\s+/,'const workerDefault = ')+
  ';comIdentity=async()=>true;globalThis.__route=ffo598SeasonRoute;').runInContext(ctx);
 return {call:ctx.__route,calls};
}
test('MSF team-scoped source is bounded and filters data to selected NFL team',async()=>{
 const h=createWorkerHarness();
 const result=await h.call(new Request('https://pfo.test/api/ffo/stats/season?team=GB'),
  {MSF_API_KEY:'SYNTHETIC_TEST_ONLY'});
 assert.equal(result.status,200);
 const json=await result.json();
 assert.equal(json.team,'GB');
 assert.equal(json.scope,'team');
 assert.equal(json.players_count,1);
 assert.equal(json.players[0].name,'Test Packer');
 assert.equal(json.players[0].season_totals.rec_yd,290);
 assert.equal(json.players[0].forecast.rec_yd,72.5);
 assert.equal(json.players[0].latest,null,'never invent week-specific logs from season totals');
 assert.equal(json.players[0].games.length,0);
 assert.match(h.calls[0],/player_stats_totals\.json\?team=GB$/);
});
test('Team-scoped MSF route rejects unrecognized team without provider request',async()=>{
 const h=createWorkerHarness();
 const result=await h.call(new Request('https://pfo.test/api/ffo/stats/season?team=XXX'),
  {MSF_API_KEY:'SYNTHETIC_TEST_ONLY'});
 assert.equal(result.status,400);
 assert.equal((await result.json()).error,'invalid_nfl_team');
 assert.equal(h.calls.length,0);
});
test('Existing FFL player-stat fields and identity safeguards are retained across app screens',()=>{
 assert.match(core,/pfo69RelevantTeams/);
 assert.match(core,/ffo\/stats\/season\?team=/);
 assert.match(core,/pfo50Independent=j;pfo50Indexed=matched/);
 assert.match(core,/for\(const key of ambiguous\)matched\.delete\(key\)/);
 assert.match(core,/if\(document\.querySelector\('#roster\.page\.active'\)\)pfo52RosterPoints\(\)/);
 assert.match(core,/if\(typeof pfo52Render==='function'\)pfo52Render\(\)/);
 assert.match(core,/function pfo69Submitted/);
 assert.match(core,/const baseline=past\?pfo52Actual\(ours,w\):pfo69Submitted\(ours,w\)/);
 assert.match(patch,/pfo52Points=function\(id,week,past=false\)/);
 assert.match(patch,/Never silently substitute Sleeper's previously scored/);
 assert.match(html,/id="ffo69-stats-status"/);
 assert.match(html,/id="ffo69-retry-stats"/);
 assert.match(html,/ffo-pfo-597\.js\?v=690/);
});
