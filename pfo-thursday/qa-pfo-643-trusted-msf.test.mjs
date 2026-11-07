import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readTrustedMSF2026,verifyNormalizedMSFPlayerIndex}
 from './ffo-msf-trusted-read-643.mjs';
import {ffo598NormalizeSeason} from './ffo-msf-season-normalizer-643.mjs';
import {forecastBrowserSourceCandidate643}
 from './ffo-server-forecast-643.mjs';

const read=p=>readFileSync(new URL('./'+p,import.meta.url),'utf8');
const now=new Date('2026-11-08T18:00:00Z');
const leagueRules=JSON.parse(read('FFO_FFL_SCORING_V1.json'));
const player=(id,name,pos,stats,team='BUF')=>({
 player:{id,fullName:name,primaryPosition:{abbreviation:pos}},
 team:{abbreviation:team},
 stats
});
const body={
 playerStatsTotals:[
  player(18607,'Sample Signalcaller','QB',
   {gamesPlayed:2,passing:{passYards:500,passTD:4,passInt:2}}),
  player(18608,'Sample Wideout','WR',
   {gamesPlayed:2,receiving:{receptions:12,recYards:180,recTD:2}}),
  player(18609,'Sample Kicker','K',
   {gamesPlayed:2,extraPointAttempts:{xpMade:4,xpAtt:5,fgAndXpPts:13},
    fieldGoals:{fgAtt:3,fg1_19Pct:100}})
 ]};
const game={games:[{schedule:{id:'g100',week:10,
 homeTeam:{abbreviation:'BUF'},awayTeam:{abbreviation:'MIA'},
 startTime:'2026-11-08T18:25:00Z',playedStatus:'NOT_STARTED'}}]};
const response=(data,code=200)=>({
 ok:code===200,status:code,headers:{get:()=>null},
 text:async()=>JSON.stringify(data)
});
const fake=(data,code=200,calls=[])=>async (url,options)=>{
 calls.push({url,method:options.method,redirect:options.redirect,
  authorization:options.headers.authorization});
 return response(data,code);
};
test('source-normalizer module EXACTLY matches the existing deployed Pages producer code',()=>{
 const original=read('_worker.js');
 const begin=original.indexOf('function ffo598NormalizeSeason(payload,checkedAt){');
 const end=original.indexOf('/* PFO 6.16',begin);
 assert.ok(begin>0&&end>begin);
 const expected=original.slice(begin,end).trim();
 const external=read('ffo-msf-season-normalizer-643.mjs').trim();
 assert.ok(external.endsWith('export '+expected),
  'source extractor must be updated alongside actual Pages normalizer, no silent divergence');
});
test('real Pages normalizer recognizes season stats but does NOT invent kicker FG tiers',()=>{
 const normalized=ffo598NormalizeSeason(body,now.toISOString());
 assert.equal(normalized.schema,'FFO_MSF_SEASON_V1');
 assert.equal(normalized.players.length,3);
 const qb=normalized.players.find(x=>x.position==='QB');
 assert.equal(qb.forecast.pass_yd,250);
 assert.equal(qb.forecast.pass_td,2);
 const k=normalized.players.find(x=>x.position==='K');
 assert.equal(k.season_totals.fgm,3,'generic FG count may be derived from validated real FG-and-XP tally');
 assert.equal(k.forecast.fgm,1.5);
 assert.equal(k.forecast.xpmiss,.5);
 for(const key of ['fgm_0_19','fgm_20_29','fgm_40_49','fgm_50_59','fgm_60p'])
  assert.equal(k.forecast[key],undefined,'not allowed to convert percentage field into FG tier');
});
test('fixed authenticated, team-scoped MSF season fetch yields same current browser candidate',async()=>{
 const calls=[];
 const result=await readTrustedMSF2026({
  env:{MSF_API_KEY:'test-only-secret'},feed:'season',team:'BUF',
  now,transport:fake(body,200,calls)
 });
 assert.equal(result.status,'verified');
 assert.equal(result.providerHttpStatus,200);
 assert.equal(result.playerCount,3);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,
  'https://api.mysportsfeeds.com/v2.1/pull/nfl/2026-regular/player_stats_totals.json?team=BUF');
 assert.equal(calls[0].method,'GET');
 assert.equal(calls[0].redirect,'error');
 assert.ok(calls[0].authorization.startsWith('Basic '));
 const qb=result.normalized.players.find(x=>x.position==='QB');
 const forecast=forecastBrowserSourceCandidate643({
  player:qb,row:qb.row,rules:leagueRules,uniqueMSFIdentityVerified:true
 });
 assert.equal(forecast.points,16);
 assert.equal(forecast.partial,true);
 assert.equal(forecast.certified,false);
 assert.equal(forecast.verifiedServerParity,false);
 assert.equal(result.accuracyWritesEnabled,false);
});
test('fixed authenticated MSF fixtures normalize exact kickoff without publishing scores',async()=>{
 const calls=[];
 const result=await readTrustedMSF2026({
  env:{MSF_API_KEY:'test-only-secret'},feed:'fixtures',team:'BUF',
  now,transport:fake(game,200,calls)
 });
 assert.equal(result.status,'verified');
 assert.equal(result.fixtures.length,1);
 assert.equal(result.fixtures[0].gameId,'g100');
 assert.equal(result.fixtures[0].kickoffAt,'2026-11-08T18:25:00.000Z');
 assert.equal(result.fixtures[0].verified,true);
 assert.equal(result.accuracyWritesEnabled,false);
 assert.equal(calls.length,1);
});
test('no provider call when credential missing, arbitrary feed or invalid team',async()=>{
 let calls=0;
 const transport=async()=>{calls++;throw Error('should not fetch')};
 for(const args of [
  {env:{},feed:'season',team:'BUF'},
  {env:{MSF_API_KEY:'secret'},feed:'playbyplay',team:'BUF'},
  {env:{MSF_API_KEY:'secret'},feed:'season',team:'INDIA'},
  {env:{MSF_API_KEY:'secret'},feed:'fixtures',team:'%2Fetc'}
 ]){
  const r=await readTrustedMSF2026({...args,now,transport});
  assert.equal(r.status,'blocked');
 }
 assert.equal(calls,0);
});
test('401, 403, 429 and 5xx are withheld, never retried or described as complete',async()=>{
 for(const [code,reason] of [[401,'provider_auth_denied'],[403,'provider_entitlement_denied'],
  [429,'provider_rate_limited'],[503,'provider_unavailable']]){
  const calls=[];
  const r=await readTrustedMSF2026({env:{MSF_API_KEY:'secret'},
   feed:'fixtures',team:'BUF',now,transport:fake({},code,calls)});
  assert.equal(r.status,'blocked');
  assert.equal(r.reason,reason);
  assert.equal(r.accuracyWritesEnabled,false);
  assert.equal(calls.length,1);
 }
});
test('missing fixture kickoff, large response and malformed JSON all fail closed',async()=>{
 const base={env:{MSF_API_KEY:'secret'},team:'BUF',now};
 const malformed=await readTrustedMSF2026({...base,feed:'fixtures',
  transport:async()=>({ok:true,status:200,headers:{get:()=>null},text:async()=>'{nope'})});
 assert.equal(malformed.reason,'provider_json_invalid');
 const missing=await readTrustedMSF2026({...base,feed:'fixtures',
  transport:fake({games:[{schedule:{id:'no-kick',week:10,
   homeTeam:{abbreviation:'BUF'},awayTeam:{abbreviation:'MIA'},
   playedStatus:'NOT_STARTED'}}]})});
 assert.equal(missing.reason,'verified_msf_game_identity_or_kickoff_unavailable');
 const large=await readTrustedMSF2026({...base,feed:'fixtures',
  transport:async()=>({ok:true,status:200,
   headers:{get:()=>String(7_000_000)},text:async()=>{throw Error('cannot read oversized payload')}})});
 assert.equal(large.reason,'provider_response_too_large');
});
test('duplicate provider IDs and ambiguous same-name/team/position cannot be assigned to fantasy identity',()=>{
 const normalized=ffo598NormalizeSeason({playerStatsTotals:[
  player(18607,'Duplicate Hero','QB',{gamesPlayed:2,passing:{passYards:200}}),
  player(18607,'Duplicate Hero','QB',{gamesPlayed:2,passing:{passYards:300}}),
  player(18608,'Verified Other','RB',{gamesPlayed:2,rushing:{rushYards:100}})
 ]},now.toISOString());
 const report=verifyNormalizedMSFPlayerIndex(normalized,{team:'BUF'});
 assert.equal(report.playerCount,1);
 assert.equal(report.players[0].id,'18608');
 assert.ok(report.conflictingProviderIdentities>=1);
});

