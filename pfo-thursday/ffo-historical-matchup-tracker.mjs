/**
 * FFO 2026 independently sourced historical matchup tracking / coverage board.
 * A pure read-only state machine: no requests, cookies, credentials or writes.
 *
 * Input: authenticated server-side MSF gateway game schedule + box/PBP/log
 * diagnostics, not Sleeper fantasy scores. The caller is responsible for rate
 * limits and obtaining full season schedule; the tracker never claims that a
 * partial schedule represents all 32 NFL teams.
 */
const okWeek = w => Number.isInteger(w)&&w>=1&&w<=18;
const finalState = value => ['FINAL','COMPLETED','FINAL_OT','FINAL_OVERTIME'].includes(String(value||'').toUpperCase());
const alpha = s => typeof s==='string' && /^[A-Z]{2,4}$/.test(s);
const dedup = list => [...new Set(list)];
const text = x => x==null?'':String(x);

export function planHistoricalMatchups(schedule=[],{fromWeek=1,throughWeek=7}={}) {
 const errors=[],byId=new Map();
 if(!Array.isArray(schedule))return {games:[],errors:['schedule_not_an_array'],count:0,byWeek:[]};
 if(!okWeek(fromWeek)||!okWeek(throughWeek)||fromWeek>throughWeek)
  return {games:[],errors:['invalid_week_window'],count:0,byWeek:[]};
 for(const raw of schedule){
  const g=raw||{}, id=text(g.id||g.gameId),week=Number(g.week),home=text(g.home).toUpperCase(),away=text(g.away).toUpperCase();
  if(!id||!okWeek(week)||!alpha(home)||!alpha(away)||home===away){
   errors.push({id:id||null,reason:'incomplete_provider_schedule_record'});continue;
  }
  if(week<fromWeek||week>throughWeek)continue;
  const prior=byId.get(id);
  if(prior){
   if(prior.week!==week||prior.home!==home||prior.away!==away||prior.status!==text(g.status)){
    byId.delete(id);errors.push({id,reason:'conflicting_provider_schedule_entries'});
   }
   continue;
  }
  if(errors.some(e=>e.id===id&&e.reason==='conflicting_provider_schedule_entries'))continue;
  byId.set(id,{id,week,home,away,status:text(g.status),
   provider:'MSF',final:finalState(g.status),sourceWeekVerified:g.weekVerified===true});
 }
 const games=[...byId.values()].sort((a,b)=>a.week-b.week||a.id.localeCompare(b.id));
 const byWeek=Array.from({length:throughWeek-fromWeek+1},(_,i)=>{
  const week=i+fromWeek,items=games.filter(g=>g.week===week);
  return {week,games:items.length,final:items.filter(g=>g.final).length,
   unplayed:items.filter(g=>!g.final).length};
 });
 return {games,errors,count:games.length,byWeek,seasonScheduleCertified:false};
}

/**
 * Input snapshots keyed by source game ID, produced by existing
 * inspectHistoricalGame / auditStatFeed / scoringEvidence QA.
 * Never infer pass from omitted booleans.
 */
export function summarizeHistoricalMatchups(plan,snapshots={}) {
 const games=(plan?.games||[]).map(g=>{
  const s=snapshots[g.id]||{},checks={
   scheduleWeekVerified:g.sourceWeekVerified===true,
   finalGame:g.final===true,
   publishedPbp:s.pbpPublished===true,
   playSequenceUsable:s.pbpChronologyVerified===true,
   finalBoxScore:s.finalBoxVerified===true,
   boxMatchesSchedule:s.scoreMatchesSchedule===true,
   playerGameLogs:s.playerGameLogsVerified===true,
   playerIdentities:s.playerIdentitiesVerified===true,
   requiredStatFields:s.requiredStatFieldsVerified===true,
   scoringEvents:s.scoringEventsReconciled===true,
   statCorrections:s.statCorrectionsChecked===true,
   kicking:s.kickerScoreVerified===true,
   defense:s.dstScoreVerified===true
  };
  const basic=['scheduleWeekVerified','finalGame','publishedPbp','playSequenceUsable','finalBoxScore','boxMatchesSchedule'];
  const advanced=['playerGameLogs','playerIdentities','requiredStatFields','scoringEvents','statCorrections','kicking','defense'];
  const missingBasic=basic.filter(k=>!checks[k]),missingAdvanced=advanced.filter(k=>!checks[k]);
  return {...g,checks,playCount:Number.isInteger(s.playCount)&&s.playCount>=0?s.playCount:null,
   missingBasic,missingAdvanced,
   stage:missingBasic.length?'source_verification_pending':
     missingAdvanced.length?'player_score_reconciliation_pending':'game_fantasy_components_verified',
   fullFantasyScoreCertified:missingBasic.length===0&&missingAdvanced.length===0&&s.finalPlayerScoreRecomputed===true,
   sourceSnapshotAt:s.checkedAt||null};
 });
 const byWeek=(plan?.byWeek||[]).map(w=>{
  const entries=games.filter(g=>g.week===w.week);
  return {...w,pbpVerified:entries.filter(x=>x.checks.publishedPbp&&x.checks.playSequenceUsable).length,
   boxVerified:entries.filter(x=>x.checks.finalBoxScore&&x.checks.boxMatchesSchedule).length,
   playerScoresVerified:entries.filter(x=>x.fullFantasyScoreCertified).length,
   remaining:entries.filter(x=>!x.fullFantasyScoreCertified).length};
 });
 return {games,byWeek,count:games.length,sourceFeedGames:games.filter(g=>g.checks.publishedPbp).length,
  finalBoxGames:games.filter(g=>g.checks.finalBoxScore).length,
  fullyReconciledGames:games.filter(g=>g.fullFantasyScoreCertified).length,
  scheduleCertified:false,
  note:'These counts cover only supplied MySportsFeeds schedule rows. Missing weeks or games may be absent from the schedule input; no fabricated zero-game completeness.'};
}

/** The caller should choose one small batch at a time to respect MSF licensing. */
export function nextHistoricalMatchupBatch(plan,snapshots={},maxGames=4) {
 if(!Number.isInteger(maxGames)||maxGames<1||maxGames>16)throw Error('invalid_batch_limit');
 return summarizeHistoricalMatchups(plan,snapshots).games
  .filter(g=>!g.fullFantasyScoreCertified&&g.final===true&&g.sourceWeekVerified===true)
  .slice(0,maxGames)
  .map(g=>({gameId:g.id,week:g.week,home:g.home,away:g.away,
    requestTypes: g.missingBasic.length?['plays','boxscore']:['gamelogs','teamgamelogs'],
    reasons:dedup([...g.missingBasic,...g.missingAdvanced])}));
}
