/* FFO 5.9.6 -- source-dated roster newsroom and mobile briefing/bye safeguards.
 * No Sleeper scoring, lineup writes, trades or Commissioner mutations.
 */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const state={articles:[],actions:[],schedule:null,loadedAt:0,pending:null,err:'',rosterCache:null};
 function lineup(){
  if(typeof liveRosterSnapshot!=='undefined'&&liveRosterSnapshot?.players?.length)return liveRosterSnapshot.players.map(p=>({...p,id:String(p.player_id||p.id)}));
  if(typeof gm47Snapshot!=='undefined'){
   const rid=Number(window.dbRosterId||1),r=gm47Snapshot?.rosters?.find(x=>Number(x.roster_id)===rid);
   if(r)return (r.players||[]).map(id=>{const p=typeof pfo49Info==='function'?pfo49Info(String(id)):{};
    return {...p,id:String(id),name:p.name||'',team:p.team||''};}).filter(p=>p.name&&!p.name.startsWith('Player '));
  }
  return [];
 }
 function date(s){const n=Date.parse(String(s||''));return Number.isFinite(n)?new Date(n).toLocaleString():'Date unavailable'}
 function validUrl(u){try{const x=new URL(u);return x.protocol==='https:'?x.href:null}catch{return null}}
 function articleList(data){
  const src=Array.isArray(data?.articles)?data.articles:[];
  return src.map(a=>({
   title:a.headline||a.title||'',summary:String(a.description||a.story||'').slice(0,260),date:a.published||a.publishedDate||a.lastModified||'',
   link:validUrl(a.links?.web?.href||a.links?.api?.href||a.link||a.url),
   publisher:'ESPN',categories:a.categories||[],id:String(a.id||'')
  })).filter(x=>x.title&&x.link&&Number.isFinite(Date.parse(x.date)));
 }
 async function fetchNew(){
  if(state.pending)return state.pending;
  if(state.loadedAt&&Date.now()-state.loadedAt<12*60000)return;
  state.pending=(async()=>{
   const [news,actions,schedule]=await Promise.allSettled([
    // ESPN is news/editorial only. This feed must NEVER supply GameCast or FFO fantasy scoring.
    fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=100',{mode:'cors',cache:'no-store'}).then(r=>{if(!r.ok)throw Error('ESPN editorial feed HTTP '+r.status);return r.json()}),
    fetchReport('NFL_ROSTER_ACTIONS.json'),
    fetchReport('nfl_schedule.json')
   ]);
   if(news.status==='fulfilled')state.articles=articleList(news.value);
   else state.err='Live editorial feed unavailable; showing only independently sourced reports where present.';
   if(actions.status==='fulfilled')state.actions=(actions.value.records||[]).filter(x=>x.name&&validUrl(x.source_url));
   if(schedule.status==='fulfilled'&&schedule.value?.teams)state.schedule=schedule.value;
   state.loadedAt=Date.now();
  })().finally(()=>{state.pending=null});
  return state.pending;
 }
 function stories(roster){
  const team=new Map(roster.filter(p=>p.name).map(p=>[normalize(p.name),p]));
  const all=[];
  for(const a of state.actions){const p=team.get(normalize(a.name));if(!p)continue;all.push({
   player:p.name,title:a.description||a.action_code,summary:a.game_availability_note||'',date:a.date,
   link:validUrl(a.source_url),publisher:a.source||'NFL team',kind:/IR|ACTIVAT|WILL_NOT_PLAY|INACTIVE/i.test(a.action_code)?'Availability':'Team action',priority:3
  });}
  for(const a of state.articles){
   const hay=normalize(a.title+' '+a.summary);
   const players=roster.filter(p=>{const name=normalize(p.name);return name&&hay.includes(name);});
   for(const p of players.slice(0,2))all.push({player:p.name,...a,kind:'NFL news article',priority:1});
  }
  if(typeof nflVerified!=='undefined'&&nflVerified?.checked_at){
   for(const p of roster){const o=(nflVerified.players||[]).find(x=>normalize(x.name)===normalize(p.name));if(!o||!o.game_status&&!o.injury&&!o.practice_status)continue;
    all.push({player:p.name,title:p.name+' — '+(o.game_status||o.practice_status||'Listed on injury report'),summary:[o.injury,o.practice_status].filter(Boolean).join(' · ')+' · NFL report presence is not game-day inactivity.',date:nflVerified.checked_at,link:'https://www.nfl.com/injuries/',publisher:'NFL injury report',kind:'Availability',priority:5});
   }
  }
  if(typeof espnInjuries!=='undefined'&&Array.isArray(espnInjuries)){
   for(const p of roster){const o=espnInjuries.find(x=>normalize(x.name)===normalize(p.name));if(!o||!o.status)continue;
    all.push({player:p.name,title:p.name+' — '+o.status,summary:o.detail||'Secondary reported designation; verify with NFL team.',date:typeof espnFetchedAt!=='undefined'?new Date(espnFetchedAt).toISOString():'',link:'https://www.espn.com/nfl/injuries',publisher:'ESPN injury report',kind:'Availability',priority:2});
   }
  }
  const week=Number(window.dbNflWeek|| (typeof gm47Snapshot!=='undefined'?gm47Snapshot?.nfl_state?.week:8) ||8);
  for(const p of roster){const code=String(p.team||'').toUpperCase(),weeks=state.schedule?.teams?.[code]?.weeks||{};
   for(const w of [week,week+1])if(weeks[String(w)]?.bye)all.push({
    player:p.name,title:p.name+' — NFL BYE Week '+w,summary:'No NFL game scheduled for '+code+' in Week '+w+'. Bye is not a medical designation.',
    date:state.schedule.as_of,link:'https://www.nfl.com/schedules/2026/reg'+w+'/',publisher:'NFL schedule / nflverse schedule check',kind:'Bye week',priority:w===week?6:3
   });
  }
  const seen=new Set();
  return all.filter(x=>x.link&&x.title&&(!x.date||Number.isFinite(Date.parse(x.date)))).sort((a,b)=>{
   const recent=x=>{const t=Date.parse(x.date||'');return Number.isFinite(t)?Math.max(-200,Math.min(5,10-(Date.now()-t)/864e5)):-200};
   return (b.priority+recent(b))-(a.priority+recent(a));
  }).filter(x=>{const key=normalize(x.player)+'|'+normalize(x.title);if(seen.has(key))return false;seen.add(key);return true;});
 }
 function render(host){
  if(!host||!document.contains(host))return;
  const roster=lineup();
  if(!roster.length){host.innerHTML='<h3>Dirty Birds · News & Intel</h3><p>Current team roster not available. News matching is withheld until ownership syncs; no unrelated headlines will be shown.</p>';return;}
  const items=stories(roster),fetched=typeof liveRosterSnapshot!=='undefined'?liveRosterSnapshot?.checked_at:typeof gm47Snapshot!=='undefined'?gm47Snapshot?.fetched_at_utc:'';
  host.innerHTML='<div class="pfo596-news-head"><h3>Dirty Birds · News & Intel</h3><small>'+esc(roster.length)+' rostered players · roster '+esc(date(fetched))+'</small></div>'+
   '<p class="pfo596-news-source">Most relevant roster-specific articles, confirmed team actions, injuries, and upcoming byes. Source dates shown; stale events are historical, and an absent report does not certify clearance.</p>'+
   (items.length?'<div class="pfo596-news-list">'+items.slice(0,18).map(x=>'<article class="pfo596-news-row"><div><small>'+esc(x.kind)+' · '+esc(x.player)+' · '+esc(date(x.date))+'</small><b>'+esc(x.title)+'</b><p>'+esc(x.summary||'Read the full report at the original source.')+'</p><a href="'+esc(x.link)+'" target="_blank" rel="noopener noreferrer">Read source · '+esc(x.publisher)+'</a></div></article>').join('')+'</div>':
   '<p class="pfo596-news-empty">No current roster-matched dated article or report was returned. This is not an all-clear. Check official team news and published injury reports as they become available.</p>')+
   (state.err?'<p class="pfo596-news-source">'+esc(state.err)+'</p>':'');

 }
 async function ensure(host){await fetchNew();if(host&&document.contains(host)&&!host.closest('[hidden]'))render(host);if(document.querySelector('#overview.page.active'))renderBriefing();}
 function refresh(){
  const host=$('pfo59-team-news');
  if(host&&!host.closest('[hidden]')){render(host);void ensure(host);}
 }
 // Only the active News tab performs a news network refresh.
 window.ffoPfoNews596={render(host){render(host);if(!state.loadedAt||Date.now()-state.loadedAt>12*60000)void ensure(host);},refresh,stories:()=>stories(lineup())};
 // Existing briefing already understands morning/pregame/postgame, score history, and
 // official inactives. Keep that data, remove duplicative navigation and truncate to
 // the operationally important sections rather than computing a parallel scoreboard.
 if(typeof renderBriefing==='function'){
  const previous=renderBriefing;
  renderBriefing=function(){
   previous();
   const host=$('briefing');if(!host)return;
   host.querySelectorAll('.pfo49-quicklinks,[data-pfo49-go],.pfo49-brief-kpis').forEach(x=>x.remove());
   const sections=[...host.querySelectorAll('.pfo51-brief-section')];
   const keep=typeof pfo49Mode!=='undefined'&&pfo49Mode==='pregame'?[0,1,2]:
     typeof pfo49Mode!=='undefined'&&pfo49Mode==='postgame'?[0,1,2]:[0,2,3];
   sections.forEach((x,i)=>{if(!keep.includes(i))x.remove();});
   host.classList.add('pfo596-brief');
   const important=stories(lineup()).filter(x=>x.priority>=3).slice(0,2);
   if(important.length){
    const compact=document.createElement('div');compact.className='pfo596-brief-news';
    compact.innerHTML='<b>Priority roster updates</b>'+important.map(x=>'<p>'+esc(x.player)+': '+esc(x.title)+' · <a href="'+esc(x.link)+'" target="_blank" rel="noopener noreferrer">'+esc(x.publisher)+'</a></p>').join('');
    const freshness=host.querySelector('.pfo51-sources');host.insertBefore(compact,freshness||null);
   }
  };
 }
 // For verified schedules only: bye is neither a forecast nor zero fantasy points.
 // The full-schedule core path still governs all other weeks and score mechanics.
 if(typeof pfo52Points==='function'){
  const original=pfo52Points;
  pfo52Points=function(id,w,past=false){
   if(past)return original(id,w,past);
   const p=typeof pfo52Info==='function'?pfo52Info(id):null;
   const code=String(p?.team||'').toUpperCase();
   const weekInfo=state.schedule?.teams?.[code]?.weeks?.[String(w)];
   if(code&&weekInfo?.bye===true)
    return {points:null,source:'VERIFIED NFL BYE WEEK '+w,bye:true,adjustment:null};
   // Never show a positive projection for a potential bye while schedule evidence
   // is still loading. Verified core full-season schedule may still be used.
   const full=typeof pfo49Schedule!=='undefined'&&pfo49Schedule?.complete;
   const now=Number(window.dbNflWeek||8);
   if(code&&!full&&!weekInfo&&Number(w)>=now&&Number(w)<=17)
    return {points:null,source:'NFL schedule not yet verified for Week '+w,schedulePending:true,adjustment:null};
   return original(id,w,past);
  };
 }
 function init(){
  const rosterTab=$('roster');
  rosterTab?.addEventListener('click',ev=>{if(ev.target.closest('[data-pfo59-team-tab="news"]'))refresh()});
  const briefing=$('briefing');
  if(briefing&&typeof renderBriefing==='function')renderBriefing();
  // Load only our small verified schedule on startup. The national news feed
  // is deliberately fetched ONLY if Coach opens Team News, not during first paint.
  const loadSchedule=async()=>{
   if(state.schedule)return;
   try{const data=await fetchReport('nfl_schedule.json');if(data?.teams)state.schedule=data;}catch{}
   if(document.querySelector('#matchup.page.active')&&typeof pfo52Render==='function')pfo52Render();
   if(document.querySelector('#championship.page.active')&&typeof pfo49RenderPlanner==='function')pfo49RenderPlanner();
   if(document.querySelector('#overview.page.active')&&typeof renderBriefing==='function')renderBriefing();
  };
  document.querySelector('nav button[data-page="matchup"]')?.addEventListener('click',()=>{void loadSchedule()});
  document.querySelector('nav button[data-page="championship"]')?.addEventListener('click',()=>{void loadSchedule()});
  setTimeout(()=>{void loadSchedule()},300);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();