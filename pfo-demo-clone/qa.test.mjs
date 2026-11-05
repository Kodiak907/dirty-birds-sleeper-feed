import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve('.pfo-exact-demo-output');
const raw=p=>readFileSync(join(root,p),'utf8'),data=p=>JSON.parse(raw(p));
const html=raw('index.html');
const manifest=data('manifest.json');
const snapshot=data('demo-data/latest.json');
const names=data('demo-data/player_names.json');
let worker,env;
test.before(async()=>{
 worker=(await import(pathToFileURL(join(root,'_worker.js')).href)).default;
 env={ASSETS:{fetch:async(request)=>{
  const pathname=new URL(request.url).pathname;
  if(pathname==='/_worker.js')return new Response('not found',{status:404});
  const path=join(root,pathname);
  if(!path.startsWith(root+'/'))return new Response('not found',{status:404});
  try{const bytes=readFileSync(path);
   return new Response(bytes,{headers:{'content-type':pathname.endsWith('.json')?'application/json':'text/plain'}});
  }catch{return new Response('not found',{status:404})}
 }}};
});
const get=(path,options)=>worker.fetch(new Request('https://ffo-pfo-exact-demo.pages.dev'+path,options),env);
test('identical PFO page, tabs and modules, NOT a substituted mini simulator',()=>{
 assert.match(html,/<h1>.*FRONT OFFICE/);
 assert.ok(html.includes('ffo-pfo-core.js?v=690'));
 assert.ok(html.includes('ffo-pfo-597.js?v=690'));
 assert.ok(html.includes('ffo-gamecast'));
 const orig=readFileSync('pfo-thursday/index.html','utf8');
 for(const page of ['overview','roster','scouting','playerhub','gamecast','radar','ask','matchup',
  'coaching','championship','availability','market','privacy','commissioner']){
  assert.match(html,new RegExp('data-page="'+page+'"'));
  assert.match(orig,new RegExp('data-page="'+page+'"'));
 }
 assert.equal(manifest.kind,'exact_copy_of_private_PFO_frontend');
});
test('new fictitious 12-team fantasy league contains real NFL players without original manager records',()=>{
 assert.equal(snapshot.rosters.length,12);assert.equal(snapshot.users.length,12);
 assert.equal(snapshot.league_id,'909090909090909090');
 assert.equal(snapshot.users[0].metadata.team_name,'The Front Office Collective');
 assert.equal(snapshot.rosters[0].starters.length,10);
 assert.equal(snapshot.rosters[0].players.length,17);
 assert.ok(Object.values(names).some(p=>p.name==='Josh Allen'));
 assert.ok(Object.values(names).some(p=>p.name==='Puka Nacua'));
 assert.ok(!JSON.stringify(snapshot).includes('1399157532559192064'));
 assert.ok(snapshot.matchups_by_week['9'].length===12);
});
test('public JS assets cannot expose original league ID, manager brand or snapshot feed',()=>{
 for(const file of readdirSync(root).filter(f=>/\.(html|js|css|mjs)$/.test(f)&&f!=='_worker.js')){
  const src=raw(file);
  for(const prohibited of ['1399157532559192064','dirty-birds-sleeper-feed',
   'tvega2924','BigOlBoyle','raw.githubusercontent.com/Kodiak907']){
   assert.ok(!src.includes(prohibited),prohibited+' present in '+file);
  }
 }
 const code=raw('ffo-pfo-core.js');
 assert.match(code,/const FEED='\/demo-data\/'/);
 assert.match(code,/LEAGUE_ID_OVERRIDE='909090909090909090'/);
 assert.match(code,/const CURATED_WAIVER_CONTEXT=\[\]/);
 assert.match(code,/FFO Demonstration Statistics/);
});
test('demo roster uses original shape and cannot fetch real league ID',async()=>{
 const r=await get('/api/roster?league_id=909090909090909090&roster_id=1');
 assert.equal(r.status,200);
 const j=await r.json();
 assert.equal(j.players.length,17);assert.equal(j.starters.length,10);
 assert.equal(j.source,'FFO DEMONSTRATION ROSTER — NOT SLEEPER LIVE');
 assert.equal(j.players.find(p=>p.name==='Josh Allen').position,'QB');
 const wrong=await get('/api/roster?league_id=1399157532559192064&roster_id=1');
 assert.equal(wrong.status,403);
});
test('exact client Sleeper paths are served only with fictional league data',async()=>{
 const rosters=await get('/api/demo-sleeper/league/909090909090909090/rosters');
 assert.equal(rosters.status,200);assert.equal((await rosters.json()).length,12);
 const users=await get('/api/demo-sleeper/league/909090909090909090/users');
 assert.equal((await users.json())[0].display_name,'The Front Office Collective');
 const matches=await get('/api/demo-sleeper/league/909090909090909090/matchups/9');
 assert.equal((await matches.json()).length,12);
 const blocked=await get('/api/demo-sleeper/league/1399157532559192064/rosters');
 assert.equal(blocked.status,404);
});
test('no public Commissioner APIs, internal monitor or licensed live GameCast',async()=>{
 for(const path of ['/api/commissioner/session','/api/commissioner/cases',
  '/api/monitor-health','/api/ffo/gamecast/plays?game=1']){
  const res=await get(path);assert.equal(res.status,403,path+' should be denied');
 }
 const mutated=await get('/api/commissioner/cases',{method:'POST'});
 assert.equal(mutated.status,405);
});
test('demo model is full and explicitly synthetic, never mislabeled paid MSF',async()=>{
 const r=await get('/api/ffo/stats/season');
 assert.equal(r.status,200);
 const j=await r.json();
 assert.ok(j.players.length>=100);
 assert.equal(j.source,'FFO Demonstration Statistics');
 assert.match(j.projection_method,/NOT MSF/);
 const team=await get('/api/ffo/stats/season?team=BUF');
 const x=await team.json();
 assert.ok(x.players.every(p=>p.team==='BUF'));
});
