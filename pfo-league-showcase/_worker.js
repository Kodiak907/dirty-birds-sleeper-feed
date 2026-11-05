/* PFO member-only licensed MSF bridge.
 * NEVER ship credentials, protected MSF data or private FFO league records.
 * Default deny: requires dedicated Cloudflare Access JWT, invited email,
 * explicit provider member-use approval, and a server-side MSF secret.
 */
const TEAMS=new Set('ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' '));
const MSF_ROOT='https://api.mysportsfeeds.com/v2.1/pull/nfl/2026-regular';
const LIMIT=5000000, cache=new Map();
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private, no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
 'x-frame-options':'DENY','access-control-allow-origin':'null'}});
const base64url=txt=>{const value=String(txt).replace(/-/g,'+').replace(/_/g,'/');
 return Uint8Array.from(atob(value.padEnd(Math.ceil(value.length/4)*4,'=')),c=>c.charCodeAt(0));};
const parse64=txt=>JSON.parse(new TextDecoder().decode(base64url(txt)));
function config(env){
 const issuer=String(env.DEMO_ACCESS_ISSUER||'').replace(/\/$/,'');
 const audience=String(env.DEMO_ACCESS_AUD||'');
 const emails=String(env.DEMO_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 const allow=String(env.MSF_MEMBER_SHARING_APPROVED||'').toLowerCase()==='true';
 return {issuer,audience,emails,allow,ready:issuer.startsWith('https://')&&issuer.endsWith('.cloudflareaccess.com')&&audience.length>5&&
 emails.length>0&&emails.length<=10&&allow&&!!env.MSF_API_KEY};
}
async function authorize(request,env){
 const conf=config(env);
 if(!conf.ready)throw Error('MEMBER_GATE_NOT_CONFIGURED');
 const jwt=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!jwt)throw Error('ACCESS_REQUIRED');
 const sections=jwt.split('.');if(sections.length!==3)throw Error('JWT_MALFORMED');
 const head=parse64(sections[0]),claims=parse64(sections[1]);
 if(head.alg!=='RS256'||!head.kid)throw Error('UNSUPPORTED_SIGNATURE');
 const now=Math.floor(Date.now()/1000);
 if(claims.iss!==conf.issuer||!Array.isArray(claims.aud)||!claims.aud.includes(conf.audience)||
  typeof claims.exp!=='number'||claims.exp<=now||typeof claims.iat!=='number'||claims.iat>now+60)
  throw Error('ACCESS_EXPIRED_OR_UNTRUSTED');
 if(!claims.email||!conf.emails.includes(String(claims.email).toLowerCase()))throw Error('INVITATION_REQUIRED');
 const result=await fetch(conf.issuer+'/cdn-cgi/access/certs',{signal:AbortSignal.timeout(5000)});
 if(!result.ok)throw Error('CERT_UNAVAILABLE');
 const json=await result.json(),keys=Array.isArray(json.keys)?json.keys:[];
 const jwk=keys.find(x=>x.kid===head.kid&&x.kty==='RSA');
 if(!jwk)throw Error('KEY_NOT_FOUND');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const verified=await crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'},key,base64url(sections[2]),
  new TextEncoder().encode(sections[0]+'.'+sections[1]));
 if(!verified)throw Error('INVALID_SIGNATURE');
 return {email:claims.email};
}
const get=(o,path)=>path.split('.').reduce((x,key)=>x?.[key],o);
const num=v=>v===null||v===undefined||v===''||typeof v==='object'?null:
 Number.isFinite(Number(v))?Number(v):null;
