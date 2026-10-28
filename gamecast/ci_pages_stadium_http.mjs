// FFO GameCast Stadium v1 — one-time preview-only Pages uploader.
// Downloads an exact, immutable GitHub PFO preview commit; never touches Pages main.
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const repo='Kodiak907/dirty-birds-sleeper-feed';
const commit='3d01a0c1923612e8007a6b7d0fb4a4acb2da1139';
const files=['index.html','_worker.js','ffo-gamecast.js','ffo-gamecast-model.mjs','ffo-gamecast-stadium.mjs','ffo-gamecast-stadium.css','ffo-quickview.js','ffo-quickview.css','ffo-commissioner-57.js','ffo-commissioner-57.css','wrangler.jsonc'];
const base=resolve(process.cwd(),'../ffo-stadium-preview-one-time');
await mkdir(base,{recursive:true});
async function download(filename){
 const url='https://raw.githubusercontent.com/'+repo+'/'+commit+'/pfo-thursday/'+filename;
 for(let attempt=1;attempt<=4;attempt++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(35000),headers:{'user-agent':'ffo-stadium-preview-uploader/1.0'}});
   if(!response.ok)throw Error(filename+' HTTP '+response.status);
   const bytes=new Uint8Array(await response.arrayBuffer());
   if(bytes.length<50)throw Error(filename+' unexpectedly short: '+bytes.length);
   await writeFile(join(base,filename),bytes);
   console.log('PFO_STADIUM_FILE: '+filename+' '+bytes.length+' bytes');
   return;
  }catch(error){if(attempt===4)throw Error('Failed to download '+filename+': '+String(error));await new Promise(r=>setTimeout(r,1000*attempt));}
 }
}
for(const f of files)await download(f);
const index=await readFile(join(base,'index.html'),'utf8');
const js=await readFile(join(base,'ffo-gamecast.js'),'utf8');
const stadium=await readFile(join(base,'ffo-gamecast-stadium.mjs'),'utf8');
const css=await readFile(join(base,'ffo-gamecast-stadium.css'),'utf8');
const worker=await readFile(join(base,'_worker.js'),'utf8');
const quick=await readFile(join(base,'ffo-quickview.js'),'utf8');
const quickCss=await readFile(join(base,'ffo-quickview.css'),'utf8');
const commissioner=await readFile(join(base,'ffo-commissioner-57.js'),'utf8');
const comStyles=await readFile(join(base,'ffo-commissioner-57.css'),'utf8');
if(!index.includes('window.ffoLoadGameCast')||!index.includes('ffoReportMemo')||!js.includes("import('/ffo-gamecast-stadium.mjs')")||!stadium.includes('GameCast Stadium v1')||!css.includes('.gc6-shell')||!worker.includes('GAMECAST_INTERNAL')||!index.includes('/ffo-quickview.js')||!index.includes('/ffo-quickview.css')||!quick.includes('FFO PFO 5.7')||!quickCss.includes('#ffo57-sheet')||!index.includes('ffo-commissioner-57.js')||!index.includes('ffo-commissioner-57.css')||!commissioner.includes('SCORE')&&false||!commissioner.includes('com57-form')||!comStyles.includes('#com57'))throw Error('PREVIEW_INTEGRITY_FAILED');
const token=process.env.PFO_PAGES_DEPLOY_TOKEN;
if(!token)throw Error('PFO_PAGES_DEPLOY_TOKEN_BUILD_SECRET_MISSING');
console.log('PFO57_PREVIEW_UPLOAD: protected Pages preview only, branch pfo-thursday-staging, commit '+commit);
const args=['--yes','wrangler','pages','deploy',base,'--project-name','dirtybirdstest','--branch','pfo-thursday-staging','--commit-message','FFO PFO 5.7 Commissioner Command + Player QuickView Preview'];
await new Promise((ok,bad)=>{
 const child=spawn('npx',args,{stdio:'inherit',shell:false,env:{...process.env,CLOUDFLARE_API_TOKEN:token}});
 child.on('error',bad);child.on('exit',c=>c===0?ok():bad(Error('PAGES_PREVIEW_UPLOAD_EXIT_'+c)));
});
console.log('PFO57_PREVIEW_UPLOAD: COMPLETE. Pages main untouched.');
