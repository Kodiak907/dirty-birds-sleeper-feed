/**
 * PFO 6.43 — private, read-only Accuracy Lab presentation.
 * Standalone UI formatter; neither authentication nor D1 access is provided
 * by this module. The protected server MUST authenticate before fetching
 * private records, and must never expose public JSON /records routes.
 */
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const number=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const pts=x=>number(x)===null?'—':x.toFixed(2);
const n=x=>Number.isInteger(x)&&x>=0?x:0;
const iso=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(x)&&
 Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
const sortedEntries=(value,limit=100)=>value&&typeof value==='object'&&!Array.isArray(value)?
 Object.entries(value).slice(0,limit):[];
const metricsHeader=(x,title)=>'<section class="pfo643-metric"><small>'+escape(title)+
 '</small><strong>'+escape(pts(x))+'</strong></section>';
function metricsTable(by,kind){
 const data=sortedEntries(by,kind==='Player'?150:30);
 if(!data.length)return '<p class="pfo643-caption">No verified '+escape(kind.toLowerCase())+
  ' comparisons available.</p>';
 return '<div class="pfo643-table-scroll"><table><thead><tr><th scope="col">'+
  escape(kind)+'</th><th scope="col">Valid pairs</th><th scope="col">MAE</th>'+
  '<th scope="col">RMSE</th><th scope="col">Bias</th></tr></thead><tbody>'+
  data.map(([label,row])=>'<tr><th scope="row">'+escape(label)+'</th><td>'+
   escape(n(row?.n))+'</td><td>'+escape(pts(row?.mae))+'</td><td>'+
   escape(pts(row?.rmse))+'</td><td>'+escape(pts(row?.bias))+'</td></tr>').join('')+
  '</tbody></table></div>';
}
export function renderPrivatePFOAccuracy643(report,{
 authenticated=false,sourceAsOfUtc=null,viewVersion='6.43'
}={}){
 if(authenticated!==true)return '<section class="pfo643-accuracy" aria-label="Accuracy Lab">'+
  '<h2>Accuracy Lab</h2><p>Protected account access required.</p></section>';
 if(!report||!['research_metrics_only','no_verified_pregame_pairs'].includes(report.status))
  return '<section class="pfo643-accuracy" aria-label="Accuracy Lab"><h2>Accuracy Lab</h2>'+
   '<p>Independent scoring evidence is unavailable or has not passed verification.</p>'+
   '<p class="pfo643-caption">No player records or provisional score claims are shown.</p></section>';
 const count=n(report.measuredPlayerGames),
  validMetrics=report.status==='research_metrics_only'&&count>0&&
  n(report.metrics?.n)===count,
  sampleReady=report.sampleThresholdMet===true,
  asOf=iso(sourceAsOfUtc),
  correction=report.correctionLedger||{};
 let h='<section class="pfo643-accuracy" aria-label="Accuracy Lab">'+
  '<header><h2>PFO Accuracy Lab <small>v'+escape(viewVersion)+'</small></h2>'+
  '<p>Independent pregame forecasts versus certified MSF/FFL final scores. Read-only.</p></header>';
 h+='<p class="pfo643-accuracy-status"><strong>'+
  (validMetrics?'Verified research comparisons':'Not measurable yet')+
  '</strong> · '+escape(count)+' valid player-games</p>';
 if(!validMetrics)h+='<p>Not enough verified data to calculate prediction error. '+ 
  'Unknown results do not count as zero.</p>';
 else h+='<p>'+(sampleReady?'Sample-size threshold reached; model calibration still requires independent heldout approval.':
  'Not enough verified data to claim calibration accuracy or forecast superiority.')+'</p>';
 h+='<div class="pfo643-metrics" aria-label="Error metrics">'+
  metricsHeader(validMetrics?report.metrics.mae:null,'Mean absolute error')+
  metricsHeader(validMetrics?report.metrics.rmse:null,'Root mean squared error')+
  metricsHeader(validMetrics?report.metrics.bias:null,'Bias · forecast minus actual')+
  '</div>';
 h+='<p class="pfo643-caption">Predictions must be stored before kickoff using the same frozen FFL rules and model displayed in PFO. These metrics are research-only, not lineup instructions.</p>';
 h+='<section><h3>By position</h3>'+metricsTable(validMetrics?report.byPosition:null,'Position')+'</section>';
 h+='<section><h3>By week</h3>'+metricsTable(validMetrics?report.byWeek:null,'Week')+'</section>';
 h+='<details><summary>Individual player comparisons</summary>'+
  '<p class="pfo643-caption">Only players with at least three verified comparable games appear here.</p>'+
  metricsTable(validMetrics?report.byPlayer:null,'Player')+'</details>';
 const exclusions=sortedEntries(report.exclusions,50);
 h+='<details><summary>Excluded or pending records</summary>'+
  (exclusions.length?'<ul>'+exclusions.map(([reason,count])=>
   '<li>'+escape(reason.replace(/_/g,' '))+' · '+escape(n(count))+'</li>').join('')+'</ul>':
   '<p>No exclusion breakdown is available from the independent ledger.</p>')+
  '</details>';
 const correctionsReady=correction.migrationApplied===true&&
  correction.evidenceCompleteForRelease===true&&
  correction.latestSourceCorrectionFeedVerified===true;
 if(!correctionsReady)h+='<p class="pfo643-caption">Official postgame stat-correction tracking is not yet fully verified. Accuracy figures remain research-only and may change.</p>';
 h+='<footer class="pfo643-caption">Source freshness: '+
  (asOf?escape(asOf)+' UTC':'not independently verified')+
  '. FFOI is not integrated. Sleeper scores do not establish scoring truth.</footer></section>';
 return h;
}
