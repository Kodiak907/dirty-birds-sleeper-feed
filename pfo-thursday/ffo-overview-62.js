/* PFO 6.2 Overview: one concise decision briefing. Keeps the original
 * three mode controls, records and standings; no duplicate news or scoreboard. */
(()=>{'use strict';
 const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const f=n=>typeof n==='number'&&Number.isFinite(n)?n.toFixed(1):'—';
 const link=(p,text)=>'<a href="#'+p+'" data-pfo62-go="'+p+'">'+text+'</a>';
 function brief(){
  const host=document.getElementById('briefing');if(!host)return;
  // No hardcoded player, roster, opponent, trade block or score values.
  const seasonWeek=typeof pfo51Week==='function'?pfo51Week():'—';
  const source=typeof pfo51RosterForBrief==='function'?pfo51RosterForBrief():null;
  const roster=source?.players||[],starters=source?.starters||[];
  const own=typeof gm47Snapshot!=='undefined'?gm47Snapshot?.rosters?.find(x=>Number(x.roster_id)===1):null;
  const record=own?.settings?String(own.settings.wins)+'–'+String(own.settings.losses):'—';
  const other=typeof pfo51CurrentOpponent==='function'?pfo51CurrentOpponent():null;
  const mode=typeof pfo49Mode!=='undefined'?pfo49Mode:'morning';
  const health=roster.filter(p=>/^(OUT|IR|PUP|QUESTIONABLE|DOUBTFUL)$/i.test(String(p.sleeper_injury_status||'')));
  const estimates=starters.map(id=>typeof pfo50Estimate==='function'?pfo50Estimate(id):null);
  const available=estimates.filter(x=>typeof x==='number'&&Number.isFinite(x));
  const complete=estimates.length>0&&estimates.length===available.length;
  const starterTotal=complete?available.reduce((sum,x)=>sum+x,0):null;
  const heading=mode==='pregame'?'Pregame preparation':mode==='postgame'?'Previous-week review':'What matters today';
  const panel=(title,description)=>'<section class="pfo62-priority"><strong>'+title+'</strong><p>'+description+'</p></section>';
  let body='<div class="pfo62-head"><div><h2>Dirty Birds · Front Office</h2>'+
   '<p>Week '+html(seasonWeek)+' · '+html(heading)+'</p></div>'+
   '<div class="pfo51-record"><b>'+html(record)+'</b><small>League record</small></div></div>';
  body+='<div class="pfo49-filters">'+[['morning','Today'],['pregame','Pregame'],['postgame','Review']]
   .map(([m,label])=>'<button type="button" data-pfo49-mode="'+m+'" class="'+(m===mode?'on':'')+'">'+label+'</button>').join('')+'</div>';
  body+='<div class="pfo62-facts">'+[
   ['Submitted starters',roster.length?starters.length:'Pending'],
   ['Model coverage',estimates.length?available.length+'/'+estimates.length:'Pending'],
   ['Week opponent',other?.name||'Not confirmed']
  ].map(([title,value])=>'<div><small>'+title+'</small><b>'+html(value)+'</b></div>').join('')+'</div>';
  if(mode==='morning'){
   body+=panel('Roster & availability',roster.length?
    html(roster.length)+' players synced · '+html(health.length)+
    ' current roster injury tag(s). These tags are not proof of gameday inactives. '+
    link('availability','Review Injury Watch'):
    'Current roster information has not loaded. This is a source problem, not a roster clearance.');
   body+=panel('Independent FFL scoring',complete?
    'Starter baseline: <b>'+f(starterTotal)+' modeled FFL points</b>. Not a certified weekly prediction.':
    html(available.length)+' of '+html(estimates.length)+' submitted starters have estimates. Full model total withheld; missing data is never scored as zero.');
   body+=panel('Useful decisions',link('market','Explore trade and waiver options')+
    ' based on current ownership. Player research and source dates are available in '+link('roster','Team News & Intel')+'.');
  }else if(mode==='pregame'){
   const startersSet=new Set(starters.map(String));
   const flagged=health.filter(p=>startersSet.has(String(p.player_id)));
   body+=panel('Check submitted starters',html(starters.length)+' submitted IDs; '+
    html(flagged.length)+' have injury tags requiring a current official check. '+
    link('availability','Verify game-day availability')+'.');
   body+=panel('Opponent preparation',other?
    '<b>'+html(other.name)+'</b> · '+html(other.starters?.length??0)+
    ' published opposing starters. '+link('matchup','Open weekly matchup')+'.':
    'Opposing team is not yet confirmed in the latest league snapshot.');
   body+=panel('Kickoff research','GameCast handles the NFL scoreboard and play-by-play. Weekly Matchup handles team scoring. No lineup decisions are made for you.');
  }else{
   const previous=Math.max(1,Number(seasonWeek)-1);
   const rows=typeof gm47HistorySnapshot!=='undefined'?gm47HistorySnapshot?.matchups_by_week?.[String(previous)]||[]:[];
   const mine=rows.find(x=>Number(x.roster_id)===1);
   const opponent=mine&&rows.find(x=>Number(x.roster_id)!==1&&x.matchup_id===mine.matchup_id);
   body+=panel('Last matchup',mine?.points!=null?'Week '+previous+' · '+html(mine.points)+
    ' league-recorded points'+(opponent?.points!=null?' vs '+html(opponent.points):' · opponent points unavailable')+
    '. This is not an independently certified historical FFL score.':
    'Last completed matchup is not yet verified in the current source snapshot.');
   body+=panel('What to study',link('playerhub','Review player usage')+', '+
    link('market','explore roster options')+', and use Matchup for the next opponent. No historical projection accuracy is claimed without certified scoring.');
  }
  const rosterTime=source?.checked_at||own?.checked_at||null;
  body+='<details class="pfo62-source"><summary>Data freshness & limitations</summary>'+
   '<p>Roster: '+html(rosterTime||'timestamp unavailable')+
   ' · Independent model coverage: '+available.length+'/'+estimates.length+
   '. Status and score sources can lag; no missing evidence is interpreted as a healthy player or zero points.</p></details>';
  host.innerHTML=body;
  host.querySelectorAll('[data-pfo62-go]').forEach(x=>x.addEventListener('click',event=>{
   event.preventDefault();
   const page=x.dataset.pfo62Go;
   document.querySelector('nav button[data-page="'+page+'"]')?.click();
   if(page==='roster')document.querySelector('[data-pfo59-team-tab="news"]')?.click();
  }));
 }
 function init(){
  if(typeof renderBriefing==='function'){renderBriefing=brief;brief();}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
