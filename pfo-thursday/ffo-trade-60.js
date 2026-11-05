/* PFO Trade Intelligence 6.0 — compact read-only two-sided FFL desk.
 * Preserves existing sleeper roster selector, valuation, Clear and market tabs.
 */
(()=>{'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const $=q=>document.querySelector(q);
 const number=x=>x===null||!Number.isFinite(x)?'—':(x>0?'+':'')+x.toFixed(1);
 const facts={give:{search:'',position:'ALL'},take:{search:'',position:'ALL'}};
 let model=null,last=null;
 const cash={weSend:0,theySend:0,ourVerifiedBalance:'',theirVerifiedBalance:''};
 let horizon='WEEK';
 const label={'ownership_snapshot_stale_or_undated':'Sleeper ownership refresh overdue',
 'ffl_rule_feed_not_ready':'FFL scoring rules not yet verified',
 'selected_player_projections_incomplete':'One or more selected players lack an independent FFL model estimate',
 'outgoing_ownership_unverified':'Outgoing player no longer appears on our Sleeper roster',
 'incoming_ownership_unverified':'Incoming player is not on selected manager’s Sleeper roster',
 'trade_partner_not_eligible':'Trade partner not eligible (roster #3 excluded)',
 'incomplete_player_exchange':'Both sides require at least one player',
 'hypothetical_roster_cuts_required':'Unbalanced package may require an unverified roster cut',
 'our_faab_balance_unconfirmed':'Dirty Birds spendable FAAB not independently confirmed',
 'opponent_faab_balance_unconfirmed':'Opponent spendable FAAB not confirmed',
 'our_faab_exceeds_spendable':'Outgoing FAAB exceeds entered spendable balance',
 'opponent_faab_exceeds_spendable':'Incoming FAAB exceeds reported opponent balance',
 'faab_invalid':'FAAB must be a nonnegative integer',
 'starter_slot_config_unverified':'Starting-slot settings unavailable'};
 function context(){return window.ffoPfo59?.tradeContext?.()||null}
 function pool(ctx){
  const ids=[...new Set([...ctx.ourRoster,...ctx.theirRoster])],players={};
  for(const id of ids){
   const v=ctx.names[id];if(!v)continue;
   const ppg=ctx.estimate(id);
   players[id]={name:v.name||'Unknown player',position:v.position||'UNKNOWN',
    team:v.team||'',ppg:Number.isFinite(ppg)&&ppg>=0?ppg:null,
    injury:v.injury_status||v.status||null};
  }
  return players;
 }
 function searchTools(side){
  const f=facts[side];const position=['ALL','QB','RB','WR','TE','K','DEF'];
  return '<div class="pfo60-compact-filter" data-pfo60-side="'+side+'">'+
   '<input type="search" data-pfo60-search="'+side+'" aria-label="Search '+side+' roster" placeholder="Search roster" value="'+esc(f.search)+'" autocomplete="off">'+
   '<div class="pfo60-positions">'+position.map(p=>'<button type="button" data-pfo60-position="'+p+
    '" data-pfo60-side="'+side+'" aria-pressed="'+(p===f.position)+'">'+p+'</button>').join('')+'</div></div>';
 }
 function filter(side){
  const wrapper=$('[data-pfo60-side="'+side+'"].pfo60-compact-filter');
  const roster=wrapper?.nextElementSibling;if(!roster)return;
  const ctx=context();if(!ctx)return;
  const selected=side==='give'?ctx.give:ctx.take;
  const f=facts[side],rows=[...roster.querySelectorAll('[data-pfo59-pick]')];
  let visible=0;
  for(const row of rows){
   const id=row.dataset.pfo59Pick,
    player=ctx.names[id],name=String(player?.name||'').toLowerCase(),
    pos=String(player?.position||'').toUpperCase().replace('D/ST','DEF');
   const show=selected.includes(id)||((f.position==='ALL'||f.position===pos)&&
    name.includes(f.search.trim().toLowerCase()));
   row.hidden=!show;if(show)visible++;
  }
  const counter=wrapper.querySelector('.pfo60-count');if(counter)counter.textContent=visible+' / '+rows.length+' players';
 }

 function starterMovement(ctx,r){
  const ready=Number.isFinite(r.starterDelta?.ours)&&Number.isFinite(r.starterDelta?.theirs)&&
   ['ours','theirs'].every(side=>r.before?.[side]?.status==='conditional'&&
    r.after?.[side]?.status==='conditional'&&Array.isArray(r.before[side].starters)&&
    Array.isArray(r.after[side].starters));
  if(!ready)return '<details class="pfo60-fold" data-pfo60-lineups><summary>Before/after starters · withheld</summary>'+
   '<div class="pfo60-warnings">Lineup changes require complete eligible-player estimates, current Sleeper ownership, verified FFL rules and resolved roster cuts. Missing evidence is not zero.</div></details>';
  const roster=(side,title)=>{
   const prior=r.before[side].starters,next=r.after[side].starters;
   const beforeIds=new Set(prior.map(p=>String(p.id))),afterIds=new Set(next.map(p=>String(p.id)));
   const received=new Set((side==='ours'?ctx.take:ctx.give).map(String));
   const sent=new Set((side==='ours'?ctx.give:ctx.take).map(String));
   const slotOrder=(ctx.slots||[]).map(x=>String(x).toUpperCase().replace('D/ST','DEF'));
   const lineup=(items,isAfter)=>{
    const sorted=[...items].sort((a,b)=>{
     const ai=slotOrder.indexOf(a.slot),bi=slotOrder.indexOf(b.slot);
     return (ai<0?99:ai)-(bi<0?99:bi)||String(a.slot).localeCompare(String(b.slot))||
      String(a.id).localeCompare(String(b.id));
    });
    return '<div class="pfo60-lineup-side"><small>'+(isAfter?'AFTER':'BEFORE')+'</small>'+
     sorted.map(p=>{
      const id=String(p.id),changed=isAfter?!beforeIds.has(id):!afterIds.has(id);
      const changeLabel=!changed?'':isAfter?(received.has(id)?'Acquired starter':'Promoted from bench'):
       (sent.has(id)?'Traded away':'Moves to bench');
      return '<div class="pfo60-lineup-row'+(changed?' pfo60-lineup-change':'')+'">'+
       '<span>'+esc(p.slot)+'</span><b>'+esc(ctx.names?.[id]?.name||id)+'</b>'+
       (changeLabel?'<small>'+esc(changeLabel)+'</small>':'')+'</div>';
     }).join('')+'</div>';
   };
   return '<section><div class="pfo60-lineup-heading"><b>'+esc(title)+'</b>'+
    '<small>'+number(r.starterDelta[side])+' modeled starter PPG</small></div>'+
    '<div class="pfo60-lineup-cols">'+lineup(prior,false)+lineup(next,true)+'</div></section>';
  };
  return '<details class="pfo60-fold" data-pfo60-lineups><summary>Before → after starters · conditional</summary>'+
   '<div class="pfo60-lineup-sections">'+roster('ours','Dirty Birds')+
   roster('theirs',ctx.managerName||'Trade partner')+'</div>'+
   '<small>Lineup optimization is conditional research, not a submitted lineup or a certified future prediction. Trade and bench movements are distinguished by Sleeper roster ownership.</small></details>';
 }
 function makeReport(ctx,r){
  const tile=(label,value,desc)=>'<div class="pfo60-kpi"><span>'+esc(label)+'</span>'+
   '<b>'+esc(value)+'</b><small>'+esc(desc)+'</small></div>';
  const delta=(prev,next)=>['QB','RB','WR','TE','K','DEF'].map(p=>{
   const d=(next[p]||0)-(prev[p]||0);
   return d?'<span>'+p+' '+(d>0?'+':'')+d+'</span>':'';
  }).filter(Boolean).join('')||'<span>No position-count changes</span>';
  const issues=r.issues.map(x=>'<div>• '+esc(label[x]||x.replaceAll('_',' '))+'</div>');
  const health=r.health.map(x=>'<div>• '+esc(x.name)+' — '+esc(x.status)+' (verify official report)</div>');
  const missingPlayers=(r.coverage?.missing||[]).map(id=>ctx.names?.[id]?.name||id);
  const asset=(id,side)=>{
   const p=ctx.names?.[id]||null,reference=pool(ctx)[id];
   return '<div class="pfo60-asset"><small>'+esc(side)+'</small><b>'+esc(p?.name||reference?.name||id)+'</b>'+
    '<span>'+esc(reference?.position||'—')+' · '+esc(reference?.team||'—')+
    ' · '+(reference?.ppg===null||reference?.ppg===undefined?'PPG unverified':reference.ppg.toFixed(1)+' modeled PPG')+'</span></div>';
  };
  const cut=(n)=>n===null?'unverified':String(n);
  const us=r.starterDelta.ours,them=r.starterDelta.theirs;
  const proven=us!==null&&them!==null&&Number.isFinite(us)&&Number.isFinite(them)&&
   r.status!=='invalid'&&r.rosterCuts.ours===0&&r.rosterCuts.theirs===0;
  const signal=!proven?'Two-team starter impact unverified':
   us>0&&them>0?'Conditional two-team starter improvement':
   us>0&&them<=0?'Dirty Birds benefit; partner starter impact is not positive':
   us<=0&&them>0?'Partner benefits; Dirty Birds starter impact is not positive':
   'Neither side shows a positive modeled starter delta';
  const nextMove=!proven?'Resolve missing inputs, eligibility and roster cuts before interpreting this trade.':
   us>0&&them>0?'Both modeled starting groups improve; verify health, FAAB and manager priorities before proposing.':
   'Uneven model benefits: inspect depth, FAAB and possible counteroffer terms. No acceptance implied.';
  const flags=r.coverage.present+'/'+r.coverage.total+' selected player forecasts';
  const clearNow=r.status!=='invalid'&&r.starterDelta.ours!==null&&r.starterDelta.theirs!==null;
  const schedule=window.ffoPfo597?.verifiedSchedule?.();
  const playoffStart=Number(ctx.playoffStart);
  const lateWeeks=Number.isInteger(playoffStart)&&playoffStart>=10&&playoffStart<=18?
   [playoffStart,playoffStart+1,playoffStart+2].filter(w=>w<=18):[];
  const scheduleNotes=(lateWeeks.length&&schedule?.teams)?
   [...new Set([...ctx.give,...ctx.take])].map(id=>{
    const p=ctx.names?.[id]||{},team=String(p.team||'').toUpperCase();
    const rows=lateWeeks.map(w=>{
     const entry=schedule.teams?.[team]?.weeks?.[String(w)];
     if(!entry)return 'W'+w+' unverified';
     if(entry.bye===true)return 'W'+w+' BYE';
     return entry.opponent?'W'+w+' opponent '+entry.opponent:'W'+w+' unverified';
    });
    return '<div>• <b>'+esc(p.name||id)+'</b>: '+esc(rows.join(' · '))+'</div>';
   }).join(''):'<div>Verified NFL fixtures or league playoff weeks unavailable.</div>';
  const horizonTabs='<div class="pfo63-horizons">'+[['WEEK','This week'],['ROS','Rest of season'],['PLAYOFFS','Playoffs']].map(([key,label])=>
   '<button type="button" data-pfo60-horizon="'+key+'" aria-pressed="'+(horizon===key)+'">'+label+'</button>').join('')+'</div>';
  const horizonText=horizon==='WEEK'?
   (r.starterDelta.ours!==null&&r.starterDelta.theirs!==null?
    'Conditional lineup comparison · our starters '+number(r.starterDelta.ours)+' PPG · their starters '+number(r.starterDelta.theirs)+' PPG.':
    'Current-week starter differential withheld until complete eligible-player estimates and roster cuts are verified.'):
   horizon==='ROS'?
    'Rest-of-season differential withheld. Repeated baseline PPG is not an opponent-specific forecast. Verified weekly projections and backtesting are pending.':
    'Fantasy-playoff differential withheld. Verified Weeks 15–17 fixtures below are schedule context, not certified performance projections.';
  return '<div class="pfo60-title"><span>Conditional FFL model · research only</span></div>'+
   '<div class="pfo60-headline"><strong>'+esc(r.headline)+'</strong><small>'+
    'Read-only research · no verified acceptance odds or auto-offers</small></div>'+
   '<div class="pfo60-kpis">'+
    tile('Asset package PPG gap',number(r.packageNetPPG),'NOT lineup impact')+
    tile('Our starter impact',number(r.starterDelta.ours),clearNow?'Lineup-aware research':'Withheld until complete')+
    tile('Their starter impact',number(r.starterDelta.theirs),clearNow?'Lineup-aware research':'Withheld until complete')+
    tile('Input coverage',flags,'Forecast ≠ certified score')+'</div>'+
   '<div class="pfo60-section-head"><b>Time horizon</b><small>Only sourced period-specific differences are displayed</small></div>'+
   horizonTabs+'<div class="pfo63-horizon-text">'+esc(horizonText)+'</div>'+
   '<div class="pfo60-section-head"><b>Trade package</b><small>Current Sleeper ownership</small></div>'+
   '<div class="pfo60-assets"><section><strong>Dirty Birds give</strong>'+ctx.give.map(id=>asset(id,'SEND')).join('')+
    '</section><section><strong>Dirty Birds receive</strong>'+ctx.take.map(id=>asset(id,'GET')).join('')+'</section></div>'+
   '<div class="pfo612-trade-brief"><b>'+esc(signal)+'</b><p>'+esc(nextMove)+'</p>'+
   '<small>FFL starter deltas are research estimates, not market prices or acceptance probabilities. Bench replacement and roster cuts matter.</small></div>'+
   '<div class="pfo60-two-sided"><div><b>Dirty Birds roster</b><div class="pfo60-chips">'+
    delta(r.depthBefore.ours,r.depthAfter.ours)+'</div><small>Net slots '+(r.rosterChange.ours>0?'+':'')+r.rosterChange.ours+
    ' · possible cuts '+cut(r.rosterCuts.ours)+'</small></div>'+
    '<div><b>'+esc(ctx.managerName)+'</b><div class="pfo60-chips">'+
    delta(r.depthBefore.theirs,r.depthAfter.theirs)+'</div><small>Net slots '+
    (r.rosterChange.theirs>0?'+':'')+r.rosterChange.theirs+' · possible cuts '+
    cut(r.rosterCuts.theirs)+'</small></div></div>'+starterMovement(ctx,r)+
   '<details class="pfo60-fold" data-pfo60-schedule><summary>Late-season fixtures · '+(lateWeeks.length?'W'+lateWeeks[0]+'–'+lateWeeks[lateWeeks.length-1]:'weeks unverified')+'</summary>'+
   '<div class="pfo60-warnings">'+scheduleNotes+
   '<div>• Future opponent strength is NOT inferred from the schedule alone.</div></div></details>'+
   '<details class="pfo60-fold" data-pfo60-faab><summary>FAAB negotiation · we send $'+cash.weSend+
    ' / receive $'+cash.theySend+'</summary>'+
    '<div class="pfo60-cash">'+
    [['weSend','We send FAAB'],['theySend','We receive FAAB'],
     ['ourVerifiedBalance','Our confirmed spendable FAAB'],['theirVerifiedBalance','Their confirmed spendable FAAB']].map(
      ([id,t])=>'<label>'+esc(t)+'<input type="number" min="0" max="999" step="1" inputmode="numeric" data-pfo60-cash="'+id+
       '" value="'+esc(cash[id])+'" placeholder="Not verified"></label>').join('')+'</div>'+
    '<small>FAAB and fantasy points are separate currencies. No invented exchange rate. Balance verification is required.</small></details>'+
   '<details class="pfo60-fold" data-pfo60-evidence><summary>Verification, injury and model limits ('+(issues.length+health.length)+')</summary>'+
    '<div class="pfo60-warnings">'+(issues.length||health.length?[...issues,...health].join(''):
    '<div>No source-rule warning was triggered by current inputs.</div>')+
    (missingPlayers.length?'<div>• Independent estimates missing for <b>'+esc(missingPlayers.join(', '))+'</b>. Full starter impacts require complete player coverage.</div>':'')+
    '<div>• Full historical FFL score certification and walk-forward projection accuracy remain pending.</div>'+
    '<div>• League-player ownership: Sleeper read-only, checked '+esc(ctx.snapshotAt||'unknown')+'.</div>'+
    '<div>• Optimized lineup comparisons assume all selected players are available; actual snap caps and Sunday actives need verification.</div>'+
    '<div>• No opponent willingness/acceptance probability claimed.</div></div></details>'+
    '<div class="pfo60-actions"><button type="button" data-pfo60-recalculate>Recalculate</button>'+
    '<button type="button" data-pfo60-copy>Copy unsent offer brief</button></div>';
 }
 function evaluate(){
  const root=$('#pfo60-trade-report'),ctx=context();if(!root||!ctx)return;
  if(!model){root.textContent='FFL Trade Intelligence model loading; existing trade selections retained.';return}
  const indexed=pool(ctx);
  const p={ourRoster:ctx.ourRoster,theirRoster:ctx.theirRoster,
   ourReserve:ctx.ourReserve||[],theirReserve:ctx.theirReserve||[],give:ctx.give,take:ctx.take,
   partnerRosterId:ctx.manager,playerIndex:indexed,starterSlots:ctx.slots,
   rosterCap:Number.isInteger(Number(ctx.rosterCap))&&Number(ctx.rosterCap)>0?Number(ctx.rosterCap):null,
   snapshotAt:ctx.snapshotAt,ruleReady:ctx.rulesReady,
   ourFAAB:cash.weSend,theirFAAB:cash.theySend,
   confirmedOurSpendable:cash.ourVerifiedBalance===''?null:Number(cash.ourVerifiedBalance),
   confirmedTheirSpendable:cash.theirVerifiedBalance===''?null:Number(cash.theirVerifiedBalance)};
  try{
   const outcome=model.evaluateFFLTrade(p);
   last={ctx,result:outcome};
   const expanded=!!root.querySelector('[data-pfo60-faab]')?.open,
    evidence=!!root.querySelector('[data-pfo60-evidence]')?.open;
   root.innerHTML=makeReport(ctx,outcome);
   if(expanded)root.querySelector('[data-pfo60-faab]').open=true;
   if(evidence)root.querySelector('[data-pfo60-evidence]').open=true;
  }catch(error){
   console.warn('FFO Trade Intel model failure',error);
   root.textContent='Trade calculation unavailable; no unverified figures substituted.';
  }
 }
 function render(){
  const board=$('#pfo59-trade-board');if(!board)return;
  const sections=[...board.querySelectorAll('.pfo59-trade-dual>section')];
  for(let i=0;i<sections.length;i++){
   const side=i===0?'give':'take',roster=sections[i].querySelector('.pfo59-trade-roster');
   if(!roster||sections[i].querySelector('.pfo60-compact-filter'))continue;
   const temp=document.createElement('div');temp.innerHTML=searchTools(side);
   const controls=temp.firstElementChild;
   const count=document.createElement('small');count.className='pfo60-count';
   controls.appendChild(count);roster.before(controls);filter(side);
  }
  let section=board.querySelector('#pfo60-trade-lab');
  if(!section){
   section=document.createElement('section');section.id='pfo60-trade-lab';
   section.innerHTML='<div class="pfo60-title"><b>FFO Trade Intelligence</b><span>Custom FFL scoring</span></div>'+
    '<div id="pfo60-trade-report" class="pfo60-placeholder">Choose a manager and players on both sides. Then tap Analyze deal for a compact two-sided evaluation. No offer is sent.</div>';
   board.querySelector('.pfo59-trade-bar')?.after(section);
  }
  if(last){
   const ctx=context();
   if(ctx&&JSON.stringify([ctx.manager,ctx.give,ctx.take])===
     JSON.stringify([last.ctx.manager,last.ctx.give,last.ctx.take]))evaluate();
   else reset();
  }
 }
 function reset(){
  last=null;
  const host=$('#pfo60-trade-report');
  if(host)host.textContent='Selection updated. Tap Analyze deal to recompute both managers’ impacts.';
 }
 function clear(){
  last=null;Object.assign(cash,{weSend:0,theySend:0,ourVerifiedBalance:'',theirVerifiedBalance:''});
  facts.give={search:'',position:'ALL'};facts.take={search:'',position:'ALL'};
  reset();
  for(const side of ['give','take']){
   const root=$('[data-pfo60-side="'+side+'"].pfo60-compact-filter');
   const search=root?.querySelector('[data-pfo60-search]');if(search)search.value='';
   root?.querySelectorAll('[data-pfo60-position]').forEach(button=>
    button.setAttribute('aria-pressed',String(button.dataset.pfo60Position==='ALL')));
   filter(side);
  }
 }
 function draft(){
  if(!last)return '';
  const {ctx,result:r}=last;
  const person=id=>ctx.names[id]?.name||id;
  return ['FFO · UNSENT TRADE RESEARCH','Partner: '+ctx.managerName,
   'Give: '+ctx.give.map(person).join(' + '),
   'Receive: '+ctx.take.map(person).join(' + '),
   'We send FAAB: $'+cash.weSend,'We receive FAAB: $'+cash.theySend,
   'Projected package PPG net: '+number(r.packageNetPPG),
   'Dirty Birds starter PPG delta: '+number(r.starterDelta.ours),
   'Opponent starter PPG delta: '+number(r.starterDelta.theirs),
   'Input coverage: '+r.coverage.present+'/'+r.coverage.total,
   'Source limitations: '+r.issues.join('; '),
   'Research ONLY, unbacktested FFL projections, never a submitted trade.'].join('\n');
 }
 document.addEventListener('input',ev=>{
  const input=ev.target.closest('[data-pfo60-search]');if(!input)return;
  const side=input.dataset.pfo60Search;if(!facts[side])return;
  facts[side].search=input.value;filter(side);
 });
 document.addEventListener('change',ev=>{
  const input=ev.target.closest('[data-pfo60-cash]');if(!input)return;
  const k=input.dataset.pfo60Cash;if(!Object.hasOwn(cash,k))return;
  cash[k]=k==='weSend'||k==='theySend'?Number(input.value):input.value;
  evaluate();
 });
 document.addEventListener('click',ev=>{
  const pos=ev.target.closest('[data-pfo60-position]');
  if(pos){
   const side=pos.dataset.pfo60Side;if(!facts[side])return;
   facts[side].position=pos.dataset.pfo60Position;
   document.querySelectorAll('[data-pfo60-side="'+side+'"] [data-pfo60-position]').forEach(
    btn=>btn.setAttribute('aria-pressed',String(btn===pos)));
   filter(side);return;
  }
  const choice=ev.target.closest('[data-pfo60-horizon]');
  if(choice){horizon=choice.dataset.pfo60Horizon;evaluate();return;}
  if(ev.target.closest('[data-pfo60-recalculate]')){evaluate();return}
  if(ev.target.closest('[data-pfo60-copy]')){
   const txt=draft();if(!txt)return;
   const button=ev.target.closest('button');
   if(navigator.clipboard?.writeText)void navigator.clipboard.writeText(txt).then(
    ()=>{if(button)button.textContent='Copied ✓'}).catch(()=>window.prompt('Copy FFO trade brief',txt));
   else window.prompt('Copy FFO trade brief',txt);
  }
 });
 window.ffoTrade60={render,reset,clear,analyze:evaluate,
  getLastResult:()=>last?.result||null};
 import('/ffo-trade-decision-60.mjs').then(m=>{
  model=m;render();
 }).catch(err=>console.warn('FFO Trade Intel bundle not available',err));
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});
 else render();
})();
