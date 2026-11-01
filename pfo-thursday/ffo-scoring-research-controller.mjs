/**
 * PFO read-only MSF 2026 historical reconstruction controller.
 * User-triggered two-game batches avoid competing with live 5s GameCast.
 * Production scoring and projections are HARD-DISABLED until source-certified.
 */
import {buildLeagueHistoryCoverage,nextLeagueHistoryBatch}
 from './ffo-league-history-pipeline.mjs';
import {walkForwardBacktest} from './ffo-verified-history-backtest.mjs';
import {calendarWeek} from './ffo-gamecast-weeks.mjs';
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installScoringResearch({getSchedule,feed,model,season='2026-regular',
 root=document,storage=null,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const storeKey='FFO_PFO_MSF_RESEARCH_W1_7_'+season+'_v1';
 // Store ONLY non-personal source verification flags and game IDs.
 // No player stats, scoring totals, credentials, PFO roster or provider payload.
 const safeStorage=storage||root?.defaultView?.localStorage||null;
 const snapshots={},certificates=[],state={
  running:false,inspected:0,error:null,autoActive:false,stopRequested:false,
  autoScanned:0,autoFailure:null,lastProgress:''
 };
 const isVisible=()=>root?.defaultView?.document?.visibilityState!=='hidden';
 const hasLiveGames=()=>((getSchedule?.()||[]).some(g=>
  /^(LIVE|IN_PROGRESS|INPROGRESS|INPROGRESS_OVERTIME|OVERTIME|OT|HALFTIME)$/i
   .test(String(g.status||''))));
 const sanitizeSnapshot=value=>{
  if(!value||typeof value!=='object')return null;
  const when=Date.parse(value.checkedAt||'');
  if(!Number.isFinite(when)||when>Date.now()+86400000||
   when<Date.now()-30*86400000)return null;
  // Local checkpoints can restore SOURCE retrieval progress, never any
  // certification, scoring correction or score-write authority.
  const flags=['pbpPublished','pbpChronologyVerified','finalBoxVerified',
   'scoreMatchesSchedule','playerGameLogsVerified'];
  const sensitive=['playerIdentitiesVerified','requiredStatFieldsVerified',
   'scoringEventsReconciled','statCorrectionsChecked','kickerScoreVerified',
   'dstScoreVerified','finalPlayerScoreRecomputed'];
  const out={checkedAt:new Date(when).toISOString()};
  for(const key of flags)out[key]=value[key]===true;
  for(const key of sensitive)out[key]=false;
  out.sourceFailure=value.sourceFailure===true;
  out.playCount=Number.isInteger(value.playCount)&&value.playCount>=0&&value.playCount<2000?
   value.playCount:null;
  return out;
 };
 try{
  const saved=JSON.parse(safeStorage?.getItem(storeKey)||'null');
  if(saved?.schema===1&&saved.entries&&typeof saved.entries==='object'){
   for(const [gameId,value] of Object.entries(saved.entries).slice(0,160)){
    if(!/^[a-zA-Z0-9_-]{1,44}$/.test(gameId))continue;
    const clean=sanitizeSnapshot(value);
    if(clean)snapshots[gameId]=clean;
   }
  }
 }catch{/* Private browsing or storage quota is nonfatal. */}
 const saveSnapshots=()=>{
  try{
   const entries=Object.fromEntries(Object.entries(snapshots).slice(0,160)
    .map(([id,value])=>[id,sanitizeSnapshot(value)]).filter(([,value])=>!!value));
   safeStorage?.setItem(storeKey,JSON.stringify({schema:1,entries}));
  }catch{/* Never interrupt scoring audit or reveal data if storage unavailable. */}
 };
 const el=id=>root.getElementById(id);
 const schedule=()=>((getSchedule?.()||[]).map(g=>({
  id:String(g.id),home:g.home,away:g.away,
  week:Number.isInteger(g.week)?g.week:calendarWeek(g.start,2026),
  weekVerified:Number.isInteger(g.week),
  status:g.status
 })).filter(g=>g.id&&g.week));
 const status=()=>buildLeagueHistoryCoverage(schedule(),snapshots,certificates,
  {fromWeek:1,throughWeek:7});
 const queue=()=>nextLeagueHistoryBatch(schedule(),snapshots,
  {fromWeek:1,throughWeek:7,maxGames:2,priorityTeam:'GB',
   allowEstimatedWeekForSourceDiscovery:true,skipPreviouslyInspected:true});
 function render(message=''){
  const target=el('ffo-gc-research-status');
  if(!target)return;
  const c=status(),q=queue();
  target.innerHTML='<strong>'+c.sourceGames+' MSF schedule games · '+c.teamsRepresented+
   '/32 NFL teams · '+c.gb.sourceGames+' GB matchups · '+
   Object.keys(snapshots).length+' games source-checked (locally checkpointed) · '+
   c.certifiedPlayerGameScores+' complete player scores certified</strong>'+
   '<div class="muted" style="margin:4px 0">'+
   safe(message||state.error||state.autoFailure||state.lastProgress||
    'Final correction checks, full event attribution, field zero-coverage and 40+/50+ rule adjudication still required. No guessed points feed projections.')+
   '</div><div class="muted">Source discovery queue: '+q.pendingGames+
   ' games pending · Next priority: '+safe(q.batch[0]?.away||'—')+
   ' @ '+safe(q.batch[0]?.home||'—')+
   (q.batch[0]?.weekSource==='calendar_estimate_not_certifiable'?
    ' · calendar-estimated week, cannot certify':'')+'</div>';
  const button=el('ffo-gc-research-next');
  if(button){button.disabled=state.running||state.autoActive||q.batch.length===0;
   button.textContent=state.running?'Inspecting MSF…':'Inspect next 2 historical games';}
  const auto=el('ffo-gc-research-all'),pause=el('ffo-gc-research-pause');
  if(auto){
   auto.disabled=state.running||state.autoActive||q.pendingGames===0;
   auto.textContent=state.autoActive?'Automatic checks active':
    q.pendingGames?'Run remaining '+q.pendingGames+' checks':'All available games source-checked';
  }
  if(pause){
   pause.disabled=!state.autoActive||state.stopRequested;
   pause.textContent=state.stopRequested?'Pausing after current request…':'Pause automated checks';
  }
  const progress=state.autoActive?' · Automatic scan: '+state.autoScanned+
    ' games this run; '+q.pendingGames+' remaining.':'';
  const progressNode=el('ffo-gc-research-progress');
  if(progressNode)progressNode.textContent=progress||
    (state.autoFailure?'Stopped: '+state.autoFailure:'');
 }
 async function runNextBatch({automatic=false}={}){
  if(state.running||(state.autoActive&&!automatic))return {checked:0,failed:false};
  const batch=queue().batch;
  if(!batch.length){
   render('No provider-scheduled final games left in the source-discovery queue.');
   return {checked:0,failed:false};
  }
  state.running=true;state.error=null;
  render('Checking MSF source data · scoring remains withheld.');
  let checked=0,failed=false;
  try{
   for(const g of batch){
    if(automatic&&(state.stopRequested||!isVisible()))break;
    render('Inspecting Week '+g.week+' · '+g.away+' @ '+g.home+'…');
    const [plays,box]=await Promise.allSettled([
     feed('plays',{season,game_id:g.gameId},true),
     feed('boxscore',{season,game_id:g.gameId},true)
    ]);
    const goodResponse=r=>r.status==='fulfilled'&&
     r.value?.available!==false&&!r.value?.error;
    const sourceOk=goodResponse(plays)&&goodResponse(box);
    let inspect=null;
    try{
     if(sourceOk)inspect=model.inspectHistoricalGame(plays.value,box.value,
      (getSchedule?.()||[]).find(x=>String(x.id)===String(g.gameId))||{});
    }catch{inspect=null;}
    const teams=[g.home,g.away];
    const logs=sourceOk?await Promise.allSettled(teams.map(team=>
     feed('gamelogs',{season,week:g.week,team},true))):[];
    const logsOk=logs.length===2&&logs.every(goodResponse);
    const mapped=logs.map(r=>goodResponse(r)?model.playerRows(r.value.data||{}):[]);
    const verifiedLogs=logsOk&&logs.every((r,i)=>mapped[i].length>0&&
     mapped[i].every(p=>String(p.game?.id||p.game?.gameId||'')===
      String(g.gameId)&&p.team===teams[i]));
    // Network failures and authenticated provider errors must not be
    // checkpointed as successfully inspected. This lets manual retry work.
    const sourceFailure=!sourceOk||!logsOk;
    snapshots[g.gameId]={
     checkedAt:new Date().toISOString(),
     sourceFailure,
     pbpPublished:inspect?.diagnostics?.hasPublishedPlays===true,
     pbpChronologyVerified:inspect?.usablePlaySequence===true,
     finalBoxVerified:inspect?.boxScorePublished===true&&inspect?.providerFinal===true,
     scoreMatchesSchedule:inspect?.matchesSchedule===true,
     playerGameLogsVerified:verifiedLogs,
     playerIdentitiesVerified:false,requiredStatFieldsVerified:false,
     scoringEventsReconciled:false,statCorrectionsChecked:false,
     kickerScoreVerified:false,dstScoreVerified:false,
     finalPlayerScoreRecomputed:false,playCount:inspect?.diagnostics?.describedCount??null,
     errors:sourceFailure?['MSF provider read unavailable; source game remains queued']:[]
    };
    saveSnapshots();
    if(sourceFailure){
     failed=true;
     state.autoFailure='MSF request failed at W'+g.week+' '+g.away+' @ '+g.home+
      '. Scan stopped; source game can be retried.';
     state.error=state.autoFailure;
     render(state.autoFailure);
     break; // Prevent 429 storms. Never hammer through a source outage.
    }
    checked++;state.inspected++;
    if(automatic)state.autoScanned++;
    state.lastProgress='Source diagnostics captured for W'+g.week+' '+g.away+
     ' @ '+g.home+'. Fantasy totals remain withheld.';
    render(state.lastProgress);
   }
  }catch(error){
   failed=true;
   state.error='MSF batch check: '+String(error?.message||error).slice(0,130);
  }finally{
   state.running=false;
   render(state.error||state.lastProgress);
  }
  return {checked,failed};
 }
 function pauseRemainingChecks(){
  if(!state.autoActive)return false;
  state.stopRequested=true;
  render('Pausing safely after the current MSF request.');
  return true;
 }
 async function runRemainingChecks(){
  if(state.autoActive||state.running||queue().pendingGames===0)return {started:false};
  state.autoActive=true;state.stopRequested=false;state.autoScanned=0;
  state.autoFailure=null;state.error=null;
  let lastPending=queue().pendingGames,reason='complete';
  render('Automated historical source discovery started. Keep this PFO tab visible.');
  try{
   // Never loop indefinitely on malformed schedule or cached MSF errors.
   for(let batches=0;batches<160;batches++){
    if(state.stopRequested){reason='paused';break;}
    if(!isVisible()){reason='page_hidden';break;}
    if(!queue().pendingGames){reason='complete';break;}
    const result=await runNextBatch({automatic:true});
    if(result.failed){reason='provider_error';break;}
    const pending=queue().pendingGames;
    if(!result.checked||pending>=lastPending){reason='no_progress';break;}
    lastPending=pending;
    if(!pending){reason='complete';break;}
    // 2,500ms between batches, more during live games. Avoid competing
    // with GameCast's five-second scores; manual pause can act during delay.
    await sleep(hasLiveGames()?8000:2500);
   }
  }finally{
   state.autoActive=false;state.stopRequested=false;
   state.lastProgress=reason==='complete'?
    'All available historical games have received source checks. Fantasy certification remains separate.':
    reason==='page_hidden'?'Scan paused because the page became hidden. Open PFO and press Run remaining to resume.':
    reason==='paused'?'Scan paused. Saved source checks will be skipped on resume.':
    reason==='provider_error'?'Scan stopped after an MSF source error to avoid rate-limit flooding.':
    'Scan stopped without additional progress; review MSF source availability.';
   render(state.lastProgress);
  }
  return {started:true,reason,checked:state.autoScanned,remaining:queue().pendingGames};
 }
 function backtestReadiness(){
  const report=walkForwardBacktest({certificates,expectedFinalGamesByPlayer:{}});
  render(report.projections?
   report.projections+' research-only out-of-sample forecasts · MAE '+report.global.mae+
   ' · production blocked.':
   'Backtest withheld: no fully certified, complete NFL player-week scores plus verified player schedules.');
  return report;
 }
 el('ffo-gc-research-next')?.addEventListener('click',()=>void runNextBatch());
 el('ffo-gc-research-all')?.addEventListener('click',()=>void runRemainingChecks());
 el('ffo-gc-research-pause')?.addEventListener('click',pauseRemainingChecks);
 el('ffo-gc-research-backtest')?.addEventListener('click',backtestReadiness);
 const api=Object.freeze({
  getReadiness:()=>({...status(),researchOnly:true,
   productionScoreWriteAllowed:false,productionProjectionEligible:false}),
  getCertifiedPlayerScore:(playerId,gameId)=>certificates.find(c=>c.certified===true&&
   String(c.playerId)===String(playerId)&&String(c.gameId)===String(gameId))?.points??null,
  getProductionProjection:()=>null,
  getBacktest:backtestReadiness,
  getInspectedGames:()=>Object.keys(snapshots).length,
  getSourceCheck:(gameId)=>snapshots[String(gameId)]?{...snapshots[String(gameId)]}:null,
  render,runNextBatch,runRemainingChecks,pauseRemainingChecks,
  getScanState:()=>({autoActive:state.autoActive,running:state.running,
   stopRequested:state.stopRequested,autoScanned:state.autoScanned,
   remaining:queue().pendingGames,error:state.autoFailure||state.error||null})
 });
 render();
 return api;
}
