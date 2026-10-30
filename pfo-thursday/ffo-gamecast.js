/* FFO GameCast v0.4: browser-facing staged intelligence inside existing PFO.
   Does NOT store API secrets and NEVER claims unconfirmed data as live. */
(async function(){
 'use strict';
 const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const model=await import('/ffo-gamecast-model.mjs');
 const stadium=await import('/ffo-gamecast-stadium.mjs');
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

 const s={status:'Gateway not checked',enabled:false,season:(()=>{const n=Number(window.dbNflSeason||2026);return n+'-regular'})(),games:[],archiveGames:[],portraitRows:[],historyResults:[],game:null,player:null,playerId:null,msfPlayer:null,playerMatch:'',playerRows:[],weekRows:[],allWeeks:new Map(),playCache:[],lastMeta:null,liveBox:null,injuries:null,latestCheck:'',lastError:'',msfFantasy:null,ownedRules:null,rulesVersion:null,rulesError:null,playFilter:'all',activePlay:-1,followLatest:true,sourceErrors:[],lastGamesCheck:null};
 const route='/api/ffo/gamecast/';
 function status(msg){s.status=msg;if($('ffo-gc-status'))$('ffo-gc-status').textContent=msg;}
 const feedCache=new Map(),feedPending=new Map();
 let playerFeedPending=null,gamePending=null,overviewPending=null,historyAuditStarted=false;
 let lastStadiumPlayId=null,lastStadiumGameId=null,priorVerifiedBallX=null;
 let lastSuccessfulGamePollAt=0,lastNewPlayAt=0,lastPlayCount=0,lastScorePollAt=0,lastProviderUpdateAt=0,finalObservedAt=0;
 const LIVE_PLAY_MS=5000,LIVE_BOX_MS=20000,IDLE_PLAY_MS=120000;
 let consecutivePlayFailures=0;
 const sectionActive=id=>!!document.querySelector('nav button[data-page="'+id+'"].active');
 const gameActive=()=>sectionActive('gamecast');
 function cacheTtl(name){
   if(name==='health')return 60000;
    if(name==='portraits')return 3600000;
   if(name==='schedule')return 180000;
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
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),name==='plays'||name==='boxscore'?9000:12500);
   try{
    const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:controller.signal,headers:{accept:'application/json'}});
    let body;try{body=await response.json()}catch{throw Error('Invalid gateway response')}
    if(!response.ok){const err=Error(body.error||'HTTP '+response.status);err.status=response.status;throw err;}
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
 function drawGames(){const el=$('ffo-gc-games');if(!el)return;
  if(!s.games.length){el.innerHTML='<p class="ffo-gc-note">No games loaded from MySportsFeeds yet. NFL season and schedule feeds must be authenticated first.</p>';return}
  el.innerHTML=s.games.map(g=>`<button class="ffo-gc-game ${s.game===g.id?'active':''}" type="button" data-ffo-game="${safe(g.id)}"><small>${safe(g.status)}</small><strong>${safe(g.away)} ${g.awayPoints??'—'} · ${g.homePoints??'—'} ${safe(g.home)}</strong><small>${g.start?safe(g.start):'Start time not verified'}</small></button>`).join('');
  el.querySelectorAll('button[data-ffo-game]').forEach(b=>b.onclick=()=>selectGame(b.dataset.ffoGame));
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
  if(!s.player||!s.enabled)return;
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
  el.innerHTML=s.historyResults.map(r=>{
   const d=r.integrity?.diagnostics||r.diagnostics||null,a=r.integrity||null;
   const counts=d?'MSF published plays '+d.describedCount+' · native IDs '+d.providerIdCount+
     ' · ID gaps '+d.missingProviderIds+' · repeated native IDs '+d.repeatedProviderIds+
     ' · unresolved collisions '+d.duplicateResolvedIds+
     ' · clocks '+d.withClock+'/'+d.displayedCount+
     ' · quarters '+(d.quarters.join(', ')||'unknown')+(d.capped?' · 360-play display cap':''):'No parsed MSF play records';
   const box=a?(a.boxScorePublished?'MSF final box score '+a.boxAway+'–'+a.boxHome+
     ' (away–home) · '+(a.providerFinal?'FINAL':'Final status unconfirmed'):
     'Independent MSF box score unavailable'):'Box score not checked';
   const check=a?'Source chronology '+a.chronologicalOrder+
     (a.comparablePairs?' ('+a.comparablePairs+' comparable transitions)':'')+
     (a.matchesSchedule===true?' · matches MSF schedule':
       a.matchesSchedule===false?' · MSF scoreboard mismatch':' · schedule comparison unavailable')+
     (a.quarterScoreMatches===true?' · period totals reconcile':
       a.quarterScoreMatches===false?' · period-total discrepancy':'')+
     (a.otPlayCount?' · OT plays '+a.otPlayCount:''):'No chronology assessment';
   const warning=a?.warnings?.length?a.warnings.join(' · '):'No flagged fields in this limited sample';
   return '<div style="border-bottom:1px solid #315069;padding:9px 0"><b>Week '+r.week+'</b> · '+safe(r.game||'Game unavailable')+
    '<div>'+safe(r.ok?'MSF HISTORICAL PLAYS AVAILABLE':r.reason)+'</div>'+
    '<div class="muted">'+safe(counts)+'</div>'+
    '<div class="muted">'+safe(box)+'</div>'+
    '<div class="muted">'+safe(check)+'</div>'+
    '<div class="muted">'+safe(warning)+'</div>'+
    (r.method==='calendar_estimate'?'<div class="muted">Week inferred from kickoff date, not a native MSF week designation</div>':'')+
    (r.gameId?'<button type="button" class="button" style="padding:4px 7px;margin-top:5px" data-ffo-history-game="'+safe(r.gameId)+'">Inspect actual plays</button>':'')+'</div>';
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
     const ok=a.usablePlaySequence&&a.diagnostics.missingClock===0;
     if(bs.status==='rejected')a.warnings.push('MSF box score request failed: '+String(bs.reason?.message||bs.reason).slice(0,65));
     const reason=a.diagnostics.scoringOnly?'Only MSF scoring-play fallback':
       !a.diagnostics.describedCount?'No published plays recognized':
       a.chronologicalOrder==='mixed'?'Chronology inconsistent':
       a.diagnostics.missingClock?'Some clocks unverified':
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
   if(indicator)indicator.textContent=available+'/6 games have usable MSF PBP · '+boxes+
    '/6 final box scores with both scores · '+matching+
    ' matching available MSF schedule scores. Neither the sample nor a box-score match certifies full PBP or player fantasy totals.';
  }finally{button.disabled=false;}
 }

 async function selectGame(id){if(!s.enabled)return;s.game=String(id);s.followLatest=true;s.visiblePlays=60;s.playCache=[];s.portraitRows=[];s.playSource=null;s.activePlay=-1;s.liveBox=null;lastPlayCount=0;lastNewPlayAt=0;lastProviderUpdateAt=0;consecutivePlayFailures=0;s.lastGamePoll=0;s.lastBoxPoll=0;finalObservedAt=0;lastStadiumPlayId=null;lastStadiumGameId=null;priorVerifiedBallX=null;drawGames();drawPlays();void ensurePortraits(s.game);await refreshGame()}
 async function refreshGame(){if(!s.enabled||!s.game||gamePending)return gamePending;
  gamePending=(async()=>{
  const selected=s.games.find(g=>g.id===s.game);
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
      feed('plays',{season:s.season,game_id:s.game}),
      boxDue?feed('boxscore',{season:s.season,game_id:s.game}):Promise.resolve(null)
    ]);
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
 async function refreshOverview(force=false){
  if(overviewPending)return overviewPending;
  overviewPending=(async()=>{try{
    const health=await feed('health',{},force);s.enabled=!!health.ready;
    if(!s.enabled){status('GameCast staging: configure encrypted MSF_API_KEY and enable Worker flag. No live data yet.');drawSignals();return}
    const sched=await feed('schedule',{season:s.season},force);
    const src=sched.data?.games||sched.data?.gameSchedule||sched.data?.schedule?.games||[];
    const allGames=Array.isArray(src)?src.map(friendlyGame).filter(x=>x.id):[];
    s.archiveGames=allGames;
    const nowMs=Date.now(),dayMs=86400000;
    const dated=allGames.map(g=>({...g,kickoffMs:Date.parse(g.start)})).filter(g=>Number.isFinite(g.kickoffMs));
    const nearby=dated.filter(g=>g.kickoffMs>=nowMs-4*dayMs&&g.kickoffMs<=nowMs+8*dayMs);
    const preserved=new Map(s.games.map(g=>[g.id,g]));
    s.games=(nearby.length?nearby:dated.sort((a,b)=>Math.abs(a.kickoffMs-nowMs)-Math.abs(b.kickoffMs-nowMs)).slice(0,24))
      .sort((a,b)=>a.kickoffMs-b.kickoffMs).slice(0,30)
      .map(g=>{
       const before=preserved.get(g.id);
       return before?model.mergeScheduledGame(before,g):g;
      });
    if(!s.games.length)s.games=allGames.slice(0,24);
    // Read-only MSF historical entitlement sample starts automatically after
    // Coach opens the Access-protected GameCast with an authenticated schedule.
    if(gameActive()&&!historyAuditStarted&&allGames.length){historyAuditStarted=true;void runHistoricalAudit();}
    // An explicitly selected historical game stays inspectable after minute refresh.
    const selectedHistory=s.archiveGames.find(g=>g.id===s.game)||preserved.get(s.game);
    if(selectedHistory&&!s.games.some(g=>g.id===s.game))s.games.push(preserved.get(s.game)||selectedHistory);
    // Always keep the league schedule in the source; this is only a compact display window.
    s.latestCheck=sched.checked_at;
    status('MySportsFeeds schedule · '+s.latestCheck+' · real-time latency and feed coverage must be verified at kickoff.');
    drawGames();drawPlayer();if(sectionActive('radar')||sectionActive('market'))refreshEvidencePanels();
    if(!s.game){const thu=s.games.find(x=>['GB','GBP','GREEN BAY'].includes(String(x.home).toUpperCase())&&['CAR','CAROLINA'].includes(String(x.away).toUpperCase()));if(thu)selectGame(thu.id)}
    else if(s.games.some(x=>x.id===s.game))drawField();
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
 document.querySelectorAll('#ffo-gc-filters [data-ffo-filter]').forEach(b=>b.addEventListener('click',()=>{s.playFilter=b.dataset.ffoFilter;document.querySelectorAll('#ffo-gc-filters [data-ffo-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));drawPlays()}));
 $('ffo-gc-refresh')?.addEventListener('click',async()=>{
   // Immediate game data first. Don't block plays behind season/health feeds.
   if(s.enabled&&s.game){s.lastGamePoll=Date.now();s.lastBoxPoll=0;await refreshGame();}
   else await refreshOverview(true);
   if(s.player)await refreshPlayer(false);
 });
 document.querySelector('nav button[data-page="gamecast"]')?.addEventListener('click',()=>{drawGames();drawPlayer();drawPlays();refreshOverview().catch(()=>{})});
 $('ffo-gc-history-check')?.addEventListener('click',()=>void runHistoricalAudit());
  void loadFfoRules().then(()=>{drawPlayer()}).catch(err=>{s.rulesError=String(err.message||err);drawPlayer();status('FFO scoring rules unavailable: '+s.rulesError)});
 drawSignals();drawGames();drawPlayer();drawPlays();drawField();
 if(gameActive())await refreshOverview();
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
   if(document.visibilityState!=='visible'||!gameActive()||!s.enabled||!s.game||gamePending)return;
   const now=Date.now(),interval=activeRefreshMs();
   if(now-(s.lastGamePoll||0)>=interval){s.lastGamePoll=now;void refreshGame();}
 },500);
 document.addEventListener('visibilitychange',()=>{
   if(document.visibilityState==='visible'&&gameActive()&&s.enabled&&s.game){
     s.lastGamePoll=Date.now();void refreshGame();
   }
 });
 setInterval(()=>{if(document.visibilityState==='visible'&&gameActive()&&s.enabled)refreshOverview()},60000);
 window.ffoGameCast={selectPlayer:setPlayer,clearPlayer,refresh:refreshOverview,getStatus:()=>({enabled:s.enabled,season:s.season,game:s.game,player:s.player?.name||null,latestCheck:s.latestCheck,playCount:s.playCache.length,playSource:s.playSource||null,
  lastSuccessfulGamePollAt:lastSuccessfulGamePollAt?new Date(lastSuccessfulGamePollAt).toISOString():null,
  lastNewPlayAt:lastNewPlayAt?new Date(lastNewPlayAt).toISOString():null,
  providerUpdatedAt:lastProviderUpdateAt?new Date(lastProviderUpdateAt).toISOString():null,
  scoreUpdateAt:lastScorePollAt?new Date(lastScorePollAt).toISOString():null,
  homeScore:s.games.find(g=>g.id===s.game)?.homePoints??null,
  awayScore:s.games.find(g=>g.id===s.game)?.awayPoints??null,
  gameFeedError:s.lastError||null,gamePhase:model.gamePhase(s.games.find(g=>g.id===s.game)?.status),finalObservedAt:finalObservedAt?new Date(finalObservedAt).toISOString():null,pollIntervalMs:activeRefreshMs(),boxPollIntervalMs:LIVE_BOX_MS,
  consecutivePlayFailures,ffoRulesLoaded:!!s.ownedRules,ffoRulesVersion:s.rulesVersion,projection:projection()})};
})();