test('existing private GamecastInternal binding can supply verified MSF schedule without copying credentials',async()=>{
 const calls=[];
 const internal={async fetch(request){
  calls.push({url:request.url,method:request.method,
   auth:request.headers.get('authorization')});
  return response({available:true,source:'MySportsFeeds',
   provider_http_status:200,data:game},200);
 }};
 const result=await readTrustedMSF2026({env:{GAMECAST_INTERNAL:internal},
  feed:'fixtures',team:'BUF',now,
  transport:async()=>{throw Error('direct network must not run')}});
 assert.equal(result.status,'verified');
 assert.equal(result.gameCount,1);
 assert.equal(result.viaTrustedGamecastInternal,true);
 assert.equal(result.accuracyWritesEnabled,false);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.mysportsfeeds.com/v2.1/pull/nfl/2026-regular/games.json?team=BUF');
 assert.equal(calls[0].auth,null,'service binding request carries no secret or browser auth');
});
test('internal Gamecast upstream 403 inside HTTP 200 gateway envelope must not become a verified MSF feed',async()=>{
 const internal={fetch:async()=>response({available:true,
  provider_http_status:403,data:game},200)};
 const result=await readTrustedMSF2026({env:{GAMECAST_INTERNAL:internal},
  feed:'fixtures',team:'BUF',now});
 assert.equal(result.status,'blocked');
 assert.equal(result.reason,'provider_payload_not_verified');
});
test('untrusted external or missing service binding is never treated as internal MSF provenance',async()=>{
 let used=false;
 const bad={GAMECAST_INTERNAL:{request:async()=>{used=true}}};
 const result=await readTrustedMSF2026({env:bad,feed:'fixtures',team:'BUF',now});
 assert.equal(result.status,'blocked');
 assert.equal(used,false);
});
