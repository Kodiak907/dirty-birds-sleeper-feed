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

 const s={status:'Gateway not checked',enabled:false,season:(()=>{const n=Number(window.dbNflSeason||2026);return n+'-'+(n+1)+'-regular'})(),games:[],game:null,player:null,playerId:null,msfPlayer:null,playerMatch:'',playerRows:[],weekRows:[],allWeeks:new Map(),playCache:[],lastMeta:null,liveBox:null,injuries:null,latestCheck:'',lastError:'',msfFantasy:null,playFilter:'all',activePlay:-1,followLatest:true,sourceErrors:[],lastGamesCheck:null};
 const route='/api/ffo/gamecast/';
 function status(msg){s.status=msg;if($('ffo-gc-status'))$('ffo-gc-status').textContent=msg;}
 const feedCache=new Map(),feedPending=new Map();
 let playerFeedPending=null,gamePending=null,overviewPending=null;
 const sectionActive=id=>!!document.querySelector('nav button[data-page="'+id+'"].active');
 const gameActive=()=>sectionActive('gamecast');
 function cacheTtl(name){
   if(name==='health')return 60000;
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
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12500);
   try{
    const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:controller.signal,headers:{accept:'application/json'}});
    let body;try{body=await response.json()}catch{throw Error('Invalid gateway response')}
    if(!response.ok)throw Error(body.error||'HTTP '+response.status);
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
  const score=x.score||x.scoring||x.scores||x.gameScore||{};
  const n=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
  return {id:String(gameId),home:name(home),away:name(away),homePoints:n(score.homeScoreTotal??score.homeScore??x.homeScoreTotal??x.homeScore),awayPoints:n(score.awayScoreTotal??score.awayScore??x.awayScoreTotal??x.awayScore),status:String(x.status||z.playedStatus||z.scheduleStatus||z.status||'Unverified game status'),start:z.startTime||z.startTimeUTC||x.startTime||null};
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
 function getRules(){return (typeof gm47Snapshot!=='undefined'&&gm47Snapshot?.league?.scoring_settings)||null}
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
  <div class="ffo-gc-statgrid"><div><b>${livePoints}</b><span>Game FFL partial</span></div><div><b>${projPoints}</b><span>FFO forecast research</span></div>${seasonTags.slice(0,4).join('')||'<div><b>—</b><span>Season stats pending</span></div>'}</div>
  <p class="ffo-gc-note">${safe(matchNote)}</p>
  <div class="ffo-gc-section"><h3>Current game player stats</h3><div class="ffo-gc-rawstats">${liveTags.length?liveTags.join(''):'<div>Game-specific player box score not verified yet.</div>'}</div></div>
  <div class="ffo-gc-section"><h3>Most recent published NFL game</h3><div class="ffo-gc-rawstats">${latestTags.length?latestTags.join(''):'<div>Independent game statistics not yet loaded.</div>'}</div></div>
   <div class="ffo-gc-section"><h3>2026 NFL season totals</h3><div class="ffo-gc-rawstats">${seasonTags.length?seasonTags.join(''):'<div>Awaiting verifiable published player season totals.</div>'}</div></div>
  <div class="ffo-gc-evidence"><b>FFL scoring audit</b><p class="ffo-gc-note">${rules?'Using current Sleeper league scoring_settings.':'FFL scoring rules not loaded from Sleeper.'} ${scoring?.points!=null?'Reconstructed '+fmt(scoring.points)+' from '+scoring.covered.length+' stat categories.':'No certified player box-score reconstruction.'} ${scoring&&!scoring.complete?'Missing / unverified scoring categories: '+safe(scoring.missing.slice(0,10).join(', '))+'.':''} ${proj&&!proj.complete?'Projection uses incomplete stat categories and must NOT overwrite trade/waiver valuation.':''}</p><p class="ffo-gc-note">Official injury cross-check: ${safe(official)} <a href="https://www.nfl.com/injuries/" target="_blank" rel="noopener noreferrer">Official NFL injuries</a></p></div>
  <p class="ffo-gc-note">* Game points and projections are experimental when category coverage is incomplete. Sleeper's actual scored league matchup remains authoritative. Latest source check: ${safe(s.latestCheck||'not connected')}. No 15–20-second SLA proven.</p>
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

 function drawField(){
  const el=$('ffo-gc-gameview');
  const g=s.games.find(x=>x.id===s.game)||null;
  const event=s.playCache[s.activePlay]||null;
  const input={game:g,event,embedded:false,latestCheck:s.latestCheck,playCount:s.playCache.length,activePlay:s.activePlay,followLatest:s.followLatest!==false,playerRows:s.playerRows,selectedPlayer:s.player,source:s.playSource,isLive:s.game&&/in.progress|in progress|live|half.time|halftime/i.test(String(g?.status||''))};
  if(el){
   el.innerHTML=stadium.fieldMarkup(input);
   el.querySelectorAll('[data-gc6-step]').forEach(btn=>btn.onclick=()=>{
    s.followLatest=false;s.activePlay=between(s.activePlay+Number(btn.dataset.gc6Step),0,Math.max(0,s.playCache.length-1));drawField();drawPlays();
   });
   el.querySelector('[data-gc6-latest]')?.addEventListener('click',()=>{
    s.followLatest=true;s.activePlay=Math.max(0,s.playCache.length-1);drawField();drawPlays();
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
  (show.length?show.map(({event,i})=>stadium.playRow(event,i,s.activePlay===i,s.games.find(g=>g.id===s.game),s.playSource,s.playerRows,s.player)).join(''):'<p class="gc6-quiet">No matching plays in the published subset. This does not prove zero involvement.</p>');
  if(selected.length>show.length){
    const more=document.createElement('button');more.type='button';more.className='ffo-gc-refresh';
    more.textContent='Show '+Math.min(40,selected.length-show.length)+' earlier plays';
    more.onclick=()=>{s.visiblePlays=Math.min(selected.length,limit+40);drawPlays();};
    el.appendChild(more);
  }
  el.querySelectorAll('[data-ffo-play]').forEach(row=>{
    const open=()=>{s.activePlay=Number(row.dataset.ffoPlay);s.followLatest=s.activePlay===s.playCache.length-1;drawField();drawPlays()};
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
 async function selectGame(id){if(!s.enabled)return;s.game=String(id);s.followLatest=true;s.visiblePlays=60;s.playCache=[];s.playSource=null;s.activePlay=-1;s.liveBox=null;drawGames();drawPlays();await refreshGame()}
 async function refreshGame(){if(!s.enabled||!s.game||gamePending)return gamePending;
  s.lastGamePoll=Date.now();
  gamePending=(async()=>{
  const selected=s.games.find(g=>g.id===s.game);
  const kickoff=Date.parse(selected?.start||'');
  if(Number.isFinite(kickoff)&&Date.now()<kickoff-5*60000){
    s.playCache=[];s.liveBox=null;s.playSource='Scheduled · awaiting kickoff';
    status('Game is scheduled · live plays and box scores are not expected before kickoff. MySportsFeeds authenticated. · '+new Date().toISOString());
    drawPlays();drawPlayer();return;
  }
  try{
    const [pb,bs]=await Promise.allSettled([feed('plays',{season:s.season,game_id:s.game}),feed('boxscore',{season:s.season,game_id:s.game})]);
    if(pb.status==='fulfilled'){
      const ps=model.plays(pb.value.data);s.playCache=model.retainPublishedPlays(s.playCache,ps);
      s.playSource=pb.value.coverage==='scoring_only'?'MySportsFeeds · scoring plays only for this specific game':'MySportsFeeds · published play-by-play';
      if(s.followLatest||s.activePlay<0)s.activePlay=Math.max(0,s.playCache.length-1);
      else s.activePlay=Math.min(s.activePlay,Math.max(0,s.playCache.length-1));
      s.latestCheck=pb.value.checked_at;
    }
    if(bs.status==='fulfilled'){s.liveBox=bs.value;s.latestCheck=bs.value.checked_at}
    const game=s.games.find(g=>g.id===s.game);
    let supplemental='';
    if(game && (!s.playCache.length || pb.status==='rejected' || pb.value?.coverage==='scoring_only' || pb.value?.full_playbyplay_authorized===false)){
      try{
        const es=await feed('espnplays',{home:game.home,away:game.away,at:game.start});
        if(Array.isArray(es.data?.plays)&&es.data.plays.length){
          const published=model.plays(es.data);s.playCache=model.versionedPlays(s.playCache,published);
          if(s.followLatest||s.activePlay<0)s.activePlay=Math.max(0,s.playCache.length-1);s.playSource='ESPN NFL game summary · supplemental';
          s.latestCheck=es.checked_at;supplemental=' · published ESPN drive descriptions';
        }else supplemental=' · no published ESPN plays yet';
      }catch(error){supplemental=' · ESPN play timeline unavailable ('+String(error?.message||'source error')+')'}
    }
    const errs=[pb,bs].filter(x=>x.status==='rejected').map(x=>String(x.reason.message||x.reason));
    status((s.playSource||'Source unavailable')+' · '+(errs.length?'Some MSF feeds unavailable: '+errs.join('; '):'MSF game requests checked')+supplemental+' · checked '+(s.latestCheck||'unknown')+' · source delay unverified');
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
    const nowMs=Date.now(),dayMs=86400000;
    const dated=allGames.map(g=>({...g,kickoffMs:Date.parse(g.start)})).filter(g=>Number.isFinite(g.kickoffMs));
    const nearby=dated.filter(g=>g.kickoffMs>=nowMs-4*dayMs&&g.kickoffMs<=nowMs+8*dayMs);
    s.games=(nearby.length?nearby:dated.sort((a,b)=>Math.abs(a.kickoffMs-nowMs)-Math.abs(b.kickoffMs-nowMs)).slice(0,24))
      .sort((a,b)=>a.kickoffMs-b.kickoffMs).slice(0,30);
    if(!s.games.length)s.games=allGames.slice(0,24);
    // Always keep the league schedule in the source; this is only a compact display window.
    s.latestCheck=sched.checked_at;
    status('MySportsFeeds schedule · '+s.latestCheck+' · ESPN supplemental play descriptions are labeled separately; live delay not verified');
    drawGames();drawPlayer();if(sectionActive('radar')||sectionActive('market'))refreshEvidencePanels();
    if(!s.game){const thu=s.games.find(x=>['GB','GBP','GREEN BAY'].includes(String(x.home).toUpperCase())&&['CAR','CAROLINA'].includes(String(x.away).toUpperCase()));if(thu)selectGame(thu.id)}
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
 $('ffo-gc-refresh')?.addEventListener('click',async()=>{await refreshOverview(true);if(s.player)await refreshPlayer(true);if(s.game)await refreshGame()});
 document.querySelector('nav button[data-page="gamecast"]')?.addEventListener('click',()=>{drawGames();drawPlayer();drawPlays();refreshOverview().then(()=>{if(s.game)return refreshGame()}).catch(()=>{})});
 drawSignals();drawGames();drawPlayer();drawPlays();drawField();
 if(gameActive())await refreshOverview();
 if(typeof pfo49Selected!=='undefined'&&pfo49Selected&&sectionActive('playerhub'))setPlayer(pfo49Selected);
 setInterval(()=>{
   if(document.visibilityState!=='visible'||!gameActive()||!s.enabled||!s.game||gamePending)return;
   const game=s.games.find(g=>g.id===s.game),now=Date.now();
   // MSF can still call a game 'scheduled' after kickoff: check the actual clock.
   const likelyLive=model.shouldPollGameLive(game,now);
   const refreshMs=likelyLive?20000:120000;
   if(now-(s.lastGamePoll||0)>=refreshMs){s.lastGamePoll=now;refreshGame();}
  },20000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&gameActive()&&s.enabled&&s.game)refreshGame().catch(()=>{})});
 setInterval(()=>{if(document.visibilityState==='visible'&&gameActive()&&s.enabled)refreshOverview()},180000);
 window.ffoGameCast={selectPlayer:setPlayer,clearPlayer,refresh:refreshOverview,getStatus:()=>({enabled:s.enabled,game:s.game,player:s.player?.name||null,latestCheck:s.latestCheck,projection:projection()})};
})();