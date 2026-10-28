// FFO PFO 5.9 — one-time, preview-only physical test uploader.
// Run ONLY in the existing ffo-gamecast-staging Cloudflare Worker build environment
// where PFO_PAGES_DEPLOY_TOKEN already exists. NEVER commit a credential to GitHub.
// Commit of this helper does not itself deploy PFO Pages.
// Rollback: existing gamecast/ci_pages_stadium_http.mjs pins the last known 5.8.1 artifact.
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';

const repo='Kodiak907/dirty-birds-sleeper-feed';
const commit='42c9cafd2594b986ae695c2643e5d5e1a469376a';
const project='dirtybirdstest',previewBranch='pfo-thursday-staging';
const files=[
 'index.html','_worker.js','wrangler.jsonc',
 'ffo-pfo-core.js','ffo-pfo-core.css',
 'ffo-gamecast.js','ffo-gamecast-model.mjs','ffo-gamecast-stadium.mjs','ffo-gamecast-stadium.css',
 'ffo-quickview.js','ffo-quickview.css',
 'ffo-commissioner-57.js','ffo-commissioner-57.css',
 'ffo-pfo-59.js','ffo-pfo-59.css',
 'ffo-championship-59.js','ffo-championship-59.css',
 'ffo-mobile-594.js','ffo-mobile-594.css',
 'FFO_CHAMPIONSHIP_100K.json',
 'FFO_FFL_SCORING_V1.json',
 'commissioner-pin-setup.html'
];
if(!process.env.PFO_PAGES_DEPLOY_TOKEN)throw Error('EXISTING_CLOUDFLARE_BUILD_SECRET_NOT_PRESENT__DO_NOT_PASTE_TOKEN_IN_GITHUB');
if(files.some(f=>f.includes('/')||f.includes('..')))throw Error('UNSAFE_FILE_LIST');
const directory=await mkdtemp(join(tmpdir(),'ffo-pfo-59-preview-'));
async function fetchPinnedFile(name){
 const url='https://raw.githubusercontent.com/'+repo+'/'+commit+'/pfo-thursday/'+encodeURIComponent(name);
 for(let attempt=0;attempt<4;attempt++){
  try{
   const response=await fetch(url,{headers:{'user-agent':'ffo-pfo-59-preview-builder/1.0'},signal:AbortSignal.timeout(40000)});
   if(!response.ok)throw Error(name+': HTTP '+response.status);
   const bytes=new Uint8Array(await response.arrayBuffer());
   if(bytes.byteLength<35)throw Error(name+': unexpectedly short file');
   await writeFile(join(directory,name),bytes);
   console.log('FFO_PFO_59_FILE_VERIFIED '+name+' '+bytes.byteLength);
   return;
  }catch(e){if(attempt===3)throw e;await new Promise(r=>setTimeout(r,900*(attempt+1)))}
 }
}
for(const f of files)await fetchPinnedFile(f);
const get=async name=>readFile(join(directory,name),'utf8');
const html=await get('index.html');
const newJS=await get('ffo-pfo-59.js');
const model=await get('FFO_CHAMPIONSHIP_100K.json');
const cjs=await get('ffo-championship-59.js');
const worker=await get('_worker.js');
const wrangler=await get('wrangler.jsonc');
const report=JSON.parse(model);
if(report.schema!=='FFO_CHAMPIONSHIP_100K_V1'||report.simulations!==100000||report.teams?.length!==12)
 throw Error('PFO59_SIMULATION_INTEGRITY_FAILED');
const msf=await get('ffo-gamecast.js');
const rules=JSON.parse(await get('FFO_FFL_SCORING_V1.json'));
if(rules.schema!=='FFO_SCORING_RULES_V1'||Object.keys(rules.scoring||{}).length!==133||
 !msf.includes('/FFO_FFL_SCORING_V1.json')||msf.includes("feed('espnplays'")||
 worker.includes('ffoScEndpoint')||!worker.includes('ffoGamecastHandle'))throw Error('FFO_MSF_ONLY_PRIMARY_SCORING_CHECK_FAILED');
const mobile=await get('ffo-mobile-594.js');
if(!mobile.includes('ffo594-dock')||!html.includes('/ffo-mobile-594.js')||!html.includes('/ffo-mobile-594.css'))throw Error('PFO594_MOBILE_APP_MISSING');
if(!html.includes('5.9 DEVELOPMENT')||!html.includes('/ffo-championship-59.js')||!html.includes('/ffo-pfo-59.js')||
 !newJS.includes('pfo59-team-hub')||!cjs.includes('CHAMP_REPORT')||
 !worker.includes('FixedLengthStream(declared)')||!worker.includes('COMMISSIONER_EVIDENCE')||
 !wrangler.includes('COMMISSIONER_EVIDENCE')||!wrangler.includes('COMMISSIONER_DB'))
 throw Error('PFO59_PREVIEW_CONTENT_INTEGRITY_FAILED');
for(const file of files.filter(f=>f.endsWith('.js')&&f!=='_worker.js')){
 const contents=await get(file);
 try{new Function(contents)}catch(e){throw Error('BROWSER_SCRIPT_SYNTAX_ERROR '+file+': '+e.message)}
}
for(const p of [...html.matchAll(/(?:src|href)=["'](\/[^"']+\.(?:js|mjs|css|json))["']/g)].map(x=>x[1].slice(1))){
 if(!files.includes(p))throw Error('INDEX_REFERENCES_MISSING_ASSET '+p);
}
const token=process.env.PFO_PAGES_DEPLOY_TOKEN;
console.log('FFO_PFO_59_PREVIEW_ONLY_PAGES_UPLOAD '+JSON.stringify({project,previewBranch,commit,simulations:report.simulations}));
const args=['--yes','wrangler','pages','deploy',directory,'--project-name',project,'--branch',previewBranch,'--commit-message','FFO PFO 5.9 Physical Test - pinned '+commit.slice(0,12)];
await new Promise((resolve,reject)=>{
 const child=spawn('npx',args,{shell:false,stdio:'inherit',env:{...process.env,CLOUDFLARE_API_TOKEN:token}});
 child.on('error',reject);
 child.on('exit',code=>code===0?resolve():reject(Error('PREVIEW_DEPLOY_EXIT_'+code)));
});
console.log('FFO_PFO_59_PREVIEW_UPLOADED__CHECK_ACCESS_AND_STATUS_BEFORE_USER_TEST');
