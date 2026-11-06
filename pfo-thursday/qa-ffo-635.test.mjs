import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {fflScore} from './ffo-gamecast-model.mjs';

const read=f=>readFileSync(new URL('./'+f,import.meta.url),'utf8');
const config=JSON.parse(read('FFO_FFL_SCORING_V1.json'));
const rules=config.scoring,ui=read('ffo-pfo-597.js'),html=read('index.html');
const start=ui.indexOf(' const FFL_SUPPORTED_STATS=');
const end=ui.indexOf(" if(typeof pfo49ScoreFromStats",start);
assert.ok(start>=0&&end>start,'Team HQ scorer can be tested independently');
const context=createContext({rules});
new Script('const frozenFFLRules=rules;\n'+ui.slice(start,end)+'\nthis.score=frozenScore;').runInContext(context);
const score=context.score;

test('Nov 5 complete Sleeper scoring video is the only authority for FFL scoring',()=>{
 assert.equal(config.version,'2026-11-05-ffl-screen-recording-verified-v4');
 const expected={
  pass_yd:0.04,pass_td:4,pass_int:-2,pass_cmp_40p:0,pass_td_40p:1,pass_td_50p:2,
  rush_yd:0.1,rush_td:6,rush_40p:0,rush_td_40p:1,rush_td_50p:2,
  rec:0.5,rec_yd:0.1,rec_td:6,rec_30_39:0,rec_40p:0,rec_td_40p:1,rec_td_50p:2,
  fgm:0,fgm_0_19:3,fgm_20_29:3,fgm_30_39:3,fgm_40_49:4,fgm_50_59:5,fgm_60p:6,
  fgmiss:-1,xpm:1,xpmiss:-1,
  def_2pt:0,def_3_and_out:0,def_4_and_stop:0,def_forced_punts:0,
  sack:1,blk_kick:2,safe:2,
  pts_allow_0:10,pts_allow_1_6:7,pts_allow_7_13:4,
  pts_allow_14_20:1,pts_allow_21_27:0,pts_allow_28_34:-1,pts_allow_35p:-4
 };
 for(const [key,value] of Object.entries(expected))
  assert.equal(rules[key],value,key+' must match authoritative video');
 assert.match(config.authority,/full Sleeper FFL Scoring Settings video/);
});
test('40+ non-TD rush, long completion, 30-39 reception and 40+ reception add zero BONUS points',()=>{
 assert.equal(score({rush_yd:42,rush_40p:1}).points,4.2);
 assert.equal(fflScore({rush_yd:42,rush_40p:1},rules,'RB').points,4.2);
 assert.equal(score({rec:1,rec_yd:40,rec_40p:1}).points,4.5);
 assert.equal(fflScore({rec:1,rec_yd:40,rec_40p:1},rules,'WR').points,4.5);
 assert.equal(score({pass_yd:45,pass_cmp_40p:1}).points,1.8);
});
test('40+ scoring touchdowns earn their verified single +1 bonus above the base TD',()=>{
 assert.equal(score({pass_td:1,pass_td_40p:1}).points,5);
 assert.equal(fflScore({pass_td:1,pass_td_40p:1},rules,'QB').points,5);
 assert.equal(score({rush_td:1,rush_td_40p:1}).points,7);
 assert.equal(fflScore({rush_td:1,rush_td_40p:1},rules,'RB').points,7);
 assert.equal(score({rec_td:1,rec_td_40p:1}).points,7);
 assert.equal(fflScore({rec_td:1,rec_td_40p:1},rules,'WR').points,7);
});
test('made FG is paid by verified distance ONLY, never by generic fgm plus distance',()=>{
 const buckets=[['fgm_0_19',3],['fgm_20_29',3],['fgm_30_39',3],
  ['fgm_40_49',4],['fgm_50_59',5],['fgm_60p',6]];
 for(const [key,points] of buckets){
  assert.equal(score({fgm:1,[key]:1}).points,points,key+' Team HQ');
  assert.equal(fflScore({fgm:1,[key]:1},rules,'K').points,points,key+' GameCast');
 }
 assert.equal(score({fgm:1,xpm:2}).points,2);
 assert.equal(fflScore({fgm:1,xpm:2},rules,'K').points,2);
 assert.equal(fflScore({fgm:1,xpm:2},rules,'K').complete,false);
 assert.ok(fflScore({fgm:1,xpm:2},rules,'K').missing.includes('unverified_field_goal_distance_counts'));
 assert.equal(fflScore({fgm:1,fgm_40_49:1,xpm:2},rules,'K').points,6);
 assert.equal(score({fgm_50_59:0.25,xpm:1}).points,2.25);
 assert.equal(fflScore({fgm:1,fgm_40_49:0.5,xpm:2},rules,'K').complete,false);
});
test('4th down stops, three-and-outs and defensive 2-point returns are not fantasy-point categories',()=>{
 assert.equal(score({def_3_and_out:5,def_4_and_stop:2,def_2pt:1,sack:1}).points,1);
 assert.equal(fflScore({def_3_and_out:5,def_4_and_stop:2,def_2pt:1,sack:1},rules,'DEF').points,1);
});
test('all UIs must load restored contract, not stale interim scoring rules',()=>{
 assert.match(ui,/FFO_FFL_SCORING_V1\.json\?v=635/);
 assert.match(ui,/2026-11-05-ffl-screen-recording-verified-v4/);
 assert.match(html,/ffo-pfo-597\.js\?v=635/);
 assert.doesNotMatch(ui,/FG made = \+3 base/);
 assert.equal(config.scoring.fgm,0);
});
