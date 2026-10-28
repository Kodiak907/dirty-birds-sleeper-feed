/* PFO 5.9 development: dedicated research workspaces and owner-specific advisory lenses.
 * Additive only. No Sleeper mutations. Every research rank is source-limited.
 */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const posList=['ALL','QB','RB','WR','TE','K','DEF'];
 let statRequested=false;
 const state={market:'trade',manager:'1',tradeGive:[],tradeTake:[],position:'ALL',search:'',snap:null,names:null,scout:null,ideas:null,schedule:new Map(),loading:false,advisoryAt:0,history:null,historyLoading:null,scheduleAt:0,waiverLoaded:false,tradeLoaded:false};
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
   const p=names[id],pos=String(p?.position||'').replace('D/ST','DEF').toUpperCase();
   if(Object.hasOwn(counts,pos))counts[pos]++;else unknown.push(id);
  }
  const slots=state.snap?.league?.roster_positions||[];
  const required={QB:Math.max(1,slots.filter(x=>x==='QB').length),RB:Math.max(1,slots.filter(x=>x==='RB').length),WR:Math.max(1,slots.filter(x=>x==='WR').length),TE:Math.max(1,slots.filter(x=>x==='TE').length),K:slots.includes('K')?1:0,DEF:slots.includes('DEF')?1:0};
  const targets={QB:required.QB+1,RB:required.RB+2,WR:required.WR+2,TE:required.TE+1,K:required.K,DEF:required.DEF};
  const priority=Object.fromEntries(Object.keys(counts).map(pos=>[pos,Math.max(0,targets[pos]-counts[pos])]));
  // Secondary weakness signal: compare source-backed starter projections across actual league rosters.
  // Require sufficient team coverage before computing a league comparison. No model values are inferred.
  const weakness={};
  const projectionFor=(roster,pos)=>{
   const scores=(roster?.players||[]).map(id=>({id,p:names[id]})).filter(x=>String(x.p?.position||'').replace('D/ST','DEF')===pos)
     .map(x=>scoreInfo({id:String(x.id),name:x.p.name,team:x.p.team}).project)
     .filter(v=>v!==null&&Number.isFinite(v)).sort((a,b)=>b-a);
   const want=required[pos];
   return want>0&&scores.length>=want?scores.slice(0,want).reduce((a,b)=>a+b,0)/want:null;
  };
  for(const pos of posList.slice(1)){
   const ours=projectionFor(r,pos),all=(state.snap?.rosters||[]).map(t=>projectionFor(t,pos)).filter(v=>v!==null);
   if(ours===null||all.length<6)continue;
   const leagueAverage=all.reduce((a,b)=>a+b,0)/all.length,difference=leagueAverage-ours;
   if(difference>0.75)weakness[pos]={difference,ours,leagueAverage,coverage:all.length};
  }
  // Use *recorded* FFL starter performance from completed weeks, distinct from forecasts.
  // Each manager is compared on per-started-player positional output, so FLEX-heavy
  // starting lineups do not automatically appear better than standard lineups.
  const historical={};const rows=state.history?.matchups_by_week;
  if(rows){
   const seasonWeek=Math.max(2,Number(state.history?.nfl_state?.week||8));
   const priorWeeks=Array.from({length:4},(_,i)=>seasonWeek-1-i).filter(w=>w>0);
   const observe=(ownerId,pos)=>{
    let points=0,starts=0,covered=0;
    for(const week of priorWeeks){
     const match=rows[String(week)]?.find(x=>Number(x.roster_id)===Number(ownerId));
     if(!match)continue;
     let perWeek=0;
     for(const id of match.starters||[]){
      if(String(names[id]?.position||'').toUpperCase().replace('D/ST','DEF')!==pos)continue;
      const val=match.players_points?.[id];
      if(!Number.isFinite(Number(val))||val===null)continue;
      points+=Number(val);starts++;perWeek++;
     }
     if(perWeek)covered++;
    }
    return starts>=2&&covered>=2?points/starts:null;
   };
   for(const pos of Object.keys(counts)){
    const mine=observe(rid,pos);
    const peers=(state.snap?.rosters||[]).map(team=>observe(team.roster_id,pos)).filter(x=>x!==null);
    if(mine===null||peers.length<8)continue;
    const leagueMean=peers.reduce((a,b)=>a+b,0)/peers.length;
    const difference=leagueMean-mine;
    if(difference>1.25)historical[pos]={difference,mine,leagueMean,coverage:peers.length,weeks:priorWeeks};
   }
  }
  const rank=Object.fromEntries(Object.keys(counts).map(pos=>[pos,priority[pos]*5+Math.min(10,Math.max(0,historical[pos]?.difference||0))*1.3+Math.min(6,Math.max(0,weakness[pos]?.difference||0))]));
  return {counts,targets,priority,rank,weakness,historical,unknown,known:!!r};
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
 function playerRow(p,priority,historical){
  const x=scoreInfo(p),season=x.season||{},signal=p.scout?.signals?.[0],metric=p.position==='QB'?['PASS YDS',season.pass_yd]:p.position==='RB'?['RUSH YDS',season.rush_yd]:['REC YDS',season.rec_yd];
  const seasonal=metric[1]!=null?metric[0]+' '+Number(metric[1]).toLocaleString():'Season stat N/A';
  const forecast=x.project!=null&&Number.isFinite(x.project)?x.project.toFixed(1):'—';
  return '<button type="button" class="pfo59-compact-row" data-pfo59-player="'+safe(p.id)+'" aria-label="Open '+safe(p.name)+' player intelligence">'+
  '<span class="pfo59-identity"><b>'+safe(p.name)+'</b><small>'+safe(p.position)+' · '+safe(p.team||'Team unverified')+' · '+safe(historical?'Manager FFL gap '+historical.difference.toFixed(1)+' PPG':seasonal)+'</small></span>'+
  '<span class="pfo59-compact-stat"><b>'+safe(forecast)+'</b><small>Model PPG</small></span>'+
  '<span class="pfo59-compact-stat"><b>'+safe(priority||0)+'</b><small>Depth gap</small></span>'+
  '<span class="pfo59-compact-open" aria-hidden="true">›</span></button>'+
  (signal&&priority>0?'<p class="pfo59-row-signal">Research watch · '+safe(String(signal.description||'').slice(0,115))+'</p>':'');
 }
 function waiver(){
  const host=$('pfo59-waiver-board');if(!host)return;
  if(!state.snap||!state.names){host.innerHTML='<p>Loading published league roster and player directory…</p>';return}
  const n=needs(state.manager),pool=entryPool(),filtered=pool.filter(p=>(state.position==='ALL'||p.position===state.position)&&p.name.toLowerCase().includes(state.search.toLowerCase()));
  filtered.sort((a,b)=>{
   const gap=Number(n.rank[b.position]||0)-Number(n.rank[a.position]||0);
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
   const leader=leaders[0];
   return '<button type="button" class="pfo59-leader" '+(leader?'data-pfo59-player="'+safe(leader.id)+'"':'disabled')+'><b>'+safe(pos)+'</b><span>'+safe(leader?.name||'No published model leader')+'</span><small>'+(leader?'Projected '+safe(scoreInfo(leader).project.toFixed(1))+' PPG · model, not season actual':'No supported ranking')+'</small></button>';
  }).join('');
  const gaps=posList.slice(1).filter(pos=>n.priority[pos]>0).sort((a,b)=>n.priority[b]-n.priority[a]);
  const scoredGaps=posList.slice(1).filter(pos=>n.historical?.[pos]).sort((a,b)=>n.historical[b].difference-n.historical[a].difference);
  const weak=posList.slice(1).filter(pos=>n.weakness[pos]).sort((a,b)=>n.weakness[b].difference-n.weakness[a].difference);
  host.innerHTML='<div class="pfo59-caveat">Personalized recommendations combine <b>roster depth</b> and, where source coverage permits, starter model comparisons to league baselines. Model deficits are estimates, not proven roster weaknesses. This player directory remains incomplete, and eligibility is not established. Nothing is claimed or bid.</div>'+
    '<div class="pfo59-metrics"><strong>'+safe(teamName(state.manager))+'</strong><span>Recorded FFL scoring weaknesses: '+safe(scoredGaps.map(p=>p+' '+n.historical[p].difference.toFixed(1)+' points/start below league mean').join(' · ')||(state.history?'No notable recent scoring deficits':'Retrieving four completed weeks of league scores…'))+'</span><span>Depth watch: '+safe(gaps.map(p=>p+' ('+n.counts[p]+'/'+n.targets[p]+')').join(' · ')||'No basic depth gaps')+'</span><span>Below published league starter-model mean: '+safe(weak.map(pos=>pos+' '+n.weakness[pos].difference.toFixed(1)+' PPG ('+n.weakness[pos].coverage+' team samples)').join(' · ')||'Insufficient evidence of a positional projection gap')+'</span><small>'+safe(n.unknown.length)+' player IDs lacked position mapping · Sleeper roster snapshot '+safe(state.snap.fetched_at_utc||'unknown')+'</small></div>'+
    '<h3>Published research / model leaders by position</h3><div class="pfo59-leaders">'+leaders+'</div>'+
    '<div class="pfo59-list-head"><h3>'+safe(state.position==='ALL'?'Personalized available player board':state.position+' available player board')+'</h3><small>'+safe(filtered.length)+' unrostered names in published directory · tap a row for full player QuickView · sorted by '+(state.position==='ALL'?'roster depth then model':'supported model PPG')+'</small></div>'+
    (filtered.length?filtered.slice(0,60).map(p=>playerRow(p,n.priority[p.position],n.historical?.[p.position])).join(''):'<p>No matching published unrostered player IDs. Do not infer league-wide absence.</p>')+
    (filtered.length>60?'<p>Showing 60 of '+safe(filtered.length)+' source-matched candidates. Narrow by position or name.</p>':'');
 }

 // The selected manager's ACTUAL published roster opens immediately, not a highlighted name only.
 // Keep visual selections read-only until Coach explicitly authorizes an actual trade.
 function tradeRoster(rid,side){
  const roster=state.snap?.rosters?.find(r=>String(r.roster_id)===String(rid));
  if(!roster)return '<p class="pfo59-foot">Roster source unavailable. No players were invented.</p>';
  const selected=side==='give'?state.tradeGive:state.tradeTake;
  const players=(roster.players||[]).map(id=>{const p=state.names?.[String(id)],x=p&&scoreInfo({id:String(id),name:p.name,team:p.team});return {id:String(id),p,x}});
  players.sort((a,b)=>(a.p?.position||'ZZ').localeCompare(b.p?.position||'ZZ')||String(a.p?.name||a.id).localeCompare(String(b.p?.name||b.id)));
  return '<div class="pfo59-trade-roster">'+players.map(({id,p,x})=>
    '<button type="button" class="pfo59-trade-player'+(selected.includes(id)?' selected':'')+'" data-pfo59-pick="'+safe(id)+'" data-pfo59-side="'+side+'" aria-pressed="'+selected.includes(id)+'">'+
    '<span class="pfo59-player-pos">'+safe(p?.position||'—')+'</span><span class="pfo59-trade-identity"><b>'+safe(p?.name||'Unmapped player '+id)+'</b><small>'+safe(p?.team||'NFL team unverified')+'</small></span>'+
    '<span class="pfo59-trade-value">'+(x?.project==null?'—':safe(x.project.toFixed(1)))+'<small>model</small></span>'+
    '<span class="pfo59-pick-mark">'+(selected.includes(id)?'✓':'+')+'</span></button>').join('')+'</div>';
 }
 function trade(){
  const host=$('pfo59-trade-board');if(!host)return;
  const partners=(state.snap?.rosters||[]).filter(r=>Number(r.roster_id)!==1).map(r=>
   '<button type="button" class="pfo59-partner'+(String(r.roster_id)===state.manager?' selected':'')+'" '+(Number(r.roster_id)===3?'disabled title="View in Scouting; trade research is excluded"':'data-pfo59-partner="'+safe(r.roster_id)+'"')+'><b>'+safe(teamName(r.roster_id))+'</b><small>'+safe(r.settings?.wins??'—')+'–'+safe(r.settings?.losses??'—')+' · '+safe((r.players||[]).length)+' players</small></button>').join('');
  const isPartner=state.manager!=='1'&&state.manager!=='3',team=state.snap?.rosters?.find(r=>String(r.roster_id)===state.manager);
  const ideas=(state.ideas?.suggestions||[]).filter(x=>String(x.opponent_roster_id)===state.manager&&String(x.opponent_roster_id)!=='3');
  host.innerHTML=
    '<div class="pfo59-subsection"><h3>Trade partner</h3><small>Select a team to view its real roster and choose players for a research-only comparison.</small></div>'+
    '<div class="pfo59-partners">'+(partners||'')+'</div>'+
    (isPartner&&team?'<div class="pfo59-trade-selected"><b>'+safe(teamName(state.manager))+'</b><span>'+safe((team.players||[]).length)+' currently rostered · Sleeper snapshot '+safe(state.snap?.fetched_at_utc||'unknown')+'</span></div>'+
    '<div class="pfo59-trade-dual"><section><h3>Dirty Birds · Give <small>'+state.tradeGive.length+'/3</small></h3>'+tradeRoster('1','give')+'</section>'+
    '<section><h3>'+safe(teamName(state.manager))+' · Receive <small>'+state.tradeTake.length+'/3</small></h3>'+tradeRoster(state.manager,'take')+'</section></div>'+
    '<div class="pfo59-trade-bar"><span>'+safe(state.tradeGive.length)+' giving · '+safe(state.tradeTake.length)+' receiving</span>'+
    '<button type="button" data-pfo59-compare '+(!state.tradeGive.length||!state.tradeTake.length?'disabled':'')+'>Analyze selected players</button><button type="button" data-pfo59-clear>Clear</button></div>'+
    '<p class="pfo59-foot">Model PPG is a forward estimate, not verified NFL production or guaranteed trade value. Selecting players never sends an offer.</p>'+
    '<details class="pfo59-legacy" id="pfo59-scenarios"><summary>Published two-sided model scenarios ('+ideas.length+')</summary>'+
      (ideas.length?ideas.slice(0,12).map(x=>'<div class="pfo59-scenario"><b>Give '+safe((x.give||[]).map(p=>p.name).join(' + '))+'</b><span>Receive '+safe((x.receive||[]).map(p=>p.name).join(' + '))+'</span><small>Dirty Birds '+safe(Number(x.dirty_birds_delta_ppg||0).toFixed(1))+' PPG · other side '+safe(Number(x.opponent_delta_ppg||0).toFixed(1))+' PPG</small></div>').join(''):'<p>No validated scenarios in this published report.</p>')+
    '</details>'
    :'<p class="pfo59-foot">Choose any trade-eligible FFL manager above. BigOlBoyle remains visible for scouting intelligence but cannot be used for proposed trades.</p>');
 }
 async function loadHistoricalScores(){
  if(state.history)return state.history;
  if(state.historyLoading)return state.historyLoading;
  state.historyLoading=(async()=>{
   try{
    const d=await fetchReport('latest.json');
    if(!d?.matchups_by_week||!Array.isArray(d.rosters))throw Error('Completed matchup scores not published');
    state.history=d;
    waiver();trade();
    return d;
   }catch(err){console.warn('FFO scoring-history coverage pending',err);return null}
   finally{state.historyLoading=null}
  })();
  return state.historyLoading;
 }
 async function loadAdvisory(force=false){
  if(state.loading)return Promise.resolve();
  if(!force&&state.advisoryAt&&Date.now()-state.advisoryAt<60000&&state.snap&&state.names){managerOptions();waiver();trade();teamTxnRender();return;}
  state.loading=true;
  try{
   const picks=await Promise.allSettled([fetchReport('fast_latest.json'),fetchReport('player_names.json'),fetchReport('AUTOMATED_WAIVER_SCOUTING.json'),fetchReport('TRADE_IDEAS.json')]);
   if(picks[0].status==='fulfilled')state.snap=picks[0].value;
   if(picks[1].status==='fulfilled')state.names=picks[1].value;
   if(picks[2].status==='fulfilled')state.scout=picks[2].value;
   if(picks[3].status==='fulfilled')state.ideas=picks[3].value;
   if(state.snap&&!state.snap.rosters?.some(r=>String(r.roster_id)===state.manager))state.manager='1';
   if(state.snap&&state.names)state.advisoryAt=Date.now();
  }catch(err){console.warn('PFO59 advisory',err)}finally{state.loading=false;managerOptions();waiver();trade();teamTxnRender();teamNewsRender()}
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
  if((view==='waiver'||view==='trade')&&document.querySelector('nav button[data-page="market"].active')){void loadAdvisory();void loadHistoricalScores();}
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
   '<button type="button" data-pfo59-market="trade">Trades</button><button type="button" data-pfo59-market="waiver">Waivers</button><button type="button" data-pfo59-market="transactions">Transactions</button></div>'+
   
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
  nav.addEventListener('click',ev=>{
   const p=ev.target.closest('[data-pfo59-player]');if(p){window.ffoQuickView?.open?.(p.dataset.pfo59Player);return;}
   const partner=ev.target.closest('[data-pfo59-partner]');if(partner){
    const id=partner.dataset.pfo59Partner;if(id==='3')return;
    state.manager=id;state.tradeTake=[];state.tradeGive=[];managerOptions();trade();
    try{const x=tb48State();x.opponent=id;x.take=[];x.give=[];tb45Save();}catch(err){console.warn('Trade lab sync unavailable',err)}
    return;
   }
   const pick=ev.target.closest('[data-pfo59-pick]');
   if(pick){
    const side=pick.dataset.pfo59Side,id=pick.dataset.pfo59Pick,arr=side==='give'?state.tradeGive:state.tradeTake;
    if(!['give','take'].includes(side))return;
    if(arr.includes(id))arr.splice(arr.indexOf(id),1);else if(arr.length<3)arr.push(id);
    trade();return;
   }
   if(ev.target.closest('[data-pfo59-clear]')){state.tradeGive=[];state.tradeTake=[];trade();return;}
   if(ev.target.closest('[data-pfo59-compare]')){
    if(!state.tradeGive.length||!state.tradeTake.length||state.manager==='3')return;
    try{
     const x=tb48State();x.opponent=state.manager;x.give=[...state.tradeGive];x.take=[...state.tradeTake];tb45Save();
     const fold=$('trade-fold');if(fold){fold.open=true;fold.scrollIntoView({behavior:'instant',block:'start'});}
     $('pfo59-compare-notice')?.remove();
    }catch(err){console.warn('Trade valuation engine unavailable',err);alert('The existing comparison engine is still syncing. Your selections remain on screen.');}
    return;
   }
   const b=ev.target.closest('[data-pfo59-market]');if(b)marketView(b.dataset.pfo59Market);
  });
  nav.addEventListener('change',ev=>{
   if(ev.target.id==='pfo59-position'){state.position=ev.target.value;waiver()}
   if(ev.target.id==='pfo59-waiver-manager'){state.manager=ev.target.value;managerOptions();waiver();trade()}
   if(ev.target.id==='pfo59-trade-manager'){const id=ev.target.value;if(id!=='3'){state.manager=id;state.tradeGive=[];state.tradeTake=[];managerOptions();trade()}}
  });
  nav.addEventListener('input',ev=>{if(ev.target.id==='pfo59-find'){state.search=ev.target.value;waiver()}});
  marketView('trade');
 }
 function entryMatch(rows){
  const ours=rows.find(x=>Number(x.roster_id)===1);if(!ours)return null;
  const peer=rows.find(x=>Number(x.roster_id)!==1&&ours.matchup_id!=null&&String(x.matchup_id)===String(ours.matchup_id));
  if(!peer)return {ours,peer:null};
  return {ours,peer};
 }
 function scheduleRender(){
  const host=$('pfo59-schedule');if(!host)return;
  const snap=state.snap||{},weeks=[...Array(17)].map((_,i)=>i+1),current=Number(snap.nfl_state?.week||8);
  host.innerHTML='<div class="pfo59-schedule-head"><h2>FFL Team Schedule</h2><button type="button" id="pfo59-schedule-load">Refresh schedule</button></div>'+
   '<div class="pfo59-schedule-list">'+weeks.map(w=>{
    const rows=state.schedule.get(w)||[];
    const match=entryMatch(rows),other=match?.peer,ours=match?.ours;
    let label=other?teamName(other.roster_id):w>=15?'Playoffs · opponent TBD':rows.length?'Opponent not established':'Schedule not yet retrieved';
    let outcome='';if(w<current&&other&&ours&&Number.isFinite(Number(ours.points))&&Number.isFinite(Number(other.points)))outcome=Number(ours.points)>Number(other.points)?'W':Number(ours.points)<Number(other.points)?'L':'T';
    return '<div class="pfo59-week"><span>Week '+w+'</span><strong>'+safe(label)+'</strong><small>'+safe(outcome)+' '+(w<current&&other?'FFL '+safe(ours?.points??'—')+'–'+safe(other?.points??'—'):w===current?'Current week':'')+'</small><button type="button" data-pfo59-week="'+w+'">View</button></div>';
   }).join('')+'</div><p class="pfo59-foot">Weeks 1–14: Sleeper league pairings. Weeks 15–17: playoff opponents TBD until bracket is established. Unretrieved pairings stay unconfirmed.</p>';
 }
 async function loadSchedule(full=false){
  if(state.loadingSchedule)return;
  // Render the 17-week skeleton instantly, even when Sleeper or GitHub is offline.
  scheduleRender();
  if(!full&&state.scheduleAt&&Date.now()-state.scheduleAt<5*60*1000)return;
  state.loadingSchedule=true;
  try{
   const snap=state.history||await fetchReport('latest.json');if(!state.snap)state.snap=snap;
   if(snap.matchups_by_week)state.history=snap;
   state.scheduleAt=Date.now();
   for(const [k,v] of Object.entries(snap.matchups_by_week||{}))if(Array.isArray(v))state.schedule.set(Number(k),v);
   scheduleRender();
   // Opening Schedule should show the verified future regular-season fixtures automatically.
   // Only load unretrieved regular-season weeks (max 4 at a time) so other tabs remain responsive.
   if(typeof pfo52GetWeek==='function'){
    const missing=Array.from({length:14},(_,i)=>i+1).filter(w=>(full||w>=current)&&!state.schedule.has(w));
    for(let i=0;i<missing.length;i+=4){
     const batch=missing.slice(i,i+4);
     const results=await Promise.allSettled(batch.map(w=>pfo52GetWeek(w)));
     results.forEach((result,j)=>{
      if(result.status==='fulfilled'&&Array.isArray(result.value)&&result.value.length===12)
       state.schedule.set(batch[j],result.value);
     });
     scheduleRender();
    }
   }
  }catch(err){
   // Never erase the schedule table when an upstream source is slow or unavailable.
   scheduleRender();
   const host=$('pfo59-schedule');
   if(host){const msg=document.createElement('p');msg.className='pfo59-foot';
    msg.textContent='FFL schedule sync unavailable: '+String(err.message||err)+'. Unknown matchups remain unverified.';
    host.prepend(msg);}
  }
  finally{state.loadingSchedule=false}
 }

 function teamTxnRender(){
  const host=$('pfo59-team-transactions');if(!host)return;
  const snap=state.snap;
  if(!snap){host.innerHTML='<p>Loading published Sleeper transaction feed…</p>';return;}
  const rows=Object.entries(snap.transactions_by_week||{}).flatMap(([week,items])=>(Array.isArray(items)?items:[]).filter(t=>t.status==='complete'&&(t.roster_ids||[]).some(id=>Number(id)===1)).map(t=>({...t,ffo_week:Number(week)}))).sort((a,b)=>Number(b.created||0)-Number(a.created||0));
  const name=id=>state.names?.[String(id)]?.name||(String(id).length<4?String(id):'Player ID '+id);
  const fmt=entries=>Object.entries(entries||{}).filter(([,rid])=>Number(rid)===1).map(([id])=>name(id)).join(', ');
  host.innerHTML='<div class="pfo59-caveat">Read-only completed Sleeper transactions for Dirty Birds in the published source window. Missing weeks are not evidence that no transactions occurred.</div>'+
  (rows.length?rows.slice(0,24).map(t=>'<div class="pfo59-txn-row"><b>W'+safe(t.ffo_week)+' · '+safe(t.type||'Move')+'</b>'+
  '<span>'+safe(fmt(t.adds)||'No additions recorded')+(fmt(t.drops)?' · Dropped '+safe(fmt(t.drops)):'')+'</span><small>'+safe(Number.isFinite(Number(t.created))?new Date(Number(t.created)).toLocaleString():'Date missing')+'</small></div>').join(''):'<p>No completed transactions by Dirty Birds were included in the checked report window.</p>')+
  '<button type="button" class="pfo59-link-to-market" data-pfo59-team-market="transactions">Open full Transactions & FAAB history</button>';
 }
 function teamNewsRender(){
  const host=$('pfo59-team-news');if(!host)return;
  const fetched=state.snap?.fetched_at_utc||'Source not loaded';
  host.innerHTML='<h3>Dirty Birds News & Intelligence</h3>'+
  '<p class="pfo59-foot">FFO reports are source-driven. A missing headline is not medical clearance or confirmation of a roster change. Published roster checked: '+safe(fetched)+'.</p>'+
  '<div class="pfo59-team-links"><button type="button" data-pfo59-team-page="scouting"><b>GM Scouting</b><small>Roster-based workload and matchup evaluation</small></button>'+
  '<button type="button" data-pfo59-team-page="availability"><b>Injury Watch</b><small>Source-dated health and inactive verification</small></button>'+
  '<button type="button" data-pfo59-team-page="radar"><b>Opportunity Radar</b><small>Relevant NFL changes and research flags</small></button>'+
  '<button type="button" data-pfo59-team-page="playerhub"><b>Player Intel</b><small>Season totals, weekly evidence and player cards</small></button></div>';
 }
 function teamTab(tab){
  const h=$('pfo59-team-hub');if(!h)return;
  for(const b of h.querySelectorAll('[data-pfo59-team-tab]'))b.setAttribute('aria-selected',String(b.dataset.pfo59TeamTab===tab));
  for(const p of h.querySelectorAll('[data-pfo59-team-panel]'))p.hidden=p.dataset.pfo59TeamPanel!==tab;
  if(tab==='schedule')void loadSchedule();
  if(tab==='news')teamNewsRender();
 }
 function mountRoster(){
  const root=$('roster');if(!root||$('pfo59-team-hub'))return;
  const rosterNodes=[...root.children];
  const hub=document.createElement('div');hub.id='pfo59-team-hub';hub.innerHTML=
   '<div class="pfo59-team-heading"><h2>Dirty Birds · Team HQ</h2><span class="pfo59-chip">SLEEPER + FFO INTELLIGENCE</span></div>'+
   '<div class="pfo59-team-tabs" aria-label="Team HQ tools">'+
   '<button type="button" data-pfo59-team-tab="roster" aria-selected="true">Roster</button>'+
   '<button type="button" data-pfo59-team-tab="schedule" aria-selected="false">Schedule</button>'+

   '<button type="button" data-pfo59-team-tab="news" aria-selected="false">News &amp; Intel</button></div>'+
   '<section data-pfo59-team-panel="roster"></section>'+
   '<section data-pfo59-team-panel="schedule" hidden><div class="card pfo59-schedule" id="pfo59-schedule"><h2>Team HQ · FFL Schedule</h2><p>Loading published matchups…</p></div></section>'+

   '<section data-pfo59-team-panel="news" hidden><div class="card" id="pfo59-team-news"></div></section>';
  root.prepend(hub);
  for(const n of rosterNodes)hub.querySelector('[data-pfo59-team-panel="roster"]').appendChild(n);
  hub.addEventListener('click',ev=>{
   const tab=ev.target.closest('[data-pfo59-team-tab]');if(tab){teamTab(tab.dataset.pfo59TeamTab);return;}
   const go=ev.target.closest('[data-pfo59-team-page]');if(go){document.querySelector('nav button[data-page="'+go.dataset.pfo59TeamPage+'"]')?.click();return;}
   if(ev.target.closest('#pfo59-schedule-load')){void loadSchedule(true);return;}
   const m=ev.target.closest('[data-pfo59-team-market]');if(m){
    document.querySelector('nav button[data-page="market"]')?.click();
    marketView(m.dataset.pfo59TeamMarket);return;
   }
   const week=ev.target.closest('[data-pfo59-week]');if(week){
    document.querySelector('nav button[data-page="matchup"]')?.click();
    if(typeof pfo52Switch==='function')pfo52Switch(Number(week.dataset.pfo59Week));
   }
  });
  document.querySelector('nav button[data-page="roster"]')?.addEventListener('click',()=>{
   teamNewsRender();
   if(hub.querySelector('[data-pfo59-team-tab="schedule"]')?.getAttribute('aria-selected')==='true')void loadSchedule();
  });
 }
 function start(){
  mountMarket();mountRoster();
  document.querySelector('nav button[data-page="market"]')?.addEventListener('click',()=>marketView(state.market));
  // Reposition the *existing* official league standings (no duplicate data or separate fetch).
  const overview=$('overview'),standings=$('league-standings')?.closest('.card');
  if(overview&&standings){standings.classList.add('pfo59-standings-top');overview.prepend(standings);}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.ffoPfo59={openMarket:marketView,refreshAdvisory:loadAdvisory};
})();