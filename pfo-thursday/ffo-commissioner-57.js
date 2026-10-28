/* FFO 5.7 private Commissioner Command enhancement.
 * Additive to existing Access+PIN, D1 case/audit, R2 evidence. No direct Sleeper writes.
 * New desk edits FFO administrative ledger immediately, NEVER claims Sleeper was edited.
 */
(()=>{'use strict';
 const el=id=>document.getElementById(id);
 const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const round=x=>Math.round((Number(x)+Number.EPSILON)*100)/100;
 const money=x=>Number.isFinite(Number(x))?round(x).toFixed(2):'—';
 const stamped=x=>Number.isFinite(Date.parse(x||''))?new Date(x).toLocaleString():'Date unavailable';
 const source=()=>typeof comUI==='object'&&comUI.unlocked;
 const access=()=>typeof comReq==='function';
 let ledger=[],loadedAt=null,error='',loading=false,lock=false;
 let focusCase=null;
 let loadNonce=0;
 function cases(){return source()?(comUI.cases||[]).filter(c=>c.league==='FFL'):[]}
 function users(){try{return gm47Snapshot?.users||[]}catch{return []}}
 function rosters(){try{return gm47Snapshot?.rosters||[]}catch{return []}}
 function manager(r){const u=users().find(x=>String(x.user_id)===String(r.owner_id));return u?.metadata?.team_name||u?.display_name||('FFL roster '+r.roster_id)}
 function rosterOptions(){return rosters().map(r=>'<option value="'+E(r.roster_id)+'">'+E(manager(r))+' (Roster '+E(r.roster_id)+')</option>').join('')}
 function caseOptions(){const list=cases();return list.map(c=>'<option value="'+E(c.id)+'">'+E(c.case_no)+' · '+E(c.team)+' · W'+E(c.week||'—')+' · '+E(c.status)+'</option>').join('')}
 function caseById(id){return cases().find(c=>Number(c.id)===Number(id))}
 function casesForRule(rule){
  const key=String(rule||'').trim().toLowerCase();return key?cases().filter(x=>String(x.rule_ref||'').toLowerCase()===key):[];
 }
 function activeList(){return ledger.filter(x=>!String(x.status||'').startsWith('VOIDED'))}
 function renderImpact(){
  const w=Number(el('com57-week')?.value||0),rid=Number(el('com57-roster')?.value||0),base=Number(el('com57-score')?.value),delta=Number(el('com57-delta')?.value);
  const preview=el('com57-preview');if(!preview)return;
  const valid=Number.isInteger(w)&&w>=1&&w<=18&&rid>=1&&el('com57-score')?.value!==''&&el('com57-delta')?.value!==''&&Number.isFinite(base)&&Number.isFinite(delta);
  const total=valid?round(base+delta):null;
  const collisions=activeList().filter(x=>Number(x.week)===w&&Number(x.roster_id)===rid&&Number(x.year)===Number(window.dbNflSeason||2026));
  const caseData=caseById(el('com57-case')?.value);
  const rule=caseData?.rule_ref||'';
  const parallel=casesForRule(rule);
  let msg=valid?'<b>'+E(money(base))+'</b> + <b>'+E((delta>=0?'+':'')+money(delta))+'</b> = <strong>'+E(money(total))+' FFL points</strong>':'Choose the roster and enter existing points plus the adjustment.';
  msg+='<small>Internal FFO adjustment preview · official Sleeper score is not changed by this screen.</small>';
  if(collisions.length)msg+='<small class="com57-warn">Active entry already exists for this roster/week. Void or reconcile it before filing another.</small>';
  if(parallel.length>1)msg+='<small>Precedent review: '+E(parallel.length-1)+' other filed case(s) using the same rule code. Review consistency before issuing.</small>';
  if(caseData&&caseData.status!=='ISSUED')msg+='<small>Case '+E(caseData.case_no)+' status: '+E(caseData.status)+'. Backend requires a case with an issued, non-reversed consequence.</small>';
  preview.innerHTML=msg;
 }
 function currentMatchupScore(week,roster){
  try{
   const m=gm47HistorySnapshot?.matchups_by_week?.[String(week)]||[];
   const found=m.find(x=>Number(x.roster_id)===Number(roster));
   return found&&Number.isFinite(Number(found.points))?Number(found.points):null;
  }catch{return null}
 }
 function fillScore(){
  const week=Number(el('com57-week')?.value),roster=Number(el('com57-roster')?.value),score=currentMatchupScore(week,roster);
  if(score!==null&&Number.isFinite(score)){
   el('com57-score').value=score.toFixed(2);
   el('com57-score-source').textContent='Existing Sleeper historical matchup snapshot · confirm it is final before filing.';
  }else{
   el('com57-score').value='';
   el('com57-score-source').textContent='No synced matchup total available for that roster/week. Enter the official Sleeper score manually and verify it.';
  }
  renderImpact();
 }
 function onCase(){
  const c=caseById(el('com57-case')?.value);if(!c)return;
  if(c.week)el('com57-week').value=c.week;
  const hit=rosters().find(x=>String(manager(x)).toLowerCase()===String(c.team||'').toLowerCase()||String(manager(x)).toLowerCase()===String(c.owner||'').toLowerCase());
  if(hit)el('com57-roster').value=hit.roster_id;
  if(c.consequence&&!el('com57-reason').value)el('com57-reason').value='Case '+c.case_no+': '+String(c.consequence).slice(0,220);
  fillScore();
 }
 function mount(){
  const host=el('com-workspace');if(!host||el('com57'))return;
  const shell=document.createElement('section');shell.id='com57';shell.className='com57-shell';
  shell.innerHTML=
  '<div class="com57-heading"><div><div class="eyebrow">FFO ADMINISTRATION · 5.7</div><h3>Commissioner Score Control</h3><p>Auditable decisions, immediate FFO ledger entry, and separate Sleeper reconciliation.</p></div><span class="com57-private">PRIVATE · PIN REQUIRED</span></div>'+
  '<div class="com57-tabs" role="tablist" aria-label="Commissioner tools"><button type="button" data-com57-tab="log" aria-selected="true">Commissioner Log</button><button type="button" data-com57-tab="scores" aria-selected="false">Score adjustments</button><button type="button" data-com57-tab="audit" aria-selected="false">Score audit</button><button type="button" data-com57-tab="toolbox" aria-selected="false">League toolbox</button></div>'+ '<div data-com57-panel="log" class="com57-panel"></div>'+
  '<div data-com57-panel="scores" class="com57-panel" hidden><div class="com57-alert">Sleeper official score changes are made only inside Sleeper Commissioner Control after the NFL week finishes. This panel records FFO decisions immediately and checks official scores later. No silent league changes.</div>'+
  '<form id="com57-form" class="com57-form">'+
  '<label>Issued disciplinary case<select id="com57-case" required><option value="">Choose filed FFL case</option></select></label>'+
  '<label>Fantasy week<input id="com57-week" type="number" min="1" max="18" required placeholder="Week"></label>'+
  '<label>FFL manager / roster<select id="com57-roster" required><option value="">Choose roster</option></select></label>'+
  '<label>Adjustment type<select id="com57-type"><option value="PENALTY">Point deduction</option><option value="AWARD">Point award</option><option value="CORRECTION">Administrative correction</option></select></label>'+
  '<label>Current recorded FFL points<input id="com57-score" type="number" step="0.01" min="-99999" max="99999" required placeholder="e.g. 137.84"></label>'+
  '<label>Points to adjust (+/-)<input id="com57-delta" type="number" step="0.01" min="-99999" max="99999" value="-50" required></label>'+
  '<p id="com57-score-source" class="com57-foot">Official score source awaiting selected roster/week.</p>'+
  '<label class="com57-full">Reason and justification<textarea id="com57-reason" required minlength="12" maxlength="1000" placeholder="Link the rule, warning, date and issued decision."></textarea></label>'+
  '<div id="com57-preview" class="com57-preview com57-full" aria-live="polite"></div>'+
  '<div class="com57-full com57-actions"><button type="submit" class="button primary">Record adjustment in FFO</button><button type="button" id="com57-refresh" class="button">Refresh ledger</button></div>'+
  '</form></div>'+
  '<div data-com57-panel="audit" class="com57-panel" hidden><div id="com57-pulse"></div><p class="com57-foot">Case decisions and evidence are maintained exclusively in Commissioner Log. Score adjustment history is append-only, including reversals.</p></div>'+
  '<div data-com57-panel="toolbox" class="com57-panel" hidden><h4>Commissioner toolbox · planned controls</h4><div class="com57-toolgrid">'+
  [['Score adjustment history','Active FFO ledger, rollback and Sleeper verification','active'],['Disciplinary precedent finder','Find prior cases sharing a rule code','active'],['Appeal and evidence timeline','Existing private cases, uploaded evidence and appeals','active'],['League roster force-edit','Read-only: perform any action in Sleeper','inactive'],['Schedule / playoff reseeding','Read-only: retain Sleeper as the system of record','inactive'],['Waiver / transaction override','Read-only: no automated transactions','inactive'],['Penalty impact simulator','Future: playoff and standings recalculation with source-complete matchup data','inactive'],['Manager notice generator','Future: draft notifications from case evidence, never auto-send','inactive']].map(([name,desc,status])=>'<div class="com57-tool"><b>'+E(name)+'</b><small>'+E(desc)+'</small><span>'+E(status==='active'?'Available via FFO':'Planned / no action')+'</span></div>').join('')+
  '</div></div>'+
  '<div class="com57-bottom"><div class="com57-rail"><h4>Point adjustment ledger</h4><div id="com57-status" aria-live="polite">Waiting for commissioner unlock…</div></div><div id="com57-ledger" class="com57-ledger"></div></div>';
  host.prepend(shell);
  // Move existing, working case-management DOM into Log ONLY; keep identity/Lock visible.
  const log=shell.querySelector('[data-com57-panel="log"]');
  for(const node of [...host.children])if(node!==shell&&!node.querySelector?.('#com-identity'))log.appendChild(node);
  // The score ledger belongs only to the score workspace, never underneath other tabs.
  shell.querySelector('[data-com57-panel="scores"]').appendChild(shell.querySelector('.com57-bottom'));
  shell.querySelectorAll('[data-com57-tab]').forEach(btn=>btn.addEventListener('click',()=>{
   shell.querySelectorAll('[data-com57-tab]').forEach(n=>n.setAttribute('aria-selected',String(n===btn)));
   shell.querySelectorAll('[data-com57-panel]').forEach(n=>{n.hidden=n.dataset.com57Panel!==btn.dataset.com57Tab});
  }));
  for(const id of ['com57-case','com57-week','com57-roster','com57-score','com57-delta','com57-type']){
   el(id)?.addEventListener('input',()=>id==='com57-case'?onCase():id==='com57-week'||id==='com57-roster'?fillScore():renderImpact());
  }
  el('com57-refresh').addEventListener('click',()=>refresh(true));
  el('com57-form').addEventListener('submit',save);
  shell.addEventListener('click',async ev=>{
   const b=ev.target.closest('[data-com57-verify],[data-com57-void],[data-com57-receipt]');if(!b)return;
   if(lock)return;
   const uid=b.dataset.com57Verify||b.dataset.com57Void||b.dataset.com57Receipt,a=ledger.find(x=>x.adjustment_id===uid);if(!a)return;
   if(b.hasAttribute('data-com57-receipt')){
    const content=['FFO OFFICIAL COMMISSIONER RULING RECEIPT','Case: '+a.case_no,'League: '+a.league,'Team: '+a.team,'Week '+a.week+' / '+a.year+' · Roster '+a.roster_id,'Adjustment: '+(Number(a.delta_points)>=0?'+':'')+money(a.delta_points)+' points','Previous recorded total: '+money(a.original_points),'FFO decision total: '+money(a.new_total),'Reason: '+a.reason,'Administrative status: '+a.status,'Filed: '+stamped(a.created_at),'Recorded by: '+a.created_by,'Note: This receipt is an FFO administrative record. Sleeper scoring is authoritative only when independently verified.'].join('\n');
    try{await navigator.clipboard.writeText(content);setMsg('Ruling receipt copied to your clipboard. It has NOT been sent to any manager.')}catch{setMsg('Clipboard permission denied; use the case Export summary for a copy.',true)}
    return;
   }
   if(b.hasAttribute('data-com57-void')){
    const why=prompt('Reason for reversing this FFO administrative adjustment (at least 8 characters):');
    if(why===null)return;
    if(why.trim().length<8){setMsg('Reason must be at least 8 characters.',true);return}
    if(!confirm('Void the FFO ledger adjustment? This does NOT reverse any Sleeper score edit.'))return;
    await action(a,'void',{reason:why.trim()});
   }else await action(a,'verify',{});
  });
  renderImpact();
 }
 function setMsg(text,bad=false){const e=el('com57-status');if(e){e.textContent=text;e.classList.toggle('com57-bad',bad)}}
 function renderLedger(){
  const host=el('com57-ledger');if(!host)return;
  const active=activeList(),net=active.reduce((sum,x)=>sum+Number(x.delta_points||0),0);
  const pulse='<div class="com57-kpis"><div><strong>'+E(ledger.length)+'</strong><small>Recorded events</small></div><div><strong>'+E(active.length)+'</strong><small>Current FFO adjustments</small></div><div><strong>'+E(money(net))+'</strong><small>Net active points</small></div><div><strong>'+E(ledger.filter(x=>x.status==='VERIFIED_IN_SLEEPER').length)+'</strong><small>Sleeper matches</small></div></div>';
  el('com57-pulse').innerHTML=pulse;
  host.innerHTML=pulse+(ledger.length?ledger.map(a=>{
   const voided=a.status==='VOIDED_IN_FFO',verified=a.status==='VERIFIED_IN_SLEEPER';
   const badge=voided?'VOIDED IN FFO':verified?'VERIFIED IN SLEEPER':'FFO ONLY · NOT OFFICIAL';
   const color=verified?'com57-good':voided?'com57-neutral':'com57-pending';
   return '<article class="com57-item"><div class="com57-itemtop"><b>'+E(a.case_no||'Case unknown')+' · '+E(a.team||'Manager unknown')+'</b><span class="'+color+'">'+E(badge)+'</span></div>'+
    '<div class="com57-scoreline">W'+E(a.week)+' · Roster '+E(a.roster_id)+' · '+E(money(a.original_points))+' <strong>'+E((Number(a.delta_points)>=0?'+':'')+money(a.delta_points))+'</strong> → <b>'+E(money(a.new_total))+'</b></div>'+
    '<p>'+E(a.reason||'No reason recorded')+'</p><small>'+E(stamped(a.created_at))+' · '+E(a.created_by||'Admin')+' · '+E(a.adjustment_type||'Adjustment')+'</small>'+
    '<div class="com57-rowactions"><button type="button" data-com57-receipt="'+E(a.adjustment_id)+'">Copy ruling receipt</button>'+(!voided?(!verified?'<button type="button" data-com57-verify="'+E(a.adjustment_id)+'">Verify Sleeper</button>':'')+'<button type="button" data-com57-void="'+E(a.adjustment_id)+'">Void in FFO</button>':'')+'</div></article>';
  }).join(''):'<p class="com57-foot">No FFO score adjustments recorded yet. File and issue a case first.</p>');
 }
 function hydrate(){
  if(!source()){setMsg('Unlock Commissioner Command with your PIN to open the private score ledger.');return}
  const select=el('com57-case'),old=focusCase||select?.value;
  select.innerHTML='<option value="">Choose filed FFL case</option>'+caseOptions();
  if(old&&cases().some(x=>String(x.id)===String(old)))select.value=String(old);
  const roster=el('com57-roster'),rOld=roster?.value;
  roster.innerHTML='<option value="">Choose roster</option>'+rosterOptions();
  if(rOld)roster.value=rOld;
  if(select.value)onCase();else renderImpact();
 }
 async function refresh(force=false){
  if(!source()||!access()||loading)return;
  if(!force&&loadedAt&&Date.now()-loadedAt<30000){hydrate();renderLedger();return}
  loading=true;setMsg('Checking the private FFO disciplinary ledger…');
  try{
   const r=await comReq('score-ledger');ledger=Array.isArray(r.adjustments)?r.adjustments:[];loadedAt=Date.now();error='';
   hydrate();renderLedger();setMsg('Private ledger synced · '+stamped(new Date().toISOString())+(r.truncated?' · event history truncated':''));
  }catch(err){error=String(err?.message||err);setMsg('Ledger unavailable: '+error,true)}
  finally{loading=false}
 }
 async function save(ev){
  ev.preventDefault();if(lock||!source())return;
  const c=caseById(el('com57-case').value),week=Number(el('com57-week').value),roster_id=Number(el('com57-roster').value),base=Number(el('com57-score').value),delta=Number(el('com57-delta').value);
  const reason=el('com57-reason').value.trim(),type=el('com57-type').value;
  if(!c||!roster_id||!Number.isInteger(week)||el('com57-score').value===''||el('com57-delta').value===''||!Number.isFinite(base)||!Number.isFinite(delta)||Math.abs(delta)<.005||reason.length<12){setMsg('Select a case, roster, week, and valid score/reason.',true);return}
  const newTotal=round(base+delta);
  if(!confirm('Record '+(delta>=0?'+':'')+money(delta)+' FFO points for Roster '+roster_id+', Week '+week+'? New FFO total '+money(newTotal)+'. This DOES NOT edit Sleeper.'))return;
  lock=true;setMsg('Recording signed commissioner decision in the private FFO ledger…');
  try{
   const payload={week,roster_id,original_points:base,delta_points:delta,adjustment_type:type,reason};
   await comReq('cases/'+c.id+'/score-adjustments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
   el('com57-reason').value='';focusCase=String(c.id);
   await refresh(true);setMsg('FFO decision recorded. Sleeper score has NOT changed. Apply it through Sleeper Commissioner Control after the week is complete.');
  }catch(err){setMsg('Adjustment not recorded: '+String(err?.message||err),true)}
  finally{lock=false}
 }
 async function action(a,op,payload){
  lock=true;setMsg(op==='void'?'Recording audit reversal…':'Comparing the commissioner override with Sleeper…');
  try{
   const x=await comReq('cases/'+a.case_id+'/score-adjustments/'+a.adjustment_id+'/'+op,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
   await refresh(true);
   setMsg(op==='void'?'FFO adjustment voided. Check Sleeper separately.':'Sleeper confirmed the recorded override: '+money(x.observed_override));
  }catch(err){setMsg((op==='void'?'Reversal':'Verification')+' failed: '+String(err?.message||err),true)}
  finally{lock=false}
 }
 function startup(){
  mount();
  document.querySelector('nav button[data-page="commissioner"]')?.addEventListener('click',()=>setTimeout(()=>{if(source())refresh();else setMsg('Unlock the private Commissioner Portal first.')},400));
  el('com-enter')?.addEventListener('click',()=>setTimeout(()=>{if(source())refresh(true)},1200));
  const ws=el('com-workspace');
  if(ws)new MutationObserver(()=>{if(!ws.hidden&&source())refresh();else if(ws.hidden)setMsg('Private Commissioner Portal locked.')}).observe(ws,{attributes:true,attributeFilter:['hidden']});
  document.addEventListener('click',ev=>{
   const b=ev.target.closest('[data-com-case]');if(b){focusCase=String(b.dataset.comCase);if(source())hydrate()}
  });
  if(source())refresh();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startup,{once:true});else startup();
 window.ffoCommissioner57={refresh:()=>refresh(true),getStatus:()=>({unlocked:source(),loadedAt,entries:ledger.length})};
})();
