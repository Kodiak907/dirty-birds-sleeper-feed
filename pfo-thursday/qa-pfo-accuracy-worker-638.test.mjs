import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './accuracy-worker-638.mjs';
import {readFileSync} from 'node:fs';

const cfg=readFileSync(new URL('./wrangler.accuracy.toml',import.meta.url),'utf8');
const code=readFileSync(new URL('./accuracy-worker-638.mjs',import.meta.url),'utf8');
const execute=async({path='/health',method='GET',tables=3,triggers=6,throwQuery=false,db=true}={})=>{
 const queries=[];
 const dbMock={prepare(sql){queries.push(sql);return {async all(){
  if(throwQuery)throw Error('database inaccessible');
  return {results:[
   ...['pfo_accuracy_forecasts','pfo_accuracy_final_certificates','pfo_accuracy_verified_games',
    'pfo_accuracy_final_revisions']
    .slice(0,tables).map(name=>({type:'table',name})),
   ...['immutable_accuracy_forecasts_update','immutable_accuracy_forecasts_delete',
    'immutable_accuracy_final_update','immutable_accuracy_final_delete',
    'immutable_accuracy_games_update','immutable_accuracy_games_delete',
    'immutable_accuracy_revisions_update','immutable_accuracy_revisions_delete']
    .slice(0,triggers).map(name=>({type:'trigger',name}))]};
 }};}};
 const response=await worker.fetch(new Request('https://pfo-accuracy-lab-worker.example'+path,{method}),
  db?{PFO_ACCURACY_DB:dbMock}:{});
 return {response,data:await response.json(),queries};
};
test('separate live D1 health endpoint checks schema and always reports capture inactive',async()=>{
 const {response,data,queries}=await execute();
 assert.equal(response.status,200);
 assert.equal(data.status,'schema_verified');
 assert.equal(data.tablesVerified,3);
 assert.equal(data.immutableTriggersVerified,6);
 assert.equal(data.schemaReady,true);
 assert.equal(data.automaticCaptureActive,false);
 assert.equal(data.independentResultsActive,false);
 assert.equal(data.accuraciesCertified,false);
 assert.equal(data.ffoiIntegrated,false);
 assert.equal(data.commissionerDatabaseAccessible,false);
 assert.ok(response.headers.get('cache-control').includes('no-store'));
 assert.equal(queries.length,1);
 assert.match(queries[0],/sqlite_master/);
 assert.doesNotMatch(queries[0],/\b(?:INSERT|UPDATE|DELETE)\b/i);
});
test('wrong route, mutation, or missing binding fail closed without touching database',async()=>{
 for(const options of [{path:'/records'},{path:'/api/commissioner'},{method:'POST'}]){
  const out=await execute(options);
  assert.equal(out.response.status,404);
  assert.equal(out.queries.length,0);
 }
 const missing=await execute({db:false});
 assert.equal(missing.response.status,503);
 assert.equal(missing.data.status,'blocked');
 assert.equal(missing.data.automaticCaptureActive,false);
 assert.equal(missing.queries.length,0);
});
test('missing tables, missing triggers, or D1 read failures report unavailable',async()=>{
 const a=await execute({tables:2}),b=await execute({triggers:5}),c=await execute({throwQuery:true});
 assert.equal(a.response.status,503);
 assert.equal(b.response.status,503);
 assert.equal(c.response.status,503);
 assert.equal(a.data.schemaReady,false);
 assert.equal(b.data.schemaReady,false);
 assert.equal(c.data.status,'blocked');
});
test('Wrangler points exclusively at new approved accuracy DB, never Commissioner DB',()=>{
 assert.match(cfg,/name = "pfo-accuracy-lab-worker"/);
 assert.match(cfg,/main = "accuracy-worker-638.mjs"/);
 assert.match(cfg,/binding = "PFO_ACCURACY_DB"/);
 assert.match(cfg,/database_name = "pfo-accuracy-lab"/);
 assert.match(cfg,/database_id = "7b354629-96ee-454e-9939-6674dd2a32d7"/);
 assert.doesNotMatch(cfg,/\bCOMMISSIONER_DB\b/);
 assert.doesNotMatch(code,/api\/commissioner|PFO_SCORE_WRITE|scheduled\s*\(/);
 assert.equal(cfg.includes('crons ='),false);
});

test('6.43 proposed D1 schema is accepted only with all four tables and all eight immutable triggers',async()=>{
 const migrated=await execute({tables:4,triggers:8});
 assert.equal(migrated.response.status,200);
 assert.equal(migrated.data.schemaVersion,2);
 assert.equal(migrated.data.tablesVerified,4);
 assert.equal(migrated.data.immutableTriggersVerified,8);
 assert.equal(migrated.data.correctionRevisionTableReady,true);
 assert.equal(migrated.data.automaticCaptureActive,false);
 const partial1=await execute({tables:4,triggers:6});
 const partial2=await execute({tables:3,triggers:8});
 assert.equal(partial1.response.status,503);
 assert.equal(partial2.response.status,503);
 assert.equal(partial1.data.correctionRevisionTableReady,false);
 assert.equal(partial2.data.correctionRevisionTableReady,false);
});
