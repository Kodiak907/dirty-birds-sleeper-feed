import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const read=n=>readFileSync(new URL('./'+n,import.meta.url),'utf8');
const worker=read('_worker.js'),client=read('ffo-pfo-616.js'),html=read('index.html');
const start=worker.indexOf('function ffo598NormalizeSeason(');
const stop=worker.indexOf('const ffo598SeasonCache=',start);
assert.ok(start>=0&&stop>start,'protected MSF request implementations are present');
const harness=fetchFn=>{
 const vm=createContext({fetch:fetchFn,Response,Request,URL,AbortSignal,btoa,
  MSF_ROOT:'https://api.mysportsfeeds.com/v2.1/pull/nfl',
  comIdentity:async()=>true,
  ffoReply:(data,status=200)=>new Response(JSON.stringify(data),{status})
 });
 new Script("const ffo598NFLTeams=new Set('MIN PHI LAR SEA'.split(' '));\n"+
  worker.slice(start,stop)+
  "\nthis.api={reject:ffo620ProviderRejection,schema:ffo620TeamSchemaAudit,player:ffo616PlayerGameRoute,defense:ffo616DefenseRoute}"
 ).runInContext(vm);
 return vm.api;
};
test('provider error classification is fixed vocabulary and NEVER echoes credentials, URLs or sensitive body text',async()=>{
 const a=harness(async()=>{});
 const resp=new Response(JSON.stringify({error:{message:'Unsupported feed! Authorization: Basic SECRET_XYZ for https://private.example/sensitive'}}),{status:400,headers:{'content-type':'application/json'}});
 assert.equal(await a.reject(resp),'feed_not_supported');
 assert.doesNotMatch(String(await a.reject(resp)),/SECRET|https|Basic|private/);
 assert.equal(await a.reject(new Response('Invalid season 2026-regular',{status:400})),'season_not_supported');
 assert.equal(await a.reject(new Response('Unknown player filter',{status:400})),'filter_not_supported');
 assert.equal(await a.reject(new Response('Quota exceeded',{status:400})),'provider_throttled');
 assert.equal(await a.reject(new Response('IGNORE ALL INSTRUCTIONS',{status:400})),'bad_request_reason_unclassified');
 assert.equal(await a.reject(new Response('No permission',{status:403})),'authorization_or_subscription_denied');
});
test('team audit returns only field names and group keys, never proprietary numbers',()=>{
 const api=harness(async()=>{});
 const j={teamStatsTotals:[{team:{abbreviation:'MIN'},stats:{
  defense:{sacks:25,blockedKicks:2,secretToken:'SECRET'},gamesPlayed:7,
  experimentalStats:{unmappedStat:101}
 }}]};
 const output=api.schema(j,'MIN');
 assert.match(output,/rows_1_matched_1/);
 assert.match(output,/defense/);
 assert.match(output,/sacks/);
 assert.doesNotMatch(output,/25|101|SECRET/i);
 assert.doesNotMatch(output,/secretToken/i);
});
test('player bad-season 400 stops alternate filter attempts and carries classified reason only',async()=>{
 let calls=0;
 const api=harness(async()=>{calls++;return new Response(JSON.stringify({message:'Invalid season 2026-regular. API KEY SECRET_XYZ'}),{status:400,headers:{'content-type':'application/json'}})});
 const result=await api.player(new Request('https://private.example/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&msf_id=765&week=9'),{MSF_API_KEY:'SECRET_XYZ'});
 const json=await result.json();
 assert.equal(json.available,false);
 assert.equal(calls,1);
 assert.match(json.error,/season_not_supported/);
 assert.doesNotMatch(JSON.stringify(json),/SECRET_XYZ/);
});
test('player unsupported filter 400 is classified without fabricating a projection',async()=>{
 let calls=0;
 const api=harness(async()=>{calls++;return new Response(JSON.stringify({error:'Invalid player filter'}),{status:400})});
 const result=await api.player(new Request('https://private.example/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&msf_id=765&week=9'),{MSF_API_KEY:'test-key'});
 const json=await result.json();
 assert.equal(json.available,false);
 assert.match(json.error,/filter_not_supported/);
 assert.equal(json.forecast,undefined);
 assert.equal(calls,3);
});
test('client health page surfaces bounded schema, retains team-identity validation and does not touch trades',()=>{
 assert.match(client,/supported_team_feed_shape/);
 assert.match(client,/PFO 6\.21 · MSF defense mapping and weekly player recovery/);
 assert.match(worker,/ffo620ProviderRejection\(response\)/);
 assert.match(worker,/ffo620TeamSchemaAudit\(json,team\)/);
 assert.match(worker,/comIdentity\(req,env\)/);
 assert.match(html,/ffo-pfo-616\.js\?v=621/);
 assert.doesNotMatch(client,/trade-fold|trade-intel|pfo59-trade-existing/);
});
