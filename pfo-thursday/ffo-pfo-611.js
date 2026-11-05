/* PFO 6.11 · automatic independent MSF statistics hydration.
   UI refresh is bounded; unavailable player projections remain unknown, not zero.
   Sleeper supplies rosters, not forecast points. */
(function(){'use strict';
 const active=()=>!document.hidden;
 const relevant=()=>!!document.querySelector('#roster.page.active,#matchup.page.active,#overview.page.active,#scouting.page.active,#playerhub.page.active,#market.page.active');
 const refreshGapMs=120000,staleMs=20*60*1000;
 let pending=null,attemptedAt=0,rosterSignature='',lastSeen='',booted=false;
 const getRoster=()=>typeof liveRosterSnapshot!=='undefined'?liveRosterSnapshot:null;
 const signature=()=>{
  const r=getRoster();return r?.players?.length?
   String(r.roster_id||'')+'|'+r.players.map(p=>[p.player_id,p.team,p.position].join(':')).sort().join('|'):'';
 };
 const showGaps=()=>{
  const el=document.getElementById('ffo69-stats-status'),r=getRoster();if(!el||!r?.players?.length)return;
  const wk=typeof pfo52Cur==='function'?pfo52Cur():Number(window.dbNflWeek||0);
  const ids=(r.starters||[]).map(String).filter(id=>id&&id!=='0');
  const known=[],missing=[],partial=[],rulesReady=window.ffoPfo597?.hasFrozenRules?.()===true;
  const info=typeof pfo69SourceStatus==='function'?pfo69SourceStatus():null;
  const sourceTeams=new Set(info?.teams||[]);
  const diag=window.ffoPfo616?.diagnostics?.()||{};
  const playerErrors=new Map(diag.player_failures||[]),defenseErrors=new Map(diag.failures||[]);
  const playerPending=new Set(diag.players_pending||[]),defensePending=new Set(diag.pending||[]);
  for(const id of ids){
   const p=typeof pfo52Info==='function'?pfo52Info(id):null;
   const score=typeof pfo52Points==='function'?pfo52Points(id,wk):null;
   const pos=typeof pfo52Pos==='function'?pfo52Pos(p):p?.position;
   const row=typeof pfo50StatsFor==='function'?pfo50StatsFor(id):null;
   const name=p?.name||id,team=typeof gm47CanonicalTeam==='function'?gm47CanonicalTeam(p?.team):p?.team;
   if(score?.points!=null&&Number.isFinite(Number(score.points))){known.push(name);if(score.partial)partial.push(name);continue}
   let reason;
   if(score?.bye)reason='verified NFL bye; no point forecast';
   else if(!rulesReady)reason='FFO scoring rules not ready';
   else if(score?.schedulePending)reason='verified NFL week schedule missing';
   else if(pos==='DEF'&&defensePending.has(team))reason='loading licensed MSF team defense and completed-game results';
   else if(pos==='DEF'&&defenseErrors.has(team))reason='MSF D/ST evidence: '+defenseErrors.get(team);
   else if(pos!=='DEF'&&playerPending.has(id))reason='loading licensed individual game logs';
   else if(pos!=='DEF'&&playerErrors.has(id))reason='MSF game logs: '+playerErrors.get(id);
   else if(info?.scope==='selected_teams'&&team&&!sourceTeams.has(team))reason='MSF did not load '+team+' team statistics';
   else if(!row)reason=pos==='DEF'?'licensed NFL team defense evidence not yet available':
    'MSF player identity/statistics not uniquely matched';
   else if(!row.games_observed&&!row.games_played)reason='MSF player appearances not verified; game-log check pending';
   else if(!row.forecast)reason=pos==='K'?'MSF exact FG-distance/XP categories unavailable':'MSF scoring categories missing';
   else reason=String(score?.source||'model validation or availability pending');
   missing.push({name,team,pos,reason,fields:Object.keys(row?.season_totals||{}).filter(k=>k!=='games_played').length});
  }
  let sub=document.getElementById('pfo611-coverage-report');
  if(!sub){sub=document.createElement('div');sub.id='pfo611-coverage-report';sub.className='note';
   sub.style.cssText='font-size:11px;line-height:1.5;margin-top:8px';
   el.insertAdjacentElement('afterend',sub);}
  sub.textContent='W'+wk+' independently modeled starters: '+known.length+'/'+ids.length+
   '. '+(partial.length?'Partial D/ST estimates: '+partial.join(', ')+'. ':'')+(missing.length?'Missing: '+missing.map(x=>x.name+' ('+x.reason+')').join(' · '):
    'All submitted starters have model estimates (check partial classifications).')+
   ' Missing categories are not zero predictions.';
  let detail=document.getElementById('pfo615-coverage-details');
  if(!detail){detail=document.createElement('div');detail.id='pfo615-coverage-details';sub.after(detail);}
  const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  detail.innerHTML='<p class="pfo615-health-summary">MSF evidence: '+safe(info?.scope||'source pending')+
   ' · '+safe(info?.loaded??0)+' indexed player records · '+safe(info?.failed?.length||0)+' team failures</p>'+
   (missing.length?'<div class="pfo615-coverage-items">'+missing.map(x=>
    '<div><b>'+safe(x.name)+'</b><span>'+safe(x.pos)+' · '+safe(x.team)+' · '+x.fields+
    ' season stat categories · '+safe(x.reason)+'</span></div>').join('')+'</div>':
    '<p class="pfo615-health-summary">All starters modeled; completeness of custom scoring bonuses still requires verification.</p>');
 };
 const paint=()=>{
  if(!active())return;
  if(document.querySelector('#roster.page.active')&&typeof pfo52RosterPoints==='function')pfo52RosterPoints();
  if(document.querySelector('#matchup.page.active')&&typeof pfo52Render==='function')pfo52Render();
  showGaps();
  window.ffoStartSit63?.refresh?.();
 };
 const run=async(reason)=>{
  if(pending)return pending;
  if(!active()||!relevant())return null;
  const current=signature();
  if(!current){
   if(typeof loadLiveRoster==='function'&&window.dbLeagueId)void loadLiveRoster();
   return null;
  }
  const changed=!!lastSeen&&lastSeen!==current;
  lastSeen=current;
  const now=Date.now(),loaded=typeof pfo50Independent!=='undefined'&&!!pfo50Independent;
  const loadedAt=typeof pfo50IndependentAt==='number'?pfo50IndependentAt:0;
  const fresh=loaded&&now-loadedAt<staleMs;
  if(!changed&&fresh){paint();return null;}
  if(!changed&&now-attemptedAt<refreshGapMs){paint();return null;}
  attemptedAt=now;
  pending=Promise.resolve().then(()=>pfo50LoadIndependent(changed))
    .catch(err=>{console.warn('PFO automatic MSF evidence update',reason,String(err));return null;})
    .then(result=>{rosterSignature=current;paint();return result;})
    .finally(()=>{pending=null;});
  return pending;
 };
 const queue=reason=>{
  // Paint first, then perform independently licensed statistics retrieval.
  if(active())setTimeout(()=>void run(reason),100);
 };
 const oldRosterLoad=loadLiveRoster;
 loadLiveRoster=function(){
  const result=oldRosterLoad.apply(this,arguments);
  Promise.resolve(result).then(()=>{
   if(signature()&&signature()!==rosterSignature)queue('roster-updated');
  }).catch(()=>{});
  return result;
 };
 function init(){
  if(booted)return;booted=true;
  setTimeout(()=>queue('initial-visible-workspace'),1100);
  // Initial Sleeper snapshot may arrive after first paint. Retry startup
  // checks with bounded cadence rather than waiting for the 5-minute timer.
  let bootPolls=0;
  const bootTimer=setInterval(()=>{
   bootPolls++;
   if(signature()){clearInterval(bootTimer);queue('roster-ready');}
   else if(bootPolls>=24)clearInterval(bootTimer);
   else if(active()&&window.dbLeagueId)void loadLiveRoster();
  },2000);
  document.querySelectorAll('nav button[data-page]').forEach(btn=>
   btn.addEventListener('click',()=>{
    if(['roster','matchup','overview','scouting','market','playerhub'].includes(btn.dataset.page))
     setTimeout(()=>queue('navigation-'+btn.dataset.page),180);
   }));
  document.addEventListener('visibilitychange',()=>{if(active())queue('return-to-app')});
  // Recheck staleness, not every individual rerender or roster polling tick.
  setInterval(()=>{if(active()&&relevant())void run('periodic-staleness')},5*60*1000);
  document.getElementById('ffo69-retry-stats')?.setAttribute('title','Manual fallback; PFO loads independent statistics automatically');
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 window.ffoPfo611={check:()=>run('manual-check'),coverage:showGaps,state:()=>({
  loading:!!pending,last_attempt_at:attemptedAt,roster_loaded:!!signature(),
  last_roster_signature_changed:rosterSignature!==signature()})};
})();