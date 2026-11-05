import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './_worker.js';
const base='https://ffo-league-demo.pages.dev';
const assets={fetch:async()=>new Response('<html>safe static showcase</html>',{status:200,headers:{'content-type':'text/html'}})};
const request=(path,init={})=>new Request(base+path,init);
test('default deny: public visitors cannot access licensed MSF member statistics',async()=>{
 const env={ASSETS:assets};
 const status=await worker.fetch(request('/api/demo/msf/status'),env);
 assert.equal(status.status,403);
 assert.equal(status.headers.get('cache-control'),'private, no-store');
 assert.doesNotMatch(await status.text(),/MSF_API_KEY|authorization[\\s:=]|Bearer\\s+[A-Za-z0-9]|example-not-a-real-secret/i);
 const stats=await worker.fetch(request('/api/demo/msf/season?team=BUF'),env);
 assert.equal(stats.status,403);
});
test('still denies when a key exists but identity, separate access policy or sharing approval is missing',async()=>{
 const env={ASSETS:assets,MSF_API_KEY:'example-not-a-real-secret',DEMO_ACCESS_ISSUER:'https://test.cloudflareaccess.com',
  DEMO_ACCESS_AUD:'example-audience-value',DEMO_ALLOWED_EMAILS:'member@example.test'};
 assert.equal((await worker.fetch(request('/api/demo/msf/status'),env)).status,403);
 env.MSF_MEMBER_SHARING_APPROVED='true';
 assert.equal((await worker.fetch(request('/api/demo/msf/status'),env)).status,403);
 const forged=await worker.fetch(request('/api/demo/msf/status',{headers:{'Cf-Access-Jwt-Assertion':'invalid.jwt.token'}}),env);
 assert.equal(forged.status,403);
});
test('public static sample still serves normally without licensed MSF integration',async()=>{
 const res=await worker.fetch(request('/'),{ASSETS:assets});
 assert.equal(res.status,200);
 assert.match(await res.text(),/safe static showcase/);
});
test('only GET may query demo MSF routes',async()=>{
 const r=await worker.fetch(request('/api/demo/msf/status',{method:'POST'}),{ASSETS:assets});
 assert.equal(r.status,405);
});
