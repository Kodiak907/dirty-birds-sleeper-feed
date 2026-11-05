import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const read=n=>readFileSync(new URL('./'+n,import.meta.url),'utf8');
const worker=read('_worker.js'),lib=read('ffo-pfo-616.js'),html=read('index.html');
const begin=worker.indexOf('function ffo617UnwrapProvider(');
const end=worker.indexOf('const ffo616DefenseCache=',begin);
assert.ok(begin>=0&&end>begin,'gateway unwrapping helper is present');
const vm=createContext({});
new Script(worker.slice(begin,end)+';this.unwrap=ffo617UnwrapProvider;').runInContext(vm);
const unwrap=vm.unwrap;
test('licensed team-defense gateway response is decoded without inventing fields',()=>{
 const data={teamGamelogs:[{team:{abbreviation:'MIN'},stats:{defense:{sacks:4}}}]};
 assert.deepEqual(JSON.parse(JSON.stringify(unwrap({available:true,data},'TEAM_DEFENSE'))),data);
 assert.deepEqual(JSON.parse(JSON.stringify(unwrap(data,'TEAM_DEFENSE'))),data);
});
test('licensed player game logs gateway is decoded while denial remains unavailable',()=>{
 const data={playerGamelogs:[{player:{fullName:'Kyren Williams'},game:{id:1}}]};
 assert.deepEqual(JSON.parse(JSON.stringify(unwrap({available:true,data},'PLAYER_GAMELOGS'))),data);
 assert.throws(()=>unwrap({available:false,error:'provider_http_403'},'PLAYER_GAMELOGS'),/MSF_GATEWAY_provider_http_403/);
 assert.throws(()=>unwrap({data:null},'PLAYER_GAMELOGS'),/SCHEMA_UNRECOGNIZED/);
});
test('protected defense and game log routes both unwrap licensed gateway payloads',()=>{
 assert.match(worker,/ffo617UnwrapProvider\(await response\.json\(\),'TEAM_DEFENSE'\)/);
 assert.match(worker,/ffo617UnwrapProvider\(await response\.json\(\),'PLAYER_GAMELOGS'\)/);
 assert.match(worker,/comIdentity\(req,env\)/);
});
test('missing player projection recovery does not depend on full-season feed',()=>{
 assert.doesNotMatch(lib,/if\(!source\?\.players\?\.length\|\|/);
 assert.match(lib,/hasFrozenRules\?\.\(\)!==true/);
 assert.match(lib,/recoveryStatus\.set\(id,'checking_licensed_player_gamelogs'\)/);
 assert.match(lib,/playerFailures\.set\(id,reason\)/);
 assert.match(lib,/if\(retries>=20\)/);
});
test('Team data health reports missing starter causes without touching Trade Lab',()=>{
 assert.match(lib,/id='pfo617-recovery-health'/);
 assert.match(lib,/playerFailures\.get\(id\)/);
 assert.match(lib,/failures\.get\(team\)/);
 assert.match(lib,/partial MSF evidence/);
 assert.match(html,/ffo-pfo-616\.js\?v=619/);
 assert.doesNotMatch(lib,/trade-fold|trade-intel|pfo59-trade-existing/);
});
