/**
 * PFO 6.1: read-only league market research.
 * Inputs are provider-neutral league roster/ownership snapshots and independently
 * calculated FFL model estimates. No Sleeper point feeds, external market prices,
 * acceptance odds, league writes, auto-offers, or auto-waiver claims.
 */
import {lineupFromFFLResearch} from './ffo-trade-decision-60.mjs';
const POS=new Set(['QB','RB','WR','TE','K','DEF']);
const id=x=>String(x??'');
const pos=x=>String(x||'').toUpperCase().replace('D/ST','DEF').replace('DST','DEF');
const valid=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=200;
const rounded=x=>Math.round((x+Number.EPSILON)*10)/10;
const recent=t=>{const d=Date.parse(t||'');return Number.isFinite(d)&&d<=Date.now()+3600000&&Date.now()-d<=86400000};
const flag=p=>/^(OUT|IR|PUP|NFI|DOUBTFUL|QUESTIONABLE)$/i.test(String(p?.injury_status||p?.injury||p?.status||''));
const depthTargets=slots=>{
 const s=(slots||[]).map(pos);
 const n=k=>s.filter(x=>x===k).length;
 return {QB:Math.max(1,n('QB'))+1,RB:Math.max(1,n('RB'))+2,
  WR:Math.max(1,n('WR'))+2,TE:Math.max(1,n('TE'))+1,
  K:n('K')?1:0,DEF:n('DEF')?1:0};
};
const activeIds=r=>{
 const reserved=new Set((r?.reserve||[]).map(id));
 return (r?.players||[]).map(id).filter(x=>!reserved.has(x));
};
const counts=(ids,names)=>{
 const c={QB:0,RB:0,WR:0,TE:0,K:0,DEF:0};
 for(const pid of ids){const p=pos(names?.[pid]?.position);if(POS.has(p))c[p]++;}
 return c;
};
function candidates(r,names,estimate,maxPerPosition=4){
 const byPosition=new Map();
 for(const pid of activeIds(r)){
  const meta=names?.[pid],position=pos(meta?.position);
  if(!POS.has(position)||!meta?.name)continue;
  const amount=estimate(pid);
  if(!byPosition.has(position))byPosition.set(position,[]);
  byPosition.get(position).push({id:pid,name:meta.name,position,team:meta.team||'',
   ppg:valid(amount)?amount:null,injuryFlag:flag(meta)});
 }
 const all=[];
 for(const rows of byPosition.values()){
  rows.sort((a,b)=>(b.ppg??-1)-(a.ppg??-1)||a.name.localeCompare(b.name));
  all.push(...rows.slice(0,maxPerPosition));
 }
 return all;
}
function needScore(idsToReceive,rosterCounts,targets){
 return idsToReceive.reduce((sum,p)=>{
  const target=targets[p.position]||0,n=rosterCounts[p.position]||0;
  return sum+(target>n?3:target===n?1:0);
 },0);
}
function packageSum(players){
 return players.every(x=>valid(x.ppg))?rounded(players.reduce((sum,x)=>sum+x.ppg,0)):null;
}
function candidateKey(x){
 return x.partnerId+'|'+x.give.map(v=>v.id).sort().join(',')+'|'+x.take.map(v=>v.id).sort().join(',');
}
/**
 * Fast, bounded candidate discovery; "priority" is only a relative research
 * order based on positional depth and independent estimate completeness.
 * It is not trade fairness, manager acceptance, or expected fantasy gain.
 */
