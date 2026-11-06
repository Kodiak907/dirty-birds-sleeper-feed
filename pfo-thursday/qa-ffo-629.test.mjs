import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const worker=readFileSync(new URL('./_worker.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('./ffo-pfo-616.js',import.meta.url),'utf8');
const fixStart=worker.indexOf('function ffo618VerifiedFixtures(');
const fixEnd=worker.indexOf('function ffo616NormalizeDefense(',fixStart);
const start=worker.indexOf('function ffo629InspectDefensePlayFields(');
const end=worker.indexOf('/* PFO 6.16: fill missing starter denominators',start);
assert.ok(fixStart>=0&&fixEnd>fixStart&&start>=0&&end>start);
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const schedule={games:[
 {schedule:{id:'884488',week:8,playedStatus:'COMPLETED',homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'BUF'}},score:{homeScoreTotal:24,awayScoreTotal:14}},
 {schedule:{id:'884489',week:9,playedStatus:'SCHEDULED',homeTeam:{abbreviation:'MIN'},awayTeam:{abbreviation:'GB'}},score:{homeScoreTotal:0,awayScoreTotal:0}}
]};
const event=(id,overrides={})=>({
 id,description:'LICENSED NFL PLAY DESCRIPTION PRIVATE - DO NOT EXPOSE',
 playStatus:{quarter:1,down:1,teamInPossession:{abbreviation:'MIN'},driveId:'d1',secondsElapsed:45},
 homeScore:0,awayScore:0,...overrides
});
const observed={gameplaybyplay:{plays:[event('p1'),event('p2',{playStatus:{quarter:1,down:2,teamInPossession:{abbreviation:'MIN'},driveId:'d1',secondsElapsed:65}})]}};
const make=(provider,auth=async()=>true)=>{
 const seen=[];
 const ctx=createContext({fetch:async(url,opts)=>{seen.push({url:String(url),opts});return provider(String(url),opts)},Response,Request,URL,AbortSignal,btoa,
  MSF_ROOT:'https://api.mysportsfeeds.com/v2.1/pull/nfl',
  ffo598NFLTeams:new Set(['MIN','BUF','GB']),
  comIdentity:auth,
  ffoReply:(d,s=200)=>reply(d,s)});
 new Script(worker.slice(fixStart,fixEnd)+worker.slice(start,end)+
  ';this.audit={shape:ffo629InspectDefensePlayFields,route:ffo629DefenseSourceAuditRoute};').runInContext(ctx);
 return {seen,...ctx.audit};
};
const provider=(pbp=observed,pbpStatus=200)=>url=>url.includes('/games.json?')?reply(schedule):
 url.endsWith('/playbyplay.json')?reply(pbp,pbpStatus):reply({error:'wrong_path'},404);
const call=(api,url='https://private.example/api/ffo/stats/defense-source-audit?team=MIN',env={MSF_API_KEY:'placeholder'})=>
 api.route(new Request(url),env);

test('sampled completed game only: count MSF field presence without attributing three-and-outs',async()=>{
 const api=make(provider());
 const res=await call(api),data=await res.json();
 assert.equal(res.status,200);
 assert.equal(data.available,true);
 assert.equal(data.game_id,'884488');
 assert.equal(data.observed_fields.plays,2);
 assert.equal(data.observed_fields.provider_id,2);
 assert.equal(data.observed_fields.drive_id,2);
 assert.equal(data.observed_fields.distinct_drive_ids,1);
 assert.equal(data.observed_fields.possession_team,2);
 assert.equal(data.observed_fields.down,2);
 assert.equal(data.observed_fields.score_snapshots,2);
 assert.equal(data.full_game_certified,false);
 assert.equal(data.three_and_out_scoring_ready,false);
 assert.equal(data.points_allowed_scoring_ready,false);
 assert.equal(data.dst_points_certified,false);
 assert.equal(data.read_only,true);
 assert.ok(Array.from(data.missing_evidence).includes('whole_game_play_coverage_not_certified'));
 assert.ok(!JSON.stringify(data).includes('LICENSED NFL PLAY DESCRIPTION PRIVATE'));
 assert.equal(api.seen.length,2);
 assert.ok(api.seen.every(x=>x.url.startsWith('https://api.mysportsfeeds.com/v2.1/pull/nfl/')));
 assert.ok(api.seen.every(x=>!x.url.includes('sleeper')&&!x.url.includes('espn')));
});

test('explicitly selected game cannot bypass final-schedule and NFL team match',async()=>{
 const api=make(provider());
 const r=await call(api,'https://private.example/api/ffo/stats/defense-source-audit?team=MIN&game_id=884489');
 const x=await r.json();
 assert.equal(x.available,false);
 assert.equal(x.error,'requested_completed_team_game_not_verified');
 assert.equal(api.seen.length,1);
});

test('provider 403 never triggers scoring-only boxscore substitution or zero three-and-outs',async()=>{
 const api=make(provider({message:'access denied'},403));
 const x=await(await call(api)).json();
 assert.equal(x.available,false);
 assert.equal(x.error,'play_by_play_provider_entitlement_denied');
 assert.equal(x.scoring_only_boxscore_not_equivalent,true);
 assert.equal(x.full_game_certified,false);
 assert.equal(x.three_and_out_scoring_ready,false);
 assert.equal(api.seen.length,2);
 assert.ok(api.seen.every(x=>!x.url.includes('/boxscore.json')));
});

test('unsupported play schema, repeated IDs, and missing drive IDs never imply score certification',async()=>{
 const api=make(provider({gameplaybyplay:{plays:[event('dup',{playStatus:{quarter:1}}),event('dup',{playStatus:{quarter:2}})]}}));
 const x=await(await call(api)).json();
 assert.equal(x.observed_fields.duplicate_provider_id,1);
 assert.equal(x.observed_fields.drive_id,0);
 assert.ok(Array.from(x.missing_evidence).includes('unique_native_play_ids_not_established'));
 assert.ok(Array.from(x.missing_evidence).includes('provider_drive_identifiers_unavailable'));
 assert.equal(x.dst_points_certified,false);
 const other=make(provider({invalid:'shape'}));
 const y=await(await call(other)).json();
 assert.equal(y.available,false);
 assert.equal(y.error,'msf_play_by_play_schema_unrecognized');
});

test('fail closed on unauthorized, invalid team and invalid game IDs before provider fetch',async()=>{
 const denied=make(provider(),async()=>{throw Error('private access required')});
 const a=await call(denied);assert.equal(a.status,403);assert.equal(denied.seen.length,0);
 const api=make(provider());
 const b=await call(api,'https://private.example/api/ffo/stats/defense-source-audit?team=OMG');
 assert.equal(b.status,400);
 const c=await call(api,'https://private.example/api/ffo/stats/defense-source-audit?team=MIN&game_id=../../bad');
 assert.equal(c.status,400);assert.equal(api.seen.length,0);
});

test('data-health control is user-triggered and protected, not an interval poll or a scoring source',()=>{
 assert.match(ui,/Check '\+team\+' D\/ST evidence/);
 assert.match(ui,/button\.addEventListener\('click'/);
 assert.match(ui,/\/api\/ffo\/stats\/defense-source-audit\?team=/);
 assert.match(ui,/D\/ST points NOT certified/);
 assert.match(worker,/url\.pathname==='\/api\/ffo\/stats\/defense-source-audit'/);
});
