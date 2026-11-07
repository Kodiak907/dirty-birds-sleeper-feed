import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ffo598NormalizeSeason} from './ffo-msf-season-normalizer-643.mjs';
import {verifyNormalizedMSFPlayerIndex} from './ffo-msf-trusted-read-643.mjs';
import {joinVerifiedPFOIdentity643} from './ffo-msf-roster-parity-643.mjs';
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
const rules=JSON.parse(readFileSync(new URL('./FFO_FFL_SCORING_V1.json',import.meta.url),'utf8'));
const now='2026-11-08T18:00:00Z';
const game={provider:'MSF',verified:true,gameId:'g101',id:'g101',week:10,
 kickoffAt:'2026-11-08T18:25:00.000Z',home:'BUF',away:'MIA',status:'SCHEDULED'};
const row=(id,name,team,position,stats)=>({
 player:{id,fullName:name,primaryPosition:{abbreviation:position}},
 team:{abbreviation:team},stats});
function msfIndex(rows){
 const normalized=ffo598NormalizeSeason({playerStatsTotals:rows},now);
 return verifyNormalizedMSFPlayerIndex(normalized,{team:'BUF'});
}
const players=[row(18607,'Sample Signalcaller','BUF','QB',
 {gamesPlayed:2,passing:{passYards:500,passTD:4,passInt:2}}),
 row(18608,'Sample Tailback','BUF','RB',
 {gamesPlayed:2,rushing:{rushYards:140,rushTD:1},receiving:{receptions:4,recYards:20}})];
const roster=[{player_id:'s100',name:'Sample Signalcaller',team:'BUF',position:'QB'},
 {player_id:'s101',name:'Sample Tailback',team:'BUF',position:'RB'}];
const bridge=extra=>joinVerifiedPFOIdentity643({team:'BUF',week:10,
 rosterPlayers:roster,msfIndex:msfIndex(players),fixture:game,rules,
 sourceAsOfUtc:now,...extra});
test('authorized roster identities join uniquely with true MSF player IDs (not scoring from Sleeper)',()=>{
 const result=bridge();
 assert.equal(result.status,'candidate_forecasts_not_capture_eligible');
 assert.equal(result.candidates.length,2);
 assert.equal(result.candidates[0].forecast.playerId,'s100');
 assert.equal(result.candidates[0].forecast.msfPlayerId,'18607');
 assert.equal(result.candidates[0].forecast.points,16);
 assert.equal(result.candidates[0].forecast.fromSleeperActual,false);
 assert.equal(result.candidates[0].forecast.scoringSystem,'FFL');
 assert.equal(result.candidates[0].forecast.rulesVersion,FFL_RULES_VERSION);
 assert.equal(result.candidates[0].verifiedServerParity,false);
 assert.equal(result.candidates[0].eligibleForAccuracyCapture,false);
 assert.equal(result.captureAllowed,false);
 assert.equal(result.writeAuthorized,false);
});
test('no verified pregame fixture, past kickoff, mismatched team or wrong scoring rules blocks mapping',()=>{
 for(const extra of [
  {sourceAsOfUtc:'2026-11-08T18:25:00Z'},
  {fixture:{...game,status:'FINAL'}},
  {fixture:{...game,verified:false}},
  {fixture:{...game,gameId:null}},
  {fixture:{...game,week:11}},
  {team:'SEA'},
  {rules:{...rules,version:'generic_ppr'}},
  {msfIndex:{status:'blocked'}}
 ]){
  const report=bridge(extra);
  assert.notEqual(report.status,'candidate_forecasts_not_capture_eligible');
  assert.equal(report.writeAuthorized,false);
 }
});
test('ambiguous duplicate Sleeper or provider identities never generate multiple forecasts',()=>{
 const rr=[...roster,{player_id:'s199',name:'Sample Signalcaller',team:'BUF',position:'QB'},
  {...roster[1],player_id:'s101'}];
 const result=bridge({rosterPlayers:rr});
 assert.equal(result.candidates.length,2);
 assert.equal(result.withheld.length,2);
 assert.ok(result.withheld.some(x=>x.reason==='msf_identity_already_assigned_to_other_roster_player'));
 assert.ok(result.withheld.some(x=>x.reason==='invalid_duplicate_or_nonfixture_roster_identity'));
});
test('same name but another position or team is not proof of the same MSF player',()=>{
 const rr=[{player_id:'s102',name:'Sample Signalcaller',team:'BUF',position:'WR'},
  {player_id:'s200',name:'Sample Tailback',team:'MIA',position:'RB'}];
 const result=bridge({rosterPlayers:rr});
 assert.equal(result.candidates.length,0);
 assert.ok(result.withheld.some(x=>x.reason==='no_unique_same_team_position_msf_identity'));
});
test('an absent real MSF scoring category or no independent forecast remains unknown',()=>{
 const index=msfIndex([row(18608,'No Plays Yet','BUF','WR',{gamesPlayed:0})]);
 const result=bridge({rosterPlayers:[{player_id:'s201',name:'No Plays Yet',team:'BUF',position:'WR'}],
  msfIndex:index});
 assert.equal(result.candidates.length,0);
 assert.equal(result.captureAllowed,false);
 assert.ok(result.withheld.some(x=>x.reason==='existing_pfo_model_has_no_supported_forecast'));
});
