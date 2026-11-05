import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
const get=x=>readFileSync(new URL('./'+x,import.meta.url),'utf8');
const core=get('ffo-pfo-core.js'),market=get('ffo-pfo-59.js'),gamecast=get('ffo-gamecast.js'),index=get('index.html');
test('TE search includes independently sourced season rows even with no weekly game logs',()=>{
 const a=core.indexOf('function pfo51FindPlayers(q)'),b=core.indexOf('function pfo51Ask(q)',a);
 assert.ok(a>=0&&b>a);
 const ctx=createContext({pfo49Players:[{id:'te1',name:'Tight End One',position:'TE',team:'NYG'},{id:'te2',name:'Tight End Two',position:'TE',team:'SEA'}],
  pfo49Dir:()=>[],liveRosterSnapshot:{players:[]},leagueOwnedIds:new Set(),ownershipCheckedMs:Date.now(),
  waiverIsRostered:()=>false,
  pfo51PlayerSummary:id=>({id,week:0,row:{season_totals:{rec:21},games:[]},forecast:id==='te1'?9.7:8.8,finalPts:null,p:{position:'TE',team:'SEA'}}),
  pfo49Signal:()=>null});
 new Script(core.slice(a,b)+'\nthis.search=pfo51FindPlayers;').runInContext(ctx);
 const found=ctx.search('find me better tight ends');
 assert.equal(found.pos,'TE');
 assert.equal(found.total,2);
 const missing=ctx.search('find me tight ends whose targets rose in last 3 weeks');
 assert.equal(missing.total,0,'no trend inferred from season totals');
});
test('market and matchup use the same independently calculated week points or both withhold',()=>{
 const a=market.indexOf('function scoreInfo(p)'),b=market.indexOf('function playerRow(p',a);
 assert.ok(a>0&&b>a);
 const ctx=createContext({console,window:{dbNflWeek:9},pfo52Cur:()=>9,
  pfo50StatsFor:()=>({season_totals:{rush_yd:430}}),
  pfo52Points:(id,week)=>({points:week===9?15.5:null,source:'FFO independent MSF'})});
 new Script(market.slice(a,b)+'\nthis.scoreInfo=scoreInfo;').runInContext(ctx);
 assert.equal(ctx.scoreInfo({id:'kyren',name:'Kyren Williams'}).project,15.5);
 ctx.pfo52Points=()=>({points:null,source:'no independently matched stats'});
 assert.equal(ctx.scoreInfo({id:'kyren',name:'Kyren Williams'}).project,null);
 assert.equal(ctx.scoreInfo({id:'kyren'}).season.rush_yd,430);
});
test('current-week Sleeper pre-kickoff zero is not a certified result',()=>{
 const a=core.indexOf('function pfo49GameTable(id)'),b=core.indexOf('function pfo49ComparePanel',a);
 assert.ok(a>0&&b>a);
 assert.match(core.slice(a,b),/league\.points===0&&!game/);
 assert.match(core.slice(a,b),/Pregame \/ provisional/);
 assert.match(core.slice(a,b),/kind=done\?'Final league score'/);
});
test('GameCast player card shows position relevant statistics instead of QB zeros for WRs',()=>{
 assert.match(gamecast,/position==='RB'/);
 assert.match(gamecast,/\['WR','TE'\]\.includes\(position\)/);
 assert.match(gamecast,/position==='K'/);
 assert.match(gamecast,/position==='DEF'/);
 assert.match(gamecast,/seasonTags=fields\.filter/);
 assert.match(gamecast,/MySportsFeeds seasonal NFL statistics/);
});
test('injury status distinguishes unconfirmed ESPN report from NFL designation',()=>{
 assert.match(core,/ESPN reported /);
 assert.match(core,/not NFL-confirmed/);
 assert.match(core,/o&&game\?\(game\+' · NFL'\)/);
});
test('old trading worksheet kept accessible but collapsed by default',()=>{
 const js=get('ffo-pfo-613.js');
 assert.match(index,/ffo-pfo-613\.js\?v=613/);
 assert.match(index,/ffo-pfo-613\.css\?v=613/);
 assert.match(js,/document\.createElement\('details'\)/);
 assert.match(js,/section\.append\(existing\)/);
 assert.doesNotMatch(js,/section\.open\s*=\s*true/);
 new Script(js);
});
test('modified scripts are valid and source-isolated',()=>{
 new Script(market,{filename:'ffo-pfo-59.js'});
 new Script(gamecast,{filename:'ffo-gamecast.js'});
 new Script(core,{filename:'ffo-pfo-core.js'});
});