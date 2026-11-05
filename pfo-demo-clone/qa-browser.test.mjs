import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const root=resolve('.pfo-exact-demo-output');
let browser,server,page,errors=[],offsite=[],worker;
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
 '.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.md':'text/plain'};
const send=async(res,response)=>{
 const body=Buffer.from(await response.arrayBuffer());
 const h={};for(const [k,v] of response.headers)h[k]=v;
 res.writeHead(response.status,h);res.end(body);
};
test.before(async()=>{
 worker=(await import(pathToFileURL(join(root,'_worker.js')).href)).default;
 const assets={fetch:async req=>{
  const path=new URL(req.url).pathname;
  if(path==='/_worker.js'||path.includes('..'))return new Response('not found',{status:404});
  try{return new Response(readFileSync(join(root,path)),{headers:{
   'content-type':mime[extname(path)]||'text/plain','cache-control':'no-store'}})}
  catch{return new Response('not found',{status:404})}
 }};
 server=createServer(async(req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  try{
   // Keep browser regression deterministic; those routes represent live external
   // public NFL research, and shouldn't block the core PFO demo load.
   const p=u.pathname;
   if(['/api/nfl-official','/api/injuries','/api/nfl-transactions','/api/player-news',
       '/api/nfl-week','/api/season-schedule','/api/target-share','/api/gameday-news',
       '/api/game-plays','/api/player-health','/api/independent-stats'].includes(p)){
    const payload=p==='/api/nfl-week'?{season:2026,week:9,games:[],checked_at:'2026-11-04T21:00:00Z'}:
     p==='/api/injuries'?{injuries:[],checked_at:'2026-11-04T21:00:00Z'}:
     p==='/api/season-schedule'?{season:2026,complete:false,teams:{},checked_at:'2026-11-04T21:00:00Z'}:
     {source:'FFO DEMO · external NFL checks intentionally paused in browser QA',
      checked_at:'2026-11-04T21:00:00Z',players:[],matches:[],news:[],games:[]};
    await send(res,Response.json(payload));return;
   }
   const response=await worker.fetch(new Request(u.toString(),{method:req.method}),{ASSETS:assets});
   await send(res,response);
  }catch(error){res.writeHead(503,{'content-type':'application/json'});
   res.end(JSON.stringify({error:'test_only_stub',message:String(error)}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,
  hasTouch:true,deviceScaleFactor:2});
 page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e.message)));
 page.on('request',r=>{
  if(!r.url().startsWith('http://127.0.0.1:')&&
    !r.url().startsWith('https://sleepercdn.com/content/nfl/players/thumb/'))
   offsite.push(r.url());
 });
 await page.route('https://**/*',route=>route.fulfill({status:404,body:''}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(1100);
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve))});
const go=async name=>{
 await page.evaluate(name=>document.querySelector('#nav button[data-page="'+name+'"]').click(),name);
 await page.waitForTimeout(400);
};
test('private PFO UI is cloned intact with 14 original navigation pages',async()=>{
 assert.match(await page.title(),/PFO League Demo/);
 assert.equal(await page.locator('#nav button[data-page]').count(),14);
 assert.match(await page.locator('.pfo-exact-demo-banner').innerText(),/Original PFO workspace/);
 assert.ok(await page.locator('#overview').count()===1);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 assert.ok(overflow<=12,'Excessive iPhone page overflow: '+overflow);
});
test('Team HQ resolves new roster without any original manager data',async()=>{
 await go('roster');
 await page.waitForTimeout(700);
 const text=await page.locator('#roster').innerText();
 assert.match(text,/Front Office Collective/i);
 assert.ok(!text.includes('Dirty Birds'));
 assert.ok((await page.locator('#actual-lineup tr').count())>=10,'Ten sample starters should render');
 assert.match(text,/Josh Allen/);
 assert.match(text,/Puka Nacua/);
});
test('original weekly matchup and Start/Sit / Lineup Lab are present',async()=>{
 await go('matchup');
 assert.ok(await page.locator('#matchup .pfo64-tabs').count()>0);
 assert.ok(await page.locator('[data-pfo64-switch=matchup][data-pfo64-value=startsit]').count()>0);
 await page.evaluate(()=>document.querySelector('[data-pfo64-switch=matchup][data-pfo64-value=startsit]').click());
 assert.equal(await page.locator('#matchup').getAttribute('data-pfo64-tab'),'startsit');
 await page.evaluate(()=>document.querySelector('[data-pfo64-switch=matchup][data-pfo64-value=lab]').click());
 assert.equal(await page.locator('#matchup').getAttribute('data-pfo64-tab'),'lab');
});
test('original Trade / Waiver tools use the seeded 12-team league',async()=>{
 await go('market');
 const markup=await page.locator('#market').innerText();
 assert.match(markup,/Trade|Waiver/);
 assert.ok(await page.locator('#market [data-pfo59-market-panel]').count()>0);
 assert.ok(!markup.includes('Dirty Birds'));
});
test('Commissioner tab is visible but protected endpoints remain inaccessible',async()=>{
 await go('commissioner');
 assert.match(await page.locator('#commissioner').innerText(),/Commissioner Command/);
 assert.ok((await page.locator('#commissioner').innerText()).includes('ADMIN ONLY'));
 assert.equal(offsite.some(x=>/raw.githubusercontent.com\/Kodiak907|api.sleeper.app\/v1\/league\//.test(x)),false);
});
test('the browser never leaks the original fantasy manager through API requests',async()=>{
 assert.equal(offsite.some(x=>/dirty-birds|tvega2924|1399157532559192064/.test(x)),false);
 const severe=errors.filter(e=>/ReferenceError|SyntaxError|Cannot read properties of undefined/.test(e));
 assert.deepEqual(severe.slice(0,5),[],'Client JS exceptions: '+severe.slice(0,5).join('; '));
});
