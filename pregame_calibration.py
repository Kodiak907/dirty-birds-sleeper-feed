#!/usr/bin/env python3
"""Pregame forecast locks and honest calibration from NFL scheduled kickoff times.

Store earliest verified pregame prediction PER PLAYER, never rewrite.
No retrospective/backfilled scoring. Read-only.
"""
import csv,io,json,datetime as dt,urllib.request
from pathlib import Path
D=Path(__file__).resolve().parent/"data"
URL="https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv"
def load(n):return json.loads((D/n).read_text(encoding="utf8"))
def save(n,data):(D/n).write_text(json.dumps(data,indent=2,sort_keys=True)+"\n",encoding="utf8")
def kickoff_map(season,week):
 req=urllib.request.Request(URL,headers={"User-Agent":"DirtyBirdsFFO/1.0"})
 with urllib.request.urlopen(req,timeout=40) as f:rows=list(csv.DictReader(io.StringIO(f.read().decode("utf-8-sig"))))
 games={}
 for r in rows:
  if str(r.get("season"))!=str(season) or str(r.get("week"))!=str(week):continue
  raw=r.get("gametime") or ""
  date=r.get("gameday") or ""
  try:
   # nflverse schedule gametime is US Eastern local time.
   from zoneinfo import ZoneInfo
   kick=dt.datetime.fromisoformat(date+"T"+raw).replace(tzinfo=ZoneInfo("America/New_York")).astimezone(dt.timezone.utc)
  except(ValueError,TypeError):continue
  for team in (r.get("home_team"),r.get("away_team")):
   if team:games[team]=kick
 return games
def main():
 now=dt.datetime.now(dt.timezone.utc)
 snap=load("latest.json")
 projections=load("ros_projections.json")
 names=load("player_names.json")
 week=int(snap["nfl_state"]["week"])
 season=int(snap["nfl_state"]["season"])
 roster=next(r for r in snap["rosters"] if r["roster_id"]==1)
 games=kickoff_map(season,week)
 path=D/"forecast_archive"/f"week_{week:02d}_locked_players.json"
 path.parent.mkdir(exist_ok=True)
 archive=json.loads(path.read_text()) if path.exists() else {
  "week":week,"season":season,"locked":{},"source":"nflverse schedule kickoff; Sleeper weekly predictions",
  "first_capture_utc":now.isoformat()}
 new=0
 for pid in roster.get("players") or []:
  pid=str(pid)
  if pid in archive["locked"]:continue
  meta=names.get(pid,{})
  team=meta.get("team")
  team={"LAR":"LA"}.get(team,team)
  kick=games.get(team)
  if kick is None or now>=kick:continue
  value=(projections["players"].get(meta.get("name"),{}).get("weeks") or {}).get(str(week))
  if not isinstance(value,(int,float)) or isinstance(value,bool):continue
  archive["locked"][pid]={"name":meta["name"],"team":team,"projection":value,
   "forecast_as_of":projections.get("as_of"),"locked_at_utc":now.isoformat(),
   "verified_kickoff_utc":kick.isoformat()}
  new+=1
 save("forecast_archive/"+path.name,archive)
 evaluations=[]
 for file in sorted(path.parent.glob("week_*_locked_players.json")):
  a=json.loads(file.read_text())
  w=int(a["week"])
  if w>=week:continue
  result=next((r for r in snap.get("matchups_by_week",{}).get(str(w),[])
    if r.get("roster_id")==1),None)
  if not result:continue
  scores=result.get("players_points") or {}
  pairs=[(obj["projection"],scores[pid]) for pid,obj in a["locked"].items()
    if pid in scores and isinstance(scores[pid],(int,float))]
  if pairs:
   evaluations.append({"week":w,"sample":len(pairs),
    "mae":round(sum(abs(p-y) for p,y in pairs)/len(pairs),3),
    "bias":round(sum(p-y for p,y in pairs)/len(pairs),3)})
 out={"updated_at_utc":now.isoformat(),"week":week,
  "locked_this_run":new,"total_locked_week":len(archive["locked"]),
  "nfl_schedule_teams_with_verified_kickoff":len(games),
  "eligible_completed_week_samples":sum(x["sample"] for x in evaluations),
  "evaluations":evaluations,
  "caveats":["An individual prediction qualifies only if saved before that player's team's verified kickoff.",
  "Historical week_XX_first.json predictions remain excluded from calibration.",
  "Predictions may still be stale at capture; availability must be verified separately.",
  "Projected points are not adjusted for uncertainty or changing lineups."]}
 save("PREGAME_CALIBRATION.json",out)
 lines=["# Pregame forecast locks and calibration","",
   f"Updated: {now.isoformat()}","",
   f"**Current Week {week}:** {len(archive['locked'])} locked player forecasts; {new} newly locked.",
   f"**Completed-week backtest sample:** {out['eligible_completed_week_samples']} actual player outcomes.","",
   "| Completed week | Players | MAE | Mean bias |","|---:|---:|---:|---:|"]
 for x in evaluations:lines.append(f"| {x['week']} | {x['sample']} | {x['mae']:.2f} | {x['bias']:+.2f} |")
 lines+=["","Forecast locks occur only before a verified NFL kickoff for the given team.",
  "This is forecast error measurement, not proof of decision effectiveness.","",
  "No trades, waivers or lineup changes occur."]
 (D/"PREGAME_CALIBRATION.md").write_text("\n".join(lines)+"\n")
 print(f"Pregame locks: {len(archive['locked'])} week {week}; evaluations: {len(evaluations)}")
if __name__=="__main__":main()
