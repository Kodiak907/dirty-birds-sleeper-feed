import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import worker from './_worker.js';
const base='https://ffo-league-demo.pages.dev';
const fixture=JSON.parse(readFileSync(new URL('./sample-rosters.json',import.meta.url),'utf8'));
const enc=x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');
test('valid Access-signed invited member receives ONLY matching sample-player MSF aggregates',async()=>{
 const crypto=webcrypto;
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,
  publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='ffo-demo-test-key';
 const issuer='https://ffo-test.cloudflareaccess.com',aud='test-audience-for-pfo-demo';
 const now=Math.floor(Date.now()/1000);
 const header=enc({alg:'RS256',kid:jwk.kid,typ:'JWT'});
 const claims=enc({iss:issuer,aud:[aud],email:'member@example.test',iat:now-5,exp:now+300});
 const bytes=new TextEncoder().encode(header+'.'+claims);
 const signature=await crypto.subtle.sign({name:'RSASSA-PKCS1-v1_5'},keys.privateKey,bytes);
 const jwt=header+'.'+claims+'.'+Buffer.from(signature).toString('base64url');
 const originalFetch=globalThis.fetch,originalCrypto=globalThis.crypto;
 globalThis.fetch=async(input,init)=>{
  const url=String(input);
  if(url===issuer+'/cdn-cgi/access/certs')return Response.json({keys:[jwk]});
  if(url.includes('api.mysportsfeeds.com')){
   assert.match(init.headers.authorization,/^Basic /);
   return Response.json({playerStatsTotals:[
    {player:{fullName:'Josh Allen',primaryPosition:'QB'},team:{abbreviation:'BUF'},
     stats:{gamesPlayed:4,passing:{passYards:1000,passTD:8,passInt:2},rushing:{rushYards:130}}},
    {player:{fullName:'Non Sample Player',primaryPosition:'QB'},team:{abbreviation:'BUF'},
     stats:{gamesPlayed:4,passing:{passYards:3000}}}
   ]});
  }
  throw Error('Unexpected external request: '+url);
 };
 if(!globalThis.crypto)globalThis.crypto=crypto;
 const env={ASSETS:{fetch:async()=>Response.json(fixture)},MSF_API_KEY:'dummy-unit-test-key',
  DEMO_ACCESS_ISSUER:issuer,DEMO_ACCESS_AUD:aud,DEMO_ALLOWED_EMAILS:'member@example.test',
  MSF_MEMBER_SHARING_APPROVED:'true'};
 try{
  const headers={'Cf-Access-Jwt-Assertion':jwt};
  const status=await worker.fetch(new Request(base+'/api/demo/msf/status',{headers}),env);
  assert.equal(status.status,200);
  const detail=await worker.fetch(new Request(base+'/api/demo/msf/season?team=BUF',{headers}),env);
  assert.equal(detail.status,200);
  const json=await detail.json();
  assert.equal(json.source,'MySportsFeeds');
  assert.equal(json.players.length,1);
  assert.equal(json.players[0].name,'Josh Allen');
  assert.equal(json.players[0].games_observed,4);
  assert.equal(json.players[0].per_game.pass_yd,250);
  assert.ok(!JSON.stringify(json).includes('Non Sample Player'));
  assert.ok(!JSON.stringify(json).includes('dummy-unit-test-key'));
  assert.equal(detail.headers.get('access-control-allow-origin'),null);
  const denial=await worker.fetch(new Request(base+'/api/demo/msf/status',
   {headers:{'Cf-Access-Jwt-Assertion':(jwt.split('.').slice(0,2).join('.')+'.'+(jwt.split('.')[2][0]==='A'?'B':'A')+jwt.split('.')[2].slice(1))}}),env);
  assert.equal(denial.status,403);
 }finally{
  globalThis.fetch=originalFetch;
  if(!originalCrypto)delete globalThis.crypto;
 }
});
