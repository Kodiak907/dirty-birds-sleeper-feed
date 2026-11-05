import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {join,extname} from 'node:path';
import {chromium} from 'playwright';
const dir='demo-exact-dist';
let server,browser,page,errors=[];
test.before(async()=>{
 const gateway=(await import('../demo-exact-dist/_worker.js')).default;
 const makeAsset=async request=>{
  const path=new URL(request.url).pathname;
  const local=join(dir,decodeURIComponent(path).replace(/^\/+/,'' )||'index.html');
  if(!local.startsWith(dir+'/')&&!local.startsWith(dir+'\\'))return new Response('not found',{status:404});
  if(!existsSync(local))return new Response('not found',{status:404});
  const ext=extname(local);
  const mime=ext==='.css'?'text/css':ext==='.js'||ext==='.mjs'?'text/javascript':ext==='.json'?'application/json':'text/html';
  return new Response(readFileSync(local),{headers:{'content-type':mime}});
 };
 const env={ASSETS:{fetch:makeAsset}};
 server=createServer(async(req,res)=>{
  try{
   const full='http://127.0.0.1:'+server.address().port+req.url,u=new URL(full);
   const route=u.pathname;
   // Public independent NFL research is never needed to verify local demo isolation.
   // Prevent network calls in CI; genuine worker read-only paths are separately preserved.
   if(/^\/api\/(nfl-official|independent-stats|season-schedule|player-news|target-share|game-plays|nfl-week|player-health|gameday-news|nfl-transactions|injuries)$/.test(route)){
    res.writeHead(503,{'content-type':'application/json'});
    res.end(JSON.stringify({available:false,error:'external_provider_disabled_in_isolated_browser_QA'}));return;
   }
   const response=await gateway.fetch(new Request(full,{method:req.method}),env);
   res.writeHead(response.status,Object.fromEntries(response.headers));
   res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){res.writeHead(500,{'content-type':'text/plain'});res.end(String(e))}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e.message)));
 await page.route(/^https:\/\//,route=>route.fulfill({status:404,body:'',headers:{'content-type':'text/plain'}}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
});
test.after(async()=>{await browser?.close();await new Promise(ok=>server?.close(ok))});
test('exact original PFO design and every nav tab visible on smartphone',async()=>{
 assert.match(await page.title(),/PFO.*Demo/i);
 assert.equal(await page.locator('#nav button[data-page]').count(),14);
 assert.ok(await page.locator('#nav [data-page=commissioner]').count()===1);
 assert.match(await page.locator('header.header').innerText(),/FRONT OFFICE/);
 assert.match(await page.locator('#pfo-exact-demo-label').innerText(),/SAMPLE LEAGUE/);
 assert.ok(await page.locator('link[href*="ffo-pfo-core.css"]').count()>0);
});
test('real original Roster page binds the synthetic Josh Allen sample team',async()=>{
 await page.evaluate(()=>document.querySelector('#nav button[data-page=roster]')?.click());
 await page.locator('#actual-lineup').getByText('Josh Allen').first().waitFor({timeout:18000});
 assert.match(await page.locator('#roster').innerText(),/The Front Office Collective/);
 assert.match(await page.locator('#actual-lineup').innerText(),/Josh Allen/);
 assert.match(await page.locator('#actual-bench').textContent(),/Lamar Jackson/);
});
test('public APIs never expose real league/commissioner data',async()=>{
 const result=await page.evaluate(async()=>{
  const [roster,commissioner,realLeague,stats]=await Promise.all([
   fetch('/api/roster?league_id=1399157532559192064&roster_id=1'),
   fetch('/api/commissioner/cases'),
   fetch('/demo-sleeper/v1/league/1399157532559192064/rosters'),
   fetch('/api/ffo/stats/season')]);
  const x=await roster.json(),j=await stats.json();
  return {roster:x,commissioner:commissioner.status,realLeague:realLeague.status,source:j.source,count:j.players?.length};
 });
 assert.equal(result.roster.roster_id,1);
 assert.equal(result.roster.league_id,'2222222222222222222');
 assert.equal(result.commissioner,403);
 assert.equal(result.realLeague,403);
 assert.equal(result.source,'PFO DEMO');
 assert.ok(result.count>=100);
});
test('weekly matchup and market are original navigable PFO workspaces',async()=>{
 await page.evaluate(()=>document.querySelector('#nav button[data-page=matchup]')?.click());
 assert.match(await page.locator('#matchup').innerText(),/Weekly Matchup Command Center/);
 await page.evaluate(()=>document.querySelector('#nav button[data-page=market]')?.click());
 assert.match(await page.locator('#market').innerText(),/Trade|Waiver/);
 await page.evaluate(()=>document.querySelector('#nav button[data-page=commissioner]')?.click());
 assert.match(await page.locator('#commissioner').innerText(),/COMMISSIONER SYSTEM LOCKED/);
});

