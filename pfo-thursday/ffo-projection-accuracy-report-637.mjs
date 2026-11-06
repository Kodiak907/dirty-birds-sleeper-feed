/**
 * PFO 6.37 source-only accuracy readiness report.
 * Run: node pfo-thursday/ffo-projection-accuracy-report-637.mjs
 * READ-ONLY. No provider calls, score writes or retroactive forecasts.
 */
import {readFileSync} from 'node:fs';
import {auditLegacyForecastArchives,auditFFLProjectionAccuracy}
 from './ffo-projection-accuracy-audit-637.mjs';
const read=name=>JSON.parse(readFileSync(new URL('../'+name,import.meta.url),'utf8'));
const version=read('pfo-thursday/FFO_FFL_SCORING_V1.json').version;
const archive=auditLegacyForecastArchives({
 rulesVersion:version,
 archives:[
  read('data/forecast_archive/week_07_first.json'),
  read('data/forecast_archive/week_08_first.json')
 ],
 lockedArchives:[
  read('data/forecast_archive/week_07_locked_players.json'),
  read('data/forecast_archive/week_08_locked_players.json')
 ],
 calibration:read('data/PREGAME_CALIBRATION.json')
});
// The repo has no evidence-certified, same-version final MSF player score
// corpus paired to time-verified 6.36 pregame snapshots. Do not invent it.
const accuracy=auditFFLProjectionAccuracy({rulesVersion:version,
 forecasts:[],certificates:[],verifiedGames:[]});
const report={
 schema:'FFO_PFO_ACCURACY_READINESS_V1',build:'PFO_6_37',
 authoritativeScoringRules:version,source:'existing repository archives only',
 archivedPredictionEvidence:archive,
 restoredRuleCurrentModelAccuracy:accuracy,
 blockers:[
  'need_saved_pregame_PFO_636_forecasts_with_verified_kickoff',
  'need_complete_independently_certified_MSF_FFL_final_player_game_scores',
  'need_same_scoring_version_for_every_forecast_and_target',
  'need_verified_unique_player_game_identity_and_no_future_leakage',
  'need_statistically_useful_sample_by_position'
 ],
 benchmarkStatus:'NOT_MEASURABLE_YET',
 note:'The preexisting Week 7/8 scoring archives and older calibration results cannot validate PFO 6.36. Never claim zero errors or certified accuracy from missing comparison data.',
 readOnly:true,productionEligible:false
};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
