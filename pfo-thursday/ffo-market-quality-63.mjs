/**
 * PFO 6.3 — constrained research engine.
 * Provider-neutral, read-only. No fair-value confidence, acceptance odds,
 * FFO-certified scores, medical clearance, or automatic league transactions.
 */
import {compareWaiverSwap} from './ffo-market-finder-61.mjs';
const id=x=>String(x??'');
const pos=x=>String(x||'').toUpperCase().replace('D/ST','DEF').replace('DST','DEF');
const finite=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=200;
const round=x=>Math.round(x*10)/10;
const fresh=x=>{const t=Date.parse(x||'');return Number.isFinite(t)&&Date.now()-t>=-3600000&&Date.now()-t<=86400000};
const gamePositions=new Set(['QB','RB','WR','TE','K','DEF']);
const protectedIds=a=>new Set((a||[]).map(id));
const active=r=>(r?.players||[]).map(id).filter(x=>!(r?.reserve||[]).map(id).includes(x));
const counts=(ids,names)=>{const n={QB:0,RB:0,WR:0,TE:0,K:0,DEF:0};
 for(const x of ids){const p=pos(names[x]?.position);if(p in n)n[p]++;}return n;};
const minimum=slots=>{
 const values=(slots||[]).map(pos);return Object.fromEntries(['QB','RB','WR','TE','K','DEF'].map(k=>
  [k,values.filter(x=>x===k).length]));
};
const targets=m=>({QB:Math.max(1,m.QB)+1,RB:Math.max(1,m.RB)+2,WR:Math.max(1,m.WR)+2,
 TE:Math.max(1,m.TE)+1,K:m.K,DEF:m.DEF});
const combinations=(arr,n,max=100)=>{const out=[];
 const visit=(i,current)=>{if(out.length>=max)return;
  if(current.length===n){out.push(current.slice());return;}
  for(let k=i;k<arr.length;k++){current.push(arr[k]);visit(k+1,current);current.pop();if(out.length>=max)return;}
 };visit(0,[]);return out;};
const getPlayers=(r,names,estimate,lock,availability)=>active(r).filter(pid=>!lock.has(pid))
 .map(pid=>{const p=names[pid]||{},position=pos(p.position),raw=estimate(pid);
  const status=String(p.injury_status||'').toUpperCase();
  const assessment=typeof availability==='function'?availability(pid,{...p,id:pid}):null;
  const excluded=assessment?.standardEligible===false||
   (!assessment&&/^(IR|PUP|NFI|INJURED RESERVE)$/.test(status))||
   /^(OUT|DOUBTFUL|QUESTIONABLE)$/.test(status);
  return {id:pid,name:p.name||pid,position,team:p.team||'',ppg:finite(raw)?raw:null,excluded};})
 .filter(p=>p.name&&gamePositions.has(p.position)&&!p.excluded);
const near=(n,d)=>d>0?n/d:NaN;
function rosterFits(base,remove,add,minimums,names){
 const exclude=new Set(remove.map(x=>x.id));
 const ids=base.filter(x=>!exclude.has(x)).concat(add.map(x=>x.id));
 const n=counts(ids,names);
 return Object.keys(minimums).every(p=>n[p]>=minimums[p]);
}
const relativeNeed=(before,after,target)=>Object.keys(target).reduce((s,p)=>s+
 Math.max(0,target[p]-before[p])-Math.max(0,target[p]-after[p]),0);
