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
export function installScoringResearch({getSchedule,feed,model,season='2026-regular',root=document,storage=null}={}){
 const storeKey='FFO_PFO_MSF_RESEARCH_W1_7_'+season+'_v1';
 // Store ONLY non-personal source verification flags and game IDs.
 // No player stats, scoring totals, credentials, PFO roster or provider payload.
 const safeStorage=storage||root?.defaultView?.localStorage||null;
 const snapshots={},certificates=[],state={running:false,inspected:0,error:null};
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
   safe(message||state.error||'Final correction checks, full event attribution, field zero-coverage and 40+/50+ rule adjudication still required. No guessed points feed projections.')+
   '</div><div class="muted">Source discovery queue: '+q.pendingGames+
   ' games pending · Next priority: '+safe(q.batch[0]?.away||'—')+
   ' @ '+safe(q.batch[0]?.home||'—')+
   (q.batch[0]?.weekSource==='calendar_estimate_not_certifiable'?
    ' · calendar-estimated week, cannot certify':'')+'</div>';
  const button=el('ffo-gc-research-next');
  if(button){button.disabled=state.running||q.batch.length===0;
   button.textContent=state.running?'Inspecting MSF…':'Inspect next 2 historical games';}
 }
 async function runNextBatch(){
  if(state.running)return;
  const batch=queue().batch;if(!batch.length){render('No provider-scheduled final games left in the current source-discovery queue.');return;}
  state.running=true;state.error=null;render('Checking source data (read-only)…');
  try{
   for(const g of batch){
    render('Inspecting Week '+g.week+' · '+g.away+' @ '+g.home+'…');
    const [plays,box]=await Promise.allSettled([
     feed('plays',{season,game_id:g.gameId},true),
     feed('boxscore',{season,game_id:g.gameId},true)
    ]);
    const ok=plays.status==='fulfilled'&&box.status==='fulfilled';
    const inspect=ok?model.inspectHistoricalGame(plays.value,box.value,
     (getSchedule?.()||[]).find(x=>String(x.id)===String(g.gameId))||{}):null;
    const teams=[g.home,g.away];
    const gameLogs=await Promise.allSettled(teams.map(team=>
     feed('gamelogs',{season,week:g.week,team},true)));
    const mapped=gameLogs.map(r=>r.status==='fulfilled'?
     model.playerRows(r.value.data||{}):[]);
    const verifiedLogs=gameLogs.every((r,i)=>r.status==='fulfilled'&&
     mapped[i].length>0&&mapped[i].every(p=>
      String(p.game?.id||p.game?.gameId||'')===String(g.gameId)&&p.team===teams[i]));
    snapshots[g.gameId]={
     checkedAt:new Date().toISOString(),
     pbpPublished:inspect?.diagnostics?.hasPublishedPlays===true,
     pbpChronologyVerified:inspect?.usablePlaySequence===true,
     finalBoxVerified:inspect?.boxScorePublished===true&&inspect?.providerFinal===true,
     scoreMatchesSchedule:inspect?.matchesSchedule===true,
     playerGameLogsVerified:verifiedLogs,
     playerIdentitiesVerified:false,requiredStatFieldsVerified:false,
     scoringEventsReconciled:false,statCorrectionsChecked:false,
     kickerScoreVerified:false,dstScoreVerified:false,
     finalPlayerScoreRecomputed:false,playCount:inspect?.diagnostics?.describedCount??null,
     errors:ok?[]:['MSF PBP/boxscore unavailable']
    };
    saveSnapshots();
    state.inspected++;render('Source diagnostics captured for W'+g.week+' '+g.away+
      ' @ '+g.home+'. Complete FFL scores are still withheld.');
   }
  }catch(error){state.error='MSF batch check: '+String(error?.message||error).slice(0,130)}
  finally{state.running=false;render()}
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
  render,runNextBatch
 });
 render();
 return api;
}
