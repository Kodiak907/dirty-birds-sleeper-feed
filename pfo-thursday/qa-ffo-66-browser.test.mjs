import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const js=readFileSync(new URL('./ffo-startsit-63.js',import.meta.url),'utf8');
const fixture='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
 '<body><nav><button data-page="matchup">Matchup</button></nav>'+
 '<section id="matchup" class="page active" data-pfo64-tab="startsit"><div id="pfo52-matchup">Week panel</div></section>'+
 '<script>window.dbRosterId=1;window.dbNflWeek=8;'+
 'const gm47Snapshot={rosters:[{roster_id:1,players:["q1","r1","r2"],reserve:["r2"],starters:["q1","r1"]}]};'+
 'const liveRosterSnapshot={roster_id:1,roster_player_ids:["q1","r1","r2"],reserve:["r2"],starters:["q1","r1"],'+
 'players:[{player_id:"q1",name:"QB Example",team:"KC",position:"QB"},'+
 '{player_id:"r1",name:"RB Example",team:"MIA",position:"RB"},'+
 '{player_id:"r2",name:"IR Example",team:"SF",position:"RB"}]};'+
 'function pfo52Cur(){return 9;}function pfo52Info(id){return liveRosterSnapshot.players.find(p=>p.player_id===id);};'+
 'function pfo50Estimate(id){const st=Date.now();while(Date.now()-st<70){};return id==="q1"?20:11;}'+
 'function pfo52Points(id){return {points:id==="q1"?20:9,source:"Independent FFL mock"};}function pfo50StatsFor(){return null;}'+
 '</script><script src="/ffo-startsit-63.js" defer></script></body></html>';
test('Start/Sit renders selectable current-roster players before slow optional analytics and never waits for Market', {timeout:60000},async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('https://pfo66.test/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/')return route.fulfill({contentType:'text/html',body:fixture});
   if(path==='/ffo-startsit-63.js')return route.fulfill({contentType:'application/javascript',body:js});
   return route.fulfill({status:404});
  });
  await page.goto('https://pfo66.test/');
  assert.equal(await page.locator('[data-pfo63-compare]').count(),2);
  assert.equal(await page.locator('[data-pfo63-compare="first"] option').count(),2);
  assert.equal(await page.locator('[data-pfo63-compare="second"] option').count(),2);
  assert.doesNotMatch(await page.locator('#pfo63-startsit').innerText(),/Waiting for a current roster/);
  assert.match(await page.locator('#pfo63-startsit').innerText(),/1 fantasy-reserve player/);
  assert.match(await page.locator('#pfo63-startsit').innerText(),/Week 9/);
  await page.locator('#pfo66-compare-output .pfo63-compare-players').waitFor();
  assert.match(await page.locator('#pfo66-compare-output').innerText(),/9.0 model PPG|9.0/);
  await page.locator('[data-pfo63-horizon="PLAYOFFS"]').click();
  assert.equal(await page.locator('[data-pfo63-horizon="PLAYOFFS"]').getAttribute('aria-pressed'),'true');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
