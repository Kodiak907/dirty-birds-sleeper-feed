/* PFO 6.4 — two compact, independent workspaces.
 * UI-only: preserves all league-scoring, source and Commissioner operations.
 */
(()=>{'use strict';
 const matchupViews=[['starters','Starters & projections'],['startsit','Start / Sit'],['lab','Lineup Lab']];
 const tradeViews=[['finder','Trade Finder'],['lab','Trade Analyzer']];
 const waiverViews=[['suggested','Suggested Pickups'],['manual','Find Your Own']];
 const tabs=(items,kind)=>'<div class="pfo64-tabs" role="tablist" aria-label="'+
  (kind==='matchup'?'Matchup tools':kind==='trade'?'Trade research tools':'Waiver research tools')+'">'+items.map(([value,label])=>
  '<button type="button" role="tab" data-pfo64-switch="'+kind+'" data-pfo64-value="'+value+
  '" aria-selected="false" tabindex="-1">'+label+'</button>').join('')+'</div>';
 let matchup='starters',trade='finder',waiver='suggested';
 function updateButtons(kind,value){
  document.querySelectorAll('[data-pfo64-switch="'+kind+'"]').forEach(b=>{
   const on=b.dataset.pfo64Value===value;
   b.setAttribute('aria-selected',String(on));
   b.tabIndex=on?0:-1;
  });
 }
 function setMatchup(value){
  if(!matchupViews.some(([key])=>key===value))return;
  matchup=value;
  const root=document.getElementById('matchup');
  if(root)root.dataset.pfo64Tab=value;
  updateButtons('matchup',value);
  if(value==='startsit')window.ffoStartSit63?.refresh?.();
 }
 function setTrade(value){
  if(!tradeViews.some(([key])=>key===value))return;
  trade=value;
  const root=document.querySelector('#market [data-pfo59-market-panel="trade"]');
  if(root)root.dataset.pfo64Trade=value;
  updateButtons('trade',value);
  if(value==='finder')window.ffoMarketFinder61?.notify?.('trade');
 }
 function setWaiver(value){
  if(!waiverViews.some(([key])=>key===value))return;
  waiver=value;
  const root=document.querySelector('#market [data-pfo59-market-panel="waiver"]');
  if(root)root.dataset.pfo65Waiver=value;
  updateButtons('waiver',value);
  if(value==='suggested')window.ffoMarketFinder61?.notify?.('waiver');
 }
 function mountWaiver(){
  const panel=document.querySelector('#market [data-pfo59-market-panel="waiver"]');
  if(!panel)return;
  if(!panel.querySelector('[data-pfo64-switch="waiver"]')){
   const section=document.createElement('div');
   section.id='pfo65-waiver-tabs';
   section.innerHTML=tabs(waiverViews,'waiver');
   const header=panel.querySelector('.pfo59-subhead');
   if(header)header.after(section);
   else panel.prepend(section);
  }
  setWaiver(waiver);
 }
 function mountMatchup(){
  const root=document.getElementById('matchup');
  const title=root?.querySelector('.pfo52-hd');
  if(!title)return;
  if(!root.querySelector('[data-pfo64-switch="matchup"]')){
   const div=document.createElement('div');
   div.id='pfo64-matchup-tabs';
   div.innerHTML=tabs(matchupViews,'matchup');
   title.after(div);
  }
  setMatchup(matchup);
 }
 function mountTrade(){
  const panel=document.querySelector('#market [data-pfo59-market-panel="trade"]');
  if(!panel)return;
  if(!panel.querySelector('[data-pfo64-switch="trade"]')){
   const section=document.createElement('div');
   section.id='pfo64-trade-tabs';
   section.innerHTML=tabs(tradeViews,'trade');
   const finder=panel.querySelector('#pfo61-trade-research');
   if(finder)finder.before(section);
   else panel.prepend(section);
  }
  setTrade(trade);
 }
 function mount(){
  mountMatchup();mountTrade();mountWaiver();
 }
 // Open a Finder result directly in the Analyzer. Capture phase ensures the
 // existing delegated button handler sees a visible Analyzer when it scrolls.
 document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-pfo61-review]'))setTrade('lab');
 },true);
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-pfo64-switch]');
  if(!button)return;
  if(button.dataset.pfo64Switch==='matchup')setMatchup(button.dataset.pfo64Value);
  else if(button.dataset.pfo64Switch==='trade')setTrade(button.dataset.pfo64Value);
  else if(button.dataset.pfo64Switch==='waiver')setWaiver(button.dataset.pfo64Value);
 });
 document.addEventListener('keydown',event=>{
  const button=event.target.closest?.('[data-pfo64-switch]');
  if(!button||!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
  const list=button.dataset.pfo64Switch==='matchup'?matchupViews:button.dataset.pfo64Switch==='trade'?tradeViews:waiverViews;
  const i=list.findIndex(([value])=>value===button.dataset.pfo64Value);
  const next=event.key==='Home'?0:event.key==='End'?list.length-1:
   (i+(event.key==='ArrowRight'?1:-1)+list.length)%list.length;
  event.preventDefault();
  const target=document.querySelector('[data-pfo64-switch="'+button.dataset.pfo64Switch+
   '"][data-pfo64-value="'+list[next][0]+'"]');
  target?.focus();target?.click();
 });
 function init(){
  mount();
  document.querySelector('nav button[data-page="matchup"]')?.addEventListener('click',mountMatchup);
  document.querySelector('nav button[data-page="market"]')?.addEventListener('click',()=>{mountTrade();mountWaiver();});
  document.querySelectorAll('[data-pfo59-market="waiver"]').forEach(button=>button.addEventListener('click',mountWaiver));
  document.querySelectorAll('[data-pfo59-market-tab="trade"],[data-pfo59-market-view="trade"]').forEach(
   button=>button.addEventListener('click',mountTrade));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 window.ffoLayout64={mount,setMatchup,setTrade,setWaiver};
})();
