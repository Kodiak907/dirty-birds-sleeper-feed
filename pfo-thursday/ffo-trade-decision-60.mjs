/**
 * PFO Trade Intelligence 6.0 — transparent two-sided FFL trade research.
 * Sleeper: roster ownership and roster slots ONLY. Player PPG must be supplied
 * from independent FFL scoring/projection evidence. NEVER price FAAB in points
 * or assert a model prediction is certified, guaranteed or manager-approved.
 */
const POS=new Set(['QB','RB','WR','TE','K','DEF']);
const norm=x=>String(x||'').toUpperCase().replace('D/ST','DEF').replace('DST','DEF');
const key=x=>String(x);
const finite=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=200;
const round=x=>Math.round((x+Number.EPSILON)*10)/10;
const sourceTime=x=>{const t=Date.parse(x||'');return Number.isFinite(t)?t:null};
const STARTER_SLOTS=new Set(['QB','RB','WR','TE','K','DEF','FLEX','W/R/T','W/R','W/T','R/T','SUPER_FLEX','SUPERFLEX','OP']);
const activeSlot=x=>STARTER_SLOTS.has(norm(x));
export function tradeSlotEligibility(slot,position){
 const s=norm(slot),p=norm(position);
 if(s===p)return true;
 if(['FLEX','W/R/T'].includes(s))return ['RB','WR','TE'].includes(p);
 if(s==='W/R')return ['WR','RB'].includes(p);
 if(s==='W/T')return ['WR','TE'].includes(p);
 if(s==='R/T')return ['RB','TE'].includes(p);
 if(['SUPER_FLEX','SUPERFLEX','OP'].includes(s))return ['QB','RB','WR','TE'].includes(p);
 return false;
}
export function validateTradeSelection({ourRoster=[],theirRoster=[],give=[],take=[],
 partnerRosterId='',excludedRosterId='3',limit=3}={}){
 const issues=[];
 if(!partnerRosterId||key(partnerRosterId)==='1'||key(partnerRosterId)===key(excludedRosterId))
  issues.push('trade_partner_not_eligible');
 if(!give.length||!take.length)issues.push('incomplete_player_exchange');
 if(give.length>limit||take.length>limit)issues.push('package_exceeds_player_limit');
 if(new Set(give.map(key)).size!==give.length||new Set(take.map(key)).size!==take.length)
  issues.push('duplicate_player');
 const ourSet=new Set(ourRoster.map(key)),theirSet=new Set(theirRoster.map(key));
 if(give.some(x=>!ourSet.has(key(x))))issues.push('outgoing_ownership_unverified');
 if(take.some(x=>!theirSet.has(key(x))))issues.push('incoming_ownership_unverified');
 if(give.some(x=>theirSet.has(key(x)))||take.some(x=>ourSet.has(key(x))))
  issues.push('cross_owned_player');
 return [...new Set(issues)];
}
export function lineupFromFFLResearch(ids=[],slots=[],playerIndex={}){
 const starters=slots.map(norm).filter(activeSlot);
 if(starters.length===0||starters.length>13)
  return {status:'withheld',reason:'starter_slot_config_unverified',points:null};
 const all=ids.map(key),unknown=[],eligible=[],injuries=[];
 for(const id of all){
  const p=playerIndex[id];
  if(!p||!POS.has(norm(p.position))){
   unknown.push(id);continue;
  }
  if(!starters.some(slot=>tradeSlotEligibility(slot,p.position)))continue;
  if(!finite(p.ppg)){unknown.push(id);continue;}
  eligible.push({id,position:norm(p.position),ppg:p.ppg});
  if(/^(OUT|IR|PUP|NFI|DOUBTFUL)$/i.test(String(p.injury||'')))injuries.push(id);
 }
 if(unknown.length)return {status:'withheld',reason:'eligible_player_forecast_missing',
  points:null,missing:unknown,eligibleCount:eligible.length};
 const count=1<<starters.length,full=count-1;
 let dp=new Map([[0,{total:0,used:[]}]]);
 for(const p of eligible){
  const next=new Map(dp);
  for(const [mask,record] of dp){
   for(let i=0;i<starters.length;i++){
    if((mask&(1<<i))||!tradeSlotEligibility(starters[i],p.position))continue;
    const m=mask|(1<<i),total=record.total+p.ppg;
    if(!next.has(m)||next.get(m).total<total)
     next.set(m,{total,used:[...record.used,{id:p.id,slot:starters[i],ppg:p.ppg}]});
   }
  }
  dp=next;
 }
 const final=dp.get(full);
 if(!final)return {status:'withheld',reason:'starter_positions_unfilled',
  points:null,missingSlots:starters.length-Math.max(...[...dp.keys()].map(x=>x.toString(2).replace(/0/g,'').length))};
 return {status:'conditional',points:round(final.total),starters:final.used,
  injuryFlags:injuries,covered:eligible.length,slots:starters.length};
}
function depth(roster=[],index={}){
 const out={QB:0,RB:0,WR:0,TE:0,K:0,DEF:0,unknown:0};
 for(const id of roster){
  const p=norm(index[key(id)]?.position);
  if(Object.hasOwn(out,p))out[p]++;else out.unknown++;
 }
 return out;
}
function swap(base,remove,add){
 const lost=new Set(remove.map(key)),left=base.map(key).filter(x=>!lost.has(x));
 return [...new Set([...left,...add.map(key)])];
}
function badHealth(p){return /^(IR|OUT|PUP|NFI|DOUBTFUL|QUESTIONABLE)$/i.test(String(p?.injury||''))}
export function evaluateFFLTrade({
 ourRoster=[],theirRoster=[],give=[],take=[],partnerRosterId,playerIndex={},
 starterSlots=[],rosterCap=null,snapshotAt=null,ruleReady=false,
 ourFAAB=0,theirFAAB=0,confirmedOurSpendable=null,confirmedTheirSpendable=null
}={}){
 const issues=validateTradeSelection({ourRoster,theirRoster,give,take,partnerRosterId});
 const receipts=[...give,...take].map(key);
 const players=receipts.map(id=>({id,...(playerIndex[id]||{})}));
 const forecastCoverage={present:players.filter(x=>finite(x.ppg)).length,total:players.length,
  missing:players.filter(x=>!finite(x.ppg)).map(x=>x.id)};
 const age=sourceTime(snapshotAt),stale=age===null||Date.now()-age>24*3600000||age>Date.now()+3600000;
 if(stale)issues.push('ownership_snapshot_stale_or_undated');
 if(!ruleReady)issues.push('ffl_rule_feed_not_ready');
 if(forecastCoverage.missing.length)issues.push('selected_player_projections_incomplete');
 const toInt=x=>Number.isInteger(x)&&x>=0&&x<=999?x:null;
 const ourCash=toInt(ourFAAB),theirCash=toInt(theirFAAB);
 if(ourCash===null||theirCash===null)issues.push('faab_invalid');
 if(ourCash>0&&(confirmedOurSpendable===null||!Number.isInteger(confirmedOurSpendable)))
  issues.push('our_faab_balance_unconfirmed');
 if(ourCash>0&&Number.isInteger(confirmedOurSpendable)&&ourCash>confirmedOurSpendable)
  issues.push('our_faab_exceeds_spendable');
 if(theirCash>0&&(confirmedTheirSpendable===null||!Number.isInteger(confirmedTheirSpendable)))
  issues.push('opponent_faab_balance_unconfirmed');
 if(theirCash>0&&Number.isInteger(confirmedTheirSpendable)&&theirCash>confirmedTheirSpendable)
  issues.push('opponent_faab_exceeds_spendable');
 const ourAfter=swap(ourRoster,give,take),theirAfter=swap(theirRoster,take,give);
 const cap=Number.isInteger(rosterCap)&&rosterCap>0?rosterCap:null;
 const cuts={ours:cap?Math.max(0,ourAfter.length-cap):null,
  theirs:cap?Math.max(0,theirAfter.length-cap):null};
 if((cuts.ours||0)+(cuts.theirs||0)>0)issues.push('hypothetical_roster_cuts_required');
 const before=issues.includes('outgoing_ownership_unverified')||issues.includes('incoming_ownership_unverified')?
  null:{
   ours:lineupFromFFLResearch(ourRoster,starterSlots,playerIndex),
   theirs:lineupFromFFLResearch(theirRoster,starterSlots,playerIndex)
  };
 const after=before?{
  ours:lineupFromFFLResearch(ourAfter,starterSlots,playerIndex),
  theirs:lineupFromFFLResearch(theirAfter,starterSlots,playerIndex)
 }:null;
 const cleanDelta=(a,b)=>a?.status==='conditional'&&b?.status==='conditional'?
  round(b.points-a.points):null;
 const us=before&&after&&cuts.ours===0&&cuts.theirs===0&&ruleReady&&!stale?cleanDelta(before.ours,after.ours):null;
 const them=before&&after&&cuts.ours===0&&cuts.theirs===0&&ruleReady&&!stale?cleanDelta(before.theirs,after.theirs):null;
 const pack=ids=>ids.every(id=>finite(playerIndex[key(id)]?.ppg))?
  round(ids.reduce((sum,id)=>sum+playerIndex[key(id)].ppg,0)):null;
 const outgoing=pack(give),incoming=pack(take);
 const health=players.filter(badHealth).map(x=>({id:x.id,name:x.name||x.id,status:x.injury}));
 const previous={ours:depth(ourRoster,playerIndex),theirs:depth(theirRoster,playerIndex)};
 const current={ours:depth(ourAfter,playerIndex),theirs:depth(theirAfter,playerIndex)};
 const metricTrust=us!==null&&them!==null&&ruleReady&&!stale?
  'conditional_covered':'insufficient_data';
 const bothGain=us!==null&&them!==null&&us>0&&them>0;
 const headline=issues.some(x=>x==='trade_partner_not_eligible'||x==='outgoing_ownership_unverified'||
  x==='incoming_ownership_unverified'||x==='our_faab_exceeds_spendable')?
  'Ownership or FAAB validation required':
  bothGain?'Both lineups improve in a conditional model':
  us!==null&&them!==null?'Two-sided starter impact modeled conditionally':
  'Starter impact withheld until inputs are complete';
 return {
  status:issues.includes('trade_partner_not_eligible')?'invalid':'research_only',
  headline,issues,partnerRosterId:key(partnerRosterId||''),
  outgoingPPG:outgoing,incomingPPG:incoming,packageNetPPG:outgoing!==null&&incoming!==null?round(incoming-outgoing):null,
  starterDelta:{ours:us,theirs:them},before,after,
  depthBefore:previous,depthAfter:current,
  rosterAfter:{ours:ourAfter,theirs:theirAfter},rosterCuts:cuts,
  coverage:forecastCoverage,health,
  faab:{weSend:ourCash,theySend:theirCash,netForUs:ourCash!==null&&theirCash!==null?theirCash-ourCash:null,
   ourBalanceVerified:ourCash===0||Number.isInteger(confirmedOurSpendable),
   theirBalanceVerified:theirCash===0||Number.isInteger(confirmedTheirSpendable)},
  source:{ownership:'Sleeper read-only',ownershipAt:snapshotAt||null,
   projectedFFL:'independent NFL-stat FFL research · NOT backtest-certified',
   productionScoringCertified:false,rosterAgeVerified:!stale,
   metricTrust,managerAcceptanceProbability:null},
  verdict:'Research only; manager interest, health, opponent adjustments and future-game forecasts are not independently validated.',
  rosterChange:{ours:ourAfter.length-ourRoster.length,theirs:theirAfter.length-theirRoster.length}
 };
}
