/* FFO PFO 5.9.4 — original FFO mobile navigation system.
 * Preserves all existing page nodes, events, API calls and Commissioner controls.
 * Uses familiar compact-app interaction principles without importing Sleeper art/code.
 */
(()=>{'use strict';
 const pageLabels={overview:'Overview',roster:'Team HQ',gamecast:'GameCast',matchup:'Matchup',market:'Market',scouting:'GM Scouting',playerhub:'Player Intel',radar:'Opportunity Radar',ask:'Ask Front Office',coaching:'Coaching Review',championship:'Championship',availability:'Injury Watch',privacy:'Sources / Privacy',commissioner:'Commissioner'};
 const primary=[
  {page:'overview',mark:'⌂',short:'Overview'},
  {page:'roster',mark:'◆',short:'Team'},
  {page:'gamecast',mark:'◉',short:'GameCast'},
  {page:'matchup',mark:'▦',short:'Matchup'},
  {page:'market',mark:'⇄',short:'Market'}
 ];
 const $=q=>document.querySelector(q);
 const nav=$('#nav');if(!nav)return;
 const buttons=[...nav.querySelectorAll('button[data-page]')];
 const pages=new Set(buttons.map(b=>b.dataset.page));
 let active=buttons.find(b=>b.classList.contains('active'))?.dataset.page||'overview';
 const scrollPositions=new Map();
 let lastFocus=null;
 const toolbar=document.createElement('div');
 toolbar.id='ffo594-dock';toolbar.setAttribute('role','navigation');toolbar.setAttribute('aria-label','Primary Front Office navigation');
 toolbar.innerHTML=primary.map(x=>
  '<button type="button" class="ffo594-dock-btn" data-ffo594-page="'+x.page+'" aria-label="Open '+x.short+'" aria-current="'+(active===x.page?'page':'false')+'">'+
  '<span class="ffo594-symbol" aria-hidden="true">'+x.mark+'</span><span class="ffo594-dock-label">'+x.short+'</span></button>'
 ).join('')+
 '<button type="button" id="ffo594-more" class="ffo594-dock-btn" aria-haspopup="true" aria-expanded="false" aria-controls="nav"><span class="ffo594-symbol" aria-hidden="true">☷</span><span class="ffo594-dock-label">All Tools</span></button>';
 const backdrop=document.createElement('button');
 backdrop.type='button';backdrop.id='ffo594-backdrop';backdrop.setAttribute('aria-label','Close All Tools menu');
 document.body.append(backdrop,toolbar);
 document.documentElement.classList.add('ffo594-ready');
 nav.setAttribute('aria-label','All Front Office tools');
 nav.setAttribute('aria-hidden','false');
 // All Tools is already fully visible, no search UI or duplicate primary destinations.
 const visibleTools=()=>buttons.filter(b=>!primary.some(x=>x.page===b.dataset.page)&&!b.hidden);
 const more=$('#ffo594-more');
 const isMobile=()=>matchMedia('(max-width: 720px)').matches;
 const update=()=>{
  active=buttons.find(b=>b.classList.contains('active'))?.dataset.page||active;
  for(const b of toolbar.querySelectorAll('[data-ffo594-page]'))b.setAttribute('aria-current',b.dataset.ffo594Page===active?'page':'false');
  more.classList.toggle('ffo594-dock-active',!primary.some(x=>x.page===active));
  const main=$('main');if(main)main.setAttribute('data-ffo594-current',active);
  document.title='FFO · '+(pageLabels[active]||'Private Front Office');
 };
 const close=(returnFocus=false)=>{
  document.body.classList.remove('ffo594-more-open');
  more.setAttribute('aria-expanded','false');
  // Keep primary tools on the dock only; preserve all secondary tool buttons.
  if(returnFocus&&lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
 };
 const open=()=>{
  if(!isMobile())return;
  lastFocus=document.activeElement;
  document.body.classList.add('ffo594-more-open');
  more.setAttribute('aria-expanded','true');
  nav.scrollTop=0;
  visibleTools()[0]?.focus({preventScroll:true});
 };
 const goto=page=>{
  if(!pages.has(page))return;
  // Route through existing nav button so GameCast lazy loading, Commissioner
  // security and analytics lifecycle listeners all run unchanged.
  const target=buttons.find(b=>b.dataset.page===page);
  close();target?.click();
  requestAnimationFrame(update);
 };
 toolbar.addEventListener('click',e=>{
  const p=e.target.closest('[data-ffo594-page]');if(p){goto(p.dataset.ffo594Page);return;}
  if(e.target.closest('#ffo594-more')){
   document.body.classList.contains('ffo594-more-open')?close(true):open();
  }
 });
 backdrop.addEventListener('click',()=>close(true));
 // Capture before legacy onclick resets scroll. Keep per-page position, like a native app.
 nav.addEventListener('click',e=>{
  const next=e.target.closest('button[data-page]')?.dataset.page;
  if(!next||!pages.has(next))return;
  const previous=buttons.find(b=>b.classList.contains('active'))?.dataset.page||active;
  if(previous!==next){
   scrollPositions.set(previous,window.scrollY||0);
   requestAnimationFrame(()=>{
    const previousY=scrollPositions.get(next)||0;
    const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
    window.scrollTo(0,Math.min(previousY,max));
   });
  }
 },true);
 nav.addEventListener('click',e=>{
  if(e.target.closest('button[data-page]')){
   close();requestAnimationFrame(update);
  }
 });
 document.addEventListener('keydown',e=>{
  if(!document.body.classList.contains('ffo594-more-open'))return;
  if(e.key==='Escape'){e.preventDefault();close(true);return}
  if(e.key==='Tab'){
   const visible=visibleTools(),first=visible[0],last=visible.at(-1)||first;
   if(first&&e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus({preventScroll:true})}
   else if(last&&!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus({preventScroll:true})}
  }
 });
 window.addEventListener('resize',()=>{if(!isMobile())close()},{passive:true});
 update();
 window.ffoMobileUX594={openTools:open,closeTools:close,openPage:goto,getCurrent:()=>active};
})();