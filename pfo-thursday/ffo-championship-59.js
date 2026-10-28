/* FFO PFO 5.9 Championship Probability Desk — loads precomputed 100,000-trial report ONLY on Championship tab.
 * Does not alter Overview, historical Championship reports, existing 100k player-score simulator or Sleeper.
 */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const pct=x=>Number.isFinite(x)?(100*x).toFixed(1)+'%':'—';
 let report=null,loading=null,stamp=0;
 const CHAMP_REPORT='/FFO_CHAMPIONSHIP_100K.json';
 function mount(){
  const page=$('championship');if(!page)return null;
  let el=$('pfo59-champ-odds');
  if(el)return el;
  el=document.createElement('section');el.id='pfo59-champ-odds';el.className='card pfo59-champ-odds';
  el.innerHTML='<div class="pfo59-champ-header"><div><div class="eyebrow">FFO · CHAMPIONSHIP PROBABILITY DESK</div><h2>League Playoff & Title Odds</h2><p>100,000 full-season scenarios · independent FFO estimates · Sleeper matchups</p></div><button type="button" id="pfo59-champ-refresh" class="button">Refresh stored report</button></div><div id="pfo59-champ-result" aria-live="polite"><p class="muted">Open Championship to load the full-season probability analysis.</p></div>';
  page.prepend(el);
  el.querySelector('#pfo59-champ-refresh').addEventListener('click',()=>{void load(true)});
  return el;
 }
 function draw(d){
  const target=$('pfo59-champ-result');if(!target)return;
  if(!d||d.schema!=='FFO_CHAMPIONSHIP_100K_V1'||d.simulations!==100000||!Array.isArray(d.teams)||d.teams.length!==12){
   target.innerHTML='<p class="note">Validated 100,000-trial odds report not available. Historical Championship outlook remains below.</p>';return;
  }
  const ours=d.teams.find(t=>Number(t.roster_id)===1);
  if(!ours){target.innerHTML='<p class="note">Dirty Birds not present in saved simulation report.</p>';return;}
  const items=[['Make playoffs',ours.playoff_probability,'Top six qualify'],['First-round bye',ours.bye_probability,'Regular-season top two'],['Reach championship game',ours.final_probability,'Win a semifinal'],['Win championship',ours.championship_probability,'Win the final']];
  const metrics=items.map(([label,val,note])=>'<div class="pfo59-champ-metric"><small>'+esc(label)+'</small><strong>'+esc(pct(val))+'</strong><span>'+esc(note)+'</span><div class="pfo59-champ-bar"><i style="width:'+Math.min(100,Math.max(0,Number(val)*100))+'%"></i></div></div>').join('');
  const rows=[...d.teams].sort((a,b)=>b.championship_probability-a.championship_probability).map((t,i)=>
   '<tr class="'+(Number(t.roster_id)===1?'pfo59-champ-ours':'')+'"><td>'+esc(i+1)+'</td><td><b>'+esc(t.name||'Roster '+t.roster_id)+'</b><small>'+esc(t.record||'—')+'</small></td><td>'+esc(pct(t.playoff_probability))+'</td><td>'+esc(pct(t.bye_probability))+'</td><td>'+esc(pct(t.final_probability))+'</td><td><strong>'+esc(pct(t.championship_probability))+'</strong></td></tr>'
  ).join('');
  const at=Number.isFinite(Date.parse(d.roster_snapshot_as_of||''))?new Date(d.roster_snapshot_as_of).toLocaleString():'unknown';
  const last=Number.isFinite(Date.parse(d.generated_at_utc||''))?new Date(d.generated_at_utc).toLocaleString():'unknown';
  target.innerHTML='<div class="pfo59-champ-highlight"><div><b>Dirty Birds · '+esc(ours.record)+'</b><span>Current-source conditional odds, not guaranteed outcomes</span></div><span>100,000 trials</span></div>'+
   '<div class="pfo59-champ-metrics">'+metrics+'</div>'+
   '<details class="pfo59-champ-details"><summary>Compare all 12 FFL managers · playoff and title odds</summary><div class="pfo59-champ-tablewrap"><table class="pfo59-champ-table"><thead><tr><th>#</th><th>Team</th><th>Playoffs</th><th>Bye</th><th>Final</th><th>Title</th></tr></thead><tbody>'+rows+'</tbody></table></div></details>'+
   '<p class="pfo59-champ-source">Snapshot: '+esc(at)+' · Generated: '+esc(last)+' · '+esc(d.simulations.toLocaleString())+' simulated season/playoff paths · Seed '+esc(d.random_seed)+' · historical score variation ±'+esc(d.scoring_variability_sd)+' points.</p>'+
   '<details class="pfo59-champ-method"><summary>What these percentages actually measure</summary><p>'+esc(d.model||'Monte Carlo season and playoff model')+'</p><ul>'+(d.assumptions||[]).map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul><p><b>Important comparison:</b> these new 100,000 trials use historical team-scoring form. The archived earlier 10,000-trial forecast used a different, player-projection-based model. Their percentages are not directly comparable, and 100,000 draws do not solve prediction bias.</p><p>Prior report: '+esc(d.prior_10000?.as_of||'date not available')+' · '+esc(d.prior_10000?.simulations||'—')+' trials; retained below, never silently replaced.</p></details>';
 }
 async function load(force=false){
  const root=mount();if(!root)return;
  if(loading)return loading;
  if(report&&!force&&Date.now()-stamp<30*60*1000){draw(report);return;}
  const target=$('pfo59-champ-result');if(!report&&target)target.innerHTML='<p class="muted">Loading the saved 100,000-scenario FFO championship report…</p>';
  loading=(async()=>{try{
   const res=await fetch(CHAMP_REPORT+(force?'?v='+Date.now():''),{credentials:'same-origin',cache:'no-store'});
   if(!res.ok)throw Error('Report HTTP '+res.status);
   const d=await res.json();
   if(d.schema!=='FFO_CHAMPIONSHIP_100K_V1'||d.simulations!==100000||d.teams?.length!==12)throw Error('Report is incomplete or is not 100,000 trials.');
   for(const t of d.teams){for(const k of ['playoff_probability','bye_probability','final_probability','championship_probability'])if(!Number.isFinite(t[k])||t[k]<0||t[k]>1)throw Error('Invalid reported '+k);}
   report=d;stamp=Date.now();draw(report);
  }catch(err){if(report)draw(report);else if(target)target.innerHTML='<p class="note">100,000-trial report unavailable: '+esc(err.message||err)+'. The prior archived outlook remains below; no odds were invented.</p>';}
  finally{loading=null;}})();
  return loading;
 }
 function init(){
  mount();
  document.querySelector('nav button[data-page="championship"]')?.addEventListener('click',()=>{mount();void load()});
  if(document.querySelector('nav button[data-page="championship"].active'))void load();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
