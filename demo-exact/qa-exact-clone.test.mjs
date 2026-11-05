import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const base='demo-exact-dist',get=(p)=>readFileSync(join(base,p),'utf8');
const fixtures=JSON.parse(get('demo-data/demo-fixture.json'));
const models=JSON.parse(get('demo-data/demo-model.json'));
const html=get('index.html'),core=get('ffo-pfo-core.js');
test('actual PFO application is copied, not replaced with separate showcase',()=>{
 assert.match(html,/data-page="gamecast"/);
 assert.match(html,/data-page="market"/);
 assert.match(html,/data-page="commissioner"/);
 assert.match(html,/ffo-pfo-core.js/);
 assert.match(html,/ffo-gamecast/);
 assert.match(html,/ffo-waiver-meta/);
 assert.match(core,/pfo52Render/);
 assert.ok(core.length>250000);
 assert.ok(readdirSync(base).filter(x=>x.endsWith('.js')).length>=15);
});
test('real league endpoints are not embedded in public JS or HTML',()=>{
 const forbidden=/1399157532559192064|dirty-birds-sleeper-feed|tvega2924|raw.githubusercontent.com\/Kodiak907|BigOlBoyle|DMccolley03|dirty-birds-monitor/i;
 for(const file of readdirSync(base)){
  if(!/\.(js|html|mjs)$/.test(file)||file==='_worker.js')continue;
  assert.doesNotMatch(get(file),forbidden,'unexpected user source in '+file);
 }
 assert.doesNotMatch(core,/https:\/\/api.sleeper.app\/v1/);
 assert.doesNotMatch(core,/https:\/\/raw.githubusercontent.com\/Kodiak907/);
 assert.match(core,/\/demo-sleeper\/v1/);
 assert.match(core,/\/demo-data\//);
 assert.ok(!existsSync(join(base,'commissioner-pin-setup.html')));
 assert.ok(!existsSync(join(base,'FFO_CHAMPIONSHIP_100K.json')));
});
test('sample league is twelve fictional teams, no user owner IDs or live league data',()=>{
 assert.equal(fixtures.league_id,'2222222222222222222');
 assert.equal(fixtures.league.name,'PFO Demonstration League');
 assert.equal(fixtures.rosters.length,12);
 assert.equal(fixtures.users.length,12);
 assert.equal(fixtures.rosters[0].starters.length,10);
 assert.ok(fixtures.rosters.every(r=>r.owner_id.startsWith('demo_manager_')));
 assert.ok(fixtures.users.every(u=>u.display_name.startsWith('Demo Manager')));
 assert.ok(fixtures.matchups_by_week['9'].length===12);
 assert.ok(fixtures.rosters.every(r=>r.players.length>=16));
 assert.ok(new Set(fixtures.rosters.flatMap(r=>r.players)).size===fixtures.rosters.reduce((n,r)=>n+r.players.length,0));
});
test('model input is transparently illustrative and can cover roster/K/DST',()=>{
 assert.equal(models.source,'PFO DEMO');
 assert.notEqual(models.source_type,'licensed_primary');
 assert.ok(models.players.length>=100);
 for(const id of fixtures.rosters[0].starters){
  const names=JSON.parse(get('demo-data/player_names.json'));
  const p=names[id];
  assert.ok(models.players.some(x=>x.name===p.name&&x.team===p.team&&x.forecast));
 }
});
test('private pages remain protected at API boundary',async()=>{
 const worker=(await import('../demo-exact-dist/_worker.js')).default;
 const url='https://ffo-pfo-exact-demo.pages.dev';
 const fixtureContent=name=>get('demo-data/'+name);
 const env={ASSETS:{fetch:async(req)=>{
   const path=new URL(req.url).pathname;
   if(path.startsWith('/demo-data/'))return new Response(fixtureContent(path.slice('/demo-data/'.length)),{status:200});
   return new Response('',{status:404});
 }}};
 const deny=await worker.fetch(new Request(url+'/api/commissioner/cases'),env);
 assert.equal(deny.status,403);
 const gamecast=await worker.fetch(new Request(url+'/api/ffo/gamecast/health'),env);
 assert.equal(gamecast.status,200);
 const gc=await gamecast.json();
 assert.match(gc.source,/FICTIONAL GAMECAST/);
 assert.equal(gc.live,false);
 assert.equal(gc.licensed,false);
 const gamecastSchedule=await worker.fetch(new Request(url+'/api/ffo/gamecast/schedule?season=2026-regular'),env);
 assert.equal(gamecastSchedule.status,200);
 const schedule=await gamecastSchedule.json();
 assert.equal(schedule.demo,true);
 assert.ok(schedule.data.games.length>=54);
 const fakePlays=await worker.fetch(new Request(url+'/api/ffo/gamecast/plays?season=2026-regular&game_id=50090'),env);
 assert.equal(fakePlays.status,200);
 assert.ok((await fakePlays.json()).data.gameplaybyplay.plays.every(p=>p.description.startsWith('DEMO:')));
 const blocked=await worker.fetch(new Request(url+'/api/ffo/gamecast/plays',{method:'POST'}),env);
 assert.equal(blocked.status,403);
 const old=await worker.fetch(new Request(url+'/demo-sleeper/v1/league/1399157532559192064/rosters'),env);
 assert.equal(old.status,403);
 const roster=await worker.fetch(new Request(url+'/api/roster?league_id=1399157532559192064&roster_id=1'),env);
 const data=await roster.json();
 assert.equal(data.league_id,fixtures.league_id);
 assert.equal(data.roster_id,1);
 assert.match(data.source,/DEMO/);
 const modeled=await worker.fetch(new Request(url+'/api/ffo/stats/season'),env);
 assert.equal(modeled.status,200);
 assert.equal((await modeled.json()).source,'PFO DEMO');
});
