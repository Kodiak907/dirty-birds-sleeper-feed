/* PFO 6.6 — instant Start/Sit roster controls, no Market hydration. */
(()=>{'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number.isFinite(x)?Number(x).toFixed(1):'—';
const state={first:'',second:'',horizon:'WEEK',nonce:0};
const home=()=>document.getElementById('pfo63-startsit');
const nowWeek=()=>typeof pfo52Cur==='function'?pfo52Cur():Number(window.dbNflWeek||9);
function source(){
 const snap=typeof gm47Snapshot!=='undefined'?gm47Snapshot:null;
 const live=typeof liveRosterSnapshot!=='undefined'?liveRosterSnapshot:null;
 const rid=String(window.dbRosterId||live?.roster_id||1);
 const team=snap?.rosters?.find(x=>String(x.roster_id)===rid)||null;
 const ids=(live?.roster_player_ids||team?.players||[]).map(String);
 const reserved=new Set((live?.reserve||team?.reserve||[]).map(String));
 const started=new Set((live?.starters||team?.starters||[]).map(String));
 const liveNames=new Map((live?.players||[]).map(x=>[String(x.player_id),x]));
 const all=ids.map(id=>{
  const p=liveNames.get(id)||(typeof pfo52Info==='function'?pfo52Info(id):null)||{};
  return {id,name:p.name||'',team:p.team||'',position:String(p.position||'').toUpperCase().replace('D/ST','DEF'),
   injury:String(p.sleeper_injury_status||p.injury_status||'').toUpperCase(),starter:started.has(id),reserved:reserved.has(id)};
 }).filter(x=>x.name&&!x.name.startsWith('Unknown player'));
 return {players:all.filter(x=>!x.reserved),ir:all.filter(x=>x.reserved),source:live?'Live roster':team?'League roster snapshot':'Awaiting roster'};
}
function value(p,week){
 let points=null,usage=null,opponent='Not verified',bye=false;
 try{const n=typeof pfo50Estimate==='function'?pfo50Estimate(p.id):null;if(typeof n==='number'&&Number.isFinite(n))points=n;}catch{}
 try{
  const row=typeof pfo50StatsFor==='function'?pfo50StatsFor(p.id):null;
  const g=(row?.last_three||[]).filter(x=>Number(x.week)<week).sort((a,b)=>b.week-a.week)[0]||null;
  const st=g?.stats||row?.latest?.stats||row?.latest||{};
  const key=p.position==='QB'?'pass_att':p.position==='RB'?'rush_att':['WR','TE'].includes(p.position)?'targets':null;
  if(key&&st[key]!=null&&Number.isFinite(Number(st[key])))usage=key.replace('_',' ')+' '+st[key]+(g?.week?' (W'+g.week+')':'');
 }catch{}
 try{
  const calendar=window.ffoPfo597?.verifiedSchedule?.(),g=calendar?.teams?.[p.team.toUpperCase()]?.weeks?.[String(week)];
  if(g){opponent=g.opponent||'Not verified';bye=g.bye===true;}
 }catch{}
 return {points,usage,opponent,bye};
}
function card(p,v){return '<div><b>'+esc(p.name)+'</b><small>'+esc(p.position)+' · '+esc(p.team)+
 (p.starter?' · Submitted starter':' · Bench')+'</small>'+
 '<div>FFL baseline <strong>'+fmt(v.points)+' PPG</strong></div>'+
 '<div>Opponent: '+esc(v.bye?'BYE':v.opponent)+'</div>'+
 '<div>'+esc(v.usage||'No verified workload sample')+'</div>'+
 '<div>Status: '+esc(p.injury||'Not tagged · health not certified')+'</div></div>';}
function details(token,players,week){
 if(token!==state.nonce)return;
 const box=home()?.querySelector('#pfo66-compare-output');if(!box)return;
 const a=players.find(x=>x.id===state.first),b=players.find(x=>x.id===state.second);
 if(!a||!b){box.textContent='Select two different players.';return;}
 const av=value(a,week),bv=value(b,week);if(token!==state.nonce)return;
 let note='';
 if(state.horizon==='WEEK'){
  note=av.points!=null&&bv.points!=null&&!av.bye&&!bv.bye?
   'Baseline difference <b>'+fmt(Math.abs(av.points-bv.points))+' model PPG</b> ('+
   esc(av.points>=bv.points?a.name:b.name)+' higher). Not a validated matchup-adjusted prediction.':
   'Comparison withheld: independent baseline or game-week eligibility is missing.';
 }else note=state.horizon==='ROS'?
  'Rest-of-season differential withheld pending validated week-specific forecasts.':
  'Fantasy-playoff differential withheld pending verified Weeks 15–17 forecasts.';
 box.innerHTML='<div class="pfo63-compare-players">'+card(a,av)+card(b,bv)+'</div>'+
  '<p class="pfo63-compare-conclusion">'+note+'</p>'+
  '<small class="pfo63-compare-foot">No automatic lineup changes. Verify official injury status.</small>';
}
function render(){
 const host=home();if(!host)return;
 const data=source(),players=data.players,week=nowWeek(),token=++state.nonce;
 if(!players.length){
  host.innerHTML='<h3>Start / Sit · Player Comparison</h3><p>Roster unavailable. This tool does not wait for Market; player names and values remain unknown until the roster loads.</p>';
  return;
 }
 if(!players.some(p=>p.id===state.first))state.first=players.find(p=>p.starter)?.id||players[0].id;
 if(!players.some(p=>p.id===state.second)||state.second===state.first)
  state.second=players.find(p=>p.id!==state.first)?.id||'';
 const options=selected=>players.map(p=>'<option value="'+esc(p.id)+'"'+(p.id===selected?' selected':'')+'>'+
  esc(p.name)+' · '+esc(p.position)+(p.starter?' · Starter':'')+'</option>').join('');
 host.innerHTML='<div class="pfo63-compare-head"><h3>Start / Sit · Player Comparison</h3><small>'+
  esc(data.source)+' · Week '+week+' · Coach decides</small></div>'+
  '<div class="pfo63-compare-choices"><label>Compare player A<select data-pfo63-compare="first">'+options(state.first)+'</select></label>'+
  '<label>Compare player B<select data-pfo63-compare="second">'+options(state.second)+'</select></label></div>'+
  '<div class="pfo63-horizon">'+[['WEEK','This week'],['ROS','Rest of season'],['PLAYOFFS','Playoffs']].map(([v,label])=>
   '<button type="button" data-pfo63-horizon="'+v+'" aria-pressed="'+(state.horizon===v)+'">'+label+'</button>').join('')+'</div>'+
  '<div id="pfo66-compare-output" aria-live="polite"><p class="pfo63-compare-foot">Player choices ready · loading two research snapshots.</p></div>'+
  (data.ir.length?'<p class="pfo63-compare-foot">'+data.ir.length+' fantasy-reserve player(s) excluded from start/sit choices.</p>':'');
 const work=()=>setTimeout(()=>details(token,players,week),0);
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(work);else work();
}
function mount(){
 const anchor=document.getElementById('pfo52-matchup');if(!anchor||home())return;
 const section=document.createElement('section');section.id='pfo63-startsit';section.className='pfo63-compare';anchor.before(section);
}
document.addEventListener('change',event=>{
 const input=event.target.closest?.('[data-pfo63-compare]');if(!input)return;
 state[input.dataset.pfo63Compare]=input.value;render();
});
document.addEventListener('click',event=>{
 const b=event.target.closest?.('[data-pfo63-horizon]');if(!b)return;
 state.horizon=b.dataset.pfo63Horizon;render();
});
function init(){
 mount();document.querySelector('nav button[data-page="matchup"]')?.addEventListener('click',()=>{
  mount();if(document.querySelector('#matchup[data-pfo64-tab="startsit"]'))render();
 });
 if(document.querySelector('#matchup.page.active'))render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.ffoStartSit63={refresh:render};
})();
