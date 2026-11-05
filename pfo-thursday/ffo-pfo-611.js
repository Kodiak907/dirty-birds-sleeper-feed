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
  const el=document.getElementById('ffo69-stats-status');
  const r=getRoster();if(!el||!r?.players?.length)return;
  const wk=typeof pfo52Cur==='function'?pfo52Cur():Number(window.dbNflWeek||0);
  const ids=(r.starters||[]).map(String).filter(id=>id&&id!=='0');
  const missing=[],good=[];
  for(const id of ids){
   const p=typeof pfo52Info==='function'?pfo52Info(id):null;
   const pts=typeof pfo52Points==='function'?pfo52Points(id,wk):null;
   if(pts?.points!=null&&Number.isFinite(Number(pts.points)))good.push(id);
   else if(pts?.bye)missing.push((p?.name||id)+' (verified bye)');
   else{
    const pos=typeof pfo52Pos==='function'?pfo52Pos(p):p?.position;
    const row=typeof pfo50StatsFor==='function'?pfo50StatsFor(id):null;
    const why=['K','DEF'].includes(pos)?'specialist/defense evidence incomplete':
      row?'FFL statistical fields incomplete':'MSF identity/statistics not matched';
    missing.push((p?.name||id)+' ('+why+')');
   }
  }
  let sub=document.getElementById('pfo611-coverage-report');
  if(!sub){sub=document.createElement('div');sub.id='pfo611-coverage-report';
   sub.className='note';sub.style.cssText='font-size:11px;line-height:1.5;margin-top:8px';
   el.insertAdjacentElement('afterend',sub);}
  sub.textContent='W'+wk+' independently modeled starters: '+good.length+'/'+ids.length+
    (missing.length?' · Missing: '+missing.join('; '):' · All submitted starters have FFO estimates')+
    '. Source gaps are not zero-point predictions.';
 };
 const paint=()=>{
  if(!active())return;
  if(document.querySelector('#roster.page.active')&&typeof pfo52RosterPoints==='function')pfo52RosterPoints();
  if(document.querySelector('#matchup.page.active')&&typeof pfo52Render==='function')pfo52Render();
  showGaps();
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