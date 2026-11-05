/* PFO 6.12 — source-led Start/Sit. Independent FFL model; Coach decides.
 * GM Scouting's existing evidence analysis is reused on demand instead of
 * maintaining a duplicate top-level navigation/workspace.
 */
(()=>{'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const fmt=(x,d=1)=>typeof x==='number'&&Number.isFinite(x)?x.toFixed(d):'—';
 const state={first:'',second:'',horizon:'WEEK',nonce:0,week:null};
 const home=()=>document.getElementById('pfo63-startsit');
 const weekNow=()=>state.week||(typeof pfo52Week!=='undefined'&&Number.isInteger(pfo52Week)?pfo52Week:typeof pfo52Cur==='function'?pfo52Cur():Number(window.dbNflWeek||9));
 const pos=p=>String(p?.position||'').toUpperCase().replace(/^(D\/ST|DST)$/,'DEF');
 const reportStats=p=>typeof pfo50StatsFor==='function'?pfo50StatsFor(p.id):null;
 function roster(){
  const snap=typeof gm47Snapshot!=='undefined'?gm47Snapshot:null;
  const live=typeof liveRosterSnapshot!=='undefined'?liveRosterSnapshot:null;
  const rid=String(window.dbRosterId||live?.roster_id||1);
  const team=snap?.rosters?.find(r=>String(r.roster_id)===rid)||null;
  const ids=(live?.roster_player_ids||team?.players||[]).map(String);
  const reserved=new Set((live?.reserve||team?.reserve||[]).map(String));
  const started=new Set((live?.starters||team?.starters||[]).map(String));
  const directory=new Map((live?.players||[]).map(p=>[String(p.player_id),p]));
  const players=ids.map(id=>{
   const p=directory.get(id)||(typeof pfo52Info==='function'?pfo52Info(id):null)||{};
   return {id,name:p.name||'',position:pos(p),team:String(p.team||'').toUpperCase(),
    injury:String(p.sleeper_injury_status||p.injury_status||''),starter:started.has(id),reserved:reserved.has(id)};
  }).filter(p=>p.name&&!/^Unknown player|^Player \d+/.test(p.name));
  return {players:players.filter(p=>!p.reserved),reserve:players.filter(p=>p.reserved),
   source:live?'Sleeper live roster':team?'Sleeper roster snapshot':'Awaiting roster'};
 }
 function metrics(p,w){
  const row=reportStats(p),stats=row?.season_totals||{},played=Number(row?.games_observed??row?.games_played);
  const n=(k)=>stats[k]===null||stats[k]===undefined||!Number.isFinite(Number(stats[k]))?null:Number(stats[k]);
  const per=(k)=>played>0&&n(k)!==null?n(k)/played:null;
  const points=typeof pfo52Points==='function'?pfo52Points(p.id,w):null;
  const schedule=window.ffoPfo597?.verifiedSchedule?.();
  const fixture=schedule?.teams?.[p.team]?.weeks?.[String(w)]||null;
  const game=(row?.games||[]).filter(g=>Number(g.week)<w).sort((a,b)=>Number(b.week)-Number(a.week))[0]||null;
  const latest=game?.stats||row?.latest?.stats||row?.latest||null;
  const labels=p.position==='QB'?[['Pass yards / G',per('pass_yd')],['Pass TD / G',per('pass_td')],['Attempts / G',per('pass_att')],['Rush yards / G',per('rush_yd')]]:
   p.position==='RB'?[['Carries / G',per('rush_att')],['Rush yards / G',per('rush_yd')],['Targets / G',per('targets')],['Catches / G',per('rec')],['Rec yards / G',per('rec_yd')]]:
   ['WR','TE'].includes(p.position)?[['Targets / G',per('targets')],['Catches / G',per('rec')],['Rec yards / G',per('rec_yd')],['Rec TD / G',per('rec_td')]]:
   p.position==='K'?[['FG 0–19',n('fgm_0_19')],['FG 20–29',n('fgm_20_29')],['FG 30–39',n('fgm_30_39')],['FG 40–49',n('fgm_40_49')],['FG 50–59',n('fgm_50_59')],['XP made',n('xpm')]]:
   [['Sacks',n('sack')],['Interceptions',n('int')],['Fumbles recovered',n('fum_rec')],['Points allowed tier',null]];
  const news=typeof pfo49PublishedNews==='function'?pfo49PublishedNews(p.id):[];
  return {row,stats,played:Number.isFinite(played)&&played>0?played:null,labels,latest,fixture,
   points:typeof points?.points==='number'&&Number.isFinite(points.points)?points.points:null,
   source:points?.source||'Independent model unavailable',bye:points?.bye||fixture?.bye===true,
   news:Array.isArray(news)?news.slice(0,3):[],games:(row?.games||[]).filter(g=>Number(g.week)<w).sort((a,b)=>Number(b.week)-Number(a.week)).slice(0,3)};
 }
 function compatible(a,b){
  if(!a||!b)return false;
  const slots=typeof pfo52Slots==='function'?pfo52Slots():['QB','RB','RB','WR','WR','TE','FLEX','FLEX','K','DEF'];
  return slots.some(slot=>typeof pfo52Legal==='function'?pfo52Legal(slot,a)&&pfo52Legal(slot,b):
   slot===a.position&&slot===b.position||slot==='FLEX'&&['RB','WR','TE'].includes(a.position)&&['RB','WR','TE'].includes(b.position));
 }
 const tile=(label,value)=>'<div class="pfo612-stat"><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>';
 function card(p,v){
  return '<section class="pfo612-compare-card"><div class="pfo612-player-name"><b>'+esc(p.name)+'</b><small>'+
   esc(p.position)+' · '+esc(p.team)+' · '+(p.starter?'Submitted starter':'Bench')+'</small></div>'+
   '<div class="pfo612-projected">'+(v.points==null?'Not modeled':fmt(v.points,2)+' FFL pts')+'</div>'+
   '<small class="pfo612-context">'+esc(v.bye?'Confirmed BYE':v.fixture?.opponent?'Opponent '+v.fixture.opponent:'Opponent not verified')+
   ' · '+esc(p.injury?'Sleeper tag '+p.injury+' · Not official clearance':'Official availability unverified')+'</small></section>';
 }
 function moreStats(p,v){
  let h='<div class="pfo612-stat-grid">'+
   tile('Observed games',v.played==null?'—':String(v.played))+
   v.labels.map(([key,n])=>tile(key,fmt(n,1))).join('')+'</div>';
  if(v.games.length)h+='<div class="pfo612-game-grid">'+v.games.map(g=>{
   const ss=g.stats||{},pieces=['rush_att','targets','rec','rec_yd','rush_yd','pass_yd','pass_td']
    .filter(k=>ss[k]!==undefined&&ss[k]!==null).slice(0,4).map(k=>k.replaceAll('_',' ')+': '+ss[k]);
   return '<div><b>Week '+esc(g.week)+'</b><small>'+esc(pieces.join(' · ')||'Per-game fields unavailable')+'</small></div>';
  }).join('')+'</div>';
  else h+='<p class="pfo612-foot">Recent game-level MSF splits are not available in this source. Season totals are not passed off as last-three-game form.</p>';
  return h;
 }
 function scouting(p){
  if(typeof gm47Analysis!=='function'||typeof gm47Card!=='function')return '<p class="pfo612-foot">Advanced source-backed assessment unavailable until source hydration completes.</p>';
  try{return gm47Card(gm47Analysis({player_id:p.id,name:p.name,team:p.team,position:p.position,
   sleeper_injury_status:p.injury}),true)}
  catch(err){console.warn('PFO 6.12 embedded GM evidence unavailable',String(err));
   return '<p class="pfo612-foot">Deep scouting source is not ready. No decision inferred.</p>'}
 }
 function details(token,players,w){
  if(token!==state.nonce)return;
  const root=home()?.querySelector('#pfo66-compare-output');if(!root)return;
  const a=players.find(p=>p.id===state.first),b=players.find(p=>p.id===state.second);
  if(!a||!b||a.id===b.id){root.textContent='Choose two different players.';return;}
  const av=metrics(a,w),bv=metrics(b,w),ok=compatible(a,b);
  const caution=!ok?'These players are not interchangeable in a verified FFL starting slot. Statistics may still be compared; no Start/Sit advantage is claimed.':
   state.horizon!=='WEEK'?'Period-specific independent forecasts are not validated yet. Week-level baseline estimates must not be mislabeled as ROS or playoff predictions.':
   av.bye||bv.bye?'Verified bye affects eligibility; no automatic lineup action is taken.':
   av.points==null||bv.points==null?'Independent FFL projection missing for one or both players; comparison withheld rather than imputing zero.':
   'Independent FFL model difference: '+fmt(Math.abs(av.points-bv.points),2)+' points in favor of '+(av.points>=bv.points?a.name:b.name)+'. This is statistical context, not a lineup recommendation.';
  const showForecast=state.horizon==='WEEK';
  let h='<div class="pfo63-compare-players">'+card(a,{...av,points:showForecast?av.points:null})+
   card(b,{...bv,points:showForecast?bv.points:null})+'</div>'+
   '<p class="pfo63-compare-conclusion">'+esc(caution)+'</p>';
  h+='<details class="pfo612-fold" open><summary>Production and usage · sourced statistics</summary><div class="pfo612-detail-cols">'+
   '<section><h4>'+esc(a.name)+'</h4>'+moreStats(a,av)+'</section>'+
   '<section><h4>'+esc(b.name)+'</h4>'+moreStats(b,bv)+'</section></div></details>';
  h+='<details class="pfo612-fold"><summary>Matchup, workload uncertainty and forecast evidence</summary><div class="pfo612-detail-cols">'+
   [ [a,av],[b,bv] ].map(([p,v])=>'<section><h4>'+esc(p.name)+'</h4><p>'+
    esc(v.bye?'Verified bye':v.fixture?.opponent?'Scheduled opponent: '+v.fixture.opponent:'Opponent not verified')+
    '</p><p>Forecast source: '+esc(v.source)+'</p>'+
    '<p>Opponent-specific defensive data and uncertainty intervals are shown only where independently validated. Missing data does not imply a neutral matchup.</p></section>').join('')+'</div></details>';
  h+='<details class="pfo612-fold"><summary>Health and player news · check source dates</summary><div class="pfo612-detail-cols">'+
   [[a,av],[b,bv]].map(([p,v])=>'<section><h4>'+esc(p.name)+'</h4>'+
    '<p>Sleeper injury tag: '+esc(p.injury||'Not tagged (not official clearance)')+'</p>'+
    (v.news.length?v.news.map(item=>{
     const href=/^https:\/\//i.test(item.url||'')?item.url:null;
     return '<p>'+(href?'<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(item.title||'Source item')+'</a>':esc(item.title||'Source item'))+
      (item.published_at?' · '+esc(item.published_at):' · Publication date not verified')+'</p>';
    }).join(''):'<p>Player-specific sourced news is unavailable in the current feed.</p>')+'</section>').join('')+
   '</div></details>';
  h+='<details class="pfo612-fold" data-pfo612-deep><summary>Advanced GM research · full source-backed analysis</summary>'+
   '<div class="pfo612-detail-cols"><section data-pfo612-scout="'+esc(a.id)+'"></section><section data-pfo612-scout="'+esc(b.id)+'"></section></div></details>';
  h+='<p class="pfo63-compare-foot">No automatic lineup changes. NFL statistics: MSF where available. FFL forecast: independent model under frozen FFO scoring. Sleeper: ownership and submitted lineup only. Forecast ≠ verified game result.</p>';
  root.innerHTML=h;
  root.querySelector('[data-pfo612-deep]')?.addEventListener('toggle',ev=>{
   if(!ev.target.open||ev.target.dataset.pfo612Loaded)return;
   ev.target.dataset.pfo612Loaded='true';
   for(const p of [a,b]){const node=[...ev.target.querySelectorAll('[data-pfo612-scout]')].find(x=>x.dataset.pfo612Scout===p.id);if(node)node.innerHTML=scouting(p);}
  });
 }
 function render(){
  const host=home();if(!host)return;
  const data=roster(),players=data.players,w=weekNow(),token=++state.nonce;
  if(!players.length){host.innerHTML='<h3>Start/Sit research</h3><p>Awaiting Sleeper roster. Player projections remain unknown until verified independent statistics load.</p>';return;}
  if(!players.some(p=>p.id===state.first))state.first=players.find(p=>p.starter)?.id||players[0].id;
  if(!players.some(p=>p.id===state.second)||state.second===state.first)state.second=players.find(p=>p.id!==state.first)?.id||'';
  const options=selected=>players.map(p=>'<option value="'+esc(p.id)+'"'+(p.id===selected?' selected':'')+'>'+esc(p.name)+' · '+esc(p.position)+(p.starter?' · Starter':'')+'</option>').join('');
  host.innerHTML='<div class="pfo63-compare-head"><h3>Start/Sit · FFO Player Comparison</h3><small>'+esc(data.source)+' · Week '+w+' · Coach makes every decision</small></div>'+
   '<div class="pfo63-compare-choices"><label>Player A<select data-pfo63-compare="first">'+options(state.first)+'</select></label>'+
   '<label>Player B<select data-pfo63-compare="second">'+options(state.second)+'</select></label></div>'+
   '<div class="pfo63-horizon">'+[['WEEK','This week'],['ROS','Rest of season'],['PLAYOFFS','Playoffs']].map(([id,label])=>
    '<button type="button" data-pfo63-horizon="'+id+'" aria-pressed="'+(id===state.horizon)+'">'+label+'</button>').join('')+'</div>'+
   '<div id="pfo66-compare-output" aria-live="polite"><p class="pfo63-compare-foot">Loading independent comparison details…</p></div>'+
   (data.reserve.length?'<p class="pfo63-compare-foot">'+data.reserve.length+' fantasy-reserve player(s) excluded from start/sit selection.</p>':'');
  // Paint controls before research processing to keep iPhone tap response immediate.
  const work=()=>setTimeout(()=>details(token,players,w),0);
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(work);else work();
 }
 function mount(){
  const anchor=document.getElementById('pfo52-matchup');
  if(!anchor||home())return;
  const el=document.createElement('section');el.id='pfo63-startsit';el.className='pfo63-compare';anchor.before(el);
  // Keep legacy GM data functions initialized; retire the duplicate navigation.
  const nav=document.querySelector('nav button[data-page="scouting"]');
  if(nav){nav.hidden=true;nav.setAttribute('aria-hidden','true');nav.tabIndex=-1;}
 }
 document.addEventListener('change',e=>{const input=e.target.closest?.('[data-pfo63-compare]');if(!input)return;
  state[input.dataset.pfo63Compare]=input.value;render();});
 document.addEventListener('click',e=>{const input=e.target.closest?.('[data-pfo63-horizon]');if(!input)return;
  state.horizon=input.dataset.pfo63Horizon;render();});
 function init(){
  mount();
  document.querySelector('nav button[data-page="matchup"]')?.addEventListener('click',()=>{
   mount();if(document.getElementById('matchup')?.dataset.pfo64Tab==='startsit')render();
  });
  if(document.querySelector('#matchup.page.active'))render();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 window.ffoStartSit63={refresh:render,setWeek:w=>{state.week=Number(w)||null;render()}};
})();