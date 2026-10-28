/* FFO GameCast v0.4: browser-facing staged intelligence inside existing PFO.
   Does NOT store API secrets and NEVER claims unconfirmed data as live. */
(async function(){
 'use strict';
 const $=id=>document.getElementById(id),safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const model=await import('/ffo-gamecast-model.mjs');
 const polish=document.createElement('style');polish.textContent=\`
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
\`;document.head.append(polish);

 const s={status:'Gateway not checked',enabled:false,season:(()=>{const n=Number(window.dbNflSeason||2026);return n+'-'+(n+1)+'-regular'})(),games:[],game:null,player:null,playerId:null,msfPlayer:null,playerMatch:'',playerRows:[],weekRows:[],allWeeks:new Map(),playCache:[],lastMeta:null,liveBox:null,injuries:null,latestCheck:'',lastError:'',msfFantasy:null,playFilter:'all',activePlay:-1,sourceErrors:[],lastGamesCheck:null};
 const route='/api/ffo/gamecast/';
 function status(msg){s.status=msg;if($('ffo-gc-status'))$('ffo-gc-status').textContent=msg;}
 async function feed(name,query={}){
  const controller=new AbortController(),t=setTimeout(()=>controller.abort(),12500);
  try{
   const url=new URL(route+name,location.origin);Object.entries(query).forEach(([k,v])=>{if(v!==undefined&&v!==null)url.searchParams.set(k,String(v))});
   const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:controller.signal,headers:{accept:'application/json'}});
   let body;try{body=await response.json()}catch{throw Error('Invalid gateway response')}
   if(!response.ok)throw Error(body.error||'HTTP '+response.status);
   if(body.available===false)throw Error(body.reason||'Feed not ready');
   return body;
  }finally{clearTimeout(t)}
 }
 function friendlyGame(x){
  const z=x?.schedule||x?.game||x||{},home=z.homeTeam||x.homeTeam||{},away=z.awayTeam||x.awayTeam||{};
  const name=t=>typeof t==='string'?t:String(t.abbreviation||t.abbr||t.name||'?');
  const gameId=z.id??x.id??z.gameId??x.gameId??'';
  const score=x.score||x.scoring||x.scores||x.gameScore||{};
  const n=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
  return {id:String(gameId),home:name(home),away:name(away),homePoints:n(score.homeScoreTotal??score.homeScore??x.homeScoreTotal??x.homeScore),awayPoints:n(score.awayScoreTotal??score.awayScore??x.awayScoreTotal??x.awayScore),status:String(x.status||z.status||'Unverified game status'),start:z.startTime||z.startTimeUTC||x.startTime||null};
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
  const fields=[['Pass YD','pass_yd'],['Pass TD','pass_td'],['Rush YD','rush_yd'],['Rush TD','rush_td'],['Rec','rec'],['Rec YD','rec_yd'],['Rec TD','rec_td'],['Targets','targets'],['FUM Lost','fum_lost']];
  const seasonTags=fields.filter(([n,k])=>Object.hasOwn(stats,k)).map(([n,k])=>`<div><b>${fmt(stats[k])}</b><span>${safe(n)} · Season</span></div>`);
  const liveTags=fields.filter(([n,k])=>Object.hasOwn(liveStats,k)).map(([n,k])=>`<div><b>${fmt(liveStats[k])}</b><span>${safe(n)} · Game</span></div>`);
  const livePoints=scoring?.points!=null?fmt(scoring.points)+'*':'—',projPoints=proj?.points!=null?fmt(proj.points)+'*':'—';
  const matchNote=s.msfPlayer?'Unique player/team match found; linked by name and team pending permanent provider-to-Sleeper ID reconciliation.':s.playerRows.length?'No unique MySportsFeeds player record matched; stats withheld rather than guessing.':'Season player stats not yet loaded.';
  const official=inj?.official?.official?String(inj.official.official.game_status||'Official designation present'):'No verified current official designation linked. Absence of report is not clearance.';
  const html=`<div class="ffo-gc-intro"><div><span class="ffo-gc-pill">GAMECAST · ${s.enabled?'PROVIDER CONNECTED':'NOT LIVE VERIFIED'}</span><h3>${safe(p.name)}</h3><p>${safe(p.position||'')} · ${safe(p.team||'Team unverified')}</p></div><button type="button" class="button" data-ffo-player-refresh="1">↻</button></div>
  <div class="ffo-gc-statgrid"><div><b>${livePoints}</b><span>Game FFL partial</span></div><div><b>${projPoints}</b><span>FFO forecast research</span></div>${seasonTags.slice(0,4).join('')||'<div><b>—</b><span>Season stats pending</span></div>'}</div>
  <p class="ffo-gc-note">${safe(matchNote)}</p>
  <div class="ffo-gc-section"><h3>Current game player stats</h3><div class="ffo-gc-rawstats">${liveTags.length?liveTags.join(''):'<div>Game-specific player box score not verified yet.</div>'}</div></div>
  <div class="ffo-gc-section"><h3>Season totals</h3><div class="ffo-gc-rawstats">${seasonTags.length?seasonTags.join(''):'<div>Awaiting licensed seasonal player totals.</div>'}</div></div>
  <div class="ffo-gc-evidence"><b>FFL scoring audit</b><p class="ffo-gc-note">${rules?'Using current Sleeper league scoring_settings.':'FFL scoring rules not loaded from Sleeper.'} ${scoring?.points!=null?'Reconstructed '+fmt(scoring.points)+' from '+scoring.covered.length+' stat categories.':'No certified player box-score reconstruction.'} ${scoring&&!scoring.complete?'Missing / unverified scoring categories: '+safe(scoring.missing.slice(0,10).join(', '))+'.':''} ${proj&&!proj.complete?'Projection uses incomplete stat categories and must NOT overwrite trade/waiver valuation.':''}</p><p class="ffo-gc-note">Official injury cross-check: ${safe(official)} <a href="https://www.nfl.com/injuries/" target="_blank" rel="noopener noreferrer">Official NFL injuries</a></p></div>
  <p class="ffo-gc-note">* Game points and projections are experimental when category coverage is incomplete. Sleeper's actual scored league matchup remains authoritative. Latest source check: ${safe(s.latestCheck||'not connected')}. No 15–20-second SLA proven.</p>
  <div class="ffo-gc-actionrow"><button type="button" data-ffo-goto="1">Full GameCast</button><button type="button" data-ffo-player-refresh="1">Refresh player feeds</button></div>${id==='ffo-gc-profile-embed'?'<details open><summary style="font-weight:800;font-size:12px;color:#f2c67c;margin:10px 0">Game field · player-linked plays</summary><div id="ffo-gc-player-field"></div></details>':''}`;
  el.innerHTML=html;
  el.querySelectorAll('[data-ffo-player-refresh]').forEach(b=>b.onclick=()=>refreshPlayer(true));
  el.querySelectorAll('[data-ffo-goto]').forEach(b=>b.onclick=()=>document.querySelector('nav button[data-page="gamecast"]')?.click());
 }
 drawField();drawSignals();
 }
 function drawSignals(){
  const proj=projection(),status=proj?.complete?'Validated coverage (still needs live replay backtest)':proj?.points!=null?'Partial FFL scoring · research only':'Awaiting verified game logs';
  const notice=`<div class="ffo-gc-evidence"><b>FFO Sports Intelligence feed</b><p class="ffo-gc-note">${safe(status)}. ${proj?'Recent-form research baseline '+fmt(proj.points)+' pts from '+proj.n+' games.':''} GameCast stats will inform workload, opportunity and trade differential models after identity, completeness and correction audits. Existing Sleeper and nflverse-derived decision systems are preserved.</p><button type="button" data-ffo-goto="1">Inspect GameCast</button></div>`;
  for(const id of ['ffo-gc-radar-intel','ffo-gc-trade-intel']){const el=$(id);if(!el)continue;el.innerHTML=notice;el.querySelector('[data-ffo-goto]').onclick=()=>document.querySelector('nav button[data-page="gamecast"]')?.click();}
 }
 // The field is a schematic. Neither MSF nor this app supplies actual ball tracking coordinates.
 const get=(o,keys)=>{for(const k of keys){const v=k.split('.').reduce((a,t)=>a?.[t],o);if(v!==undefined&&v!==null&&v!=='')return v;}return null;};
 const at=(o,keys)=>{const v=get(o,keys);return v!==null&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=100?Number(v):null;};
 const between=(n,low,high)=>Math.max(low,Math.min(high,n));
 function playDetails(event){const raw=event?.raw||{};
  const start=at(raw,['lineOfScrimmage','startYardLine','startingYardLine','fieldPosition.yardLine','situation.yardLine','playSituation.yardLine']);
  const end=at(raw,['endYardLine','endingYardLine','ballOnYardLine','newYardLine']);
  const yards=get(raw,['yardsGained','playYards','yards']);
  const delta=Number.isFinite(Number(yards))&&Math.abs(Number(yards))<=100?Number(yards):null;
  const realEnd=end!==null?end:(start!==null&&delta!==null?between(start+delta,0,100):null);
  const dist=get(raw,['yardsToFirstDown','distance','downAndDistance.distance','situation.distance']);
  const down=get(raw,['down','downAndDistance.down','situation.down']);
  const toGo=Number.isFinite(Number(dist))&&Number(dist)>0&&Number(dist)<=100?Number(dist):null;
  return {start,end:realEnd,yards:delta,down,toGo,quarter:event?.period??null,clock:event?.clock??null};
 }
 function fieldMarkup(embedded=false){const g=s.games.find(x=>x.id===s.game),event=s.playCache[s.activePlay]||null;
  const d=playDetails(event),start=d.start,end=d.end;
  const x=yard=>Math.round(38+yard*5.64),xb=yard=>Math.round(yard*6.4);
  const lines=Array.from({length:11},(_,i)=>{const yard=i*10;return `<line x1="${x(yard)}" y1="170" x2="${xb(yard)}" y2="350" stroke="${i===0||i===10?'#d2e9de':'#bdedcf'}" stroke-width="${i===0||i===10?2.8:1.2}" opacity=".77"/><text x="${x(yard)}" y="192" fill="#d7eddc" font-size="11" text-anchor="middle" opacity=".83">${yard}</text>`;}).join('');
  const ten=(start!==null&&d.toGo!==null)?between(start+d.toGo,0,100):null;
  const firstDown=ten!==null?`<line x1="${x(ten)}" x2="${xb(ten)}" y1="170" y2="350" stroke="#e7b949" stroke-width="4" stroke-dasharray="9 6" opacity=".95"/>`:'';
  // If both real yardline endpoints exist, render a data-derived *schematic* arrow, not tracking.
  const path=(start!==null&&end!==null&&start!==end)?`<path d="M ${x(start)} 278 Q ${Math.round((x(start)+x(end))/2)} 205 ${x(end)} 275" fill="none" stroke="#ffcb70" stroke-width="4.2" stroke-linecap="round" stroke-dasharray="7 4"/><circle cx="${x(end)}" cy="275" r="7" fill="#ffdc85" stroke="#071725" stroke-width="3"/>`:'';
  const ball=start!==null?`<ellipse cx="${x(start)}" cy="278" rx="12" ry="7" transform="rotate(-18 ${x(start)} 278)" fill="#b66837" stroke="#f5d4a5" stroke-width="2"/>`:'';
  const score=v=>v===null||v===undefined?'—':safe(v);
  const tags=d.down&&d.toGo?`${safe(d.down)} & ${safe(d.toGo)}`:'Down and distance unverified';
  const quarter=safe(d.quarter||'Q —'),clock=safe(d.clock||'Clock —');
  const caption=event?(start!==null?`Data-linked spot: ${start} yd${end!==null&&end!==start?' → '+end+' yd':''}. Field positions schematic, not tracking.`:'Yardline not supplied: field position deliberately blank.'):'Select a published play. No score or play is invented.';
  return `<div class="ffo-gc-scoreboard"><div class="team">${safe(g?.away||'AWAY')} <b>${score(g?.awayPoints)}</b><small>${safe(g?.status||'Game not selected')}</small></div><div class="ffo-gc-center"><strong>${quarter} · ${clock}</strong><span>${safe(tags)}</span></div><div class="team"><b>${score(g?.homePoints)}</b> ${safe(g?.home||'HOME')}<small>MSF snapshot · not calibrated</small></div></div>
  <div class="ffo-gc-stadium" role="img" aria-label="Schematic football field${start===null?'; no position known':'; play at yard '+start}"><svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ffo-grass-${embedded?'small':'large'}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#286947"/><stop offset="1" stop-color="#0c4935"/></linearGradient></defs><path d="M0 76 Q320 2 640 76 L640 170 L0 170Z" fill="#172b44"/><path d="M0 97 Q320 30 640 97 M0 111 Q320 50 640 111 M0 125 Q320 67 640 125" fill="none" stroke="#485f76" stroke-width="2"/><path d="M0 141 L640 141 L640 172 L0 172Z" fill="#0b1728"/><g fill="#f1d2a5" opacity=".58">${Array.from({length:42},(_,i)=>`<circle cx="${i*16}" cy="155" r="2"/>`).join('')}</g><path d="M38 170 L602 170 L640 350 L0 350Z" fill="url(#ffo-grass-${embedded?'small':'large'})" stroke="#cde0df" stroke-width="2"/><path d="M38 170 L93 170 L64 350 L0 350Z" fill="#224b5a" opacity=".55"/><path d="M547 170 L602 170 L640 350 L576 350Z" fill="#224b5a" opacity=".55"/>${lines}${firstDown}${path}${ball}</svg><div class="ffo-gc-field-caption">${safe(caption)}</div></div>
  ${embedded?'':`<div class="ffo-gc-controls"><button data-ffo-step="-1" ${s.activePlay<=0?'disabled':''}>◀ Earlier</button><span>${event?`Play ${s.activePlay+1} / ${s.playCache.length}`:'Awaiting published plays'}</span><button data-ffo-step="1" ${s.activePlay>=s.playCache.length-1?'disabled':''}>Later ▶</button></div>`}
  <div class="ffo-gc-provenance">${event?safe(event.text):'No verified provider play selected.'} · ${safe(s.latestCheck||'No live check yet')} · schematic field, not measured player tracking</div>`;
 }
 function drawField(){const el=$('ffo-gc-gameview');if(el){el.innerHTML=fieldMarkup(false);el.querySelectorAll('[data-ffo-step]').forEach(btn=>btn.onclick=()=>{s.activePlay=between(s.activePlay+Number(btn.dataset.ffoStep),0,Math.max(0,s.playCache.length-1));drawField();drawPlays()})}
  const small=$('ffo-gc-player-field');if(small)small.innerHTML=fieldMarkup(true);
 }
 function drawPlays(){const el=$('ffo-gc-playfeed');if(!el)return;
  if(!s.game){el.innerHTML='<p class="ffo-gc-note">Select a game to see the provider play timeline.</p>';drawField();return;}
  if(!s.playCache.length){el.innerHTML='<h3>Play-by-play</h3><p class="ffo-gc-note">No published plays available for this game yet. The licensed MySportsFeeds boxscore may provide scoring plays only; full play-by-play is not yet authorized.</p>';drawField();return;}
  const needle=s.player?model.normalizeName(s.player.name):'';
  const isScoring=x=>/touchdown|field goal (is good|made)|extra point (is good|made)|safety/i.test(x.text||'');
  const matching=(x)=>needle&&model.normalizeName(x.text).includes(needle);
  const numbered=s.playCache.map((event,i)=>({event,i}));
  const selected=numbered.filter(({event})=>s.playFilter==='scoring'?isScoring(event):s.playFilter==='player'?matching(event):true);
  const show=selected.slice(-60).reverse();
  el.innerHTML=`<h3>${s.playFilter==='player'?safe(s.player?.name||'Player not selected')+' · ':''}${s.playSource?.includes('SCORING PLAYS ONLY')?'Published scoring plays (partial)':'Published plays'} <small style="color:#acc4d7">(${selected.length} matching / ${s.playCache.length} loaded)</small></h3>`+
   (show.length?show.map(({event,i})=>`<div class="ffo-gc-play ${s.activePlay===i?'active':''}" data-ffo-play="${i}" role="button" tabindex="0"><div class="ffo-gc-playtop"><strong>${safe(event.update==='corrected'?'CORRECTED':event.update==='new'?'NEW':'PLAY')}</strong><small>${safe(event.period?'Q'+event.period:'Quarter unknown')} ${safe(event.clock||'Time unknown')}</small></div><div>${safe(event.text)}</div><small>${safe(s.playSource||'Source not verified')} · provisional · schematic only</small></div>`).join(''):'<p class="ffo-gc-note">No matching plays in this subset. This does not prove zero involvement.</p>');
  el.querySelectorAll('[data-ffo-play]').forEach(row=>{const open=()=>{s.activePlay=Number(row.dataset.ffoPlay);drawField();drawPlays()};row.onclick=open;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}});
  drawField();
 }

 async function refreshPlayer(force=false){
  if(!s.player||!s.enabled)return;
  try{
   if(force||!s.playerRows.length){const r=await feed('stats',{season:s.season});s.playerRows=model.playerRows(r.data);s.latestCheck=r.checked_at;findPlayer()}
   drawPlayer();
   if(force||!s.allWeeks.size){
    const week=Math.min(18,Math.max(1,Number(window.dbNflWeek||8)));
    const previous=Array.from({length:week},(_,i)=>i+1);
    for(let i=0;i<previous.length;i+=3){await Promise.all(previous.slice(i,i+3).map(async w=>{
      try{const r=await feed('gamelogs',{season:s.season,week:w});s.allWeeks.set(w,model.playerRows(r.data))}catch{ /* coverage gaps remain explicit */ }
    }))}
   }
   drawPlayer();
  }catch(error){s.lastError=String(error.message||error);status('Player feed unavailable: '+s.lastError);drawPlayer()}
 }
 async function selectGame(id){if(!s.enabled)return;s.game=String(id);s.playCache=[];s.playSource=null;s.activePlay=-1;s.liveBox=null;drawGames();drawPlays();await refreshGame()}
 async function refreshGame(){if(!s.enabled||!s.game)return;
  try{
    const [pb,bs]=await Promise.allSettled([feed('plays',{season:s.season,game_id:s.game}),feed('boxscore',{season:s.season,game_id:s.game})]);
    if(pb.status==='fulfilled'){
      const ps=model.plays(pb.value.data);s.playCache=model.versionedPlays(s.playCache,ps);
      s.playSource=pb.value.coverage==='scoring_only'?'MySportsFeeds · scoring plays only (full PBP restricted)':'MySportsFeeds · published play-by-play';
      if(s.activePlay<0)s.activePlay=Math.max(0,s.playCache.length-1);
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
          s.activePlay=Math.max(0,s.playCache.length-1);s.playSource='ESPN NFL game summary · supplemental';
          s.latestCheck=es.checked_at;supplemental=' · published ESPN drive descriptions';
        }else supplemental=' · no published ESPN plays yet';
      }catch(error){supplemental=' · ESPN play timeline unavailable ('+String(error?.message||'source error')+')'}
    }
    const errs=[pb,bs].filter(x=>x.status==='rejected').map(x=>String(x.reason.message||x.reason));
    status((s.playSource||'Source unavailable')+' · '+(errs.length?'Some MSF feeds unavailable: '+errs.join('; '):'MSF game requests checked')+supplemental+' · checked '+(s.latestCheck||'unknown')+' · source delay unverified');
    drawPlays();drawPlayer();
  }catch(error){status('Game feed error: '+error.message)}
 }
 async function refreshOverview(){
  try{
    const health=await feed('health');s.enabled=!!health.ready;
    if(!s.enabled){status('GameCast staging: configure encrypted MSF_API_KEY and enable Worker flag. No live data yet.');drawSignals();return}
    const sched=await feed('schedule',{season:s.season});
    const src=sched.data?.games||sched.data?.gameSchedule||sched.data?.schedule?.games||[];
    s.games=Array.isArray(src)?src.map(friendlyGame).filter(x=>x.id):[];
    s.latestCheck=sched.checked_at;
    status('MySportsFeeds schedule · '+s.latestCheck+' · ESPN supplemental play descriptions are labeled separately; live delay not verified');
    drawGames();drawPlayer();
    if(!s.game){const thu=s.games.find(x=>['GB','GBP','GREEN BAY'].includes(String(x.home).toUpperCase())&&['CAR','CAROLINA'].includes(String(x.away).toUpperCase()));if(thu)selectGame(thu.id)}
  }catch(error){s.enabled=false;status('GameCast not connected: '+String(error.message||error));drawGames();drawPlayer()}
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
 $('ffo-gc-refresh')?.addEventListener('click',async()=>{await refreshOverview();if(s.player)await refreshPlayer(true);if(s.game)await refreshGame()});
 document.querySelector('nav button[data-page="gamecast"]')?.addEventListener('click',()=>{drawGames();drawPlayer();drawPlays()});
 drawSignals();drawGames();drawPlayer();drawPlays();drawField();await refreshOverview();
 setInterval(()=>{if(document.visibilityState==='visible'&&s.enabled&&s.game)refreshGame()},20000);
 setInterval(()=>{if(document.visibilityState==='visible'&&s.enabled)refreshOverview()},90000);
 window.ffoGameCast={selectPlayer:setPlayer,refresh:refreshOverview,getStatus:()=>({enabled:s.enabled,game:s.game,player:s.player?.name||null,latestCheck:s.latestCheck,projection:projection()})};
})();