export function findTradeResearch({rosters=[],names={},estimate=()=>null,ownerRosterId='1',
 excludedRosterIds=['3'],starterSlots=[],snapshotAt=null,rulesReady=false,
 selectedPartnerId=null,maxResults=12}={}){
 if(!Array.isArray(rosters)||typeof estimate!=='function')return [];
 const own=rosters.find(r=>id(r.roster_id)===id(ownerRosterId));
 if(!own)return [];
 const exclude=new Set([id(ownerRosterId),...excludedRosterIds.map(id)]);
 const partners=rosters.filter(r=>!exclude.has(id(r.roster_id))&&
  (!selectedPartnerId||id(r.roster_id)===id(selectedPartnerId)));
 const targets=depthTargets(starterSlots),ourCounts=counts(activeIds(own),names);
 const ours=candidates(own,names,estimate,3);
 if(!ours.length)return [];
 const trusted=rulesReady===true&&recent(snapshotAt);
 const found=[];
 for(const other of partners){
  const theirs=candidates(other,names,estimate,3);
  if(!theirs.length)continue;
  const otherCounts=counts(activeIds(other),names);
  const append=(give,take)=>{
   const outgoing=packageSum(give),incoming=packageSum(take);
   const covered=outgoing!==null&&incoming!==null;
   const needOurs=needScore(take,ourCounts,targets),needTheirs=needScore(give,otherCounts,targets);
   const imbalance=covered?Math.abs(incoming-outgoing):null;
   const complexity=give.length+take.length-2;
   // Only relative sorting; do not expose as probability, fairness or quantified value.
   const priority=needOurs*4+needTheirs*4+(covered?6:0)-
    (imbalance===null?8:Math.min(25,imbalance)*0.8)-complexity*4-
    (give.some(p=>p.injuryFlag)||take.some(p=>p.injuryFlag)?3:0);
   found.push({partnerId:id(other.roster_id),give:give.map(x=>({...x})),
    take:take.map(x=>({...x})),format:give.length+' for '+take.length,
    outgoingPPG:trusted&&covered?outgoing:null,
    incomingPPG:trusted&&covered?incoming:null,
    completeness:give.concat(take).filter(p=>valid(p.ppg)).length+'/'+(give.length+take.length),
    needs:{ours:needOurs,theirs:needTheirs},
    priority,healthFlag:give.concat(take).some(p=>p.injuryFlag),
    researchOnly:true,acceptanceProbability:null,fairnessConfidence:null,
    warning:!trusted?'FFL model rules or Sleeper ownership freshness not verified':
     !covered?'Incomplete independent FFL estimates':'Conditional model research, not a fair-value guarantee'});
  };
  for(const a of ours)for(const b of theirs)append([a],[b]);
  // Add bounded 2-for-1 and 1-for-2 alternatives; leave roster cuts unresolved.
  const multiOurs=ours.slice(0,8),multiTheirs=theirs.slice(0,8);
  for(let i=0;i<multiOurs.length;i++)for(let j=i+1;j<multiOurs.length;j++)
   for(const b of multiTheirs.slice(0,5))append([multiOurs[i],multiOurs[j]],[b]);
  for(let i=0;i<multiTheirs.length;i++)for(let j=i+1;j<multiTheirs.length;j++)
   for(const a of multiOurs.slice(0,5))append([a],[multiTheirs[i],multiTheirs[j]]);
 }
 found.sort((a,b)=>b.priority-a.priority||
  (a.give.length+a.take.length)-(b.give.length+b.take.length)||
  a.partnerId.localeCompare(b.partnerId));
 const seen=new Set(),byPartner=new Map(),out=[];
 const maximum=Math.max(1,Math.min(30,Number(maxResults)||12));
 const limit=selectedPartnerId?maximum:3;
 const take=row=>{
  if(!row||out.length>=maximum)return false;
  const k=candidateKey(row);
  if(seen.has(k)||(byPartner.get(row.partnerId)||0)>=limit)return false;
  seen.add(k);byPartner.set(row.partnerId,(byPartner.get(row.partnerId)||0)+1);
  out.push(row);return true;
 };
 // Guarantee diverse starting points rather than returning twelve variations
 // of one multi-player structure. One-for-one options lead, followed by both
 // uneven package types when the current rosters genuinely support them.
 const partnerIds=[...new Set(found.map(row=>row.partnerId))];
 for(const format of ['1 for 1','2 for 1','1 for 2']){
  for(const partnerId of partnerIds){
   if(out.length>=maximum)break;
   take(found.find(row=>row.partnerId===partnerId&&row.format===format));
  }
 }
 for(const row of found){if(out.length>=maximum)break;take(row);}
 return out;
}
/**
 * Candidate directory MUST already be ownership-filtered by the caller.
 * No add/drop is executed; suggestions do not imply eligibility or clearance.
 */
