/**
 * PFO 6.38–6.42 current implementation/readiness checkpoint.
 * This reports verified code status without manufacturing live metrics.
 * Source: isolated repository branch; no production data or provider calls.
 */
import {readFileSync} from 'node:fs';
import {FFL_RULES_VERSION} from './ffo-pregame-capture-638.mjs';
import {produceResearchReadinessReport,auditProjectionSurfaces}
 from './ffo-projection-reliability-642.mjs';
import {auditLegacyForecastArchives,auditFFLProjectionAccuracy}
 from './ffo-projection-accuracy-audit-637.mjs';
import {readAccuracyDashboard} from './ffo-accuracy-dashboard-640.mjs';
import {evaluateFFLCalibration} from './ffo-projection-calibration-641.mjs';
const text=n=>readFileSync(new URL('./'+n,import.meta.url),'utf8');
const read=n=>JSON.parse(text(n));
const version=read('FFO_FFL_SCORING_V1.json').version;
const overview=produceResearchReadinessReport({rulesVersion:version,
 hasSeparateDB:false,modelAdapterVerified:false,liveCaptures:0,
 certifiedScores:0,independentMatches:0,mobileQA:false});
const legacy=auditLegacyForecastArchives({rulesVersion:version,
 archives:[read('../data/forecast_archive/week_07_first.json'),read('../data/forecast_archive/week_08_first.json')],
 lockedArchives:[read('../data/forecast_archive/week_07_locked_players.json'),read('../data/forecast_archive/week_08_locked_players.json')],
 calibration:read('../data/PREGAME_CALIBRATION.json')});
const measured=auditFFLProjectionAccuracy({rulesVersion:version});
const calibration=evaluateFFLCalibration({auditReport:measured});
const dashboard=await readAccuracyDashboard(null);
const surface=auditProjectionSurfaces({sourceVersion:version,
 staticHtml:text('index.html'),modules:{},sampleRows:[]});
const report={
 schema:'FFO_PFO_638_642_READINESS_CHECKPOINT_V1',
 branch:'pfo-638-642-accuracy-stack-20261106',
 rulesVersion:version,authoritativeRulesMatched:version===FFL_RULES_VERSION,
 phases:overview.phases,productionEligible:false,
 operationalState:{
  separateAccuracyD1Bound:false,
  runtimeVerifiedMSFScheduleAdapter:false,
  runtimeSameModelPFOForecastAdapter:false,
  automatedPregameCaptureActive:false,
  independentActualCertificatesStored:0,
  pregameFinalPairsAvailable:measured.measuredPlayerGames,
  accuracyDashboardLive:false,
  calibrationProductionApplied:false,
  realDeviceSafariTestCompleted:false
 },
 sourceOnlyResearch:{
  historicArchiveForecastRecords:legacy.legacyForecastRecords,
  historicCalibrationSamplesNotComparable:legacy.legacyCalibrationSamples,
  certifiedCurrentRulePairs:measured.measuredPlayerGames,
  accuracyMae:measured.metrics.mae,
  provisionalDashboardStatus:dashboard.status,
  calibrationStatus:calibration.status,
  staticSurfaceContractStatus:surface.status,
  staticSurfaceContractGaps:surface.failedChecks
 },
 releaseDecision:overview.status,
 protected:{
  productionPreviewUnmodified:true,
  commissionerD1NotUsedForAccuracy:true,
  publicDemoUnmodified:true,FFOINotIntegrated:true
 },
 nextConcreteDependencies:[
  'Provision independent Cloudflare D1 database pfo-accuracy-lab and apply 0001_accuracy_ledger.sql',
  'Build verified MSF game-fixture feed adapter and exact existing PFO 6.36 forecast parity adapter',
  'Activate pregame schedule only after both real adapters and database binding pass smoke tests',
  'Collect complete independently reconciled final MSF scoring certificates',
  'Gather enough verified forecast/actual pairs, measure accuracy, compare held-out candidate and perform mobile acceptance'
 ],
 readOnly:true,notes:'Feature implementations and tests are distinct from operational activation. No live data is inferred from synthetic QA.'
};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
