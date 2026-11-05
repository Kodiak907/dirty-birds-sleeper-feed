/**
 * PFO versus external projections: PRE-GAME comparison only.
 * Sleeper projections may be compared, but Sleeper actual fantasy scores NEVER
 * define truth. Only independent MSF/FFL certified final player-game scores do.
 * The two predictions must use exactly the same FFL scoring rules and kickoff.
 * No predictions are fetched, written, or retroactively manufactured here.
 */
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const final=x=>/^(FINAL|COMPLETED|FINAL_OT|FINAL_OVERTIME)$/i.test(String(x||''));
const median=a=>a.length?[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)/2)]:null;
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const metrics=(rows,key)=> {
 if(!rows.length)return {n:0,mae:null,rmse:null,bias:null,medianAbsoluteError:null};
 const errors=rows.map(x=>x[key]-x.actual),n=errors.length;
 return {n,mae:round(errors.reduce((s,v)=>s+Math.abs(v),0)/n),
  rmse:round(Math.sqrt(errors.reduce((s,v)=>s+v*v,0)/n)),
  bias:round(errors.reduce((s,v)=>s+v,0)/n),
  medianAbsoluteError:round(median(errors.map(Math.abs)))};
};
const uniqueKey=x=>[String(x?.playerId||''),String(x?.gameId||'')].join('|');
const inTime=(x,cutoffMinutes)=>{
 const kickoff=Date.parse(x?.kickoffAt||''),captured=Date.parse(x?.capturedAt||'');
 return Number.isFinite(kickoff)&&Number.isFinite(captured)&&
  captured<=kickoff-cutoffMinutes*60000&&captured>=kickoff-7*86400000;
};
function acceptedForecast(entry,provider,rulesVersion,cutoffMinutes){
 return entry&&entry.provider===provider&&finite(entry.points)&&entry.points>=0&&
  entry.scoringSystem==='FFL'&&entry.rulesVersion===rulesVersion&&
  entry.fromSleeperActual!==true&&entry.afterGameKnowledge!==true&&
  Number.isInteger(entry.week)&&entry.week>=1&&entry.week<=18&&
  entry.playerId!=null&&entry.gameId!=null&&inTime(entry,cutoffMinutes);
}
function onlyOne(rows){
 const grouped=new Map();
 for(const r of rows){
  const key=uniqueKey(r),current=grouped.get(key)||[];
  current.push(r);grouped.set(key,current);
 }
 return grouped;
}
/**
 * Experimental benchmark gate. Winning MAE on a few fixtures does not establish
 * superiority; production stays withheld until larger independent comparisons.
 */
export function compareFFLForecasts({pfoForecasts=[],sleeperForecasts=[],certificates=[],
 rulesVersion='',cutoffMinutes=15,minPairedGames=100,maxCaptureGapMinutes=60}={}){
 const reasons=[],excluded={missingPrediction:0,invalidForecast:0,scoringMismatch:0,
  kickoffMismatch:0,captureWindowMismatch:0,uncertifiedTarget:0,duplicate:0};
 const validTarget=c=>c?.certified===true&&c.provider==='MSF'&&
  c.fantasyScoreFromSleeper!==true&&final(c.gameStatus)&&
  Number.isInteger(c.week)&&finite(c.points)&&c.points>=0&&
  c.rulesVersion===rulesVersion&&c.playerId!=null&&c.gameId!=null;
 const uniqueTargets=onlyOne((certificates||[]).filter(validTarget));
 const pfo=onlyOne((pfoForecasts||[]).filter(x=>acceptedForecast(x,'PFO',rulesVersion,cutoffMinutes)));
 const sleeper=onlyOne((sleeperForecasts||[]).filter(x=>acceptedForecast(x,'Sleeper',rulesVersion,cutoffMinutes)));
 const paired=[];
 for(const [key,targets] of uniqueTargets){
  if(targets.length!==1){excluded.duplicate++;continue;}
  const target=targets[0],pp=pfo.get(key)||[],ss=sleeper.get(key)||[];
  if(pp.length!==1||ss.length!==1){
   excluded.missingPrediction++;continue;
  }
  const [a]=pp,[b]=ss;
  if(a.week!==target.week||b.week!==target.week||
   Date.parse(a.kickoffAt)!==Date.parse(b.kickoffAt)||
   Date.parse(a.capturedAt)>Date.parse(a.kickoffAt)||
   Date.parse(b.capturedAt)>Date.parse(b.kickoffAt)){
   excluded.kickoffMismatch++;continue;
  }
  if(Math.abs(Date.parse(a.capturedAt)-Date.parse(b.capturedAt))>maxCaptureGapMinutes*60000){
   excluded.captureWindowMismatch++;continue;
  }
  paired.push({playerId:String(target.playerId),gameId:String(target.gameId),week:target.week,
   position:String(target.position||'UNKNOWN'),actual:target.points,
   pfo:a.points,sleeper:b.points,
   pfoAbsError:round(Math.abs(a.points-target.points)),
   sleeperAbsError:round(Math.abs(b.points-target.points))});
 }
 const pfoResult=metrics(paired,'pfo'),sleeperResult=metrics(paired,'sleeper');
 const gain=paired.length?round(sleeperResult.mae-pfoResult.mae):null;
 const perPosition=Object.fromEntries([...new Set(paired.map(x=>x.position))].sort().map(pos=>{
  const samples=paired.filter(x=>x.position===pos);
  return [pos,{pfo:metrics(samples,'pfo'),sleeper:metrics(samples,'sleeper')}];
 }));
 if(!rulesVersion)reasons.push('ffl_rules_version_required');
 if(paired.length<minPairedGames)reasons.push('insufficient_matched_pregame_certified_games');
 if(!paired.length)reasons.push('no_valid_paired_comparisons');
 // Direction is descriptive, never statistical proof of superiority.
 return {status:paired.length?'research_comparison_only':'comparison_withheld',
  matchedPlayerGames:paired.length,pfo:pfoResult,sleeper:sleeperResult,
  maeImprovementAgainstSleeper:gain,perPosition,excluded,
  evidenceSufficientForSuperiorityClaim:false,
  productionEligible:false,noSleeperFantasyActuals:true,
  predictionInputsComparable:paired.length>0,blockers:reasons,
  note:'Sleeper predictions are eligible only if independently converted to the SAME frozen FFL rules before kickoff. No certified outperformance claim is made.',
  pairs:paired};
}
