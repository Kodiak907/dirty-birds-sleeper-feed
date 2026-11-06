import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const read=n=>readFileSync(new URL('./'+n,import.meta.url),'utf8');
const cfg=JSON.parse(read('FFO_FFL_SCORING_V1.json'));
const source=read('ffo-pfo-597.js'),worker=read('_worker.js'),html=read('index.html');
const start=source.indexOf(' const FFL_SUPPORTED_STATS=');
const stop=source.indexOf(" if(typeof pfo49ScoreFromStats",start);
assert.ok(start>=0&&stop>start,'FFL scorer can be independently exercised');
function scorer(){
 const ctx=createContext({rules:cfg.scoring});
 new Script('const frozenFFLRules=rules;\n'+source.slice(start,stop)+'\nthis.score=frozenScore;').runInContext(ctx);
 return ctx.score;
}
const workerStart=worker.indexOf('function ffo598NormalizeSeason('),
 workerEnd=worker.indexOf('const ffo598SeasonCache=',workerStart);
assert.ok(workerStart>=0&&workerEnd>workerStart);
function harness(provider){
 const ctx=createContext({fetch:provider,Response,Request,URL,AbortSignal,btoa,
  MSF_ROOT:'https://api.mysportsfeeds.com/v2.1/pull/nfl',
  comIdentity:async()=>true,
  ffoReply:(data,status=200)=>new Response(JSON.stringify(data),{status})
 });
 new Script("const ffo598NFLTeams=new Set('MIN PHI LAR SEA'.split(' '));\n"+
  worker.slice(workerStart,workerEnd)+
  '\nthis.api={normalize:ffo598NormalizeSeason,parse:ffo623KickerBoxRow,route:ffo616PlayerGameRoute};').runInContext(ctx);
 return ctx.api;
}
function box(id){
 const week=id-7000;
 return {gameboxscore:{game:{id,homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'BUF'}},
  stats:{home:{players:[{player:{id:765,firstName:'Will',lastName:'Reichard',position:'K'},
   playerStats:[{extraPointAttempts:{xpMade:3,xpAtt:4,fgAndXpPts:12},
    fieldGoals:{fg1_19Pct:100,fg40_49Pct:100,fg50PlusPct:100}}]
  }]},away:{players:[]}}}};
}
test('Nov 5 full Sleeper video scoring supersedes interim commissioner scoring changes',()=>{
 const s=cfg.scoring;
 assert.equal(cfg.version,'2026-11-05-ffl-screen-recording-verified-v4');
 assert.equal(s.pass_td,4);
 assert.equal(s.pass_cmp_40p,0);
 assert.equal(s.pass_td_40p,1);
 assert.equal(s.pass_td_50p,2);
 assert.equal(s.rec_30_39,0);
 assert.equal(s.rec_40p,0);
 assert.equal(s.def_2pt,0);
 assert.equal(s.def_3_and_out,0);
 assert.equal(s.rec,0.5);
 assert.equal(s.pass_yd,0.04);
 assert.equal(s.xpm,1);
 assert.equal(s.xpmiss,-1);
 assert.equal(s.fgmiss,-1);
 assert.equal(s.fgm,0);
 assert.deepEqual([s.fgm_0_19,s.fgm_20_29,s.fgm_30_39,s.fgm_40_49,s.fgm_50_59,s.fgm_60p],
  [3,3,3,4,5,6]);
});
test('FG has no generic base: exact distance tier only, plus PATs',()=>{
 const score=scorer();
 assert.equal(score({fgm:1,fgm_40_49:1,xpm:2}).points,6);
 assert.equal(score({fgm_40_49:1,xpm:2}).points,6,'distance bucket scores without generic FG');
 assert.equal(score({fgm:1,xpm:2}).points,2,'unknown made-FG distance scores no fantasy points, only verified PATs');
 assert.equal(score({fgm:1,fgm_0_19:1,xpm:2}).points,5);
 assert.equal(score({fgm:1,fgm_60p:1}).points,6);
 assert.equal(score({fgm:1,fgm_50_59:1}).points,5);
 assert.equal(score({fgm:1,fgm_40_49:1,fgmiss:1,xpmiss:1}).points,2);
});
test('independent passing, receiving, and defensive bonuses are included and stack only with verified thresholds',()=>{
 const score=scorer();
 assert.equal(score({pass_yd:250,pass_td:1}).points,14);
 assert.equal(score({pass_td:1,pass_cmp_40p:1,pass_td_40p:1,pass_td_50p:1}).points,7);
 assert.equal(score({rec:3,rec_yd:100,rec_30_39:1,rec_40p:1}).points,11.5);
 assert.equal(score({def_2pt:1,def_3_and_out:2,sack:1}).points,1);
 assert.equal(score({rec:2,rec_30_39:1}).partial,true);
});
test('MSF xpMade and xpAtt are exact counts; consistent kick points recover only generic FG makes',()=>{
 const api=harness(async()=>new Response('{}'));
 const raw={playerStatsTotals:[{player:{id:765,firstName:'Will',lastName:'Reichard',
  position:'K'},team:{abbreviation:'MIN'},stats:{
    gamesPlayed:1,
    extraPointAttempts:{xpMade:3,xpAtt:4,fgAndXpPts:12},
    fieldGoals:{fg1_19Pct:100,fg40_49Pct:100,fg50PlusPct:100}
  }}]};
 const row=api.normalize(raw,'2026-11-05').players[0];
 assert.equal(row.season_totals.xpm,3);
 assert.equal(row.season_totals.xpmiss,1);
 assert.equal(row.season_totals.fgm,3);
 assert.equal(row.season_totals.fgm_40_49,undefined);
 assert.equal(row.season_totals.fgm_60p,undefined);
 assert.equal(scorer()(row.forecast).points,2);
});
test('provider percentages cannot become makes; inconsistent FG kick-point arithmetic is rejected as FG evidence',()=>{
 const api=harness(async()=>new Response('{}'));
 const stat={gamesPlayed:1,fieldGoals:{fg40_49Pct:100,fg50PlusPct:100},
  extraPointAttempts:{xpMade:2,xpAtt:2,fgAndXpPts:10}};
 const row=api.normalize({playerStatsTotals:[{player:{id:765,fullName:'Will Reichard',position:'K'},
  team:{abbreviation:'MIN'},stats:stat}]},'2026-11-05').players[0];
 assert.equal(row.season_totals.fgm,undefined,'8 divided by 3 is not integral, so no invented field goals');
 assert.equal(row.season_totals.fgm_40_49,undefined);
 assert.equal(scorer()(row.forecast).points,2,'only two verified PATs contribute');
});
test('authenticated MSF boxscore kicker recovers at least two unique prior games with partial generic FG + PAT evidence',async()=>{
 const calls=[];
 const schedule={games:[7,8].map(w=>({schedule:{id:7000+w,week:w,playedStatus:'COMPLETED',
  homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'BUF'}}}))};
 const api=harness(async endpoint=>{
  const u=new URL(endpoint);calls.push(u.pathname);
  if(u.pathname.endsWith('/games.json'))return new Response(JSON.stringify(schedule),{status:200});
  const match=u.pathname.match(/games\/(\d+)\/boxscore\.json$/);
  assert.ok(match);
  return new Response(JSON.stringify(box(Number(match[1]))),{status:200});
 });
 const r=await api.route(new Request('https://private.test/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&msf_id=765&position=K&week=9'),
  {MSF_API_KEY:'not-a-secret'});
 const data=await r.json();
 assert.equal(data.games_observed,2);
 assert.equal(data.available,undefined);
 assert.equal(data.forecast.xpm,3);
 assert.equal(data.forecast.xpmiss,1);
 assert.equal(data.forecast.fgm,3);
 assert.equal(data.forecast.fgm_40_49,undefined);
 assert.equal(data.partial,true);
 assert.equal(scorer()(data.forecast).points,2);
 assert.equal(calls.length,3);
});
test('model loads own updated scoring file without Sleeper point totals, protecting source isolation',()=>{
 assert.match(source,/FFO_FFL_SCORING_V1\.json\?v=635/);
 assert.match(source,/cache:'no-store'/);
 assert.match(source,/rec_30_39/);
 assert.match(source,/pass_cmp_40p/);
 assert.match(source,/def_3_and_out/);
 assert.match(html,/ffo-pfo-597\.js\?v=635/);
 assert.match(html,/ffo-pfo-616\.js\?v=627/);
 assert.doesNotMatch(source,/sleeperGet\(/);
});

test('GameCast and Team HQ share the same updated FFL scoring contract without changing historical Sleeper records',()=>{
 const g=read('ffo-gamecast-model.mjs');
 assert.ok(g.includes("Number(rules.fgm):0)"),'PBP kicker audit reads generic FG multiplier, which is now zero');
 assert.ok(g.includes("const xp=num(source?.extraPointAttempts?.xpMade)"),'GameCast maps verified XP counts');
 assert.ok(source.includes("fgTiers=['fgm_0_19'"),'Team HQ FFL scorer uses exact distance tiers without a generic made-FG bonus');
 assert.equal(cfg.scoring.def_3_and_out,0);
 assert.equal(cfg.scoring.pass_td,4);
 assert.doesNotMatch(g,/Sleeper fantasy score as primary projection/);
});
