import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const dir=dirname(fileURLToPath(import.meta.url));
const read=name=>readFileSync(join(dir,name),'utf8');
const worker=read('_worker.js'),core=read('ffo-pfo-core.js'),quick=read('ffo-quickview.js'),patch=read('ffo-pfo-597.js');
function workerSandbox(){
 const ctx=createContext({Response,Request,Headers,URL,console,Date,Number,Map,Set,AbortController,AbortSignal,TextDecoder,TextEncoder});
 new Script(worker.replace(/\bexport\s+default\s+/,'const workerDefault = ')+';globalThis.__normal=ffo598NormalizeSeason;').runInContext(ctx);
 return ctx.__normal;
}
test('MSF season source is the singular PFO production-statistics foundation',()=>{
 assert.match(core,/const sources=\['\/api\/ffo\/stats\/season'\]/);
 assert.match(core,/pfo50Indexed=matched/);
 assert.doesNotMatch(core,/const sources=season===2026\?/);
 assert.match(worker,/await comIdentity\(req,env\)/);
 assert.match(worker,/ffo598SeasonRoute\(request,env\)/);
 assert.match(worker,/env\.MSF_API_KEY/);
 assert.match(patch,/FFO_FFL_SCORING_V1\.json/);
});
test('MSF documented season rows normalize and never invent weekly game logs',()=>{
 const normalize=workerSandbox();
 const out=normalize({lastUpdatedOn:'2026-10-29',playerStatsTotals:[
  {player:{id:88,firstName:'Test',lastName:'Receiver',primaryPosition:'WR'},team:{abbreviation:'GB'},stats:{gamesPlayed:5,receiving:{recYards:400,receptions:30,recTouchdowns:4,targets:51}}},
  {player:{id:9,firstName:'No',lastName:'Games',primaryPosition:'WR'},team:{abbreviation:'SF'},stats:{receiving:{recYards:20,receptions:2}}}
 ]},'2026-10-29T20:00:00Z');
 assert.equal(out.schema,'FFO_MSF_SEASON_V1');
 assert.equal(out.players[0].season_totals.rec_yd,400);
 assert.equal(out.players[0].games_observed,5);
 assert.equal(out.players[0].forecast.rec_yd,80);
 assert.equal(out.players[0].games.length,0);
 assert.equal(out.players[0].latest,null);
 assert.equal(out.players[1].games_observed,null);
 assert.equal(out.players[1].forecast,null);
 assert.equal(out.players[1].season_totals.rec_yd,20);
});
test('Malformed MSF feed rejected and partial statistics clearly marked',()=>{
 const normalize=workerSandbox();
 assert.throws(()=>normalize({playerStatsTotals:{}},new Date().toISOString()),/SCHEMA/);
 assert.throws(()=>normalize({playerStatsTotals:[{player:{firstName:'Nameless'}}]},new Date().toISOString()),/IDENTIFIABLE/);
 const out=normalize({playerStatsTotals:[{player:{fullName:'A Player'},team:{abbreviation:'NE'},stats:{gamesPlayed:2}}]},'2026-10-29T20:00:00Z');
 assert.equal(out.players[0].forecast,null);
 assert.equal(out.players[0].coverage,'season_or_games_played_unavailable');
});
test('QuickView is dismissible by touch without breaking natural scroll',()=>{
 for(const event of ['touchstart','touchmove','touchend','touchcancel'])assert.ok(quick.includes("addEventListener('"+event+"'"));
 assert.match(quick,/body\.scrollTop>1/);
 assert.match(quick,/dy>=90/);
 assert.match(quick,/touchmove'[\s\S]*?passive:false/);
 assert.match(quick,/window\.ffoQuickView=\{[\s\S]*?refresh:/);
 assert.doesNotMatch(quick,/if\(String\(p\.id\)===['"]12495['"]\)/);
});
test('All production stats fail closed without provider or verified player identity',()=>{
 assert.match(core,/for\(const key of ambiguous\)matched\.delete\(key\)/);
 assert.match(worker,/MSF_NO_IDENTIFIABLE_PLAYER_ROWS/);
 assert.match(worker,/source_type:'licensed_primary'/);
 assert.match(core,/No recent-game trend inferred from unavailable logs/);
});
