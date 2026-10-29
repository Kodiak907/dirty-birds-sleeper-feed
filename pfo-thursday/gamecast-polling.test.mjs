import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldPollGameLive,retainPublishedPlays} from './ffo-gamecast-model.mjs';

const kickoff=Date.parse('2026-10-30T00:15:00Z');
const scheduled={start:'2026-10-30T00:15:00Z',status:'Unplayed'};
test('PFO polls promptly even if source still says scheduled at kickoff',()=>{
 for(const status of ['Scheduled','Not Started','Unplayed','Pregame','Created']){
  const game={...scheduled,status};
  assert.equal(shouldPollGameLive(game,kickoff-1),false,status+' before kickoff');
  assert.equal(shouldPollGameLive(game,kickoff),true,status+' at kickoff');
  assert.equal(shouldPollGameLive(game,kickoff+20_000),true,status+' 20s after kickoff');
 }
});
test('terminal games do not poll at live cadence',()=>{
 for(const status of ['Final','Completed','Postponed','Cancelled','Suspended']){
  assert.equal(shouldPollGameLive({...scheduled,status},kickoff+60_000),false,status);
 }
});
test('explicit in-progress statuses receive fast refresh, late windows end',()=>{
 assert.equal(shouldPollGameLive({status:'Live',start:'invalid'},kickoff),true);
 assert.equal(shouldPollGameLive({...scheduled,status:'Scheduled'},kickoff+7*3600_000),false);
 assert.equal(shouldPollGameLive({...scheduled,status:'Scheduled'},kickoff-600_000),false);
});
test('provider transient empty responses do not erase published plays',()=>{
 const prior=[{id:'play-1',text:'run',period:1,update:'new'}];
 assert.deepEqual(retainPublishedPlays(prior,[]),prior);
 assert.deepEqual(retainPublishedPlays(prior,null),prior);
 const corrected=retainPublishedPlays(prior,[{id:'play-1',text:'run corrected',period:1},{id:'play-2',text:'pass',period:1}]);
 assert.equal(corrected.length,2);
 assert.equal(corrected[0].update,'corrected');
 assert.equal(corrected[1].update,'new');
});
test('live PFO browser has 20s polling, duplicate request guard and no HTTP cache',()=>{
 const src=readFileSync(new URL('./ffo-gamecast.js',import.meta.url),'utf8');
 assert.match(src,/const refreshMs=likelyLive\?20000:120000/);
 assert.match(src,/model\.shouldPollGameLive\(game,now\)/);
 assert.match(src,/gamePending\)return gamePending/);
 assert.match(src,/s\.lastGamePoll=Date\.now\(\)/);
 assert.match(src,/Live plays and boxscores are NEVER cached/);
 assert.match(src,/cache:'no-store'/);
 assert.match(src,/visibilitychange/);
 assert.match(src,/model\.retainPublishedPlays/);
});
