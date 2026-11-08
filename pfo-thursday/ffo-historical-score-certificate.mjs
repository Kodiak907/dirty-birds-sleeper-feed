/**
 * FFO FFL immutable historical score certification (2026).
 * Accept only explicit independently verified MSF stat/event components.
 * Missing value is UNKNOWN, never assumed 0. No Sleeper score dependency.
 */
import {normalizeStats} from './ffo-gamecast-model.mjs';
import {reconcileLongTDComponents643} from './ffo-long-td-policy-643.mjs';
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const id=x=>x===null||x===undefined?'':String(x);
const valid=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const FINAL=/^(FINAL|COMPLETED|FINAL_OT|FINAL_OVERTIME)$/i;
const playerPosition=p=>['QB','RB','WR','TE','K','DEF'].includes(String(p||'').toUpperCase());
const offenceRule=k=>/^(pass_|rush_|rec$|rec_|fum_|bonus_pass|bonus_rush|bonus_rec)/.test(k);
const kickerRule=k=>/^(fg|xp|bonus_fg|bonus_xp)/.test(k);
const defenseRule=k=>/^(def_|dst_|sack|int|fum_rec|pts_allow|yds_allow|blk_kick|safe|td|st_)/.test(k);
export const applicableFFLRuleKeys=(rules,position)=>{
 const pos=String(position||'').toUpperCase();
 const filter=pos==='K'?kickerRule:pos==='DEF'?defenseRule:offenceRule;
 if(!playerPosition(pos))return [];
 return Object.keys(rules||{}).filter(k=>filter(k)&&typeof rules[k]==='number'&&Number.isFinite(rules[k])&&rules[k]!==0).sort();
};
const ruleVersionOK=rules=>rules?.schema==='FFO_SCORING_RULES_V1'&&rules?.league==='FFL'&&rules?.season===2026&&
 typeof rules.scoring==='object'&&rules.scoring!==null;
const requiredGameChecks=['providerGameIdVerified','scheduleWeekVerified','finalScoreVerified',
 'fullPlayCoverageVerified','finalBoxScoreVerified','playerGameLogsVerified',
 'allScoringEventsReconciled','statCorrectionsChecked','scheduleGamesComplete'];
const distanceBonus=new Set(['pass_td_40p','pass_td_50p','rec_td_40p','rec_td_50p',
 'rush_td_40p','rush_td_50p']);
const number=x=>typeof x==='number'&&Number.isFinite(x)?x:null;

/**
 * componentProof: separate provider-linked observations:
 * {category,value,source,gameId,playerId,verified:true}
 * Never treat unverified events as awards. If both stat and PBP claim a
 * category, they must agree. Distance bonus proof must carry policy-specific
 * counts from the reconciled MSF play ledger, not generic box-score counts.
 */
export function certifyHistoricalFFLPlayerGame({game,player,rules,componentProof=[],
 bonusPolicy=null,bonusPolicyAdjudicated=false,
 longTDThresholdEvidence=null}={}){
 const errors=[],missing=[],components=[],contradictions=[];
 if(!ruleVersionOK(rules))errors.push('frozen_ffl_rules_unverified');
 if(!game||!id(game.id)||!Number.isInteger(game.week)||game.week<1||game.week>18)errors.push('game_identity_or_week_missing');
 if(game?.provider!=='MSF')errors.push('non_msf_game_provider');
 if(!FINAL.test(String(game?.status||'')))errors.push('game_not_final');
 for(const check of requiredGameChecks)if(game?.[check]!==true)errors.push('game_'+check+'_not_verified');
 if(!player||!id(player.id)||!playerPosition(player.position))errors.push('player_identity_or_position_missing');
 if(player?.identityVerified!==true)errors.push('player_identity_unverified');
 if(id(player?.gameId)!==id(game?.id))errors.push('player_game_id_mismatch');
 if(player?.team!==game?.home&&player?.team!==game?.away)errors.push('player_not_on_game_team');
 if(bonusPolicy!=='additive'&&bonusPolicy!=='highest_only')errors.push('touchdown_bonus_policy_unresolved');
 if(bonusPolicyAdjudicated!==true)errors.push('touchdown_bonus_policy_unadjudicated');
 const scored=rules?.scoring||{};
 const keys=applicableFFLRuleKeys(scored,player?.position);
 if(!keys.length)errors.push('no_applicable_ffl_rules');
 const published=normalizeStats(player?.stats||{});
 const evidenceByKey=new Map();
 for(const p of componentProof||[]){
  if(!p?.category||p.verified!==true||!valid(p.value)||
   id(p.playerId)!==id(player?.id)||id(p.gameId)!==id(game?.id)||
   !['msf_final_stat','msf_reconciled_pbp','msf_verified_team_log'].includes(p.source))continue;
  const k=String(p.category);
  if(!evidenceByKey.has(k))evidenceByKey.set(k,[]);
  evidenceByKey.get(k).push(p);
 }
 for(const category of keys){
  const entries=evidenceByKey.get(category)||[];
  const stat=number(published[category]);
  const proofs=entries.map(p=>p.value);
  const unique=[...new Set(proofs)];
  if(unique.length>1||(stat!==null&&unique.length>0&&unique.some(v=>v!==stat))){
   contradictions.push({category,stat,proofs:unique});continue;
  }
  if(distanceBonus.has(category)&&!entries.some(p=>p.source==='msf_reconciled_pbp')){
   missing.push(category);continue;
  }
  if(distanceBonus.has(category)&&bonusPolicyAdjudicated!==true){
   missing.push(category);continue;
  }
  const value=distanceBonus.has(category)?unique[0]:stat!==null?stat:unique.length?unique[0]:null;
  if(value===null||value===undefined){missing.push(category);continue;}
  const weight=scored[category];
  components.push({category,value,weight,points:round(value*weight),
   source:distanceBonus.has(category)?'msf_reconciled_pbp':stat!==null?'msf_final_player_log':entries[0]?.source||null});
 }
 if(contradictions.length)errors.push('conflicting_msf_stat_and_event_evidence');
 if(missing.length)errors.push('scoring_categories_not_verified');
 const longBonuses=reconcileLongTDComponents643({
  components,bonusPolicy,thresholdEvidence:longTDThresholdEvidence
 });
 if(!longBonuses.accepted)errors.push(longBonuses.reason);
 const effectiveComponents=longBonuses.accepted?longBonuses.components:components;
 const certified=errors.length===0&&effectiveComponents.length===keys.length;
 const points=certified?round(effectiveComponents.reduce((sum,c)=>sum+c.points,0)):null;
 return {status:certified?'certified':'withheld',certified,
  playerId:id(player?.id)||null,team:player?.team||null,position:player?.position||null,
  gameId:id(game?.id)||null,week:game?.week||null,opponent:player?.team===game?.home?game?.away:game?.home,
  provider:'MSF',rulesVersion:rules?.version||null,bonusPolicy:bonusPolicy||null,
  points,components:effectiveComponents,
  longTDBonusPolicySource:longBonuses.policySource||'unverified',
  requiredCategoryCount:keys.length,verifiedCategoryCount:effectiveComponents.length,
  missing,contradictions,blockers:[...new Set(errors)],
  source:'MSF final game/player log plus independently reconciled MSF scoring events × FFO FFL rules',
  fantasyScoreFromSleeper:false,
  playerIdentityVerified:certified,finalBoxScoreVerified:certified,
  statCategoriesComplete:certified,eventBonusesReconciled:certified,
  statCorrectionsChecked:certified,gameStatus:game?.status??null,
  fflPoints:points,finalPlayerScoreRecomputed:certified};
}
