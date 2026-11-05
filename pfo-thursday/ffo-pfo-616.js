/* PFO 6.16: licensed MSF team-defense companion to the existing FFO projection
 * pipeline. Does NOT alter Trade Lab, private auth, Commissioner or Sleeper.
 * Missing independent defensive components remain partial/uncertified.
 */
(()=>{'use strict';
 const defense=new Map(),pending=new Map(),failures=new Map(),seen=new Map();
 const playerPending=new Map(),playerFailures=new Map(),playerSeen=new Map(),playerRecovered=new Set();
 const canonical=x=>typeof gm47CanonicalTeam==='function'?gm47CanonicalTeam(x):String(x||'').toUpperCase();
 const pos=p=>typeof pfo52Pos==='function'?pfo52Pos(p):String(p?.position||'').toUpperCase().replace(/^D\/?ST$/,'DEF');
 const info=id=>typeof pfo52Info==='function'?pfo52Info(id):null;
 const roster=()=>typeof liveRosterSnapshot!=='undefined'?liveRosterSnapshot:null;
 const defenseIds=()=>{
  const r=roster(),ids=new Set((r?.players||[]).filter(p=>pos(p)==='DEF').map(p=>String(p.player_id)));
  for(const id of r?.starters||[])if(pos(info(id))==='DEF')ids.add(String(id));
  if(typeof gm47Snapshot!=='undefined'){
   const my=gm47Snapshot?.rosters?.find(x=>String(x.roster_id)===String(window.dbRosterId||1));
   for(const id of my?.players||[])if(pos(info(id))==='DEF')ids.add(String(id));
  }
  return [...ids];
 };
 const status=(team)=>defense.get(team)||null;
 const score=(row)=>{
  if(!row?.forecast||row?.games_observed<2)return null;
  const pointsAllowed=Number(row?.coverage?.points_allowed_games||0);
  const defenseEvidence=Number(row?.coverage?.defensive_stat_games||0);
  // One data bucket alone is not a credible full D/ST baseline.
  if(!pointsAllowed&&!defenseEvidence)return null;
  const result=window.ffoPfo597?.scoreFrozen?.(row.forecast);
  if(typeof result?.points!=='number'||!Number.isFinite(result.points))return null;
  return {points:Math.round(result.points*100)/100,source:
   'MySportsFeeds observed team gamelogs · '+row.games_observed+' completed games · FFO frozen D/ST scoring · partial model',
   partial:true,certified:false,coverage:row.coverage,model:'PFO_616_MSF_TEAM_DEFENSE_V1'};
 };
 function redraw(){
  try{window.ffoPfo611?.coverage?.()}catch{}
  try{if(document.querySelector('#roster.page.active'))pfo52RosterPoints?.()}catch{}
  try{if(document.querySelector('#matchup.page.active'))pfo52Render?.()}catch{}
  try{if(document.querySelector('#overview.page.active')){renderBriefing?.();pfo50RenderHomeKPIs?.()}}catch{}
  try{if(document.querySelector('#market.page.active'))window.ffoPfo59?.refreshCurrent?.()}catch{}
  try{if(document.querySelector('#championship.page.active'))pfo49RenderPlanner?.()}catch{}
  window.ffoStartSit63?.refresh?.();
 }
 async function load(team,force=false){
  team=canonical(team);
  if(!team||!/^[A-Z]{2,3}$/.test(team))return null;
  if(pending.has(team))return pending.get(team);
  if(!force&&defense.has(team)&&Date.now()-(seen.get(team)||0)<10*60*1000)return defense.get(team);
  if(!force&&failures.has(team)&&Date.now()-(seen.get(team)||0)<90*1000)return null;
  const job=(async()=>{
   try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);
    let response;
    try{response=await fetch('/api/ffo/stats/defense?team='+encodeURIComponent(team),
     {cache:'no-store',signal:controller.signal});}finally{clearTimeout(timer)}
    if(!response.ok)throw Error('Protected team defense HTTP '+response.status);
    const data=await response.json();
    if(data.source!=='MySportsFeeds'||data.team!==team||data.available===false||!data.forecast){
     throw Error(String(data.error||'independent_team_defense_unavailable'));
    }
    if(!Number.isInteger(data.games_observed)||data.games_observed<2)
     throw Error('insufficient_finished_team_games');
    defense.set(team,data);failures.delete(team);seen.set(team,Date.now());redraw();return data;
   }catch(error){failures.set(team,String(error?.message||error));seen.set(team,Date.now());redraw();return null}
   finally{pending.delete(team)}
  })();
  pending.set(team,job);return job;
 }
 // For a starter with missing scoring categories, query only that player's
 // licensed game logs. Never substitute Sleeper scoring history/forecasts.
 const samePlayer=(a,b)=>String(a||'').toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').replace(/\b(jr|sr|ii|iii|iv)\b\.?/gi,'').replace(/[^a-z]/g,'')===
  String(b||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/\b(jr|sr|ii|iii|iv)\b\.?/gi,'').replace(/[^a-z]/g,'');
 async function recoverPlayer(id){
  id=String(id);
  if(playerPending.has(id))return playerPending.get(id);
  const source=typeof pfo50Independent!=='undefined'?pfo50Independent:null;
  if(!source?.players?.length)return null;
  if(playerRecovered.has(id))return null;
  if(Date.now()-(playerSeen.get(id)||0)<90000)return null;
  const p=info(id),team=canonical(p?.team);
  if(!p?.name||!team||pos(p)==='DEF'||!/^[A-Za-z .'-]{3,70}$/.test(p.name))return null;
  const row=typeof pfo50StatsFor==='function'?pfo50StatsFor(id):null;
  const scored=window.ffoPfo597?.scoreFrozen?.(row?.forecast);
  if(scored?.points!=null&&Number.isFinite(Number(scored.points)))return null;
  playerSeen.set(id,Date.now());
  const job=(async()=>{
   try{
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),14000);
    let response;
    try{response=await fetch('/api/ffo/stats/player-coverage?team='+encodeURIComponent(team)+
     '&name='+encodeURIComponent(p.name),{cache:'no-store',signal:ctl.signal});}
    finally{clearTimeout(timer)}
    if(!response.ok)throw Error('MSF player game coverage HTTP '+response.status);
    const data=await response.json();
    if(data.source!=='MySportsFeeds'||data.available===false||canonical(data.team)!==team||
     !samePlayer(p.name,data.name)||!data.forecast||data.games_observed<2)
     throw Error(String(data.error||'verified_player_gamelogs_unavailable'));
    if(data.position&&pos(p)!==String(data.position).toUpperCase().replace(/^D\/?ST$/,'DEF'))
     throw Error('provider_position_conflict');
    // Guard against partial game logs that contain no scorable FFL fields.
    const score=window.ffoPfo597?.scoreFrozen?.(data.forecast);
    if(score?.points==null||!Number.isFinite(Number(score.points)))
     throw Error('player_game_logs_do_not_cover_FFL_scoring_fields');
    if(typeof pfo50Indexed==='undefined'||typeof pfo50Key!=='function')throw Error('model_index_unavailable');
    const copy=new Map(pfo50Indexed),key=pfo50Key(p.name,team);
    copy.set(key,{...data,name:p.name,team,source_type:'licensed_primary',
     coverage:'verified_player_game_logs_partial'});
    pfo50Indexed=copy; // bust 5.9.7 forecast cache by reference
    playerRecovered.add(id);playerFailures.delete(id);redraw();return data;
   }catch(error){playerFailures.set(id,String(error?.message||error));return null}
   finally{playerPending.delete(id)}
  })();
  playerPending.set(id,job);return job;
 }
 function recoverUnmodeled(){
  const r=roster();if(!r?.starters?.length)return;
  const ids=r.starters.map(String).filter(id=>id&&id!=='0'&&pos(info(id))!=='DEF');
  // Bound requests: only submitted starters, and only demonstrably unsupported
  // scoring rows (up to four at any one visit).
  let requested=0;
  for(const id of ids){
   if(requested>=4)break;
   const row=typeof pfo50StatsFor==='function'?pfo50StatsFor(id):null;
   if(row?.forecast&&window.ffoPfo597?.scoreFrozen?.(row.forecast)?.points!=null)continue;
   if(playerPending.has(id)||playerRecovered.has(id)||Date.now()-(playerSeen.get(id)||0)<90000)continue;
   requested++;void recoverPlayer(id);
  }
 }

 let boot=false,refreshTimer=null;
 function refresh(){
  for(const id of defenseIds()){const p=info(id),team=canonical(p?.team||id);
   if(team)void load(team);
  }
  recoverUnmodeled();
 }
 const base=typeof pfo52Points==='function'?pfo52Points:null;
 if(base){
  pfo52Points=function(id,week,past=false){
   if(past)return base(id,week,past);
   const player=info(id),position=pos(player);
   if(position!=='DEF')return base(id,week,past);
   const prior=base(id,week,past);
   if(prior?.bye)return prior;
   const team=canonical(player?.team||id),row=status(team);
   // A documented BYE must always override projections.
   const schedule=window.ffoPfo597?.verifiedSchedule?.();
   const weekRow=schedule?.teams?.[team]?.weeks?.[String(week)];
   if(weekRow?.bye===true)return prior;
   if(schedule?.teams?.[team]&&weekRow?.opponent){
    const projected=score(row);
    if(projected)return {...projected,bye:false,week:Number(week),opponent:weekRow.opponent};
   }
   // Never fall back to the old Sleeper-history-based D/ST estimate.
   if(!row&&team&&!pending.has(team))void load(team);
   return {points:null,source:failures.get(team)||
     (row?'MSF D/ST gamelogs insufficient for safe FFL model':
     'Loading independent MSF team defense game logs'),
     modelPending:true,adjustment:null};
  };
 }
 function init(){
  if(boot)return;boot=true;refresh();
  // Roster often arrives after DOMContentLoaded; retry only a few times.
  let retries=0;refreshTimer=setInterval(()=>{
   retries++;refresh();
   if(retries>=15){clearInterval(refreshTimer);refreshTimer=null}
  },1600);
  document.querySelectorAll('nav button[data-page]').forEach(btn=>btn.addEventListener('click',()=>{
   if(['roster','matchup','overview','market','championship'].includes(btn.dataset.page))
    setTimeout(refresh,80);
  }));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 window.ffoPfo616={refresh,load,status:team=>defense.get(canonical(team))||null,
  diagnostics:()=>({teams:[...defense.keys()],pending:[...pending.keys()],failures:[...failures],
   players_recovered:[...playerRecovered],players_pending:[...playerPending.keys()],player_failures:[...playerFailures],
   source:'licensed MSF, never Sleeper projections'})};
})();