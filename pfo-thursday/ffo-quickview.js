/* FFO PFO 5.7: player quickview, additive to every existing Front Office tool.
 * Zero new data API calls. Uses current Sleeper FFL rules and existing verified NFL sources.
 * Preserves GameCast, Radar, Trade, Waivers, Briefings, Injury Watch, stat scrolling. */
(()=>{'use strict';
 const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=(x,d=1)=>x==null||x===''||!Number.isFinite(Number(x))?'—':Number(x).toFixed(d);
 const safe=(fn,def=null)=>{try{return fn()}catch{return def}};
 const when=x=>Number.isFinite(Date.parse(x||''))?new Date(x).toLocaleString():'Not verified';
 const tabs=[['summary','Overview'],['games','Game Log'],['usage','Usage'],['health','Health'],['research','Research']];
 const aliases={GBP:'gb',LA:'lar',JAC:'jax',WAS:'wsh',WSH:'wsh',GB:'gb',KC:'kc',TB:'tb',NE:'ne',NO:'no',NYG:'nyg',NYJ:'nyj',LV:'lv',SF:'sf'};
 const logo=t=>{const a=String(t||'').toUpperCase(),x=aliases[a]||a.toLowerCase();return /^[a-z]{2,4}$/.test(x)?'https://a.espncdn.com/i/teamlogos/nfl/500/'+x+'.png':''};
 const pic=id=>/^[0-9]{2,9}$/.test(String(id||''))?'https://sleepercdn.com/content/nfl/players/thumb/'+String(id)+'.jpg':'';
 let root=null,id=null,tab='summary',oldFocus=null,oldOverflow='';
 const info=()=>{const p=safe(()=>pfo49Info(id),{id,name:'Player '+id,position:'',team:''}),m=safe(()=>pfo49Metric(id)),ind=safe(()=>pfo50StatsFor(id)),inj=safe(()=>pfo49Injury(id),{});
  const recorded=safe(()=>pfo49Observed(id),{})||{},week=Number(window.dbNflWeek||8);
  const closed=Object.entries(recorded).filter(([w,v])=>Number(w)<week&&Number.isFinite(Number(v?.points))).sort((a,b)=>Number(a[0])-Number(b[0]));
  const vals=closed.map(x=>Number(x[1].points)),last=vals.slice(-3);
  const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null,recent=last.length?last.reduce((a,b)=>a+b,0)/last.length:null;
  const ownerFresh=safe(()=>!!leagueOwnedIds&&!!ownershipCheckedMs&&Date.now()-ownershipCheckedMs<300000,false);
  const owner=ownerFresh?safe(()=>pfo49Owner(id),'FFL manager pending'):'Sleeper ownership not freshly verified';
  return {p,m,ind,inj,recorded,week,closed,avg,recent,owner,source:safe(()=>pfo50Independent?.checked_at||pfo49Metrics?.as_of)};
 };
 const tile=(v,k)=>'<div class="ffo57-tile"><b>'+E(v)+'</b><small>'+E(k)+'</small></div>';
 const line=(title,detail,val)=>'<div class="ffo57-row"><div><b>'+E(title)+'</b><small>'+E(detail)+'</small></div><span class="ffo57-num">'+E(val)+'</span></div>';
 const scoring=()=>{const s=safe(()=>gm47Snapshot?.league?.scoring_settings);if(!s)return 'Current league scoring settings not yet loaded. Sleeper remains the official scoring authority.';
  const fields=[['rec','per reception'],['pass_td','per passing TD'],['rush_td','per rushing TD'],['rec_td','per receiving TD']].filter(([k])=>s[k]!=null).map(([k,d])=>fmt(s[k],2)+' '+d);
  return 'Sleeper FFL rules: '+fields.join(' · ')+'. Other custom scoring and bonus categories may apply.';
 };
 // Explicit dated official box-score correction when independent NFL player-feed coverage lags.
 // These observed stats NEVER replace projected PPG or official Sleeper fantasy scores.
 const officialKnown=(p)=>{
  if(String(p.id)==='12495'||(/^ollie gordon(?: ii)?$/i.test(String(p.name||''))&&String(p.team||'').toUpperCase()==='MIA'))
   return {week:7,through:'2026-10-25',link:'https://www.miamidolphins.com/team/players-roster/ollie-gordon-ii/logs/',
    latest:{week:7,rush_att:25,rush_yd:103,rush_td:1,rec:1,targets:3,rec_yd:0},
    season:{rush_att:72,rush_yd:339,rush_td:4,rec:6,targets:8,rec_yd:14},team:'MIA'};
  return null;
 };
 const summary=d=>{
  const {p,ind,m}=d,pos=String(p.position||'').toUpperCase(),verified=officialKnown(p),
   sourceWeek=Number(ind?.latest?.week||0),current=verified&&sourceWeek<verified.week?verified.latest:(ind?.latest||{});
  const latest=pos==='QB'?[['Pass att.',current.pass_att],['Pass yds',current.pass_yd],['Pass TD',current.pass_td],['Rush yds',current.rush_yd]]:
   pos==='RB'?[['Rush att.',current.rush_att],['Rush yds',current.rush_yd],['Rush TD',current.rush_td],['Targets',current.targets],['Catches',current.rec],['Rec yds',current.rec_yd]]:
   pos==='WR'||pos==='TE'?[['Targets',current.targets],['Catches',current.rec],['Rec yds',current.rec_yd],['Rec TD',current.rec_td]]:
   [['Games',ind?.games_observed],['Snap %',m?.snap_share_pct],['NFL week',current.week]];
  const officialSeason=verified?.season,totals=officialSeason||ind?.season_totals||{};
  const seasonList=pos==='QB'?[['Pass yards',totals.pass_yd],['Pass TD',totals.pass_td],['Rush yards',totals.rush_yd]]:
   pos==='RB'?[['Rush att.',totals.rush_att],['Rush yards',totals.rush_yd],['Rush TD',totals.rush_td],['Targets',totals.targets],['Receptions',totals.rec],['Rec yards',totals.rec_yd]]:
   [['Targets',totals.targets],['Receptions',totals.rec],['Rec yards',totals.rec_yd],['Rec TD',totals.rec_td]];
  const series=x=>x.filter(([,n])=>n!==null&&n!==undefined).map(([label,n])=>tile(fmt(n,0),label)).join('');
  const source=verified&&sourceWeek<verified.week?
   '<p class="ffo57-evidence">NFL team official box score through Week '+verified.week+' ('+E(verified.through)+'). <a href="'+verified.link+'" target="_blank" rel="noopener">Miami Dolphins player log ↗</a>. Independent nflverse feed currently only reaches '+E(sourceWeek||'unverified')+' for this player. This correction does not change the FFO forecast.</p>':
   '<p class="ffo57-evidence">Independent NFL stats: last published week '+E(current.week??'unavailable')+' · source checked '+E(when(d.source))+'. Not necessarily current live data.</p>';
  return '<div class="ffo57-tilegrid ffo59-player-kpis">'+tile(fmt(d.avg),'Recorded FFL PPG · '+d.closed.length+' games')+
   tile(fmt(d.recent),'Last '+Math.min(3,d.closed.length)+' FFL games')+
   tile(fmt(safe(()=>pfo50Estimate(id))),'FFO model · estimate')+'</div>'+
   '<h3 class="ffo57-section">Latest verifiable NFL game · W'+E(current.week??'?')+'</h3>'+
   '<div class="ffo57-tilegrid ffo59-player-stats">'+(series(latest)||'<p>Verified game data unavailable</p>')+'</div>'+
   '<h3 class="ffo57-section">2026 season totals</h3><div class="ffo57-tilegrid ffo59-player-stats">'+(series(seasonList)||'<p>Season source coverage unavailable</p>')+'</div>'+
   source+'<details class="ffo59-scoring-note"><summary>FFL scoring and modeling limitations</summary><p>'+E(scoring())+'</p>'+
   '<p>FFO projection is an estimate, not a verified outcome. Official FFL fantasy scores come from Sleeper; missing stats are never assumed to be zero.</p></details>';
 };
 const games=d=>{const obs=Object.entries(d.recorded).filter(([w,v])=>Number.isInteger(Number(w))&&Number.isFinite(Number(v?.points))).sort((a,b)=>Number(b[0])-Number(a[0]));
  let h='<div class="ffo57-note">Only recorded Sleeper FFL points are labeled official. In-progress weeks may change. Missing weekly data is not a zero.</div>';
  h+=obs.length?obs.slice(0,18).map(([w,v])=>line('Week '+w,Number(w)<d.week?'Sleeper recorded points':'Sleeper in-progress / provisional',fmt(v.points,2))).join(''):'<p class="ffo57-muted">No official FFL score history available in the current league snapshot.</p>';
  return h;
 };
 const usage=d=>{const pos=String(d.p.position||'').toUpperCase(),last=d.ind?.latest||{},m=d.m||{};
  const values=pos==='QB'?[['Pass attempts',last.pass_att],['Completions',last.pass_cmp],['Passing yards',last.pass_yd],['Rush attempts',last.rush_att]]:
  pos==='RB'?[['Carries',last.rush_att],['Rush yards',last.rush_yd],['Targets',last.targets],['Receptions',last.rec]]:
  pos==='WR'||pos==='TE'?[['Targets',last.targets],['Receptions',last.rec],['Receiving yards',last.rec_yd],['Receiving TDs',last.rec_td]]:
  [['Latest NFL week',last.week],['Recorded NFL games',d.ind?.games_observed]];
  let h='<div class="ffo57-note">Usage = published NFL participation, not guaranteed next-week workload.</div>';
  h+=values.map(([k,v])=>line(k,'Latest published game',fmt(v,Number.isInteger(Number(v))?0:1))).join('');
  if(m.snap_share_pct!=null)h+=line('Snap share','Published participation sample',fmt(m.snap_share_pct,1)+'%');
  if(m.targets_per_game!=null)h+=line('Targets per game','Published sample average',fmt(m.targets_per_game,2));
  if(!d.ind&&!d.m)h+='<div class="ffo57-note ffo57-warning">NFL usage source missing or unmatched. No stat values are filled by guessing.</div>';
  return h;
 };
 const health=d=>{const j=d.inj||{};let h='<div class="ffo57-note">Fantasy tags, practice reports and official inactive decisions are not interchangeable. No reported injury does not establish medical clearance.</div>';
  if(j.official)h+=line('Official NFL injury report',j.official.practice_status||'Practice detail pending',j.official.game_status||'Status unavailable');
  if(j.espn)h+=line('ESPN injury research','Secondary source; verify current official report',j.espn.status||j.espn.description||'Reported');
  if(j.fantasy)h+=line('Sleeper fantasy injury tag','Fantasy designation, not the gameday inactive list',j.fantasy);
  if(j.older)h+=line('Historical NFL report','Previous week '+(j.older.week||'unknown'),j.older.game_status||'Older report');
  if(!j.official&&!j.espn&&!j.fantasy&&!j.older)h+='<p class="ffo57-muted">No relevant injury item in current data. Player status remains unverified.</p>';
  return h+'<div class="ffo57-source">NFL injury feed checked '+E(when(safe(()=>nflVerified?.checked_at)))+' · <a href="https://www.nfl.com/injuries/" target="_blank" rel="noopener noreferrer">Official NFL reports</a></div>';
 };
 const research=d=>'<div class="ffo57-tilegrid">'+tile(fmt(safe(()=>pfo50Estimate(id))),'FFO model forecast*')+tile(fmt(d.avg),'Recorded FFL PPG')+tile(fmt(d.recent),'Recent recorded PPG')+'</div><div class="ffo57-note">Our Opportunity Radar, Waiver Research, GM Scouting, Trade Analyzer, briefings and Injury Watch remain in their original locations and retain their existing functionality. This quickview is an access layer—not a replacement.</div>'+line('NFL evidence published','Independent NFL season and game observations',when(d.source))+line('FFL ownership and scoring','League roster, settings and completed fantasy scores','Sleeper')+'<p class="ffo57-description">*Research models are uncertain, require validation and do not indicate guaranteed fantasy points or trade acceptance.</p>';
 const views={summary,games,usage,health,research};
 function mount(){
  if(root)return;
  root=document.createElement('div');root.id='ffo57-sheet';root.hidden=true;
  root.innerHTML='<div class="ffo57-backdrop" data-ffo57-close="1"></div><section class="ffo57-card" role="dialog" aria-modal="true" aria-labelledby="ffo57-name"><div class="ffo57-handle"></div><div class="ffo57-hero"><div class="ffo57-portrait" id="ffo57-photo"></div><div><div class="ffo57-eyebrow">FFO · PLAYER INTELLIGENCE</div><h2 class="ffo57-name" id="ffo57-name"></h2><div class="ffo57-sub" id="ffo57-sub"></div></div><button class="ffo57-close" type="button" data-ffo57-close="1" aria-label="Close player profile">×</button></div><div class="ffo57-actions"><button type="button" data-ffo57-dest="playerhub">Full Player Intel</button><button type="button" data-ffo57-dest="radar">Radar</button><button type="button" data-ffo57-dest="market">Trades / Waivers</button></div><div class="ffo57-tabs" role="tablist" aria-label="Player profile tabs"></div><div class="ffo57-body" role="tabpanel" tabindex="0"></div></section>';
  document.body.append(root);
  root.addEventListener('click',ev=>{
   if(ev.target.closest('[data-ffo57-close]')){close();return}
   const t=ev.target.closest('[data-ffo57-tab]');if(t){tab=t.dataset.ffo57Tab;draw();return}
   const dest=ev.target.closest('[data-ffo57-dest]');if(!dest)return;
   const where=dest.dataset.ffo57Dest,player=id;close();
   if(where==='playerhub'){if(typeof pfo49Open==='function')pfo49Open(player);return}
   document.querySelector('nav button[data-page="'+where+'"]')?.click();
  });
  root.addEventListener('keydown',ev=>{
   if(ev.key==='Escape'){ev.preventDefault();close();return}
   if((ev.key==='ArrowLeft'||ev.key==='ArrowRight')&&ev.target.closest('[role=tablist]')){
    const i=tabs.findIndex(x=>x[0]===tab);tab=tabs[(i+(ev.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length][0];draw();
    root.querySelector('[data-ffo57-tab="'+tab+'"]')?.focus();ev.preventDefault();
   }
   if(ev.key==='Tab'){
    const all=[...root.querySelectorAll('button:not([disabled]),[tabindex="0"]')].filter(n=>n.offsetParent!==null);
    if(all.length&&ev.shiftKey&&document.activeElement===all[0]){ev.preventDefault();all.at(-1).focus()}
    else if(all.length&&!ev.shiftKey&&document.activeElement===all.at(-1)){ev.preventDefault();all[0].focus()}
   }
  });
 }
 function draw(){
  if(!root||!id)return;
  root.querySelector('.ffo57-tabs').innerHTML=tabs.map(([key,label])=>'<button type="button" role="tab" data-ffo57-tab="'+key+'" aria-selected="'+(tab===key?'true':'false')+'">'+E(label)+'</button>').join('');
  root.querySelector('.ffo57-body').innerHTML=(views[tab]||summary)(info())+
   '<h3 class="ffo57-section">FFO tools</h3><div class="ffo57-links"><button type="button" data-ffo57-dest="playerhub">Detailed Intel</button><button type="button" data-ffo57-dest="availability">Injury Watch</button><button type="button" data-ffo57-dest="radar">Opportunity Radar</button><button type="button" data-ffo57-dest="market">Trade Analyzer & Waivers</button></div>';
  root.querySelector('.ffo57-body').scrollTop=0;
 }
 function open(player,from){
  if(typeof pfo49Info!=='function'||!player)return false;
  mount();oldFocus=from||document.activeElement;oldOverflow=document.body.style.overflow;
  id=String(player);tab='summary';const d=info(),p=d.p,name=p.name||'Player';
  root.querySelector('#ffo57-name').textContent=name;
  const head=root.querySelector('#ffo57-photo'),src=pic(id);
  head.innerHTML=src?'<img src="'+E(src)+'" alt="'+E(name)+' headshot" loading="lazy" onerror="this.replaceWith(document.createTextNode(\'—\'))">':'<span>'+E(name.split(/\s+/).map(z=>z[0]||'').slice(0,2).join('').toUpperCase())+'</span>';
  const tm=logo(p.team);
  root.querySelector('#ffo57-sub').innerHTML=(tm?'<img src="'+E(tm)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">':'')+'<span>'+E(p.position||'Position pending')+' · '+E(p.team||'Team pending')+'</span><span>· '+E(d.owner)+'</span>';
  draw();root.hidden=false;document.body.style.overflow='hidden';
  root.querySelector('.ffo57-close')?.focus({preventScroll:true});return true;
 }
 function close(){if(!root||root.hidden)return;root.hidden=true;document.body.style.overflow=oldOverflow;id=null;safe(()=>oldFocus?.focus?.({preventScroll:true}));}
 // Capture only user-selected player links; all ordinary Front Office interactions remain unchanged.
 document.addEventListener('click',ev=>{
  if(root&&!root.hidden)return;
  const t=ev.target.closest('[data-pfo49-id]');if(!t||t.closest('#ffo57-sheet'))return;
  const player=t.dataset.pfo49Id;
  if(!player||!open(player,t))return;
  ev.preventDefault();ev.stopImmediatePropagation();
 },true);
 window.ffoQuickView={open:player=>open(player),close,current:()=>id};
})();
