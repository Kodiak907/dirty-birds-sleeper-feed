
const initial={
 snapshot:'Awaiting current Sleeper data',record:'Source pending',rosterCount:null,
 faabSpent:null,projection:null,
 playoff:{playoff_probability:null,bye_probability:null,final_probability:null,championship_probability:null},
 teams:[],lineup:[],injuries:[],trades:[],
 sources:[['Sleeper','Not yet loaded'],['FFO analysis','Not yet loaded']]
}
let data=JSON.parse(JSON.stringify(initial));const $=x=>document.getElementById(x),pc=x=>(100*(x||0)).toFixed(1)+'%',e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('pfo50-top')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
window.addEventListener('scroll',()=>{$('pfo50-top')?.classList.toggle('visible',window.scrollY>350)},{passive:true});
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.page).classList.add('active');window.scrollTo(0,0)});
let liveStandings=[],standingsStamp=null;
function renderLeagueStandings(){
 const el=$('league-standings');if(!el)return;
 if(!liveStandings.length){el.innerHTML='<div class="note">Live Sleeper standings pending. No projected rank is substituted.</div>';return;}
 el.innerHTML='<div class="standings-scroll"><table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W-L</th><th>PF</th></tr></thead><tbody>'+liveStandings.map((t,i)=>'<tr class="'+(t.roster_id===1?'standings-ours':'')+'"><td>'+e(i+1)+'</td><td>'+e(t.team)+'</td><td>'+e(t.w)+'–'+e(t.l)+'</td><td>'+e(t.pf.toFixed(2))+'</td></tr>').join('')+'</tbody></table></div><div class="tag-note">Based on Sleeper standings · Last source '+e(standingsStamp?new Date(standingsStamp).toLocaleString():'unknown')+' · Tiebreak order uses wins, then points for, then roster ID; official league playoff seeding may differ.</div>';
}
function updateLeagueStandings(snap){
 if(!Array.isArray(snap?.rosters)||!Array.isArray(snap?.users))return;
 const users=new Map(snap.users.map(u=>[String(u.user_id),u]));
 liveStandings=snap.rosters.map(r=>{const u=users.get(String(r.owner_id))||{},st=r.settings||{};let name=(u.metadata||{}).team_name||u.display_name||'Roster '+r.roster_id;
 return {roster_id:Number(r.roster_id),team:name,w:Number(st.wins)||0,l:Number(st.losses)||0,pf:(Number(st.fpts)||0)+(Number(st.fpts_decimal)||0)/100};}).sort((a,b)=>b.w-a.w||b.pf-a.pf||a.roster_id-b.roster_id);
 standingsStamp=snap.fetched_at_utc||null;if(document.querySelector('#overview.page.active'))renderLeagueStandings();
}
// League-specific Coach policy: Boyle (BigOlBoyle), Sleeper roster #3, is view-only.
// Keep his players in league roster/standings. Never construct, display or copy a trade with him.
const TRADE_VIEW_ONLY_ROSTER_ID=3;
function isTradeExcludedOpponent(rid,name=''){
 return String(rid??'')===String(TRADE_VIEW_ONLY_ROSTER_ID) || /boyle/i.test(String(name||''));
}
let waiverResearch=[], tradeStatus="Awaiting GM screening", tradeRejected=[], tradeReportStamp=null;
// Extra PUBLIC read-only research feeds. All source dates are displayed and no trade is auto-approved.
let broaderTradeIdeas=[],tradeProfiles=new Map(),tradeIdeasStamp=null,tradeExplorationStatus='Awaiting research';
let marketPricedLeads=[],marketValueAsOf=null,marketValueBaseline='12-team full PPR (not FFL half PPR)';
let tradeBlockReport=null,tradeBlockLoadError='Trade-block feed not published';

// Snapshot from official dated club reporting (reviewed Oct 25, 2026).
// Never pretend this static source is continuously refreshed.
const CURATED_WAIVER_CONTEXT=[{"player":"Ja'Kobi Lane","team":"BAL","event_type":"RETURN_FROM_IR_AND_COMPETING_WR_INJURY","event_player":"Ja'Kobi Lane / Rashod Bateman","event_at":"2026-10-23","event":"Baltimore activated Lane from injured reserve on October 17 after his wrist injury. Rashod Bateman had a shoulder problem and exited Week 6, but was a full practice participant Thursday/Friday and carried no final Week 7 game designation.","impact":"Lane has a path to more routes and contested targets, but Bateman has NOT been ruled out and targets are not guaranteed. Check Baltimore's quarterback situation.","primary_source":{"publisher":"Baltimore Ravens","url":"https://www.baltimoreravens.com/news/jakobi-lane-ravens-activated-from-injured-reserve-carl-jones-2026","published":"2026-10-17"},"analysis":[{"publisher":"Ravens injury report","url":"https://www.baltimoreravens.com/team/injury-report/index-app","published":"2026-10-23","takeaway":"Bateman shoulder: limited Wednesday; full Thursday and Friday; no final game designation."},{"publisher":"Baltimore Ravens","url":"https://www.baltimoreravens.com/news/jesse-minter-lamar-jackson-ankle-still-day-day-monday-week-7-injuries-rashod-bateman-cam-jurgens-trey-hendrickson-tyler-loop-critical-misses","published":"2026-10-19","takeaway":"Team acknowledged Bateman's Week 6 early exit."},{"publisher":"NBC Sports","url":"https://www.nbcsports.com/nfl/baltimore-ravens/player-news","published":"2026-10-23","takeaway":"Analyst notes Lane taking some opportunities in Baltimore's receiving group."}],"followups":["Confirm next game's quarterback","Check Lane routes/targets versus Bateman","Watch Bateman shoulder news"],"confidence":"official_activation_verified_role_projection_unconfirmed"},{"player":"DeMario Douglas","team":"NE","event_type":"TEAMMATE_RECEIVER_IR_AND_SLOT_ROLE","event_player":"Romeo Doubs / Mack Hollins","event_at":"2026-10-22","event":"New England placed Romeo Doubs on IR October 19 and Mack Hollins on IR October 10. Its October 22 game analysis identified Douglas as the available slot receiver.","impact":"More receiver snaps may be available, but returning A.J. Brown and other Patriots targets limit guaranteed volume. We cannot verify an IR activation for Douglas himself.","primary_source":{"publisher":"New England Patriots","url":"https://www.patriots.com/news/patriots-place-wr-romeo-doubs-on-injured-reserve-sign-db-elliott-davison-to-the-53-man-roster-from-the-practice-squad-announce-additional-practice-squad-moves","published":"2026-10-19"},"analysis":[{"publisher":"Patriots.com","url":"https://www.patriots.com/news/inactives-analysis-patriots-place-lg-alijah-vera-tucker-on-ir-rt-morgan-moses-officially-active-for-thursday-night-s-game-vs-the-bears","published":"2026-10-22","takeaway":"Douglas projected in the slot with A.J. Brown and Efton Chism III in the WR group."},{"publisher":"Patriots team transactions","url":"https://www.patriots.com/team/transactions/2026","published":"2026-10-22","takeaway":"Doubs/Hollins placed on IR; A.J. Brown activated from NFL IR October 17."}],"followups":["Review Thursday snap/target splits","Check slot route share","Do not label Douglas returning from IR without official proof"],"confidence":"teammate_ir_verified_own_return_unconfirmed"},{"player":"Rashod Bateman","team":"BAL","event_type":"OWN_INJURY_WITH_COMPETITION","event_player":"Rashod Bateman / Ja'Kobi Lane","event_at":"2026-10-23","event":"Bateman suffered a shoulder issue, exited Week 6 early and was limited Wednesday. The official injury report lists full practice Thursday/Friday and no Week 7 game designation.","impact":"Monitor any workload reduction, but an injury is NOT the same as ruled out. Lane's return increases competition for targets.","primary_source":{"publisher":"Baltimore Ravens","url":"https://www.baltimoreravens.com/team/injury-report/index-app","published":"2026-10-23"},"analysis":[{"publisher":"Baltimore Ravens","url":"https://www.baltimoreravens.com/news/jesse-minter-lamar-jackson-ankle-still-day-day-monday-week-7-injuries-rashod-bateman-cam-jurgens-trey-hendrickson-tyler-loop-critical-misses","published":"2026-10-19","takeaway":"Head coach discussed shoulder concern and early Week 6 exit."},{"publisher":"NBC Sports","url":"https://www.nbcsports.com/nfl/baltimore-ravens/player-news","published":"2026-10-23","takeaway":"Full practices, target competition from Lane."}],"followups":["Check next official injury designation","Track routes after early exit","Compare Lane targets"],"confidence":"own_injury_verified_out_unverified"}];
const CURATED_ACTIONS=[
 {name:'Christian Kirk',team:'SF',date:'2026-10-24',action_code:'ACTIVATED_FROM_IR',description:'49ers activated Kirk from NFL IR, removed questionable designation.',source_url:'https://www.49ers.com/news/49ers-announce-roster-moves-ahead-of-sfvsatl',source:'49ers'},
 {name:'Jonah Coleman',team:'DEN',date:'2026-10-24',action_code:'ACTIVATED_FROM_IR',description:'Broncos activated Coleman from NFL IR; his final Friday game designation was Questionable.',source_url:'https://www.denverbroncos.com/news/broncos-activate-rb-jonah-coleman-and-olb-jonathon-cooper-place-rb-tyler-badie-and-olb-jonah-elliss-on-ir',source:'Broncos'},
 {name:"Ja'Kobi Lane",team:'BAL',date:'2026-10-17',action_code:'ACTIVATED_FROM_IR',description:'Baltimore activated Lane from NFL IR after wrist injury.',source_url:'https://www.baltimoreravens.com/news/jakobi-lane-ravens-activated-from-injured-reserve-carl-jones-2026',source:'Ravens'}
];
let autoScout=null,autoScoutByName=new Map(),autoScoutError=null;
let waiverCatalysts=new Map(CURATED_WAIVER_CONTEXT.map(x=>[normPlayer(x.player),x])),catalystsStamp='2026-10-25T18:30:00Z';
let rosterActions=CURATED_ACTIONS.slice(),actionsStamp='2026-10-25T18:30:00Z',actionLoadError=null;
async function refreshRosterActions(){
 try{const d=await fetchReport('NFL_ROSTER_ACTIONS.json');if(Array.isArray(d.records)){
  const map=new Map([...CURATED_ACTIONS,...d.records].map(x=>[normPlayer(x.name),x]));rosterActions=Array.from(map.values());actionsStamp=d.reviewed_at_utc||actionsStamp;actionLoadError=null;
 }}catch(err){actionLoadError='Using Oct 25 dated source snapshot; GitHub action feed unavailable';}
 updateInjuryView();renderBriefing();
}

async function refreshSupplementaryResearch(){
 const names=['TRADE_IDEAS.json','trade_market.json','WAIVER_CATALYSTS.json','MARKET_OFFER_GUIDE.json','AUTOMATED_WAIVER_SCOUTING.json','TRADE_QUALITY_43.json','TRADE_BLOCK_SCOUTING.json'];
 const all=await Promise.allSettled(names.map(fetchReport));
 all.forEach((r,i)=>{if(r.status!=='fulfilled'){if(i===6)tradeBlockLoadError='Trade-block GitHub research is not yet available';return;}const d=r.value;
  if(i===0 && Array.isArray(d.suggestions)){broaderTradeIdeas=d.suggestions;tradeIdeasStamp=d.generated_at_utc;tradeExplorationStatus='Loaded';}
  if(i===1 && Array.isArray(d.profiles))tradeProfiles=new Map(d.profiles.map(p=>[Number(p.id),p]));
  if(i===2 && Array.isArray(d.catalysts)){waiverCatalysts=new Map([...CURATED_WAIVER_CONTEXT,...d.catalysts].map(x=>[normPlayer(x.player),x]));catalystsStamp=d.last_curated_at_utc||catalystsStamp;}
  if(i===3 && Array.isArray(d.qualified_top_five)){marketPricedLeads=d.qualified_top_five;marketValueAsOf=d.source_as_of||d.generated_at_utc;marketValueBaseline=d.market_baseline||marketValueBaseline;}
  if(i===4 && Array.isArray(d.candidates)){autoScout=d;autoScoutByName=new Map(d.candidates.map(x=>[normPlayer(x.name),x]));autoScoutError=null;}
  if(i===5 && Array.isArray(d.qualified)){tradeQuality43=d;}
  if(i===6 && Array.isArray(d.reports)){tradeBlockReport=d;tradeBlockLoadError=null;}
 });
 renderTradeScouting();renderWaiverScouting();renderBriefing();gm47Render();
}

let waiverUsage=new Map(),waiverUsageStamp=null,waiverUsageError=null,leagueOwnedIds=null,ownershipStamp=null;
let leagueOwnedNames=new Set(),ownershipCheckedMs=0,ownershipSource='awaiting Sleeper';
function updateLeagueOwnership(rosters,checkedAt,source='Sleeper snapshot',names=null){
 if(!Array.isArray(rosters)||!rosters.length)return false;
 const at=Date.parse(checkedAt||'');if(!Number.isFinite(at)||at<ownershipCheckedMs)return false;
 const ids=new Set(rosters.flatMap(r=>(r.players||[]).map(String)));
 const people=new Set();for(const id of ids){const obj=names?.[id];if(obj?.name)people.add(normPlayer(obj.name));}
 leagueOwnedIds=ids;leagueOwnedNames=people;ownershipStamp=checkedAt;ownershipCheckedMs=at;ownershipSource=source;
 if(document.querySelector('#market.page.active [data-pfo59-market-panel="waiver"]:not([hidden])'))renderWaiverScouting();return true;
}
function waiverIsRostered(player,id){
 if(!leagueOwnedIds)return false;
 if(id!=null&&String(id)!==''&&leagueOwnedIds.has(String(id)))return true;
 return leagueOwnedNames.has(normPlayer(player));
}

let cachedPlayerNames=null, catalogPending=null;
let modelLineupMeta={week:null,published:null,source:"Embedded backup; not live"};

function renderBriefing(){
 const host=$('briefing');if(!host)return;
 const roster=liveRosterSnapshot;
 const ids=new Map((roster?.players||[]).map(p=>[String(p.player_id),p]));
 const actual=new Set((roster?.starters||[]).map(pid=>normPlayer(ids.get(String(pid))?.name)).filter(Boolean));
 const recommended=(data.lineup||[]).map(p=>p[1]).filter(Boolean);
 const alternatives=roster?recommended.filter(n=>!actual.has(normPlayer(n)) && !/vikings|d\/st/i.test(n)):[];
 const activeActions=rosterActions.filter(x=>(roster?.players||[]).some(p=>normPlayer(p.name)===normPlayer(x.name)) && /ACTIVATED_FROM_IR/.test(x.action_code));
 const noOffers=!(data.trades||[]).length;
 const waiverCount=waiverResearch.filter(x=>!waiverIsRostered(x.player,x.source_player_id||x.player_id)).length;const autoCount=(autoScout?.candidates||[]).filter(x=>!waiverIsRostered(x.name,x.player_id||x.source_player_id||x.id)).length;
 const validProjection=Number.isFinite(Number(data.projection)) && Number(data.projection)>0;
 let h='<div class="brief-top"><b>Dirty Birds '+e(data.record)+'</b><span class="research-pill">Research brief · '+e(new Date().toLocaleTimeString())+'</span></div>';
 h+='<div class="brief-digest"><div class="brief-stat"><b>'+e(roster?.players?.length??data.rosterCount)+'</b><span>Live roster players</span></div><div class="brief-stat"><b>'+(validProjection?e(Number(data.projection).toFixed(1)):'—')+'</b><span>Projected points · week '+e(modelLineupMeta.week||'unconfirmed')+'</span></div></div>';
 if(alternatives.length)h+='<div class="brief-row"><b><span class="brief-dot"></span>Lineup divergence</b><small>Model includes '+e(alternatives.slice(0,4).join(', '))+' outside submitted starters. Research only; do not assume these are higher-confidence calls.</small></div>';
 else if(roster)h+='<div class="brief-row"><b><span class="brief-dot"></span>Actual lineup synced</b><small>No obvious named starter differences in the current model; verify slots and projections.</small></div>';
 else h+='<div class="brief-row"><b><span class="brief-dot"></span>Waiting for submitted Sleeper roster</b><small>Cannot compare projected and actual starters until roster loads.</small></div>';
 if(activeActions.length)h+='<div class="brief-row"><b><span class="brief-dot"></span>Official NFL roster updates</b><small>'+activeActions.map(a=>e(a.name)+' activated '+e(a.date)).join(' · ')+'. NFL activation is not proof of game-day active status.</small></div>';
 h+='<div class="brief-row"><b><span class="brief-dot"></span>Trade block — Coach priorities</b><small>Garrett Wilson · A.J. Brown · Patrick Mahomes. '+(tradeBlockReport?'Targeted research: '+e(tradeBlockReport.tested||0)+' package configurations checked. ':'Focused scanner connecting. ')+'No offers submitted; use the Trade Laboratory for vetted discussions.</small></div>';
 h+='<div class="brief-row"><b><span class="brief-dot"></span>Trade desk</b><small>'+(tradeQuality43?e(tradeQuality43.candidates_evaluated||0)+' package configurations scanned; '+e(tradeQuality43.qualified?.length||0)+' passed the stronger two-sided market/lineup screen. '+((tradeQuality43.qualified?.length||0)===0?'We are refusing bad-value offers, not recommending them.':'Investigate qualified candidates before any offer.'):(noOffers?'No trade has cleared our quality gate. ':' '+e(data.trades.length)+' ideas cleared for Coach review. ')+e(broaderTradeIdeas.length)+' exploratory packages; proposed gains do not equal market fairness.')+'</small></div>';
 h+='<div class="brief-row"><b><span class="brief-dot"></span>Waiver opportunity desk</b><small>'+e(waiverCount)+' model candidates, '+e(autoCount)+' automatically scouted with dated coverage and depth-chart checks; '+e([...waiverCatalysts.keys()].filter(k=>waiverResearch.some(w=>normPlayer(w.player)===k)).length)+' manually verified context. Coach approves claims.</small></div>';
 if(autoScout?.candidates?.length){
  const alerts=autoScout.candidates.map(p=>({p,n:(p.signals||[]).length,news:(p.news||[]).length}))
    .filter(x=>x.n&&x.news).sort((a,b)=>b.n-a.n||b.news-a.news).slice(0,3);
  if(alerts.length)h+='<div class="brief-row"><b><span class="brief-dot"></span>Research alerts to investigate</b><small>'+alerts.map(x=>e(x.p.name)+' ('+e(x.n)+' usage/depth alerts, '+e(x.news)+' dated news hits)').join(' · ')+'. These are automated research priorities, NOT injury certifications or pickup authorizations. Open Waiver Scouting for sources.</small></div>';
 }


 const needsReview=(roster?.players||[]).filter(p=>/^(Out|Questionable|Doubtful|IR|PUP)$/i.test(String(p.sleeper_injury_status||''))).slice(0,5);
 if(needsReview.length)h+='<div class="brief-row"><b><span class="brief-dot"></span>Availability to review</b><small>'+e(needsReview.map(p=>p.name+' ('+p.sleeper_injury_status+')').join(' · '))+'. Sleeper tags are not official game-day inactive decisions. Review Injury Watch and the verified inactives panel.</small></div>';
 const projAge=modelLineupMeta.published?Math.max(0,Date.now()-Date.parse(modelLineupMeta.published)):null;
 const researchAge=tradeIdeasStamp?Math.max(0,Date.now()-Date.parse(tradeIdeasStamp)):null;
 if((projAge!=null&&projAge>90*60000)||(researchAge!=null&&researchAge>120*60000))h+='<div class="brief-row"><b><span class="brief-dot"></span>Research freshness</b><small>'+e('Lineup model: '+(projAge==null?'unavailable':ageText(projAge))+' old · Trade research: '+(researchAge==null?'unavailable':ageText(researchAge))+' old. A successful connectivity check does not regenerate projections.')+'</small></div>';

 h+='<div class="brief-links"><a href="#roster" data-to="roster">Roster comparison ↗</a><a href="#availability" data-to="availability">Injury Watch ↗</a><a href="#market" data-to="market">Trade / Waiver ↗</a></div>';
 host.innerHTML=h;
 host.querySelectorAll('[data-to]').forEach(a=>a.onclick=ev=>{ev.preventDefault();const nav=document.querySelector('nav button[data-page="'+a.dataset.to+'"]');if(nav)nav.click();});
}

function pfo50RenderHomeKPIs(){
 const cells=[['NFL week',window.dbNflWeek||'—'],['Submitted starters',liveRosterSnapshot?.starters?.length??'—'],['Health flags',(liveRosterSnapshot?.players||[]).filter(x=>/^(out|questionable|doubtful|IR|PUP)$/i.test(String(x.sleeper_injury_status||''))).length],['Opportunity leads',pfo50Independent?String(pfo49RadarPool().length):'—']];
 $('kpis').innerHTML=cells.map(([a,b])=>`<div class="card"><div class="label">${e(a)}</div><div class="value">${e(b)}</div><div class="label">Read-only source</div></div>`).join('');
}
function pfo50RenderProjectedLineup(){
 const host=$('lineup');if(!host)return;
 const week=Number(window.dbNflWeek||8);
 host.innerHTML=(data.lineup||[]).map(x=>{const id=pfo49Players.find(p=>normPlayer(p.name)===normPlayer(x[1]))?.id||(liveRosterSnapshot?.players||[]).find(p=>normPlayer(p.name)===normPlayer(x[1]))?.player_id;
  const p=id?pfo49Info(id):null,match=p?pfo49ScheduleWeek(p,week):null,model=id&&typeof pfo52Points==='function'?pfo52Points(id,week):null,score=model?.points??null;
  return '<tr><td>'+e(x[0])+'</td><td>'+(id?pfo49Link(id):e(x[1]))+'</td><td>'+e(model?.bye?'BYE':model?.opponent||match?.opponent||'Schedule pending')+'</td><td>'+(model?.bye?'BYE':score==null?'PENDING':pfo49Num(score,1)+'*')+'</td></tr>';
 }).join('');
 if($('projection-status'))$('projection-status').innerHTML='* FFO independent recent-form model under FFL scoring. No opponent or injury adjustment; incomplete stat categories can affect bonuses. Submitted lineup remains separate.';
}
function render(light=!document.querySelector('nav button[data-page="market"].active,nav button[data-page="radar"].active,nav button[data-page="scouting"].active')){let p=data.playoff;pfo50RenderHomeKPIs();let max=Math.max(...data.teams.map(x=>x[2]),.01);$('contenders').innerHTML=data.teams.map(x=>`<div class="barrow"><span>${e(x[0])} <small class="muted">${e(x[1])}</small></span><b>${pc(x[2])}</b></div><div class="bar"><span style="width:${x[2]/max*100}%"></span></div>`).join('');renderBriefing();renderLeagueStandings();pfo50RenderProjectedLineup();renderRosterComparison();$('chances').innerHTML=[['Playoffs',p.playoff_probability],['Bye',p.bye_probability],['Final',p.final_probability],['Championship',p.championship_probability]].map(x=>`<div class="barrow"><span>${e(x[0])}</span><b>${pc(x[1])}</b></div><div class="bar"><span style="width:${x[1]*100}%"></span></div>`).join('');if(!injurySnapshot) $('injuries').innerHTML='<tr><td colspan="3">Waiting for current source…</td></tr>';else updateInjuryView();if(!light){renderTradeScouting();renderWaiverScouting();gm47Render();}$('sources').innerHTML=data.sources.map(x=>`<div class="source"><b>${e(x[0])}</b><span>${e(x[1])}</span></div>`).join('')}
$('reset').onclick=()=>{data=JSON.parse(JSON.stringify(initial));render();$('importstatus').textContent='Restored embedded snapshot (not verified live).'};$('file').onchange=async ev=>{let ok=0,problems=[];for(let f of ev.target.files){try{let x=JSON.parse(await f.text()),n=f.name.toUpperCase();if(n.includes('FULL_SEASON_PLAYOFF_SIMULATION')&&Array.isArray(x.teams)){let d=x.teams.find(y=>y.roster_id===1);if(d){data.playoff=d;data.teams=x.teams.map(y=>[y.name,y.record,y.championship_probability]);data.sources[1][1]=x.generated_at_utc||'Imported';ok++}}else if(n.includes('AVAILABILITY_INTELLIGENCE')&&x.dirty_birds_watch){data.injuries=x.dirty_birds_watch.map(t=>[t.name,t.sleeper_injury_status||'No tag',t.injury_report?.week?'Week '+t.injury_report.week+' '+(t.injury_report.practice_status||''):'No matched report; not clearance']);ok++}else if(n.includes('GAMEDAY_DECISION')){data.sources[2][1]=(x.third_party_inactive_source_status||'Unknown')+' • '+(x.generated_at_utc||'imported');ok++}else if(n.includes('MARKET_OFFER_GUIDE')){data.trades=(x.qualified_top_five||[]).map(t=>[(t.give||[]).map(y=>y.name).join(' + '),(t.receive||[]).map(y=>y.name).join(' + '),'+'+t.dirty_birds_delta_ppg+' PPG']);ok++}else if(n.includes('WEEKLY_LINEUPS')&&x.weeks){let w=x.weeks['7'];if(w?.starters){data.lineup=w.starters.map(t=>[t.position,t.name,t.opponent,t.ppg]);data.projection=w.ppg;ok++}}else if(n==='LATEST.JSON'){let r=x.rosters?.find(t=>t.roster_id===1);if(r){data.record=r.settings.wins+'–'+r.settings.losses;data.rosterCount=r.players.length;data.faabSpent=r.settings.waiver_budget_used;data.snapshot='FFL Week '+x.nfl_state?.week+' • imported';data.sources[0][1]=x.fetched_at_utc||'Imported';ok++}}else problems.push(f.name+': incompatible or unknown format')}catch(err){problems.push(f.name+': invalid JSON')}}render();$('importstatus').textContent='Imported '+ok+' reports. '+problems.join('; ');ev.target.value=''}; // Initial render deferred until state is initialized


// FAAB ledger: direct Sleeper read-only API. Never displays a guessed remaining balance.
const SLEEPER='https://api.sleeper.app/v1';
function fmtFaab(x){return typeof x==='number' && Number.isFinite(x)?'$'+x.toFixed(0):'—'}
async function sleeperGet(path){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(SLEEPER+path,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('Sleeper HTTP '+r.status);return await r.json()}finally{clearTimeout(timer)}}
async function ensureNameCatalog(){
 if(cachedPlayerNames)return cachedPlayerNames;
 if(catalogPending)return catalogPending;
 catalogPending=fetchReport('player_names.json').then(x=>{if(!x||typeof x!=='object')throw Error('Name catalog unavailable');cachedPlayerNames=x;return x}).finally(()=>{catalogPending=null});
 return catalogPending;
}
function transactionName(pid,catalog){
 const key=String(pid);
 const stored=catalog?.[key];const current=(liveRosterSnapshot?.players||[]).find(p=>String(p.player_id)===key);
 return stored?.name||current?.name||(key.length?'Player ID '+key:'Unknown player');
}
function rosterNameById(rid,rosters,users){
 const roster=rosters.find(r=>Number(r.roster_id)===Number(rid));
 const owner=users.find(u=>String(u.user_id)===String(roster?.owner_id));
 return owner?.display_name||owner?.username||('Roster '+rid);
}
async function refreshFaab(){
 const panel=$('faabpanel');if(!panel)return;const ledgerWasOpen=Boolean(panel.querySelector('.txn-fold')?.open);
 const id=window.dbLeagueId||LEAGUE_ID_OVERRIDE;
 if(!id){panel.innerHTML='<div class="note">League ID has not loaded. Waiting for the Sleeper source.</div>';return}
 try{
  const [league,rosters,users,namesResult]=await Promise.all([
   sleeperGet('/league/'+id),sleeperGet('/league/'+id+'/rosters'),sleeperGet('/league/'+id+'/users'),
   ensureNameCatalog().catch(()=>null)
  ]);
  if(!Array.isArray(rosters)||!league)throw Error('Incomplete league or roster response');
  updateLeagueOwnership(rosters,new Date().toISOString(),'Direct Sleeper league rosters',namesResult);
  const rosterId=Number(window.dbRosterId||1);
  const mine=rosters.find(r=>Number(r.roster_id)===rosterId);if(!mine)throw Error('Dirty Birds roster not found');
  const budget=Number(league.settings?.waiver_budget),used=Number(mine.settings?.waiver_budget_used);
  const valid=Number.isFinite(budget)&&Number.isFinite(used)&&budget>=0;
  const week=Math.max(1,Math.min(18,Number(league.settings?.leg||window.dbNflWeek||7)));
  const weekNums=Array.from({length:week},(_,i)=>i+1);
  const sets=await Promise.allSettled(weekNums.map(w=>sleeperGet('/league/'+id+'/transactions/'+w)));
  const failedWeeks=[],all=[];
  sets.forEach((r,i)=>{if(r.status==='fulfilled'&&Array.isArray(r.value))all.push(...r.value.map(t=>({...t,_week:weekNums[i]})));else failedWeeks.push(weekNums[i]);});
  const seen=new Set();
  const relevant=all.filter(t=>{
    if(t.status!=='complete')return false;
    const involving=(t.roster_ids||[]).some(x=>Number(x)===rosterId)
      ||Object.values(t.adds||{}).some(x=>Number(x)===rosterId)
      ||Object.values(t.drops||{}).some(x=>Number(x)===rosterId)
      ||(t.waiver_budget||[]).some(x=>Number(x.sender)===rosterId||Number(x.receiver)===rosterId);
    const k=String(t.transaction_id||`${t._week}-${t.created}-${t.type}-${JSON.stringify(t.adds||{})}`);
    if(!involving||seen.has(k))return false;seen.add(k);return true;
  }).sort((a,b)=>(b.created||0)-(a.created||0));
  const ledger=relevant.slice(0,25).map(t=>{
    const incoming=Object.keys(t.adds||{}).filter(pid=>Number(t.adds[pid])===rosterId).map(pid=>transactionName(pid,namesResult));
    const outgoing=[...new Set([...Object.keys(t.drops||{}).filter(pid=>Number(t.drops[pid])===rosterId),...(t.type==='trade'&&(t.roster_ids||[]).length===2?Object.keys(t.adds||{}).filter(pid=>Number(t.adds[pid])!==rosterId):[])])].map(pid=>transactionName(pid,namesResult));
    const oppIds=(t.roster_ids||[]).map(Number).filter(x=>x!==rosterId);
    const opponent=t.type==='trade'&&oppIds.length?' · With '+oppIds.map(r=>rosterNameById(r,rosters,users)).join(', '):'';
    let summary=[];
    if(incoming.length)summary.push((t.type==='trade'?'Received ':'Added ')+incoming.join(', '));
    if(outgoing.length)summary.push((t.type==='trade'?'Sent ':'Dropped ')+outgoing.join(', '));
    const moves=summary.length?summary.join(' · '):(t.type==='trade'?'Trade completed — no player IDs recorded for this roster':'Roster transaction — player details unavailable');
    const cash=(t.waiver_budget||[]).map(w=>Number(w.receiver)===rosterId?'+'+w.amount:Number(w.sender)===rosterId?'-'+w.amount:null).filter(Boolean);
    const bid=t.type==='waiver'&&t.settings?.waiver_bid!=null?'Bid $'+t.settings.waiver_bid:null;
    const amt=cash.length?cash.join(' / '):(bid||'—');
    let timestamp=Number(t.created)?new Date(Number(t.created)).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Date unavailable';
    return '<tr><td>W'+e(t._week)+'</td><td><div class="txn-main">'+e(moves)+'</div><div class="txn-side">'+e(t.type||'transaction')+e(opponent)+' · '+e(timestamp)+'</div></td><td>'+e(amt)+'</td></tr>';
  }).join('');
  const remain=valid?budget-used:null;
  const warning=!namesResult?'Player directory unavailable: unknown IDs are displayed rather than guessed.':'';
  panel.innerHTML='<div class="grid four"><div><div class="label">Starting league FAAB</div><div class="value">'+fmtFaab(valid?budget:null)+'</div></div><div><div class="label">Sleeper budget used</div><div class="value">'+fmtFaab(valid?used:null)+'</div></div><div><div class="label">Base remaining*</div><div class="value">'+fmtFaab(remain)+'</div></div><div><div class="label">Known trade FAAB received</div><div class="value">$45*</div></div></div><p class="market-small">*Base remaining excludes any net traded FAAB. The $45 reflects historical deals, not an additional available balance. Sleeper balance/transaction rules remain authoritative.</p><details class="txn-fold"><summary><b>Completed Dirty Birds transactions</b> · '+relevant.length+' completed <span class="fold-caret">▼</span></summary><table class="txn-ledger"><thead><tr><th>Week</th><th>Players / Move</th><th>FAAB</th></tr></thead><tbody>'+(ledger||'<tr><td colspan="3">No matching completed moves reported.</td></tr>')+'</tbody></table><p class="market-small">Showing '+Math.min(relevant.length,25)+' of '+relevant.length+' matching completed transactions. Source: Sleeper live league API · Checked '+e(new Date().toLocaleTimeString())+'. '+(failedWeeks.length?'Weeks '+e(failedWeeks.join(', '))+' failed to load; ledger may be incomplete. ':'')+e(warning)+'</p></details>';
  if(panel.querySelector('.txn-fold'))panel.querySelector('.txn-fold').open=ledgerWasOpen;
  liveFaab={budget,used,remaining:remain};lastFaabSuccess=Date.now();data.faabSpent=used;
 }catch(err){panel.innerHTML='<div class="note">Sleeper transaction history unavailable ('+e(err.message)+'). No historical transactions inferred.</div>'}
}

// Auto-refresh uses public source JSON only. The dashboard is behind Cloudflare Access,
// but none of these source URLs is private. No authentication tokens are involved.
const FEED='https://raw.githubusercontent.com/Kodiak907/dirty-birds-sleeper-feed/main/data/';
const LIVE_FILES=['latest.json','FULL_SEASON_PLAYOFF_SIMULATION.json','WEEKLY_LINEUPS.json','AVAILABILITY_INTELLIGENCE.json','GAMEDAY_DECISION.json','ACTIONABLE_GM_BOARD.json'];
const FAST_FILE='fast_latest.json'; // lightweight independently published Sleeper snapshot
let activeSync=false, lastGoodSync=null;
const LEAGUE_ID_OVERRIDE=''; // Optional: set if the GitHub latest report lacks league_id
let liveFaab=null, lastFaabSuccess=null;
const ffoReportMemo=new Map(),ffoReportInflight=new Map();
async function fetchReport(file){
 const now=Date.now(),ttl=file==='fast_latest.json'?15000:file==='player_names.json'?900000:/TRADE|MARKET|AUTOMATED_WAIVER|QUALITY/.test(file)?300000:90000;
 const cached=ffoReportMemo.get(file);if(cached&&now-cached.at<ttl)return cached.data;
 if(ffoReportInflight.has(file))return ffoReportInflight.get(file);
 const pending=(async()=>{
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
  try{
   const res=await fetch(FEED+file+'?v='+Math.floor(now/ttl),{cache:'no-store',signal:ctrl.signal,credentials:'omit'});
   if(!res.ok)throw Error(file+' HTTP '+res.status);
   const item=await res.json();if(!item||typeof item!=='object')throw Error(file+' invalid JSON');
   const responseBytes=Number(res.headers.get('content-length')||0);
   if(file!=='player_names.json'&&file!=='external_metrics.json'&&responseBytes>0&&responseBytes<=125000){
    ffoReportMemo.delete(file);ffoReportMemo.set(file,{at:Date.now(),data:item});
    while(ffoReportMemo.size>12)ffoReportMemo.delete(ffoReportMemo.keys().next().value);
   }return item;
  }finally{clearTimeout(timer)}
 })();
 ffoReportInflight.set(file,pending);
 try{return await pending}finally{ffoReportInflight.delete(file)}
}
// Read-only waiver usage feed is research, not evidence of current claim eligibility.
async function refreshWaiverUsage(){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),13000);
 try{
  const r=await fetch(FEED+'WAIVER_WATCHLIST.md?v='+Date.now(),{cache:'no-store',signal:ctrl.signal,credentials:'omit'});
  if(!r.ok)throw Error('Waiver source HTTP '+r.status);
  const md=await r.text(),used=new Map();
  const generated=md.match(/^Generated:\s*(\S+)/m);waiverUsageStamp=generated?.[1]||null;
  let group=null;
  for(const line of md.split(/\r?\n/)){
   const head=line.match(/^### (QB|RB|WR|TE|K|DEF)\s*$/);if(head){group=head[1];continue}
   if(line.startsWith('## '))group=null;
   const p=line.split('|').slice(1,-1).map(x=>x.trim());
   if(!group||p.length<6||!/^[0-9]+$/.test(p[0]))continue;
   const value=Number(p[3]),snaps=Number(p[5].replace('%',''));
   if(!p[1]||!Number.isFinite(value))continue;
   used.set(normPlayer(p[1]),{position:group,team:p[2],rosPpg:value,coverage:p[4],snapPct:Number.isFinite(snaps)?snaps:null,injury:p[6]||'Not reported'});
  }
  waiverUsage=used;waiverUsageError=null;
 }catch(err){waiverUsageError=String(err.message||err)}finally{clearTimeout(timer);renderWaiverScouting()}
}

// 4.3: trade research prioritizes team fit and two-sided gains, then displays
// rejected/marginal ideas separately. A points delta is NOT fair market value.
let tradeQuality43=null;
let tradeLens='all';
function tradeLeadGrade(x){
 const ours=Number(x.dirty_birds_delta_ppg||0),theirs=Number(x.opponent_delta_ppg||0);
 const give=x.give||[],recv=x.receive||[];
 const sent=give.reduce((s,p)=>s+Number(p.projected_ppg||0),0),got=recv.reduce((s,p)=>s+Number(p.projected_ppg||0),0);
 const ratio=sent>0?got/sent:0;
 const star=give.some(p=>['Bijan Robinson','Kyren Williams','A.J. Brown'].includes(p.name));
 const extra=give.length>recv.length?give.length-recv.length:0;
 const issues=[];
 if(ours<0.75)issues.push('Small modeled benefit to Dirty Birds');
 if(theirs<0.5)issues.push('Little demonstrated value for other manager');
 if(ratio<0.8)issues.push('Outgoing value may exceed incoming value');
 if(star&&ours<1.75)issues.push('High-value starter risk for limited gain');
 if(extra&&ours<1.6)issues.push('Multi-player consolidation lacks clear starter gain');
 if((x.warnings||[]).length)issues.push('Incomplete health/workload evidence');
 if(x.dirty_birds_drop_to_fit)issues.push('Would need to cut '+x.dirty_birds_drop_to_fit);
 if(x.opponent_drop_to_fit)issues.push('They would need to drop '+x.opponent_drop_to_fit);
 const researchAge=tradeIdeasStamp?Date.now()-Date.parse(tradeIdeasStamp):Infinity;
  const dated=Number.isFinite(researchAge)&&researchAge>=0&&researchAge<=48*3600000;
  const ownershipReady=!!leagueOwnedIds&&!!ownershipCheckedMs&&Date.now()-ownershipCheckedMs<=300000;
  if(!dated)issues.push('Underlying trade scan is old or missing a source date');
  if(!ownershipReady)issues.push('Verify current FFL roster ownership before treating this as a lead');
  let tier=issues.length===0&&ours>=1.5&&theirs>=1?'PROMISING SCAN':'RESEARCH ONLY';
 return {issues,tier,ratio,sent,got};
}
function tradeBlockHTML(){
 const focus=[{name:'Garrett Wilson',id:'8146'},{name:'A.J. Brown',id:'5859'},{name:'Patrick Mahomes',id:'4046'}];
 let h='<div class="block-shell"><div class="block-header"><strong>Coach’s Trade Block</strong><span class="roster-label forecast">PRIORITY RESEARCH</span></div>';
 h+='<div class="block-assets">'+focus.map(p=>'<span class="block-asset">'+e(p.name)+'</span>').join('')+'</div>';
 h+='<p class="market-small">We search deals involving these three assets first. This is a <b>research preference</b>, not a confirmed standing offer to any manager.</p>';
 if(!tradeBlockReport?.reports){h+='<div class="screened-no">Targeted trade feed pending its GitHub research run. '+e(tradeBlockLoadError||'')+' The broad trade model below remains available.</div></div>';return h;}
 const stamp=tradeBlockReport.generated_at_utc?new Date(tradeBlockReport.generated_at_utc).toLocaleString():'unknown date';
 h+='<p class="market-small">Scan '+e(stamp)+' · '+e(tradeBlockReport.tested||0)+' configurations, '+e(tradeBlockReport.market_screened||0)+' price-band matches. Full-PPR market references are not exact half-PPR valuations.</p>';
 for(const f of focus){
  const report=tradeBlockReport.reports.find(r=>r.asset===f.name);
  const checkedLive=liveRosterSnapshot?.players?.some(p=>String(p.player_id)===f.id);
  let ownership=checkedLive?'On live Dirty Birds roster':liveRosterSnapshot?'NOT on live roster — verify before discussing':'Live ownership pending';
  const leads=(report?.leads||[]).filter(x=>!isTradeExcludedOpponent(x.opponent_roster_id??x.opponent_id,x.opponent||x.opponent_name));
  h+='<div class="block-profile"><strong>'+e(f.name)+'</strong> <span class="research-pill">'+e(ownership)+'</span><div class="block-sub">'+e(leads.length)+' published leads after manager exclusion · '+e(leads.filter(x=>x.screen==='STRICT_RESEARCH_PASS').length)+' passed stricter screening</div>';
  if(!report)h+='<div class="market-small">No source data for this asset yet.</div>';
  else if(!leads.length)h+='<div class="market-small">No research package worth opening at the current source prices and modeled lineups. We will not invent an offer.</div>';
  else h+='<details class="market-disclosure"><summary>Examine '+e(leads.length)+' potential '+e(f.name)+' deal structures</summary>'+leads.slice(0,6).map(x=>{
   const g=(x.give||[]).map(y=>y.name).join(' + '),recv=(x.receive||[]).map(y=>y.name).join(' + ');
   return '<div class="block-lead"><b>'+e(g)+' → '+e(recv)+'</b><small>'+e(x.opponent||'Opponent')+' · Dirty Birds '+(Number(x.our_lineup_delta_ppg)>=0?'+':'')+e(x.our_lineup_delta_ppg)+' PPG · Them +'+e(x.their_lineup_delta_ppg)+' PPG · Value paid/received '+e(x.value_paid_received_ratio)+'×</small><span class="research-pill '+(x.screen==='STRICT_RESEARCH_PASS'?'ok':'warn')+'">'+e(x.screen==='STRICT_RESEARCH_PASS'?'Stricter screen passed':'Research only')+'</span><details><summary>Examine the costs</summary><div class="scout-detail">'+(x.our_extra_cut?'Our additional roster cut: '+e(x.our_extra_cut)+'. ':'')+(x.opponent_extra_cut?'Opponent additional cut: '+e(x.opponent_extra_cut)+'. ':'')+'Projected lineup changes do NOT establish true player value, manager willingness, current health or playoff impact. FFL scoring is half-PPR; market baseline is full-PPR.</div></details></div>';
  }).join('')+'</details>';
  h+='</div>';
 }
 h+='<div class="market-small">All results are read-only. Coach authorizes each negotiation and transaction. A source reported no offers sent, and no acceptance probability is estimated.</div></div>';
 return h;
}
function renderTradeScouting(){
 const box=$('trade-intel');if(!box)return;
 // Legacy Trade Laboratory is expensive. Hydrate only when explicitly expanded;
 // all background source updates still refresh cached research without painting it.
 if($('pfo59-market')&&(!$('trade-fold')?.open||!document.querySelector('#market.page.active [data-pfo59-market-panel="trade"]:not([hidden])')))return;const priorExpanded=[...box.querySelectorAll('details')].map((z,i)=>z.open?i:-1).filter(i=>i>=0);
 const live=broaderTradeIdeas.filter(x=>!isTradeExcludedOpponent(x.opponent_roster_id,x.opponent_name||x.opponent)&&Number.isFinite(Number(x.dirty_birds_delta_ppg))&&Number.isFinite(Number(x.opponent_delta_ppg)));
 const scored=live.map(x=>({...x,_grade:tradeLeadGrade(x),_opp:tradeProfiles.get(Number(x.opponent_roster_id))}));
 const qualified=scored.filter(x=>x._grade.tier==='PROMISING SCAN');
 const candidates=scored.filter(x=>x._grade.tier!=='PROMISING SCAN').sort((a,b)=>{
   const aa=Number(a.dirty_birds_delta_ppg)*0.7+Number(a.opponent_delta_ppg)*0.3-a._grade.issues.length*0.4;
   const bb=Number(b.dirty_birds_delta_ppg)*0.7+Number(b.opponent_delta_ppg)*0.3-b._grade.issues.length*0.4;return bb-aa;
 });
 let h=tradeBlock45HTML()+'<details class="market-disclosure"><summary>Previous 4.4 broad scan and audit research</summary>'+tradeBlockHTML()+'<p class="market-small">League-wide scan '+e(tradeIdeasStamp?new Date(tradeIdeasStamp).toLocaleString():'not loaded')+' · Quality screen '+e(tradeReportStamp?new Date(tradeReportStamp).toLocaleString():'pending')+'. <b>Research only.</b> No offers submitted.</p>';
 h+='<div class="brief-digest"><div class="brief-stat"><b>'+e(live.length)+'</b><span>Modeled scenarios</span></div><div class="brief-stat"><b>'+e(qualified.length)+'</b><span>Potential negotiation leads*</span></div></div>';
 h+='<p class="market-small">*Passing preliminary model screens does not confirm market fairness, current NFL health or manager acceptance. Coach authorizes every offer.</p>';
 if(tradeProfiles.size){
  const profiles=[...tradeProfiles.values()].filter(t=>Number(t.id)!==1&&!isTradeExcludedOpponent(t.id,t.team));
  h+='<div class="market-section-label">Opponent positional needs (scouting)</div>';
  const needy=profiles.map(t=>{const counts=Object.fromEntries(Object.entries(t.positions||{}).map(([p,l])=>[p,(l||[]).length]));const needs=[];if((counts.RB||0)<=4)needs.push('RB depth');if((counts.WR||0)<=4)needs.push('WR depth');if((counts.TE||0)<=1)needs.push('TE depth');return {...t,needs};}).filter(t=>t.needs.length).slice(0,5);
  h+='<div class="trade-quality">'+(needy.length?needy.map(t=>'<div class="brief-row"><b>'+e(t.team)+'</b><small>Possible needs: '+e(t.needs.join(', '))+' · Positional counts only, not confirmed manager priorities</small>'+(t.needs.includes('RB depth')&&(t.positions?.WR||[]).length>=6?'<small><b>Potential RB-for-WR conversation:</b> WR group includes '+e((t.positions.WR||[]).slice(0,5).join(', '))+'. Names are scouting targets, NOT offers or an indication anyone is available.</small>':'')+'</div>').join(''):'No obvious positional count shortages detected in latest roster profiles.')+'</div>';
 } if(tradeQuality43){
  const v=tradeQuality43;
  h+='<div class="market-section-label">Trade Opportunities · 4.3 Quality Screen</div><p class="market-small">'+e((v.qualified||[]).filter(x=>!isTradeExcludedOpponent(x.opponent_roster_id,x.opponent_name)).length)+' packages met the two-sided lineup gain and market-value gates · '+e(v.candidates_evaluated||0)+' configurations evaluated · updated '+e(v.generated_at_utc?new Date(v.generated_at_utc).toLocaleString():'unknown')+'. Market baseline is full-PPR, not an exact FFL valuation.</p>';
  if((v.qualified||[]).some(x=>!isTradeExcludedOpponent(x.opponent_roster_id,x.opponent_name))){
   h+=v.qualified.filter(x=>!isTradeExcludedOpponent(x.opponent_roster_id,x.opponent_name)).slice(0,8).map(x=>{
    const give=(x.give||[]).map(y=>y.name).join(' + '),receive=(x.receive||[]).map(y=>y.name).join(' + ');
    const ours=Number(x.our_gain),theirs=Number(x.their_gain),ratio=Number(x.market_paid_received_ratio);
    const sourceDate=v.generated_at_utc?new Date(v.generated_at_utc).toLocaleString():'undated model';
    const line=(t)=>'<div class="pfo55-offer-line">'+e(t)+'</div>';
    return '<article class="trade-lead pfo55-screened-offer">'+
     '<div class="pfo55-offer-side"><div><small>GIVE</small><strong>'+e(give)+'</strong></div><b>→</b><div><small>RECEIVE</small><strong>'+e(receive)+'</strong></div></div>'+
     '<small class="market-small">'+e(x.opponent_name||'Opponent roster '+x.opponent_roster_id)+' · FFL candidate, no offer sent</small>'+
     '<div class="pfo55-offer-metrics"><span>Our model <b>'+(Number.isFinite(ours)?(ours>=0?'+':'')+ours.toFixed(2):'—')+' PPG</b></span><span>Their model <b>'+(Number.isFinite(theirs)?(theirs>=0?'+':'')+theirs.toFixed(2):'—')+' PPG</b></span><span>Value ratio <b>'+(Number.isFinite(ratio)?ratio.toFixed(2)+'×':'—')+'</b></span></div>'+
     '<div class="pfo55-offer-procon"><div><b>Why it could work</b>'+line('Dirty Birds lineup impact '+(Number.isFinite(ours)?ours.toFixed(2)+' PPG':'unverified'))+line('Opponent lineup impact '+(Number.isFinite(theirs)?theirs.toFixed(2)+' PPG':'unverified'))+line(x.why_both_benefit||'Both-team fit requires further verification')+'</div>'+
     '<div><b>Risks / limits</b>'+line('Market baseline uses full PPR, FFL is half PPR')+line('NFL health and playoff-week impact require fresh checks')+line('Manager interest and offer acceptance are unknown')+'</div></div>'+
     '<details><summary>Evidence, assumptions and source dates</summary><p class="market-small">Model as of '+e(sourceDate)+'. Roster replacement effects are included only to the extent the source model documents them. No action can be submitted from this analysis.</p></details></article>';
   }).join('');
  }
  else h+='<div class="screened-no">No packages cleared the stricter two-sided market and lineup gates. No recommendations are better than a forced bad trade.</div>';
 }

 h+='<div class="market-section-label">Our deal requirements</div><div class="gm-watch">Prefer a meaningful Dirty Birds starting-lineup upgrade, a credible need filled for the other team, no unnecessary star premium, and a package that makes sense at current market values. <b>No forced trades.</b></div>';
 if(qualified.length){h+='<div class="market-section-label">Legacy research (not approved)</div>';}
 else if(!tradeQuality43)h+='<div class="screened-no"><b>No current deal passes preliminary filters.</b><br>Research requires market verification.</div>';
 const printDeal=x=>{
  const who=x._opp?.team||'Roster '+x.opponent_roster_id;
  const give=(x.give||[]).map(p=>p.name).join(' + '),take=(x.receive||[]).map(p=>p.name).join(' + ');
  const q=x._grade,notes=[...q.issues,...(x.warnings||[])];
  return '<div class="trade-lead"><strong>'+e(give)+' → '+e(take)+'</strong><div class="scout-meta">'+e(who)+' · <span class="research-pill">Us +'+Number(x.dirty_birds_delta_ppg).toFixed(2)+'</span><span class="research-pill">Them +'+Number(x.opponent_delta_ppg).toFixed(2)+'</span><span class="research-pill '+(q.tier==='PROMISING SCAN'?'ok':'warn')+'">'+e(q.tier)+'</span></div><details><summary>Roster impact and weaknesses</summary><div class="scout-detail">Outgoing projection sum '+e(q.sent.toFixed(1))+' PPG; incoming sum '+e(q.got.toFixed(1))+' PPG. These are NOT trade-value rankings.<br>'+e(notes.join(' · ')||'Market valuation, target health and acceptance not yet independently verified')+'<br>Evaluate their positional needs and remaining season schedule before a real offer.</div></details></div>';
 };
 if(!tradeQuality43)h+=qualified.slice(0,6).map(printDeal).join('');
 else if(qualified.length)h+='<details class="market-disclosure"><summary>Older model ideas ('+e(qualified.length)+') — NOT quality-approved</summary>'+qualified.slice(0,8).map(printDeal).join('')+'</details>';
 
 if(marketPricedLeads.some(x=>!isTradeExcludedOpponent(x.opponent_roster_id,x.opponent_name))){
  h+='<div class="market-section-label">Legacy price matches — not recommendations</div>';
  h+='<p class="market-small">'+e(marketPricedLeads.filter(x=>!isTradeExcludedOpponent(x.opponent_roster_id,x.opponent_name)).length)+' packages had independent value matches as of '+e(marketValueAsOf?new Date(marketValueAsOf).toLocaleString():'unknown date')+'. Reference uses <b>'+e(marketValueBaseline)+'</b>. A price match alone does not make a good trade.</p>';
  h+='<details class="market-disclosure"><summary>Review priced opportunities and hidden costs ('+e(marketPricedLeads.filter(x=>!isTradeExcludedOpponent(x.opponent_roster_id,x.opponent_name)).length)+')</summary>';
  h+=marketPricedLeads.filter(x=>!isTradeExcludedOpponent(x.opponent_roster_id,x.opponent_name)).slice(0,8).map(x=>{const q=x.market_quote||{},who=tradeProfiles.get(Number(x.opponent_roster_id))?.team||'Roster '+x.opponent_roster_id;const given=(x.give||[]).map(p=>p.name).join(' + ');const received=(x.receive||[]).map(p=>p.name).join(' + ');const flags=tradeLeadGrade(x).issues;return '<div class="trade-lead"><b>'+e(given)+' → '+e(received)+'</b><div class="scout-meta">'+e(who)+' · Model us +'+e(Number(x.dirty_birds_delta_ppg||0).toFixed(2))+' PPG · them +'+e(Number(x.opponent_delta_ppg||0).toFixed(2))+' PPG · Value paid/received '+e(Number(q.paid_to_received_ratio||0).toFixed(2))+'×</div><small>'+e(flags.length?flags.join(' · '):'Independent value reference checked; current health and manager interest not verified')+'</small></div>';}).join('');
  h+='</details>';
 }

 h+='<div class="market-section-label">Rejected / incomplete research (expand only to audit)</div>';
 h+='<div class="trade-groups"><button type="button" data-lens="all" class="'+(tradeLens==='all'?'selected':'')+'">All</button><button type="button" data-lens="wr" class="'+(tradeLens==='wr'?'selected':'')+'">Acquire WR</button><button type="button" data-lens="rb" class="'+(tradeLens==='rb'?'selected':'')+'">Acquire RB</button><button type="button" data-lens="te" class="'+(tradeLens==='te'?'selected':'')+'">Acquire TE</button></div>';
 let filtered=candidates.filter(x=>tradeLens==='all'||(x.receive||[]).some(p=>String(p.pos||'').toLowerCase()===tradeLens));
 if(!filtered.length)h+='<p class="market-small">No scanned packages match this target position. We have not fabricated alternatives.</p>';
 else h+='<details class="market-disclosure"><summary>Show '+e(filtered.length)+' unvetted scenarios (NOT offers)</summary>'+filtered.slice(0,35).map(printDeal).join('')+'</details>';
 // An unattributed historical rejection could involve Boyle: hide it until owner ID exists.
 if(tradeRejected.some(x=>x.opponent_roster_id!=null&&!isTradeExcludedOpponent(x.opponent_roster_id,x.opponent_name)))h+='<details class="market-disclosure"><summary>Previously rejected by quality-control: '+e(tradeRejected.filter(x=>x.opponent_roster_id!=null&&!isTradeExcludedOpponent(x.opponent_roster_id,x.opponent_name)).length)+'</summary>'+tradeRejected.filter(x=>x.opponent_roster_id!=null&&!isTradeExcludedOpponent(x.opponent_roster_id,x.opponent_name)).slice(0,8).map(x=>'<div class="market-case"><b>'+e((x.give||[]).join(' + '))+' → '+e((x.receive||[]).join(' + '))+'</b><small>'+e((x.reasons||[]).join(' · '))+'</small></div>').join('')+'</details>';
 h+='<p class="market-small">Next model upgrade: expand to better two-player swaps, adjust values for current role/injuries, and screen roster needs before making trade recommendations.</p>';
 h+='</details>';
 box.innerHTML=h;
 [...box.querySelectorAll('details')].forEach((z,i)=>{if(priorExpanded.includes(i))z.open=true;});
 box.querySelectorAll('[data-lens]').forEach(btn=>btn.onclick=()=>{tradeLens=btn.dataset.lens;renderTradeScouting();});
}
function renderWaiverScouting(){
 const box=$('waiverlive');if(!box)return;const priorExpanded=[...box.querySelectorAll('details')].map((z,i)=>z.open?i:-1).filter(i=>i>=0);
 const visible=waiverResearch.filter(x=>!waiverIsRostered(x.player,x.source_player_id||x.player_id));
 const visibleAuto=(autoScout?.candidates||[]).filter(x=>!waiverIsRostered(x.name,x.player_id||x.source_player_id||x.id));
 const hidden=(waiverResearch.length-visible.length)+(autoScout?.candidates?.length||0)-visibleAuto.length;
 const published=waiverUsageStamp?new Date(waiverUsageStamp).toLocaleString():'not available';
 let out='<p class="market-small"><b>'+e(visible.length)+' eligible-to-research shortlists</b> · '+e(visibleAuto.length)+' automated radar entries · '+e(hidden)+' rostered entries excluded across raw pools · Ownership '+e(ownershipStamp?new Date(ownershipStamp).toLocaleString():'not yet checked')+' ('+e(ownershipSource)+') · Usage '+e(published)+'. ROS PPG is a <b>projection</b>, not historical production.</p>';
 if(!leagueOwnedIds)out+='<div class="note">Current league ownership has not loaded. Candidate availability is unverified, and names may disappear after Sleeper connects.</div>';
 else if(Date.now()-ownershipCheckedMs>5*60*1000)out+='<div class="note">Sleeper ownership check is older than five minutes. Displayed names are a research cache, not certified current waiver availability.</div>';
 if(!visible.length)out+='<div class="scout47-note">No unrostered candidates remain in the model shortlist. Rostered players are excluded, not recommended as waivers.</div>';
 if(!waiverResearch.length&&!visibleAuto.length){box.innerHTML=out;return;}

 if(waiverUsageError)out+='<div class="note">Usage detail unavailable: '+e(waiverUsageError)+'</div>';
 out+=visible.map((x,i)=>{
  const usage=waiverUsage.get(normPlayer(x.player));
  const watch=Boolean(autoScoutByName.get(normPlayer(x.player))?.signals?.length);
  const snap=usage?.snapPct;
  const role=snap==null?'No supported snap-share sample':snap>=80?'High recent snap share (participation only)':snap>=55?'Moderate recent snap share — review trend':'Limited recent snap share — role needs monitoring';
  const inj=usage?.injury&&usage.injury!=='Not flagged'?'Source injury tag: '+usage.injury+'; verify official report':'No source injury flag; not game-day clearance';
  const gaps=Array.isArray(x.not_yet_verified)?x.not_yet_verified:[];
  const flags=Array.isArray(x.evidence_flags)?x.evidence_flags.filter(t=>t!=='No listed coverage caveats'):[];
  const catalyst=waiverCatalysts.get(normPlayer(x.player));
  const automatic=autoScoutByName.get(normPlayer(x.player));
  const autoEvidence=automatic?'<div class="auto-evidence"><b>Automated scouting · '+e(automatic.checked_at||autoScout?.generated_at_utc||'unknown')+'</b>'+ (automatic.signals||[]).slice(0,5).map(z=>'<p><b>'+e(z.type||'Signal')+':</b> '+e(z.description||'')+(z.source_url? ' <a href="'+e(z.source_url)+'" target="_blank" rel="noopener">Source ↗</a>':'')+'</p>').join('')+(automatic.news||[]).slice(0,4).map(z=>'<p><b>Recent reporting:</b> <a href="'+e(z.url)+'" target="_blank" rel="noopener">'+e(z.title)+'</a> · '+e(z.published||'undated')+' · '+e(z.publisher||'Publisher unknown')+'</p>').join('')+'<small>Automated news headlines are research leads, not independently verified injury designations. Sleeper injury tags are not official NFL transaction proof.</small></div>':'<p class="market-small">Automated scouting report not published for this player yet. The scouting job covers the entire model shortlist when it runs.</p>';
  const preview=catalyst?'<div class="evidence-preview"><b>Opportunity trigger · '+e(catalyst.event_at||'dated report')+':</b> '+e(catalyst.event||'')+'<div class="no-verification">'+e(catalyst.impact||'Role still requires checking')+'</div></div>':'';
  const evidence=catalyst?'<div class="scout-catalyst"><strong>Confirmed opportunity event: '+e(catalyst.event_player||'Team change')+'</strong><br>'+e(catalyst.event||'Event reported')+'<br><small>'+e(catalyst.impact||'Role change requires verification')+'</small><p class="market-small">'+e(catalyst.analysis?.map(a=>a.publisher+': '+a.takeaway).join(' | ')||'')+'</p><a href="'+e(catalyst.primary_source?.url||'#')+'" target="_blank" rel="noopener noreferrer">Official team source ↗</a> '+(catalyst.analysis||[]).map(a=>'<a href="'+e(a.url)+'" target="_blank" rel="noopener noreferrer">'+e(a.publisher)+' ↗</a>').join('')+'<p class="market-small">Curated '+e(catalystsStamp?new Date(catalystsStamp).toLocaleDateString():'date unrecorded')+'. This report is NOT automatically updated with breaking news. Next checks: '+e((catalyst.followups||[]).join(' · '))+'</p></div>':'<p><b>Depth chart catalyst:</b> No separate club-verified catalyst in the manually curated report. Inspect automated depth and news alerts above; absence is not proof of clearance.</p>';

  return '<div class="scout-card"><div class="scout-top"><div><b>'+e(x.player)+'</b><div class="scout-meta">'+e(x.position)+' · '+e(x.team||usage?.team||'—')+(watch?' · <strong style="color:#ffcf85">Coach watchlist</strong>':'')+'</div></div><span class="scout-pill'+(watch?' accent':'')+'">'+e(x.research_tier||'Research')+'</span></div>'+
   '<div class="scout-metrics"><span class="scout-pill">Projected ROS '+(usage?e(usage.rosPpg.toFixed(2)):'N/A')+' PPG</span><span class="scout-pill">Snap share '+(snap!=null?e(snap.toFixed(1))+'%':'unavailable')+'</span><span class="scout-pill">Model depth +'+e(Number(x.bench_depth_difference_ppg||0).toFixed(2))+'</span></div>'+
   '<div class="scout-meta">'+(leagueOwnedIds?'<strong>Unrostered in checked league snapshot</strong> (waiver eligibility/unlock time unchecked)':'League ownership not freshly verified')+' · Modeled starter improvement '+e(Number(x.modeled_starter_gain_ppg||0).toFixed(2))+' PPG</div>'+preview+
   '<details><summary>Scouting evidence &amp; open questions</summary><div class="scout-detail">'+autoEvidence+'<p><b>Usage:</b> '+e(role)+'</p>'+ '<p><b>Availability:</b> '+e(inj)+'</p>'+evidence+'<p><b>Potential roster decision:</b> Compare with '+e(x.hypothetical_drop||'current bench')+' <em>only after</em> reviewing weekly usage, waiver status and cost.</p><p><b>Still needs checking:</b> '+e(gaps.join(', ')||'Role, availability, and cost')+(flags.length?' · Flags: '+e(flags.join(', ')):'')+'</p></div></details></div>';
 }).join('');
 if(visibleAuto.length){
   const listed=new Set(visible.map(x=>normPlayer(x.player)));
   const extra=visibleAuto.filter(x=>!listed.has(normPlayer(x.name)));
   const alertScore=x=>(x.signals||[]).length*2+(x.news||[]).length;
   extra.sort((a,b)=>alertScore(b)-alertScore(a));
   out+='<div class="market-section-label">Automated opportunity radar — beyond the initial shortlist</div>';
   out+='<p class="market-small">'+e(extra.length)+' additional currently unrostered names in research · '+e(autoScout.news_queries_attempted||0)+' external news lookups · '+e(autoScout.news_query_failures||0)+' feed failures · snapshot '+e(autoScout.generated_at_utc?new Date(autoScout.generated_at_utc).toLocaleString():'time unknown')+'. These are research findings, not waiver recommendations.</p>';
   if(autoScout.news_query_failures)out+='<div class="note">News indexing failed for '+e(autoScout.news_query_failures)+' searches. Injury status cannot be inferred from these missing reports.</div>';
   const card=x=>'<div class="scout-card"><div class="scout-top"><div><b>'+e(x.name)+'</b><div class="scout-meta">'+e(x.position)+' · '+e(x.team||'team unknown')+'</div></div><span class="research-pill">'+e((x.signals||[]).length)+' usage/availability alerts</span></div>'+
     (x.signals||[]).slice(0,3).map(y=>'<div class="scout-detail"><b>'+e(y.type)+':</b> '+e(y.description)+(y.source_url?' <a href="'+e(y.source_url)+'" target="_blank" rel="noopener">Evidence source ↗</a>':'')+'</div>').join('')+
     (x.news||[]).slice(0,3).map(y=>'<p class="market-small"><a href="'+e(y.url)+'" target="_blank" rel="noopener">'+e(y.title)+'</a> · '+e(y.published||'date unverified')+' · '+e(y.publisher||'news index')+'<br><span class="muted">Headline only, requires confirmation</span></p>').join('')+
     (!(x.signals||[]).length&&!(x.news||[]).length?'<p class="market-small">No new injury/depth/usage signal verified by this scan; not a clearance determination.</p>':'')+'</div>';
   out+=extra.slice(0,6).map(card).join('');
   if(extra.length>6)out+='<details class="market-disclosure"><summary>See remaining '+e(extra.length-6)+' automatically scouted candidates</summary>'+extra.slice(6).map(card).join('')+'</details>';
 } else if(!autoScout?.candidates?.length)out+='<div class="note">Automated waiver scouting has not published a full candidate-pool report yet. The hourly research pipeline must complete successfully; the four manually sourced catalyst reports below are not a substitute.</div>';
 out+='<p class="market-small">Research source labels indicate automated provider flags, dated journalist headlines, or human-verified club updates. A headline by itself is not confirmation of an injury. No automatic cuts, bids, or pickups.</p>';
 box.innerHTML=out;[...box.querySelectorAll('details')].forEach((z,i)=>{if(priorExpanded.includes(i))z.open=true;});
}
function mergeFeed(name,x){
 if(name==='latest.json'){
  gm47Snapshot=x;
  // fast_latest.json intentionally has no historical matchups: preserve the hourly scored ledger.
  if(x.matchups_by_week&&Object.keys(x.matchups_by_week).length)gm47HistorySnapshot={matchups_by_week:x.matchups_by_week,fetched_at_utc:x.fetched_at_utc,season:Number(x.nfl_state?.season)};
  updateLeagueStandings(x);
  const r=x.rosters?.find(v=>v.roster_id===1);
  if(!r||!x.nfl_state)throw Error('Invalid roster snapshot');
  data.record=r.settings.wins+'–'+r.settings.losses;
  data.rosterCount=r.players?.length||0;
  const spent=r.settings.waiver_budget_used;
  if(typeof spent==='number')data.faabSpent=spent;
  data.snapshot='FFL Week '+x.nfl_state.week+' • synced';data.sources[0][1]=x.fetched_at_utc||'Time unavailable';
  if(x.nfl_state?.week!=null)window.dbNflWeek=Number(x.nfl_state.week); if(x.nfl_state?.season!=null)window.dbNflSeason=Number(x.nfl_state.season);
  const leagueId=String(x.league_id||x.league?.league_id||x.league?.id||LEAGUE_ID_OVERRIDE||'');if(/^\d{10,}$/.test(leagueId))window.dbLeagueId=leagueId;
  window.dbRosterId=r.roster_id;
  if(Array.isArray(x.rosters)){
    updateLeagueOwnership(x.rosters,x.fetched_at_utc||'', 'Published Sleeper snapshot',cachedPlayerNames);
  }
  if(document.querySelector('#overview.page.active'))renderGamedayInactives();
  if(document.querySelector('#market.page.active [data-pfo59-market-panel="waiver"]:not([hidden])'))renderWaiverScouting();
 }
 if(name==='FULL_SEASON_PLAYOFF_SIMULATION.json'){
  const me=x.teams?.find(t=>t.roster_id===1);
  if(x.status!=='complete_schedule_conditional_model'||!me)throw Error('Playoff report incomplete');
  data.playoff=me;data.teams=x.teams.map(t=>[t.name,t.record,t.championship_probability]);
  data.sources[1][1]=x.generated_at_utc||'Time unavailable';
 }
 if(name==='WEEKLY_LINEUPS.json'){
  gm47Lineups=x;
  const weeks=x.weeks||{},keys=Object.keys(weeks).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  const target=Number((data.snapshot.match(/Week (\d+)/)||[])[1]);
  const w=weeks[String(target)]||weeks[String(keys.find(k=>k>=target))]||weeks[String(keys[keys.length-1])];
  if(w?.starters){data.lineup=w.starters.map(v=>[v.position,v.name,v.opponent,v.ppg]);data.projection=w.ppg;
   modelLineupMeta={week:Number(weeks[String(target)]?target:(keys.find(k=>k>=target)||keys[keys.length-1])),published:x.generated_at_utc||x.fetched_at_utc||null,source:'WEEKLY_LINEUPS.json'};if(document.querySelector('#roster.page.active,#matchup.page.active'))renderRosterComparison();}
 }
 if(name==='AVAILABILITY_INTELLIGENCE.json'){
  gm47Availability=x;
  if(Array.isArray(x.dirty_birds_watch)){injurySnapshot={stamp:x.generated_at_utc||x.fetched_at_utc||null,watch:x.dirty_birds_watch};if(document.querySelector('#availability.page.active'))updateInjuryView();}
 }
 if(name==='GAMEDAY_DECISION.json'){gm47Gameday=x;}
 if(name==='GAMEDAY_DECISION.json')data.sources[2][1]=(x.third_party_inactive_source_status||'Not independently verified')+' • '+(x.generated_at_utc||'');
 if(name==='ACTIONABLE_GM_BOARD.json'){
  if(!Array.isArray(x.waiver_research_shortlist)||!Array.isArray(x.trade_qualified_for_negotiation_review))throw Error('GM screen invalid');
  waiverResearch=x.waiver_research_shortlist;tradeStatus=x.trade_status||'No qualified trade ideas';
  tradeRejected=Array.isArray(x.trade_rejected)?x.trade_rejected:[];tradeReportStamp=x.generated_at_utc||null;
  data.trades=x.trade_qualified_for_negotiation_review.map(t=>[(t.give||[]).map(p=>p.name).join(' + '),(t.receive||[]).map(p=>p.name).join(' + '),Number(t.dirty_birds_delta_ppg||0).toFixed(2)+' PPG']);
 }
}

// Injury Command 2.2: source-aware adjudication. Snapshot is NOT official NFL evidence.
let injurySnapshot=null, nflVerified=null, transactionEvidence=null, latestInjuryCheck=null, injuryError=null;
let liveRosterSnapshot=null,liveRosterError=null,liveRosterCheckedAt=null;
// Submitted Sleeper roster and model remain separate. Never alter Sleeper state.
function rosterPerson(pid,lookup){return lookup.get(String(pid))||{name:'Unknown player ('+pid+')',team:'—',position:'—',sleeper_injury_status:null};}
function renderRosterComparison(){
 const status=$('actualstatus'),actual=$('actual-lineup');if(!status||!actual)return;
 const live=liveRosterSnapshot,players=live?.players||[],byId=new Map(players.map(p=>[String(p.player_id),p]));
 const meta=modelLineupMeta;
 const age=meta.published?Math.max(0,Date.now()-Date.parse(meta.published)):null;
 const projection=$('projection-status');
 if(projection){projection.textContent=(meta.week?'Model week '+meta.week+' · ':'')+meta.source+(Number.isFinite(age)?' · Published '+ageText(age)+' ago':' · Publication time unavailable')+' · Research only';}
 if(!live){status.textContent='Actual lineup unavailable — '+(liveRosterError||'waiting for current Sleeper data')+'. The model below is NOT the submitted lineup.';actual.innerHTML='<tr><td colspan="3">No verified live starters. Do not use projected names as actual.</td></tr>';$('actual-bench').textContent='Live roster unavailable';$('actual-reserve').textContent='Live roster unavailable';$('bench-count').textContent='';$('reserve-count').textContent='';$('lineupdiff').textContent='Comparison unavailable until Sleeper connects.';return;}
 const started=(live.starters||[]).map(String),slots=live.starting_slots||[];
 const reserves=new Set((live.reserve||[]).map(String));const starterIds=new Set(started.filter(id=>id&&id!=='0'));
 const bench=players.filter(p=>!starterIds.has(String(p.player_id))&&!reserves.has(String(p.player_id)));
 const reservePlayers=players.filter(p=>reserves.has(String(p.player_id)));
 const cell=(p)=>((p.player_id&&String(p.player_id)!=='0')?pfo49Link(p.player_id):e(p.name))+(p.sleeper_injury_status?'<div class="tag-note">Sleeper: '+e(p.sleeper_injury_status)+'</div>':'');
 actual.innerHTML=started.length?started.map((id,i)=>{const p=id==='0'?{name:'Empty slot',team:'—'}:rosterPerson(id,byId);return '<tr><td>'+e(slots[i]||'START')+'</td><td>'+cell(p)+'</td><td>'+e(p.team||'—')+'</td></tr>';}).join(''):'<tr><td colspan="3">Sleeper returned no submitted starter slots.</td></tr>';
 const list=(items)=>items.length?'<table><thead><tr><th>Pos.</th><th>Player</th><th>Team</th></tr></thead><tbody>'+items.map(p=>'<tr><td>'+e(p.position||'—')+'</td><td>'+cell(p)+'</td><td>'+e(p.team||'—')+'</td></tr>').join('')+'</tbody></table>':'<div class="muted" style="margin-top:12px">None currently listed.</div>';
 $('actual-bench').innerHTML=list(bench);$('actual-reserve').innerHTML=list(reservePlayers);
 $('bench-count').textContent='('+bench.length+')';$('reserve-count').textContent='('+reservePlayers.length+')';
 status.innerHTML='<strong>SLEEPER CONNECTED</strong> · '+e(players.length)+' roster entries · '+e(started.length)+' starting slots · Checked '+e(new Date(live.checked_at||Date.now()).toLocaleTimeString())+' · Actual team only';
 if($('rosterstats')) $('rosterstats').innerHTML='<div class="value">'+e(players.length)+'</div><div class="muted">Current Sleeper roster entries (including D/ST)</div><div class="note">Research only. NFL and fantasy injury designations must be distinguished.</div>';
 const projected=(data.lineup||[]).filter(v=>v[1]&&!/D\/ST|defense/i.test(v[1])).map(v=>normPlayer(v[1]));
 const actualNames=new Set(started.filter(v=>v&&v!=='0').map(id=>normPlayer(rosterPerson(id,byId).name)));
 const notSubmitted=(data.lineup||[]).filter(v=>v[1]&&!/D\/ST|defense/i.test(v[1])&&!actualNames.has(normPlayer(v[1]))).map(v=>v[1]);
 const staleWeek=meta.week&&live?.nfl_week&&Number(meta.week)!==Number(live.nfl_week);
 $('lineupdiff').innerHTML=(staleWeek?'<strong>MODEL WEEK MISMATCH</strong> · The projection is for a different week.<br>':'')+(notSubmitted.length?'Projected starters not currently in the submitted lineup: <strong>'+notSubmitted.map(e).join(', ')+'</strong>.':'Model player names broadly match submitted starters; verify positions, slots and publishing time.')+'<div class="tag-note">Differences are for review only. No lineup change is made.</div>';
}

const INJURY_MAX_AGE_MS=80*60*1000;
const dateMs=x=>{const n=Date.parse(x||'');return Number.isFinite(n)?n:null};
function ageText(ms){return ms==null?'unknown age':ms<60000?'under 1 minute':Math.round(ms/60000)+' minutes';}
let espnInjuries=null, espnFetchedAt=null, espnError=null, espnSourceAge=null;
function normPlayer(x){return String(x||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
function updateInjuryView(){
 const health=$('injuryhealth'),body=$('injuries');if(!health||!body)return;
 const roster=liveRosterSnapshot?.players||[];const official=nflVerified?.players||[];const alt=espnInjuries||[];
 health.innerHTML='<b>Official NFL report:</b> '+e(pfo49Today(nflVerified?.checked_at))+' · <b>ESPN:</b> '+e(pfo49Today(espnFetchedAt))+' · <b>Roster:</b> '+e(pfo49Today(liveRosterSnapshot?.checked_at))+'<div class="pfo49-small">Only a direct NFL injury-report match is called official. Sleeper tags are fantasy indicators, not confirmed inactives.</div>';
 if(!roster.length){body.innerHTML='<tr><td colspan="3">Current roster has not loaded. No injury status can be verified yet.</td></tr>';return;}
 const starterIds=new Set((liveRosterSnapshot?.starters||[]).map(String));
 const rows=roster.map(p=>{const o=official.find(x=>normPlayer(x.name)===normPlayer(p.name)),a=alt.find(x=>normPlayer(x.name)===normPlayer(p.name));const tag=p.sleeper_injury_status||'';
  const game=String(o?.game_status||'').trim(),checkedOfficial=!!nflVerified?.checked_at;
  const label=o&&game?(game+' · NFL REPORT'):o?'NFL REPORT · no final game designation':a?(String(a.status||'ESPN injury entry')+' · ESPN'):tag?(tag+' · fantasy tag'):checkedOfficial?'NOT LISTED · NFL report checked':'STATUS UNVERIFIED · source pending';
  const checked=o||checkedOfficial?'<a href="https://www.nfl.com/injuries/" target="_blank" rel="noopener noreferrer">NFL injury report ↗</a>':(a?'<a href="https://www.espn.com/nfl/injuries" target="_blank" rel="noopener noreferrer">ESPN injuries ↗</a>':'Source confirmation unavailable');
  const note=o?('Practice: '+e(o.practice_status||'not published')+(o.injury?' · '+e(o.injury):'')+' · No game-day availability assumed'):a?e(a.detail||'Reported injury; verify team'):checkedOfficial?'Not included among matched injury-report entries as of '+e(pfo49Today(nflVerified.checked_at))+'. This is NOT a verified active or game-day clearance.':'No verified report available. Missing designation is NOT confirmation of clearance.';
  return {p,label,checked,note,important:!!o||!!a||!!tag||starterIds.has(String(p.player_id))};
 });
 rows.sort((a,b)=>Number(!!b.p.sleeper_injury_status)-Number(!!a.p.sleeper_injury_status));
 body.innerHTML=rows.map(x=>'<tr><td>'+e(x.p.name)+(starterIds.has(String(x.p.player_id))?' <small>STARTER</small>':'')+'</td><td><b>'+e(x.label)+'</b></td><td>'+x.note+'<div class="pfo49-small">'+x.checked+'</div></td></tr>').join('');
}
function watchNames(){return [...new Set([(liveRosterSnapshot?.players||[]).map(p=>p.name),...(liveRosterSnapshot?.players?.length?[]:[(injurySnapshot?.watch||[]).map(p=>p.name),(data?.lineup||[]).map(p=>p[1])])].flat().filter(Boolean).filter(n=>!/(vikings|defense|d\/st)/i.test(n)))].slice(0,45);}
async function loadLiveRoster(){
 const id=window.dbLeagueId||LEAGUE_ID_OVERRIDE, rid=window.dbRosterId||1;
 if(!id){liveRosterError='Waiting for live league ID from GitHub; saved watch list used';return;}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
 try{const r=await fetch('/api/roster?league_id='+encodeURIComponent(id)+'&roster_id='+encodeURIComponent(rid),{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(!Array.isArray(j.players)||!j.players.length)throw Error('Empty Sleeper player list');liveRosterSnapshot=j;liveRosterCheckedAt=Date.now();liveRosterError=null;renderRosterComparison();renderGamedayInactives();renderBriefing();pfo50RenderHomeKPIs();pfo50RenderProjectedLineup();renderTradeScouting();gm47Render();if(document.querySelector('#pfo59-team-hub [data-pfo59-team-panel="news"]:not([hidden])'))window.ffoPfoNews596?.refresh?.();}
 catch(err){liveRosterError=String(err.message||err);renderRosterComparison();}
 finally{clearTimeout(timer)}
}
async function loadOfficialInjuryVerification(){
 injuryError=null;
 try{const controller=new AbortController();const tm=setTimeout(()=>controller.abort(),12000);let r;
 try{r=await fetch('/api/nfl-official?names='+encodeURIComponent(watchNames().join(','))+'&ts='+Date.now(),{cache:'no-store',signal:controller.signal});}finally{clearTimeout(tm)}
 if(!r.ok)throw Error('NFL endpoint HTTP '+r.status);
 const x=await r.json();if(!Array.isArray(x.players)||!x.checked_at)throw Error('NFL report not verified');
 nflVerified=x;
 }catch(err){nflVerified=null;injuryError='Official NFL report unavailable: '+err.message;}
}
async function loadEspnInjuries(){
 try{
  const controller=new AbortController();const tm=setTimeout(()=>controller.abort(),12000);
  let r;
  try{r=await fetch('/api/injuries?names='+encodeURIComponent(watchNames().join(','))+'&ts='+Date.now(),{cache:'no-store',signal:controller.signal});}
  finally{clearTimeout(tm);}
  if(!r.ok)throw Error('HTTP '+r.status);
  const x=await r.json();if(!Array.isArray(x.injuries))throw Error('invalid injury feed');
  espnInjuries=x.injuries;espnFetchedAt=Date.parse(x.checked_at)||Date.now();espnError=null;
 }catch(err){espnError='ESPN feed: '+err.message;}
}


async function loadOfficialTransactions(){
 try{
  const names=injurySnapshot?.watch?.map(p=>p.name).filter(Boolean)||[];
  if(!names.length)return;
  const controller=new AbortController(),tm=setTimeout(()=>controller.abort(),11000);
  let r;try{r=await fetch('/api/nfl-transactions?names='+encodeURIComponent(names.join(',')),{cache:'no-store',signal:controller.signal});}finally{clearTimeout(tm)}
  if(!r.ok)throw Error('HTTP '+r.status);
  const x=await r.json();if(!Array.isArray(x.matches))throw Error('invalid transaction response');
  transactionEvidence=x;
 }catch(err){transactionEvidence=null;injuryError=(injuryError?injuryError+'; ':'')+'Transaction endpoint unavailable: '+String(err?.message||err)}
}

// Injury checking is independent of GitHub report and FAAB refreshes.
let injuryBusy=false;
async function refreshInjuryOnly(){
 if(injuryBusy)return;
 injuryBusy=true;
 const health=$('injuryhealth');
 if(health)health.textContent='Checking live NFL and ESPN sources…';
 try{
  const initialNames=watchNames(),seen=new Set(initialNames.map(normPlayer));
  // Fetch roster and available injury sources at the same time; don't add
  // a full extra network wait when a saved roster/name list already exists.
  const rosterTask=loadLiveRoster();
  const sourceTask=initialNames.length?Promise.allSettled([loadOfficialInjuryVerification(),loadEspnInjuries()]):Promise.resolve();
  await Promise.allSettled([rosterTask,sourceTask]);
  if(watchNames().some(n=>!seen.has(normPlayer(n))))
   await Promise.allSettled([loadOfficialInjuryVerification(),loadEspnInjuries()]);
 }catch(err){injuryError='Injury refresh error: '+String(err?.message||err);}
 finally{latestInjuryCheck=new Date();injuryBusy=false;updateInjuryView();renderGamedayInactives();if(document.querySelector('nav button[data-page="scouting"].active'))gm47Render();if(document.querySelector('#pfo59-team-hub [data-pfo59-team-panel="news"]:not([hidden])'))window.ffoPfoNews596?.refresh?.();}
}
async function refreshLive(){
 if(activeSync)return;activeSync=true;
 $('liveindicator').textContent='Refreshing six public intelligence reports…';
 const results=await Promise.allSettled(LIVE_FILES.map(fetchReport));let good=0,errors=[];
 // Ensure snapshot loads before lineup selection, and GM shortlist loads regardless of failures elsewhere.
 for(let i=0;i<results.length;i++){
  let item=results[i],name=LIVE_FILES[i];
  if(item.status==='fulfilled')try{mergeFeed(name,item.value);good++}catch(err){errors.push(name+': '+err.message)}
  else errors.push(name+': '+(item.reason?.message||'Connection failed'));
 }
 // Apply the independent fast Sleeper roster/FAAB snapshot AFTER the older hourly latest.json,
 // so the hourly feed never overwrites fresher live roster metrics.
 let fastStatus='';
 try {
   const fast=await fetchReport(FAST_FILE);
   if(!fast.fetched_at_utc||String(fast.league_id)!==String(window.dbLeagueId||fast.league_id)) throw Error('Invalid fast feed');
   const fastMs=Date.parse(fast.fetched_at_utc);
   const oldMs=Date.parse(data.sources[0]?.[1]||'');
   if(Number.isFinite(fastMs) && (!Number.isFinite(oldMs)||fastMs>=oldMs)) {
     mergeFeed('latest.json',fast);
     fastStatus='Fast Sleeper: '+ageText(Date.now()-fastMs)+' old';
   } else fastStatus='Fast Sleeper: older than research snapshot';
 } catch(e) {fastStatus='Fast Sleeper: not available yet ('+(e?.message||'error')+')';}
 if(good){lastGoodSync=new Date();if(document.querySelector('#overview.page.active'))render(true)}
 // Defer the large historical FAAB ledger until Trade/Waiver is requested.
 if(document.querySelector('nav button[data-page="market"].active'))void refreshFaab();
 if(window.dbLeagueId&&!liveRosterSnapshot)refreshInjuryOnly();
 // Injury refresh runs on a separate timer and cannot be blocked by FAAB or GitHub.
 const msg=good===LIVE_FILES.length?'CONNECTED • checked '+lastGoodSync.toLocaleTimeString()+' • all 6 reports retrieved (source generation dates may be older)':good?'PARTIAL SYNC • '+good+'/6 reports • '+errors.join('; '):'OFFLINE • keeping last saved snapshot • '+errors.join('; ');
 const stamp=dateMs(injurySnapshot?.stamp);$('liveindicator').textContent=msg+' • '+fastStatus+' • Injury research published '+(stamp?ageText(Date.now()-stamp)+' ago':'at an unknown time')+'. Hourly research is separate from the live ESPN/NFL checks. Checking GitHub does not generate a new report.';
 activeSync=false;if(document.querySelector('nav button[data-page="scouting"].active'))gm47Render();
}
// Homepage gameday inactive board: verified official submissions plus separately
// labeled ESPN event inactives. Player names and IDs must match current Sleeper.
// Both sources are read-only GitHub reports published by the existing hourly workflow.
let officialInactiveEvidence=null,espnGamedayEvidence=null;
let inactiveEvidenceChecked=null,inactiveEvidenceError='';
const INACTIVE_FILES=['OFFICIAL_INACTIVE_VERIFICATION.json','GAME_INACTIVES_EVIDENCE.json'];
function reportAgeTime(value){const ms=Date.parse(value||'');return Number.isFinite(ms)?'Published '+ageText(Math.max(0,Date.now()-ms))+' ago':'Report time unavailable';}
function safeSourceLink(raw,label){
 try{const u=new URL(String(raw||''));const host=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||!(host==='nfl.com'||host.endsWith('.nfl.com')||host==='espn.com'||host.endsWith('.espn.com')))return '';
  return '<a class="source-link" target="_blank" rel="noopener noreferrer" href="'+e(u.toString())+'">'+e(label)+' ↗</a>';
 }catch{return '';}
}
function rosterWeek(){const week=Number(window.dbNflWeek||((data.snapshot.match(/Week (\d+)/)||[])[1]));return Number.isInteger(week)&&week>0?week:null;}
function reportMatchesCurrentWeek(feed){
 const week=rosterWeek();const season=Number(window.dbNflSeason);
 return !!feed && !!week && Number(feed.week)===week && Number.isInteger(season) && Number(feed.season)===season;
}
function renderGamedayInactives(){
 const box=$('gameday-inactives');if(!box)return;
 const roster=liveRosterSnapshot?.players||[];
 const season=Number(window.dbNflSeason),week=rosterWeek();
 if(!roster.length){box.innerHTML='<div class="note">Connecting to your Sleeper roster and game-day inactives…</div>';return;}
 if(!Number.isInteger(season)||!week){box.innerHTML='<div class="note">Waiting for the current week: previous weeks’ reports are excluded.</div>';return;}
 const byId=new Map(roster.map(p=>[String(p.player_id),p]));
 const officialCurrent=reportMatchesCurrentWeek(officialInactiveEvidence),espnCurrent=reportMatchesCurrentWeek(espnGamedayEvidence);
 const verified=[],thirdParty=[],ruledOut=[],used=new Set();
 if(officialCurrent){for(const [id,entry] of Object.entries(officialInactiveEvidence.confirmed_official_inactives||{})){
  if(!byId.has(String(id))||entry?.status!=='inactive'||!entry?.verified_at_utc||!entry?.verified_by||!entry?.source_url)continue;
  verified.push({id:String(id),p:byId.get(String(id)),entry,label:'OFFICIAL inactive · reviewed team/league release'});used.add(String(id));
 }}
 if(espnCurrent){for(const [id,entry] of Object.entries(espnGamedayEvidence.explicit_inactives||{})){
  if(!byId.has(String(id))||used.has(String(id))||!entry?.event_id)continue;
  thirdParty.push({id:String(id),p:byId.get(String(id)),entry,label:'ESPN game-specific inactive · third-party'});used.add(String(id));
 }}
 // Official current NFL injury report explicitly says Out: ruled out BEFORE
 // kickoff, not merely tagged by Sleeper, not Questionable or Doubtful.
 const officialRows=Array.isArray(nflVerified?.players)?nflVerified.players:[];
 const officialAge=Date.now()-Date.parse(nflVerified?.checked_at||'');
 const currentNflSource=Number.isFinite(officialAge)&&officialAge>=0&&officialAge<2*60*60*1000;
 if(currentNflSource){for(const p of roster){
  if(used.has(String(p.player_id)))continue;
  const same=officialRows.filter(x=>normPlayer(x.name)===normPlayer(p.name)&&String(x.position||'').toUpperCase()===String(p.position||'').toUpperCase());
  if(same.length!==1||String(same[0].game_status||'').trim().toLowerCase()!=='out')continue;
  ruledOut.push({id:String(p.player_id),p,entry:{source_url:same[0].source_url},label:'Ruled OUT · official NFL injury report'});used.add(String(p.player_id));
 }}
 const starters=new Set((liveRosterSnapshot?.starters||[]).map(String));
 const rows=(items)=>items.map(item=>'<div class="gameday-item"><div><b>'+e(item.p.name)+(starters.has(item.id)?' <span class="gameday-chip warn">STARTING LINEUP ALERT</span>':'')+'</b><small>'+e(item.p.team||'NFL')+' · '+e(item.p.position||'—')+' · '+e(item.label)+'</small></div>'+safeSourceLink(item.entry.source_url,'Evidence')+'</div>').join('');
 let html='<div class="gameday-summary"><span class="gameday-chip">NFL Week '+e(week)+' · '+e(season)+'</span>';
 html+='<span class="gameday-chip '+(verified.length||ruledOut.length?'good':'warn')+'">'+(verified.length+ruledOut.length)+' official inactive / OUT reports</span>';
 if(thirdParty.length)html+='<span class="gameday-chip">'+thirdParty.length+' ESPN game inactives</span>';
 html+='</div>';
 if(verified.length)html+='<div class="gameday-subhead"><strong>Confirmed official gameday inactives</strong></div>'+rows(verified);
 if(ruledOut.length)html+='<div class="gameday-subhead"><strong>Ruled OUT before kickoff · Official NFL injury report</strong></div>'+rows(ruledOut);
 if(thirdParty.length)html+='<div class="gameday-subhead"><strong>ESPN-reported gameday inactives (not officially verified)</strong></div>'+rows(thirdParty);
 if(!verified.length&&!thirdParty.length&&!ruledOut.length)html+='<div class="gameday-warning">No roster player has a confirmed inactive or explicitly verified OUT designation in the currently available reports. <b>This does NOT certify the roster as active.</b></div>';
 html+='<p class="gameday-soft"><b>Strict rule:</b> Questionable, Doubtful, Sleeper injury labels, IR tags and being in your starting lineup never count as inactive. Those belong in Injury Watch. A confirmed inactive who is also starting is flagged for action.</p>';
 let timing=[];
 timing.push(officialCurrent?'Official submissions: '+reportAgeTime(officialInactiveEvidence.generated_at_utc):'Official submissions: pending');
 timing.push(espnCurrent?'ESPN event report: '+reportAgeTime(espnGamedayEvidence.as_of):'ESPN event report: pending');
 timing.push(currentNflSource?'NFL injury scrape: '+reportAgeTime(nflVerified.checked_at):'NFL injury scrape: unavailable or over two hours old');
 if(inactiveEvidenceError)timing.push(inactiveEvidenceError);
 html+='<p class="gameday-soft">'+e(timing.join(' · '))+'</p>';
 html+='<p class="gameday-soft"><a href="https://www.nfl.com/injuries/" target="_blank" rel="noopener noreferrer">Official NFL injury designations ↗</a> · <a href="https://www.nfl.com/news/" target="_blank" rel="noopener noreferrer">Team/league gameday releases ↗</a>. A refreshed webpage scrape is not necessarily a newly published team report.</p>';
 box.innerHTML=html;
}
let inactiveBusy=false;
async function refreshGamedayInactives(){
 if(inactiveBusy)return;inactiveBusy=true;
 const results=await Promise.allSettled(INACTIVE_FILES.map(fetchReport));
 const errors=[];
 for(let i=0;i<results.length;i++){
  const item=results[i];
  if(item.status==='fulfilled'){
   const x=item.value;
   if(!x||!Number.isInteger(Number(x.week))||!Number.isInteger(Number(x.season))){errors.push(INACTIVE_FILES[i]+' schema invalid');continue;}
   if(i===0)officialInactiveEvidence=x;else espnGamedayEvidence=x;
  }else errors.push(INACTIVE_FILES[i]+': '+String(item.reason?.message||item.reason));
 }
 inactiveEvidenceChecked=new Date();inactiveEvidenceError=errors.join('; ');
 inactiveBusy=false;renderGamedayInactives();
}

// Independent monitor status polling; never blocks injuries or FAAB.
async function refreshBackgroundMonitor(){
 const host=$('backgroundmonitor');if(!host)return;
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),10000);
 try{
  const res=await fetch('https://dirty-birds-monitor-git.tvega2924.workers.dev/health?ts='+Date.now(),{cache:'no-store',signal:ctrl.signal});
  const payload=await res.json();if(!res.ok||!payload||!Array.isArray(payload.checks))throw Error(payload?.message||payload?.error||'Monitor unavailable');
  const stamp=Date.parse(payload.checked_at||'');const age=Date.now()-stamp;
  const fresh=Number.isFinite(age)&&age>=0&&age<=420000;
  const formatTime=(d)=>Number.isFinite(Date.parse(d||''))?new Date(d).toLocaleString():'Unknown';
  const lines=payload.checks.map(c=>{
    const when=Date.parse(c.source_timestamp||'');
    const published=Number.isFinite(when)?' • Source age '+ageText(Math.max(0,Date.now()-when)):' • Source publication time unknown';
    return '<div class="source"><b>'+e(c.name.replaceAll('_',' '))+'</b><span>'+(c.ok?'Reachable':'ERROR')+published+(c.error?' • '+e(c.error):'')+'</span></div>';
  }).join('');
  host.innerHTML='<div class="note">'+(fresh?'SCHEDULED MONITOR ACTIVE':'MONITOR SNAPSHOT OLD')+' • Last stored run '+e(formatTime(payload.checked_at))+'</div>'+lines;
 }catch(err){host.textContent='Background monitor unavailable: '+String(err.message||err)+'; dashboard injury and Sleeper checks operate independently.'}
 finally{clearTimeout(timer)}
}
let ffoResearchStarted=false,ffoResearchCheckedAt=0;
function ffoResearchStart(force=false){
 if(document.hidden||(!force&&ffoResearchStarted&&Date.now()-ffoResearchCheckedAt<300000))return;
 ffoResearchStarted=true;ffoResearchCheckedAt=Date.now();
 refreshWaiverUsage();refreshSupplementaryResearch();refreshRosterActions();
}
for(const page of ['market','radar','scouting','availability'])document.querySelector('nav button[data-page="'+page+'"]')?.addEventListener('click',()=>ffoResearchStart());
setTimeout(()=>{if(!document.hidden)refreshBackgroundMonitor()},9000);
// All trade/waiver research loads on-demand when its navigation tab is opened.
setInterval(()=>{if(!document.hidden)ffoResearchStart(true)},900000);
setInterval(()=>{if(!document.hidden)refreshBackgroundMonitor()},60000);

$('refreshlive').onclick=()=>{refreshInjuryOnly();refreshLive()};
setInterval(()=>{if(!document.hidden){refreshInjuryOnly();refreshLive();}},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshInjuryOnly();if(!lastGoodSync||Date.now()-lastGoodSync.getTime()>60000)refreshLive();}});
/* 4.5 interactive private research desk. Browser-local settings, NO Sleeper writes. */
const TB45_KEY='dirtybirds:ffl:tradeblock:4.5';
const TB45_DEFAULT={mine:['8146','5859','4046'],targets:[],view:'sell',budget:'',needs:'ANY',shape:'STANDARD'};
let tb45State=(()=>{try{const x=JSON.parse(localStorage.getItem(TB45_KEY)||'null');if(x&&Array.isArray(x.mine)&&Array.isArray(x.targets))return {...TB45_DEFAULT,...x};}catch(err){}return {...TB45_DEFAULT};})();
let tb45Data={snap:null,names:null,ros:null,market:null,asOf:null,error:'Awaiting league and market reports'};
let tb45Loading=false,tb45CacheKey='',tb45CacheResults=[];
const TB45_FP_SOURCE='https://www.fantasypros.com/2026/10/fantasy-football-trade-value-chart-week-7-2026/';
const TB45_WALTER='https://walterpicks.beehiiv.com/p/week-7-trade-report';
const TB45_WALTER_BUYS=['Kyler Murray','Dak Prescott','Chase Brown','Saquon Barkley','Bucky Irving','Zay Flowers','Jalen Coker','A.J. Brown','Terrance Ferguson','Dalton Kincaid'];
const TB45_WALTER_SELLS=['C.J. Stroud','Justin Herbert','Quinshon Judkins','Ashton Jeanty','Jaylen Warren','Michael Wilson','Luther Burden III','Dallas Goedert'];
// Directly transcribed public FantasyPros Week 7 chart values (1QB redraft, Oct 2026).
// Dated second-opinion check; not live, not WalterPicks proprietary valuations.
const TB45_FP={
'Josh Allen':29.1,'Lamar Jackson':28.6,'Brock Purdy':24.7,'Drake Maye':24.5,'Jared Goff':12.8,'Caleb Williams':12,'Patrick Mahomes':10,'C.J. Stroud':3.6,'Dak Prescott':8,'Jayden Daniels':1,
'Jahmyr Gibbs':75.1,'Bijan Robinson':67.5,'Kenneth Walker III':60.9,'James Cook III':59.3,'Jonathan Taylor':52.3,'Derrick Henry':50.5,'Kyren Williams':48.9,'Christian McCaffrey':46.8,'Chuba Hubbard':41.6,'Jaylen Warren':40.8,'Saquon Barkley':33.1,'Ollie Gordon II':28.2,'Blake Corum':24.9,'Jordan Mason':23.3,'Omarion Hampton':20.8,'TreVeyon Henderson':18.9,'RJ Harvey':16.9,'J.K. Dobbins':16.6,'Zach Charbonnet':15.4,'Woody Marks':24.2,'Jonah Coleman':1.9,'Kaelon Black':1.4,
'Jaxon Smith-Njigba':57.1,'Puka Nacua':55.4,"Ja'Marr Chase":54,'Amon-Ra St. Brown':51.3,'Zay Flowers':41.3,'CeeDee Lamb':40.5,'Christian Watson':40.4,'Chris Olave':38.3,'Nico Collins':37.2,'Justin Jefferson':36.1,'Malik Nabers':33.8,'Tetairoa McMillan':32,'A.J. Brown':31.4,'Garrett Wilson':31,'George Pickens':29.9,'Tee Higgins':29.5,'Jameson Williams':29.2,'DeVonta Smith':26.2,'Emeka Egbuka':25.7,'Jaylen Waddle':22.9,'DK Metcalf':22.7,'Ladd McConkey':19.6,'Jakobi Meyers':17.6,'Marvin Harrison Jr.':16.4,'Khalil Shakir':15.6,'Keenan Allen':15.2,'Courtland Sutton':13.1,"Ja'Kobi Lane":11.6,'Antonio Williams':11.4,'Caleb Douglas':4.8,'Rashod Bateman':1.0
};
const tb45Norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const tb45Stamp=s=>{let t=Date.parse(s||'');return Number.isFinite(t)?new Date(t).toLocaleString():'Unknown';};
const tb45Currency=x=>Number.isFinite(Number(x))?'$'+Number(x).toFixed(0):'—';
function tb45Save(){try{localStorage.setItem(TB45_KEY,JSON.stringify(tb45State));}catch(err){}tb45CacheKey='';renderTradeScouting();}
async function tb45Refresh(){
 if(tb45Loading)return;tb45Loading=true;
 try{const sources=['fast_latest.json','player_names.json','market_values.json'];
  const settled=await Promise.allSettled(sources.map(fetchReport));
  if(settled.some(x=>x.status!=='fulfilled'))throw Error(sources.filter((_,i)=>settled[i].status!=='fulfilled').join(', ')+' unavailable');
  const [snap,names,market]=settled.map(x=>x.value);
  if(!Array.isArray(snap.rosters)||!snap.rosters.length||!names||!market.players)throw Error('Incomplete Sleeper, projection or trade value schema');
  tb45Data={snap,names,ros:pfo50TradeRos(),market,error:null,asOf:new Date().toISOString()};tb45CacheKey='';
  tb45State.targets=tb45State.targets.filter(pid=>!isTradeExcludedOpponent((snap.rosters||[]).find(r=>(r.players||[]).map(String).includes(String(pid)))?.roster_id));
  tb48Sanitize();
  try{localStorage.setItem(TB45_KEY,JSON.stringify(tb45State));}catch(_){}
 }catch(err){tb45Data.error=String(err.message||err);}
 finally{tb45Loading=false;renderTradeScouting();}
}
function tb45Player(pid){const x=tb45Data.names?.[String(pid)]||{};return {id:String(pid),name:x.name||String(pid),pos:x.position||'',team:x.team||''};}
function tb45RosterPlayers(rid){return (tb45Data.snap?.rosters||[]).find(r=>Number(r.roster_id)===Number(rid))?.players?.map(String)||[];}
function tb45Manager(rid){const r=(tb45Data.snap?.rosters||[]).find(r=>Number(r.roster_id)===Number(rid));const u=(tb45Data.snap?.users||[]).find(u=>String(u.user_id)===String(r?.owner_id))||{};return u.metadata?.team_name||u.display_name||'Roster '+rid;}
function tb45Owner(pid){return (tb45Data.snap?.rosters||[]).find(r=>(r.players||[]).map(String).includes(String(pid)))?.roster_id||null;}
function tb45PPG(pid){const row=pfo50StatsFor(pid)||pfo50Indexed.get(pfo50Key(tb45Player(pid).name,tb45Player(pid).team));return row?.forecast?pfo50Score(row.forecast):null;}
function tb45Val(pid){const v=tb45Data.market?.players?.[String(pid)]?.value;return Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;}
function tb45FP(pid){let n=tb45Player(pid).name;return TB45_FP[n]??TB45_FP[""+n.replace(/ II$/,'') ]??null;}
function tb45CoreLineup(ids){
 const players=ids.map(pid=>({...tb45Player(pid),ppg:tb45PPG(pid)})).filter(x=>x.ppg!=null),pos={QB:1,RB:2,WR:2,TE:1,K:1,DEF:1};
 let selected=[],used=new Set();
 for(const [key,num] of Object.entries(pos)){
  const group=players.filter(x=>x.pos===key&&!used.has(x.id)).sort((a,b)=>b.ppg-a.ppg).slice(0,num);
  if(group.length!==num)return null;
  for(const x of group){selected.push(x);used.add(x.id);}
 }
 const flex=players.filter(x=>['RB','WR','TE'].includes(x.pos)&&!used.has(x.id)).sort((a,b)=>b.ppg-a.ppg).slice(0,2);
 if(flex.length!==2)return null;
 selected.push(...flex);return {total:selected.reduce((s,x)=>s+x.ppg,0),starters:selected};
}
function tb45Fit(ids,old,maxExtra,protectedIds){
 if(maxExtra<=0){const l=tb45CoreLineup(ids);return l?{total:l.total,cut:[]}:null;}
 if(maxExtra>2)return null; // 3-for-1 and 1-for-3 require at most two extra cuts
 const opts=old.filter(pid=>ids.includes(pid)&&!protectedIds.includes(pid)&&['RB','WR','TE','QB'].includes(tb45Player(pid).pos));
 // A roster needs exactly maxExtra cuts to remain within its previous player limit.
 const cutSets=maxExtra===1?opts.map(pid=>[pid]):opts.flatMap((pid,i)=>opts.slice(i+1).map(q=>[pid,q]));
 let best=null;
 for(const cut of cutSets){const reject=new Set(cut);const l=tb45CoreLineup(ids.filter(x=>!reject.has(x)));if(l&&(!best||l.total>best.total))best={total:l.total,cut};}
 return best;
}
function tb45Market(ids){let s=0;for(const pid of ids){const n=tb45Val(pid);if(n==null)return null;s+=n;}return s;}
function tb45Expert(ids){let s=0;for(const pid of ids){const n=tb45FP(pid);if(n==null)return null;s+=n;}return s;}
function tb46Depth(ids){
 const counts={QB:0,RB:0,WR:0,TE:0},bypos={QB:[],RB:[],WR:[],TE:[]};
 const starterIds=new Set((tb45CoreLineup(ids)?.starters||[]).map(x=>x.id));
 for(const pid of ids){const p=tb45Player(pid),v=tb45PPG(pid);if(bypos[p.pos]&&v!=null){counts[p.pos]++;if(!starterIds.has(String(pid)))bypos[p.pos].push(v);}}
 // Bench production is descriptive: sum of the three highest projected nonstarters per position.
 const bench={};for(const pos of Object.keys(bypos)){bypos[pos].sort((a,b)=>b-a);bench[pos]=bypos[pos].slice(0,3).reduce((a,b)=>a+b,0);}
 return{counts,bench};
}
function tb46Audit(give,take,ourOld,ourNew,themOld,themNew,us,them,ratio,fp,injuries,ourCut,theirCut){
 const now=Date.now(),marketAge=(now-Date.parse(tb45Data.market?.as_of||''))/86400000,projAge=(now-Date.parse(tb45Data.ros?.as_of||''))/86400000;
 const marketRecent=Number.isFinite(marketAge)&&marketAge<=3,projRecent=Number.isFinite(projAge)&&projAge<=3;
 const priced=fp!=null,disagree=priced&&Math.abs(fp-ratio)>.22;
 const concentrate=(give.length!==take.length),twoCuts=((ourCut||[]).length===2||(theirCut||[]).length===2);
 const ourBefore=tb46Depth(ourOld),ourAfter=tb46Depth(ourNew),theirBefore=tb46Depth(themOld),theirAfter=tb46Depth(themNew);
 const ourDepthDelta=+(Object.values(ourAfter.bench).reduce((a,b)=>a+b,0)-Object.values(ourBefore.bench).reduce((a,b)=>a+b,0)).toFixed(2);
 const theirDepthDelta=+(Object.values(theirAfter.bench).reduce((a,b)=>a+b,0)-Object.values(theirBefore.bench).reduce((a,b)=>a+b,0)).toFixed(2);
 const risks=[];
 if(disagree)risks.push('Independent valuation sources disagree materially');
 if(!priced)risks.push('FantasyPros does not cover every player in this package');
 if(!marketRecent||!projRecent)risks.push('One or more research inputs are over 72 hours old');
 if(ourDepthDelta<-.5)risks.push('Our projected bench production decreases');
 if(theirDepthDelta<-.5)risks.push('Opponent loses bench insurance');
 if(concentrate)risks.push('Unequal package size: replacement and consolidation premiums are not fully priced');
 if(twoCuts)risks.push('Requires two extra player cuts on receiving side');
 if(injuries.length)risks.push('Players have provider health designations requiring official checks');
 if(us<1.5)risks.push('Projected immediate starter gain is marginal');
 if(them<.5)risks.push('Little demonstrated benefit to opposing manager');
 const fpGap=priced?+(100*(fp-1)).toFixed(1):null;
 const marketGap=+(100*(ratio-1)).toFixed(1);
 const grade=(us>=1.5&&them>=.5&&ratio>=.85&&ratio<=1.12&&marketRecent&&projRecent&&!disagree&&injuries.length===0&&ourDepthDelta>=-1&&(!concentrate||us>=2))?'B (promising research)':(us>=.5&&them>=0&&ratio>=.75&&ratio<=1.18)?'C (needs negotiation)':'D (high caution)';
 return{ourBefore,ourAfter,theirBefore,theirAfter,ourDepthDelta,theirDepthDelta,grade,marketGap,fpGap,risks,marketRecent,projRecent,concentrate};
}
function tb46Combos(values,size,limit){
 if(size===1)return values.slice(0,limit).map(x=>[x]);
 const result=[];let count=0;
 function recurse(at,arr){if(arr.length===size){result.push(arr.slice());return;}for(let i=at;i<values.length;i++){arr.push(values[i]);recurse(i+1,arr);arr.pop();if(result.length>=limit)return;}}
 recurse(0,[]);return result;
}
function tb46Shapes(){const v=tb45State.shape||'STANDARD';if(v==='STANDARD')return [[1,1],[1,2],[2,1],[2,2]];if(v==='ALL')return [[1,1],[1,2],[2,1],[2,2],[3,1],[3,2],[3,3]];const p=v.split('x').map(Number);return [p];}
function tb45DoDeal(give,take,otherId,origin){
 const ourIds=tb45RosterPlayers(1),themIds=tb45RosterPlayers(otherId);
 const originalMine=tb45CoreLineup(ourIds),originalTheirs=tb45CoreLineup(themIds);
 if(!originalMine||!originalTheirs)return null;
 const newOurs=ourIds.filter(x=>!give.includes(x)).concat(take);
 const newTheirs=themIds.filter(x=>!take.includes(x)).concat(give);
 const ours=tb45Fit(newOurs,ourIds,Math.max(0,take.length-give.length),tb45State.mine);
 const theirs=tb45Fit(newTheirs,themIds,Math.max(0,give.length-take.length),[]);
 if(!ours||!theirs)return null;
 const pv=tb45Market(give),rv=tb45Market(take);
 if(pv==null||rv==null||rv===0)return null;
 const ratio=pv/rv;
 if(ratio<.68||ratio>1.24)return null;
 const us=+(ours.total-originalMine.total).toFixed(2),them=+(theirs.total-originalTheirs.total).toFixed(2);
 if(us<.25||them<-.05)return null;
 const paidFP=tb45Expert(give),recFP=tb45Expert(take),fp=paidFP!=null&&recFP>0?+(paidFP/recFP).toFixed(2):null;
 const injuries=[...give,...take].filter(pid=>['IR','OUT','PUP','DOUBTFUL'].includes(String((tb45Data.names?.[pid]||{}).injury_status||'').toUpperCase())).map(pid=>tb45Player(pid).name);
 const walterBuy=take.some(pid=>TB45_WALTER_BUYS.some(n=>tb45Norm(n)===tb45Norm(tb45Player(pid).name)));
 const ourCut=Array.isArray(ours.cut)?ours.cut:ours.cut?[ours.cut]:[],theirCut=Array.isArray(theirs.cut)?theirs.cut:theirs.cut?[theirs.cut]:[];
 const audit=tb46Audit(give,take,ourIds,newOurs.filter(pid=>!ourCut.includes(pid)),themIds,newTheirs.filter(pid=>!theirCut.includes(pid)),us,them,ratio,fp,injuries,ourCut,theirCut);
 const confirmed=us>=1.5&&them>=.5&&ratio>=.85&&ratio<=1.12&&(!audit.concentrate||us>=2)&&audit.marketRecent&&audit.projRecent&&audit.ourDepthDelta>=-1&&!audit.risks.some(x=>x.includes('disagree materially'))&&injuries.length===0;
 // A positive projection alone does not imply a fair offer or manager willingness.
 const score=us+Math.min(3,them)*.6+(walterBuy?.2:0)-2.5*Math.abs(1-ratio)-(fp!=null?Math.abs(1-fp):.1)-give.length*.12-take.length*.12;
 return{give,take,otherId,origin,us,them,ratio,fp,cutO:ourCut,cutT:theirCut,injuries,confirmed,score,walterBuy,audit};
}
function tb45Results(){
 const d=tb45Data;if(!d.snap||!pfo50Independent||!d.market)return [];
 const shapes=tb46Shapes();const key=JSON.stringify([tb45State.mine,tb45State.targets,tb45State.view,tb45State.needs,tb45State.shape,d.snap.fetched_at_utc,d.market.as_of,d.ros.as_of]);
 if(key===tb45CacheKey)return tb45CacheResults;
 const deals=[],seenRaw=new Set();let examined=0,priceFiltered=0,compared=0;
 const mine=tb45RosterPlayers(1);
 const hasValue=pid=>tb45Val(pid)!=null&&tb45PPG(pid)!=null&&['QB','RB','WR','TE'].includes(tb45Player(pid).pos);
 const marketMemo=new Map();const valueOf=ids=>{const k=ids.slice().sort().join(',');if(marketMemo.has(k))return marketMemo.get(k);const v=tb45Market(ids);marketMemo.set(k,v);return v;};
 const offer=(give,take,opponent,origin)=>{
  if(isTradeExcludedOpponent(opponent,tb45Manager(opponent)))return;
  examined++;
  if(tb45State.needs!=='ANY'&&!take.some(pid=>tb45Player(pid).pos===tb45State.needs))return;
  const paid=valueOf(give),received=valueOf(take);
  if(!paid||!received||paid/received<.68||paid/received>1.24)return;
  priceFiltered++;
  const signature=opponent+'|'+give.slice().sort().join(',')+'|'+take.slice().sort().join(',');if(seenRaw.has(signature))return;seenRaw.add(signature);
  const result=tb45DoDeal(give,take,opponent,origin);compared++;
  if(result)deals.push(result);
 };
 if(tb45State.view==='sell'){
  const extras=mine.filter(pid=>!tb45State.mine.includes(pid)&&hasValue(pid)).sort((a,b)=>tb45Val(a)-tb45Val(b)).slice(0,10);
  const ownedBlock=tb45State.mine.filter(pid=>mine.includes(pid)&&hasValue(pid));
  for(const primary of ownedBlock){
   for(const r of d.snap.rosters.filter(r=>Number(r.roster_id)!==1&&!isTradeExcludedOpponent(r.roster_id,tb45Manager(r.roster_id)))){
    const targets=(r.players||[]).map(String).filter(hasValue).sort((a,b)=>tb45PPG(b)-tb45PPG(a)).slice(0,13);
    for(const [giveN,takeN] of shapes){
     const myExtras=giveN===1?[[primary]]:tb46Combos(extras,giveN-1,100).map(x=>[primary,...x]);
     const givens=giveN===1?[[primary]]:myExtras;
     const takes=tb46Combos(targets,takeN,250);
     let shapeChecks=0;
     for(const give of givens){for(const take of takes){offer(give,take,r.roster_id,'sell');if(++shapeChecks>=3500)break;}if(shapeChecks>=3500)break;}
    }
   }
  }
 }else{
  const myPool=mine.filter(hasValue).sort((a,b)=>tb45Val(b)-tb45Val(a)).slice(0,15);
  for(const target of tb45State.targets.filter(pid=>tb45Owner(pid)&&Number(tb45Owner(pid))!==1&&!isTradeExcludedOpponent(tb45Owner(pid),tb45Manager(tb45Owner(pid)))&&hasValue(pid))){
   const owner=tb45Owner(target);
   const extras=tb45RosterPlayers(owner).filter(pid=>pid!==target&&hasValue(pid)).sort((a,b)=>tb45Val(a)-tb45Val(b)).slice(0,12);
   for(const [giveN,takeN] of shapes){
    const givens=tb46Combos(myPool,giveN,260);
    const takes=takeN===1?[[target]]:tb46Combos(extras,takeN-1,130).map(x=>[target,...x]);
    let shapeChecks=0;
    for(const give of givens){for(const take of takes){offer(give,take,owner,'buy');if(++shapeChecks>=4500)break;}if(shapeChecks>=4500)break;}
   }
  }
 }
 deals.sort((a,b)=>(b.confirmed?1:0)-(a.confirmed?1:0)||b.score-a.score);
 const seen=new Set(),teamCount={};let result=[];
 for(const x of deals){const k=x.otherId+'|'+x.take.slice().sort().join(',')+'|'+x.give.length+'x'+x.take.length;if(seen.has(k)||(teamCount[x.otherId]||0)>=5)continue;
  seen.add(k);teamCount[x.otherId]=(teamCount[x.otherId]||0)+1;result.push(x);if(result.length>=25)break;}
 tb45CacheKey=key;tb45CacheResults=result;tb45CacheResults.tests=examined;tb45CacheResults.priceMatched=priceFiltered;tb45CacheResults.evaluated=compared;tb45CacheResults.passed=deals.length;return result;
}
function tb45ViewOnlyRosterHTML(){
 const roster=(tb45Data.snap?.rosters||[]).find(r=>Number(r.roster_id)===TRADE_VIEW_ONLY_ROSTER_ID);
 if(!roster)return '<details class="market-disclosure"><summary>BigOlBoyle · view-only roster</summary><p class="market-small">Awaiting league roster sync.</p></details>';
 const groups={};for(const pid of (roster.players||[])){const p=tb45Player(pid);const pos=p.pos||'OTHER';(groups[pos]??=[]).push(p.name);}
 const html=Object.entries(groups).map(([pos,players])=>'<div class="brief-row"><b>'+e(pos)+' · '+e(players.length)+'</b><small>'+e(players.sort().join(' · '))+'</small></div>').join('');
 return '<details class="market-disclosure"><summary>BigOlBoyle · roster intelligence only (no trades)</summary><p class="market-small">Sleeper roster #3 · '+e(tb45Stamp(tb45Data.snap?.fetched_at_utc))+'. All players remain visible here, but Boyle is excluded from trade block selections, package generation, research results, and copied offers.</p>'+html+'</details>';
}

/* 4.8 manual 2-sided valuation. This intentionally shows ALL manually specified trades,
   including bad or incomplete ones; the older automatic screen remains selective. */
function tb48State(){
 if(!tb45State.compare||typeof tb45State.compare!=='object')tb45State.compare={opponent:'',give:[],take:[]};
 const x=tb45State.compare;
 x.opponent=String(x.opponent||'');
 if(!Array.isArray(x.give))x.give=[];
 if(!Array.isArray(x.take))x.take=[];
 x.give=[...new Set(x.give.map(String))].slice(0,3);
 x.take=[...new Set(x.take.map(String))].slice(0,3);
 return x;
}
function tb48Sanitize(){
 const x=tb48State(),snap=tb45Data.snap;
 if(!snap)return;
 if(!snap.rosters.some(r=>String(r.roster_id)===x.opponent&&Number(r.roster_id)!==1&&!isTradeExcludedOpponent(r.roster_id,tb45Manager(r.roster_id)))){x.opponent='';x.take=[];}
 const ourSet=new Set(tb45RosterPlayers(1));x.give=x.give.filter(id=>ourSet.has(id));
 if(x.opponent){const theirSet=new Set(tb45RosterPlayers(x.opponent));x.take=x.take.filter(id=>theirSet.has(id));}
}
function tb48Sum(ids,getter){if(!ids.length)return null;const nums=ids.map(getter);return nums.every(v=>v!=null&&Number.isFinite(Number(v)))?nums.reduce((a,v)=>a+Number(v),0):null;}
const tb48Num=(x,precision=1)=>x==null?'Not verified':Number(x).toFixed(precision);
const tb48Signed=(x,precision=1)=>x==null?'Not computable':(x>0?'+':'')+Number(x).toFixed(precision);
function tb48Deal(){
 tb48Sanitize();const x=tb48State();
 if(!tb45Data.snap||!pfo50Independent||!x.opponent||!x.give.length||!x.take.length)return null;
 if(isTradeExcludedOpponent(x.opponent,tb45Manager(x.opponent)))return null;
 const give=x.give,take=x.take,ourOld=tb45RosterPlayers(1),theirOld=tb45RosterPlayers(x.opponent);
 if(!give.every(id=>ourOld.includes(id))||!take.every(id=>theirOld.includes(id)))return null;
 const sell=tb48Sum(give,tb45Val),buy=tb48Sum(take,tb45Val);
 const fpSell=tb48Sum(give,tb45FP),fpBuy=tb48Sum(take,tb45FP);
 const rosSell=tb48Sum(give,tb45PPG),rosBuy=tb48Sum(take,tb45PPG);
 const ourNew=ourOld.filter(id=>!give.includes(id)).concat(take);
 const theirNew=theirOld.filter(id=>!take.includes(id)).concat(give);
 const oursBefore=tb45CoreLineup(ourOld),theirsBefore=tb45CoreLineup(theirOld);
 const oursAfter=tb45Fit(ourNew,ourOld,Math.max(0,take.length-give.length),[]);
 const theirsAfter=tb45Fit(theirNew,theirOld,Math.max(0,give.length-take.length),[]);
 const ourCut=oursAfter?.cut||[],theirCut=theirsAfter?.cut||[];
 const ourDelta=oursBefore&&oursAfter?+(oursAfter.total-oursBefore.total).toFixed(2):null;
 const theirDelta=theirsBefore&&theirsAfter?+(theirsAfter.total-theirsBefore.total).toFixed(2):null;
 const ourFinal=ourNew.filter(id=>!ourCut.includes(id)),theirFinal=theirNew.filter(id=>!theirCut.includes(id));
 const ourDepthOld=tb46Depth(ourOld),ourDepthNew=tb46Depth(ourFinal),theirDepthOld=tb46Depth(theirOld),theirDepthNew=tb46Depth(theirFinal);
 const benchDelta=(a,b)=>+(Object.values(b.bench).reduce((s,n)=>s+n,0)-Object.values(a.bench).reduce((s,n)=>s+n,0)).toFixed(2);
 const injuryFlags=[...give,...take].filter(id=>{const t=String(tb45Data.names?.[id]?.injury_status||'').toUpperCase();return ['IR','OUT','PUP','DOUBTFUL','QUESTIONABLE'].includes(t);}).map(id=>tb45Player(id).name+' ('+tb45Data.names[id].injury_status+')');
 const now=Date.now(),age=t=>{const a=Date.parse(t||'');return Number.isFinite(a)?(now-a)/86400000:null;};
 const marketAge=age(tb45Data.market?.as_of),rosAge=age(tb45Data.ros?.as_of),sleeperAge=age(tb45Data.snap?.fetched_at_utc);
 const gap=sell!=null&&buy!=null?buy-sell:null;
 const ratio=sell!=null&&buy>0?sell/buy:null;
 const percent=sell!=null&&buy!=null&&sell+buy>0?100*(buy-sell)/((buy+sell)/2):null;
 return{x,give,take,ourOld,theirOld,ourFinal,theirFinal,sell,buy,fpSell,fpBuy,rosSell,rosBuy,ourDelta,theirDelta,ourCut,theirCut,ourDepthOld,ourDepthNew,theirDepthOld,theirDepthNew,ourBenchDelta:benchDelta(ourDepthOld,ourDepthNew),theirBenchDelta:benchDelta(theirDepthOld,theirDepthNew),injuryFlags,marketAge,rosAge,sleeperAge,gap,ratio,percent};
}
function tb48Chips(ids,side){return ids.length?ids.map(id=>'<span class="tb-chip '+(side==='take'?'bought':'')+'">'+e(tb45Player(id).name)+' <button type="button" title="Remove '+e(tb45Player(id).name)+'" aria-label="Remove '+e(tb45Player(id).name)+'" data-tb48-remove="'+side+'" data-player="'+e(id)+'">×</button></span>').join(''):'<span class="tb48-status">Select up to 3 players.</span>';}
function tb48Figure(value,unit='',signed=false){return value==null?'Not computable':(signed?tb48Signed(value,2):tb48Num(value,2))+unit;}
function tb48TeamHTML(name,giving,getting,giveValue,getValue,delta,bench,cuts,market,sideName){
 let out='<div class="tb48-team"><h4>'+e(name)+'</h4>';
 out+='<div class="tb48-row"><small>Giving</small>'+e(giving.map(id=>tb45Player(id).name).join(' + '))+'</div>';
 out+='<div class="tb48-row"><small>Receiving</small>'+e(getting.map(id=>tb45Player(id).name).join(' + '))+'</div>';
 out+='<div class="tb48-row"><small>Market value sent → received (reference units)</small><b>'+ (giveValue==null?'—':e(tb48Num(giveValue,0)))+' → '+(getValue==null?'—':e(tb48Num(getValue,0)))+'</b></div>';
 out+='<div class="tb48-row"><small>Market-value net for '+e(sideName)+'</small><b class="'+(market==null?'':market>0?'tb48-gain':market<0?'tb48-loss':'')+'">'+(market==null?'Not verified':e(Math.abs(market).toFixed(0))+' reference units '+(market>0?'received above what is sent':market<0?'sent above what is received':'evenly exchanged'))+'</b></div>';
 out+='<div class="tb48-row"><small>Modeled starting-lineup change</small><b class="'+(delta==null?'':delta>0?'tb48-gain':delta<0?'tb48-loss':'')+'">'+(delta==null?'Not computable':e(Math.abs(delta).toFixed(2))+' projected starter PPG '+(delta>0?'gained':delta<0?'lost':'unchanged'))+'</b></div>';
 out+='<div class="tb48-row"><small>Projected bench depth proxy change</small>'+(delta==null?'Not computable':e(Math.abs(bench).toFixed(2))+' projected depth PPG '+(bench>0?'gained':bench<0?'lost':'unchanged'))+'</div>';
 if(cuts.length)out+='<div class="tb48-row"><small>Modeled additional roster cut(s), NOT executed</small>'+e(cuts.map(id=>tb45Player(id).name).join(' + '))+'</div>';
 return out+'</div>';
}
function tb48ReportHTML(z){
 const validMarket=z.sell!=null&&z.buy!=null;
 let headline='Unverified market comparison',detail='One or more players lack a usable current trade-value reference. We cannot claim a complete valuation.';
 if(validMarket){if(Math.abs(z.percent)<=10){headline='Similar listed market value';detail='The two package totals are within 10% on one full-PPR public market scale. This does not establish acceptance or equal FFL value.';}
  else if(z.gap>0){headline='Dirty Birds receives higher listed value';detail='The incoming package carries more full-PPR market units than what we send. That makes it favorable to us on price, but less attractive to the opposing manager.';}
  else{headline='Dirty Birds pays a listed market premium';detail='We send more full-PPR market units than we receive. The extra price needs a clear lineup, scarcity, upside, or playoff justification.';}}
 let h='<div class="tb48-eval-report" aria-live="polite"><div class="block-header"><strong>Two-sided package valuation</strong><span class="roster-label forecast">'+e(z.give.length)+' FOR '+e(z.take.length)+'</span></div>';
 h+='<div class="tb48-assess"><b>'+e(headline)+'</b><div>'+e(detail)+'</div>'+ (z.percent!=null?'<div>Package value difference: <b>'+e(Math.abs(z.percent).toFixed(1))+'%</b>. '+(z.percent>0?'Dirty Birds receives more listed reference value.':z.percent<0?'Dirty Birds sends more listed reference value.':'Both packages are even on the published market scale.')+'</div>':'')+'</div>';
 h+='<details class="pfo49-disclose" open><summary>Player-by-player production and FFL projections</summary><p class="pfo49-small">Game statistics are NFLverse data; reference valuations are third-party and do not establish next-week performance.</p>'+[...z.give,...z.take].map(id=>'<div class="pfo49-waiver"><b>'+e(tb45Player(id).name)+'</b> · '+e(z.give.includes(id)?'Dirty Birds sends':'Dirty Birds receives')+pfo50StatsStrip(id)+'</div>').join('')+'</details>';
 h+='<div class="tb48-panel">'+tb48TeamHTML('Dirty Birds',z.give,z.take,z.sell,z.buy,z.ourDelta,z.ourBenchDelta,z.ourCut,z.gap,'Dirty Birds')+tb48TeamHTML(tb45Manager(z.x.opponent),z.take,z.give,z.buy,z.sell,z.theirDelta,z.theirBenchDelta,z.theirCut,z.gap==null?null:-z.gap,'opponent')+'</div>';
 const problems=[];
 if(z.sell==null||z.buy==null)problems.push('Market values missing for one or more players; totals are not partially filled.');
 if(z.rosSell==null||z.rosBuy==null)problems.push('Half-PPR ROS projections missing for one or more assets; package ROS totals withheld.');
 if(z.ourDelta==null||z.theirDelta==null)problems.push('One or both starting lineups cannot be fully modeled from available projections or valid roster-cut combinations.');
 if(z.marketAge==null||z.marketAge>3)problems.push('Market quote source is undated or more than 72 hours old.');
 if(z.rosAge==null||z.rosAge>3)problems.push('ROS projection source is undated or more than 72 hours old.');
 if(z.sleeperAge==null||z.sleeperAge>1)problems.push('Sleeper roster snapshot is over 24 hours old / timestamp missing.');
 if(z.injuryFlags.length)problems.push('Sleeper health tags need official verification: '+z.injuryFlags.join(', ')+'.');
 if(z.fpSell==null||z.fpBuy==null)problems.push('Dated FantasyPros Week 7 comparison cannot price every player; no partial totals substituted.');
 if(z.ourCut.length||z.theirCut.length)problems.push('Unequal player count requires hypothetical roster cuts; cuts are optimization assumptions, NOT roster actions.');
 h+='<div class="tb48-issues"><b>Package ROS projections (half-PPR):</b> outgoing '+(z.rosSell==null?'unavailable':e(tb48Num(z.rosSell))+' PPG')+' / incoming '+(z.rosBuy==null?'unavailable':e(tb48Num(z.rosBuy))+' PPG')+'. These are sums, not lineup gains.<br>';
 h+='<b>Independent dated second check:</b> FantasyPros outgoing '+(z.fpSell==null?'unavailable':e(tb48Num(z.fpSell)))+' / incoming '+(z.fpBuy==null?'unavailable':e(tb48Num(z.fpBuy)))+' (Week 7, not a live valuation).<br>';
 h+='<b>Market ratio:</b> '+(z.ratio==null?'unavailable':e(tb48Num(z.ratio,2))+'× paid / received')+'.</div>';
 h+='<details><summary>Player-by-player values and full roster effect</summary><table class="tb-player-table"><thead><tr><th>Side</th><th>Player</th><th>ROS PPG</th><th>Market</th><th>FP W7</th></tr></thead><tbody>';
 for(const [label,ids] of [['Give',z.give],['Get',z.take]])for(const id of ids){const p=tb45Player(id),ppg=tb45PPG(id),market=tb45Val(id),fp=tb45FP(id);h+='<tr><td>'+e(label)+'</td><td>'+e(p.name)+' · '+e(p.pos)+'</td><td>'+(ppg==null?'—':e(tb48Num(ppg,2)))+'</td><td>'+(market==null?'—':e(tb48Num(market,0)))+'</td><td>'+(fp==null?'—':e(tb48Num(fp,1)))+'</td></tr>';}
 h+='</tbody></table><p class="tb48-step">Position counts after projected swap (including any hypothetical cuts):</p><div class="tb48-panel">';
 const lines=(before,after)=>['QB','RB','WR','TE'].map(pos=>pos+': '+before.counts[pos]+' → '+after.counts[pos]).join(' · ');
 h+='<div class="tb48-team">Dirty Birds<br>'+e(lines(z.ourDepthOld,z.ourDepthNew))+'</div><div class="tb48-team">'+e(tb45Manager(z.x.opponent))+'<br>'+e(lines(z.theirDepthOld,z.theirDepthNew))+'</div></div></details>';
 h+='<details><summary>Verification limits and source dates</summary><div class="tb48-issues">';
 h+='<b>Sleeper ownership:</b> '+e(tb45Stamp(tb45Data.snap?.fetched_at_utc))+' · <b>Market:</b> '+e(tb45Stamp(tb45Data.market?.as_of))+' · <b>ROS projections:</b> '+e(tb45Stamp(tb45Data.ros?.as_of))+'.<br>';
 h+='Market source is a <b>12-team full-PPR reference</b>; the league uses half-PPR. ROS values are forecast estimates rather than historical results or guaranteed output. The model evaluates starting-lineup fit using projected optimal positions; this does not predict weekly lineup or coach decisions. No acceptance probability is claimed.<br>';
 h+=(problems.length?problems.map(x=>'<div>• '+e(x)+'</div>').join(''):'No source/factor gaps detected by these automated checks; independent role, injuries, schedule and manager intentions still require research.');
 h+='</div><a class="tb-source" href="'+TB45_FP_SOURCE+'" target="_blank" rel="noopener">FantasyPros dated chart</a></details>';
 h+='<button type="button" class="tb48-action" data-tb48-copy>Copy valuation report</button><span class="tb48-status">Private research only. No transaction is sent to Sleeper.</span></div>';
 return h;
}
function tb48FeatureHTML(){
 tb48Sanitize();const x=tb48State(),d=tb45Data;
 let h='<div class="tb48-eval" id="tb48-eval"><div class="block-header"><h3>Build-a-Trade · Two-Sided Valuation</h3><span class="roster-label forecast">5.0</span></div>';
 h+='<div class="tb48-step">Choose your players, a trading partner, and their players. Compare value <b>for both teams</b> automatically. Any proposed deal can be evaluated, even if our automatic trade scanner would reject it. Up to 3 players on either side.</div>';
 if(d.error)h+='<div class="tb48-status">Data status: '+e(d.error)+'. Current valuations may be unavailable.</div>';
 const eligible=(d.snap?.rosters||[]).filter(r=>Number(r.roster_id)!==1&&!isTradeExcludedOpponent(r.roster_id,tb45Manager(r.roster_id)));
 h+='<div class="tb48-forms"><div class="tb48-wide"><label for="tb48-opponent">1 · Opposing team</label><select id="tb48-opponent"><option value="">Choose a team…</option>'+eligible.map(r=>'<option value="'+e(r.roster_id)+'" '+(x.opponent===String(r.roster_id)?'selected':'')+'>'+e(tb45Manager(r.roster_id))+' · roster '+e(r.roster_id)+'</option>').join('')+'</select></div>';
 const ours=tb45RosterPlayers(1).filter(id=>!x.give.includes(id)).map(tb45Player).filter(p=>['QB','RB','WR','TE','K','DEF'].includes(p.pos)).sort((a,b)=>a.name.localeCompare(b.name));
 const theirs=(x.opponent?tb45RosterPlayers(x.opponent):[]).filter(id=>!x.take.includes(id)).map(tb45Player).filter(p=>['QB','RB','WR','TE','K','DEF'].includes(p.pos)).sort((a,b)=>a.name.localeCompare(b.name));
 h+='<div><label for="tb48-add-give">2 · Dirty Birds GIVE ('+e(x.give.length)+'/3)</label><select id="tb48-add-give" '+(x.give.length>=3||!d.snap?'disabled':'')+'>'+tb45SelectOptions(ours,'Select outgoing player…')+'</select><div class="tb48-picked">'+tb48Chips(x.give,'give')+'</div></div>';
 h+='<div><label for="tb48-add-take">3 · Dirty Birds RECEIVE ('+e(x.take.length)+'/3)</label><select id="tb48-add-take" '+(!x.opponent||x.take.length>=3||!d.snap?'disabled':'')+'>'+tb45SelectOptions(theirs,x.opponent?'Select incoming player…':'Select opponent first…')+'</select><div class="tb48-picked">'+tb48Chips(x.take,'take')+'</div></div></div>';
 h+='<div class="tb48-status">Players and teams are restricted to currently reported Sleeper ownership. BigOlBoyle is excluded from negotiating but remains in roster-only intelligence. The evaluator never sends trades.</div>';
 if(d.snap&&d.ros){const res=tb48Deal();h+=res?tb48ReportHTML(res):'<div class="tb48-status">Add at least one player on each side and choose a partner to see the valuation. There is no acceptance/quality gate on manual comparisons.</div>';}
 else h+='<div class="tb48-status">Awaiting all three verified data inputs: Sleeper roster, dated market values and ROS projections.</div>';
 h+='<button type="button" data-tb48-clear>Clear this proposal</button></div>';
 return h;
}
function tb48CopyReport(){const z=tb48Deal();if(!z)return;
 const fmt=ids=>ids.map(id=>tb45Player(id).name).join(' + ');
 const val=x=>x==null?'unverified':tb48Num(x,2);
 const txt='DIRTY BIRDS · UNSENT TRADE VALUATION\nPartner: '+tb45Manager(z.x.opponent)+'\nWe give: '+fmt(z.give)+'\nWe receive: '+fmt(z.take)+'\nMarket units: send '+val(z.sell)+'; receive '+val(z.buy)+'; Dirty Birds net '+val(z.gap)+'; Opponent net '+val(z.gap==null?null:-z.gap)+'\nDirty Birds projected starting-lineup change: '+val(z.ourDelta)+' PPG\nOpponent projected starting-lineup change: '+val(z.theirDelta)+' PPG\nPotential Dirty Birds cuts: '+(z.ourCut.map(id=>tb45Player(id).name).join(', ')||'none modeled')+'\nPotential opponent cuts: '+(z.theirCut.map(id=>tb45Player(id).name).join(', ')||'none modeled')+'\nAs of: Sleeper '+tb45Stamp(tb45Data.snap?.fetched_at_utc)+'; TheTradeCalc '+tb45Stamp(tb45Data.market?.as_of)+'; ROS '+tb45Stamp(tb45Data.ros?.as_of)+'\nResearch only. Market values are full-PPR references, ROS projections are estimates, lineup deltas are modeled, and no acceptance is implied. NOT SENT.';
 const b=document.querySelector('[data-tb48-copy]');
 if(navigator.clipboard?.writeText)navigator.clipboard.writeText(txt).then(()=>{if(b)b.textContent='Copied valuation ✓';}).catch(()=>{window.prompt('Copy valuation report',txt);});
 else window.prompt('Copy valuation report',txt);
}

function tb45SelectOptions(options,defaultLabel){return '<option value="">'+e(defaultLabel)+'</option>'+options.map(x=>'<option value="'+e(x.id)+'">'+e(x.name)+' · '+e(x.pos)+' · '+e(x.team||'—')+'</option>').join('');}
function tradeBlock45HTML(){
 const d=tb45Data,ours=tb45RosterPlayers(1),all=(d.snap?.rosters||[]).flatMap(r=>r.roster_id===1||isTradeExcludedOpponent(r.roster_id,tb45Manager(r.roster_id))?[]:(r.players||[]).map(pid=>({...tb45Player(pid),ownerId:r.roster_id,ownerName:tb45Manager(r.roster_id)}))).filter(x=>['QB','RB','WR','TE'].includes(x.pos));
 const myList=ours.map(tb45Player).filter(x=>['QB','RB','WR','TE'].includes(x.pos));
 const savedOur=tb45State.mine.filter(pid=>ours.includes(pid)).map(pid=>tb45Player(pid));
 const savedTargets=tb45State.targets.map(pid=>({...tb45Player(pid),ownerId:tb45Owner(pid)})).filter(p=>p.ownerId&&Number(p.ownerId)!==1&&!isTradeExcludedOpponent(p.ownerId,tb45Manager(p.ownerId)));
 const tmode=tb45State.view==='buy';
 let h='<section class="tb45" id="tb45-desk">'+tb48FeatureHTML()+'<div class="block-header"><h3>Two-Way Trade Block</h3><span class="roster-label forecast">COACH CONTROL</span></div>';
 h+='<p>Coach selects the players to move or acquire. The desk researches trade structures against <b>actual FFL owners</b>. Saved on this device only; <b>nothing is posted to Sleeper.</b></p>';
 h+='<div class="tb-tabs"><button type="button" data-tb-view="sell" aria-selected="'+(!tmode)+'">Trade away · our block</button><button type="button" data-tb-view="buy" aria-selected="'+tmode+'">Trade for · opponents</button></div>';
 if(d.error)h+='<div class="tb-empty">Live trade value feed: '+e(d.error)+' · <button type="button" data-tb-reload>Retry</button></div>';
 if(!d.snap)h+='<div class="tb-empty">Waiting for current league roster and trade-market reports. Selections will remain saved locally when possible.</div>';
 h+='<div class="tb-controls"><div><label>Our trade block</label><select aria-label="Select our player" id="tb45-add-mine">'+tb45SelectOptions(myList.filter(x=>!tb45State.mine.includes(x.id)),'Add one of our players…')+'</select><div class="tb-flex" style="margin-top:9px">'+(tb45State.mine.length?tb45State.mine.map(pid=>'<span class="tb-chip">'+e(tb45Player(pid).name)+' <button type="button" title="Remove" aria-label="Remove '+e(tb45Player(pid).name)+'" data-tb-remove-mine="'+e(pid)+'">×</button></span>').join(''):'<span class="market-small">No outgoing players selected.</span>')+'</div></div>';
 h+='<div><label>Other managers’ available / targeted players</label><select id="tb45-add-target" aria-label="Select opponent player"><option value="">Mark a player you saw on another manager’s block…</option>';
 let byTeam=new Map();for(const p of all){if(tb45State.targets.includes(p.id))continue;if(!byTeam.has(p.ownerId))byTeam.set(p.ownerId,[]);byTeam.get(p.ownerId).push(p);}
 for(const [rid,players] of byTeam){h+='<optgroup label="'+e(tb45Manager(rid))+'">'+players.sort((a,b)=>a.name.localeCompare(b.name)).map(p=>'<option value="'+e(p.id)+'">'+e(p.name)+' · '+e(p.pos)+'</option>').join('')+'</optgroup>';}
 h+='</select><div class="tb-flex" style="margin-top:9px">'+(tb45State.targets.length?tb45State.targets.map(pid=>'<span class="tb-chip bought">'+e(tb45Player(pid).name)+' <button type="button" title="Remove" aria-label="Remove '+e(tb45Player(pid).name)+'" data-tb-remove-target="'+e(pid)+'">×</button></span>').join(''):'<span class="market-small">No opponent block listings entered.</span>')+'</div><small style="display:block;margin:6px 0;color:#ffce88;font-size:11px">Sleeper has a Trade Block, but the public roster feed does NOT certify who listed a player. You mark listings you actually saw.</small></div></div>';
 h+='<div class="tb-controls" style="margin-top:12px"><div><label>Preferred position to acquire</label><select id="tb45-needs">'+[['ANY','Any position'],['RB','Running back'],['WR','Wide receiver'],['TE','Tight end'],['QB','Quarterback']].map(([v,l])=>'<option value="'+v+'" '+(tb45State.needs===v?'selected':'')+'>'+l+'</option>').join('')+'</select></div><div><label>Maximum spendable FAAB (optional, confirm against Sleeper)</label><input id="tb45-budget" inputmode="numeric" type="number" step="1" min="0" max="999" value="'+e(tb45State.budget)+'" placeholder="Enter verified spendable balance"/><small style="color:#95abc4;font-size:11px">Sleeper’s budget-used field isn’t a reliable spendable balance after FAAB trades.</small></div></div>';
 h+='<div class="tb-scan-filter"><label>Deal structure · players Dirty Birds give → receive</label><select id="tb46-shape">'+[['STANDARD','Standard: 1–2 players'],['3x1','3 for 1'],['3x2','3 for 2'],['3x3','3 for 3'],['1x3','1 for 3'],['2x3','2 for 3'],['ALL','All shapes (capped research sample)']].map(([v,l])=>'<option value="'+v+'" '+((tb45State.shape||'STANDARD')===v?'selected':'')+'>'+l+'</option>').join('')+'</select><div class="tb-price-legend">Each structure is priced using both teams’ actual rosters. Large combination sets are bounded for mobile speed, so these are sampled opportunities—not an exhaustive leaguewide proof of no possible trade.</div></div>';
 const snap=d.snap?.fetched_at_utc,market=d.market?.as_of,ros=d.ros?.as_of;
 h+='<p>Sources: Sleeper '+e(tb45Stamp(snap))+' · Half-PPR ROS '+e(tb45Stamp(ros))+' · TheTradeCalc '+e(tb45Stamp(market))+'. <a class="tb-source" href="'+TB45_FP_SOURCE+'" target="_blank" rel="noopener">FantasyPros Week 7 chart</a> is a dated second check; <a class="tb-source" href="'+TB45_WALTER+'" target="_blank" rel="noopener">WalterPicks Week 7 trade report</a> is used for a dated buy/sell signal (Oct 21); its proprietary valuation engine remains separate.</p>';
 h+='<div class="tb-results"><div class="block-header"><strong>'+(tmode?'Buy-side acquisition ideas':'Sell-side package ideas')+'</strong><button type="button" data-tb-reload>Refresh research</button></div>';
 if(!d.snap||!d.market||!d.ros)h+='<div class="tb-empty">Live research inputs are required. No fake or historical offers are displayed in this section.</div>';
 else if(tmode&&!savedTargets.length)h+='<div class="tb-empty">Select a player you’ve seen on another manager’s Sleeper block above. We will build offers specifically to acquire that player, using our actual roster.</div>';
 else if(!tmode&&!savedOur.length)h+='<div class="tb-empty">Add at least one currently rostered Dirty Birds player to research outgoing packages.</div>';
 else{
  const deals=tb45Results(),strict=deals.filter(x=>x.confirmed),rest=deals.filter(x=>!x.confirmed),total=deals.tests||0;
  h+='<p>Screened '+e(total)+' player combinations · '+e(deals.priceMatched||0)+' within initial market band · '+e(deals.evaluated||0)+' evaluated for actual lineup/depth fit · '+e(strict.length)+' stronger leads · '+e(rest.length)+' additional exploratory leads. No acceptance percentage is inferred.</p>';
  if(strict.length){h+='<div class="market-section-label">Higher-confidence research leads (NOT endorsed offers)</div>';h+=strict.slice(0,8).map((x,i)=>tb45DealHTML(x,'a'+i)).join('');}
  if(rest.length){h+='<details class="market-disclosure"><summary>Other exploratory deals — further work needed ('+e(rest.length)+')</summary>'+rest.slice(0,10).map((x,i)=>tb45DealHTML(x,'b'+i)).join('')+'</details>';}
  if(!deals.length)h+='<div class="tb-empty">No trade package currently satisfied even the minimum two-sided lineup and market tests. This is a scouting result—not evidence that nobody will trade. Try different assets, change the deal structure, add FAAB to a draft, or revisit after new valuations arrive.</div>';
 }
 h+='</div>'+tb45ViewOnlyRosterHTML()+'<details><summary>Backup and restore your Trade Block selections</summary><p>The block is stored in this browser, not on Cloudflare KV. iPhone private browsing can erase it when the session ends. Copy the text below to keep a backup.</p><textarea rows="3" readonly id="tb45-export">'+e(JSON.stringify({mine:tb45State.mine,targets:tb45State.targets,budget:tb45State.budget,needs:tb45State.needs,shape:tb45State.shape,compare:tb48State()}))+'</textarea><label>Paste a saved backup to restore</label><textarea rows="3" id="tb45-import" placeholder="Paste the exported JSON here"></textarea><button data-tb-import type="button">Restore block</button></details>';
 h+='<div class="tb-foot">Read-only research; no trade posted or accepted. Player values: attributed TheTradeCalc 12-team full-PPR reference, FFL projections half-PPR, FantasyPros Week 7 public chart for players matched. No access to WalterPicks proprietary scores, and FAAB has no trustworthy universal exchange rate. Confirm manager availability and rules before negotiating.</div></section>';
 return h;
}
function tb45DealHTML(x,key){if(isTradeExcludedOpponent(x.otherId,tb45Manager(x.otherId)))return ''; 
 const format=ids=>ids.map(pid=>tb45Player(pid).name).join(' + ');
 const status=x.confirmed?'Promising research · not endorsed':x.audit?.grade||'Research · not yet strong';
 const d='<div class="tb-deal"><strong>GIVE: '+e(format(x.give))+'<br>RECEIVE: '+e(format(x.take))+'</strong>';
 let h=d+'<span class="tb-tag '+(x.confirmed?'good':'warn')+'">'+e(status)+'</span><span class="tb-tag">'+e(tb45Manager(x.otherId))+'</span>';
 h+='<small>Projected starting lineup: Dirty Birds <b>'+(x.us>=0?'+':'')+e(x.us.toFixed(2))+' PPG</b> · Opponent <b>'+(x.them>=0?'+':'')+e(x.them.toFixed(2))+' PPG</b><br>TheTradeCalc paid / received '+e(x.ratio.toFixed(2))+'× · FantasyPros second check '+(x.fp==null?'not matched to all players':e(x.fp.toFixed(2))+'× (dated Week 7)')+'</small>';
 if(x.cutO.length||x.cutT.length)h+='<small>Extra roster cuts: '+(x.cutO.length?'Dirty Birds '+e(x.cutO.map(pid=>tb45Player(pid).name).join(' + '))+'; ':'')+(x.cutT.length?'opponent '+e(x.cutT.map(pid=>tb45Player(pid).name).join(' + ')):'')+'. These are hypothetical replacements only; no cuts are executed.</small>';
 if(x.walterBuy)h+='<small><b>WalterPicks buy-side research:</b> an incoming target is on its Oct 21 public buy list. This is editorial research, not a proprietary app trade grade. <a class="tb-source" href="'+TB45_WALTER+'" target="_blank" rel="noopener">Read report</a>.</small>';
 if(x.give.some(pid=>TB45_WALTER_BUYS.some(n=>tb45Norm(n)===tb45Norm(tb45Player(pid).name))))h+='<small><b>Price caution:</b> WalterPicks included an outgoing player as a Week 7 <em>buy</em>. Check whether selling now sacrifices upside.</small>';
 if(x.injuries.length)h+='<small>Player health tag: '+e(x.injuries.join(', '))+' — verify before offers.</small>';
 const a=x.audit;
 h+='<div class="tb-value-grid"><div class="tb-metric"><small>Dirty Birds bench depth proxy impact</small><b>'+(a.ourDepthDelta>=0?'+':'')+e(a.ourDepthDelta.toFixed(2))+' projected PPG</b></div><div class="tb-metric"><small>Opponent bench depth proxy impact</small><b>'+(a.theirDepthDelta>=0?'+':'')+e(a.theirDepthDelta.toFixed(2))+' projected PPG</b></div></div>';
 h+='<details class="valuation-audit"><summary>Full GM valuation audit · '+e(x.give.length)+' for '+e(x.take.length)+'</summary>';
 h+='<div class="tb-audit"><b>Market-price gap:</b> '+e(a.marketGap.toFixed(1))+'% (positive means we give more on TheTradeCalc).<br><b>Expert second-check:</b> '+(a.fpGap==null?'Unavailable for full package':e(a.fpGap.toFixed(1))+'% (positive means FantasyPros values outgoing assets higher)')+'<br><b>Lineup improvement:</b> Dirty Birds '+e(x.us.toFixed(2))+' PPG, opponent '+e(x.them.toFixed(2))+' PPG. These are single ROS weekly estimates, not weekly matchup forecasts.<br><b>Post-trade playable depth:</b> '+['QB','RB','WR','TE'].map(p=>e(p)+' '+e(a.ourAfter.counts[p])+' (before '+e(a.ourBefore.counts[p])+')').join(' · ')+'<br><b>Opponent playable depth:</b> '+['QB','RB','WR','TE'].map(p=>e(p)+' '+e(a.theirAfter.counts[p])+' (before '+e(a.theirBefore.counts[p])+')').join(' · ')+'</div>';
 h+='<div class="tb-audit"><b>Player inputs (half-PPR PPG / full-PPR market):</b><table class="tb-player-table"><thead><tr><th>Side</th><th>Player</th><th>ROS</th><th>Market</th><th>FP</th></tr></thead><tbody>'+[['Give',x.give],['Get',x.take]].map(([side,arr])=>arr.map(pid=>'<tr><td>'+e(side)+'</td><td>'+e(tb45Player(pid).name)+'</td><td>'+e(tb45PPG(pid)?.toFixed(1)||'—')+'</td><td>'+e(tb45Val(pid)||'—')+'</td><td>'+e(tb45FP(pid)??'—')+'</td></tr>').join('')).join('')+'</tbody></table></div>';
 h+='<div class="tb-audit"><b>Bench proxy:</b> Sum of the three highest projected nonstarters in each skill position; descriptive, not the next-week lineup or injury risk.<br><b>Model screen:</b> '+e(a.grade)+'<br><b>Source freshness:</b> Market '+(a.marketRecent?'last 72h':'older than 72h')+'; ROS '+(a.projRecent?'last 72h':'older than 72h')+'. FantasyPros chart remains Week 7, not live or league-specific.<br><b>What needs checking:</b> <span class="caution">'+e(a.risks.join(' · ')||'Confirm opponent needs, injuries, playoff schedules and keeper/trade rules')+'</span>.<br><b>Consolidation:</b> A 3-for-1 does not automatically equal the sum of the incoming starter’s value; depth and roster cuts matter. No predicted acceptance percentage.</div></details>';
 h+='<details><summary>Add FAAB to this deal / copy draft</summary><p>Choose either direction and an amount. It can bridge a negotiation, but has no verified player-value conversion. The model cannot assume a manager will accept cash-equivalent FAAB.</p>';
 h+='<div class="tb-faab"><select aria-label="FAAB direction" id="tb45-dir-'+key+'"><option value="none">No FAAB</option><option value="pay">We send FAAB</option><option value="get">We receive FAAB</option></select><input type="number" inputmode="numeric" min="0" max="999" step="1" value="0" aria-label="FAAB amount" id="tb45-amount-'+key+'"/></div>';
 h+='<button type="button" data-tb-copy="'+e(key)+'" data-tb-our="'+e(x.give.join(','))+'" data-tb-in="'+e(x.take.join(','))+'" data-tb-opponent="'+e(x.otherId)+'">Copy deal draft</button><small>We can only validate outgoing FAAB against the spendable balance you entered. Confirm opponent funds in Sleeper before requesting incoming FAAB.</small></details></div>';
 return h;
}
function tb45CopyDraft(button){if(isTradeExcludedOpponent(button.dataset.tbOpponent,tb45Manager(button.dataset.tbOpponent)))return; 
 const key=button.dataset.tbCopy,direction=$('tb45-dir-'+key)?.value||'none',amount=Math.round(Number($('tb45-amount-'+key)?.value)||0);
 if(amount<0||amount>999||!Number.isFinite(amount)){alert('Enter valid nonnegative FAAB.');return;}
 const budget=tb45State.budget===''?null:Number(tb45State.budget);
 if(direction==='pay'&&amount>0&&budget!=null&&amount>budget){alert('FAAB amount exceeds your entered spendable budget.');return;}
 let text='Dirty Birds trade discussion (DRAFT — NOT SENT)\nWith: '+tb45Manager(button.dataset.tbOpponent)+'\nWe give: '+button.dataset.tbOur.split(',').map(pid=>tb45Player(pid).name).join(' + ')+'\nWe receive: '+button.dataset.tbIn.split(',').map(pid=>tb45Player(pid).name).join(' + ');
 if(direction==='pay'&&amount>0)text+='\nPlus: Dirty Birds send $'+amount+' FAAB';
 if(direction==='get'&&amount>0)text+='\nPlus: Opponent sends $'+amount+' FAAB';
 text+='\nResearch only. Verify injury status, manager interest, roster slots, real remaining FAAB and league rules before proposing in Sleeper.';
 if(direction==='pay'&&amount>0&&budget==null)text+='\nWarning: spendable Dirty Birds FAAB not entered/verified.';
 if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>{button.textContent='Copied draft ✓';}).catch(()=>{window.prompt('Copy draft',text);});
 else window.prompt('Copy draft',text);
}
function tb45ChangeSelect(e){const t=e.target;
 if(t.id==='tb48-opponent'){const x=tb48State();x.opponent=isTradeExcludedOpponent(t.value,tb45Manager(t.value))?'':String(t.value||'');x.take=[];tb45Save();return;}
 if(t.id==='tb48-add-give'&&t.value){const x=tb48State();if(tb45RosterPlayers(1).includes(t.value)&&x.give.length<3)x.give=[...new Set([...x.give,t.value])];tb45Save();return;}
 if(t.id==='tb48-add-take'&&t.value){const x=tb48State();if(x.opponent&&!isTradeExcludedOpponent(x.opponent,tb45Manager(x.opponent))&&tb45RosterPlayers(x.opponent).includes(t.value)&&x.take.length<3)x.take=[...new Set([...x.take,t.value])];tb45Save();return;}
 if(t.id==='tb45-add-mine'&&t.value){tb45State.mine=[...new Set([...tb45State.mine,t.value])];tb45Save();}
 if(t.id==='tb45-add-target'&&t.value&&!isTradeExcludedOpponent(tb45Owner(t.value),tb45Manager(tb45Owner(t.value)))){tb45State.targets=[...new Set([...tb45State.targets,t.value])];tb45State.view='buy';tb45Save();}
 if(t.id==='tb45-needs'){tb45State.needs=t.value;tb45Save();}
 if(t.id==='tb46-shape'){tb45State.shape=t.value;tb45Save();}
 if(t.id==='tb45-budget'){tb45State.budget=t.value;try{localStorage.setItem(TB45_KEY,JSON.stringify(tb45State));}catch(err){}}
}
function tb45Click(e){const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-tb48-remove')){const x=tb48State(),side=b.dataset.tb48Remove;if(['give','take'].includes(side))x[side]=x[side].filter(id=>id!==b.dataset.player);tb45Save();return;}
 if(b.hasAttribute('data-tb48-clear')){
  // The legacy Clear button previously repainted the entire Trade Laboratory,
  // causing a noticeable iPhone stall after a package valuation.
  tb45State.compare={opponent:'',give:[],take:[]};
  try{localStorage.setItem(TB45_KEY,JSON.stringify(tb45State));}catch(_){}
  tb45CacheKey='';
  const old=document.getElementById('tb48-eval');
  if(old)old.outerHTML=tb48FeatureHTML(); // only the compact proposal form
  return;
 }
 if(b.hasAttribute('data-tb48-copy')){tb48CopyReport();return;}
 if(b.hasAttribute('data-tb-view')){tb45State.view=b.dataset.tbView;tb45Save();}
 if(b.hasAttribute('data-tb-remove-mine')){tb45State.mine=tb45State.mine.filter(x=>x!==b.dataset.tbRemoveMine);tb45Save();}
 if(b.hasAttribute('data-tb-remove-target')){tb45State.targets=tb45State.targets.filter(x=>x!==b.dataset.tbRemoveTarget);tb45Save();}
 if(b.hasAttribute('data-tb-reload'))tb45Refresh();
 if(b.hasAttribute('data-tb-copy'))tb45CopyDraft(b);
 if(b.hasAttribute('data-tb-import')){try{const j=JSON.parse($('tb45-import').value);if(!Array.isArray(j.mine)||!Array.isArray(j.targets))throw Error('Missing lists');tb45State.mine=j.mine.map(String).slice(0,20);tb45State.targets=j.targets.map(String).filter(pid=>!isTradeExcludedOpponent(tb45Owner(pid),tb45Manager(tb45Owner(pid)))).slice(0,30);tb45State.budget=j.budget??'';tb45State.needs=['ANY','QB','RB','WR','TE'].includes(j.needs)?j.needs:'ANY';tb45State.shape=['STANDARD','3x1','3x2','3x3','1x3','2x3','ALL'].includes(j.shape)?j.shape:'STANDARD';tb45State.compare=j.compare&&typeof j.compare==='object'?j.compare:{opponent:'',give:[],take:[]};tb48Sanitize();tb45Save();}catch(err){alert('Invalid trade block JSON backup');}}
}
$('trade-intel').addEventListener('change',tb45ChangeSelect);
$('trade-intel').addEventListener('click',tb45Click);
// Data only; no Cloudflare KV writes. Every 15m while viewed is plenty for price/projection source files.
tb45Refresh();
setInterval(()=>{if(!document.hidden)tb45Refresh();},15*60*1000);

/* 4.9 — Evidence-aware scouting desk. Does not authorize/submit any transaction. */
let gm47Snapshot=null,gm47Lineups=null,gm47Availability=null,gm47Gameday=null,gm47HistorySnapshot=null;
let gm47Games=new Map(),gm47GamesError=new Map(),gm47GamesLoading=new Set();
let gm47State={position:'ALL',player:'',compare:'',week:0,manualWeek:false};
const GM47_ESPN_SCHEDULE='https://www.espn.com/nfl/schedule';
const GM47_STAT_SOURCE='https://github.com/Kodiak907/dirty-birds-sleeper-feed/blob/main/data/AVAILABILITY_INTELLIGENCE.json';
const GM47_PROJ_SOURCE='https://github.com/Kodiak907/dirty-birds-sleeper-feed/blob/main/data/WEEKLY_LINEUPS.json';
function gm47Time(x){const t=Date.parse(x||'');return Number.isFinite(t)?new Date(t).toLocaleString():'Not provided';}
function gm47Age(x){const t=Date.parse(x||'');if(!Number.isFinite(t))return 'unknown age';const h=Math.max(0,(Date.now()-t)/3600000);return h<1?'< 1 hour':h<24?Math.round(h)+' hours':Math.round(h/24)+' days';}
function gm47Fresh(x,hours){const d=Date.parse(x||'');return Number.isFinite(d)&&d<=Date.now()+120000&&Date.now()-d<=hours*3600000;}
function gm47Num(x,dec=1){return Number.isFinite(Number(x))&&x!==null&&x!==''?Number(x).toFixed(dec):'Not published';}
function gm47Roster(){let players=liveRosterSnapshot?.players||[];if(players.length)return players.filter(p=>['QB','RB','WR','TE','K','DEF'].includes(String(p.position).toUpperCase()));
 const watch=gm47Availability?.dirty_birds_watch||[];return watch.filter(p=>['QB','RB','WR','TE','K','DEF'].includes(String(p.position).toUpperCase())).map(p=>({...p,player_id:p.id}));}
function gm47Person(id){return gm47Roster().find(p=>String(p.player_id)===String(id))||null;}
function gm47UsagePerson(p){return (gm47Availability?.dirty_birds_watch||[]).find(x=>String(x.id)===String(p?.player_id))||null;}
function gm47Week(){return Number(gm47State.week||window.dbNflWeek||gm47Snapshot?.nfl_state?.week||7);}
function gm47Proj(p){return (gm47Lineups?.weeks?.[String(gm47Week())]?.starters||[]).find(z=>String(z.id)===String(p?.player_id))||null;}
function gm47ScoringHistory(p){
 const all=gm47HistorySnapshot?.season===Number(window.dbNflSeason||gm47Snapshot?.nfl_state?.season||2026)?gm47HistorySnapshot.matchups_by_week:{},prev=gm47Week();const values=[];
 for(let w=prev-1;w>=1&&values.length<4;w--){
  const rows=all[String(w)];if(!Array.isArray(rows))continue;
  // Search all league rosters: traded/acquired players can have scored for their prior owner.
  const matched=rows.filter(z=>Object.prototype.hasOwnProperty.call(z.players_points||{},String(p?.player_id)));
  if(matched.length!==1)continue; // ambiguous or absent: do not infer a result
  const pts=matched[0].players_points[String(p.player_id)];
  if(pts!==undefined&&pts!==null&&Number.isFinite(Number(pts)))values.push({week:w,points:Number(pts),scored_for_roster:matched[0].roster_id});
 }
 return values.reverse();
}
function gm47Score(p){const x=gm47HistorySnapshot;const games=x?.season===Number(window.dbNflSeason||gm47Snapshot?.nfl_state?.season||2026)?x?.matchups_by_week?.[String(gm47Week())]||[]:[];const our=games.find(m=>Number(m.roster_id)===Number(window.dbRosterId||1));const n=our?.players_points?.[String(p?.player_id)];return (n!==null&&n!==undefined&&Number.isFinite(Number(n)))?Number(n):null;}
function gm47CanonicalTeam(s){const v=String(s||'').trim().toUpperCase();return ({JAC:'JAX',WSH:'WAS',LA:'LAR',SD:'LAC',OAK:'LV',STL:'LAR'})[v]||v;}
function gm47Game(p){const games=gm47Games.get(gm47Week())||[];const our=gm47CanonicalTeam(p?.team);return games.find(g=>[g.home,g.away].map(gm47CanonicalTeam).includes(our))||null;}
function gm47Opponent(p){const g=gm47Game(p);if(g){let v=gm47CanonicalTeam(p.team)===gm47CanonicalTeam(g.home)?g.away:g.home;return {name:v,source:'ESPN NFL week schedule',game:g};}
 const full=pfo49ScheduleWeek({team:p.team},gm47Week());return full?.opponent?{name:full.opponent,source:'full-season NFL schedule',game:null}:{name:null,source:null,game:null};}
async function gm47LoadGames(week){const w=Number(week);if(!w||gm47Games.has(w)||gm47GamesLoading.has(w))return;
 gm47GamesLoading.add(w);
 try{const ctrl=new AbortController(),tm=setTimeout(()=>ctrl.abort(),13000);let res;try{res=await fetch('/api/nfl-week?week='+encodeURIComponent(w)+'&season='+encodeURIComponent(Number(window.dbNflSeason||gm47Snapshot?.nfl_state?.season||2026)),{cache:'no-store',signal:ctrl.signal});}finally{clearTimeout(tm)}
  const j=await res.json();if(!res.ok||!Array.isArray(j.games)||j.games.length<1)throw Error(j.error||'No validated NFL schedule');
  gm47Games.set(w,j.games);gm47GamesError.delete(w);
 }catch(err){gm47GamesError.set(w,String(err.message||err))}finally{gm47GamesLoading.delete(w);gm47Render();}
}
function gm47Row(label,status,detail,link=null){let t='<div class="scout47-factor"><span class="sctag '+e(status)+'">'+(status==='evidenced'?'Measured / documented':status==='context'?'Context only':'Still unverified')+'</span><b>'+e(label)+'</b><p>'+e(detail)+'</p>';
 if(link?.url&&/^https:\/\//.test(link.url))t+='<a href="'+e(link.url)+'" target="_blank" rel="noopener noreferrer">'+e(link.title||'Review source')+' ↗</a>';
 return t+'</div>';}
const GM47_POSITION={
 QB:[['Protection & pressure','Opponent pressure rate, sack/pressure vulnerability, starting OL health, pressure-to-sack conversion'],['Defensive coverage','Zone/man tendencies, disguises, blitz frequency, explosive plays allowed'],['Pass design','Designed runs, scramble usage, pass attempts, red-zone pass rate, likely passing volume']],
 RB:[['Blocking and run front','Run blocking, defensive box fronts, line health, yards before contact'],['Backfield competition','Teammate availability, early-down vs third-down share, goal-line split'],['Touch quality','Red-zone carries, routes and targets, gamescript-sensitive workload']],
 WR:[['Coverage assignment','Likely primary DB and whether coverage follows slot/outside alignment'],['Route and target quality','Routes per dropback, air yards, first reads, end-zone and red-zone targets'],['QB connection','Quarterback availability, pressure impact, target quality and contested usage']],
 TE:[['Routes versus blocking','Routes per team pass play, pass-protection assignments, in-line vs slot share'],['Opponent TE coverage','Linebacker/safety assignments, man/zone matchup and TE-specific allowance'],['Receiving competition','Other pass catchers, red-zone target competition, quarterback trust']],
 K:[['Scoring environment','Team implied score, drives, red-zone stalls, field-goal attempt rate'],['Weather & kicking conditions','Verified wind speed/gusts, rain, surface and kicking distance'],['Role security','Official kicker availability and recent accuracy/attempt opportunities']],
 DEF:[['Opponent QB & protections','QB status, turnover-worthy plays, sack rate, OL health'],['Pressure & disruption','Defensive pressure/sack creation, takeaways, short fields, special teams'],['Script & environment','Game spread/total, opponent pass rate, pace and weather impact']]
};
function gm47Analysis(p){const usage=gm47UsagePerson(p),estimated=pfo50Estimate(p.player_id),proj=estimated==null?null:{ppg:estimated},o=gm47Opponent(p),game=o.game;
 const pos=String(p.position||'').toUpperCase();const official=(nflVerified?.players||[]).find(z=>normPlayer(z.name)===normPlayer(p.name)&&String(z.position||'').toUpperCase()===pos);
 const officialFresh=gm47Fresh(nflVerified?.checked_at,2);const sp=String(p.sleeper_injury_status||usage?.sleeper_injury_status||'');
 const espn=(espnInjuries||[]).find(z=>normPlayer(z.name)===normPlayer(p.name));
 const inactive=(officialInactiveEvidence?.inactives||[]).find(z=>String(z.id||z.player_id)===String(p.player_id));
 const snap=Array.isArray(usage?.recent_snap_percentages)?usage.recent_snap_percentages.filter(x=>Number.isFinite(Number(x))):[];
 const observedSnap=usage?.snap_share_pct;
 const usageStamp=gm47Availability?.source_metrics_as_of||usage?.report_source_as_of||gm47Availability?.generated_at_utc;
 const week=gm47Week(),isWeekNow=week===Number(window.dbNflWeek||gm47Snapshot?.nfl_state?.week||7);const history=gm47ScoringHistory(p);
 const sourceFresh=gm47Fresh(usageStamp,72);
 const evidence=[],contrary=[],gaps=[],factors=[];
 function add(l,s,d,u){factors.push({label:l,status:s,detail:d,link:u});if(s==='missing')gaps.push(l);}
 const snapLink={url:GM47_STAT_SOURCE,title:'Scouting source'};
 if(liveRosterSnapshot?.players?.some(x=>String(x.player_id)===String(p.player_id))){
  const liveRecent=gm47Fresh(liveRosterSnapshot.checked_at,1);
  add('Verified Sleeper roster assignment',liveRecent?'evidenced':'context',
    p.name+' currently appears on Dirty Birds roster as '+pos+' · '+((liveRosterSnapshot.starters||[]).map(String).includes(String(p.player_id))?'in submitted starting lineup':'on bench / reserve')+' · checked '+gm47Time(liveRosterSnapshot.checked_at)+'. This verifies fantasy roster placement, not NFL active status.',{url:'https://sleeper.com/',title:'Live Sleeper roster'});
 }
 if(history.length){
  const avg=history.reduce((a,z)=>a+z.points,0)/history.length;
  add('Actual recent fantasy scoring',gm47Fresh(gm47HistorySnapshot?.fetched_at_utc,24)?'evidenced':'context',
   history.map(z=>'W'+z.week+' '+gm47Num(z.points,2)).join(' · ')+' · Mean '+gm47Num(avg,2)+' over '+history.length+' previously recorded FFL league week(s), including former fantasy owners when available. These are Sleeper scoring outcomes, not NFL carries, targets, routes or expected future production.',{url:'https://sleeper.com/',title:'Sleeper league scoring'});
 }else add('Actual recent fantasy scoring','missing','No unambiguous previous-week player scoring history was found in the accessible FFL league matchup snapshot. Not a zero-point finding.',{url:'https://sleeper.com/',title:'Sleeper'});

 if(usage&&snap.length){let txt='Last '+snap.length+' published samples: '+snap.map(v=>gm47Num(v,0)+'%').join(' → ')+' (chronological order not independently validated).';
  if(Number.isFinite(Number(observedSnap))&&observedSnap!=null)txt+=' Summary snap share '+gm47Num(observedSnap,0)+'%.';
  txt+=' Source '+gm47Time(usageStamp)+'; snapshot may lag live games.';
  add('Playing-time evidence',sourceFresh?'evidenced':'context',txt,snapLink);
  if(snap.length>=2){const d=Number(snap.at(-1))-Number(snap[0]);if(Math.abs(d)>=18)contrary.push('Snap percentages vary by '+Math.abs(d).toFixed(0)+' points across available observations; investigate the cause instead of assuming a stable role.');}
 }else add('Playing-time evidence','missing','No usable weekly snap sequence for this player. Do not equate missing participation with low usage.',snapLink);
 if(['RB','WR','TE','QB'].includes(pos)){
  const targets=usage?.targets_per_game,carries=usage?.carries_per_game;
  if(targets!=null||carries!=null){let parts=[];if(targets!=null)parts.push(gm47Num(targets,2)+' targets/game');if(carries!=null)parts.push(gm47Num(carries,2)+' carries/game');
   add('Opportunity volume',sourceFresh?'evidenced':'context',parts.join(' · ')+' — source aggregate; not a next-week guarantee. Last sample week '+e(usage?.latest_snap_week??'unknown')+'.',snapLink);
  }else add('Opportunity volume','missing','Carries, targets, and relevant trend were not published in our verified sources.',snapLink);
 }
 const when=p.sleeper_injury_status==null?'No Sleeper injury tag': 'Sleeper '+String(p.sleeper_injury_status);
 if(official&&officialFresh){const d=official.game_status||'No final designation listed';add('Availability / official report','evidenced',when+' · Official NFL game designation: '+d+'; practice: '+(official.practice_status||'not listed')+'. NFL injury reporting is NOT the same as gameday actives.',{url:'https://www.nfl.com/injuries/',title:'NFL official injury report'});
  if(/^(out|doubtful)$/i.test(String(d)))contrary.push('Official NFL game designation '+d+'; a projected score cannot override this.');
 }else{
  add('Availability / official report','missing',when+(espn?' · ESPN reports '+espn.status+' (third party)':'')+'. An absent official player row does not prove healthy or active. Check official team report and game-specific inactives.',{url:'https://www.nfl.com/injuries/',title:'Official NFL report'});
 }
 if(sp&&/^(Out|IR|PUP|Doubtful|Questionable)$/i.test(sp))contrary.push('Sleeper status '+sp+' needs current official NFL corroboration; fantasy reserve and NFL IR are distinct.');
 const action=rosterActions.find(a=>normPlayer(a.name)===normPlayer(p.name));
 if(action) add('Documented roster action','context','Club report '+action.date+': '+action.description+'. A prior activation is not gameday clearance.',{url:action.source_url,title:'Dated club report'});
 const pweek=gm47Lineups?.weeks?.[String(week)];
 if(proj&&Number.isFinite(Number(proj.ppg))&&Number(proj.ppg)>0){add('FFO independent statistical projection','context',gm47Num(proj.ppg,2)+' estimated FFL points using independent nflverse game statistics (65% last three observed games + 35% season baseline), not opponent-adjusted. This is not a published expert forecast.',{url:'https://github.com/nflverse/nflverse-data',title:'Independent NFL statistics source'});}
 else add('FFO independent statistical projection','missing','No supported independent FFO estimate for this player yet; sufficient published NFL game samples or scoring rules are missing. This is not a zero-point forecast.',{url:'https://github.com/nflverse/nflverse-data',title:'Source coverage'});
 add('Independent expert disagreement','missing','No matched, timestamped multi-expert weekly start/sit consensus for this player. A trade value chart does not count as a matchup-specific projection.',{url:'https://www.fantasypros.com/nfl/start/',title:'Check weekly consensus'});
 if(o.name){let txt='Opponent '+o.name+' for NFL Week '+week+' from '+o.source+'.';if(game){txt+=' '+(gm47CanonicalTeam(game.home)===gm47CanonicalTeam(p.team)?'Home':'Away')+' · '+(game.status||'status pending')+' · '+(game.date?new Date(game.date).toLocaleString():'date unknown')+'.';if(game.total!=null)txt+=' Published over/under '+game.total+' (not a player forecast).';}
  add('Opponent / game context',o.game?'evidenced':'context',txt,o.game?{url:'https://www.espn.com/nfl/scoreboard',title:'NFL scoreboard'}:{url:'https://github.com/nflverse/nflverse-data',title:'NFL schedule source'});
 }else add('Opponent / game context','missing','Opponent has not been established from an NFL schedule or a verified week-specific lineup estimate. Do not infer it from last week.',{url:GM47_ESPN_SCHEDULE,title:'NFL schedules'});
 if(game?.weather){add('Game conditions','context','Published stadium weather: '+game.weather+'. Conditions may change; wind/gust values are required for kicker/pass effects.',{url:'https://www.espn.com/nfl/scoreboard',title:'ESPN scoreboard'});}
 else add('Game conditions','missing','No current sourced wind, precipitation, surface/roof condition or forecasts in our connected feed. Do not assume neutral weather.',{url:'https://www.weather.gov/',title:'Weather source'});
 if(game?.total!=null){add('Market game environment','context','Published game over/under '+gm47Num(game.total,1)+'; it does not resolve team share or opportunity.',{url:'https://www.espn.com/nfl/scoreboard',title:'Game totals'});}
 else add('Market game environment','missing','No timestamped game total, spread, pace, or implied team scoring available. Do not invent betting lines.');
 const mates=(gm47Roster()||[]).filter(z=>String(z.player_id)!==String(p.player_id)&&gm47CanonicalTeam(z.team)===gm47CanonicalTeam(p.team)).map(z=>z.name);
 add('Teammates and usage competition','missing','Same-NFL-team players on our fantasy roster: '+(mates.join(', ')||'none matched')+'. This does NOT capture the full NFL depth chart, injured teammates or confirmed target share. Inspect club depth and practice reports.',{url:'https://www.nfl.com/injuries/',title:'Teammate reports'});
 const requirements=GM47_POSITION[pos]||[];for(const [label,detail] of requirements)add(label,'missing','Required before a complete '+pos+' assessment: '+detail+'. Our current sources do not verify this dimension.');
 const lastPoints=gm47Score(p);
 if(lastPoints!=null){add('Observed fantasy points','context',gm47Num(lastPoints,2)+' points currently recorded for this league matchup/week. This can be in progress and is an outcome, not the reason a pregame decision was right or wrong.',{url:'https://sleeper.com/',title:'Current Sleeper scores'});
  if(proj&&lastPoints<Number(proj.ppg)*0.5)contrary.push('Recorded fantasy points ('+gm47Num(lastPoints,2)+') are well below the published estimate ('+gm47Num(proj.ppg,2)+'); determine whether the projection was captured before kickoff and whether the game is final before judging the process.');
 }
 if(o.name&&proj&&Number(proj.ppg)>0)evidence.push('A sourced opponent and modeled point estimate exist; neither establishes a favorable matchup without scheme and opportunity evidence.');
 if(usage&&snap.length&&usage?.targets_per_game!=null)evidence.push('Participation and target-volume samples are available; verify role stability and target quality.');
 if(!gm47Fresh(pfo50Independent?.checked_at,48)&&proj)contrary.push('Independent stats feed has not been checked successfully in the last 48 hours.');
 if(!gm47Fresh(gm47Availability?.generated_at_utc,48))contrary.push('Available usage/injury scouting snapshot is stale or undated.');
 if(!isWeekNow)contrary.push('This is a different NFL week from the current game state. Use it for research, not a premature lineup instruction.');
 return {p,usage,proj,opponent:o,game,week,sourceFresh,factors,evidence,contrary,gaps,lastPoints};
}
function gm47Card(report,compact=false){
 if(!report)return '<div class="note">Current roster evidence unavailable.</div>';
 const {p,opponent:o,gaps,contrary}=report;const m=pfo50StatsFor(p.player_id),proj=pfo50Estimate(p.player_id),official=pfo49Injury(p.player_id);
 let h='<div class="scout47-title"><div><h2>'+e(p.name)+'</h2><p class="muted">'+e(p.position||'')+' · '+e(p.team||'')+' · Week '+e(report.week)+' · '+e(o.name||'Opponent not verified')+'</p></div><span class="roster-label forecast">RESEARCH ONLY</span></div>';
 h+='<div class="pfo49-statgrid">'+pfo50StatTile('FFO FFL forecast*',pfo49Num(proj,1)) + pfo50StatTile('Last NFL game · FFL est.*',pfo49Num(m?.latest?pfo49ScoreFromStats(m.latest)?.points:null,1)) +pfo50StatTile('Targets / game',pfo49Num(m?.targets_per_game,1))+pfo50StatTile('Snap share',pfo49Num(report.usage?.snap_share_pct,0)+'%')+'</div>';
 h+='<div class="pfo49-callout"><b>Decision summary</b><p>'+(official.official?'Official NFL designation: '+e(official.official.game_status||'No game designation.'):'No verified current NFL injury designation matched. Not evidence of clearance.')+'</p><p>'+(proj==null?'Independent forecast unavailable: insufficient published NFL game sample.':'Independent projection: '+e(pfo49Num(proj,1))+' FFL pts, based on published NFL game stats (not matchup adjusted).')+'</p><p>'+e(gaps.length)+' research categories need further evidence before a strong recommendation.</p></div>';
 h+='<button class="button" type="button" data-pfo49-id="'+e(p.player_id)+'">Open player stats, schedule and news</button>';
 if(contrary.length)h+='<details class="pfo49-disclose"><summary>Key risks ('+contrary.length+')</summary>'+contrary.slice(0,5).map(z=>'<p>'+e(z)+'</p>').join('')+'</details>';
 h+='<details class="pfo49-disclose"><summary>Supporting evidence and missing information</summary>'+report.evidence.slice(0,5).map(z=>'<p>'+e(z)+'</p>').join('')+'<p><b>Still unverified:</b> '+e(gaps.slice(0,8).join(' · '))+'</p></details>';
 if(!compact)h+='<details class="pfo49-disclose"><summary>Full detailed source matrix</summary><div class="scout47-matrix">'+report.factors.map(x=>gm47Row(x.label,x.status,x.detail,x.link)).join('')+'</div></details>';
 return h;
}
function gm47Compare(){const main=gm47Person(gm47State.player),other=gm47Person(gm47State.compare);if(!main||!other||main.player_id===other.player_id)return '';
 const a=gm47Analysis(main),b=gm47Analysis(other);
 function summ(r){return '<div><b>'+e(r.p.name)+'</b> · '+e(r.p.position||'')+'<p>FFO statistical baseline*: '+e(r.proj?gm47Num(r.proj.ppg,2)+' pts':'missing')+'</p><p>Snap share: '+e(r.usage?.snap_share_pct!=null?gm47Num(r.usage.snap_share_pct)+'%':'not published')+'</p><p>Opponent: '+e(r.opponent.name||'unverified')+'</p><p>Missing dimensions: '+e(r.gaps.length)+'</p></div>';}
 return '<div class="card"><div class="scout47-title"><h3>Head-to-head research comparison</h3><span class="scout47-label warn">NO BLIND WINNER</span></div><div class="scout47-peer">'+summ(a)+summ(b)+'</div><p class="scout47-note">Projection differences alone are <b>not</b> enough to choose a starter. Both players require verified opportunity, position-specific opponent tendencies, QB/OL health, and current game conditions. Review each player individually; the comparison does not issue a start/sit recommendation.</p></div>';
}
function gm47SyncControls(){const players=gm47Roster();const weeks=Object.keys(gm47Lineups?.weeks||{}).map(Number).filter(x=>x>=1&&x<=18).sort((a,b)=>a-b);
 const current=Number(window.dbNflWeek||gm47Snapshot?.nfl_state?.week||7),filteredWeeks=[...new Set(weeks.length?weeks:[current])];
 if(!gm47State.manualWeek)gm47State.week=current;
 if(!filteredWeeks.includes(gm47Week()))filteredWeeks.push(gm47Week());filteredWeeks.sort((a,b)=>a-b);
 const w=$('gm47-week');if(w){const opts=filteredWeeks.map(v=>'<option value="'+e(v)+'">Week '+e(v)+(v===current?' · current':'')+'</option>').join('');if(w.innerHTML!==opts)w.innerHTML=opts;w.value=String(gm47Week());}
 const eligible=players.filter(p=>gm47State.position==='ALL'||String(p.position||'').toUpperCase()===gm47State.position);
 if(!eligible.some(p=>String(p.player_id)===gm47State.player))gm47State.player=String((eligible[0]||{}).player_id||'');
 const psel=$('gm47-player');if(psel){const opts=eligible.map(p=>'<option value="'+e(p.player_id)+'">'+e(p.name)+' ('+e(p.position)+')</option>').join('');if(psel.innerHTML!==opts)psel.innerHTML=opts;psel.value=gm47State.player;}
 const cs=$('gm47-compare');if(cs){const opts='<option value="">No comparison</option>'+players.filter(p=>String(p.player_id)!==gm47State.player).map(p=>'<option value="'+e(p.player_id)+'">'+e(p.name)+' ('+e(p.position)+')</option>').join('');if(cs.innerHTML!==opts)cs.innerHTML=opts;if(!players.some(p=>String(p.player_id)===gm47State.compare))gm47State.compare='';cs.value=gm47State.compare;}
}
function gm47Render(){const host=$('gm47-report');if(!host)return;
 gm47SyncControls();const p=gm47Person(gm47State.player);
 const current=gm47Week();if(!gm47Games.has(current)&&!gm47GamesLoading.has(current)&&!gm47GamesError.has(current))queueMicrotask(()=>gm47LoadGames(current));
 const age1=gm47Age(gm47Snapshot?.fetched_at_utc),age2=gm47Age(gm47Availability?.generated_at_utc),age3=gm47Age(gm47Lineups?.projection_as_of||gm47Lineups?.generated_at_utc);
 $('gm47-freshness').textContent='Sleeper '+age1+' · Usage '+age2+' · Forecast '+age3+' · NFL schedule '+(gm47Games.has(current)?'loaded':gm47GamesError.has(current)?'unavailable':'pending');
 if(!p){host.innerHTML='<div class="card note">No verified live roster yet. Waiting for Sleeper/GitHub feeds; no player conclusions available.</div>';return;}
 const r=gm47Analysis(p);
 let h='<div class="card">'+gm47Card(r)+'</div>';
 h+=gm47Compare();
 h+='<details class="card pfo49-disclose"><summary>Source ledger and model limitations</summary><div class="scout47-source">';
 h+='<b>Actual roster / scores:</b> Sleeper snapshot '+e(gm47Time(gm47Snapshot?.fetched_at_utc))+' · Past fantasy outcomes '+e(gm47Time(gm47HistorySnapshot?.fetched_at_utc))+' · Live lineup '+e(gm47Time(liveRosterSnapshot?.checked_at))+'<br>';
 h+='<b>Usage / injuries:</b> <a href="'+GM47_STAT_SOURCE+'" target="_blank" rel="noopener">League injury and usage intelligence</a> · '+e(gm47Time(gm47Availability?.generated_at_utc))+'<br>';
 h+='<b>Forecast:</b> <a href="'+GM47_PROJ_SOURCE+'" target="_blank" rel="noopener">Legacy historical week-specific feed (not used by 5.0 FFO model)</a> · '+e(gm47Time(pfo50Independent?.checked_at))+'<br>';
 h+='<b>Official availability:</b> <a href="https://www.nfl.com/injuries/" target="_blank" rel="noopener">NFL injury reports</a> · '+e(gm47Time(nflVerified?.checked_at))+'<br>';
 h+='<b>Schedule:</b> <a href="https://www.espn.com/nfl/scoreboard" target="_blank" rel="noopener">ESPN NFL scoreboard</a> · '+(gm47Games.has(current)?'retrieved this session':e(gm47GamesError.get(current)||'pending'))+'<br>';
 h+='<b>Still external:</b> Position coverage/pressure, blocking, route participation, full NFL teammate usage, multiple expert start/sit forecasts, verified local weather and pace. Those are <b>not yet ingested</b> into this dashboard.<br>';
 h+='Source reachability does not imply current reporting. Last recorded points may be in-progress. No past score is evidence that a pregame recommendation was optimal.</div></div>';
 host.innerHTML=h;
}
$('gm47-pos').addEventListener('change',ev=>{gm47State.position=ev.target.value;gm47State.player='';gm47State.compare='';gm47Render();});
$('gm47-player').addEventListener('change',ev=>{gm47State.player=ev.target.value;gm47State.compare='';gm47Render();});
$('gm47-compare').addEventListener('change',ev=>{gm47State.compare=ev.target.value;gm47Render();});
$('gm47-week').addEventListener('change',ev=>{gm47State.manualWeek=true;gm47State.week=Number(ev.target.value)||gm47Week();gm47Render();gm47LoadGames(gm47Week());});
$('gm47-refresh').addEventListener('click',()=>{gm47Games.delete(gm47Week());gm47GamesError.delete(gm47Week());gm47LoadGames(gm47Week());refreshLive();refreshInjuryOnly();});
$('gm47-open-from-roster')?.addEventListener('click',()=>{document.querySelector('nav button[data-page="scouting"]')?.click();});

/* FFO 5.0 · Independent NFLverse statistical evidence. Sleeper remains ONLY the
   authority for league settings, ownership, recorded FFL scores and transactions. */
let pfo50Independent=null,pfo50Indexed=new Map(),pfo50IndependentError='',pfo50IndependentPromise=null,pfo50IndependentAt=0,pfo50ScheduleError='';
function pfo50Key(name,team){return normPlayer(name)+'|'+gm47CanonicalTeam(team||'');}
function pfo50StatsFor(id){const p=pfo49Info(id),key=pfo50Key(p.name,p.team),exact=pfo50Indexed.get(key);if(exact)return exact;
 // Sleeper can retain roman-numeral/Jr suffixes that nflverse omits. Match only
 // a unique, SAME-TEAM first+last base name; never silently map another player.
 const stem=String(p.name||'').replace(/\s+(?:jr\.?|sr\.?|ii|iii|iv)$/i,'').trim();
 const matches=[...pfo50Indexed.values()].filter(x=>gm47CanonicalTeam(x.team)===gm47CanonicalTeam(p.team)&&String(x.name||'').replace(/\s+(?:jr\.?|sr\.?|ii|iii|iv)$/i,'').trim().toLowerCase()===stem.toLowerCase());
 return matches.length===1?matches[0]:null;
}
function pfo50Score(stats){const s=pfo49ScoreFromStats(stats);return s&&Number.isFinite(s.points)?s.points:null;}
function pfo50Estimate(id){const row=pfo50StatsFor(id);return row?.forecast?pfo50Score(row.forecast):null;}
function pfo50StatTile(label,val){return '<div><b>'+e(val==null?'—':val)+'</b><span>'+e(label)+'</span></div>';}
function pfo50StatsStrip(id){const row=pfo50StatsFor(id),p=pfo49Info(id);if(!row)return '<div class="pfo50-evidence warning"><b>Independent player statistics pending.</b> '+e(pfo50IndependentError||'We are checking a separate published NFL player-stat feed. Official Sleeper scoring and GameCast availability are independently tracked.')+' <button type="button" class="button" id="pfo57-retry-stats">Retry NFL statistics</button></div>';
 const weekly=row.latest||{},project=pfo50Estimate(id);const w=Number(weekly.week);const league=pfo49Observed(id)?.[w];const actual=league?.points??pfo50Score(weekly);
 const hist=league?'Actual FFL':'Reconstructed FFL*';
 const key=p.position||row.position;
 let fields=[['W'+w+' '+hist,pfo49Num(actual,1)],['Next-game model*',pfo49Num(project,1)]];
 if(['QB'].includes(key))fields.push(['Completions / Att.',(weekly.pass_cmp??'—')+' / '+(weekly.pass_att??'—')],['Incompletions',weekly.pass_inc??'—'],['Pass yds',weekly.pass_yd??'—'],['Rush yds',weekly.rush_yd??'—']);
 if(['RB','WR','TE'].includes(key))fields.push(['Rushes',weekly.rush_att??'—'],['Targets',weekly.targets??'—'],['Catches',weekly.rec??'—'],['Rush yds',weekly.rush_yd??'—'],['Rec yds',weekly.rec_yd??'—'],['Target share',weekly.target_share_pct!=null?weekly.target_share_pct+'%':'—']);
 const totals=row.season_totals||{},seasonFields=[['Passing yards',totals.pass_yd],['Passing TDs',totals.pass_td],['Rush yards',totals.rush_yd],['Rush TDs',totals.rush_td],['Targets',totals.targets],['Receptions',totals.rec],['Receiving yards',totals.rec_yd],['Receiving TDs',totals.rec_td]];
  const published=seasonFields.filter(([label,value])=>value!==null&&value!==undefined);
  const seasonMarkup=published.length?'<details class="pfo49-disclose" open><summary>Verified NFL season totals · '+e(row.games_observed)+' recorded games</summary><div class="pfo49-statgrid">'+published.map(([label,value])=>pfo50StatTile(label,value)).join('')+'</div><p class="pfo50-micro">Source: nflverse published player weeks. Games counted in source may lag live NFL games; no missing category is represented as zero.</p></details>':'<p class="pfo50-micro">Full NFL season totals not yet delivered by the independent stat source.</p>';
  return '<div class="pfo49-statgrid">'+fields.map(([label,value])=>pfo50StatTile(label,value)).join('')+'</div>'+seasonMarkup+'<p class="pfo50-micro">*Independent nflverse player stats; scoring reconstruction can omit some FFL bonuses. FFO model uses documented recent and season stats, not expert projections. NFL games: '+e(row.games_observed)+'.</p>';
}
function pfo50TradeRos(){const players={};for(const x of pfo50Indexed.values()){if(!x.forecast)continue;const pp=pfo50Score(x.forecast);if(pp==null)continue;players[x.name]={ppg:pp,coverage_fraction:1,method:['FFO 5.0 independent nflverse recent-form model'],games_observed:x.games_observed};}
 return {as_of:pfo50Independent?.checked_at||null,players,source:'nflverse independently sourced 2026 player stats; FFO baseline 65% last3 + 35% season; custom FFL scoring'};
}
async function pfo50LoadIndependent(force=false){const season=Number(window.dbNflSeason||2026);
 if(pfo50IndependentPromise)return pfo50IndependentPromise;
 if(!force&&pfo50Independent&&Date.now()-pfo50IndependentAt<20*60*1000)return pfo50Independent;
 pfo50IndependentPromise=(async()=>{try{
  const controller=new AbortController(),tm=setTimeout(()=>controller.abort(),23000);let r;try{r=await fetch('/api/independent-stats?season='+season,{cache:'no-store',signal:controller.signal});}finally{clearTimeout(tm);}
  if(!r.ok)throw Error('Independent stats HTTP '+r.status);const j=await r.json();if(!Array.isArray(j.players)||j.players.length<100)throw Error('Incomplete NFL player-stat sample');
  pfo50Independent=j;pfo50Indexed=new Map(j.players.map(x=>[pfo50Key(x.name,x.team),x]));pfo50IndependentError='';pfo50IndependentAt=Date.now();
  if(tb45Data?.snap){tb45Data.ros=pfo50TradeRos();tb45CacheKey='';if(document.querySelector('#market.page.active [data-pfo59-market-panel="trade"]:not([hidden])'))renderTradeScouting();}
  // PFO 5.9.5: data updates are global, DOM updates only for the visible workspace.
  // Previously this single refresh rebuilt every large hidden panel on iPhone.
  if(document.querySelector('#radar.page.active'))pfo49RenderRadar();
  if(document.querySelector('#overview.page.active')){pfo50RenderHomeKPIs();pfo49OverviewHealth();renderBriefing();}
  if(document.querySelector('#matchup.page.active'))pfo50RenderProjectedLineup();
  if(document.querySelector('#market.page.active'))renderWaiverScouting();
  if(document.querySelector('#playerhub.page.active'))pfo49RenderPlayer();
  if(document.querySelector('#championship.page.active'))pfo49RenderPlanner();
  if(document.querySelector('#availability.page.active'))updateInjuryView();
  if(document.querySelector('#scouting.page.active'))gm47Render();
  return j;
 }catch(err){pfo50IndependentError=String(err.message||err);return null;}finally{pfo50IndependentPromise=null;}})();
 return pfo50IndependentPromise;
}

/* PFO 4.9: roster-grounded research; no fantasy transactions or automated lineup submissions. */
let pfo49Metrics=null,pfo49Ros=null,pfo49MetricsAt=null,pfo49MetricsError=null;
let pfo49Players=[],pfo49Selected=null,pfo49Trend=new Map(),pfo49TrendAt=null,pfo49Mode='morning',pfo49RadarFilter='ALL';
let pfo49FullLog={},pfo49FullLogError='',pfo49LastFetch=0,pfo49RefreshBusy=false;
let pfo49Pins=new Set();try{pfo49Pins=new Set(JSON.parse(localStorage.getItem('pfo49pins')||'[]'));}catch(_){/* storage optional */}
function pfo49Today(x){const d=new Date(x);return Number.isFinite(d.getTime())?d.toLocaleString():'Time not published';}
function pfo49Num(x,d=1){return x==null||!Number.isFinite(Number(x))?'—':Number(x).toFixed(d);}
function pfo49Ready(){return Array.isArray(gm47Snapshot?.rosters)&&!!pfo49Metrics;}
function pfo49Dir(){const src=cachedPlayerNames||tb45Data?.names||{};const output=new Map();
 for(const [id,p] of Object.entries(src))if(p?.name&&p?.position){output.set(String(id),{id:String(id),name:p.name,team:p.team||'',position:p.position});}
 for(const [id,p] of Object.entries(pfo49Metrics?.players||{}))if(p?.name){const old=output.get(String(id))||{};output.set(String(id),{id:String(id),name:p.name,position:old.position||p.position||'',team:p.nfl_team||old.team||''});}
 for(const p of liveRosterSnapshot?.players||[])output.set(String(p.player_id),{id:String(p.player_id),name:p.name,team:p.team||'',position:p.position||''});
 return [...output.values()];
}
// Indexed NFL identity and metric lookups: avoid repeatedly scanning the full
// player directory for every visible row. Rebuild only when the source changes.
let pfo595RosterRef=null,pfo595RosterIndex=new Map(),pfo595MetricRef=null,pfo595MetricIndex=new Map();
function pfo49Info(id){
 const key=String(id);
 if(pfo595RosterRef!==pfo49Players){
  pfo595RosterRef=pfo49Players;
  pfo595RosterIndex=new Map(pfo49Players.map(p=>[String(p.id),p]));
 }
 const found=pfo595RosterIndex.get(key);
 if(found)return found;
 if(!pfo49Players.length)return pfo49Dir().find(x=>x.id===key)||{id:key,name:'Player '+key,team:'',position:''};
 return {id:key,name:'Player '+key,team:'',position:''};
}
function pfo49Metric(id){
 const players=pfo49Metrics?.players;
 if(!players)return null;
 const direct=players[String(id)];if(direct)return direct;
 const p=pfo49Info(id);
 if(pfo595MetricRef!==players){
  pfo595MetricRef=players;pfo595MetricIndex=new Map();
  for(const x of Object.values(players)){
   if(!x?.name)continue;
   const key=normPlayer(x.name)+'|'+gm47CanonicalTeam(x.nfl_team);
   if(!pfo595MetricIndex.has(key))pfo595MetricIndex.set(key,x);
  }
 }
 return pfo595MetricIndex.get(normPlayer(p.name)+'|'+gm47CanonicalTeam(p.team))||null;
}
function pfo49Projected(id){const p=pfo49Info(id),model=pfo50StatsFor(id);const base=pfo50Estimate(id);return base==null?null:{name:p.name,ppg:base,weeks:Object.fromEntries(Array.from({length:18},(_,i)=>[String(i+1),base]))};}
function pfo49Observed(id){const rows={...(gm47HistorySnapshot?.matchups_by_week||{})};if(pfo49LiveMatchups&&Number(pfo49LiveMatchupWeek)===Number(window.dbNflWeek))rows[String(pfo49LiveMatchupWeek)]=pfo49LiveMatchups;const season=Number(window.dbNflSeason||gm47Snapshot?.nfl_state?.season||2026);if(Number(gm47HistorySnapshot?.nfl_state?.season||gm47HistorySnapshot?.league?.season||season)!==season)return {};
 const out={};for(const [week,matchups] of Object.entries(rows)){
  if(!Array.isArray(matchups))continue;const hit=matchups.filter(m=>Object.prototype.hasOwnProperty.call(m.players_points||{},String(id)));
  if(hit.length!==1)continue;const raw=hit[0].players_points[String(id)];if(raw!==null&&raw!==undefined&&Number.isFinite(Number(raw)))out[Number(week)]={points:Number(raw),owner:hit[0].roster_id,source:'Sleeper FFL matchup scored points'};
 }return out;
}
function pfo49ProjectedWeek(id,w){const info=pfo49Info(id);if(pfo49Schedule?.complete&&!pfo49ScheduleWeek(info,w))return null;return pfo50Estimate(id);}
function pfo49LeagueRecord(){const r=gm47Snapshot?.rosters?.find(r=>Number(r.roster_id)===1);return r?.settings?String(r.settings.wins)+'–'+String(r.settings.losses):data.record;}
function pfo49Injury(id){const p=pfo49Info(id);const own=(liveRosterSnapshot?.players||[]).find(x=>String(x.player_id)===String(id));const official=(nflVerified?.players||[]).find(x=>normPlayer(x.name)===normPlayer(p.name));const espn=(espnInjuries||[]).find(x=>normPlayer(x.name)===normPlayer(p.name));const m=pfo49Metric(id);
 return {fantasy:own?.sleeper_injury_status||null,official,espn,older:m?.injury_report_record||null};
}
function pfo49PublishedNews(id){const p=pfo49Info(id);const row=autoScoutByName.get(normPlayer(p.name));return [...(pfo49LiveNews[id]?.news||[]),...(row?.news||[])].filter((n,i,a)=>/^https:\/\//.test(n.url||'')&&a.findIndex(x=>x.title===n.title)===i).slice(0,9);}
function pfo49CoachData(id){const p=pfo49Info(id),c=waiverCatalysts?.get(normPlayer(p.name));if(!c)return null;
 return c.primary_source?.url?c:null;
}
function pfo49Owner(id){const roster=gm47Snapshot?.rosters?.find(r=>(r.players||[]).map(String).includes(String(id)));if(!roster)return 'Unrostered in checked FFL snapshot';const u=gm47Snapshot?.users?.find(u=>String(u.user_id)===String(roster.owner_id));return 'FFL roster '+roster.roster_id+' · '+e(u?.metadata?.team_name||u?.display_name||'Manager');}
function pfo49SourceStamp(){return 'NFL stats checked '+pfo49Today(pfo50Independent?.checked_at||pfo49Metrics?.as_of)+' · League scores '+pfo49Today(gm47Snapshot?.fetched_at_utc)+' · FFO projections use independent NFL stats';}
function pfo49Link(id,opts={}){const p=pfo49Info(id);return '<button type="button" class="pfo49-player-link" data-pfo49-id="'+e(id)+'" title="Open complete player profile">'+e(p.name)+'</button>';}
function pfo49Signal(id){const m=pfo49Metric(id)||pfo50StatsFor(id),p=pfo49Info(id);if(!m)return null;
 const snaps=Array.isArray(m.recent_three_snap_pct)?m.recent_three_snap_pct.filter(v=>v!=null&&Number.isFinite(Number(v))).map(Number):[];
 const snap=m.snap_share_pct!=null?Number(m.snap_share_pct):null;
 const targets=m.targets_per_game!=null?Number(m.targets_per_game):null;
 const catches=m.receptions_per_game!=null?Number(m.receptions_per_game):null;
 const season=m.season_avg_snap_share_pct!=null?Number(m.season_avg_snap_share_pct):null;
 const isSkill=['WR','RB','TE','QB'].includes(p.position);if(!isSkill||snap==null&&targets==null&&m.pass_att_per_game==null)return null;
 const difference=snap!=null&&season!=null?snap-season:null;
 // Descriptive research sorting only; never a probability of breaking out.
 const points=(p.position==='QB'?(m.pass_att_per_game||0)*.3:(targets||m.targets_per_game||0)*3)+Math.max(0,snap||0)*.22+(difference!=null?Math.max(-15,Math.min(35,difference))*.65:0)+(catches||0)*.7;
 const newestWeek=m.latest_snap_week||m.latest?.week||null;
 const games=(pfo50StatsFor(id)?.last_three||[]).sort((a,b)=>a.week-b.week),latest=games.at(-1),prev=games.at(-2);
 const k=p.position==='QB'?'pass_att':p.position==='RB'?'rush_att':'targets';
 const volumeChange=latest?.stats?.[k]!=null&&prev?.stats?.[k]!=null?latest.stats[k]-prev.stats[k]:null;
 const trendBonus=volumeChange!=null?Math.max(-15,Math.min(25,volumeChange*2)):0;
 return {id,p,m,snap,targets,catches,season,difference,snaps,points:points+trendBonus,newestWeek,volumeChange,volumeMetric:k,popularity:pfo49Trend.get(String(id))};
}
function pfo49RadarPool(){if(!leagueOwnedIds||!ownershipCheckedMs||Date.now()-ownershipCheckedMs>5*60*1000)return [];const all=(pfo49Players.length?pfo49Players:pfo49Dir()).filter(x=>pfo49Metrics?.players?.[x.id]||pfo50Indexed.has(pfo50Key(x.name,x.team)));return all.filter(x=>!waiverIsRostered(x.name,x.id)).map(x=>pfo49Signal(x.id)).filter(x=>x&&x.newestWeek&&x.newestWeek>=Number(window.dbNflWeek||7)-2);}
function pfo49SignalHTML(x){const m=x.m,delta=x.difference;
 let reason=[];if(delta!=null&&delta>=12)reason.push('Recent snap share '+pfo49Num(delta,0)+' points above season average');
 if(x.p.position==='QB'&&m.pass_att_per_game>=20)reason.push(pfo49Num(m.pass_att_per_game,1)+' passes per recorded game');
 if(x.targets!=null&&x.targets>=5)reason.push(pfo49Num(x.targets,1)+' targets per observed game');
 if(x.volumeChange!=null&&x.volumeChange>=3)reason.push('Week-over-week '+x.volumeMetric.replaceAll('_',' ')+' +'+x.volumeChange+' (observed)');
 if(x.snap!=null&&x.snap>=75)reason.push(pfo49Num(x.snap,0)+'% published snap share');
 if(!reason.length)reason.push('Published 2026 participation warrants monitoring');
 const obs=pfo49Observed(x.id);const completed=Object.entries(obs).filter(([w])=>Number(w)<Number(window.dbNflWeek||8));
 const pts=completed.slice(-3).map(([w,z])=>'W'+w+' '+pfo49Num(z.points,1)).join(' · ');
 const news=pfo49PublishedNews(x.id);
 return '<article class="pfo49-radar-item"><div class="pfo49-row"><div><strong>'+pfo49Link(x.id)+'</strong><div class="muted">'+e(x.p.position)+' · '+e(x.p.team||m.nfl_team||'NFL')+' · '+e(leagueOwnedIds?'Not on a checked FFL roster':'Ownership not yet verified')+'</div></div><button type="button" class="pfo49-pin" data-pfo49-pin="'+e(x.id)+'">'+(pfo49Pins.has(x.id)?'★ Watching':'☆ Watch')+'</button></div><div class="pfo49-statgrid"><div><b>'+pfo49Num(x.targets,1)+'</b><span>Targets/game*</span></div><div><b>'+(x.snap==null?'—':pfo49Num(x.snap,0)+'%')+'</b><span>Snap share · source sample</span></div><div><b>'+(delta==null?'—':(delta>0?'+':'')+pfo49Num(delta,0)+' pp')+'</b><span>Vs season avg</span></div></div><p><b>Opportunity signal:</b> '+e(reason.join(' · '))+'.</p>'+ (pts?'<p class="muted">Confirmed FFL game points: '+e(pts)+'</p>':'') +'<p class="pfo49-small">'+(news.length?e(news[0].publisher||'News')+' headline '+e(news[0].published||'undated')+' · not fact-checked':'No dated reporting attached to this candidate yet')+' · Research score is not a forecast.</p></article>';
}
function pfo49RenderRadar(){const el=$('pfo49-radar');if(!el)return;
 const raw=pfo49RadarPool(),all=raw.filter(x=>pfo49RadarFilter==='ALL'||x.p.position===pfo49RadarFilter);
 const order=all.sort((a,b)=>(pfo49Pins.has(b.id)?1:0)-(pfo49Pins.has(a.id)?1:0)||b.points-a.points);
 const featured=['13274','13296'].map(id=>order.find(x=>x.id===id)).filter(Boolean);
 const rest=order.filter(x=>!featured.some(y=>y.id===x.id)).slice(0,18);
 let h='<div class="pfo49-row"><div><h2>Opportunity Radar</h2><p class="muted">Spot growing workloads before they become obvious. Scans the broader published 2026 player-stat pool—not just waiver headlines.</p></div><span class="buildtag">EVIDENCE FIRST</span></div>';
 h+='<div class="pfo49-filters">'+['ALL','QB','RB','WR','TE'].map(f=>'<button type="button" data-pfo49-filter="'+f+'" class="'+(pfo49RadarFilter===f?'on':'')+'">'+(f==='ALL'?'All roles':f)+'</button>').join('')+'</div>';
 if(!pfo49Metrics)h+='<div class="note">Waiting for the published 2026 statistics. No breakout claims until the source arrives.</div>';
 if(!leagueOwnedIds||!ownershipCheckedMs||Date.now()-ownershipCheckedMs>5*60*1000)h+='<div class="note">Current FFL ownership verification is pending or older than five minutes. Candidate cards are withheld until current ownership is confirmed; refresh the league source.</div>';
 h+='<p class="pfo49-small">'+e(pfo49SourceStamp())+' · *Snap percentages are source aggregates and may lag NFL games. Targets/game is based on observed player-stat weeks, not target share. No made-up target-share percentages.</p>';
 if(featured.length)h+='<h3>Players we specifically want on the radar</h3><div class="pfo49-radar-grid">'+featured.map(pfo49SignalHTML).join('')+'</div>';
 h+='<h3>Other emerging opportunities ('+e(rest.length)+' shown)</h3><div class="pfo49-radar-grid">'+(rest.length?rest.map(pfo49SignalHTML).join(''):'<div class="note">No qualifying, supported candidates for this filter.</div>')+'</div>';
 h+='<details class="pfo49-disclose"><summary>How Radar ranks research opportunities</summary><p>Research ordering uses documented targets or pass attempts, recent carries/target changes, snap share and differences from season participation averages. It is <b>not</b> a probability, player valuation, or start recommendation. The source does not guarantee chronological order within its three snap samples. A player’s NFL role, health, opponent and league availability require separate confirmation.</p></details>';
 el.innerHTML=h;
}
function pfo49SearchChange(){const q=String($('pfo49-search')?.value||'').trim().toLowerCase();const list=$('pfo49-search-results');if(!list)return;
 if(!q){list.innerHTML='<p class="muted">Search any NFL player, including rostered and unrostered players.</p>';return;}
 const results=pfo49Players.filter(x=>x.name.toLowerCase().includes(q)||x.team.toLowerCase()===q).slice(0,35);
 list.innerHTML=results.length?results.map(x=>'<button type="button" class="pfo49-result" data-pfo49-id="'+e(x.id)+'"><b>'+e(x.name)+'</b><small>'+e(x.position)+' · '+e(x.team)+' · '+(leagueOwnedIds&&waiverIsRostered(x.name,x.id)?'FFL rostered':'FFL availability not fully certified')+'</small></button>').join(''):'<p class="muted">No matching player in current sources. Try a shorter name; player directory may be unavailable.</p>';
}
function pfo49ScoreFromStats(stats){const rules=gm47Snapshot?.league?.scoring_settings;if(!stats||!rules)return null;
 const keys=['pass_yd','pass_td','pass_int','pass_int_td','rush_yd','rush_td','rush_40p','rush_td_40p','rush_td_50p','rec','rec_yd','rec_td','rec_td_40p','rec_td_50p','pass_td_40p','pass_td_50p','fum_lost','fum','rush_2pt','rec_2pt','pass_2pt','pass_cmp','pass_att','fgm_0_19','fgm_20_29','fgm_30_39','fgm_40_49','fgm_50_59','fgm_60p','fgmiss','xpm','xpmiss','sack','int','def_td','ff','fum_rec','safe','blk_kick'];
 let result=0,used=0;
 for(const k of keys){const weight=Number(rules[k]||0);if(weight===0)continue;const v=Number(stats[k]);if(Number.isFinite(v)){result+=weight*v;used++;}}
 if(!used)return null;
 // We cannot reconstruct all bonuses or D/ST points-allowed tiers from incomplete stat lines.
 return {points:result,partial:true,source:'Estimated from weekly raw player stats under FFL rule weights; bonus/DST completeness not certified'};
}
function pfo49EntriesFromFeed(feed){const r=feed?.stats||feed?.weekly_stats||feed||{};const entries=Array.isArray(r)?r:Object.entries(r).map(([w,v])=>({...v,week:v?.week??w}));
 const obj={};for(const x of entries){let w=Number(x.week??x.game_week??x.week_number);let raw=x.stats||x.stat||x.player_stats||x;
 if(!Number.isInteger(w)||w<1||w>18||!raw||typeof raw!=='object')continue;
 const sc=pfo49ScoreFromStats(raw);if(sc)obj[w]=sc;
 }return obj;
}
async function pfo49LoadFullLog(id,force=false){
 // Data source is independent nflverse weekly player stats, not Sleeper projections.
 await pfo50LoadIndependent(force);if(pfo49Selected===String(id))pfo49RenderPlayer();
}
function pfo49GameTable(id){
 const observed=pfo49Observed(id),info=pfo49Info(id),ind=pfo50StatsFor(id),week=Math.max(1,Math.min(18,Number(window.dbNflWeek||8)));
 let h='<div class="pfo49-table-wrap"><table class="pfo49-gamelog"><thead><tr><th>Week</th><th>Opponent</th><th>FFL pts</th><th>Type</th><th>Source</th></tr></thead><tbody>';
 for(let w=1;w<=18;w++){
  const done=w<week,league=observed[w],game=ind?.games?.find(g=>g.week===w),fromRaw=game?pfo49ScoreFromStats(game.stats):null;
  const opponent=pfo49ScheduleWeek(info,w);const opp=opponent?.opponent||(pfo49Schedule?.complete&&pfo49Schedule.teams?.[gm47CanonicalTeam(info.team)]?'BYE':'Not verified');
  let points=null,kind='',why='';
  if(league){points=league.points;kind=done?'Final league score':'Live league score';why='Sleeper league scoring';}
  else if(game&&fromRaw){points=fromRaw.points;kind='FFL reconstruction*';why='nflverse raw game stats';}
  else if(!done&&opponent){points=pfo49ProjectedWeek(id,w);kind=points==null?'No forecast':'FFO model*';why=points==null?'Insufficient sample':'Independent stats · NOT expert projection';}
  else if(opp==='BYE'){kind='BYE';why='Confirmed on full-season NFL schedule';}
  else {kind=done?'No scoring record':'No verified matchup';why='Source coverage incomplete';}
  h+='<tr><td>W'+w+'</td><td>'+e(opp)+'</td><td><b>'+pfo49Num(points,2)+'</b></td><td>'+e(kind)+'</td><td>'+e(why)+'</td></tr>';
 }
 return h+'</tbody></table></div><p class="pfo49-small">*League-scored points are authoritative. FFL reconstructions use nflverse NFL statistics converted to FFL scoring; custom big-play bonuses and D/ST categories may be missing. FFO projections are an experimental recent-form statistical baseline (65% last three observed games + 35% season average) applied to FFL rules, not an outside expert prediction or opponent-adjusted forecast. No missing schedule automatically becomes BYE.</p>';
}
function pfo49ComparePanel(id){const p=pfo49Info(id),roster=(liveRosterSnapshot?.players||[]).filter(x=>['QB','RB','WR','TE','K'].includes(x.position)&&String(x.player_id)!==String(id));
 const selected=pfo49Comparator||'';const opt=roster.map(x=>'<option value="'+e(x.player_id)+'" '+(selected===String(x.player_id)?'selected':'')+'>'+e(x.name)+'</option>').join('');
 let h='<div class="pfo49-row"><h3>Start/Sit research comparison</h3><span class="roster-label forecast">NOT AUTOMATED</span></div><label class="pfo49-small">Compare with a Dirty Birds player<select id="pfo49-compare"><option value="">Choose teammate</option>'+opt+'</select></label>';
 if(selected){const a=pfo49Projected(id),b=pfo49Projected(selected),other=pfo49Info(selected);const ptsA=pfo49ProjectedWeek(id,Number(window.dbNflWeek||8)),ptsB=pfo49ProjectedWeek(selected,Number(window.dbNflWeek||8));
  h+='<div class="pfo49-statgrid"><div><b>'+pfo49Num(ptsA,2)+'</b><span>'+e(p.name)+' ROS estimate</span></div><div><b>'+pfo49Num(ptsB,2)+'</b><span>'+e(other.name)+' ROS estimate</span></div></div><p class="pfo49-small">These are FFO statistical baselines from nflverse data under FFL settings, not validated exact FFL bonus projections. Injury, opponent, teammate volume and kickoff reports can outweigh small projection differences. Open both profiles for sources.</p>';
 }
 return h;
}
function pfo49RenderPlayer(){const el=$('pfo49-profile');if(!el)return;const id=pfo49Selected;if(!id){el.innerHTML='<p class="muted">Choose a player to view his full FFL-scored game log, future estimates, workload, injury reports, coaching evidence, and news.</p>';return;}
 const p=pfo49Info(id),m=pfo49Metric(id),inj=pfo49Injury(id),ros=pfo49Projected(id),observed=pfo49Observed(id),scores=Object.entries(observed).filter(([w])=>Number(w)<Number(window.dbNflWeek||8)).map(([w,z])=>z.points);
 const mean=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null,recency=scores.slice(-3),recent=recency.length?recency.reduce((a,b)=>a+b,0)/recency.length:null;
 const pop=pfo49Trend.get(id),news=pfo49PublishedNews(id),curated=pfo49CoachData(id);
 let h='<div class="pfo49-row"><div><h2>'+e(p.name)+'</h2><div class="muted">'+e(p.position)+' · '+e(p.team||m?.nfl_team||'Team unverified')+' · '+e(pfo49Owner(id))+'</div></div><button class="pfo49-pin" data-pfo49-pin="'+e(id)+'">'+(pfo49Pins.has(id)?'★ Watching':'☆ Watch')+'</button></div>';
 h+='<p class="pfo49-small">Official league scoring: Sleeper settings ('+e(gm47Snapshot?.league?.scoring_settings?.rec===.5?'0.5 PPR, plus custom FFL bonuses':'custom league rules')+'). Completed matchup scores from Sleeper are authoritative; approximations are explicitly marked.</p>';
 h+='<div class="pfo49-statgrid"><div><b>'+pfo49Num(mean,1)+'</b><span>FFL PPG · '+scores.length+' scored games</span></div><div><b>'+pfo49Num(recent,1)+'</b><span>Last '+recency.length+' recorded FFL games</span></div><div><b>'+pfo49Num(m?.targets_per_game,1)+'</b><span>Targets/game · observed</span></div><div><b>'+pfo49Num(m?.snap_share_pct,0)+'%</b><span>Published snap share</span></div><div><b>'+pfo49Num(m?.receptions_per_game,1)+'</b><span>Catches/game</span></div><div><b>'+pfo49Num(pfo50Estimate(id),1)+'</b><span>Independent FFO model PPG</span></div></div>';
 h+=pfo50StatsStrip(id);h+=pfo49TargetMarkup(id);
 h+='<div class="pfo49-callout"><b>What the numbers mean</b><p>Targets/game, catches, and snaps come from published NFL-stat samples; source coverage can be incomplete. <b>Target share calculations, when source coverage permits, are shown separately above. Missing team denominators never become invented percentages. '+(pop!=null?'National Sleeper trending adds: '+e(pop)+' (popularity, not production).':'National add-count feed pending or player not in the top trending list.')+'</p><small>'+e(pfo49SourceStamp())+'</small></div>';
 h+='<details class="pfo49-disclose" open><summary>All 18 NFL weeks · actual FFL points and future projections</summary>'+pfo49GameTable(id)+'</details>';
 h+='<details class="pfo49-disclose" open><summary>Injury and availability timeline</summary><div class="pfo49-panel">';
 if(inj.official)h+='<p><b>NFL injury report:</b> '+e(inj.official.game_status||'No game designation published')+' · Practice '+e(inj.official.practice_status||'not published')+' · Checked '+e(pfo49Today(nflVerified?.checked_at))+'. <a href="https://www.nfl.com/injuries/" target="_blank" rel="noopener noreferrer">NFL source</a></p>';
 else h+='<p><b>Official injury report:</b> No matching currently retrieved NFL injury-report row. This is <b>not clearance</b>.</p>';
 if(inj.espn)h+='<p><b>ESPN third-party report:</b> '+e(inj.espn.status||inj.espn.description||'Report found')+'.</p>';
 if(inj.fantasy)h+='<p><b>Sleeper fantasy injury tag:</b> '+e(inj.fantasy)+' (not an official game-day inactive).</p>';
 if(inj.older)h+='<p><b>Historical practice observation:</b> Week '+e(inj.older.week)+' · '+e(inj.older.practice_status||'No participation stated')+'; historical only.</p>';
 h+='</div></details>';
 h+='<details class="pfo49-disclose" open><summary>Coaching / role updates and current reporting</summary><div class="pfo49-panel">';
 if(curated){h+='<p><b>Documented team context ('+e(curated.event_at||'date not reported')+'):</b> '+e(curated.event)+' <a href="'+e(curated.primary_source.url)+'" target="_blank" rel="noopener noreferrer">Official club source</a></p><p>'+e(curated.impact||'Role must still be confirmed')+'</p>';}
 else h+='<p><b>Verified coach quotation:</b> None in the currently connected source record. We will not turn headlines into invented coach comments.</p>';
 if(news.length)h+='<div class="pfo49-news">'+news.map(n=>'<p><a href="'+e(n.url)+'" target="_blank" rel="noopener noreferrer">'+e(n.title)+'</a><br><small>'+e(n.publisher||'Publisher')+' · '+e(n.published||'Undated')+' · Headline only; open article for verification</small></p>').join('')+'</div>';
 else h+='<p class="muted">No published article links from the connected search. This does not mean no news exists. Live headline lookup may be unavailable.</p>';
 h+='</div></details>';
 h+='<details class="pfo49-disclose"><summary>Playoff weeks · projection research</summary><div class="pfo49-panel">'+[15,16,17].map(w=>'<p>Week '+w+': <b>'+pfo49Num(pfo49ProjectedWeek(id,w),2)+'</b> baseline projected fantasy points'+(pfo49ProjectedWeek(id,w)==null?' · Not published':' · Opponent and health adjustments unverified')+'</p>').join('')+'</div></details>';
 h+='<div class="pfo49-panel">'+pfo49ComparePanel(id)+'</div>';
 h+='<p class="pfo49-small">No roster move, waiver bid, or trade is submitted by this page. Current source age matters more than the time this page was opened.</p>';
 el.innerHTML=h;
 const oldSelect=$('pfo49-compare');if(oldSelect)oldSelect.onchange=()=>{const v=oldSelect.value; // Preserve comparator across rerender
  pfo49Comparator=v;pfo49RenderPlayer();};
}
let pfo49Comparator='';
function pfo49Open(id){pfo49Selected=String(id);document.querySelector('nav button[data-page="playerhub"]')?.click();$('pfo49-search').value=pfo49Info(id).name;$('pfo49-search-results').innerHTML='';pfo49RenderPlayer();pfo49LoadFullLog(String(id));pfo49LoadTargetShare(String(id));pfo49LoadPlayerNews(String(id));}
function pfo49TopWatch(){const ranked=pfo49RadarPool().sort((a,b)=>b.points-a.points);const top=ranked.slice(0,2);return top;}
function renderBriefing(){const el=$('briefing');if(!el)return;
 const w=Number(window.dbNflWeek||gm47Snapshot?.nfl_state?.week||7), p=data.playoff||{},roster=liveRosterSnapshot?.players||[];
 const starters=(liveRosterSnapshot?.starters||[]).map(String),onBench=roster.filter(x=>!starters.includes(String(x.player_id)));
 const warnings=roster.filter(x=>/^(Out|Questionable|Doubtful|IR|PUP)$/i.test(String(x.sleeper_injury_status||'')));
 const prob=Number(p.playoff_probability), current=pfo49LiveMatchupWeek===w?pfo49LiveMatchups?.find(x=>Number(x.roster_id)===1):gm47HistorySnapshot?.matchups_by_week?.[String(w)]?.find(x=>Number(x.roster_id)===1);
 let h='<div class="pfo49-row"><div><h2>Coach’s Daily Briefing</h2><p class="pfo49-small">Week '+e(w)+' · Dirty Birds command · facts and research labeled separately</p></div><span class="buildtag">LIVE CHECK</span></div>';
 h+='<div class="pfo49-filters">'+[['morning','Morning'],['pregame','Pregame'],['postgame','Postgame']].map(([v,l])=>'<button type="button" data-pfo49-mode="'+v+'" class="'+(pfo49Mode===v?'on':'')+'">'+l+'</button>').join('')+'</div>';
 h+='<div class="pfo49-brief-kpis"><div><b>'+e(warnings.length)+'</b><small>Injury tags · verify below</small></div><div><b>'+e(starters.length||'—')+'</b><small>Submitted starters</small></div><div><b>'+e(pfo49TopWatch().length)+'</b><small>Emerging leads</small></div><div><b>'+e(roster.length||'—')+'</b><small>Roster entries</small></div></div>'; 
 const baseTag='<p class="pfo49-small">Sleeper snapshot '+e(pfo49Today(gm47Snapshot?.fetched_at_utc))+'. Refreshing the page is not the same as refreshing the source.</p>';
 if(current?.points!=null)h+='<div class="pfo49-score-guide">Current Week '+e(w)+' Sleeper matchup total: <b>'+e(pfo49Num(current.points,2))+' FFL points</b>. May be in progress · live checked '+e(pfo49Today(pfo49LiveMatchupAt))+'.</div>';
 if(pfo49Mode==='morning'){
  h+='<div class="pfo49-brief-item"><b>1 · Roster health</b><p>'+(warnings.length?'Check '+e(warnings.slice(0,5).map(x=>x.name+' ('+x.sleeper_injury_status+')').join(', '))+'. These are fantasy tags, <b>not confirmed inactives</b>.':'No injury flags on the currently synced Dirty Birds roster. Absence of a fantasy flag is not medical clearance.')+'</p></div>';
  const top=pfo49TopWatch();h+='<div class="pfo49-brief-item"><b>2 · Emerging opportunities</b><p>'+(top.length?top.map(x=>pfo49Link(x.id)+' · '+e(pfo49Num(x.targets,1))+' targets/game').join(' • '):'Waiting for current published usage data. No breakout claim yet.')+' <button class="pfo49-text-btn" data-pfo49-go="radar">Explore Radar</button></p></div>';
  h+='<div class="pfo49-brief-item"><b>3 · Trade / waiver decisions</b><p>Check the two-sided trade evaluator for fair value and lineup effects. Waiver targets are checked against current league ownership; no automatic claims.</p></div>';
 }else if(pfo49Mode==='pregame'){
  h+='<div class="pfo49-brief-item"><b>1 · Official gameday inactive board</b><p>Always directly below this briefing. An unconfirmed report is not clearance; confirmed inactives in submitted starters are flagged.</p></div>';
  const actual=new Set(starters);const missing=(data.lineup||[]).filter(x=>!roster.some(p=>actual.has(String(p.player_id))&&normPlayer(p.name)===normPlayer(x[1]))).slice(0,3);
  h+='<div class="pfo49-brief-item"><b>2 · Submitted lineup versus model</b><p>'+(roster.length?(missing.length?'Differences worth reviewing: '+e(missing.map(x=>x[1]).join(', '))+'.':'No immediate player-name mismatch identified. Confirm slot eligibility and kickoff timing.'):'Current submitted lineup has not loaded; cannot compare.')+' <button class="pfo49-text-btn" data-pfo49-go="roster">Open roster</button></p></div>';
  h+='<div class="pfo49-brief-item"><b>3 · Last checks before kickoff</b><p>Official actives/inactives, late practice information, starting QBs, actual workloads, and source timestamps. Our system does not make lineup changes.</p></div>';
 }else{
  const weekRows=gm47HistorySnapshot?.matchups_by_week?.[String(Math.max(1,w-1))]||[];const completed=weekRows.find(x=>Number(x.roster_id)===1);
  h+='<div class="pfo49-brief-item"><b>1 · Last recorded team score</b><p>'+(completed?.points!=null?'Week '+e(w-1)+': '+e(pfo49Num(completed.points,2))+' actual FFL points, from Sleeper matchup history.':'Last completed matchup is not yet available in the accessible history snapshot.')+'</p></div>';
  h+='<div class="pfo49-brief-item"><b>2 · What to learn</b><p>Review player workloads and actual fantasy points against your decisions. Archived <b>pregame</b> forecasts are required before reporting genuine model prediction accuracy.</p></div>';
  h+='<div class="pfo49-brief-item"><b>3 · Prepare for next week</b><p>Review growing snap shares, upcoming opponents, roster injuries, and credible injury/coach reporting. <button class="pfo49-text-btn" data-pfo49-go="radar">Open Radar</button></p></div>';
 }
 h+=baseTag+'<div class="pfo49-quicklinks"><button type="button" data-pfo49-go="availability">Injury Watch</button><button type="button" data-pfo49-go="market">Trade / Waiver</button><button type="button" data-pfo49-go="playerhub">Player Intel</button></div>';
 el.innerHTML=h;
}
function pfo49ScoreLine(id){const rows=pfo49Observed(id),w=Number(window.dbNflWeek||8);const past=Object.entries(rows).filter(([k])=>Number(k)<w).sort((a,b)=>Number(b[0])-Number(a[0])).slice(0,3);
 return past.length?past.map(([w,x])=>'W'+w+' '+pfo49Num(x.points,1)+' FFL').join(' · '):'No league-scored game log in current snapshot';}
function renderWaiverScouting(){const el=$('waiverlive');if(!el)return;const original=[...(waiverResearch||[]),...(autoScout?.candidates||[]).map(x=>({player:x.name,source_player_id:x.id,position:x.position,team:x.team}))];
 const unique=new Map();for(const x of original){const id=String(x.source_player_id||x.player_id||x.id||'');const k=id||normPlayer(x.player);if(!k||unique.has(k)||waiverIsRostered(x.player,id))continue;unique.set(k,x);}
 const all=[...unique.values()];let h='<h3>Waiver Scouting · Player First</h3><p class="muted">Each candidate shows published production, usage, injury context and dated news. No headline is treated as a verified coach quote. Only players not found on checked FFL rosters appear.</p>';
 if(!leagueOwnedIds)h+='<div class="note">Live Sleeper ownership has not loaded. Current availability cannot be certified.</div>';
 else if(Date.now()-ownershipCheckedMs>300000)h+='<div class="note">League ownership evidence is older than five minutes. Refresh before committing FAAB.</div>';
 h+='<p class="pfo49-small">Source stats '+e(pfo49Today(pfo49Metrics?.as_of))+' · Ownership '+e(pfo49Today(ownershipStamp))+' · '+e(all.length)+' distinct research candidates.</p>';
 for(const x of all.slice(0,18)){
  const id=String(x.source_player_id||x.player_id||x.id||pfo49Players.find(p=>normPlayer(p.name)===normPlayer(x.player))?.id||'');const m=pfo49Metric(id),auto=autoScoutByName.get(normPlayer(x.player));const news=(auto?.news||[]).slice(0,3),inj=pfo49Injury(id),proj=pfo49Projected(id);
  h+='<article class="pfo49-waiver"><div class="pfo49-row"><div><b>'+ (id?pfo49Link(id):e(x.player))+'</b><div class="muted">'+e(x.position||pfo49Info(id).position)+' · '+e(x.team||pfo49Info(id).team)+'</div></div><span class="roster-label forecast">RESEARCH</span></div>';
  h+='<div class="pfo49-statgrid"><div><b>'+pfo49Num(m?.targets_per_game,1)+'</b><span>Targets/game*</span></div><div><b>'+pfo49Num(m?.receptions_per_game,1)+'</b><span>Rec/game*</span></div><div><b>'+pfo49Num(m?.snap_share_pct,0)+'%</b><span>Published snaps*</span></div><div><b>'+pfo49Num(pfo50Estimate(id),1)+'</b><span>FFO FFL projected PPG*</span></div></div>';
  h+=pfo50StatsStrip(id); h+='<p class="pfo49-small"><b>Verified league scores (if rostered):</b> '+e(pfo49ScoreLine(id))+'</p>';
  h+='<p class="pfo49-small"><b>Injury:</b> '+(inj.official?'NFL game status '+e(inj.official.game_status||'not final')+' · Official source checked '+e(pfo49Today(nflVerified?.checked_at)):(inj.older?'Historical practice W'+e(inj.older.week)+' '+e(inj.older.practice_status||'')+' · not current clearance':'No current official designation established; not proof of health'))+'</p>';
  h+='<details><summary>News, role context &amp; source limits</summary><div class="pfo49-panel">'+(news.length?news.map(n=>'<p><a href="'+e(n.url)+'" target="_blank" rel="noopener noreferrer">'+e(n.title)+'</a><br><small>'+e(n.publisher||'Publisher')+' · '+e(n.published||'Undated')+' · Headline only / not independently verified</small></p>').join(''):'<p>No dated articles currently attached.</p>')+'<p><b>Coach comment:</b> No individually verified direct coach quote in the connected feed unless explicitly linked in the player profile.</p><p>*Stat sample coverage can vary; team target share and routes are not invented. Review opponent and injuries before any decision.</p></div></details></article>';
 }
 if(all.length>18)h+='<p class="pfo49-small">Showing 18 of '+e(all.length)+' published scouting candidates. Open Opportunity Radar for broader unrostered research.</p>';
 if(!all.length)h+='<div class="note">No eligible candidate yet—or the current research/ownership feeds are still loading.</div>';
 el.innerHTML=h;
}
async function pfo49LoadSources(force=false){if(pfo49RefreshBusy)return;const now=Date.now();if(!force&&now-pfo49LastFetch<210000)return;pfo49RefreshBusy=true;pfo49LastFetch=now;
 const files=await Promise.allSettled([fetchReport('external_metrics.json'),pfo50LoadIndependent(force),ensureNameCatalog(),sleeperGet('/players/nfl/trending/add?lookback_hours=24&limit=100')]);
 if(files[0].status==='fulfilled'&&files[0].value?.players){pfo49Metrics=files[0].value;pfo49MetricsAt=now;pfo49MetricsError=null;}else pfo49MetricsError='2026 usage feed unavailable; retaining last successful statistics';
 /* Projections come only from nflverse stats via pfo50LoadIndependent; no Sleeper or older ROS prediction feeds. */
 if(files[3].status==='fulfilled'&&Array.isArray(files[3].value)){pfo49Trend=new Map(files[3].value.map(x=>[String(x.player_id),Number(x.count)]));pfo49TrendAt=new Date().toISOString();}
 pfo49Players=pfo49Dir();
 if(document.querySelector('#roster.page.active'))pfo49BindPlayerButtons();
 if(document.querySelector('#radar.page.active'))pfo49RenderRadar();
 if(document.querySelector('#overview.page.active')){renderBriefing();pfo49InjurySummary();pfo49OverviewHealth();}
 if(document.querySelector('#market.page.active'))renderWaiverScouting();
 if(document.querySelector('#playerhub.page.active'))pfo49RenderPlayer();
 if(document.querySelector('#championship.page.active'))pfo49RenderPlanner();
 pfo49RefreshBusy=false;
}
function pfo49OpenPage(page){document.querySelector('nav button[data-page="'+page+'"]').click();}
document.addEventListener('click',evt=>{const b=evt.target.closest('[data-pfo49-id], [data-pfo49-pin], [data-pfo49-mode], [data-pfo49-filter], [data-pfo49-go]');if(!b)return;
 if(b.dataset.pfo49Id){pfo49Open(b.dataset.pfo49Id);return;}
 if(b.dataset.pfo49Pin){const id=b.dataset.pfo49Pin;pfo49Pins.has(id)?pfo49Pins.delete(id):pfo49Pins.add(id);try{localStorage.setItem('pfo49pins',JSON.stringify([...pfo49Pins]));}catch(_){/* optional */}pfo49RenderRadar();pfo49RenderPlayer();return;}
 if(b.dataset.pfo49Mode){pfo49Mode=b.dataset.pfo49Mode;renderBriefing();return;}
 if(b.dataset.pfo49Filter){pfo49RadarFilter=b.dataset.pfo49Filter;pfo49RenderRadar();return;}
 if(b.dataset.pfo49Go){pfo49OpenPage(b.dataset.pfo49Go);return;}
});
$('pfo49-search')?.addEventListener('input',pfo49SearchChange);
$('pfo49-refresh')?.addEventListener('click',()=>{pfo49LoadSources(true);refreshLive();refreshInjuryOnly();refreshGamedayInactives();});
document.addEventListener('click',event=>{if(event.target.closest('#pfo57-retry-stats'))pfo50LoadIndependent(true).then(()=>{if(pfo49Selected)pfo49RenderPlayer()})});
const pfo49OldCompareHook=()=>{};
function pfo49BindPlayerButtons(){document.querySelectorAll('#actual-lineup tr,#actual-bench tr,#actual-reserve tr').forEach(tr=>{
 const cell=tr.children?.[1]||tr.children?.[0];if(!cell||cell.querySelector('button'))return;
 const t=cell.textContent?.trim();const match=pfo49Players.find(x=>normPlayer(x.name)===normPlayer(t))||(liveRosterSnapshot?.players||[]).find(x=>normPlayer(x.name)===normPlayer(t));if(!match)return;
 cell.innerHTML=pfo49Link(match.id||match.player_id);
 });}
const pfo49Watch=new MutationObserver(list=>{if(!pfo49Players.length)return;for(const record of list){if(record.target?.id==='actual-lineup'||record.target?.id==='actual-bench'||record.target?.id==='actual-reserve'){pfo49BindPlayerButtons();break;}}});
for(const id of ['actual-lineup','actual-bench','actual-reserve']){const node=$(id);if(node)pfo49Watch.observe(node,{childList:true});}
setInterval(()=>{if(!document.hidden&&document.querySelector('#playerhub.page.active,#radar.page.active,#market.page.active,#scouting.page.active'))pfo49LoadSources()},240000);
setInterval(()=>{if(!document.hidden&&document.querySelector('#overview.page.active'))renderBriefing();if(!document.hidden&&document.querySelector('#radar.page.active'))pfo49RenderRadar();},60000);
// Don't block core Sleeper and injury checks on slower advanced-stat research.
// Open Player Intel / Radar / Market / Scouting to fetch expensive NFL/player catalogs.
for(const page of ['playerhub','radar','market','scouting'])document.querySelector('nav button[data-page="'+page+'"]')?.addEventListener('click',()=>pfo49LoadSources());

/* 4.9 source checks: never turn a current check time into a false publication time. */
let pfo49Targets={},pfo49TargetErrors={},pfo49Schedule=null,pfo49Backtest=null,pfo49LiveNews={},pfo49NewsError={};
async function pfo49LoadTargetShare(id){const p=pfo49Info(id);if(!p.team||!p.name||pfo49Targets[id])return;
 try{const url='/api/target-share?name='+encodeURIComponent(p.name)+'&team='+encodeURIComponent(p.team)+'&season='+encodeURIComponent(window.dbNflSeason||2026);
  const res=await fetch(url,{cache:'no-store'});const j=await res.json();if(!res.ok||!j)throw Error(j.error||'Source unavailable');pfo49Targets[id]=j;pfo49TargetErrors[id]=null;}
 catch(err){pfo49TargetErrors[id]=String(err.message||err);}if(pfo49Selected===String(id))pfo49RenderPlayer();
}
async function pfo49LoadPlayerNews(id){const p=pfo49Info(id);if(!p.name||pfo49LiveNews[id])return;
 try{const r=await fetch('/api/player-news?name='+encodeURIComponent(p.name),{cache:'no-store'});const j=await r.json();if(!r.ok||!Array.isArray(j.news))throw Error(j.error||'No confirmed feed');pfo49LiveNews[id]={checked_at:j.checked_at,news:j.news};pfo49NewsError[id]=null;}
 catch(err){pfo49NewsError[id]=String(err.message||err);}if(pfo49Selected===String(id))pfo49RenderPlayer();
}
function pfo49TargetMarkup(id){const x=pfo49Targets[id];if(!x)return '<div class="pfo49-score-guide">Team target share: '+(pfo49TargetErrors[id]?'not available from the connected source ('+e(pfo49TargetErrors[id])+')':'checking the complete weekly team target totals…')+'. Missing data is not zero.</div>';
 if(x.status!=='observed')return '<div class="pfo49-score-guide">Team target share: not verified · '+e(x.reason||'No unique source match')+'.</div>';
 return '<div class="pfo49-score-guide"><b>Verified historical target share:</b> '+e(pfo49Num(x.season_target_share_pct,1))+'% across '+e(x.games_observed)+' observed games · Last 3 reported: '+e(pfo49Num(x.recent_three_target_share_pct,1))+'% · '+e(x.targets_observed)+' of '+e(x.team_targets_same_weeks)+' recorded team targets in matched weeks. <a href="'+e(x.source_url)+'" target="_blank" rel="noopener noreferrer">Underlying 2026 weekly stats</a><p class="pfo49-small">Calculated using all recorded team targets in the same source weeks. Different from air-yard share, route rate, or a next-game prediction. Latest CSV freshness is not independently verified.</p></div>';
}
function pfo49ScheduleWeek(p,w){const t=gm47CanonicalTeam(p.team);const row=pfo49Schedule?.teams?.[t]?.weeks?.[String(w)]||pfo49Schedule?.teams?.[t==='LAR'?'LA':t]?.weeks?.[String(w)];return row||null;}
async function pfo49LoadEvidence49(){
 const season=Number(window.dbNflSeason||2026);
 const settled=await Promise.allSettled([fetch('/api/season-schedule?season='+season).then(async r=>{if(!r.ok)throw Error('Schedule HTTP '+r.status);return r.json()}),fetchReport('DECISION_BACKTEST.json')]);
 if(settled[0].status==='fulfilled'&&settled[0].value?.complete)pfo49Schedule=settled[0].value;
 else pfo50ScheduleError='A complete 18-week schedule was not verified; unspecified weeks are NOT treated as byes.';
 if(settled[1].status==='fulfilled')pfo49Backtest=settled[1].value;
 pfo49RenderPlayer();pfo49RenderPlanner();pfo49OverviewHealth();pfo50RenderProjectedLineup();
}
function pfo49InjurySummary(){const el=$('pfo49-injury-summary');if(!el)return;const roster=liveRosterSnapshot?.players||[],official=nflVerified?.players||[];
 const flagged=roster.filter(p=>/^(IR|PUP|OUT|Doubtful|Questionable)$/i.test(String(p.sleeper_injury_status||'')));
 const matched=roster.flatMap(p=>official.filter(o=>normPlayer(o.name)===normPlayer(p.name)&&/^(out|doubtful|questionable)$/i.test(String(o.game_status||''))).map(o=>({p,o})));
 el.innerHTML='<div class="pfo49-row"><div><b>Injury newsroom · Dirty Birds</b><div class="pfo49-small">NFL source checked '+e(pfo49Today(nflVerified?.checked_at))+' · Sleeper roster checked '+e(pfo49Today(liveRosterSnapshot?.checked_at))+'</div></div></div>'+
  '<div class="pfo49-healthrows"><span>'+e(flagged.length)+' Sleeper injury tags</span><span>'+e(matched.length)+' matched NFL questionable / doubtful / out report(s)</span><span>Official game-day inactives are always on Overview</span></div>'+
  '<p class="pfo49-small">'+(matched.length?matched.slice(0,8).map(x=>e(x.p.name)+' ('+e(x.o.game_status)+')').join(' · '):'No matching NFL Out/Doubtful/Questionable rows in the latest retrieved official report; this does not prove anyone is cleared.')+'</p>';
}
function pfo49OverviewHealth(){const el=$('pfo49-overview-health');if(!el)return;
 let a=[['Sleeper league',gm47Snapshot?.fetched_at_utc],['Advanced NFL usage',pfo49Metrics?.as_of],['FFO independent projections',pfo50Independent?.checked_at],['Official injury retrieval',nflVerified?.checked_at],['Verified inactives feed',officialInactiveEvidence?.checked_at_utc||officialInactiveEvidence?.generated_at_utc]];
 let h='<div class="pfo49-healthrows"><span>'+e(pfo49Players.length)+' player records</span><span>'+e(pfo49RadarPool().length)+' qualified radar observations</span></div><p class="pfo49-small">Current checks are <b>not</b> guarantees the source changed. Date of data:</p>';
 for(const [name,stamp] of a)h+='<div class="pfo49-brief-item"><b>'+e(name)+'</b><p class="pfo49-small">'+e(pfo49Today(stamp))+'</p></div>';
 el.innerHTML=h;
}
function pfo49RenderPlanner(){const el=$('pfo49-playoff-plan');if(!el)return;const roster=(liveRosterSnapshot?.players||[]).filter(p=>['QB','RB','WR','TE'].includes(p.position));
 const plan=roster.map(x=>({p:x,proj:pfo49Projected(x.player_id),total:[15,16,17].reduce((a,w)=>a+(pfo49ProjectedWeek(x.player_id,w)||0),0)})).sort((a,b)=>b.total-a.total).slice(0,12);
 let h='<div class="pfo49-row"><div><h2>Championship Preparation · Weeks 15–17</h2><p class="muted">Roster-specific projection calendar. The model does not automatically account for news, changing usage or future transactions.</p></div><span class="roster-label forecast">SCENARIOS</span></div>';
 h+='<div class="pfo49-table-wrap"><table class="pfo49-gamelog pfo49-report-table"><thead><tr><th>Player</th><th>W15</th><th>W16</th><th>W17</th><th>Risk / Opponent notes</th></tr></thead><tbody>';
 for(const x of plan)h+='<tr><td>'+pfo49Link(x.p.player_id)+'</td>'+[15,16,17].map(w=>{const model=typeof pfo52Points==='function'?pfo52Points(x.p.player_id,w):null;return '<td>'+(model?.bye?'BYE':pfo49Num(pfo49ProjectedWeek(x.p.player_id,w),1))+'</td>';}).join('')+'<td class="pfo49-small">'+[15,16,17].map(w=>{const model=typeof pfo52Points==='function'?pfo52Points(x.p.player_id,w):null;return 'W'+w+': '+e(model?.bye?'BYE':model?.opponent||pfo49ScheduleWeek(x.p,w)?.opponent||'schedule not loaded');}).join(' · ')+'</td></tr>';
 h+='</tbody></table></div><p class="pfo49-small">Point estimates use an uncalibrated NFLverse recent-form model with FFL scoring; our custom long-TD bonuses are not guaranteed included. Projected values are not fantasy results. Injuries and opponents require fresh review.</p>';
 const n=Number(pfo49Backtest?.completed_comparable_weeks)||0;
 h+='<details class="pfo49-disclose"><summary>Projection quality / accountability audit</summary><div class="pfo49-panel"><b>'+e(n)+' properly archived comparable pregame week(s)</b><p>'+e(n===0?'No validated forecast accuracy percentage is available yet. A prediction recorded after a kickoff cannot be used as an honest pregame backtest.':'Recorded pregame forecast comparisons are available in the connected decision archive.')+'</p><p class="pfo49-small">Source updated '+e(pfo49Today(pfo49Backtest?.updated_at_utc))+'. The existing pipeline retains decision archives; more eligible pregame records must accumulate to measure calibration.</p><a href="https://github.com/Kodiak907/dirty-birds-sleeper-feed/blob/main/data/DECISION_BACKTEST.json" target="_blank" rel="noopener noreferrer">View model accountability archive</a></div></details>';
 el.innerHTML=h;
}
// Supplements source refreshes without modifying the old trade engine or safety policy.
// Historical evidence loads on its research view rather than during startup.
setInterval(()=>{if(!document.hidden){pfo49InjurySummary();pfo49OverviewHealth();if(document.querySelector('#championship.page.active'))pfo49RenderPlanner();}},90000);

// Refresh current-week fantasy matchup points directly from Sleeper, separately from the
// slower GitHub historical snapshots. Recorded points may be provisional while games run.
let pfo49LiveMatchups=null,pfo49LiveMatchupWeek=null,pfo49LiveMatchupAt=null,pfo49LiveMatchupError=null,pfo49MatchBusy=false;
async function pfo49LiveMatchupRefresh(){if(pfo49MatchBusy)return;const id=window.dbLeagueId||LEAGUE_ID_OVERRIDE;const week=Number(window.dbNflWeek||0);if(!id||!week)return;
 pfo49MatchBusy=true;try{const rows=await sleeperGet('/league/'+id+'/matchups/'+week);if(!Array.isArray(rows)||!rows.length)throw Error('Empty matchup response');pfo49LiveMatchups=rows;pfo49LiveMatchupWeek=week;pfo49LiveMatchupAt=new Date().toISOString();pfo49LiveMatchupError=null;}
 catch(err){pfo49LiveMatchupError=String(err.message||err);}finally{pfo49MatchBusy=false;renderBriefing();if(pfo49Selected)pfo49RenderPlayer();}
}
setTimeout(pfo49LiveMatchupRefresh,3100);
setInterval(()=>{if(!document.hidden)pfo49LiveMatchupRefresh();},60000);


// Gameday Watch shares source reports with the FFO data pipeline, NOT the text
// output of the separate ChatGPT Gameday automation. Only directly attributed
// club events are called club-sourced; third-party headlines are never verified.
let pfo50Gameday={actions:null,catalysts:null,availability:null,news:null,week:null,attempted_at:null,errors:[],busy:false};
function pfo50GamedayDate(d){return pfo49Today(d)}
function pfo50GamedayMatch(name){return (liveRosterSnapshot?.players||[]).find(x=>normPlayer(x.name)===normPlayer(name));}
function pfo50GamedayFresh(d,days){const ts=Date.parse(d||'');return Number.isFinite(ts)&&Date.now()-ts>=-86400000&&Date.now()-ts<=days*86400000;}
function pfo50GamedayLink(url,title){try{const u=new URL(String(url||''));if(u.protocol!=='https:')return '';return '<a href="'+e(u.toString())+'" target="_blank" rel="noopener noreferrer">'+e(title||'Original source')+' ↗</a>';}catch{return '';}}
function pfo50RenderGameday(){const el=$('pfo50-gameday-watch');if(!el)return;
 const roster=liveRosterSnapshot?.players||[];
 if(!roster.length){el.innerHTML='<div class="pfo50-game-banner">Connecting to the current Sleeper roster before matching research to players. No roster-specific conclusion yet.</div>';return;}
 const actions=(pfo50Gameday.actions?.records||[]).filter(x=>pfo50GamedayMatch(x.name)&&pfo50GamedayFresh(x.date,14)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,4);
 const catalysts=(pfo50Gameday.catalysts?.catalysts||[]).filter(x=>pfo50GamedayMatch(x.player)&&pfo50GamedayFresh(x.event_at,14)&&x.primary_source?.url).sort((a,b)=>String(b.event_at||'').localeCompare(String(a.event_at||''))).slice(0,3);
 const alerts=(pfo50Gameday.availability?.alerts||[]).filter(x=>pfo50GamedayMatch(x.name||x.player||x.player_name||'')).slice(0,3);
 const observed=roster.map(p=>({p,m:pfo49Metric(p.player_id)})).filter(x=>x.m?.latest_snap_week&&Array.isArray(x.m.recent_three_snap_pct)&&x.m.recent_three_snap_pct.length&&Number(x.m.latest_snap_week)>=Number(window.dbNflWeek||7)-2).sort((a,b)=>Number(b.m.snap_share_pct||0)-Number(a.m.snap_share_pct||0)).slice(0,4);
 const news=(pfo50Gameday.news?.items||[]).filter(x=>x.players?.some(n=>pfo50GamedayMatch(n))&&pfo50GamedayFresh(x.published_at,7)).slice(0,4);
 const clubStamp=pfo50Gameday.actions?.reviewed_at_utc;
 const week=pfo50Gameday.week;
 const latestGame=roster.filter(p=>p.team&&['QB','RB','WR','TE','K'].includes(p.position)).slice(0,25).map(p=>({p,g:week?.games?.find(g=>[gm47CanonicalTeam(g.home),gm47CanonicalTeam(g.away)].includes(gm47CanonicalTeam(p.team)))})).filter(x=>x.g);
 const matchups=new Map();for(const x of latestGame)matchups.set(String(x.g.id),x.g);
 let h='<div class="pfo50-game-banner"><b>Current league Week '+e(window.dbNflWeek||'—')+' · read-only scouting.</b> Official inactive names remain in the board above. <b>Starting QB changes and play restrictions require explicit verified reporting</b>; silence from the sources is not clearance.</div>';
 h+='<div class="pfo50-game-grid"><div class="pfo50-game-row"><b>Club roster developments</b><small>'+e(actions.length)+' recent roster-related dated record(s) matched · curated '+e(pfo50GamedayDate(clubStamp))+'</small></div><div class="pfo50-game-row"><b>Rostered-player news</b><small>'+e(news.length)+' recent ESPN headline lead(s) · checked '+e(pfo50GamedayDate(pfo50Gameday.news?.checked_at))+'</small></div><div class="pfo50-game-row"><b>Published snap usage</b><small>'+e(observed.length)+' roster player(s) with recent measured snap observations · '+e(pfo50GamedayDate(pfo49Metrics?.as_of))+'</small></div><div class="pfo50-game-row"><b>Week schedule &amp; weather</b><small>'+e(matchups.size)+' roster-relevant NFL game(s) found · '+e(pfo50GamedayDate(week?.checked_at))+'</small></div></div>';
 h+='<div class="pfo50-game-title">Material club and role developments</div>';
 let items=[];
 for(const x of actions){const p=pfo50GamedayMatch(x.name);items.push({date:x.date,html:'<span class="pfo50-game-tag">CLUB-SOURCED ACTION</span><b>'+pfo49Link(p.player_id)+' · '+e(x.action_code||'Roster action')+'</b><small>'+e(x.date)+' · '+e(x.source||'NFL team')+'</small><p>'+e(x.description||'Dated roster action')+'</p>'+pfo50GamedayLink(x.source_url,'Team announcement')+'<small>Transaction does not automatically certify game-day availability.</small>'});}
 for(const x of catalysts){const p=pfo50GamedayMatch(x.player);items.push({date:x.event_at,html:'<span class="pfo50-game-tag">SOURCED OPPORTUNITY</span><b>'+pfo49Link(p.player_id)+'</b><small>'+e(x.event_at)+' · '+e(x.primary_source.publisher||'Official club')+'</small><p>'+e(x.event||'Verified development')+'</p><small>'+e(x.impact||'Workload still to be confirmed')+'</small>'+pfo50GamedayLink(x.primary_source.url,'Original club report')});}
 for(const x of alerts){const p=pfo50GamedayMatch(x.name||x.player||x.player_name);const desc=String(x.description||x.event||x.message||'Watchlist update').slice(0,500);items.push({date:x.at||x.as_of||pfo50Gameday.availability?.generated_at_utc||'',html:'<span class="pfo50-game-tag lead">AUTOMATED WATCH FLAG · VERIFY</span><b>'+pfo49Link(p.player_id)+'</b><small>Published '+e(pfo50GamedayDate(x.at||x.as_of||pfo50Gameday.availability?.generated_at_utc))+'</small><p>'+e(desc)+'</p><small>Pipeline observation is not a confirmed medical or gameday designation.</small>'});}
 items.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 if(items.length)h+='<div class="pfo50-game-grid">'+items.slice(0,4).map(x=>'<div class="pfo50-game-row">'+x.html+'</div>').join('')+'</div>';
 else h+='<div class="pfo50-game-blank">No recent club-sourced roster or injury event matched this roster in the available reports. This does NOT mean no news or injuries exist.</div>';
 h+='<details><summary>Published participation + upcoming games ('+observed.length+' role snapshots)</summary>';
 if(observed.length)h+='<div class="pfo50-game-grid">'+observed.map(({p,m})=>'<div class="pfo50-game-row"><b>'+pfo49Link(p.player_id)+'</b><small>Latest source week '+e(m.latest_snap_week)+' · observed snap samples '+e(m.recent_three_snap_pct.map(v=>Number(v).toFixed(0)+'%').join(' / '))+'</small><small>Recent measured snap share '+e(pfo49Num(m.snap_share_pct,1))+'% · targets/game '+e(pfo49Num(m.targets_per_game,1))+' · not a forecast of touches</small></div>').join('')+'</div>';
 else h+='<div class="pfo50-game-blank">No recent qualified snap observations.</div>';
 if(matchups.size)h+='<div class="pfo50-game-grid">'+[...matchups.values()].slice(0,8).map(g=>'<div class="pfo50-game-row"><b>'+e(g.away)+' @ '+e(g.home)+'</b><small>'+e(pfo50GamedayDate(g.date))+' · '+e(g.status||'Status unavailable')+'</small><small>Weather: '+e(g.weather||'not published in source')+' · game context only</small></div>').join('')+'</div>';
 else h+='<div class="pfo50-game-blank">Live opponent/weather context not yet available.</div>';
 h+='</details><details><summary>Recent sourced headlines ('+news.length+' leads, not verified quotes)</summary>';
 if(news.length)h+=news.map(x=>'<div class="pfo50-game-row" style="margin-top:8px"><span class="pfo50-game-tag lead">HEADLINE · UNVERIFIED CONTENT</span><b>'+e(x.title||'Article')+'</b><small>'+e(pfo50GamedayDate(x.published_at))+' · '+e(x.publisher||'ESPN')+' · '+e((x.players||[]).join(', '))+'</small>'+pfo50GamedayLink(x.url,'Read original article')+'</div>').join('');
 else h+='<div class="pfo50-game-blank">No roster-matched article in the latest ESPN feed or feed unavailable. Source absence is not confirmation of no news.</div>';
 h+='</details>';
 const errors=pfo50Gameday.errors||[];
 h+='<div class="pfo50-game-meta">Source check '+e(pfo50GamedayDate(pfo50Gameday.attempted_at))+' · '+e(errors.length?errors.length+' feed(s) unavailable: '+errors.join('; '):'No source fetch errors reported in this refresh')+' · Source articles are linked rather than reproduced. News headlines are leads only, not verified coach quotations, medical conclusions or starter confirmations.</div>';
 el.innerHTML=h;
}
async function pfo50LoadGameday(force=false){if(pfo50Gameday.busy)return;const roster=liveRosterSnapshot?.players||[];if(!roster.length)return;
 pfo50Gameday.busy=true;const names=roster.filter(x=>['QB','RB','WR','TE','K'].includes(x.position)&&x.name).map(x=>x.name).slice(0,30),season=Number(window.dbNflSeason||2026),week=Number(window.dbNflWeek||7);
 const sources=[['actions',()=>fetchReport('NFL_ROSTER_ACTIONS.json')],['catalysts',()=>fetchReport('WAIVER_CATALYSTS.json')],['availability',()=>fetchReport('AVAILABILITY_INTELLIGENCE.json')],['week',()=>fetch('/api/nfl-week?season='+season+'&week='+week).then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})],['news',()=>fetch('/api/gameday-news?names='+encodeURIComponent(names.join(','))).then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})]];
 const settled=await Promise.allSettled(sources.map(x=>x[1]()));let errors=[];
 settled.forEach((r,i)=>{if(r.status==='fulfilled')pfo50Gameday[sources[i][0]]=r.value;else errors.push(sources[i][0]+': '+String(r.reason?.message||r.reason).slice(0,90));});
 pfo50Gameday.errors=errors;pfo50Gameday.attempted_at=new Date().toISOString();pfo50Gameday.busy=false;pfo50RenderGameday();
}
$('pfo50-gameday-refresh')?.addEventListener('click',()=>pfo50LoadGameday(true));
setTimeout(()=>pfo50LoadGameday(),4800);
// No duplicate background gameday load; on-demand and periodic refresh remain.
setInterval(()=>{if(!document.hidden)pfo50LoadGameday()},360000);
setInterval(()=>{if(!document.hidden&&document.querySelector('#overview.page.active'))pfo50RenderGameday()},60000);

/* FFO 5.1 major intelligence review build: source-labelled, read-only.
 * This module uses the 5.0 league, stat, injury and evidence state already loaded.
 * No fake coach quotes, live scores or projected fantasy points. */
const PFO51_STORE='pfo51-deltas-v1';
const pfo51Escape=e;
const pfo51Fmt=(v,d=1)=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toFixed(d);
const pfo51Week=()=>Number(window.dbNflWeek||gm47Snapshot?.nfl_state?.week||7);
const pfo51Season=()=>Number(window.dbNflSeason||2026);
function pfo51ReadStore(){try{const x=JSON.parse(localStorage.getItem(PFO51_STORE)||'null');return x&&x.schema===1?x:null;}catch{return null;}}
let pfo51Changes=pfo51ReadStore();
function pfo51Save(){try{localStorage.setItem(PFO51_STORE,JSON.stringify(pfo51Changes));}catch{}}
function pfo51ShortDate(x){if(!x)return 'Date not confirmed';const d=new Date(x);return Number.isFinite(d.getTime())?d.toLocaleString():'Date not confirmed';}
function pfo51Link(id){return pfo49Link(id);}
function pfo51PlayerSummary(id){
 const p=pfo49Info(id),row=pfo50StatsFor(id),latest=row?.latest||null,week=Number(latest?.week||0);
 const observed=pfo49Observed(id),official=observed[week],historical=Object.entries(observed).filter(([w])=>Number(w)<pfo51Week());
 const finalPts=official?.points??(latest?pfo50Score(latest):null),label=official?'Recorded FFL':'NFL stat reconstruction*';
 const avgOfficial=historical.length?historical.reduce((s,[,x])=>s+Number(x.points||0),0)/historical.length:null;
 const avgRecon=Array.isArray(row?.games)&&row.games.length?row.games.map(g=>pfo50Score(g.stats)).filter(Number.isFinite):[];
 const avg=avgOfficial??(avgRecon.length?avgRecon.reduce((a,b)=>a+b,0)/avgRecon.length:null),avgLabel=avgOfficial!=null?'League-scored avg':'Reconstructed avg*';
 const key=p.position||row?.position||'',stats=latest||{};
 const metrics=[];
 if(key==='QB')metrics.push(['Pass',stats.pass_cmp!=null&&stats.pass_att!=null?stats.pass_cmp+'/'+stats.pass_att:'—'],['Incmp',stats.pass_inc],['Pass yds',stats.pass_yd],['Rush yds',stats.rush_yd],['Pass TD',stats.pass_td]);
 else if(key==='RB')metrics.push(['Rush att',stats.rush_att],['Rush yds',stats.rush_yd],['Targets',stats.targets],['Catches',stats.rec],['Rec yds',stats.rec_yd]);
 else if(key==='WR'||key==='TE')metrics.push(['Targets',stats.targets],['Catches',stats.rec],['Rec yds',stats.rec_yd],['Target share',stats.target_share_pct==null?null:stats.target_share_pct+'%'],['Rush yds',stats.rush_yd]);
 const total=(metric)=>Array.isArray(row?.games)&&row.games.some(g=>g.stats?.[metric]!=null)?row.games.reduce((v,g)=>v+Number(g.stats?.[metric]||0),0):null;
 if(key==='QB')metrics.push(['Season pass yds',total('pass_yd')]);
 else if(key==='RB')metrics.push(['Season rush yds',total('rush_yd')],['Season rec yds',total('rec_yd')]);
 else if(key==='WR'||key==='TE')metrics.push(['Season rec yds',total('rec_yd')],['Season catches',total('rec')]);
 const snaps=pfo49Metric(id)?.snap_share_pct;
 if(snaps!=null&&['RB','WR','TE','QB'].includes(key))metrics.push(['Snap %',pfo51Fmt(snaps,0)+'%']);
 return {id,p,row,latest,week,finalPts,label,avg,avgLabel,forecast:pfo50Estimate(id),metrics};
}
function pfo51MetricStat(label,value){return '<div class="pfo51-stat"><span>'+pfo51Escape(label)+'</span><b>'+pfo51Escape(value==null?'—':value)+'</b></div>';}
function pfo51SnapshotHTML(id,compact=false){
 const s=pfo51PlayerSummary(id),all=[[s.week?'Week '+s.week+' FFL pts':'Latest FFL pts',pfo51Fmt(s.finalPts,1)],['Season PPG*',pfo51Fmt(s.avg,1)],['Next FFO baseline*',pfo51Fmt(s.forecast,1)],...s.metrics.map(([k,v])=>[k,v])];
 return '<div class="pfo51-universal '+(compact?'compact':'')+'"><div class="pfo51-universal-grid">'+all.map(([label,v])=>pfo51MetricStat(label,v)).join('')+'</div><small>'+pfo51Escape(s.row?'Latest NFL stat week '+s.week+' · '+s.label+' · '+s.avgLabel+'.':'Independent weekly data unavailable.')+' *Independent reconstructed points/season averages are estimates where no recorded FFL score exists. Forecast is recent-form baseline, not opponent-adjusted.</small></div>';
}
// Keep one consistent stat treatment in existing waiver/trade/profile contexts.
pfo50StatsStrip=function(id){return pfo51SnapshotHTML(id,false);};
// Radar cards now show box-score lines before clicking, position-appropriate workload,
// and verified role context rather than headline count masquerading as a confidence score.
pfo49SignalHTML=function(x){const s=pfo51PlayerSummary(x.id),m=x.m||{},p=x.p;
 const mainLabel=p.position==='QB'?'Pass attempts':p.position==='RB'?'Rushing attempts':'Targets';
 const mainValue=p.position==='QB'?(s.latest?.pass_att??m.pass_att_per_game):p.position==='RB'?(s.latest?.rush_att??null):(s.latest?.targets??null);
 const change=x.volumeChange,delta=x.difference,sourceContext=pfo49CoachData(x.id),clubContext=sourceContext?.primary_source?.url;
 const reason=[];
 if(change!=null&&change>0)reason.push(mainLabel+' rose '+change+' from prior observed game');
 if(delta!=null&&delta>=10)reason.push('snap share '+pfo51Fmt(delta,0)+' percentage points above season average');
 if(!reason.length)reason.push('published playing-time sample; more evidence required to establish a breakout');
 let html='<article class="pfo49-radar-item pfo51-radar-card"><div class="pfo49-row"><div><strong>'+pfo51Link(x.id)+'</strong><div class="muted">'+e(p.position)+' · '+e(p.team)+' · '+(leagueOwnedIds?'Checked unrostered':'Ownership unverified')+'</div></div><button type="button" class="pfo49-pin" data-pfo49-pin="'+e(x.id)+'">'+(pfo49Pins.has(x.id)?'★ Watching':'☆ Watch')+'</button></div>';
 html+=pfo51SnapshotHTML(x.id,false);
 html+='<p class="pfo51-reason"><b>Why watch:</b> '+e(reason.join('; '))+'.</p>';
 if(clubContext)html+='<div class="pfo51-sourced">Club-sourced context ('+e(sourceContext.event_at||'date unavailable')+'): '+e(sourceContext.event||'Roster development')+' '+pfo50GamedayLink(clubContext,'Official team source')+'<small>Potential effect: '+e(sourceContext.impact||'Unverified')+'</small></div>';
 else html+='<p class="pfo49-small">No directly verified club role statement attached. Do not treat an article headline as a coach quote.</p>';
 return html+'</article>';
};
function pfo51FixRosterRows(){
 for(const id of ['actual-lineup','actual-bench','actual-reserve']){
 const el=$(id);if(!el)continue;
 for(const tr of el.querySelectorAll('tr')){
  const btn=tr.querySelector('[data-pfo49-id]');if(!btn||tr.querySelector('.pfo51-inline'))continue;
  const playerId=btn.dataset.pfo49Id,s=pfo51PlayerSummary(playerId),tip=document.createElement('div');
  tip.className='pfo51-inline';tip.textContent='W'+(s.week||'—')+' '+pfo51Fmt(s.finalPts,1)+' pts · Avg '+pfo51Fmt(s.avg,1)+' · Next '+pfo51Fmt(s.forecast,1)+'*';
  tip.title='FFL scoring when available; otherwise reconstructed NFL stats and experimental forecast';btn.parentNode.appendChild(tip);
 }
 }
}
function pfo51CurrentOpponent(){
 const w=pfo51Week();let games=pfo49LiveMatchupWeek===w&&pfo49LiveMatchups||gm47HistorySnapshot?.matchups_by_week?.[String(w)]||[];
 const ours=games.find(x=>Number(x.roster_id)===1),other=ours&&games.find(x=>Number(x.matchup_id)===Number(ours.matchup_id)&&Number(x.roster_id)!==1);
 if(!other)return null;
 const mr=gm47Snapshot?.rosters?.find(x=>Number(x.roster_id)===Number(other.roster_id));const usr=gm47Snapshot?.users?.find(x=>String(x.user_id)===String(mr?.owner_id));
 const name=usr?.metadata?.team_name||usr?.display_name||'Roster '+other.roster_id;
 return {name,roster:mr,points:other.points,starters:other.starters||[],week:w};
}
function pfo51RosterForBrief(){
 if(Array.isArray(liveRosterSnapshot?.players)&&liveRosterSnapshot.players.length){return {players:liveRosterSnapshot.players,starters:liveRosterSnapshot.starters||[],source:'Live Sleeper roster',checked_at:liveRosterSnapshot.checked_at};}
 // Cached league data is a clearly labeled fallback, never called live.
 const t=Date.parse(gm47Snapshot?.fetched_at_utc||''), roster=gm47Snapshot?.rosters?.find(x=>Number(x.roster_id)===1);
 if(roster&&Number.isFinite(t)&&Date.now()-t>=-60_000&&Date.now()-t<6*3600_000&&Array.isArray(roster.players)){
  const players=roster.players.map(pid=>{const p=pfo49Info(pid);return {player_id:String(pid),name:p.name,team:p.team,position:p.position,sleeper_injury_status:null};});
  return {players,starters:(roster.starters||[]).map(String),source:'Cached Sleeper league snapshot — not a live refresh',checked_at:gm47Snapshot.fetched_at_utc};
 }
 return {players:[],starters:[],source:'Roster connection unavailable',checked_at:null};
}
function pfo51OpponentPreview(opp){
 if(!opp?.starters?.length)return '<p>Opponent starter submissions are unavailable; no starters inferred.</p>';
 const items=opp.starters.filter(id=>String(id)!=='0').map(id=>({id:String(id),p:pfo49Info(id),proj:pfo50Estimate(id)}));
 const measured=items.filter(x=>x.proj!=null),sum=measured.reduce((v,x)=>v+x.proj,0);
 let html='<ul class="pfo51-opponent-list">'+items.slice(0,12).map(x=>'<li>'+pfo51Link(x.id)+'<small>'+e(x.p.position||'Unverified position')+' · FFO baseline '+pfo51Fmt(x.proj,1)+'* FFL points</small></li>').join('')+'</ul>';
 html+='<p class="pfo51-fine">'+e(measured.length)+' of '+e(items.length)+' submitted players have an independent model baseline'+(measured.length===items.length?' · '+pfo51Fmt(sum,1)+' combined baseline FFL points':' · total withheld because coverage is incomplete')+'. *Not an opponent-adjusted projection or a prediction of future manager actions.</p>';
 return html;
}
function pfo51BriefSection(title,html,subtitle=''){
 return '<div class="pfo51-brief-section"><div class="pfo51-brief-title">'+e(title)+'</div>'+html+(subtitle?'<small>'+e(subtitle)+'</small>':'')+'</div>';
}
function pfo51SourceHealth(){const refs=[['Roster',liveRosterSnapshot?.checked_at||gm47Snapshot?.fetched_at_utc],['NFL stats',pfo50Independent?.checked_at],['Official report',nflVerified?.checked_at],['Club intel',pfo50Gameday.actions?.reviewed_at_utc]];
 return refs.map(([a,b])=>'<span>'+e(a)+': '+e(b?pfo51ShortDate(b):'not confirmed')+'</span>').join(' · ');
}
function pfo51LatestScore(){const w=pfo51Week();const h=gm47HistorySnapshot?.matchups_by_week||{};const cur=(pfo49LiveMatchupWeek===w?pfo49LiveMatchups:h[String(w)])||[];return cur.find(x=>Number(x.roster_id)===1)||null;}
function pfo51Briefing(){
 const el=$('briefing');if(!el)return;
 const week=pfo51Week(),briefRoster=pfo51RosterForBrief(),roster=briefRoster.players,starters=briefRoster.starters,opp=pfo51CurrentOpponent();
 const ids=new Set(starters.map(String)),userRecord=gm47Snapshot?.rosters?.find(x=>Number(x.roster_id)===1)?.settings;
 const record=userRecord?userRecord.wins+'–'+userRecord.losses:'Not synced';
 const official=(nflVerified?.players||[]),officialFlags=roster.flatMap(p=>official.filter(o=>normPlayer(o.name)===normPlayer(p.name)&&/^(out|doubtful|questionable)$/i.test(String(o.game_status||''))).map(o=>({p,o})));
 const fantasyFlags=roster.filter(p=>/^(IR|PUP|out|doubtful|questionable)$/i.test(String(p.sleeper_injury_status||'')));
 const top=pfo49TopWatch().slice(0,3),mode=pfo49Mode;
 let h='<div class="pfo49-row pfo51-heading"><div><h2>Coach’s '+(mode==='morning'?'Morning':mode==='pregame'?'Pregame':'Postgame')+' Briefing</h2><p class="pfo49-small">Week '+e(week)+' · Dirty Birds · '+e(pfo51ShortDate(new Date()))+'</p></div><div class="pfo51-record"><b>'+e(record)+'</b><small>Dirty Birds record · Sleeper</small></div></div>';
 h+='<div class="pfo49-filters">'+[['morning','Morning'],['pregame','Pregame'],['postgame','Postgame']].map(([v,l])=>'<button type="button" data-pfo49-mode="'+v+'" class="'+(mode===v?'on':'')+'">'+l+'</button>').join('')+'</div>';
 h+='<p class="pfo51-fine">Roster data: '+e(briefRoster.source)+' · '+e(pfo51ShortDate(briefRoster.checked_at))+'</p>';
 h+='<div class="pfo49-brief-kpis">'+[
 ['Starters',roster.length?starters.length:'Not synced'],['Rostered',roster.length?roster.length:'Not synced'],['Flagged',roster.length?new Set([...fantasyFlags.map(x=>x.player_id),...officialFlags.map(x=>x.p.player_id)]).size:'Not synced'],['Available radar',pfo50Independent&&leagueOwnedIds?pfo49RadarPool().length:'Not verified']].map(([a,b])=>'<div><b>'+e(b)+'</b><small>'+e(a)+'</small></div>').join('')+'</div>';
 const cur=pfo51LatestScore();if(cur&&cur.points!=null)h+='<div class="pfo49-score-guide">Week '+week+' recorded FFL points: <b>'+pfo51Fmt(cur.points,2)+'</b> · '+e(pfo51ShortDate(pfo49LiveMatchupAt||gm47HistorySnapshot?.fetched_at_utc))+' · Game may still be in progress; not a guaranteed final result.</div>';
 if(mode==='morning'){
  h+=pfo51BriefSection('1 · Availability and lineup',roster.length?'<p>'+e(starters.length)+' submitted starters · '+e(fantasyFlags.length)+' Sleeper injury tag(s) · '+e(officialFlags.length)+' official injury-report designation(s). <b>These are not verified game-day inactives.</b></p>':'<p>Current roster data unavailable. No health conclusion is made.</p>');
  if(officialFlags.length)h+='<p class="pfo51-sublist">'+officialFlags.slice(0,5).map(({p,o})=>e(p.name)+': '+e(o.game_status)).join(' · ')+'</p>';
  const topList=top.map(x=>{const s=pfo51PlayerSummary(x.id);return '<div class="pfo51-brief-player">'+pfo51Link(x.id)+' <small>W'+e(s.week||'—')+' '+pfo51Fmt(s.finalPts,1)+' pts · Next '+pfo51Fmt(s.forecast,1)+' baseline · '+(x.p.position==='QB'?'Pass attempts':x.p.position==='RB'?'Carries':'Targets')+' '+e((x.p.position==='QB'?s.latest?.pass_att:x.p.position==='RB'?s.latest?.rush_att:s.latest?.targets)??'—')+'</small></div>';}).join('');
  h+=pfo51BriefSection('2 · Developing opportunities',topList||'<p>Independent radar has no current qualified player observations. Missing data is not proof that no opportunity exists.</p>','Radar players are unrostered only when a current ownership snapshot is present.');
  const club=(pfo50Gameday.actions?.records||[]).filter(x=>roster.some(p=>normPlayer(p.name)===normPlayer(x.name))).slice(0,3);
  h+=pfo51BriefSection('3 · Confirmed team developments',club.length?club.map(x=>'<p><b>'+e(x.name)+'</b> · '+e(x.description||x.action_code)+' '+pfo50GamedayLink(x.source_url,'Team source')+' <small>'+e(x.date||'Date unavailable')+'</small></p>').join(''):'<p>No roster-matched dated club event in the currently connected curated feed. This does not rule out breaking developments.</p>');
  const unseen=pfo51Changes?.unread?.length||0;
  h+=pfo51BriefSection('4 · Since your last check','<p>'+e(unseen)+' new material source/change event(s) on this browser. '+(unseen?'<button class="pfo49-text-btn" data-pfo51-viewchanges="1">Review changes</button>':'New changes will appear below the inactive board after the source refreshes.')+'</p>');
 }else if(mode==='pregame'){
  h+=pfo51BriefSection('1 · Official inactive verification','<p>Inactive board stays immediately beneath the briefing. Confirm only named, current-week official inactives; an injury report marked “Questionable” is not an inactive list.</p>');
  const toCheck=roster.filter(p=>ids.has(String(p.player_id))&&(/^(IR|PUP|out|doubtful|questionable)$/i.test(String(p.sleeper_injury_status||''))||officialFlags.some(o=>o.p.player_id===p.player_id)));
  h+=pfo51BriefSection('2 · Submitted starter checks',roster.length?'<p>'+e(starters.length)+' starters submitted. '+e(toCheck.length)+' starter(s) have an injury tag or official report designation requiring review.</p>'+(toCheck.length?'<p class="pfo51-sublist">'+toCheck.slice(0,6).map(x=>pfo51Link(x.player_id)).join(' · ')+'</p>':'<p>No starter injury flags in currently checked reports; this does not certify availability.</p>'):'<p>Starter data not loaded. Comparison unavailable until Sleeper confirms roster.</p>');
  h+=pfo51BriefSection('3 · Opponent preparation',opp?'<p><b>'+e(opp.name)+'</b> · '+e(opp.starters.length)+' submitted players in Week '+week+'.'+(opp.points!=null?' Currently recorded FFL points: '+pfo51Fmt(opp.points,2)+'.':'')+'</p>'+pfo51OpponentPreview(opp):'<p>The current-week opponent matchup has not been confirmed from league matchups. No opponent inferred.</p>');
  const games=(pfo50Gameday.week?.games||[]).filter(g=>roster.some(p=>p.team&&[g.home,g.away].map(gm47CanonicalTeam).includes(gm47CanonicalTeam(p.team)))).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  h+=pfo51BriefSection('4 · Kickoffs, quarterbacks and weather',games.length?games.slice(0,5).map(g=>'<p><b>'+e(g.away)+' @ '+e(g.home)+'</b> · '+e(pfo51ShortDate(g.date))+' · '+e(g.status||'status unavailable')+(g.weather?' · '+e(g.weather):' · Stadium weather unverified')+'</p>').join(''):'<p>Current sourced game schedule/weather context unavailable.</p>','Quarterback changes and workload restrictions require direct team/NFL verification; no inference from silence.');
 }else{
  const doneWeek=Math.max(1,week-1),rows=gm47HistorySnapshot?.matchups_by_week?.[String(doneWeek)]||[],ours=rows.find(x=>Number(x.roster_id)===1),oppDone=ours&&rows.find(x=>Number(x.roster_id)!==1&&x.matchup_id===ours.matchup_id);
  h+=pfo51BriefSection('1 · Completed matchup',ours?.points!=null?'<p><b>Week '+doneWeek+': '+pfo51Fmt(ours.points,2)+' actual FFL points.</b> '+(oppDone?.points!=null?'Opponent: '+pfo51Fmt(oppDone.points,2)+' pts · '+(ours.points>oppDone.points?'Scored more':ours.points<oppDone.points?'Scored fewer':'Tied')+' by '+pfo51Fmt(Math.abs(ours.points-oppDone.points),2)+' points.':'Opponent score not yet confirmed.')+'</p>':'<p>Last completed FFL week not confirmed by the historical matchup source.</p>');
  const sc=ours&&Object.entries(ours.players_points||{}).filter(([id])=>ours.starters?.map(String).includes(String(id))).map(([id,pts])=>({id,pts:Number(pts)})).filter(x=>Number.isFinite(x.pts)).sort((a,b)=>b.pts-a.pts).slice(0,4);
  h+=pfo51BriefSection('2 · Highest-scoring submitted starters',sc?.length?sc.map(x=>'<p>'+pfo51Link(x.id)+' · <b>'+pfo51Fmt(x.pts,2)+' FFL pts</b></p>').join(''):'<p>Finalized individual starter score detail unavailable.</p>');
  const stats=roster.map(p=>({p,record:pfo50StatsFor(p.player_id)})).filter(x=>x.record?.latest&&x.record.latest.week>=doneWeek);
  h+=pfo51BriefSection('3 · Workloads to review',stats.slice(0,4).map(({p,record})=>'<p>'+pfo51Link(p.player_id)+' · '+(p.position==='QB'?'Attempts '+e(record.latest.pass_att??'—'):p.position==='RB'?'Carries '+e(record.latest.rush_att??'—'):'Targets '+e(record.latest.targets??'—'))+' · source Week '+e(record.latest.week)+'</p>').join('')||'<p>No recent independently sourced workload observations loaded.</p>');
  h+=pfo51BriefSection('4 · Next actions','<p>Review injuries, role shifts, next NFL opponents, waiver eligibility and FAAB. Our model cannot claim proven prediction accuracy without properly archived pregame forecasts.</p>');
 }
 h+='<div class="pfo51-sources"><b>Source freshness</b> · '+pfo51SourceHealth()+'<br>Published information may lag ingestion. Stats and role forecasts are not official medical or lineup declarations.</div>';
 h+='<div class="pfo49-quicklinks"><button type="button" data-pfo49-go="availability">Injury Watch</button><button type="button" data-pfo49-go="radar">Opportunity Radar</button><button type="button" data-pfo49-go="ask">Ask Front Office</button></div>';
 el.innerHTML=h;
}
renderBriefing=pfo51Briefing;
// Position-aware radar; QB evidence must be pass attempts/dropbacks, never targets/game.
const pfo51OriginalSignal=pfo49Signal;
pfo49Signal=function(id){const x=pfo51OriginalSignal(id);if(!x)return null;const p=x.p;
 if(p.position==='QB'){
  const pass=pfo50StatsFor(id)?.latest?.pass_att??x.m?.pass_att_per_game;
  if(!Number.isFinite(Number(pass))||Number(pass)<8)return null;
  // Eliminate the QB receiving-target signal from ranking and its descriptive outputs.
  x.targets=null;x.points=(Number(pass)*.45)+Math.max(0,x.snap||0)*.14+Math.max(-15,Math.min(25,Number(x.volumeChange||0)*2));
 }
 const n=pfo50StatsFor(id)?.games?.length||0;
 const coach=pfo49CoachData(id);
 if(n<2&&(x.difference==null||x.difference<12)&&!coach)return null;
 // This score is a relative research ordering, never a calibrated breakout probability.
 x.points=(Math.max(0,x.volumeChange||0)*3)+(Math.max(0,x.difference||0)*.8)+(coach?12:0)+(n>=3?5:0);
 return x;
};
function pfo51CollectChanges(){
 const rows=[],w=pfo51Week(),roster=liveRosterSnapshot?.players||[];
 for(const p of roster){
 const status=String(p.sleeper_injury_status||'').trim();
 if(status&&/^(out|questionable|doubtful|ir|pup)$/i.test(status))rows.push({id:'tag:'+p.player_id+':'+status,kind:'Fantasy status',date:liveRosterSnapshot?.checked_at||'',name:p.name,detail:'Sleeper injury tag: '+status+' (not an official inactive)',severity:'verify'});
 if(pfo49Schedule?.complete&&p.team&&pfo49Schedule.teams?.[gm47CanonicalTeam(p.team)]){
  for(const ww of [w,w+1].filter(x=>x<=18)){
   if(!pfo49ScheduleWeek({team:p.team},ww))rows.push({id:'bye:'+p.player_id+':'+ww,kind:'NFL bye-week schedule',date:pfo49Schedule.as_of||'',name:p.name,detail:'Team '+p.team+' has no scheduled NFL game in Week '+ww+' per checked full-season schedule. This is not a game-day inactive report.',severity:'observed'});
  }
 }
}
 // Do not re-issue stale NFL report rows as "new Week N" alerts. The 5.0
 // table parser lacks a report-game identifier; only source-scoped events qualify.
 if(Number(nflVerified?.report_week)===w&&Number(nflVerified?.report_season)===pfo51Season()){
  for(const o of (nflVerified.players||[])){
   const p=roster.find(p=>normPlayer(p.name)===normPlayer(o.name));if(!p||!/^(Out|Questionable|Doubtful)$/i.test(String(o.game_status||'')))continue;
   rows.push({id:'report:'+w+':'+p.player_id+':'+o.game_status,kind:'Official injury report',date:nflVerified.checked_at,name:p.name,detail:'Week '+w+' designation: '+o.game_status+' · practice '+(o.practice_status||'not reported'),severity:'verify'});
  }
 }
 for(const x of pfo50Gameday.actions?.records||[]){if(!roster.some(p=>normPlayer(p.name)===normPlayer(x.name))||!pfo50GamedayFresh(x.date,9))continue;
  rows.push({id:'club:'+x.name+':'+x.date+':'+x.action_code,kind:'Club roster move',date:x.date,name:x.name,detail:x.description||x.action_code,source:x.source_url,severity:'verified'});
 }
 for(const x of pfo50Gameday.catalysts?.catalysts||[]){if(!pfo50GamedayFresh(x.event_at,9)||!x.primary_source?.url)continue;
  // Unrostered or rostered candidates can be meaningful only if on the research radar or own roster.
  const match=pfo49Players.find(p=>normPlayer(p.name)===normPlayer(x.player));if(!match)continue;
  rows.push({id:'catalyst:'+x.player+':'+x.event_at+':'+x.event_type,kind:'Opportunity event',date:x.event_at,name:x.player,detail:x.event+' · Projected impact: '+(x.impact||'not confirmed'),source:x.primary_source.url,severity:'verified'});
 }
 for(const x of (pfo50Gameday.news?.items||[]).slice(0,15)){
  if(!pfo50GamedayFresh(x.published_at,4)||!x.url||!x.players?.some(n=>roster.some(p=>normPlayer(p.name)===normPlayer(n))))continue;
  rows.push({id:'lead:'+x.url,kind:'News lead · unverified content',date:x.published_at,name:(x.players||[]).join(', '),detail:String(x.title||'New article').slice(0,200),source:x.url,severity:'lead'});
 }
 for(const x of pfo49RadarPool().slice(0,22)){
  const increase=x.volumeChange??0,role=x.difference??0,metric=x.p.position==='QB'?'Pass attempts':x.p.position==='RB'?'Rush attempts':'Targets';
  if(increase<3&&role<15)continue;
  rows.push({id:'role:'+x.id+':'+x.newestWeek+':'+Math.sign(increase)+':'+(role>=15),kind:'Measured workload',date:pfo49Metrics?.as_of,name:x.p.name,detail:'W'+x.newestWeek+' '+metric+(increase>0?' increased by '+increase+' vs prior recorded game':' not confirmed higher')+(role>=15?' · snap share '+pfo51Fmt(role,0)+' pp above season average':'')+' · observed, not a future guarantee',severity:'observed'});
 }
 return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
function pfo51UpdateChanges(){const rosterReady=Array.isArray(liveRosterSnapshot?.players)&&liveRosterSnapshot.players.length>0;
 // First baseline waits for a completed news/club-source attempt and published usage.
 // Otherwise a late initial load would incorrectly mark old news as newly breaking.
 if(!rosterReady||!pfo50Gameday.attempted_at||!pfo49Metrics?.players)return;
 const candidates=pfo51CollectChanges();
 if(!pfo51Changes){pfo51Changes={schema:1,known:candidates.map(x=>x.id),unread:[],first_seen:new Date().toISOString(),last_seen:new Date().toISOString()};pfo51Save();return;}
 const known=new Set(pfo51Changes.known||[]);const unread=new Map((pfo51Changes.unread||[]).map(x=>[x.id,x]));
 for(const x of candidates)if(!known.has(x.id)){known.add(x.id);unread.set(x.id,x);}
 pfo51Changes.known=[...known].slice(-350);pfo51Changes.unread=[...unread.values()].slice(-40);pfo51Changes.last_seen=new Date().toISOString();pfo51Save();
}
function pfo51RenderChanges(){const el=$('pfo51-changes');if(!el)return;
 if(!liveRosterSnapshot?.players?.length){el.innerHTML='<p class="muted">Waiting for a current roster before recording changes. No assumptions.</p>';return;}
 const events=pfo51Changes?.unread||[];
 const footer='<small>Device-local history only: a new browser starts a fresh baseline. Material changes appear after a successful connected feed refresh, not through an always-on background push. Sources may lag real-world reports.</small>';
 el.innerHTML='<div class="pfo49-row"><div><h2>What changed since your last check</h2><p class="pfo49-small">'+e(events.length)+' unread recorded source developments · First observed '+e(pfo51ShortDate(pfo51Changes?.first_seen))+'</p></div><button type="button" id="pfo51-markread" class="pfo49-pin" '+(!events.length?'disabled':'')+'>Mark read</button></div>'+
 (events.length?'<div class="pfo51-alerts">'+events.slice(0,12).map(x=>'<div class="pfo51-alert"><div><b>'+e(x.kind)+' · '+e(x.name)+'</b> <small>'+e(pfo51ShortDate(x.date))+'</small></div><p>'+e(x.detail)+'</p>'+(x.source?pfo50GamedayLink(x.source,'Original source'):'')+'<small>'+e(x.severity==='verified'?'Dated source event; current role or health still requires checking':x.severity==='observed'?'Measured source trend; not a guarantee':x.severity==='lead'?'Unverified headline lead. Read article before relying on its claims':'Requires current official game-day confirmation')+'</small></div>').join('')+'</div>':'<p class="pfo51-empty">No unread changes from the connected feeds. This does not certify that nothing happened elsewhere.</p>')+footer;
 $('pfo51-markread')?.addEventListener('click',()=>{pfo51Changes.unread=[];pfo51Save();pfo51RenderChanges();renderBriefing();});
}
function pfo51FindPlayers(q){const p=pfo49Players.length?pfo49Players:pfo49Dir();let pos=(q.match(/\b(QBS?|RBS?|WRS?|TES?)\b/i)||[])[1]?.toUpperCase().replace(/S$/,'')||null;
 if(!pos){if(/receiver|wideout/i.test(q))pos='WR';else if(/running back/i.test(q))pos='RB';else if(/quarterback/i.test(q))pos='QB';else if(/tight end/i.test(q))pos='TE';}
 const wantAvailable=/available|free agent|unrostered|waiver|pickups?/i.test(q),wantOurs=/my roster|our roster|our players|dirty birds/i.test(q),trend=/rising|increas|grow|breakout|opportun|last 3|targets|snaps/i.test(q);
 const checked=!!leagueOwnedIds;const stale=checked&&(!ownershipCheckedMs||Date.now()-ownershipCheckedMs>5*60*1000);if(wantAvailable&&(!checked||stale))return {error:stale?'Ownership data is more than five minutes old. Refresh Sleeper before treating anyone as unrostered.':'Current FFL ownership has not loaded. Cannot certify free agents.'};
 let pool=p.filter(x=>pfo50Indexed.has(pfo50Key(x.name,x.team))&&['QB','RB','WR','TE'].includes(x.position)&&(!pos||x.position===pos)&&(!wantOurs||(liveRosterSnapshot?.players||[]).some(y=>String(y.player_id)===x.id))&&(!wantAvailable||!waiverIsRostered(x.name,x.id)));
 let entries=pool.map(x=>{const stat=pfo51PlayerSummary(x.id),sig=pfo49Signal(x.id);return {id:x.id,stat,sig};}).filter(x=>x.stat.row&&x.stat.week);
 if(trend)entries=entries.filter(x=>x.sig&&(x.sig.volumeChange>0||x.sig.difference>10));
 const lastThree=/last\s+(?:three|3)\s+(?:games|weeks)/i.test(q),mentionsSnaps=/\bsnap(?:s|%| share)?\b/i.test(q);
 if(trend&&lastThree)entries=entries.filter(x=>{
   const games=x.stat.row?.games?.slice(-3)||[];
   if(games.length<3)return false;
   const field=x.stat.p.position==='QB'?'pass_att':x.stat.p.position==='RB'?'rush_att':'targets';
   const v=games.map(g=>g.stats?.[field]);
   return v.every(n=>n!=null&&Number.isFinite(Number(n)))&&Number(v[0])<Number(v[1])&&Number(v[1])<Number(v[2]);
 });
 entries.sort((a,b)=>{
  const av=trend?((a.sig?.volumeChange||0)*2+Math.max(0,a.sig?.difference||0)):(a.stat.forecast??-9999);
  const bv=trend?((b.sig?.volumeChange||0)*2+Math.max(0,b.sig?.difference||0)):(b.stat.forecast??-9999);
  return bv-av;
 });
 return {entries:entries.slice(0,12),total:entries.length,pos,trend,lastThree,wantAvailable,checked,snapTrendUnsupported:mentionsSnaps&&trend};
}
function pfo51Ask(q){const area=$('pfo51-answer');if(!area)return;let query=String(q||'').trim().slice(0,300);if(!query){area.innerHTML='<p>Please enter a scouting question.</p>';return;}
 const detail='<p class="pfo51-fine">This is a deterministic search of connected data, not a general-purpose language model. It cannot read arbitrary articles, invent coach statements, or verify unpublished transactions.</p>';
 if(/since my last|what changed|new since/i.test(query)){pfo51RenderChanges();document.getElementById('pfo51-changes')?.scrollIntoView({behavior:'smooth'});area.innerHTML='<p>Opened your recorded change feed on the Overview.</p>'+detail;return;}
 if(/opponent|playing this week|opposing team/i.test(query)){
 const opp=pfo51CurrentOpponent();area.innerHTML=opp?'<h3>Week '+e(opp.week)+' FFL Opponent: '+e(opp.name)+'</h3><p>'+e(opp.starters.length)+' players submitted as starters in the current matched Sleeper snapshot. '+(opp.points!=null?'Recorded score: '+pfo51Fmt(opp.points,2)+' FFL points.':'Live points not yet verified.')+'</p>'+pfo51OpponentPreview(opp)+'<p>Opponent prep means understanding the opponent’s submitted starters, depth, late injury risks and positional pressure. This does not predict what their manager will do.</p>':'<p>The current Sleeper matchup pairing has not loaded, so opponent identity cannot be verified.</p>';area.innerHTML+=detail;return;
 }
 const queryNorm=normPlayer(query),matched=pfo49Players.filter(x=>queryNorm.includes(normPlayer(x.name))&&x.name.length>=5).sort((a,b)=>b.name.length-a.name.length);
 if(/compar|versus|\bvs\b/i.test(query)&&matched.length>=2){const a=matched[0],b=matched.find(x=>x.id!==a.id);if(b){area.innerHTML='<h3>Player research comparison</h3><div class="pfo51-two">'+[a,b].map(x=>'<div class="pfo51-box"><b>'+pfo51Link(x.id)+'</b>'+pfo51SnapshotHTML(x.id,true)+'</div>').join('')+'</div><p>Both sets of projections are independent recent-form baselines. Availability, future workload, opponent adjustments and coach reporting must be verified separately; no automatic lineup recommendation.</p>'+detail;return;}}
 if(/injur|questionable|doubtful|inactiv|IR\b|hurt/i.test(query)){
  const roster=liveRosterSnapshot?.players||[],official=nflVerified?.players||[];
  const rows=roster.map(p=>({p,o:official.find(x=>normPlayer(x.name)===normPlayer(p.name))})).filter(x=>x.o&&/^(Out|Questionable|Doubtful)$/i.test(x.o.game_status||'')||/^(Out|Questionable|Doubtful|IR|PUP)$/i.test(x.p.sleeper_injury_status||''));
  area.innerHTML='<h3>Roster injury checks</h3>'+(rows.length?rows.map(({p,o})=>'<p>'+pfo51Link(p.player_id)+' · '+e(o?'Official injury-report designation '+o.game_status:'Sleeper fantasy tag '+p.sleeper_injury_status)+'</p>').join(''):'<p>No roster-matched injury flag in the connected reports. This does not establish medical clearance.</p>')+'<p class="pfo51-fine">NFL report checked '+e(pfo51ShortDate(nflVerified?.checked_at))+' · official game-day inactive confirmation is a different source.</p>'+detail;return;
 }
 if(/coach quote|coach said|press conference|live play|full play.by.play|contract|league setting|draft board/i.test(query)){area.innerHTML='<p>That question requires a verified coach transcript, licensed live-play feed, or a separate league-management source. No such evidence is available in the current structured search, so I will not invent an answer.</p>'+detail;return;}
 const r=pfo51FindPlayers(query);
 if(r.error){area.innerHTML='<p>'+e(r.error)+'</p>';return;}
 area.innerHTML='<h3>Source-backed player search</h3><p>'+e(r.entries.length)+' of '+e(r.total)+' matching published-stat players'+(r.pos?' · '+e(r.pos):'')+(r.trend?' · measured increases only':'')+(r.wantAvailable?' · checked unrostered':'')+'</p>'+
 (r.entries.length?r.entries.map(x=>'<div class="pfo51-query-result"><b>'+pfo51Link(x.id)+'</b> · '+e(x.stat.p.position)+' '+e(x.stat.p.team)+'<div>Week '+e(x.stat.week)+': '+e(pfo51Fmt(x.stat.finalPts,1))+' FFL pts* · Season avg '+e(pfo51Fmt(x.stat.avg,1))+'* · Next baseline '+e(pfo51Fmt(x.stat.forecast,1))+'*</div><small>'+(x.sig?.volumeChange!=null?'Recent '+e(x.sig.volumeMetric.replaceAll('_',' '))+' change: '+e(x.sig.volumeChange):'No verifiable recent game-to-game workload change')+' · '+e(x.stat.label)+'</small></div>').join(''):'<p>No players meet the requested filter with supported data. Try a position or remove the trend condition.</p>')+
 (r.snapTrendUnsupported?'<p class="pfo51-fine"><b>Important:</b> These results use independently recorded targets/carries/attempts and available playing-time samples. Chronological snap growth is NOT independently verified by this search; a rising-snap request is not fully satisfied.</p>':'')+
 '<p class="pfo51-fine">Underlying statistics: nflverse weekly game feed, checked '+e(pfo51ShortDate(pfo50Independent?.checked_at))+' · FFL rules: Sleeper league settings. *Non-league reconstructed scoring and projections are estimates and can omit custom bonuses.</p>'+detail;
}
$('pfo51-ask-form')?.addEventListener('submit',event=>{event.preventDefault();pfo51Ask($('pfo51-question').value);});
document.addEventListener('click',event=>{const btn=event.target.closest('[data-pfo51-prompt],[data-pfo51-viewchanges]');if(!btn)return;
 if(btn.dataset.pfo51Prompt){$('pfo51-question').value=btn.dataset.pfo51Prompt;pfo51Ask(btn.dataset.pfo51Prompt);}
 if(btn.dataset.pfo51Viewchanges){$('pfo51-changes')?.scrollIntoView({behavior:'smooth'});}
});
// Keep source changes visible after asynchronous loads without overstating source availability.
function pfo51Tick(){try{pfo51FixRosterRows();pfo51UpdateChanges();pfo51RenderChanges();}catch(err){console.warn('FFO change-feed unavailable',err)}}
// Changes digest updates on-demand and on its regular 25s visible-page cycle.
setInterval(()=>{if(!document.hidden&&document.querySelector('#overview.page.active'))pfo51Tick()},25000);
// Original injury and player pages stay read-only. This build cannot convert an outdated
// questionable practice report into an official game-day active without specific evidence.

// Game Tracker is a read-only scoreboard client. A missing last-play excerpt is
// NOT silently filled in as live play-by-play, and scores may be provisional.
let pfo51GameFeed=null,pfo51GameFetchTime=0,pfo51GameError=null,pfo51GameBusy=false;
const pfo51SafeLink=u=>{try{const x=new URL(u);return x.protocol==='https:'?x.toString():null}catch{return null}};
function pfo51RenderGames(){const el=$('pfo51-games');if(!el)return;
 const games=pfo51GameFeed?.games||[];
 if(!games.length){el.innerHTML='<p class="pfo51-empty">'+e(pfo51GameError?'No usable scoreboard response: '+pfo51GameError:'No confirmed NFL game state available yet.')+'</p>';return;}
 const rosterTeams=new Set((liveRosterSnapshot?.players||[]).map(x=>gm47CanonicalTeam(x.team||'')));
 const sorted=[...games].sort((a,b)=>Number(rosterTeams.has(gm47CanonicalTeam(b.home))||rosterTeams.has(gm47CanonicalTeam(b.away)))-Number(rosterTeams.has(gm47CanonicalTeam(a.home))||rosterTeams.has(gm47CanonicalTeam(a.away)))||String(a.date).localeCompare(String(b.date)));
 const live=sorted.filter(g=>g.state==='in');
 let h='<p class="pfo49-small">'+(live.length?e(live.length)+' game(s) marked in progress by ESPN · ':'No games currently marked in progress by this source · ')+'Source checked '+e(pfo51ShortDate(pfo51GameFeed.checked_at))+'. Data may lag broadcasts.</p><div class="pfo51-scoregrid">';
 for(const g of sorted.slice(0,14)){
  const named=rosterTeams.has(gm47CanonicalTeam(g.home))||rosterTeams.has(gm47CanonicalTeam(g.away));
  const relevant=named?' · Dirty Birds roster matchup':'';
  const score=(['in','post'].includes(g.state)&&g.home_score!=null&&g.away_score!=null)?'<b>'+e(g.away)+' '+e(g.away_score)+' — '+e(g.home_score)+' '+e(g.home)+'</b>':'<b>'+e(g.away)+' @ '+e(g.home)+'</b>';
  const state=g.state==='in'?'In progress':g.state==='post'?'Final / completed per source':'Pregame / scheduled';
  h+='<div class="pfo51-scorecard">'+score+'<small>'+e(state)+' · '+e(g.status||'No clock state')+(g.state==='in'?' · Period '+e(g.period??'?')+' · '+e(g.clock||'clock unavailable'):'')+e(relevant)+'</small>';
  if(g.last_play)h+='<p><b>Most recent provider play excerpt:</b> '+e(g.last_play)+'</p>';
  if(/^\d{8,12}$/.test(String(g.id||'')))h+='<button class="pfo49-pin" type="button" data-pfo51-gameplays="'+e(g.id)+'">Recent provider plays</button><div id="pfo51-plays-'+e(g.id)+'" class="pfo51-gameplays" aria-live="polite"></div>';
  h+='</div>';
 }
 h+='</div><p class="pfo51-fine">This is an experimental read-only scoreboard integration, not licensed push play-by-play, not official game-day inactives, and not authoritative FFL fantasy scoring. Full-play streaming requires a licensed provider and backend adapter. Sportradar and SportsDataIO are integration candidates, NOT currently connected.</p>';
 el.innerHTML=h;
}
async function pfo51FetchGames(){if(pfo51GameBusy||!window.dbNflWeek)return;pfo51GameBusy=true;
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
 try{const r=await fetch('/api/nfl-week?season='+pfo51Season()+'&week='+pfo51Week(),{cache:'no-store',signal:ctrl.signal});if(!r.ok)throw Error('scoreboard HTTP '+r.status);const j=await r.json();if(!Array.isArray(j.games)||!j.games.length)throw Error('game states unavailable');pfo51GameFeed=j;pfo51GameError=null;pfo51GameFetchTime=Date.now();}
 catch(err){pfo51GameError=String(err.message||err);}finally{clearTimeout(timeout);pfo51GameBusy=false;pfo51RenderGames();}
}
async function pfo51LoadPlays(id){
 if(!/^\d{8,12}$/.test(String(id)))return;
 const el=document.getElementById('pfo51-plays-'+id);if(!el)return;
 el.innerHTML='<p class="pfo51-fine">Checking source play log…</p>';
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),11000);
 try{const res=await fetch('/api/game-plays?event_id='+encodeURIComponent(id),{cache:'no-store',signal:ctrl.signal});if(!res.ok)throw Error('Game play feed HTTP '+res.status);
  const j=await res.json();if(!Array.isArray(j.plays))throw Error('Unrecognized play data');
  el.innerHTML=(j.plays.length?'<ol class="pfo51-playlist">'+j.plays.map(p=>'<li><b>'+(p.period?'Q'+e(p.period)+' ':'')+e(p.clock||'')+'</b> '+e(p.text)+'</li>').join('')+'</ol>':'<p class="pfo51-fine">No usable play descriptions published for this game.</p>')+
   '<p class="pfo51-fine">ESPN game summary · checked '+e(pfo51ShortDate(j.checked_at))+' · Experimental third-party feed; not guaranteed live, complete, or final.</p>';
 }catch(err){el.innerHTML='<p class="pfo51-fine">Provider play log unavailable: '+e(String(err.message||err))+'. Game scoreboard above remains separate.</p>';}finally{clearTimeout(timer);}
}
document.addEventListener('click',event=>{const btn=event.target.closest('[data-pfo51-gameplays]');if(btn)pfo51LoadPlays(btn.dataset.pfo51Gameplays)});
$('pfo51-refreshgames')?.addEventListener('click',pfo51FetchGames);
setTimeout(pfo51FetchGames,5500);
setInterval(()=>{if(!document.hidden&&document.querySelector('#overview.page.active'))pfo51FetchGames()},60000);

// 5.0 QA correction: after an NFL box-score records genuine participation in
// the *same* game week, don't leave an old Questionable label as the headline.
// Participation is not medical clearance and never carries into the next week.
const pfo51LegacyInjuryView=updateInjuryView;
updateInjuryView=function(){pfo51LegacyInjuryView();const body=$('injuries');if(!body)return;
 const week=pfo51Week(),roster=liveRosterSnapshot?.players||[];
 for(const tr of body.querySelectorAll('tr')){
  const cell=tr.children[0],status=tr.children[1],detail=tr.children[2];if(!cell||!status||!detail)continue;
  const person=roster.find(p=>normPlayer(cell.textContent||'').startsWith(normPlayer(p.name)));
  if(!person)continue;
  const g=pfo50StatsFor(person.player_id)?.games?.find(x=>Number(x.week)===week);
  if(!g)continue;
  const st=g.stats||{},hasParticipation=['pass_att','rush_att','targets','rec'].some(k=>Number(st[k])>0);
  if(!hasParticipation)continue;
  const previous=status.textContent.trim();
  status.innerHTML='<b>Played · W'+e(week)+'</b><div class="pfo51-inline">NFL box-score participation recorded</div>';
  detail.innerHTML='<span class="pfo51-inline">'+e(previous)+' is an earlier injury-report/aggregator designation, not the latest game participation. Does not certify next-game availability.</span><div class="pfo49-small"><a href="https://github.com/nflverse/nflverse-data" target="_blank" rel="noopener noreferrer">Independent NFL stats source</a></div>';
 }
};

// 5.0 QA correction: do not manufacture different W15/W16/W17 forecasts from
// one baseline. Display it ONCE until opponent-adjusted model inputs exist.
pfo49RenderPlanner=function(){const el=$('pfo49-playoff-plan');if(!el)return;
 const roster=(liveRosterSnapshot?.players||[]).filter(p=>['QB','RB','WR','TE'].includes(p.position)),plan=roster.map(x=>({p:x,base:pfo50Estimate(x.player_id)})).sort((a,b)=>(b.base??-999)-(a.base??-999)).slice(0,16);
 let html='<div class="pfo49-row"><div><h2>Championship Schedule · Weeks 15–17</h2><p class="muted">Verified NFL opponents and ONE independent FFO recent-form baseline per player. We do not have a validated matchup-adjusted Week 15/16/17 forecast, so the same number is not copied into three misleading columns.</p></div><span class="roster-label forecast">SCENARIO RESEARCH</span></div>';
 html+='<div class="pfo49-table-wrap"><table class="pfo49-gamelog pfo49-report-table"><thead><tr><th>Player</th><th>FFO baseline*</th><th>W15 opponent</th><th>W16 opponent</th><th>W17 opponent</th></tr></thead><tbody>';
 for(const x of plan){const opp=w=>pfo49ScheduleWeek(pfo49Info(x.p.player_id),w)?.opponent||(pfo49Schedule?.complete?'BYE':'Not verified');
 html+='<tr><td>'+pfo49Link(x.p.player_id)+'</td><td>'+pfo49Num(x.base,1)+'*</td>'+[15,16,17].map(w=>'<td>'+e(opp(w))+'</td>').join('')+'</tr>';}
 html+='</tbody></table></div>';
 html+='<p class="pfo49-small">*The FFO baseline is reconstructed from published NFL player stats using the current FFL scoring settings; it is not adjusted for each playoff opponent, future injuries or role changes. No separate weekly points estimate is asserted until the necessary opponent-specific model is built and validated.</p>';
 const n=Number(pfo49Backtest?.completed_comparable_weeks)||0;
 html+='<details class="pfo49-disclose"><summary>Projection accountability ('+e(n)+' comparable archived week(s))</summary><div class="pfo49-panel">'+e(n?'Archived pregame comparison records are available.':'No validated historical forecast-error report yet. We need saved, pre-kickoff projections and final fantasy results.')+' <a href="https://github.com/Kodiak907/dirty-birds-sleeper-feed/blob/main/data/DECISION_BACKTEST.json" target="_blank" rel="noopener noreferrer">Audit source</a></div></details>';
 el.innerHTML=html;
};


/* FFO 5.2 — Historical Matchups, Lineup Lab, Coaching Review and source-safe QA.
   READ ONLY. Never submits lineups or transactions. */
const PFO52_WEEK_CACHE=new Map(),PFO52_PENDING=new Map();
let pfo52Week=Number(window.dbNflWeek||8),pfo52Scenario=null,pfo52Scenarios=[],pfo52LoadState='',pfo52ReviewBusy=false,pfo52ReviewEntries=[];
function pfo52Cur(){return Math.max(1,Math.min(18,Number(window.dbNflWeek||gm47Snapshot?.nfl_state?.week||8)));}
function pfo52Slots(){const positions=gm47Snapshot?.league?.roster_positions;
 const s=Array.isArray(positions)?positions.filter(x=>!['BN','IR','TAXI','RESERVE'].includes(String(x).toUpperCase())):[];
 return s.length?s:['QB','RB','RB','WR','WR','TE','FLEX','K','DEF'];}
function pfo52Pos(p){const x=String(p?.position||'').toUpperCase();return x==='DST'||x==='D/ST'?'DEF':x;}
function pfo52Legal(slot,p){const pos=pfo52Pos(p),sl=String(slot).toUpperCase();if(!pos||!sl)return false;
 if(sl==='FLEX')return ['RB','WR','TE'].includes(pos);
 if(sl==='SUPER_FLEX'||sl==='SUPERFLEX')return ['QB','RB','WR','TE'].includes(pos);
 if(sl==='WRRB_FLEX')return ['WR','RB'].includes(pos);
 if(sl==='REC_FLEX')return ['WR','TE'].includes(pos);
 if(sl==='IDP_FLEX')return ['DL','LB','DB'].includes(pos);
 return sl===pos;
}
function pfo52Info(id){let p=pfo49Info(id);const live=(liveRosterSnapshot?.players||[]).find(x=>String(x.player_id)===String(id));if(live&&(!p.name||p.name.startsWith('Player ')))p={...live,id:String(id)};
 if(!p.position&&(String(id).toUpperCase().startsWith('DEF')||/^[A-Z]{2,3}$/.test(String(id))))return {...p,name:gm47CanonicalTeam(id)+' D/ST',team:gm47CanonicalTeam(id),position:'DEF'};
 return p;
}
function pfo52Money(n,places=2){return n==null||!Number.isFinite(Number(n))?'—':Number(n).toFixed(places);}
function pfo52Hist(w){return PFO52_WEEK_CACHE.get(w)||(gm47HistorySnapshot?.season===Number(window.dbNflSeason||2026)?(gm47HistorySnapshot.matchups_by_week?.[String(w)]||null):null);}
async function pfo52GetWeek(w,force=false){const wk=Number(w);if(wk<1||wk>18)return null;
 if(!force&&PFO52_WEEK_CACHE.has(wk))return PFO52_WEEK_CACHE.get(wk);
 if(PFO52_PENDING.has(wk))return PFO52_PENDING.get(wk);
 const league=window.dbLeagueId||LEAGUE_ID_OVERRIDE;
 if(!league)return pfo52Hist(wk);
 const promise=(async()=>{try{const rows=await sleeperGet('/league/'+league+'/matchups/'+wk);if(!Array.isArray(rows)||rows.length<2)throw Error('No league matchup entries');
  PFO52_WEEK_CACHE.set(wk,rows); if(wk===pfo52Cur())pfo52RosterPoints();return rows;
 }catch(err){console.warn('Weekly Sleeper matchup',wk,String(err));return pfo52Hist(wk);}finally{PFO52_PENDING.delete(wk)}})();PFO52_PENDING.set(wk,promise);return promise;
}
function pfo52Match(w){const arr=pfo52Hist(w)||(w===pfo52Cur()&&Array.isArray(pfo49LiveMatchups)?pfo49LiveMatchups:null);if(!Array.isArray(arr))return null;
 const rid=Number(window.dbRosterId||1);const ours=arr.find(x=>Number(x.roster_id)===rid);
 const theirs=ours&&arr.find(x=>Number(x.roster_id)!==rid&&String(x.matchup_id)===String(ours.matchup_id)&&ours.matchup_id!=null);
 return {ours,theirs};}
function pfo52Owner(rid){const r=gm47Snapshot?.rosters?.find(x=>Number(x.roster_id)===Number(rid));const u=gm47Snapshot?.users?.find(x=>String(x.user_id)===String(r?.owner_id));return u?.metadata?.team_name||u?.display_name||('FFL roster '+rid);}
function pfo52Team(w,side){const match=pfo52Match(w),m=match?.[side];if(!m)return null;
 const isPast=w<pfo52Cur(),started=(m.starters||[]).map(String),ids=Array.isArray(m.players)&&m.players.length?m.players.map(String):started.filter(id=>id&&id!=='0');
 const completeRoster=Array.isArray(m.players)&&m.players.length>0;
 const players=[...new Set([...ids,...started.filter(id=>id!=='0')])];
 const score=m.points!=null&&Number.isFinite(Number(m.points))?Number(m.points):null;
 return {id:Number(m.roster_id),name:side==='ours'?'Dirty Birds':pfo52Owner(m.roster_id),members:players.map(id=>pfo52Info(id)),ids:players,starters:started,players_points:m.players_points||{},completeRoster,record:m,score,source:isPast?'Sleeper weekly matchup · recorded player ownership':'Sleeper weekly matchup',week:w};
}
function pfo52FutureTeam(rid){const r=gm47Snapshot?.rosters?.find(x=>Number(x.roster_id)===Number(rid));if(!r)return null;
 const live=Number(rid)===Number(window.dbRosterId||1)?liveRosterSnapshot:null;
 const ids=(live?.roster_player_ids||r.players||[]).map(String);
 const starters=(live?.starters||r.starters||[]).map(String);
 return {id:rid,name:Number(rid)===Number(window.dbRosterId||1)?'Dirty Birds':pfo52Owner(rid),members:ids.map(id=>pfo52Info(id)),ids,starters,players_points:{},completeRoster:true,score:null,record:r,source:live?'Sleeper live roster':'Latest Sleeper league roster · not a historical snapshot'};
}
function pfo52Points(id,w,past=false){if(past)return null;
 const p=pfo52Info(id);
 if(pfo49Schedule?.complete&&pfo52Pos(p)!=='DEF'&&!pfo49ScheduleWeek(p,w))return null;
 let baseline=pfo50Estimate(id),source='Independent nflverse FFO recent-form projection';
 if(baseline==null){ // Actual previous league-scored points are permitted as a transparent baseline for K/DST.
  const history=[];for(let wk=Math.min(w-1,pfo52Cur()-1);wk>=1&&history.length<4;wk--){const all=pfo52Hist(wk)||[];
   for(const m of all){if(m.players_points?.[String(id)]!=null){const n=Number(m.players_points[String(id)]);if(Number.isFinite(n))history.push(n);break;}}
  }
  if(history.length>=2){baseline=history.slice(0,3).reduce((a,b)=>a+b,0)/Math.min(3,history.length);source='Sleeper previous scored weeks · historical average';}
 }
 if(baseline==null)return {points:null,source:'No supported FFO baseline for this position/player',adjustment:null};
 // Adjustment requires observed opponent-specific defense data (no invented matchup factors).
 const opponent=pfo49ScheduleWeek(p,w)?.opponent;
 const adjusted=pfo52Pos(p)!=='K'&&pfo52Pos(p)!=='DEF'?pfo52DefenseAdjustment(pfo52Pos(p),opponent):null;
 return {points:baseline*(adjusted??1),source:source+(adjusted!=null?' · observed defensive allowance adjustment':' · no opponent adjustment'),adjustment:adjusted};
}
function pfo52DefenseAdjustment(pos,opponent){if(!opponent||!pfo50Independent?.players?.length)return null;
 if(!['QB','RB','WR','TE'].includes(pos))return null;
 const target=gm47CanonicalTeam(opponent),rows=new Map();
 for(const p of pfo50Independent.players){if(p.position!==pos)continue;
  for(const g of p.games||[]){const opp=gm47CanonicalTeam(g.opponent||'');if(!opp)continue;
   const points=pfo50Score(g.stats);if(!Number.isFinite(points))continue;
   const k=opp+'|'+g.week;rows.set(k,(rows.get(k)||0)+points);
  }
 }
 const teamMeans=new Map();for(const [k,v] of rows){const t=k.split('|')[0],a=teamMeans.get(t)||[];a.push(v);teamMeans.set(t,a);}
 const means=[...teamMeans.entries()].filter(([_,x])=>x.length>=3).map(([team,x])=>({team,mean:x.reduce((a,b)=>a+b,0)/x.length}));
 if(means.length<20)return null;
 const baseline=means.reduce((a,b)=>a+b.mean,0)/means.length,mine=means.find(x=>x.team===target);
 if(!mine||baseline<=0)return null;
 return Math.max(.85,Math.min(1.15,1+(.25*(mine.mean/baseline-1)))); // shrink noisy allowance observations by 75%.
}
function pfo52Value(team,id,w,past){if(past){const raw=team?.players_points?.[String(id)];return raw==null||!Number.isFinite(Number(raw))?null:Number(raw);}return pfo52Points(id,w)?.points??null;}
function pfo52Best(team,w,past=false){const slots=pfo52Slots(),eligible=(team?.members||[]).filter(p=>!(!past&&pfo52Pos(p)==='NA')).map(p=>({id:String(p.id||p.player_id),p,val:pfo52Value(team,String(p.id||p.player_id),w,past)}));
 // Dynamic maximum-weight bipartite matching using successive augmenting paths.
 // Unknown values cannot be silently treated as zero or as an optimal recommendation.
 const n=eligible.length,L=slots.length,N=2+n+L,src=N-2,snk=N-1,graph=Array.from({length:N},()=>[]);
 const edge=(a,b,cap,cost)=>{const x={to:b,rev:graph[b].length,cap,cost},y={to:a,rev:graph[a].length,cap:0,cost:-cost};graph[a].push(x);graph[b].push(y);};
 for(let i=0;i<n;i++){if(!Number.isFinite(eligible[i].val))continue;edge(src,i,1,0);for(let j=0;j<L;j++)if(pfo52Legal(slots[j],eligible[i].p))edge(i,n+j,1,-eligible[i].val);}
 for(let j=0;j<L;j++)edge(n+j,snk,1,0);
 for(let round=0;round<L;round++){const dist=Array(N).fill(Infinity),prev=Array(N).fill(-1),edgeIdx=Array(N).fill(-1),inq=Array(N).fill(false);dist[src]=0;const q=[src];inq[src]=true;
  for(let head=0;head<q.length;head++){const u=q[head];inq[u]=false;for(let k=0;k<graph[u].length;k++){const ed=graph[u][k];if(ed.cap>0&&dist[u]+ed.cost<dist[ed.to]-1e-9){dist[ed.to]=dist[u]+ed.cost;prev[ed.to]=u;edgeIdx[ed.to]=k;if(!inq[ed.to]){q.push(ed.to);inq[ed.to]=true;}}}}
  if(prev[snk]===-1)break;for(let v=snk;v!==src;v=prev[v]){const ed=graph[prev[v]][edgeIdx[v]];ed.cap--;graph[v][ed.rev].cap++;}
 }
 const assignments=slots.map((slot,j)=>{const x=graph[n+j].find(ed=>ed.to<n&&ed.cap===1);return {slot,id:x?eligible[x.to].id:null};});
 const known=assignments.filter(x=>x.id).length,sum=assignments.reduce((acc,x)=>acc+(x.id?pfo52Value(team,x.id,w,past)||0:0),0);
 return {assignments,known,required:slots.length,total:known?sum:null,complete:known===slots.length};
}
function pfo52Actual(team,w){const slots=pfo52Slots(),started=team?.starters||[];
 return {assignments:slots.map((slot,i)=>({slot,id:started[i]&&started[i]!=='0'?started[i]:null})),total:team?.score??null};
}
function pfo52Reconciles(team,w){if(!team||team.score==null)return false;const v=pfo52LineupScore(team,pfo52Actual(team,w).assignments,w,true);return v.complete&&Math.abs(v.total-team.score)<.05;}
function pfo52LineupScore(team,assignments,w,past){let total=0,count=0;for(const x of assignments){const v=x.id?pfo52Value(team,x.id,w,past):null;if(v!=null){total+=v;count++;}}
 return {total:count?total:null,complete:count===assignments.length,known:count};
}
function pfo52PointLabel(val,complete=true){return val==null?'—':pfo52Money(val,2)+(complete?'':' †');}
function pfo52Table(t,plan,w,past,mode){const rows=plan?.assignments||[];return '<div class="pfo52-lineup">'+rows.map((x,i)=>{const p=x.id?pfo52Info(x.id):null,val=x.id?pfo52Value(t,x.id,w,past):null;
 const reserve=(t?.members||[]).filter(y=>pfo52Legal(x.slot,y)&&String(y.id||y.player_id)!==String(x.id)&&!rows.some((z,j)=>j!==i&&String(z.id)===String(y.id||y.player_id)));
 const selector=mode==='ours'?'<select class="pfo52-swap" data-pfo52-swap="'+i+'" aria-label="Change '+e(x.slot)+' player"><option value="'+e(x.id||'')+'">'+e(p?.name||'Open slot')+'</option>'+reserve.map(y=>'<option value="'+e(y.id||y.player_id)+'">'+e(y.name)+'</option>').join('')+'</select>':'';
 const proj=!past&&x.id?pfo52Points(x.id,w):null;
 return '<div class="pfo52-playerrow"><span class="pfo52-slot">'+e(x.slot)+'</span><div>'+(x.id?'<button class="pfo597-player-link" type="button" data-pfo49-id="'+e(x.id)+'">'+e(p?.name||'Unknown player')+'</button>':'<strong>No verified option</strong>')+'<small>'+e(p?.position||'')+(p?.team?' · '+e(p.team):'')+'</small>'+selector+'</div><b>'+(proj?.bye?'BYE':proj?.modelPending||proj?.schedulePending?'PENDING':pfo52PointLabel(val))+'</b></div>';
 }).join('')+'</div>';
}
function pfo52RosterCard(team,w,past){if(!team)return '<p class="pfo52-dim">Opponent not established for this selected week.</p>';
 const starters=new Set(team.starters),ids=team.members,reserve=new Set((past?[]:team.record?.reserve||[]).map(String));
 const list=items=>items.length?items.map(p=>{const v=!past?pfo52Points(String(p.id),w):null;return '<button type="button" class="pfo52-pill pfo597-player-pill" data-pfo49-id="'+e(p.id)+'">'+e(pfo52Pos(p)||'?')+' '+e(p.name)+' · '+(v?.bye?'BYE':v?.modelPending||v?.schedulePending?'PENDING':pfo52PointLabel(pfo52Value(team,String(p.id),w,past)))+'</button>';}).join(''):'<span class="pfo52-dim">None verified</span>';
 const bench=ids.filter(p=>!starters.has(String(p.id))&&!reserve.has(String(p.id)));
 const health=ids.filter(p=>pfo52Pos(p)!=='DEF').map(p=>{const raw=pfo52HealthCatalog.get(String(p.id))||(liveRosterSnapshot?.players||[]).find(x=>String(x.player_id)===String(p.id))||{};const tag=raw.injury_status||raw.sleeper_injury_status||null;
  const confirmed=w===pfo52Cur()&&reportMatchesCurrentWeek(officialInactiveEvidence)?officialInactiveEvidence?.confirmed_official_inactives?.[String(p.id)]:null;
  const third=w===pfo52Cur()&&reportMatchesCurrentWeek(espnGamedayEvidence)?espnGamedayEvidence?.explicit_inactives?.[String(p.id)]:null;
  const isBye=!!pfo49Schedule?.complete&&!pfo49ScheduleWeek(p,w);
  return {p,tag,confirmed,third,isBye};}).filter(x=>x.tag||x.confirmed||x.third||x.isBye);
 const activeStatus=past?'Historical gameday inactive/IR designation is not independently available for this week.':'No verified current-week inactive or injury designation for these players; an absent report does not prove active.';
 const healthHTML=past?'<p class="pfo52-fine">'+activeStatus+'</p>':(health.length?health.map(x=>'<div class="pfo52-healthrow">'+e(x.p.name)+' · '+e(x.confirmed?.status==='inactive'?'VERIFIED GAME INACTIVE':x.third?'ESPN-reported game inactive':x.isBye?'NFL BYE · W'+w:String(x.tag||'Possible status; verify'))+'</div>').join('')+'<p class="pfo52-fine">Current Sleeper tags and current-game inactive evidence, with verified schedule byes. For future weeks, an injury tag reflects the latest directory only, not a future-week designation. Missing reports do not prove active.</p>':'<p class="pfo52-fine">'+activeStatus+'</p>');
 return '<div class="pfo52-fullroster"><h3>'+e(team.name)+' · '+e(ids.length)+' recorded players</h3><p class="pfo52-fine">'+e(team.completeRoster?'Roster membership obtained for selected snapshot':'Only submitted starters were supplied; the historical bench cannot be verified')+'</p><h4>Submitted starters</h4><div class="pfo52-pills">'+list(ids.filter(p=>starters.has(String(p.id))))+'</div><h4>Bench / non-starters</h4><div class="pfo52-pills">'+(team.completeRoster?list(bench):'<span class="pfo52-dim">Bench ownership missing in source</span>')+'</div><h4>Fantasy reserve</h4><p class="pfo52-fine">'+(past?'Historical fantasy IR not supplied in weekly matchup source':reserve.size?e([...reserve].map(id=>pfo52Info(id).name).join(', ')):'None in current saved reserve snapshot')+'</p><h4>NFL availability / inactives · Week '+w+'</h4>'+healthHTML+'</div>';
}
function pfo52Switch(w){pfo52Week=Math.max(1,Math.min(17,Number(w)||pfo52Cur()));pfo52Scenario=null;pfo52Scenarios=pfo52SavedRead(pfo52Week,pfo52Week<pfo52Cur());pfo52Render();pfo52GetWeek(pfo52Week).then(()=>{if(pfo52Week===w)pfo52Render();});}
function pfo52Render(){const el=$('pfo52-matchup');if(!el)return;const w=pfo52Week,current=pfo52Cur(),past=w<current,match=pfo52Match(w);
 let ours=past?pfo52Team(w,'ours'):pfo52FutureTeam(Number(window.dbRosterId||1));
 let opp=past?pfo52Team(w,'theirs'):(match?.theirs?pfo52FutureTeam(Number(match.theirs.roster_id)):null);
 const header='<div class="pfo52-weekrow"><button data-pfo52-step="-1" type="button" '+(w===1?'disabled':'')+'>← Previous</button><label>FFL week <select id="pfo52-week">'+Array.from({length:17},(_,i)=>'<option value="'+(i+1)+'" '+(w===i+1?'selected':'')+'>Week '+(i+1)+(i+1>=15?' · playoffs':'')+'</option>').join('')+'</select></label><button data-pfo52-step="1" type="button" '+(w===17?'disabled':'')+'>Next →</button></div>';
 let h=header+'<p class="pfo52-fine">'+(past?'Historical final recorded FFL scores · using Week '+w+' roster only · corrections may revise prior totals':w===current?'Current-week submitted roster and model estimates · independent predictions are not final scores':'Future preview from current rosters · future trades, availability and playoff opponents are unknown')+'</p>';
 if(!ours){el.innerHTML=h+'<div class="note">No verified historical weekly matchup entry for Dirty Birds. Fetching Sleeper week '+w+' if possible. We will not substitute today\'s roster for past ownership.</div>';return;}
 const baseline=past?pfo52Actual(ours,w):pfo52Best(ours,w,false);
 const counterpart=past?(opp?pfo52Actual(opp,w):null):(opp?pfo52Best(opp,w,false):null);
 if(!pfo52Scenario||pfo52Scenario.week!==w||pfo52Scenario.past!==past){pfo52Scenario={week:w,past,assignments:baseline.assignments.map(x=>({...x}))};pfo52Scenarios=pfo52SavedRead(w,past);}
 const simulated=pfo52LineupScore(ours,pfo52Scenario.assignments,w,past),original=past?{total:ours.score,complete:ours.score!=null}:pfo52LineupScore(ours,baseline.assignments,w,false);
 const comparable=!past||pfo52Reconciles(ours,w),delta=comparable&&original.total!=null&&simulated.complete?(simulated.total-original.total):null;
 const oppScore=past?opp?.score:counterpart?.total;
 h+='<div class="pfo52-scoreboard"><div><small>DIRTY BIRDS · '+(past?'FINAL':'MODEL')+'</small><strong>'+pfo52PointLabel(past?ours.score:original.total,original.complete)+'</strong></div><div class="pfo52-versus">VS</div><div><small>'+e(opp?.name||'Opponent TBD')+' · '+(past?'FINAL':'MODEL')+'</small><strong>'+pfo52PointLabel(oppScore,past?oppScore!=null:!!counterpart?.complete)+'</strong></div></div>';
 if(!opp)h+='<p class="note">'+(past?'Historical opponent pairing unavailable in matched Sleeper records.':'Opponent not established for Week '+w+'. Playoff pairings remain TBD until FFL seeds are known.')+'</p>';
 h+='<div class="pfo52-duel"><article><div class="pfo52-panhead"><h3>Dirty Birds '+(past?'submitted lineup':'best model lineup')+'</h3><small>'+(past?'Actual starters &amp; final player points':'Optimal legal lineup under supported FFO baselines')+'</small></div>'+pfo52Table(ours,baseline,w,past,'none')+'</article><article><div class="pfo52-panhead"><h3>'+e(opp?.name||'Opposing manager')+' '+(past?'submitted lineup':'best model lineup')+'</h3><small>'+(past?'Original weekly starters':'Projected best eligible starters; not their actual submitted lineup')+'</small></div>'+(opp?pfo52Table(opp,counterpart,w,past,'none'):'<p class="pfo52-dim">Future opposing roster unconfirmed</p>')+'</article></div>';
 h+='<section class="pfo52-lab"><div class="pfo52-panhead"><h3>Interactive Lineup Lab</h3><small>'+(past?'HINDSIGHT: final player points':'SCENARIO: experimental FFO projections')+' · Never changes Sleeper</small></div>';
 h+='<div class="pfo52-scorecards"><div><small>Original</small><b>'+pfo52PointLabel(original.total,original.complete)+'</b></div><div><small>Simulated</small><b>'+pfo52PointLabel(simulated.total,simulated.complete)+'</b></div><div><small>Difference</small><b>'+(delta==null?'—':(delta>=0?'+':'')+pfo52Money(delta))+'</b></div></div>';
 if(past&&!comparable)h+='<p class="note">Final team score and individual starter points do not reconcile in the loaded weekly record. Hindsight score differences are withheld until a complete league-scored audit can be performed.</p>';
 h+='<p class="pfo52-fine">Swap any legal starter for a rostered bench player. Changes are isolated to this preview. † A partial total means at least one player lacks a supported scoring estimate—missing does not equal zero.</p>'+pfo52Table(ours,pfo52Scenario,w,past,'ours');
 h+='<div class="pfo52-actions"><button data-pfo52-action="reset" type="button">Reset lineup</button><button data-pfo52-action="save" type="button">Save scenario locally</button></div>';
 if(pfo52Scenarios.length)h+='<div class="pfo52-pills">'+pfo52Scenarios.map((x,i)=>'<button data-pfo52-loadscenario="'+i+'" type="button">'+e(x.name)+' · '+pfo52PointLabel(x.total,x.complete)+'</button>').join('')+'</div>';
 const ideal=past&&ours.completeRoster?pfo52Best(ours,w,true):null;
 if(past&&ideal)h+='<div class="pfo52-reviewline">Retrospective best legal lineup: <strong>'+pfo52PointLabel(ideal.total,ideal.complete)+'</strong> · '+(pfo52Reconciles(ours,w)&&ideal.complete?'Unused potential: '+pfo52Money(Math.max(0,ideal.total-ours.score))+' FFL pts':'Historical starters/FFL total cannot be reconciled for a complete audit')+'</div>';
 h+='</section><div class="pfo52-duel"><article>'+pfo52RosterCard(ours,w,past)+'</article><article>'+(opp?pfo52RosterCard(opp,w,past):'<p class="pfo52-dim">Future opposing roster is not yet established.</p>')+'</article></div>';
 h+='<p class="pfo52-fine">Source: Sleeper per-week matchups for historical ownership, starters, and final fantasy points. nflverse for FFO projection inputs, where supported. Opponent-aware adjustments require sufficient observed NFL opponent data. All projections and retrospective optimizations are private research.</p>';
 el.innerHTML=h;
}
function pfo52SaveKey(w,past){return 'ffo52_saved_scenarios_v1_'+Number(window.dbNflSeason||2026)+'_'+w+'_'+(past?'hindsight':'forecast');}
function pfo52SavedRead(w,past){try{const v=JSON.parse(localStorage.getItem(pfo52SaveKey(w,past))||'[]');return Array.isArray(v)?v.slice(0,5):[];}catch{return [];}}
function pfo52SaveCurrent(){try{localStorage.setItem(pfo52SaveKey(pfo52Week,pfo52Week<pfo52Cur()),JSON.stringify(pfo52Scenarios.slice(-5)));}catch{}}
function pfo52Swap(i,id){const m=pfo52Week<pfo52Cur()?pfo52Team(pfo52Week,'ours'):pfo52FutureTeam(Number(window.dbRosterId||1));const item=m?.members.find(p=>String(p.id)===String(id)),slot=pfo52Scenario?.assignments[i]?.slot;
 if(!item||!pfo52Legal(slot,item))return;
 const other=pfo52Scenario.assignments.findIndex((x,j)=>j!==i&&x.id===String(id));if(other>=0)return; // reject duplicate assignment
 pfo52Scenario.assignments[i].id=String(id);pfo52Render();
}
document.addEventListener('change',ev=>{if(ev.target?.id==='pfo52-week'){pfo52Switch(Number(ev.target.value));return;}
 const n=ev.target?.dataset?.pfo52Swap;if(n!=null)pfo52Swap(Number(n),ev.target.value);
});
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-pfo52-step],[data-pfo52-action],[data-pfo52-loadscenario],[data-pfo52-goweek]');if(!b)return;
 if(b.dataset.pfo52Step)pfo52Switch(pfo52Week+Number(b.dataset.pfo52Step));
 if(b.dataset.pfo52Goweek){document.querySelector('nav button[data-page="matchup"]')?.click();pfo52Switch(Number(b.dataset.pfo52Goweek));}
 if(b.dataset.pfo52Action==='reset'){pfo52Scenario=null;pfo52Render();}
 if(b.dataset.pfo52Action==='save'){const w=pfo52Week,past=w<pfo52Cur(),team=past?pfo52Team(w,'ours'):pfo52FutureTeam(Number(window.dbRosterId||1)),s=pfo52LineupScore(team,pfo52Scenario.assignments,w,past);pfo52Scenarios.push({name:'Scenario '+(pfo52Scenarios.length+1),assignments:pfo52Scenario.assignments.map(x=>({...x})),total:s.total,complete:s.complete});pfo52Scenarios=pfo52Scenarios.slice(-5);pfo52SaveCurrent();pfo52Render();}
 if(b.dataset.pfo52Loadscenario){const s=pfo52Scenarios[Number(b.dataset.pfo52Loadscenario)];if(s){if(s.assignments?.length===pfo52Slots().length){const team=pfo52Week<pfo52Cur()?pfo52Team(pfo52Week,'ours'):pfo52FutureTeam(Number(window.dbRosterId||1));const ids=new Set();const valid=s.assignments.every((a,i)=>{if(!a.id)return true;const p=team?.members?.find(x=>String(x.id)===String(a.id));if(!p||!pfo52Legal(pfo52Slots()[i],p)||ids.has(String(a.id)))return false;ids.add(String(a.id));return true;});if(valid){pfo52Scenario.assignments=s.assignments.map(x=>({...x}));pfo52Render();}}}}
});
async function pfo52Review(){const el=$('pfo52-coaching');if(!el||pfo52ReviewBusy)return;
 const now=pfo52Cur(),max=Math.min(now-1,17);if(max<1){el.innerHTML='<p>There are no completed league weeks to audit yet.</p>';return;}
 pfo52ReviewBusy=true;el.innerHTML='<p class="pfo52-fine">Retrieving recorded FFL roster ownership and final league points for completed weeks 1–'+max+'…</p>';
 try{const weeks=Array.from({length:max},(_,i)=>i+1);await Promise.all(weeks.map(async w=>{await pfo52GetWeek(w);}));
 const items=[];for(const w of weeks){const t=pfo52Team(w,'ours'),op=pfo52Team(w,'theirs');if(!t){items.push({w,error:'Historical matchup unavailable'});continue;}
  const best=t.completeRoster?pfo52Best(t,w,true):null,official=t.score;
  items.push({w,team:t,op,best,actual:official,delta:best?.complete&&pfo52Reconciles(t,w)?Math.max(0,best.total-official):null,efficiency:best?.complete&&pfo52Reconciles(t,w)&&best.total>0?100*official/best.total:null});
 }
 pfo52ReviewEntries=items;
 const valid=items.filter(x=>x.delta!=null),actual=items.filter(x=>x.actual!=null),sum=a=>a.reduce((s,x)=>s+x,0);
 const pts=sum(actual.map(x=>x.actual)),unused=sum(valid.map(x=>x.delta));
 let h='<div class="pfo52-panhead"><h2>Season Coaching Performance</h2><p class="pfo52-fine">Retrospective analysis of players actually owned during each FFL week. Not a claim we could predict their performances before kickoff.</p></div>';
 h+='<div class="pfo52-scorecards"><div><small>Recorded FFL points</small><b>'+pfo52Money(actual.length?pts:null,1)+'</b></div><div><small>Verified audited weeks</small><b>'+valid.length+' / '+max+'</b></div><div><small>Potential left unused*</small><b>'+pfo52Money(valid.length?unused:null,1)+'</b></div></div>';
 h+='<div class="pfo52-history">'+items.map(x=>x.error?'<div class="pfo52-historyrow"><b>Week '+x.w+'</b><span>'+e(x.error)+'</span><button data-pfo52-goweek="'+x.w+'">Inspect →</button></div>':
 '<div class="pfo52-historyrow"><div><b>Week '+x.w+'</b><small>vs '+e(x.op?.name||'Opponent unverified')+'</small></div><div>Final <strong>'+pfo52PointLabel(x.actual)+'</strong><small>Best possible '+(x.best?.complete?pfo52PointLabel(x.best.total):'Not auditable')+'</small></div><div>'+(x.delta!=null?'<b>'+pfo52Money(x.delta,1)+' pts unused</b><small>'+pfo52Money(x.efficiency,1)+'% lineup efficiency</small>':'<small>Historical bench/points missing</small>')+'</div><button data-pfo52-goweek="'+x.w+'">Inspect →</button></div>').join('')+'</div>';
 h+='<p class="pfo52-fine">*Cumulative unused-point total includes only verified complete-roster, fully scored weeks. Efficiency = actual / retrospectively best legal lineup; it can exceed 100% when a league adjustment or missing data prevents exact comparison. No projection backtesting is implied.</p>';
 el.innerHTML=h;
 }finally{pfo52ReviewBusy=false;}
}
// Explicit current player-position metadata for all statistics surfaces.
const pfo52BaseSummary=pfo51PlayerSummary;
pfo51PlayerSummary=function(id){const obj=pfo52BaseSummary(id),p=pfo52Info(id),pos=pfo52Pos(p),row=obj.row;
 const metrics=obj.metrics||[];
 if(pos==='QB')obj.metrics=metrics.filter(([k])=>!/rec|catch|target/i.test(k));
 if(pos==='RB')obj.metrics=metrics.filter(([k])=>!/pass(ing)?/i.test(k));
 if(['WR','TE'].includes(pos))obj.metrics=metrics.filter(([k])=>!/pass(ing)?/i.test(k));
 if(['WR','TE'].includes(pos))obj.metrics=metrics.filter(([k,v])=>!(k==='Rush yds'&&(v==null||Number(v)===0)));
 if(pos==='K'||pos==='DEF'){
  const history=[];for(let w=1;w<pfo52Cur();w++){for(const m of pfo52Hist(w)||[]){const n=m.players_points?.[String(id)];if(n!=null&&Number.isFinite(Number(n))){history.push({week:w,points:Number(n)});break;}}}
  obj.metrics=history.length?[['Latest scored W'+history.at(-1).week,history.at(-1).points.toFixed(2)],['Games scored',history.length],['Season PPG',pfo52Money(history.reduce((n,x)=>n+x.points,0)/history.length,1)]]:[];
  if(pos==='K'&&row?.latest){for(const [key,label] of [['fgm','FG made'],['fga','FG attempts'],['xpm','XP made'],['xpa','XP attempts']])if(row.latest[key]!=null)obj.metrics.push([label,row.latest[key]]);}
  obj.forecast=pfo52Points(id,pfo52Cur())?.points??null;
  if(history.length){obj.finalPts=history.at(-1).points;obj.week=history.at(-1).week;obj.label='FFL recorded kicker/defense score';obj.avg=history.reduce((n,x)=>n+x.points,0)/history.length;}
 }
 return obj;
};
// Roster Defense points, actual league-scored; do not turn missing into a zero.
const pfo52PreviousRoster=renderRosterComparison;
renderRosterComparison=function(){pfo52PreviousRoster();pfo52RosterPoints();};
function pfo52RosterPoints(){const el=$('actual-lineup');if(!el)return;
 const week=pfo52Cur(),rows=pfo52Hist(week)||[],ours=rows.find(x=>Number(x.roster_id)===Number(window.dbRosterId||1));
 const started=(liveRosterSnapshot?.starters||[]).map(String);for(const [i,tr] of [...el.querySelectorAll('tr')].entries()){
  const id=started[i],player=pfo52Info(id);if(!id||!pfo52Pos(player))continue;
  let cell=tr.cells?.[1];if(!cell)continue;const old=cell.querySelector('.pfo52-rosterpoints');if(old)old.remove();
  const points=ours?.players_points?.[id],tag=document.createElement('div');tag.className='pfo52-rosterpoints';
  tag.textContent=points!=null&&Number.isFinite(Number(points))?'Week '+week+' · '+Number(points).toFixed(2)+' recorded FFL points':'Week '+week+' · FFL points not yet reported';
  cell.append(tag);
 }
}
// NFL D/ST is a fantasy team, not an injured player.
const pfo52OldInjury=updateInjuryView;
updateInjuryView=function(){pfo52OldInjury();const el=$('injuries');if(!el)return;for(const tr of [...el.querySelectorAll('tr')]){
 const row=liveRosterSnapshot?.players?.find(p=>normPlayer(tr.cells?.[0]?.textContent||'').startsWith(normPlayer(p.name))&&p.name);
 if(row&&pfo52Pos(row)==='DEF')tr.remove();}
};
// Current-week official inactive reports outrank stale fantasy injury tags. Mere absence from an
// inactive list never establishes ACTIVE. In-game injuries require an observed, dated source.
const pfo52PreInactiveInjury=updateInjuryView;
updateInjuryView=function(){pfo52PreInactiveInjury();const body=$('injuries');if(!body)return;
 const players=liveRosterSnapshot?.players||[],isCurrent=reportMatchesCurrentWeek(officialInactiveEvidence);
 for(const row of body.querySelectorAll('tr')){const p=players.find(x=>x.name&&normPlayer(row.cells?.[0]?.textContent||'').startsWith(normPlayer(x.name)));
  if(!p||pfo52Pos(p)==='DEF'){if(pfo52Pos(p)==='DEF')row.remove();continue;}
  const record=isCurrent?officialInactiveEvidence?.confirmed_official_inactives?.[String(p.player_id)]:null;
  if(record?.status==='inactive'&&record.verified_at_utc&&record.source_url&&record.verified_by){row.cells[1].innerHTML='<b>OFFICIAL INACTIVE · W'+e(pfo52Cur())+'</b>';row.cells[2].innerHTML='<a href="'+e(record.source_url)+'" target="_blank" rel="noopener noreferrer">Verified current-week gameday report</a>';}
 }
 const caption=$('injuryhealth');if(caption){let line=caption.querySelector('.pfo52-live-caveat');if(!line){line=document.createElement('p');line.className='pfo52-fine pfo52-live-caveat';caption.append(line);}line.textContent='Game participation can supersede an old questionable tag for that game, but does not certify future availability. This build does not have a continuously verified in-game injury/return feed; no automatic return-to-play claim is made.';}
};
// For Radar and Waiver: do not present confirmed season-out players as pick-up targets.
// IR with unknown return duration goes to the watch queue rather than a recommendation.
let pfo52HealthCatalog=new Map(),pfo52HealthCheckedAt=null;
function pfo52HealthDecision(id){const player=pfo52Info(id),inj=pfo49Injury(id),m=pfo49Metric(id),raw=pfo52HealthCatalog.get(String(id))||cachedPlayerNames?.[String(id)]||{};
 const text=[raw.injury_notes,raw.injury_body_part,raw.status,m?.injury_report_record?.detail,m?.injury_report_record?.game_status,inj.official?.game_status].filter(Boolean).join(' ');
 const flag=String(raw.injury_status||raw.status||inj.fantasy||'').toUpperCase();
 if(/(out for (the |this )?season|season.ending|will miss remainder|torn achilles|torn acl)/i.test(text))return {allow:false,reason:'Season-ending condition in available metadata; independent dated confirmation is required'};
 if(/\bIR\b|INJURED.RESERVE|RESERVE.INJURED|\bPUP\b/.test(flag)){
  const weeks=Number(raw.weeks_out||raw.expected_weeks_out);if(Number.isFinite(weeks)&&weeks>6)return {allow:false,reason:'Estimated absence longer than six weeks; source metadata requires validation'};
  if(!Number.isFinite(weeks)||weeks<=0)return {allow:false,reason:'IR/PUP return window unverified; separated from ready-to-use pickups'};
 }
 return {allow:true,reason:''};
}
const pfo52OriginalRadar=pfo49RadarPool;
pfo49RadarPool=function(){return pfo52OriginalRadar().filter(x=>pfo52HealthDecision(x.id).allow);};
// Replace generic waiver production numbers with existing universal position-aware strip;
// retain all ownership checks and evidence disclosures.
const pfo52WaiverOriginal=renderWaiverScouting;
renderWaiverScouting=function(){pfo52WaiverOriginal();const el=$('waiverlive');if(!el)return;
 for(const article of [...el.querySelectorAll('article.pfo49-waiver')]){const btn=article.querySelector('[data-pfo49-id]');const id=btn?.dataset?.pfo49Id;if(!id)continue;
  if(!pfo52HealthDecision(id).allow){article.remove();continue;}
  const old=article.querySelector('.pfo49-statgrid');if(old)old.remove();
 }
 if(!el.querySelector('article.pfo49-waiver'))el.insertAdjacentHTML('beforeend','<p class="pfo52-fine">No verified ready-to-add players survive current league ownership and health screening. Long-term IR cases are withheld, not labeled healthy.</p>');
};
// Ask Front Office: general search is limited to our players and verified unrostered players.
const pfo52OldFind=pfo51FindPlayers;
pfo51FindPlayers=function(q){if(/\btrade\b|\btrade ideas?\b|\bacquire\b/i.test(q))return {tradeIntent:true};
 const res=pfo52OldFind(q);if(res.error)return res;
 if(!leagueOwnedIds||!ownershipCheckedMs||Date.now()-ownershipCheckedMs>300000)return {error:'Cannot safely distinguish other managers’ players until current league ownership is verified. Refresh Sleeper source.'};
 const mine=new Set((liveRosterSnapshot?.players||[]).map(x=>String(x.player_id)));
 res.entries=res.entries.filter(x=>mine.has(String(x.id))||!waiverIsRostered(pfo52Info(x.id).name,x.id));res.total=res.entries.length;return res;
};
const pfo52OldAsk=pfo51Ask;
pfo51Ask=function(q){const area=$('pfo51-answer');if(!area)return;
 const query=String(q||'').slice(0,300);
 if(/\btrade\b|\bacquire\b|\boffer\b/i.test(query)){
  const names=pfo49Players.filter(x=>x.name.length>=5&&normPlayer(query).includes(normPlayer(x.name)));
  const owned=names.filter(x=>{const owner=(gm47Snapshot?.rosters||[]).find(r=>(r.players||[]).map(String).includes(String(x.id)));return owner&&Number(owner.roster_id)!==Number(window.dbRosterId||1)&&!isTradeExcludedOpponent(owner.roster_id,pfo52Owner(owner.roster_id));});
  area.innerHTML='<h3>Explicit trade research</h3><p>Other-manager players appear only inside this trade-intent pathway. No offer is submitted; roster #3 (BigOlBoyle) is never a trade target.</p>'+(!owned.length?'<p>No eligible named trade target could be verified from current league rosters.</p>':owned.slice(0,6).map(x=>'<div class="pfo51-query-result"><strong>'+e(x.name)+'</strong> · '+e(pfo52Owner((gm47Snapshot?.rosters||[]).find(r=>(r.players||[]).map(String).includes(String(x.id)))?.roster_id))+'<div><button type="button" class="pfo49-pin" data-pfo52-tradetarget="'+e(x.id)+'">Open target in trade desk</button></div></div>').join(''))+'<p class="pfo52-fine">Explicitly selected names only. The two-sided evaluator still requires Coach to enter the package.</p>';
  return;
 }
 if(/opponent|playing this week|opposing team/i.test(query)){
  area.innerHTML='<h3>Weekly opponent research</h3><p>Full opponent ownership and player comparison belongs in the Weekly Matchup page. It includes actual FFL rosters, points and the editable lineup lab.</p><button type="button" class="pfo49-pin" data-pfo52-gomatchup="1">Open Weekly Matchup</button>';return;
 }
 const mine=new Set((liveRosterSnapshot?.players||[]).map(x=>String(x.player_id)));
 const matches=pfo49Players.filter(x=>x.name.length>=5&&normPlayer(query).includes(normPlayer(x.name)));
 if(matches.length){
  if(!leagueOwnedIds||!ownershipCheckedMs||Date.now()-ownershipCheckedMs>300000){area.textContent='League ownership verification unavailable or stale. Refresh Sleeper before named-player scouting.';return;}
  const opposed=matches.filter(x=>!mine.has(String(x.id))&&waiverIsRostered(x.name,x.id));
  if(opposed.length){area.innerHTML='<p>Some named players belong to other FFL managers and are excluded from general scouting. Use an explicit trade question to open a trade-target pathway.</p>';return;}
 }
 pfo52OldAsk(query);
};
document.addEventListener('click',ev=>{const btn=ev.target.closest('[data-pfo52-tradetarget],[data-pfo52-gomatchup]');if(!btn)return;
 if(btn.dataset.pfo52Gomatchup){document.querySelector('nav button[data-page="matchup"]')?.click();return;}
 if(btn.dataset.pfo52Tradetarget){const id=btn.dataset.pfo52Tradetarget;const owner=(gm47Snapshot?.rosters||[]).find(r=>(r.players||[]).map(String).includes(String(id)));
  if(!owner||isTradeExcludedOpponent(owner.roster_id,pfo52Owner(owner.roster_id)))return;
  // This only selects a research target locally; it never sends or proposes an actual offer.
  if(tb45State&&Array.isArray(tb45State.targets)&&!tb45State.targets.includes(id))tb45State.targets=[...tb45State.targets,id];
  tb45State.view='buy';tb45Save();
  document.querySelector('nav button[data-page="market"]')?.click();
  document.getElementById('trade-fold')?.setAttribute('open','');
 }
});
// Championship is entirely Dirty Birds playoff player research.
pfo49RenderPlanner=function(){const el=$('pfo49-playoff-plan');if(!el)return;
 const wks=[15,16,17],team=pfo52FutureTeam(Number(window.dbRosterId||1));
 if(!team){el.innerHTML='<h2>Dirty Birds Playoff Intelligence</h2><p>Current verified roster unavailable. No playoff forecasts can be displayed yet.</p>';return;}
 let h='<div class="pfo52-panhead"><h2>Dirty Birds · Championship Weeks 15–17</h2><p class="pfo52-fine">Player-by-player points, NFL opponent, and legal starting-lineup totals—not a bracket predicting other league managers. Weekly estimates are opponent-adjusted only when sufficient independently observed defensive data exists; otherwise labeled unchanged recent-form baselines.</p></div>';
 h+='<div class="pfo52-champgrid">'+wks.map(w=>{const best=pfo52Best(team,w,false);return '<div class="pfo52-champbox"><b>W'+w+' ideal*</b><strong>'+pfo52PointLabel(best.total,best.complete)+'</strong><small>'+best.known+'/'+best.required+' legal slots</small></div>';}).join('')+'</div>';
 h+='<div class="pfo49-table-wrap"><table class="pfo49-gamelog"><thead><tr><th>Dirty Birds player</th>'+wks.map(w=>'<th>Week '+w+'</th>').join('')+'</tr></thead><tbody>';
 const members=team.members.filter(p=>['QB','RB','WR','TE','K','DEF'].includes(pfo52Pos(p)))
   .sort((a,b)=>['QB','RB','WR','TE','K','DEF'].indexOf(pfo52Pos(a))-['QB','RB','WR','TE','K','DEF'].indexOf(pfo52Pos(b))||String(a.name).localeCompare(String(b.name)));
 // Playoff starters cannot be inferred from today's lineup. Show everyone together.
 const statrow=p=>'<tr><td><small class="pfo59-playerpos">'+e(pfo52Pos(p))+'</small> '+pfo49Link(p.id)+'</td>'+wks.map(w=>{const opp=pfo49ScheduleWeek(p,w)?.opponent||(pfo49Schedule?.complete?'BYE':'NFL opponent unverified');const x=pfo52Points(p.id,w);return '<td title="'+e((x?.source||'Model unavailable')+' · Opponent: '+opp)+'"><b>'+(x?.bye?'BYE':x?.modelPending||x?.schedulePending?'PENDING':pfo52PointLabel(x?.points))+'</b><small class="pfo52-dim">'+e(x?.bye?'OFF':opp==='NFL opponent unverified'?'OPP ?':opp)+'</small></td>';}).join('')+'</tr>';
 h+=members.map(statrow).join('');
 h+='</tbody></table></div><p class="pfo52-fine">All currently rostered players appear together. Current starters and bench do not predict playoff lineup assignments.</p>';
 h+='<p class="pfo52-fine">Unverified opponents do not receive invented matchup adjustments. Model projection is not an expert or market forecast. D/ST and kicker estimates, if available, use past recorded FFL point averages. Opponents and NFL bye information require completed source schedule. † Partial lineup projections omit missing-score positions; never treat those estimates as a complete roster total.</p>';
 el.innerHTML=h;
};
// Scouting K/DST: visibly render actual historical league scoring, even when NFL kicking stat feed lacks FG distances.
const pfo52OldGm=gm47Render;
gm47Render=function(){pfo52OldGm();const el=$('gm47-report'),id=gm47State.player,p=gm47Person(id)||pfo52Info(id),pos=pfo52Pos(p);
 if(!el||!id||!['K','DEF'].includes(pos))return;
 const history=gm47ScoringHistory(p);let html='<section class="card pfo52-special"><h3>'+e(pos==='K'?'Kicker':'D/ST')+' · FFL recorded scoring</h3>';
 html+=history.length?'<div class="pfo52-pills">'+history.map(x=>'<span class="pfo52-pill">W'+x.week+' · '+pfo52Money(x.points)+' pts</span>').join('')+'</div><p>Verified recent scored average: <b>'+pfo52Money(history.reduce((n,x)=>n+x.points,0)/history.length,2)+' FFL pts</b> across '+history.length+' sourced weeks.</p>':'<p>No individually league-scored game data for the selected player was available. No made-up zeroes.</p>';
 if(pos==='K')html+='<p class="pfo52-fine">Field goals by distance and XP totals are not supplied by the current independent weekly offensive-stat feed. FFL scoring is verified where historical Sleeper records exist; FG/XP breakdown remains unavailable pending a suitable source.</p>';
 html+='</section>';el.insertAdjacentHTML('beforeend',html);
};
async function pfo52FetchHealth(){const ids=new Set();for(const x of [...(waiverResearch||[]),...(autoScout?.candidates||[])]){const id=x.source_player_id||x.player_id||x.id;if(id)ids.add(String(id));}
 for(const x of [...pfo52OriginalRadar()].sort((a,b)=>b.points-a.points).slice(0,55))ids.add(String(x.id));
 const pairing=pfo52Match(pfo52Cur());for(const rid of [Number(window.dbRosterId||1),pairing?.theirs?.roster_id]){if(!Number.isFinite(Number(rid)))continue;for(const p of pfo52FutureTeam(Number(rid))?.members||[])ids.add(String(p.id));}
 const list=[...ids].filter(id=>id&&id.length<40).slice(0,90);if(!list.length)return;
 try{const r=await fetch('/api/player-health?ids='+encodeURIComponent(list.join(',')),{cache:'no-store'});if(!r.ok)throw Error('health endpoint unavailable');const j=await r.json();if(!j.players||!j.checked_at)throw Error('unrecognized metadata');
  pfo52HealthCatalog=new Map(Object.entries(j.players));pfo52HealthCheckedAt=j.checked_at;renderWaiverScouting();pfo49RenderRadar();
 }catch(err){console.warn('Player health catalog not verified',String(err));}}
setTimeout(pfo52FetchHealth,13000);
function pfo52OpenPage(page){if(page==='matchup'){pfo52Week=pfo52Week||pfo52Cur();pfo52Render();pfo52GetWeek(pfo52Week).then(()=>pfo52Render());}
 if(page==='coaching')pfo52Review();}
document.querySelectorAll('nav button[data-page="matchup"],nav button[data-page="coaching"]').forEach(b=>b.addEventListener('click',()=>pfo52OpenPage(b.dataset.page)));
// Full weekly matchup download is deferred until Matchup/Coaching is opened.

// Strict position-aware universal player statistics. No QB catches, irrelevant receiving placeholders,
// or misleading empty defense/kicker offensive categories.
const pfo52OldStrip=pfo50StatsStrip;
pfo50StatsStrip=function(id){const row=pfo50StatsFor(id),p=pfo52Info(id),pos=pfo52Pos(p);
 if(['K','DEF'].includes(pos)){const games=[];for(let w=1;w<=pfo52Cur();w++)for(const m of pfo52Hist(w)||[]){const n=m.players_points?.[String(id)];if(n!=null&&Number.isFinite(Number(n))){games.push({week:w,points:Number(n)});break;}}
  return '<div class="pfo49-statgrid">'+(games.length?[['Latest actual W'+games.at(-1).week,pfo52Money(games.at(-1).points)],['FFL PPG',pfo52Money(games.reduce((a,b)=>a+b.points,0)/games.length)],['Games',games.length]].map(([label,v])=>pfo50StatTile(label,v)).join(''):'<div class="pfo52-fine">FFL scored history unavailable for this '+e(pos)+'. Missing is not zero.</div>')+'</div>';
 }
 if(!row||!['QB','RB','WR','TE'].includes(pos))return pfo52OldStrip(id);
 const g=row.latest||{},wk=Number(g.week)||null,actual=wk!=null?pfo49Observed(id)?.[wk]?.points:null,pts=actual??(wk!=null?pfo50Score(g):null),proj=pfo50Estimate(id);
 const fields=[[wk?'W'+wk+(actual!=null?' actual FFL':' reconstructed*'):'Latest FFL pts',pfo49Num(pts,1)],['Next game model*',pfo49Num(proj,1)]];
 if(pos==='QB')fields.push(['Completions / attempts',(g.pass_cmp??'—')+' / '+(g.pass_att??'—')],['Pass yds',g.pass_yd??'—'],['Pass TD',g.pass_td??'—'],['Interceptions',g.pass_int??'—'],['Rush yds',g.rush_yd??'—']);
 if(pos==='RB')fields.push(['Carries',g.rush_att??'—'],['Rush yds',g.rush_yd??'—'],['Targets',g.targets??'—'],['Catches',g.rec??'—'],['Rec yds',g.rec_yd??'—']);
 if(['WR','TE'].includes(pos))fields.push(['Targets',g.targets??'—'],['Catches',g.rec??'—'],['Rec yds',g.rec_yd??'—'],['Rec TD',g.rec_td??'—'],['Target share',g.target_share_pct!=null?g.target_share_pct+'%':'—']);
 return '<div class="pfo49-statgrid">'+fields.map(([k,v])=>pfo50StatTile(k,v)).join('')+'</div><p class="pfo50-micro">*Independent NFL statistical reconstruction may omit league-specific scoring bonuses. FFO projection is a recent-form model, not verified expert projection.</p>';
};


// ---------- FFO 5.3 Precision & Performance (read-only; no added page) ----------
const PFO53_MODEL_VERSION='5.3:history-weighted-plus-opponent-v1', PFO53_SIM_SEED=20261029;
let pfo53HistoryState='pending',pfo53MatchMode='submitted',pfo53HistoryRenderPending=false;
const pfo53DefNames={ARI:'Arizona Cardinals',ATL:'Atlanta Falcons',BAL:'Baltimore Ravens',BUF:'Buffalo Bills',CAR:'Carolina Panthers',CHI:'Chicago Bears',CIN:'Cincinnati Bengals',CLE:'Cleveland Browns',DAL:'Dallas Cowboys',DEN:'Denver Broncos',DET:'Detroit Lions',GB:'Green Bay Packers',HOU:'Houston Texans',IND:'Indianapolis Colts',JAX:'Jacksonville Jaguars',KC:'Kansas City Chiefs',LAC:'Los Angeles Chargers',LAR:'Los Angeles Rams',LV:'Las Vegas Raiders',MIA:'Miami Dolphins',MIN:'Minnesota Vikings',NE:'New England Patriots',NO:'New Orleans Saints',NYG:'New York Giants',NYJ:'New York Jets',PHI:'Philadelphia Eagles',PIT:'Pittsburgh Steelers',SEA:'Seattle Seahawks',SF:'San Francisco 49ers',TB:'Tampa Bay Buccaneers',TEN:'Tennessee Titans',WAS:'Washington Commanders'};
const pfo53OriginalInfo=pfo52Info;
pfo52Info=function(id){const p=pfo53OriginalInfo(id),team=gm47CanonicalTeam(id);if(pfo53DefNames[team]&&(p.position==='DEF'||p.position==='D/ST'||p.position==='DST'||!p.position||String(p.name).startsWith('Player '))){return {...p,id:String(id),name:pfo53DefNames[team]+' D/ST',team,position:'DEF'};}return p;};
function pfo53Scored(id,maxWeek=pfo52Cur()-1){const out=[];for(let w=1;w<=Math.min(18,maxWeek);w++){const rows=pfo52Hist(w)||[];const hits=rows.filter(m=>m.players_points&&Object.hasOwn(m.players_points,String(id)));if(hits.length!==1)continue;const v=hits[0].players_points[String(id)];if(v!=null&&Number.isFinite(Number(v)))out.push({week:w,points:Number(v),owner:hits[0].roster_id});}return out;}
function pfo53PeerBaseline(pos){const counts=new Map();for(let w=Math.max(1,pfo52Cur()-4);w<pfo52Cur();w++)for(const m of pfo52Hist(w)||[])for(const [id,raw] of Object.entries(m.players_points||{})){if(pfo52Pos(pfo52Info(id))!==pos)continue;const n=Number(raw);if(!Number.isFinite(n))continue;const a=counts.get(id)||[];a.push(n);counts.set(id,a);}
 const means=[...counts.values()].filter(a=>a.length>=2).map(a=>a.reduce((t,v)=>t+v,0)/a.length).sort((a,b)=>a-b);return means.length>=5?means[Math.floor(means.length/2)]:null;}
const pfo53PreviousPoints=pfo52Points;
pfo52Points=function(id,w,past=false){if(past)return null;const p=pfo52Info(id),pos=pfo52Pos(p),sched=pfo49ScheduleWeek(p,w);
 if(pfo49Schedule?.complete&&p.team&&!sched)return {points:null,source:'VERIFIED BYE (no NFL game in Week '+w+')',adjustment:null,bye:true};
 if(['K','DEF'].includes(pos)){
  const hist=pfo53Scored(id,Math.min(w-1,pfo52Cur()-1)).slice(-5);let baseline=null,source=null;
  if(hist.length>=1){const recent=hist.slice(-3),avg=recent.reduce((n,g)=>n+g.points,0)/recent.length;
   const long=hist.reduce((n,g)=>n+g.points,0)/hist.length;baseline=.7*avg+.3*long;source='Recorded Sleeper FFL points · '+hist.length+' prior scored game(s)'+(hist.length===1?' · low sample':'');}
  else if(pfo53HistoryState==='loaded'){
   const peer=pfo53PeerBaseline(pos);if(peer!=null){baseline=peer;source='PROVISIONAL '+pos+' league-peer median; no player history · low confidence';}
  }
  if(baseline==null)return {points:null,source:pfo53HistoryState==='pending'?'Retrieving league-scored '+pos+' history':'No supported '+pos+' projection or verified peer sample',adjustment:null};
  // For K/DST no fabricated opponent multiplier. Independent opponent defense observations are offensive-only.
  return {points:Math.round(baseline*100)/100,source:source+' · no verified opponent kicking/DST adjustment',adjustment:null,model:PFO53_MODEL_VERSION};
 }
 const result=pfo53PreviousPoints(id,w,past);if(result?.points!=null)return {...result,model:PFO53_MODEL_VERSION};return result;
};
// All week-aware surfaces share ONE projection method rather than the former uniform future calendar.
pfo49ProjectedWeek=function(id,w){return pfo52Points(id,w)?.points??null;};
pfo49Projected=function(id){const p=pfo52Info(id);const vals=Object.fromEntries(Array.from({length:18},(_,k)=>[String(k+1),pfo52Points(id,k+1)?.points??null]));return {name:p.name,ppg:pfo52Points(id,pfo52Cur())?.points??null,weeks:vals};};
// League-scored history is consulted before determining whether kicker stats are absent.
gm47ScoringHistory=function(p){return pfo53Scored(p?.player_id||p?.id,gm47Week()-1).slice(-5).map(x=>({week:x.week,points:x.points,scored_for_roster:x.owner}));};
const pfo53PrevStrip=pfo50StatsStrip;
pfo50StatsStrip=function(id){const pos=pfo52Pos(pfo52Info(id));if(!['K','DEF'].includes(pos))return pfo53PrevStrip(id);
 const rows=pfo53Scored(id),last=rows.at(-1),pred=pfo52Points(id,pfo52Cur()),avg=rows.length?rows.reduce((a,x)=>a+x.points,0)/rows.length:null;
 return '<div class="pfo49-statgrid">'+[['Latest FFL actual',last==null?'—':pfo52Money(last.points)],['Recorded PPG',pfo52Money(avg)],['Week '+pfo52Cur()+' model',pfo52Money(pred?.points)],['Games scored',rows.length||'—']].map(([k,v])=>pfo50StatTile(k,v)).join('')+'</div><p class="pfo50-micro">'+e(pred?.source||'No supported projection')+' · League-scored history from per-week Sleeper matchups. FG-distance and XP attempt counts require a separate verified source; not inferred.</p>';
};
function pfo53RerenderFromHistory(){
 if(pfo53HistoryRenderPending)return;
 // Coalesce multiweek fetch completions into one visible-workspace paint.
 pfo53HistoryRenderPending=true;
 setTimeout(()=>{pfo53HistoryRenderPending=false;
  if(document.hidden)return;
  try{
   if(document.querySelector('#matchup.page.active,#coaching.page.active')){pfo52Render();pfo53WeekFocus();}
   if(document.querySelector('#championship.page.active'))pfo49RenderPlanner();
   if(document.querySelector('#playerhub.page.active'))pfo49RenderPlayer();
   if(document.querySelector('#scouting.page.active'))gm47Render();
   if(document.querySelector('#overview.page.active'))renderRosterComparison();
  }catch(err){console.warn('FFO history visible-view refresh',err)}
 },350);
}
async function pfo53WarmHistory(){const max=Math.min(pfo52Cur()-1,17),weeks=Array.from({length:max},(_,i)=>max-i);
 if(!max){pfo53HistoryState='loaded';return;}pfo53HistoryState='loading';let i=0,ok=0;
 async function worker(){while(i<weeks.length){const wk=weeks[i++];const rows=await pfo52GetWeek(wk);if(Array.isArray(rows)&&rows.length)ok++;}}
 await Promise.all([worker(),worker(),worker()]);pfo53HistoryState=ok?'loaded':'unavailable';pfo53RerenderFromHistory();}
// Matchup: submitted starters (both teams) take precedence; the best model is a separate toggle.
function pfo53CurrentTeam(w,side){const rid=Number(window.dbRosterId||1),match=pfo52Match(w),record=match?.[side];
 if(w<pfo52Cur())return pfo52Team(w,side);
 if(side==='ours'){
  const t=pfo52FutureTeam(rid);if(!t)return null;
  // For the current week a fresh live Sleeper roster contains the actual submitted starters.
  if(w===pfo52Cur()&&Number(liveRosterSnapshot?.roster_id)===rid){t.starters=(liveRosterSnapshot.starters||[]).map(String);t.source='Sleeper roster API · '+(liveRosterSnapshot.checked_at||'timestamp unknown');}
  return t;
 }
 if(!record)return null;
 const t=pfo52FutureTeam(Number(record.roster_id));if(!t)return null;
 if(w===pfo52Cur()&&Array.isArray(record.starters)&&record.starters.length){t.starters=record.starters.map(String);t.source='Sleeper Week '+w+' matchup submission';}
 return t;
}
function pfo53ModelPlan(team,w,past){return pfo53MatchMode==='submitted'?pfo52Actual(team,w):pfo52Best(team,w,past);}
const pfo53OriginalRenderMatch=pfo52Render;
pfo52Render=function(){pfo53OriginalRenderMatch();const root=$('pfo52-matchup');if(!root)return;const w=pfo52Week,past=w<pfo52Cur(),ours=pfo53CurrentTeam(w,'ours'),opp=pfo53CurrentTeam(w,'theirs');if(!ours)return;
 const duel=root.querySelector('.pfo52-duel');if(!duel)return;
 const mode=pfo53MatchMode,oursPlan=pfo53ModelPlan(ours,w,past),oppPlan=opp?pfo53ModelPlan(opp,w,past):null;
 const controls='<div class="pfo53-toggle" role="group" aria-label="Lineup comparison mode"><button type="button" data-pfo53-mode="submitted" aria-pressed="'+(mode==='submitted')+'">Submitted lineup</button><button type="button" data-pfo53-mode="optimal" aria-pressed="'+(mode==='optimal')+'">Best projected</button><small>'+(past?'Final league-scored data':mode==='submitted'?'Sleeper choices, not FFO picks':'Advisory only · never submits')+'</small></div>';
 duel.insertAdjacentHTML('beforebegin',controls);
 const label=mode==='submitted'?'Submitted':'Best projected';duel.innerHTML='<article><div class="pfo52-panhead"><h3>Dirty Birds · '+label+'</h3><small>'+e(ours.source||'Sleeper')+'</small></div>'+pfo52Table(ours,oursPlan,w,past,'none')+'</article><article><div class="pfo52-panhead"><h3>'+e(opp?.name||'Opponent TBD')+' · '+label+'</h3><small>'+(opp?e(opp.source||'Sleeper'):'No verified pairing')+'</small></div>'+(opp?pfo52Table(opp,oppPlan,w,past,'none'):'<p class="pfo52-dim">Matchup unavailable</p>')+'</article>';
 const board=root.querySelector('.pfo52-scoreboard');if(board){const me=past?ours.score:pfo52LineupScore(ours,oursPlan.assignments,w,false).complete?pfo52LineupScore(ours,oursPlan.assignments,w,false).total:null;
 const opScore=opp&&oppPlan?pfo52LineupScore(opp,oppPlan.assignments,w,false):null;
 const other=past?opp?.score:(opScore?.complete?opScore.total:null);
 const parts=board.querySelectorAll('strong');if(parts[0])parts[0].textContent=pfo52PointLabel(me);if(parts[1])parts[1].textContent=pfo52PointLabel(other);
 const titles=board.querySelectorAll('small');if(titles[0])titles[0].textContent='DIRTY BIRDS · '+(past?'FINAL':label.toUpperCase()+' MODEL');if(titles[1])titles[1].textContent=(opp?.name||'Opponent TBD')+' · '+(past?'FINAL':label.toUpperCase()+' MODEL');}
};
document.addEventListener('click',event=>{const b=event.target.closest('[data-pfo53-mode]');if(b){pfo53MatchMode=b.dataset.pfo53Mode;pfo52Render();}});
// Automatic weekly PFO status, current data first; displayed timestamps are those of the source.
function pfo53WeekFocus(){const over=$('overview');if(!over)return;let host=$('pfo53-weekfocus');if(!host){host=document.createElement('div');host.id='pfo53-weekfocus';host.className='pfo53-weekfocus';(over.querySelector('.pfo49-front')||over.firstElementChild).after(host);}
 const wk=pfo52Cur(),team=pfo53CurrentTeam(wk,'ours'),match=pfo52Match(wk),other=match?.theirs,starters=team?.starters?.filter(x=>x!=='0').length;
 host.innerHTML='<div class="pfo53-quick"><b>WEEK '+wk+' · DIRTY BIRDS</b><span>Submitted '+e(starters==null?'unavailable':starters)+' · '+e(other?pfo52Owner(other.roster_id):'Opponent pending')+'</span></div><small>Submitted roster read: '+e(liveRosterSnapshot?.checked_at?new Date(liveRosterSnapshot.checked_at).toLocaleString():'not connected')+' · Individual projections are FFO estimates, not verified NFL outcomes.</small>';
}
document.addEventListener('click',event=>{if(event.target.closest('[data-pfo53-gomatch]'))document.querySelector('nav button[data-page="matchup"]')?.click()});
const pfo53PreviousRoster=renderRosterComparison;
renderRosterComparison=function(){pfo53PreviousRoster();pfo53WeekFocus();const live=liveRosterSnapshot;if(!live)return;
 const snap=gm47Snapshot?.rosters?.find(x=>Number(x.roster_id)===Number(live.roster_id));const a=(live.starters||[]).map(String),b=(snap?.starters||[]).map(String);
 if(b.length&&a.join('|')!==b.join('|')){const st=$('actualstatus');if(st)st.insertAdjacentHTML('beforeend','<div class="pfo53-noactual">Published league archive and live Sleeper roster disagree. Actual starters above come from the directly checked roster endpoint ('+e(live.checked_at||'timestamp unknown')+'), not the archived snapshot.</div>');}
};
// Hard eligibility and schedule veto: language interpretation never overrules sourced byes/ownership.
const pfo53PreviousAsk=pfo51Ask;
pfo51Ask=function(q){const query=String(q||'').trim(),area=$('pfo51-answer');if(!area)return;
 const replacement=/\b(start|play|use|replace|bench|over|instead of)\b/i.test(query)&&/\b(qb|quarterback)\b/i.test(query);
 if(!replacement)return pfo53PreviousAsk(q);
 const wantedWeek=Number((query.match(/\bweek\s*(\d{1,2})\b/i)||[])[1]||pfo52Cur());
 if(wantedWeek<1||wantedWeek>18){area.textContent='Select an NFL week from 1–18.';return;}
 if(!pfo49Schedule?.complete){area.innerHTML='<h3>QB replacement · Week '+wantedWeek+'</h3><p>Cannot screen quarterbacks until the complete NFL schedule loads. A missing schedule is not a confirmed game or a confirmed BYE.</p>';return;}
 const roster=pfo53CurrentTeam(wantedWeek,'ours'),ids=new Set((roster?.members||[]).map(x=>String(x.id))),starters=new Set((roster?.starters||[]).map(String));
 const named=pfo53QuarterbackBaseline(query,roster);
 const eligible=(liveRosterSnapshot?.players||[]).filter(x=>pfo52Pos(x)==='QB'&&!starters.has(String(x.player_id))&&pfo49ScheduleWeek(x,wantedWeek)&&pfo52HealthDecision(x.player_id).allow);
 const knownOwnership=!!leagueOwnedIds&&ownershipCheckedMs&&Date.now()-ownershipCheckedMs<300000;
 let fa=[];if(knownOwnership)fa=(pfo49Players.length?pfo49Players:pfo49Dir()).filter(x=>x.position==='QB'&&!ids.has(String(x.id))&&!waiverIsRostered(x.name,x.id)&&pfo49ScheduleWeek(x,wantedWeek)&&pfo52HealthDecision(x.id).allow);
 const rows=[...eligible.map(x=>({id:String(x.player_id),p:x,type:'Your bench'})),...fa.map(x=>({id:String(x.id),p:x,type:'Verified free agent'}))].map(x=>({...x,model:pfo52Points(x.id,wantedWeek)})).filter(x=>x.model?.points!=null).sort((a,b)=>b.model.points-a.model.points).slice(0,8);
 const starterName=named?.name||'Named current starter',starterVal=named?pfo52Points(named.player_id,wantedWeek)?.points:null;
 area.innerHTML='<h3>Week '+wantedWeek+' QB replacement screen</h3><p><b>Baseline:</b> '+e(starterName)+' · '+pfo52PointLabel(starterVal)+' FFO model pts. Bye-week players and long-term unavailable players are excluded.</p>'+(rows.length?rows.map(x=>'<div class="pfo51-query-result"><b>'+pfo49Link(x.id)+'</b> · '+e(x.type)+' · <b>'+pfo52PointLabel(x.model.points)+'</b> projected FFL pts<small>'+e(x.model.source||'FFO model')+'</small></div>').join(''):'<p>No eligible alternative could be supported for that week from currently verified data.</p>')+'<p class="pfo51-fine">'+(knownOwnership?'Free-agent ownership checked within five minutes.':'Free agents are withheld until the latest league-ownership verification is available.')+' This is research, not an automatic recommendation or lineup change. The language layer is rule-based, NOT a hosted LLM.</p>';
};
// Report current-week status and last verified participation as distinct events; never declare a future week cleared.
const pfo53PreviousInjury=updateInjuryView;
updateInjuryView=function(){pfo53PreviousInjury();const root=$('injuries');if(!root)return;const week=pfo52Cur();
 for(const tr of root.querySelectorAll('tr')){const p=(liveRosterSnapshot?.players||[]).find(x=>x.name&&normPlayer(tr.cells?.[0]?.textContent||'').startsWith(normPlayer(x.name)));if(!p||pfo52Pos(p)==='DEF')continue;
  const stats=pfo50StatsFor(p.player_id)?.games||[];const participated=stats.filter(g=>Number(g.week)<week&&Number(g.week)>=week-2&&Object.values(g.stats||{}).some(v=>typeof v==='number'&&v>0)).sort((a,b)=>b.week-a.week)[0];
  if(participated){const div=document.createElement('div');div.className='pfo53-compact';div.textContent='Recorded statistical participation: W'+participated.week+' (does not determine W'+week+' availability)';tr.cells[2]?.appendChild(div);}
  const o=(nflVerified?.players||[]).find(x=>normPlayer(x.name)===normPlayer(p.name));const current=Number(nflVerified?.report_week)===week&&Number(nflVerified?.report_season)===Number(window.dbNflSeason||2026);
  if(o&&/questionable/i.test(String(o.game_status))&&!current)tr.cells[1].innerHTML='<b>'+((Number(nflVerified?.report_week)>0&&Number(nflVerified.report_week)<week)?'Prior report Q · W'+e(nflVerified.report_week):'Q · report week unverified')+'</b><div class="pfo53-compact">Week '+week+' clearance unverified; previous participation does not establish new-game availability.</div>'; 
 }
};
// The roster-only championship remains above outdated league odds, which are archived/collapsed.
function pfo53ReorderChamp(){const champ=$('championship'),plan=$('pfo49-playoff-plan');if(!champ||!plan)return;champ.prepend(plan);}
// 100,000 reproducible opponent-conditional player-score draws in a background worker.
let pfo53SimWorker=null,pfo53SimKey='',pfo53SimResults={};
function pfo53RenderSimResult(el,r){el.dataset.simPhase='result';el.innerHTML='<b>100,000-draw Dirty Birds player-score simulation · fixed seed '+r.seed+'</b><div class="pfo52-champgrid">'+r.results.map(x=>'<div class="pfo52-champbox"><small>W'+x.week+' · P10 / P50 / P90</small><strong>'+pfo52Money(x.median,1)+'</strong><small>'+pfo52Money(x.q10,1)+'–'+pfo52Money(x.q90,1)+' modeled FFL pts</small></div>').join('')+'</div><p class="pfo53-compact">Illustrative, UNCALIBRATED score uncertainty using roster player point baselines, position-dependent volatility and simplified same-team correlation. Not championship-winning odds. Injuries/trades and changing future starters are not simulated. 100,000 draws reduce Monte Carlo sampling noise—not prediction error.</p><button type="button" id="pfo53-sim-button">Rerun 100,000 score simulations</button>';el.querySelector('button')?.addEventListener('click',()=>{pfo53SimKey='';pfo53Simulate();});}

function pfo53Simulate(){const el=$('pfo53-simulation');if(!el)return;
 const team=pfo52FutureTeam(Number(window.dbRosterId||1));if(!team){el.innerHTML='Current roster unavailable.';return;}
 const weeks=[15,16,17].map(w=>{const best=pfo52Best(team,w,false);return {week:w,complete:best.complete,players:best.assignments.map(x=>({id:x.id,position:pfo52Pos(pfo52Info(x.id)),team:pfo52Info(x.id).team,mean:pfo52Points(x.id,w)?.points})).filter(x=>x.id)};});
 const key=JSON.stringify(weeks);if(pfo53SimKey===key&&pfo53SimResults.done){pfo53RenderSimResult(el,pfo53SimResults);return;}pfo53SimKey=key;pfo53SimResults={done:false};
 if(weeks.some(x=>!x.complete||x.players.some(p=>!Number.isFinite(p.mean)))){el.dataset.simPhase='blocked';el.innerHTML='<b>100,000-draw simulation withheld.</b> At least one required starting slot lacks a supported player estimate. Missing kicker/DST data is not zero. Load/reconcile Sleeper history first.';return;}
 el.dataset.simPhase='pending';el.innerHTML='<b>Computing 100,000 reproducible conditional score simulations…</b><small> No validated championship odds; purely forecast-uncertainty illustration.</small>';
 const source=`self.onmessage=e=>{const {weeks,seed,n}=e.data;let state=seed>>>0;function rand(){state^=state<<13;state^=state>>>17;state^=state<<5;return ((state>>>0)+1)/4294967297}function gauss(){return Math.sqrt(-2*Math.log(Math.max(1e-10,rand())))*Math.cos(2*Math.PI*rand())}let results=[];for(const row of weeks){const samples=new Float64Array(n);for(let i=0;i<n;i++){let v=0,clubs=new Map();for(const p of row.players){let t=clubs.get(p.team);if(t===undefined){t=gauss();clubs.set(p.team,t)}const sig=({QB:.34,RB:.42,WR:.48,TE:.5,K:.58,DEF:.7})[p.position]||.5;const draw=p.mean*(1+sig*(.22*t+.975*gauss()));v+=p.position==='DEF'?Math.max(-10,draw):Math.max(0,draw)}samples[i]=v;}samples.sort();results.push({week:row.week,q10:samples[Math.floor(.10*n)],median:samples[Math.floor(.5*n)],q90:samples[Math.floor(.9*n)]});}postMessage({results,seed,n});}`;
 try{if(pfo53SimWorker)pfo53SimWorker.terminate();const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));const worker=new Worker(url);pfo53SimWorker=worker;worker.onmessage=evt=>{URL.revokeObjectURL(url);const r=evt.data;pfo53SimResults={done:true,...r};pfo53SimWorker=null;pfo53RenderSimResult($('pfo53-simulation')||el,r);worker.terminate();};worker.onerror=()=>{URL.revokeObjectURL(url);pfo53SimWorker=null;($('pfo53-simulation')||el).textContent='Simulation execution failed; do not rely on probability estimates.';};worker.postMessage({weeks,seed:PFO53_SIM_SEED,n:100000});}
 catch(err){el.textContent='This browser cannot run the background simulation; no results generated.';}
}
const pfo53PrevPlanner=pfo49RenderPlanner;
pfo49RenderPlanner=function(){pfo53PrevPlanner();pfo53ReorderChamp();const el=$('pfo49-playoff-plan');if(!el)return;
 let panel=$('pfo53-simulation');if(!panel){panel=document.createElement('div');panel.id='pfo53-simulation';panel.className='pfo53-sim';el.insertBefore(panel,el.children[1]||null);}
 if(pfo53SimResults.done&&pfo53SimKey){pfo53RenderSimResult(panel,pfo53SimResults);return;}if(pfo53SimWorker&&pfo53SimKey){panel.dataset.simPhase='pending';panel.innerHTML='<b>Computing 100,000 player-score simulations…</b>';return;}if(!['pending','result'].includes(panel.dataset.simPhase)){panel.dataset.simPhase='ready';panel.innerHTML='<button type="button" id="pfo53-sim-button">Run 100,000 score simulations</button><span class="pfo53-compact"> · Each playoff week, Dirty Birds player scores only; independently modeled, not league-manager matchup odds.</span>';}
 if(panel.dataset.simPhase==='ready')panel.querySelector('button')?.addEventListener('click',pfo53Simulate);
};
// Keep source-specific first-hand quotes only; no invented Coleman/Wilson statements.
const pfo53PrevPlayer=pfo49RenderPlayer;
pfo49RenderPlayer=function(){pfo53PrevPlayer();const id=pfo49Selected;if(!id)return;const p=pfo52Info(id),root=$('pfo49-profile');if(!root)return;
 const coach=pfo49CoachData(id);if(['jonah coleman','garrett wilson'].includes(String(p.name).toLowerCase())&&!coach&&!PFO53_ROLE_REPORTS[normPlayer(p.name)]){const details=[...root.querySelectorAll('details')].find(x=>/Coaching \/ role updates/.test(x.textContent));if(details){const hint=document.createElement('p');hint.className='pfo53-noactual';hint.textContent=p.name+': increased-touch coaching comments have been requested for sourcing, but no verified dated primary-source quotation is connected. Do not assume the coach promised a workload increase.';details.appendChild(hint);}}
};
// Start once after the initial DOM setup; progressive network history hydration never blocks page open.
setTimeout(()=>{pfo53ReorderChamp();pfo53WeekFocus();},1900);
// Full-season history is requested when matchup, championship or coaching is entered.
document.querySelector('nav button[data-page="championship"]')?.addEventListener('click',()=>{pfo49RenderPlanner();});


// Post-audit hardening: fantasy defense IDs are NFL team abbreviations, not regular player IDs.
const pfo53UnresolvedInfo=pfo49Info;
pfo49Info=function(id){const base=pfo53UnresolvedInfo(id),team=gm47CanonicalTeam(id);if(pfo53DefNames[team]&&(!base.position||['DEF','DST','D/ST'].includes(String(base.position).toUpperCase())||base.name==='Player '+id))return {...base,id:String(id),name:pfo53DefNames[team]+' D/ST',position:'DEF',team};return base;};
// Prefer real Sleeper league scoring for a known week; never call an unloaded matchup a 0-point performance.
const pfo53PriorRosterRows=pfo52RosterPoints;
pfo52RosterPoints=function(){pfo53PriorRosterRows();const host=$('actual-lineup'),wk=pfo52Cur();if(!host)return;
 const roster=liveRosterSnapshot,started=(roster?.starters||[]).map(String);
 [...host.querySelectorAll('tr')].forEach((tr,i)=>{const pid=started[i];if(!pid||pid==='0'||!['K','DEF'].includes(pfo52Pos(pfo52Info(pid))))return;
  const cell=tr.cells?.[1];if(!cell)return;cell.querySelector('.pfo53-k-model')?.remove();const r=pfo52Points(pid,wk),s=document.createElement('div');s.className='pfo53-k-model';s.textContent=r?.points!=null?'Week '+wk+' estimated '+pfo52Money(r.points)+' FFL pts · historical/model':'Week '+wk+' forecast unavailable · '+(r?.source||'awaiting data');cell.append(s);
 });
};
// Distinguish the named QB to replace by surname, or fall back to the actual submitted QB.
function pfo53QuarterbackBaseline(query,team){const found=(liveRosterSnapshot?.players||[]).filter(p=>pfo52Pos(p)==='QB');
 const byName=found.find(p=>{const full=normPlayer(p.name),last=normPlayer(String(p.name||'').split(' ').at(-1));return full&&normPlayer(query).includes(full)||last&&last.length>=4&&normPlayer(query).includes(last)});
 if(byName)return byName;const starterIDs=new Set((team?.starters||[]).map(String));return found.find(p=>starterIDs.has(String(p.player_id)))||null;
}
// The baseline lookup above is referenced in the rule-based Ask replacement branch.
// Noncommercial player/news references; verified primary club material or plainly labeled secondary reporting.
const PFO53_ROLE_REPORTS={
 'garrettwilson': {date:'2026-10-22',speaker:'Frank Reich, Jets offensive coordinator',quote:'Can we do it more? Sure, I want to get it to him.',source:'Associated Press report carried by Fox Sports',link:'https://www.foxsports.com/articles/nfl/jets-frank-reich-understands-garrett-wilsons-frustration-wants-to-get-him-involved-earlier',firsthand:false,club:'https://www.newyorkjets.com/news/notebook-frank-reich-game-planning-for-lions-getting-ball-to-garrett-wilson-09-24-2026'},
 'jonahcoleman': {date:'2026-10-26',speaker:'Sean Payton, Broncos head coach',quote:'Like anything else, I think it’s something you earn and he’s done a good job of that.',source:'Reporter Nick Kosmider, via 4for4; team press conference available',link:'https://www.4for4.com/news/broncos-rb-jonah-coleman-has-earned-his-touches',firsthand:false,club:'https://www.denverbroncos.com/video/hc-sean-payton-on-denver-s-special-teams-unit-the-group-has-done-a-real-good-job'}
};
const pfo53PrevProfile=pfo49RenderPlayer;
pfo49RenderPlayer=function(){pfo53PrevProfile();const id=pfo49Selected;if(!id)return;const profile=$('pfo49-profile'),player=pfo52Info(id),report=PFO53_ROLE_REPORTS[normPlayer(player.name)];if(!profile||!report)return;
 const detail=[...profile.querySelectorAll('details')].find(d=>/Coaching \/ role updates/.test(d.querySelector('summary')?.textContent||''));if(!detail)return;
 const existing=detail.querySelector('.pfo53-club-report');if(existing)existing.remove();
 const section=document.createElement('div');section.className='pfo53-club-report';section.innerHTML='<b>'+e(report.speaker)+' · '+e(report.date)+'</b><blockquote>'+e(report.quote)+'</blockquote><small>'+e(report.source)+' · reported quotation (not independently checked verbatim against primary audio)</small><p><a href="'+e(report.link)+'" target="_blank" rel="noopener noreferrer">Read attributed report</a> · <a href="'+e(report.club)+'" target="_blank" rel="noopener noreferrer">Team-published material</a></p><p>Stated coaching intent is not an observed snap or carry increase; compare with the player\'s measured usage after the next game.</p>';
 detail.append(section);
};
// Player intel topline for K/DST must not show receiver-specific rows.
const pfo53OriginalProfileAgain=pfo49RenderPlayer;
pfo49RenderPlayer=function(){pfo53OriginalProfileAgain();const id=pfo49Selected;if(!id)return;const root=$('pfo49-profile'),pos=pfo52Pos(pfo52Info(id));if(!['QB','K','DEF'].includes(pos)||!root)return;
 const tiles=root.querySelector('.pfo49-statgrid');if(!tiles)return;
 for(const tile of [...tiles.children]){const label=tile.querySelector('span')?.textContent||'';
  if((pos==='QB'&&/targets|catches|receptions|receiving/i.test(label))||(['K','DEF'].includes(pos)&&/targets|catches|receptions|snap share|Independent FFO model PPG/i.test(label)))tile.remove();}
};
// Recover/retry per-week scoring history when the league ID appears after initial page startup.
let pfo53HistoryBusy=false;
const pfo53OriginalHistory=pfo53WarmHistory;
pfo53WarmHistory=async function(){if(pfo53HistoryBusy)return;pfo53HistoryBusy=true;try{await pfo53OriginalHistory();}finally{pfo53HistoryBusy=false;}};
setTimeout(()=>{if(pfo53HistoryState==='unavailable'&&(window.dbLeagueId||LEAGUE_ID_OVERRIDE))pfo53WarmHistory();},11000);
setInterval(()=>{if(!document.hidden&&document.querySelector('#matchup.page.active,#coaching.page.active,#championship.page.active')&&(pfo53HistoryState==='unavailable'||(pfo53HistoryState==='loaded'&&!PFO52_WEEK_CACHE.size)))pfo53WarmHistory();},120000);


// Progressive disclosure on existing research cards: three decision numbers stay visible; all source metrics remain accessible.
function pfo53CompactStatRows(scope,radar=false){if(!scope)return;
 for(const article of scope.querySelectorAll(radar?'article.pfo51-radar-card':'article.pfo49-waiver')){
  if(article.dataset.pfo53Dense==='yes')continue;
  const univ=article.querySelector('.pfo51-universal'),tiles=univ?.querySelector('.pfo51-universal-grid');
  if(!tiles||tiles.children.length<=3)continue;
  article.dataset.pfo53Dense='yes';
  const disclosure=document.createElement('details');disclosure.className='pfo53-dense-details';
  const summary=document.createElement('summary');summary.textContent='All stats, calculation notes & source details';disclosure.append(summary);
  const more=document.createElement('div');more.className='pfo51-universal-grid pfo53-moremetrics';
  for(const el of [...tiles.children].slice(3))more.appendChild(el);
  disclosure.append(more);
  for(const small of [...univ.children].filter(x=>x.tagName==='SMALL'))disclosure.append(small);
  univ.append(disclosure);
 }
}
const pfo53PriorRadar=pfo49RenderRadar;
pfo49RenderRadar=function(){pfo53PriorRadar();pfo53CompactStatRows($('pfo49-radar'),true);};
const pfo53PriorWaiver=renderWaiverScouting;
renderWaiverScouting=function(){pfo53PriorWaiver();pfo53CompactStatRows($('waiverlive'));};


/* 5.4 shared point forecasts and decisive-position scouting. */
const pfo54OriginalGM=gm47Render;
gm47Render=function(){pfo54OriginalGM();const host=$('gm47-report'),p=pfo52Info(gm47State.player),w=gm47Week();if(!host||!p)return;
 const block=host.querySelector('.card .pfo49-statgrid');if(!block)return;
 const pos=pfo52Pos(p),model=pfo52Points(p.id||p.player_id,w),last=pfo53Scored(p.id||p.player_id,w-1).at(-1),row=pfo50StatsFor(p.id||p.player_id),nums=[];
 nums.push(['W'+w+' FFL forecast',model?.points==null?'—':pfo52Money(model.points)]);
 nums.push(['Last recorded FFL',last?pfo52Money(last.points)+' · W'+last.week:'—']);
 if(pos==='K'||pos==='DEF'){
  const scored=pfo53Scored(p.id||p.player_id,w-1).slice(-5);nums.push(['Recorded PPG',scored.length?pfo52Money(scored.reduce((s,x)=>s+x.points,0)/scored.length):'—']);nums.push(['Scored sample',scored.length||'—']);
 }else if(pos==='QB'){
  nums.push(['Recent pass yds',row?.latest?.passing_yards??row?.latest?.pass_yd??'—']);nums.push(['Pass TD',row?.latest?.passing_tds??row?.latest?.pass_td??'—']);
 }else{nums.push(['Targets / game',row?.targets_per_game??'—']);nums.push(['Latest catches',row?.latest?.receptions??'—']);}
 block.innerHTML=nums.map(([label,val])=>pfo50StatTile(label,val)).join('');
 const call=host.querySelector('.card .pfo49-callout');if(call){const first=call.querySelector('p:nth-of-type(2)');if(first)first.textContent=model?.points!=null?'Week '+w+' FFO FFL projection: '+pfo52Money(model.points)+' pts · '+(model.source||'modeled; verify against game-day conditions'):'Week '+w+' projection unavailable: '+(model?.source||'no verified baseline');}
};
/* Actual recorded points are separate from forecasts, for every submitted starter. */
const pfo54OldRoster=pfo52RosterPoints;
pfo52RosterPoints=function(){pfo54OldRoster();const host=$('actual-lineup'),w=pfo52Cur(),starters=(liveRosterSnapshot?.starters||[]).map(String);if(!host)return;
 for(const [i,tr] of [...host.querySelectorAll('tr')].entries()){
  const id=starters[i];if(!id||id==='0'||!tr.cells?.[1])continue;
  tr.cells[1].querySelectorAll('.pfo54-proj,.pfo53-k-model').forEach(x=>x.remove());
  const f=pfo52Points(id,w),div=document.createElement('span');div.className='pfo54-proj';div.textContent=f?.points!=null?'Week '+w+' projected '+pfo52Money(f.points)+' FFL pts · '+(f.source?.startsWith('Recorded')?'historical baseline':'FFO estimate'):(f?.bye?'BYE · no NFL game':'Week '+w+' projection unavailable');tr.cells[1].append(div);
 }
};
/* All metrics remain swipeable on one line; deep notes stay in expandable disclosure. */
const pfo54OldDense=pfo53CompactStatRows;
pfo53CompactStatRows=function(root,radar=false){pfo54OldDense(root,radar);if(!root)return;
 for(const article of root.querySelectorAll(radar?'article.pfo51-radar-card':'article.pfo49-waiver')){
  if(article.dataset.pfo54Strip)return;const univ=article.querySelector('.pfo51-universal'),first=univ?.querySelector('.pfo51-universal-grid');if(!first)continue;
  const more=univ.querySelector('.pfo53-moremetrics');if(more)for(const div of [...more.children])first.append(div);
  if(!univ.querySelector('.pfo54-swipelabel'))first.insertAdjacentHTML('beforebegin','<small class="pfo54-swipelabel">Swipe stats sideways ↔ · tap to expand evidence</small>');
  article.dataset.pfo54Strip='1';
 }
};
/* Exclude uncertain IR candidates from action suggestions until cleared, not from historical profiles. */
const pfo54HealthBefore=pfo52HealthDecision;
pfo52HealthDecision=function(id){const existing=pfo54HealthBefore(id),m=pfo52HealthCatalog?.get(String(id))||{},notes=String(m.injury_notes||'').toLowerCase(),st=String(m.injury_status||m.status||'').toUpperCase();
 if(['IR','PUP','NFI','SUSPENDED'].includes(st)||/season[- ]ending|out for (the )?season|will miss remainder/.test(notes))return {allow:false,reason:'Roster metadata indicates extended unavailability; confirm a dated activation before actionable research'};
 return existing;};
/* Coaching hindsight percentage is position-legal selected starter overlap, NOT subjective judgment. */
const pfo54OldReview=pfo52Review;
pfo52Review=async function(){await pfo54OldReview();const host=$('pfo52-coaching');if(!host||host.querySelector('.pfo54-coach-score'))return;
 let chosen=0,possible=0,weeks=0;
 for(const x of pfo52ReviewEntries||[]){if(x.delta==null||!x.best?.complete||!x.team)continue;
  const optimal=new Set(x.best.assignments.map(y=>String(y.id)).filter(Boolean)),submitted=new Set((x.team.starters||[]).map(String).filter(y=>y!=='0'));
  const valid=optimal.size;if(!valid)continue;weeks++;possible+=valid;for(const id of submitted)if(optimal.has(id))chosen++;
 }
 const value=possible?((chosen/possible)*100).toFixed(1)+'%':'—';const banner=document.createElement('div');banner.className='pfo54-coach-score';banner.innerHTML='<strong>'+e(value)+'</strong><div><b>Season Start/Sit Approval</b><p>'+chosen+' of '+possible+' hindsight-optimal selected-player credits · '+weeks+' audited weeks</p><p>Credits players included in an optimal legal final-score lineup. Ties and equally-scoring alternatives can affect the result; excludes incomplete historical records.</p></div>';
 host.prepend(banner);
};
/* Do not re-present old 2026 odds as current. */
const pfo54OldPlanner=pfo49RenderPlanner;
pfo49RenderPlanner=function(){pfo54OldPlanner();const host=$('pfo49-playoff-plan');if(!host)return;
 let box=$('pfo54-qualification');if(!box){box=document.createElement('div');box.id='pfo54-qualification';box.className='pfo54-champmessage';host.prepend(box);}
 box.innerHTML='<b>Playoff qualification · title appearance · title win</b><p>Percentages need a verified FFL-wide bracket, standings tiebreakers, future opponent pairings, and simulated scores for every remaining league matchup. The older stored percentages are archived, not live 5.4 odds. Current odds withheld until that audit is complete; the separate 100,000-draw Dirty Birds scoring ranges remain visible below.</p>';
};
/* Overview: prioritize week, submitted choice verification and actionable navigation. */
function pfo54OverviewPulse(){const page=$('overview');if(!page)return;
 const wk=pfo52Cur(),focus=$('pfo53-weekfocus');if(focus&&page.firstElementChild!==focus)page.prepend(focus);
 let el=$('pfo54-briefing-nav');if(!el){el=document.createElement('div');el.id='pfo54-briefing-nav';page.insertBefore(el,focus?.nextSibling||page.firstElementChild)}
 const verified=!!liveRosterSnapshot?.checked_at,age=verified?Math.round((Date.now()-new Date(liveRosterSnapshot.checked_at).getTime())/60000):null;
 const latest=(liveRosterSnapshot?.starters||[]).filter(x=>x!=='0').length;
 const health=(liveRosterSnapshot?.players||[]).filter(p=>(liveRosterSnapshot.starters||[]).includes(p.player_id)&&/^(OUT|IR|PUP|DOUBTFUL)$/i.test(p.injury_status||''));
 el.innerHTML='<div class="pulse"><b>STARTERS · W'+wk+'</b><span>'+(verified?e(latest)+' submitted · '+e(Number.isFinite(age)?age+'m old':'age unknown'):'Live lineup unverified')+'</span></div>'+
 '<div class="pulse"><b>HEALTH CHECK</b><span>'+(health.length?health.length+' Sleeper-tagged starter(s) · verify official status':'No confirmed medical clearance implied')+'</span></div>';
}
const pfo54OldFocus=pfo53WeekFocus;
pfo53WeekFocus=function(){pfo54OldFocus();pfo54OverviewPulse()};
document.addEventListener('click',e=>{const b=e.target.closest('[data-pfo54-open]');if(b)document.querySelector('nav button[data-page="'+b.dataset.pfo54Open+'"]')?.click()});
/* Commissioner UI: authenticated via verified Cloudflare Access JWT + short server-verified PIN session. */
const comUI={unlocked:false,cases:[],selected:null,loaded:false};
async function comReq(route,opts={}){const response=await fetch('/api/commissioner/'+route,{credentials:'same-origin',cache:'no-store',...opts});const type=response.headers.get('content-type')||'';if(!type.includes('application/json'))throw Error('Cloudflare Access login may be required: open the protected commissioner URL and authenticate.');const obj=await response.json();if(!response.ok)throw Error(obj.error||'HTTP '+response.status);return obj;}
function comMsg(message,bad=false){const el=$('com-access');if(!el)return;el.textContent=message;el.style.color=bad?'#ffb2a9':'#88e8c3';}
async function comStatus(){try{const data=await comReq('status');comUI.unlocked=!!data.unlocked;comUI.loaded=true;
  if(!data.ready){
  const v=data.pin_secret_format||{},bad=[v.hash_ok===false?'COMMISSIONER_PIN_HASH':null,v.salt_ok===false?'COMMISSIONER_PIN_SALT':null,v.session_ok===false?'COMMISSIONER_SESSION_SECRET':null].filter(Boolean);
  comMsg(bad.length?'Preview secret format is invalid: '+bad.join(', ')+'. Check these entries in Cloudflare Preview; your PIN has not been tested.':'Private administrator configuration incomplete. Check Preview settings.',true);
  $('com-unlock').hidden=true;$('com-workspace').hidden=true;return;
 }
  $('com-unlock').hidden=!!data.unlocked;$('com-workspace').hidden=!data.unlocked;comMsg(data.unlocked?'Commissioner access verified · session expires after 20 minutes.':'Your admin email is verified. Enter your PIN to open private cases.');if(data.unlocked){$('com-identity').textContent='Authenticated commissioner · '+data.identity;await comRefresh()}
 }catch(err){comUI.unlocked=false;$('com-unlock').hidden=true;$('com-workspace').hidden=true;comMsg('Protected service unavailable: '+err.message,true)}}
async function comRefresh(){const obj=await comReq('cases');comUI.cases=obj.cases||[];comDrawList()}
function comDrawList(){const root=$('com-list');if(!root)return;const q=String($('com-filter')?.value||'').toLowerCase(),list=comUI.cases.filter(c=>[c.case_no,c.team,c.owner,c.rule_ref,c.status].some(v=>String(v||'').toLowerCase().includes(q)));
 $('com-summary').innerHTML=['Cases '+comUI.cases.length,'Issued '+comUI.cases.filter(x=>x.status==='ISSUED').length,'Appealed '+comUI.cases.filter(x=>x.status==='APPEALED').length].map(s=>'<span class="com-badge">'+e(s)+'</span>').join('');
 root.innerHTML=list.length?list.map(c=>'<button type="button" class="com-case" data-com-case="'+c.id+'"><strong>'+e(c.case_no)+'</strong> <span class="com-badge">'+e(c.status)+'</span><small>'+e(c.team)+' · '+e(c.owner)+' · W'+e(c.week||'—')+' · '+e(c.evidence_count)+' attachment(s)</small></button>').join(''):'<p class="com-muted">No matching administrative cases.</p>';
}
async function comOpen(id){const x=await comReq('cases/'+id);comUI.selected=x.case;const c=x.case,root=$('com-detail');if(!root)return;
 let h='<div><b>'+e(c.case_no)+'</b> · <span class="com-badge">'+e(c.status)+'</span><p class="com-muted">'+e(c.league)+' · '+e(c.team)+' / '+e(c.owner)+' · Incident '+e(c.occurred_on)+' · W'+e(c.week||'—')+'</p></div>';
 h+='<p><b>Category / rule:</b> '+e(c.rule_ref||'General')+'</p><p><b>Action / supporting facts:</b> '+e(c.violation)+'</p><p><b>Decision / consequence:</b> '+e(c.consequence)+'</p><p class="com-muted">Filed '+e(c.created_utc)+' by '+e(c.created_by)+' · No Sleeper action issued by this app.</p>';
 h+='<details><summary><b>Record action / appeal / reversal</b></summary><form id="com-event-form"><label for="com-action">Action</label><select id="com-action" name="event_type"><option value="ISSUED">Issue consequence</option><option value="NOTIFIED">Manager notified</option><option value="APPEALED">Appeal received</option><option value="RESOLVED">Decision resolved</option><option value="REVERSED">Reverse action</option><option value="NOTE">Internal case note</option></select><label for="com-reason">Reason / details / notice reference</label><textarea id="com-reason" name="note" minlength="8" required></textarea><button class="button primary" type="submit">Append immutable audit event</button></form></details>';
 h+='<details><summary><b>Evidence vault ('+x.evidence.length+')</b></summary><form id="com-upload-form"><label for="com-file">Photo, PDF (8 MB) or video (75 MB)</label><input type="file" id="com-file" name="evidence" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,video/mp4,video/quicktime,video/webm,.mov,.heic,.heif" required><button class="button" type="submit">Upload private evidence</button></form>'+(x.evidence||[]).map(v=>'<p><button type="button" class="button" data-com-file="'+v.id+'">Download '+e(v.original_name)+'</button><small class="com-quiet">'+e(v.sha256.slice(0,16))+'… · '+e(v.created_utc)+'</small></p>').join('')+'</details>';
 h+='<details><summary><b>Audit history ('+x.events.length+')</b></summary>'+x.events.map(y=>'<div class="com-event"><b>'+e(y.event_type)+'</b> '+e(y.note)+'<small>'+e(y.created_utc)+' · '+e(y.created_by)+'</small></div>').join('')+'</details>';
 h+='<button class="button" type="button" data-com-export="'+c.id+'">Export case summary</button><div id="com-detail-feedback" class="com-feedback" aria-live="polite"></div>';root.innerHTML=h;
}
async function comChallengeProof(pin){
 const c=await comReq('challenge');
 if(!window.crypto?.subtle)throw Error('SECURE_BROWSER_REQUIRED');
 if(typeof pin!=='string'||pin.length<6||pin.length>64)throw Error('ENTER_YOUR_COMPLETE_6_TO_64_CHARACTER_PIN');
 const salt=Uint8Array.from(String(c.salt).match(/.{2}/g),h=>parseInt(h,16));
 const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
 const derived=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:c.iterations,hash:'SHA-256'},base,256);
 const key=await crypto.subtle.importKey('raw',derived,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('FFO-COMMISSIONER-PROOF-v1:'+c.challenge)));
 const proof=Array.from(signed,b=>b.toString(16).padStart(2,'0')).join('');
 return {challenge:c.challenge,proof};
}
$('com-enter')?.addEventListener('click',async()=>{const pin=$('com-pin').value;const btn=$('com-enter');btn.disabled=true;comMsg('Verifying PIN securely…');try{const proof=await comChallengeProof(pin);await comReq('unlock',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(proof)});$('com-pin').value='';await comStatus()}catch(err){$('com-pin').value='';comMsg('PIN not accepted: '+err.message,true)}finally{btn.disabled=false}});
$('com-lock')?.addEventListener('click',async()=>{try{await comReq('lock',{method:'POST'})}finally{comUI.unlocked=false;comUI.cases=[];comUI.selected=null;$('com-detail').textContent='Locked.';await comStatus()}});
$('com-filter')?.addEventListener('input',comDrawList);
const comMaxEvidenceBytes=file=>String(file?.type||'').startsWith('video/')?75*1024*1024:8*1024*1024;
async function comUploadEvidence(caseId,file){
 if(!file||!file.size||file.size>comMaxEvidenceBytes(file))throw Error((file?.name||'File')+' exceeds its permitted size or is empty');
 const allowed=['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf','video/mp4','video/quicktime','video/webm'];
 if(!allowed.includes(file.type))throw Error((file.name||'Attachment')+': unsupported file type '+(file.type||'unknown'));
 return comReq('cases/'+caseId+'/evidence',{method:'POST',headers:{'content-type':file.type,'x-ffo-filename':encodeURIComponent(file.name)},body:file});
}
let comSavingNew=false;
$('com-case-form')?.addEventListener('submit',async(ev)=>{
 ev.preventDefault();if(comSavingNew)return;const f=ev.target,button=f.querySelector('[type="submit"]');
 const values=Object.fromEntries(new FormData(f).entries());const files=[...($('com-new-evidence')?.files||[])];
 comSavingNew=true;if(button)button.disabled=true;comMsg('Saving Commissioner Log entry…');
 let saved;
 try{saved=await comReq('cases',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(values)});}
 catch(err){comMsg('Log entry not filed: '+err.message,true);return;}
 finally{comSavingNew=false;if(button)button.disabled=false;}
 const c=saved.case;f.reset();$('com-new').open=false;
 comMsg('Commissioner Log '+c.case_no+' saved. '+(files.length?'Uploading '+files.length+' evidence file(s) independently…':'No penalty or Sleeper action executed.'));
 // Refresh and uploads are independent; navigation remains fully usable.
 void comRefresh().catch(err=>comMsg('Entry saved, but list refresh failed: '+err.message,true));
 if(!files.length){void comOpen(c.id).catch(()=>{});return;}
 void (async()=>{
  let done=0;const errors=[];
  for(const file of files){
   try{await comUploadEvidence(c.id,file);done++}
   catch(err){errors.push(file.name+': '+err.message)}
  }
  comMsg('Log '+c.case_no+': '+done+'/'+files.length+' attachments uploaded.'+(errors.length?' Failed: '+errors.join('; '):' All evidence saved privately.'),!!errors.length);
  void comRefresh().catch(()=>{});
  if(comUI.selected?.id===c.id||!comUI.selected)void comOpen(c.id).catch(()=>{});
 })();
});
document.addEventListener('click',async(ev)=>{const caseB=ev.target.closest('[data-com-case]'),evidB=ev.target.closest('[data-com-file]'),expB=ev.target.closest('[data-com-export]');
 try{if(caseB){await comOpen(Number(caseB.dataset.comCase))}else if(evidB&&comUI.selected){const id=Number(evidB.dataset.comFile);const r=await fetch('/api/commissioner/cases/'+comUI.selected.id+'/evidence/'+id,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('Evidence access denied');const blob=await r.blob(),link=document.createElement('a'),evRow=[...$('com-detail').querySelectorAll('[data-com-file]')].find(x=>Number(x.dataset.comFile)===id);link.href=URL.createObjectURL(blob);link.download=(evRow?.textContent||'case-evidence').replace(/^Download /,'');link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}else if(expB&&comUI.selected){const d=await comReq('cases/'+comUI.selected.id);const content=JSON.stringify({case:d.case,events:d.events,evidence_metadata:d.evidence,exported_at:new Date().toISOString()},null,2);const url=URL.createObjectURL(new Blob([content],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=d.case.case_no+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}
 catch(err){comMsg('Case action failed: '+err.message,true)}
});
const comSubmissionInFlight=new Set();
document.addEventListener('submit',async(ev)=>{
 const form=ev.target;if(!['com-event-form','com-upload-form'].includes(form?.id))return;
 ev.preventDefault();const c=comUI.selected;if(!c)return;
 const key=form.id+':'+c.id;if(comSubmissionInFlight.has(key))return;
 const msg=$('com-detail-feedback'),button=form.querySelector('[type="submit"]');comSubmissionInFlight.add(key);
 if(button)button.disabled=true;if(msg)msg.textContent='Saving securely…';
 try{
  if(form.id==='com-event-form'){
   const b=Object.fromEntries(new FormData(form).entries());
   await comReq('cases/'+c.id+'/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});
  }else{
   const file=new FormData(form).get('evidence');
   await comUploadEvidence(c.id,file);
  }
  if(msg)msg.textContent='Saved securely. Refreshing case history…';
  comMsg('Commissioner Log '+c.case_no+' saved. You can continue navigating.');
  void comRefresh().catch(()=>{});
  if(comUI.selected?.id===c.id)void comOpen(c.id).catch(err=>comMsg('Saved, but case display refresh failed: '+err.message,true));
 }catch(err){
  if(msg)msg.textContent='Not saved: '+err.message;
  comMsg('Case action failed: '+err.message,true);
 }finally{comSubmissionInFlight.delete(key);if(button)button.disabled=false}
});
document.querySelector('nav button[data-page="commissioner"]')?.addEventListener('click',comStatus);


// PFO 5.6: dated source confidence, not a made-up projection confidence percentage.
const pfo56Age=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?Date.now()-n:null};
const pfo56FmtStamp=v=>Number.isFinite(Date.parse(v||''))?new Date(v).toLocaleString():'Date not verified';
function pfo56SourceRail(area){
 const host=$(area);if(!host)return;
 let rail=host.querySelector('.pfo56-source-rail');
 if(!rail){rail=document.createElement('div');rail.className='pfo56-source-rail';host.prepend(rail)}
 const ownAge=ownershipCheckedMs?Date.now()-ownershipCheckedMs:null,ownFresh=ownAge!==null&&ownAge>=0&&ownAge<=300000&&!!leagueOwnedIds;
 const usageStamp=pfo50Independent?.checked_at||pfo49Metrics?.as_of||null,usageAge=pfo56Age(usageStamp);
 const researchStamp=area==='trade-intel'?tradeIdeasStamp||marketValueAsOf:waiverUsageStamp,researchAge=pfo56Age(researchStamp);
 const cells=[
  {label:ownFresh?'FFL OWNERSHIP CHECKED '+Math.floor(ownAge/60000)+'m AGO':'FFL OWNERSHIP STALE / UNVERIFIED',warn:!ownFresh},
  {label:usageStamp?'NFL USAGE AS OF '+pfo56FmtStamp(usageStamp):'NFL USAGE DATE UNKNOWN',warn:usageAge===null||usageAge>86400000},
  {label:researchStamp?'MODEL REPORT '+pfo56FmtStamp(researchStamp):'MODEL REPORT UNDATED',warn:researchAge===null||researchAge>172800000}
 ];
 rail.replaceChildren();
 for(const item of cells){const el=document.createElement('span');el.className='pfo56-source-chip'+(item.warn?' caution':'');el.textContent=item.label;rail.append(el)}
 let note=host.querySelector('.pfo56-model-caveat');
 if(!note){note=document.createElement('p');note.className='pfo56-model-caveat';host.prepend(note)}
 note.textContent='Observed NFL production and verified Sleeper ownership are not future projections or guaranteed player availability. Source gaps and stale scans remain labeled. No trades or claims submitted.';
}
const pfo56OldTrade=renderTradeScouting;
renderTradeScouting=function(){pfo56OldTrade();pfo56SourceRail('trade-intel')};
const pfo56OldWaiver=renderWaiverScouting;
renderWaiverScouting=function(){pfo56OldWaiver();pfo56SourceRail('waiverlive')};
const pfo56OldRadar=pfo49RenderRadar;
pfo49RenderRadar=function(){
 pfo56OldRadar();const host=$('pfo49-radar');if(!host)return;
 host.querySelector('.pfo56-source-rail')?.remove();
 const rail=document.createElement('div');rail.className='pfo56-source-rail';
 const valid=!!ownershipCheckedMs&&!!leagueOwnedIds&&Date.now()-ownershipCheckedMs<=300000;
 for(const [label,warn] of [[valid?'CURRENT FFL OWNERSHIP':'OWNERSHIP STALE / UNVERIFIED',!valid],['OBSERVED USAGE · RESEARCH RANK, NOT BREAKOUT PROBABILITY',false]]){
  const tag=document.createElement('span');tag.className='pfo56-source-chip'+(warn?' caution':'');tag.textContent=label;rail.append(tag);
 }
 host.prepend(rail);
};

/* 5.7 stability: one tap clears selected player, search and GameCast embed. */
function pfo57ClearPlayer(){
 pfo49Selected=null;pfo49Comparator='';
 const search=$('pfo49-search');if(search)search.value='';
 const result=$('pfo49-search-results');
 if(result)result.innerHTML='<p class="muted">Selection cleared. Search above or select a player from the roster.</p>';
 const panel=$('pfo49-profile');if(panel)panel.innerHTML='<p class="muted">No player selected. Search above to open Player Intel.</p>';
 window.ffoGameCast?.clearPlayer?.();
}
$('pfo49-clear')?.addEventListener('click',pfo57ClearPlayer);
$('pfo49-search')?.addEventListener('input',()=>{if(!$('pfo49-search').value.trim())pfo57ClearPlayer()});
/* Submitted Sleeper roster fetch: dedupe overlapping loads and refresh when roster opened. */
const pfo57RosterFetch=loadLiveRoster;
let pfo57RosterPending=null;
loadLiveRoster=function(force=false){
 if(pfo57RosterPending)return pfo57RosterPending;
 if(!force&&liveRosterCheckedAt&&Date.now()-liveRosterCheckedAt<15000)return Promise.resolve(liveRosterSnapshot);
 pfo57RosterPending=Promise.resolve().then(()=>pfo57RosterFetch()).finally(()=>{pfo57RosterPending=null});
 return pfo57RosterPending;
};
document.querySelector('nav button[data-page="roster"]')?.addEventListener('click',()=>loadLiveRoster(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.querySelector('nav button[data-page="roster"].active'))loadLiveRoster(true)});
setInterval(()=>{if(!document.hidden&&document.querySelector('nav button[data-page="roster"].active'))loadLiveRoster()},20000);
document.querySelector('nav button[data-page="market"]')?.addEventListener('click',()=>void refreshFaab());

// Initialize only after all lexical declarations have run.
render(true); // Paint Overview, roster placeholders, and briefings without rendering inactive research panels.
renderGamedayInactives();
setTimeout(()=>{if(!document.hidden){void refreshGamedayInactives();void refreshInjuryOnly();void refreshLive();}},300);
setInterval(()=>{if(!document.hidden)refreshGamedayInactives()},60000);
// Lazy view hydration: preserve existing research engines, but let touch navigation paint first.
const pfo58HydratedViews=new Set();
function pfo58HydrateView(page){
 if(pfo58HydratedViews.has(page))return;pfo58HydratedViews.add(page);
 try{
  if(page==='market'){
   const pane=document.querySelector('#market [data-pfo59-market-panel]:not([hidden])')?.dataset.pfo59MarketPanel||'trade';
   if(pane==='trade')renderTradeScouting();
   else if(pane==='waiver')renderWaiverScouting();
   else if(pane==='transactions')void refreshFaab();
  }
  else if(page==='radar'){pfo49RenderRadar();}
  else if(page==='scouting'){gm47Render();void gm47LoadGames(gm47Week());}
  else if(page==='matchup'||page==='coaching'||page==='championship'){void pfo53WarmHistory();}
  else if(page==='availability'){void pfo50LoadGameday();}
  else if(page==='privacy'){void refreshBackgroundMonitor();}
 }catch(err){console.warn('Deferred FFO view hydration issue',err);pfo58HydratedViews.delete(page);}
}
document.querySelectorAll('nav button[data-page]').forEach(btn=>btn.addEventListener('click',()=>{
 const target=btn.dataset.page;
 // Allow Safari to paint the destination before beginning heavier research.
 const run=()=>{if(document.querySelector('#'+target+'.page.active'))pfo58HydrateView(target)};
 if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:850});
 else setTimeout(run,120);
}));


/* P0 lineup integrity: if two genuine Sleeper endpoints disagree, never mark one "confirmed" silently. */
(function(){
 function audit(){
  const out=document.getElementById('ffo55-lineup-audit');if(!out||typeof pfo52Cur!=='function'||typeof pfo52Hist!=='function')return;
  const a=Array.isArray(liveRosterSnapshot?.starters)?liveRosterSnapshot.starters.map(String):[];
  const week=pfo52Cur(),history=pfo52Hist(week),row=Array.isArray(history)?history.find(x=>Number(x.roster_id)===Number(window.dbRosterId||1)):null;
  const b=Array.isArray(row?.starters)?row.starters.map(String):[];
  if(!a.length||!b.length){out.style.display='none';return}
  const difference=a.some((id,i)=>id!==b[i])||a.length!==b.length;
  if(!difference){out.style.display='block';out.style.background='#173d32';out.textContent='W'+week+' Sleeper roster and matchup starter IDs currently agree. Confirm each snapshot timestamp before interpreting LIVE.';return}
  const changed=a.map((id,i)=>id!==b[i]?('Slot '+(i+1)+': roster '+(pfo52Info(id)?.name||id)+' / weekly matchup '+(pfo52Info(b[i])?.name||b[i])):null).filter(Boolean);
  out.style.display='block';out.style.background='#563628';out.style.borderColor='#b67d4a';out.textContent='SOURCE CONFLICT · W'+week+' roster endpoint vs Sleeper weekly matchup starters differ ('+changed.join('; ')+'). Do not trust the LIVE badge until reconciled with a fresh Sleeper fetch. No lineup actions were made.';
 }
 const prev=pfo52RosterPoints;
 pfo52RosterPoints=function(){const result=prev.apply(this,arguments);try{audit()}catch(_){}return result};
 setInterval(()=>{if(!document.hidden)try{audit()}catch(_){}},15000);
})();
/* THURSDAY RELEASE: structural density, source details always recoverable. */
(function(){
 const prev=pfo53CompactStatRows;
 pfo53CompactStatRows=function(root,radar=false){prev(root,radar);if(!root)return;
  for(const card of root.querySelectorAll(radar?'article.pfo51-radar-card':'article.pfo49-waiver')){
   if(card.dataset.ffo55Compact==='1')continue;
   card.dataset.ffo55Compact='1';
   const disclosure=document.createElement('details');disclosure.className='ffo-compact-detail';
   const title=document.createElement('summary');title.textContent='Usage, scouting reasons & source evidence';disclosure.append(title);
   for(const node of [...card.children]){
    if(node.classList?.contains('pfo49-row')||node.classList?.contains('pfo51-universal')||node.classList?.contains('pfo49-statgrid')||node.classList?.contains('pfo53-dense-details'))continue;
    disclosure.append(node);
   }
   if(disclosure.children.length>1)card.append(disclosure);
  }
 };
})();
