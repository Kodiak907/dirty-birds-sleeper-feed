/* FFO GameCast v0.4: browser-facing staged intelligence inside existing PFO.
   Does NOT store API secrets and NEVER claims unconfirmed data as live. */
(async function(){
 'use strict';
 const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const model=await import('/ffo-gamecast-model.mjs');
 const stadium=await import('/ffo-gamecast-stadium.mjs');
 const sameGame=await import('/ffo-same-game-player-evidence.mjs');
 const eventScenarios=await import('/ffo-msf-event-score-scenarios.mjs');
 const weekNav=await import('/ffo-gamecast-weeks.mjs');
 const researchController=await import('/ffo-scoring-research-controller.mjs');
 const gc6Style=document.createElement('link');gc6Style.rel='stylesheet';gc6Style.href='/ffo-gamecast-stadium.css';document.head.append(gc6Style);
 const polish=document.createElement('style');polish.textContent=`
#radar,#market,#availability,#playerhub{width:100%;max-width:100%;min-width:0}
#radar .pfo49-radar-grid{display:grid!important;grid-template-columns:minmax(0,1fr)!important;width:100%;max-width:100%;min-width:0;gap:8px}
#radar .pfo49-radar-item,#market .scout-card{width:100%;max-width:100%;min-width:0;overflow:hidden;box-sizing:border-box}
#radar .pfo49-radar-item{padding:10px 12px}
#radar .pfo49-radar-item .pfo49-row,#market .scout-top{display:flex;align-items:center;justify-content:space-between;min-width:0;gap:8px;flex-wrap:wrap}
#radar .pfo49-radar-item .pfo49-row>div,#market .scout-top>div{min-width:0;flex:1 1 170px}
#radar .pfo49-radar-item .pfo49-statgrid,#market .scout-card .scout-metrics{display:flex!important;gap:8px;width:100%;max-width:100%;min-width:0;overflow-x:auto!important;overflow-y:hidden!important;touch-action:pan-x;overscroll-behavior-x:contain;scrollbar-width:thin;-webkit-overflow-scrolling:touch;padding-bottom:6px;scroll-snap-type:x proximity}
#radar .pfo49-radar-item .pfo49-statgrid>div{flex:0 0 112px!important;min-width:112px!important;max-width:140px!important;scroll-snap-align:start}
#market .scout-card .scout-metrics>*{flex:0 0 auto;scroll-snap-align:start}
#radar .pfo49-radar-item p,#market .scout-card p{overflow-wrap:anywhere}
#market .market-columns,#market .grid.two{grid-template-columns:minmax(0,1fr)!important;max-width:100%;min-width:0}
#market .market-fold,#market .fold-body,#market .scout-card,#radar .card{min-width:0;max-width:100%}
@media(max-width:430px){#radar .pfo49-radar-item{padding:9px}#radar .pfo49-radar-item .pfo49-statgrid>div{flex-basis:104px!important;min-width:104px!important}#market .scout-card{padding:9px}}
`;document.head.append(polish);

 const s={status:'Gateway not checked',enabled:false,season:(()=>{const n=Number(window.dbNflSeason||2026);return n+'-regular'})(),games:[],archiveGames:[],selectedWeek:null,coverage:null,portraitRows:[],historyResults:[],game:null,player:null,playerId:null,msfPlayer:null,playerMatch:'',playerRows:[],weekRows:[],allWeeks:new Map(),playCache:[],lastMeta:null,liveBox:null,injuries:null,latestCheck:'',lastError:'',msfFantasy:null,ownedRules:null,rulesVersion:null,rulesError:null,playFilter:'all',activePlay:-1,followLatest:true,sourceErrors:[],lastGamesCheck:null};
 const route='/api/ffo/gamecast/';
 function status(msg){s.status=msg;if($('ffo-gc-status'))$('ffo-gc-status').textContent=msg;}
 const feedCache=new Map(),feedPending=new Map();
 let playerFeedPending=null,gamePending=null,overviewPending=null,historyAuditStarted=false,statAuditRunning=false;
 let scoringResearch=null;
 let weekboardPending=null,backgroundPlayPending=null,lastWeekboardPoll=0,lastWeekboardSuccess=0,lastBackgroundDispatch=0;
 let weekboardFailures=0,weekboardError='',weekboardProviderUpdatedAt=null,weekboardGameCount=0;
 const backgroundPlayCheckedAt={},backgroundPlayEvidence=new Map();
 const SCOREBOARD_MS=5000,BACKGROUND_PLAY_MIN_MS=60000;
 let lastStadiumPlayId=null,lastStadiumGameId=null,priorVerifiedBallX=null;
 let lastSuccessfulGamePollAt=0,lastNewPlayAt=0,lastPlayCount=0,lastScorePollAt=0,lastProviderUpdateAt=0,finalObservedAt=0;
 const LIVE_PLAY_MS=5000,LIVE_BOX_MS=5000,IDLE_PLAY_MS=120000;
 let consecutivePlayFailures=0;
 const sectionActive=id=>!!document.querySelector('nav button[data-page="'+id+'"].active');
 const gameActive=()=>sectionActive('gamecast');
 function cacheTtl(name){
   if(name==='health')return 60000;
    if(name==='portraits')return 3600000;
   if(name==='schedule')return 45000;
    if(name==='weekboard')return 0;
   if(name==='injuries')return 240000;
   if(name==='updates')return 60000;
   // Stats and historical logs are stored only as normalized rows, never duplicated here.
   // Live plays and boxscores are NEVER cached; their polling is limited separately.
   return 0;
 }
 async function feed(name,query={},force=false){
  const url=new URL(route+name,location.origin);
  Object.entries(query).forEach(([k,v])=>{if(v!==undefined&&v!==null)url.searchParams.set(k,String(v))});
  const key=url.pathname+url.search,now=Date.now(),ttl=cacheTtl(name),hit=feedCache.get(key);
  if(!force&&ttl>0&&hit&&now-hit.at<ttl)return hit.body;
  if(feedPending.has(key))return feedPending.get(key);
  const promise=(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),name==='plays'||name==='boxscore'?9000:name==='stats'||name==='gamelogs'?26000:12500);
   try{
    const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:controller.signal,headers:{accept:'application/json'}});
    let body;try{body=await response.json()}catch{throw Error('Invalid gateway response')}
    if(!response.ok){
      // Cloudflare binding status is not proof of an MSF HTTP status.
      const details=[];
      if(body.transport==='legacy_gamecast_service_binding')details.push('legacy GameCast binding');
      else if(body.transport==='direct_msf')details.push('direct MSF');
      if(Number.isInteger(body.binding_http_status))details.push('binding HTTP '+body.binding_http_status);
      if(Number.isInteger(body.msf_http_status_via_binding))details.push('MSF status reported by binding '+body.msf_http_status_via_binding);
      if(Number.isInteger(body.provider_http_status)&&body.provider_status_direct===true)details.push('MSF HTTP '+body.provider_http_status);
      if(typeof body.inner_gateway_error==='string'&&/^[a-z0-9_-]{1,80}$/i.test(body.inner_gateway_error))details.push('inner error '+body.inner_gateway_error);
      const err=Error((body.error||'HTTP '+response.status)+(details.length?' · '+details.join(' · '):''));
      err.status=response.status;err.diagnostics=details;throw err;
     }
    // A licensed not-modified feed is normal, not a lost connection.
    if(body.available===false&&body.reason==='provider_not_modified')return {...body,notModified:true};
    if(body.available===false)throw Error(body.reason||'Feed not ready');
    if(ttl>0){
      feedCache.delete(key);feedCache.set(key,{at:Date.now(),body});
      while(feedCache.size>8)feedCache.delete(feedCache.keys().next().value);
    }
    return body;
   }finally{clearTimeout(timer)}
  })();
  feedPending.set(key,promise);
  try{return await promise}finally{feedPending.delete(key)}
 }
 async function ensurePlayerTotals(force=false){
  if(statAuditRunning)return s.playerRows;
  if(s.playerRows.length&&!force)return s.playerRows;
  if(playerFeedPending)return playerFeedPending;
  playerFeedPending=(async()=>{const data=await feed('stats',{season:s.season},force);s.playerRows=model.playerRows(data.data);s.latestCheck=data.checked_at||s.latestCheck;if(s.player)findPlayer();return s.playerRows})();
  try{return await playerFeedPending}finally{playerFeedPending=null}
 }

 function friendlyGame(x){
  const z=x?.schedule||x?.game||x||{},home=z.homeTeam||x.homeTeam||{},away=z.awayTeam||x.awayTeam||{};
  const name=t=>typeof t==='string'?t:String(t.abbreviation||t.abbr||t.name||'?');
  const gameId=z.id??x.id??z.gameId??x.gameId??'';
   const weekNum=Number(z.week??x.week??z.weekNumber??x.weekNumber);
  const score=x.score||x.scoring||x.scores||x.gameScore||z.score||z.scoring||{};
  const n=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
  return {id:String(gameId),home:name(home),away:name(away),week:Number.isInteger(weekNum)&&weekNum>=1&&weekNum<=18?weekNum:null,
   homePoints:n(score.homeScoreTotal??score.homeScore??z.homeScoreTotal??x.homeScoreTotal??x.homeScore),
   awayPoints:n(score.awayScoreTotal??score.awayScore??z.awayScoreTotal??x.awayScoreTotal??x.awayScore),
   status:String(z.playedStatus||z.gameStatus||z.status||x.playedStatus||x.gameStatus||x.status||z.scheduleStatus||'Unverified game status'),start:z.startTime||z.startTimeUTC||x.startTime||null};
 }
 function drawGames(){
  const el=$('ffo-gc-games'),select=$('ffo-gc-week'),statusEl=$('ffo-gc-week-status');
  if(!el)return;
  const seasonYear=Number(s.season.slice(0,4));
  const current=weekNav.currentCalendarWeek(new Date(),seasonYear)||Number(window.dbNflWeek)||1;
  if(!Number.isInteger(s.selectedWeek)||s.selectedWeek<1||s.selectedWeek>18)s.selectedWeek=current;
  if(select){
   if(select.options.length!==18)select.innerHTML=Array.from({length:18},(_,i)=>
    '<option value="'+(i+1)+'">Week '+(i+1)+(i+1===current?' · Current':'')+'</option>').join('');
   select.value=String(s.selectedWeek);
  }
  if(!s.archiveGames.length){
   el.innerHTML='<p class="ffo-gc-note">No games loaded from MySportsFeeds yet. Authenticated season schedule required; never invent scores.</p>';
   if(statusEl)statusEl.textContent='Week '+s.selectedWeek+' · awaiting authenticated full-season MSF schedule';
   return;
  }
  const previous=new Map(s.games.map(g=>[g.id,g]));
  s.games=weekNav.scheduleForWeek(s.archiveGames,s.selectedWeek,seasonYear)
   .map(g=>{
    const prior=previous.get(g.id);
    if(!prior)return g;
    const merged=model.mergeScheduledGame(prior,g);
    // When the MSF per-game boxscore is newer than the slower full-season
    // schedule snapshot, NEVER roll the displayed score backwards.
    // An incoming corrected boxscore can still update it next poll.
    return (prior.scoreSource==='MySportsFeeds game boxscore'||prior.scoreSource==='MySportsFeeds weekly games')?
     {...merged,homePoints:prior.homePoints??merged.homePoints,
      awayPoints:prior.awayPoints??merged.awayPoints,
      status:prior.status,scoreSource:prior.scoreSource,
      scoreProviderUpdatedAt:prior.scoreProviderUpdatedAt||null,
      scoreCheckedAt:prior.scoreCheckedAt||null}:merged;
   });
  const groups=weekNav.groupWeekGames(s.games);
  const coverage=weekNav.todayCoverage(s.archiveGames,new Date(),seasonYear);
  s.coverage=coverage;
  const live=s.games.filter(g=>['live','overtime'].includes(model.gamePhase(g.status))).length;
  const reference=coverage.expectedGames!==null&&s.selectedWeek===current?
   ' · Today '+coverage.uniqueMatchups+'/'+coverage.expectedGames+' source-scheduled matchups'+
   (coverage.missing.length?' · '+coverage.missing.length+' missing: '+coverage.missing.join(', '):'')+
   (coverage.extra.length?' · '+coverage.extra.length+' unrecognized matchups':''):'';
  const age=lastWeekboardSuccess?Math.floor((Date.now()-lastWeekboardSuccess)/1000):null;
  const scoreStatus=weekboardError?' · scoreboard error: '+weekboardError:
   lastWeekboardSuccess?' · scoreboard checked '+age+'s ago'+
    (weekboardProviderUpdatedAt?' · provider updated '+weekboardProviderUpdatedAt:' · provider update time unknown')+
    (weekboardGameCount<s.games.length?' · partial scoreboard '+weekboardGameCount+'/'+s.games.length:''):
   ' · scoreboard feed not checked';
  if(statusEl)statusEl.textContent='Week '+s.selectedWeek+' · '+s.games.length+
   ' MSF games · '+live+' reported LIVE'+reference+scoreStatus+
   ' · Score poll 5s; selected PBP 5s; other live PBP about 60s. Actual provider freshness not guaranteed.';
  if(!s.games.length){
   el.innerHTML='<p class="ffo-gc-note">Week '+safe(s.selectedWeek)+
    ' has no schedule entries in the current authenticated MSF response. Unknown, not zero games.</p>';
   return;
  }
  const pacificTime=start=>{
   const t=Date.parse(start||'');
   return Number.isFinite(t)?new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Los_Angeles',weekday:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'
   }).format(new Date(t)):'Start time unverified';
  };
  const localScoreTime=value=>{
   const stamp=Date.parse(value||'');
   return Number.isFinite(stamp)?new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Los_Angeles',hour:'numeric',minute:'2-digit',hour12:true
   }).format(new Date(stamp))+' PT':null;
  };
  // Coach's compact stat-rail interaction: ONE horizontally swipable
  // carousel for all games. Never spread day groups into flex columns.
  // Preserve the user's swipe position during five-second score updates.
  const oldRail=el.querySelector('.ffo-gc-game-rail');
  const sameWeek=el.dataset.railWeek===String(s.selectedWeek);
  const priorScroll=sameWeek&&oldRail?oldRail.scrollLeft:0;
  const ordered=[
   ...groups.today.map(g=>({g,day:'Today'})),
   ...groups.earlier.map(g=>({g,day:'Earlier'})),
   ...groups.upcoming.map(g=>({g,day:'Upcoming'})),
   ...groups.unknown.map(g=>({g,day:'Date unknown'}))
  ];
  const cards=ordered.map(({g,day})=>{
   const phase=model.gamePhase(g.status);
   const label=phase==='live'||phase==='overtime'?'LIVE':
    phase==='final'?'FINAL':String(g.status||'STATUS UNKNOWN').toUpperCase();
   const scoreLine=safe(g.away)+' '+safe(g.awayPoints===null?'—':g.awayPoints)+
    ' · '+safe(g.homePoints===null?'—':g.homePoints)+' '+safe(g.home);
   const scoreTime=localScoreTime(g.scoreCheckedAt);
   const bg=backgroundPlayEvidence.get(g.id);
   return '<button class="ffo-gc-game '+(s.game===g.id?'active':'')+
    '" type="button" data-ffo-game="'+safe(g.id)+'" aria-label="'+
    safe(g.away+' at '+g.home+', '+label)+'">'+
    '<span class="ffo-gc-card-head"><span class="ffo-gc-card-day">'+safe(day)+'</span>'+
    '<span class="ffo-gc-card-state">'+safe(label)+'</span></span>'+
    '<strong>'+scoreLine+'</strong>'+
    '<small>'+safe(pacificTime(g.start))+'</small>'+
    (scoreTime?'<small class="ffo-gc-score-meta">Checked '+safe(scoreTime)+'</small>':'')+
    (bg&&g.id!==s.game?'<small class="ffo-gc-score-meta">'+
     (bg.count===null?'Plays unavailable':safe(bg.count)+' plays checked')+'</small>':'')+
    '</button>';
  }).join('');
  const html='<div class="ffo-gc-rail-hint"><span>Week '+safe(s.selectedWeek)+
   ' · '+ordered.length+' games</span><span>Swipe games ⇄</span></div>'+
   '<div class="ffo-gc-game-rail" role="region" aria-label="Week '+safe(s.selectedWeek)+
   ' NFL games, swipe horizontally" tabindex="0">'+cards+'</div>';
  // Five-second scoreboard updates should NOT destroy the touch carousel,
  // steal focus, or reset a drag halfway through its swipe gesture.
  const sameCards=sameWeek&&oldRail&&
   [...oldRail.querySelectorAll('[data-ffo-game]')].map(b=>b.dataset.ffoGame).join('|')===
    ordered.map(x=>String(x.g.id)).join('|');
  if(sameCards){
   const template=document.createElement('template');template.innerHTML=html;
   const nextButtons=[...template.content.querySelectorAll('[data-ffo-game]')];
   [...oldRail.querySelectorAll('[data-ffo-game]')].forEach((button,index)=>{
    const next=nextButtons[index];
    if(button.innerHTML!==next.innerHTML)button.innerHTML=next.innerHTML;
    if(button.className!==next.className)button.className=next.className;
   });
   const oldHint=el.querySelector('.ffo-gc-rail-hint');
   const newHint=template.content.querySelector('.ffo-gc-rail-hint');
   if(oldHint&&newHint&&oldHint.innerHTML!==newHint.innerHTML)oldHint.innerHTML=newHint.innerHTML;
  }else{
   el.innerHTML=html;
   el.dataset.railWeek=String(s.selectedWeek);
   const rail=el.querySelector('.ffo-gc-game-rail');
   if(rail)rail.scrollLeft=priorScroll;
   el.querySelectorAll('button[data-ffo-game]').forEach(b=>b.onclick=()=>selectGame(b.dataset.ffoGame));
  }
 }
 function findPlayer(){if(!s.player)return;s.playerMatch='';s.msfPlayer=null;
   const r=model.resolvePlayer(s.player,s.playerRows);s.playerMatch=r.status;s.msfPlayer=r.player;
 }
 function fmt(x){return x===null||x===undefined?'—':Number.isFinite(Number(x))?Number(x).toLocaleString(undefined,{maximumFractionDigits:2}):String(x)}
 function gameLivePlayer(){if(!s.liveBox||!s.player)return null;
   const data=s.liveBox.data||{};
   const groups=[data.playerStats,data.boxscore?.playerStats,data.boxscore?.playerStatsTotals,data.gameboxscore?.playerStats,data.gameboxscore?.playerStatsTotals,data.playerStatsTotals,data.boxscore?.players];
   for(const list of groups){const rows=model.playerRows({playerStats:Array.isArray(list)?list:[]});const match=model.resolvePlayer(s.player,rows);if(match.player)return match.player;}
   return null;
 }
 function getRules(){return s.ownedRules}
 async function loadFfoRules(){
  if(s.ownedRules)return s.ownedRules;
  const r=await fetch('/FFO_FFL_SCORING_V1.json',{credentials:'same-origin',cache:'no-store'});
  if(!r.ok)throw Error('FFO scoring definition HTTP '+r.status);
  const x=await r.json();
  if(x?.schema!=='FFO_SCORING_RULES_V1'||x.league!=='FFL'||x.season!==2026||!x.scoring||Object.keys(x.scoring).length<100)
   throw Error('FFO scoring file integrity check failed');
  s.ownedRules=x.scoring;s.rulesVersion=x.version;s.rulesError=null;
  return s.ownedRules;
 }
 function projection(){
   if(!s.player||!s.allWeeks.size)return null;
   const games=[...s.allWeeks.entries()].sort((a,b)=>a[0]-b[0]).map(([week,rows])=>({week,entry:model.resolvePlayer(s.player,rows).player})).filter(x=>x.entry?.stats);
   return games.length?model.fflProjection(games.map(x=>x.entry),getRules(),s.player?.position):null;
 }
 function pfoPlayerId(){return s.player?.id||s.playerId}
 function drawPlayer(){for(const id of ['ffo-gc-player','ffo-gc-profile-embed']){
  const el=$(id);if(!el)continue;
  if(!s.player){el.innerHTML='<p class="ffo-gc-note">Choose a player from Player Intel or your roster to see their personalized GameCast.</p>';continue;}
  const p=s.player,stats=model.normalizeStats(s.msfPlayer?.stats||{}),live=gameLivePlayer(),liveStats=model.normalizeStats(live?.stats||{}),rules=getRules(),scoring=live?.stats?model.fflScore(live.stats,rules,p.position):null,proj=projection(),inj=typeof pfo49Injury==='function'&&pfoPlayerId()?pfo49Injury(pfoPlayerId()):null;
   const independent=typeof pfo50StatsFor==='function'?pfo50StatsFor(pfoPlayerId()):null;
   const backupSeason=independent?.season_totals||{};
   const seasonEvidence=Object.keys(stats).length?stats:backupSeason;
   const hasProviderSeason=Object.keys(stats).length>0;
   const latestIndependent=independent?.latest||{};
  const fields=[['Pass YD','pass_yd'],['Pass TD','pass_td'],['Rush YD','rush_yd'],['Rush TD','rush_td'],['Rec','rec'],['Rec YD','rec_yd'],['Rec TD','rec_td'],['Targets','targets'],['FUM Lost','fum_lost']];
  const seasonTags=fields.filter(([n,k])=>Object.hasOwn(seasonEvidence,k)).map(([n,k])=>`<div><b>${fmt(seasonEvidence[k])}</b><span>${safe(n)} · Season</span></div>`);
   const latestTags=fields.filter(([n,k])=>Object.hasOwn(latestIndependent,k)).map(([n,k])=>`<div><b>${fmt(latestIndependent[k])}</b><span>${safe(n)} · Week ${safe(latestIndependent.week||'—')}</span></div>`);
  const liveTags=fields.filter(([n,k])=>Object.hasOwn(liveStats,k)).map(([n,k])=>`<div><b>${fmt(liveStats[k])}</b><span>${safe(n)} · Game</span></div>`);
  const livePoints=scoring?.points!=null?fmt(scoring.points)+'*':'—',projPoints=proj?.points!=null?fmt(proj.points)+'*':'—';
  const matchNote=hasProviderSeason?'MySportsFeeds uniquely matched seasonal NFL statistics, pending stable provider ID mapping.':seasonTags.length?'Season totals from independently published nflverse 2026 player data, matched to the selected name and team; not a MySportsFeeds match.':s.playerRows.length?'No unambiguous player match; season totals withheld until a verified source loads.':'Season totals not yet available. Verify source status or refresh Intel.';
  const official=inj?.official?.official?String(inj.official.official.game_status||'Official designation present'):'No verified current official designation linked. Absence of report is not clearance.';
  const html=`<div class="ffo-gc-intro"><div><span class="ffo-gc-pill">GAMECAST · ${s.enabled?'PROVIDER CONNECTED':'NOT LIVE VERIFIED'}</span><h3>${safe(p.name)}</h3><p>${safe(p.position||'')} · ${safe(p.team||'Team unverified')}</p></div><button type="button" class="button" data-ffo-player-refresh="1">↻</button></div>
  <div class="ffo-gc-statgrid"><div><b>${livePoints}</b><span>FFO MSF score*</span></div><div><b>${projPoints}</b><span>FFO forecast research</span></div>${seasonTags.slice(0,4).join('')||'<div><b>—</b><span>Season stats pending</span></div>'}</div>
  <p class="ffo-gc-note">${safe(matchNote)}</p>
  <div class="ffo-gc-section"><h3>Current game player stats</h3><div class="ffo-gc-rawstats">${liveTags.length?liveTags.join(''):'<div>Game-specific player box score not verified yet.</div>'}</div></div>
  <div class="ffo-gc-section"><h3>Most recent published NFL game</h3><div class="ffo-gc-rawstats">${latestTags.length?latestTags.join(''):'<div>Independent game statistics not yet loaded.</div>'}</div></div>
   <div class="ffo-gc-section"><h3>2026 NFL season totals</h3><div class="ffo-gc-rawstats">${seasonTags.length?seasonTags.join(''):'<div>Awaiting verifiable published player season totals.</div>'}</div></div>
  <div class="ffo-gc-evidence"><b>FFL scoring audit</b><p class="ffo-gc-note">${rules?'FFO-owned 2026 FFL rules '+safe(s.rulesVersion||'v1')+'; stats from MySportsFeeds.':'FFO own scoring rules not loaded: '+safe(s.rulesError||'pending')+'.'} ${scoring?.points!=null?'Reconstructed '+fmt(scoring.points)+' from '+scoring.covered.length+' stat categories.':'No certified player box-score reconstruction.'} ${scoring&&!scoring.complete?'Missing / unverified scoring categories: '+safe(scoring.missing.slice(0,10).join(', '))+'.':''} ${proj&&!proj.complete?'Projection uses incomplete stat categories and must NOT overwrite trade/waiver valuation.':''}</p><p class="ffo-gc-note">Official injury cross-check: ${safe(official)} <a href="https://www.nfl.com/injuries/" target="_blank" rel="noopener noreferrer">Official NFL injuries</a></p></div>
  <p class="ffo-gc-note">* Game points and projections are experimental when category coverage is incomplete. FFO game fantasy scoring is independent of Sleeper; incomplete MSF stat/event coverage is explicitly provisional. Sleeper comparison is a validation check only. Latest source check: ${safe(s.latestCheck||'not connected')}. No 15–20-second SLA proven.</p>
  <div class="ffo-gc-actionrow"><button type="button" data-ffo-goto="1">Full GameCast</button><button type="button" data-ffo-player-refresh="1">Refresh player feeds</button></div>${id==='ffo-gc-profile-embed'?'<details open><summary style="font-weight:800;font-size:12px;color:#f2c67c;margin:10px 0">Game field · player-linked plays</summary><div id="ffo-gc-player-field"></div></details>':''}`;
  el.innerHTML=html;
  el.querySelectorAll('[data-ffo-player-refresh]').forEach(b=>b.onclick=()=>refreshPlayer(true));
  el.querySelectorAll('[data-ffo-goto]').forEach(b=>b.onclick=()=>document.querySelector('nav button[data-page="gamecast"]')?.click());
 }
 drawField();drawSignals();
 }
 async function refreshInjuryEvidence(){
  const above=$('injuryhealth');if(!above||!s.enabled)return;
  if(Date.now()-(s.lastInjuryCheck||0)<300000)return;
  s.lastInjuryCheck=Date.now();
  let pane=$('ffo-gc-injury-intel');
  if(!pane){pane=document.createElement('details');pane.id='ffo-gc-injury-intel';pane.className='ffo-gc-evidence';above.insertAdjacentElement('afterend',pane);}
  try {
    const response=await feed('injuries'),entries=Array.isArray(response.data?.players)?response.data.players:[];
    const roster=Array.isArray(typeof liveRosterSnapshot!=='undefined'&&liveRosterSnapshot?.players)?liveRosterSnapshot.players:[];
    const matches=[];
    for(const member of roster){
      const fullName=model.normalizeName(member.name||''),team=String(member.team||'').toUpperCase();
      if(!fullName||!team)continue;
      const candidates=entries.filter(x=>{
        const p=x.player||x,msfName=model.normalizeName(p.fullName||[p.firstName,p.lastName].filter(Boolean).join(' '));
        const msfTeam=String(p.currentTeam?.abbreviation||p.team?.abbreviation||'').toUpperCase();
        return msfName===fullName&&msfTeam===team;
      });
      if(candidates.length!==1)continue;
      const row=candidates[0],p=row.player||row,inj=p.currentInjury||row.currentInjury;
      if(!inj)continue;
      const description=String(typeof inj==='string'?inj:inj.description||inj.comment||inj.status||'Injury information supplied without a designation').slice(0,200);
      matches.push({name:member.name,description});
    }
    const stamp=String(response.data?.lastUpdatedOn||response.checked_at||'unknown');
    pane.innerHTML='<summary><b>MySportsFeeds injury cross-check</b> · '+matches.length+' uniquely linked roster reports</summary>'+
      '<p class="ffo-gc-note">Source timestamp: '+safe(stamp)+'. Current injury text is NOT an official Week 8 game designation, activation or clearance. Sleeper/NFL injury fields above remain separate.</p>'+
      (matches.length?'<div class="ffo-gc-intel-list">'+matches.slice(0,15).map(x=>'<div class="ffo-gc-intel-row"><b>'+safe(x.name)+'</b><span>'+safe(x.description)+'</span><small>MySportsFeeds current injury · identity matched to NFL team</small></div>').join('')+'</div>':'<p class="ffo-gc-note">No unambiguous Dirty Birds injury record matched this source. This does not mean players are healthy.</p>');
  }catch(e){pane.innerHTML='<summary><b>MySportsFeeds injury cross-check unavailable</b></summary><p class="ffo-gc-note">Provider check unsuccessful; rely on separately dated official injury reports. '+safe(String(e?.message||'unknown'))+'</p>';}
 }
 function drawSignals(){
  const proj=projection(),status=proj?.complete?'Validated coverage (still needs live replay backtest)':proj?.points!=null?'Partial FFL scoring · research only':'Awaiting verified game logs';
  const notice=`<div class="ffo-gc-evidence"><b>FFO Sports Intelligence feed</b><p class="ffo-gc-note">${safe(status)}. ${proj?'Recent-form research baseline '+fmt(proj.points)+' pts from '+proj.n+' games.':''} GameCast stats will inform workload, opportunity and trade differential models after identity, completeness and correction audits. Existing Sleeper and nflverse-derived decision systems are preserved.</p><button type="button" data-ffo-goto="1">Inspect GameCast</button></div>`;
  for(const id of ['ffo-gc-radar-intel','ffo-gc-trade-intel']){const el=$(id);if(!el)continue;el.innerHTML=notice;el.querySelector('[data-ffo-goto]').onclick=()=>document.querySelector('nav button[data-page="gamecast"]')?.click();}
 }
 async function refreshEvidencePanels(){
  if(!s.enabled)return;
  try{
    await ensurePlayerTotals();
     const rows=s.playerRows;
    const item=(p,tag)=>{
      const found=model.resolvePlayer(p,rows);if(!found.player)return null;
      const r=model.normalizeStats(found.player.stats),pos=String(p.position||'').toUpperCase();
      const keys=pos==='QB'?[['pass_att','Att'],['pass_yd','Pass Yds'],['pass_td','Pass TDs']]:
        pos==='RB'?[['rush_att','Carries'],['rush_yd','Rush Yds'],['targets','Targets']]:
        [['targets','Targets'],['rec','Recs'],['rec_yd','Rec Yds']];
      const metrics=keys.filter(([k])=>r[k]!==undefined&&r[k]!==null).map(([k,label])=>label+' '+Number(r[k]).toLocaleString());
      if(!metrics.length)return null;
      return '<div class="ffo-gc-intel-row"><b>'+safe(p.name)+'</b><small>'+safe(pos)+' · '+safe(p.team||'')+'</small><span>'+metrics.map(safe).join(' · ')+'</span><small>MSF 2026 season total · verified unique name/team match · '+safe(tag)+'</small></div>';
    };
    const rad=typeof pfo49RadarPool==='function'?pfo49RadarPool():[];
    const rated=rad.slice(0,12).map(x=>item(x.p,'Radar research')).filter(Boolean).slice(0,6);
    let waivers=[];
    try{
      if(typeof waiverResearch!=='undefined'&&Array.isArray(waiverResearch)&&typeof waiverIsRostered==='function'&&typeof leagueOwnedIds!=='undefined'&&leagueOwnedIds){
        const candidates=waiverResearch.filter(x=>!waiverIsRostered(x.player,x.source_player_id||x.player_id)).slice(0,12);
        waivers=candidates.map(x=>item({name:x.player,position:x.position,team:x.team},'Sleeper unrostered at check')).filter(Boolean).slice(0,6);
      }
    }catch{}
    const panel=(records,kind)=>'<details class="ffo-gc-evidence"><summary><b>MySportsFeeds 2026 season totals · '+safe(kind)+'</b> · '+records.length+' unique verified matches</summary>'+
       '<p class="ffo-gc-note">NFL stats are real season-to-date totals. Ownership is still checked through Sleeper. These are NOT upcoming FFL projections or trade valuations. Source checked '+safe(s.latestCheck||'time unverified')+'.</p>'+
       (records.length?'<div class="ffo-gc-intel-list">'+records.join('')+'</div>':'<p class="ffo-gc-note">No unambiguous candidate matches available yet. Do not infer zero stats or waiver eligibility.</p>')+
       '</details>';
    const radHost=$('ffo-gc-radar-intel'),marketHost=$('ffo-gc-trade-intel');
    if(radHost)radHost.innerHTML=panel(rated,'Opportunity Radar');
    if(marketHost)marketHost.innerHTML=panel(waivers,'Waiver research candidates')+
       '<p class="ffo-gc-note">Two-sided trade and offer models remain evidence-based and read-only; incomplete MSF stat categories cannot silently overwrite valuation.</p>';
  }catch(err){
    const message='Provider season totals unavailable for intelligence crosscheck ('+safe(err?.message||'unknown')+'). Existing Sleeper/independent data remains.';
    for(const id of ['ffo-gc-radar-intel','ffo-gc-trade-intel'])if($(id))$(id).innerHTML='<p class="ffo-gc-note">'+message+'</p>';
  }
 }
 // The field is a schematic. Neither MSF nor this app supplies actual ball tracking coordinates.
 const get=(o,keys)=>{for(const k of keys){const v=k.split('.').reduce((a,t)=>a?.[t],o);if(v!==undefined&&v!==null&&v!=='')return v;}return null;};
 const at=(o,keys)=>{const v=get(o,keys);return v!==null&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=100?Number(v):null;};
 const between=(n,low,high)=>Math.max(low,Math.min(high,n));
 function playDetails(event){const raw=event?.raw||{},state=raw.playStatus||{},g=s.games.find(x=>x.id===s.game)||{};
  const alias=t=>({GBP:'GB',GNB:'GB',JAC:'JAX',ARZ:'ARI',TAM:'TB',NOR:'NO',SFO:'SF',KAN:'KC'}[String(t||'').toUpperCase()]||String(t||'').toUpperCase());
  const scrimmage=state.lineOfScrimmage||{},spotTeam=alias(typeof scrimmage.team==='object'?scrimmage.team?.abbreviation:scrimmage.team);
  const yard=at(scrimmage,['yardLine']);
  // Yardline is relative to the source-reported side of the field, not an absolute coordinate.
  // Resolve orientation only when both the side team and selected game's teams agree.
  const start=yard===null?null:spotTeam===alias(g.away)?yard:spotTeam===alias(g.home)?100-yard:null;
  const poss=alias(state.teamInPossession?.abbreviation||state.teamInPossession||'');
  const direction=poss===alias(g.away)?1:poss===alias(g.home)?-1:null;
  const rawEnd=at(raw,['endYardLine','endingYardLine','ballOnYardLine','newYardLine']);
  const dist=get(raw,['playStatus.yardsRemaining','yardsToFirstDown','distance','downAndDistance.distance','situation.distance']);
  const down=get(raw,['playStatus.currentDown','down','downAndDistance.down','situation.down']);
  const toGo=Number.isFinite(Number(dist))&&Number(dist)>0&&Number(dist)<=100?Number(dist):null;
  return {start,end:rawEnd,yards:null,down,toGo,direction,
    reportedSpot:yard!==null&&spotTeam?spotTeam+' '+yard:null,
    quarter:event?.period??null,clock:event?.clock??null};
 }

 function portraitDirectory(){
   const names=typeof pfo49Dir==='function'?pfo49Dir():[];
   return [...s.playerRows,...s.portraitRows,...names.map(p=>({...p,sleeper:true}))];
  }
  function drawField(){
  const el=$('ffo-gc-gameview');
  const g=s.games.find(x=>x.id===s.game)||null;
  const event=s.playCache[s.activePlay]||null;
  const input={game:g,event,embedded:false,latestCheck:s.latestCheck,playCount:s.playCache.length,activePlay:s.activePlay,followLatest:s.followLatest!==false,playerRows:portraitDirectory(),selectedPlayer:s.player,source:s.playSource,isLive:s.game&&['live','overtime'].includes(model.gamePhase(g?.status))};
  if(el){
   const currentPlayId=event?.id||null;
   const switched=lastStadiumGameId!==s.game;
   const changed=!switched&&currentPlayId&&lastStadiumPlayId&&currentPlayId!==lastStadiumPlayId&&s.followLatest;
   const previousX=switched?null:priorVerifiedBallX;
   el.innerHTML=stadium.fieldMarkup(input);
   const bar=el.querySelector('.gc6-statebar');
   if(bar&&['live','overtime'].includes(model.gamePhase(g?.status))){
    const tracker=document.createElement('span');
    tracker.className='gc6-refresh-tracker';
    tracker.setAttribute('aria-label','Next MSF poll countdown');
    tracker.innerHTML='<small>MSF refresh</small> <b data-gc6-refresh>0–5s</b>';
    bar.appendChild(tracker);
   }
   const marker=el.querySelector('.gc6-ball');
   const nextX=marker?Number(marker.getAttribute('cx')):null;
   // Animate only between two provider-verified spots from consecutive displayed
   // plays, never move a stale, unverified or synthetic ball position.
   if(changed&&marker&&Number.isFinite(previousX)&&Number.isFinite(nextX)&&Math.abs(previousX-nextX)>.5&&
      typeof marker.animate==='function'&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
    marker.animate([{transform:'translateX('+(previousX-nextX)+'px)'},{transform:'translateX(0px)'}],
     {duration:900,easing:'ease-out'});
   }
   lastStadiumGameId=s.game;lastStadiumPlayId=currentPlayId;
   priorVerifiedBallX=Number.isFinite(nextX)?nextX:null;
   el.querySelectorAll('[data-gc6-step]').forEach(btn=>btn.onclick=()=>{
    s.followLatest=false;s.activePlay=between(s.activePlay+Number(btn.dataset.gc6Step),0,Math.max(0,s.playCache.length-1));drawPlays();
   });
   el.querySelector('[data-gc6-latest]')?.addEventListener('click',()=>{
    s.followLatest=true;s.activePlay=Math.max(0,s.playCache.length-1);drawPlays();
   });
  }
  const small=$('ffo-gc-player-field');
  if(small)small.innerHTML=stadium.fieldMarkup({...input,embedded:true});
 }
 function drawPlays(){
  const el=$('ffo-gc-playfeed');if(!el)return;
  if(!s.game){el.innerHTML='<p class="gc6-quiet">Select an NFL game to see its verified published play timeline.</p>';drawField();return;}
  if(!s.playCache.length){el.innerHTML='<h3>Play-by-play</h3><p class="gc6-quiet">No published plays for this game yet. Scheduled games appear when the provider publishes data; restricted historical feeds are not fabricated.</p>';drawField();return;}
  const needle=s.player?model.normalizeName(s.player.name):'';
  const isScoring=x=>/touchdown|field goal (is good|made)|extra point (is good|made)|safety/i.test(x.text||'');
  const matching=x=>needle&&model.normalizeName(x.text).includes(needle);
  const selected=s.playCache.map((event,i)=>({event,i})).filter(({event})=>s.playFilter==='scoring'?isScoring(event):s.playFilter==='player'?matching(event):true);
  const limit=Math.max(60,Number(s.visiblePlays||60)),show=selected.slice(-limit).reverse();
  el.innerHTML='<div class="gc6-feedtitle"><h3>'+safe(s.playFilter==='player'?(s.player?.name||'Player')+' · ':'')+(s.playSource?.includes('scoring plays only')?'Scoring plays (partial)':'Live & historical play-by-play')+'</h3><small>'+selected.length+' of '+s.playCache.length+' published plays</small></div>'+
  (show.length?show.map(({event,i})=>stadium.playRow(event,i,s.activePlay===i,s.games.find(g=>g.id===s.game),s.playSource,portraitDirectory(),s.player)).join(''):'<p class="gc6-quiet">No matching plays in the published subset. This does not prove zero involvement.</p>');
  if(selected.length>show.length){
    const more=document.createElement('button');more.type='button';more.className='ffo-gc-refresh';
    more.textContent='Show '+Math.min(40,selected.length-show.length)+' earlier plays';
    more.onclick=()=>{s.visiblePlays=Math.min(selected.length,limit+40);drawPlays();};
    el.appendChild(more);
  }
  el.querySelectorAll('[data-ffo-play]').forEach(row=>{
    const open=()=>{s.activePlay=Number(row.dataset.ffoPlay);s.followLatest=s.activePlay===s.playCache.length-1;drawPlays()};
    row.onclick=open;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
  });
  drawField();
 }

 async function refreshPlayer(force=false){
  if(!s.player||!s.enabled||statAuditRunning)return;
  try{
   await ensurePlayerTotals(force);drawPlayer();
   if(!force&&!s.allWeeks.size){
    // At most three completed weeks for provisional recent-form context.
    // Complete season totals remain independent and are shown immediately.
    const week=Math.min(18,Math.max(1,Number(window.dbNflWeek||8)));
    const past=Array.from({length:Math.min(3,week-1)},(_,i)=>week-1-i).reverse();
    const rows=await Promise.allSettled(past.map(w=>feed('gamelogs',{season:s.season,week:w})));
    rows.forEach((v,i)=>{if(v.status==='fulfilled')s.allWeeks.set(past[i],model.playerRows(v.value.data))});
   }
   drawPlayer();
  }catch(error){s.lastError=String(error.message||error);status('Player feed unavailable: '+s.lastError);drawPlayer()}
 }
 
 const auditPause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 // Five-minute reuse of successfully authenticated historical MSF responses.
 // Failure responses and the regular live GameCast feed are never cached here.
 const auditSuccessCache=new Map(),AUDIT_REUSE_MS=300000;
 const transientStatError=e=>/upstream_unreachable|gateway_or_server_error|provider_unreachable|provider_body_read_failed|fetch is aborted|aborterror|network|http 502|http 503|rate_limited/i.test(String(e?.message||e));
 async function auditedStatRequest(name,query,progress){
  const permitted=['stats','gamelogs','teamgamelogs','plays','boxscore'].includes(name);
  const key=name+':'+Object.entries(query||{}).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('&');
  const prior=permitted?auditSuccessCache.get(key):null;
  if(prior&&Date.now()-prior.at<AUDIT_REUSE_MS){
   progress?.('Reusing successful MSF historical '+name+' snapshot (<5 min old)');
   return prior.data;
  }
  for(let attempt=1;attempt<=2;attempt++){
   try{
    const result=await feed(name,query,true);
    if(permitted&&result?.available!==false){
     auditSuccessCache.set(key,{at:Date.now(),data:result});
     while(auditSuccessCache.size>28)auditSuccessCache.delete(auditSuccessCache.keys().next().value);
    }
    return result;
   }catch(error){
    if(attempt===2||!transientStatError(error))throw error;
    progress?.('Temporary gateway failure · one controlled retry for '+name);
    await auditPause(3600);
   }
  }
 }
 function renderStatAudit(report){
  const el=$('ffo-gc-stat-audit-results');if(!el)return;
  const weeks=report.weeks.map(r=>{
   const a=r.audit,ok=!!(a?.supported&&r.teamFilterVerified);
   const title=ok?a.parsedCount+' published player records':'Unavailable · no scores assumed';
   const detail=ok?'Provider IDs '+a.uniqueProviderIds+' · numeric stats '+a.statsRecognized+(r.recovered?' · gateway recovered':''):
    String(r.error||'Feed not independently verified').slice(0,220);
   const positions=ok?['QB','RB','WR','TE','K','DEF'].map(p=>{
    const x=a.positionCoverage?.[p]||{};
    return p+' '+(x.records||0)+' records · '+(x.partialScoring||0)+' partial point estimates';
   }).join(' · '):'';
   return '<details class="gc-stat-audit-week" style="border-bottom:1px solid #315069;padding:8px 0">'+
    '<summary style="cursor:pointer;display:flex;justify-content:space-between;flex-wrap:wrap;gap:5px">'+
    '<strong>Week '+r.week+'</strong><span>'+safe(title)+'</span>'+
    '<span style="width:100%;font-size:12px;opacity:.83;overflow-wrap:anywhere">'+safe(detail)+'</span></summary>'+
    (ok?'<div class="muted" style="font-size:12px;margin:8px 0">'+safe(positions)+
    '</div><div class="muted">All category gaps remain unknown; no final FFL scores.</div>':'')+
    '</details>';
  }).join('');
  const season=!report.seasonChecked?'Season totals · checking':
   report.seasonAudit?.supported&&report.seasonFilterVerified?
   'Season totals · '+report.seasonAudit.parsedCount+' player records':
   'Season totals unverified'+(report.seasonError?' · '+report.seasonError:'');
  const a=report.lowerBound,comparison=a?a.matchedPlayers+' MSF player IDs matched · '+
   a.comparedCategories+' lower-bound checks · '+a.overSeasonTotals+' six-week totals exceeding published season totals':'Season reconciliation unavailable';
  const e=report.scoringEvidence,by=e?.byPosition||{};
  const positionRows=e?['QB','RB','WR','TE','K','DEF'].map(position=>{
   const p=by[position]||{},total=p.records||0;
   const core=p.coreCoverage||[],observed=(p.coveredCategories||[]).slice(0,10),coverage=p.scoringRuleCoverage||{};
   const statRules=coverage.statMappedRules||0,eventRules=coverage.eventEvidenceRules||[];
   const mappingGaps=coverage.unavailableMappedRules||[];
   const mappedSummary=statRules?coverage.statMappedRows+'/'+total+' records contain all '+statRules+' mapped scoring categories':
    'No published-stat rule coverage verified';
   const mappingGapsSummary=mappingGaps.slice(0,9).map(x=>x.category+' '+x.publishedRows+'/'+total+' records').join(' · ');
   const eventSummary=eventRules.length?eventRules.join(', '):'No additional weighted play-only rules identified for this position';
   const coreText=core.length?core.map(c=>c.category+' '+c.records+'/'+total).join(' · '):
    'No verified scoring core categories';
   const examples=(p.samples||[]).map(x=>{
    const parts=(x.components||[]).map(c=>c.key+': '+c.stat+' × '+c.weight+' = '+c.points).join(' · ');
    return '<div style="padding:6px 0;border-top:1px solid #315069">'+
     '<strong>'+safe(x.player)+' · sample W'+safe(x.week)+'</strong>'+
     '<div class="muted">Observed subtotal '+safe(x.observedPoints)+' (NOT final FFL score)</div>'+
     '<div class="muted">'+safe(parts||'No observed components')+'</div>'+
     '<div class="muted">Unknown / unverified: '+safe(x.missing.join(', ')||'None in mapped weights; game events still need review')+'</div></div>';
   }).join('');
   return '<details style="border-bottom:1px solid #315069;padding:7px 0">'+
    '<summary style="cursor:pointer;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">'+
    '<strong>'+position+'</strong><span>'+total+' records · '+(p.withPartialPoints||0)+' provisional subtotals</span>'+
    '<span style="width:100%;font-size:11px;opacity:.8">'+(p.fullyCovered||0)+' full weighted-rule completions · NOT certified FFL score</span></summary>'+
    '<div class="muted" style="font-size:12px;overflow-wrap:anywhere;margin:7px 0">Mapped stat fields: '+safe(mappedSummary)+'</div>'+
    '<div class="muted" style="font-size:12px;overflow-wrap:anywhere">Incomplete stat mappings: '+safe(mappingGapsSummary||'None reported')+'</div>'+
    '<div class="muted" style="font-size:12px;overflow-wrap:anywhere">Play-by-play/event verification: '+safe(eventSummary)+'</div>'+
    '<div class="muted" style="font-size:12px;overflow-wrap:anywhere;margin:7px 0">Core scoring coverage: '+safe(coreText)+'</div>'+
    '<div class="muted" style="font-size:12px;overflow-wrap:anywhere">Observed category mappings: '+
     safe(observed.map(x=>x.name+' ('+x.records+')').join(', ')||'None')+'</div>'+
    '<div class="muted" style="font-size:12px;overflow-wrap:anywhere">Unverified categories: '+
     safe((p.missingCategories||[]).slice(0,15).join(', ')||'None in parsed categories')+'</div>'+
    (position==='K'?'<div class="muted" style="font-size:12px;overflow-wrap:anywhere">Kicking-related MSF player fields: '+safe((p.observedRawFieldPaths||[]).filter(x=>/fieldgoal|extraPoint|pat|kick(?!offReturn)/i.test(x)).join(', ')||'Not present in sampled player game logs')+'</div>':'')+
    examples+'</details>';
  }).join(''):'';
  const t=report.teamEvidence,pb=report.kickEvidence;
  const dstWeeks=model.summarizeDstWeeks(report.teamWeeks||[],report.team);
  const dstWeekRows=dstWeeks.weeks.map(w=>'<div style="padding:6px 0;border-top:1px solid #315069;font-size:12px">'+
   '<b>Week '+safe(w.week)+'</b> · '+safe(w.status==='team_stats_verified'?'MSF team game identified':'Team game unverified')+
   '<div class="muted">Sacks '+safe(w.sacks===null?'unknown':w.sacks)+
   ' · INT '+safe(w.interceptions===null?'unknown':w.interceptions)+
   ' · observed subtotal '+safe(w.observedSubtotal===null?'unknown':w.observedSubtotal+' pts')+
   ' · full D/ST score NOT certified</div>'+
   (w.error?'<div class="muted">'+safe(w.error)+'</div>':'')+'</div>').join('');
  const dstBoxWeeks=report.dstBoxWeeks||[];
  const boxRows=dstBoxWeeks.map(row=>{
   const e=row.evidence,verified=e?.status==='scoreboard_reconciled',mismatch=e?.status==='scoreboard_mismatch';
   const label=verified?'Final scores match':mismatch?'SCORES DIFFER':e?.sourceFinalVerified?'Final box available · schedule unverified':'Unverified';
   const ledger=row.scoringPlays;
   const ledgerRows=(ledger?.events||[]).slice(0,14).map(play=>
    '<div style="font-size:12px;padding:6px 0;border-top:1px solid #315069;overflow-wrap:anywhere">'+
    '<b>'+safe(play.scoringSide||'Scoring side not verified')+
    (play.scoringPoints===null?'':' +'+safe(play.scoringPoints))+'</b> · '+
    safe(play.scoreType.replaceAll('_',' '))+
    '<div class="muted">'+safe(play.description||'Published score snapshot without description')+'</div></div>').join('');
   const ledgerStatus=ledger?.available?(ledger.finalScoreMatchesLedger===true?
    'Scoring deltas match final score':'Scoring sequence not fully reconciled'):'Scoring-play evidence unavailable';
   const ledgerCard=ledger?
    '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px">MSF scoring-play review · '+
    safe(ledger.scoringPlays)+' published entries</summary>'+
    '<div class="muted" style="font-size:12px;margin:5px 0">'+safe(ledgerStatus)+
    ' · '+safe(ledger.nonOffenseCandidates)+' defensive/special-teams TD candidates · '+safe(ledger.unverifiedSideEvents)+
    ' events with uncertain scoring side</div>'+ledgerRows+
    '<div class="muted" style="font-size:12px;margin-top:6px">Descriptions and score changes are evidence only; no non-offensive scoring adjustment is automatically credited or deducted.</div></details>':'';

   return '<details '+(mismatch?'open ':'')+'style="border-bottom:1px solid #315069;padding:7px 0">'+
    '<summary style="cursor:pointer;display:flex;justify-content:space-between;flex-wrap:wrap;gap:5px">'+
    '<b>Week '+safe(row.week)+'</b><span style="font-size:12px">'+safe(label)+'</span>'+
    '<span style="width:100%;font-size:11px;opacity:.8">'+safe(row.game||'Game unavailable')+'</span></summary>'+
    (e?'<div class="muted" style="font-size:12px;margin-top:6px">'+
      (e.homeScore===null?'Box score unavailable':'MSF final: '+safe(e.away)+' '+safe(e.awayScore)+' · '+safe(e.home)+' '+safe(e.homeScore))+
      '</div>'+
      '<div class="muted" style="font-size:12px">Opponent scoreboard points: '+
      (e.rawOpponentPoints===null?'unverified':safe(e.rawOpponentPoints))+
      ' · FFL points allowed: unverified · D/ST points: unverified</div>'+
      '<div class="muted" style="font-size:12px">'+safe(e.reason||'Unverified')+'</div>'+ledgerCard:
      '<div class="muted" style="font-size:12px">'+safe(row.error||'No authenticated box score')+'</div>')+
    '</details>';
  }).join('');
  const boxCard='<details style="padding:8px 0;border-top:1px solid #315069">'+
   '<summary style="cursor:pointer;font-weight:700">Final score cross-check · Weeks 1–6</summary>'+
   '<div class="muted" style="font-size:12px;margin:7px 0">'+
   safe(dstBoxWeeks.filter(x=>x.evidence?.status==='scoreboard_reconciled').length)+
   '/6 MSF box scores matched independent final schedules. These are NOT D/ST points allowed.</div>'+
   boxRows+
   '<p class="muted" style="font-size:12px">Pick-sixes, fumble returns, special-teams touchdowns and other scoring adjustments must be classified before applying FFL points-allowed rules.</p>'+
   '</details>';
  // Displays actual licensed plays, not invented or automatically awarded
  // touchdown bonuses. Game logs are independently reconciled later.
  const eventWeeks=report.playerEventWeeks||[];
  const eventRows=eventWeeks.map(row=>{
   const e=row.evidence,joined=row.sameGameReconciliation,scenario=row.eventScenarios;
   const scenarioRows=(scenario?.players||[]).filter(p=>p.scoringEvidenceCount>0).slice(0,7).map(p=>
    '<div style="font-size:11px;padding:5px 0;border-top:1px solid #294157;overflow-wrap:anywhere">'+
    '<strong>'+safe(p.player||p.playerId)+'</strong> · conditional supplemental points: '+
    '<b>'+safe(p.highestOnlyCandidatePoints)+'</b> if highest-only / '+
    '<b>'+safe(p.additiveCandidatePoints)+'</b> if 40+ and 50+ stack'+
    (p.twoPtMissingStatSourceCandidates?' · includes '+safe(p.twoPtMissingStatSourceCandidates)+
     ' corroborated 2PT points ABSENT from player game log':'')+
    (p.twoPtAlreadyPublished?' · '+safe(p.twoPtAlreadyPublished)+
     ' published 2PT stat already counted separately':'')+
    '</div>').join('');
   const scenarioCard=scenarioRows?
    '<details style="margin:6px 0;padding:5px 0;border-top:1px solid #315069">'+
    '<summary style="cursor:pointer;font-size:12px;font-weight:700">Conditional scoring alternatives · NOT final FFL totals</summary>'+
    '<div class="muted" style="font-size:11px;margin:5px 0">These are potential EXTRA event-only points, not complete player fantasy scores. '+
    'TD base points are NOT included. The exact 50+ bonus stacking rule, missing plays and final stat corrections have not been adjudicated. '+
    'Do not use for projections, waivers, trades, or live matchup scores.</div>'+
    scenarioRows+'</details>':'';
   const blockerLabels={
    missing_fullPlayCoverageVerified:'Whole-game play coverage not certified',
    missing_statCorrectionsChecked:'Final stat corrections not independently checked',
    final_player_stat_not_verified:'Player stat not published in weekly MSF log',
    fifty_plus_stacking_not_adjudicated:'FFL 50+ stacking rule pending',
    play_count_exceeds_final_player_stat_count:'PBP event count exceeds published final stat',
    missing_gameFinal:'Final game evidence not verified',
    missing_finalPlayerBoxScoreVerified:'Final player box-score categories incomplete'
   };
   const categoryLabels={
    source_event_count_equals_stat:'Identified PBP count agrees with published stat',
    source_events_are_subset_of_stat:'PBP candidates are a subset of published total',
    player_stat_unpublished:'PBP identified; separate weekly stat not published',
    source_plays_exceed_stat:'Published counts disagree — needs investigation'
   };
   const twoPtRows=(joined?.twoPointCorroboration||[]).map(x=>
    '<div class="muted" style="font-size:11px;padding:5px 0;border-top:1px solid #294157">'+
    '<b>Two-point conversion · '+safe(x.publishedResult||'unknown')+'</b> · '+
    (x.pbpVerifiedSuccessfulPass?'MSF PBP success with verified player IDs':
     'PBP outcome or identities unverified')+
    ' · '+safe(x.sourceTier==='two_independent_msf_feeds_agree'?
      'Independent MSF scoring summary agrees':
      x.sourceTier==='ambiguous_duplicate_scoring_summary'?
      'Duplicate scoring summary — needs review':
      'Scoring-summary corroboration not established')+
    ' · no fantasy points credited</div>').join('');
   const sameGameLine=joined?'<details style="margin:6px 0;padding:5px 0;border-top:1px solid #315069">'+
    '<summary style="cursor:pointer;font-size:12px">Same-game MSF player cross-check · '+
    safe(joined.sameGameStatMatches)+'/'+safe(joined.matchedCandidatePlayerIds)+' matched IDs · final awards withheld</summary>'+
    '<div class="muted" style="font-size:11px;margin:5px 0">MSF game '+safe(joined.gameId||'unknown')+
    ' · final scoreboard '+safe(joined.finalScoreboardVerified?'verified':'unverified')+
    ' · '+safe(joined.ledger.pendingCount)+' scoring candidates pending. '+
    'Whole-game completeness, final stat corrections and bonus stacking remain verification gates.</div>'+
    twoPtRows+scenarioCard+
    joined.ledger.lineItems.slice(0,10).map(x=>
     '<div class="muted" style="font-size:11px;padding:3px 0;border-top:1px solid #294157">'+
     safe(x.player||x.playerId||'Unresolved player')+' · '+safe(x.category)+
     ' · identified PBP plays '+safe(x.sourceObservedCount??'unknown')+
     ' / same-game MSF stat '+safe(x.statCount===null?'not published':x.statCount)+
     ' · '+safe(categoryLabels[x.sourceCategoryAgreement]||'Category comparison pending')+
     ' · hold: '+safe(x.blockers.map(key=>blockerLabels[key]||key.replaceAll('_',' ')).join('; '))+
     '</div>').join('')+
    (joined.missingOrAmbiguousPlayerIds.length?'<div class="muted">Unmatched MSF player IDs: '+
     safe(joined.missingOrAmbiguousPlayerIds.join(', '))+'</div>':'')+'</details>':'';
   const rows=(e?.events||[]).slice(0,15).map(play=>{
    const identities=(play.matched||[]).map(a=>
     (a.verifiedIdentity?safe(a.player)+' · MSF #'+safe(a.providerId):
      (a.sourceToken?safe(a.sourceToken):'actor unverified'))+
     (a.yards!==null?' · '+safe(a.yards)+' yd':'')+
     (a.weightedRules?.length?' · possible '+safe(a.weightedRules.join(', ')):'')).join(' / ');
    return '<div style="padding:6px 0;border-top:1px solid #315069;font-size:12px;overflow-wrap:anywhere">'+
     '<b>'+safe(play.eventType.replaceAll('_',' '))+' · '+safe(play.publishedResult)+'</b>'+
     '<div class="muted">'+safe(play.description)+'</div>'+
     '<div class="muted">'+(play.teamPossessionVerified?'Team possession matched':'Possession unverified')+
     (identities?' · '+identities:' · actor/bonus unverified')+'</div></div>';
   }).join('');
   return '<details style="border-bottom:1px solid #315069;padding:7px 0">'+
    '<summary style="cursor:pointer;display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px">'+
    '<b>Week '+safe(row.week)+'</b><span style="font-size:12px">'+
    (e?safe(e.publishedCandidates)+' source event candidates':'Source unavailable')+'</span>'+
    '<span style="width:100%;font-size:11px;opacity:.85">'+safe(row.game||row.error||'Game unverified')+'</span></summary>'+
    (e?'<div class="muted" style="font-size:12px;margin:5px 0">'+
      safe(e.identifiedCandidateEvents)+' uniquely matched player events · '+
      safe(e.unverifiedCandidateEvents)+' unresolved · '+safe(e.twoPointAttempts)+' 2PT attempts · '+
      safe(e.longTouchdowns)+' long-TD candidates · '+safe(e.excludedNullifiedPlays||0)+' nullified plays excluded. No final bonuses credited.</div>'+sameGameLine+rows:
      '<div class="muted">'+safe(row.error||'No authenticated source evidence')+'</div>')+
    '</details>';
  }).join('');
  const eventCard='<details style="border-top:1px solid #315069;padding:8px 0">'+
   '<summary style="cursor:pointer;font-weight:700">Player TD bonuses & two-point evidence · Weeks 1–6</summary>'+
   '<div class="muted" style="font-size:12px;margin:7px 0">'+
    safe(eventWeeks.filter(x=>!!x.evidence).length)+'/6 licensed MSF PBP samples processed. '+
    'Only uniquely resolved weekly MSF player identities are displayed as matched. No unverified bonus awarded.</div>'+
   eventRows+
   '<p class="muted" style="font-size:12px">Long-TD 40+/50+ bonus stacking, 2PT success, independent play totals and any statistical corrections remain verification gates. Provisional source observations do not modify FFL player totals.</p>'+
   '</details>';
  const dstSamples=report.dstPlayWeeks||[];
  const dstCandidateRows=dstSamples.map(item=>{
   const sample=item.evidence,counts=sample?.categoryCounts||{};
   const categoryText=sample?Object.entries(counts).filter(([,count])=>count>0)
    .map(([name,count])=>name.replaceAll('_',' ')+': '+count).join(' · '):'No verified play evidence';
   const descriptionRows=(sample?.samples||[]).slice(0,8).map(x=>
    '<div style="padding:5px 0;border-top:1px solid #315069;font-size:12px;overflow-wrap:anywhere">'+
    '<b>'+safe(x.categories.join(', ').replaceAll('_',' '))+'</b>'+
    (x.sourcePossessionTeam?' · possession '+safe(x.sourcePossessionTeam):' · possession unknown')+
    '<div class="muted">'+safe(x.description)+'</div>'+
    '</div>').join('');
   return '<details style="border-bottom:1px solid #315069;padding:7px 0">'+
    '<summary style="cursor:pointer;display:flex;justify-content:space-between;gap:5px;flex-wrap:wrap">'+
    '<b>Week '+safe(item.week)+'</b><span style="font-size:12px">'+
    (sample?safe(sample.candidateEvents)+' published candidate events':'Source unavailable')+'</span>'+
    '<span style="width:100%;font-size:11px;opacity:.83">'+safe(item.game||item.error||'Game unverified')+'</span></summary>'+
    '<div class="muted" style="font-size:12px;margin:7px 0;overflow-wrap:anywhere">'+
    safe(categoryText||'No candidate events found in available feed')+'</div>'+
    (descriptionRows?'<details><summary style="cursor:pointer;font-size:12px">Inspect original published defensive play descriptions</summary>'+
     descriptionRows+'</details>':'')+
    '<div class="muted" style="font-size:12px;margin-top:6px">Event candidates only — neither defense attribution nor fantasy scoring is certified.</div>'+
    '</details>';
  }).join('');
  const dstCandidateSection='<details style="border-top:1px solid #315069;padding:8px 0">'+
   '<summary style="cursor:pointer;font-weight:700">D/ST published play candidates · Weeks 1–6</summary>'+
   '<div class="muted" style="font-size:12px;margin:7px 0">'+
   safe(dstSamples.filter(x=>!!x.evidence).length)+'/6 existing MSF PBP samples inspected. '+
   'Interceptions, fumbles, blocked kicks, safeties and returns are source-text candidates, not points.</div>'+
   dstCandidateRows+
   '<p class="muted" style="font-size:12px">Possession is not proof of the scoring defense. Points allowed and touchdowns need game/box reconciliation.</p>'+
   '</details>';
  const teamside=t?.teamFilterVerified
   ?'MSF team log verified · '+t.records+' record'+(t.records===1?'':'s')+
     ' · '+t.numericRecords+' with numeric stats'
   :'Team log not verified · '+String(report.teamEvidenceError||'No evidence yet');
  const defense=t?.observedComponents||[];
  const defenseLine=t?.teamFilterVerified?defense.map(x=>
    x.label+': '+(x.value===null?'unknown':x.value)+
    (x.value!==null?' × '+x.weight+' = '+x.points+' provisional points':'')).join(' · '):'';
  const missing=t?.teamFilterVerified?(t.missingComponents||[]).join(', '):'';
  const teamCard='<details style="border-top:1px solid #315069;padding:8px 0">'+
   '<summary style="cursor:pointer;font-weight:700">D/ST source evidence · Weeks 1–6</summary>'+
   '<div class="muted" style="font-size:12px;margin:7px 0">'+safe(dstWeeks.verifiedWeeks)+'/6 MSF team games verified. Sacks/INTs are independent provisional components.</div>'+dstWeekRows+
   '<div class="muted" style="font-size:12px;overflow-wrap:anywhere;margin:7px 0">'+safe(teamside)+'</div>'+
   (defenseLine?'<div style="font-size:12px;overflow-wrap:anywhere;margin:7px 0">'+safe(defenseLine)+'</div>':'')+
   (missing?'<div class="muted" style="font-size:12px">Missing verified categories: '+safe(missing)+'</div>':'')+
   '<div class="muted" style="font-size:12px;margin:7px 0">Points allowed, return touchdowns, blocked kicks and turnovers require independent evidence. No final D/ST fantasy score is certified.</div>'+boxCard+
   '</details>';
  const kickHistory=model.summarizeKickerWeeks(report.kickWeeks||[],report.team);
  const kickChecks=model.reconcileKickerWeeks(report.kickWeeks||[],report.teamWeeks||[],report.team);
  const kickWeekRows=kickHistory.weeks.map(w=>{
   const observed=w.status==='pbp_published';
   const check=kickChecks.weeks.find(c=>c.week===w.week);
   const checkDesc=check?(check.status==='four_counts_match'?'All 4 published team FG/XP counts reconcile':
    check.status==='partial_counts_match'?check.comparedCategories+'/4 published team FG/XP categories reconcile':
    check.status==='mismatch'?(check.crossFeedDifferenceMayBeAttributionGap?'Possible PBP player-attribution gap · ':'Count difference · ')+(check.disagreements||[]).map(d=>d.category).join(', '):
    'Not independently verifiable · '+check.reason):'Team kick counts not yet checked';
   const fields=[['fgAttempts','FG attempts'],['fgMade','FG made'],['xpAttempts','XP attempts'],['xpMade','XP made']];
   const countSummary=check?.observedCounts?fields.map(([key,label])=>{
    const provider=check.providerTotals?.[key];
    const usable=provider!==null&&provider!==undefined&&Number.isFinite(Number(provider));
    return label+': PBP '+Number(check.observedCounts[key]??0)+' / team '+(usable?Number(provider):'not published');
   }).join(' · '):'';
   const needsReview=check?.status==='mismatch';
   const warningText=needsReview?(check.crossFeedDifferenceMayBeAttributionGap?'Investigate unidentified published kicks: ':'Review count difference: ')+check.disagreements.map(d=>d.category+' ('+d.pbpCount+' attributed PBP vs '+d.teamCount+' team total)').join('; '):'';
   const missingPlayDetails=needsReview?(check.unresolvedPlayDetails||[]).map(x=>
    '<div style="font-size:11px;padding:5px 0;border-top:1px solid #315069;overflow-wrap:anywhere">'+
    '<b>'+safe(x.kickerToken||'Unattributed kick')+'</b> · '+safe(x.kind)+' · '+safe(x.outcome)+
    (x.sourcePossessionTeam?' · source possession '+safe(x.sourcePossessionTeam):' · possession unverified')+
    '<div class="muted">'+safe(x.description)+'</div></div>').join(''):'';
   const evidence=(w.players||[]).map(p=>
    '<div class="muted" style="font-size:12px">'+safe(p.playerName||p.actor)+
    ' · ID '+safe(p.providerId||'unknown')+' · observed '+(p.observedSubtotal===null?'unknown':safe(p.observedSubtotal)+' pts')+
    ' · '+safe(p.unknownEvents)+' uncertain plays</div>').join('');
   return '<details '+(needsReview?'open ':'')+'style="border-bottom:1px solid #315069;padding:7px 0">'+
    '<summary style="cursor:pointer;display:flex;justify-content:space-between;flex-wrap:wrap;gap:5px">'+
    '<strong>Week '+safe(w.week)+(needsReview?' · CHECK COUNTS':'')+'</strong><span style="font-size:12px">'+safe(observed?w.candidatePlays+' published FG/XP mentions':'Unverified')+'</span>'+
    '<span style="width:100%;font-size:11px;opacity:.8">'+safe(w.game||w.error||'Game unverified')+'</span></summary>'+
    (observed?'<div class="muted" style="font-size:12px;margin:6px 0">'+
     'GB player-ID-matched plays '+safe(w.knownEvents)+' · unknown or opposing actors '+safe(w.unverifiedEvents)+
     ' · observed GB subtotal '+(w.observedPoints===null?'unknown':safe(w.observedPoints)+' pts')+'</div>'+evidence+
     '<div class="muted" style="font-size:12px;overflow-wrap:anywhere">'+safe(checkDesc)+'</div>'+
     (countSummary?'<div class="muted" style="font-size:11px;overflow-wrap:anywhere;margin:5px 0">Team/PBP evidence: '+safe(countSummary)+'</div>':'')+
     (warningText?'<div style="font-size:12px;font-weight:700;margin:4px 0">Reconciliation needs review: '+safe(warningText)+'</div>':'')+
     (check?.disagreements?.length?'<div style="font-size:12px;font-weight:600;overflow-wrap:anywhere;margin:5px 0">Disagreement: '+
      safe(check.disagreements.map(d=>d.category+': published PBP '+d.pbpCount+' vs MSF team '+d.teamCount).join(' · '))+'</div>'+
      (check.unresolvedActorTokens?.length?'<div class="muted" style="font-size:11px">Unresolved actors: '+safe(check.unresolvedActorTokens.join(', '))+'</div>':'')+
      (check.unattributedPlays?'<div class="muted" style="font-size:11px">Unattributed kick mentions: '+safe(check.unattributedPlays)+'</div>':'')+
      (missingPlayDetails?'<details style="padding:4px 0"><summary style="font-size:12px;cursor:pointer">Inspect original MSF plays needing identification</summary>'+missingPlayDetails+'</details>':''):''):
     '<div class="muted" style="font-size:12px">Unknown, not zero. '+safe(w.error||'No licensed play data')+'</div>')+
    '</details>';
  }).join('');
  const sample=(pb?.publishedEvents||[]).slice(0,10).map(x=>
   '<div style="padding:6px 0;border-bottom:1px solid #315069;font-size:12px">'+
   '<b>'+safe(x.kind)+'</b> · '+safe(x.publishedOutcome)+
   (x.kickerToken?' · '+safe(x.kickerToken):' · kicker unverified')+
   (x.observedEventPoints!==null?' · '+safe(x.observedEventPoints)+' provisional pts':' · scoring unknown')+
   (x.distance!==null?' · '+safe(x.distance)+' yards':' · distance unknown')+
   '<div class="muted">'+safe(x.description)+'</div></div>').join('');
  const kickCard='<details style="border-top:1px solid #315069;padding:8px 0">'+
   '<summary style="cursor:pointer;font-weight:700">Kicker evidence · Weeks 1–6</summary>'+
   '<div class="muted" style="font-size:12px;margin:7px 0">'+safe(kickHistory.publishedFeeds)+
   '/6 historical game feeds · '+safe(kickHistory.identityVerifiedWeeks)+
   ' with uniquely verified '+safe(report.team)+' kicker IDs · '+safe(kickChecks.matched)+' full count matches · '+safe(kickChecks.partialMatches)+' partial count matches · '+safe(kickChecks.discrepancies)+' weeks needing count review · '+safe(kickChecks.unverified)+' unverified checks. Provisional points not certified.</div>'+
   (kickHistory.players.length?kickHistory.players.map(p=>
    '<div style="font-size:12px"><b>'+safe(p.playerName)+'</b> · '+
    safe(p.weeksWithObservedEvents)+' weeks · observed subtotal '+safe(p.observedSubtotal)+' pts (not final)</div>').join(''):'')+
   kickWeekRows+
   (sample?'<details style="padding:8px 0"><summary style="cursor:pointer;font-size:12px">Inspect published kick plays · '+safe(pb.sampleGame||'')+'</summary>'+sample+'</details>':'')+
   '<p class="muted" style="font-size:12px">Opposing kickers and players without uniquely verified MSF identity receive no GB credit. Missing weeks and missing fields remain unknown, not zero.</p>'+
   '</details>';
  const scoringCard=e?'<details style="border-top:1px solid #315069;margin:8px 0;padding-top:8px">'+
   '<summary style="cursor:pointer;font-weight:700">FFL scoring components · '+safe(e.records)+' player-week records</summary>'+
   '<p class="muted" style="font-size:12px">Independent MSF stats and frozen FFL rules only. Mapped stat coverage cannot certify long-TD bonuses, turnover events, K or D/ST. Unknown values remain unknown.</p>'+
   positionRows+'</details>':'';
  el.innerHTML='<div style="padding:7px 0;overflow-wrap:anywhere"><strong>Team '+safe(report.team)+'</strong> · '+safe(season)+'</div>'+
   '<div class="muted" style="font-size:12px;overflow-wrap:anywhere">'+safe(comparison)+'</div>'+
   '<p class="muted" style="font-size:12px">Missing games or statistics are unknown, not zero. Bonuses, K and D/ST are not certified.</p>'+scoringCard+eventCard+kickCard+teamCard+dstCandidateSection+weeks;
 }
 async function runStatAudit(){
  const button=$('ffo-gc-stat-audit-check'),indicator=$('ffo-gc-stat-audit-status');
  if(!button||button.disabled||statAuditRunning)return;
  if(!s.enabled){if(indicator)indicator.textContent='Authenticated MSF gateway required';return}
  button.disabled=true;statAuditRunning=true;
  const team=String($('ffo-gc-stat-audit-team')?.value||'GB').toUpperCase();
  const report={team,weeks:[],seasonChecked:false,seasonAudit:null,seasonError:null,lowerBound:null,seasonFilterVerified:false,scoringEvidence:null,teamEvidence:null,teamEvidenceError:null,teamWeeks:[],kickEvidence:null,kickEvidenceError:null,kickWeeks:[],dstPlayWeeks:[],dstBoxWeeks:[],playerEventWeeks:[],recoveredWeekCount:0};
  let seasonPayload=null;
  const goodWeeks=[];
  try{
   if(!s.ownedRules)await loadFfoRules();
   // Six MSF week requests are serialized, with pacing and one retry.
   // A failed week is never represented as zero player statistics.
   for(let week=1;week<=6;week++){
    if(indicator)indicator.textContent='Team '+team+' · checking week '+week+' of 6…';
    try{
     const res=await auditedStatRequest('gamelogs',{season:s.season,week,team},
      msg=>{if(indicator)indicator.textContent='Week '+week+' · '+msg});
     const payload=res.data||{},audit=model.auditStatFeed(payload,s.ownedRules);
     const rows=model.playerRows(payload);
     const teamFilterVerified=rows.length>0&&rows.every(r=>r.team===team);
     report.weeks.push({week,audit,teamFilterVerified,
      error:teamFilterVerified?null:'MSF player/team identity was not verified'});
     if(audit.supported&&teamFilterVerified)goodWeeks.push({week,payload});
    }catch(error){report.weeks.push({week,error:String(error.message||error).slice(0,220)})}
    renderStatAudit(report);
    if(week<6)await auditPause(1600);
   }
   // Recover ONLY transient failures after the initial six weekly checks.
   // Keep successful weeks; a recovered response replaces its error row.
   for(const failed of report.weeks.filter(r=>r.error&&transientStatError(r.error)).slice(0,6)){
    if(indicator)indicator.textContent='MSF temporary outage · recovering Week '+failed.week+'…';
    await auditPause(2400);
    try{
     const response=await auditedStatRequest('gamelogs',{season:s.season,week:failed.week,team},
      msg=>{if(indicator)indicator.textContent='Week '+failed.week+' recovery · '+msg});
     const payload=response.data||{},audit=model.auditStatFeed(payload,s.ownedRules),rows=model.playerRows(payload);
     if(audit.supported&&rows.length&&rows.every(r=>r.team===team)){
      const index=report.weeks.findIndex(r=>r.week===failed.week);
      if(index>=0)report.weeks[index]={week:failed.week,audit,teamFilterVerified:true,recovered:true,error:null};
      if(!goodWeeks.some(x=>x.week===failed.week))goodWeeks.push({week:failed.week,payload});
      report.recoveredWeekCount++;
     }
    }catch{/* Keep original transient error unknown, never zero. */}
    renderStatAudit(report);
   }
   if(indicator)indicator.textContent='Team '+team+' · checking season totals…';
   try{
    const res=await auditedStatRequest('stats',{season:s.season,team},
     msg=>{if(indicator)indicator.textContent='Season totals · '+msg});
    seasonPayload=res.data||{};
    report.seasonAudit=model.auditStatFeed(seasonPayload,s.ownedRules);
    const rows=model.playerRows(seasonPayload);
    report.seasonFilterVerified=rows.length>0&&rows.every(r=>r.team===team);
    if(!report.seasonFilterVerified)report.seasonError='Filtered MSF season players unverified';
   }catch(error){
    report.seasonError=String(error.message||error).slice(0,220);
    if(transientStatError(error)){
     if(indicator)indicator.textContent='Recovering temporary MSF season totals error…';
     await auditPause(2400);
     try{
      const response=await auditedStatRequest('stats',{season:s.season,team});
      const payload=response.data||{},audit=model.auditStatFeed(payload,s.ownedRules),rows=model.playerRows(payload);
      if(audit.supported&&rows.length&&rows.every(r=>r.team===team)){
       seasonPayload=payload;report.seasonAudit=audit;report.seasonFilterVerified=true;report.seasonError=null;
      }
     }catch{/* Preserve failed source as unverified. */}
    }
   }
   report.seasonChecked=true;
   renderStatAudit(report);
   if(indicator)indicator.textContent='Checking MSF team game logs for independent D/ST stats…';
   try{
    const source=await auditedStatRequest('teamgamelogs',{season:s.season,week:1,team},
      message=>{if(indicator)indicator.textContent='D/ST · '+message});
    report.teamEvidence=model.auditTeamGameFeed(source.data||{},team,s.ownedRules);
    report.teamWeeks.push({week:1,evidence:report.teamEvidence});
    if(!report.teamEvidence.teamFilterVerified)
      report.teamEvidenceError='Returned team IDs or schema unverified';
   }catch(error){
    report.teamEvidenceError=String(error.message||error).slice(0,180);
    report.teamWeeks.push({week:1,error:report.teamEvidenceError});
   }
   // Verify team-specific MSF gamelogs across Weeks 1–6, with controlled
   // pacing and no invented 0.0s for missed games or unverified team IDs.
   for(let week=2;week<=6;week++){
    if(indicator)indicator.textContent='D/ST historical game log · Week '+week+' / 6…';
    await auditPause(1600);
    try{
     const data=await auditedStatRequest('teamgamelogs',{season:s.season,week,team},
      msg=>{if(indicator)indicator.textContent='D/ST W'+week+' · '+msg});
     report.teamWeeks.push({week,evidence:model.auditTeamGameFeed(data.data||{},team,s.ownedRules)});
    }catch(error){report.teamWeeks.push({week,error:String(error.message||error).slice(0,180)})}
    renderStatAudit(report);
   }
   // Delayed and bounded recovery for transient team-defense gateway failures.
   for(const failed of report.teamWeeks.filter(x=>x.error&&transientStatError(x.error)).slice(0,6)){
    if(indicator)indicator.textContent='D/ST recovering MSF team Week '+failed.week+'…';
    await auditPause(2400);
    try{
     const response=await auditedStatRequest('teamgamelogs',{season:s.season,week:failed.week,team});
     const verified=model.auditTeamGameFeed(response.data||{},team,s.ownedRules);
     if(verified.teamFilterVerified){
      const at=report.teamWeeks.findIndex(x=>x.week===failed.week);
      if(at>=0)report.teamWeeks[at]={week:failed.week,evidence:verified,recovered:true};
      if(failed.week===1){report.teamEvidence=verified;report.teamEvidenceError=null}
     }
    }catch{/* Missing D/ST stats stay unknown. */}
    renderStatAudit(report);
   }
   // Verify historical FG/XP events against one team-specific game per week.
   // Never use a season-wide actor identity to prove a historical weekly roster.
   const candidates=s.archiveGames.map(g=>({g,week:auditWeekForGame(g).week}))
    .filter(x=>x.week>=1&&x.week<=6&&
     [stadium.abbrev(x.g.home),stadium.abbrev(x.g.away)].includes(team));
   for(let week=1;week<=6;week++){
    const matches=candidates.filter(x=>x.week===week);
    if(matches.length!==1){
     report.kickWeeks.push({week,error:matches.length?'Multiple matching schedule games; attribution withheld':'No scheduled MSF team game located'});
     report.dstPlayWeeks.push({week,error:'Unique MSF game unavailable'});
     report.playerEventWeeks.push({week,error:'Unique MSF game unavailable'});
     continue;
    }
    const g=matches[0].g,game=g.away+' @ '+g.home;
    if(indicator)indicator.textContent='MSF kicker play evidence · '+team+' Week '+week+' of 6…';
    const weekly=goodWeeks.find(x=>x.week===week);
    // A historical MSF player row may supply the verified full name, jersey,
    // provider ID, team and position needed to safely resolve PBP initials.
    const players=weekly?model.playerRows(weekly.payload):[];
    if(week>1)await auditPause(1250);
    try{
     const response=await auditedStatRequest('plays',{season:s.season,game_id:g.id},
      msg=>{if(indicator)indicator.textContent='Kicker W'+week+' · '+msg});
     const evidence=model.kickingPlayEvidence(response.data||{},s.ownedRules,players);
     report.kickWeeks.push({week,game,gameId:String(g.id),evidence});
     report.dstPlayWeeks.push({week,game,evidence:model.dstPlayEvidence(response.data||{})});
     report.playerEventWeeks.push({week,game,evidence:model.playerScoringPlayCandidates(response.data||{},players,team,s.ownedRules)});
     if(!report.kickEvidence){report.kickEvidence=evidence;
      report.kickEvidence.sampleWeek=week;report.kickEvidence.sampleGame=game;}
    }catch(error){report.kickWeeks.push({week,game,error:String(error.message||error).slice(0,155)});
     report.dstPlayWeeks.push({week,game,error:'MSF historical play request failed'});
     report.playerEventWeeks.push({week,game,error:'MSF historical play request failed'})}
    renderStatAudit(report);
   }
   // User-triggered audit only; does not change GameCast live polling.
   // The box score provides final scoreboard context, not awardable D/ST PA.
   for(let week=1;week<=6;week++){
    const matches=candidates.filter(x=>x.week===week);
    if(matches.length!==1){
     report.dstBoxWeeks.push({week,error:matches.length?'Ambiguous MSF game':'No matching MSF schedule game'});
     continue;
    }
    const g=matches[0].g,game=g.away+' @ '+g.home;
    if(indicator)indicator.textContent='D/ST final box cross-check · Week '+week+' of 6…';
    try{
     const response=await auditedStatRequest('boxscore',{season:s.season,game_id:g.id},
      msg=>{if(indicator)indicator.textContent='D/ST box W'+week+' · '+msg});
     const schedule={id:g.id,home:stadium.abbrev(g.home),away:stadium.abbrev(g.away),
      homePoints:g.homePoints,awayPoints:g.awayPoints,status:g.status};
     report.dstBoxWeeks.push({week,game,
      evidence:model.dstScoreboardEvidence(response,schedule,team,s.ownedRules),
      scoringPlays:model.dstScoringPlayLedger(response,schedule,team)});
    }catch(error){report.dstBoxWeeks.push({week,game,error:String(error.message||error).slice(0,150)})}
    renderStatAudit(report);
    if(week<6)await auditPause(1100);
   }
   // Cross-reference PBP actors to independent player game logs by MSF
   // GAME ID and PLAYER ID, never name or Sleeper fantasy scoring.
   for(const row of report.playerEventWeeks){
    if(!row.evidence)continue;
    const match=candidates.find(x=>x.week===row.week&&
     x.g.away+' @ '+x.g.home===row.game);
    const weekly=goodWeeks.find(x=>x.week===row.week);
    const box=report.dstBoxWeeks.find(x=>x.week===row.week);
    if(!match)continue;
    row.sameGameReconciliation=sameGame.correlateWeeklyPlayerEvents({
     gameId:match.g.id,teamAbbreviation:team,
     players:weekly?model.playerRows(weekly.payload):[],
     evidence:row.evidence,boxEvidence:box?.evidence||null,
     scoringSummary:box?.scoringPlays||null,rules:s.ownedRules
    });
    row.eventScenarios=eventScenarios.eventScoreScenarios({
     ledger:row.sameGameReconciliation.ledger,
     corroboration:row.sameGameReconciliation.twoPointCorroboration,
     rules:s.ownedRules
    });
   }
   if(!report.kickEvidence)
    report.kickEvidenceError='No team-specific historical MSF kick plays verified';
   if(goodWeeks.length)report.scoringEvidence=model.scoringEvidence(goodWeeks,s.ownedRules,team);
   if(report.seasonFilterVerified&&goodWeeks.length)
    report.lowerBound=model.auditSeasonLowerBound(goodWeeks.map(x=>x.payload),seasonPayload);
   renderStatAudit(report);
   const valid=report.weeks.filter(r=>r.audit?.supported&&r.teamFilterVerified).length;
   if(indicator)indicator.textContent=team+' · '+valid+'/6 weeks parsed · '+
    (report.seasonFilterVerified?'season feed verified':'season totals not verified')+
    '. Missing stats are unknown, not zero. No final FFL score certified.';
  }catch(error){
   if(indicator)indicator.textContent='Audit interrupted · '+String(error.message||error).slice(0,140);
  }finally{button.disabled=false;statAuditRunning=false}
 }

 function auditWeekForGame(g){
  if(Number.isInteger(g.week))return {week:g.week,method:'provider'};
  // Calendar fallback used only to LOCATE a test game; not a claim of
  // provider-verified week labels or historical completeness.
  const kickoff=Date.parse(g.start||''),regularStart=Date.parse('2026-09-10T00:00:00Z');
  if(!Number.isFinite(kickoff)||kickoff<regularStart)return {week:null,method:'unknown'};
  const week=Math.floor((kickoff-regularStart)/604800000)+1;
  return {week:week>=1&&week<=18?week:null,method:'calendar_estimate'};
 }
 async function ensurePortraits(gameId){
  const g=s.games.find(x=>x.id===gameId)||s.archiveGames.find(x=>x.id===gameId);
  if(!g)return;
  const teams=[...new Set([stadium.abbrev(g.home),stadium.abbrev(g.away)])].filter(Boolean);
  const responses=await Promise.allSettled(teams.map(team=>feed('portraits',{team})));
  if(s.game!==gameId)return;
  s.portraitRows=responses.flatMap(r=>r.status==='fulfilled'&&Array.isArray(r.value.players)?r.value.players:[]);
  if(responses.some(r=>r.status==='rejected'))
    s.photoWarning='Portrait directory partly unavailable; initials shown for unverified identities.';
  else s.photoWarning='';
  drawField();drawPlays();
 }
 function renderHistoryAudit(){
  const el=$('ffo-gc-history-results');if(!el)return;
  // Compact summary first. Audit diagnostics stay available without occupying
  // the whole mobile viewport unless Coach opens a specific game.
  el.innerHTML=s.historyResults.map(r=>{
   const a=r.integrity||null,d=a?.diagnostics||r.diagnostics||null;
   const home=a?.boxHome,away=a?.boxAway;
   const score=a?.boxScorePublished?away+'–'+home:'Score unavailable';
   const clock=d?d.withClock+'/'+d.displayedCount+' clocks':'Clock coverage unknown';
   const available=!!(a?.usablePlaySequence&&a.clockCoverage!=='incomplete');
   const exception=a?.clockCoverage==='ot_exception';
   const tier=available?'PBP available'+(exception?' · OT clock exception':''):r.reason||'Not verified';
   const notes=a?.warnings?.length?a.warnings.join(' · '):'No flagged fields in limited audit';
   const counts=d?'Published plays '+d.describedCount+
    ' · native IDs '+d.providerIdCount+' · ID gaps '+d.missingProviderIds+
    ' · repeated native IDs '+d.repeatedProviderIds+
    ' · collisions '+d.duplicateResolvedIds+
    ' · '+clock+' · Q'+(d.quarters.join(', Q')||'unknown')+
    (d.capped?' · 360-play viewing cap':''):'No published play diagnostics';
   const box=a?(a.boxScorePublished?'MSF box score '+score+
       ' · '+(a.providerFinal?'FINAL':'Final unconfirmed'):'MSF box score unavailable'):'Box score unchecked';
   const order=a?'Source chronology '+a.chronologicalOrder+
     (a.matchesSchedule===true?' · final scores match':
      a.matchesSchedule===false?' · score mismatch':' · score comparison unavailable')+
     (a.quarterScoreMatches===true?' · period totals reconcile':
      a.quarterScoreMatches===false?' · period totals mismatch':'')+
     (a.otPlayCount?' · '+a.otPlayCount+' OT plays':''):'Chronology unchecked';
   return '<details class="gc-history-row" style="border-bottom:1px solid #315069;padding:8px 0"'+
     (available?'':' open')+'><summary style="cursor:pointer;display:flex;flex-wrap:wrap;gap:5px;align-items:center;justify-content:space-between">'+
     '<strong>W'+r.week+' · '+safe(r.game||'Game unavailable')+'</strong>'+
     '<span style="font-size:11px;opacity:.9">'+safe(d?d.describedCount+' plays · '+score:'No PBP')+'</span>'+
     '<span style="font-size:11px;width:100%;opacity:.85">'+safe(tier)+'</span></summary>'+
     '<div style="font-size:12px;margin:7px 0;line-height:1.45">'+
     '<div>'+safe(counts)+'</div><div class="muted">'+safe(box)+'</div>'+
     '<div class="muted">'+safe(order)+'</div>'+
     '<div class="muted">'+safe(notes)+'</div>'+
     (r.method==='calendar_estimate'?'<div class="muted">Week inferred from kickoff date</div>':'')+
     '<div class="muted">This sample alone does not certify every play or independent fantasy totals.</div>'+
     (r.gameId?'<button type="button" class="button" style="padding:5px 8px;margin-top:5px" data-ffo-history-game="'+safe(r.gameId)+'">Inspect actual plays</button>':'')+
     '</div></details>';
  }).join('');
  el.querySelectorAll('[data-ffo-history-game]').forEach(button=>button.addEventListener('click',async()=>{
   const id=button.dataset.ffoHistoryGame,g=s.archiveGames.find(x=>x.id===id);
   if(!g||!s.enabled)return;
   if(!s.games.some(x=>x.id===id))s.games.push(g);
   await selectGame(id);
  }));
 }

 async function runHistoricalAudit(){
  const button=$('ffo-gc-history-check'),indicator=$('ffo-gc-history-status');
  if(button?.disabled||!s.enabled){if(indicator)indicator.textContent='Authenticate the private MSF gateway before auditing.';return;}
  button.disabled=true;s.historyResults=[];
  const all=s.archiveGames;
  try{
   for(let week=1;week<=6;week++){
    if(indicator)indicator.textContent='MSF Week '+week+' of 6 · checking real PBP and final box score…';
    const candidates=all.map(g=>({g,tag:auditWeekForGame(g)})).filter(x=>x.tag.week===week)
      .sort((a,b)=>Date.parse(a.g.start||'')-Date.parse(b.g.start||''));
    const choice=candidates[0];
    if(!choice){
     s.historyResults.push({week,ok:false,reason:'No MSF schedule-matched game returned',method:'unknown'});
     renderHistoryAudit();continue;
    }
    const g=choice.g,short=g.away+' @ '+g.home;
    const [pb,bs]=await Promise.allSettled([
     feed('plays',{season:s.season,game_id:g.id},true),
     feed('boxscore',{season:s.season,game_id:g.id},true)
    ]);
    if(pb.status==='rejected'||pb.value?.available===false){
     const reason=pb.status==='rejected'?String(pb.reason?.message||pb.reason):String(pb.value?.reason||'MSF plays unavailable');
     s.historyResults.push({week,game:short,gameId:g.id,method:choice.tag.method,ok:false,
      reason:'MSF PBP request failed: '+reason.slice(0,100)});
     renderHistoryAudit();continue;
    }
    try{
     const response=pb.value;
     const box=bs.status==='fulfilled'&&!bs.value?.notModified&&bs.value?.available!==false?bs.value:null;
     const a=model.inspectHistoricalGame(response,box,g);
     const ok=a.usablePlaySequence&&a.clockCoverage!=='incomplete';
     if(bs.status==='rejected')a.warnings.push('MSF box score request failed: '+String(bs.reason?.message||bs.reason).slice(0,65));
     const reason=a.diagnostics.scoringOnly?'Only MSF scoring-play fallback':
       !a.diagnostics.describedCount?'No published plays recognized':
       a.chronologicalOrder==='mixed'?'Chronology inconsistent':
       a.clockCoverage==='incomplete'?'Incomplete clock evidence':
       a.diagnostics.duplicateResolvedIds?'Unresolved play identities':
       'Published MSF PBP observed';
     s.historyResults.push({week,game:short,gameId:g.id,method:choice.tag.method,
      ok,reason,integrity:a});
    }catch(error){
     s.historyResults.push({week,game:short,gameId:g.id,method:choice.tag.method,ok:false,
      reason:'Integrity evaluation failed: '+String(error.message||error).slice(0,90)});
    }
    renderHistoryAudit();
   }
   const available=s.historyResults.filter(r=>r.ok).length;
   const boxes=s.historyResults.filter(r=>r.integrity?.boxScorePublished).length;
   const matching=s.historyResults.filter(r=>r.integrity?.matchesSchedule===true).length;
   const exceptions=s.historyResults.filter(r=>r.integrity?.clockCoverage==='ot_exception').length;
   const total=s.historyResults.reduce((n,r)=>n+(r.integrity?.diagnostics?.describedCount||0),0);
   if(indicator)indicator.textContent=available+'/6 MSF PBP samples available · '+total+' published plays · '+boxes+
    '/6 final box scores · '+matching+'/6 matching schedule scores'+
    (exceptions?' · '+exceptions+' overtime clock exception'+(exceptions===1?'':'s'):'')+
    '. Full-play completeness and fantasy scoring are separate verification milestones.';
  }finally{button.disabled=false;}
 }

 async function selectGame(id){
  if(!s.enabled)return;
  const targetId=String(id),target=s.games.find(g=>g.id===targetId)||s.archiveGames.find(g=>g.id===targetId);
  if(!target)return;
  const sourceWeek=weekNav.gameWeek(target,Number(s.season.slice(0,4))).week;
  if(sourceWeek&&sourceWeek!==s.selectedWeek)s.selectedWeek=sourceWeek;
  if(gamePending)await gamePending;
  s.game=targetId;s.followLatest=true;s.visiblePlays=60;s.playCache=[];s.portraitRows=[];s.playSource=null;s.activePlay=-1;s.liveBox=null;lastPlayCount=0;lastNewPlayAt=0;lastProviderUpdateAt=0;consecutivePlayFailures=0;s.lastGamePoll=0;s.lastBoxPoll=0;finalObservedAt=0;lastStadiumPlayId=null;lastStadiumGameId=null;priorVerifiedBallX=null;drawGames();drawPlays();void ensurePortraits(s.game);await refreshGame()}
 async function refreshGame(){if(!s.enabled||!s.game||gamePending)return gamePending;
  gamePending=(async()=>{
  const selectedGameId=s.game,selected=s.games.find(g=>g.id===selectedGameId);
  const kickoff=Date.parse(selected?.start||'');
  if(Number.isFinite(kickoff)&&Date.now()<kickoff-5*60000){
    s.playCache=[];s.liveBox=null;s.playSource='Scheduled · awaiting kickoff';
    status('Game is scheduled · live plays and box scores are not expected before kickoff. MySportsFeeds authenticated. · '+new Date().toISOString());
    drawPlays();drawPlayer();return;
  }
  try{
    const boxDue=!s.liveBox||!s.lastBoxPoll||Date.now()-s.lastBoxPoll>=LIVE_BOX_MS;
    if(boxDue)s.lastBoxPoll=Date.now();
    const [pb,bs]=await Promise.allSettled([
      feed('plays',{season:s.season,game_id:selectedGameId}),
      boxDue?feed('boxscore',{season:s.season,game_id:selectedGameId}):Promise.resolve(null)
    ]);
    if(s.game!==selectedGameId)return;
    if(pb.status==='fulfilled'&&!pb.value.notModified){
      consecutivePlayFailures=0;
      const ps=model.plays(pb.value.data);
      s.playCache=model.mergePlayTimeline(s.playCache,ps);
      if(lastPlayCount>0&&s.playCache.length>lastPlayCount)lastNewPlayAt=Date.now();
      lastPlayCount=s.playCache.length;
      lastSuccessfulGamePollAt=Date.now();
      s.playSource=pb.value.coverage==='scoring_only'?'MySportsFeeds · scoring plays only for this specific game':'MySportsFeeds · published play-by-play';
      if(s.followLatest||s.activePlay<0)s.activePlay=Math.max(0,s.playCache.length-1);
      else s.activePlay=Math.min(s.activePlay,Math.max(0,s.playCache.length-1));
      s.latestCheck=pb.value.checked_at;
      if(pb.value.provider_updated_at&&Number.isFinite(Date.parse(pb.value.provider_updated_at)))lastProviderUpdateAt=Date.parse(pb.value.provider_updated_at);
    }
    if(pb.status==='fulfilled'&&pb.value.notModified){
      consecutivePlayFailures=0;lastSuccessfulGamePollAt=Date.now();
    }
    if(pb.status==='rejected')consecutivePlayFailures=Math.min(3,consecutivePlayFailures+1);
    if(bs.status==='fulfilled'&&bs.value&&!bs.value.notModified){
      s.liveBox=bs.value;s.latestCheck=bs.value.checked_at;
      if(bs.value.provider_updated_at&&Number.isFinite(Date.parse(bs.value.provider_updated_at)))lastProviderUpdateAt=Math.max(lastProviderUpdateAt,Date.parse(bs.value.provider_updated_at));
      const idx=s.games.findIndex(g=>g.id===s.game);
      if(idx>=0){
       const previous=s.games[idx],enriched=model.gameScoreUpdate(previous,bs.value);
       if(enriched.scoreSource==='MySportsFeeds game boxscore'){
        enriched.scoreProviderUpdatedAt=bs.value.provider_updated_at||null;
        enriched.scoreCheckedAt=bs.value.checked_at||new Date().toISOString();
       }
       s.games[idx]=enriched;
       if(model.gamePhase(enriched.status)==='final'&&!finalObservedAt)finalObservedAt=Date.now();
       if(enriched.scoreSource)lastScorePollAt=Date.now();
       drawGames();
      }
    }
    // Some licensed play-by-play records also include explicit verified score totals.
    // Do not infer a score from scoring-play descriptions.
    if(pb.status==='fulfilled'&&s.playCache.length){
      const last=s.playCache[s.playCache.length-1];
      const idx=s.games.findIndex(g=>g.id===s.game);
      const st=last?.raw?.playStatus||{};
      if(idx>=0&&(st.homeScoreTotal!=null||st.awayScoreTotal!=null)){
       const scored=model.gameScoreUpdate(s.games[idx],{gameboxscore:{scoring:st}});
       if(scored.scoreSource){s.games[idx]=scored;drawGames()}
      }
    }
    // MySportsFeeds-only live evaluation: never substitute ESPN play timelines.
    // An unauthorized MSF play feed is shown as a genuine entitlement gap.
    const supplemental=pb.status==='fulfilled'&&pb.value.coverage==='scoring_only'
      ?' · MySportsFeeds scoring plays only: full PBP entitlement not confirmed'
      :'';
    const errs=[pb,bs].filter(x=>x.status==='rejected').map(x=>String(x.reason.message||x.reason));
    const age=lastNewPlayAt?Math.round((Date.now()-lastNewPlayAt)/1000):null;
    const current=s.games.find(g=>g.id===s.game);
     if(model.gamePhase(current?.status)==='final'&&!finalObservedAt)finalObservedAt=Date.now();
     const scoreCoverage=current?.homePoints!=null&&current?.awayPoints!=null?'MSF score reported':'MSF score unavailable';
    const publishLag=lastProviderUpdateAt?Math.max(0,Math.floor((Date.now()-lastProviderUpdateAt)/1000)):null;
    status((model.gamePhase(current?.status)==='final'?'FINAL · ':'')+(s.playSource||'Source unavailable')+' · '+scoreCoverage+
      (errs.length?' · '+errs.join('; '):pb.status==='fulfilled'&&pb.value.notModified?' · MSF unchanged':' · MSF poll complete')+
      (age!==null?' · last NEW published play '+age+'s ago':' · no new published play observed')+
      (publishLag!==null?' · provider updated '+publishLag+'s ago':' · provider update time unavailable')+
      supplemental+' · checked '+(s.latestCheck||'unknown')+' · feed delay not certified');
    drawPlays();drawPlayer();
  }catch(error){status('Game feed error: '+error.message)}})();
  try{return await gamePending}finally{gamePending=null}
 }
 // One authenticated MSF weekly-games request updates every game's score.
 async function refreshWeekboard(){
  if(!s.enabled||!s.archiveGames.length||!s.selectedWeek)return;
  if(weekboardPending)return weekboardPending;
  const requestedWeek=s.selectedWeek;lastWeekboardPoll=Date.now();
  weekboardPending=(async()=>{
   try{
    const res=await feed('weekboard',{season:s.season,week:requestedWeek},true);
    if(s.selectedWeek!==requestedWeek)return;
    if(res.notModified){lastWeekboardSuccess=Date.now();weekboardError='';weekboardFailures=0;drawGames();return}
    if(!Array.isArray(res.data?.games))throw Error('MSF weekly scoreboard schema not verified');
    const seen=new Set();let changed=0;
    for(const raw of res.data.games){
     const update=friendlyGame(raw),index=s.games.findIndex(g=>g.id===update.id);
     if(index<0||seen.has(update.id))continue;
     seen.add(update.id);
     const verified=weekNav.mergeVerifiedWeekScore(s.games[index],update,{
      providerUpdatedAt:res.provider_updated_at||null,checkedAt:res.checked_at||new Date().toISOString()});
     if(!verified.accepted)continue;
     s.games[index]=verified.game;changed++;
    }
    weekboardGameCount=seen.size;lastWeekboardSuccess=Date.now();
    weekboardProviderUpdatedAt=res.provider_updated_at||null;
    weekboardError='';weekboardFailures=0;drawGames();
    if(s.game&&changed)drawField();
   }catch(error){
    if(s.selectedWeek!==requestedWeek)return;
    weekboardFailures=Math.min(4,weekboardFailures+1);
    weekboardError=String(error.message||error).slice(0,100);drawGames();
   }
  })();
  try{return await weekboardPending}finally{weekboardPending=null}
 }
 // Rotate other LIVE game PBP requests at a slower per-game pace.
 async function refreshOneBackgroundPlay(){
  if(!s.enabled||backgroundPlayPending||!s.games.length)return;
  const week=s.selectedWeek;
  const candidates=weekNav.backgroundPlayCandidates(
   s.games,s.game,backgroundPlayCheckedAt,Date.now(),BACKGROUND_PLAY_MIN_MS);
  const target=candidates[0];if(!target)return;
  backgroundPlayCheckedAt[target.id]=Date.now();lastBackgroundDispatch=Date.now();
  backgroundPlayPending=(async()=>{
   try{
    const res=await feed('plays',{season:s.season,game_id:target.id},true);
    if(s.selectedWeek!==week)return;
    const published=model.plays(res.data);
    const last=published.length?published[published.length-1]:null;
    backgroundPlayEvidence.set(target.id,{checkedAt:Date.now(),count:published.length,
     message:'Other-game MSF PBP: '+published.length+' plays checked'+
      (res.coverage==='scoring_only'?' · scoring only':'')+
      (last?.period?' · latest Q'+last.period:'')});
   }catch(error){
    if(s.selectedWeek!==week)return;
    backgroundPlayEvidence.set(target.id,{checkedAt:Date.now(),count:null,
     message:'Other-game PBP unavailable · '+String(error.message||error).slice(0,60)});
   }finally{if(s.selectedWeek===week)drawGames()}
  })();
  try{return await backgroundPlayPending}finally{backgroundPlayPending=null}
 }
 async function refreshOverview(force=false){
  if(overviewPending)return overviewPending;
  overviewPending=(async()=>{try{
    const health=await feed('health',{},force);s.enabled=!!health.ready;
    if(!s.enabled){status('GameCast staging: configure encrypted MSF_API_KEY and enable Worker flag. No live data yet.');drawSignals();return}
    const sched=await feed('schedule',{season:s.season},force);
    const src=sched.data?.games||sched.data?.gameSchedule||sched.data?.schedule?.games||[];
    const allGames=Array.isArray(src)?src.map(friendlyGame).filter(x=>x.id):[];
    s.archiveGames=allGames;
    // Authenticated complete season schedule; week selection is not a rolling
    // calendar viewport that silently drops Sunday games.
    s.latestCheck=sched.checked_at;
    if(!Number.isInteger(s.selectedWeek)||s.selectedWeek<1||s.selectedWeek>18)
     s.selectedWeek=weekNav.currentCalendarWeek(new Date(),Number(s.season.slice(0,4)))||Number(window.dbNflWeek)||1;
    status('MySportsFeeds full-season schedule · '+s.latestCheck+' · scores from MSF, latency not certified.');
    drawGames();scoringResearch?.render();drawPlayer();if(sectionActive('radar')||sectionActive('market'))refreshEvidencePanels();
    if(s.game&&!s.games.some(x=>x.id===s.game)){
     s.game=null;s.playCache=[];s.liveBox=null;s.playSource=null;s.activePlay=-1;drawPlays();
    }
    // Open the FIRST provider-reported live contest only when the coach
    // has not selected a different game. Never auto-start a past/future feed.
    if(!s.game&&gameActive()){
     const live=s.games.find(x=>['live','overtime'].includes(model.gamePhase(x.status)));
     if(live)void selectGame(live.id);
    }else if(s.game)drawField();
  }catch(error){s.enabled=false;status('GameCast not connected: '+String(error.message||error));drawGames();drawPlayer()}})();
  try{return await overviewPending}finally{overviewPending=null}
 }
 function clearPlayer(){
    s.player=null;s.playerId=null;s.msfPlayer=null;s.playerMatch='';s.allWeeks.clear();
    const embed=$('ffo-gc-profile-embed');if(embed)embed.remove();
    drawPlayer();drawPlays();
  }
  function setPlayer(id){try{s.playerId=String(id);s.player=pfo49Info(id);const host=$('pfo49-profile');if(host&&!$('ffo-gc-profile-embed')){const child=document.createElement('div');child.id='ffo-gc-profile-embed';child.className='ffo-gc-evidence';host.prepend(child)}s.msfPlayer=null;s.playerMatch='';findPlayer();drawPlayer();if(s.enabled)refreshPlayer(false);
   const g=s.games.find(x=>x.home===s.player.team||x.away===s.player.team);if(g&&s.game!==g.id)selectGame(g.id);
  }catch(error){status('Player integration unavailable: '+error.message)}
 }
 // Non-destructive hook: every existing player link still opens the full original PFO profile.
 if(typeof pfo49Open==='function'){
  const prevOpen=pfo49Open;pfo49Open=function(id){prevOpen(id);setPlayer(id)};
 }
 if(typeof pfo49RenderPlayer==='function'){
  const prevRender=pfo49RenderPlayer;pfo49RenderPlayer=function(...args){const out=prevRender(...args);const host=$('pfo49-profile');if(host&&s.player){let child=$('ffo-gc-profile-embed');if(!child){child=document.createElement('div');child.id='ffo-gc-profile-embed';child.className='ffo-gc-evidence';host.prepend(child)}drawPlayer()}return out};
 }
 function setWeek(week){
  const n=Number(week);
  if(!Number.isInteger(n)||n<1||n>18||n===s.selectedWeek)return;
  s.selectedWeek=n;s.game=null;s.playCache=[];s.liveBox=null;s.playSource=null;
  s.activePlay=-1;s.lastGamePoll=0;s.lastBoxPoll=0;lastWeekboardPoll=0;
  lastWeekboardSuccess=0;weekboardGameCount=0;weekboardError='';
  lastStadiumGameId=null;
  drawGames();drawPlays();
  if(gameActive()&&s.enabled)void refreshWeekboard();
 }
 $('ffo-gc-week')?.addEventListener('change',e=>setWeek(e.currentTarget.value));
 $('ffo-gc-week-today')?.addEventListener('click',()=>{
  const current=weekNav.currentCalendarWeek(new Date(),Number(s.season.slice(0,4)));
  if(current)setWeek(current);
 });
 document.querySelectorAll('#ffo-gc-filters [data-ffo-filter]').forEach(b=>b.addEventListener('click',()=>{s.playFilter=b.dataset.ffoFilter;document.querySelectorAll('#ffo-gc-filters [data-ffo-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));drawPlays()}));
 $('ffo-gc-refresh')?.addEventListener('click',async()=>{
  if(s.enabled){
   lastWeekboardPoll=0;
   await Promise.allSettled([
    refreshWeekboard(),
    s.game?(s.lastGamePoll=Date.now(),s.lastBoxPoll=0,refreshGame()):refreshOverview(true)
   ]);
  }else await refreshOverview(true);
  if(s.player)await refreshPlayer(false);
 });
 document.querySelector('nav button[data-page="gamecast"]')?.addEventListener('click',()=>{
  drawGames();drawPlayer();drawPlays();
  refreshOverview().then(()=>refreshWeekboard()).catch(()=>{});
 });
 $('ffo-gc-history-check')?.addEventListener('click',()=>void runHistoricalAudit());
  const teamSelect=$('ffo-gc-stat-audit-team');
  if(teamSelect){
   const names=['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WSH'];
   teamSelect.innerHTML=names.map(n=>'<option value="'+n+'"'+(n==='GB'?' selected':'')+'>'+n+'</option>').join('');
  }
  $('ffo-gc-stat-audit-check')?.addEventListener('click',()=>void runStatAudit());
  void loadFfoRules().then(()=>{drawPlayer()}).catch(err=>{s.rulesError=String(err.message||err);drawPlayer();status('FFO scoring rules unavailable: '+s.rulesError)});
 scoringResearch=researchController.installScoringResearch({
  getSchedule:()=>s.archiveGames,feed,model,season:s.season,root:document
 });
 window.ffoVerifiedScoringResearch=scoringResearch;
 drawSignals();drawGames();scoringResearch.render();drawPlayer();drawPlays();drawField();
 if(gameActive()){
  await refreshOverview();
  void refreshWeekboard();
 }
 if(typeof pfo49Selected!=='undefined'&&pfo49Selected&&sectionActive('playerhub'))setPlayer(pfo49Selected);
 function activeRefreshMs(){
    const game=s.games.find(g=>g.id===s.game);
    return model.gamePollInterval({status:game?.status,finalObservedAt,now:Date.now(),
      kickoff:game?.start,failures:consecutivePlayFailures});
 }
 setInterval(()=>{
   const ticker=document.querySelector('[data-gc6-refresh]');
   if(ticker&&gameActive()&&s.enabled&&s.game&&['live','overtime'].includes(model.gamePhase(s.games.find(g=>g.id===s.game)?.status))){
    const interval=activeRefreshMs(),last=s.lastGamePoll||0;
    const seconds=Math.max(0,Math.ceil((interval-Math.max(0,Date.now()-last))/1000));
    ticker.textContent=interval===LIVE_PLAY_MS?seconds+'s':seconds+'s';
    ticker.parentElement?.classList.toggle('gc6-refresh-wait',interval>LIVE_PLAY_MS);
   }
   if(document.visibilityState!=='visible'||!gameActive()||!s.enabled)return;
   const now=Date.now();
   const scoreInterval=SCOREBOARD_MS*Math.min(8,2**weekboardFailures);
   if(!weekboardPending&&now-lastWeekboardPoll>=scoreInterval)void refreshWeekboard();
   if(!backgroundPlayPending&&now-lastBackgroundDispatch>=SCOREBOARD_MS){
    const candidate=weekNav.backgroundPlayCandidates(
     s.games,s.game,backgroundPlayCheckedAt,now,BACKGROUND_PLAY_MIN_MS)[0];
    if(candidate)void refreshOneBackgroundPlay();
   }
   if(!s.game||gamePending)return;
   const interval=activeRefreshMs();
   if(now-(s.lastGamePoll||0)>=interval){s.lastGamePoll=now;void refreshGame();}
 },500);
 document.addEventListener('visibilitychange',()=>{
   if(document.visibilityState==='visible'&&gameActive()&&s.enabled){
    lastWeekboardPoll=0;void refreshWeekboard();
    if(s.game){s.lastGamePoll=Date.now();void refreshGame()}
   }
 });
 setInterval(()=>{if(document.visibilityState==='visible'&&gameActive()&&s.enabled)refreshOverview()},60000);
 window.ffoGameCast={selectPlayer:setPlayer,clearPlayer,refresh:refreshOverview,refreshWeekboard,setWeek,getStatus:()=>({enabled:s.enabled,season:s.season,game:s.game,player:s.player?.name||null,latestCheck:s.latestCheck,playCount:s.playCache.length,playSource:s.playSource||null,selectedWeek:s.selectedWeek,visibleGames:s.games.length,
  scheduledToday:s.coverage?.uniqueMatchups??null,expectedToday:s.coverage?.expectedGames??null,
  missingToday:s.coverage?.missing||[],dailySlateVerified:s.coverage?.slateVerified===true,
  lastSuccessfulGamePollAt:lastSuccessfulGamePollAt?new Date(lastSuccessfulGamePollAt).toISOString():null,
  lastNewPlayAt:lastNewPlayAt?new Date(lastNewPlayAt).toISOString():null,
  providerUpdatedAt:lastProviderUpdateAt?new Date(lastProviderUpdateAt).toISOString():null,
  scoreUpdateAt:lastScorePollAt?new Date(lastScorePollAt).toISOString():null,
  homeScore:s.games.find(g=>g.id===s.game)?.homePoints??null,
  awayScore:s.games.find(g=>g.id===s.game)?.awayPoints??null,
  gameFeedError:s.lastError||null,gamePhase:model.gamePhase(s.games.find(g=>g.id===s.game)?.status),finalObservedAt:finalObservedAt?new Date(finalObservedAt).toISOString():null,pollIntervalMs:activeRefreshMs(),boxPollIntervalMs:LIVE_BOX_MS,
  scoreboardPollIntervalMs:SCOREBOARD_MS,lastWeekboardPollAt:lastWeekboardPoll?new Date(lastWeekboardPoll).toISOString():null,
  lastScoreboardSuccessAt:lastWeekboardSuccess?new Date(lastWeekboardSuccess).toISOString():null,
  weeklyScoreboardError:weekboardError||null,weeklyBoardGameCount:weekboardGameCount,
  backgroundGamePbpCount:backgroundPlayEvidence.size,
  consecutivePlayFailures,ffoRulesLoaded:!!s.ownedRules,ffoRulesVersion:s.rulesVersion,projection:projection()})};
})();