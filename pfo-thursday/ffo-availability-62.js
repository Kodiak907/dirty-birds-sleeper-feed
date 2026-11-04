/* FFO PFO 6.2: read-only, dated reserve/return-window classification.
 * Not medical clearance and not first-party waiver eligibility. FFOI will
 * eventually supply verified official club actions to this same boundary.
 */
(()=>{'use strict';
 const sourceFlags=Object.freeze({
  '4881':{id:'4881',name:'Lamar Jackson',status:'EXPECTED_IR',asOf:'2026-11-01T18:38:00-05:00',
   source:'Baltimore Ravens',source_url:'https://www.baltimoreravens.com/news/lamar-jackson-thumb-injured-ravens-bills-2026'},
  '6904':{id:'6904',name:'Jalen Hurts',status:'IR',asOf:'2026-10-17T18:14:00-04:00',
   source:'Philadelphia Eagles',source_url:'https://www.philadelphiaeagles.com/news/eagles-place-jalen-hurts-on-injured-reserve-sign-jaydon-blue-to-the-active-roster-2026-nfl-week-6-panthers'}
 });
 const when=x=>{const v=Date.parse(String(x||''));return Number.isFinite(v)?v:null};
 const normalized=x=>String(x??'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const https=x=>/^https:\/\/[a-z0-9.-]+\//i.test(String(x||''));
 const reserve=x=>/\bIR\b|\bPUP\b|\bNFI\b|INJURED[ _-]?RESERVE|SEASON[ _-]?ENDING|OUT[ _-]?FOR[ _-]?SEASON|EXPECTED[ _-]?IR/i.test(String(x||''));
 const kind=x=>String(x?.action_code||x?.type||'').toUpperCase().replace(/[\s-]+/g,'_');
 function latestClubAction(player,actions=[]){
  const pid=String(player.id||player.player_id||'');
  const name=normalized(player.name),team=String(player.team||'').toUpperCase();
  return (Array.isArray(actions)?actions:[]).filter(action=>{
   const sameId=pid&&String(action.player_id||'')===pid;
   const sameName=name&&normalized(action.name||action.player)===name;
   const sameTeam=!team||!action.team||String(action.team).toUpperCase()===team;
   return (sameId||sameName&&sameTeam)&&https(action.source_url)&&when(action.date||action.at||action.as_of)!==null;
  }).sort((a,b)=>when(b.date||b.at||b.as_of)-when(a.date||a.at||a.as_of))[0]||null;
 }
 function classify(player={},actions=[],now=Date.now()){
  const pid=String(player.id||player.player_id||''),name=normalized(player.name);
  const flag=sourceFlags[pid]||Object.values(sourceFlags).find(x=>normalized(x.name)===name)||null;
  const metadataStatus=[player.injury_status,player.status,player.roster_status,
   player.season_status,player.availability_status].filter(Boolean).join(' · ');
  const action=latestClubAction(player,actions),actionTime=when(action?.date||action?.at||action?.as_of);
  const baselineTime=when(flag?.asOf)||0;
  const newAction=!!action&&actionTime!==null&&actionTime>=baselineTime;
  const label=kind(action);
  const movedToReserve=newAction&&/PLACED_ON_IR|INJURED_RESERVE|EXPECTED_IR|OUT_FOR_SEASON|SEASON_ENDING/.test(label);
  const activated=newAction&&/ACTIVATED_FROM_IR|REMOVED_FROM_IR|RETURNED_TO_ACTIVE_ROSTER/.test(label);
  const clubWindow=newAction&&/PRACTICE_WINDOW_OPEN|PRACTICE_WINDOW_OPENED|DESIGNATED_TO_RETURN/.test(label)&&
   actionTime<=now&&now-actionTime<=21*86400000;
  const evidence=player.verified_practice_window||player.practice_window_evidence;
  const windowAt=when(evidence?.opened_at||evidence?.date);
  const documentedWindow=evidence?.verified===true&&https(evidence.source_url)&&
   windowAt!==null&&windowAt>=baselineTime&&windowAt<=now&&now-windowAt<=21*86400000&&
   (!movedToReserve||windowAt>actionTime);
  const windowOpen=!!(clubWindow||documentedWindow);
  const release=activated||windowOpen;
  const blocked=(reserve(metadataStatus)||!!flag||movedToReserve)&&!release;
  const sourceAction=(movedToReserve||activated||clubWindow)&&action;
  return {standardEligible:!blocked,irTabEligible:blocked,
   status:blocked?'reserve_only':windowOpen?'practice_window':'standard',
   practiceWindowOpen:windowOpen,
   source:sourceAction?String(action.source||'Official team report'):flag?.source||null,
   sourceUrl:sourceAction?action.source_url:flag?.source_url||null,
   sourceDate:sourceAction?String(action.date||action.at||action.as_of):flag?.asOf||null,
   reason:blocked?'IR / long-term reserve evidence; no currently verified return window':
    windowOpen?'Verified 21-day practice window (not game-day clearance)':
    activated?'Dated club activation (not game-day clearance)':'No current long-term reserve evidence in supplied sources',
   metadataStatus:metadataStatus||null};
 }
 window.ffoAvailability62=Object.freeze({classify,sourceFlags});
})();
