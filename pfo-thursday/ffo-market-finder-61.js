/* PFO 6.1 Market Research — additive, read-only and provider-neutral. */
(()=>{'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dollar=x=>typeof x==='number'&&Number.isFinite(x)?(x>0?'+':'')+x.toFixed(1):'—';
 const state={trade:{partner:'all',rows:[],stamp:'',pending:false,error:''},
  waiver:{position:'ALL',rows:[],stamp:'',pending:false,error:''}};
 let model=null,promise=null;
 function getContext(includeWaivers=false){
  return window.ffoPfo59?.marketResearchContext?.({includeWaivers})||null;
 }
 function loadModel(){
  if(model)return Promise.resolve(model);
  if(!promise)promise=import('/ffo-market-finder-61.mjs').then(x=>(model=x)).catch(e=>{
   promise=null;throw e;
  });
  return promise;
 }
 function mount(){
  const pairs=[['trade','pfo59-trade-board'],['waiver','pfo59-waiver-board']];
  for(const [type,anchorId] of pairs){
   const anchor=document.getElementById(anchorId);
   if(!anchor||document.getElementById('pfo61-'+type+'-research'))continue;
   const box=document.createElement('section');
   box.id='pfo61-'+type+'-research';box.className='pfo61-research';
   box.setAttribute('aria-label',type==='trade'?'Trade Finder research':'Waiver add/drop research');
   anchor.before(box);
  }
 }
 const tradeHost=()=>document.getElementById('pfo61-trade-research');
 const waiverHost=()=>document.getElementById('pfo61-waiver-research');
 function offerList(){
  const host=tradeHost();if(!host)return;
  const ctx=getContext(),owners=ctx?.partners||[];
  const selector='<label class="pfo61-picker">Manager <select data-pfo61-trade-partner>'+
   '<option value="all">All eligible managers</option>'+owners.map(p=>'<option value="'+esc(p.id)+'"'+
   (state.trade.partner===p.id?' selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label>';
  const rows=state.trade.rows;
  const content=state.trade.pending?'<p class="pfo61-note">Preparing source-limited packages…</p>':
   state.trade.error?'<p class="pfo61-note">'+esc(state.trade.error)+'</p>':
   !ctx?.rosters?.length?'<p class="pfo61-note">Waiting for published league rosters. No trade candidates inferred.</p>':
   !rows.length?'<p class="pfo61-note">No eligible packages found in the current published rosters.</p>':
   '<div class="pfo61-stack">'+rows.map((r,i)=>{
    const manager=owners.find(p=>p.id===r.partnerId)?.name||'Roster '+r.partnerId;
    const players=a=>a.map(p=>esc(p.name)).join(' + ');
    const complete=r.outgoingPPG!==null&&r.incomingPPG!==null;
    return '<article class="pfo61-offer"><div class="pfo61-offer-top"><b>'+esc(manager)+'</b><small>'+
     esc(r.format)+' · research only</small></div>'+
     '<div class="pfo61-two"><div><small>WE GIVE</small><strong>'+players(r.give)+'</strong></div>'+
     '<div><small>WE RECEIVE</small><strong>'+players(r.take)+'</strong></div></div>'+
     '<div class="pfo61-meta"><span>Model coverage '+esc(r.completeness)+'</span>'+
     '<span>Both team needs '+esc(r.needs.ours)+' / '+esc(r.needs.theirs)+'</span>'+
     '<span>Package model '+(complete?dollar(r.incomingPPG-r.outgoingPPG)+' PPG':'withheld')+'</span></div>'+
     (r.healthFlag?'<small class="pfo61-alert">Injury designation: check current source</small>':'')+
     '<button type="button" data-pfo61-review="'+i+'">Open in Trade Analyzer</button></article>';
   }).join('')+'</div>';
  host.innerHTML='<div class="pfo61-head"><div><b>Trade Finder · FFO Research</b>'+
   '<small>Quick package discovery across actual league rosters</small></div>'+
   '<button type="button" data-pfo61-refresh="trade">Refresh</button></div>'+
   selector+'<p class="pfo61-disclosure">Research ordering considers roster depth and provisional FFL estimates. It is not a fair-trade verdict, acceptance probability, or actual offer. Unbalanced deals require roster-cut review.</p>'+content;
 }
 function waiverList(){
  const host=waiverHost();if(!host)return;
  const ctx=getContext(false),rows=state.waiver.rows;
  const content=state.waiver.pending?'<p class="pfo61-note">Ranking add/drop research…</p>':
   state.waiver.error?'<p class="pfo61-note">'+esc(state.waiver.error)+'</p>':
   !ctx?.rosters?.length?'<p class="pfo61-note">Waiting for published ownership before ranking waivers.</p>':
   !rows.length?'<p class="pfo61-note">No ownership-filtered candidates available for this view.</p>':
   '<div class="pfo61-stack">'+rows.map((r,i)=>{
    const drops=r.dropOptions.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name)+
     (d.starter?' · STARTER':' · bench')+'</option>').join('');
    return '<article class="pfo61-offer"><div class="pfo61-waiver-title"><b>'+esc(r.name)+'</b>'+
     '<small>'+esc(r.position)+' · '+esc(r.team||'Team unknown')+' · '+(r.ppg===null?'Model withheld':r.ppg.toFixed(1)+' model PPG')+'</small></div>'+
     '<div class="pfo61-meta"><span>Roster depth need '+esc(r.shortage)+'</span>'+
     '<span>Ownership: unrostered in latest directory</span></div>'+
     (r.healthFlag?'<small class="pfo61-alert">Injury designation requires recheck</small>':'')+
     '<label class="pfo61-picker">Potential drop <select data-pfo61-drop="'+i+'">'+
     (drops||'<option value="">No evaluated drops</option>')+'</select></label>'+
     '<button type="button" data-pfo61-waiver-compare="'+i+'"'+(!r.dropOptions.length?' disabled':'')+
     '>Compare add / drop</button><div class="pfo61-comparison" data-pfo61-result="'+i+'"></div></article>';
   }).join('')+'</div>';
  host.innerHTML='<div class="pfo61-head"><div><b>Waiver Decision Desk</b>'+
   '<small>Actual unrostered players · conditional replacement impact</small></div>'+
   '<button type="button" data-pfo61-refresh="waiver">Refresh</button></div>'+
   '<label class="pfo61-picker">Position <select data-pfo61-waiver-position>'+
   ['ALL','QB','RB','WR','TE','FLEX','K','DEF'].map(p=>'<option'+
   (state.waiver.position===p?' selected':'')+'>'+p+'</option>').join('')+'</select></label>'+
   '<p class="pfo61-disclosure">Potential drops are research candidates, not recommendations to execute. Eligibility, waivers, FAAB, and game-day availability require separate verification. No adds or drops are submitted.</p>'+content;
 }
 async function refreshTrade(force=false){
  mount();const ctx=getContext();
  if(!ctx?.rosters?.length||!ctx?.names||!ctx?.estimate){state.trade.rows=[];offerList();return;}
  const stamp=[ctx.snapshotAt,ctx.rulesReady,state.trade.partner,ctx.modelVersion||''].join('|');
  if(!force&&state.trade.stamp===stamp){if(!tradeHost()?.querySelector('.pfo61-head'))offerList();return;}
  if(state.trade.pending)return;
  state.trade.pending=true;state.trade.error='';offerList();
  try{
   const m=await loadModel(),latest=getContext();
   if(!latest?.rosters?.length)return;
   state.trade.rows=m.findTradeResearch({rosters:latest.rosters,names:latest.names,
    estimate:latest.estimate,ownerRosterId:latest.ownerRosterId||'1',
    excludedRosterIds:latest.excludedRosterIds||['3'],starterSlots:latest.slots,
    snapshotAt:latest.snapshotAt,rulesReady:latest.rulesReady,
    selectedPartnerId:state.trade.partner==='all'?null:state.trade.partner,maxResults:12});
   state.trade.stamp=stamp;
  }catch(e){state.trade.error='Trade Finder unavailable; existing Trade Analyzer is unaffected.';
   console.warn('PFO Trade Finder research error',e);
  }finally{state.trade.pending=false;offerList();}
 }
 async function refreshWaiver(force=false){
  mount();const first=getContext();if(!first?.rosters?.length||!first?.names){
   state.waiver.rows=[];waiverList();return;
  }
  const stamp=[first.snapshotAt,first.rulesReady,first.waiverRosterId,
   state.waiver.position,first.modelVersion||''].join('|');
  if(!force&&state.waiver.stamp===stamp){if(!waiverHost()?.querySelector('.pfo61-head'))waiverList();return;}
  if(state.waiver.pending)return;
  state.waiver.pending=true;state.waiver.error='';waiverList();
  try{
   const m=await loadModel(),ctx=getContext(true);
   const roster=ctx?.rosters?.find(r=>String(r.roster_id)===String(ctx.waiverRosterId));
   state.waiver.rows=m.findWaiverResearch({roster,names:ctx.names,
    unrostered:ctx.unrostered||[],estimate:ctx.estimate,starterSlots:ctx.slots,
    position:state.waiver.position,maxResults:8,rulesReady:ctx.rulesReady,
    snapshotAt:ctx.snapshotAt});
   state.waiver.stamp=stamp;
  }catch(e){state.waiver.error='Waiver comparison unavailable; existing Waiver Market is unaffected.';
   console.warn('PFO Waiver Decision research error',e);
  }finally{state.waiver.pending=false;waiverList();}
 }
 function notify(view){
  mount();
  const active=document.querySelector('#market.page.active [data-pfo59-market-panel="'+view+'"]:not([hidden])');
  if(!active)return;
  if(view==='trade')void refreshTrade();
  if(view==='waiver')void refreshWaiver();
 }
 document.addEventListener('click',ev=>{
  const refresh=ev.target.closest('[data-pfo61-refresh]');
  if(refresh){const type=refresh.dataset.pfo61Refresh;
   if(type==='trade')void refreshTrade(true);else if(type==='waiver')void refreshWaiver(true);
   return;
  }
  const open=ev.target.closest('[data-pfo61-review]');
  if(open){
   const row=state.trade.rows[Number(open.dataset.pfo61Review)];
   if(!row)return;
   const applied=window.ffoPfo59?.applyResearchTrade?.({
    partnerId:row.partnerId,give:row.give.map(p=>p.id),take:row.take.map(p=>p.id)});
   if(applied){
    window.ffoTrade60?.analyze?.();
    document.getElementById('pfo60-trade-lab')?.scrollIntoView({behavior:'instant',block:'start'});
   }else{
    const host=tradeHost();if(host)host.insertAdjacentHTML('afterbegin',
     '<p class="pfo61-alert">Ownership changed; refresh the league snapshot before analysis.</p>');
   }
   return;
  }
  const btn=ev.target.closest('[data-pfo61-waiver-compare]');
  if(btn){
   const i=Number(btn.dataset.pfo61WaiverCompare),row=state.waiver.rows[i];
   const host=waiverHost(),target=host?.querySelector('[data-pfo61-result="'+i+'"]');
   const drop=host?.querySelector('[data-pfo61-drop="'+i+'"]')?.value;
   if(!row||!drop||!target)return;
   const ctx=getContext(true),roster=ctx?.rosters?.find(r=>String(r.roster_id)===String(ctx.waiverRosterId));
   const m=model;
   const result=m?.compareWaiverSwap({roster,addId:row.id,dropId:drop,
    names:ctx.names,estimate:ctx.estimate,starterSlots:ctx.slots,
    rulesReady:ctx.rulesReady,snapshotAt:ctx.snapshotAt});
   const player=ctx.names?.[drop]?.name||drop;
   target.textContent=result?.status==='conditional'?
    'If '+row.name+' replaces '+player+': '+dollar(result.delta)+' modeled starter PPG. Research only; actual add/drop eligibility unverified.':
    'Starter impact withheld: '+String(result?.reason||'insufficient evidence').replaceAll('_',' ')+'. No missing data treated as zero.';
   return;
  }
 });
 document.addEventListener('change',ev=>{
  const p=ev.target.closest('[data-pfo61-trade-partner]');
  if(p){state.trade.partner=p.value;state.trade.stamp='';void refreshTrade(true);return;}
  const w=ev.target.closest('[data-pfo61-waiver-position]');
  if(w){state.waiver.position=w.value;state.waiver.stamp='';void refreshWaiver(true);}
 });
 function start(){mount();notify('trade');}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.ffoMarketFinder61={notify,refreshTrade,refreshWaiver};
})();
