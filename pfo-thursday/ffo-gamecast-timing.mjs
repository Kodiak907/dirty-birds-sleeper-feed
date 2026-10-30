/* FFO GameCast — verified-data-only live poll timing; no fake game clock. */
export const LIVE_PLAY_MS=5000, LIVE_BOX_MS=10000, IDLE_PLAY_MS=120000;
export function isGamePollingLive(game,now=Date.now()){
 const status=String(game?.status||'').toLowerCase();
 if(/final|complete|postgame|post.game|cancel|postpon|suspend/.test(status))return false;
 if(/in.progress|in progress|inprogress|live|halftime|half.time/.test(status))return true;
 const kick=Date.parse(game?.start||'');
 // Feed labels sometimes remain "Scheduled" during an actual game.
 // The kickoff window is a request-timing heuristic, NOT proof of live status.
 return Number.isFinite(kick)&&now>=kick-5*60000&&now<=kick+5.5*3600000;
}
export function nextPlayPollMs(game,failures=0,now=Date.now()){
 const n=Math.max(0,Math.min(3,Number.isFinite(failures)?Math.floor(failures):0));
 return (isGamePollingLive(game,now)?LIVE_PLAY_MS:IDLE_PLAY_MS)*Math.min(8,2**n);
}
export function providerClock(play){
 const q=Number(play?.period),clock=String(play?.clock||'');
 if(!Number.isInteger(q)||q<1||q>5||!/^(?:0?[0-9]|1[0-5]):[0-5]\d$/.test(clock))return null;
 return {period:'Q'+q,clock,playId:String(play.id||'')};
}
