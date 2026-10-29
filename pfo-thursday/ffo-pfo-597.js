/* FFO PFO 5.9.7 · Coach's waiver, FFL valuation, verified-week forecast patch.
 * Independent NFL stats for forecasts; Sleeper only rosters/ownership and final league results.
 * Never invent a player score, medical clearance, free-agent status or opponent.
 */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=(n,d=1)=>n!=null&&Number.isFinite(Number(n))?Number(n).toFixed(d):'Unverified';
 const signed=n=>n==null||!Number.isFinite(Number(n))?'Unverified':(n>0?'+':'')+Number(n).toFixed(2);
 const norm=x=>String(x??'').toLowerCase().replace(/[^a-z0-9]/g,'').replace(/(?:jr|sr|ii|iii|iv)$/,'');
 const canonical=t=>typeof gm47CanonicalTeam==='function'?gm47CanonicalTeam(t):String(t||'').toUpperCase();
 // Official FFO scoring file is the model's authority; Sleeper remains roster/history only.
 let frozenFFLRules=null,rulesPending=null;
 const FFL_SUPPORTED_STATS=['pass_yd','pass_td','pass_int','pass_int_td','rush_yd','rush_td','rush_att','rush_40p','rush_td_40p','rush_td_50p','rec','rec_yd','rec_td','rec_td_40p','rec_td_50p','pass_td_40p','pass_td_50p','fum_lost','fum','rush_2pt','rec_2pt','pass_2pt','pass_cmp','pass_att','fgm_0_19','fgm_20_29','fgm_30_39','fgm_40_49','fgm_50_59','fgm_60p','fgmiss','xpm','xpmiss','sack','int','def_td','ff','fum_rec','safe','blk_kick'];
 const frozenScore=(stats)=>{
  if(!stats||!frozenFFLRules)return null;
  let points=0,observed=0;
  for(const stat of FFL_SUPPORTED_STATS){
   const multiplier=Number(frozenFFLRules[stat]||0);
   if(!Number.isFinite(multiplier)||multiplier===0)continue;
   if(stats[stat]===null||stats[stat]===undefined||stats[stat]==='')continue;
   const count=Number(stats[stat]);
   if(!Number.isFinite(count))continue;
   points+=multiplier*count;observed++;
  }
  return observed?{points,partial:true,source:'FFO_FFL_SCORING_V1.json × NFL statistical categories · unverified bonuses/tiers are excluded'}:null;
 };
 if(typeof pfo49ScoreFromStats==='function')pfo49ScoreFromStats=frozenScore;
 const loadFFLRules=()=>{
  if(frozenFFLRules)return Promise.resolve(frozenFFLRules);
  if(rulesPending)return rulesPending;
  if(typeof fetch!=='function')return Promise.resolve(null);
  rulesPending=(async()=>{
   try{
    const response=await fetch('/FFO_FFL_SCORING_V1.json',{cache:'force-cache'});
    if(!response.ok)throw Error('FFO scoring file HTTP '+response.status);
    const payload=await response.json();
    if(payload?.schema!=='FFO_SCORING_RULES_V1'||!payload.scoring||Object.keys(payload.scoring).length<100)throw Error('FFL scoring schema incomplete');
    frozenFFLRules=payload.scoring;
    estimateCache.clear();
    try{
     if(typeof tb45Data!=='undefined'&&tb45Data?.snap&&typeof pfo50TradeRos==='function')tb45Data.ros=pfo50TradeRos();
    }catch(err){console.warn('FFO trade model refresh pending',err)}
    redraw();
    if(document.querySelector('#market.page.active [data-pfo59-market-panel="trade"]:not([hidden])')&&typeof renderTradeScouting==='function')renderTradeScouting();
    return frozenFFLRules;
   }catch(err){console.warn('FFO frozen-scoring file unavailable; independent point estimates withheld',err);return null;}
   finally{rulesPending=null;}
  })();
  return rulesPending;
 };
 let verifiedSchedule=null,loadPending=null,lastTrade=null;
 let estimateIndexRef=null;const estimateCache=new Map();
 const originalEstimate=typeof pfo50Estimate==='function'?pfo50Estimate:null;
 const weekRow=(team,week)=>{
  const rows=verifiedSchedule?.teams;
  const t=canonical(team),key=String(week);
  return rows?.[t]?.weeks?.[key]||rows?.[t]?.weeks?.[Number(week)]||null;
 };
 const sourceForecast=id=>{
  const index=typeof pfo50Indexed==='undefined'?null:pfo50Indexed;
  if(index!==estimateIndexRef){estimateIndexRef=index;estimateCache.clear();}
  const key=String(id);
  if(estimateCache.has(key))return estimateCache.get(key);
  const evaluate=()=>{
  if(originalEstimate){
   const a=originalEstimate(id);if(a!=null&&Number.isFinite(a))return {points:a,source:'FFO independent NFL-stat forecast under FFL scoring'};
  }
  if(typeof pfo50Indexed==='undefined'||!pfo50Indexed?.size||typeof pfo50Score!=='function')return null;
  const p=typeof pfo52Info==='function'?pfo52Info(id):null;
  if(!p?.name||!p?.team)return null;
  const rows=[...pfo50Indexed.values()].filter(x=>canonical(x.team)===canonical(p.team)&&norm(x.name)===norm(p.name));
  if(rows.length!==1)return null;
  const row=rows[0];
  if(row.forecast){
   const pts=pfo50Score(row.forecast);
   if(pts!=null&&Number.isFinite(pts))return {points:pts,source:'FFO NFL-stat model · verified same-team player mapping'};
  }
  const games=(row.games||[]).filter(x=>Number.isFinite(Number(x.week))).sort((a,b)=>Number(a.week)-Number(b.week));
  const scores=games.map(g=>pfo50Score(g.stats||g)).filter(v=>v!=null&&Number.isFinite(v));
  const seasonTotal=row.season_totals?pfo50Score(row.season_totals):null;
  const played=Number(row.games_played||row.season_totals?.games_played||row.season_totals?.games||scores.length||0);
  const seasonMean=seasonTotal!=null&&Number.isFinite(played)&&played>0?seasonTotal/played:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null;
  if(seasonMean==null)return null;
  if(scores.length>=2){
   const recent=scores.slice(-3),last=recent.reduce((a,b)=>a+b,0)/recent.length;
   return {points:0.65*last+0.35*seasonMean,source:'FFO independently reconstructed FFL points · 65% last 3 / 35% season · no unsupported injury adjustment'};
  }
  if(played>=2)return {points:seasonMean,source:'FFO independent NFL-season stats / verified games played · low-confidence average'};
  return null;
  };
  const computed=evaluate();estimateCache.set(key,computed);return computed;
 };
 // A single independently scored forecast feeds Team HQ, weekly matchup, trade
 // analysis and playoff calendar. It replaces a null-only native forecast, not NFL facts.
 if(originalEstimate)pfo50Estimate=function(id){return sourceForecast(id)?.points??null;};
 if(typeof pfo49ProjectedWeek==='function'){
  const originalProjectedWeek=pfo49ProjectedWeek;
  pfo49ProjectedWeek=function(id,w){
   const p=typeof pfo52Info==='function'?pfo52Info(id):null,row=weekRow(p?.team,w);
   if(row?.bye===true)return null;
   if(row?.opponent)return sourceForecast(id)?.points??null;
   if(verifiedSchedule&&p?.team)return null;
   return originalProjectedWeek(id,w);
  };
 }
 const basePoints=typeof pfo52Points==='function'?pfo52Points:null;
 if(basePoints){
  pfo52Points=function(id,week,past=false){
   if(past)return basePoints(id,week,past);
   const info=typeof pfo52Info==='function'?pfo52Info(id):null;
   const pos=String(info?.position||'').toUpperCase(),team=canonical(info?.team);
   const row=weekRow(team,week);
   if(row?.bye===true)return {points:null,bye:true,source:'VERIFIED NFL BYE · week '+week,adjustment:null};
   if(verifiedSchedule&&team&&Object.hasOwn(verifiedSchedule.teams||{},team)&&!row&&pos!=='DEF')return {points:null,schedulePending:true,source:'No verified Week '+week+' schedule row for '+team,adjustment:null};
   if(row?.opponent){
    // Earlier 5.9.6 withholding was correct before the schedule loaded; once
    // the sourced schedule verifies a playing week, it cannot continue to hide the model.
    const v=sourceForecast(id);
    if(v)return {...v,bye:false,adjustment:null,opponent:row.opponent};
    return {points:null,bye:false,source:'FFO projection pending: NFL player-stat model has no supported sample',modelPending:true,opponent:row.opponent,adjustment:null};
   }
   return basePoints(id,week,past);
  };
 }
 function redraw(){
  try{if(document.querySelector('#matchup.page.active')&&typeof pfo52Render==='function')pfo52Render();}catch(e){console.warn('FFO matchup redraw',e)}
  try{if(document.querySelector('#championship.page.active')&&typeof pfo52Championship==='function')pfo52Championship();else if(document.querySelector('#championship.page.active')&&typeof pfo49RenderPlanner==='function')pfo49RenderPlanner();}catch(e){console.warn('FFO championship redraw',e)}
  try{if(document.querySelector('#roster.page.active')&&typeof pfo50RenderProjectedLineup==='function')pfo50RenderProjectedLineup();}catch(e){console.warn('FFO team model redraw',e)}
  try{if(document.querySelector('#market.page.active [data-pfo59-market-panel="waiver"]:not([hidden])')&&window.ffoPfo59?.openMarket)window.ffoPfo59.openMarket('waiver');}catch(e){console.warn('FFO waiver leaderboard redraw',e)}
 }
 async function loadSchedule(){
  if(verifiedSchedule||loadPending)return loadPending;
  if(typeof fetchReport!=='function')return null;
  loadPending=(async()=>{try{
   const d=await fetchReport('nfl_schedule.json');
   if(!d?.teams||Object.keys(d.teams).length<30)throw Error('NFL schedule evidence incomplete');
   verifiedSchedule=d;redraw();return d;
  }catch(e){console.warn('FFO schedule unavailable; forecasts withheld for unverified byes',e);return null;}
  finally{loadPending=null;}})();
  return loadPending;
 }
 // Data refreshes can arrive after page paint. Repaint only the active tool.
 if(typeof pfo50LoadIndependent==='function'){
  const original=pfo50LoadIndependent;
  pfo50LoadIndependent=async function(...args){const v=await original(...args);if(v)redraw();return v;};
 }
 // Keep legacy full-PPR market screens archived in source, not visible as FFL valuations.
 // Preserve existing manual comparison inputs and event routing; only remove irrelevant
 // pricing sections from the mobile trade report.
 if(typeof renderTradeScouting==='function'&&typeof tb48FeatureHTML==='function'){
  renderTradeScouting=function(){
   const host=$('trade-intel'),fold=$('trade-fold');
   if(!host||!fold?.open||!document.querySelector('#market.page.active [data-pfo59-market-panel="trade"]:not([hidden])'))return;
   host.innerHTML='<div class="pfo597-trade-report"><h3>FFO FFL trade research</h3><p class="pfo597-rank-note">Uses the frozen league-specific scoring model and independent NFL statistics. The legacy full-PPR pricing display is excluded.</p>'+tb48FeatureHTML()+'</div>';
  };
 }
 if(typeof tb48ReportHTML==='function'){
  tb48ReportHTML=function(z){
   lastTrade=z;
   const sides=[['Dirty Birds sends',z.give],['Dirty Birds receives',z.take]];
   const projection=id=>{
    const p=typeof tb45Player==='function'?tb45Player(id):null;
    const v=sourceForecast(id);
    return {p,pts:v?.points??null,source:v?.source||'NFL-derived FFL forecast unavailable'};
   };
   const sum=ids=>{const vals=ids.map(projection);return vals.every(v=>v.pts!=null)?vals.reduce((a,b)=>a+b.pts,0):null;};
   const out=sum(z.give),incoming=sum(z.take),difference=out!=null&&incoming!=null?incoming-out:null;
   const outcome=difference==null?'FFL model coverage incomplete':Math.abs(difference)<0.5?'Comparable FFL projected package output':difference>0?'Dirty Birds receives higher projected FFL production':'Dirty Birds sends higher projected FFL production';
   const row=(title,ids)=>'<section class="pfo597-trade-half"><h4>'+esc(title)+'</h4>'+
    ids.map(id=>{const x=projection(id);return '<div class="pfo597-trade-person">'+(/^[0-9]{2,9}$/.test(String(id))?'<img class="pfo598-eval-photo" alt="" loading="lazy" src="https://sleepercdn.com/content/nfl/players/thumb/'+esc(id)+'.jpg" onerror="this.hidden=true">':'')+'<button type="button" class="pfo597-player-link" data-pfo49-id="'+esc(id)+'">'+esc(x.p?.name||id)+'</button><span>'+fmt(x.pts,2)+' <small>FFL PPG*</small></span></div>';}).join('')+'</section>';
   let h='<section class="pfo597-trade-report" aria-live="polite"><div class="pfo597-trade-title"><h3>FFL-specific trade evaluation</h3><span>'+z.give.length+' FOR '+z.take.length+'</span></div>'+
    '<p class="pfo597-rank-note">FFO independently scores NFL performance using the league’s actual custom scoring rules. No full-PPR market-value scale or outside trade price is used to grade this package.</p>'+
    '<div class="pfo597-trade-result"><b>'+esc(outcome)+'</b><span>Outgoing '+fmt(out)+' / Incoming '+fmt(incoming)+' projected FFL points per game · Net '+signed(difference)+'*</span></div>'+
    '<div class="pfo597-trade-sides">'+sides.map(x=>row(...x)).join('')+'</div>'+
    '<div class="pfo597-trade-sides"><div><h4>Dirty Birds</h4><b>'+signed(z.ourDelta)+' starter PPG impact</b><p>Depth proxy '+signed(z.ourBenchDelta)+' PPG</p></div>'+
    '<div><h4>'+esc(typeof tb45Manager==='function'?tb45Manager(z.x.opponent):'Opposing manager')+'</h4><b>'+signed(z.theirDelta)+' starter PPG impact</b><p>Depth proxy '+signed(z.theirBenchDelta)+' PPG</p></div></div>';
   if(z.ourCut.length||z.theirCut.length)h+='<p class="pfo597-trade-warning">Hypothetical roster cuts only: Dirty Birds '+esc(z.ourCut.map(id=>tb45Player(id).name).join(', ')||'none')+' · Opponent '+esc(z.theirCut.map(id=>tb45Player(id).name).join(', ')||'none')+'. Nothing is submitted.</p>';
   if(z.injuryFlags?.length)h+='<p class="pfo597-trade-warning">Injury flags require official verification: '+esc(z.injuryFlags.join(', '))+'</p>';
   h+='<details><summary>FFL calculation and source limitations</summary><p>*Projected FFL points per game are independent recent-form estimates from NFL statistics, not future game results, guaranteed trade prices or true manager willingness. The two sides’ package totals are not equivalent to lineup improvement. Missing data is shown as unverified rather than zero. Opponent, byes, snaps, injury decisions and each team’s roster structure matter.</p><p>Roster membership is read from Sleeper only; NFL performance comes from independent data. No full-PPR valuation influences the displayed recommendation.</p></details>';
   h+='<button class="pfo597-copy-trade" type="button" data-pfo597-copy-trade>Copy FFL evaluation</button><span class="pfo597-foot">Research only · never sends a trade</span></section>';
   return h;
  };
 }
 document.addEventListener('click',event=>{
  const btn=event.target.closest('[data-pfo597-copy-trade]');
  if(!btn||!lastTrade)return;
  const z=lastTrade;
  const idToName=id=>typeof tb45Player==='function'?tb45Player(id).name:id;
  const text=['FFO · UNSENT FFL TRADE RESEARCH',
   'Give: '+z.give.map(idToName).join(' + '),
   'Receive: '+z.take.map(idToName).join(' + '),
   'Dirty Birds starting-lineup impact: '+signed(z.ourDelta)+' projected FFL PPG',
   'Opponent starting-lineup impact: '+signed(z.theirDelta)+' projected FFL PPG',
   'No full-PPR market valuation. Independent NFL-stat FFL scoring model; missing projections unverified. No trade submitted.'].join('\n');
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>{btn.textContent='Copied';}).catch(()=>{btn.textContent='Copy unavailable';});
 });
 document.addEventListener('DOMContentLoaded',()=>{void loadFFLRules();void loadSchedule();},{once:true});
 if(document.readyState!=='loading'){void loadFFLRules();void loadSchedule();}
 const nav=$('nav');
 nav?.addEventListener('click',event=>{
  const page=event.target.closest('[data-page]')?.dataset.page;
  if(page==='matchup'||page==='championship'||page==='roster')void loadSchedule();
  if(page==='availability'){
   // Show existing source state immediately instead of an indefinitely empty panel.
   const root=$('injuries');
   if(root&&!root.children.length)root.innerHTML='<tr><td colspan="3">Checking roster-specific NFL injury reports. Previous data is not medical clearance.</td></tr>';
   if(typeof updateInjuryView==='function'&&(typeof liveRosterSnapshot!=='undefined'&&liveRosterSnapshot))updateInjuryView();
   if(typeof refreshInjuryOnly==='function'&&typeof injuryBusy!=='undefined'&&!injuryBusy)void refreshInjuryOnly();
  }
 });
 window.ffoPfo597={verifiedSchedule:()=>verifiedSchedule,forecast:sourceForecast,loadSchedule,loadFFLRules,scoreFrozen:frozenScore,hasFrozenRules:()=>!!frozenFFLRules};
})();