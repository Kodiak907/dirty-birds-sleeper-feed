import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const core=read('./ffo-pfo-core.js'),html=read('./index.html'),layout=read('./ffo-layout-64.js');
test('PFO 6.4 modules parse and bind to the existing Matchup and Market views',()=>{
 assert.doesNotThrow(()=>new Script(layout));
 assert.doesNotThrow(()=>new Script(core));
 assert.match(html,/ffo-layout-64\.js\?v=640/);
 assert.match(html,/ffo-layout-64\.css\?v=640/);
});
test('Bench details are in each starter panel, full roster duplicate removed',()=>{
 assert.match(core,/function pfo64BenchMenu\(/);
 assert.match(core,/matchupColumns\[0\]\?\.insertAdjacentHTML\('beforeend',pfo64BenchMenu\(ours,w,past\)\)/);
 assert.match(core,/matchupColumns\[1\]\?\.insertAdjacentHTML\('beforeend',pfo64BenchMenu\(opp,w,past\)\)/);
 assert.doesNotMatch(core,/h\+='\<\/section\>\<div class="pfo52-duel"\>\<article\>'\+pfo52RosterCard/);
 assert.match(core,/const pfo53OriginalRenderMatch=pfo52Render/);
 assert.match(core,/pfo52Scenarios\.map/);
 assert.match(core,/data-pfo53-mode="submitted"/);
});
test('Matchup tabs preserve three distinct tools and Trade Finder opens existing analyzer',()=>{
 assert.match(layout,/Starters & projections/);
 assert.match(layout,/Start \/ Sit/);
 assert.match(layout,/Lineup Lab/);
 assert.match(layout,/Trade Finder/);
 assert.match(layout,/Trade Analyzer/);
 assert.match(layout,/data-pfo61-review/);
 assert.match(layout,/setTrade\('lab'\)/);
 assert.doesNotMatch(layout,/fetch\(|localStorage\.setItem|Sleeper|submitTrade/);
});

test('Waiver tabs preserve existing researched pickups and manual player discovery independently',()=>{
 const ui=read('./ffo-layout-64.js'),css=read('./ffo-layout-64.css');
 assert.match(ui,/Suggested Pickups/);
 assert.match(ui,/Find Your Own/);
 assert.match(ui,/function setWaiver/);
 assert.match(css,/data-pfo65-waiver="manual"/);
 assert.match(css,/data-pfo65-waiver="suggested"/);
 assert.match(css,/pfo59-waiver-board/);
 assert.match(css,/pfo61-waiver-research/);
});
