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
