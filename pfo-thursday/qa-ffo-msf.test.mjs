// FFO MSF-only independent scoring regression checks: no Sleeper fantasy-point input.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {fflScore,normalizeStats,plays,resolvePlayer,gameScoreUpdate,gamePhase,gameStatusLabel,mergeScheduledGame,mergePlayTimeline,gamePollInterval,diagnosePlayFeed,sourcePlayRows,inspectHistoricalGame} from './ffo-gamecast-model.mjs';
import {fieldMarkup,eventInfo,playSubject} from './ffo-gamecast-stadium.mjs';

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

test('MSF shorthand 10-J.Love resolves QB by team and 14-C.Watson resolves receiver',()=>{
 const rows=[{id:'1136',name:'Jordan Love',team:'GB',sleeper:true},
 {id:'7562',name:'Christian Watson',team:'GB',sleeper:true},
 {id:'2244',name:'Jordan Love',team:'CAR',sleeper:true}];
 const game={home:'GB',away:'CAR'};
 const mk=text=>({text,raw:{playStatus:{teamInPossession:{abbreviation:'GB'}}}});
 assert.equal(playSubject(mk('(4:50) (Shotgun) 10-J.Love pass incomplete short right.'),rows,null,game).player?.id,'1136');
 assert.equal(playSubject(mk('(4:30) (Shotgun) 10-J.Love pass to 14-C.Watson for 11 yards.'),rows,null,game).player?.id,'7562');
 assert.equal(playSubject(mk('(4:15) 10-J.Love pass incomplete intended for 14-C.Watson.'),rows,null,game).player?.id,'1136');
 const rendered=fieldMarkup({game:{...game,homePoints:27,awayPoints:19,status:'LIVE'},event:mk('(4:50) (Shotgun) 10-J.Love pass incomplete short right.'),playerRows:rows});
 assert.match(rendered,/Jordan Love/);
 assert.match(rendered,/sleepercdn.com/);
});
test('GameCast polling is five seconds with a visible compact countdown',()=>{
 assert.match(core,/LIVE_PLAY_MS=5000/);
 assert.match(core,/data-gc6-refresh/);
 assert.match(core,/gc6-refresh-tracker/);
});

