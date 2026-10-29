// FFO 5.9.6: isolated regression fixture, never connects to Sleeper writes or Commissioner.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const core=read('./ffo-pfo-core.js'),market=read('./ffo-pfo-59.js'),news=read('./ffo-pfo-596.js'),html=read('./index.html'),css=read('./ffo-pfo-596.css');
test('5.9.6 scripts parse and are wired into preview',()=>{
 for(const [n,src] of Object.entries({core,market,news}))assert.doesNotThrow(()=>new Script(src,{filename:n}),n);
 assert.match(html,/ffo-pfo-596\.js\?v=596/);
 assert.match(html,/ffo-pfo-596\.css\?v=596/);
 assert.match(html,/5\.9\.7 COACH REVIEW — DEVELOPMENT/);
 assert.match(css,/#overview \.pfo49-quicklinks/);
});
test('Trade stays incremental; heavy legacy only renders when expanded',()=>{
 assert.match(market,/tradeEstimateCache=new Map/);
 assert.match(market,/mark\.textContent=chosen\?'✓':'\+'/);
 assert.match(market,/tradeFold\.addEventListener\('toggle'/);
 assert.match(core,/Legacy Trade Laboratory is expensive/);
 assert.doesNotMatch(market,/x\.opponent=id;x\.take=\[\];x\.give=\[\];tb45Save\(\)/);
 assert.match(market,/x\.opponent=state\.manager;x\.give=\[\.\.\.state\.tradeGive\]/);
});
test('Week forecasts distinguish verified bye, unknown forecast and no inferred playoff bench',()=>{
 assert.match(core,/proj\?\.bye\?'BYE':pfo52PointLabel\(val\)/);
 assert.match(core,/v\?\.bye\?'BYE'/);
 assert.match(core,/h\+=members\.map\(statrow\)\.join\(''\)/);
 assert.doesNotMatch(core,/Bench & reserve playoff projections/);
 assert.match(news,/VERIFIED NFL BYE WEEK/);
});
test('Roster news is actual source articles/actions, not tool shortcut buttons',()=>{
 assert.match(news,/NFL_ROSTER_ACTIONS\.json/);
 assert.match(news,/football\/nfl\/news\?limit=100/);
 assert.match(news,/p\.name/);
 assert.match(news,/Read source/);
 assert.doesNotMatch(market,/data-pfo59-team-page="scouting"/);
 assert.match(news,/national news feed/);
});
test('Dated article matching stays on current roster; source links and safe bye overrides',async()=>{
 const host={innerHTML:'',closest:()=>null};
 const doc={readyState:'loading',addEventListener(){},contains:()=>true,getElementById:()=>null,querySelector:()=>null};
 const ctx=createContext({
  document:doc,window:{dbNflWeek:8},console,setTimeout:()=>{},
  URL,Date,
  liveRosterSnapshot:{checked_at:'2026-10-28T20:00:00Z',players:[{player_id:'og',name:'Ollie Gordon II',team:'MIA',position:'RB'},{player_id:'ck',name:'Christian Kirk',team:'SF',position:'WR'}]},
  pfo52Info:(id)=>({team:id==='og'?'MIA':'SF',name:id==='og'?'Ollie Gordon II':'Christian Kirk'}),
  pfo52Points:()=>({points:12.5,source:'model'}),
  fetch:async()=>({ok:true,json:async()=>({articles:[
   {id:'1',headline:'Ollie Gordon II workload update',description:'Ollie Gordon II increased touches',published:'2026-10-28T20:00:00Z',links:{web:{href:'https://www.espn.com/nfl/story/ollie'}}},
   {id:'2',headline:'Unknown player unrelated report',description:'Other teams',published:'2026-10-28T20:00:00Z',links:{web:{href:'https://www.espn.com/nfl/story/else'}}}
  ]})}),
  fetchReport:async path=>path==='NFL_ROSTER_ACTIONS.json'?{records:[{name:'Christian Kirk',description:'Activated from IR',date:'2026-10-24',source_url:'https://www.49ers.com/news/confirmed',source:'49ers'}]}:{as_of:'2026-10-28T20:00:00Z',teams:{MIA:{weeks:{8:{bye:true}}},SF:{weeks:{8:{opponent:'LAR'}}}}}
 });
 new Script(news).runInContext(ctx);
 ctx.window.ffoPfoNews596.render(host);
 for(let i=0;i<20;i++)await Promise.resolve();
 assert.match(host.innerHTML,/Ollie Gordon II workload update/);
 assert.match(host.innerHTML,/Christian Kirk/);
 assert.match(host.innerHTML,/Read source/);
 assert.doesNotMatch(host.innerHTML,/Unknown player unrelated report/);
 assert.equal(ctx.pfo52Points('og',8).bye,true);
 assert.equal(ctx.pfo52Points('og',8).points,null);
 assert.equal(ctx.pfo52Points('ck',8).points,12.5);
});
