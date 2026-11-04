import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const file=n=>readFileSync(new URL(n,import.meta.url),'utf8');
const fixture='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<link href="/ffo-layout-64.css" rel="stylesheet"></head>'+
 '<body style="color:white;background:#0c2030;margin:0;max-width:100%;font-family:Arial,sans-serif">'+
 '<nav><button data-page="matchup">Matchup</button><button data-page="market">Market</button></nav>'+
 '<section id="matchup"><div class="pfo52-hd"><h2>Weekly Matchup Command Center</h2></div>'+
 '<section id="pfo63-startsit">Start / Sit Comparison</section>'+
 '<div id="pfo52-matchup"><div class="pfo52-weekrow">Week selector</div>'+
 '<div class="pfo52-scoreboard">Game scores</div><div class="pfo52-duel">'+
 '<article>Dirty Birds starters<details class="pfo64-bench"><summary>Bench (4)</summary><button class="pfo64-bench-player">RB Example</button></details></article></div>'+
 '<section class="pfo52-lab">Interactive lineup lab</section></div></section>'+
 '<section id="market"><section data-pfo59-market-panel="trade"><div id="pfo61-trade-research">'+
 '<button data-pfo61-review="0">Inspect deal</button></div>'+
 '<div id="pfo59-trade-board">Existing Trade Analyzer<div id="pfo60-trade-lab">FAAB negotiation</div></div>'+
 '</section><section data-pfo59-market-panel="waiver"><div class="pfo59-subhead">Waiver Command</div>'+
 '<div id="pfo61-waiver-research"><button data-pfo61-waiver-compare="0">Suggested add/drop</button></div>'+
 '<div class="pfo59-filters"><input id="pfo59-find" placeholder="Search names"></div>'+
 '<div id="pfo59-waiver-board">Manual waiver board</div>'+
 '<details class="pfo59-legacy"><summary>Waiver legacy research</summary></details></section></section>'+
 '<script>window.ffoStartSit63={refresh:()=>{}};window.ffoMarketFinder61={notify:()=>{}};</script>'+
 '<script src="/ffo-layout-64.js"></script></body></html>';
test('iPhone Matchup and Trade sub-tabs isolate tools and preserve bench disclosure and FAAB', {timeout:60000},async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('https://pfo64.test/**',route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname==='/')return route.fulfill({contentType:'text/html',body:fixture});
   if(pathname==='/ffo-layout-64.js')return route.fulfill({contentType:'text/javascript',body:file('ffo-layout-64.js')});
   if(pathname==='/ffo-layout-64.css')return route.fulfill({contentType:'text/css',body:file('ffo-layout-64.css')});
   return route.fulfill({status:404});
  });
  await page.goto('https://pfo64.test/');
  assert.equal(await page.locator('[data-pfo64-switch="matchup"]').count(),3);
  assert.equal(await page.locator('[data-pfo64-switch="trade"]').count(),2);
  assert.equal(await page.locator('[data-pfo64-switch="waiver"]').count(),2);
  assert.equal(await page.locator('#pfo61-waiver-research').isVisible(),true);
  assert.equal(await page.locator('#pfo59-waiver-board').isVisible(),false);
  await page.locator('[data-pfo64-switch="waiver"][data-pfo64-value="manual"]').click();
  assert.equal(await page.locator('#pfo59-waiver-board').isVisible(),true);
  assert.equal(await page.locator('#pfo61-waiver-research').isVisible(),false);
  assert.equal(await page.locator('#pfo59-find').isVisible(),true);
  await page.locator('[data-pfo64-switch="waiver"][data-pfo64-value="suggested"]').click();
  assert.equal(await page.locator('#pfo61-waiver-research').isVisible(),true);
  assert.equal(await page.locator('.pfo52-duel').isVisible(),true);
  assert.equal(await page.locator('.pfo52-lab').isVisible(),false);
  assert.equal(await page.locator('#pfo63-startsit').isVisible(),false);
  await page.locator('[data-pfo64-switch="matchup"][data-pfo64-value="startsit"]').click();
  assert.equal(await page.locator('#pfo63-startsit').isVisible(),true);
  assert.equal(await page.locator('.pfo52-duel').isVisible(),false);
  await page.locator('[data-pfo64-switch="matchup"][data-pfo64-value="lab"]').click();
  assert.equal(await page.locator('.pfo52-lab').isVisible(),true);
  assert.equal(await page.locator('.pfo52-weekrow').isVisible(),true);
  await page.locator('[data-pfo64-switch="matchup"][data-pfo64-value="starters"]').click();
  assert.equal(await page.locator('.pfo64-bench').isVisible(),true);
  await page.locator('.pfo64-bench summary').click();
  assert.equal(await page.locator('.pfo64-bench-player').isVisible(),true);
  assert.equal(await page.locator('#pfo61-trade-research').isVisible(),true);
  assert.equal(await page.locator('#pfo59-trade-board').isVisible(),false);
  await page.locator('[data-pfo61-review]').click();
  assert.equal(await page.locator('#pfo59-trade-board').isVisible(),true);
  assert.equal(await page.locator('#pfo61-trade-research').isVisible(),false);
  assert.equal(await page.locator('#pfo60-trade-lab').isVisible(),true);
  for(const width of [320,375,390,430]){
   await page.setViewportSize({width,height:844});
   const x=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));
   assert.ok(x.scroll<=x.inner+2,'horizontal overflow '+JSON.stringify(x));
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