const FIELDS={
 pass_yd:['passing.passYards','passing.passingYards','passing.yards','passYards'],
 pass_td:['passing.passTD','passing.passTouchdowns','passing.passTds','passTD'],
 pass_int:['passing.passInt','passing.interceptions','passInt'],
 rush_att:['rushing.rushAttempts','rushing.attempts','rushAttempts'],
 rush_yd:['rushing.rushYards','rushing.yards','rushYards'],
 rush_td:['rushing.rushTD','rushing.rushTouchdowns','rushTD'],
 rec:['receiving.receptions','receiving.rec','receptions'],
 rec_yd:['receiving.recYards','receiving.receivingYards','recYards'],
 rec_td:['receiving.recTD','receiving.recTouchdowns','recTD'],
 targets:['receiving.targets','receiving.recTargets','targets'],
 fgm_0_19:['fieldGoals.fieldGoalsMade0To19','kicking.fieldGoalsMade0To19'],
 fgm_20_29:['fieldGoals.fieldGoalsMade20To29','kicking.fieldGoalsMade20To29'],
 fgm_30_39:['fieldGoals.fieldGoalsMade30To39','kicking.fieldGoalsMade30To39'],
 fgm_40_49:['fieldGoals.fieldGoalsMade40To49','kicking.fieldGoalsMade40To49'],
 fgm_50_59:['fieldGoals.fieldGoalsMade50To59','kicking.fieldGoalsMade50To59'],
 fgm_60p:['fieldGoals.fieldGoalsMade60Plus','kicking.fieldGoalsMade60Plus'],
 xpm:['extraPoints.extraPointsMade','extraPoints.made','kicking.extraPointsMade'],
 sack:['defense.sacks','defensive.sacks','defense.sacksMade'],
 int:['defense.interceptions','defensive.interceptions'],
 ff:['defense.forcedFumbles','defensive.forcedFumbles']
};
const norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
async function permittedPlayers(req,env){
 const asset=new URL('/sample-rosters.json',req.url);
 const response=await env.ASSETS.fetch(new Request(asset));
 if(!response.ok)throw Error('DEMO_DIRECTORY_MISSING');
 const json=await response.json();
 const names=new Map();
 for(const [id,p] of Object.entries(json.players||{})){
  if(!p.name||!TEAMS.has(p.team))continue;
  names.set(norm(p.name)+':'+p.team.toUpperCase(),{id,name:p.name,team:p.team,position:p.position});
 }
 return names;
}
async function seasonTeam(req,env,team){
 const cacheKey='season:'+team,hit=cache.get(cacheKey),now=Date.now();
 if(hit&&now-hit.time<120000)return hit.data;
 const allowed=await permittedPlayers(req,env);
 const endpoint=MSF_ROOT+'/player_stats_totals.json?team='+encodeURIComponent(team);
 const upstream=await fetch(endpoint,{headers:{authorization:'Basic '+btoa(env.MSF_API_KEY+':MYSPORTSFEEDS'),
  accept:'application/json'},signal:AbortSignal.timeout(12000)});
 if(!upstream.ok)throw Error(upstream.status===401||upstream.status===403?'PROVIDER_ENTITLEMENT_DENIED':'PROVIDER_UNAVAILABLE');
 const size=num(upstream.headers.get('content-length'))||0;if(size>LIMIT)throw Error('FEED_TOO_LARGE');
 const raw=await upstream.text();if(raw.length>LIMIT)throw Error('FEED_TOO_LARGE');
 const parsed=JSON.parse(raw);
 if(!Array.isArray(parsed.playerStatsTotals))throw Error('FEED_SCHEMA_UNVERIFIED');
 const rows=[];
 for(const item of parsed.playerStatsTotals){
  const p=item.player||item.playerInfo||{},stats=item.stats||item.playerStats||{};
  const current=item.team?.abbreviation||item.teamInfo?.abbreviation||p.currentTeam?.abbreviation||item.teamAbbreviation||'';
  const name=String(p.fullName||p.displayName||[p.firstName,p.lastName].filter(Boolean).join(' ')||'').trim();
  if(current.toUpperCase()!==team)continue;
  const match=allowed.get(norm(name)+':'+team);if(!match)continue;
  const g=num(stats.gamesPlayed??item.gamesPlayed??stats.games);
  const games=Number.isInteger(g)&&g>0&&g<=18?g:null;
  const per_game={};
  if(games)for(const [key,aliases] of Object.entries(FIELDS)){
   let v=null;for(const a of aliases){v=num(get(stats,a));if(v!==null)break}
   if(v!==null)per_game[key]=Math.round(v/games*1000)/1000;
  }
  rows.push({...match,games_observed:games,per_game,coverage:games&&Object.keys(per_game).length?'season_observed_per_game_partial':'unverified'});
 }
 const data={source:'MySportsFeeds',schema:'PFO_MEMBER_MSF_MINIMAL_V1',checked_at:new Date().toISOString(),
  season:2026,team,projection_status:'not_calibrated',players:rows};
 cache.set(cacheKey,{time:Date.now(),data});return data;
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/demo/msf/'))return env.ASSETS.fetch(request);
  if(request.method!=='GET')return reply({error:'method_not_allowed'},405);
  try{await authorize(request,env)}
  catch{return reply({source:'MySportsFeeds',available:false,error:'member_access_required_or_not_configured'},403)}
  try{
   if(url.pathname==='/api/demo/msf/status')return reply({source:'MySportsFeeds',available:true,scope:'invited_demo_members_only',schema:'PFO_MEMBER_MSF_MINIMAL_V1'});
   if(url.pathname==='/api/demo/msf/season'){
    const team=String(url.searchParams.get('team')||'').toUpperCase();
    if(!TEAMS.has(team))return reply({error:'invalid_team'},400);
    return reply(await seasonTeam(request,env,team));
   }
   return reply({error:'not_found'},404);
  }catch(err){
   const label=String(err?.message||'').toUpperCase();
   return reply({source:'MySportsFeeds',available:false,error:
    /PROVIDER_ENTITLEMENT_DENIED/.test(label)?'msf_entitlement_denied':
    /FEED_TOO_LARGE|FEED_SCHEMA/.test(label)?'msf_feed_not_verified':'licensed_provider_temporarily_unavailable'},502);
  }
 }
};
