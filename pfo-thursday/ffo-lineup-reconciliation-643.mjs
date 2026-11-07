/**
 * PFO 6.43: pure single-source FFL lineup projection reconciliation.
 * Read-only research module; NOT connected to protected PFO preview.
 * Sleeper may supply slot assignment/IDs, never score inputs.
 */
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
export const FFL_STARTER_SLOTS=Object.freeze([
 'QB','RB','RB','WR','WR','TE','FLEX','FLEX','K','DEF'
]);
const normPos=x=>String(x??'').toUpperCase().replace(/^D\/?ST$/,'DEF');
const cleanId=x=>typeof x==='string'||typeof x==='number'?String(x).trim():'';
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const posAllowed=(slot,pos)=>{
 if(!pos)return false;
 return slot==='FLEX'?['RB','WR','TE'].includes(pos):slot===pos;
};
const sameForecast=(a,b)=>a?.points===b?.points&&
 a?.rulesVersion===b?.rulesVersion&&a?.modelVersion===b?.modelVersion;

export function evaluateFFLLineup({slots,projections={},rulesVersion=FFL_RULES_VERSION}={}){
 const issues=[],rows=[],seen=new Set();
 const sourced=projections&&typeof projections==='object'?projections:{};
 const valid=Array.isArray(slots)&&slots.length===10;
 if(!valid)issues.push('exactly_ten_submitted_starter_slots_required');
 if(rulesVersion!==FFL_RULES_VERSION)issues.push('unrecognized_ffl_scoring_contract');
 let knownSubtotal=0,covered=0,partial=0;
 for(let i=0;i<FFL_STARTER_SLOTS.length;i++){
  const expected=FFL_STARTER_SLOTS[i],entry=Array.isArray(slots)?slots[i]:null;
  const slot=normPos(entry?.slot),id=cleanId(entry?.playerId??entry?.id);
  const pos=normPos(entry?.position);
  const problems=[];
  if(slot!==expected)problems.push('submitted_slot_order_or_identity_mismatch');
  if(!id||id==='0')problems.push('submitted_starter_missing');
  if(id&&id!=='0'&&seen.has(id))problems.push('duplicate_starter_identity');
  if(id&&id!=='0')seen.add(id);
  if(id&&id!=='0'&&!posAllowed(expected,pos))problems.push('starter_position_ineligible');
  const selected=id&&Object.hasOwn(sourced,id)?sourced[id]:entry?.projection;
  if(id&&Object.hasOwn(sourced,id)&&entry?.projection&&
   !sameForecast(entry.projection,sourced[id]))
   problems.push('conflicting_projection_across_tools');
  let points=null;
  if(!selected||!Number.isFinite(selected.points)||Math.abs(selected.points)>200){
   problems.push('missing_or_invalid_ffl_projection');
  }else if(selected.rulesVersion!==FFL_RULES_VERSION){
   problems.push('projection_rules_version_mismatch');
  }else if(!problems.length){
   points=selected.points;knownSubtotal+=points;covered++;
   if(selected.partial!==false||selected.certified!==true)partial++;
  }
  rows.push({index:i,slot:expected,playerId:id||null,position:pos||null,
   points,partial:points!==null?(selected?.partial!==false||selected?.certified!==true):null,
   certified:points!==null&&selected?.certified===true&&selected?.partial===false,
   modelVersion:selected?.modelVersion??null,
   source:selected?.source??null,problems});
  for(const problem of problems)issues.push(problem);
 }
 const eligible=valid&&covered===10&&issues.length===0&&rulesVersion===FFL_RULES_VERSION;
 return {
  schema:'PFO_643_FFL_LINEUP_PROJECTION_V1',
  rulesVersion:FFL_RULES_VERSION,requiredSlots:10,numericCovered:covered,
  missingOrInvalid:10-covered,knownSubtotal:covered?round(knownSubtotal):null,
  projectedTotal:eligible?round(knownSubtotal):null,
  totalStatus:eligible?(partial?'complete_numeric_partial_scoring_evidence':'complete_numeric_all_components_certified'):
   'incomplete_do_not_show_as_full_team_total',
  partialModels:partial,
  certified:eligible&&partial===0,
  issueCodes:[...new Set(issues)],rows,
  sourceOfPlayerIds:'authorized_roster_and_lineup_state_only',
  sourceOfFantasyPoints:'independent_FFL_versioned_model_only',
  submittedLineupChanged:false
 };
}
export function compareFFLLineups({submitted,optimized,projections={}}={}){
 const from=evaluateFFLLineup({slots:submitted,projections});
 const to=evaluateFFLLineup({slots:optimized,projections});
 const ids=slots=>Array.isArray(slots)?slots.map(x=>cleanId(x?.playerId??x?.id)):[],
  before=ids(submitted),after=ids(optimized),
  original=new Set(before),candidate=new Set(after);
 return {
  schema:'PFO_643_LINEUP_COMPARISON_V1',
  submitted:from,optimized:to,
  playersOut:before.filter(id=>id&&id!=='0'&&!candidate.has(id)),
  playersIn:after.filter(id=>id&&id!=='0'&&!original.has(id)),
  changedSlots:FFL_STARTER_SLOTS.map((slot,i)=>({
   index:i,slot,submittedPlayerId:before[i]||null,optimizedPlayerId:after[i]||null,
   changed:before[i]!==after[i],
   submittedPoints:from.rows[i].points,optimizedPoints:to.rows[i].points
  })).filter(x=>x.changed),
  projectedDelta:from.projectedTotal!==null&&to.projectedTotal!==null?
   round(to.projectedTotal-from.projectedTotal):null,
  autoSubmitsLineup:false,coachDecisionRequired:true,
  dataComplete:from.projectedTotal!==null&&to.projectedTotal!==null,
  uncertifiedScoringEvidence:!from.certified||!to.certified
 };
}
