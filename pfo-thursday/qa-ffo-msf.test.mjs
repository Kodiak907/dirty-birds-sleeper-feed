// FFO MSF-only independent scoring regression checks: no Sleeper fantasy-point input.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {fflScore,normalizeStats,plays,resolvePlayer,gameScoreUpdate,gamePhase,gameStatusLabel,mergeScheduledGame,mergePlayTimeline,gamePollInterval,diagnosePlayFeed,sourcePlayRows,inspectHistoricalGame,playerRows,playerFeedShape,auditStatFeed,auditSeasonLowerBound,scoringEvidence,statFieldPaths,auditTeamGameFeed,kickingPlayEvidence,summarizeDstWeeks,summarizeKickerWeeks,reconcileKickerWeeks} from './ffo-gamecast-model.mjs';
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
 assert.match(core,/full-play completeness and fantasy scoring are separate verification milestones/i);
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
 assert.match(core,/Published plays/);
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
 assert.equal(r.clockCoverage,'ot_exception');
 assert.equal(r.regulationClockUnknown,0);
 assert.ok(r.warnings.some(w=>/overtime play lacks a verifiable clock/.test(w)));
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
 assert.match(core,/final box scores/);
 assert.doesNotMatch(core,/fullGameCertified:true/);
});


test('MSF clock verification tiers do not downgrade a valid OT game for an unreported OT clock',()=>{
 const p={data:{gameplaybyplay:{plays:[
  {description:'Regulation kickoff',playStatus:{quarter:1,secondsElapsed:8}},
  {description:'End first half',playStatus:{quarter:2,secondsElapsed:900}},
  {description:'Regulation final',playStatus:{quarter:4,secondsElapsed:900}},
  {description:'OT start play',playStatus:{quarter:5,secondsElapsed:20}}
 ]}}};
 const result=inspectHistoricalGame(p,null,{id:'G1'});
 assert.equal(result.usablePlaySequence,true);
 assert.equal(result.otPlayCount,1);
 assert.equal(result.otClockUnknown,1);
 assert.equal(result.regulationClockUnknown,0);
 assert.equal(result.clockCoverage,'ot_exception');
 assert.equal(result.fullGameCertified,false);
});
test('MSF historical audit still fails genuine regulation clock gaps',()=>{
 const p={data:{gameplaybyplay:{plays:[
  {description:'Kickoff with no clock evidence',playStatus:{quarter:1}},
  {description:'Second quarter',playStatus:{quarter:2,secondsElapsed:100}}
 ]}}};
 const result=inspectHistoricalGame(p,null,{id:'G1'});
 assert.equal(result.regulationClockUnknown,1);
 assert.equal(result.clockCoverage,'incomplete');
 assert.ok(result.warnings.some(w=>/regulation\/unknown-period/.test(w)));
});
test('GameCast historical cards are compact on iPhone and show OT exception distinctly',()=>{
 assert.match(core,/gc-history-row/);
 assert.match(core,/clockCoverage==='ot_exception'/);
 assert.match(core,/const ok=a\.usablePlaySequence&&a\.clockCoverage!=='incomplete'/);
 assert.match(core,/Published plays/);
 assert.match(core,/full-play completeness/i);
});