const roleDelta=(give,take,leagueVOR)=>{
 const sum=a=>a.reduce((s,p)=>s+(p.ppg-leagueVOR[p.position]),0);
 return {out:sum(give),in:sum(take)};
};
function replacementBaselines(rosters,names,estimate,slots){
 const by={QB:[],RB:[],WR:[],TE:[],K:[],DEF:[]};
 for(const r of rosters)for(const pid of active(r)){
  const p=pos(names[pid]?.position),v=estimate(pid);
  if(p in by&&finite(v))by[p].push(v);
 }
 const min=minimum(slots);
 return Object.fromEntries(Object.entries(by).map(([p,values])=>{
  values.sort((a,b)=>b-a);
  const ix=Math.max(0,(min[p]||1)*Math.max(1,rosters.length)-1);
  return [p,values[Math.min(ix,values.length-1)]??null];
 }));
}
export function screenTradePackages({
 rosters=[],names={},estimate=()=>null,ownerRosterId='1',excludedRosterIds=['3'],
 starterSlots=[],snapshotAt=null,rulesReady=false,selectedPartnerId=null,
 maxResults=10,objective='BALANCED',fairOnly=true,preferUneven=false,
 protectedMine=[],protectedByManager={},availability=null
}={}){
 const empty={results:[],diagnostics:{priced:0,considered:0,reason:'not_checked'}};
 if(!Array.isArray(rosters)||!rosters.length||typeof estimate!=='function')return empty;
 const own=rosters.find(r=>id(r.roster_id)===id(ownerRosterId));if(!own)return empty;
 const trusted=rulesReady===true&&fresh(snapshotAt);
 if(!trusted)return {...empty,diagnostics:{priced:0,considered:0,reason:'independent_model_or_roster_snapshot_not_ready'}};
 const objectivePos=['QB','RB','WR','TE'].includes(objective)?objective:null;
 const exclude=new Set([id(ownerRosterId),...excludedRosterIds.map(id)]);
 const allowed=rosters.filter(r=>!exclude.has(id(r.roster_id))&&(!selectedPartnerId||id(r.roster_id)===id(selectedPartnerId)));
 const min=minimum(starterSlots),target=targets(min),baselines=replacementBaselines(rosters,names,estimate,starterSlots);
 // Only covered player values allow a screened trade idea. Missing data cannot
 // become a bogus "fair" offer just because roster depth suggests a need.
 const ours=getPlayers(own,names,estimate,protectedIds(protectedMine),availability);
 const allOwn=active(own),ownCounts=counts(allOwn,names),results=[];
 let priced=0,considered=0;
 for(const other of allowed){
  const theirLocks=protectedIds(protectedByManager[id(other.roster_id)]);
  const theirs=getPlayers(other,names,estimate,theirLocks,availability);
  const theirIds=active(other),theirCounts=counts(theirIds,names);
  const useOurs=ours.filter(x=>finite(x.ppg)&&!['K','DEF'].includes(x.position));
  const useTheirs=theirs.filter(x=>finite(x.ppg)&&!['K','DEF'].includes(x.position));
  const shapes=[[1,1],[2,1],[1,2],[2,2],[3,1],[1,3],[3,2],[2,3]];
  for(const [a,b] of shapes){
   const gs=combinations(useOurs.slice(0,10),a,a===1?10:40);
   const ts=combinations(useTheirs.slice(0,10),b,b===1?10:40);
   for(const give of gs)for(const take of ts){
    considered++;
    if(!rosterFits(allOwn,give,take,min,names)||!rosterFits(theirIds,take,give,min,names))continue;
    // Avoid 2 QBs or 3 WRs bundled with little football utility.
    if(give.filter(x=>x.position==='QB').length>1||take.filter(x=>x.position==='QB').length>1)continue;
    const ourAfter=counts(allOwn.filter(x=>!give.some(g=>g.id===x)).concat(take.map(x=>x.id)),names);
    const theirAfter=counts(theirIds.filter(x=>!take.some(t=>t.id===x)).concat(give.map(x=>x.id)),names);
    const needUs=relativeNeed(ownCounts,ourAfter,target),needThem=relativeNeed(theirCounts,theirAfter,target);
    const upgrade=objectivePos&&take.some(x=>x.position===objectivePos)&&
     (give.filter(x=>x.position===objectivePos).length<take.filter(x=>x.position===objectivePos).length||
     Math.max(...take.filter(x=>x.position===objectivePos).map(x=>x.ppg))>
       Math.max(0,...give.filter(x=>x.position===objectivePos).map(x=>x.ppg)));
    if(objectivePos&&!upgrade)continue;
    if(needUs<0||needThem<0)continue;
    if(needUs===0&&needThem===0&&!objectivePos)continue;
    const baseKnown=give.concat(take).every(p=>finite(baselines[p.position]));
    if(!baseKnown)continue;
    priced++;
    const value=roleDelta(give,take,baselines),ratio=near(value.in,value.out);
    // Conservative replacement-value guard: no cross-position raw PPG swaps.
    // Replacements can be below zero, so compare absolute VOR differences too.
    const gap=Math.abs(value.in-value.out),scale=Math.max(3,Math.abs(value.in),Math.abs(value.out));
    const balanced=gap/scale<=0.26&&(!Number.isFinite(ratio)||ratio>=0.65&&ratio<=1.45);
    if(fairOnly&&!balanced)continue;
    // Every result must have a concrete trade rationale, never a fabricated win %.
    const score=needUs*8+needThem*8+(balanced?8:0)+(objectivePos&&upgrade?6:0)-
      Math.min(25,gap)*2-Math.max(0,a+b-2)*1.5+(preferUneven&&a!==b?4:0);
    if(score<0)continue;
    results.push({partnerId:id(other.roster_id),give,take,format:a+' for '+b,
     outgoingPPG:round(give.reduce((s,x)=>s+x.ppg,0)),
     incomingPPG:round(take.reduce((s,x)=>s+x.ppg,0)),
     completeness:(a+b)+'/'+(a+b),needs:{ours:needUs,theirs:needThem},
     rationale:(needUs>0?'Fills our depth need':'Position-upgrade research')+'; '+
       (needThem>0?'addresses their shortage':'does not add their depth'),
     replacementValueGap:round(value.in-value.out),
     priority:score,balanced,healthFlag:false,researchOnly:true,
     acceptanceProbability:null,fairnessConfidence:null,
     warning:'Conditional replacement-value screening; starting impact requires complete lineup coverage'});
   }
  }
 }
 results.sort((a,b)=>b.priority-a.priority||
  (preferUneven?Number(b.give.length!==b.take.length)-Number(a.give.length!==a.take.length):0));
 const out=[],managerCount=new Map(),formats=new Map(),used=new Set();
 const maximum=Math.min(20,Math.max(1,Number(maxResults)||10));
 for(const r of results){
  if(out.length>=maximum)break;
  const key=r.partnerId+'|'+r.give.map(x=>x.id).sort().join(':')+'|'+r.take.map(x=>x.id).sort().join(':');
  if(used.has(key)||(managerCount.get(r.partnerId)||0)>=3)continue;
  if(r.format==='1 for 1'&&(formats.get(r.format)||0)>=Math.ceil(maximum/4))continue;
  // Never allow one attractive individual to be repeated in every suggestion.
  if(out.some(x=>x.partnerId===r.partnerId&&
   x.give.map(p=>p.id).join(',')===r.give.map(p=>p.id).join(',')&&x.take.some(p=>r.take.some(t=>t.id===p.id))))continue;
  out.push(r);used.add(key);managerCount.set(r.partnerId,(managerCount.get(r.partnerId)||0)+1);
  formats.set(r.format,(formats.get(r.format)||0)+1);
 }
 return {results:out,diagnostics:{priced,considered,
  reason:out.length?'screened':priced?'no_packages_met_two_sided_guardrails':'insufficient_covered_player_valuations'}};
}
export function recommendWaiverPairs({
 roster=null,names={},unrostered=[],estimate=()=>null,starterSlots=[],
 snapshotAt=null,rulesReady=false,availability=null,position='ALL',
 maxResults=8,protectedMine=[]
}={}){
 if(!roster||!Array.isArray(unrostered))return {results:[],reason:'ownership_unavailable'};
 const mine=active(roster),owned=new Set((roster.players||[]).map(id)),locks=protectedIds(protectedMine);
 const starters=new Set((roster.starters||[]).map(id)),min=minimum(starterSlots),
  target=targets(min),have=counts(mine,names);
 const pool=unrostered.filter(p=>{
  const pid=id(p.id||p.player_id),info=names[pid]||p,role=pos(info.position);
  if(!pid||owned.has(pid)||!gamePositions.has(role)||!info.name)return false;
  if(position!=='ALL'&&position!=='IR'&&role!==position&&
   !(position==='FLEX'&&['RB','WR','TE'].includes(role)))return false;
  const clearance=availability?.(pid,{...p,...info,id:pid});
  const ir=clearance?.irTabEligible===true||
   (!clearance&&/^(IR|PUP|NFI|INJURED RESERVE)$/i.test(String(info.injury_status||'')));
  if(/^(OUT|DOUBTFUL)$/i.test(String(info.injury_status||''))&&position!=='IR')return false;
  return position==='IR'?ir:!ir;
 }).slice(0,250);
 const results=[];
 for(const candidate of pool){
  const pid=id(candidate.id||candidate.player_id),p=names[pid]||candidate,
   role=pos(p.position),raw=estimate(pid),score=finite(raw)?raw:finite(candidate.modelPPG)?candidate.modelPPG:null;
  const need=Math.max(0,target[role]-have[role]);
  const options=[];
  for(const dropId of mine){
   if(locks.has(dropId)||starters.has(dropId))continue;
   const d=names[dropId];if(!d)continue;
   const roleDrop=pos(d.position);
   // Do not leave essential positions unfilled just to get another bench player.
   if(have[roleDrop]-1+(roleDrop===role?1:0)<min[roleDrop])continue;
   const dp=estimate(dropId),dropPPG=finite(dp)?dp:null;
   const same=role===roleDrop;
   if(need===0&&roleDrop!==role)continue;
   const diff=finite(score)&&finite(dropPPG)?round(score-dropPPG):null;
   const coverage=rulesReady&&fresh(snapshotAt)&&diff!==null;
   if(need===0&&(!coverage||diff<1.5))continue;
   // No default auto-drop if neither player's value can be compared.
   if(!coverage)continue;
   const loss=roleDrop===role?0:Math.max(0,target[roleDrop]-(have[roleDrop]-1));
   const metric=need*8+(same?5:0)+Math.min(18,diff)+
    (have[roleDrop]>target[roleDrop]?5:0)-loss*9-
    Math.max(0,dropPPG)*0.15;
   options.push({id:dropId,name:d.name||dropId,position:roleDrop,
    ppg:dropPPG,starter:false,modelGap:diff,score:metric});
  }
  options.sort((a,b)=>b.score-a.score);
  if(!options.length)continue;
  const best=options[0];
  results.push({id:pid,name:p.name,team:p.team||'',position:role,
   ppg:score,shortage:need,reserved:position==='IR',
   selectedDrop:best,dropOptions:options.slice(0,4),priority:best.score+
    (score!==null?score*0.2:0),researchOnly:true,faabRecommendation:null,
   rationale:need?'Adds depth to a thin position':'Supported same-position model upgrade',
   modelGap:best.modelGap,
   starterDelta:compareWaiverSwap({roster,addId:pid,dropId:best.id,names,estimate,
    starterSlots,rulesReady,snapshotAt,availability}).delta,
   warning:'Candidate comparison is provisional; waiver lock, health, and starter impact need verification'});
 }
 results.sort((a,b)=>b.priority-a.priority||a.name.localeCompare(b.name));
 const out=[],seenDrop=new Set();
 for(const row of results){
  if(out.length>=maxResults)break;
  const alternative=row.dropOptions.find(x=>!seenDrop.has(x.id));
  if(alternative){row.selectedDrop=alternative;seenDrop.add(alternative.id);}
  out.push(row);
 }
 return {results:out,reason:out.length?'paired':'no_supported_positive_add_drop_pairs'};
}
