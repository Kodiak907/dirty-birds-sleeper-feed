// Isolated one-time PFO preview deployment from the existing Cloudflare Git build service.
// Never deploy Pages production ('main'); this uploads ONLY to a preview branch.
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
function run(bin,args){return new Promise((ok,bad)=>{const ch=spawn(bin,args,{stdio:'inherit',shell:false});ch.on('error',bad);ch.on('exit',code=>code===0?ok():bad(Error(bin+' exit code '+code)));});}
await run('git',['fetch','--depth=1','origin','pfo-thursday-staging']);
await run('git',['checkout','FETCH_HEAD','--','pfo-thursday']);
const directory=resolve(process.cwd(),'../pfo-thursday');
console.log('PFO_THURSDAY_PREVIEW: Publishing only isolated preview branch, never main');
await run('npx',['--yes','wrangler','pages','deploy',directory,'--project-name','dirtybirdstest','--branch','pfo-thursday-staging','--commit-message','PFO 5.5 Thursday GameCast staging']);
console.log('PFO_THURSDAY_PREVIEW: Complete');
