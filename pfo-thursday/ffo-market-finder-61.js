/* PFO 6.3: provider-neutral screened Trade Finder and automatic Waiver Pairs.
 * Read-only, no league mutations or unsourced acceptance probabilities.
 */
(()=>{'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=x=>typeof x==='number'&&Number.isFinite(x)?(x>0?'+':'')+x.toFixed(1):'—';
 const state={trade:{partner:'all',objective:'BALANCED',mode:'FAIR',shape:'ANY',fairOnly:true,preferUneven:true,rows:[],diagnostics:null,
  stamp:'',pending:false,error:''},
  waiver:{position:'ALL',rows:[],reason:'',stamp:'',pending:false,error:''},
  protectedMine:[],protectedOthers:{},loadedKey:null};
 let engine=null,loading=null;
 const ctx=includeWaivers=>window.ffoPfo59?.marketResearchContext?.({includeWaivers})||null;
 const host=t=>document.getElementById('pfo61-'+t+'-research');
 const storageKey=context=>'pfo63:market-controls:'+String(context?.leagueId||'ffl-pending')+':'+String(context?.ownerRosterId||'1');
 function loadPrefs(context){
  const key=storageKey(context);if(state.loadedKey===key)return;
  state.loadedKey=key;
  try{
   const data=JSON.parse(localStorage.getItem(key)||'null');
   if(data&&typeof data==='object'){
    state.protectedMine=Array.isArray(data.mine)?data.mine.map(String).slice(0,35):[];
    state.protectedOthers=data.others&&typeof data.others==='object'?data.others:{};
    if(['BALANCED','QB','RB','WR','TE'].includes(data.objective))state.trade.objective=data.objective;
    if(['FAIR','FLEECE','MULTI'].includes(data.mode))state.trade.mode=data.mode;
    if(['ANY','1 for 1','2 for 1','1 for 2','2 for 2','3 for 1','1 for 3','3 for 2','2 for 3'].includes(data.shape))state.trade.shape=data.shape;
    if(typeof data.fairOnly==='boolean')state.trade.fairOnly=data.fairOnly;
    if(typeof data.preferUneven==='boolean')state.trade.preferUneven=data.preferUneven;
   }
  }catch(error){console.warn('FFO local trade preferences unavailable',error);}
 }
 function savePrefs(){
  try{localStorage.setItem(state.loadedKey,JSON.stringify({mine:state.protectedMine,
    others:state.protectedOthers,objective:state.trade.objective,
    mode:state.trade.mode,shape:state.trade.shape,fairOnly:state.trade.fairOnly,preferUneven:state.trade.preferUneven}));}catch{}
 }
 function getEngine(){
  if(engine)return Promise.resolve(engine);
  if(!loading)loading=import('/ffo-market-quality-63.mjs?v=660').then(m=>(engine=m)).catch(error=>{
   loading=null;throw error;});
  return loading;
 }
 function mount(){
  for(const [type,anchor] of [['trade','pfo59-trade-board'],['waiver','pfo59-waiver-board']]){
   const reference=document.getElementById(anchor);
   if(reference&&!host(type)){
    const section=document.createElement('section');section.id='pfo61-'+type+'-research';
    section.className='pfo61-research';
    section.setAttribute('aria-label',type==='trade'?'Screened trade ideas':'Automatic waiver add and drop research');
    reference.before(section);
   }
  }
 }
 function owners(context){return context?.partners||[];}
 function protectedPlayers(context,side){
  const rid=side==='mine'?String(context?.ownerRosterId||'1'):state.trade.partner;
  const r=context?.rosters?.find(x=>String(x.roster_id)===rid);
  const checks=side==='mine'?state.protectedMine:state.protectedOthers[rid]||[];
  if(!r)return '<small>Choose a trade partner to mark known off-limits players.</small>';
  return '<div class="pfo63-lock-list">'+(r.players||[]).filter(pid=>context.names?.[String(pid)]?.name)
   .map(pid=>{
    const key=String(pid),p=context.names[key];
    return '<label><input type="checkbox" data-pfo63-lock="'+side+'" value="'+esc(key)+'"'+
     (checks.includes(key)?' checked':'')+'><span>'+esc(p.name)+'</span><small>'+esc(p.position||'')+'</small></label>';
   }).join('')+'</div>';
 }
 function tradeRender(){
  const box=host('trade');if(!box)return;
  const context=ctx(),list=owners(context),s=state.trade;
  const chosen=list.some(x=>String(x.id)===s.partner)?s.partner:'all';
  let html='<div class="pfo61-head"><div><b>FFO Trade Finder · Screened Deals</b>'+
   '<small>Balanced needs and replacement value · no automatic offers</small></div>'+
   '<button type="button" data-pfo61-refresh="trade">Refresh</button></div>';
  const modes=[['FAIR','Fair Offers'],['FLEECE','Fleeces'],['MULTI','Multi-Player Deals']];
  html+='<div class="pfo65-trade-modes" role="group" aria-label="Trade Finder deal modes">'+
   modes.map(([key,label])=>'<button type="button" data-pfo65-trade-mode="'+key+
    '" aria-pressed="'+(s.mode===key)+'">'+label+'</button>').join('')+'</div>'+
   '<p class="pfo65-mode-note">'+esc(s.mode==='FAIR'?
    'Look for comparable replacement value on both sides. Balanced does not guarantee acceptance.':
    s.mode==='FLEECE'?
    'Explore favorable-value asks that still meet an opponent need. Ambitious does not mean likely to be accepted.':
    'Explore 2-for-1, 1-for-2, 2-for-2 and larger packages, with roster needs screened.')+'</p>';
  html+='<div class="pfo63-controls"><label class="pfo61-picker">Trade partner<select data-pfo61-trade-partner>'+
   '<option value="all">All eligible teams</option>'+list.map(x=>'<option value="'+esc(x.id)+'"'+
   (chosen===String(x.id)?' selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label>'+
   '<label class="pfo61-picker">Trade objective<select data-pfo63-objective>'+
   [['BALANCED','Best overall roster fit'],['QB','Upgrade QB'],['RB','Upgrade RB'],
    ['WR','Upgrade WR'],['TE','Upgrade TE']].map(([value,label])=>
    '<option value="'+value+'"'+(s.objective===value?' selected':'')+'>'+label+'</option>').join('')+
   '</select></label></div>';
  const formats=[['ANY','Any package size'],['1 for 1','1 for 1'],['2 for 1','2 for 1'],
   ['1 for 2','1 for 2'],['2 for 2','2 for 2'],['3 for 1','3 for 1'],['1 for 3','1 for 3'],
   ['3 for 2','3 for 2'],['2 for 3','2 for 3']];
  html+='<div class="pfo65-shape-row"><label class="pfo61-picker">Package shape<select data-pfo65-trade-shape>'+
   formats.filter(([key])=>s.mode!=='MULTI'||key!=='1 for 1').map(([key,label])=>
   '<option value="'+key+'"'+(s.shape===key?' selected':'')+'>'+label+'</option>').join('')+
   '</select></label><label class="pfo65-uneven"><input type="checkbox" data-pfo63-uneven'+
   (s.preferUneven?' checked':'')+'> Prioritize uneven 2-for-1 / 3-for-2 packages</label></div>';
  html+='<details class="pfo63-protect"><summary>Off-limits players · my team / known rival exclusions</summary>'+
   '<p class="pfo61-disclosure">These are private research exclusions, not verified manager declarations. They never update a league roster.</p>'+
   '<strong>Do not trade from my roster</strong>'+protectedPlayers(context,'mine')+
   '<strong>Exclude known untouchables on selected opponent</strong>'+protectedPlayers(context,'other')+
   '</details>';
  const diag=s.diagnostics||{};
  const status=s.pending?'Evaluating coverage, positional constraints and roster balance…':
   s.error||(!context?.rosters?.length?'Waiting for ownership snapshot.':
   !s.rows.length?(diag.reason==='independent_model_or_roster_snapshot_not_ready'?
    'Screened deals withheld: frozen FFL rules, a current roster snapshot, and independent player values are required.':
    'No defensible packages met the current requirements. Rather than inventing fair offers, broaden your filters or revisit after independent projections are available.'):'');
  if(status)html+='<p class="pfo63-empty">'+esc(status)+'</p>';
  if(s.rows.length)html+='<div class="pfo61-stack">'+s.rows.map((r,i)=>{
   const name=list.find(x=>String(x.id)===r.partnerId)?.name||'Roster '+r.partnerId;
   const players=rows=>rows.map(x=>esc(x.name)).join(' + ');
   return '<article class="pfo61-offer"><div class="pfo61-offer-top"><b>'+esc(name)+'</b>'+
    '<small>'+esc(r.format)+' · '+(s.mode==='FLEECE'?'Favorable-value research':r.balanced?'Screened balance':'Conditional research')+'</small></div>'+
    '<div class="pfo61-two"><div><small>WE GIVE</small><strong>'+players(r.give)+'</strong></div>'+
    '<div><small>WE GET</small><strong>'+players(r.take)+'</strong></div></div>'+
    '<div class="pfo61-meta"><span>Independent model '+esc(r.completeness)+' covered</span>'+
    '<span>Replacement-value gap '+fmt(r.replacementValueGap)+' model PPG</span></div>'+
    (r.starterImpact?'<div class="pfo61-meta pfo66-trade-impact"><span>Our skill starters '+fmt(r.starterImpact.ours)+' provisional PPG</span>'+
     '<span>Their skill starters '+fmt(r.starterImpact.theirs)+' provisional PPG</span></div>':'')+
    '<p class="pfo63-reason">'+esc(r.rationale)+'</p>'+
    '<button type="button" data-pfo61-review="'+i+'">Inspect in Trade Analyzer</button></article>';
  }).join('')+'</div>';
  html+='<p class="pfo61-disclosure">Fair and Fleece filters now account for both managers' conditional skill-starter impact. Missing projection coverage withholds classifications. K/DST impact is excluded if not traded. Neither acceptance odds nor market confidence are claimed. The Trade Analyzer retains FAAB negotiation.</p>';
  box.innerHTML=html;
 }
 function waiverRender(){
  const box=host('waiver');if(!box)return;
  const context=ctx(),s=state.waiver;
  let content='<div class="pfo61-head"><div><b>Waiver Decision Desk · Suggested Add + Drop</b>'+
   '<small>We identify the suggested drop automatically; no claim is sent</small></div>'+
   '<button type="button" data-pfo61-refresh="waiver">Refresh</button></div>';
  content+='<label class="pfo61-picker">Position<select data-pfo61-waiver-position>'+
   ['ALL','QB','RB','WR','TE','FLEX','K','DEF','IR'].map(p=>
    '<option'+(s.position===p?' selected':'')+'>'+p+'</option>').join('')+'</select></label>';
  const reason=s.pending?'Evaluating roster depth and covered player replacements…':
   s.error||(!context?.rosters?.length?'Waiting for current ownership.':
   !s.rows.length?'No positively screened automatic add/drop pair is supported by the current data. '+(
    s.reason==='no_supported_positive_add_drop_pairs'?'This may reflect missing independent estimates or inadequate benefit.':
    'Refresh when more source evidence is available.'):'');
  if(reason)content+='<p class="pfo63-empty">'+esc(reason)+'</p>';
  if(s.rows.length)content+='<div class="pfo61-stack">'+s.rows.map((r,i)=>{
   const d=r.selectedDrop;
   return '<article class="pfo61-offer"><div class="pfo63-waiver-pair">'+
    '<div><small>ADD</small><b>'+esc(r.name)+'</b><span>'+esc(r.position)+' · '+esc(r.team||'Team unverified')+'</span></div>'+
    '<div><small>DROP CANDIDATE</small><b>'+esc(d.name)+'</b><span>'+esc(d.position)+' · bench</span></div></div>'+
    '<div class="pfo61-meta"><span>Model pair gap '+fmt(r.modelGap)+' PPG</span>'+
    '<span>Starter impact '+fmt(r.starterDelta)+' PPG'+(r.starterDelta===null?' · withheld':'')+'</span></div>'+
    '<p class="pfo63-reason">'+esc(r.rationale)+'</p>'+
    '<details class="pfo63-alternatives"><summary>Other evaluated bench drops ('+
    Math.max(0,r.dropOptions.length-1)+')</summary>'+
    r.dropOptions.filter(x=>x.id!==d.id).map(x=>'<div>'+esc(x.name)+' · '+fmt(x.modelGap)+' model PPG pair gap</div>').join('')+
    '</details>'+
    '<button type="button" data-pfo61-waiver-compare="'+i+'">Review recommended add / drop</button>'+
    '<div class="pfo61-comparison" data-pfo61-result="'+i+'"></div></article>';
  }).join('')+'</div>';
  content+='<p class="pfo61-disclosure">These are covered-data suggestions, not guaranteed upgrades. Roster ownership, waiver claim eligibility, injury availability, FAAB and the final roster decision require your verification. IR stays a separate research view.</p>';
  box.innerHTML=content;
 }
 async function refreshTrade(force=false){
  mount();let context=ctx();if(!context)return;
  loadPrefs(context);
  const s=state.trade,stamp=[context.snapshotAt,context.modelVersion,context.rulesReady,s.partner,s.objective,
   s.mode,s.shape,s.fairOnly,s.preferUneven,state.protectedMine.join(','),JSON.stringify(state.protectedOthers)].join('|');
  if(!force&&s.stamp===stamp){if(!host('trade')?.querySelector('.pfo61-head'))tradeRender();return;}
  if(s.pending)return;
  s.pending=true;s.error='';tradeRender();
  try{
   const model=await getEngine();context=ctx();
   const {results,diagnostics}=model.screenTradePackages({rosters:context.rosters,names:context.names,
    estimate:context.estimate,ownerRosterId:context.ownerRosterId,excludedRosterIds:context.excludedRosterIds,
    starterSlots:context.slots,snapshotAt:context.snapshotAt,rulesReady:context.rulesReady,
    selectedPartnerId:s.partner==='all'?null:s.partner,objective:s.objective,
    mode:s.mode,shapeFilter:s.shape,fairOnly:s.fairOnly,preferUneven:s.preferUneven,availability:context.availability,
    protectedMine:state.protectedMine,
    protectedByManager:state.protectedOthers,maxResults:12});
   s.rows=results;s.diagnostics=diagnostics;s.stamp=stamp;
  }catch(err){s.error='Screened Trade Finder unavailable; existing manual Trade Analyzer is unaffected.';
   console.warn('FFO screened finder',err);
  }finally{s.pending=false;tradeRender();}
 }
 async function refreshWaiver(force=false){
  mount();let context=ctx();if(!context)return;
  loadPrefs(context);
  const s=state.waiver,stamp=[context.snapshotAt,context.modelVersion,context.rulesReady,
   context.waiverRosterId,context.actionsVersion,s.position,state.protectedMine.join(',')].join('|');
  if(!force&&s.stamp===stamp){if(!host('waiver')?.querySelector('.pfo61-head'))waiverRender();return;}
  if(s.pending)return;
  s.pending=true;s.error='';waiverRender();
  try{
   const model=await getEngine();context=ctx(true);
   const roster=context.rosters.find(r=>String(r.roster_id)===String(context.waiverRosterId));
   const {results,reason}=model.recommendWaiverPairs({roster,names:context.names,unrostered:context.unrostered,
    estimate:context.estimate,starterSlots:context.slots,snapshotAt:context.snapshotAt,
    rulesReady:context.rulesReady,availability:context.availability,position:s.position,
    protectedMine:state.protectedMine,maxResults:8});
   s.rows=results;s.reason=reason;s.stamp=stamp;
  }catch(err){s.error='Automatic add/drop research unavailable; manual Waiver Market remains available.';
   console.warn('FFO Waiver Pair research',err);
  }finally{s.pending=false;waiverRender();}
 }
 function notify(view){
  mount();
  if(!document.querySelector('#market.page.active [data-pfo59-market-panel="'+view+'"]:not([hidden])'))return;
  if(view==='trade')void refreshTrade();else if(view==='waiver')void refreshWaiver();
 }
 document.addEventListener('change',event=>{
  const t=event.target;
  if(t.matches('[data-pfo61-trade-partner]')){state.trade.partner=t.value;state.trade.stamp='';void refreshTrade(true);}
  if(t.matches('[data-pfo63-objective]')){state.trade.objective=t.value;savePrefs();void refreshTrade(true);}
  if(t.matches('[data-pfo65-trade-shape]')){state.trade.shape=t.value;savePrefs();void refreshTrade(true);}
  if(t.matches('[data-pfo63-fair]')){state.trade.fairOnly=t.checked;savePrefs();void refreshTrade(true);}
  if(t.matches('[data-pfo63-uneven]')){state.trade.preferUneven=t.checked;savePrefs();void refreshTrade(true);}
  if(t.matches('[data-pfo63-lock]')){
   const checked=t.checked,id=t.value,scope=t.dataset.pfo63Lock;
   if(scope==='mine'){
    state.protectedMine=checked?[...new Set([...state.protectedMine,id])]:
     state.protectedMine.filter(x=>x!==id);
   }else if(state.trade.partner!=='all'){
    const key=state.trade.partner,list=state.protectedOthers[key]||[];
    state.protectedOthers[key]=checked?[...new Set([...list,id])]:list.filter(x=>x!==id);
   }
   savePrefs();void refreshTrade(true);
  }
  if(t.matches('[data-pfo61-waiver-position]')){state.waiver.position=t.value;void refreshWaiver(true);}
 });
 document.addEventListener('click',event=>{
  const modeButton=event.target.closest('[data-pfo65-trade-mode]');
  if(modeButton){
   const next=modeButton.dataset.pfo65TradeMode;
   if(['FAIR','FLEECE','MULTI'].includes(next)){
    state.trade.mode=next;
    if(next==='MULTI'&&state.trade.shape==='1 for 1')state.trade.shape='ANY';
    savePrefs();void refreshTrade(true);
   }
   return;
  }
  const button=event.target.closest('[data-pfo61-refresh],[data-pfo61-review],[data-pfo61-waiver-compare]');
  if(!button)return;
  if(button.dataset.pfo61Refresh){
   if(button.dataset.pfo61Refresh==='trade')void refreshTrade(true);
   else void refreshWaiver(true);
   return;
  }
  if(button.dataset.pfo61Review!==undefined){
   const row=state.trade.rows[Number(button.dataset.pfo61Review)];if(!row)return;
   const applied=window.ffoPfo59?.applyResearchTrade?.({partnerId:row.partnerId,
    give:row.give.map(p=>p.id),take:row.take.map(p=>p.id)});
   if(applied){window.ffoTrade60?.analyze?.();
    document.getElementById('pfo60-trade-lab')?.scrollIntoView({behavior:'instant',block:'start'});}
   else{const target=host('trade');if(target)target.insertAdjacentHTML('afterbegin',
    '<p class="pfo61-alert">Ownership has changed. Refresh before evaluation.</p>');}
   return;
  }
  if(button.dataset.pfo61WaiverCompare!==undefined){
   const i=Number(button.dataset.pfo61WaiverCompare),row=state.waiver.rows[i];
   const target=host('waiver')?.querySelector('[data-pfo61-result="'+i+'"]');
   if(!row||!target)return;
   target.textContent='Proposed research pair: add '+row.name+'; consider dropping '+row.selectedDrop.name+
    '. Independent player model gap '+fmt(row.modelGap)+' PPG. '+
    (row.starterDelta===null?'Complete starter-lineup impact is withheld.':
     'Conditional starting-lineup model difference '+fmt(row.starterDelta)+' PPG.')+
    ' No transaction submitted; verify claims and FAAB first.';
  }
 });
 function start(){mount();notify('trade');}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.ffoMarketFinder61={notify,refreshTrade,refreshWaiver};
})();
