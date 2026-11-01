import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const file=name=>readFileSync(join(import.meta.dirname,name),'utf8');
const sunday=[
 ['BAL','BUF'],['TEN','CIN'],['ARI','DAL'],['MIN','DET'],
 ['IND','JAX'],['LV','NYJ'],['CLE','PIT'],['ATL','TB'],
 ['LAC','LAR'],['KC','DEN'],['NE','MIA'],['PHI','WSH']
];
const games=[
 {id:'thu',week:8,home:'GB',away:'CAR',start:'2026-10-30T00:15:00Z',status:'FINAL'},
 ...sunday.map(([away,home],i)=>({id:'sun'+i,week:i%2===0?8:null,home,away,
   start:i<8?'2026-11-01T18:00:00Z':i<11?'2026-11-01T21:25:00Z':'2026-11-02T01:20:00Z',
   status:i===0?'LIVE':'SCHEDULED'})),
 {id:'mon',week:8,home:'SEA',away:'CHI',start:'2026-11-03T01:15:00Z',status:'SCHEDULED'},
 {id:'week9',week:9,home:'BAL',away:'JAX',start:'2026-11-06T01:15:00Z',status:'SCHEDULED'}
];
const browserGame=g=>({schedule:{id:g.id,week:g.week,homeTeam:{abbreviation:g.home},
 awayTeam:{abbreviation:g.away},startTime:g.start,playedStatus:g.status},
 score:{homeScoreTotal:g.status==='LIVE'?10:null,awayScoreTotal:g.status==='LIVE'?3:null}});
const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ffo-pfo-core.css"></head>'+
 '<body style="max-width:100%;margin:0"><nav><button data-page="gamecast">GameCast</button></nav>'+
 '<div id="ffo-gc-status"></div><div class="ffo-gc-weekbar" style="display:flex;max-width:100%;gap:8px;flex-wrap:wrap">'+
 '<select id="ffo-gc-week" aria-label="Choose NFL week"></select><button id="ffo-gc-week-today">Current week</button>'+
 '<div id="ffo-gc-week-status"></div></div><div id="ffo-gc-games" class="ffo-gc-games"></div>'+
 '<div id="ffo-gc-gameview"></div><div id="ffo-gc-playfeed"></div>'+
 '<div id="ffo-gc-player-field"></div><button id="ffo-gc-refresh">Refresh</button></body></html>';

