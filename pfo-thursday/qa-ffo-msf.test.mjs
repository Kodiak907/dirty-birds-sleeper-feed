// FFO MSF-only independent scoring regression checks: no Sleeper fantasy-point input.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {fflScore,normalizeStats,plays,resolvePlayer,gameScoreUpdate} from './ffo-gamecast-model.mjs';
import {fieldMarkup,eventInfo} from './ffo-gamecast-stadium.mjs';

const base=dirname(fileURLToPath(import.meta.url));
const own=JSON.parse(readFileSync(join(base,'FFO_FFL_SCORING_V1.json'),'utf8'));
const core=readFileSync(join(base,'ffo-gamecast.js'),'utf8');
const worker=readFileSync(join(base,'_worker.js'),'utf8');
test('FFO-owned 2026 rules, independent source and no ESPN scoring board',()=>{
 assert.equal(own.schema,'FFO_SCORING_RULES_V1');
 assert.equal(own.league,'FFL');
 assert.equal(own.season,2026);
 assert.ok(Object.keys(own.scoring).length>=130);
 assert.equal(own.scoring.rec,.5);
 assert.equal(own.scoring.pass_td,4);
 assert.equal(own.scoring.rush_td,6);
 assert.equal(own.scoring.pass_yd,.04);
 assert.equal(own.scoring.fgm_60p,6);
 assert.match(core,/\/FFO_FFL_SCORING_V1\.json/);
 assert.doesNotMatch(core,/gm47Snapshot\?\.league\?\.scoring_settings/);
 assert.match(core,/\/api\/ffo\/gamecast\//);
 assert.doesNotMatch(core,/feed\('espnplays'/);
 assert.doesNotMatch(worker,/function ffoScBuild\(/);
 assert.doesNotMatch(worker,/ffoScEndpoint\(/);
 assert.match(worker,/async function ffoGamecastHandle\(/);
});
test('FFO computes half-PPR receiver independently from MSF stat categories',()=>{
 const stats={receiving:{receptions:5,recYards:100,recTD:1,targets:8},rushing:{rushYards:0,rushTD:0},fumbles:{fumblesLost:0}};
 const out=fflScore(stats,own.scoring,'WR');
 assert.equal(out.points,18.5);
 assert.equal(out.complete,false,'rare scoring events not explicitly covered; never claim certified');
 assert.ok(out.covered.includes('rec_yd')&&out.covered.includes('rec'));
});
test('FFO independently computes QB core stats from MSF fields',()=>{
 const stats={passing:{passYards:300,passTD:2,passInt:1},rushing:{rushYards:20,rushTD:0},fumbles:{fumblesLost:0}};
 const out=fflScore(stats,own.scoring,'QB');
 assert.equal(out.points,20);
 assert.equal(out.complete,false,'unverified bonuses and event categories withheld');
});
test('Missing MySportsFeeds stats are unknown, not zero points',()=>{
 const empty=fflScore({},own.scoring,'RB');
 assert.equal(empty.points,null);
 assert.equal(empty.complete,false);
 assert.ok(empty.missing.length>0);
});
test('Parse MSF play status using actual quarter relative secondsElapsed',()=>{
 const result=plays({gameplaybyplay:{plays:[{id:'msf-1',description:'Test sourced play',playStatus:{quarter:2,secondsElapsed:170}}]}});
 assert.equal(result.length,1);
 assert.equal(result[0].clock,'12:10');
 assert.equal(result[0].period,'2');
 assert.equal(result[0].text,'Test sourced play');
});
test('Player identity: unique team-and-name match, never arbitrary Sleeper ID to MSF',()=>{
 const roster={name:'Christian Watson',team:'GB'};
 const msf=[{name:'Christian Watson',team:'GB',stats:{receiving:{receptions:2}}},{name:'Christian Watson',team:'CAR',stats:{receiving:{receptions:4}}}];
 assert.equal(resolvePlayer(roster,msf).player.team,'GB');
 assert.equal(resolvePlayer({name:'Someone Else',team:'GB'},msf).player,null);
 const doubles=[msf[0],{...msf[0]}];
 assert.equal(resolvePlayer(roster,doubles).status,'ambiguous_player_identity');
});

test('Live MSF boxscore refresh supplies exact sourced scores and ignores unrelated game IDs',()=>{
 const game={id:'20261029-CAR-GB',home:'GB',away:'CAR',homePoints:null,awayPoints:null,status:'LIVE'};
 const body={data:{gameboxscore:{game:{id:'20261029-CAR-GB',playedStatus:'LIVE'},
   scoring:{homeScoreTotal:24,awayScoreTotal:17}}}};
 const changed=gameScoreUpdate(game,body);
 assert.equal(changed.homePoints,24);
 assert.equal(changed.awayPoints,17);
 assert.equal(changed.scoreSource,'MySportsFeeds game boxscore');
 assert.equal(changed.status,'LIVE');
 assert.deepEqual(gameScoreUpdate(game,{data:{gameboxscore:{game:{id:'unrelated'},scoring:{homeScoreTotal:999,awayScoreTotal:999}}}}),game);
});
test('No supplied MSF score is unknown, never fabricated zero; earlier sourced scores persist',()=>{
 const game={id:'G1',home:'GB',away:'CAR',homePoints:7,awayPoints:3};
 const same=gameScoreUpdate(game,{data:{gameboxscore:{scoring:{}}}});
 assert.equal(same.homePoints,7);assert.equal(same.awayPoints,3);
 const unknown=gameScoreUpdate({...game,homePoints:null,awayPoints:null},{data:{gameboxscore:{scoring:{}}}});
 assert.equal(unknown.homePoints,null);assert.equal(unknown.awayPoints,null);
});
test('Stadium uses verified line of scrimmage for ball position and renders latest game score',()=>{
 const game={id:'G1',home:'GB',away:'CAR',homePoints:24,awayPoints:17,status:'LIVE'};
 const event={id:'play-95',text:'Verified Carolina short pass',
  period:'3',clock:'13:44',
  raw:{playStatus:{quarter:3,teamInPossession:{abbreviation:'CAR'},lineOfScrimmage:{team:{abbreviation:'CAR'},yardLine:42},currentDown:1,yardsRemaining:10}}};
 const info=eventInfo(event,game);
 assert.equal(info.spot,42);
 assert.equal(info.offense,'CAR');
 const rendered=fieldMarkup({game,event,isLive:true,source:'MSF',playCount:95,activePlay:94});
 assert.match(rendered,/class="gc6-ball"/);
 assert.match(rendered,/data-source-spot="42"/);
 assert.match(rendered,/class="gc6-score">17</);
 assert.match(rendered,/class="gc6-score">24</);
 assert.match(rendered,/CAR POSSESSION/);
 const missing=fieldMarkup({game,event:{...event,raw:{playStatus:{quarter:3}}}});
 assert.doesNotMatch(missing,/class="gc6-ball"/);
});
