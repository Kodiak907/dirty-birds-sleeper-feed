import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
let server,browser,page,offsite=[];
test.before(async()=>{
 const files=['index.html','showcase.js','showcase.css','sample-rosters.json',
  'ffo-pfo-core.css','ffo-pfo-59.css','ffo-mobile-594.css','ffo-pfo-596.css','ffo-pfo-597.css','ffo-layout-64.css',
  'ffo-trade-decision-60.mjs','ffo-market-finder-61.mjs'];
 const fileSet=new Set(files);
 server=createServer((req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname.slice(1)||'index.html';
  if(!fileSet.has(path)){res.writeHead(404);res.end('not found');return;}
  const name=['index.html','showcase.js','showcase.css','sample-rosters.json'].includes(path)?
   '../pfo-league-showcase/'+path:'../pfo-thursday/'+path;
  const ext=path.split('.').at(-1),mime=ext==='mjs'||ext==='js'?'text/javascript':ext==='css'?'text/css':ext==='json'?'application/json':'text/html';
  res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});
  res.end(readFileSync(new URL(name,import.meta.url)));
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=await chromium.launch({headless:true});
 page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:')&&!r.url().startsWith('https://sleepercdn.com/content/nfl/players/thumb/'))offsite.push(r.url())});
 await page.route('https://sleepercdn.com/**',route=>route.fulfill({status:404,body:''}));
 page.on('pageerror',e=>offsite.push('JS ERROR '+e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
});
test.after(async()=>{await browser?.close();await new Promise(ok=>server?.close(ok))});
test('loads original PFO interface and real-player sample team without private calls',async()=>{
 assert.match(await page.title(),/PFO/);
 assert.match(await page.locator('#demo-briefing').innerText(),/The Front Office Collective/);
 assert.equal((await page.locator('#nav button').count()),13);
 assert.ok(await page.locator('#demo-all-tools').isVisible());
 assert.deepEqual(offsite,[]);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 assert.ok(overflow<=3,'horizontal overflow '+overflow);
});
test('Team HQ renders 10 starters, real players, 7 bench forecasts',async()=>{
 await page.locator('#demo-mobile-nav [data-go=roster]').click();
 assert.equal(await page.locator('#demo-starters tr').count(),10);
 assert.match(await page.locator('#demo-starters').innerText(),/Josh Allen/);
 assert.match(await page.locator('#demo-starters').innerText(),/Puka Nacua/);
 assert.match(await page.locator('#demo-bench').innerText(),/Lamar Jackson/);
 assert.match(await page.locator('#demo-team-total').innerText(),/Best projected/);
 const before=await page.locator('#demo-starters').innerText();
 await page.locator('[data-teamview=best]').click();
 assert.notEqual(await page.locator('#demo-starters').innerText(),before,'Best Projected must change actual selected starters');
 assert.equal(await page.locator('#demo-starters tr').count(),10);
});
test('Weekly Matchup has both 10-man lineups and bench cards',async()=>{
 await page.locator('#demo-mobile-nav [data-go=matchup]').click();
 assert.equal(await page.locator('.pfo-demo-matchgrid article').count(),2);
 assert.equal(await page.locator('.pfo-demo-compact-player').count(),20);
 await page.locator('[data-matchview=best]').click();
 assert.match(await page.locator('#demo-matchup').innerText(),/OPTIMAL/);
 await page.locator('[data-matchmode=startsit]').click();
 assert.match(await page.locator('#demo-matchup').innerText(),/Start \/ Sit Decision Desk/);
 const b=await page.locator('.pfo-demo-versus').innerText();
 await page.locator('#demo-start-a').selectOption({index:2});
 assert.notEqual(await page.locator('.pfo-demo-versus').innerText(),b);

 await page.locator('[data-matchmode=lab]').click();
 assert.match(await page.locator('#demo-matchup').innerText(),/Interactive Lineup Lab/);
 await page.locator('[data-lab-best]').click();
 assert.match(await page.locator('#demo-matchup').innerText(),/Best legal projection/);
});
test('real PFO trade model compares hypothetical two-sided trade',async()=>{
 await page.locator('#demo-mobile-nav [data-go=market]').click();
 await page.locator('[data-trade=give][data-index="0"]').selectOption({index:1});
 await page.locator('[data-trade=take][data-index="0"]').selectOption({index:1});
 assert.match(await page.locator('#demo-market').innerText(),/FFO 6.0 Trade Intelligence/);
 assert.match(await page.locator('#demo-market').innerText(),/Our lineup impact/);
});
test('PFO waiver lab calls real comparison logic with sample player',async()=>{
 await page.locator('[data-marketmode=waiver]').click();
 await page.locator('#demo-waiver-add').selectOption({index:1});
 await page.locator('#demo-waiver-drop').selectOption({index:1});
 assert.match(await page.locator('#demo-market').innerText(),/FFO modeled lineup impact/);
 await page.locator('[data-demo-claim]').click();
 await page.locator('#demo-mobile-nav [data-go=roster]').click();
 assert.match(await page.locator('#demo-bench').innerText(),/Patrick Mahomes/);
});
test('player intelligence, opportunity radar and GameCast can be explored',async()=>{
 await page.locator('#demo-all-tools').click();
 await page.locator('#demo-tools-drawer [data-go=playerhub]').click();
 await page.locator('#demo-player-search').fill('CeeDee');
 assert.match(await page.locator('#demo-player-results').innerText(),/CeeDee Lamb/);
 await page.locator('#demo-all-tools').click();
 await page.locator('#demo-tools-drawer [data-go=radar]').click();
 assert.ok(await page.locator('#demo-radar article').count()>2);
 await page.locator('#demo-mobile-nav [data-go=gamecast]').click();
 await page.locator('[data-next-play]').click();
 assert.match(await page.locator('#demo-gamecast').innerText(),/Play 2/);
 assert.deepEqual(offsite,[]);
});

test('Coaching Review logs real interactive example decisions and can clear them',async()=>{
 await page.locator('#demo-all-tools').click();
 await page.locator('#demo-tools-drawer [data-go=coaching]').click();
 assert.match(await page.locator('#demo-coaching').innerText(),/No decisions logged/);
 await page.locator('[data-coach-go]').click();
 await page.locator('[data-demo-decision=a]').click();
 assert.match(await page.locator('#demo-matchup').innerText(),/Sample decision saved/);
 await page.locator('#demo-all-tools').click();
 await page.locator('#demo-tools-drawer [data-go=coaching]').click();
 assert.match(await page.locator('#demo-coaching').innerText(),/Demo start\/sit calls/);
 assert.equal(await page.locator('#demo-coaching .pfo-demo-cardlist article').count(),1);
 await page.locator('[data-clear-coach]').click();
 assert.equal(await page.locator('#demo-coaching .pfo-demo-cardlist article').count(),0);
});
test('Championship lab calculates 100,000 illustrative draws and responds to controls',async()=>{
 await page.locator('#demo-all-tools').click();
 await page.locator('#demo-tools-drawer [data-go=championship]').click();
 assert.match(await page.locator('#demo-championship').innerText(),/100,000 simulated scenarios/);
 assert.equal(await page.locator('#demo-championship .pfo-demo-odds-item').count(),3);
 const before=(await page.locator('#demo-championship .pfo-demo-odds-item').allInnerTexts()).join('|');
 await page.locator('#demo-sim-strength').selectOption('20');
 const after=(await page.locator('#demo-championship .pfo-demo-odds-item').allInnerTexts()).join('|');
 assert.notEqual(before,after,'changing opponent strength should modify chances');
});
