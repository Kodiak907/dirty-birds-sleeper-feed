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
 assert.match(worker,/MSF_ROOT\+'\/2026-regular\/player_stats_totals\.json'/);
 assert.doesNotMatch(worker,/MSF_ROOT\+'\/2026-2027-regular\/player_stats_totals\.json'/);
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

test('Waiver personalized All uses MSF starter comparisons, not Sleeper fantasy score history',()=>{
 const waiver=read('ffo-pfo-59.js');
 assert.match(waiver,/waiverManager:'1'/);
 assert.match(waiver,/const historical=\{\}/);
 assert.match(waiver,/const starterPPG=\{\},injuryRisk=\{\}/);
 assert.match(waiver,/p\.modelPPG-n\.starterPPG\[/);
 assert.doesNotMatch(waiver,/state\.history\?\.matchups_by_week/);
 assert.ok(waiver.includes('if(/\\b(IR|PUP|NFI|OUT|DOUBTFUL)\\b/i.test'),'injury-risk word boundaries must be actual regex boundaries');
});

test('Trade roster: five grid tracks, bounded portraits and real DEF placeholder',()=>{
 const css=read('ffo-pfo-59.css'),market=read('ffo-pfo-59.js');
 assert.match(css,/grid-template-columns:18px 25px minmax\(0,1fr\) 37px 14px!important/);
 assert.match(css,/\.pfo598-trade-photo img\{/);
 assert.match(css,/max-width:24px!important/);
 assert.match(css,/max-height:29px!important/);
 assert.match(market,/p\?\.position!=='DEF'/);
 assert.match(market,/pfo598-team-placeholder/);
 assert.match(market,/state\.manager='1';/);
 assert.match(market,/managerOptions\(\);trade\(\); \/\/ immediately replace/);
 assert.match(market,/refreshCurrent:/);
});
test('MSF load success or failure refreshes the visible Market; no recycled dashes',()=>{
 assert.match(core,/window\.ffoPfo59\?\.refreshCurrent\?\.\(\)/);
 assert.match(worker,/json\?\.data/);
 assert.match(worker,/MSF_GATEWAY_/);
 assert.match(core,/MSF season feed unavailable or incomplete/);
});
test('Injury status never silently treats stale week reports as current',()=>{
 assert.match(core,/const official=recent&&matchingWeek/);
 assert.match(core,/checkedOfficial=recent&&matchingWeek/);
 assert.match(core,/if\(document\.querySelector\('#scouting\.page\.active'\)\)gm47Render\(\)/);
 assert.match(patch,/pfo598-injury-coverage/);
 assert.match(patch,/No match does not mean ACTIVE/);
});


test('FFO never labels Sleeper initialized 0.00 as verified independent score',()=>{
 assert.match(core,/W'\+week\+' · FFO live stats pending/);
 assert.match(core,/Only score same-week sourced NFL stats/);
 assert.doesNotMatch(core,/Number\(points\)\.toFixed\(2\)\+' recorded FFL points'/);
});
test('Both trade renderers bound player portraits and withhold unsupported impacts',()=>{
 const reportCss=read('ffo-pfo-597.css');
 assert.match(reportCss,/#trade-intel \.pfo597-trade-person img\.pfo598-eval-photo/);
 assert.match(reportCss,/max-width:24px!important/);
 assert.match(reportCss,/max-height:29px!important/);
 assert.match(patch,/impactKnown=difference!==null/);
 assert.match(patch,/Starter impact pending verified MSF/);
});
test('Injury Watch summarizes source coverage once instead of repeating a full disclaimer for every player',()=>{
 assert.match(core,/const label=o&&game\?/);
 assert.match(core,/No report available/);
 assert.doesNotMatch(core,/No verified report available\. Missing designation is NOT confirmation of clearance/);
 assert.match(patch,/No match does not mean ACTIVE/);
});


test('Live GameCast uses MSF v2.1 2026-regular route and original secret stays server-side',()=>{
 const gamecast=read('ffo-gamecast.js');
 assert.ok(gamecast.includes("return n+'-regular'"),'MSF GameCast must use 2026-regular per live Worker endpoint');
 assert.ok(!gamecast.includes("return n+'-'+(n+1)+'-regular'"),'wrong 2026-2027-regular path must not recur');
 assert.match(gamecast,/gameFeedError:s\.lastError\|\|null/);
 assert.match(gamecast,/LIVE_PLAY_MS=10000,LIVE_BOX_MS=20000,IDLE_PLAY_MS=120000/);
 assert.match(gamecast,/setInterval\(\(\)=>\{[\s\S]*?activeRefreshMs\(\)/);
 assert.match(gamecast,/document\.addEventListener\('visibilitychange'/);
 assert.match(gamecast,/consecutivePlayFailures/);
 assert.match(gamecast,/name==='plays'\|\|name==='boxscore'\?9000:12500/);
 assert.match(worker,/env\.GAMECAST_INTERNAL\.fetch\(new Request\(upstream,\{method:'GET'\}\)\)/);
 assert.doesNotMatch(gamecast,/env\.(MSF_API_KEY|FFOI_MSF_API_KEY)|Basic\s*\+\s*btoa/);
});
