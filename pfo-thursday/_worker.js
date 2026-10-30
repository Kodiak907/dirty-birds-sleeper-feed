/* FFO Commissioner 5.4. Default-deny Access+PIN gate; private D1/R2. No client secrets. */
const comJson=(o,s=200,h={})=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...h}});
const comB64=x=>{const s=x.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0))};
const comUrlB64=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const comSafeEqual=(a,b)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0};
const comIso=()=>new Date().toISOString();
let comKeyCache={issuer:'',until:0,keys:[]};
async function comIdentity(request,env){
 const issuer=String(env.COMMISSIONER_ACCESS_ISSUER||'').replace(/\/$/,'');
 const aud=String(env.COMMISSIONER_ACCESS_AUD||'');
 const emails=String(env.COMMISSIONER_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)||!aud||!emails.length)throw Error('ACCESS_NOT_CONFIGURED');
 const token=request.headers.get('Cf-Access-Jwt-Assertion');if(!token)throw Error('ACCESS_REQUIRED');
 const segments=token.split('.');if(segments.length!==3)throw Error('INVALID_IDENTITY');
 let header,claims;try{header=JSON.parse(new TextDecoder().decode(comB64(segments[0])));claims=JSON.parse(new TextDecoder().decode(comB64(segments[1])))}catch{throw Error('INVALID_IDENTITY')}
 if(header.alg!=='RS256'||typeof header.kid!=='string'||claims.iss!==issuer||!(Array.isArray(claims.aud)?claims.aud.includes(aud):claims.aud===aud)||!Number.isFinite(Number(claims.exp))||Number(claims.exp)<Date.now()/1000||Number(claims.iat)>Date.now()/1000+120||!claims.email)throw Error('INVALID_IDENTITY');
 const email=String(claims.email).toLowerCase();if(!emails.includes(email))throw Error('ADMIN_NOT_AUTHORIZED');
 if(comKeyCache.issuer!==issuer||comKeyCache.until<Date.now()){
  const resp=await fetch(issuer+'/cdn-cgi/access/certs',{headers:{accept:'application/json'}});if(!resp.ok)throw Error('ACCESS_KEY_UNAVAILABLE');const certs=await resp.json();if(!Array.isArray(certs.keys))throw Error('ACCESS_KEY_UNAVAILABLE');comKeyCache={issuer,until:Date.now()+300000,keys:certs.keys};
 }
 const jwk=comKeyCache.keys.find(x=>x.kid===header.kid&&x.kty==='RSA');if(!jwk)throw Error('ACCESS_KEY_MISMATCH');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,comB64(segments[2]),new TextEncoder().encode(segments[0]+'.'+segments[1]));
 if(!ok)throw Error('INVALID_IDENTITY');return email;
}
async function comHmacKey(env){const secret=String(env.COMMISSIONER_SESSION_SECRET||'').trim();if(secret.length<32)throw Error('SESSION_NOT_CONFIGURED');return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
async function comSign(payload,env){const key=await comHmacKey(env);const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload));return payload+'.'+comUrlB64(new Uint8Array(signature))}
async function comSession(req,env,email){const raw=(req.headers.get('cookie')||'').match(/(?:^|;\s*)ffo_commissioner=([^;]+)/)?.[1];if(!raw)return false;
 const dot=raw.lastIndexOf('.');if(dot<1)return false;const payload=raw.slice(0,dot);const sig=raw.slice(dot+1);
 try{const k=await comHmacKey(env);if(!(await crypto.subtle.verify('HMAC',k,comB64(sig),new TextEncoder().encode(payload))))return false;const data=JSON.parse(new TextDecoder().decode(comB64(payload)));return data.email===email&&Number(data.exp)>Date.now()&&Number(data.exp)<Date.now()+30*60*1000}catch{return false}
}
// PIN derivation runs in the authenticated browser, avoiding Cloudflare Worker CPU exhaustion.
// The server NEVER receives the plaintext PIN. It validates the HMAC challenge proof using
 // the existing (unchanged) salted PBKDF2 verifier stored as an encrypted Cloudflare secret.
 async function comChallengeValid(token,email,req,env){
  if(!token || req.headers.get('cookie')?.match(/(?:^|;\s*)ffo_com_challenge=([^;]+)/)?.[1]!==token)return false;
  const i=token.lastIndexOf('.');if(i<1)return false;
  const payload=token.slice(0,i),sig=token.slice(i+1);
  try {
   const sessionKey=await comHmacKey(env);
   if(!(await crypto.subtle.verify('HMAC',sessionKey,comB64(sig),new TextEncoder().encode(payload))))return false;
   const c=JSON.parse(new TextDecoder().decode(comB64(payload)));
   return c.purpose==='pin_unlock'&&c.email===email&&Number(c.exp)>Date.now()&&Number(c.exp)<=Date.now()+90000;
  }catch{return false}
 }
 async function comPinProofOkay(proof,token,env){
  if(!/^[a-f0-9]{64}$/.test(String(proof||'')))return false;
  try {
   const verifier=String(env.COMMISSIONER_PIN_HASH||'').trim().toLowerCase();if(!/^[a-f0-9]{64}$/.test(verifier))return false;
   const key=await crypto.subtle.importKey('raw',Uint8Array.from(verifier.match(/.{2}/g),h=>parseInt(h,16)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
   const result=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('FFO-COMMISSIONER-PROOF-v1:'+token)));
   const supplied=Uint8Array.from(String(proof).match(/.{2}/g),h=>parseInt(h,16));
   return comSafeEqual(result,supplied);
  }catch{return false}
 }

const comText=(x,n=350)=>String(x||'').trim().slice(0,n);

// PFO 5.7: Commissioner FFO-only point-adjustment ledger.
// A record changes the ADMINISTRATIVE ledger, not official Sleeper points.
// All revisions append D1 events; none overwrite history or submit to Sleeper.
const comScoreNumber=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=99999&&Math.abs(n*100-Math.round(n*100))<1e-6;
const comScoreRound=n=>Math.round((n+Number.EPSILON)*100)/100;
async function comScoreEvents(env,limit=500){
 const result=await env.COMMISSIONER_DB.prepare(
  "SELECT e.id,e.case_id,e.event_type,e.note,e.created_utc,e.created_by,c.case_no,c.league,c.year,c.week AS case_week,c.team,c.owner FROM commissioner_events e JOIN commissioner_cases c ON c.id=e.case_id WHERE e.event_type IN ('SCORE_RECORDED','SCORE_VOIDED','SCORE_VERIFIED') ORDER BY e.id ASC LIMIT ?"
 ).bind(limit).all();
 const events=[];
 for(const row of result.results||[]){
  try{
   const d=JSON.parse(row.note);
   if(d?.schema!=='FFO_COMMISSIONER_SCORE_V1'||!/^[a-f0-9-]{36}$/.test(String(d.adjustment_id||'')))continue;
   events.push({id:row.id,case_id:row.case_id,case_no:row.case_no,league:row.league,year:row.year,team:row.team,owner:row.owner,created_at:row.created_utc,created_by:row.created_by,event_type:row.event_type,...d});
  }catch{/* Existing generic notes are not score events. */}
 }
 return events;
}
async function comSleeperScoreVerify(env,a){
 const league=String(env.COMMISSIONER_FFL_LEAGUE_ID||'');
 if(!/^\d{12,22}$/.test(league))return {verified:false,reason:'SLEEPER_LEAGUE_ID_NOT_CONFIGURED'};
 const stateResp=await fetch('https://api.sleeper.app/v1/state/nfl',{signal:AbortSignal.timeout(8000)});
 if(!stateResp.ok)return {verified:false,reason:'SLEEPER_STATE_UNAVAILABLE'};
 const state=await stateResp.json();
 if(Number(state.season)!==Number(a.year)||Number(state.week)<=Number(a.week))return {verified:false,reason:'WEEK_NOT_COMPLETED_OR_SEASON_MISMATCH'};
 const response=await fetch('https://api.sleeper.app/v1/league/'+league+'/matchups/'+a.week,{signal:AbortSignal.timeout(9000)});
 if(!response.ok)return {verified:false,reason:'SLEEPER_MATCHUP_UNAVAILABLE'};
 const list=await response.json();
 if(!Array.isArray(list))return {verified:false,reason:'SLEEPER_MATCHUP_INVALID'};
 const found=list.find(m=>Number(m.roster_id)===Number(a.roster_id));
 if(!found)return {verified:false,reason:'ROSTER_NOT_FOUND_IN_SAFELY_CONFIGURED_LEAGUE'};
 const actual=Number(found.custom_points);
 if(found.custom_points===null||found.custom_points===undefined||!Number.isFinite(actual))return {verified:false,reason:'NO_COMMISSIONER_OVERRIDE_PUBLISHED',observed_points:found.points??null};
 if(Math.abs(actual-Number(a.new_total))>.011)return {verified:false,reason:'SLEEPER_CUSTOM_SCORE_DIFFERENT',observed_override:actual};
 return {verified:true,official_custom_points:actual,source:'Sleeper public matchup API',checked_at:comIso()};
}

