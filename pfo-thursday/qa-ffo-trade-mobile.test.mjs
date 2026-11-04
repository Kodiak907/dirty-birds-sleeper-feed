import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const file=n=>readFileSync(join(import.meta.dirname,n),'utf8');
const ids=['q1','r1','w1','t1','k1','d1','r2','w2','r3',
 'q2','r4','w4','t2','k2','d2','r5','w3','r6'];
const pos=id=>({q:'QB',r:'RB',w:'WR',t:'TE',k:'K',d:'DEF'})[id[0]];
const ppg=[20,15,12,8,7,6,10,7,4,19,16,11,8,7,6,9,11,3];
const names=Object.fromEntries(ids.map((id,i)=>[id,{
 name:'Sample '+id,position:pos(id),team:i<9?'GB':'CHI',injury_status:null
}]));
const fixture='window.__values='+JSON.stringify(Object.fromEntries(ids.map((id,i)=>[id,ppg[i]])))+
 ';window.__ctx={manager:"5",managerName:"Rival Manager",give:["r2"],take:["w3"],'+
 'snapshotAt:new Date().toISOString(),names:'+JSON.stringify(names)+
 ',ourRoster:'+JSON.stringify(ids.slice(0,9))+',theirRoster:'+JSON.stringify(ids.slice(9))+
 ',slots:["QB","RB","WR","FLEX","TE","K","DEF"],rosterCap:9,rulesReady:true,'+
 'estimate:(id)=>window.__values[id]??null};'+
 'window.ffoPfo59={tradeContext:()=>window.__ctx};';
const row=(id,side)=>'<button class="pfo59-trade-player" data-pfo59-pick="'+id+
 '" data-pfo59-side="'+side+'"><span class="pfo59-player-pos">'+pos(id)+
 '</span><span class="pfo598-trade-photo"></span><span class="pfo59-trade-identity"><b>Sample '+id+
 '</b><small>GB</small></span><span class="pfo59-trade-value">—</span><span class="pfo59-pick-mark">+</span></button>';
const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<link rel="stylesheet" href="/ffo-pfo-59.css"><link rel="stylesheet" href="/ffo-trade-60.css"></head>'+
 '<body style="margin:0;background:#0b1a2c;color:#e5edf6;padding:10px;box-sizing:border-box">'+
 '<div id="pfo59-trade-board" style="width:100%;max-width:100%">'+
 '<div class="pfo59-trade-dual"><section><h3>Dirty Birds Give</h3><div class="pfo59-trade-roster">'+
 ids.slice(0,9).map(id=>row(id,'give')).join('')+
 '</div></section><section><h3>Rival Receive</h3><div class="pfo59-trade-roster">'+
 ids.slice(9).map(id=>row(id,'take')).join('')+
 '</div></section></div><div class="pfo59-trade-bar"><span>1 for 1</span><button>Analyze</button></div></div>'+
 '<script src="/fixture.js"></script><script src="/ffo-trade-60.js"></script></body></html>';
test('Mobile Trade Intelligence is compact, searchable, FFL-specific and source-honest',{timeout:60000},async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.route('https://pfo-trade.test/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/')return route.fulfill({contentType:'text/html',body:html});
   if(path==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:fixture});
   if(path==='/ffo-trade-60.js'||path==='/ffo-trade-decision-60.mjs')
    return route.fulfill({contentType:'text/javascript',body:file(path.slice(1))});
   if(path==='/ffo-pfo-59.css'||path==='/ffo-trade-60.css')
    return route.fulfill({contentType:'text/css',body:file(path.slice(1))});
   return route.fulfill({status:404,body:'not found'});
  });
  await page.goto('https://pfo-trade.test/');
  await page.waitForFunction(()=>Boolean(window.ffoTrade60));
  await page.waitForFunction(()=>!!document.querySelector('[data-pfo60-search="give"]'));
  for(const width of [320,375,390,430]){
   await page.setViewportSize({width,height:844});
   const m=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,
    width:innerWidth,card:document.getElementById('pfo59-trade-board').getBoundingClientRect().width}));
   assert.ok(m.scroll<=m.width+2,'Trade mobile page horizontal overflow: '+JSON.stringify(m));
  }
  await page.locator('[data-pfo60-search="give"]').fill('Sample r2');
  assert.equal(await page.locator('[data-pfo59-side="give"]:visible').count(),1);
  await page.locator('[data-pfo60-search="give"]').fill('');
  await page.locator('[data-pfo60-position="RB"][data-pfo60-side="take"]').click();
  // Selected assets stay visible even when filtered to another position.
  assert.equal(await page.locator('[data-pfo59-side="take"]:visible').count(),4);
  assert.equal(await page.locator('[data-pfo59-pick="w3"]:visible').count(),1);
  await page.evaluate(()=>window.ffoTrade60.analyze());
  assert.match(await page.locator('#pfo60-trade-report').innerText(),/Our starter impact/);
  assert.match(await page.locator('#pfo60-trade-report').innerText(),/Their starter impact/);
  const result=await page.evaluate(()=>window.ffoTrade60.getLastResult());
  assert.equal(result.starterDelta.ours,1);
  assert.equal(result.starterDelta.theirs,-1);
  await page.locator('[data-pfo60-lineups] summary').click();
  const movement=await page.locator('[data-pfo60-lineups]').innerText();
  assert.match(movement,/Before.*after starters/i);
  assert.match(movement,/Acquired starter/);
  assert.match(movement,/Traded away/);
  assert.equal(await page.locator('.pfo60-lineup-sections>section').count(),2);
  await page.locator('[data-pfo60-faab] summary').click();
  await page.locator('[data-pfo60-cash="weSend"]').fill('15');
  await page.locator('[data-pfo60-cash="weSend"]').dispatchEvent('change');
  const cash=await page.evaluate(()=>window.ffoTrade60.getLastResult());
  assert.equal(cash.faab.weSend,15);
  assert.equal(cash.packageNetPPG,1);
  assert.ok(cash.issues.includes('our_faab_balance_unconfirmed'));
  await page.locator('[data-pfo60-search="give"]').fill('Sample q1');
  await page.evaluate(()=>window.ffoTrade60.clear());
  assert.equal(await page.evaluate(()=>window.ffoTrade60.getLastResult()),null);
  assert.equal(await page.locator('[data-pfo60-search="give"]').inputValue(),'');
  assert.equal(await page.locator('[data-pfo60-position="ALL"][data-pfo60-side="take"]').getAttribute('aria-pressed'),'true');
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
