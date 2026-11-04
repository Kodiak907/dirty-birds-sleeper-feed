import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const script=read('./ffo-availability-62.js');
const ctx=createContext({window:{},Date,Array,RegExp,Object,String,Number});
new Script(script).runInContext(ctx);
const classify=ctx.window.ffoAvailability62.classify;
const now=Date.parse('2026-11-04T21:00:00Z');
test('Dated Ravens and Eagles evidence keeps long-term absences off standard waiver boards',()=>{
 for(const p of [{id:'4881',name:'Lamar Jackson',injury_status:'Questionable',status:'Active'},
  {id:'6904',name:'Jalen Hurts',injury_status:'IR',status:'Inactive'}]){
  const x=classify(p,[],now);
  assert.equal(x.standardEligible,false);
  assert.equal(x.irTabEligible,true);
  assert.match(x.sourceUrl,/^https:\/\//);
  assert.ok(Date.parse(x.sourceDate)<now);
 }
});
test('Official club activation after a stale IR tag restores normal position research without asserting active on Sunday',()=>{
 const x=classify({id:'13345',name:'Jonah Coleman',team:'DEN',injury_status:'IR'},
 [{name:'Jonah Coleman',team:'DEN',date:'2026-10-24',action_code:'ACTIVATED_FROM_IR',
 source_url:'https://www.denverbroncos.com/news/example',source:'Denver Broncos'}],now);
 assert.equal(x.standardEligible,true);
 assert.equal(x.irTabEligible,false);
 assert.match(x.reason,/not game-day clearance/);
});
test('Official 21-day return window is time bounded and cannot be replaced by an unrelated old report',()=>{
 const profile={id:'601',name:'Reserve RB',position:'RB',injury_status:'IR'};
 const action={name:'Reserve RB',date:'2026-10-30',action_code:'PRACTICE_WINDOW_OPEN',
  source_url:'https://www.nfl.com/news/practice-window'};
 assert.equal(classify(profile,[action],now).standardEligible,true);
 const old=classify(profile,[{...action,date:'2026-09-01'}],now);
 assert.equal(old.irTabEligible,true);
 const bogus=classify({...profile,verified_practice_window:{verified:false,
  opened_at:'2026-11-03',source_url:action.source_url}},[],now);
 assert.equal(bogus.irTabEligible,true);
});
test('Overview removes duplicate tracker and news cards and retains standings, record, GameCast, News and Injury pages',()=>{
 const html=read('./index.html'),page=html.split('<section class="page active" id="overview">')[1].split('<section class="page" id="roster">')[0];
 assert.doesNotMatch(page,/pfo51-livecard|Game Tracker · Scores|pfo50-gameday|pfo51-changes-card/);
 assert.match(page,/id="league-standings"/);
 assert.match(html,/id="gamecast"/);
 assert.match(html,/id="availability"/);
 assert.match(read('./ffo-pfo-59.js'),/Club &amp; Role Updates/);
 assert.match(read('./ffo-pfo-59.js'),/id="pfo51-changes"/);
 assert.match(html,/ffo-availability-62\.js/);
 assert.match(html,/ffo-overview-62\.js/);
});
test('New brief has no hardcoded trade block or legacy third-party scoreboard',()=>{
 const text=read('./ffo-overview-62.js');
 assert.doesNotMatch(text,/Garrett Wilson|ESPN scoreboard|Coleman|Charbonnet/);
 assert.match(text,/Front Office/);
 assert.match(text,/Model coverage/);
 assert.match(text,/Source dates/);
});
