/* PFO 5.9 development: dedicated research workspaces and owner-specific advisory lenses.
 * Additive only. No Sleeper mutations. Every research rank is source-limited.
 */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const posList=['ALL','QB','RB','WR','TE','K','DEF'];
 let statRequested=false;
 const state={market:'home',manager:'1',position:'ALL',search:'',snap:null,names:null,scout:null,ideas:null,schedule:new Map(),loading:false,waiverLoaded:false,tradeLoaded:false};
 function teamName(id){
  const r=state.snap?.rosters?.find(x=>String(x.roster_id)===String(id));
  const u=state.snap?.users?.find(x=>String(x.user_id)===String(r?.owner_id));
  return u?.metadata?.team_name||u?.display_name||('Roster '+id);
 }
 function options(){
  return (state.snap?.rosters||[]).slice().sort((a,b)=>a.roster_id-b.roster_id).map(r=>'<option value="'+safe(r.roster_id)+'"'+(String(r.roster_id)===state.manager?' selected':'')+'>'+safe(teamName(r.roster_id))+'</option>').join('');
 }
 function needs(rid){
  const r=state.snap?.rosters?.find(x=>String(x.roster_id)===String(rid));
  const names=state.names||{},counts={QB:0,RB:0,WR:0,TE:0,K:0,DEF:0},unknown=[];
  for(const id of r?.players||[]){
   const p=names[id];const pos=String(p?.position||'').replace('D/ST','DEF').toUpperCase();
   if(Object.hasOwn(counts,pos))counts[pos]++;else unknown.push(id);
  }
  const slots=state.snap?.league?.roster_positions||[];
  const required={QB:Math.max(1,slots.filter(x=>x==='QB').length),RB:Math.max(1,slots.filter(x=>x==='RB').length),WR:Math.max(1,slots.filter(x=>x==='WR').length),TE:Math.max(1,slots.filter(x=>x==='TE').length),K:slots.includes('K')?1:0,DEF:slots.includes('DEF')?1:0};
  const targets={QB:required.QB+1,RB:required.RB+2,WR:required.WR+2,TE:required.TE+1,K:required.K,DEF:required.DEF};
  const priority=Object.fromEntries(Object.keys(counts).map(pos=>[pos,Math.max(0,targets[pos]-counts[pos])]));
  return {counts,targets,priority,unknown,known:!!r};
 }
 function ownership(){const s=new Set();for(const r of state.snap?.rosters||[])for(const id of r.players||[])s.add(String(id));return s}
 function entryPool(){
  if(!state.snap?.rosters?.length||!state.names)return [];
  const owned=ownership(),memo=new Map();
  for(const [id,p] of Object.entries(state.names)){
   const pos=String(p?.position||'').toUpperCase().replace('D/ST','DEF');
   if(owned.has(String(id))||!posList.includes(pos)||pos==='ALL'||!p?.name)continue;
   memo.set(String(id),{id:String(id),name:p.name,position:pos,team:p.team||'',scout:null,tracked:false});
  }
  for(const x of state.scout?.candidates||[]){
   const id=String(x.id||x.player_id||''),p=memo.get(id);
   if(p){p.scout=x;p.tracked=true}
  }
  return [...memo.values()];
 }
 function scoreInfo(p){
  let season=null,project=null;
  try {
   const row=pfo50Indexed?.get(pfo50Key(p.name,p.team));
   if(row?.season_totals)season=row.season_totals;
   if(row?.forecast)project=pfo50Score(row.forecast);
  }catch{}
  return {season,project};
 }
 function playerRow(p,priority){
  const x=scoreInfo(p),signals=p.scout?.signals||[];
  const projected=x.project!=null&&Number.isFinite(x.project)?Number(x.project).toFixed(1)+' pts/game model':'Projection unavailable';
  return '<div class="pfo59-player"><div class="pfo59-player-head"><span><b>'+safe(p.name)+'</b><small>'+safe(p.position)+' · '+safe(p.team||'NFL team not established')+'</small></span><span class="pfo59-chip">'+(p.tracked?'GM tracked':'Directory only')+'</span></div>'+
   '<div class="pfo59-player-meta"><span>'+safe(projected)+'</span><span>Roster-depth gap '+safe(priority||0)+'</span><span>'+safe(signals.length)+' research flags</span></div>'+
   (signals.length?'<p>'+safe(String(signals[0].description||'Flag requires verification').slice(0,240))+'</p>':'<p>Unscouted candidate. No source-verified opportunity or current availability established.</p>')+
   '<small>Unrostered in '+safe(state.snap?.fetched_at_utc||'source time unknown')+' league snapshot; waiver clearance, health and game eligibility still require checking.</small></div>';
 }
 function waiver(){
  const host=$('pfo59-waiver-board');if(!host)return;
  if(!state.snap||!state.names){host.innerHTML='<p>Loading published league roster and player directory…</p>';return}
  const n=needs(state.manager),pool=entryPool(),filtered=pool.filter(p=>(state.position==='ALL'||p.position===state.position)&&p.name.toLowerCase().includes(state.search.toLowerCase()));
  filtered.sort((a,b)=>{
   const gap=Number(n.priority[b.position]||0)-Number(n.priority[a.position]||0);
   if(state.position==='ALL'&&gap)return gap;
   const pa=scoreInfo(a).project,pb=scoreInfo(b).project;
   if(pa!=null&&pb!=null&&pa!==pb)return pb-pa;
   if(pa!=null&&pb==null)return -1;if(pb!=null&&pa==null)return 1;
   return Number(b.tracked)-Number(a.tracked)||a.name.localeCompare(b.name);
  });
  const leaders=posList.slice(1).map(pos=>{
   const list=pool.filter(p=>p.position===pos).sort((a,b)=>{
    const av=scoreInfo(a).project,bv=scoreInfo(b).project;
    return (bv==null?-Infinity:bv)-(av==null?-Infinity:av);
   });
   const leaders=list.filter(x=>scoreInfo(x).project!=null);
   return '<div class="pfo59-leader"><b>'+safe(pos)+'</b><span>'+safe(leaders[0]?.name||'No published model leader')+'</span><small>'+(leaders.length?'Projected model '+safe(scoreInfo(leaders[0]).project.toFixed(1))+' PPG · not actual results':'No supported ranking')+'</small></div>';
  }).join('');
  const gaps=posList.slice(1).filter(pos=>n.priority[pos]>0).sort((a,b)=>n.priority[b]-n.priority[a]);
  host.innerHTML='<div class="pfo59-caveat">Personalized rankings use roster counts as a <b>depth proxy</b>, not proof of talent weakness. Projection fields only appear when independently published. The candidate directory is incomplete; this is not the entire NFL free-agent list. Nothing is claimed or bid.</div>'+
    '<div class="pfo59-metrics"><strong>'+safe(teamName(state.manager))+'</strong><span>Depth watch: '+safe(gaps.map(p=>p+' ('+n.counts[p]+'/'+n.targets[p]+')').join(' · ')||'No simple depth gaps')+'</span><small>'+safe(n.unknown.length)+' player IDs lacked position mapping; gaps are provisional · Sleeper roster snapshot '+safe(state.snap.fetched_at_utc||'unknown')+'</small></div>'+
    '<h3>Published research / model leaders by position</h3><div class="pfo59-leaders">'+leaders+'</div>'+
    '<div class="pfo59-list-head"><h3>'+safe(state.position==='ALL'?'Personalized available player board':state.position+' available player board')+'</h3><small>'+safe(filtered.length)+' unrostered names in published directory · sorted by '+(state.position==='ALL'?'position depth then model':'model when covered')+'</small></div>'+
    (filtered.length?filtered.slice(0,60).map(p=>playerRow(p,n.priority[p.position])).join(''):'<p>No matching published unrostered player IDs. Do not infer league-wide absence.</p>')+
    (filtered.length>60?'<p>Showing 60 of '+safe(filtered.length)+' source-matched candidates. Narrow by position or name.</p>':'');
 }
 function trade(){
  const host=$('pfo59-trade-board');if(!host)return;
  const ideas=(state.ideas?.suggestions||[]).filter(x=>String(x.opponent_roster_id)===state.manager&&String(x.opponent_roster_id)!=='3');
  const n=needs(state.manager);
  host.innerHTML='<div class="pfo59-caveat">These are <b>two-sided scenario screens</b>, never actual offers or acceptance probabilities. BigOlBoyle (roster 3) is visible for league intelligence but excluded from trade proposals.</div>'+
    '<div class="pfo59-metrics"><strong>'+safe(teamName(state.manager))+'</strong><span>Depth watch: '+safe(Object.keys(n.priority).filter(k=>n.priority[k]>0).map(k=>k+' '+n.counts[k]+'/'+n.targets[k]).join(' · ')||'No basic depth gap')+'</span></div>'+
    '<h3>Published scenarios involving this manager</h3>'+
    (ideas.length?ideas.slice(0,16).map(x=>'<div class="pfo59-player"><b>Give '+safe((x.give||[]).map(p=>p.name).join(' + '))+'</b><p>Receive '+safe((x.receive||[]).map(p=>p.name).join(' + '))+'</p>'+
      '<div class="pfo59-player-meta">Dirty Birds model '+safe(Number(x.dirty_birds_delta_ppg||0).toFixed(2))+' PPG · Opponent model '+safe(Number(x.opponent_delta_ppg||0).toFixed(2))+' PPG</div><small>'+safe((x.warnings||[]).join('; ')||'Acceptance, market value, availability and current roles require independent verification')+'</small></div>').join(''):'<p>No dated model-screened scenarios for this manager. No proposal has been invented.</p>')+
    '<small>Published scenario report: '+safe(state.ideas?.generated_at_utc||'Not loaded')+'. Trade Laboratory below remains the original full multi-player comparison engine.</small>';
 }
 async function loadAdvisory(force=false){
  if(state.loading)return;state.loading=true;
  try{
   const picks=await Promise.allSettled([fetchReport('fast_latest.json'),fetchReport('player_names.json'),fetchReport('AUTOMATED_WAIVER_SCOUTING.json'),fetchReport('TRADE_IDEAS.json')]);
   if(picks[0].status==='fulfilled')state.snap=picks[0].value;
   if(picks[1].status==='fulfilled')state.names=picks[1].value;
   if(picks[2].status==='fulfilled')state.scout=picks[2].value;
   if(picks[3].status==='fulfilled')state.ideas=picks[3].value;
   if(state.snap&&!state.snap.rosters?.some(r=>String(r.roster_id)===state.manager))state.manager='1';
  }catch(err){console.warn('PFO59 advisory',err)}finally{state.loading=false;managerOptions();waiver();trade()}
 }
 function managerOptions(){
  for(const id of ['pfo59-waiver-manager','pfo59-trade-manager']){
   const select=$(id);if(select){const chosen=state.manager;select.innerHTML=options();select.value=chosen;}
  }
 }
 function marketView(view){
  state.market=view;
  for(const b of document.querySelectorAll('[data-pfo59-market]'))b.setAttribute('aria-selected',String(b.dataset.pfo59Market===view));
  for(const panel of document.querySelectorAll('[data-pfo59-market-panel]'))panel.hidden=panel.dataset.pfo59MarketPanel!==view;
  if(view==='waiver'||view==='trade')void loadAdvisory();
  if(view==='waiver'&&!statRequested&&typeof pfo50LoadIndependent==='function'){
   statRequested=true;void pfo50LoadIndependent().then(()=>waiver()).catch(()=>{});
  }
  if(view==='transactions')try{if(typeof refreshFaab==='function')void refreshFaab()}catch{}
 }
 function mountMarket(){
  const root=$('market'),columns=root?.querySelector('.market-columns'),tradeFold=$('trade-fold'),waiverFold=$('waiver-fold'),faab=$('faabpanel')?.closest('.card');
  if(!root||!columns||!tradeFold||!waiverFold||!faab)return;
  const nav=document.createElement('div');nav.id='pfo59-market';nav.innerHTML=
   '<div class="pfo59-market-tabs" aria-label="Front Office market tools">'+
   '<button type="button" data-pfo59-market="home">Market home</button><button type="button" data-pfo59-market="trade">Trades</button><button type="button" data-pfo59-market="waiver">Waivers</button><button type="button" data-pfo59-market="transactions">Transactions</button></div>'+
   '<section data-pfo59-market-panel="home"><div class="pfo59-tiles"><button type="button" data-pfo59-market="trade"><b>Trade Command</b><span>Build offers and examine two-sided roster fit</span></button><button type="button" data-pfo59-market="waiver"><b>Waiver Command</b><span>Manager-specific priorities and position leaders</span></button><button type="button" data-pfo59-market="transactions"><b>Transactions</b><span>FAAB, executed moves and Sleeper history</span></button></div></section>'+
   '<section data-pfo59-market-panel="trade" hidden><div class="pfo59-subhead"><h2>Trade Command</h2><label>Analyze manager <select id="pfo59-trade-manager"></select></label></div><div id="pfo59-trade-board"></div><div id="pfo59-trade-existing"></div></section>'+
   '<section data-pfo59-market-panel="waiver" hidden><div class="pfo59-subhead"><h2>Waiver Command</h2><label>Roster <select id="pfo59-waiver-manager"></select></label></div>'+
   '<div class="pfo59-filters"><label>Available players <select id="pfo59-position">'+posList.map(p=>'<option>'+p+'</option>').join('')+'</select></label><label>Search <input id="pfo59-find" type="search" placeholder="Player name…" autocomplete="off"></label></div><div id="pfo59-waiver-board"></div><details class="pfo59-legacy"><summary>Existing GM waiver scouting and source trail</summary><div id="pfo59-waiver-existing"></div></details></section>'+
   '<section data-pfo59-market-panel="transactions" hidden><h2>League Transactions / FAAB</h2><p>Read-only Sleeper transactions, FAAB spent, budget and ledger history. No transaction is performed by FFO.</p><div id="pfo59-txn-existing"></div></section>';
  root.querySelector('.market-heading')?.after(nav);
  const legacyTrade=$('trade-intel')?.closest('#trade-fold');
  $('pfo59-trade-existing').appendChild(tradeFold);
  $('pfo59-waiver-existing').appendChild(waiverFold);
  $('pfo59-txn-existing').appendChild(faab);
  const gamecastTrade=$('ffo-gc-trade-intel');if(gamecastTrade)$('pfo59-trade-existing').prepend(gamecastTrade);
  columns.remove();
  nav.addEventListener('click',ev=>{const b=ev.target.closest('[data-pfo59-market]');if(b)marketView(b.dataset.pfo59Market)});
  nav.addEventListener('change',ev=>{
   if(ev.target.id==='pfo59-position'){state.position=ev.target.value;waiver()}
   if(ev.target.id==='pfo59-waiver-manager'||ev.target.id==='pfo59-trade-manager'){state.manager=ev.target.value;managerOptions();waiver();trade()}
  });
  nav.addEventListener('input',ev=>{if(ev.target.id==='pfo59-find'){state.search=ev.target.value;waiver()}});
  marketView('home');
 }
 function entryMatch(rows){
  const ours=rows.find(x=>Number(x.roster_id)===1);if(!ours)return null;
  const peer=rows.find(x=>Number(x.roster_id)!==1&&ours.matchup_id!=null&&String(x.matchup_id)===String(ours.matchup_id));
  if(!peer)return {ours,peer:null};
  return {ours,peer};
 }
 function scheduleRender(){
  const host=$('pfo59-schedule');if(!host)return;
  const snap=state.snap||{},weeks=[...Array(18)].map((_,i)=>i+1),current=Number(snap.nfl_state?.week||8);
  host.innerHTML='<div class="pfo59-schedule-head"><h2>FFL Team Schedule</h2><button type="button" id="pfo59-schedule-load">Load full 18-week schedule</button></div>'+
   '<div class="pfo59-schedule-list">'+weeks.map(w=>{
    const rows=state.schedule.get(w)||[];
    const match=entryMatch(rows),other=match?.peer,ours=match?.ours;
    let label=other?teamName(other.roster_id):rows.length?'Opponent not established':'Schedule not yet retrieved';
    let outcome='';if(w<current&&other&&ours&&Number.isFinite(Number(ours.points))&&Number.isFinite(Number(other.points)))outcome=Number(ours.points)>Number(other.points)?'W':Number(ours.points)<Number(other.points)?'L':'T';
    return '<div class="pfo59-week"><span>Week '+w+'</span><strong>'+safe(label)+'</strong><small>'+safe(outcome)+' '+(w<current&&other?'FFL '+safe(ours?.points??'—')+'–'+safe(other?.points??'—'):w===current?'Current week':'')+'</small><button type="button" data-pfo59-week="'+w+'">View</button></div>';
   }).join('')+'</div><p class="pfo59-foot">Matchups from Sleeper only. Weeks without retrieved pairings remain unconfirmed; no future opponents are guessed.</p>';
 }
 async function loadSchedule(full=false){
  if(state.loadingSchedule)return;
  state.loadingSchedule=true;
  try{
   const snap=await fetchReport('latest.json');if(!state.snap)state.snap=snap;
   for(const [k,v] of Object.entries(snap.matchups_by_week||{}))if(Array.isArray(v))state.schedule.set(Number(k),v);
   scheduleRender();
   if(full&&typeof pfo52GetWeek==='function'){
    for(let start=1;start<=18;start+=4){
     const weeks=[start,start+1,start+2,start+3].filter(w=>w<=18);
     const rows=await Promise.allSettled(weeks.map(w=>pfo52GetWeek(w)));
     rows.forEach((r,i)=>{if(r.status==='fulfilled'&&Array.isArray(r.value))state.schedule.set(weeks[i],r.value)});
     scheduleRender();
    }
   }
  }catch(err){const host=$('pfo59-schedule');if(host&&!state.schedule.size)host.textContent='FFL schedule source unavailable: '+String(err.message||err)}
  finally{state.loadingSchedule=false}
 }
 function mountRoster(){
  const root=$('roster');if(!root||$('pfo59-schedule'))return;
  const schedule=document.createElement('section');schedule.id='pfo59-schedule';schedule.className='card pfo59-schedule';schedule.innerHTML='<h2>Team HQ · Schedule</h2><p>Load Sleeper matchups when you open Team HQ.</p>';
  root.querySelector('.card')?.after(schedule);
  schedule.addEventListener('click',ev=>{
   if(ev.target.closest('#pfo59-schedule-load'))void loadSchedule(true);
   const b=ev.target.closest('[data-pfo59-week]');if(b){document.querySelector('nav button[data-page="matchup"]')?.click();if(typeof pfo52Switch==='function')pfo52Switch(Number(b.dataset.pfo59Week));}
  });
  document.querySelector('nav button[data-page="roster"]')?.addEventListener('click',()=>{void loadSchedule();void loadAdvisory()});
 }
 function start(){mountMarket();mountRoster();document.querySelector('nav button[data-page="market"]')?.addEventListener('click',()=>{if(state.market==='home')return;});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.ffoPfo59={openMarket:marketView,refreshAdvisory:loadAdvisory};
})();