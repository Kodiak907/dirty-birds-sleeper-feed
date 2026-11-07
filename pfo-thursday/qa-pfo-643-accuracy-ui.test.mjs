import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPrivatePFOAccuracy643} from './ffo-accuracy-ui-643.mjs';
const report={
 status:'research_metrics_only',measuredPlayerGames:2,
 metrics:{n:2,mae:2.75,rmse:3.12,bias:-1.5},
 byPosition:{QB:{n:2,mae:2.75,rmse:3.12,bias:-1.5}},
 byWeek:{10:{n:2,mae:2.75,rmse:3.12,bias:-1.5}},
 byPlayer:{'18607':{n:3,mae:2,rmse:3,bias:1}},
 sampleThresholdMet:false,exclusions:{missing_matching_pregame_forecast:4},
 correctionLedger:{migrationApplied:false,evidenceCompleteForRelease:false,
  latestSourceCorrectionFeedVerified:false}
};
test('unauthenticated caller cannot display private player metrics or raw errors',()=>{
 const h=renderPrivatePFOAccuracy643(report,{authenticated:false});
 assert.match(h,/Protected account access required/);
 assert.doesNotMatch(h,/18607|2\.75|missing matching pregame/);
});
test('empty verified sample honestly says Not measurable yet, no fake zero MAE/RMSE',()=>{
 const h=renderPrivatePFOAccuracy643({
  ...report,status:'no_verified_pregame_pairs',measuredPlayerGames:0,
  metrics:{n:0,mae:null,rmse:null,bias:null}
 },{authenticated:true});
 assert.match(h,/Not measurable yet/);
 assert.match(h,/0 valid player-games/);
 assert.match(h,/Unknown results do not count as zero/);
 assert.doesNotMatch(h,/0\.00/);
});
test('real matched research samples show MAE RMSE bias and correct caveats, no lineup recommendation',()=>{
 const h=renderPrivatePFOAccuracy643(report,{
  authenticated:true,sourceAsOfUtc:'2026-11-08T22:05:00Z'
 });
 assert.match(h,/Verified research comparisons/);
 assert.match(h,/2 valid player-games/);
 assert.match(h,/2\.75/);
 assert.match(h,/3\.12/);
 assert.match(h,/-1\.50/);
 assert.match(h,/Not enough verified data to claim calibration/);
 assert.match(h,/Official postgame stat-correction tracking is not yet fully verified/);
 assert.match(h,/2026-11-08T22:05:00\.000Z/);
 assert.match(h,/Sleeper scores do not establish scoring truth/);
});
test('misstated count cannot show a credible metric from inconsistent report',()=>{
 const h=renderPrivatePFOAccuracy643({...report,metrics:{...report.metrics,n:100}},
  {authenticated:true});
 assert.match(h,/Not measurable yet/);
 assert.doesNotMatch(h,/2\.75/);
});
test('source HTML and player IDs are escaped; no unsafe onclick or external links emitted',()=>{
 const h=renderPrivatePFOAccuracy643({
  ...report,byPlayer:{"<img src=x onerror=alert(1)>":{n:3,mae:1,rmse:1,bias:0}},
  exclusions:{"<script>alert(1)</script>":1}
 },{authenticated:true});
 assert.doesNotMatch(h,/<script>|<img/);
 assert.match(h,/&lt;script&gt;/);
 assert.match(h,/&lt;img/);
 assert.doesNotMatch(h,/href=|onclick=/);
});
test('if independent accuracy source is withheld, no scoreboard/player/private debug information renders',()=>{
 const h=renderPrivatePFOAccuracy643({...report,status:'blocked',
  byPlayer:{"secret-private-player":{n:4,mae:3}}},{authenticated:true});
 assert.match(h,/evidence is unavailable/);
 assert.doesNotMatch(h,/secret-private-player/);
 assert.doesNotMatch(h,/2\.75/);
});
