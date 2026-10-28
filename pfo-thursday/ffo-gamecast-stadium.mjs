/* FFO GameCast Stadium v1, preview only. Read-only visualization of published play records.
   End-zone names mark SCHEMATIC ATTACK TARGETS, not the venue's painted end zones.
   No invented routes, positions, players, scores, or provider update speeds. */
import {normalizeName} from './ffo-gamecast-model.mjs';
const H=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const A=x=>typeof x==='string'?x:String(x?.abbreviation||x?.abbr||x?.name||'');
const aliases={GBP:'GB',GNB:'GB',JAC:'JAX',ARZ:'ARI',TAM:'TB',NOR:'NO',SFO:'SF',KAN:'KC',WAS:'WSH',LA:'LAR'};
export const abbrev=x=>{const v=A(x).trim().toUpperCase();return aliases[v]||v};
const spec='ARI|Cardinals|ari|#97233F;ATL|Falcons|atl|#A71930;BAL|Ravens|bal|#4F2683;BUF|Bills|buf|#00338D;CAR|Panthers|car|#0085CA;CHI|Bears|chi|#0B162A;CIN|Bengals|cin|#FB4F14;CLE|Browns|cle|#78461E;DAL|Cowboys|dal|#003594;DEN|Broncos|den|#FB4F14;DET|Lions|det|#0076B6;GB|Packers|gb|#203731;HOU|Texans|hou|#03202F;IND|Colts|ind|#002C5F;JAX|Jaguars|jax|#006778;KC|Chiefs|kc|#E31837;LAC|Chargers|lac|#0080C6;LAR|Rams|lar|#003594;LV|Raiders|lv|#A5ACAF;MIA|Dolphins|mia|#008E97;MIN|Vikings|min|#4F2683;NE|Patriots|ne|#002244;NO|Saints|no|#9F8958;NYG|Giants|nyg|#0B2265;NYJ|Jets|nyj|#125740;PHI|Eagles|phi|#004C54;PIT|Steelers|pit|#FFB612;SEA|Seahawks|sea|#002244;SF|49ers|sf|#AA0000;TB|Buccaneers|tb|#D50A0A;TEN|Titans|ten|#0C2340;WSH|Commanders|wsh|#5A1414';
const DATA=Object.fromEntries(spec.split(';').map(x=>{const [a,name,logo,color]=x.split('|');return [a,{abbr:a,name,logo,color}]}));
export const brand=t=>DATA[abbrev(t)]||{abbr:abbrev(t)||'NFL',name:abbrev(t)||'Team',logo:'',color:'#28445B'};
export const logo=t=>{const b=brand(t);return b.logo?'https://a.espncdn.com/i/teamlogos/nfl/500/'+b.logo+'.png':''};
const loc=(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o);
const first=(o,paths)=>{for(const k of paths){const v=loc(o,k);if(v!==null&&v!==undefined&&v!=='')return v}return null};
const num=(x,min,max)=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))&&Number(x)>=min&&Number(x)<=max?Number(x):null;
const nameOf=t=>brand(t).abbr;
const icon=(team,cls)=>{const src=logo(team);return src?'<img class="'+cls+'" src="'+H(src)+'" alt="'+H(brand(team).name)+' logo" loading="lazy" onerror="this.style.display=\'none\'">':'<span class="'+cls+'">'+H(nameOf(team))+'</span>'};
const outcome=x=>{const t=String(x?.text||'');if(/touchdown/i.test(t))return 'TOUCHDOWN';if(/intercepted|interception/i.test(t))return 'INTERCEPTION';if(/fumble/i.test(t))return 'FUMBLE';if(/field goal/i.test(t))return 'FIELD GOAL';if(/sacked|sack for/i.test(t))return 'SACK';if(/penalty/i.test(t))return 'PENALTY';if(/first down/i.test(t))return 'FIRST DOWN';if(/incomplete/i.test(t))return 'INCOMPLETE';return 'PLAY'};
const highlight=x=>/TOUCHDOWN|INTERCEPTION|FUMBLE|FIELD GOAL/.test(outcome(x));
const stateOf=e=>e?.raw?.playStatus||{};
export function eventInfo(e,g){
 const st=stateOf(e),raw=e?.raw||{},home=abbrev(g?.home),away=abbrev(g?.away);
 const team=abbrev(first(raw,['team.abbreviation','offensiveTeam.abbreviation','playTeam.abbreviation','teamInPossession.abbreviation','playStatus.teamInPossession.abbreviation','playStatus.teamInPossession'])||'');
 const offense=team===home||team===away?team:null;
 const side=abbrev(first(st,['lineOfScrimmage.team.abbreviation','lineOfScrimmage.team'])||'');
 const yl=num(first(st,['lineOfScrimmage.yardLine']),0,50);
 const spot=(yl!==null&&(side===home||side===away))?(side===away?yl:100-yl):null;
 const down=num(first(st,['currentDown']),1,4);
 const distance=num(first(st,['yardsRemaining']),0,99);
 const dir=offense===away?1:offense===home?-1:null;
 const target=dir!==null&&spot!==null&&distance!==null?Math.max(0,Math.min(100,spot+dir*distance)):null;
 const explicitYds=num(first(raw,['yardsGained','play.yardsGained','playResult.yardsGained','playOutcome.yardsGained']),-99,99);
 const end=spot!==null&&dir!==null&&explicitYds!==null&&spot+dir*explicitYds>=0&&spot+dir*explicitYds<=100?spot+dir*explicitYds:null;
 return {offense,side,yl,spot,down,distance,dir,target,end,explicitYds,quarter:e?.period||null,clock:e?.clock||null};
}
const validImage=x=>{if(typeof x!=='string')return '';try{const u=new URL(x);return u.protocol==='https:'&&['mysportsfeeds.com','sleepercdn.com','sleeper.com','espncdn.com','nfl.com'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d))?u.href:''}catch{return ''}};
function uniqueMatchingPlayer(event,playerRows,selected){
 const norm=normalizeName(event?.text||'');if(!norm)return null;
 const matches=(Array.isArray(playerRows)?playerRows:[]).filter(p=>{const n=normalizeName(p?.name||'');return n.length>=6&&norm.includes(n)});
 const length=matches.length?Math.max(...matches.map(x=>normalizeName(x.name).length)):0;
 const choices=matches.filter(x=>normalizeName(x.name).length===length);
 if(choices.length===1)return choices[0];
 if(selected?.name&&norm.includes(normalizeName(selected.name))&&normalizeName(selected.name).length>=6)return selected;
 return null;
}
function playerPortrait(event,rows,selected){
 const p=uniqueMatchingPlayer(event,rows,selected);
 const raw=p?.raw?.player||p?.raw?.playerInfo||p||{};
 let src=validImage(first(raw,['officialImageSrc','officialImageUrl','headshot','headshotUrl','imageUrl','photoUrl']));
 // Only use Sleeper ID when uniquely matched to the roster member, never a MSF ID.
 if(!src&&p?.name&&selected?.name&&normalizeName(p.name)===normalizeName(selected.name)){
   const id=String(selected.id||'');if(/^[0-9]{1,8}$/.test(id))src='https://sleepercdn.com/content/nfl/players/thumb/'+id+'.jpg';
 }
 const label=p?.name||'Player unavailable';
 return {name:label,src,initials:label==='Player unavailable'?'—':label.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()};
}
function escColor(hex){return /^#[A-Fa-f0-9]{6}$/.test(hex)?hex:'#1a4550'}
const score=x=>x===null||x===undefined?'—':H(x);
const clockFmt=e=>e?(e.period?'Q'+H(e.period):'Q —')+' · '+H(e.clock||'Clock unavailable'):'PRE-GAME';
export function fieldMarkup({game:g,event,embedded=false,latestCheck='',playCount=0,activePlay=-1,followLatest=true,playerRows=[],selectedPlayer=null,source='',isLive=false}){
 const away=brand(g?.away),home=brand(g?.home),i=eventInfo(event,g),p=playerPortrait(event,playerRows,selectedPlayer);
 const goalX=v=>Math.round(88+v*6.04),x=goalX,down=i.down!==null?String(i.down):'—',dist=i.distance!==null?String(i.distance):'—';
 const offense=i.offense?brand(i.offense):null;
 const leftEnd=home,rightEnd=away; // end zones show attack targets, not painted venue branding.
 const scrim=i.spot!==null?'<line x1="'+x(i.spot)+'" y1="112" x2="'+x(i.spot)+'" y2="325" stroke="#76E3ED" stroke-width="3.4" opacity=".97"/>':'';
 const togo=i.target!==null?'<line x1="'+x(i.target)+'" y1="112" x2="'+x(i.target)+'" y2="325" stroke="#F5D16A" stroke-width="3" opacity=".98"/>':'';
 const ball=i.spot!==null?'<ellipse cx="'+x(i.spot)+'" cy="235" rx="11" ry="6.5" transform="rotate(-20 '+x(i.spot)+' 235)" fill="#A96332" stroke="#F9E0B9" stroke-width="2"/>':'';
 const travel=i.end!==null&&i.spot!==null&&i.end!==i.spot?'<path d="M'+x(i.spot)+' 225 Q'+Math.round((x(i.spot)+x(i.end))/2)+' 174 '+x(i.end)+' 225" fill="none" stroke="#FFC66A" stroke-width="3" stroke-dasharray="8 6"/><circle cx="'+x(i.end)+'" cy="225" r="5" fill="#FFC66A" stroke="#091d26" stroke-width="2"/>':'';
 let stripes='',ticks='',yardNumbers='';
 for(let j=0;j<=10;j++){const xx=x(j*10);stripes+='<line x1="'+xx+'" y1="113" x2="'+xx+'" y2="329" stroke="#D3F1DC" stroke-width="'+(j===0||j===10?2:1.3)+'" opacity=".65"/>';if(j>0&&j<10)yardNumbers+='<text x="'+xx+'" y="143" text-anchor="middle" font-size="11" font-weight="800" fill="#DBF4E7" opacity=".8">'+(j<=5?j*10:(10-j)*10)+'</text>'}
 for(let j=0;j<20;j++){const xx=x(j*5);ticks+='<line x1="'+xx+'" y1="169" x2="'+xx+'" y2="181" stroke="#E9F7E8" stroke-width="1.5" opacity=".55"/><line x1="'+xx+'" y1="261" x2="'+xx+'" y2="273" stroke="#E9F7E8" stroke-width="1.5" opacity=".55"/>'}
 const id=embedded?'mini':'main';
 const field='<svg viewBox="0 0 780 355" role="img" aria-label="Illustrative football field. Left is the '+H(home.abbr)+' scoring target and right is the '+H(away.abbr)+' scoring target. Not the physical stadium orientation." xmlns="http://www.w3.org/2000/svg">'+
 '<defs><linearGradient id="gc6grass-'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#277D56"/><stop offset=".5" stop-color="#1C6948"/><stop offset="1" stop-color="#104F38"/></linearGradient><linearGradient id="gc6sky-'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#294557"/><stop offset="1" stop-color="#101e2b"/></linearGradient></defs>'+
 '<rect width="780" height="355" fill="url(#gc6sky-'+id+')"/><path d="M0 108 Q390 -28 780 108 L780 135 L0 135Z" fill="#162937"/>'+
 Array.from({length:60},(_,j)=>'<circle cx="'+((j*83)%780)+'" cy="'+(38+(j*19)%74)+'" r="'+(j%4===0?2:1)+'" fill="'+(j%7===0?'#F1CF7C':'#94C1C2')+'" opacity="'+(.14+(j%6)*.06)+'"/>').join('')+
 '<rect x="0" y="112" width="780" height="218" rx="3" fill="url(#gc6grass-'+id+')"/>'+
 Array.from({length:10},(_,j)=>'<rect x="'+(88+j*60.4)+'" y="112" width="60.4" height="218" fill="'+(j%2?'#ffffff06':'#00000009')+'"/>').join('')+
 '<rect x="0" y="112" width="88" height="218" fill="'+escColor(leftEnd.color)+'"/><rect x="692" y="112" width="88" height="218" fill="'+escColor(rightEnd.color)+'"/>'+
 '<rect x="0" y="112" width="780" height="218" fill="none" stroke="#D8F7ED" stroke-width="3"/>'+stripes+ticks+yardNumbers+
 '<text class="gc6-endzone-word" text-anchor="middle" transform="translate(50 225) rotate(-90)">'+H(leftEnd.abbr)+'</text>'+
 '<text class="gc6-endzone-word" text-anchor="middle" transform="translate(729 225) rotate(90)">'+H(rightEnd.abbr)+'</text>'+
 '<text x="390" y="65" text-anchor="middle" class="gc6-venue-title">FFO · GAMECAST STADIUM</text>'+
 scrim+togo+travel+ball+'</svg>';
 const tag=event?outcome(event):'AWAITING PLAY';
 const front='<div class="gc6-hdr"><div class="gc6-team">'+icon(away.abbr,'gc6-teamlogo')+'<div><div class="gc6-teamname">'+H(away.name)+'<small>AWAY</small></div><div class="gc6-score">'+score(g?.awayPoints)+'</div></div></div><div class="gc6-gameclock"><strong>'+clockFmt(event)+'</strong><span>'+H(i.down!==null?down+' & '+dist:(g?.status||'STATUS PENDING'))+'</span></div><div class="gc6-team"><div style="text-align:right"><div class="gc6-teamname">'+H(home.name)+'<small>HOME</small></div><div class="gc6-score">'+score(g?.homePoints)+'</div></div>'+icon(home.abbr,'gc6-teamlogo')+'</div></div>';
 const state='<div class="gc6-statebar"><span>'+ (isLive?'<i class="gc6-live-dot"></i>':'')+H(isLive?'LIVE CHECKING':String(g?.status||'GAME STATUS UNVERIFIED').toUpperCase())+'</span><span>'+H(offense?offense.abbr+' POSSESSION · '+(i.dir===1?'ATTACK →':'← ATTACK'):'POSSESSION UNVERIFIED')+'</span></div>';
 const portrait=p.src?'<img loading="lazy" src="'+H(p.src)+'" alt="'+H(p.name)+' portrait" onerror="this.parentElement.innerHTML=\'<span class=gc6-initial>—</span>\'">':'<span class="gc6-initial">'+H(p.initials)+'</span>';
 const featured='<div class="gc6-feature"><div class="gc6-portrait">'+portrait+'</div><div class="gc6-feature-copy"><span class="gc6-eyebrow">'+H(event?'SELECTED PLAY · '+(offense?offense.abbr:'TEAM UNVERIFIED'):'PREGAME / NO PLAY')+'</span><h4>'+H(p.name==='Player unavailable'?(event?'Published play':'Awaiting official play data'):p.name)+'</h4><p>'+H(event?.text||'Plays appear when an authorized source publishes them. No simulated live events.')+'</p></div><span class="gc6-tag">'+H(tag)+'</span></div>';
 const specLabel=event&&i.spot!==null?'Line of scrimmage: '+H(i.side)+' '+i.yl+' · '+(i.down||'—')+' & '+(i.distance===null?'—':i.distance):'Ball position unavailable or not yet published';
 const extra='<div class="gc6-bottomline"><b>'+H(specLabel)+'</b> · '+H(source||'Source not verified')+' · schematic attack targets, not stadium paint, routes or tracking.<br>'+H(latestCheck||'Refresh not verified')+'</div>';
 const control=embedded?'':'<div class="gc6-controls"><button type="button" data-gc6-step="-1" '+(activePlay<=0?'disabled':'')+'>← Earlier</button><button type="button" data-gc6-latest="1" aria-pressed="'+(followLatest?'true':'false')+'">'+(followLatest?'Following latest':'Jump to latest')+'</button><button type="button" data-gc6-step="1" '+(activePlay>=playCount-1?'disabled':'')+'>Later →</button></div>';
 return '<div class="gc6-shell">'+front+state+'<div class="gc6-stadium">'+field+'<div class="gc6-attack"><span>← '+H(home.abbr)+' SCORING TARGET</span><span>'+H(away.abbr)+' SCORING TARGET →</span></div></div>'+featured+control+extra+'</div>';
}
export function playRow(event,index,selected,game,source,playerRows,selectedPlayer){
 const info=eventInfo(event,game),team=info.offense?brand(info.offense):null,p=playerPortrait(event,playerRows,selectedPlayer);
 const big=highlight(event);
 const badge=outcome(event);
 const desc=String(event.text||'');
 const marked=p.name!=='Player unavailable'&&desc.includes(p.name)?H(desc).replace(H(p.name),'<strong>'+H(p.name)+'</strong>'):H(desc);
 return '<div class="gc6-play '+(selected?'active ':'')+(big?'gc6-big':'')+'" data-ffo-play="'+index+'" tabindex="0" role="button" aria-label="Select '+H(event.period?'quarter '+event.period+' ':'')+H(event.clock||'')+' play"><div>'+ (team?icon(team.abbr,'gc6-feedlogo'):'<span class="gc6-feedlogo" aria-hidden="true">🏈</span>')+'</div><div class="gc6-play-body"><div class="gc6-rowtop"><strong>'+H(team?.name||'TEAM UNVERIFIED')+' · '+H(event.update==='corrected'?'CORRECTED':event.update==='new'?'NEW':'PLAY')+'</strong><span>'+H(event.period?'Q'+event.period:'Q —')+' · '+H(event.clock||'—')+'</span></div><div class="gc6-description">'+marked+'</div><div class="gc6-rowfoot">'+H(info.down!==null?info.down+' & '+(info.distance===null?'—':info.distance):'Down not confirmed')+' · '+H(source||'Source unverified')+' <span class="gc6-flag">'+H(badge)+'</span></div></div></div>';
}