test('original PFO best-projected lineup is an operating switch, not a dead demo label',async()=>{
 await page.evaluate(()=>document.querySelector('#nav [data-page="matchup"]')?.click());
 await page.locator('[data-pfo53-mode="optimal"]').first().waitFor({timeout:22000});
 await page.locator('[data-pfo53-mode="optimal"]').first().click();
 await page.waitForTimeout(150);
 assert.equal(await page.locator('[data-pfo53-mode="optimal"]').first().getAttribute('aria-pressed'),'true');
 assert.match(await page.locator('#matchup').innerText(),/Best projected/i);
 await page.locator('[data-pfo53-mode="submitted"]').first().click();
 assert.equal(await page.locator('[data-pfo53-mode="submitted"]').first().getAttribute('aria-pressed'),'true');
});
test('original PFO Start/Sit compares two real NFL names from sample team',async()=>{
 await page.evaluate(()=>document.querySelector('#nav [data-page="matchup"]')?.click());
 await page.locator('[data-pfo64-switch="matchup"][data-pfo64-value="startsit"]').click();
 await page.locator('#pfo63-startsit [data-pfo63-compare="first"]').waitFor({timeout:16000});
 assert.equal(await page.locator('#pfo63-startsit select[data-pfo63-compare]').count(),2);
 await page.locator('#pfo63-startsit #pfo66-compare-output .pfo63-compare-players').waitFor({timeout:12000});
 const first=await page.locator('#pfo66-compare-output').innerText();
 assert.match(first,/Josh Allen|Jahmyr Gibbs|Puka Nacua|Lamar Jackson/);
 const selector=page.locator('#pfo63-startsit [data-pfo63-compare="second"]');
 await selector.selectOption({index:2});
 await page.locator('#pfo63-startsit #pfo66-compare-output .pfo63-compare-players').waitFor({timeout:12000});
 assert.match(await page.locator('#pfo66-compare-output').innerText(),/FFL baseline/i);
});
test('original PFO Trade Command opens a DIFFERENT demo manager roster',async()=>{
 await page.evaluate(()=>document.querySelector('#nav [data-page="market"]')?.click());
 await page.locator('[data-pfo59-market="trade"]').first().click();
 await page.locator('[data-pfo64-switch="trade"][data-pfo64-value="lab"]').first().click();
 await page.locator('#pfo59-trade-board [data-pfo59-partner="2"]').waitFor({timeout:20000});
 await page.locator('#pfo59-trade-board [data-pfo59-partner="2"]').click();
 const give=page.locator('#pfo59-trade-board [data-pfo59-side="give"]');
 const take=page.locator('#pfo59-trade-board [data-pfo59-side="take"]');
 assert.ok(await give.count()>=10);
 assert.ok(await take.count()>=10);
 await give.first().click();
 await take.first().click();
 const btn=page.locator('#pfo59-trade-board [data-pfo59-compare]');
 assert.equal(await btn.isDisabled(),false);
 await btn.click();
 assert.match(await page.locator('#pfo59-trade-board').innerText(),/FFO|model|projected|analysis/i);
});

test('best projected mode is interactive on the ACTUAL PFO weekly matchup',async()=>{
 await page.evaluate(()=>document.querySelector('#nav button[data-page=matchup]')?.click());
 await page.locator('#matchup [data-pfo53-mode=optimal]').first().waitFor({timeout:16000});
 await page.evaluate(()=>document.querySelector('#matchup [data-pfo53-mode=optimal]').click());
 assert.equal(await page.locator('#matchup [data-pfo53-mode=optimal]').getAttribute('aria-pressed'),'true');
 assert.match(await page.locator('#matchup').innerText(),/Best projected/i);
 await page.evaluate(()=>document.querySelector('#matchup [data-pfo53-mode=submitted]').click());
 assert.equal(await page.locator('#matchup [data-pfo53-mode=submitted]').getAttribute('aria-pressed'),'true');
});
test('actual Start / Sit research renders real NFL players and changes comparison',async()=>{
 await page.evaluate(()=>document.querySelector('#nav button[data-page=matchup]')?.click());
 await page.locator('[data-pfo64-switch=matchup][data-pfo64-value=startsit]').first().waitFor({timeout:12000});
 await page.evaluate(()=>document.querySelector('[data-pfo64-switch=matchup][data-pfo64-value=startsit]').click());
 await page.locator('#pfo63-startsit [data-pfo63-compare=first]').first().waitFor({timeout:15000});
 const select=page.locator('#pfo63-startsit [data-pfo63-compare=second]');
 assert.ok(await select.locator('option').count()>2,'Sample roster should provide choices');
 const before=await select.inputValue();
 await select.selectOption({index:2});
 const after=await select.inputValue();
 assert.notEqual(after,before,'Player selection must update');
 assert.match(await page.locator('#pfo63-startsit').innerText(),/Compare player A|Start \/ Sit/);
 await page.evaluate(()=>document.querySelector('[data-pfo64-switch=matchup][data-pfo64-value=lab]').click());
 assert.equal(await page.locator('#matchup').getAttribute('data-pfo64-tab'),'lab');
});
test('original Trade Finder and Waiver Market load the demo league, not old FFL roster',async()=>{
 await page.evaluate(()=>document.querySelector('#nav button[data-page=market]')?.click());
 await page.locator('#pfo59-trade-manager option').first().waitFor({timeout:16000});
 assert.ok(await page.locator('#pfo59-trade-manager option').count()>3,'Demo trade partner list should populate');
 await page.evaluate(()=>document.querySelector('#market [data-pfo59-market=waiver]').click());
 await page.locator('#pfo59-waiver-manager option').first().waitFor({timeout:14000});
 assert.ok(await page.locator('#pfo59-waiver-manager option').count()>3);
 assert.match(await page.locator('#market').innerText(),/Waiver Command|Waiver Market/i);
});
