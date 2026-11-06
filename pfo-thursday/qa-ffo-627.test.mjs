import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const read=name=>readFileSync(new URL('./'+name,import.meta.url),'utf8');
const worker=read('_worker.js'),client=read('ffo-pfo-616.js'),proj=read('ffo-pfo-597.js'),html=read('index.html');
const start=worker.indexOf('function ffo598NormalizeSeason('),end=worker.indexOf('const ffo598SeasonCache=',start);
assert.ok(start>=0&&end>start);
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
function harness(fn){
 const ctx=createContext({fetch:fn,Response,Request,URL,AbortSignal,btoa,
  MSF_ROOT:'https://api.mysportsfeeds.com/v2.1/pull/nfl',
  comIdentity:async()=>true,
  ffoReply:(data,status=200)=>reply(data,status)
 });
 new Script("const ffo598NFLTeams=new Set('MIN PHI LAR SEA'.split(' '));\n"+
 worker.slice(start,end)+
 '\nthis.api={parse:ffo623KickerBoxRow,verify:ffo627VerifiedKickerFieldGoals,route:ffo616PlayerGameRoute};').runInContext(ctx);
 return ctx.api;
}
const fixture=(id,home='MIN',away='BUF')=>({id:String(id),home,away,week:8});
function box(id,description,playerStats=[{extraPointAttempts:{xpMade:1,xpAtt:1}}],score=3,team='MIN'){
 const home=team==='MIN';
 const row={player:{id:765,firstName:'Will',lastName:'Reichard',position:'K'},playerStats};
 return {gameboxscore:{game:{id,homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'BUF'}},
  scoring:{quarters:[{quarterNumber:1,scoringPlays:[{
   id:'p-'+id,playDescription:description,homeScore:home?score:0,awayScore:home?0:score
  }]}]},
  stats:{home:{players:[row]},away:{players:[]}}
 }};
}
const good='(08:11) 16-W.Reichard 47 yard field goal is GOOD';
test('scoring-play FG awards only verified scoring-side, exact kicker and distance category',()=>{
 const api=harness(async()=>reply({}));
 const parsed=api.parse(box(7108,good),fixture(7108),'MIN','Will Reichard','765','2026-11-05');
 assert.equal(parsed.available,true);
 assert.equal(parsed.stats.fgm,1);
 assert.equal(parsed.stats.fgm_40_49,1);
 assert.equal(parsed.stats.xpm,1);
 assert.equal(parsed.verified_fg_scoring_plays,1);
 assert.equal(parsed.stats.fgm_50_59,undefined);
});
test('verified FG may supply game evidence even when player raw FG totals are absent',()=>{
 const api=harness(async()=>reply({}));
 const parsed=api.parse(box(7108,good,[{}]),fixture(7108),'MIN','Will Reichard','765','2026-11-05');
 assert.equal(parsed.available,true);
 assert.equal(parsed.stats.fgm,1);
 assert.equal(parsed.stats.fgm_40_49,1);
});
test('holder mentions, wrong scoring side, missing distance, or no score change cannot create FG bonuses',()=>{
 const api=harness(async()=>reply({}));
 const cases=[
  box(7108,'(08:11) 34-T.Original 47 yard field goal is GOOD Holder-16-W.Reichard'),
  box(7108,good,undefined,3,'BUF'),
  box(7108,'(08:11) 16-W.Reichard field goal is GOOD'),
  box(7108,good,undefined,0)
 ];
 for(const c of cases){
  const o=api.parse(c,fixture(7108),'MIN','Will Reichard','765','2026-11-05');
  assert.equal(o.verified_fg_scoring_plays,0);
  assert.equal(o.stats?.fgm_40_49,undefined);
 }
});
test('provider generic FG count smaller than verified scoring plays fails closed instead of double counting',()=>{
 const api=harness(async()=>reply({}));
 const source=box(7108,good,[{fieldGoals:{fgMade:0},extraPointAttempts:{xpMade:1}}]);
 const o=api.parse(source,fixture(7108),'MIN','Will Reichard','765','2026-11-05');
 assert.equal(o.available,false);
 assert.equal(o.error,'kicker_scoring_play_count_conflicts_with_msf_stats');
});
test('recent historical kicker source gathers up to four unique completed games, not only two',async()=>{
 const seen=[];
 const schedule={games:[5,6,7,8].map(w=>({schedule:{id:7100+w,week:w,
  playedStatus:'COMPLETED',homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'BUF'}}}))};
 const api=harness(async url=>{
  const u=new URL(url);seen.push(u.pathname);
  if(u.pathname.endsWith('/games.json'))return reply(schedule);
  const m=u.pathname.match(/\/games\/(\d+)\/boxscore\.json$/);
  assert.ok(m);
  return reply(box(Number(m[1]),good));
 });
 const response=await api.route(new Request('https://private.example/api/ffo/stats/player-coverage?team=MIN&name=Will%20Reichard&msf_id=765&position=K&week=9'),
   {MSF_API_KEY:'test-not-real'});
 const v=await response.json();
 assert.equal(v.games_observed,4);
 assert.equal(v.verified_fg_scoring_plays,4);
 assert.equal(v.forecast.fgm,1);
 assert.equal(v.forecast.fgm_40_49,1);
 assert.equal(v.forecast.xpm,1);
 assert.equal(v.partial,true);
 assert.equal(seen.length,5);
});
test('verified fractional per-game FG forecast retains +3 FG base and distance bonus instead of dropping fractional FG counts',()=>{
 const rule=JSON.parse(read('FFO_FFL_SCORING_V1.json')).scoring;
 const start=proj.indexOf(' const FFL_SUPPORTED_STATS=');
 const stop=proj.indexOf(" if(typeof pfo49ScoreFromStats",start);
 assert.ok(start>=0&&stop>start);
 const ctx=createContext({rules:rule});
 new Script("const frozenFFLRules=rules;\n"+proj.slice(start,stop)+"\nthis.score=frozenScore;").runInContext(ctx);
 assert.equal(ctx.score({fgm:0.5,xpm:1}).points,2.5);
 assert.equal(ctx.score({fgm_40_49:0.5,xpm:1}).points,4);
 assert.equal(ctx.score({fgm:0.75,xpm:1.25}).points,3.5);
 assert.equal(ctx.score({fgm_50_59:0.25,xpm:1}).points,2.75);
});
test('kicker projections remain partial even with 10/10 positional estimates',()=>{
 assert.match(proj,/partial:pos==='K'\|\|v\.partial===true/);
 assert.match(client,/PFO 6\.27 · kicker scoring-play and data-quality audit/);
 assert.match(worker,/ffo627VerifiedKickerFieldGoals/);
 assert.match(html,/ffo-pfo-616\.js\?v=627/);
 assert.match(html,/ffo-pfo-597\.js\?v=627/);
 assert.doesNotMatch(client,/trade-fold|trade-intel|pfo59-trade-existing/);
});

test('Overview badge derives the same build revision as Data Health instead of carrying an obsolete hardcoded version',()=>{
 assert.match(client,/const auditTitle='PFO 6\.27 · kicker scoring-play and data-quality audit'/);
 assert.match(client,/badge\.textContent=auditTitle\.split\(' · '\)\[0\]\+' · PRIVATE PREVIEW'/);
 assert.match(html,/PFO · PRIVATE PREVIEW/);
 assert.doesNotMatch(html,/5\.9\.7 COACH REVIEW|PFO 6\.26 · PRIVATE PREVIEW/);
});
