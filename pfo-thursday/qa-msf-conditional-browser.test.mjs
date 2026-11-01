// True UI rendering regression for the conditional historical scoring card.
// Uses real PFO GameCast renderer + read-only MSF synthetic source fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {playerScoringPlayCandidates} from './ffo-gamecast-model.mjs';
import {correlateWeeklyPlayerEvents} from './ffo-same-game-player-evidence.mjs';
import {eventScoreScenarios} from './ffo-msf-event-score-scenarios.mjs';
const file=name=>readFileSync(join(import.meta.dirname,name),'utf8');
const rules=JSON.parse(file('FFO_FFL_SCORING_V1.json')).scoring;
const players=[
 {id:'18607',name:'Jordan Love',team:'GB',position:'QB',jersey:'10'},
 {id:'39108',name:'Christian Watson',team:'GB',position:'WR',jersey:'9'},
 {id:'166697',name:'Matthew Golden',team:'GB',position:'WR',jersey:'0'}
];
const plays=[
 '(5:57) 10-J.Love pass deep left to 9-C.Watson for 42 yards, TOUCHDOWN.',
 '(13:19) 10-J.Love pass deep middle to 9-C.Watson for 53 yards, TOUCHDOWN.',
 'TWO-POINT CONVERSION ATTEMPT. 10-J.Love pass to 0-M.Golden is complete. ATTEMPT SUCCEEDS.'
].map(description=>({description,playStatus:{quarter:2,teamInPossession:{abbreviation:'GB'}}}));
const evidence=playerScoringPlayCandidates({gameplaybyplay:{plays}},players,'GB',rules);
const playerGamelogs=players.map(p=>({...p,game:{id:'163616'},stats:
 p.id==='18607'?{passing:{passTD:2}}:
 p.id==='39108'?{receiving:{recTD:2}}:{receiving:{receptions:3}}
}));
const scoringSummary={gameId:'163616',finalScoreVerified:true,events:[
 {period:2,scoringSide:'GB',scoringPoints:2,
  description:'TWO-POINT CONVERSION ATTEMPT. 10-J.Love pass to 0-M.Golden is complete. ATTEMPT SUCCEEDS.'}
]};
const joined=correlateWeeklyPlayerEvents({
 gameId:'163616',teamAbbreviation:'GB',players:playerGamelogs,
 evidence,boxEvidence:{gameId:'163616',sourceFinalVerified:true,
 scheduleFinalVerified:true,scheduleScoreMatches:true},
 scoringSummary,rules
});
const eventScenarios=eventScoreScenarios({
 ledger:joined.ledger,corroboration:joined.twoPointCorroboration,rules
});
const report={
 team:'GB',weeks:[],seasonChecked:false,lowerBound:null,seasonFilterVerified:false,
 scoringEvidence:null,teamEvidence:null,teamEvidenceError:null,teamWeeks:[],
 kickEvidence:null,kickEvidenceError:null,kickWeeks:[],dstPlayWeeks:[],dstBoxWeeks:[],
 playerEventWeeks:[{week:5,game:'CHI @ GB',evidence,sameGameReconciliation:joined,eventScenarios}]
};

test('Actual mobile GameCast audit renders ID-less Week 5 conditional bonus alternatives', {timeout:60000},async()=>{
 assert.equal(evidence.events.every(p=>p.sourceId===null),true);
 assert.equal(eventScenarios.players.find(x=>x.playerId==='18607').highestOnlyCandidatePoints,5);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.route('https://pfo.test/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/')return route.fulfill({contentType:'text/html',body:
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+
    '<div id="ffo-gc-stat-audit-results"></div></body></html>'});
   if(['/ffo-gamecast-model.mjs','/ffo-gamecast-stadium.mjs',
     '/ffo-same-game-player-evidence.mjs','/ffo-scoring-reconciliation.mjs',
     '/ffo-msf-event-score-scenarios.mjs','/ffo-gamecast-weeks.mjs'].includes(path))
     return route.fulfill({contentType:'text/javascript',body:file(path.slice(1))});
   if(path==='/ffo-gamecast-stadium.css')return route.fulfill({contentType:'text/css',body:file('ffo-gamecast-stadium.css')});
   return route.fulfill({status:404,contentType:'application/json',body:'{}'});
  });
  await page.goto('https://pfo.test/');
  const raw=file('ffo-gamecast.js');
  const injected=raw.replace(' window.ffoGameCast={',
   ' window.__ffoQaRenderStatAudit=renderStatAudit;\n window.ffoGameCast={');
  assert.notEqual(raw,injected,'GameCast QA instrumentation must attach to the real renderer');
  await page.addScriptTag({content:injected});
  await page.waitForFunction(()=>typeof window.__ffoQaRenderStatAudit==='function');
  await page.evaluate(r=>window.__ffoQaRenderStatAudit(r),report);
  const root=page.locator('#ffo-gc-stat-audit-results');
  await root.locator('summary').filter({hasText:'Player TD bonuses & two-point evidence'}).click();
  await root.locator('summary').filter({hasText:'Week 5'}).first().click();
  await root.locator('summary').filter({hasText:'Same-game MSF player cross-check'}).click();
  const summary=root.locator('summary').filter({hasText:'Conditional scoring alternatives'});
  assert.equal(await summary.count(),1,'Conditional scoring alternatives must actually render');
  await summary.click();
  const scenarios=await summary.locator('xpath=..').innerText();
  assert.match(scenarios,/Jordan Love/);
  assert.match(scenarios,/Christian Watson/);
  assert.match(scenarios,/Matthew Golden/);
  assert.match(scenarios,/5 if highest-only \/ 6 if 40\+ and 50\+ stack/);
  assert.match(scenarios,/3 if highest-only \/ 4 if 40\+ and 50\+ stack/);
  assert.match(scenarios,/2 if highest-only \/ 2 if 40\+ and 50\+ stack/);
  assert.match(scenarios,/NOT final FFL totals/);
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  const noPageWideOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2);
  assert.equal(noPageWideOverflow,true,'scenario card must not force phone-wide horizontal scroll');
 }finally{await browser.close();}
});
