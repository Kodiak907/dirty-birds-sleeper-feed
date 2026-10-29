import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {join} from 'node:path';

test('iPhone-sized player-card gesture: drag handle down closes, ordinary page scroll stays open', {timeout:60000},async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>');
  await page.addStyleTag({path:join(import.meta.dirname,'ffo-quickview.css')});
  await page.evaluate(()=>{
   window.dbNflWeek=8;
   window.pfo49Info=()=>({id:'101',name:'QA Receiver',team:'SF',position:'WR'});
   window.pfo49Observed=()=>({});
   window.pfo50StatsFor=()=>null;
   window.pfo49Injury=()=>({});
   window.pfo49Metric=()=>null;
  });
  await page.addScriptTag({path:join(import.meta.dirname,'ffo-quickview.js')});
  const perform=async (origin,start=100,end=255)=>page.evaluate(({origin,start,end})=>{
   const node=document.querySelector(origin);
   const touch=y=>new Touch({identifier:44,target:node,clientX:190,clientY:y,radiusX:1,radiusY:1,force:1});
   const send=(type,where)=>node.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[touch(where)],changedTouches:[touch(where)],targetTouches:type==='touchend'?[]:[touch(where)]}));
   send('touchstart',start);send('touchmove',start+65);send('touchend',end);
   return document.querySelector('#ffo57-sheet').hidden;
  },{origin,start,end});
  await page.evaluate(()=>window.ffoQuickView.open('101'));
  assert.equal(await page.locator('#ffo57-sheet').evaluate(x=>x.hidden),false);
  assert.equal(await perform('.ffo57-handle'),true);
  await page.evaluate(()=>window.ffoQuickView.open('101'));
  assert.equal(await perform('.ffo57-handle',100,180),true);
  await page.evaluate(()=>window.ffoQuickView.open('101'));
  const scrolled=await page.evaluate(()=>{
   const body=document.querySelector('.ffo57-body');body.innerHTML='<div style="height:1600px">Scrollable content</div>';body.scrollTop=100;
   const t=y=>new Touch({identifier:33,target:body,clientX:190,clientY:y});
   const fire=(type,y)=>body.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[t(y)],changedTouches:[t(y)]}));
   fire('touchstart',120);fire('touchmove',270);fire('touchend',285);
   return {hidden:document.querySelector('#ffo57-sheet').hidden,scrollTop:body.scrollTop};
  });
  assert.equal(scrolled.hidden,false,'scrolling an already-scrolled card must not dismiss it');
  assert.ok(scrolled.scrollTop>=50);
 }finally{await browser.close();}
});

test('two-sided iPhone Trade player rows keep portraits bounded and all five slots on one line',{timeout:60000},async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="pfo59-trade-board"><div class="pfo59-trade-dual"><section><div class="pfo59-trade-roster"><button class="pfo59-trade-player"><span class="pfo59-player-pos">K</span><span class="pfo598-trade-photo"><img width="24" height="29" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'800\' height=\'1500\'%3E%3Crect width=\'800\' height=\'1500\' fill=\'purple\'/%3E%3C/svg%3E"></span><span class="pfo59-trade-identity"><b>Very Long Kicker Name</b><small>MIN</small></span><span class="pfo59-trade-value">—<small>model</small></span><span class="pfo59-pick-mark">+</span></button></div></section></div></div></body></html>');
  await page.addStyleTag({path:join(import.meta.dirname,'ffo-pfo-59.css')});
  const d=await page.evaluate(()=>{
   const row=document.querySelector('.pfo59-trade-player'),img=row.querySelector('img');
   const parts=[...row.children].map(x=>{const b=x.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}});
   const b=row.getBoundingClientRect(),p=img.getBoundingClientRect();
   return {w:b.width,h:b.height,imgW:p.width,imgH:p.height,parts,scroll:row.scrollWidth-row.clientWidth};
  });
  assert.ok(d.h<=41&&d.h>=37,'trade rows remain compact');
  assert.ok(d.imgW<=25&&d.imgH<=30,'portrait cannot take over a card');
  assert.ok(d.parts.every(x=>Math.abs(x.y-d.parts[0].y)<15),'five fields stay in the same grid row');
  assert.ok(d.scroll<=1,'no sideways page overflow');
 }finally{await browser.close()}
});


test('expanded FFL trade EVALUATION keeps portraits compact inside two iPhone columns',{timeout:60000},async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const sample='<div class="pfo597-trade-person"><img class="pfo598-eval-photo" width="24" height="29" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'800\' height=\'1200\'%3E%3Crect width=\'800\' height=\'1200\' fill=\'red\'/%3E%3C/svg%3E"><button type="button" class="pfo597-player-link">Long Fictional Player Name</button><span>Unverified<small>FFL PPG</small></span></div>';
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div style="width:390px;padding:12px;box-sizing:border-box"><div id="trade-intel"><div class="pfo597-trade-report"><div class="pfo597-trade-sides"><section><h4>Dirty Birds sends</h4>'+sample+'</section><section><h4>Dirty Birds receives</h4>'+sample+'</section></div></div></div></div></body></html>');
  await page.addStyleTag({path:join(import.meta.dirname,'ffo-pfo-597.css')});
  const dim=await page.evaluate(()=>{
   const root=document.querySelector('#trade-intel'),r=root.getBoundingClientRect();
   const cards=[...root.querySelectorAll('.pfo597-trade-person')];
   const items=cards.map(c=>{const el=c.querySelector('img'),p=el.getBoundingClientRect(),cr=c.getBoundingClientRect();return {w:p.width,h:p.height,rowH:cr.height,rowW:cr.width,overflow:c.scrollWidth>c.clientWidth+1}});
   return {rootW:r.width,items,viewport:window.innerWidth,scroll:document.documentElement.scrollWidth};
  });
  assert.equal(dim.items.length,2);
  assert.ok(dim.items.every(x=>x.w<=25&&x.h<=30&&x.rowH<=70),'report faces must not fill half the phone');
  assert.ok(dim.items.every(x=>!x.overflow),'no list row sideways scroll');
  assert.ok(dim.scroll<=dim.viewport+1,'no page-wide horizontal overflow');
 }finally{await browser.close();}
});