test('Mobile GameCast renders 12 Sunday games plus TNF/MNF, switches weeks and selects verified game', {timeout:60000},async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const RealDate=Date,fixed=RealDate.parse('2026-11-01T18:00:00Z');
   class MockDate extends RealDate {
    constructor(...args){if(args.length)super(...args);else super(fixed)}
    static now(){return fixed}
   }
   window.Date=MockDate;
  });
  let refreshCount=0,weekboardCalls=0;
  await page.route('https://pfo.test/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/')return route.fulfill({contentType:'text/html',body:html});
   if(['/ffo-gamecast.js','/ffo-gamecast-model.mjs','/ffo-gamecast-stadium.mjs',
      '/ffo-same-game-player-evidence.mjs','/ffo-scoring-reconciliation.mjs',
      '/ffo-msf-event-score-scenarios.mjs','/ffo-gamecast-weeks.mjs'].includes(path))
    return route.fulfill({contentType:'text/javascript',body:file(path.slice(1))});
   if(path==='/ffo-pfo-core.css')return route.fulfill({contentType:'text/css',body:file('ffo-pfo-core.css')});
   if(path==='/ffo-gamecast-stadium.css')return route.fulfill({contentType:'text/css',body:file('ffo-gamecast-stadium.css')});
   if(path==='/FFO_FFL_SCORING_V1.json')return route.fulfill({contentType:'application/json',body:file('FFO_FFL_SCORING_V1.json')});
   if(path==='/api/ffo/gamecast/health')return route.fulfill({json:{ready:true}});
   if(path==='/api/ffo/gamecast/schedule'){
    refreshCount++;
    return route.fulfill({json:{available:true,checked_at:'2026-11-01T18:00:00Z',data:{games:games.map(browserGame)}}});
   }
   if(path==='/api/ffo/gamecast/weekboard'){
    weekboardCalls++;
    return route.fulfill({json:{available:true,checked_at:'2026-11-01T18:00:05Z',
     provider_updated_at:'2026-11-01T18:00:05Z',data:{games:games.filter(g=>g.week===8||g.id.startsWith('sun')).map(g=>({
      schedule:{id:g.id,week:8,homeTeam:{abbreviation:g.home},awayTeam:{abbreviation:g.away},
       playedStatus:g.id==='sun1'?'LIVE':g.status,startTime:g.start},
      score:g.id==='sun1'?{homeScoreTotal:7,awayScoreTotal:3}:
        g.id==='sun0'?{homeScoreTotal:10,awayScoreTotal:3}:null
     }))}}});
   }
   if(path==='/api/ffo/gamecast/portraits')return route.fulfill({json:{available:true,players:[]}});
   if(path==='/api/ffo/gamecast/plays')return route.fulfill({json:{available:true,coverage:'full',
    data:{gameplaybyplay:{plays:[{id:'p1',description:'Verified provider play 1',
     playStatus:{quarter:1,secondsElapsed:60,teamInPossession:{abbreviation:'BAL'},
      lineOfScrimmage:{team:{abbreviation:'BAL'},yardLine:42}}}]}}}});
   if(path==='/api/ffo/gamecast/boxscore')return route.fulfill({json:{available:true,data:{
    gameboxscore:{game:{id:'sun0',playedStatus:'LIVE'},scoring:{homeScoreTotal:10,awayScoreTotal:3}}
   }}});
   return route.fulfill({status:404,json:{error:'unavailable'}});
  });
  await page.goto('https://pfo.test/');
  await page.addScriptTag({url:'https://pfo.test/ffo-gamecast.js'});
  await page.waitForFunction(()=>!!window.ffoGameCast);
  await page.evaluate(()=>window.ffoGameCast.refresh(true));
  await page.waitForFunction(()=>window.ffoGameCast.getStatus().visibleGames===14);
  assert.equal(await page.locator('#ffo-gc-games button[data-ffo-game]').count(),14);
  assert.match(await page.locator('#ffo-gc-week-status').innerText(),/Today 12\/12 source-scheduled matchups/);
  assert.equal(await page.locator('#ffo-gc-week option').count(),18);
  assert.equal(await page.locator('#ffo-gc-week').inputValue(),'8');
  const info=await page.evaluate(()=>window.ffoGameCast.getStatus());
  assert.equal(info.dailySlateVerified,true);
  await page.evaluate(()=>window.ffoGameCast.refreshWeekboard());
  assert.ok(weekboardCalls>=1);
  assert.equal((await page.evaluate(()=>window.ffoGameCast.getStatus())).scoreboardPollIntervalMs,5000);
  assert.match(await page.locator('[data-ffo-game="sun1"]').innerText(),/TEN 3 · 7 CIN/);
  await page.locator('#ffo-gc-week').selectOption('9');
  assert.equal(await page.locator('#ffo-gc-games button[data-ffo-game]').count(),1);
  await page.locator('#ffo-gc-week-today').click();
  assert.equal(await page.locator('#ffo-gc-week').inputValue(),'8');
  assert.equal(await page.locator('#ffo-gc-games button[data-ffo-game]').count(),14);
  await page.locator('[data-ffo-game="sun0"]').click();
  await page.waitForFunction(()=>window.ffoGameCast.getStatus().playCount===1);
  assert.equal((await page.evaluate(()=>window.ffoGameCast.getStatus())).game,'sun0');
  await page.locator('nav button[data-page="gamecast"]').evaluate(e=>e.classList.add('active'));
  await page.waitForFunction(()=>window.ffoGameCast.getStatus().backgroundGamePbpCount>=1,
   {timeout:10000});
  assert.match(await page.locator('[data-ffo-game="sun1"]').innerText(),/Other-game plays/);
  assert.equal(errors.length,0,errors.join('; '));
  assert.ok(refreshCount>=1);
  const viewport=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:window.innerWidth}));
  assert.ok(viewport.scrollWidth<=viewport.width+2,JSON.stringify(viewport));
  // Regression for Coach's 10:24 iPhone screenshot: no four narrow, empty
  // columns; groups must stack and cards fill the available mobile width.
  for(const width of [375,390,430,600,1024]){
   await page.setViewportSize({width,height:844});
   const bounds=await page.evaluate(()=>{
    const parent=document.querySelector('#ffo-gc-games').getBoundingClientRect();
    const groups=[...document.querySelectorAll('#ffo-gc-games .ffo-gc-week-group')];
    const first=document.querySelector('#ffo-gc-games .ffo-gc-game');
    const firstGroup=groups[0]?.getBoundingClientRect();
    const secondGroup=groups[1]?.getBoundingClientRect();
    return {parentWidth:parent.width,groupCount:groups.length,
     firstWidth:first?.getBoundingClientRect().width||0,
     top1:firstGroup?.top??0,bottom1:firstGroup?.bottom??0,
     top2:secondGroup?.top??0,
     scrollWidth:document.documentElement.scrollWidth,viewportWidth:window.innerWidth,
     text:first?.innerText||''};
   });
   assert.ok(bounds.groupCount>=3,'Expected Today, Earlier, Upcoming groups: '+JSON.stringify(bounds));
   assert.ok(bounds.top2>=bounds.bottom1-2,'Group columns must stack vertically: '+JSON.stringify(bounds));
   assert.ok(bounds.scrollWidth<=bounds.viewportWidth+2,'No page-wide scroll: '+JSON.stringify(bounds));
   if(width<=600)assert.ok(bounds.firstWidth>=Math.min(bounds.parentWidth*.85,300),
    'Mobile game cards must occupy near-full width: '+JSON.stringify(bounds));
   assert.doesNotMatch(bounds.text,/2026-11-01T18:00:05Z/,'Do not show raw ISO timestamps on cards');
  }
 }finally{await browser.close()}
});