test('Provider state is authoritative: Q4 zero is not final; OT stays live',()=>{
 assert.equal(gamePhase('IN_PROGRESS'),'live');
 assert.equal(gamePhase('Q4'),'live');
 assert.equal(gamePhase('OVERTIME'),'overtime');
 assert.equal(gamePhase('COMPLETED'),'final');
 assert.equal(gamePhase('FINAL_OT'),'final');
 assert.equal(gameStatusLabel('completed'),'FINAL');
 assert.equal(gameStatusLabel('overtime'),'OT');
 assert.equal(gamePhase('0:00'),'unknown');
 const g={home:'GB',away:'CAR',homePoints:27,awayPoints:19,status:'COMPLETED',scoreSource:'MySportsFeeds game boxscore'};
 const stale={...g,homePoints:21,awayPoints:19,status:'IN_PROGRESS',scoreSource:'MySportsFeeds schedule'};
 assert.deepEqual(mergeScheduledGame(g,stale),g);
});
test('Final box scores accept provider corrections but refuse stale LIVE downgrades',()=>{
 const g={id:'G1',home:'GB',away:'CAR',homePoints:27,awayPoints:19,status:'COMPLETED'};
 const correction=gameScoreUpdate(g,{data:{gameboxscore:{game:{id:'G1',playedStatus:'COMPLETED'},scoring:{homeScoreTotal:28,awayScoreTotal:19}}}});
 assert.equal(correction.homePoints,28);
 assert.equal(correction.status,'COMPLETED');
 const stale=gameScoreUpdate(correction,{data:{gameboxscore:{game:{id:'G1',playedStatus:'LIVE'},scoring:{}}}});
 assert.equal(stale.status,'COMPLETED');
});
test('Truncated provider response retains published plays; corrections replace by stable ID',()=>{
 const previous=[
  {id:'a',period:'4',clock:'0:40',text:'Punt to end zone'},
  {id:'b',period:'4',clock:'0:30',text:'Packers timeout'}];
 const truncated=mergePlayTimeline(previous,[{id:'b',period:'4',clock:'0:30',text:'Packers timeout corrected'}]);
 assert.equal(truncated.length,2);
 assert.equal(truncated[0].id,'a');
 assert.equal(truncated[1].update,'corrected');
 const restored=mergePlayTimeline(truncated,[previous[0],{id:'b',period:'4',clock:'0:30',text:'Packers timeout corrected'}]);
 assert.equal(restored.length,2);
 assert.equal(new Set(restored.map(p=>p.id)).size,2);
});
test('Postgame poll stays fast for 90 seconds before reducing to two minutes',()=>{
 const now=Date.parse('2026-10-30T04:30:00Z');
 assert.equal(gamePollInterval({status:'LIVE',now}),5000);
 assert.equal(gamePollInterval({status:'OVERTIME',now}),5000);
 assert.equal(gamePollInterval({status:'COMPLETED',now,finalObservedAt:now-15000}),5000);
 assert.equal(gamePollInterval({status:'COMPLETED',now,finalObservedAt:now-100000}),120000);
 assert.equal(gamePollInterval({status:'Q4',now}),5000);
});
test('Special teams: verified D. Whelan roster player gets real portrait and unaudited actor stays labeled',()=>{
 const g={home:'GB',away:'CAR',status:'COMPLETED',homePoints:27,awayPoints:19};
 const e={text:'(:30) 19-D.Whelan punts 37 yards to end zone, Touchback.',period:'4',clock:'0:30',raw:{playStatus:{teamInPossession:{abbreviation:'GB'}}}};
 const directory=[{id:'4248789',name:'Daniel Whelan',team:'GB',position:'P',image:'https://a.espncdn.com/i/headshots/nfl/players/full/4248789.png',source:'ESPN 2026 team roster'}];
 const p=playSubject(e,directory,null,g);
 assert.equal(p.player?.name,'Daniel Whelan');
 const rendered=fieldMarkup({game:g,event:e,playerRows:directory});
 assert.match(rendered,/4248789.png/);
 assert.match(rendered,/>FINAL</);
 assert.doesNotMatch(rendered,/LIVE CHECKING/);
 const unknown=playSubject(e,[],null,g);
 assert.equal(unknown.player?.name,'D. Whelan');
 assert.equal(unknown.player?.unverified,true);
 assert.doesNotMatch(fieldMarkup({game:g,event:e,playerRows:[]}),/4248789.png/);
});
test('Historical audit is MSF-only and player imagery is backed by protected roster',()=>{
 assert.match(core,/runHistoricalAudit/);
 assert.match(core,/feed\('plays',\{season:s.season,game_id:g.id\},true\)/);
 assert.match(core,/ensurePortraits/);
 assert.match(worker,/route==='portraits'/);
 assert.match(worker,/site.api.espn.com\/apis\/site\/v2\/sports\/football\/nfl\/teams/);
});