const comCaseListSql="SELECT c.*,COALESCE((SELECT e.event_type FROM commissioner_events e WHERE e.case_id=c.id AND e.event_type NOT IN ('NOTE','SCORE_RECORDED','SCORE_VOIDED','SCORE_VERIFIED') ORDER BY e.id DESC LIMIT 1),'FILED') AS status,(SELECT COUNT(*) FROM commissioner_evidence v WHERE v.case_id=c.id) AS evidence_count FROM commissioner_cases c";
async function comGetCase(env,id){return env.COMMISSIONER_DB.prepare(comCaseListSql+' WHERE c.id=?').bind(id).first()}
async function comJsonBody(req){if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw Error('JSON_REQUIRED');const text=await req.text();if(text.length>30000)throw Error('BODY_TOO_LARGE');return JSON.parse(text)}
async function commissionerApi(req,env){
 const url=new URL(req.url),parts=url.pathname.split('/').filter(Boolean),method=req.method;
 if(!env.COMMISSIONER_DB||!env.COMMISSIONER_EVIDENCE)return comJson({ready:false,error:'PRIVATE_STORAGE_NOT_CONFIGURED',message:'Bind private D1 and R2 before enabling commissioner functions.'},503);
 let email;try{email=await comIdentity(req,env)}catch(err){const str=String(err.message||'ACCESS_DENIED');return comJson({ready:false,error:str},str==='ACCESS_NOT_CONFIGURED'?503:403)}
 if(!['GET','POST'].includes(method))return comJson({error:'METHOD_NOT_ALLOWED'},405);
 if(method==='POST'){
  if(req.headers.get('origin')!==url.origin)return comJson({error:'ORIGIN_CHECK_FAILED'},403);
 }
 const pinHashValid=/^[a-f0-9]{64}$/.test(String(env.COMMISSIONER_PIN_HASH||'').trim().toLowerCase()),pinSaltValid=/^[a-f0-9]{32}$/.test(String(env.COMMISSIONER_PIN_SALT||'').trim().toLowerCase()),pinSessionValid=String(env.COMMISSIONER_SESSION_SECRET||'').trim().length>=32;const ready=pinHashValid&&pinSaltValid&&pinSessionValid;
 if(parts[2]==='status'&&method==='GET')return comJson({ready,identity:email,unlocked:ready&&await comSession(req,env,email),pin_secret_format:{hash_ok:pinHashValid,salt_ok:pinSaltValid,session_ok:pinSessionValid}});
 if(parts[2]==='challenge'&&method==='GET'){
  if(!ready)return comJson({error:'PIN_OR_SESSION_NOT_CONFIGURED'},503);
  const now=Math.floor(Date.now()/1000);
  const lim=await env.COMMISSIONER_DB.prepare('SELECT failures,blocked_until FROM commissioner_pin_limits WHERE email=?').bind(email).first();
  if(Number(lim?.blocked_until||0)>now)return comJson({error:'PIN_TEMPORARILY_LOCKED',retry_after_seconds:Number(lim.blocked_until)-now},429);
  const salt=String(env.COMMISSIONER_PIN_SALT||'').trim().toLowerCase();if(!/^[a-f0-9]{32}$/.test(salt))return comJson({error:'PIN_SALT_INVALID_FORMAT'},503);
  const challengePayload=comUrlB64(new TextEncoder().encode(JSON.stringify({purpose:'pin_unlock',email,exp:Date.now()+90000,nonce:crypto.randomUUID()})));
  const token=await comSign(challengePayload,env);
  return comJson({challenge:token,salt,kdf:'PBKDF2-SHA256',iterations:210000,expires_in_seconds:90},200,{'set-cookie':'ffo_com_challenge='+token+'; HttpOnly; Secure; SameSite=Strict; Path=/api/commissioner; Max-Age=90'});
 }
 
 if(!ready)return comJson({error:'PIN_OR_SESSION_NOT_CONFIGURED'},503);
 if(parts[2]==='unlock'&&method==='POST'){
  const now=Math.floor(Date.now()/1000),lim=await env.COMMISSIONER_DB.prepare('SELECT failures,blocked_until FROM commissioner_pin_limits WHERE email=?').bind(email).first();
  if(Number(lim?.blocked_until||0)>now)return comJson({error:'PIN_TEMPORARILY_LOCKED',retry_after_seconds:Number(lim.blocked_until)-now},429);
  let body;try{body=await comJsonBody(req)}catch{return comJson({error:'INVALID_REQUEST'},400)}
  if(!body.challenge||!body.proof)return comJson({error:'CHALLENGE_REQUIRED'},400);
  if(!(await comChallengeValid(body.challenge,email,req,env)))return comJson({error:'CHALLENGE_INVALID'},400);
  if(!(await comPinProofOkay(body.proof,body.challenge,env))){const failures=Number(lim?.failures||0)+1,block=failures>=5?now+900:0;
   await env.COMMISSIONER_DB.prepare('INSERT INTO commissioner_pin_limits(email,failures,blocked_until) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET failures=excluded.failures,blocked_until=excluded.blocked_until').bind(email,failures,block).run();return comJson({error:failures>=5?'PIN_TEMPORARILY_LOCKED':'WRONG_PIN',attempts_remaining:Math.max(0,5-failures)},failures>=5?429:403);
  }
  await env.COMMISSIONER_DB.prepare('INSERT INTO commissioner_pin_limits(email,failures,blocked_until) VALUES(?,0,0) ON CONFLICT(email) DO UPDATE SET failures=0,blocked_until=0').bind(email).run();
  const payload=comUrlB64(new TextEncoder().encode(JSON.stringify({email,exp:Date.now()+20*60*1000,nonce:crypto.randomUUID()})));
  return comJson({unlocked:true,identity:email,expires_in_minutes:20},200,{'set-cookie':'ffo_commissioner='+await comSign(payload,env)+'; HttpOnly; Secure; SameSite=Strict; Path=/api/commissioner; Max-Age=1200'});
 }
 if(parts[2]==='lock'&&method==='POST')return comJson({unlocked:false},200,{'set-cookie':'ffo_commissioner=; Max-Age=0; HttpOnly; Secure; SameSite=Strict; Path=/api/commissioner'});
 if(!(await comSession(req,env,email)))return comJson({error:'ADMIN_PIN_REQUIRED'},401);
 if(parts[2]==='score-ledger'&&parts.length===3&&method==='GET'){
  const events=await comScoreEvents(env);
  const map=new Map();
  for(const ev of events){
   const prev=map.get(ev.adjustment_id);
   if(ev.event_type==='SCORE_RECORDED')map.set(ev.adjustment_id,{...ev,status:'RECORDED_IN_FFO',history:[{event_type:ev.event_type,at:ev.created_at,by:ev.created_by}]});
   else if(prev){prev.history.push({event_type:ev.event_type,at:ev.created_at,by:ev.created_by});if(ev.event_type==='SCORE_VOIDED')prev.status='VOIDED_IN_FFO';if(ev.event_type==='SCORE_VERIFIED')prev.status='VERIFIED_IN_SLEEPER';}
  }
  return comJson({adjustments:[...map.values()].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,150),source:'FFO private commissioner D1 record; Sleeper has NOT been changed by this portal',truncated:events.length>=500});
 }
 if(parts[2]==='cases'&&parts.length===3&&method==='GET'){
  const rows=await env.COMMISSIONER_DB.prepare(comCaseListSql+' ORDER BY c.id DESC LIMIT 150').all();return comJson({cases:rows.results||[],identity:email});
 }
 if(parts[2]==='cases'&&parts.length===3&&method==='POST'){
  let d;try{d=await comJsonBody(req)}catch{return comJson({error:'INVALID_JSON'},400)}
  const league=comText(d.league,4),team=comText(d.team,100)||'League-wide',owner=comText(d.owner,100)||'Commissioner Office',violation=comText(d.violation,2500),consequence=comText(d.consequence,1500)||'Administrative record only; no consequence imposed.',occurred=comText(d.occurred_on,10),effective=comText(d.effective_on,10),category=comText(d.action_category,24).toUpperCase()||'GENERAL',rule=comText(category+(comText(d.rule_ref,100)?' / '+comText(d.rule_ref,100):''),100),week=Number(d.week||0)||null,year=Number(occurred.slice(0,4));
  if(!['FFL','DoF'].includes(league)||!team||!owner||violation.length<12||!consequence||!/^(20[2-9][0-9])-\d{2}-\d{2}$/.test(occurred)||Number.isNaN(Date.parse(occurred))||effective&&!/^20\d\d-\d\d-\d\d$/.test(effective)||week!==null&&(!Number.isInteger(week)||week<1||week>18))return comJson({error:'REQUIRED_FIELDS_INVALID'},400);
  const now=comIso();const write=await env.COMMISSIONER_DB.prepare('INSERT INTO commissioner_cases(league,year,week,team,owner,rule_ref,violation,consequence,occurred_on,effective_on,created_utc,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(league,year,week,team,owner,rule,violation,consequence,occurred,effective||null,now,email).run();
  const id=Number(write.meta?.last_row_id);if(!Number.isInteger(id)||id<1)throw Error('CASE_INSERT_NO_ID');const number=league+'-'+year+'-'+String(id).padStart(6,'0');
  await env.COMMISSIONER_DB.prepare('UPDATE commissioner_cases SET case_no=? WHERE id=? AND case_no IS NULL').bind(number,id).run();
  await env.COMMISSIONER_DB.prepare('INSERT INTO commissioner_events(case_id,event_type,note,created_by,created_utc) VALUES(?,?,?,?,?)').bind(id,'FILED','Draft case filed; no Sleeper action executed',email,now).run();
  return comJson({case:await comGetCase(env,id)},201);
 }
 const id=Number(parts[3]);if(parts[2]==='cases'&&Number.isInteger(id)&&id>0){
  const record=await comGetCase(env,id);if(!record)return comJson({error:'CASE_NOT_FOUND'},404);
  
   if(parts[4]==='score-adjustments'&&parts.length===5&&method==='POST'){
     let d;try{d=await comJsonBody(req)}catch{return comJson({error:'SCORE_REQUEST_INVALID'},400)}
     if(record.league!=='FFL')return comJson({error:'FFL_SCORE_LEDGER_ONLY_FOR_NOW'},409);
     const week=Number(d.week),roster=Number(d.roster_id),base=Number(d.original_points),delta=Number(d.delta_points),newTotal=comScoreRound(base+delta);
     const reason=comText(d.reason,1000),type=comText(d.adjustment_type,30).toUpperCase();
     if(!Number.isInteger(week)||week<1||week>18||(record.week!=null&&Number(record.week)!==week)||!Number.isInteger(roster)||roster<1||roster>32||
         !comScoreNumber(base)||!comScoreNumber(delta)||!comScoreNumber(newTotal)||Math.abs(delta)<.005||!['PENALTY','AWARD','CORRECTION'].includes(type)||(type==='PENALTY'&&delta>=0)||(type==='AWARD'&&delta<=0)||reason.length<12)
       return comJson({error:'SCORE_FIELDS_INVALID_OR_CASE_WEEK_MISMATCH'},400);
     const records=await env.COMMISSIONER_DB.prepare("SELECT event_type FROM commissioner_events WHERE case_id=? ORDER BY id ASC").bind(id).all();
     const actions=records.results||[];
     if(!actions.some(x=>x.event_type==='ISSUED')||actions.some(x=>x.event_type==='REVERSED'))return comJson({error:'CASE_MUST_BE_ISSUED_AND_NOT_REVERSED'},409);
     const previous=await comScoreEvents(env);
     const active=new Map();
     for(const ev of previous){if(ev.event_type==='SCORE_RECORDED')active.set(ev.adjustment_id,ev);else if(ev.event_type==='SCORE_VOIDED')active.delete(ev.adjustment_id)}
     if([...active.values()].some(ev=>ev.league==='FFL'&&Number(ev.year)===Number(record.year)&&Number(ev.week)===week&&Number(ev.roster_id)===roster))
      return comJson({error:'ACTIVE_ADJUSTMENT_EXISTS_FOR_THIS_ROSTER_AND_WEEK_VOID_OR_RECONCILE_FIRST'},409);
     const now=comIso(),item={schema:'FFO_COMMISSIONER_SCORE_V1',adjustment_id:crypto.randomUUID(),week,year:Number(record.year),roster_id:roster,original_points:base,delta_points:delta,new_total:newTotal,adjustment_type:type,reason,official_score_status:'NOT_SUBMITTED_TO_SLEEPER'};
     await env.COMMISSIONER_DB.prepare('INSERT INTO commissioner_events(case_id,event_type,note,created_by,created_utc) VALUES(?,?,?,?,?)').bind(id,'SCORE_RECORDED',JSON.stringify(item),email,now).run();
     return comJson({saved:true,adjustment:item,message:'Recorded in private FFO commissioner ledger only. No Sleeper scores changed.'},201);
   }
   if(parts[4]==='score-adjustments'&&parts.length===7&&method==='POST'){
     const uid=String(parts[5]||''),op=String(parts[6]||'');
     if(!/^[a-f0-9-]{36}$/.test(uid)||!['void','verify'].includes(op))return comJson({error:'INVALID_SCORE_EVENT'},400);
     const all=await comScoreEvents(env),matched=all.filter(x=>x.adjustment_id===uid&&Number(x.case_id)===id);
     const base=matched.find(x=>x.event_type==='SCORE_RECORDED');
     if(!base)return comJson({error:'ADJUSTMENT_NOT_FOUND'},404);
     if(matched.some(x=>x.event_type==='SCORE_VOIDED'))return comJson({error:'ALREADY_VOIDED_IN_FFO'},409);
     if(op==='void'){
       let body;try{body=await comJsonBody(req)}catch{return comJson({error:'REASON_REQUIRED'},400)}
       const reason=comText(body.reason,650);if(reason.length<8)return comJson({error:'REVERSAL_REASON_REQUIRED'},400);
       await env.COMMISSIONER_DB.prepare('INSERT INTO commissioner_events(case_id,event_type,note,created_by,created_utc) VALUES(?,?,?,?,?)').bind(id,'SCORE_VOIDED',JSON.stringify({schema:'FFO_COMMISSIONER_SCORE_V1',adjustment_id:uid,reason}),email,comIso()).run();
       return comJson({voided:true,message:'FFO ledger adjustment voided. A separate Sleeper change, if any, must be reversed in Sleeper.'});
     }
     if(matched.some(x=>x.event_type==='SCORE_VERIFIED'))return comJson({verified:true,already:true});
     const check=await comSleeperScoreVerify(env,base);
     if(!check.verified)return comJson(check,409);
     await env.COMMISSIONER_DB.prepare('INSERT INTO commissioner_events(case_id,event_type,note,created_by,created_utc) VALUES(?,?,?,?,?)').bind(id,'SCORE_VERIFIED',JSON.stringify({schema:'FFO_COMMISSIONER_SCORE_V1',adjustment_id:uid,verified_at:check.checked_at,official_custom_points:check.official_custom_points}),email,comIso()).run();
     return comJson({verified:true,source:check.source,observed_override:check.official_custom_points});
   }
if(parts.length===4&&method==='GET'){
   const events=await env.COMMISSIONER_DB.prepare('SELECT * FROM commissioner_events WHERE case_id=? ORDER BY id ASC').bind(id).all();
   const evidence=await env.COMMISSIONER_DB.prepare('SELECT id,case_id,original_name,mime,bytes,sha256,created_utc,created_by FROM commissioner_evidence WHERE case_id=? ORDER BY id DESC').bind(id).all();
   return comJson({case:record,events:events.results||[],evidence:evidence.results||[]});
  }
  if(parts[4]==='events'&&parts.length===5&&method==='POST'){
   let d;try{d=await comJsonBody(req)}catch{return comJson({error:'INVALID_JSON'},400)}
   const kind=comText(d.event_type,12).toUpperCase(),note=comText(d.note,2000);
   if(!['ISSUED','NOTIFIED','APPEALED','RESOLVED','REVERSED','NOTE'].includes(kind)||note.length<8)return comJson({error:'ACTION_OR_REASON_REQUIRED'},400);
   await env.COMMISSIONER_DB.prepare('INSERT INTO commissioner_events(case_id,event_type,note,created_by,created_utc) VALUES(?,?,?,?,?)').bind(id,kind,note,email,comIso()).run();return comJson({case:await comGetCase(env,id)},201);
  }
  if(parts[4]==='evidence'&&parts.length===5&&method==='POST'){
   const mime=req.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
   const name=(()=>{let raw=String(req.headers.get('x-ffo-filename')||'evidence');try{raw=decodeURIComponent(raw)}catch{}return comText(raw,115).replace(/[^\w.() -]/g,'_')})();
   const allowed=['image/png','image/jpeg','image/webp','image/heic','image/heif','application/pdf','video/mp4','video/quicktime','video/webm'];
   if(!allowed.includes(mime))return comJson({error:'FILE_TYPE_NOT_ALLOWED'},415);
   const maxBytes=mime.startsWith('video/')?75*1024*1024:8*1024*1024;
   const declared=Number(req.headers.get('content-length')||0);
   if(declared>maxBytes)return comJson({error:'FILE_TOO_LARGE'},413);
   if(!req.body&&mime.startsWith('video/'))return comJson({error:'EVIDENCE_BODY_REQUIRED'},400);
   // Real format signature verification. Headers and file extensions are not trusted.
   const validMagic=b=>{
    const text=(a,z)=>String.fromCharCode(...b.slice(a,z));
    return !!({
     'image/png':b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71,
     'image/jpeg':b[0]===255&&b[1]===216&&b[2]===255,
     'image/webp':text(0,4)==='RIFF'&&text(8,12)==='WEBP',
     'application/pdf':text(0,5)==='%PDF-',
     'image/heic':text(4,8)==='ftyp'&&/^(heic|heix|hevc|mif1|msf1)$/.test(text(8,12)),
     'image/heif':text(4,8)==='ftyp'&&/^(heic|heix|hevc|mif1|msf1)$/.test(text(8,12)),
     'video/mp4':text(4,8)==='ftyp',
     'video/quicktime':text(4,8)==='ftyp',
     'video/webm':b[0]===26&&b[1]===69&&b[2]===223&&b[3]===163
    })[mime];
   };
   const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
   const key='commissioner/'+record.case_no+'/'+crypto.randomUUID();
   let size=0,sha='';
   if(mime.startsWith('video/')&&declared>8*1024*1024){
    // Cloudflare Workers: streamed SHA-256 and fixed-length R2 upload, no 75MB ArrayBuffer.
    // Both browser and server cap at 75MiB. Length must be known for R2.put(stream).
    if(!req.body||typeof crypto.DigestStream!=='function'||typeof FixedLengthStream!=='function')
     return comJson({error:'LARGE_VIDEO_STREAMING_NOT_CONFIGURED'},503);
    const [peek,body]=req.body.tee();
    const reader=peek.getReader(),head=[];let got=0;
    try{
     while(got<16){
      const part=await reader.read();if(part.done)break;
      const piece=part.value;if(piece?.byteLength){head.push(piece.slice(0,Math.min(16-got,piece.byteLength)));got+=Math.min(16-got,piece.byteLength)}
     }
    }catch{return comJson({error:'EVIDENCE_STREAM_READ_FAILED'},400)}
    finally{void reader.cancel().catch(()=>{})}
    const signature=new Uint8Array(got);let offset=0;
    for(const chunk of head){signature.set(chunk,offset);offset+=chunk.byteLength}
    if(got<12||!validMagic(signature))return comJson({error:'FILE_CONTENT_INVALID'},415);
    const [forR2,forDigest]=body.tee();
    const fixed=new FixedLengthStream(declared),hashStream=new crypto.DigestStream('SHA-256');
    const tasks=[
     forR2.pipeTo(fixed.writable),
     forDigest.pipeTo(hashStream),
     env.COMMISSIONER_EVIDENCE.put(key,fixed.readable,{httpMetadata:{contentType:mime}})
    ];
    const finished=await Promise.allSettled(tasks);
    if(finished.some(x=>x.status==='rejected')||!finished[2].value){
     await env.COMMISSIONER_EVIDENCE.delete(key).catch(()=>{});
     return comJson({error:'EVIDENCE_STREAM_UPLOAD_FAILED'},503);
    }
    try{sha=hex(new Uint8Array(await hashStream.digest));size=declared}
    catch{await env.COMMISSIONER_EVIDENCE.delete(key).catch(()=>{});return comJson({error:'EVIDENCE_HASH_FAILED'},503)}
   }else{
    // Small images/PDFs and small video clips retain the previously verified path.
    // Unknown-length video bodies are refused rather than buffering potentially 75MiB.
    if(mime.startsWith('video/')&&declared===0)return comJson({error:'VIDEO_CONTENT_LENGTH_REQUIRED'},411);
    const buf=await req.arrayBuffer();
    if(buf.byteLength>maxBytes||buf.byteLength<12||declared&&declared!==buf.byteLength)return comJson({error:'FILE_SIZE_INVALID'},413);
    if(!validMagic(new Uint8Array(buf.slice(0,16))))return comJson({error:'FILE_CONTENT_INVALID'},415);
    size=buf.byteLength;sha=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',buf)));
    await env.COMMISSIONER_EVIDENCE.put(key,buf,{httpMetadata:{contentType:mime},customMetadata:{sha256:sha}});
   }
   try{
    await env.COMMISSIONER_DB.prepare('INSERT INTO commissioner_evidence(case_id,original_name,mime,bytes,sha256,object_key,created_utc,created_by) VALUES(?,?,?,?,?,?,?,?)').bind(id,name,mime,size,sha,key,comIso(),email).run();
   }catch(err){await env.COMMISSIONER_EVIDENCE.delete(key).catch(()=>{});return comJson({error:'EVIDENCE_METADATA_WRITE_FAILED'},503)}
   return comJson({saved:true,name,sha256:sha,bytes:size},201);
  }
  if(parts[4]==='evidence'&&parts.length===6&&method==='GET'){
   const evid=await env.COMMISSIONER_DB.prepare('SELECT * FROM commissioner_evidence WHERE case_id=? AND id=?').bind(id,Number(parts[5])).first();if(!evid)return comJson({error:'EVIDENCE_NOT_FOUND'},404);
   const object=await env.COMMISSIONER_EVIDENCE.get(evid.object_key);if(!object)return comJson({error:'EVIDENCE_OBJECT_MISSING'},404);
   return new Response(object.body,{status:200,headers:{'content-type':evid.mime,'content-disposition':'attachment; filename="'+evid.original_name.replace(/["\\]/g,'')+'"','cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'",'x-ffo-case':record.case_no}});
  }
 }
 return comJson({error:'UNKNOWN_COMMISSIONER_ENDPOINT'},404);
}

// Dirty Birds 2.4 — source-safe same-origin injury endpoints.
// ESPN is third-party; NFL source is official but fetch/parse must succeed before certification.
const ESPN='https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries';
const NFL='https://www.nfl.com/injuries/';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const result=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
async function get(url){const r=await fetch(url,{headers:{accept:'text/html, application/json'},cf:{cacheTtl:60,cacheEverything:true}});if(!r.ok)throw Error('source HTTP '+r.status);return r;}
function flatten(payload){const out=[];for(const group of (Array.isArray(payload.injuries)?payload.injuries:[])){for(const row of (Array.isArray(group.injuries)?group.injuries:[group])){const a=row.athlete||row.player||{};const name=a.fullName||a.displayName||row.name;if(!name)continue;const s=row.status;out.push({name:String(name),team:String(group.team?.abbreviation||''),status:String(typeof s==='object'?(s.description||s.name||'Listed'):(s||'Listed')),detail:String(typeof (row.details||row.detail)==='object'?((row.details||row.detail).detail||(row.details||row.detail).description||(row.details||row.detail).type||''):(row.details||row.detail||'')).slice(0,300),date:String(row.date||row.updated||'')});}}return out;}
// Parse visible NFL.com table rows only. Conservative: never infer clearance from absence.
function decode(s){return s.replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&[a-z]+;/g,' ')}
function strip(s){return decode(s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim())}
function nflRows(html){const rows=[];for(const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>strip(x[1]));if(cells.length<5)continue;const [name,position,injury,practice,game]=cells;if(!name||name.toLowerCase()==='player'||name.length>100||!/^(QB|RB|WR|TE|K|P|DL|DE|DT|LB|CB|S|OL|C|G|T|FB|LS|DB|OT|OG)$/i.test(position))continue;rows.push({name,position,injury,practice_status:practice,game_status:game,source_url:NFL});}return rows;}

const TX_BASE='https://www.nfl.com/transactions/league/';
const CATEGORIES=['reserve-list','signings','other'];
function cleanName(v){return v.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+(?:Jr\.?|Sr\.?|II|III|IV)$/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase();}
function parseTransactions(html, sourceUrl, category, year, month){
 const rows=[];
 for(const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>strip(x[1]));
  if(cells.length<6)continue;
  const date=cells[2],name=cells[3],action=cells[5];
  const match=/^(\d{1,2})\/(\d{1,2})$/.exec(date||'');
  if(!match||!name||!action||name.toLowerCase()==='name')continue;
  if(Number(match[1])!==month||Number(match[2])<1||Number(match[2])>31)continue;
  const iso=`${year}-${String(month).padStart(2,'0')}-${match[2].padStart(2,'0')}`;
  rows.push({name,date:iso,action,category,from:cells[0],to:cells[1],source_url:sourceUrl});
 }
 return rows;
}
function classifyAction(action,category){
 const a=action.toLowerCase();
 if(/(?:reserve\/injured|injured\s+reserve|reserve-injured)/.test(a)){
  if(/(?:activat|reinstat|returned?\s+to\s+(?:the\s+)?active|removed?\s+from)/.test(a))return 'ACTIVATED_FROM_IR';
  if(/(?:designated\s+to\s+return|return\s+designation)/.test(a))return 'DESIGNATED_TO_RETURN';
  if(category==='reserve-list'||/(?:placed|added|transferred|moved)\s+(?:to|on|onto)/.test(a))return 'PLACED_ON_IR';
 }
 if(/(?:activat|reinstat)/.test(a)&&/(?:\bir\b|injur)/.test(a))return 'ACTIVATED_FROM_IR';
 return 'OTHER_TRANSACTION';
}
function nextPageUrl(html,current){
 for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  if(!/next\s*page/i.test(strip(m[2])) && !/aria-label\s*=\s*["']next/i.test(m[1]))continue;
  const h= m[1].match(/href\s*=\s*["']([^"']+)["']/i);
  if(!h)continue;
  try{const u=new URL(decode(h[1]),current); if(u.hostname==='www.nfl.com' && u.pathname.startsWith('/transactions/league/'))return u.toString();}catch{}
 }
 return null;
}
async function scanCategory(cfg,pageLimit){
 const rows=[],seen=new Set(),seenRows=new Set();let url=cfg.url, pages=0, error=null;
 while(url && pages<pageLimit){
  if(seen.has(url)){error='PAGINATION_LOOP';break;}
  seen.add(url);
  try{
   const body=await (await get(url)).text();pages++;
   const pageRows=parseTransactions(body,url,cfg.category,cfg.year,cfg.month);
   if(!pageRows.length){error='UNPARSEABLE_PAGE';break;}
   for(const record of pageRows){const key=[record.name,record.date,record.action,record.category].join('|'); if(!seenRows.has(key)){seenRows.add(key);rows.push(record);}}
   const next=nextPageUrl(body,url);
   if(next && seen.has(next)){error='REPEATED_NEXT_CURSOR';url=next;break;}
   url=next;
  }catch(e){error=String(e.message||e);break;}
 }
 return {rows,pages,next_page:url,error,complete:!url&&!error};
}
async function findTransactions(names){
 const now=new Date();const year=now.getUTCFullYear(),month=now.getUTCMonth()+1;
 const previous=new Date(Date.UTC(year,month-2,1));
 const months=[[year,month],[previous.getUTCFullYear(),previous.getUTCMonth()+1]];
 // 40 source requests maximum, with a hard per-category bound to avoid Worker subrequest exhaustion.
 // Reserve List is prioritized because it records explicit IR placements.
 const cfgs=months.flatMap(([y,m])=>CATEGORIES.map(category=>({category,year:y,month:m,url:`${TX_BASE}${category}/${y}/${m}`})));
 const coverage=[],records=[];
 for(const cfg of cfgs){
  const limit=cfg.category==='other'?2:8;
  const scan=await scanCategory(cfg,limit);
  coverage.push({category:cfg.category,month:`${cfg.year}-${String(cfg.month).padStart(2,'0')}`,status:scan.error?'PARTIAL_OR_ERROR':'PARSED',rows:scan.rows.length,pages_scanned:scan.pages,coverage_complete:scan.complete,next_page:scan.next_page,error:scan.error,source_url:cfg.url});
  records.push(...scan.rows);
 }
 const matches=[];
 for(const name of names){
  const matched=records.filter(r=>cleanName(r.name)===cleanName(name)).sort((a,b)=>b.date.localeCompare(a.date));
  for(const row of matched)matches.push({...row,action_code:classifyAction(row.action,row.category),requested_name:name});
 }
 const confirmed=matches.filter(x=>x.action_code==='ACTIVATED_FROM_IR'||x.action_code==='PLACED_ON_IR'||x.action_code==='DESIGNATED_TO_RETURN');
 const incomplete=coverage.some(x=>!x.coverage_complete);
 const players=names.map(name=>{const history=matches.filter(x=>x.requested_name===name&&x.action_code!=='OTHER_TRANSACTION'); const latest=history[0]||null;return {name,latest_dated_action:latest,dated_action_found:!!latest,current_status:'UNVERIFIED',reason:latest ? (incomplete?'Incomplete transaction history prevents current-status determination.':'A dated transaction does not alone establish current NFL status without complete relevant subsequent history.') : 'No dated IR event found in searched history; absence does not establish active status.'};});
 return {matches,verified_count:confirmed.length,dated_evidence_found:confirmed.length>0,players,coverage,coverage_complete:!incomplete,records_scanned:records.length};
}


// Dirty Birds 3.2: read-only live roster. Player catalog is cached at Cloudflare;
// do not derive NFL roster state from an injury tag.
const SLEEPER_API='https://api.sleeper.app/v1';
async function sleeperJSON(path,ttl=30){const r=await fetch(SLEEPER_API+path,{headers:{accept:'application/json'},cf:{cacheEverything:true,cacheTtl:ttl}});if(!r.ok)throw Error('Sleeper '+r.status);return r.json()}
async function liveRoster(id,rid){
 const [rosters,catalog,league]=await Promise.all([sleeperJSON('/league/'+id+'/rosters',30),sleeperJSON('/players/nfl',3600),sleeperJSON('/league/'+id,180)]);
 const entry=rosters.find(r=>Number(r.roster_id)===Number(rid));if(!entry)throw Error('Roster ID not found');
 const ids=[...new Set([...(entry.players||[]),...(entry.starters||[]),...(entry.reserve||[])].filter(pid=>pid&&pid!=='0'))];
 const players=ids.map(pid=>{const p=catalog[pid]||{};const display=p.full_name||([p.first_name,p.last_name].filter(Boolean).join(' '))||p.search_full_name||null;return {player_id:pid,name:display||((p.position==='DEF'||String(pid).startsWith('DEF'))?String(p.team||pid)+' D/ST':String(pid)),team:p.team||null,position:p.position||null,sleeper_injury_status:p.injury_status||null}});
 const starters=(entry.starters||[]).map(String);
 const reserves=(entry.reserve||[]).map(String);
 const startingSlots=(league.roster_positions||[]).filter(slot=>!['BN','IR','TAXI','RESERVE'].includes(slot));
 return {source:'SLEEPER LIVE ROSTER',checked_at:new Date().toISOString(),roster_id:entry.roster_id,league_id:id,players,players_count:players.length,starters,starting_slots:startingSlots,reserve:reserves,roster_player_ids:(entry.players||[]).map(String),warning:'Actual lineup is the current Sleeper submitted starters; a model recommendation never submits a transaction.'};
}

// 4.7: public ESPN scoreboards are game context, never scheme/defense-vs-position proof.
async function weekContext(season,week){
 const endpoint=`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=2&week=${week}&limit=100`;
 const response=await fetch(endpoint,{headers:{accept:'application/json'},cf:{cacheEverything:true,cacheTtl:25}});
 if(!response.ok)throw Error('ESPN week schedule HTTP '+response.status);
 const payload=await response.json();if(!Array.isArray(payload.events))throw Error('ESPN schedule response unparseable');
 const games=[];
 for(const event of payload.events){
  const comp=Array.isArray(event.competitions)?event.competitions[0]:null;
  const clubs=Array.isArray(comp?.competitors)?comp.competitors:[];
  const home=clubs.find(t=>t.homeAway==='home')?.team?.abbreviation,away=clubs.find(t=>t.homeAway==='away')?.team?.abbreviation;
  if(!home||!away)continue;
  const v=Number(comp?.odds?.[0]?.overUnder);
  const weather=comp?.weather||event.weather||null;
  const description=typeof weather?.displayValue==='string'?weather.displayValue:null;
  games.push({id:String(event.id||''),home:String(home),away:String(away),date:event.date||null,
   status:String(event.status?.type?.shortDetail||event.status?.type?.description||'Unknown'),
   state:String(event.status?.type?.state||'unknown'),period:Number(event.status?.period)||null,
   clock:String(event.status?.displayClock||''),
   home_score:clubs.find(t=>t.homeAway==='home')?.score!=null?Number(clubs.find(t=>t.homeAway==='home').score):null,
   away_score:clubs.find(t=>t.homeAway==='away')?.score!=null?Number(clubs.find(t=>t.homeAway==='away').score):null,
   last_play:typeof comp?.situation?.lastPlay?.text==='string'?comp.situation.lastPlay.text.slice(0,280):null,
   total:Number.isFinite(v)&&v>20&&v<100?v:null,weather:description&&description.length<180?description:null});
 }
 if(games.length<1)throw Error('ESPN provided no identifiable matchup records for requested week');
 return {source:'ESPN PUBLIC NFL SCOREBOARD',source_url:'https://www.espn.com/nfl/scoreboard',checked_at:new Date().toISOString(),season,week,games,
  limitations:['Schedule context only; no defensively adjusted fantasy recommendation.','Weather and betting lines may be missing, pregame or outdated.','Game-specific opponent defensive fronts and coverage are not available from this endpoint.']};
}


// 4.9 optional source-backed player detail endpoints. No user data, tokens or transactions.
function csvTable(csv){const lines=[];let field='',row=[],quoted=false;
 for(let i=0;i<csv.length;i++){const c=csv[i];if(c==='"'){if(quoted&&csv[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(field);field='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&csv[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>x!==''))lines.push(row);row=[];}
  else field+=c;
 }if(field||row.length){row.push(field);lines.push(row);}return lines;}
function normal49(s){return String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
function team49(s){return ({JAC:'JAX',WSH:'WAS',LA:'LAR',STL:'LAR',SD:'LAC',OAK:'LV'})[String(s||'').toUpperCase()]||String(s||'').toUpperCase();}
async function targetShare49(name,team,season){
 const url=`https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season}.csv`;
 const response=await fetch(url,{headers:{accept:'text/csv'},cf:{cacheEverything:true,cacheTtl:900}});
 if(!response.ok)throw Error('Weekly nflverse stats HTTP '+response.status);
 const csv=await response.text();if(csv.length>15_000_000)throw Error('Weekly stats response unexpectedly large');
 const rows=csvTable(csv);if(rows.length<100)throw Error('Weekly stat rows incomplete');
 const heads=rows.shift().map(x=>x.trim());const ix=x=>heads.indexOf(x);
 const idName=ix('player_display_name')>=0?ix('player_display_name'):ix('player_name');
 const idTeam=ix('team'),idWeek=ix('week'),idTargets=ix('targets'),idYear=ix('season');
 if([idName,idTeam,idWeek,idTargets].some(v=>v<0))throw Error('Published target metrics not present; share withheld');
 const t=team49(team),nm=normal49(name),perWeek=new Map();
 for(const row of rows){if(team49(row[idTeam])!==t||Number(row[idYear])!==season)continue;const w=Number(row[idWeek]),count=Number(row[idTargets]);if(!Number.isInteger(w)||w<1||w>18||!Number.isFinite(count)||count<0)continue;
  const agg=perWeek.get(w)||{week:w,team_targets:0,player_targets:0,player_matches:0};agg.team_targets+=count;
  if(normal49(row[idName])===nm){agg.player_targets+=count;agg.player_matches++;}
  perWeek.set(w,agg);
 }
 const weeks=[...perWeek.values()].filter(x=>x.player_matches===1&&x.team_targets>0).sort((a,b)=>a.week-b.week);
 if(!weeks.length)return {source:'nflverse weekly 2026 player stats',source_url:url,status:'unavailable',reason:'No unique player/team match across reported games; no target share calculated',weeks:[]};
 const sum=(arr,key)=>arr.reduce((a,r)=>a+r[key],0);
 const share=arr=>{const d=sum(arr,'team_targets');return d>0?Number((100*sum(arr,'player_targets')/d).toFixed(1)):null;};
 return {source:'nflverse 2026 stats_player weekly file (source CSV)',source_url:url,status:'observed',checked_at:new Date().toISOString(),player:name,team:t,season,games_observed:weeks.length,targets_observed:sum(weeks,'player_targets'),team_targets_same_weeks:sum(weeks,'team_targets'),season_target_share_pct:share(weeks),recent_three_target_share_pct:share(weeks.slice(-3)),weeks:weeks.map(z=>({week:z.week,targets:z.player_targets,team_targets:z.team_targets,share_pct:Number((100*z.player_targets/z.team_targets).toFixed(1))})),limitations:['Shares use summed nflverse player targets for the same team and weeks, not pass-play participation or first-read share.','Player/team identity must have one unambiguous match per reported week.','Source statistics can lag completed and in-progress games.','Injuries, play-calling and future targets are not inferred from historical share.']};
}
function rssText49(s){return String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
async function playerNews49(name){
 const query=`"${name}" NFL injury coach practice when:7d`;
 const url='https://news.google.com/rss/search?q='+encodeURIComponent(query)+'&hl=en-US&gl=US&ceid=US:en';
 const r=await fetch(url,{headers:{accept:'application/rss+xml, application/xml'},cf:{cacheEverything:true,cacheTtl:900}});
 if(!r.ok)throw Error('News RSS HTTP '+r.status);
 const xml=await r.text();if(!/<rss[\s>]/.test(xml))throw Error('No usable news RSS source');
 const read=(block,tag)=>rssText49(block.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'))?.[1]||'');
 const posts=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,12).map(m=>{
 const block=m[1];const title=read(block,'title'),link=read(block,'link'),publisher=read(block,'source'),pubDate=read(block,'pubDate');
 return {title:title.slice(0,230),url:/^https:\/\//i.test(link)?link:null,publisher:publisher.slice(0,90),published:pubDate?new Date(pubDate).toISOString():null,verification:'HEADLINE_ONLY_NOT_FACT_CHECKED'};
 }).filter(x=>x.title&&x.url);
 return {source:'Google News RSS player headline search',scope:'Search leads only, no article text or verified coach quotes',checked_at:new Date().toISOString(),player:name,news:posts};
}

// 5.0: independent NFL evidence, not Sleeper projections. Public NFLverse data;
// source license: https://github.com/nflverse/nflverse-data (CC BY 4.0 for applicable datasets).
const FFO50_STATS_FIELDS={
  pass_att:'attempts',pass_cmp:'completions',pass_yd:'passing_yards',pass_td:'passing_tds',pass_int:'passing_interceptions',
  rush_att:'carries',rush_yd:'rushing_yards',rush_td:'rushing_tds',
  rec:'receptions',rec_yd:'receiving_yards',rec_td:'receiving_tds',targets:'targets',
  pass_2pt:'passing_2pt_conversions',rush_2pt:'rushing_2pt_conversions',rec_2pt:'receiving_2pt_conversions'
};
const FFO50_STATS_URL=season=>`https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season}.csv`;
async function ffo50CSV(url, max=18_000_000){const r=await fetch(url,{headers:{accept:'text/csv'},cf:{cacheEverything:true,cacheTtl:1800}});if(!r.ok)throw Error('Public data source HTTP '+r.status);const s=await r.text();if(s.length>max||s.length<1000)throw Error('Published CSV size outside expected range');return csvTable(s);}
function ffo50Number(v){if(v==null||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
async function ffo50Stats(season){
 const url=FFO50_STATS_URL(season),rows=await ffo50CSV(url);const heads=rows.shift().map(s=>s.trim());const ix=x=>heads.indexOf(x);
 const opponentIx=ix('opponent_team'); const wk=ix('week'),tm=ix('team'),pos=ix('position'),nm=ix('player_display_name')>=0?ix('player_display_name'):ix('player_name'),yr=ix('season');
 if([wk,tm,nm].some(i=>i<0))throw Error('nflverse weekly player-stat schema changed');
 const fields=Object.entries(FFO50_STATS_FIELDS).map(([out,input])=>[out,ix(input)]);
 const players=new Map(),teamTargets=new Map();let checked=0;
 for(const row of rows){if(yr>=0&&Number(row[yr])!==season)continue;const week=Number(row[wk]);if(!Number.isInteger(week)||week<1||week>18)continue;const name=String(row[nm]||'').trim(),team=team49(row[tm]),position=String(row[pos]||'');if(!name||!team)continue;
  const stats={};for(const [key,i] of fields){if(i<0)continue;const v=ffo50Number(row[i]);if(v!=null)stats[key]=v;}
  // Incompletions derived only if BOTH completions and attempts were published.
  if(stats.pass_cmp!=null&&stats.pass_att!=null)stats.pass_inc=Math.max(0,stats.pass_att-stats.pass_cmp);
  const key=normal49(name)+'|'+team;let x=players.get(key);if(!x){x={name,team,position,games:[]};players.set(key,x)}
  x.games.push({week,opponent:opponentIx>=0?team49(row[opponentIx]):null,stats});checked++;
  if(stats.targets!=null){const k=team+'|'+week;teamTargets.set(k,(teamTargets.get(k)||0)+stats.targets);}
 }
 for(const x of players.values()){
  x.games.sort((a,b)=>a.week-b.week);const total=x.games.length;
  for(const g of x.games){const n=teamTargets.get(x.team+'|'+g.week);g.target_share_pct=(n>0&&g.stats.targets!=null)?Math.round(g.stats.targets/n*1000)/10:null;}
  const seasonTotal=k=>x.games.reduce((n,g)=>n+(g.stats[k]||0),0);
   // Full season totals survive transport that trims the per-game history to recent weeks.
   // Missing stat categories remain absent, not fabricated zeroes.
   x.season_totals=Object.fromEntries(Object.keys(FFO50_STATS_FIELDS)
      .filter(k=>x.games.some(g=>g.stats[k]!==undefined))
      .map(k=>[k,Math.round(seasonTotal(k)*100)/100]));
  const last=x.games.at(-1),last3=x.games.slice(-3),avg=(gs,k)=>gs.reduce((n,g)=>n+(g.stats[k]||0),0)/gs.length;
  // Low-complexity explainable statistical baseline; not externally published expert forecasts.
  const forecast={};if(total>=2)for(const key of Object.keys(FFO50_STATS_FIELDS)){
   if(!x.games.some(g=>g.stats[key]!=null))continue;
   forecast[key]=Math.round((.65*avg(last3,key)+.35*seasonTotal(key)/total)*100)/100;
  }
  if(forecast.pass_att!=null&&forecast.pass_cmp!=null)forecast.pass_inc=Math.max(0,forecast.pass_att-forecast.pass_cmp);
  x.latest=last?{week:last.week,...last.stats,target_share_pct:last.target_share_pct}:null;
  x.last_three=last3;
  x.forecast=total>=2?forecast:null;
  x.games_observed=total;
  x.targets_per_game=seasonTotal('targets')/total;
  x.receptions_per_game=seasonTotal('rec')/total;
  x.carries_per_game=seasonTotal('rush_att')/total;
  x.pass_att_per_game=seasonTotal('pass_att')/total;
 }
 return {source:'nflverse 2026 weekly NFL player statistics',source_url:url,checked_at:new Date().toISOString(),source_rows:checked,players:[...players.values()]};
}
async function ffo50Schedule(season){
 const url='https://github.com/nflverse/nfldata/raw/refs/heads/master/data/games.csv';
 const alternative='https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv';
 let rows,source=alternative;try{rows=await ffo50CSV(alternative,9_000_000);}catch(err){rows=await ffo50CSV(url,9_000_000);source=url;}
 const heads=rows.shift().map(x=>x.trim()),ix=k=>heads.indexOf(k);const wi=ix('week'),si=ix('season'),hi=ix('home_team'),ai=ix('away_team'),gi=ix('game_type');
 if([wi,si,hi,ai].some(n=>n<0))throw Error('Schedule source schema incomplete');
 const teams={},weeks=new Set();let count=0;
 for(const r of rows){if(Number(r[si])!==season||gi>=0&&!/^(REG|regular)$/i.test(r[gi]))continue;const w=Number(r[wi]),home=team49(r[hi]),away=team49(r[ai]);if(!Number.isInteger(w)||w<1||w>18||!home||!away)continue;
  (teams[home]??={weeks:{}}).weeks[w]={opponent:away,home:true};(teams[away]??={weeks:{}}).weeks[w]={opponent:home,home:false};weeks.add(w);count++;
 }
 const valid=weeks.size===18&&count>=260&&Object.values(teams).length>=32&&Object.values(teams).every(t=>Object.keys(t.weeks).length===17);
 return {season,source_url:source,checked_at:new Date().toISOString(),games:count,weeks_covered:weeks.size,teams,complete:valid};
}



/* PFO 5.9.8: licensed MSF season totals -> compact source-attributed player data.
   Unknown categories are withheld rather than assumed to be zero. */
function ffo598NormalizeSeason(payload,checkedAt){
 const rows=payload?.playerStatsTotals;
 if(!Array.isArray(rows))throw Error('MSF_SEASON_SCHEMA_UNRECOGNIZED');
 const fields={
 pass_yd:['passing.passYards','passing.passingYards','passing.yards','passYards'],
 pass_td:['passing.passTD','passing.passTouchdowns','passing.passTds','passTD'],
 pass_int:['passing.passInt','passing.interceptions','passInt'],
 pass_cmp:['passing.passCompletions','passing.completions','passCompletions'],
 pass_att:['passing.passAttempts','passing.attempts','passAttempts'],
 rush_yd:['rushing.rushYards','rushing.yards','rushYards'],
 rush_td:['rushing.rushTD','rushing.rushTouchdowns','rushTD'],
 rush_att:['rushing.rushAttempts','rushing.attempts','rushAttempts'],
 rec:['receiving.receptions','receiving.rec','receptions'],
 rec_yd:['receiving.recYards','receiving.receivingYards','recYards'],
 rec_td:['receiving.recTD','receiving.recTouchdowns','recTD'],
 targets:['receiving.targets','receiving.recTargets','targets'],
 fum_lost:['fumbles.fumblesLost','fumbles.lost','fumblesLost'],
 fum:['fumbles.fumbles','fumbles.total'],
 rush_2pt:['rushing.rushTwoPt','rushing.twoPointConversions'],
 rec_2pt:['receiving.recTwoPt','receiving.twoPointConversions'],
 pass_2pt:['passing.passTwoPt','passing.twoPointConversions'],
 fgm_0_19:['fieldGoals.fieldGoalsMade0To19','kicking.fieldGoalsMade0To19'],
 fgm_20_29:['fieldGoals.fieldGoalsMade20To29','kicking.fieldGoalsMade20To29'],
 fgm_30_39:['fieldGoals.fieldGoalsMade30To39','kicking.fieldGoalsMade30To39'],
 fgm_40_49:['fieldGoals.fieldGoalsMade40To49','kicking.fieldGoalsMade40To49'],
 fgm_50_59:['fieldGoals.fieldGoalsMade50To59','kicking.fieldGoalsMade50To59'],
 fgm_60p:['fieldGoals.fieldGoalsMade60Plus','kicking.fieldGoalsMade60Plus'],
 xpm:['extraPoints.extraPointsMade','extraPoints.made','kicking.extraPointsMade'],
 xpmiss:['extraPoints.extraPointsMissed','extraPoints.missed','kicking.extraPointsMissed'],
 fgmiss:['fieldGoals.fieldGoalsMissed','fieldGoals.missed','kicking.fieldGoalsMissed'],
 sack:['defense.sacks','defensive.sacks','defense.sacksMade'],
 int:['defense.interceptions','defensive.interceptions'],
 ff:['defense.forcedFumbles','defensive.forcedFumbles'],
 fum_rec:['defense.fumbleRecoveries','defensive.fumbleRecoveries'],
 safe:['defense.safeties','defensive.safeties'],
 blk_kick:['defense.blockedKicks','defensive.blockedKicks']
 };
 const get=(o,path)=>path.split('.').reduce((x,k)=>x?.[k],o);
 const number=x=>x===null||x===undefined||x===''||typeof x==='object'?null:Number.isFinite(Number(x))?Number(x):null;
 const players=[];
 for(const item of rows){
  const p=item?.player||item?.playerInfo||{},raw=item?.stats||item?.playerStats||{};
  const team=item?.team?.abbreviation||item?.teamInfo?.abbreviation||p?.currentTeam?.abbreviation||item?.teamAbbreviation||'';
  const name=String(p.fullName||p.displayName||[p.firstName,p.lastName].filter(Boolean).join(' ')||item.name||'').trim();
  if(!name||!team)continue;
  const gp=number(raw.gamesPlayed??item.gamesPlayed??raw.games);
  const games=gp!==null&&Number.isInteger(gp)&&gp>=0&&gp<=18?gp:null;
  const totals={};
  for(const [key,aliases] of Object.entries(fields)){
   for(const a of aliases){const n=number(get(raw,a));if(n!==null){totals[key]=n;break}}
  }
  if(games!==null)totals.games_played=games;
  const hasStats=Object.keys(totals).some(k=>k!=='games_played');
  const forecast=games>0&&hasStats?Object.fromEntries(Object.entries(totals).filter(([k])=>k!=='games_played').map(([k,v])=>[k,v/games])):null;
  players.push({msf_id:p.id??item.playerId??null,name,team:String(team).toUpperCase(),
   position:String(p.primaryPosition||p.position||item.position||'').toUpperCase(),
   season_totals:totals,games_observed:games,games_played:games,latest:null,games:[],forecast,
   coverage:forecast?'season_per_game_partial':'season_or_games_played_unavailable'});
 }
 if(!players.length)throw Error('MSF_NO_IDENTIFIABLE_PLAYER_ROWS');
 return {schema:'FFO_MSF_SEASON_V1',source:'MySportsFeeds',source_type:'licensed_primary',checked_at:checkedAt,
  provider_updated_at:payload.lastUpdatedOn||null,history_available:false,
  projection_method:'MSF-reported season totals divided by sourced games played (no last-three trends)',
  players_count:players.length,players};
}
let ffo598SeasonCache=null,ffo598SeasonPending=null;
async function ffo598SeasonRoute(req,env){
 if(req.method!=='GET')return ffoReply({error:'method_not_allowed'},405);
 try{await comIdentity(req,env)}catch{return ffoReply({error:'access_required_or_forbidden'},403)}
 const now=Date.now();
 if(ffo598SeasonCache&&now-ffo598SeasonCache.at<90000)return ffoReply(ffo598SeasonCache.data);
 if(ffo598SeasonPending)return ffoReply(await ffo598SeasonPending);
 ffo598SeasonPending=(async()=>{
  // Season statistics must be available independently of the GameCast enable
  // switch; this remains protected by the same verified Cloudflare Access identity.
  if(!env.MSF_API_KEY&&!env.GAMECAST_INTERNAL)return {source:'MySportsFeeds',available:false,error:'licensed_provider_not_configured',checked_at:new Date().toISOString()};
  const endpoint=MSF_ROOT+'/2026-regular/player_stats_totals.json';
  let upstream;
  try{
   // Prefer direct licensed MSF credentials when configured; do not route
   // raw external URLs through a Pages/Workers service binding unnecessarily.
   upstream=env.MSF_API_KEY
    ?await fetch(endpoint,{method:'GET',headers:{authorization:'Basic '+btoa(env.MSF_API_KEY+':MYSPORTSFEEDS'),accept:'application/json'},signal:AbortSignal.timeout(12000)})
    :await env.GAMECAST_INTERNAL.fetch(new Request(endpoint,{method:'GET'}));
  }catch{return {source:'MySportsFeeds',available:false,error:'licensed_provider_unreachable',checked_at:new Date().toISOString()}}
  const checked_at=new Date().toISOString();
  if(!upstream.ok||upstream.status===204||upstream.status===304)return {source:'MySportsFeeds',available:false,
   error:upstream.status===401||upstream.status===403?'provider_auth_or_entitlement_denied':
    upstream.status===204||upstream.status===304?'feed_not_ready_or_not_modified':'provider_http_error',
   provider_http_status:upstream.status,checked_at};
  try{
   const size=Number(upstream.headers.get('content-length')||0);
   if(size>6500000)throw Error('MSF_SEASON_PAYLOAD_TOO_LARGE');
   const raw=await upstream.text();
   if(raw.length>6500000)throw Error('MSF_SEASON_PAYLOAD_TOO_LARGE');
   const json=JSON.parse(raw);
   // A bound internal gateway may return {available, data, provider_http_status}
   // whereas the direct MSF route returns playerStatsTotals at the root.
   // Never call a success/failure envelope a verified season feed.
   if(json?.available===false||json?.error)throw Error('MSF_GATEWAY_'+String(json.error||json.reason||'UNAVAILABLE').slice(0,50).replace(/[^A-Z0-9_-]/gi,'_'));
   const payload=Array.isArray(json?.playerStatsTotals)?json:json?.data;
   if(!Array.isArray(payload?.playerStatsTotals))throw Error('MSF_SEASON_SCHEMA_UNRECOGNIZED');
   const data=ffo598NormalizeSeason(payload,checked_at);
   data.provider_http_status=Number.isInteger(json?.provider_http_status)?json.provider_http_status:upstream.status;
   data.cross_reference_status='not_yet_checked';
   ffo598SeasonCache={data,at:Date.now()};return data;
  }catch(err){return {source:'MySportsFeeds',available:false,error:String(err.message||err),provider_http_status:upstream.status,checked_at}}
 })();
 try{return ffoReply(await ffo598SeasonPending)}finally{ffo598SeasonPending=null}
}

export default {async fetch(request,env){const url=new URL(request.url);if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);if(url.pathname==='/api/ffo/stats/season')return ffo598SeasonRoute(request,env);if(url.pathname.startsWith('/api/ffo/gamecast/'))return ffoGamecastHandle(request,env,{verifyAccess:comIdentity,transport:env.GAMECAST_INTERNAL ? (upstream,options)=>env.GAMECAST_INTERNAL.fetch(new Request(upstream,{method:'GET'})) : fetch});if(url.pathname.startsWith('/api/commissioner/')){try{return await commissionerApi(request,env)}catch(err){return comJson({error:'COMMISSIONER_SERVICE_ERROR',message:'Private case system unavailable; no operation confirmed.'},503)}}if(request.method!=='GET')return result({error:'method not allowed'},405);try{
 if(url.pathname==='/api/gameday-news'){
  // ESPN news metadata are leads, not proof that a headline is true or a coach quote was verified.
  const names=(url.searchParams.get('names')||'').split(',').map(x=>x.trim()).filter(x=>/^[a-z .'-]{3,65}$/i.test(x)).slice(0,35);
  if(!names.length)return result({error:'Valid roster names required'},400);
  const endpoint='https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=75';
  const response=await fetch(endpoint,{headers:{accept:'application/json'},cf:{cacheEverything:true,cacheTtl:240}});
  if(!response.ok)throw Error('ESPN NFL news HTTP '+response.status);
  const payload=await response.json();
  if(!Array.isArray(payload.articles))throw Error('News source schema missing articles');
  const safeName=x=>String(x).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const matched=[];
  for(const a of payload.articles){
   const title=String(a.headline||a.title||'').slice(0,220),description=String(a.description||'').slice(0,300),content=safeName(title+' '+description);
   const players=names.filter(n=>content.includes(safeName(n)));
   if(!players.length)continue;
   const u=String(a.links?.web?.href||a.link||'');
   let safeUrl;try{const v=new URL(u);if(v.protocol!=='https:'||!/(^|\.)espn\.com$/.test(v.hostname))continue;safeUrl=v.toString();}catch{continue;}
   const stamp=String(a.published||a.lastModified||'');
   matched.push({title,players,published_at:/^\d{4}-\d{2}-\d{2}/.test(stamp)?stamp:null,url:safeUrl,publisher:'ESPN',verification:'NEWS_HEADLINE_LEAD_NOT_VERIFIED_REPORT'});
  }
  matched.sort((a,b)=>String(b.published_at||'').localeCompare(String(a.published_at||'')));
  return result({source:'ESPN NFL NEWS HEADLINES',source_url:'https://www.espn.com/nfl/',checked_at:new Date().toISOString(),coverage:'latest 75 source articles, matched by roster name',items:matched.slice(0,15),verification:'Headline matches are leads. Article claims and coach quotes require reading the original source. No match does not establish no news.'});
 }
 if(url.pathname==='/api/independent-stats'){
  const season=Number(url.searchParams.get('season'));if(!Number.isInteger(season)||season<2020||season>2035)return result({error:'Valid season required'},400);
  const full=await ffo50Stats(season);const name=url.searchParams.get('name');const team=url.searchParams.get('team');
  if(name){if(!/^[a-z .'-]{3,70}$/i.test(name)||team&&!/^[A-Z]{2,4}$/i.test(team))return result({error:'Valid player name/team required'},400);
   full.players=full.players.filter(x=>normal49(x.name)===normal49(name)&&(!team||team49(x.team)===team49(team)));
  } else {full.players=full.players.map(x=>({...x,games:x.games.slice(-4)}));}
  return result(full);
 }
 if(url.pathname==='/api/season-schedule'){
  const season=Number(url.searchParams.get('season'));if(!Number.isInteger(season)||season<2020||season>2035)return result({error:'Valid season required'},400);
  return result(await ffo50Schedule(season));
 }
 if(url.pathname==='/api/player-news'){
  const name=url.searchParams.get('name')||'';
  if(!/^[a-z .'-]{3,65}$/i.test(name))return result({error:'Valid player name required'},400);
  return result(await playerNews49(name));
 }
 if(url.pathname==='/api/target-share'){
  const name=url.searchParams.get('name')||'',team=url.searchParams.get('team')||'',season=Number(url.searchParams.get('season'));
  if(!/^[a-z .'-]{3,65}$/i.test(name)||!/^[A-Z]{2,4}$/i.test(team)||!Number.isInteger(season)||season<2020||season>2035)return result({error:'Valid player name, team and season required'},400);
  return result(await targetShare49(name,team,season));
 }
 if(url.pathname==='/api/game-plays'){
  // EXPERIMENTAL ESPN summary: last provider-published plays, NOT a licensed realtime push stream.
  const eventId=url.searchParams.get('event_id')||'';
  if(!/^\d{8,12}$/.test(eventId))return result({error:'Valid numeric ESPN game event ID required'},400);
  const upstream='https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event='+eventId;
  const response=await fetch(upstream,{headers:{accept:'application/json'},cf:{cacheEverything:true,cacheTtl:20}});
  if(!response.ok)throw Error('ESPN game summary HTTP '+response.status);
  const j=await response.json();
  const drives=[...(Array.isArray(j?.drives?.previous)?j.drives.previous:[]),...(j?.drives?.current?[j.drives.current]:[])];
  const plays=drives.flatMap(d=>Array.isArray(d?.plays)?d.plays:[]).map(p=>({
   id:String(p.id||''),text:String(p.text||'').slice(0,400),period:Number(p.period?.number||p.period||0)||null,
   clock:String(p.clock?.displayValue||p.clock||''),team:String(p.team?.abbreviation||''),scoring_play:!!p.scoringPlay
  })).filter(p=>p.text).slice(-12).reverse();
  return result({source:'ESPN NFL GAME SUMMARY',source_url:'https://www.espn.com/nfl/game/_/gameId/'+eventId,
   checked_at:new Date().toISOString(),event_id:eventId,plays,provider_status:String(j?.header?.competitions?.[0]?.status?.type?.description||''),
   verification:'Third-party source play descriptions. Updates can lag, omit plays or be corrected. Not certified as comprehensive realtime coverage or official fantasy scoring.'});
 }
 if(url.pathname==='/api/nfl-week'){
  const week=Number(url.searchParams.get('week')),season=Number(url.searchParams.get('season'));
  if(!Number.isInteger(week)||week<1||week>18||!Number.isInteger(season)||season<2020||season>2035)return result({error:'Valid season and NFL regular-season week (1–18) required'},400);
  return result(await weekContext(season,week));
 }
 if(url.pathname==='/api/player-health'){
  const ids=(url.searchParams.get('ids')||'').split(',').map(x=>x.trim()).filter(x=>/^[A-Za-z0-9_-]{1,40}$/.test(x)).slice(0,90);
  if(!ids.length)return result({error:'No player IDs provided'},400);
  const catalog=await sleeperJSON('/players/nfl',3600),players={};
  for(const id of ids){const p=catalog[id];if(!p)continue;players[id]={name:p.full_name||null,position:p.position||null,team:p.team||null,injury_status:p.injury_status||null,status:p.status||null,injury_notes:p.injury_notes||null,injury_body_part:p.injury_body_part||null};}
  return result({source:'Sleeper public NFL player directory metadata; not official health verification',checked_at:new Date().toISOString(),players,warning:'Status and metadata alone cannot verify IR return date, out-for-season reports, or official gameday actives; review ambiguous cases separately.'});
 }
 if(url.pathname==='/api/roster'){
  const id=url.searchParams.get('league_id')||'',rid=url.searchParams.get('roster_id')||'1';
  if(!/^\d{10,22}$/.test(id)||!/^\d{1,3}$/.test(rid))return result({error:'Valid league_id and roster_id required'},400);
  return result(await liveRoster(id,rid));
 }
 if(url.pathname==='/api/nfl-transactions'){
  const names=(url.searchParams.get('names')||'').split(',').map(s=>s.trim()).filter(s=>/^[a-z .'-]{3,60}$/i.test(s)).slice(0,35);
  if(!names.length)return result({source:'NFL.COM TRANSACTIONS',verified:false,reason:'Supply roster names with ?names=Christian%20Kirk,...',matches:[],checked_at:new Date().toISOString()});
  const evidence=await findTransactions(names);
  return result({source:'NFL.COM CATEGORIZED TRANSACTIONS',checked_at:new Date().toISOString(),verified:false,verification_scope:'CURRENT_PLAYER_STATUS_REQUIRES_COMPLETE_SUBSEQUENT_HISTORY',...evidence,reason:evidence.verified_count?'Dated transaction evidence exists, but current status remains unverified because subsequent transactions may be missing.':'No explicitly dated IR action found in scanned records; absence cannot establish active status.',warning:'Paginated sources are scanned with bounded page limits. Only explicit dated actions can be verified; incomplete coverage and absence cannot establish active status.',source_url:TX_BASE+'reserve-list/'+new Date().getUTCFullYear()+'/'+(new Date().getUTCMonth()+1)});
 }
 if(url.pathname==='/api/monitor-health'){
  const upstream=await fetch('https://dirty-birds-monitor-git.tvega2924.workers.dev/health',{headers:{accept:'application/json'},cf:{cacheTtl:0}});
  if(!upstream.ok)return result({error:'monitor upstream HTTP '+upstream.status},503);
  const status=await upstream.json();
  if(!status||!Array.isArray(status.checks))return result({error:status?.message||'No saved scheduled run'},503);
  // Return only source check summaries. No Cloudflare or Sleeper credentials.
  return result({checked_at:status.checked_at,checks:status.checks.map(x=>({name:x.name,ok:!!x.ok,checked_at:x.checked_at,source_timestamp:x.source_timestamp||null,error:x.error||null}))});
 }
 if(url.pathname==='/api/injuries'){
  const names=(url.searchParams.get('names')||'').split(',').map(x=>x.trim()).filter(x=>/^[a-z .'-]{3,60}$/i.test(x)).slice(0,45);
  const payload=await (await get(ESPN)).json();if(!Array.isArray(payload.injuries))throw Error('ESPN schema invalid');
  const all=flatten(payload);const injuries=names.length?all.filter(x=>names.some(n=>cleanName(n)===cleanName(x.name))):all;
  return result({source:'ESPN THIRD-PARTY',checked_at:new Date().toISOString(),query_names:names,injuries,matching_count:injuries.length,warning:'Not listed never means active or cleared; ESPN is not official IR verification.'});
 }
 if(url.pathname==='/api/nfl-official'){
  const names=(url.searchParams.get('names')||'').split(',').map(x=>x.trim()).filter(x=>/^[a-z .'-]{3,60}$/i.test(x)).slice(0,45);
  const html=await (await get(NFL)).text();const all=nflRows(html);if(all.length<20)throw Error('Official NFL rows not extractable; verification withheld');
  const players=names.length?all.filter(x=>names.some(n=>cleanName(n)===cleanName(x.name))):all;
  return result({source:'NFL.COM OFFICIAL INJURY REPORT',source_url:NFL,checked_at:new Date().toISOString(),query_names:names,players,count:players.length,source_count:all.length,report_type:'PRACTICE_AND_GAME_DESIGNATION_NOT_IR_ACTIVATION',warning:'Not listed does not establish healthy or active status.'});
 }
 return result({error:'unknown endpoint'},404);
 }catch(err){return result({verified:false,error:String(err.message||err),checked_at:new Date().toISOString()},503);}}};


/* FFO GameCast 0.4 — secure MySportsFeeds staging adapter.
   Use only behind verified Cloudflare Access (comIdentity in PFO worker).
   NO provider data is stored or logged. Private API; staging gate defaults OFF.
*/
const MSF_ROOT='https://api.mysportsfeeds.com/v2.1/pull/nfl';
const FFO_SEASON=/^(latest|current|20\d{2}-(regular|preseason|playoff)|20\d{2}-20\d{2}-(regular|preseason|playoff))$/;
const FFO_GAME=/^[a-zA-Z0-9_-]{1,75}$/;
const FFO_ROUTE=new Set(['health','season','schedule','stats','gamelogs','injuries','updates','plays','boxscore','lineup','espnplays']);
function ffoReply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}})}
function ffoBuildPath(route,params){
 if(!FFO_ROUTE.has(route))throw Error('unsupported_feed');
 const season=params.get('season')||'latest';if(!FFO_SEASON.test(season))throw Error('invalid_season');
 if(route==='season')return '/current_season.json';
 if(route==='injuries')return '/injuries.json';
 if(route==='health')throw Error('health_is_local');
 if(route==='schedule')return `/${season}/games.json`;
 if(route==='stats')return `/${season}/player_stats_totals.json`;
 if(route==='updates')return `/${season}/latest_updates.json`;
 if(route==='gamelogs'){
   const week=Number(params.get('week'));
   if(!Number.isInteger(week)||week<1||week>18)throw Error('week_required_1_to_18');
   return `/${season}/week/${week}/player_gamelogs.json`;
 }
 const game=params.get('game_id')||'';
 if(!FFO_GAME.test(game))throw Error('invalid_game_id');
 return `/${season}/games/${game}/${route==='plays'?'playbyplay':route}.json`;
}
/** Dependency-injection verifyAccess is mandatory; tests inject mocks only. */
async function ffoGamecastHandle(req,env,{verifyAccess,transport=fetch,now=()=>new Date().toISOString()}={}){
 const u=new URL(req.url),route=u.pathname.slice('/api/ffo/gamecast/'.length);
 if(!u.pathname.startsWith('/api/ffo/gamecast/')||!FFO_ROUTE.has(route))return ffoReply({error:'not_found'},404);
 if(req.method!=='GET')return ffoReply({error:'method_not_allowed'},405);
 if(typeof verifyAccess!=='function')return ffoReply({error:'authentication_not_configured'},503);
 try{await verifyAccess(req,env)}catch{return ffoReply({error:'access_required_or_forbidden'},403)}
 if(env.FFO_GAMECAST_ENABLED!=='true'&&!env.GAMECAST_INTERNAL)return ffoReply({ready:false,live:false,error:'gamecast_staging_disabled'},503);
 if(route==='espnplays'){
  // Supplemental third-party game-summary descriptions when licensed MSF PBP is unavailable.
  // Verified Cloudflare Access identity is required; NEVER claim an official MSF play feed.
  const home=String(u.searchParams.get('home')||'').toUpperCase(),away=String(u.searchParams.get('away')||'').toUpperCase();
  const when=String(u.searchParams.get('at')||'');const kickoff=new Date(when);
  if(!/^[A-Z]{2,3}$/.test(home)||!/^[A-Z]{2,3}$/.test(away)||home===away||!Number.isFinite(kickoff.getTime())||kickoff.getUTCFullYear()<2026||kickoff.getUTCFullYear()>2035)
    return ffoReply({error:'verified_game_teams_and_start_required'},400);
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(kickoff);
  const dates=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const date=dates.year+dates.month+dates.day;
  const base='https://site.api.espn.com/apis/site/v2/sports/football/nfl/';
  try{
   const board=await fetch(base+'scoreboard?dates='+date,{headers:{accept:'application/json'},cf:{cacheEverything:true,cacheTtl:90},signal:AbortSignal.timeout(8000)});
   if(!board.ok)return ffoReply({source:'ESPN summary',error:'scoreboard_unavailable',provider_http_status:board.status,checked_at:now()},502);
   const events=(await board.json()).events||[];
   const espnTeam=t=>({GBP:'GB',GNB:'GB',KCC:'KC',KAN:'KC',LAR:'LAR',LA:'LAR',JAC:'JAX',JAX:'JAX',WAS:'WSH',WSH:'WSH',OAK:'LV',STL:'LAR',SD:'LAC',ARZ:'ARI',NOR:'NO',TAM:'TB',SFO:'SF'}[String(t||'').toUpperCase()]||String(t||'').toUpperCase());
   const matches=events.filter(evt=>{
     const c=evt.competitions?.[0]?.competitors||[];
     return c.some(t=>t.homeAway==='home'&&espnTeam(t.team?.abbreviation)===espnTeam(home))&&c.some(t=>t.homeAway==='away'&&espnTeam(t.team?.abbreviation)===espnTeam(away));
   });
   if(matches.length!==1)return ffoReply({source:'ESPN summary',available:false,reason:'unique_game_match_not_found',checked_at:now(),games_found:matches.length});
   const event=matches[0],eventId=String(event.id);
   if(!/^\d{8,12}$/.test(eventId))return ffoReply({error:'invalid_provider_event_identifier'},502);
   const summary=await fetch(base+'summary?event='+eventId,{headers:{accept:'application/json'},cf:{cacheEverything:true,cacheTtl:15},signal:AbortSignal.timeout(9000)});
   if(!summary.ok)return ffoReply({source:'ESPN summary',error:'summary_unavailable',provider_http_status:summary.status,checked_at:now()},502);
   const doc=await summary.json(),drives=[...(Array.isArray(doc.drives?.previous)?doc.drives.previous:[]),...(doc.drives?.current?[doc.drives.current]:[])];
   const plays=drives.flatMap(d=>Array.isArray(d.plays)?d.plays:[]).map(p=>({
     id:String(p.id||''),description:String(p.text||'').slice(0,420),quarter:Number(p.period?.number)||null,
     time:String(p.clock?.displayValue||''),down:Number(p.start?.down)||null,
     yardsToFirstDown:Number.isFinite(Number(p.start?.distance))?Number(p.start.distance):null,
     startYardLine:Number.isFinite(Number(p.start?.yardLine))?Number(p.start.yardLine):null,
     endYardLine:Number.isFinite(Number(p.end?.yardLine))?Number(p.end.yardLine):null,
     yardsGained:Number.isFinite(Number(p.statYardage))?Number(p.statYardage):null,
     awayScore:Number.isFinite(Number(p.awayScore))?Number(p.awayScore):null,
     homeScore:Number.isFinite(Number(p.homeScore))?Number(p.homeScore):null,
     modified:String(p.modified||''),scoringPlay:!!p.scoringPlay
   })).filter(p=>p.id&&p.description).slice(-220);
   return ffoReply({source:'ESPN NFL game summary · supplemental',source_url:'https://www.espn.com/nfl/game/_/gameId/'+eventId,
     checked_at:now(),available:true,coverage:'published_drive_play_descriptions',full_playbyplay_authorized:false,
     live_delay_verified:false,provisional:true,game_status:event.status?.type?.description||null,
     event_id:eventId,provider_http_status:summary.status,data:{plays}});
  }catch{return ffoReply({source:'ESPN NFL game summary',error:'source_unreachable',checked_at:now()},502)}
 }
 if(route==='health')return ffoReply({source:'FFO GameCast',version:'0.4',ready:!!(env.MSF_API_KEY||env.GAMECAST_INTERNAL),live:false,live_verified:false,authenticated:true,provider_credential_configured:!!(env.MSF_API_KEY||env.GAMECAST_INTERNAL),checked_at:now()});
 if(!env.MSF_API_KEY&&!env.GAMECAST_INTERNAL)return ffoReply({error:'mysportsfeeds_key_not_configured'},503);
 let path;try{path=ffoBuildPath(route,u.searchParams)}catch(error){return ffoReply({error:error.message},400)}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),11000);
 let resp;
 try {resp=await transport(MSF_ROOT+path,{method:'GET',headers:{authorization:env.MSF_API_KEY?'Basic '+btoa(env.MSF_API_KEY+':MYSPORTSFEEDS'):'Service-Binding',accept:'application/json'},redirect:'manual',signal:controller.signal});}
 catch {return ffoReply({source:'MySportsFeeds',route,error:'provider_unreachable',checked_at:now()},502)}
 finally{clearTimeout(timer)}
 const meta={source:'MySportsFeeds',feed:route,checked_at:now(),provider_http_status:resp.status,provisional:true,live_delay_verified:false,licensed:true};
 if(resp.status===204||resp.status===304)return ffoReply({...meta,available:false,reason:resp.status===304?'provider_not_modified':'feed_not_ready'});
 if((resp.status===403||resp.status===404)&&route==='plays'){
   // This subscription does not currently authorize the full PBP feed.
   // Use ONLY the licensed MySportsFeeds boxscore's published scoring plays;
   // do not imply this is complete play-by-play or generate missing plays.
   try{
     const boxpath=ffoBuildPath('boxscore',u.searchParams);
     const backup=await transport(MSF_ROOT+boxpath,{method:'GET',headers:{authorization:env.MSF_API_KEY?'Basic '+btoa(env.MSF_API_KEY+':MYSPORTSFEEDS'):'Service-Binding',accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(11000)});
     if(backup.ok){
       const payload=await backup.json(),quarters=Array.isArray(payload?.scoring?.quarters)?payload.scoring.quarters:[];
       const plays=quarters.flatMap(q=>(Array.isArray(q.scoringPlays)?q.scoringPlays:[]).map((p,i)=>{
         const elapsed=Number(p.quarterSecondsElapsed),secs=Number.isFinite(elapsed)?Math.max(0,900-elapsed):null;
         const clock=secs===null?'':Math.floor(secs/60)+':'+String(secs%60).padStart(2,'0');
         return {id:'msf-boxscore-'+String(q.quarterNumber)+'-'+i,description:String(p.playDescription||''),quarter:q.quarterNumber,time:clock,source:'MSF boxscore',scoreChange:p.scoreChange,awayScore:p.awayScore,homeScore:p.homeScore};
       })).filter(p=>p.description);
       return ffoReply({...meta,source:'MySportsFeeds boxscore',provider_http_status:backup.status,original_playbyplay_status:resp.status,available:true,coverage:'scoring_only',full_playbyplay_authorized:false,verified_boxscore_feed:true,data:{plays,scoring_context:{quarter:payload?.scoring?.currentQuarter,down:payload?.scoring?.currentDown,remaining:payload?.scoring?.currentYardsRemaining,awayScoreTotal:payload?.scoring?.awayScoreTotal,homeScoreTotal:payload?.scoring?.homeScoreTotal}}});
     }
   }catch{/* A missing partial-scoring feed is never represented as zero plays. */}
 }
 if(resp.status===429)return ffoReply({...meta,error:'provider_rate_limited',retry_after_seconds:Number(resp.headers.get('retry-after'))||null},429);
 if(resp.status===401||resp.status===403)return ffoReply({...meta,error:'provider_auth_or_entitlement_denied'},502);
 if(resp.status===404)return ffoReply({...meta,error:'provider_feed_not_found'},502);
 if(!resp.ok)return ffoReply({...meta,error:'provider_upstream_error'},502);
 const len=Number(resp.headers.get('content-length')||0);
 if(len>4_000_000)return ffoReply({...meta,error:'provider_payload_exceeds_limit'},502);
 let str,payload;
 try{str=await resp.text();if(str.length>4_000_000)throw Error('too_large');payload=JSON.parse(str);if(!payload||typeof payload!=='object')throw Error('bad_payload');}
 catch{return ffoReply({...meta,error:'provider_payload_invalid_or_too_large'},502)}
 return ffoReply({...meta,available:true,unverified_schema:true,
  provider_updated_at:payload.lastUpdatedOn||payload.gameboxscore?.lastUpdatedOn||payload.gameplaybyplay?.lastUpdatedOn||payload.gamePlayByPlay?.lastUpdatedOn||null,
  data:payload});
}
