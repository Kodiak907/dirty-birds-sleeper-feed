// PFO 5.9 development browser smoke tests. Local HTTP fixture, mock commissioner only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

const basedir=resolve(import.meta.dirname);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json'};
let server,browser,base;

async function serve(request,response){
 try{
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  const file=resolve(basedir,'.'+pathname);
  if(!file.startsWith(basedir+sep)&&file!==basedir){response.writeHead(403).end('Forbidden');return}
  const target=pathname==='/'?resolve(basedir,'index.html'):file;
  const data=await readFile(target);
  response.writeHead(200,{'content-type':mime[extname(target)]||'application/octet-stream','cache-control':'no-store'});
  response.end(data);
 }catch{response.writeHead(404).end('Not found')}
}

async function setup(){
 server=createServer(serve);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
}
async function teardown(){await browser?.close();await new Promise(r=>server?.close(r));}

async function getPage(){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2,hasTouch:true});
 const page=await context.newPage();
 const api=[];
 await page.route('**/api/commissioner/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname,method=route.request().method();
  let body={};
  if(path.endsWith('/status'))body={ready:true,unlocked:true,identity:'local-qa@example.invalid',pin_secret_format:{hash_ok:true,salt_ok:true,session_ok:true}};
  else if(path.endsWith('/cases')&&method==='GET')body={cases:[]};
  else if(path.endsWith('/scores')&&method==='GET')body={adjustments:[],events:[]};
  else if(method==='POST'&&path.endsWith('/cases')){body={case:{id:991,case_no:'FFL-2026-QA0991',league:'FFL',team:'League-wide',owner:'Commissioner Office'}};api.push('create:mock');}
  else if(path.endsWith('/cases/991'))body={case:{id:991,case_no:'FFL-2026-QA0991',league:'FFL',team:'League-wide',owner:'Commissioner Office',week:8,occurred_on:'2026-10-28',rule_ref:'GENERAL',violation:'QA simulated administrative record only',consequence:'No penalty',status:'FILED',created_at:'2026-10-28T10:00:00Z',created_by:'qa@example.invalid'},events:[],evidence:[]};
  else body={scores:[],cases:[],events:[],adjustments:[]};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.route('https://api.sleeper.app/**',route=>route.abort('failed'));
 await page.route('https://raw.githubusercontent.com/**',route=>route.abort('failed'));
 await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:20000});
 return {page,context,api};
}
async function clickTab(page,id){
 await page.locator('nav button[data-page="'+id+'"]').click({timeout:10000});
 await page.waitForTimeout(60);
}
test('PFO 5.9 local Chromium mobile UI smoke: all new workspaces and protected tabs', {timeout:110000},async()=>{
 await setup();
 let ctx;
 try{
  const {page,context,api}=await getPage();ctx=context;
  await page.waitForTimeout(900);
  assert.equal(await page.locator('#overview').count(),1);
  await clickTab(page,'roster');
  assert.equal(await page.locator('#pfo59-team-hub').count(),1,'Team HQ mounted');
  assert.equal(await page.locator('#pfo59-team-hub [data-pfo59-team-tab]').count(),4,'Four Team HQ tabs');
  await page.locator('[data-pfo59-team-tab="schedule"]').click();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#pfo59-schedule .pfo59-week').count(),17,'17 FFL weeks, no fake Week18');
  await page.locator('[data-pfo59-team-tab="roster"]').click();
  assert.equal(await page.locator('#actual-lineup').count(),1,'Legacy submitted lineup preserved');
  await clickTab(page,'market');
  assert.equal(await page.locator('#pfo59-market').count(),1,'Market workspace mounted');
  await page.locator('.pfo59-market-tabs [data-pfo59-market="trade"]').click();
  assert.equal(await page.locator('#pfo59-trade-existing #trade-fold').count(),1,'Original multi-player trade engine still mounted');
  await page.locator('.pfo59-market-tabs [data-pfo59-market="waiver"]').click();
  assert.equal(await page.locator('#pfo59-position option').count(),7,'Position filters exist');
  assert.equal(await page.locator('#pfo59-waiver-existing #waiver-fold').count(),1,'Original waiver research preserved');
  await page.locator('.pfo59-market-tabs [data-pfo59-market="transactions"]').click();
  assert.equal(await page.locator('#pfo59-txn-existing #faabpanel').count(),1,'FAAB remains in Transactions');
  await clickTab(page,'championship');
  await page.locator('#pfo59-champ-odds',{}).waitFor({state:'visible',timeout:8000});
  await page.waitForTimeout(800);
  assert.match(await page.locator('#pfo59-champ-result').innerText(),/100,000|100000|playoffs/i);
  assert.equal(await page.locator('#chances').count(),1,'Archived original odds retained');
  assert.equal(await page.locator('#pfo59-legacy-odds #chances').count(),1,'Archived model accessible in Championship disclosure');
  assert.equal(await page.locator('#pfo59-legacy-odds #contenders').count(),1,'Original contender percentages remain available');
  await clickTab(page,'commissioner');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#com57 [data-com57-tab]').count(),4,'Commissioner sub-tabs mounted');
  await page.locator('#com57 button[data-com57-tab="scores"]').click();
  assert.equal(await page.locator('#com57 [data-com57-panel="scores"]').isVisible(),true,'Score adjustments visible');
  assert.equal(await page.locator('#com-case-form').isVisible(),false,'Commissioner Log cannot leak into score adjustments');
  await page.locator('#com57 button[data-com57-tab="log"]').click();
  assert.equal(await page.locator('#com57 [data-com57-panel="log"]').isVisible(),true,'Commissioner Log visible');
  await page.locator('#com-new summary').click();
  assert.equal(await page.locator('#com-case-form').isVisible(),true,'Can open Commissioner Log form');
  assert.equal(await page.locator('#com-new-evidence').count(),1,'Evidence selector present');
  assert.equal(api.length,0,'Smoke test did not submit any case');
  await clickTab(page,'overview');
  assert.equal(await page.locator('#overview').isVisible(),true,'Overview remains available');
 }finally{await ctx?.close();await teardown()}
});