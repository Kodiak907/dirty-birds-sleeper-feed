/* EXACT PFO BUILD: copy existing application assets, never redesign them.
 * Point all fantasy-manager sources at a separate fictional league; retain
 * public NFL research behind safe server routes, and deny admin/live MSF.
 */
import {readFileSync,writeFileSync,readdirSync,rmSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve('.'),src=join(root,'pfo-thursday'),
 target=resolve(process.argv[2]||'.pfo-exact-demo-output'),
 read=file=>readFileSync(join(root,file),'utf8'),
 write=(file,content)=>{const path=join(target,file);mkdirSync(resolve(path,'..'),{recursive:true});writeFileSync(path,content)};
if(target===root||target===src)throw Error('Unsafe build destination');
rmSync(target,{recursive:true,force:true});mkdirSync(target,{recursive:true});
const league='909090909090909090';
const seed=JSON.parse(read('pfo-demo-clone/seed-rosters.json'));
const rename={
 'Dirty Birds':'Front Office Collective',
 'DIRTY BIRDS':'FRONT OFFICE COLLECTIVE',
 'BigOlBoyle':'Sample Rival','Boyle':'Sample Rival',
 '1399157532559192064':league,
 'tvega2924':'ffo-demo-only'
};
function general(content){
 let text=content;
 text=text.replaceAll('https://raw.githubusercontent.com/Kodiak907/dirty-birds-sleeper-feed/main/data/','/demo-data/')
  .replaceAll('https://github.com/Kodiak907/dirty-birds-sleeper-feed/blob/main/data/','/demo-data/')
  .replaceAll('https://api.sleeper.app/v1','/api/demo-sleeper')
  .replaceAll('https://dirty-birds-monitor-git.tvega2924.workers.dev','/api/demo-monitor')
  .replaceAll('Kodiak907/dirty-birds-sleeper-feed','ffo-league-demo-sample')
  .replaceAll("Coach's","Manager's").replaceAll('Coach’s','Manager’s');
 for(const [from,to] of Object.entries(rename))text=text.split(from).join(to);
 return text;
}
let coreCount=0;
for(const file of readdirSync(src)){
 if(!/\.(html|css|js|mjs|json)$/.test(file)||/^qa-|^commissioner-pin-setup|\.test\.|^PFO_|^FFO_CHAMPIONSHIP/.test(file))continue;
 if(file==='_worker.js')continue;
 let text=readFileSync(join(src,file),'utf8');
 if(/\.(html|js|mjs)$/.test(file))text=general(text);
 if(file==='ffo-pfo-core.js'){
  coreCount++;
  const first=text.indexOf('const CURATED_WAIVER_CONTEXT='),last=text.indexOf('let autoScout=',first);
  if(first<0||last<first)throw Error('PFO original hardcoded coaching intel structure changed');
  text=text.slice(0,first)+'const CURATED_WAIVER_CONTEXT=[];\nconst CURATED_ACTIONS=[];\n'+text.slice(last);
  text=text.replace('const TRADE_VIEW_ONLY_ROSTER_ID=3','const TRADE_VIEW_ONLY_ROSTER_ID=-999');
  text=text.replace("const LEAGUE_ID_OVERRIDE='';","const LEAGUE_ID_OVERRIDE='"+league+"';");
  text=text.replaceAll('Garrett Wilson · A.J. Brown · Patrick Mahomes','Josh Allen · CeeDee Lamb · Breece Hall');
  text=text.replaceAll('Coach priorities','Demo franchise priorities');
  const focus="const focus=[{name:'Garrett Wilson',id:'8146'},{name:'A.J. Brown',id:'5859'},{name:'Patrick Mahomes',id:'4046'}];";
  const newFocus=['Josh Allen','CeeDee Lamb','Breece Hall'].map(name=>{
   const id=seed.rosters[0].players.find(i=>seed.players[i]?.name===name);
   if(!id)throw Error('Missing sample trade-block player: '+name);
   return {name,id};
  });
  if(!text.includes(focus))throw Error('Original trade block focus changed');
  text=text.replace(focus,'const focus='+JSON.stringify(newFocus)+';');
  text=text.replaceAll("data.source!=='MySportsFeeds'","data.source!=='FFO Demonstration Statistics'")
   .replaceAll("part?.source!=='MySportsFeeds'","part?.source!=='FFO Demonstration Statistics'")
   .replaceAll("source:'MySportsFeeds'","source:'FFO Demonstration Statistics'")
   .replaceAll('MySportsFeeds','FFO Demonstration Statistics');
  text=text.replaceAll('FFO DEMO independent stats','FFO demonstration model');
  text=text.replaceAll('Trade block — Manager priorities','Trade block — Demo research priorities');
 }
 if(file==='index.html'){
  text=text.replace('Dirty Birds Private Front Office · FFO 5.9 Development Preview',
   'PFO League Demo | Pro Front Office — Original Application Clone');
  text=text.replaceAll('PRIVATE FRONT OFFICE','PRO FRONT OFFICE');
  text=text.replaceAll('Coach&#39;s read-only command center','Read-only example franchise');
  text=text.replaceAll("Coach's read-only command center",'Read-only example franchise');
  text=text.replace('<body><main>','<body><main><div class="pfo-exact-demo-banner"><strong>FFO LEAGUE DEMO</strong> · Original PFO workspace · New fantasy franchise · Sample ownership and outcomes · Commissioner operations protected</div>');
  text=text.replace('</head>','<link rel="stylesheet" href="/pfo-exact-demo.css?v=1"></head>');
 }
 write(file,text);
}
if(coreCount!==1)throw Error('Main PFO core was not included');
write('pfo-exact-demo.css','.pfo-exact-demo-banner{border:1px solid #52786c;border-radius:10px;background:linear-gradient(95deg,#183b35,#203e50);padding:10px 13px;margin:5px 0 13px;font-size:11px;line-height:1.5;color:#daeee7}.pfo-exact-demo-banner strong{color:#f3c875;letter-spacing:.06em}@media(max-width:650px){.pfo-exact-demo-banner{font-size:10px;padding:8px 10px}}');
const original=read('pfo-thursday/_worker.js');
const exportText='export default {async fetch(request,env){';
if(!original.includes(exportText))throw Error('Original private API export changed; refuse deployment');
write('_worker.js',original.replace(exportText,'const ORIGINAL_PFO_BACKEND={async fetch(request,env){')+
 '\n'+read('pfo-demo-clone/demo-worker-wrapper.js'));
write('_headers','/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Cache-Control: no-store\n');
write('manifest.json',JSON.stringify({kind:'exact_copy_of_private_PFO_frontend',
 source_revision:'pfo-msf-week5-reconciliation-20261031',demo:true,
 league_id:league,roster_id:1,real_ffl_data:false,real_msf_public:false},null,2));
for(const file of readdirSync(target)){
 if(!/\.(html|js|css|json|mjs)$/.test(file)||file==='_worker.js')continue;
 const body=readFileSync(join(target,file),'utf8');
 for(const forbidden of ['1399157532559192064','tvega2924','BigOlBoyle','dirty-birds-sleeper-feed']){
  if(body.includes(forbidden))throw Error('Original private identifier in public asset '+file+': '+forbidden);
 }
}
console.log('PFO exact clone assembled: '+coreCount+' genuine PFO core, '+readdirSync(target).length+' original client assets');