export function findWaiverResearch({roster=null,names={},unrostered=[],estimate=()=>null,
 starterSlots=[],position='ALL',maxResults=8,rulesReady=false,snapshotAt=null}={}){
 if(!roster||!Array.isArray(unrostered))return [];
 const active=activeIds(roster),owned=new Set((roster.players||[]).map(id));
 const targets=depthTargets(starterSlots),current=counts(active,names);
 const starters=new Set((roster.starters||[]).map(id));
 const drops=active.filter(x=>names?.[x]&&POS.has(pos(names[x].position)))
  .map(x=>({id:x,name:names[x].name||x,position:pos(names[x].position),
   ppg:estimate(x),starter:starters.has(x),injuryFlag:flag(names[x])}));
 // The default board is a team-need view, not an endless QB/K/DST list.
 // A deliberately selected position remains available for full scouting.
 const bestAtPosition={};
 for(const d of drops)if(valid(d.ppg))
  bestAtPosition[d.position]=Math.max(bestAtPosition[d.position]??0,d.ppg);
 const rows=[];
 const seen=new Set();
 for(const c of unrostered){
  const pid=id(c.id??c.player_id),meta=names?.[pid]||c,p=pos(meta?.position||c.position);
  if(!pid||owned.has(pid)||seen.has(pid)||!POS.has(p)||!meta?.name)continue;
  if(position!=='ALL'&&position!==p&&!(position==='FLEX'&&['RB','WR','TE'].includes(p)))continue;
  const projected=valid(c.modelPPG)?c.modelPPG:estimate(pid);
  const ppg=valid(projected)?projected:null;
  if(position==='ALL'){
   const injury=String(meta.injury_status||meta.status||'').toUpperCase();
   if(/^(OUT|IR|PUP|NFI|DOUBTFUL)$/.test(injury))continue;
   if(['QB','K','DEF'].includes(p)&&(current[p]||0)>=(targets[p]||0)){
    const incumbent=bestAtPosition[p],requiredUpgrade=p==='QB'?3.5:2.5;
    if(!valid(ppg)||!valid(incumbent)||ppg-incumbent<requiredUpgrade)continue;
   }
  }
  seen.add(pid);
  const shortage=Math.max(0,(targets[p]||0)-(current[p]||0));
  const options=drops.slice().sort((a,b)=>{
   const sortValue=x=>(x.starter?20:0)+(x.position===p?0:5)+
    (valid(x.ppg)?x.ppg:10)+(x.injuryFlag?-2:0);
   return sortValue(a)-sortValue(b)||a.name.localeCompare(b.name);
  }).slice(0,3).map(d=>({...d,ppg:valid(d.ppg)?d.ppg:null}));
  const health=flag(meta);
  const priority=shortage*8+(ppg!==null?Math.min(20,ppg):0)+(options.length?2:0)-(health?4:0);
  rows.push({id:pid,name:meta.name,position:p,team:meta.team||'',ppg:rulesReady&&recent(snapshotAt)?ppg:null,
   availableFrom:'published unrostered directory',dropOptions:options,shortage,priority,
   healthFlag:health,researchOnly:true,faabRecommendation:null,
   warning:!rulesReady||!recent(snapshotAt)?'Model or roster freshness not verified':
    ppg===null?'Independent FFL model estimate missing':'Eligibility and waiver timing not verified'});
 }
 rows.sort((a,b)=>b.priority-a.priority||a.name.localeCompare(b.name));
 return rows.slice(0,Math.max(1,Math.min(20,Number(maxResults)||8)));
}
export function compareWaiverSwap({roster=null,addId,dropId,names={},estimate=()=>null,
 starterSlots=[],rulesReady=false,snapshotAt=null}={}){
 const before=(roster?.players||[]).map(id),reserve=new Set((roster?.reserve||[]).map(id));
 const add=id(addId),drop=id(dropId);
 if(!roster||!add||!drop||add===drop||!before.includes(drop)||reserve.has(drop)||before.includes(add))
  return {status:'invalid',delta:null,reason:'ownership_or_reserve_not_verified'};
 if(!rulesReady||!recent(snapshotAt))
  return {status:'withheld',delta:null,reason:'ffl_rules_or_ownership_freshness_not_verified'};
 const active=before.filter(x=>!reserve.has(x));
 const after=active.filter(x=>x!==drop).concat(add);
 const index={};
 for(const pid of new Set([...active,add])){
  const p=names?.[pid]||{};
  const amt=estimate(pid);
  index[pid]={position:pos(p.position),ppg:valid(amt)?amt:null,
   name:p.name||pid,injury:p.injury_status||p.status||null};
 }
 const b=lineupFromFFLResearch(active,starterSlots,index);
 const a=lineupFromFFLResearch(after,starterSlots,index);
 const delta=b.status==='conditional'&&a.status==='conditional'?rounded(a.points-b.points):null;
 return {status:delta===null?'withheld':'conditional',delta,
  reason:delta===null?'starter_slots_or_player_estimates_incomplete':'conditional_lineup_research',
  before:b,after:a,addId:add,dropId:drop,acceptanceProbability:null};
}
