/* FFO / PFO public sandbox. All players, franchises and scores are fictional.
   No network calls, logins, admin endpoints, storage or paid statistics. */
(function(){'use strict';
 const $=id=>document.getElementById(id);
 const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
 const first=['Jordan','Amir','Taylor','Devon','Chris','Micah','Malik','Drew','Cameron','Alex','Shawn','Riley','Andre','Quinn','Tyler','Jesse','Morgan','Logan','Parker','Kendall','Marcel','Darius','Trey','Dante','Sam','Reese','Eli','Jalen','Casey','Avery'];
 const last=['Hale','Carter','Ellis','Parker','Hughes','Brooks','Monroe','Bennett','Mills','Waters','Steele','Lewis','Vaughn','Bryant','Rowe','Stone','Cruz','Harris','Fisher','Caldwell','Maddox','Reed','Payne','Sullivan','Grant','Fields','Banks','Watson','Ford','Richards'];
 const pos=['QB','RB','RB','RB','WR','WR','WR','WR','TE','TE','K','DEF','WR','RB'];
 const slots=['QB','RB','RB','WR','WR','TE','FLEX','FLEX','K','DEF'];
 const starterIdx=[0,1,2,4,5,8,3,6,10,11];
 const bases={QB:19,RB:14,WR:13,TE:10,K:8,DEF:7};
 const teamNames=['Fourth & Chaos','Sunday Renegades','End Zone Syndicate','The Blitz Committee'];
 function player(seed,i){
  const p=pos[i],idx=seed*17+i;
  return {id:String(seed*100+i),name:p==='DEF'?['Iron City Defense','Harbor City Defense','West Valley Defense','Riverbend Defense'][seed]:first[idx%first.length]+' '+last[(idx*7+seed*3)%last.length],
   pos:p,base:bases[p]+((i*5+seed*7)%13)/2-(p==='K'||p==='DEF'?1.5:0),
   snap:Math.min(95,45+((idx*13)%50)),usage:Math.min(28,4+((idx*11)%23)),team:seed};
 }
 const teams=teamNames.map((name,seed)=>({name,seed,players:pos.map((_,i)=>player(seed,i)),starters:starterIdx.map(i=>String(seed*100+i))}));
 const freeAgents=[
  {id:'FA1',name:'Skyler Rhodes',pos:'RB',base:11.4,snap:48,usage:12},
  {id:'FA2',name:'Noah Lancaster',pos:'WR',base:13.2,snap:71,usage:16},
  {id:'FA3',name:'Marcus Wynn',pos:'TE',base:9.7,snap:64,usage:7},
  {id:'FA4',name:'Dylan Jefferson',pos:'QB',base:17.6,snap:83,usage:29},
  {id:'FA5',name:'Nico Bradshaw',pos:'WR',base:10.8,snap:57,usage:8},
  {id:'FA6',name:'Caleb Mercer',pos:'RB',base:12.6,snap:63,usage:13},
  {id:'FA7',name:'Eastport Defense',pos:'DEF',base:7.8,snap:null,usage:null},
  {id:'FA8',name:'Evan Holden',pos:'K',base:8.3,snap:null,usage:null}
 ];
 const state={team:0,week:9,page:'overview',partner:1,give1:'',give2:'',take1:'',take2:'',faab:0,watched:new Set(),claimed:[],intel:'',query:''};
 const lookup=new Map([...teams.flatMap(t=>t.players),...freeAgents].map(x=>[x.id,x]));
 const getTeam=()=>teams[state.team],getPartner=()=>teams[state.partner];
 const squad=(idx=state.team)=>[...teams[idx].players,...(idx===state.team?state.claimed:[])];
 function points(p,w=state.week){
  const fluct=0.90+((Number.parseInt(p.id.replace(/\D/g,''),10)*3+w*17+7)%18)/100;
  return Math.round(p.base*fluct*100)/100;
 }
 const fmt=n=>Number(n).toFixed(2);
 const total=team=>team.starters.reduce((s,id)=>s+points(lookup.get(id)),0);
 const bench=idx=>squad(idx).filter(p=>!teams[idx].starters.includes(p.id));
 const playerButton=(p,label)=>'<button type="button" data-person="'+escapeHTML(p.id)+'" class="action" title="Open fictional player profile">'+escapeHTML(label||p.name)+'</button>';
 const row=(p,slot,action='')=>'<div class="row"><div class="player-left"><span class="slot">'+escapeHTML(slot||p.pos)+'</span><div class="name-wrap"><div class="name">'+playerButton(p)+'</div><small class="small">'+escapeHTML(p.pos)+' · DEMO projection</small></div></div><span class="score">'+fmt(points(p))+'</span>'+action+'</div>';
 const scoreBlock=(title,n,sub)=>'<div class="metric"><span class="eyebrow">'+escapeHTML(title)+'</span><b class="big">'+fmt(n)+'</b><small>'+escapeHTML(sub)+'</small></div>';
 const disclaimer='<div class="callout">Simulated statistics and projected points are fictional training examples, not FFO live forecasts. Nothing here submits to Sleeper, changes a roster, or reaches a private API.</div>';
 function overview(){
  const t=getTeam(),p=getPartner();
  const totals=teams.map((team,i)=>({name:team.name,pts:total(team),i})).sort((a,b)=>b.pts-a.pts);
  return '<div class="grid four"><div class="card">'+scoreBlock('YOUR DEMO LINEUP',total(t),'10 synthetic starters')+'</div><div class="card">'+scoreBlock('MATCHUP OPPONENT',total(p),'Week '+state.week+' example')+'</div><div class="card"><div class="metric"><span class="eyebrow">BENCH DEPTH</span><b class="big">'+bench(state.team).length+'</b><small>Mock roster options</small></div></div><div class="card"><div class="metric"><span class="eyebrow">WAIVER POOL</span><b class="big">'+(freeAgents.length-state.claimed.length)+'</b><small>Sample free agents available</small></div></div></div>'+
   '<div class="grid"><div class="card"><h2>'+escapeHTML(t.name)+' Team HQ</h2><p class="small">Sample franchise, automatically selected throughout the demo.</p>'+t.starters.slice(0,6).map((id,i)=>row(lookup.get(id),slots[i])).join('')+'<button class="primary" type="button" data-open="team">Open complete roster</button></div>'+
   '<div class="card"><h2>Example league power board</h2><p class="small">Order changes with synthetic Week '+state.week+' scores.</p>'+totals.map((x,i)=>'<div class="row"><div><span class="slot">#'+(i+1)+'</span> <span class="name">'+escapeHTML(x.name)+'</span></div><strong class="score">'+fmt(x.pts)+'</strong></div>').join('')+'<p class="small">Demonstration rankings, not real FFL standings.</p></div></div>'+disclaimer;
 }
 function teamPage(){
  const t=getTeam(),starts=t.starters.map(id=>lookup.get(id));
  return '<div class="grid"><div class="card"><div class="eyebrow">CURRENT FRANCHISE</div><h2>'+escapeHTML(t.name)+'</h2><p class="small">Submitted-style example roster, no real account involved.</p><div class="big">'+fmt(total(t))+' <span class="small">projected points</span></div><h3 class="group">Illustrative starting lineup</h3>'+starts.map((p,i)=>row(p,slots[i])).join('')+'</div>'+
   '<div class="card"><h2>Bench &amp; depth</h2><p class="small">Each bench member has a forecast, not a blank slot.</p>'+bench(state.team).map(p=>row(p,p.pos)).join('')+
   '<div class="splitline"></div><h3>Sample roster intelligence</h3><div class="chip">14-player starting roster</div><div class="chip">'+state.claimed.length+' simulated claims</div><div class="chip">FFL-style 10 starters</div><p class="small">Starter choices are examples. The public demo never recommends or submits real lineup changes.</p></div></div>'+disclaimer;
 }
 function matchup(){
  const t=getTeam(),p=getPartner();
  return '<div class="card"><h2>Weekly matchup simulator</h2><p class="small">Independent fictional forecasts for selected example Week '+state.week+'.</p><label style="max-width:380px">Compare against<select data-field="partner">'+teams.map((x,i)=>i!==state.team?'<option value="'+i+'"'+(i===state.partner?' selected':'')+'>'+escapeHTML(x.name)+'</option>':'').join('')+'</select></label></div>'+
   '<div class="grid"><div class="card"><div class="eyebrow">SELECTED TEAM</div><h2>'+escapeHTML(t.name)+'</h2><div class="big">'+fmt(total(t))+'</div>'+t.starters.map((id,i)=>row(lookup.get(id),slots[i])).join('')+'</div>'+
   '<div class="card"><div class="eyebrow">MATCHUP RIVAL</div><h2>'+escapeHTML(p.name)+'</h2><div class="big">'+fmt(total(p))+'</div>'+p.starters.map((id,i)=>row(lookup.get(id),slots[i])).join('')+'</div></div>'+
   '<div class="callout">Example advantage: <b>'+escapeHTML((total(t)>=total(p)?t:p).name)+'</b> by '+fmt(Math.abs(total(t)-total(p)))+' projected points. This is an artificial scenario, not a real contest prediction.</div>';
 }
 const opts=(players,val)=>'<option value="">— None —</option>'+players.map(p=>'<option value="'+escapeHTML(p.id)+'"'+(val===p.id?' selected':'')+'>'+escapeHTML(p.name)+' · '+p.pos+' · '+fmt(points(p))+'</option>').join('');
 function trades(){
  const own=squad(state.team),partner=squad(state.partner);
  const ownIds=[state.give1,state.give2].filter(Boolean),theirIds=[state.take1,state.take2].filter(Boolean);
  const a=ownIds.reduce((s,id)=>s+(lookup.has(id)?points(lookup.get(id)):0),0);
  const b=theirIds.reduce((s,id)=>s+(lookup.has(id)?points(lookup.get(id)):0),0);
  const valid=ownIds.length>0&&theirIds.length>0&&new Set(ownIds).size===ownIds.length&&new Set(theirIds).size===theirIds.length;
  const gain=b-a,partnerGain=-gain;
  return '<div class="card"><h2>Trade Lab</h2><p class="small">Analyze mock GIVE / RECEIVE packages from the perspective of whichever sample team you selected. Nothing is offered, sent or accepted.</p><label style="max-width:440px">Negotiation partner<select data-field="partner">'+teams.map((x,i)=>i!==state.team?'<option value="'+i+'"'+(state.partner===i?' selected':'')+'>'+escapeHTML(x.name)+'</option>':'').join('')+'</select></label></div>'+
  '<div class="grid"><div class="card"><div class="eyebrow">WE GIVE • '+escapeHTML(getTeam().name)+'</div><div class="choice-grid"><label>Player 1<select data-field="give1">'+opts(own,state.give1)+'</select></label><label>Player 2 (optional)<select data-field="give2">'+opts(own,state.give2)+'</select></label></div></div>'+
  '<div class="card"><div class="eyebrow">WE RECEIVE • '+escapeHTML(getPartner().name)+'</div><div class="choice-grid"><label>Player 1<select data-field="take1">'+opts(partner,state.take1)+'</select></label><label>Player 2 (optional)<select data-field="take2">'+opts(partner,state.take2)+'</select></label></div></div></div>'+
  '<div class="card"><label style="max-width:200px">Hypothetical FAAB added to package<select data-field="faab">'+[0,5,10,15,20,25,30].map(x=>'<option value="'+x+'"'+(state.faab===x?' selected':'')+'>$'+x+'</option>').join('')+'</select></label>'+
  (valid?'<div class="grid"><div>'+scoreBlock('OUR RAW PLAYER PROJECTION DELTA',gain,'Received minus sent, points only')+'</div><div>'+scoreBlock('THEIR RAW PLAYER PROJECTION DELTA',partnerGain,'Sent minus received, points only')+'</div></div><p class="stickyNote">These are raw projected-player sums, <b>not</b> lineup replacement effects, accepted trade values, or two-sided fairness judgments. $'+state.faab+' hypothetical FAAB is shown separately and not converted into points.</p>':
   '<div class="empty">Choose unique players on each side to compare a hypothetical trade.</div>')+
   '<button data-clear-trade type="button">Clear trade scenario</button></div>'+disclaimer;
 }
 function waivers(){
  const pool=freeAgents.filter(p=>!state.claimed.some(x=>x.id===p.id));
  return '<div class="grid"><div class="card"><h2>Waiver Research</h2><p class="small">Fictional unrostered sample pool for <b>'+escapeHTML(getTeam().name)+'</b>. Test the watchlist or add a simulated player to your example bench.</p>'+
   pool.map(p=>'<div class="row"><div class="player-left"><div class="name-wrap"><div class="name">'+playerButton(p)+'</div><small class="small">'+p.pos+' · '+fmt(points(p))+' demo pts</small></div></div><div><button class="action" type="button" data-watch="'+p.id+'">'+(state.watched.has(p.id)?'Unwatch':'Watch')+'</button> <button class="action primary" type="button" data-claim="'+p.id+'">Try add</button></div></div>').join('')+
   (!pool.length?'<div class="empty">All mock players have been added in this browser session.</div>':'')+'</div>'+
   '<div class="card"><h2>Scenario feedback</h2><div class="eyebrow">SAMPLE WATCHLIST</div>'+([...state.watched].length?[...state.watched].map(id=>'<div class="row"><span>'+escapeHTML(lookup.get(id)?.name||'')+'</span><span class="score">'+fmt(points(lookup.get(id)))+'</span></div>').join(''):'<p class="small">Tap Watch beside any sample player.</p>')+
   '<div class="splitline"></div><h3>Simulated additions</h3>'+(state.claimed.length?state.claimed.map(p=>row(p,'BN')).join(''):'<p class="small">Try adding a fictional free agent. Your selected team bench changes in this session only.</p>')+
   '<p class="stickyNote">There is no waiver bid, FAAB transfer, submission, transaction, or real ownership check in this demonstration.</p></div></div>'+disclaimer;
 }
 function intelRows(){
  const all=[...squad(state.team),...freeAgents];
  const q=state.query.toLowerCase();
  const filtered=all.filter(p=>(p.name+' '+p.pos).toLowerCase().includes(q));
  return filtered.map(p=>'<div class="row"><div><div class="name">'+playerButton(p)+'</div><small class="small">'+p.pos+' · Fictional identity</small></div><div class="score">'+fmt(points(p))+'</div></div>').join('')||'<div class="empty">No synthetic players match the search.</div>';
 }
 function intel(){
  const p=lookup.get(state.intel)||squad(state.team)[0];
  return '<div class="grid"><div class="card"><h2>Player Intelligence</h2><p class="small">Select a mock player to inspect sample position-appropriate evidence.</p><label>Filter players<input class="search" data-intel-search placeholder="Search fictional players or positions" value="'+escapeHTML(state.query)+'"></label><div id="intel-results">'+intelRows()+'</div></div>'+
   '<div class="card"><span class="eyebrow">SYNTHETIC PLAYER PROFILE</span><h2>'+escapeHTML(p.name)+'</h2><div class="chip">'+escapeHTML(p.pos)+'</div><div class="metric" style="margin:18px 0"><span class="eyebrow">W'+state.week+' EXAMPLE FFL POINTS</span><div class="big">'+fmt(points(p))+'</div><small>Generated locally from a fixed fake rating</small></div>'+
   (p.pos==='K'?'<div class="row"><span>Example FGs made/game</span><b>2.1</b></div><div class="row"><span>Example XP made/game</span><b>2.6</b></div>':
    p.pos==='DEF'?'<div class="row"><span>Example sacks/game</span><b>2.4</b></div><div class="row"><span>Example takeaways/game</span><b>1.1</b></div>':
    '<div class="row"><span>Example snap share</span><b>'+p.snap+'%</b></div><div class="row"><span>Example weekly opportunities</span><b>'+p.usage+'</b></div>')+
    '<div class="splitline"></div><p class="small">This public demo intentionally contains no real league rosters, NFL stats, injuries, paid provider feeds or personal manager intelligence.</p></div></div>'+disclaimer;
 }
 const renderers={overview,team:teamPage,matchup,trade:trades,waivers,intel};
 function render(){
  $('team-choice').innerHTML=teams.map((x,i)=>'<option value="'+i+'"'+(i===state.team?' selected':'')+'>'+escapeHTML(x.name)+'</option>').join('');
  $('week-choice').value=String(state.week);
  document.querySelectorAll('#tabs [data-page]').forEach(b=>{
   if(b.dataset.page===state.page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  $('workspace').innerHTML=renderers[state.page]();
 }
 function cleanTrade(){state.give1='';state.give2='';state.take1='';state.take2='';state.faab=0;}
 function safePartner(){if(state.partner===state.team)state.partner=(state.team+1)%teams.length;}
 document.addEventListener('click',e=>{
  const tab=e.target.closest('#tabs [data-page]'),go=e.target.closest('[data-open]');
  if(tab||go){state.page=(tab||go).dataset.page;render();return;}
  const person=e.target.closest('[data-person]');if(person){state.intel=person.dataset.person;state.page='intel';render();return;}
  const watch=e.target.closest('[data-watch]');if(watch){const id=watch.dataset.watch;state.watched.has(id)?state.watched.delete(id):state.watched.add(id);render();return;}
  const claim=e.target.closest('[data-claim]');if(claim){
   const p=freeAgents.find(x=>x.id===claim.dataset.claim);
   if(p&&!state.claimed.some(x=>x.id===p.id))state.claimed.push(p);
   render();return;
  }
  if(e.target.closest('[data-clear-trade]')){cleanTrade();render();return;}
  if(e.target.id==='reset'){state.watched.clear();state.claimed=[];state.intel='';state.query='';cleanTrade();render();}
 });
 document.addEventListener('change',e=>{
  if(e.target.id==='team-choice'){
   state.team=Number(e.target.value);state.claimed=[];state.watched.clear();state.intel='';state.query='';cleanTrade();safePartner();render();return;
  }
  if(e.target.id==='week-choice'){state.week=Number(e.target.value);render();return;}
  const field=e.target.dataset.field;
  if(field&&['partner','give1','give2','take1','take2','faab'].includes(field)){
   state[field]=['partner','faab'].includes(field)?Number(e.target.value):e.target.value;
   if(field==='partner'){safePartner();cleanTrade();}
   render();
  }
 });
 document.addEventListener('input',e=>{
  if(e.target.matches('[data-intel-search]')){
   state.query=e.target.value;
   const box=$('intel-results');if(box)box.innerHTML=intelRows();
  }
 });
 render();
})();