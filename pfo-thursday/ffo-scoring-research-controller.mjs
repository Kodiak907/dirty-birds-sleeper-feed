/**
 * PFO read-only MSF 2026 historical reconstruction controller.
 * User-triggered two-game batches avoid competing with live 5s GameCast.
 * Production scoring and projections are HARD-DISABLED until source-certified.
 */
import {buildLeagueHistoryCoverage,nextLeagueHistoryBatch}
 from './ffo-league-history-pipeline.mjs';
import {walkForwardBacktest} from './ffo-verified-history-backtest.mjs';
import {calendarWeek} from './ffo-gamecast-weeks.mjs';
import {buildCertificationWorklistFromCheckpoints} from './ffo-historical-audit-worklist.mjs?v=680';
import {classifyMSFScanFailure,scanFailurePolicy} from './ffo-msf-scan-recovery.mjs?v=670';
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installScoringResearch({getSchedule,feed,model,season='2026-regular',
 root=document,storage=null,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const storeKey='FFO_PFO_MSF_RESEARCH_W1_7_'+season+'_v1';
 // Store ONLY non-personal source verification flags and game IDs.
 // No player stats, scoring totals, credentials, PFO roster or provider payload.
 const safeStorage=storage||root?.defaultView?.localStorage||null;
 const snapshots={},certificates=[],state={
  running:false,inspected:0,error:null,autoActive:false,stopRequested:false,
  autoScanned:0,autoFailure:null,lastProgress:'',lastFailure:null,
  excludedThisRun:new Set(),consecutiveUnavailable:0,cooldownUntil:0
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
  out.failureKind=/^(rate_limit|access|bad_request|payload_limit|invalid_payload|missing_feed|transient|unknown)$/.test(String(value.failureKind||''))?value.failureKind:null;
  out.failureReason=typeof value.failureReason==='string'?value.failureReason.slice(0,140):null;
  // Only code/status summaries are allowed; no provider body or credentials.
  out.failureDiagnostic=typeof value.failureDiagnostic==='string'?
   value.failureDiagnostic.replace(/[^a-zA-Z0-9 _./:|+=-]/g,'').slice(0,170):null;
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
 const certificationQueue=()=>buildCertificationWorklistFromCheckpoints(schedule(),snapshots,{fromWeek:1,throughWeek:7,priorityTeam:'GB'});
 const queue=(exclude=[])=>nextLeagueHistoryBatch(schedule(),snapshots,
  {fromWeek:1,throughWeek:7,maxGames:2,priorityTeam:'GB',
   allowEstimatedWeekForSourceDiscovery:true,skipPreviouslyInspected:true,
   excludeGameIds:exclude});
 function render(message=''){
  const target=el('ffo-gc-research-status');
  if(!target)return;
  const c=status(),q=queue(),cert=certificationQueue();
  const attempted=Object.values(snapshots).filter(x=>x?.checkedAt).length;
  const failed=Object.values(snapshots).filter(x=>x?.sourceFailure===true).length;
  const completed=attempted-failed;
  target.innerHTML='<strong>'+c.sourceGames+' MSF schedule games · '+c.teamsRepresented+
   '/32 NFL teams · '+c.gb.sourceGames+' GB matchups · '+
   completed+' source requests completed · '+attempted+' attempted · '+
   failed+' source failures (locally checkpointed) · '+
   c.certifiedPlayerGameScores+' complete player scores certified</strong>'+
   '<div class="muted" style="margin:4px 0">'+
   safe(message||state.error||state.autoFailure||state.lastProgress||
    'Final correction checks, full event attribution, field zero-coverage and 40+/50+ rule adjudication still required. No guessed points feed projections.')+
   '</div><div class="muted">Source discovery queue: '+q.pendingGames+
   ' games pending · Next priority: '+safe(q.batch[0]?.away||'—')+
   ' @ '+safe(q.batch[0]?.home||'—')+
   (q.batch[0]?.weekSource==='calendar_estimate_not_certifiable'?
    ' · calendar-estimated week, cannot certify':'')+'</div>'+
   (!q.pendingGames&&cert.sourceGames?'<div class="muted" style="margin:6px 0;color:#b3ddc9">Source discovery complete. Next: controlled certification evidence review · '+cert.worklist.filter(g=>g.sourceChecked).length+' prioritized games shown; no automatic score credit.</div>':'')+
   (failed?'<div class="muted" style="margin:5px 0;color:#edc384">Failed source reads remain pending: '+
    Object.entries(snapshots).filter(([,v])=>v?.sourceFailure===true).slice(0,3)
     .map(([id,v])=>safe(id+' ('+(v.failureKind||'unknown')+': '+
      (v.failureDiagnostic||v.failureReason||'source unavailable')+')')).join(' · ')+
    (failed>3?' · +'+(failed-3)+' more':'')+'</div>':'');
  const button=el('ffo-gc-research-next');
  if(button){button.disabled=state.running||state.autoActive||q.batch.length===0;
   button.textContent=state.running?'Inspecting MSF…':'Inspect next 2 historical games';}
  const single=el('ffo-gc-research-single');
  if(single){
   const id=preferredFailedGameId();
   const cooldown=Math.max(0,state.cooldownUntil-Date.now());
   single.disabled=state.running||state.autoActive||!id||cooldown>0;
   single.textContent=cooldown>0?'MSF cooldown · '+Math.ceil(cooldown/1000)+'s':
    id?'Diagnose failed game '+id+' · one game':'No saved failed games to retry';
  }
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
    ' games this run; '+q.pendingGames+' pending, '+state.excludedThisRun.size+
    ' temporarily skipped.':'';
  const progressNode=el('ffo-gc-research-progress');
  if(progressNode)progressNode.textContent=progress||
    (state.autoFailure?'Stopped: '+state.autoFailure:'');
 }
 function preferredFailedGameId(){
  const ids=Object.keys(snapshots).filter(id=>snapshots[id]?.sourceFailure===true);
  const scheduled=new Set(schedule().filter(g=>g.week>=1&&g.week<=7).map(g=>String(g.id)));
  if(ids.includes('163584')&&scheduled.has('163584'))return '163584';
  return ids.find(id=>scheduled.has(id))||null;
 }
 async function probeHistoricalGame(g){
  const scheduleGame=(getSchedule?.()||[]).find(x=>String(x.id)===String(g.gameId))||{};
  const [plays,box]=await Promise.allSettled([
   feed('plays',{season,game_id:g.gameId},true),
   feed('boxscore',{season,game_id:g.gameId},true)
  ]);
  let failure=classifyMSFScanFailure([
   {feed:'plays',result:plays},{feed:'boxscore',result:box}
  ]);
  let inspection=null;
  if(!failure){
   try{inspection=model.inspectHistoricalGame(plays.value,box.value,scheduleGame)}
   catch(error){
    failure={kind:'unknown',retryable:false,delayMs:0,
     description:'MSF historical play/box response not interpretable',
     diagnostic:'model_inspection_error'};
   }
  }
  let logs=[],verifiedLogs=false;
  if(!failure){
   // Separate play/box and team-log bursts; limited MSF accounts should
   // never receive all four game queries in one simultaneous request burst.
   const delay=hasLiveGames()?3500:1200;
   await sleep(delay);
   if(!isVisible()||state.stopRequested)return {cancelled:true};
   const teams=[g.home,g.away];
   logs=await Promise.allSettled(teams.map(team=>
    feed('gamelogs',{season,week:g.week,team},true)));
   failure=classifyMSFScanFailure(logs.map((result,i)=>({
    feed:i===0?'gamelogs_home':'gamelogs_away',result
   })));
   if(!failure){
    try{
     const mapped=logs.map(r=>model.playerRows(r.value.data||{}));
     verifiedLogs=logs.every((r,i)=>mapped[i].length>0&&
      mapped[i].every(p=>String(p.game?.id||p.game?.gameId||'')===
       String(g.gameId)&&p.team===teams[i]));
    }catch(error){failure={kind:'unknown',retryable:false,delayMs:0,
     description:'MSF player game-log response not interpretable',
     diagnostic:'player_game_log_mapping_error'}}
   }
  }
  return {inspection,verifiedLogs,failure,cancelled:false};
 }
 async function runNextBatch({automatic=false,excludeGameIds=[],specificGameId=null}={}){
  if(state.running||(state.autoActive&&!automatic))return {checked:0,skipped:0,failed:false};
  if(state.cooldownUntil>Date.now()){
   render('MSF rate-limit cooldown active; source checks preserved.');
   return {checked:0,skipped:0,failed:false,stopped:true,category:'rate_limit',reason:'cooldown'};
  }
  let batch=queue(excludeGameIds).batch;
  if(specificGameId!==null){
   const key=String(specificGameId);
   const game=schedule().find(g=>g.id===key&&g.week>=1&&g.week<=7);
   if(!game||snapshots[key]?.sourceFailure!==true)
    return {checked:0,skipped:0,failed:false,reason:'not_failed'};
   batch=[{gameId:game.id,week:game.week,home:game.home,away:game.away}];
  }
  if(!batch.length){
   render('No available MSF games in this scan batch.');
   return {checked:0,skipped:0,failed:false};
  }
  state.running=true;state.error=null;
  render('Checking historical MSF source data; scores remain withheld.');
  let checked=0,skipped=0,failed=false,category=null,stopped=false;
  try{
   for(const g of batch){
    if(automatic&&(state.stopRequested||!isVisible()))break;
    render('Inspecting Week '+g.week+' · '+g.away+' @ '+g.home+'…');
    let probe=await probeHistoricalGame(g);
    if(probe.cancelled)break;
    let failure=probe.failure;
    // Bounded recovery: one retry for network/502 errors. Throttling is
    // treated more cautiously: at most one retry after a 60s cooldown.
    if(failure?.retryable&&automatic&&isVisible()&&!state.stopRequested){
     const delay=failure.delayMs||6500;
     render(failure.description+' at '+g.away+' @ '+g.home+
      ' · waiting '+Math.ceil(delay/1000)+'s before one retry.');
     for(let elapsed=0;elapsed<delay;elapsed+=5000){
      await sleep(Math.min(5000,delay-elapsed));
      if(state.stopRequested||!isVisible())break;
     }
     if(state.stopRequested||!isVisible())break;
     probe=await probeHistoricalGame(g);
     if(probe.cancelled)break;
     failure=probe.failure;
    }
    const sourceFailure=!!failure;
    const inspection=probe.inspection;
    snapshots[g.gameId]={
     checkedAt:new Date().toISOString(),
     sourceFailure,failureKind:failure?.kind||null,
     failureReason:failure?.description||null,
     failureDiagnostic:failure?.diagnostic||null,
     pbpPublished:inspection?.diagnostics?.hasPublishedPlays===true,
     pbpChronologyVerified:inspection?.usablePlaySequence===true,
     finalBoxVerified:inspection?.boxScorePublished===true&&inspection?.providerFinal===true,
     scoreMatchesSchedule:inspection?.matchesSchedule===true,
     playerGameLogsVerified:probe.verifiedLogs===true,
     playerIdentitiesVerified:false,requiredStatFieldsVerified:false,
     scoringEventsReconciled:false,statCorrectionsChecked:false,
     kickerScoreVerified:false,dstScoreVerified:false,
     finalPlayerScoreRecomputed:false,playCount:inspection?.diagnostics?.describedCount??null
    };
    saveSnapshots();
    if(sourceFailure){
     skipped++;failed=true;category=failure.kind;
     const detail='W'+g.week+' '+g.away+' @ '+g.home+' · '+
      failure.description+' · '+failure.diagnostic;
     state.lastFailure={gameId:g.gameId,week:g.week,kind:failure.kind,
      description:failure.description,diagnostic:failure.diagnostic};
     state.autoFailure=detail;
     state.error=detail;
     state.excludedThisRun.add(g.gameId);
     const policy=scanFailurePolicy(failure);
     if(policy.action==='stop'){
      stopped=true;
      if(failure.kind==='rate_limit')state.cooldownUntil=Date.now()+60000;
      render('Scan stopped: '+detail+'. Successful checks preserved.');
      break;
     }
     state.consecutiveUnavailable++;
     render('Unverified game set aside for this run: '+detail+
      '. Continuing with other games where possible.');
     if(state.consecutiveUnavailable>=3){
      stopped=true;state.autoFailure='Three consecutive MSF source failures; stopped to avoid provider flooding. Last: '+detail;
      break;
     }
     if(!automatic)break;
     await sleep(hasLiveGames()?7000:4000);
     continue;
    }
    checked++;state.inspected++;state.consecutiveUnavailable=0;
    if(automatic)state.autoScanned++;
    state.lastProgress='Source requests completed for W'+g.week+' '+g.away+
     ' @ '+g.home+'. Fantasy totals still withheld.';
    render(state.lastProgress);
    if(automatic&&g!==batch[batch.length-1])await sleep(hasLiveGames()?5000:3000);
   }
  }catch(error){
   failed=true;stopped=true;category='unexpected_error';
   state.error='MSF batch error: '+String(error?.message||error).slice(0,120);
   state.autoFailure=state.error;
  }finally{state.running=false;render(state.error||state.lastProgress)}
  return {checked,skipped,failed,stopped,category};
 }
 async function retryFailedGame(gameId=null){
  if(state.running||state.autoActive)return {started:false,reason:'busy'};
  if(!isVisible())return {started:false,reason:'page_hidden'};
  const cooldown=Math.max(0,state.cooldownUntil-Date.now());
  if(cooldown>0){
   render('MSF throttling cooldown; no retry sent.');
   return {started:false,reason:'cooldown',retryAfterSeconds:Math.ceil(cooldown/1000)};
  }
  const id=gameId===null?preferredFailedGameId():String(gameId);
  if(!id||snapshots[id]?.sourceFailure!==true){
   render('Select a game with a saved failed source check. No new request sent.');
   return {started:false,reason:'not_failed'};
  }
  const result=await runNextBatch({specificGameId:id});
  return {...result,gameId:id};
 }
 function pauseRemainingChecks(){
  if(!state.autoActive)return false;
  state.stopRequested=true;
  render('Pausing safely after the current MSF request.');
  return true;
 }
 async function runRemainingChecks(){
  if(state.autoActive||state.running||queue().pendingGames===0)return {started:false};
  const cooldown=Math.max(0,state.cooldownUntil-Date.now());
  if(cooldown>0){
   render('MSF throttling cooldown active · retry after '+Math.ceil(cooldown/1000)+
    's. Existing source checks are saved.');
   return {started:false,reason:'cooldown',retryAfterSeconds:Math.ceil(cooldown/1000)};
  }
  state.autoActive=true;state.stopRequested=false;state.autoScanned=0;
  state.autoFailure=null;state.error=null;state.lastFailure=null;
  state.excludedThisRun.clear();state.consecutiveUnavailable=0;
  let lastEligible=queue().pendingGames,reason='complete';
  render('Automatic historical source inspection started. Keep PFO visible.');
  try{
   for(let batches=0;batches<160;batches++){
    if(state.stopRequested){reason='paused';break}
    if(!isVisible()){reason='page_hidden';break}
    const available=queue([...state.excludedThisRun]).pendingGames;
    if(!available){
     reason=queue().pendingGames?'unavailable_games':'complete';
     break;
    }
    const result=await runNextBatch({automatic:true,
     excludeGameIds:[...state.excludedThisRun]});
    if(result.stopped){
     reason=result.category==='rate_limit'?'rate_limit':
      result.category==='access'||result.category==='bad_request'?'provider_access':
      result.category==='unexpected_error'?'unexpected_error':'multiple_source_errors';
     break;
    }
    const eligible=queue([...state.excludedThisRun]).pendingGames;
    if(!result.checked&&!result.skipped||eligible>=lastEligible){
     reason='no_progress';break;
    }
    lastEligible=eligible;
    if(!eligible){
     reason=queue().pendingGames?'unavailable_games':'complete';break;
    }
    await sleep(hasLiveGames()?8000:4500);
   }
  }catch(error){
   reason='unexpected_error';
   state.autoFailure='Scan interrupted by a client error: '+
    String(error?.message||error).slice(0,115);
  }finally{
   state.autoActive=false;state.stopRequested=false;
   const remaining=queue().pendingGames,missing=state.excludedThisRun.size;
   state.lastProgress=reason==='complete'?
    'Available historical source checks finished; this does NOT certify fantasy scores.':
    reason==='unavailable_games'?'Scan completed accessible games; '+missing+
      ' unavailable source games remain pending for a later retry.':
    reason==='page_hidden'?'Scan paused when your phone left the page. Reopen PFO and resume.':
    reason==='paused'?'Scan paused. Successful checks remain saved locally.':
    reason==='rate_limit'?'MSF rate limiting detected. Paused to protect live scores; retry after the 60s cooldown.':
    reason==='provider_access'?'MSF feed access or request rejected. Check provider entitlement before retrying.':
    reason==='multiple_source_errors'?'Multiple MSF games unavailable. Paused after three consecutive failures.':
    reason==='unexpected_error'?'Historical scan stopped after an unexpected error; source checks remain saved.':
    'Scan stopped without progress; review MSF source availability.';
   state.error=null;
   if(state.lastFailure&&reason!=='complete'){
    state.lastProgress+=' Last failed game: '+state.lastFailure.gameId+
     ' · '+state.lastFailure.description+'.';
   }
   render(state.lastProgress);
  }
  return {started:true,reason,checked:state.autoScanned,
   failedThisRun:state.excludedThisRun.size,remaining:queue().pendingGames,
   lastFailure:state.lastFailure};
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
 el('ffo-gc-research-single')?.addEventListener('click',()=>void retryFailedGame());
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
  getCertificationWorklist:()=>certificationQueue(),
  getInspectedGames:()=>Object.keys(snapshots).length,
  getSourceCheck:(gameId)=>snapshots[String(gameId)]?{...snapshots[String(gameId)]}:null,
  render,runNextBatch,runRemainingChecks,retryFailedGame,pauseRemainingChecks,
  getScanState:()=>({autoActive:state.autoActive,running:state.running,
   stopRequested:state.stopRequested,autoScanned:state.autoScanned,
   remaining:queue().pendingGames,error:state.autoFailure||state.error||null})
 });
 render();
 return api;
}
