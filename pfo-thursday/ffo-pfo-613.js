/* PFO 6.13 · preserve legacy trade research behind an optional evidence fold.
 * The FFO Trade Analyzer remains the working two-sided decision surface.
 */
(()=>{'use strict';
 let mounted=false;
 function mount(){
  const existing=document.getElementById('trade-intel');
  if(!existing||existing.closest('[data-pfo613-legacy]'))return;
  const section=document.createElement('details');
  section.className='pfo613-legacy-trade';
  section.dataset.pfo613Legacy='true';
  const summary=document.createElement('summary');
  summary.textContent='Historical trade research and alternative market evidence';
  section.append(summary);
  existing.before(section);
  section.append(existing);
  mounted=true;
 }
 function init(){
  mount();
  const market=document.querySelector('nav button[data-page="market"]');
  market?.addEventListener('click',()=>setTimeout(mount,0));
  document.addEventListener('click',e=>{
   if(e.target.closest?.('[data-pfo59-market="trade"],[data-pfo64-switch="trade"],[data-pfo59-market-tab="trade"]'))
    setTimeout(mount,0);
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
 window.ffoPfo613={mount,hasLegacyFold:()=>mounted};
})();