/* PFO 6.16: licensed MSF team-defense companion to the existing FFO projection
 * pipeline. Does NOT alter Trade Lab, private auth, Commissioner or Sleeper.
 * Missing independent defensive components remain partial/uncertified.
 */
(()=>{'use strict';
 const defense=new Map(),pending=new Map(),failures=new Map(),seen=new Map();
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
 let boot=false,refreshTimer=null;
 function refresh(){
  for(const id of defenseIds()){const p=info(id),team=canonical(p?.team||id);
   if(team)void load(team);
  }
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
   if(defenseIds().length||retries>=15){clearInterval(refreshTimer);refreshTimer=null}
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
   source:'licensed MSF, never Sleeper projections'})};
})();