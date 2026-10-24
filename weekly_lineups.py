#!/usr/bin/env python3
"""Read-only weekly FFL optimizer and forward prediction archive.
Backtests ONLY archived pregame snapshots after completed weeks; no look-ahead.
"""
import json,datetime as dt
from pathlib import Path
from lineup_impact import build_lineup
D=Path(__file__).resolve().parent/"data"
def load(n):return json.loads((D/n).read_text(encoding="utf8"))
def write(n,obj):(D/n).write_text(json.dumps(obj,indent=2,sort_keys=True,ensure_ascii=False)+"\n",encoding="utf8")
def weekly_lineup(ids,names,ros,week):
 projected={}
 for p in names.values():
  n=p.get("name")
  record=ros.get(n,{})
  value=(record.get("weeks") or {}).get(str(week))
  if isinstance(value,(float,int)) and not isinstance(value,bool):
   projected[n]={"ppg":value}
 return build_lineup(ids,names,projected)
def main():
 latest=load("latest.json")
 names=load("player_names.json")
 ros=load("ros_projections.json")
 schedule=load("nfl_schedule.json")
 current=int((latest.get("nfl_state") or {}).get("week",7))
 roster=next(r for r in latest["rosters"] if r["roster_id"]==1)
 reserved={str(x) for x in roster.get("reserve") or []}
 eligible=[str(x) for x in roster.get("players") or [] if str(x) not in reserved]
 generated=dt.datetime.now(dt.timezone.utc).isoformat()
 out={"generated_at_utc":generated,"projection_source":ros.get("source"),
 "projection_as_of":ros.get("as_of"),"snapshot_utc":latest.get("fetched_at_utc"),
 "roster_id":1,"excluded_fantasy_reserve_player_ids":sorted(reserved),
 "model":"1 QB / 2 RB / 2 WR / 1 TE / 2 FLEX / K / DEF. Week-specific Sleeper forecast; missing estimates never imputed.",
 "warnings":["Current fantasy reserve players excluded; verify NFL availability separately.",
 "Publisher weekly estimates are not verified start/sit recommendations or injury predictions.",
 "Missing week forecasts block a complete lineup; playoff rank not simulated here.",
 "Pregame archives are only written if no existing file for the target week."],
 "weeks":{}}
 for week in range(current,18):
  lineup=weekly_lineup(eligible,names,ros["players"],week)
  for p in lineup.get("starters",[]):
   team=names.get(p["id"],{}).get("team")
   p["opponent"]=(schedule.get("teams",{}).get(team,{})
      .get("weeks",{}).get(str(week),{}).get("opponent"))
  out["weeks"][str(week)]=lineup
 archive=D/"forecast_archive";archive.mkdir(exist_ok=True)
 # Immutable first model prediction for current week; no rewriting after initial save.
 archive_path=archive/f"week_{current:02d}_first.json"
 if not archive_path.exists():
  write("forecast_archive/"+archive_path.name,{"week":current,"captured_at_utc":generated,
    "model_version":"weekly_lineup_v1","roster_id":1,"projection_as_of":ros.get("as_of"),
    "players":{name:info.get("weeks",{}).get(str(current))
      for name,info in ros.get("players",{}).items()
      if info.get("weeks",{}).get(str(current)) is not None},
    "recommended_lineup":out["weeks"][str(current)],
    "source_snapshot_utc":latest.get("fetched_at_utc")})
 # Calibration uses previously recorded forecasts only, excludes current week.
 evaluations=[]
 for file in sorted(archive.glob("week_*_first.json")):
  prior=json.loads(file.read_text())
  week=prior["week"]
  if week>=current:continue
  by_roster=[r for r in latest.get("matchups_by_week",{}).get(str(week),[]) if r.get("roster_id")==1]
  if not by_roster:continue
  actual=by_roster[0].get("players_points") or {}
  pairs=[]
  for name,pred in prior.get("players",{}).items():
   pid=next((id for id,meta in names.items() if meta.get("name")==name),None)
   if pid in actual and isinstance(pred,(int,float)) and isinstance(actual[pid],(int,float)):
    pairs.append({"name":name,"prediction":pred,"actual":actual[pid],"error":round(pred-actual[pid],2)})
  if pairs:
   evaluations.append({"week":week,"matched_players":len(pairs),
    "MAE":round(sum(abs(p["error"]) for p in pairs)/len(pairs),3),
    "bias":round(sum(p["error"] for p in pairs)/len(pairs),3)})
 out["backtesting"]={"status":"available" if evaluations else "awaiting_completed_week_with_archived_predictions",
    "evaluations":evaluations,
    "warning":"No retrospective claims from forecasts captured after kickoff. Only archived predictions are eligible."}
 write("WEEKLY_LINEUPS.json",out)
 lines=["# Dirty Birds — Week-by-Week Optimizer","",
  f"Generated: {generated} | Forecast as of: {ros.get('as_of')}","",
  "**Read-only; reserve players excluded. Estimates do not constitute verified active/inactive information.**",""]
 for week,result in out["weeks"].items():
  lines.extend([f"## Week {week}"+(" (playoffs)" if int(week)>=15 else ""),""])
  if not result.get("complete"):
   lines.append("**Incomplete projection coverage:** "+result.get("reason","missing lineup")+". No fabricated starter lineup.")
  else:
   lines.extend([f"**Projected optimal score:** {result['ppg']:.2f}","",
    "| Starter | Position | Opponent | Projection |","|---|---|---|---:|"])
   for p in result["starters"]:
    lines.append(f'| {p["name"]} | {p["position"]} | {p.get("opponent") or "Check schedule"} | {p["ppg"]:.2f} |')
  lines.append("")
 lines+=["## Prediction tracking and calibration","",
  "First stored forecast per week is retained; later updates will not overwrite it.",
  f"Completed-week archived evaluations: {len(evaluations)}.",
  "No historical forecast is constructed from final results. Model accuracy cannot be claimed before true pregame observations are evaluated."]
 (D/"WEEKLY_LINEUPS.md").write_text("\n".join(lines)+"\n",encoding="utf8")
 print("Weekly lineups: "+str(sum(x.get("complete",False) for x in out["weeks"].values()))+"/"+str(len(out["weeks"]))+" complete; archived backtests "+str(len(evaluations)))
if __name__=="__main__":main()
