import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {chromium} from 'playwright';
const file=name=>readFileSync(join(import.meta.dirname,name),'utf8');
const ours=['q1','r1','w1','t1','k1','d1','r2','w2','r3'];
const theirs=['q2','r4','w4','t2','k2','d2','r5','w3','r6'];
const amounts={q1:20,r1:15,w1:12,t1:8,k1:7,d1:6,r2:10,w2:7,r3:4,
 q2:19,r4:16,w4:11,t2:8,k2:7,d2:6,r5:9,w3:11,r6:3,w5:13};
const pos=id=>({q:'QB',r:'RB',w:'WR',t:'TE',k:'K',d:'DEF'})[id[0]];
const names=Object.fromEntries(Object.keys(amounts).map(id=>[id,{name:'Sample '+id,
 position:pos(id),team:'GB',active:true}]));
const fixture=`window.__applied=null;window.__analyzed=0;
const rosters=${JSON.stringify([{roster_id:1,players:ours,starters:['q1','r1','w1','r2','t1','k1','d1'],reserve:[]},{roster_id:3,players:['q3'],reserve:[]},{roster_id:5,players:theirs,reserve:[]}])};
const names=${JSON.stringify(names)};const amounts=${JSON.stringify(amounts)};
window.ffoPfo59={
 marketResearchContext:({includeWaivers}={})=>({
  rosters,names,slots:['QB','RB','WR','FLEX','TE','K','DEF'],
  snapshotAt:new Date().toISOString(),rulesReady:true,
  ownerRosterId:'1',waiverRosterId:'1',excludedRosterIds:['3'],
  partners:[{id:'5',name:'Rival Team'}],
  estimate:id=>amounts[id]??null,
  unrostered:includeWaivers?[{id:'w5',name:'Sample w5',position:'WR',modelPPG:13}]:[]
 }),
 applyResearchTrade:x=>(window.__applied=x,true)
};window.ffoTrade60={analyze:()=>window.__analyzed++};`;
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">'+
 '<link rel="stylesheet" href="/ffo-market-finder-61.css"></head><body style="background:#071b2c;color:white;margin:0">'+
 '<main><section class="page active" id="market">'+
 '<div data-pfo59-market-panel="trade"><div id="pfo59-trade-board"></div><div id="pfo60-trade-lab"></div></div>'+
 '<div data-pfo59-market-panel="waiver" hidden><div id="pfo59-waiver-board"></div></div></section></main>'+
 '<script src="/fixture.js"></script><script src="/ffo-market-finder-61.js"></script></body></html>';
test('Trade Finder and Waiver Decision Desk open and run fast on mobile without league writes',
 {timeout:60000},async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('https://pfo61.test/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/')return route.fulfill({contentType:'text/html',body:html});
   if(path==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:fixture});
   if(['/ffo-market-finder-61.js','/ffo-market-finder-61.mjs','/ffo-market-quality-63.mjs','/ffo-trade-decision-60.mjs'].includes(path))
    return route.fulfill({contentType:'text/javascript',body:file(path.slice(1))});
   if(path==='/ffo-market-finder-61.css')
    return route.fulfill({contentType:'text/css',body:file(path.slice(1))});
   return route.fulfill({status:404,body:'not found'});
  });
  await page.goto('https://pfo61.test/');
  await page.locator('[data-pfo63-objective]').first().waitFor();
  await page.locator('.pfo63-empty, [data-pfo61-review]').first().waitFor();
  for(const width of [320,375,390,430]){
   await page.setViewportSize({width,height:844});
   const box=await page.evaluate(()=>({actual:document.documentElement.scrollWidth,available:innerWidth}));
   assert.ok(box.actual<=box.available+2,'Horizontal overflow: '+JSON.stringify(box));
  }
  assert.ok(await page.locator('[data-pfo63-objective]').count()>0);
  assert.ok(await page.locator('[data-pfo63-fair]').count()>0);
  assert.ok(await page.locator('.pfo63-protect').count()>0);
  const candidates=await page.locator('[data-pfo61-review]').count();
  if(candidates){
   await page.locator('[data-pfo61-review]').first().click();
   const selected=await page.evaluate(()=>({applied:window.__applied,analyzed:window.__analyzed}));
   assert.equal(selected.applied.partnerId,'5');
   assert.ok(selected.applied.give.length>=1&&selected.applied.take.length>=1);
   assert.equal(selected.analyzed,1);
  }else{
   assert.match(await page.locator('#pfo61-trade-research').innerText(),/No defensible packages|withheld/i);
  }
  await page.evaluate(()=>{
   document.querySelector('[data-pfo59-market-panel="trade"]').hidden=true;
   document.querySelector('[data-pfo59-market-panel="waiver"]').hidden=false;
   window.ffoMarketFinder61.notify('waiver');
  });
  await page.locator('#pfo61-waiver-research .pfo61-head').waitFor();
  await page.locator('#pfo61-waiver-research .pfo63-empty, #pfo61-waiver-research [data-pfo61-waiver-compare]').first().waitFor();
  assert.match(await page.locator('#pfo61-waiver-research').innerText(),/Waiver Decision Desk/);
  if(await page.locator('[data-pfo61-waiver-compare]').count()){
   assert.equal(await page.locator('[data-pfo61-drop]').count(),0,'Drop must be automatic');
   await page.locator('[data-pfo61-waiver-compare]').first().click();
   assert.match(await page.locator('[data-pfo61-result="0"]').innerText(),/Proposed research pair|withheld/i);
  }else{
   assert.match(await page.locator('#pfo61-waiver-research').innerText(),/No positively screened automatic add\/drop pair/i);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
