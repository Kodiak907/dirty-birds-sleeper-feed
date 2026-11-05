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
