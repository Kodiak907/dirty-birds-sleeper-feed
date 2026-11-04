/* PFO 6.3 — read-only Start/Sit Compare inside existing Weekly Matchup.
 * Comparative evidence, not an automated lineup instruction.
 */
(()=>{'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=x=>typeof x==='number'&&Number.isFinite(x)?x.toFixed(1):'—';
 const state={first:'',second:'',horizon:'WEEK'};
 const norm=x=>String(x||'').toUpperCase().replace('D/ST','DEF');
 const home=()=>document.getElementById('pfo63-startsit');
 const source=()=>{
  const market=window.ffoPfo59?.marketResearchContext?.();
  const roster=market?.rosters?.find(r=>String(r.roster_id)===String(market.ownerRosterId||1));
  const players=(roster?.players||[]).map(String).filter(pid=>market.names?.[pid]?.name);
  return {market,players};
 };
 function model(id,context){
  const p=context.market?.names?.[id]||{},estimate=context.market?.estimate?.(id);
  const ppg=typeof estimate==='number'&&Number.isFinite(estimate)?estimate:null;
  const info=typeof pfo50StatsFor==='function'?pfo50StatsFor(id):null;
  const latest=info?.latest||{},role=norm(p.position),week=Number(window.dbNflWeek||9);
  const schedule=window.ffoPfo597?.verifiedSchedule?.();
  const game=schedule?.teams?.[String(p.team||'').toUpperCase()]?.weeks?.[String(week)]||null;
  const opponent=game?.bye===true?'BYE':game?.opponent||'Unverified matchup';
  const usage=role==='QB'?['Pass attempts',latest.pass_att]:role==='RB'?
   ['Rush attempts',latest.rush_att]:['Targets',latest.targets];
  const statWeek=Number(latest.week);
  return {p,ppg,role,week,opponent,usage,
   usageWeek:Number.isInteger(statWeek)&&statWeek>=1?statWeek:null,
   injury:p.injury_status||p.status||null,
   freshness:context.market?.snapshotAt||null};
 }
 function render(){
  const host=home();if(!host)return;
  const c=source();
  if(!c.market?.rosters?.length){
   host.innerHTML='<h3>Start / Sit · Player Comparison</h3><p>Waiting for a current roster and independent player directory. No unsupported lineup recommendation is shown.</p>';
   return;
  }
  if(!c.players.includes(state.first))state.first=c.players[0]||'';
  if(!c.players.includes(state.second)||state.first===state.second)
   state.second=c.players.find(id=>id!==state.first)||'';
  const options=selected=>c.players.map(pid=>'<option value="'+esc(pid)+'"'+
   (selected===pid?' selected':'')+'>'+esc(c.market.names[pid].name)+' · '+
   esc(c.market.names[pid].position||'')+'</option>').join('');
  const a=model(state.first,c),b=model(state.second,c);
  const rows=[a,b];
  let html='<div class="pfo63-compare-head"><div><h3>Start / Sit · Player Comparison</h3>'+
   '<small>Coach decides the lineup · independent research only</small></div></div>';
  html+='<div class="pfo63-compare-choices"><label>Compare player A<select data-pfo63-compare="first">'+options(state.first)+'</select></label>'+
   '<label>Compare player B<select data-pfo63-compare="second">'+options(state.second)+'</select></label></div>';
  html+='<div class="pfo63-horizon">'+[['WEEK','This week'],['ROS','Rest of season'],['PLAYOFFS','Playoffs']]
   .map(([value,label])=>'<button type="button" data-pfo63-horizon="'+value+'" aria-pressed="'+
    (state.horizon===value)+'">'+label+'</button>').join('')+'</div>';
  html+='<div class="pfo63-compare-players">'+rows.map(x=>{
   const usage=x.usageWeek!==null&&x.usage[1]!=null?
    esc(x.usage[0])+' '+esc(x.usage[1])+' (source W'+esc(x.usageWeek)+')':'No verified recent workload sample';
   return '<div><b>'+esc(x.p.name||'Unknown')+'</b><small>'+esc(x.role)+' · '+
    esc(x.p.team||'NFL team unverified')+'</small>'+
    '<div>Independent FFL model baseline <strong>'+fmt(x.ppg)+' PPG</strong></div>'+
    '<div>Upcoming opponent: '+esc(x.opponent)+'</div>'+
    '<div>'+usage+'</div>'+
    '<div>Injury metadata: '+esc(x.injury||'No injury tag; health not certified')+'</div></div>';
  }).join('')+'</div>';
  if(state.horizon==='WEEK'){
   const enough=a.ppg!==null&&b.ppg!==null&&a.opponent!=='BYE'&&b.opponent!=='BYE';
   html+='<p class="pfo63-compare-conclusion">'+(enough?
    'Independent baseline difference: <b>'+fmt(Math.abs(a.ppg-b.ppg))+' model PPG</b> ('+
     esc(a.ppg>=b.ppg?a.p.name:b.p.name)+' has the higher baseline). This is not a validated opponent-adjusted weekly forecast or a start instruction.':
    'A numeric comparison is withheld until both independent estimates and playing-week eligibility can be checked. Missing data is never treated as zero.')+'</p>';
  }else{
   html+='<p class="pfo63-compare-conclusion">'+(state.horizon==='ROS'?
    'Rest-of-season player differentials require week-by-week verified projections and health/workload adjustments.':
    'Playoff-specific differentials require independently modeled Weeks 15–17 and opponent-specific evidence.')+
    ' Those forecasts are not certified yet, so no invented points or percentages are displayed.</p>';
  }
  html+='<small class="pfo63-compare-foot">Usage snapshots and NFL schedules are separate from forecasts. Verify official game-week injury statuses before locking a lineup. This tool neither chooses a starter nor modifies submissions.</small>';
  host.innerHTML=html;
 }
 function mount(){
  const anchor=document.getElementById('pfo52-matchup');
  if(!anchor||home())return;
  const section=document.createElement('section');section.id='pfo63-startsit';
  section.className='pfo63-compare';
  anchor.before(section);
 }
 document.addEventListener('change',event=>{
  const control=event.target.closest('[data-pfo63-compare]');if(!control)return;
  state[control.dataset.pfo63Compare]=control.value;render();
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-pfo63-horizon]');if(button){
   state.horizon=button.dataset.pfo63Horizon;render();
  }
 });
 function init(){mount();
  document.querySelector('nav button[data-page="matchup"]')?.addEventListener('click',()=>{mount();render();});
  if(document.querySelector('#matchup.page.active'))render();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 window.ffoStartSit63={refresh:render};
})();
