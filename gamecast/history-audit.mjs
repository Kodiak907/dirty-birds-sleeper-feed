// Single diagnostic: report HTTP codes only, never response bodies or private keys.
export async function auditHistory(fetchFeed) {
  const season = "2026-2027-regular";
  const schedule = await fetchFeed(season + "/games.json");
  if (!schedule.ok) return {scheduleStatus:schedule.status};
  const data = await schedule.json();
  const games = Array.isArray(data.games) ? data.games : [];
  const check = [];
  for(let week=1;week<=7;week++) {
    const game = games.find(x=>Number(x.schedule?.week)===week && x.schedule?.playedStatus==="COMPLETED");
    if(!game) {check.push({week,reason:"no_completed_game"});continue}
    const id=game.schedule.id;
    const pbp=await fetchFeed(season+"/games/"+id+"/playbyplay.json");
    const box=await fetchFeed(season+"/games/"+id+"/boxscore.json");
    check.push({week,gameId:id,playedStatus:"COMPLETED",playbyplay:pbp.status,boxscore:box.status});
    await pbp.body?.cancel(); await box.body?.cancel();
  }
  return {season,checkedAt:new Date().toISOString(),checks:check};
}