test('MSF gamelogs response schema is parsed, not silently treated as an empty feed',()=>{
 const payload={gamelogs:[{player:{id:11,fullName:'FFO Test Receiver',primaryPosition:'WR'},
   team:{abbreviation:'GB'},game:{id:'G1'},stats:{receiving:{receptions:5,recYards:100,recTD:1}}}]};
 assert.deepEqual(playerFeedShape(payload),{collection:'gamelogs',rawCount:1});
 const rows=playerRows(payload);
 assert.equal(rows.length,1);
 assert.equal(rows[0].id,'11');
 assert.equal(rows[0].team,'GB');
 assert.equal(rows[0].position,'WR');
 const audit=auditStatFeed(payload,own.scoring);
 assert.equal(audit.supported,true);
 assert.equal(audit.parsedCount,1);
 assert.equal(audit.positionCoverage.WR.records,1);
 assert.equal(audit.positionCoverage.WR.partialScoring,1);
 assert.equal(audit.positionCoverage.WR.completeScoring,0);
 assert.equal(audit.scoringCertified,false);
});
test('MSF season totals parsed with native provider IDs; unavailable stats remain unknown',()=>{
 const totals={playerStatsTotals:[{player:{id:17,fullName:'FFO Test QB',primaryPosition:'QB'},
  team:{abbreviation:'CAR'},stats:{passing:{passYards:200,passTD:2}}}]};
 const a=auditStatFeed(totals,own.scoring);
 assert.equal(a.supported,true);assert.equal(a.collection,'playerStatsTotals');
 assert.equal(a.uniqueProviderIds,1);assert.equal(a.statsRecognized,1);
 assert.equal(a.positionCoverage.QB.partialScoring,1);
 assert.ok(a.positionCoverage.QB.missingCategories.length);
 assert.equal(a.scoringCertified,false);
 assert.equal(auditStatFeed({gamelogs:[]},own.scoring).supported,false);
});
test('Six-week log totals are compared only by matching native player IDs and observed categories',()=>{
 const season={playerStatsTotals:[{player:{id:11,fullName:'FFO Test Receiver',primaryPosition:'WR'},
  team:{abbreviation:'GB'},stats:{receiving:{receptions:10,recYards:190,recTD:2}}}]};
 const logs=[{gamelogs:[{player:{id:11,fullName:'FFO Test Receiver'},team:{abbreviation:'GB'},
  game:{id:'G1'},stats:{receiving:{receptions:4,recYards:80,recTD:1}}}]},
  {gamelogs:[{player:{id:11,fullName:'FFO Test Receiver'},team:{abbreviation:'GB'},
  game:{id:'G2'},stats:{receiving:{receptions:6,recYards:110,recTD:1}}}]}];
 const a=auditSeasonLowerBound(logs,season);
 assert.equal(a.matchedPlayers,1);
 assert.equal(a.overSeasonTotals,0);
 assert.ok(a.comparedCategories>=3);
 assert.equal(a.certifiedSeasonReconciliation,false);
 const wrong={playerStatsTotals:[{player:{id:11,fullName:'FFO Test Receiver'},
  stats:{receiving:{receptions:9,recYards:190,recTD:2}}}]};
 const b=auditSeasonLowerBound(logs,wrong);
 assert.equal(b.overSeasonTotals,1);
 assert.equal(b.examples[0].category,'rec');
});
test('Statistics audit is private, read-only, on demand, and calls MSF not Sleeper for points',()=>{
 const index=readFileSync(join(base,'index.html'),'utf8');
 assert.match(index,/id="ffo-gc-stat-audit-check"/);
 assert.match(core,/runStatAudit/);
 assert.match(core,/auditedStatRequest\('gamelogs',\{season:s.season,week,team\}/);
 assert.match(core,/auditedStatRequest\('stats',\{season:s.season,team\}/);
 assert.match(core,/auditSeasonLowerBound/);
 assert.match(core,/No final FFL score certified/);
 assert.doesNotMatch(core,/feed\('sleeperPoints'/);
});

test('MSF stats route supports validated team filter and isolated size errors',()=>{
 assert.match(worker,/const FFO_NFL_TEAMS=new Set/);
 assert.match(worker,/function ffoTeamFilter\(params\)/);
 assert.match(worker,/throw Error\('invalid_team_filter'\)/);
 assert.match(worker,/if\(route==='stats'\)return .*ffoTeamFilter\(params\)/);
 assert.match(worker,/if\(route==='gamelogs'\|\|route==='teamgamelogs'\)[\s\S]*?ffoTeamFilter\(params\)/);
 assert.match(worker,/provider_payload_exceeds_limit/);
 assert.match(worker,/provider_json_invalid/);
 assert.match(worker,/provider_body_read_failed/);
 assert.doesNotMatch(worker,/provider_payload_invalid_or_too_large/);
});
test('Team-scoped FFO stat audit rejects ignored MSF team filter',()=>{
 const index=readFileSync(join(base,'index.html'),'utf8');
 assert.match(index,/id="ffo-gc-stat-audit-team"/);
 assert.match(core,/const team=String\(\$\('ffo-gc-stat-audit-team'\)/);
 assert.match(core,/auditedStatRequest\('stats',\{season:s.season,team\}/);
 assert.match(core,/auditedStatRequest\('gamelogs',\{season:s.season,week,team\}/);
 assert.match(core,/rows\.length>0&&rows\.every\(r=>r\.team===team\)/);
 assert.match(core,/report\.seasonFilterVerified/);
 assert.match(core,/No final FFL score certified/);
});

test('Gateway preserves binding versus MSF failure layers without exposing response bodies',()=>{
 assert.match(worker,/legacy_gamecast_service_binding/);
 assert.match(worker,/binding_http_status:viaBinding\?resp.status:null/);
 assert.match(worker,/msf_http_status_via_binding:verifiedInnerStatus/);
 assert.match(worker,/inner_gateway_error:safeInnerError/);
 assert.match(worker,/size>8192/);
 assert.match(worker,/provider_gateway_or_server_error/);
 assert.match(worker,/upstream_layer:viaBinding\?'legacy_gamecast_worker':'mysportsfeeds'/);
 assert.doesNotMatch(worker,/JSON\.stringify\(inner\)/);
});
test('Read-only MSF stat audit shows specific errors instead of opaque provider_upstream_error',()=>{
 assert.match(core,/legacy GameCast binding/);
 assert.match(core,/binding HTTP/);
 assert.match(core,/MSF status reported by binding/);
 assert.match(core,/inner error/);
 assert.match(core,/report\.seasonError=String\(error\.message\|\|error\)\.slice\(0,220\)/);
 assert.doesNotMatch(core,/MSF player game logs.*certified NFL fantasy score/);
});

test('MSF historical stat audit paces weekly requests, retries transient gateway failure once, and leaves absent data unknown',()=>{
 assert.match(core,/statAuditRunning=true/);
 assert.match(core,/if\(statAuditRunning\)return s\.playerRows/);
 assert.match(core,/if\(!s\.player\|\|!s\.enabled\|\|statAuditRunning\)return/);
 assert.match(core,/await auditPause\(1600\)/);
 assert.match(core,/await auditPause\(3600\)/);
 assert.match(core,/for\(let attempt=1;attempt<=2;attempt\+\+\)/);
 assert.match(core,/auditedStatRequest\('gamelogs',\{season:s.season,week,team\}/);
 assert.match(core,/auditedStatRequest\('stats',\{season:s.season,team\}/);
 assert.match(core,/Missing games or statistics are unknown, not zero/);
});


test('FFL out-of-position passing touchdown is not lost when a WR throws the ball',()=>{
 const stats={passing:{passYards:40,passTD:1},receiving:{receptions:2,recYards:20},rushing:{rushYards:0,rushTD:0},fumbles:{fumblesLost:0}};
 const r=fflScore(stats,own.scoring,'WR');
 assert.equal(r.points,8.6);
 assert.ok(r.components.some(x=>x.key==='pass_td'&&x.points===4));
 assert.ok(r.components.some(x=>x.key==='pass_yd'&&x.points===1.6));
 assert.equal(r.complete,false,'unverified event-only scoring still blocks certification');
});
test('Kicker scoring uses FFO 40-49 and 50-59 distance bands, not a made-FG shortcut',()=>{
 const stats={fieldGoals:{fieldGoalsMade40To49:1,fieldGoalsMade50To59:1,fieldGoalsMissed:0},
  extraPoints:{extraPointsMade:2,extraPointsMissed:0}};
 const norm=normalizeStats(stats);
 assert.equal(norm.fgm_40_49,1);
 assert.equal(norm.fgm_50_59,1);
 const r=fflScore(stats,own.scoring,'K');
 assert.equal(r.points,11);
 assert.equal(r.complete,false);
 assert.ok(r.missing.includes('fgm_60p'));
 assert.ok(r.components.some(x=>x.key==='fgm_50_59'&&x.points===5));
 const generic=fflScore({fieldGoals:{fieldGoalsMade:2},extraPoints:{extraPointsMade:2}},own.scoring,'K');
 assert.equal(generic.points,2,'2 XP are evidenced, made FG distances not invented');
 assert.ok(generic.missing.includes('fgm_40_49'));
 assert.ok(generic.missing.includes('fgm_50_59'));
});
test('Per-position FFL evidence exposes component weights and category coverage but no certified scores',()=>{
 const feed={gamelogs:[
  {player:{id:101,fullName:'FFO Test WR',primaryPosition:'WR'},team:{abbreviation:'GB'},stats:{receiving:{receptions:4,recYards:60,recTD:1}}},
  {player:{id:102,fullName:'FFO Test K',primaryPosition:'K'},team:{abbreviation:'GB'},stats:{extraPoints:{extraPointsMade:2},fieldGoals:{fieldGoalsMade40To49:1}}},
  {player:{id:103,fullName:'Other Team QB',primaryPosition:'QB'},team:{abbreviation:'CAR'},stats:{passing:{passYards:200}}}
 ]};
 const a=scoringEvidence([{week:6,payload:feed}],own.scoring,'GB');
 assert.equal(a.team,'GB');assert.equal(a.records,2);assert.equal(a.weekFeeds,1);
 assert.equal(a.exactFantasyPointsCertified,false);
 assert.equal(a.byPosition.WR.records,1);assert.equal(a.byPosition.K.records,1);
 assert.equal(a.byPosition.QB.records,0);
 const w=a.byPosition.WR.samples[0];
 assert.equal(w.week,6);assert.equal(w.observedPoints,14);
 assert.ok(w.components.some(x=>x.key==='rec'&&x.points===2));
 assert.ok(w.components.some(x=>x.key==='rec_yd'&&x.points===6));
 assert.ok(w.missing.length);
 assert.equal(a.byPosition.K.samples[0].observedPoints,6);
});
test('MSF scoring audit displays component breakdown and lower-bound comparison accurately',()=>{
 assert.match(core,/model\.scoringEvidence\(goodWeeks,s\.ownedRules,team\)/);
 assert.match(core,/FFL scoring components/);
 assert.match(core,/Observed subtotal/);
 assert.match(core,/lower-bound checks/);
 assert.match(core,/six-week totals exceeding published season totals/);
 assert.match(core,/model\.auditSeasonLowerBound\(goodWeeks\.map\(x=>x\.payload\),seasonPayload\)/);
 assert.doesNotMatch(core,/Sleeper fantasy points as source/);
});

test('Unknown MSF kicker fields are discoverable as private schema names but never treated as points',()=>{
 const stats={fieldGoalShooting:{fgGood:1,fgLong:53},patKicking:{patGood:3},playerName:'example'};
 const keys=statFieldPaths(stats);
 assert.deepEqual(keys,['fieldGoalShooting.fgGood','fieldGoalShooting.fgLong','patKicking.patGood']);
 const sample={gamelogs:[{player:{id:15,fullName:'FFO Test Kicker',primaryPosition:'K'},
   team:{abbreviation:'GB'},stats}]};
 const a=scoringEvidence([{week:6,payload:sample}],own.scoring,'GB');
 assert.equal(a.byPosition.K.records,1);
 assert.equal(a.byPosition.K.withPartialPoints,0);
 assert.ok(a.byPosition.K.observedRawFieldPaths.includes('fieldGoalShooting.fgGood'));
 assert.equal(a.exactFantasyPointsCertified,false);
});
test('MSF team gamelog source is verified independently from individual players',()=>{
 const payload={teamgamelogs:[{team:{abbreviation:'GB'},game:{id:'G-1'},
   stats:{defense:{sacks:3},turnovers:{takeaways:2}}}]};
 const a=auditTeamGameFeed(payload,'GB');
 assert.equal(a.collection,'teamgamelogs');
 assert.equal(a.records,1);
 assert.equal(a.numericRecords,1);
 assert.equal(a.teamFilterVerified,true);
 assert.ok(a.exampleFieldPaths.includes('defense.sacks'));
 assert.equal(a.dstScoreCertified,false);
 assert.equal(auditTeamGameFeed(payload,'CAR').teamFilterVerified,false);
 assert.equal(auditTeamGameFeed({gamelogs:[]},'GB').dstScoreCertified,false);
});
test('Player audit reports special-teams source gaps and team-gamelog endpoint securely',()=>{
 assert.match(worker,/teamgamelogs/);
 assert.match(worker,/team_gamelogs/);
 assert.match(worker,/ffoTeamFilter\(params\)/);
 assert.match(core,/auditedStatRequest\('teamgamelogs',\{season:s.season,week:1,team\}/);
 assert.match(core,/model\.auditTeamGameFeed/);
 assert.match(core,/observedRawFieldPaths/);
 assert.match(core,/D\/ST source evidence/);
 assert.match(core,/No final D\/ST fantasy score is certified/);
 assert.doesNotMatch(core,/D\/ST.*0\.0 points/);
});

test('Historical MSF FG/XP PBP detection reports events without inventing player credit',()=>{
 const payload={gameplaybyplay:{plays:[
  {description:'(:44) 19-D.Whelan punts 37 yards, Touchback.',playStatus:{quarter:4}},
  {description:'(11:53) 31-B.Kicker 45 yard Field Goal is good',playStatus:{quarter:1}},
  {description:'(05:21) 31-B.Kicker extra point is good',playStatus:{quarter:1}},
  {description:'(1:30) 31-B.Kicker 53 yard field goal no good',playStatus:{quarter:2}},
  {description:'(0:30) field goal attempt blocked',playStatus:{quarter:3}}
 ]}};
 const evidence=kickingPlayEvidence(payload);
 assert.equal(evidence.candidatePlays,4);
 assert.equal(evidence.fgCandidates,3);
 assert.equal(evidence.xpCandidates,1);
 assert.deepEqual(evidence.publishedEvents.map(e=>e.publishedOutcome),
  ['reported_good','reported_good','reported_missed','reported_missed']);
 assert.equal(evidence.publishedEvents[0].distance,45);
 assert.equal(evidence.publishedEvents[2].distance,53);
 assert.equal(evidence.kickingFantasyScoreCertified,false);
 assert.doesNotMatch(JSON.stringify(evidence),/fantasyPoints/);
});
test('Published MSF defensive sacks and interceptions score as isolated, provisional components',()=>{
 const payload={teamgamelogs:[{team:{abbreviation:'GB'},game:{id:'G1'},
  stats:{tackles:{sacks:2},interceptions:{interceptions:1},fumbles:{fumOppRec:3}}}]};
 const evidence=auditTeamGameFeed(payload,'GB',own.scoring);
 assert.equal(evidence.teamFilterVerified,true);
 assert.equal(evidence.knownComponentCount,2);
 assert.deepEqual(evidence.observedComponents.map(x=>[x.category,x.value,x.points]),
  [['sack',2,2],['int',1,2]]);
 assert.equal(evidence.dstScoreCertified,false);
 assert.ok(evidence.exampleFieldPaths.some(x=>x.startsWith('fumbles.')));
 assert.ok(!evidence.observedComponents.some(x=>x.category==='fum_rec'));
});
test('Audit renders compact specialist evidence and verifies a single licensed game without guessed points',()=>{
 assert.match(core,/Kicker evidence · Weeks 1–6/);
 assert.match(core,/D\/ST source evidence/);
 assert.match(core,/model\.kickingPlayEvidence/);
 assert.match(core,/model\.auditTeamGameFeed\(source\.data\|\|\{\},team,s\.ownedRules\)/);
 assert.match(core,/Final kicker scoring not certified/);
 assert.match(core,/No final D\/ST fantasy score is certified/);
 assert.match(core,/\.filter\(x=>x\.week>=1&&x\.week<=6/);
});

test('PBP kicker events compute independent FFL kick-point subtotals without certifying scores',()=>{
 const descriptions=[
  '(12:16) 28-T.Smack 59 yard field goal is GOOD, Center-42-M.Orzech',
  '28-T.Smack extra point is No Good, Wide Right',
  '(1:42) 16-W.Reichard 38 yard field goal is GOOD',
  '(13:56) 28-T.Smack 43 yard field goal is GOOD',
  '16-W.Reichard extra point is GOOD',
  '28-T.Smack extra point is GOOD',
  '(5:12) 28-T.Smack 26 yard field goal is GOOD',
  '16-W.Reichard extra point is GOOD',
  '16-W.Reichard extra point is GOOD',
  '16-W.Reichard extra point is GOOD'
 ];
 const payload={gameplaybyplay:{plays:descriptions.map((description,i)=>({id:'event'+i,description,playStatus:{quarter:1}}))}};
 const a=kickingPlayEvidence(payload,own.scoring,[
  {id:'msf-a',name:'Terry Smack',team:'GB',jersey:'28',position:'K'},
  {id:'msf-b',name:'Will Reichard',team:'MIN',jersey:'16',position:'K'}
 ]);
 assert.equal(a.candidatePlays,10);
 assert.equal(a.kickers.find(x=>x.kickerToken==='28-T.Smack').observedSubtotal,12);
 assert.equal(a.kickers.find(x=>x.kickerToken==='16-W.Reichard').observedSubtotal,7);
 assert.equal(a.kickers.find(x=>x.kickerToken==='28-T.Smack').providerId,'msf-a');
 assert.equal(a.kickingFantasyScoreCertified,false);
 assert.ok(a.publishedEvents.every(x=>x.observedEventPoints!==null));
});
test('Kicker audit deduplicates native IDs and withholds unknown actor/distance credit',()=>{
 const payload={gameplaybyplay:{plays:[
  {id:'x1',description:'31-B.Kicker 65 yard field goal is GOOD'},
  {id:'x1',description:'31-B.Kicker 65 yard field goal is GOOD'},
  {id:'x2',description:'31-B.Kicker field goal is GOOD'},
  {description:'extra point is GOOD, Center-22-C.Long'},
  {description:'31-B.Kicker extra point is NO GOOD'}
 ]}};
 const a=kickingPlayEvidence(payload,own.scoring);
 assert.equal(a.candidatePlays,4);
 assert.equal(a.unattributedEvents,1);
 assert.equal(a.kickers[0].observedSubtotal,5);
 assert.equal(a.kickers[0].unknownEvents,1);
 assert.equal(a.kickers[0].providerId,null);
 assert.equal(a.kickingFantasyScoreCertified,false);
});
test('PFO kicker audit matches weekly MSF team player rows and shows separate six-week evidence',()=>{
 assert.match(core,/model\.playerRows\(weekly\.payload\)/);
 assert.match(core,/model\.kickingPlayEvidence\(response\.data\|\|\{\},s\.ownedRules,players\)/);
 assert.match(core,/model\.summarizeKickerWeeks\(report\.kickWeeks\|\|\[\],report\.team\)/);
 assert.match(core,/Kicker evidence · Weeks 1–6/);
 assert.match(core,/Opposing kickers and players without uniquely verified MSF identity/);
});

test('D/ST Weeks 1-6 scoring evidence distinguishes valid zero sacks from missing game',()=>{
 const make=(week,sack,ints)=>({week,evidence:auditTeamGameFeed({teamgamelogs:[{
  team:{abbreviation:'GB'},game:{id:'GB-'+week},stats:{tackles:{sacks:sack},interceptions:{interceptions:ints}}
 }]},'GB',own.scoring)});
 const r=summarizeDstWeeks([make(1,3,1),make(2,0,0),{week:3,error:'MSF 503'}],'GB');
 assert.equal(r.verifiedWeeks,2);
 assert.equal(r.weeks[0].observedSubtotal,5);
 assert.equal(r.weeks[1].observedSubtotal,0);
 assert.equal(r.weeks[2].observedSubtotal,null);
 assert.equal(r.weeks[2].sacks,null);
 assert.equal(r.finalDstCertified,false);
});
test('D/ST team mismatches and duplicate team games do not become certified points',()=>{
 const bad=auditTeamGameFeed({teamgamelogs:[{team:{abbreviation:'CAR'},stats:{tackles:{sacks:4}}}]},'GB',own.scoring);
 const dupe=auditTeamGameFeed({teamgamelogs:[
  {team:{abbreviation:'GB'},stats:{tackles:{sacks:2}}},
  {team:{abbreviation:'GB'},stats:{tackles:{sacks:2}}}
 ]},'GB',own.scoring);
 const r=summarizeDstWeeks([{week:1,evidence:bad},{week:2,evidence:dupe}],'GB');
 assert.equal(r.verifiedWeeks,0);
 assert.equal(r.weeks[0].observedSubtotal,null);
 assert.equal(r.weeks[1].observedSubtotal,null);
 assert.equal(r.weeks[1].status,'ambiguous_game_records');
});
test('Historical D/ST audit requests all six weeks and reports independent components only',()=>{
 assert.match(core,/for\(let week=2;week<=6;week\+\+\)/);
 assert.match(core,/model\.summarizeDstWeeks\(report\.teamWeeks\|\|\[\],report\.team\)/);
 assert.match(core,/full D\/ST score NOT certified/);
});

test('Kicker Weeks 1–6 attribution accepts only current-week GB name, jersey, team and MSF ID',()=>{
 const rows=playerRows({gamelogs:[{
  player:{id:802,fullName:'Terry Smack',jerseyNumber:28,primaryPosition:'K'},
  team:{abbreviation:'GB'},stats:{}
 }]});
 const descriptions=[
  '(12:16) 28-T.Smack 59 yard field goal is GOOD',
  '28-T.Smack extra point is NO GOOD',
  '16-W.Reichard 38 yard field goal is GOOD',
  '28-T.Smack extra point is GOOD'
 ];
 const pb={gameplaybyplay:{plays:descriptions.map((description,i)=>({
  id:'kick-'+i,description,playStatus:{quarter:1,secondsElapsed:i*80}}))}};
 const e=kickingPlayEvidence(pb,own.scoring,rows);
 const r=summarizeKickerWeeks([{week:3,game:'MIN @ GB',evidence:e},
  {week:4,game:'GB @ CHI',error:'MSF provider request failed'}],'GB');
 assert.equal(r.publishedFeeds,1);
 assert.equal(r.identityVerifiedWeeks,1);
 assert.equal(r.weeks[0].knownEvents,3);
 assert.equal(r.weeks[0].unverifiedEvents,1);
 assert.equal(r.weeks[0].observedPoints,5);
 assert.equal(r.players.length,1);
 assert.equal(r.players[0].providerId,'802');
 assert.equal(r.players[0].observedSubtotal,5);
 assert.equal(r.weeks[1].observedPoints,null);
 assert.equal(r.weeks[1].status,'feed_unverified');
 assert.equal(r.finalScoresCertified,false);
});
test('Kicker actor with matching name but wrong jersey or team remains unverified',()=>{
 const pb={gameplaybyplay:{plays:[
 {id:'1',description:'(5:00) 28-T.Smack 43 yard field goal is GOOD'}
 ]}};
 const wrong=playerRows({gamelogs:[{
 player:{id:10,fullName:'Terry Smack',jerseyNumber:99,primaryPosition:'K'},
 team:{abbreviation:'GB'},stats:{}
 },{
 player:{id:11,fullName:'Terry Smack',jerseyNumber:28,primaryPosition:'K'},
 team:{abbreviation:'MIN'},stats:{}
 }]});
 const e=kickingPlayEvidence(pb,own.scoring,wrong);
 const r=summarizeKickerWeeks([{week:1,evidence:e}],'GB');
 assert.equal(r.identityVerifiedWeeks,0);
 assert.equal(r.weeks[0].observedPoints,null);
 assert.equal(r.weeks[0].unverifiedEvents,1);
 assert.equal(r.finalScoresCertified,false);
});
test('Kicker historical audit checks at most one matching team game each week and never credits BYE or ambiguity as zero',()=>{
 assert.match(core,/for\(let week=1;week<=6;week\+\+\)/);
 assert.match(core,/matches\.length!==1/);
 assert.match(core,/Multiple matching schedule games; attribution withheld/);
 assert.match(core,/No scheduled MSF team game located/);
 assert.match(core,/report\.kickWeeks\.push/);
 assert.match(core,/Unknown, not zero/);
});

test('FFO MSF weekly kicker FG/XP play counts reconcile only with same game ID and independent team counts',()=>{
 const rows=playerRows({gamelogs:[{player:{id:802,fullName:'Terry Smack',jerseyNumber:28,primaryPosition:'K'},team:{abbreviation:'GB'},stats:{}}]});
 const pb={gameplaybyplay:{plays:[
  {id:'a',description:'28-T.Smack 59 yard field goal is GOOD'},
  {id:'b',description:'28-T.Smack extra point is NO GOOD'},
  {id:'c',description:'28-T.Smack 26 yard field goal is GOOD'},
  {id:'d',description:'28-T.Smack extra point is GOOD'}
 ]}};
 const evidence=kickingPlayEvidence(pb,own.scoring,rows);
 const team=auditTeamGameFeed({teamgamelogs:[{
  team:{abbreviation:'GB'},game:{id:'g1'},stats:{
   fieldGoals:{fgAtt:2,fgMade:2},extraPoints:{xpAtt:2,xpMade:1},
   tackles:{sacks:3},interceptions:{interceptions:1}
  }
 }]},'GB',own.scoring);
 assert.equal(team.kickingReference.fgAttempts,2);
 assert.equal(team.kickingReference.fgMade,2);
 assert.equal(team.kickingReference.xpAttempts,2);
 assert.equal(team.kickingReference.xpMade,1);
 const audit=reconcileKickerWeeks([{week:1,gameId:'g1',evidence}],
  [{week:1,evidence:team}],'GB');
 assert.equal(audit.matched,1);
 assert.equal(audit.discrepancies,0);
 assert.equal(audit.weeks[0].comparedCategories,4);
 assert.equal(audit.weeks[0].status,'four_counts_match');
 assert.deepEqual(audit.weeks[0].observedCounts,{fgAttempts:2,fgMade:2,xpAttempts:2,xpMade:1});
 assert.equal(audit.fullFantasyScoresCertified,false);
});
test('Kicker audit flags independently published FG disagreement, never silently overwrites it',()=>{
 const evidence=kickingPlayEvidence({gameplaybyplay:{plays:[{
  id:'p1',description:'28-T.Smack 43 yard field goal is GOOD'
 }]}},own.scoring,[{id:'802',name:'Terry Smack',jersey:'28',position:'K',team:'GB'}]);
 const team=auditTeamGameFeed({teamgamelogs:[{
  team:{abbreviation:'GB'},game:{id:'g1'},stats:{fieldGoals:{fgAtt:2,fgMade:1}}
 }]},'GB',own.scoring);
 const r=reconcileKickerWeeks([{week:1,gameId:'g1',evidence}],[{week:1,evidence:team}],'GB');
 assert.equal(r.discrepancies,1);
 assert.equal(r.weeks[0].status,'mismatch');
 assert.equal(r.weeks[0].comparedCategories,2);
 assert.deepEqual(r.weeks[0].disagreements,[{category:'fgAttempts',teamCount:2,pbpCount:1}]);
 assert.equal(r.fullFantasyScoresCertified,false);
});
test('Kicker reconciliation rejects mismatched game IDs, missing totals and missing week feeds',()=>{
 const evidence=kickingPlayEvidence({gameplaybyplay:{plays:[{id:'p1',description:'28-T.Smack extra point is GOOD'}]}},
  own.scoring,[{id:'802',name:'Terry Smack',jersey:'28',position:'K',team:'GB'}]);
 const ref=auditTeamGameFeed({teamgamelogs:[{
  team:{abbreviation:'GB'},game:{id:'g1'},stats:{extraPoints:{xpAtt:1,xpMade:1}}
 }]},'GB',own.scoring);
 const absent=auditTeamGameFeed({teamgamelogs:[{
  team:{abbreviation:'GB'},game:{id:'g3'},stats:{tackles:{sacks:2}}
 }]},'GB',own.scoring);
 const r=reconcileKickerWeeks([
  {week:1,gameId:'g2',evidence},
  {week:2,gameId:'g2',evidence},
  {week:3,gameId:'g3',evidence},
  {week:4,error:'MSF timeout'}],[
  {week:1,evidence:ref},{week:2,evidence:{teamFilterVerified:false}},
  {week:3,evidence:absent}], 'GB');
 assert.equal(r.matched,0);
 assert.equal(r.weeks[0].status,'unverified');
 assert.match(r.weeks[0].reason,/game ID differs/);
 assert.match(r.weeks[1].reason,/team kicking totals unavailable/);
 assert.match(r.weeks[2].reason,/counts not mapped/);
 assert.equal(r.weeks[3].status,'unverified');
 assert.equal(r.weeks[3].observedCounts,null);
});
test('FFO mobile scoring audit shows independent MSF crosscheck and no synthetic kicker certification',()=>{
 assert.match(core,/model\.reconcileKickerWeeks\(report\.kickWeeks\|\|\[\],report\.teamWeeks\|\|\[\],report\.team\)/);
 assert.match(core,/full count matches/);
 assert.match(core,/weeks needing count review/);
 assert.match(core,/model\.auditTeamGameFeed/);
 assert.match(core,/report\.kickWeeks\.push\(\{week,game,gameId:String\(g\.id\),evidence\}\)/);
 assert.match(core,/Final kicker scoring not certified/);
});

test('Historical stat audits reuse only successful source responses briefly; do not cache failures or change live GameCast polling',()=>{
 assert.match(core,/const auditSuccessCache=new Map\(\),AUDIT_REUSE_MS=300000/);
 assert.match(core,/if\(prior&&Date\.now\(\)-prior\.at<AUDIT_REUSE_MS\)/);
 assert.match(core,/if\(permitted&&result\?\.available!==false\)/);
 assert.match(core,/while\(auditSuccessCache\.size>28\)/);
 assert.match(core,/for\(let attempt=1;attempt<=2;attempt\+\+\)/);
 assert.match(core,/await auditPause\(3600\)/);
 assert.match(core,/name==='plays'\|\|name==='boxscore'\?9000/);
});
test('Kicker crosschecks expose exact mismatched counts and unresolved identity, never imply certification',()=>{
 const unverified={gameplaybyplay:{plays:[
  {id:'a',description:'28-T.Smack 43 yard field goal is GOOD'},
  {id:'b',description:'16-W.Reichard 38 yard field goal is GOOD'},
  {id:'c',description:'unassigned field goal is GOOD'}
 ]}};
 const pb=kickingPlayEvidence(unverified,own.scoring,[
  {id:'802',name:'Terry Smack',jersey:'28',position:'K',team:'GB'}
 ]);
 const ref=auditTeamGameFeed({teamgamelogs:[{team:{abbreviation:'GB'},game:{id:'g1'},
   stats:{fieldGoals:{fgAtt:2,fgMade:2}}}]},'GB',own.scoring);
 const result=reconcileKickerWeeks([{week:1,gameId:'g1',evidence:pb}],
  [{week:1,evidence:ref}],'GB');
 assert.equal(result.discrepancies,1);
 assert.equal(result.unverified,0);
 assert.ok(result.weeks[0].unresolvedActorTokens.includes('16-W.Reichard'));
 assert.ok(result.weeks[0].unattributedPlays>0);
 assert.equal(result.weeks[0].disagreements[0].category,'fgAttempts');
 assert.equal(result.fullFantasyScoresCertified,false);
 assert.match(core,/Disagreement:/);
 assert.match(core,/Unresolved actors:/);
});

test('Kicker discrepancy is visible and expanded on narrow mobile GameCast',()=>{
 assert.match(core,/needsReview\?'open '/);
 assert.match(core,/CHECK COUNTS/);
 assert.match(core,/Reconciliation needs review:/);
 assert.match(core,/Team\/PBP evidence:/);
 assert.match(core,/published team FG\/XP categories reconcile/);
 assert.match(core,/weeks needing count review/);
});
