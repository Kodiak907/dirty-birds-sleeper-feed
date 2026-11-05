/* PFO League Showcase. Original PFO visual assets and read-only research engines.
   NFL names from the PFO directory; EVERYTHING about sample roster assignment,
   scoring, ownership, health, trades, GameCast and projections is hypothetical.
   No Sleeper, MSF, private API, persistence or authenticated connections. */
import {evaluateFFLTrade,lineupFromFFLResearch} from './ffo-trade-decision-60.mjs';
import {findWaiverResearch,compareWaiverSwap} from './ffo-market-finder-61.mjs';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n===null||!Number.isFinite(Number(n))?'—':Number(n).toFixed(2);
const fmt=n=>Number(n)>=0?'+'+money(n):money(n);
const slots=['QB','RB','RB','WR','WR','TE','FLEX','FLEX','K','DEF'];
const data=await fetch('./sample-rosters.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Bundled demo roster not available');return r.json()});
const players=data.players, own=data.rosters[0], rival=data.rosters[1];
const state={week:9,page:'overview',market:'trade',matchmode:'starters',give:[],take:[],sendFaab:0,recvFaab:0,add:'',drop:'',claims:[],watch:new Set(),selected:own.starters[0],scoutPos:'ALL',scout:own.starters[0],search:'',radarPos:'ALL',game:0,play:0,scenarios:[],question:''};
const teamOf=id=>players[id]?.team||'—';
const identity=id=>players[id]||{name:'Unverified player',position:'?',team:'—'};
const pool=()=>Array.from(new Set([...own.players,...rival.players,...data.waivers,...state.claims]));
const ours=()=>[...new Set([...own.players,...state.claims])];
const available=()=>data.waivers.filter(id=>!state.claims.includes(id));
const position=id=>identity(id).position;
function projection(id,w=state.week){
 const p=identity(id),s=String(id),numeric=[...s].reduce((a,c)=>a+c.charCodeAt(0),0);
 const pos=p.position;
 const base={QB:18.4,RB:12.2,WR:12.0,TE:9.7,K:7.2,DEF:7.0}[pos]??null;
 if(base===null)return null;
 const tier=(numeric*7%23-7)*0.55;
 const swing=((numeric*13+w*7)%17-8)*0.22;
 return Math.max(0.2,Math.round((base+tier+swing)*100)/100);
}
const teamTotal=(roster=own)=>roster.starters.reduce((a,id)=>a+(projection(id)||0),0);
const eligible=(slot,pos)=>slot===pos||slot==='FLEX'&&['RB','WR','TE'].includes(pos);
function bestLineup(ids){const index={};for(const id of ids)index[id]={position:position(id),ppg:projection(id),name:identity(id).name};return lineupFromFFLResearch(ids,slots,index)}
function pButton(id){return '<button type="button" class="pfo-demo-person" data-player="'+esc(id)+'">'+esc(identity(id).name)+'</button>'}
function badge(text){return '<span class="pfo-demo-pill">'+esc(text)+'</span>'}
function stat(value,label,klass=''){return '<div class="pfo-demo-stat"><b class="'+klass+'">'+esc(value)+'</b><small>'+esc(label)+'</small></div>'}
function field(id,slot='',compact=false){
 const p=identity(id),note=compact?'': '<span class="pfo-demo-projection-small">Week '+state.week+' projected '+money(projection(id))+' FFL pts · FFO demo estimate</span>';
 return compact?'<div class="pfo-demo-matchrow"><span><small class="pfo-demo-pos">'+esc(slot||p.position)+'</small> '+pButton(id)+' <small class="pfo-demo-pos">'+esc(p.team)+'</small></span><b>'+money(projection(id))+'</b></div>':
 '<tr><td>'+esc(slot||p.position)+'</td><td>'+pButton(id)+note+'</td><td>'+esc(p.team)+'</td></tr>';
}
function benchList(roster=own,ids=null){
 const members=ids||roster.players.filter(id=>!roster.starters.includes(id));
 return members.map(id=>'<div class="pfo-demo-bench-row"><span>'+badge(position(id))+' '+pButton(id)+' <small class="pfo-demo-pos">'+esc(teamOf(id))+'</small></span><b class="pfo-demo-projection">'+money(projection(id))+'</b></div>').join('')||'<p class="pfo-demo-empty">No bench players found.</p>';
}
function weekNote(){return 'All projections are illustrative FFL-style model inputs, NOT live licensed statistics, certified forecasts, or real Week '+state.week+' NFL scores.'}
function view(page){state.page=page;document.querySelectorAll('#nav [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));document.querySelectorAll('.page').forEach(s=>s.classList.toggle('active',s.id===page));document.querySelectorAll('#demo-mobile-nav [data-go]').forEach(b=>b.classList.toggle('active',b.dataset.go===page));render();window.scrollTo(0,0)}
function render(){const routes={overview,roster,scouting,playerhub,gamecast,radar,ask,matchup,coaching,championship,availability,market,privacy};routes[state.page]?.()}
function overview(){
 const my=teamTotal(own),other=teamTotal(rival),best=bestLineup(ours()),full=best.status==='conditional'?best.points:null;
 $('demo-briefing').innerHTML='<p class="muted" style="font-size:12px">The Front Office Collective · Week '+state.week+' · FFO Demo Scouting</p>'+
   '<div class="pfo-demo-statgrid">'+stat(money(my),'Submitted roster projection','pfo-demo-highlight')+stat(money(other),'Example opponent projection')+stat(full!==null?money(full):'—','Best legal starting lineup')+'</div>'+
   '<div class="note"><strong>League Showcase.</strong> You have control of a newly assembled demonstration franchise. Every PFO analysis here uses this roster, not Dirty Birds. '+esc(weekNote())+'</div>'+
   '<div class="pfo-demo-market-controls"><button class="button primary" data-go="roster">Open Team HQ</button><button class="button" data-go="matchup">Weekly Matchup</button><button class="button" data-go="market">Trade / Waiver</button></div>';
 $('demo-kpis').innerHTML=['<div class="card">'+stat(ours().length,'Demo roster players')+'</div>','<div class="card">'+stat(data.waivers.length-state.claims.length,'Sample available players')+'</div>',
   '<div class="card">'+stat(own.faab,'Illustrative FAAB balance')+'</div>','<div class="card">'+stat(state.week,'Analysis week')+'</div>'].join('');
 $('demo-standings').innerHTML='<table class="pfo-demo-table"><tr><th>Sample team</th><th>Model</th></tr><tr><td>'+esc(own.name)+'</td><td class="pfo-demo-projection">'+money(my)+'</td></tr><tr><td>'+esc(rival.name)+'</td><td class="pfo-demo-projection">'+money(other)+'</td></tr></table><p class="pfo-demo-fine">This is a demonstration pairing, not the real league standings.</p>';
 $('demo-source-summary').innerHTML='<p class="pfo-demo-fine">NFL player names and positions: FFO-published Sleeper directory.</p><p class="pfo-demo-fine">PFO interface styling: original application CSS. Trade and waiver: original PFO 6.x read-only research engines.</p><p class="pfo-demo-warning">Player points, health, schedule and GameCast examples: simulated. Private MSF, FFL transactions and Commissioner records unavailable by design.</p>';
}
function roster(){
 const total=teamTotal(own),best=bestLineup(ours());
 $('demo-roster-status').textContent=own.name+' · '+ours().length+' demonstration roster players · sample submitted 10 starters · read-only preview';
 $('demo-team-total').innerHTML='<div class="pfo-demo-tiles"><div class="pfo-demo-tile"><small>Week '+state.week+' FFO model</small><strong>'+money(total)+'</strong><small>Submitted starters: 10/10</small></div><div class="pfo-demo-tile"><small>Optimal illustrative lineup</small><strong>'+money(best.points)+'</strong><small>'+esc(best.status==='conditional'?'Legal slot model':'Coverage incomplete')+'</small></div></div><p class="pfo-demo-fine">'+esc(weekNote())+'</p>';
 $('demo-starters').innerHTML=own.starters.map((id,i)=>field(id,slots[i])).join('');
 const bn=ours().filter(id=>!own.starters.includes(id));$('demo-bench-count').textContent='('+bn.length+')';
 $('demo-bench').innerHTML=benchList(own,bn);
 $('demo-roster-intel').innerHTML='<div class="pfo-demo-statgrid">'+stat(ours().filter(id=>position(id)==='QB').length,'QBs')+stat(ours().filter(id=>position(id)==='RB').length,'RBs')+stat(ours().filter(id=>position(id)==='WR').length,'WRs')+'</div>'+
   '<p class="pfo-demo-warning">Player names and NFL club affiliation come from our imported directory, not a live transaction report. All fantasy ownership in this demo is fictional.</p>'+
   '<details class="pfo49-disclose" open><summary>Roster construction &amp; scoring evidence</summary><p class="pfo-demo-fine">Ten starters: 1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX, 1 K, 1 D/ST. Independent FFL-style illustrative estimates use the same scoring categories by position; production data is withheld from this public build.</p></details>';
}
function projectionProfile(id){
 const p=identity(id),val=projection(id),pos=p.position;
 const sample=pos==='QB'?[['Pass Yds',258],['Passing TD',1.9],['Rush Yds',29]]:
 pos==='RB'?[['Carries',15],['Rush Yds',78],['Receptions',3.4]]:
 pos==='WR'?[['Targets',8.1],['Receptions',5.3],['Rec Yds',71]]:
 pos==='TE'?[['Targets',6.8],['Receptions',4.3],['Rec Yds',52]]:
 pos==='K'?[['FG made',1.9],['Extra points',2.4],['40+ FG',0.9]]:
 [['Sacks',2.5],['Takeaways',1.4],['Points allowed',20]];
 return '<div class="pfo49-profile-head"><h3>'+pButton(id)+' <small class="pfo-demo-pos">'+esc(pos)+' · '+esc(p.team)+'</small></h3></div>'+
 '<div class="pfo-demo-statgrid">'+stat(money(val),'W'+state.week+' FFO-style demo forecast','pfo-demo-highlight')+stat('DEMO','Data confidence')+stat('—','Verified latest game')+'</div>'+
 '<h3>Position-specific statistical inputs</h3><div class="pfo-demo-statgrid">'+sample.map(([k,v])=>stat(v,k)).join('')+'</div>'+
 '<div class="note">Real NFL player identity · illustrative workload and statistical fields. These example numbers are not sourced MSF game logs and cannot be used as genuine predictions.</div>';
}
function scouting(){
 const ids=pool().filter(id=>state.scoutPos==='ALL'||position(id)===state.scoutPos);
 const select=$('demo-scout-player');if(!ids.includes(state.scout))state.scout=ids[0]||'';
 select.innerHTML=ids.map(id=>'<option value="'+esc(id)+'"'+(id===state.scout?' selected':'')+'>'+esc(identity(id).name)+'</option>').join('');
 $('demo-scout-pos').value=state.scoutPos;
 $('demo-scout-report').innerHTML=state.scout?projectionProfile(state.scout):'<p class="pfo-demo-empty">No players at this position.</p>';
}
function playerhub(){
 const q=state.search.toLowerCase(),results=pool().filter(id=>identity(id).name.toLowerCase().includes(q)).slice(0,22);
 $('demo-player-results').innerHTML=results.map(id=>'<div class="pfo-demo-bench-row"><span>'+badge(position(id))+' '+pButton(id)+'</span><b class="pfo-demo-projection">'+money(projection(id))+'</b></div>').join('')||'<p class="pfo-demo-empty">No matching demo players.</p>';
 $('demo-player-search').value=state.search;
 $('demo-player-profile').innerHTML=state.selected?projectionProfile(state.selected):'<p class="pfo-demo-empty">Select a player to inspect the PFO-style profile.</p>';
}
function matchup(){
 const score=teamTotal(own),rScore=teamTotal(rival);
 document.querySelectorAll('[data-matchmode]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.matchmode===state.matchmode)));
 const header='<div class="pfo-demo-scoreboard"><div><small>'+esc(own.name)+' · MODEL</small><strong>'+money(score)+'</strong><small>10/10 demo estimates</small></div><div class="vs">VS</div><div><small>'+esc(rival.name)+' · MODEL</small><strong>'+money(rScore)+'</strong><small>10/10 demo estimates</small></div></div>';
 const teamsHTML='<div class="pfo-demo-matchgrid"><article><h3>'+esc(own.name)+'</h3>'+own.starters.map((id,i)=>field(id,slots[i],true)).join('')+'<details><summary>Bench ('+(ours().length-own.starters.length)+')</summary>'+benchList(own,ours().filter(id=>!own.starters.includes(id)))+'</details></article><article><h3>'+esc(rival.name)+'</h3>'+rival.starters.map((id,i)=>field(id,slots[i],true)).join('')+'<details><summary>Bench ('+(rival.players.length-rival.starters.length)+')</summary>'+benchList(rival)+'</details></article></div>';
 let content=header+teamsHTML;
 if(state.matchmode==='startsit'){const best=bestLineup(ours());content=header+'<div class="card"><h3>Start / Sit research</h3>'+stat(money(best.points),'Best supported legal lineup, example')+'<p class="pfo-demo-warning">The comparison is a demonstration of PFO’s lineup-selection logic. Actual availability and game forecasts are not verified here.</p></div>'+teamsHTML;}
 if(state.matchmode==='lab'){const best=bestLineup(ours());content=header+'<div class="pfo-demo-statgrid">'+stat(money(score),'Submitted sample lineup')+stat(money(best.points),'Optimal legal projection')+stat(best.points!=null?money(best.points-score):'—','Illustrative unused upside')+'</div>'+teamsHTML;}
 $('demo-matchup').innerHTML=content+'<p class="pfo-demo-fine">'+esc(weekNote())+'</p>';
}
function tradeOptions(ids,selected){return '<option value="">Select player</option>'+ids.map(id=>'<option value="'+esc(id)+'"'+(selected===id?' selected':'')+'>'+esc(identity(id).name)+' · '+position(id)+'</option>').join('')}
function trade(){
 const index={};for(const id of new Set([...ours(),...rival.players]))index[id]={name:identity(id).name,position:position(id),ppg:projection(id)};
 let outcome=null;
 if(state.give.length&&state.take.length){
   outcome=evaluateFFLTrade({ourRoster:ours(),theirRoster:rival.players,give:state.give,take:state.take,
    partnerRosterId:rival.roster_id,playerIndex:index,starterSlots:slots,rosterCap:21,
    snapshotAt:new Date().toISOString(),ruleReady:true,ourFAAB:state.sendFaab,theirFAAB:state.recvFaab,
    confirmedOurSpendable:100,confirmedTheirSpendable:85});
 }
 const get=(side,index)=>side==='give'?state.give[index]||'':state.take[index]||'';
 let out='<div class="grid two"><div class="card"><h2>WE GIVE · '+esc(own.name)+'</h2><div class="pfo-demo-form">'+[0,1,2].map(i=>'<label>Outgoing '+(i+1)+'<select data-trade="give" data-index="'+i+'">'+tradeOptions(ours(),get('give',i))+'</select></label>').join('')+'</div><p class="pfo-demo-fine">Select up to three players from the demonstration franchise.</p></div>'+
 '<div class="card"><h2>WE RECEIVE · '+esc(rival.name)+'</h2><div class="pfo-demo-form">'+[0,1,2].map(i=>'<label>Incoming '+(i+1)+'<select data-trade="take" data-index="'+i+'">'+tradeOptions(rival.players,get('take',i))+'</select></label>').join('')+'</div></div></div>'+
 '<div class="card"><h3>FAAB terms · Sample amounts</h3><div class="pfo-demo-form-grid"><label class="pfo-demo-form">We send ($)<input id="demo-send-faab" type="number" min="0" max="100" value="'+state.sendFaab+'"></label><label class="pfo-demo-form">They send ($)<input id="demo-recv-faab" type="number" min="0" max="85" value="'+state.recvFaab+'"></label></div><button class="button" data-clear-trade type="button">Clear deal</button></div>';
 if(outcome){
 const net=outcome.packageNetPPG,oursDelta=outcome.starterDelta?.ours,theirsDelta=outcome.starterDelta?.theirs;
 out+='<div class="card"><h2>FFO 6.0 Trade Intelligence</h2><div class="pfo-demo-statgrid">'+stat(net==null?'—':fmt(net),'Raw outgoing vs incoming PPG')+stat(oursDelta==null?'—':fmt(oursDelta),'Our lineup impact')+stat(theirsDelta==null?'—':fmt(theirsDelta),'Opposing lineup impact')+'</div>'+
 '<p class="pfo-demo-warning">'+esc(outcome.headline||'Conditional research · no offer created')+'</p>'+
 (outcome.issues?.length?'<details open><summary>Trade evidence &amp; risks</summary><p class="pfo-demo-fine">'+esc(outcome.issues.join(' · '))+'</p></details>':'')+
 '<p class="pfo-demo-fine">This analysis calls the real PFO trade research function with fictional roster assignments and hypothetical model values. FAAB is kept separate from fantasy points. No league operations are performed.</p></div>';
 }else out+='<div class="card"><p class="pfo-demo-empty">Select GIVE and RECEIVE players to run the actual PFO two-sided trade comparison on this demo franchise.</p></div>';
 return out;
}
function waiver(){
 const ids=available();
 const research=findWaiverResearch({roster:{players:ours(),starters:own.starters,reserve:[]},
   names:players,unrostered:ids,estimate:id=>projection(id),starterSlots:slots,
   maxResults:10,rulesReady:true,snapshotAt:new Date().toISOString()});
 const dropList=ours().filter(id=>!own.starters.includes(id));
 const chosen=state.add&&state.drop?compareWaiverSwap({roster:{players:ours(),starters:own.starters,reserve:[]},addId:state.add,dropId:state.drop,
   names:players,estimate:id=>projection(id),starterSlots:slots,rulesReady:true,snapshotAt:new Date().toISOString()}):null;
 return '<div class="grid two"><div class="card"><h2>Waiver Market</h2><p class="pfo-demo-fine">Sample available NFL players, ranked with PFO 6.1 research. These names are NOT verified available in your real FFL.</p>'+
 ids.map(id=>'<div class="pfo-demo-bench-row"><span>'+badge(position(id))+' '+pButton(id)+'<small class="pfo-demo-pos"> · '+esc(teamOf(id))+'</small></span><span><b class="pfo-demo-projection">'+money(projection(id))+'</b> <button type="button" class="button" data-watch="'+esc(id)+'">'+(state.watch.has(id)?'Watching':'Watch')+'</button></span></div>').join('')+
 '<p class="pfo-demo-fine">PFO waiver research evaluated '+research.length+' candidate opportunities. Sample availability is isolated to this site.</p></div>'+
 '<div class="card"><h2>Waiver Swap Laboratory</h2><p class="pfo-demo-fine">Evaluate adding a player and releasing a bench asset. No real waiver claim is made.</p><div class="pfo-demo-form"><label>Target<select id="demo-waiver-add">'+tradeOptions(ids,state.add)+'</select></label><label>Bench player to release<select id="demo-waiver-drop">'+tradeOptions(dropList,state.drop)+'</select></label></div>'+
 (chosen?'<div class="pfo-demo-statgrid">'+stat(chosen.delta==null?'—':fmt(chosen.delta),'FFO modeled lineup impact')+stat(chosen.status,'PFO research result')+'</div><p class="pfo-demo-warning">'+esc(chosen.reason||'')+'</p>':'<p class="pfo-demo-empty">Choose both players for a roster-impact simulation.</p>')+
 '<button type="button" data-demo-claim class="button primary" '+(!state.add?'disabled':'')+'>Add to demo bench only</button><div class="pfo-demo-fine">Watchlist: '+state.watch.size+' · Sample additions: '+state.claims.length+'</div></div></div>';
}
function market(){
 document.querySelectorAll('[data-marketmode]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.marketmode===state.market)));
 $('demo-market').innerHTML=state.market==='trade'?trade():state.market==='waiver'?waiver():
 '<div class="card"><h2>Transaction History · Sample Mode</h2><p class="pfo-demo-fine">Live FFL transaction history is intentionally excluded from public demos. Mock changes exist only for this page session.</p>'+
 (state.claims.length?state.claims.map(id=>'<div class="pfo-demo-bench-row">'+pButton(id)+'<small class="pfo-demo-pos">Added to demonstration bench</small></div>').join(''):'<p class="pfo-demo-empty">No simulated moves yet. Open Waiver Market to test one.</p>')+'</div>';
}
function radar(){
 $('demo-radar').innerHTML='<div class="pfo-demo-market-controls">'+['ALL','QB','RB','WR','TE','K','DEF'].map(pos=>'<button class="button '+(state.radarPos===pos?'primary':'')+'" data-radar="'+pos+'">'+pos+'</button>').join('')+'</div>'+
 '<div class="pfo-demo-cardlist">'+available().filter(id=>state.radarPos==='ALL'||position(id)===state.radarPos)
   .sort((a,b)=>projection(b)-projection(a)).map((id,i)=>'<article><header><strong>'+badge('#'+(i+1))+' '+pButton(id)+'</strong>'+badge(position(id))+'</header>'+
   '<div class="pfo-demo-statgrid">'+stat(money(projection(id)),'FFO demonstration pts')+stat('—','Verified touches / targets')+stat('—','Verified snaps')+'</div><small>Real NFL player name. Source-backed 2026 usage unavailable in this isolated public demo. No unverified role change presented as fact.</small></article>').join('')+'</div>';
}
function ask(){
 const q=state.question.toLowerCase(),pos=/\b(rb|running back)/.test(q)?'RB':/\b(wr|receiver)/.test(q)?'WR':/\b(qb|quarterback)/.test(q)?'QB':/\b(te|tight end)/.test(q)?'TE':null;
 const listed=available().filter(id=>!pos||position(id)===pos).sort((a,b)=>projection(b)-projection(a)).slice(0,5);
 $('demo-answer').innerHTML=state.question?'<div class="note"><b>Front Office Evidence Search · Demo</b><p class="pfo-demo-fine">Results from the sample player pool, using representative projection inputs. No verified 2026 usage claims.</p>'+
 (listed.map(id=>'<div class="pfo-demo-bench-row">'+pButton(id)+'<b>'+money(projection(id))+' pts</b></div>').join('')||'<p class="pfo-demo-fine">No matching sample players.</p>')+'</div>':
 '<div class="note">Try “available receivers” or “running back depth” to see how PFO answers roster-focused questions without recommending Dirty Birds players.</div>';
}
function coaching(){$('demo-coaching').innerHTML='<p class="pfo-demo-fine">PFO tracks season coaching decisions through confirmed weekly starters and final scores. Public demo ownership is fictional, so the historical coaching approval percentage is deliberately withheld.</p>'+
 '<div class="pfo-demo-statgrid">'+stat('—','Verified weeks audited')+stat('—','Actual coaching approval')+stat('10','Example starting slots')+'</div><div class="note">No invented historic grade or manager record is presented as actual.</div>'}
function championship(){$('demo-championship').innerHTML='<div class="pfo-demo-statgrid">'+stat('—','Verified make-playoffs %')+stat('—','Reach final %')+stat('—','Win championship %')+'</div><p class="pfo-demo-fine">PFO championship probability calculations require real FFL standings, future schedule and a validated forecast distribution. This isolated sample does not falsify 100,000 simulations.</p><div class="pfo-demo-tiles"><div class="pfo-demo-tile"><small>Current Week '+state.week+' team model</small><strong>'+money(teamTotal(own))+'</strong></div><div class="pfo-demo-tile"><small>Fantasy playoff weeks</small><strong>15–17</strong></div></div>'}
function availability(){$('demo-injuries').innerHTML='<div class="note">Real injury clearance, official inactives and practice reports are not attached to public sample rosters. No player is automatically classified active or cleared.</div>'+
 '<table class="pfo-demo-table"><tr><th>Sample player</th><th>Verified status</th></tr>'+
 own.starters.slice(0,8).map(id=>'<tr><td>'+pButton(id)+'</td><td class="pfo-demo-warning">Not checked in demo</td></tr>').join('')+'</table>'}
const sampleGames=[
 {a:'BUF',b:'KC',score:'— : —',tag:'Example matchup',drive:'Illustrative first drive',plays:['Kickoff · demonstration opening drive','1st & 10 · pass complete (sample)','2nd & 4 · rush for a first down (sample)','New possession · sample drive complete']},
 {a:'DET',b:'LAR',score:'— : —',tag:'Example matchup',drive:'Illustrative red-zone drive',plays:['Opening play · sample rush','2nd & 6 · example pass','3rd & goal · demonstration touchdown','PAT · demonstration only']},
 {a:'PHI',b:'DAL',score:'— : —',tag:'Example matchup',drive:'Illustrative two-minute drive',plays:['Drive begins · demonstration','Pass toward sideline · sample','Spike to stop clock · sample','Kick attempt · demonstration only']}
];
function gamecast(){
 const g=sampleGames[state.game];$('demo-gamecast').innerHTML='<div class="pfo-demo-gc-rail">'+sampleGames.map((x,i)=>'<button class="button" data-game="'+i+'" aria-selected="'+(i===state.game)+'"><b>'+x.a+' vs '+x.b+'</b><span>'+x.tag+' · no live score</span></button>').join('')+'</div>'+
 '<div class="pfo-demo-scoreboard"><div><small>'+g.a+'</small><strong>—</strong></div><div class="vs">EXAMPLE</div><div><small>'+g.b+'</small><strong>—</strong></div></div>'+
 '<div class="pfo-demo-gc-field"><strong>FFO GAMECAST · SAMPLE FIELD</strong></div><div class="pfo-demo-statgrid">'+stat('—','Live game status')+stat('—','Live player stat totals')+stat('—','Live feed latency')+'</div>'+
 '<div class="pfo-demo-market-controls"><button class="button primary" data-next-play>Step through sample play</button><button class="button" data-reset-play>Reset example</button></div><h3>'+g.drive+'</h3>'+
 '<div>'+g.plays.slice(0,state.play+1).map((p,i)=>'<div class="pfo-demo-play"><b>Play '+(i+1)+'</b> · '+esc(p)+'</div>').join('')+'</div>'+
 '<p class="pfo-demo-fine">The real PFO GameCast uses licensed MSF data. This site demonstrates its field, game selection and play rail, not a live NFL game.</p>';
}
function privacy(){$('demo-sources').innerHTML='<div class="pfo-demo-statgrid">'+stat('PFO','Original interface styles')+stat('6.0 / 6.1','Trade & waiver engine')+stat('0','Private data API calls')+'</div>'+
 '<p class="pfo-demo-fine"><b>NFL identities:</b> Player names, positions and club labels are copied from the organization’s existing published player directory and may not reflect subsequent changes.</p>'+
 '<p class="pfo-demo-fine"><b>Demonstration estimates:</b> Fabricated purely to show how an FFL-style research workflow operates. Not actual MSF predictions.</p>'+
 '<p class="pfo-demo-fine"><b>Isolation:</b> Public site includes no Cloudflare worker, Access identity, MSF credential, Commissioner endpoint, private Dirty Birds roster, sensitive league records, or Sleeper write permission. There are no storage or account connections.</p>'+
 '<p class="pfo-demo-fine"><b>Important:</b> An authentic multi-manager connected PFO product would require separate user login, roster-scoped authorization and licensed data distribution approval. This showcase is only a safe demonstration.</p>'}
document.addEventListener('click',event=>{
 const go=event.target.closest('[data-go]');if(go){view(go.dataset.go);return}
 const page=event.target.closest('#nav [data-page]');if(page){view(page.dataset.page);return}
 const id=event.target.closest('[data-player]')?.dataset.player;if(id){state.selected=id;state.scout=id;view('playerhub');return}
 const m=event.target.closest('[data-matchmode]');if(m){state.matchmode=m.dataset.matchmode;matchup();return}
 const marketMode=event.target.closest('[data-marketmode]');if(marketMode){state.market=marketMode.dataset.marketmode;market();return}
 const radarFilter=event.target.closest('[data-radar]');if(radarFilter){state.radarPos=radarFilter.dataset.radar;radar();return}
 const watch=event.target.closest('[data-watch]');if(watch){const id=watch.dataset.watch;state.watch.has(id)?state.watch.delete(id):state.watch.add(id);market();return}
 if(event.target.closest('[data-clear-trade]')){state.give=[];state.take=[];state.sendFaab=0;state.recvFaab=0;market();return}
 if(event.target.closest('[data-demo-claim]')){
  const id=state.add;if(id&&available().includes(id)){state.claims.push(id);state.add='';state.drop='';market();}return;
 }
 const game=event.target.closest('[data-game]');if(game){state.game=Number(game.dataset.game);state.play=0;gamecast();return}
 if(event.target.closest('[data-next-play]')){state.play=Math.min(state.play+1,sampleGames[state.game].plays.length-1);gamecast();return}
 if(event.target.closest('[data-reset-play]')){state.play=0;gamecast();return}
 if(event.target.id==='demo-ask'){state.question=$('demo-question').value.trim();ask();return}
 if(event.target.id==='demo-player-clear'){state.search='';state.selected='';playerhub();return}
 if(event.target.id==='demo-reset'){
  state.week=9;state.market='trade';state.matchmode='starters';state.give=[];state.take=[];state.sendFaab=0;state.recvFaab=0;state.add='';state.drop='';state.claims=[];state.watch.clear();state.selected=own.starters[0];state.search='';
  $('demo-week').value='9';render();return;
 }
});
document.addEventListener('change',event=>{
 const t=event.target;
 if(t.id==='demo-week'){state.week=Number(t.value);render();return}
 if(t.id==='demo-scout-pos'){state.scoutPos=t.value;scouting();return}
 if(t.id==='demo-scout-player'){state.scout=t.value;scouting();return}
 if(t.dataset.trade){
  const side=t.dataset.trade,at=Number(t.dataset.index),arr=state[side],next=arr.slice();
  next[at]=t.value;state[side]=next.filter(Boolean);market();return
 }
 if(t.id==='demo-send-faab'){state.sendFaab=Math.max(0,Math.min(100,Math.floor(Number(t.value)||0)));market();return}
 if(t.id==='demo-recv-faab'){state.recvFaab=Math.max(0,Math.min(85,Math.floor(Number(t.value)||0)));market();return}
 if(t.id==='demo-waiver-add'){state.add=t.value;market();return}
 if(t.id==='demo-waiver-drop'){state.drop=t.value;market();return}
});
document.addEventListener('input',event=>{
 if(event.target.id==='demo-player-search'){state.search=event.target.value;playerhub();const q=$('demo-player-search');q.focus();q.setSelectionRange(state.search.length,state.search.length)}
});
$('demo-week').value=String(state.week);
view('overview');
