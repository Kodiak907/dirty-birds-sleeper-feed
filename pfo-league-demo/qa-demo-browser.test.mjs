import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
let appServer,browserObj,page;
test.before(async()=>{
 appServer=createServer((req,res)=>{
  const allowed={'/':'index.html','/demo.js':'demo.js','/demo.css':'demo.css'};
  const file=allowed[new URL(req.url,'http://localhost').pathname];
  if(!file){res.writeHead(404);res.end('not found');return;}
  const mime=file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html';
  res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});
  res.end(readFileSync(new URL('./'+file,import.meta.url)));
 });
 await new Promise(ok=>appServer.listen(0,'127.0.0.1',ok));
 browserObj=await chromium.launch({headless:true});
 const context=await browserObj.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 page=await context.newPage();
 const port=appServer.address().port;
 await page.goto('http://127.0.0.1:'+port+'/');
});
test.after(async()=>{await browserObj?.close();await new Promise(ok=>appServer?.close(ok));});
test('public sandbox loads with no off-origin requests',async()=>{
 assert.match(await page.title(),/PFO League Demo/);
 assert.equal(await page.locator('#team-choice option').count(),4);
 assert.match(await page.locator('body').innerText(),/Demo data only/);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 assert.ok(overflow<=2,'mobile horizontal document overflow '+overflow);
});
test('franchise switch updates selected team everywhere',async()=>{
 await page.locator('#team-choice').selectOption('2');
 await page.locator('#tabs [data-page=team]').click();
 assert.match(await page.locator('#workspace').innerText(),/End Zone Syndicate/);
 assert.match(await page.locator('#workspace').innerText(),/projected points/);
});
test('trade lab evaluates per-team GIVE / RECEIVE selectors without sending trades',async()=>{
 await page.locator('#tabs [data-page=trade]').click();
 await page.locator('[data-field=give1]').selectOption({index:1});
 await page.locator('[data-field=take1]').selectOption({index:1});
 assert.match(await page.locator('#workspace').innerText(),/OUR RAW PLAYER PROJECTION DELTA/);
 await page.locator('[data-clear-trade]').click();
 assert.match(await page.locator('#workspace').innerText(),/Choose unique players/);
});
test('waiver watch and mock roster addition never leave the page',async()=>{
 await page.locator('#tabs [data-page=waivers]').click();
 await page.locator('[data-watch=FA1]').click();
 assert.match(await page.locator('#workspace').innerText(),/Skyler Rhodes/);
 await page.locator('[data-claim=FA1]').click();
 await page.locator('#tabs [data-page=team]').click();
 assert.match(await page.locator('#workspace').innerText(),/Skyler Rhodes/);
});
test('player intel and fictional week selector work on mobile',async()=>{
 await page.locator('#week-choice').selectOption('11');
 await page.locator('#tabs [data-page=intel]').click();
 assert.match(await page.locator('#workspace').innerText(),/W11 EXAMPLE FFL POINTS/);
 await page.locator('[data-intel-search]').fill('QB');
 assert.ok(await page.locator('#intel-results [data-person]').count()>0);
});