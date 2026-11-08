/* PFO 6.3 Overview — source-first, manager-specific operations briefing. */
(()=>{'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=x=>typeof x==='number'&&Number.isFinite(x)?x.toFixed(1):'—';
 const link=(page,label)=>'<a href="#'+page+'" data-pfo62-go="'+page+'">'+label+'</a>';
 const panel=(name,body)=>'<section class="pfo62-priority"><strong>'+name+'</strong><p>'+body+'</p></section>';
 const pName=pid=>{try{return pfo49Info(String(pid))?.name||String(pid);}catch{return String(pid)}};
 const status=p=>String(p.sleeper_injury_status||'').toUpperCase();
 function pfo643OverviewCoverage(starters,values){
  const ids=Array.isArray(starters)?starters.map(x=>String(x??'')):[];
  const list=Array.isArray(values)?values:[];
  const measured=list.filter(x=>typeof x==='number'&&Number.isFinite(x));
  const slotsVerified=ids.length===10&&ids.every(x=>x&&x!=='0')&&
   new Set(ids).size===10;
  const covered=slotsVerified&&list.length===10&&measured.length===10;
  const projected=covered?Math.round((measured.reduce((sum,v)=>sum+v,0)+
   Number.EPSILON)*100)/100:null;
  return {covered,projected,measured,required:10,
   distinctStarterSlots:slotsVerified,submittedCount:ids.filter(x=>x&&x!=='0').length};
 }
 function brief(){
  const host=document.getElementById('briefing');if(!host)return;
  const week=typeof pfo51Week==='function'?pfo51Week():'—';
  const snapshot=typeof pfo51RosterForBrief==='function'?pfo51RosterForBrief():null;
  const roster=snapshot?.players||[],starters=snapshot?.starters||[];
  const mine=typeof gm47Snapshot!=='undefined'?gm47Snapshot?.rosters?.find(x=>Number(x.roster_id)===1):null;
  const settings=mine?.settings||null;
  const opponent=typeof pfo51CurrentOpponent==='function'?pfo51CurrentOpponent():null;
  const mode=typeof pfo49Mode!=='undefined'?pfo49Mode:'morning';
  const index=window.ffoPfo59?.marketResearchContext?.()||null;
  // Same week-specific independent FFO model used by Matchup and Trade.
  // A season-wide market value must not substitute for a missing week result.
  const estimate=id=>{
   const result=typeof pfo52Points==='function'?pfo52Points(String(id),Number(week)):null;
   return typeof result?.points==='number'&&Number.isFinite(result.points)?result.points:null;
  };
  const values=starters.map(estimate),coverage=pfo643OverviewCoverage(starters,values),
   measured=coverage.measured,covered=coverage.covered,projected=coverage.projected;
  const reserve=new Set((mine?.reserve||[]).map(String));
  const eligible=roster.filter(p=>!reserve.has(String(p.player_id)));
  const counts={QB:0,RB:0,WR:0,TE:0,K:0,DEF:0};
  for(const p of eligible){const pos=String(p.position||'').toUpperCase().replace('D/ST','DEF');if(pos in counts)counts[pos]++;}
  const slots=(index?.slots||[]).map(x=>String(x).toUpperCase());
  const depthTarget={QB:Math.max(1,slots.filter(x=>x==='QB').length)+1,
   RB:Math.max(1,slots.filter(x=>x==='RB').length)+2,
   WR:Math.max(1,slots.filter(x=>x==='WR').length)+2,
   TE:Math.max(1,slots.filter(x=>x==='TE').length)+1};
  const shortages=Object.keys(depthTarget).filter(p=>counts[p]<depthTarget[p])
   .map(p=>p+' '+counts[p]+'/'+depthTarget[p]);
  const uncertain=roster.filter(p=>/^(OUT|QUESTIONABLE|DOUBTFUL|IR|PUP|NFI)$/.test(status(p)));
  const selected=new Set(starters.map(String));
  const affected=uncertain.filter(p=>selected.has(String(p.player_id)));
  const leagueBudget=Number(typeof gm47Snapshot!=='undefined'?gm47Snapshot?.league?.settings?.waiver_budget:NaN);
  const spent=Number(settings?.waiver_budget_used);
  const remaining=Number.isFinite(leagueBudget)&&leagueBudget>0&&Number.isFinite(spent)?
   Math.max(0,leagueBudget-spent):null;
  const previous=Math.max(1,Number(week)-1),played=typeof gm47HistorySnapshot!=='undefined'?
   gm47HistorySnapshot?.matchups_by_week?.[String(previous)]||[]:[];
  const result=played.find(x=>Number(x.roster_id)===1);
  const rival=result&&played.find(x=>Number(x.roster_id)!==1&&x.matchup_id===result.matchup_id);
  const outcome=result?.points!=null&&rival?.points!=null?
   (result.points>rival.points?'Win':result.points<rival.points?'Loss':'Tie'):null;
  const margin=outcome?Math.abs(Number(result.points)-Number(rival.points)).toFixed(2):null;
  const heading=mode==='pregame'?'Game-week preparation':mode==='postgame'?'Previous-week review':'Current team priorities';
  let body='<div class="pfo62-head"><div><h2>Dirty Birds · Front Office</h2>'+
   '<p>Week '+esc(week)+' · '+esc(heading)+'</p></div><div class="pfo51-record"><b>'+
   esc(settings?String(settings.wins)+'–'+String(settings.losses):'Pending')+
   '</b><small>League record</small></div></div>';
  body+='<div class="pfo49-filters">'+[['morning','Today'],['pregame','Pregame'],['postgame','Review']]
   .map(([value,label])=>'<button type="button" data-pfo49-mode="'+value+
   '" class="'+(mode===value?'on':'')+'">'+label+'</button>').join('')+'</div>';
  body+='<div class="pfo62-facts">'+[
   ['Starting slots',roster.length?starters.length:'Not synced'],
   ['Model coverage',values.length?measured.length+'/10':'Pending'],
   ['Next opponent',opponent?.name||'Unconfirmed']
  ].map(([label,value])=>'<div><small>'+label+'</small><b>'+esc(value)+'</b></div>').join('')+'</div>';
  if(mode==='morning'){
   body+=panel('Roster watch',roster.length?
    (affected.length?'<b>'+affected.length+' submitted starter(s) require availability review:</b> '+
      affected.slice(0,4).map(p=>esc(p.name)+' ('+esc(status(p))+')').join(' · ')+'. ':
      (uncertain.length?uncertain.length+' rostered players have injury/IR tags, none confirmed as starting alerts. ':
        'No current roster injury tags observed; this does not establish NFL clearance. '))+
     link('availability','Injury Watch'):
     'Ownership data not yet synced. Current team availability is unknown.');
   body+=panel('Positional depth',shortages.length?
    'Against a simple bench-depth target: <b>'+esc(shortages.join(' · '))+
    '</b>. These are roster counts, not verified talent or performance deficits. '+link('market','Research waivers'):
    'No basic QB/RB/WR/TE depth-count gaps in the active roster. '+link('market','Explore value upgrades')+'.');
   body+=panel('Scoring & decision readiness',covered?
    'Provisional submitted-starter baseline: <b>'+num(projected)+
    ' FFL points</b>. It is not a validated opponent-adjusted forecast.':
    'Independent starter estimates available for <b>'+measured.length+'/10'+
    '</b>. Full weekly total withheld; compare players in the Market while historical score certification continues.');
   body+=panel('Market pulse',remaining!==null?
    'Published budget arithmetic suggests $'+esc(remaining)+' remaining FAAB, pending live transaction verification. '+
      link('market','Review trade and waiver pairs')+'.':
    link('market','Review screened trade packages and waiver pairs')+
      '. Financial balances cannot be inferred without current league settings.');
  }else if(mode==='pregame'){
   body+=panel('Starter availability',affected.length?
    '<b>'+affected.length+' potentially affected starters:</b> '+affected.slice(0,6).map(p=>esc(p.name)+
    ' ('+esc(status(p))+')').join(' · ')+'. '+link('availability','Verify current reports')+'.':
    esc(starters.length)+' starter IDs submitted; no starter injury tag in the current roster metadata. '+
    link('availability','Verify current-week inactives and questionable players')+'.');
   body+=panel('Opponent scouting',opponent?
    '<b>'+esc(opponent.name)+'</b> · '+esc(opponent.starters?.length||0)+
    ' published opposing starters. '+link('matchup','Review opposing roster and lineup')+'.':
    'No independently verified opponent starting group available.');
   body+=panel('Flex and bench options',shortages.length?
    'Current backup depth-watch positions: '+esc(shortages.join(' · '))+
    '. '+link('roster','Review roster usage and substitutions')+'.':
    'There are no obvious roster-count gaps. '+link('roster','Compare bench roles and player usage')+'.');
   body+=panel('Kickoff research','GameCast handles NFL scores and drives. '+link('matchup','Weekly Matchup')+
    ' handles submitted starters. Availability and workload are separate source checks, not guaranteed projections.');
  }else{
   body+=panel('Last matchup result',outcome?
    '<b>'+outcome+' by '+margin+' points</b> · Week '+previous+' league-recorded '+
     esc(result.points)+' vs '+esc(rival.points)+'. This is league history, not certified independent FFO scoring.':
    result?.points!=null?'Week '+previous+': '+esc(result.points)+
     ' league-recorded points. The opponent result is unavailable.':
    'Previous-week matchup score was not found in the current source snapshot.');
   const top=result?.players_points&&typeof result.players_points==='object'?
    Object.entries(result.players_points).filter(([pid])=>(result.starters||[]).map(String).includes(String(pid)))
     .filter(([,points])=>typeof Number(points)==='number'&&Number.isFinite(Number(points)))
     .sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,3):[];
   body+=panel('Top recorded starter contributions',top.length?
    top.map(([id,points])=>esc(pName(id))+' · '+Number(points).toFixed(2)+' pts').join(' · ')+
    '. League-recorded scoring, pending independent reconciliation.':
    'Player-specific final contribution data has not been certified or published.');
   body+=panel('Next-week opportunities',shortages.length?'Depth areas worth scouting: '+
    esc(shortages.join(' · '))+'. '+link('market','Explore replacement options')+'.':
    link('market','Research upgrades and waiver replacements')+
    '. Use Player Intel to compare usage trends before changing starters.');
  }
  const submitted=starters.filter(id=>id&&id!=='0').map(id=>{
   const player=typeof pfo52Info==='function'?pfo52Info(String(id)):roster.find(x=>String(x.player_id)===String(id));
   const score=estimate(id),provider=typeof pfo52Points==='function'?pfo52Points(String(id),Number(week)):null;
   return {id:String(id),name:player?.name||pName(id),position:player?.position||'?',
    score,status:String(player?.sleeper_injury_status||''),source:provider?.source||'Independent model pending'};
  });
  const known=submitted.filter(x=>x.score!==null).sort((a,b)=>b.score-a.score);
  const missing=submitted.filter(x=>x.score===null);
  const lines=known.slice(0,5).map(x=>'<span class="pfo615-brief-player"><b>'+esc(x.position)+' · '+esc(x.name)+'</b><strong>'+num(x.score)+' FFL</strong></span>').join('');
  const miss=missing.slice(0,6).map(x=>'<span class="pfo615-brief-missing">'+esc(x.name)+' · '+esc(x.source)+'</span>').join('');
  body+=panel('Submitted lineup · individual model coverage',
   '<div class="pfo615-brief-stats">'+(lines||'<span>No independent starter projections verified yet.</span>')+'</div>'+
   (missing.length?'<p class="pfo615-brief-warning"><b>'+missing.length+' missing individual model estimates:</b></p>'+
     '<div class="pfo615-brief-missing-list">'+miss+'</div>':
     '<p class="pfo615-brief-good">'+(coverage.distinctStarterSlots?'All ten submitted starter slots have individual model outputs; validation remains provisional.':'Submitted starter slots are incomplete or duplicated; a full FFL team total is withheld.')+'</p>')+
   '<small>Showing the highest available model estimates, NOT ranking your starting decisions. '+link('matchup','Inspect every submitted starter')+'.</small>');
  const selectedIds=new Set(starters.map(String));
  const available=eligible.filter(p=>!selectedIds.has(String(p.player_id)));
  const ranked=available.map(p=>({name:p.name,position:p.position,score:estimate(p.player_id)}))
    .filter(x=>x.score!==null).sort((a,b)=>b.score-a.score).slice(0,4);
  body+=panel('Bench research · flexibility and coverage',
   '<p>'+available.length+' eligible non-starter(s) in the current Sleeper roster. '+
   (ranked.length?'Sourced research baselines:</p><div class="pfo615-brief-stats">'+ranked.map(x=>
    '<span class="pfo615-brief-player"><b>'+esc(x.position)+' · '+esc(x.name)+'</b><strong>'+num(x.score)+' FFL</strong></span>').join('')+'</div>':
    'No independently modeled bench forecasts currently available.</p>')+
   '<small>These are descriptive estimates, not proposed starter changes. '+link('matchup','Compare in Start/Sit')+'.</small>');
  const oppStarters=(opponent?.starters||[]).map(x=>typeof x==='object'?(x.player_id||x.id):x).filter(Boolean);
  const oppNames=oppStarters.slice(0,3).map(id=>esc(pName(id)));
  body+=panel('Opponent intelligence · verified matchup context',
   '<p><b>'+esc(opponent?.name||'FFL pairing not yet confirmed')+'</b> · '+
   esc(oppStarters.length)+' identified starter(s) in the latest paired record. '+
   (oppNames.length?'Published players: '+oppNames.join(' · ')+'. ':'')+
   'Source: Sleeper FFL matchup; the opposing manager can change submissions.</p>'+
   link('matchup','Review opposing starters and week-specific estimates')+'.');
  const newsEntries=roster.slice(0,25).flatMap(p=>{
   const articles=typeof pfo49PublishedNews==='function'?pfo49PublishedNews(p.player_id):[];
   const first=articles?.[0];return first?.title&&/^https:\/\//.test(first.url||'')?[{player:p.name||'Player',...first}]:[];
  }).slice(0,3);
  body+=panel('Player news · source-linked developments',
   newsEntries.length?'<div class="pfo615-brief-news">'+newsEntries.map(n=>
    '<a href="'+esc(n.url)+'" target="_blank" rel="noopener noreferrer"><b>'+esc(n.player)+'</b> · '+
    esc(n.title)+' <small>'+esc(n.published_at||n.published||'Publication time not verified')+'</small></a>').join('')+'</div>'+
     '<small>Headlines are attributed reports, not official injury clearance.</small>':
     '<p>No dated, directly linked player reporting was returned by the connected feed. '+link('playerhub','Open Player Intel')+'.</p>');
  body+='<details class="pfo62-source"><summary>Data freshness & limitations</summary>'+
   '<p>Roster snapshot: '+esc(snapshot?.checked_at||index?.snapshotAt||'unverified')+
   '. Independent estimates: '+measured.length+'/'+values.length+
   '. Fantasy tags are not official game-day inactive reports. Historical score certification is still incomplete.</p></details>';
  host.innerHTML=body;
  host.querySelectorAll('[data-pfo62-go]').forEach(anchor=>anchor.addEventListener('click',event=>{
   event.preventDefault();
   const page=anchor.dataset.pfo62Go;
   document.querySelector('nav button[data-page="'+page+'"]')?.click();
   if(page==='roster')document.querySelector('[data-pfo59-team-tab="news"]')?.click();
  }));
 }
 function init(){if(typeof renderBriefing==='function'){renderBriefing=brief;brief();}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