test('Completed game hides countdown and stale possession while preserving final score',()=>{
 const game={id:'F1',home:'GB',away:'CAR',status:'COMPLETED',homePoints:27,awayPoints:19};
 const event={id:'last',period:'4',clock:'0:00',text:'End of game',raw:{playStatus:{teamInPossession:{abbreviation:'CAR'},currentDown:3,yardsRemaining:14}}};
 const final=fieldMarkup({game,event,isLive:false});
 assert.match(final,/>FINAL</);
 assert.match(final,/GAME COMPLETE/);
 assert.match(final,/LAST PUBLISHED PLAY/);
 assert.doesNotMatch(final,/CAR POSSESSION/);
 assert.doesNotMatch(final,/3 &amp; 14/);
 assert.match(final,/class="gc6-score">19</);
 assert.match(final,/class="gc6-score">27</);
 assert.match(core,/if\(bar&&\['live','overtime'\]\.includes\(model\.gamePhase\(g\?\.status\)\)\)/);
 assert.match(core,/if\(ticker&&gameActive\(\)&&s\.enabled&&s\.game&&\['live','overtime'\]\.includes/);
});
test('Live and OT remain refresh-eligible, historical scan samples Weeks 1–6',()=>{
 assert.equal(gamePhase('LIVE'),'live');
 assert.equal(gamePhase('OVERTIME'),'overtime');
 assert.equal(gamePhase('COMPLETED'),'final');
 assert.match(core,/for\(let week=1;week<=6;week\+\+\)/);
 assert.match(core,/historyAuditStarted=true;void runHistoricalAudit\(\)/);
 assert.match(core,/full-game coverage unverified|Full MSF PBP not demonstrated/);
});


test('Historical MSF PBP with NO native IDs is not falsely labeled duplicate IDs',()=>{
 const data={gameplaybyplay:{plays:[
  {description:'First published punt',playStatus:{quarter:1,secondsElapsed:25}},
  {description:'Second published pass',playStatus:{quarter:1,secondsElapsed:26}},
  {description:'Third published rush',playStatus:{quarter:2,secondsElapsed:13}}
 ]}};
 const list=plays(data),d=diagnosePlayFeed(data,{coverage:'full'});
 assert.equal(sourcePlayRows(data).length,3);
 assert.equal(list.length,3);
 assert.equal(new Set(list.map(p=>p.id)).size,3);
 assert.ok(list.every(p=>p.identitySource==='derived_from_published_play'));
 assert.equal(d.providerIdCount,0);
 assert.equal(d.missingProviderIds,3);
 assert.equal(d.repeatedProviderIds,0);
 assert.equal(d.duplicateResolvedIds,0);
 assert.equal(d.withClock,3);
 assert.deepEqual(d.quarters,['1','2']);
 assert.equal(d.hasPublishedPlays,true);
 assert.equal(d.fullGameVerified,false);
});
test('Repeated native MSF play IDs are diagnosed separately and safely scoped',()=>{
 const data={gameplaybyplay:{plays:[
  {id:'5',description:'Play in Q1',playStatus:{quarter:1,secondsElapsed:10}},
  {id:'5',description:'Play in Q2',playStatus:{quarter:2,secondsElapsed:19}},
  {id:'5',description:'Different play at same clock',playStatus:{quarter:2,secondsElapsed:19}}
 ]}};
 const rows=plays(data),d=diagnosePlayFeed(data);
 assert.equal(new Set(rows.map(p=>p.id)).size,3);
 assert.equal(d.providerIdCount,3);
 assert.equal(d.missingProviderIds,0);
 assert.equal(d.repeatedProviderIds,2);
 assert.equal(d.duplicateResolvedIds,0);
 assert.equal(d.limitedIdentity,true);
 assert.equal(d.fullGameVerified,false);
});
test('MSF scoring-only fallback cannot certify historical access to full PBP',()=>{
 const data={plays:[{id:'score1',description:'Made 49-yard field goal',quarter:4,time:'0:50'}]};
 const d=diagnosePlayFeed(data,{coverage:'scoring_only',full_playbyplay_authorized:false});
 assert.equal(d.describedCount,1);
 assert.equal(d.scoringOnly,true);
 assert.equal(d.hasPublishedPlays,false);
 assert.equal(d.fullGameVerified,false);
});
test('Reordering an identifier-free snapshot preserves deterministic play keys',()=>{
 const p={description:'Published return',playStatus:{quarter:1,secondsElapsed:75}};
 const q={description:'Published tackle',playStatus:{quarter:1,secondsElapsed:80}};
 const first=plays({plays:[p,q]});
 const second=plays({plays:[q,p]});
 const byText=rows=>new Map(rows.map(r=>[r.text,r.id]));
 assert.equal(byText(first).get(p.description),byText(second).get(p.description));
 assert.equal(byText(first).get(q.description),byText(second).get(q.description));
});
test('Week 1–6 audit reports missing and repeated provider IDs separately',()=>{
 assert.match(core,/inspectHistoricalGame/);
 assert.match(core,/ID gaps/);
 assert.match(core,/repeated native IDs/);
 assert.match(core,/MSF published plays/);
 assert.doesNotMatch(core,/!sameId\?'Duplicate play IDs'/);
});


test('MSF historical integrity: final box score and independently sourced schedule align',()=>{
 const p={data:{gameplaybyplay:{plays:[
  {description:'Kickoff return',playStatus:{quarter:1,secondsElapsed:20}},
  {description:'Half ends',playStatus:{quarter:2,secondsElapsed:900}},
  {description:'Third-quarter rush',playStatus:{quarter:3,secondsElapsed:40}},
  {description:'Final kneel',playStatus:{quarter:4,secondsElapsed:898}}
 ]}}};
 const box={available:true,data:{gameboxscore:{game:{id:'G1',playedStatus:'COMPLETED'},
  scoring:{homeScoreTotal:27,awayScoreTotal:19,
    quarters:[{homeScore:7,awayScore:3},{homeScore:7,awayScore:7},{homeScore:7,awayScore:3},{homeScore:6,awayScore:6}]}}}};
 const g={id:'G1',home:'GB',away:'CAR',status:'COMPLETED',homePoints:27,awayPoints:19};
 const r=inspectHistoricalGame(p,box,g);
 assert.equal(r.usablePlaySequence,true);
 assert.equal(r.boxScorePublished,true);
 assert.equal(r.providerFinal,true);
 assert.equal(r.chronologicalOrder,'forward');
 assert.equal(r.matchesSchedule,true);
 assert.equal(r.quarterScoreMatches,true);
 assert.equal(r.first.quarter,1);assert.equal(r.last.quarter,4);
 assert.equal(r.first.clock,'14:40');
 assert.equal(r.last.clock,'0:02');
 assert.equal(r.fullGameCertified,false);
});
test('MSF historical integrity: reverse PBP chronology is surfaced, not reordered silently',()=>{
 const p={data:{gameplaybyplay:{plays:[
  {description:'Last play',playStatus:{quarter:4,secondsElapsed:899}},
  {description:'Before halftime',playStatus:{quarter:2,secondsElapsed:850}},
  {description:'Opening play',playStatus:{quarter:1,secondsElapsed:10}}
 ]}}};
 const r=inspectHistoricalGame(p,null,{id:'G1'});
 assert.equal(r.chronologicalOrder,'reverse');
 assert.equal(r.first.quarter,1);
 assert.equal(r.last.quarter,4);
 assert.equal(r.boxScorePublished,false);
 assert.ok(r.warnings.some(w=>/box-score/i.test(w)));
});
test('MSF historical integrity: quarter sequence regression reports mixed chronology',()=>{
 const p={data:{gameplaybyplay:{plays:[
  {description:'Q1 play',playStatus:{quarter:1,secondsElapsed:30}},
  {description:'Q3 play',playStatus:{quarter:3,secondsElapsed:120}},
  {description:'Q2 play',playStatus:{quarter:2,secondsElapsed:120}}
 ]}}};
 const r=inspectHistoricalGame(p,null,{id:'G1'});
 assert.equal(r.chronologicalOrder,'mixed');
 assert.equal(r.usablePlaySequence,false);
 assert.ok(r.warnings.some(w=>/chronology/.test(w)));
});
test('MSF regular-season overtime: do not fabricate a 15-minute clock from secondsElapsed',()=>{
 const p={gameplaybyplay:{plays:[
  {description:'Overtime first play',playStatus:{quarter:5,secondsElapsed:20}},
  {description:'(8:40) Verified overtime pass',playStatus:{quarter:5,secondsElapsed:80}}
 ]}};
 const r=inspectHistoricalGame({data:p},null,{id:'G1'});
 const a=plays(p);
 assert.equal(a[0].period,'5');
 assert.equal(a[0].clock,'');
 assert.equal(a[1].clock,'8:40');
 assert.equal(r.otPlayCount,2);
 assert.equal(r.otClockUnknown,1);
 assert.ok(r.warnings.some(w=>/OT contains/.test(w)));
 assert.equal(r.fullGameCertified,false);
});
test('MSF reconciliation: distinguish box score failure and mismatched schedule score',()=>{
 const p={data:{plays:[{description:'(14:59) kickoff',quarter:1,time:'14:59'}]}};
 const box={data:{gameboxscore:{game:{id:'G1',playedStatus:'COMPLETED'},scoring:{homeScoreTotal:20,awayScoreTotal:17}}}};
 const r=inspectHistoricalGame(p,box,{id:'G1',status:'COMPLETED',homePoints:21,awayPoints:17});
 assert.equal(r.matchesSchedule,false);
 assert.ok(r.warnings.some(w=>/differs from MSF schedule/.test(w)));
 assert.equal(r.quarterScoreMatches,null);
});
test('Historical QA requests BOTH MSF play-by-play and game box score for each sample',()=>{
 assert.match(core,/feed\('plays',\{season:s.season,game_id:g.id\},true\)/);
 assert.match(core,/feed\('boxscore',\{season:s.season,game_id:g.id\},true\)/);
 assert.match(core,/final box scores with both scores/);
 assert.doesNotMatch(core,/fullGameCertified:true/);
});
